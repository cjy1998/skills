#!/usr/bin/env node
/**
 * 在 Node 里跑 render.js：不需要浏览器、不需要 python3。
 *
 * 用法（工作目录里应有 render.js、render.styles.js、images/）：
 *   node <技能目录>/node/render.mjs --dir <工作目录>
 *
 * 输出：<工作目录>/images/NN-slug.png + contact-sheet.png
 * 退出码：0 成功；1 排版诊断、渲染失败或依赖缺失。
 */
import vm from 'node:vm';
import { createRequire } from 'node:module';
import { readFile, readdir, stat } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createEnvironment } from './dom-shim.mjs';

const HERE = dirname(fileURLToPath(import.meta.url));
const require = createRequire(import.meta.url);

const FONT_FILES = [
  ['NotoSansSC-Regular.otf', ['PingFang SC', 'Hiragino Sans GB'], 400],
  ['NotoSansSC-Medium.otf', ['PingFang SC', 'Hiragino Sans GB'], 500],
  ['NotoSansSC-Bold.otf', ['PingFang SC', 'Hiragino Sans GB'], 700],
  ['NotoSerifSC-Bold.otf', ['Songti SC', 'STSong'], 700],
  ['JetBrainsMono-Regular.ttf', ['Menlo', 'SFMono-Regular'], 400],
  ['JetBrainsMono-Bold.ttf', ['Menlo', 'SFMono-Regular'], 700],
];

function parseArgs(argv) {
  const args = { dir: process.cwd(), timeout: 90_000 };
  for (let i = 0; i < argv.length; i += 1) {
    const key = argv[i];
    if (key === '--dir' || key === '--out') args.dir = resolve(argv[++i] ?? '.');
    else if (key === '--timeout') args.timeout = Number(argv[++i] ?? 90000);
    else if (key === '--help' || key === '-h') args.help = true;
    else throw new Error(`未知参数：${key}`);
  }
  return args;
}

function loadCanvas() {
  const candidates = [
    process.env.XHS_NODE_MODULES,
    join(HERE, 'node_modules'),
    join(process.cwd(), '.xhs-runtime', 'node_modules'),
    join(process.cwd(), 'node_modules'),
  ].filter(Boolean);
  for (const base of candidates) {
    try {
      return require(require.resolve('@napi-rs/canvas', { paths: [base] }));
    } catch {
      /* 尝试下一个候选目录 */
    }
  }
  throw new Error(
    '缺少依赖 @napi-rs/canvas。请在技能目录执行：node node/setup.mjs --prefix <工作目录>/.xhs-runtime\n' +
      '（或设置 XHS_NODE_MODULES 指向已装好的 node_modules）',
  );
}

function resolveFontDir() {
  const candidates = [process.env.XHS_FONT_DIR, join(HERE, 'fonts'), join(process.cwd(), '.xhs-runtime', 'fonts')].filter(Boolean);
  for (const dir of candidates) {
    if (existsSync(join(dir, 'NotoSansSC-Regular.otf'))) return dir;
  }
  throw new Error('缺少中文字体。请在技能目录执行：node node/setup.mjs --prefix <工作目录>/.xhs-runtime');
}

function registerFonts(canvasLib, fontDir) {
  const missing = [];
  for (const [file, aliases] of FONT_FILES) {
    const full = join(fontDir, file);
    if (!existsSync(full)) { missing.push(file); continue; }
    for (const alias of aliases) canvasLib.GlobalFonts.registerFromPath(full, alias);
  }
  if (missing.length) throw new Error(`字体文件缺失：${missing.join('、')}（目录 ${fontDir}）`);
  const probe = canvasLib.createCanvas(64, 32).getContext('2d');
  const measure = (weight, size, family, text) => {
    probe.font = `${weight} ${size}px ${family}`;
    return probe.measureText(text).width;
  };
  const regular = measure(400, 24, '"PingFang SC", "Hiragino Sans GB", sans-serif', '测试');
  const bold = measure(700, 24, '"PingFang SC", "Hiragino Sans GB", sans-serif', '测试');
  if (!(regular > 10)) throw new Error('字体注册后测量异常，中文字体可能未生效');
  if (Math.abs(regular - bold) > 2) throw new Error('粗体字体文件损坏或缺失（400/700 字宽不一致），请重新运行 setup.mjs');
  const mono = measure(400, 13, '"Menlo", "SFMono-Regular", "Hiragino Sans GB", monospace', '中文');
  if (!(mono > 10)) throw new Error('等宽字体的中文回退失效，请重新运行 setup.mjs');
  return probe;
}

