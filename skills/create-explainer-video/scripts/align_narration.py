#!/usr/bin/env python3
"""Align one continuous PCM16 narration to scene-local manuscript captions."""

import argparse
import difflib
import hashlib
import io
import json
import math
import os
import re
import sys
import tempfile
import wave
from pathlib import Path


ASR_PARAMETERS = {
    "language": "zh",
    "word_timestamps": True,
    "temperature": 0.0,
    "condition_on_previous_text": True,
    "verbose": False,
}


def normalized(text):
    return "".join(char.lower() for char in text if char.isalnum())


def split_text(text):
    """Return (display text, first raw index, last raw index), within one scene."""
    chunks = []
    for match in re.finditer(r"[^，。？！；：、\n]+[，。？！；：、]?", text):
        raw, start = match.group(), match.start()
        while raw:
            weight, take = 0.0, 0
            for char in raw:
                weight += 0.53 if ord(char) < 128 else 1.0
                if weight > 32:
                    break
                take += 1
            if take < len(raw):
                space = raw.rfind(" ", 0, take)
                if space > take // 2:
                    take = space + 1
            label = raw[:take].strip().rstrip("，。；：、")
            indexes = [start + i for i, char in enumerate(raw[:take]) if char.isalnum()]
            if indexes:
                chunks.append((label, indexes[0], indexes[-1]))
            start += take
            raw = raw[take:]
    return chunks


def read_json(path):
    with path.open(encoding="utf-8") as reader:
        return json.load(reader)


def read_story(path):
    story = read_json(path)
    if not isinstance(story, list) or not story:
        raise ValueError("story 必须是非空分幕数组")
    scenes, ids = [], set()
    for scene in story:
        if not isinstance(scene, dict):
            raise ValueError("story 每幕必须是对象")
        scene_id, text = scene.get("id"), scene.get("text")
        if not isinstance(scene_id, str) or not scene_id or scene_id in ids:
            raise ValueError("每幕 id 必须为非空且唯一的字符串")
        if not isinstance(text, str) or not normalized(text):
            raise ValueError(f"幕 {scene_id} 缺少有效原稿")
        text = text.replace("SKILL 点 MD", "SKILL.md")
        chunks = split_text(text)
        if not chunks:
            raise ValueError(f"幕 {scene_id} 无可用字幕")
        scenes.append({"id": scene_id, "text": text, "chunks": chunks})
        ids.add(scene_id)
    return scenes


def waveform(path, np):
    """Hash the same bytes decoded; duration comes from actual complete samples."""
    source = path.read_bytes()
    source_hash = hashlib.sha256(source).hexdigest()
    with wave.open(io.BytesIO(source), "rb") as reader:
        channels = reader.getnchannels()
        rate = reader.getframerate()
        if reader.getsampwidth() != 2 or reader.getcomptype() != "NONE":
            raise ValueError("音频必须为未压缩 PCM16 WAV")
        if channels < 1 or rate < 1:
            raise ValueError("WAV 声道数或采样率无效")
        raw = reader.readframes(reader.getnframes())
    if not raw or len(raw) % (2 * channels):
        raise ValueError("WAV 实样本为空或含不完整采样帧")
    samples = np.frombuffer(raw, dtype="<i2").reshape(-1, channels)
    duration = len(samples) / rate
    mono = (samples.astype(np.float32) / 32768.0).mean(axis=1)
    if rate != 16000:
        positions = np.arange(math.ceil(len(mono) * 16000 / rate)) * rate / 16000
        mono = np.interp(positions, np.arange(len(mono)), mono).astype(np.float32)
    return mono, duration, source_hash


def model_fingerprint(model):
    """Local path/mtime manifest: never resolve a repository through a network API."""
    digest = hashlib.sha256()
    digest.update(str(model).encode("utf-8"))
    for entry in [model, *sorted(model.rglob("*"))]:
        stat = entry.stat()
        record = [entry.relative_to(model).as_posix(), stat.st_size, stat.st_mtime_ns]
        digest.update(json.dumps(record, ensure_ascii=False).encode("utf-8"))
        digest.update(b"\n")
    return digest.hexdigest()


