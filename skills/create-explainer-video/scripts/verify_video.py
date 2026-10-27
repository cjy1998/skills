#!/usr/bin/env python3
"""Validate an H.264 explainer video using only Python's standard library."""

import argparse
import json
import math
import os
from pathlib import Path
import subprocess
import sys
import tempfile
from fractions import Fraction


class VideoError(Exception):
    """A controlled, user-facing validation error."""


class ArgumentParser(argparse.ArgumentParser):
    def error(self, message):
        raise VideoError("Invalid arguments: " + message)


def checked_text(value, label):
    text = os.fspath(value)
    if not text or any(char in text for char in ("\r", "\n", "\x00")):
        raise VideoError(label + " must be nonempty and contain no CR, LF or NUL")
    return text


def absolute_path(value, label):
    return Path(checked_text(value, label)).expanduser().absolute()


def input_path(value, label):
    path = absolute_path(value, label)
    if not path.is_file():
        raise VideoError(label + " is not a readable regular file: " + str(path))
    return path


def new_output_path(value, label):
    path = absolute_path(value, label)
    # lexists also rejects dangling symlinks; exists() alone would miss them.
    if os.path.lexists(path):
        raise VideoError(label + " already exists; refusing to overwrite: " + str(path))
    if not path.parent.is_dir():
        raise VideoError(label + " parent directory does not exist: " + str(path.parent))
    return path


def positive_fraction(value, label):
    try:
        result = Fraction(str(value))
    except (ValueError, ZeroDivisionError, TypeError):
        raise VideoError(label + " must be a positive number or fraction") from None
    if result <= 0:
        raise VideoError(label + " must be positive")
    return result


def positive_integer(value, label):
    try:
        result = int(str(value))
    except (ValueError, TypeError):
        raise VideoError(label + " must be a positive integer") from None
    if result <= 0:
        raise VideoError(label + " must be positive")
    return result


def tool_environment(executable):
    executable = checked_text(executable, "Executable")
    env = os.environ.copy()
    # Bare command names retain PATH lookup. Explicit paths add their own
    # library directory only in the child environment, never in global config.
    if os.path.dirname(executable):
        executable = str(absolute_path(executable, "Executable"))
        if sys.platform == "darwin":
            directory = str(Path(executable).parent)
            existing = env.get("DYLD_LIBRARY_PATH", "")
            env["DYLD_LIBRARY_PATH"] = directory + (os.pathsep + existing if existing else "")
    return executable, env


def run_tool(executable, arguments, label, *, capture=False, output=None, temp_dir=None):
    executable, env = tool_environment(executable)
    with tempfile.TemporaryFile(dir=temp_dir) as errors, tempfile.TemporaryFile(dir=temp_dir) as captured:
        destination = captured if capture else (output if output is not None else subprocess.DEVNULL)
        try:
            result = subprocess.run(
                [executable] + [os.fspath(arg) for arg in arguments],
                stdin=subprocess.DEVNULL,
                stdout=destination,
                stderr=errors,
                env=env,
                check=False,
            )
        except OSError as exc:
            raise VideoError(label + ": cannot execute tool (" + (exc.strerror or "OS error") + ")") from None
        if result.returncode != 0:
            raise VideoError(label + ": tool failed (exit " + str(result.returncode) + ")")
        # Tools run at error log level. Treat even a successful exit with error
        # diagnostics as failure, but never echo arbitrary tool stderr.
        if errors.tell():
            raise VideoError(label + ": tool reported errors; diagnostics suppressed")
        if capture:
            if captured.tell() > 8 * 1024 * 1024:
                raise VideoError(label + ": unexpectedly large metadata response")
            captured.seek(0)
            return captured.read()
    return None