async function pngSize(file) {
  const head = (await readFile(file)).subarray(0, 24);
  if (head.subarray(1, 4).toString('latin1') !== 'PNG') return null;
  return { width: head.readUInt32BE(16), height: head.readUInt32BE(20) };
}

const HELP = `用法: node render.mjs --dir <工作目录> [--timeout 90000]

工作目录需要包含 render.js（由 assets/render.template.js 复制并填写 CONTENT / STYLE_ID）
与 render.styles.js。PNG 会写入 <工作目录>/images/。`;

async function main() {
  const args = parseArgs(process.argv.slice(2));
  if (args.help) { console.log(HELP); return 0; }

  const canvasLib = loadCanvas();
  const fontDir = resolveFontDir();
  registerFonts(canvasLib, fontDir);

  const stylesPath = join(args.dir, 'render.styles.js');
  const renderPath = join(args.dir, 'render.js');
  for (const file of [stylesPath, renderPath]) {
    if (!existsSync(file)) throw new Error(`找不到 ${file}（先把 assets/ 里的模板复制到工作目录）`);
  }

  const env = createEnvironment({ outDir: args.dir, canvasLib, log: (line) => console.log(line) });
  const context = vm.createContext(env.sandbox);

  vm.runInContext(await readFile(stylesPath, 'utf8'), context, { filename: stylesPath });
  vm.runInContext(await readFile(renderPath, 'utf8'), context, { filename: renderPath });
  vm.runInContext(
    `globalThis.__xhsRun = (async () => {
      const started = Date.now();
      while (typeof window.renderResult === 'undefined') {
        if (window.__xhsError) throw new Error(window.__xhsError);
        if (Date.now() - started > ${Number(args.timeout)}) throw new Error('渲染超时');
        await new Promise((r) => setTimeout(r, 10));
      }
      const button = document.querySelector('#export');
      if (!button || typeof button.onclick !== 'function') throw new Error('没有可用的导出按钮');
      return await button.onclick();
    })().then(
      (result) => { globalThis.__xhsDone = { ok: true, result }; },
      (error) => { globalThis.__xhsDone = { ok: false, error: String((error && error.stack) || error) }; },
    );`,
    context,
    { filename: 'xhs-bootstrap.js' },
  );

  const started = Date.now();
  while (!context.__xhsDone) {
    if (Date.now() - started > args.timeout + 15_000) throw new Error('等待渲染结果超时');
    await new Promise((r) => setTimeout(r, 20));
  }

  const done = context.__xhsDone;
  const renderResult = env.window.renderResult;
  if (!done.ok) {
    const diagnostics = renderResult?.diagnostics ?? [];
    console.error('渲染或导出失败：');
    console.error('  ' + done.error.split('\n')[0]);
    if (diagnostics.length) {
      console.error(`  排版诊断 ${diagnostics.length} 条：`);
      for (const item of diagnostics) console.error('   - ' + JSON.stringify(item));
    }
    if (env.errors.length) console.error('  控制台错误：\n   - ' + env.errors.join('\n   - '));
    return 1;
  }

  const diagnostics = renderResult?.diagnostics ?? done.result?.diagnostics ?? [];
  if (diagnostics.length) {
    console.error(`排版诊断未通过（${diagnostics.length} 条），请精简或拆页后重跑：`);
    for (const item of diagnostics) console.error(' - ' + JSON.stringify(item));
    return 1;
  }

  const imagesDir = join(args.dir, 'images');
  const files = (await readdir(imagesDir)).filter((name) => name.endsWith('.png')).sort();
  const expected = done.result?.exported ?? [];
  const missing = expected.filter((name) => !files.includes(name));
  const report = [];
  for (const name of files) {
    const size = await pngSize(join(imagesDir, name));
    report.push({ name, width: size?.width ?? 0, height: size?.height ?? 0, kb: Math.round((await stat(join(imagesDir, name))).size / 1024) });
  }
  const bad = report.filter((item) => item.name !== 'contact-sheet.png' && (item.width !== 1080 || item.height !== 1440));
  console.log('');
  console.log(`风格：${done.result?.style ?? renderResult?.style ?? '未知'}｜页数：${report.filter((r) => r.name !== 'contact-sheet.png').length}`);
  for (const item of report) console.log(`  ${item.name}  ${item.width}×${item.height}  ${item.kb} KB`);
  if (missing.length) { console.error(`缺少导出文件：${missing.join('、')}`); return 1; }
  if (bad.length) { console.error(`尺寸不合规：${bad.map((b) => `${b.name} ${b.width}×${b.height}`).join('、')}`); return 1; }
  console.log('OK');
  return 0;
}

main().then(
  (code) => process.exit(code),
  (error) => {
    console.error(error.message ?? String(error));
    process.exit(1);
  },
);