def obtain_asr(args, audio, source_hash, fingerprint):
    if args.asr_json is not None:
        result = read_json(args.asr_json)
        if not isinstance(result, dict) or result.get("sourceSha256") != source_hash:
            raise ValueError("--asr-json 的 sourceSha256 与音频不匹配；拒绝旧时间戳")
        print("使用已有 ASR：音频 SHA256 已核验，未调用模型。", flush=True)
        return result, False

    if args.cache.exists():
        try:
            cached = read_json(args.cache)
        except (ValueError, UnicodeError):
            cached = None
        if isinstance(cached, dict) and cached.get("fingerprint") == fingerprint:
            result = cached.get("result")
            if isinstance(result, dict) and result.get("sourceSha256") == source_hash:
                print("ASR 缓存命中：音频、模型、prompt 和识别参数一致。", flush=True)
                return result, False
        print("ASR 缓存指纹不符或损坏：重新识别，不复用旧时间戳。", flush=True)
    else:
        print("ASR 无缓存：使用本地模型识别。", flush=True)

    # Only the recognition branch imports MLX; --help and --asr-json never do.
    import mlx_whisper

    result = mlx_whisper.transcribe(
        audio,
        path_or_hf_repo=str(args.model),
        initial_prompt=args.prompt or None,
        **ASR_PARAMETERS,
    )
    if not isinstance(result, dict):
        raise ValueError("ASR 未返回有效对象")
    result["sourceSha256"] = source_hash
    return result, True


def heard_characters(result, duration):
    segments = result.get("segments")
    if not isinstance(segments, list) or not segments:
        raise ValueError("ASR 缺少 segments/word timestamps")
    heard, times = [], []
    previous_start = -1.0
    for segment in segments:
        if not isinstance(segment, dict) or not isinstance(segment.get("words"), list):
            raise ValueError("ASR 每段必须包含 word timestamps")
        segment_chars = []
        for word in segment["words"]:
            if not isinstance(word, dict) or not isinstance(word.get("word"), str):
                raise ValueError("ASR word 格式无效")
            start, end = word.get("start"), word.get("end")
            if any(isinstance(t, bool) or not isinstance(t, (int, float)) or not math.isfinite(t)
                   for t in (start, end)):
                raise ValueError("ASR word 时间戳必须是有限数字")
            if not 0 <= start <= end <= duration or start < previous_start:
                raise ValueError("ASR word 时间戳倒序或超出音频边界")
            previous_start = start
            chars = normalized(word["word"])
            segment_chars.append(chars)
            for i, char in enumerate(chars):
                time = start + (end - start) * (i + 0.5) / len(chars)
                if times and time < times[-1]:
                    raise ValueError("ASR 字符时间戳倒序")
                heard.append(char)
                times.append(time)
        if "text" in segment:
            if not isinstance(segment["text"], str) or normalized(segment["text"]) != "".join(segment_chars):
                raise ValueError("ASR 段落文本与 word timestamps 不一致")
    if not heard:
        raise ValueError("ASR 没有可对齐字符")
    return "".join(heard), times


def align(story, result, duration, np):
    reference = "".join(normalized(scene["text"]) for scene in story)
    heard, times = heard_characters(result, duration)
    matcher = difflib.SequenceMatcher(None, reference, heard, autojunk=False)
    anchors = {}
    for a, b, size in matcher.get_matching_blocks():
        for k in range(size):
            anchors[a + k] = times[b + k]
    coverage, precision = len(anchors) / len(reference), len(anchors) / len(heard)
    if coverage < 0.95 or precision < 0.95:
        raise ValueError(f"全文核验失败：cov={coverage:.2%}, precision={precision:.2%}（均需 ≥95%）")
    if not heard.startswith(reference[:10]) or not heard.endswith(reference[-10:]):
        raise ValueError("全文核验失败：首尾各 10 个有效字符必须精确匹配")

    checks, offset = [], 0
    for scene in story:
        length = len(normalized(scene["text"]))
        ratio = sum(index in anchors for index in range(offset, offset + length)) / length
        if ratio < 0.85:
            raise ValueError(f"幕 {scene['id']} 核验失败：cov={ratio:.2%}（需 ≥85%）")
        checks.append({"id": scene["id"], "cov": ratio})
        offset += length

    anchors.setdefault(0, times[0])
    anchors.setdefault(len(reference) - 1, times[-1])
    keys = sorted(anchors)
    aligned = np.maximum.accumulate(
        np.interp(np.arange(len(reference)), keys, [anchors[key] for key in keys])
    )
    groups, offset = [], 0
    duration_ms = math.floor(duration * 1000)
    for scene in story:
        raw_times = {}
        for index, char in enumerate(scene["text"]):
            if char.isalnum():
                raw_times[index] = float(aligned[offset])
                offset += len(char.lower())
        group = []
        # Splitting each scene independently prevents punctuation joining scenes.
        for label, first, last in scene["chunks"]:
            start = round(max(0.0, raw_times[first] - 0.10), 3)
            end = min(duration_ms / 1000, round(max(start + 0.25, raw_times[last] + 0.20), 3))
            group.append({"start": start, "end": end, "text": label})
        groups.append(group)
    cues = [cue for group in groups for cue in group]
    for cue, following in zip(cues, cues[1:]):
        if following["start"] - cue["end"] < 0.55:
            cue["end"] = following["start"]
    previous = 0.0
    for cue in cues:
        if not previous <= cue["start"] < cue["end"] <= duration:
            raise ValueError("字幕时间重叠、零长度或超出音频边界")
        previous = cue["end"]
    return groups, {"cov": coverage, "precision": precision, "perScene": checks}