def probe_media(video, ffprobe, *, temp_dir=None):
    raw = run_tool(
        ffprobe,
        ["-v", "error", "-count_frames", "-show_streams", "-show_format", "-of", "json", video],
        "Media probe", capture=True, temp_dir=temp_dir,
    )
    try:
        data = json.loads(raw)
    except (ValueError, UnicodeError):
        raise VideoError("Media probe returned invalid JSON") from None
    if not isinstance(data, dict) or not isinstance(data.get("streams"), list):
        raise VideoError("Media probe returned no stream metadata")
    if not all(isinstance(stream, dict) for stream in data["streams"]):
        raise VideoError("Media probe returned invalid stream metadata")
    return data


def duration(value, label):
    try:
        result = float(value)
    except (ValueError, TypeError):
        raise VideoError(label + " is missing or invalid") from None
    if not math.isfinite(result) or result <= 0:
        raise VideoError(label + " must be finite and positive")
    return result


def inspect_media(data, *, width=None, height=None, fps=None, frames=None):
    videos = [stream for stream in data["streams"] if stream.get("codec_type") == "video"]
    audios = [stream for stream in data["streams"] if stream.get("codec_type") == "audio"]
    if len(videos) != 1 or videos[0].get("disposition", {}).get("attached_pic"):
        raise VideoError("Exactly one non-attached video stream is required")
    video = videos[0]
    if video.get("codec_name") != "h264":
        raise VideoError("Video codec must be H.264")
    if video.get("pix_fmt") not in ("yuv420p", "yuvj420p"):
        raise VideoError("Video pixel format must be yuv420p or yuvj420p")
    actual_width = positive_integer(video.get("width"), "Video width")
    actual_height = positive_integer(video.get("height"), "Video height")
    if width is not None and actual_width != positive_integer(width, "Expected width"):
        raise VideoError("Video width mismatch: expected " + str(width) + ", got " + str(actual_width))
    if height is not None and actual_height != positive_integer(height, "Expected height"):
        raise VideoError("Video height mismatch: expected " + str(height) + ", got " + str(actual_height))
    nominal_fps = positive_fraction(video.get("r_frame_rate"), "Video frame rate")
    average_fps = positive_fraction(video.get("avg_frame_rate"), "Average frame rate")
    if nominal_fps != average_fps:
        raise VideoError("Variable or inconsistent video frame rate is not supported")
    if fps is not None and nominal_fps != positive_fraction(fps, "Expected frame rate"):
        raise VideoError("Video frame rate mismatch: expected " + str(fps) + ", got " + str(nominal_fps))
    time_base = positive_fraction(video.get("time_base"), "Video time base")
    actual_frames = positive_integer(video.get("nb_read_frames"), "Decoded frame count")
    declared_frames = video.get("nb_frames")
    if declared_frames not in (None, "N/A"):
        if positive_integer(declared_frames, "Declared frame count") != actual_frames:
            raise VideoError("Declared frame count does not match decoded frame count")
    if frames is not None and actual_frames != positive_integer(frames, "Expected frame count"):
        raise VideoError("Frame count mismatch: expected " + str(frames) + ", got " + str(actual_frames))
    video_duration = duration(video.get("duration"), "Video duration")
    expected_duration = float(Fraction(actual_frames, 1) / nominal_fps)
    tolerance = max(0.001, float(1 / nominal_fps) / 2, float(time_base) * 2)
    if abs(video_duration - expected_duration) > tolerance:
        raise VideoError("Video duration does not match frame count / frame rate")
    container_duration = duration(data.get("format", {}).get("duration"), "Container duration")
    if container_duration + tolerance < video_duration:
        raise VideoError("Container duration is shorter than the video")
    audio_info = []
    for audio in audios:
        if audio.get("codec_name") != "aac":
            raise VideoError("Every audio stream must be AAC (no audio is also allowed)")
        info = {"codec": "aac", "sample_rate": audio.get("sample_rate"), "channels": audio.get("channels")}
        if audio.get("duration") not in (None, "N/A"):
            info["duration_seconds"] = duration(audio["duration"], "Audio duration")
        audio_info.append(info)
    return {
        "codec": "h264", "pixel_format": video["pix_fmt"], "profile": video.get("profile"),
        "width": actual_width, "height": actual_height,
        "fps": str(nominal_fps), "time_base": str(time_base), "frames": actual_frames,
        "duration_seconds": video_duration, "container_duration_seconds": container_duration,
        "audio": audio_info,
    }


