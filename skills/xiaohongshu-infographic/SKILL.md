---
name: xiaohongshu-infographic
description: 制作 1080×1440 小红书信息图、轮播图、图解笔记；先让用户从暖白杂志、深蓝科技编辑、瑞士极简、粗线条海报、手账笔记、工程蓝图、暗黑霓虹、复古报刊八种风格中选择，并标明适用内容。支持工具横评、插件推荐、避坑、教程、原理解释及行业观察；同套封面、内容与收尾统一配色、字体和图形语言，使用 Canvas 模板、Node 无浏览器导出、质检打包。
when_to_use: 用户要求小红书配图、轮播图、信息图、图解笔记，或复用已选风格时
argument-hint: <主题或内容来源，可附风格名称>
---

# 小红书信息图（八种风格）

## 先选风格，并说明适合的内容

新任务先咨询风格，不根据记忆、上次任务或模板顺序设置默认。用户本次已指定风格则直接使用；同一任务修图继续沿用已选风格。

展示选项时使用“风格名｜适合内容”，在描述中补充配色与布局。适用内容是推荐，不是硬性限制。

| 风格名｜适合内容 | 视觉特点 | STYLE_ID |
|---|---|---|
| 暖白杂志｜工具推荐、选型清单 | 暖白、深墨、青柠；杂志大标题与简洁功能区 | magazine |
| 深蓝科技编辑｜AI 产品、技术更新 | 深蓝薄荷封面、浅灰内容页；编辑分栏 | tech |
| 瑞士极简｜横评、结论清单 | 黑白红、严格对齐、大数字、对照表 | swiss |
| 粗线条海报｜避坑、误区纠正 | 粗黑边框、明亮色块、硬阴影、重点大字 | brutal |
| 手账笔记｜教程、学习笔记 | 米色纸张、横线、勾选、荧光笔与便签 | notebook |
| 工程蓝图｜原理、架构、流程 | 深蓝网格、浅色线稿、工程节点与标注 | blueprint |
| 暗黑霓虹｜编程、自动化、AI 话题 | 炭黑底、青紫光线、终端面板；正文不发光 | neon |
| 复古报刊｜行业观察、故事、时间线 | 米色纸张、宋体报头、细分栏、红色批注 | newspaper |

AskUserQuestion 每题最多四个选项，不一次塞入八项：
1. 先展示完整菜单，再问偏好哪组：“编辑与阅读（杂志、科技编辑、极简、报刊）”或“主题与图解（海报、手账、蓝图、霓虹）”。
2. 再对所选组展示四个“风格名｜适合内容”选项。若用户已直接说出具体风格，跳过分组询问。
3. 用户拿不准时，展示 assets/style-catalog.png 或对应 STYLE_ID-pair-preview.png，再选择。不要仅靠名称让用户猜。

## 同套图的统一规则

必须统一封面、内容页、收尾页的配色体系、字体层级和图形语言。允许布局与信息密度变化，不允许中途切换到另一套风格。

- **配色**：从同一主题 token 取背景、正文、辅助字、强调色；不临时引入其他风格的色板。六种新增风格默认整套保持同一明暗模式。
- **字体**：同级标题使用同一字体与字重体系，正文保持清晰中文系统字体，代码使用等宽字体。复古报刊各页标题统一宋体，正文统一黑体；不是封面宋体、内容标题突然换黑体。
- **图形**：同一套沿用同样的边框、线宽、圆角、编号、阴影和装饰。海报保持粗框，手账保持纸张与勾选，蓝图保持网格节点，霓虹保持青紫细光线，报刊保持细分栏。
- **分工**：封面用更大的标题、较少文字和清晰阅读收益；内容页降低装饰强度，突出解释；收尾页沿用同主题整理结论。统一不等于每页复制同一布局。
- **已有深蓝科技编辑风**：保留已确认的深蓝封面与浅灰内容页，这是同一蓝色＋薄荷色板的明暗变体；不要把它误改成旧的整块蓝字卡片版。其他主题不自动套用这种明暗切换。
- 所有风格封面都不放价格，目录最多六项。

## 工作流

