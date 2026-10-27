#!/usr/bin/env node
/**
 * 一次性安装：下载中文字体 + 安装 @napi-rs/canvas。
 *
 * 用法：
 *   node node/setup.mjs                          # 装到技能目录 node/ 下（自用最省事）
 *   node node/setup.mjs --prefix <工作目录>/.xhs-runtime   # 装到工作区内（沙箱只允许写工作区时用这个）
 *
 * 之后 render.mjs 会自动在 技能目录/node、<cwd>/.xhs-runtime、<cwd>/node_modules 里找依赖和字体。
 */
import { existsSync } from 'node:fs';
import { copyFile, mkdir, rename, stat, unlink, writeFile } from 'node:fs/promises';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';

const HERE = dirname(fileURLToPath(import.meta.url));
const CDN = 'https://cdn.jsdelivr.net/gh/googlefonts/noto-cjk@main/';
const JB = 'https://cdn.jsdelivr.net/gh/JetBrains/JetBrainsMono@master/fonts/ttf/';
const FONTS = [
  ['NotoSansSC-Regular.otf', 'Sans/SubsetOTF/SC/NotoSansSC-Regular.otf', 8_331_336],
  ['NotoSansSC-Medium.otf', 'Sans/SubsetOTF/SC/NotoSansSC-Medium.otf', 8_345_436],
  ['NotoSansSC-Bold.otf', 'Sans/SubsetOTF/SC/NotoSansSC-Bold.otf', 8_543_168],
  ['NotoSerifSC-Bold.otf', 'Serif/SubsetOTF/SC/NotoSerifSC-Bold.otf', 12_094_336],
  ['JetBrainsMono-Regular.ttf', JB + 'JetBrainsMono-Regular.ttf', 270_224],
  ['JetBrainsMono-Bold.ttf', JB + 'JetBrainsMono-Bold.ttf', 274_096],
];

function parseArgs(argv) {
  const args = { prefix: HERE, fonts: true, deps: true };
  for (let i = 0; i < argv.length; i += 1) {
    const key = argv[i];
    if (key === '--prefix') args.prefix = resolve(argv[++i] ?? '.');
    else if (key === '--skip-fonts') args.fonts = false;
    else if (key === '--skip-deps') args.deps = false;
    else if (key === '--help' || key === '-h') args.help = true;
    else throw new Error(`未知参数：${key}`);
  }
  return args;
}

async function download(url, dest, expected) {
  for (let attempt = 1; attempt <= 3; attempt += 1) {
    try {
      const response = await fetch(url);
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      const bytes = Buffer.from(await response.arrayBuffer());
      if (expected && Math.abs(bytes.length - expected) > 1024) {
        throw new Error(`文件大小异常 ${bytes.length}（期望 ${expected}）`);
      }
      const tmp = `${dest}.part`;
      await writeFile(tmp, bytes);
      await rename(tmp, dest);
      return bytes.length;
    } catch (error) {
      console.warn(`  第 ${attempt} 次下载失败：${error.message}`);
      if (attempt === 3) throw error;
    }
  }
  return 0;
}

async function ensureFonts(prefix) {
  const dir = join(prefix, 'fonts');
  await mkdir(dir, { recursive: true });
  for (const [file, remote, expected] of FONTS) {
    const dest = join(dir, file);
    if (existsSync(dest) && Math.abs((await stat(dest)).size - expected) <= 1024) {
      console.log(`字体已就绪：${file}`);
      continue;
    }
    if (existsSync(dest)) await unlink(dest);
    console.log(`下载字体：${file}`);
    const size = await download(remote.startsWith('http') ? remote : CDN + remote, dest, expected);
    console.log(`  ${file} ${(size / 1024 / 1024).toFixed(1)} MB`);
  }
  return dir;
}

function installDeps(prefix) {
  const pkg = join(prefix, 'package.json');
  if (!existsSync(pkg)) copyFile(join(HERE, 'package.json'), pkg).catch(() => {});
  const args = ['install', '--omit=dev', '--no-audit', '--no-fund', '--cache', join(prefix, '.npm-cache')];
  console.log(`安装依赖：npm ${args.join(' ')}（目录 ${prefix}）`);
  const result = spawnSync('npm', args, { cwd: prefix, stdio: 'inherit' });
  if (result.status !== 0) throw new Error('npm install 失败，请检查网络或 npm 配置');
}

async function verify(prefix) {
  const { createRequire } = await import('node:module');
  const require = createRequire(join(prefix, 'package.json'));
  const canvas = require('@napi-rs/canvas');
  const { GlobalFonts, createCanvas } = canvas;
  const fontDir = join(prefix, 'fonts');
  for (const [file, aliases] of [
    ['NotoSansSC-Regular.otf', ['PingFang SC', 'Hiragino Sans GB']],
    ['NotoSansSC-Medium.otf', ['PingFang SC', 'Hiragino Sans GB']],
    ['NotoSansSC-Bold.otf', ['PingFang SC', 'Hiragino Sans GB']],
    ['NotoSerifSC-Bold.otf', ['Songti SC', 'STSong']],
    ['JetBrainsMono-Regular.ttf', ['Menlo', 'SFMono-Regular']],
    ['JetBrainsMono-Bold.ttf', ['Menlo', 'SFMono-Regular']],
  ]) {
    for (const alias of aliases) GlobalFonts.registerFromPath(join(fontDir, file), alias);
  }
  const ctx = createCanvas(64, 32).getContext('2d');
  const width = (weight, family, text) => { ctx.font = `${weight} 24px ${family}`; return ctx.measureText(text).width; };
  const regular = width(400, '"PingFang SC", sans-serif', '测试');
  const bold = width(700, '"PingFang SC", sans-serif', '测试');
  if (!(regular > 10)) throw new Error('字体测量异常');
  if (Math.abs(regular - bold) > 2) throw new Error('粗体字体损坏，请删除 fonts/ 后重试');
  console.log(`依赖版本：@napi-rs/canvas ${require('@napi-rs/canvas/package.json').version}；中文字体测量正常`);
  return prefix;
}

const HELP = `用法: node setup.mjs [--prefix <安装目录>] [--skip-fonts] [--skip-deps]

默认装到技能自身的 node/ 目录；沙箱只允许写工作区时，用 --prefix <工作区>/.xhs-runtime。`;

async function main() {
  const args = parseArgs(process.argv.slice(2));
  if (args.help) { console.log(HELP); return; }
  await mkdir(args.prefix, { recursive: true });
  if (args.fonts) await ensureFonts(args.prefix);
  if (args.deps) installDeps(args.prefix);
  await verify(args.prefix);
  console.log('');
  console.log(`安装完成：${args.prefix}`);
  console.log(`渲染：node ${join(HERE, 'render.mjs')} --dir <工作目录>`);
  console.log(`预览：node ${join(HERE, 'serve.mjs')} --root <工作目录>`);
}

main().catch((error) => {
  console.error(`安装失败：${error.message ?? error}`);
  process.exit(1);
});