def decode_video(video, ffmpeg, *, temp_dir=None):
    # Packaged FFmpeg builds may lack the default wrapped_avframe encoder.
    run_tool(
        ffmpeg,
        ["-hide_banner", "-v", "error", "-nostdin", "-xerror", "-i", video,
         "-map", "0:v:0", "-map", "0:a?", "-c:v", "rawvideo", "-c:a", "pcm_s16le", "-f", "null", "-"],
        "Full video/audio decode", temp_dir=temp_dir,
    )


def verify_video(video, ffmpeg="ffmpeg", ffprobe="ffprobe", *, width=1080, height=1920,
                 fps=30, frames=None, temp_dir=None):
    video = input_path(video, "Video")
    result = inspect_media(
        probe_media(video, ffprobe, temp_dir=temp_dir), width=width, height=height, fps=fps, frames=frames,
    )
    decode_video(video, ffmpeg, temp_dir=temp_dir)
    result.update({"ok": True, "video": str(video), "decode": "ok"})
    return result


def remove_owned_file(path, identity):
    """Never delete a preexisting/replaced file during failure cleanup."""
    try:
        current = os.lstat(path)
        if (current.st_dev, current.st_ino) == (identity.st_dev, identity.st_ino):
            os.unlink(path)
    except OSError:
        pass


def write_report(path, result):
    fd = os.open(path, os.O_WRONLY | os.O_CREAT | os.O_EXCL, 0o644)
    identity = os.fstat(fd)
    try:
        with os.fdopen(fd, "w", encoding="utf-8") as report:
            json.dump(result, report, ensure_ascii=False, indent=2)
            report.write("\n")
    except BaseException:
        remove_owned_file(path, identity)
        raise


def print_error(exc):
    if isinstance(exc, VideoError):
        message = str(exc)
    elif isinstance(exc, OSError):
        message = "File operation failed: " + (exc.strerror or "OS error")
    elif isinstance(exc, KeyboardInterrupt):
        message = "Cancelled"
    else:
        message = "Unexpected failure (" + type(exc).__name__ + ")"
    print(json.dumps({"ok": False, "error": message}, ensure_ascii=False))


def main(argv=None):
    parser = ArgumentParser(description=__doc__)
    parser.add_argument("video")
    parser.add_argument("--ffmpeg", default="ffmpeg")
    parser.add_argument("--ffprobe", default="ffprobe")
    parser.add_argument("--width", default=1080, type=int)
    parser.add_argument("--height", default=1920, type=int)
    parser.add_argument("--fps", default="30", help="Frame rate, e.g. 30 or 30000/1001")
    parser.add_argument("--frames", type=int)
    parser.add_argument("--report", help="New JSON report path; existing files are never overwritten")
    try:
        args = parser.parse_args(argv)
        positive_integer(args.width, "Expected width")
        positive_integer(args.height, "Expected height")
        positive_fraction(args.fps, "Expected frame rate")
        if args.frames is not None:
            positive_integer(args.frames, "Expected frame count")
        report = new_output_path(args.report, "Report") if args.report is not None else None
        result = verify_video(
            args.video, args.ffmpeg, args.ffprobe,
            width=args.width, height=args.height, fps=args.fps, frames=args.frames,
        )
        if report is not None:
            write_report(report, result)
        summary = {key: result[key] for key in ("ok", "video", "frames", "duration_seconds", "fps", "decode")}
        summary["audio"] = "aac" if result["audio"] else "none"
        if report is not None:
            summary["report"] = str(report)
        print(json.dumps(summary, ensure_ascii=False))
        return 0
    except (Exception, KeyboardInterrupt) as exc:
        print_error(exc)
        return 130 if isinstance(exc, KeyboardInterrupt) else 1


if __name__ == "__main__":
    sys.exit(main())
