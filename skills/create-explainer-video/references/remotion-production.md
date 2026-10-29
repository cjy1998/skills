# Remotion 制作与验收

## 独立工作副本

将 `assets/remotion-template/` 复制到全新工作目录，保留 `public/`（模板中的 `.gitkeep` 保持该目录存在）；将本 Skill 的 `scripts/render.mjs` 复制到工作项目的 `scripts/`。不要直接编辑已安装 Skill 来保存当前选题。

模板依赖使用 Remotion 4.0.537 全套同版本；React 19.3.1、esbuild 0.28.1 为本机已验证依赖。新机器先确认包版本可获得并授权安装，不自动降级或悄悄换工具；Remotion 的使用许可按用户实际用途自行确认。

```bash
npm install
PREVIEW_PORT=8782 npm run preview
```

- `npm install`：在独立工作目录安装模板所列依赖，需要网络与用户授权；不要把 `node_modules` 收进 Skill。
- `PREVIEW_PORT`：默认 8782，只绑定 `127.0.0.1`；冲突时换空闲端口，不杀用户服务。预览只服务内存脚本与 `public/` 内媒体，拒绝穿越与外部符号链接。
- `npm run preview`：浏览器查看正文、封面、片尾、整片。编辑后重启自己启动的服务；没有头像时片尾预览提示缺项；无声示例不能被当作完整新视频。

准备好连续 WAV 和字幕清单后，核验并将生成的清单放为工作副本 `src/film.json`。所有原稿、素材和清单同步后才导出。

## 可编辑字段

| 文件 | 字段 | 作用与边界 |
|---|---|---|
| `src/story.json` | id、chapter、label、title、visual、accent、text | 每幕原稿和画面；id唯一，chapter对应章节索引，title按语义两行，accent选mint/coral |
| `src/project.json` | brand、englishLabel、footer | 品牌与页脚；账号缺失不编造 |
| 同上 | chapters、introNote、sceneNote | 章节导航和辅助说明；参考为前言+四章，增多后须重新设计导航宽度 |
| 同上 | cover | 独立封面标题、关键词、说明卡、主题词、页脚；超长关键词需改字号/版式 |
| 同上 | avatar | 用户头像在public内的相对路径；默认空，封面可无头像，片尾必须提供 |
| 同上 | outro | 片尾短标题、关注按钮、标签与落款；默认120帧无声，不自动添加BGM或配音 |
| 同上 | captionLines | 完整字幕句→语义换行字符串，只改变排版，不改变时间或内容 |
| `src/film.json` | previewMode、audioFile、audioSha256、scenes | 无声示例previewMode=true；真实旁白对齐后为false，文件SHA绑定防错配 |
| 同上 | fps、audioStart、totalFrames、scenes.from/frames/captions | 单条旁白时间轴；字幕时间是本幕局部秒数，切页不切音轨 |
| `src/Visuals.tsx` | palette、Visual | 全片配色与图解；换风格同时检查封面/片尾，不只改正文 |
| `src/fonts.ts` | loadFont | 默认Noto Sans SC；首次可能联网取字体，离线时提前准备本地许可字体并适配 |

`visual` 类型：chat、repeat、manual、prompt、package、criteria、cases、dinner、tools、process、refine、request、files、test、install、invoke、summary、question。现有图形是 Skill 主题的例子；新题材需要改相应文字与图形，不能认为只改口播就完成新视频。

## 导出

先使用系统已有 Chrome/Chromium；脚本不自动下载浏览器。下列命令均在工作项目根目录执行：

```bash
node scripts/render.mjs --target cover --output out/cover-v1.png --browser "$CHROME"
node scripts/render.mjs --target stills --output out/stills-v1 --browser "$CHROME"
node scripts/render.mjs --target outro --output out/outro-v1.mp4 --browser "$CHROME"
node scripts/render.mjs --target body --output out/body-v1.mp4 --browser "$CHROME"
node scripts/render.mjs --target final --output out/final-v1.mp4 --browser "$CHROME"
```

