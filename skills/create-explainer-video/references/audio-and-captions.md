# 连续旁白与字幕

## 百炼模型与音色

参数核实日期：2026-10-27。使用时再次查官方文档，不能以这次成功推断未来版本或任意长文本限制。

- [Qwen-Audio 3.1 TTS Plus](https://help.aliyun.com/zh/model-studio/qwen-audio-3-1-tts-plus)
- [HTTP 接口](https://help.aliyun.com/zh/model-studio/qwen-audio-tts-http-api)
- [音色列表](https://help.aliyun.com/zh/model-studio/qwen-audio-tts-voice-list)

本片已成功使用：

```json
{
  "model": "qwen-audio-3.1-tts-plus",
  "input": {
    "text": "用户已确认的完整口播稿",
    "voice": "longanlingxin_v3.1",
    "format": "mp3",
    "sample_rate": 24000
  }
}
```

- `model`：选择真实支持预置 `voice` 的模型；这是参考片的模型，不是新选题的必选项。
- `text`：完整连续口播，不能逐幕独立随机生成后拼成十八种声音。先确认稿件，整片授权后才调用。
- `voice`：用户试听确认的音色标识；龙安灵心是本片选定女声，不强制所有视频沿用。
- `format`：本次请求 MP3，保存原始结果后本地转 PCM WAV 供时长与对齐使用。
- `sample_rate`：本次 24000 Hz；按当前接口支持设置，不能随意假设任意采样率可用。

对应端点：`https://dashscope.aliyuncs.com/api/v1/services/audio/tts/SpeechSynthesizer`。地域、账户与权限按实际百炼账户选择，不跨地域搬用密钥。

`qwen-audio-3.1-tts-next` 的生成接口使用提示与参考音频，不可把 Plus 的 `input.voice` 照搬过去并声称声音已锁定。新模型先核对参数表和实际试听。

截至上述日期，未获得可据以保证任意三分钟全文完整生成的明确单次上限；参考片一次生成 205.968 秒成功只是实例。超限时先规划分块及同声音锚定并试听跨块，不能猜测 `max_tokens` 或默默删稿。

## 收费、缓存与凭证

- 只从受控环境变量或用户明确提供的本机凭证位置读取密钥；不要要求贴进聊天，不放入代码、命令行参数、报告、Skill 或 Git。
- 调用前确认是否收费、发送哪些文字/参考音频；真人参考声音上传需单独授权。
- 将端点、模型、音色及文本参数哈希为请求指纹，发请求前落盘 `request-started`。只有相同指纹、成功状态、存在素材及文件 SHA 一致时复用。
- 请求失败或记录已开始但结果不明时停止调查，不自动重试以免重复计费；不偷换音色或模型。
- 密钥可经 curl stdin 配置传递，避免出现在进程参数；清除不必要的子进程密钥环境。不输出完整响应或带签名下载链接。
- 保存 MP3 原件，安全检查下载链接，核对 PCM 时长、首尾内容后再进入制作。本 Skill 不附收费调用脚本，也不进行自动 API 请求。

## 响度与真实时长

参考片采用两遍 `loudnorm`：I=-18 LUFS、TP=-2 dBTP、LRA=9；这些是本片目标，不是所有平台强制要求。

1. 先按最终声道布局测量。单声道改立体声可能带来约 3 dB 测量差异，不能测单声道后盲套立体声目标。
2. 第二遍填入第一遍的 `measured_I`、`measured_TP`、`measured_LRA`、`measured_thresh` 与 `offset`，输出 24 kHz、立体声 PCM16 WAV；已有输出不覆盖。
3. 再测最终 WAV，检查目标响度、真峰值和削波。以 `WAV样本帧数 / 采样率` 得实际时长，不单信 MP3/API 元数据。
4. 当 FFmpeg 默认空输出编码器不可用时，测量显式指定 `-c:a pcm_s16le -f null -`。

响度归一解决音量一致，不解决音色、说话方式或模型随机声音的变化。

## 本地 ASR 与对齐

`scripts/align_narration.py` 使用 NumPy 和 MLX Whisper，当前识别后端限 Apple Silicon / MLX 适用环境；其他系统必须换本地识别后端或导入已核对的字词时间戳，不承诺脚本原样可运行。安装 Python 包、下载模型先取得授权；脚本只接收已存在的本地模型目录，不自动下载。

在工作项目根目录运行，先保留旧时间轴并使用新输出文件名：

```bash
python3 "$SKILL_DIR/scripts/align_narration.py" \
  --story src/story.json --audio public/audio/narration.wav \
  --model "$LOCAL_WHISPER_MODEL" --audio-ref audio/narration.wav \
  --output src/film-new.json --srt out/captions-new.srt \
  --cache out/narration-asr.json \
  --prompt '简体中文科技科普。AI，Skill，SKILL.md。'
```

- `$SKILL_DIR`：当前安装或合集里的本 Skill 目录；不写入作者本机绝对路径。
- `--story`：按幕原稿；字幕取这里，不使用识别错字作为显示文本。
- `--audio`：已确认连续旁白 PCM16 WAV；只做识别和对齐，不调用 TTS、不改变声音。
- `--model`：已下载本地 Whisper 目录，缺失即停止，不能自动联网下载。
- `--audio-ref`：音频在 `public/` 内的相对路径；生成的清单据此加载声音，不能包含 `..` 或绝对路径。
- `--output` / `--srt`：新时间轴 JSON 与字幕文件；父目录需已存在，已有文件拒绝覆盖。核验后将新清单替换工作副本的 `src/film.json`，不要直接覆盖已确认版本。
- `--cache`：本地识别缓存；音频、模型或提示变更后失效，不沿用旧时间戳。
- `--prompt`：短术语提示，帮助简体和英文术语；不能把全文稿件塞进识别提示诱导结果。
- 可选 `--fps 30 --audio-start 8 --end-pad 33`：默认帧率、整条音轨开头延迟帧数及正文尾部留白帧数；不为每幕加静音。当前动画模板只支持已设计的 30 fps。
- 可选 `--asr-json`：导入已有识别结果，必须含与 WAV 一致的 `sourceSha256` 和逐词时间戳，不借此跳过完整性验证。

识别设置固定简体中文任务、逐词时间戳、temperature=0、`condition_on_previous_text=True`。模型仍可能识别繁体、同音字或把 Skill 写成 Scale/Skew，不能自动断言配音漏读。

核验全文覆盖 ≥95%、识别精度 ≥95%、每幕 ≥85%，另严格核对开头与最后十个有效字符。失败先对照实际末句、ASR繁简/同音/英文误识别和缓存指纹；不降低门槛掩盖问题。百分比通过仍需听首尾与跨幕音色。

字幕把 `SKILL 点 MD` 显示为 `SKILL.md`，时间仍依据旁白。分句以语义为先，较长句拆成约 32 加权字符以内；无重叠、负时长或跨幕溢出。参考字体下最长两行，通过 `project.captionLines` 调整语义换行，并在浏览器逐条测量，不能仅信字符数。
