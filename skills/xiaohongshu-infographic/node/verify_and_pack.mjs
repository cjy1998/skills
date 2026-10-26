#!/usr/bin/env node
/**
 * 质检 + 打包（verify_and_pack.py 的 Node 版，不依赖 python3 和 zip 命令）。
 *
 * 用法：node <技能目录>/node/verify_and_pack.mjs --dir <工作目录> [--zip 输出.zip] [--count 8]
 * 质检：PNG 签名、张数、1080×1440 尺寸、contact-sheet 是否存在。
 * 打包：发布图片/NN-*.png、总览预览.png、小红书*.txt（UTF-8 文件名），写完回读校验 CRC。
 */
import { readdir, readFile, stat, writeFile } from 'node:fs/promises';
import { join, resolve, basename } from 'node:path';
import { deflateRawSync, inflateRawSync } from 'node:zlib';

const PNG_SIG = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);

/* ---------- CRC32 ---------- */
const CRC_TABLE = (() => {
  const table = new Uint32Array(256);
  for (let n = 0; n < 256; n += 1) {
    let c = n;
    for (let k = 0; k < 8; k += 1) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    table[n] = c >>> 0;
  }
  return table;
})();

function crc32(buf) {
  let c = 0xffffffff;
  for (let i = 0; i < buf.length; i += 1) c = CRC_TABLE[(c ^ buf[i]) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}

/* ---------- ZIP ---------- */
function dosDateTime(date) {
  const d = new Date(date);
  const time = ((d.getHours() & 31) << 11) | ((d.getMinutes() & 63) << 5) | ((d.getSeconds() / 2) & 31);
  const day = (((d.getFullYear() - 1980) & 127) << 9) | (((d.getMonth() + 1) & 15) << 5) | (d.getDate() & 31);
  return { time, day };
}

function buildZip(entries) {
  const local = [];
  const central = [];
  let offset = 0;
  for (const entry of entries) {
    const name = Buffer.from(entry.name, 'utf8');
    const data = entry.data;
    const comp = deflateRawSync(data, { level: 9 });
    const crc = crc32(data);
    const { time, day } = dosDateTime(entry.mtime ?? Date.now());

    const head = Buffer.alloc(30);
    head.writeUInt32LE(0x04034b50, 0);
    head.writeUInt16LE(20, 4);
    head.writeUInt16LE(0x0800, 6); // UTF-8 文件名
    head.writeUInt16LE(8, 8); // deflate
    head.writeUInt16LE(time, 10);
    head.writeUInt16LE(day, 12);
    head.writeUInt32LE(crc, 14);
    head.writeUInt32LE(comp.length, 18);
    head.writeUInt32LE(data.length, 22);
    head.writeUInt16LE(name.length, 26);
    head.writeUInt16LE(0, 28);
    local.push(head, name, comp);

    const cd = Buffer.alloc(46);
    cd.writeUInt32LE(0x02014b50, 0);
    cd.writeUInt16LE(20, 4);
    cd.writeUInt16LE(20, 6);
    cd.writeUInt16LE(0x0800, 8);
    cd.writeUInt16LE(8, 10);
    cd.writeUInt16LE(time, 12);
    cd.writeUInt16LE(day, 14);
    cd.writeUInt32LE(crc, 16);
    cd.writeUInt32LE(comp.length, 20);
    cd.writeUInt32LE(data.length, 24);
    cd.writeUInt16LE(name.length, 28);
    cd.writeUInt16LE(0, 30);
    cd.writeUInt16LE(0, 32);
    cd.writeUInt16LE(0, 34);
    cd.writeUInt16LE(0, 36);
    cd.writeUInt32LE(0, 38);
    cd.writeUInt32LE(offset, 42);
    central.push(cd, name);

    offset += 30 + name.length + comp.length;
  }
  const cdBuf = Buffer.concat(central);
  const eocd = Buffer.alloc(22);
  eocd.writeUInt32LE(0x06054b50, 0);
  eocd.writeUInt16LE(0, 4);
  eocd.writeUInt16LE(0, 6);
  eocd.writeUInt16LE(entries.length, 8);
  eocd.writeUInt16LE(entries.length, 10);
  eocd.writeUInt32LE(cdBuf.length, 12);
  eocd.writeUInt32LE(offset, 16);
  eocd.writeUInt16LE(0, 20);
  return Buffer.concat([...local, cdBuf, eocd]);
}

function readZip(buf) {
  const eocdOffset = buf.lastIndexOf(Buffer.from([0x50, 0x4b, 0x05, 0x06]));
  if (eocdOffset < 0) throw new Error('ZIP 缺少中央目录结尾记录');
  const count = buf.readUInt16LE(eocdOffset + 10);
  let ptr = buf.readUInt32LE(eocdOffset + 16);
  const entries = [];
  for (let i = 0; i < count; i += 1) {
    if (buf.readUInt32LE(ptr) !== 0x02014b50) throw new Error(`中央目录第 ${i + 1} 项损坏`);
    const crc = buf.readUInt32LE(ptr + 16);
    const csize = buf.readUInt32LE(ptr + 20);
    const usize = buf.readUInt32LE(ptr + 24);
    const nameLen = buf.readUInt16LE(ptr + 28);
    const extraLen = buf.readUInt16LE(ptr + 30);
    const commentLen = buf.readUInt16LE(ptr + 32);
    const lho = buf.readUInt32LE(ptr + 42);
    const name = buf.subarray(ptr + 46, ptr + 46 + nameLen).toString('utf8');
    if (buf.readUInt32LE(lho) !== 0x04034b50) throw new Error(`${name} 的本地文件头损坏`);
    const dataStart = lho + 30 + buf.readUInt16LE(lho + 26) + buf.readUInt16LE(lho + 28);
    const raw = buf.subarray(dataStart, dataStart + csize);
    const data = buf.readUInt16LE(lho + 8) === 8 ? inflateRawSync(raw) : raw;
    entries.push({ name, size: usize, crc, ok: crc32(data) === crc && data.length === usize });
    ptr += 46 + nameLen + extraLen + commentLen;
  }
  return entries;
}

/* ---------- 参数 ---------- */
function parseArgs(argv) {
  const args = { dir: process.cwd(), count: null, width: 1080, height: 1440, zip: null };
  for (let i = 0; i < argv.length; i += 1) {
    const key = argv[i];
    if (key === '--dir') args.dir = resolve(argv[++i] ?? '.');
    else if (key === '--zip') args.zip = resolve(argv[++i] ?? '');
    else if (key === '--count') args.count = Number(argv[++i]);
    else if (key === '--width') args.width = Number(argv[++i]);
    else if (key === '--height') args.height = Number(argv[++i]);
    else if (key === '--help' || key === '-h') args.help = true;
    else throw new Error(`未知参数：${key}`);
  }
  return args;
}

const HELP = `用法: node verify_and_pack.mjs --dir <工作目录> [--zip 输出.zip] [--count 8] [--width 1080] [--height 1440]

不带 --count 时只校验尺寸与 PNG 合法性，不强制张数。`;

function pngSize(buf) {
  if (buf.length < 24 || !buf.subarray(0, 8).equals(PNG_SIG)) return null;
  return { width: buf.readUInt32BE(16), height: buf.readUInt32BE(20) };
}

const kb = (bytes) => `${Math.round(bytes / 1024)} KB`;
const mb = (bytes) => `${(bytes / 1024 / 1024).toFixed(1)} MB`;

async function main() {
  const args = parseArgs(process.argv.slice(2));
  if (args.help) { console.log(HELP); return 0; }

  const imagesDir = join(args.dir, 'images');
  const failures = [];
  let names = [];
  try {
    names = (await readdir(imagesDir)).filter((n) => n.endsWith('.png')).sort();
  } catch {
    failures.push(`找不到图片目录：${imagesDir}`);
  }
  const pages = names.filter((n) => n !== 'contact-sheet.png');
  const sheet = names.includes('contact-sheet.png');

  if (pages.length === 0) failures.push('images/ 里没有发布图片');
  if (args.count !== null && pages.length !== args.count) {
    failures.push(`图片张数不符：期望 ${args.count} 张，实际 ${pages.length} 张`);
  }
  if (!sheet) failures.push('缺少 images/contact-sheet.png（页数概览）');

  const rows = [];
  for (const name of names) {
    const buf = await readFile(join(imagesDir, name));
    const size = pngSize(buf);
    const row = { name, bytes: buf.length, width: size?.width ?? 0, height: size?.height ?? 0 };
    if (!size) failures.push(`${name} 不是合法 PNG`);
    else if (name !== 'contact-sheet.png' && (size.width !== args.width || size.height !== args.height)) {
      failures.push(`${name} 尺寸为 ${size.width}×${size.height}，应为 ${args.width}×${args.height}`);
    }
    rows.push(row);
  }

  let textFiles = [];
  try {
    textFiles = (await readdir(args.dir)).filter((n) => /^小红书.*\.txt$/.test(n)).sort();
  } catch { /* 目录不存在时上面已经记过失败 */ }
  if (textFiles.length === 0) console.warn('提示：未找到「小红书*.txt」文案文件，ZIP 里将没有笔记文案。');

  console.log(`图片：${pages.length} 张${sheet ? ' + 总览预览' : ''}`);
  for (const row of rows) console.log(`  ${row.name}  ${row.width}×${row.height}  ${kb(row.bytes)}`);
  for (const file of textFiles) console.log(`  文案 ${file}  ${kb((await stat(join(args.dir, file))).size)}`);

  if (failures.length) {
    console.log('FAIL');
    for (const item of failures) console.log(`  - ${item}`);
    return 1;
  }

  if (args.zip) {
    const entries = [];
    for (const name of pages) {
      const file = join(imagesDir, name);
      entries.push({ name: `发布图片/${name}`, data: await readFile(file), mtime: (await stat(file)).mtimeMs });
    }
    const sheetFile = join(imagesDir, 'contact-sheet.png');
    entries.push({ name: '总览预览.png', data: await readFile(sheetFile), mtime: (await stat(sheetFile)).mtimeMs });
    for (const file of textFiles) {
      const full = join(args.dir, file);
      entries.push({ name: file, data: await readFile(full), mtime: (await stat(full)).mtimeMs });
    }
    const zipBuf = buildZip(entries);
    await writeFile(args.zip, zipBuf);
    const check = readZip(await readFile(args.zip));
    const broken = check.filter((e) => !e.ok);
    if (broken.length) {
      console.log('FAIL');
      for (const item of broken) console.log(`  - ZIP 回读校验失败：${item.name}`);
      return 1;
    }
    console.log(`ZIP：${basename(args.zip)}  ${mb(zipBuf.length)}（${check.length} 项）`);
    for (const item of check) console.log(`  ${item.name}  ${kb(item.size)}`);
    console.log('OK');
    return 0;
  }

  console.log('OK（未生成 ZIP，如需打包请加 --zip 路径）');
  return 0;
}

main().then(
  (code) => process.exit(code),
  (error) => { console.error(error.message ?? String(error)); process.exit(1); },
);