- `--target cover`：封面PNG，Composition `ExplainerCover`；不会插入视频开头。
- `--target stills`：正文每幕中间帧PNG；可加 `--frame N` 指定正文帧，检查最长字幕还需逐条抽查。
- `--target outro`：4秒无声片尾，Composition `FollowOutro`；头像缺失停止，先给用户单独审稿。
- `--target body`：完整连续旁白正文，Composition `ExplainerBody`；拒绝无声示例与失效音频SHA。
- `--target final`：正文+4秒片尾，Composition `ExplainerFinal`；这是重新渲染而非原视频无损合并，只在明确授权整片时使用。
- `--output`：全新输出路径；父目录先创建，拒绝覆盖，不改已确认旧片。stills目标是新目录。
- `--browser` / `$CHROME`：用户本机已有浏览器的实际可执行路径；也可通过 `REMOTION_BROWSER` 设置，不在交付脚本硬编码作者路径。
- `--project`：可选工作项目目录，默认当前目录。
- `--port`：默认8783，渲染内部服务器端口；不要与已有服务或另一个渲染共享端口。

默认1080×1920、30fps、H.264、CRF19、JPEG92、AAC192k、并发4、fast预设。改变码率、字幕或字体后重新验证；控制资源占用，避免并发渲染争抢端口与机器。

## 实际播放与视觉检查

1. 打开预览实际使用章节跳转、播放、暂停及首中尾定位；检查浏览器错误、头像加载和字体，不把类型检查当成功。
2. 逐幕查看关键帧、最长标题与字幕；字幕最多两行，检查滚动宽高与容器边界。导出后再读PNG检查颜色、文字遮挡与内容一致。
3. 播放导出MP4的首、中、尾，确认声音一致、结尾完整和音画同步；核对拼接边界能正常播放至ended。
4. 隐藏浏览器无法截图时用媒体抽帧读取，不反复调用失败截图工具。后台无声视频可能被节电暂停，前台或可用的自动化浏览器重测；不能把暂停误判成文件损坏。
5. 不把“404 network requests”这样的请求数量日志解释成404错误码；查看真实响应状态。没有听觉能力时请用户试听，报告明确区分代码检查和人类听感。

## 编码与全片解码

```bash
python3 "$SKILL_DIR/scripts/verify_video.py" out/final-v1.mp4 \
  --ffmpeg "$FFMPEG" --ffprobe "$FFPROBE" \
  --width 1080 --height 1920 --fps 30 --frames 6996 \
  --report out/final-check-v1.json
```

- 视频位置是必填项；H.264、8bit4:2:0与AAC（或无音轨片尾）会被检查。
- `--ffmpeg` / `--ffprobe`：默认PATH上的ffmpeg/ffprobe，也可显式给现有可执行路径；Darwin子进程会增加该路径所在动态库目录，不改全局环境。
- `--width` / `--height` / `--fps`：默认1080/1920/30，其他实际尺寸必须显式提供，不能套参考片参数。
- `--frames`：可选预期总帧数；6996仅属于参考最终片，新视频取自己清单计算结果。
- `--report`：可选新JSON报告，已有文件拒绝覆盖。省略仍打印短校验结果。

完整解码显式使用rawvideo和PCM空输出，适配缺少wrapped_avframe的FFmpeg构建。`yuvj420p`是有效全范围8bit4:2:0，不误报成像素格式错误；检查色彩范围但不强行改已确认画面。

## 保留已有正文合并无声片尾

```bash
python3 "$SKILL_DIR/scripts/merge_outro.py" \
  --body out/body-v1.mp4 --outro out/outro-v1.mp4 \
  --output out/final-copy-v1.mp4 --ffmpeg "$FFMPEG" --ffprobe "$FFPROBE"
```

- `--body`：已确认H.264正文，恰好一条AAC；`--outro`：不含音轨的H.264片尾。不能用脚本丢弃有声片尾。
- `--output`：新MP4，先在同父目录临时文件验证，再独占写入；存在即停止，失败清理只涉及本次临时产物。
- 编码、尺寸、帧率、profile、像素格式和timebase不兼容时停止，改用完整渲染，不自动转换用户原视频。
- 脚本先取正文video-only，再concat视频，最后复制原正文AAC；默认concat自动转换开启，不使用shortest截掉静音片尾。
- H.264拼接可能必须插入SPS/PPS，所以不能要求视频packet逐字节哈希相同。禁用auto_convert虽可能让hash相同，却会造成片尾解码损坏；AAC可逐包核对完全一致。
- 不依赖framemd5，本机打包FFmpeg可能没有这个muxer。总帧数与全片解码通过后，仍检查拼接处画面与实际播放。
