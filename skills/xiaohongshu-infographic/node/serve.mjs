#!/usr/bin/env node
/**
 * 本地预览服务器（serve.py 的 Node 版）：静态托管工作目录 + 接收 render.js 的 PNG 导出。
 *
 * 用法：node <技能目录>/node/serve.mjs --root <工作目录> [--port 8767]
 * 打开 http://127.0.0.1:8767/ 预览，页面“导出全部 PNG”按钮会把图片写到 <工作目录>/images/
 */
import http from 'node:http';
import { createReadStream } from 'node:fs';
import { mkdir, writeFile } from 'node:fs/promises';
import { extname, join, normalize, resolve, sep } from 'node:path';

const PNG_SIG = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
const NAME_RE = /^(?:[0-9]{2}-[a-z0-9-]+|contact-sheet)\.png$/;
const MAX_BYTES = 15_000_000;
const TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.svg': 'image/svg+xml',
  '.json': 'application/json; charset=utf-8',
  '.txt': 'text/plain; charset=utf-8',
  '.md': 'text/markdown; charset=utf-8',
};

function parseArgs(argv) {
  const args = { root: process.cwd(), port: 8767, host: '127.0.0.1' };
  for (let i = 0; i < argv.length; i += 1) {
    const key = argv[i];
    if (key === '--root') args.root = resolve(argv[++i] ?? '.');
    else if (key === '--port') args.port = Number(argv[++i] ?? 8767);
    else if (key === '--host') args.host = argv[++i] ?? '127.0.0.1';
    else if (key === '--help' || key === '-h') args.help = true;
    else throw new Error(`未知参数：${key}`);
  }
  return args;
}

function send(res, status, body, type = 'text/plain; charset=utf-8') {
  res.writeHead(status, { 'Content-Type': type, 'Cache-Control': 'no-store' });
  res.end(body);
}

function readBody(req) {
  return new Promise((ok, fail) => {
    const chunks = [];
    let total = 0;
    req.on('data', (chunk) => {
      total += chunk.length;
      if (total > MAX_BYTES) { fail(new Error('payload too large')); req.destroy(); return; }
      chunks.push(chunk);
    });
    req.on('end', () => ok(Buffer.concat(chunks)));
    req.on('error', fail);
  });
}

const HELP = `用法: node serve.mjs --root <工作目录> [--port 8767] [--host 127.0.0.1]`;

async function main() {
  const args = parseArgs(process.argv.slice(2));
  if (args.help) { console.log(HELP); return; }
  const root = args.root;
  const imagesDir = join(root, 'images');

  const server = http.createServer(async (req, res) => {
    const url = new URL(req.url ?? '/', `http://${req.headers.host ?? '127.0.0.1'}`);

    if (url.pathname === '/export') {
      if (req.method !== 'POST') return send(res, 405, 'method not allowed');
      const name = url.searchParams.get('name') ?? '';
      if (!NAME_RE.test(name)) return send(res, 400, 'bad name');
      let body;
      try { body = await readBody(req); } catch { return send(res, 413, 'payload too large'); }
      if (body.length === 0 || !body.subarray(0, 8).equals(PNG_SIG)) return send(res, 400, 'bad png');
      await mkdir(imagesDir, { recursive: true });
      await writeFile(join(imagesDir, name), body);
      console.log(`已保存 images/${name}（${Math.round(body.length / 1024)} KB）`);
      return send(res, 200, 'OK');
    }

    const rel = decodeURIComponent(url.pathname).replace(/^\/+/, '');
    const target = rel === '' ? 'index.html' : rel;
    const full = resolve(normalize(join(root, target)));
    if (full !== root && !full.startsWith(root + sep)) return send(res, 403, 'forbidden');

    const stream = createReadStream(full);
    stream.on('error', () => send(res, 404, 'not found'));
    stream.once('open', () => {
      res.writeHead(200, {
        'Content-Type': TYPES[extname(full).toLowerCase()] ?? 'application/octet-stream',
        'Cache-Control': 'no-store',
      });
      stream.pipe(res);
    });
    return undefined;
  });

  await new Promise((ok, fail) => {
    server.once('error', fail);
    server.listen(args.port, args.host, ok);
  });
  console.log(`预览地址：http://${args.host}:${args.port}/  （根目录 ${root}）`);
  console.log('Ctrl+C 停止。页面上的“导出全部 PNG”会直接写入 images/。');
}

main().catch((error) => {
  console.error(error.message ?? String(error));
  process.exit(1);
});
