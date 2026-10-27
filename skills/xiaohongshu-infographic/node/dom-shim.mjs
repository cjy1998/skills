/**
 * 最小 DOM/Canvas 适配层：让 assets/render.js + render.styles.js 在 Node 里原样运行。
 * 浏览器里由 index.html 提供的 #gallery / #export / #style-name 以及 fetch('/export') 由此模拟。
 */
import { mkdir, writeFile } from 'node:fs/promises';
import { join } from 'node:path';

const PNG_SIG = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
const EXPORT_NAME = /^(?:[0-9]{2}-[a-z0-9-]+|contact-sheet)\.png$/;

class FakeNode {
  constructor(tag) {
    this.tagName = tag;
    this.children = [];
    this.style = {};
    this.disabled = false;
    this.onclick = null;
    this._text = '';
  }
  append(...nodes) { this.children.push(...nodes); }
  appendChild(node) { this.children.push(node); return node; }
  setAttribute() {}
  removeAttribute() {}
  addEventListener(type, fn) { if (type === 'click') this.onclick = fn; }
  querySelector() { return null; }
  get textContent() { return this._text; }
  set textContent(value) { this._text = String(value); }
}

function decorateCanvas(canvas) {
  if (typeof canvas.setAttribute !== 'function') {
    canvas.setAttribute = () => {};
    canvas.getAttribute = () => null;
  }
  if (typeof canvas.toBlob !== 'function') {
    canvas.toBlob = (callback, type = 'image/png') => {
      const bytes = canvas.toBuffer('image/png');
      callback({ type, size: bytes.length, arrayBuffer: async () => bytes });
    };
  }
  return canvas;
}

/**
 * @param {object} options
 * @param {string} options.outDir  工作目录；PNG 写入 <outDir>/images/
 * @param {object} options.canvasLib  @napi-rs/canvas 模块导出（由调用方按自己的查找顺序解析）
 * @param {(message: string) => void} [options.log]
 */
export function createEnvironment({ outDir, canvasLib, log = () => {} }) {
  if (!canvasLib || typeof canvasLib.createCanvas !== 'function') {
    throw new Error('createEnvironment 需要传入 canvasLib（@napi-rs/canvas 模块）');
  }
  const { createCanvas } = canvasLib;
  const imagesDir = join(outDir, 'images');
  const gallery = new FakeNode('main');
  const exportButton = new FakeNode('button');
  const styleName = new FakeNode('span');
  const errors = [];

  const document = {
    createElement(tag) {
      if (tag === 'canvas') return decorateCanvas(createCanvas(300, 150));
      return new FakeNode(tag);
    },
    createTextNode(text) { return { nodeType: 3, textContent: String(text) }; },
    querySelector(selector) {
      if (selector === '#gallery') return gallery;
      if (selector === '#export') return exportButton;
      if (selector === '#style-name') return styleName;
      return null;
    },
    documentElement: { style: { setProperty() {} } },
    fonts: { ready: Promise.resolve() },
  };

  async function fetchShim(input, init = {}) {
    const url = new URL(String(input), 'http://127.0.0.1');
    const name = url.searchParams.get('name') ?? '';
    if (url.pathname !== '/export' || !EXPORT_NAME.test(name) || (init.method ?? 'GET') !== 'POST') {
      return { ok: false, status: 400, text: async () => 'bad request' };
    }
    const body = init.body;
    const bytes = body && typeof body.arrayBuffer === 'function'
      ? Buffer.from(await body.arrayBuffer())
      : Buffer.from(body ?? []);
    if (bytes.length === 0 || bytes.length > 15_000_000 || !bytes.subarray(0, 8).equals(PNG_SIG)) {
      return { ok: false, status: 400, text: async () => 'bad payload' };
    }
    await mkdir(imagesDir, { recursive: true });
    await writeFile(join(imagesDir, name), bytes);
    log(`已保存 images/${name}（${Math.round(bytes.length / 1024)} KB）`);
    return { ok: true, status: 200, text: async () => 'OK' };
  }

  const window = {};

  const consoleShim = {
    log: (...args) => log(args.map(String).join(' ')),
    info: (...args) => log(args.map(String).join(' ')),
    warn: (...args) => log('WARN ' + args.map(String).join(' ')),
    error: (...args) => {
      const text = args.map((a) => (a && a.stack ? a.stack : String(a))).join(' ');
      errors.push(text);
      if (!window.__xhsError) window.__xhsError = text;
      log('ERROR ' + text);
    },
  };

  const sandbox = {
    window,
    document,
    console: consoleShim,
    fetch: fetchShim,
    setTimeout,
    clearTimeout,
    requestAnimationFrame: (fn) => setTimeout(() => fn(Date.now()), 0),
  };

  return { sandbox, window, imagesDir, gallery, exportButton, styleName, errors };
}
