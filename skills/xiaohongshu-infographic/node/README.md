# 无浏览器运行（Node）

原技能依赖浏览器执行 `exportAll()`、用 Python 起预览服务并打包。本目录把这三件事搬到 Node：
用 `@napi-rs/canvas`（Skia）执行同一套 `render.js` / `render.styles.js`，把 PNG 直接写到
`images/`，再用纯 Node 校验尺寸、生成 ZIP。**不需要浏览器、不需要 python3、不需要系统字体。**

## 目录

| 文件 | 作用 |
|---|---|
| `render.mjs` | 主入口：加载 shim + 字体，在 `vm` 里跑 `render.styles.js` / `render.js`，触发 `exportAll()`，检查 `diagnostics` 与尺寸 |
| `dom-shim.mjs` | 最小 DOM/Canvas 适配层：`document.querySelector`、`toBlob`、`fetch('/export')` 落盘 |
| `serve.mjs` | 可选：本地预览服务器（`serve.py` 的 Node 版），浏览器里点“导出全部 PNG”即可写入 `images/` |
| `verify_and_pack.mjs` | 质检 + 打包（`verify_and_pack.py` 的 Node 版，不依赖 `zip` 命令） |
| `setup.mjs` | 一次性安装：下载 6 个字体、`npm install` 依赖、自检 |
| `fonts/` | 字体与许可证；字体不随仓库提交，由 `setup.mjs` 下载（Noto Sans SC Regular/Medium/Bold、Noto Serif SC Bold、JetBrains Mono Regular/Bold） |
| `node_modules/` | `@napi-rs/canvas`（安装后生成） |

## 快速开始

```bash
# 首次（当前机器已装好，新机器才需要）
node <技能目录>/node/setup.mjs

# 在素材目录（含 render.js、render.styles.js、images/）里导出
node <技能目录>/node/render.mjs --dir <素材目录>

# 质检 + 打包
node <技能目录>/node/verify_and_pack.mjs --dir <素材目录> --zip <素材目录>/小红书发布素材.zip --count <实际页数>
```

`render.mjs` 成功时打印风格名、每张图的尺寸与体积，最后一行 `OK`；失败时退出码 1，
并逐条打印 `diagnostics`（例如 `{"slide":1,"text":"…","width":1220.8,"max":950}`，说明该行超宽，需要精简或拆页）。

## 沙箱 / 只读技能目录

技能通常装在 `$DSH_HOME/skills`，会话沙箱只允许写工作区。此时把依赖装到工作区内：

```bash
node <技能目录>/node/setup.mjs --prefix <素材目录>/.xhs-runtime
```

`render.mjs` 会按 `XHS_NODE_MODULES` → 技能目录 `node/` → `<cwd>/.xhs-runtime` → `<cwd>/node_modules`
的顺序找依赖和字体，所以之后照常执行 `render.mjs --dir …` 即可。也可用环境变量
`XHS_NODE_MODULES`、`XHS_FONT_DIR` 显式指定。

## 字体映射

| 模板里的字体栈 | 实际字体 | 说明 |
|---|---|---|
| `"PingFang SC", "Hiragino Sans GB", sans-serif` | Noto Sans SC Regular/Medium/Bold | 400/500/700 三档，其余字重由 Skia 就近匹配 |
| `"Songti SC", "STSong", serif` | Noto Serif SC Bold | 复古报刊的报头/标题 |
| `Menlo, "SFMono-Regular", "Hiragino Sans GB", monospace` | JetBrains Mono + 中文回退 Noto Sans SC | 拉丁与符号等宽，中文回退到黑体 |

字重与字面细节同 macOS 系统字体不完全一致（例如 PingFang 的 650/750 会被映射到 500 或 700），
版式仍按同一套 token 计算；正文宽度按 `measureText` 实测，因此不会出现溢出误判。

字体许可：Noto 系列为 SIL OFL 1.1，JetBrains Mono 为 SIL OFL 1.1，许可证原文见 `fonts/LICENSE-*.txt`。

## 与 Python 版的差异

- 预览服务：`serve.mjs` 与 `serve.py` 行为一致（`POST /export?name=`、PNG 魔数、15 MB 上限、文件名白名单）。
- 打包：ZIP 内路径一致（`发布图片/NN-*.png`、`总览预览.png`、`小红书*.txt`），中文文件名带 UTF-8 标志位；
  写完用 `zlib.inflateRawSync` 回读并校验 CRC32，替代 Python 的 `testzip()`。
- `--count` 省略时只校验 PNG 与尺寸，不强制张数；给了就严格比较。

## 排错

| 现象 | 原因 / 处理 |
|---|---|
| `缺少依赖 @napi-rs/canvas` | 跑 `setup.mjs`，或设 `XHS_NODE_MODULES` |
| `字体注册后测量异常` / `粗体字体文件损坏` | 字体下载被截断（曾出现过 Bold 只有 7.6 MB）。删掉 `fonts/` 重新 `setup.mjs` |
| `找不到 …/render.styles.js` | 先把 `assets/` 的模板复制到素材目录 |
| `渲染或导出失败：Error: 排版检查未通过` | 看随后打印的 `diagnostics`，精简文案或拆页 |
| 图片尺寸不合规 | 不要改 `W/H`；确认没有手动缩放 canvas |

## 自检

```bash
node --check render.mjs && node --check dom-shim.mjs && node --check serve.mjs \
  && node --check verify_and_pack.mjs && node --check setup.mjs
```