1. **规划**：选定风格后读 references/style-guide.md，列出封面、内容、收尾主题；通常 5–8 页，每页只讲一个层次，密集材料拆页。
2. **拷贝**：使用独立素材目录。复制 assets/render.template.js 为 render.js、assets/render.styles.js 保持原名、assets/index.template.html 为 index.html；有 python3 和浏览器工具时另可复制 scripts/serve.py、scripts/verify_and_pack.py，纯 Node 环境直接用技能自带的 node/ 脚本。不要覆盖已发布素材或混入旧编号图片。
3. **填写**：仅编辑工作副本 render.js 的 CONTENT 区，将 STYLE_ID 从 null 设为所选 ID。填写 CONTENT.cover、details、closing。模板不提供默认风格；不修改用户级模板来填某篇笔记的具体内容。
4. **配对检查**：使用资源中的已确认内容风格。新视觉方向、重大改版或全新密集布局，先给一张内容页样稿；确认后补配套封面，成对检查统一性，再扩展整套。不要只确认封面就把后续页做成另一种视觉。
5. **语法检查**：执行 node --check render.js 与 node --check render.styles.js。
6. **导出**：执行 node <技能目录>/node/render.mjs --dir <素材目录>。它在 Node 里跑同一套 exportAll，把 PNG 写入 images/ 并合成 contact-sheet.png；diagnostics 非空、尺寸不符或渲染异常都会以退出码 1 失败并逐条打印。改完 CONTENT 直接重跑，不需要刷新页面。
7. **可选预览**：需要目视调版且环境有浏览器时，运行 node <技能目录>/node/serve.mjs --root <素材目录>（默认 8767），打开 http://127.0.0.1:8767/；页面按钮同样写入 images/，改脚本后刷新。没有浏览器工具就跳过，用第 6 步产物。
8. **质检**：读取每张 PNG 与 contact-sheet.png，逐套核对配色、标题字体、图形语言、中文、页脚、代码、价格条件及遮挡；diagnostics 必须为空。不靠缩小正文掩盖溢出；精简或拆页后重导。
9. **打包**：写小红书笔记文案.txt，含标题、逐页导览、避坑、话题、来源及整理日期。运行 node <技能目录>/node/verify_and_pack.mjs --dir <素材目录> --zip <素材目录>/小红书发布素材.zip --count <实际页数>，失败则修复。
10. **交付**：如果启动过预览服务，停止该任务（按任务 ID，不按名称批量杀进程）；提供发布包、总览、文案链接及封面预览。

## 运行环境（Node，无需浏览器）

- **首次使用**：运行 node <技能目录>/node/setup.mjs [--prefix <素材目录>/.xhs-runtime] 安装 @napi-rs/canvas 并下载中文字体与等宽字体；已装好的机器可直接渲染。
- **字体映射**：PingFang SC / Hiragino Sans GB → Noto Sans SC（400/500/700）；Songti SC / STSong → Noto Serif SC Bold；Menlo / SFMono-Regular → JetBrains Mono，中文回退 Noto Sans SC。字面与 macOS 系统字体略有差异，版式仍按同一套 token 计算。
- **字体不入库**：字体由 setup.mjs 从 jsDelivr 下载并按字节数校验，仓库只保留许可证（node/fonts/LICENSE-Noto.txt、node/fonts/LICENSE-JetBrainsMono.txt，均为 SIL OFL 1.1）。
- **沙箱**：只允许写工作区时，用 --prefix 装到 <素材目录>/.xhs-runtime；render.mjs 会自动在那里找依赖和字体。也可用 XHS_NODE_MODULES、XHS_FONT_DIR 指定。
- **原 Python 脚本保留**：有 python3 和浏览器工具时仍可按 serve.py + 浏览器 exportAll 的原流程执行；两种方式产物一致（PNG 尺寸、ZIP 结构）。
- 细节与排错见 node/README.md。

## 内容与真实性

- 保持 1080×1440。产品页推荐三项功能、一个费用或条件区、一条重点提示；不重复堆砌产品名和长段落。
- 教程用 kind:guide。sections.code 原样保留命令或配置，body 紧邻说明每项的作用、默认行为、场景和风险；超过页高则拆页。
- 横评用 kind:product。示例价格与权益必须核实再填；非商业主题可把费用区改写为“准备条件 / 操作方式”，重点条用作关键提示。
- 插件内容区分插件版本与宿主版本，按作者声明写最低范围或精确支持列表，不能把指定列表外推为“以上”。首页写明版本查看入口；没有声明最低版本时不编造。
- 不重复展示“未实测”等醒目状态标签，也不虚构已实测；具体系统、版本、依赖、费用、权限限制必须保留。整理日期与实际资料核查状态相符。
- 促销标明资格、地区、有效期和状态；历史或待确认活动不能写成“现在必领”，通用订阅与独立产品定价不能混同。
- 不使用 emoji、真实密钥或 token；示例域名使用 example.com。

## 资源

- assets/render.template.js：共享绘制、原有两种风格、导出管线与可编辑 CONTENT 示例。
- assets/render.styles.js：六种扩展风格，统一封面、产品、教程与收尾的主题绘制。
- assets/index.template.html：预览页，先加载 render.styles.js，再加载 render.js。
- assets/style-catalog.png：八种风格的封面与内容对照总览。
- assets/STYLE_ID-pair-preview.png：八种风格各一张封面与内容并排预览，将 STYLE_ID 替换为表中的 ID；与总览合计九张，仅用于选型和视觉参考，不参与模板渲染。
- references/style-guide.md：配色、排版差异、字段与密度约束。
- node/render.mjs：无浏览器导出主入口（vm 执行 render.js、调用 exportAll、写出 PNG 与总览）。
- node/dom-shim.mjs：DOM / Canvas / fetch 适配层。
- node/serve.mjs：Node 预览服务（serve.py 等价）。
- node/verify_and_pack.mjs：Node 质检与打包（verify_and_pack.py 等价，不依赖 zip 命令）。
- node/setup.mjs：首次安装依赖与字体；node/README.md：运行时说明、字体映射与排错。
- scripts/serve.py：本地静态服务与 PNG 接收（Python / 浏览器环境）。
- scripts/verify_and_pack.py：张数、PNG 尺寸与 ZIP 完整性校验（Python / 浏览器环境）。