def srt_time(ms):
    hours, ms = divmod(ms, 3600000)
    minutes, ms = divmod(ms, 60000)
    seconds, ms = divmod(ms, 1000)
    return f"{hours:02}:{minutes:02}:{seconds:02},{ms:03}"


def make_film(args, story, groups, duration, source_hash, audit):
    total_frames = args.audio_start + math.ceil(duration * args.fps) + args.end_pad
    boundaries = [0] + [args.audio_start + round(group[0]["start"] * args.fps)
                        for group in groups[1:]] + [total_frames]
    scenes, subtitles = [], []
    previous_ms = 0
    audio_end = args.audio_start / args.fps + duration
    for index, (scene, group) in enumerate(zip(story, groups)):
        start_frame, end_frame = boundaries[index:index + 2]
        if end_frame <= start_frame:
            raise ValueError(f"幕 {scene['id']} 帧边界无效")
        scene_start = start_frame / args.fps
        scene_duration = (end_frame - start_frame) / args.fps
        offset = args.audio_start / args.fps - scene_start
        captions, previous = [], 0.0
        for cue in group:
            start = max(0.0, round(cue["start"] + offset, 4))
            end = min(scene_duration, audio_end - scene_start, round(cue["end"] + offset, 4))
            if not previous <= start < end <= scene_duration:
                raise ValueError(f"幕 {scene['id']} 字幕重叠、零长度或越界")
            previous = end
            captions.append({"start": start, "end": end, "text": cue["text"]})
            # Quantize inward so SRT cannot extend beyond the film's frame bounds.
            start_ms = math.ceil((scene_start + start) * 1000)
            end_ms = math.floor((scene_start + end) * 1000)
            if not previous_ms <= start_ms < end_ms:
                raise ValueError("SRT 毫秒量化后字幕重叠或零长度")
            previous_ms = end_ms
            subtitles.append(f"{len(subtitles) + 1}\n{srt_time(start_ms)} --> {srt_time(end_ms)}\n{cue['text']}\n")
        scenes.append({"id": scene["id"], "from": start_frame,
                       "frames": end_frame - start_frame, "captions": captions})
    film = {
        "previewMode": False,
        "audioFile": args.audio_ref,
        "audioSha256": source_hash,
        "storySha256": hashlib.sha256(args.story.read_bytes()).hexdigest(),
        "audioDurationSec": duration,
        "fps": args.fps,
        "audioStart": args.audio_start,
        "totalFrames": total_frames,
        "scenes": scenes,
        "audit": audit,
    }
    return film, "\n".join(subtitles)


def write_exclusive_pair(output, film_text, srt, srt_text):
    """Reserve both destinations exclusively; roll back only our own new files."""
    opened = []
    try:
        for path, text in ((output, film_text), (srt, srt_text)):
            writer = path.open("x", encoding="utf-8")
            opened.append((path, writer, text))
        for _, writer, text in opened:
            writer.write(text)
            writer.flush()
        for _, writer, _ in opened:
            writer.close()
    except BaseException:
        for path, writer, _ in opened:
            writer.close()
            path.unlink()
        raise


def write_cache(path, fingerprint, result):
    text = json.dumps({"fingerprint": fingerprint, "result": result}, ensure_ascii=False,
                      indent=2, allow_nan=False) + "\n"
    temporary = None
    try:
        with tempfile.NamedTemporaryFile(mode="w", encoding="utf-8", dir=path.parent,
                                         prefix=".asr-cache-", delete=False) as writer:
            temporary = Path(writer.name)
            writer.write(text)
        os.replace(temporary, path)
    finally:
        if temporary is not None and temporary.exists():
            temporary.unlink()


def parse_args():
    parser = argparse.ArgumentParser(description=__doc__)
    for flag, help_text in (
        ("story", "分幕原稿 JSON（id/text 数组）"),
        ("audio", "单轨连续 PCM16 WAV"),
        ("model", "已存在的本地 Whisper 模型目录；禁止自动下载"),
        ("output", "新 film JSON；父目录必须存在"),
        ("srt", "新 SRT；父目录必须存在"),
        ("cache", "可更新的 ASR 指纹缓存；父目录必须存在"),
    ):
        parser.add_argument("--" + flag, required=True, type=Path, help=help_text)
    parser.add_argument("--audio-ref", required=True, help="安全的 public 相对路径，例如 audio/narration.wav")
    parser.add_argument("--asr-json", type=Path, help="已有 ASR，必须含匹配音频的 sourceSha256；不调用模型")
    parser.add_argument("--prompt", default="", help="简短术语，单行最多 200 字符；不要传全文")
    parser.add_argument("--fps", type=int, default=30)
    parser.add_argument("--audio-start", type=int, default=8, help="音频起始帧，默认 8")
    parser.add_argument("--end-pad", type=int, default=33, help="结尾留白帧，默认 33")
    args = parser.parse_args()
    if args.fps <= 0 or args.audio_start < 0 or args.end_pad < 0:
        raise ValueError("fps 必须为正整数；audio-start/end-pad 不得为负")
    if len(args.prompt) > 200 or any(ord(char) < 32 or ord(char) == 127 for char in args.prompt):
        raise ValueError("--prompt 仅接受单行简短术语（最多 200 字符）")
    ref = args.audio_ref
    if (not ref or ref != ref.strip() or ".." in ref or any(char in ref for char in "\\:#?%")
            or any(ord(char) < 32 or ord(char) == 127 for char in ref)
            or any(part in ("", ".", "..") for part in ref.split("/"))):
        raise ValueError("--audio-ref 必须为安全 public 相对路径；禁止绝对地址、.. 或 URL")
    for name in ("story", "audio", "model", "output", "srt", "cache", "asr_json"):
        path = getattr(args, name)
        if path is not None:
            setattr(args, name, path.expanduser().absolute())
    args.model = args.model.resolve()
    if not args.model.is_dir():
        raise ValueError("--model 必须为已存在的本地目录；不会自动下载模型")
    for name in ("story", "audio", "asr_json"):
        path = getattr(args, name)
        if path is not None and not path.is_file():
            raise ValueError(f"--{name.replace('_', '-')} 必须为已存在的文件")
    destinations = [args.output, args.srt, args.cache]
    inputs = [args.story, args.audio] + ([args.asr_json] if args.asr_json else [])
    resolved = [path.resolve() for path in destinations]
    if len(set(resolved)) != 3 or set(resolved) & {path.resolve() for path in inputs}:
        raise ValueError("output、srt、cache 必须互不相同且不得覆盖输入文件")
    for path in destinations:
        if not path.parent.is_dir():
            raise ValueError("输出/SRT/cache 父目录必须已存在；不会创建目录")
    for path in (args.output, args.srt):
        if os.path.lexists(path):
            raise ValueError("输出或 SRT 已存在；拒绝覆盖")
    if args.cache.is_symlink() or (args.cache.exists() and not args.cache.is_file()):
        raise ValueError("cache 必须为普通文件路径，不得为目录或符号链接")
    return args


def main():
    args = parse_args()
    # Argument validation (including --help) does not require NumPy or MLX.
    import numpy as np

    story = read_story(args.story)
    audio, duration, source_hash = waveform(args.audio, np)
    fingerprint = {
        "version": 1,
        "sourceSha256": source_hash,
        "modelFingerprint": model_fingerprint(args.model),
        "prompt": args.prompt,
        "recognitionParameters": {**ASR_PARAMETERS, "initial_prompt": args.prompt or None},
        "waveform": {"sampleRate": 16000, "channelMix": "mean", "sampleFormat": "PCM16"},
    }
    result, new_cache = obtain_asr(args, audio, source_hash, fingerprint)
    groups, audit = align(story, result, duration, np)
    film, subtitles = make_film(args, story, groups, duration, source_hash, audit)
    film_text = json.dumps(film, ensure_ascii=False, indent=2, allow_nan=False) + "\n"
    if new_cache:
        write_cache(args.cache, fingerprint, result)
    write_exclusive_pair(args.output, film_text, args.srt, subtitles)
    print(f"完成：{len(film['scenes'])} 幕，{sum(len(g) for g in groups)} 条字幕，"
          f"{film['totalFrames']} 帧；cov={audit['cov']:.2%}，precision={audit['precision']:.2%}。")
    return 0


if __name__ == "__main__":
    try:
        sys.exit(main())
    except KeyboardInterrupt:
        print("错误：操作已取消。", file=sys.stderr)
        sys.exit(130)
    except Exception as error:
        message = " ".join(str(error).split())[:240] or type(error).__name__
        print(f"错误：{message}", file=sys.stderr)
        sys.exit(1)
