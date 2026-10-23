// Load before render.js. Only declarations belong here: the base globals are not ready yet.
const EXTRA_THEMES = {
  swiss: {name:'瑞士极简',paper:'#F8F7F3',ink:'#191A18',muted:'#656863',accent:'#DD402F',signal:'#DD402F',rule:'#C8C9C2',grid:'#E7E7E0',dark:'#0B0D0C',light:'#EFEEE8',panel:'#FFFFFF',soft:'#F3E6E1',codeInk:'#F5F6F1',codeComment:'#AFBAB2',titleWeight:650},
  brutal: {name:'粗线条海报',paper:'#FFF8E9',ink:'#181A19',muted:'#3E4542',accent:'#FFDB40',signal:'#3652DE',rule:'#181A19',grid:'#E8DFC9',dark:'#181A19',light:'#DDE8FF',panel:'#FFFFFF',soft:'#FBDDE5',codeInk:'#FFFFFF',codeComment:'#B9C9BF',titleWeight:800},
  notebook: {name:'手账笔记',paper:'#F7F0DE',ink:'#343B36',muted:'#616A60',accent:'#F4DE7E',signal:'#506950',rule:'#B5BEA8',grid:'#DDE0D4',dark:'#26372C',light:'#E2E8CE',panel:'#FBF5E6',soft:'#D9AAA4',codeInk:'#F3F5E9',codeComment:'#B6C7AD',titleWeight:650},
  blueprint: {name:'工程蓝图',paper:'#103555',ink:'#E9F4FD',muted:'#B5CCE0',accent:'#89DBF0',signal:'#89DBF0',rule:'#719AAF',grid:'#183F5D',dark:'#071E32',light:'#D7EDF4',panel:'#153F62',soft:'#214C6A',codeInk:'#E9F4FD',codeComment:'#A4C8D5',titleWeight:650},
  neon: {name:'暗黑霓虹',paper:'#090B14',ink:'#F0F3FF',muted:'#A7B0C6',accent:'#70F3DC',signal:'#AF90FF',rule:'#3B405C',grid:'#181D2B',dark:'#0A0E19',light:'#242039',panel:'#101420',soft:'#292147',codeInk:'#F0F3FF',codeComment:'#A7B0C6',titleWeight:650},
  newspaper: {name:'复古报刊',paper:'#F2E9D4',ink:'#322D25',muted:'#6C6152',accent:'#E0C28D',signal:'#9C3B2D',rule:'#84765E',grid:'#D7CAB2',dark:'#211D17',light:'#EADCC1',panel:'#F6EEDC',soft:'#B1A28A',codeInk:'#FAF2E2',codeComment:'#C6BBA6',titleWeight:800,titleFont:'"Songti SC", "STSong", serif'}
};

// All text is measured at its actual font. Never use fillText's maxWidth (it squeezes text).
function extraFont(role, size, weight) {
  return `${weight} ${size}px ${role === 'mono' ? fonts.mono : role === 'title' && C.titleFont ? C.titleFont : fonts.sans}`;
}
function extraDiagnostic(details) {
  diagnostics.push({slide:slides.length + 1,style:STYLE_ID,...details});
}
function extraText(value, x, y, w, size, color=C.ink, role='body', weight=400, bottom=1330) {
  const s = String(value ?? '');
  ctx.font = extraFont(role, size, weight);
  ctx.textBaseline = 'top';
  ctx.fillStyle = color;
  const width = ctx.measureText(s).width, max = Math.min(w, W - 64 - x);
  if (width > max + .5 || x < 64) extraDiagnostic({type:'width',text:s,x,width,max,right:x + width});
  if (y + size > bottom) extraDiagnostic({type:'bottom',text:s,bottom:y + size,maxBottom:bottom});
  ctx.fillText(s, x, y);
  return width;
}
function extraBlock(value, w, size=26, role='body', leading=1.4, weight) {
  const s = String(value ?? ''), rows = [];
  weight = weight ?? (role === 'title' ? C.titleWeight : 400);
  ctx.font = extraFont(role, size, weight);
  if (s !== '') for (const raw of s.split('\n')) {
    let row = '';
    for (const ch of raw) {
      if (row && ctx.measureText(row + ch).width > w) { rows.push(row); row = ch; }
      else row += ch;
    }
    rows.push(row);
  }
  return {source:s,rows,w,size,role,weight,step:size * leading,h:rows.length * size * leading};
}
function extraDraw(b, x, y, color=C.ink, bottom=1330) {
  b.rows.forEach((row, i) => extraText(row, x, y + i * b.step, b.w, b.size, color, b.role, b.weight, bottom));
  if (y + b.h > bottom) extraDiagnostic({type:'paragraph',text:b.source,bottom:y + b.h,maxBottom:bottom});
  return y + b.h;
}
function extraRect(x, y, w, h, fill, stroke, width=1, radius=0) {
  ctx.beginPath();
  ctx.roundRect(x + width / 2, y + width / 2, w - width, h - width, radius);
  if (fill) { ctx.fillStyle = fill; ctx.fill(); }
  if (stroke) { ctx.strokeStyle = stroke; ctx.lineWidth = width; ctx.stroke(); }
}
function extraCircle(x, y, r, fill, stroke, width=1) {
  ctx.beginPath(); ctx.arc(x, y, r, 0, Math.PI * 2);
  if (fill) { ctx.fillStyle = fill; ctx.fill(); }
  if (stroke) { ctx.strokeStyle = stroke; ctx.lineWidth = width; ctx.stroke(); }
}

// Shared page chrome, including the newspaper masthead and notebook's wider left margin.
function extraStart(index, total) {
  if (!Object.hasOwn(EXTRA_THEMES, STYLE_ID)) throw new Error('扩展绘图只支持 swiss / brutal / notebook / blueprint / neon / newspaper');
  canvas = document.createElement('canvas'); canvas.width = W; canvas.height = H;
  canvas.setAttribute('role', 'img');
  canvas.setAttribute('aria-label', `${C.name} · ${index} / ${total}`);
  ctx = canvas.getContext('2d');
  box(0, 0, W, H, C.paper);
  // Leave room for the poster's 10px hard shadow inside the 64px page margin.
  const x = STYLE_ID === 'notebook' ? 140 : 64, w = STYLE_ID === 'brutal' ? 940 : 1016 - x;
  if (STYLE_ID === 'notebook') {
    for (let y = 128; y < 1360; y += 42) line(124, y, 1016, y, C.grid);
    line(124, 48, 124, 1360, C.soft, 2);
    for (let y = 154; y < 1340; y += 216) {
      extraCircle(80, y, 14, C.rule);
      extraCircle(78, y - 2, 11, C.paper);
    }
  } else if (STYLE_ID === 'blueprint') {
    for (let xx = 0; xx < W; xx += 20) line(xx, 0, xx, H, xx % 100 === 0 ? C.soft : C.grid);
    for (let yy = 0; yy < H; yy += 20) line(0, yy, W, yy, yy % 100 === 0 ? C.soft : C.grid);
  } else if (STYLE_ID === 'neon') {
    const halo = ctx.createRadialGradient(910, 230, 5, 910, 230, 660);
    halo.addColorStop(0, C.soft); halo.addColorStop(1, C.paper);
    box(0, 0, W, 900, halo);
  } else if (STYLE_ID === 'newspaper') {
    let seed = 83;
    const random = () => { seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0; return seed / 4294967296; };
    ctx.save(); ctx.fillStyle = C.rule;
    for (let i = 0; i < 9000; i++) {
      ctx.globalAlpha = .025 + random() * .035;
      ctx.fillRect(random() * W, random() * H, 1 + random(), 1);
    }
    ctx.restore();
  }
  const page = `${String(index).padStart(2, '0')} / ${String(total).padStart(2, '0')}`;
  if (STYLE_ID === 'newspaper') {
    extraText(CONTENT.brand, x, 54, w - 196, 52, C.ink, 'title', C.titleWeight);
    extraText(page, x + w - 154, 72, 154, 24, C.signal, 'mono', 500);
    line(x, 125, x + w, 125, C.ink, 4); line(x, 134, x + w, 134, C.rule);
  } else if (STYLE_ID === 'brutal') {
    box(x, 54, w - 210, 54, C.ink);
    extraText(CONTENT.brand, x + 18, 67, w - 246, 24, C.panel, 'title', C.titleWeight);
    extraText(page, x + w - 170, 69, 170, 26, C.ink, 'mono', 700);
  } else {
    if (STYLE_ID === 'swiss') box(x, 63, 18, 18, C.signal);
    if (STYLE_ID === 'neon') {
      extraRect(x, 54, w - 218, 48, C.grid, C.rule, 1, 24);
      extraCircle(x + 22, 78, 4, C.accent);
    }
    const inset = STYLE_ID === 'swiss' ? 34 : STYLE_ID === 'neon' ? 40 : 0;
    extraText(CONTENT.brand, x + inset, 63, w - 240 - inset, 25, STYLE_ID === 'swiss' ? C.ink : C.signal, 'title', 600);
    extraText(page, x + w - 162, 64, 162, 24, STYLE_ID === 'swiss' ? C.muted : C.signal, 'mono', 600);
    if (STYLE_ID !== 'notebook') line(x, 116, x + w, 116, STYLE_ID === 'swiss' ? C.ink : C.rule, STYLE_ID === 'swiss' ? 2 : 1);
  }
  return {x,w,y:STYLE_ID === 'newspaper' ? 166 : 148};
}
function extraFooter(index) {
  const x = STYLE_ID === 'notebook' ? 140 : 64;
  line(x, 1360, 1016, 1360, C.rule, STYLE_ID === 'brutal' ? 3 : 1);
  if (STYLE_ID === 'newspaper') line(x, 1353, 1016, 1353, C.ink, 3);
  extraText(CONTENT.footer, x, 1380, 1016 - x - 74, 19, C.muted, 'body', 400, 1420);
  extraText(String(index).padStart(2, '0'), 966, 1375, 50, 28, STYLE_ID === 'swiss' ? C.muted : C.signal, 'mono', 600, 1420);
}

// Surface and numbering are reused on covers, content pages and summaries.
// Decorative strokes stay in padding/gutters, never through a text baseline.
function extraSurface(x, y, w, h, kind='panel', n=0) {
  let ink = C.ink, muted = C.muted;
  if (STYLE_ID === 'brutal') {
    const fill = kind === 'callout' ? C.signal : kind === 'hero' ? C.accent : [C.panel,C.light,C.soft][n % 3];
    box(x + 10, y + 10, w, h, C.ink);
    extraRect(x, y, w, h, fill, C.ink, 5);
    if (kind === 'callout') ink = muted = C.codeInk;
  } else if (STYLE_ID === 'blueprint') {
    const light = kind === 'callout';
    extraRect(x, y, w, h, light ? C.light : C.panel, C.rule, 1.5);
    box(x + 1, y + 1, 5, Math.min(44, h - 2), C.accent);
    if (light) { ink = C.dark; muted = C.paper; }
    // Engineering registration marks are confined to the panel corners.
    line(x + w - 17, y + 7, x + w - 7, y + 7, light ? C.dark : C.accent);
    line(x + w - 7, y + 7, x + w - 7, y + 17, light ? C.dark : C.accent);
  } else if (STYLE_ID === 'neon') {
    const edge = ctx.createLinearGradient(x, y, x + w, y + h);
    edge.addColorStop(0, C.accent); edge.addColorStop(.55, C.signal); edge.addColorStop(1, C.rule);
    ctx.save(); ctx.shadowColor = C.signal; ctx.shadowBlur = 16;
    extraRect(x, y, w, h, C.panel, edge, 1.5, 16); ctx.restore();
  } else if (STYLE_ID === 'notebook') {
    if (kind !== 'panel') extraRect(x, y, w, h, kind === 'hero' ? C.accent : C.light, null, 1, 3);
    else line(x, y + h, x + w, y + h, C.rule);
  } else if (STYLE_ID === 'newspaper') {
    if (kind === 'callout') box(x, y, w, h, C.light);
    line(x, y, x + w, y, C.ink, 3); line(x, y + 7, x + w, y + 7, C.rule);
    line(x, y + h, x + w, y + h, C.rule);
  } else {
    if (kind === 'callout') box(x, y + 8, 6, h - 16, C.signal);
    else { line(x, y, x + w, y, C.ink, 2); line(x, y + h, x + w, y + h, C.rule); }
  }
  const bottom = y + h + (STYLE_ID === 'brutal' ? 10 : 0);
  if (bottom > 1330) extraDiagnostic({type:'surface',bottom,maxBottom:1330});
  return {ink,muted};
}
function extraMark(n, x, y, size=44) {
  const label = String(n).padStart(2, '0');
  if (STYLE_ID === 'notebook') {
    extraRect(x, y + 2, 30, 30, C.paper, C.signal, 2, 2);
    line(x + 6, y + 16, x + 13, y + 24, C.signal, 3);
    line(x + 13, y + 24, x + 25, y + 8, C.signal, 3);
    extraText(label, x, y + 38, 44, 20, C.signal, 'mono', 500);
  } else if (STYLE_ID === 'blueprint') {
    extraCircle(x + 23, y + 23, 22, C.paper, C.accent, 1.5);
    extraText(label, x + 8, y + 11, 32, 24, C.accent, 'mono', 500);
  } else if (STYLE_ID === 'brutal') {
    extraRect(x, y, 54, 54, n % 2 ? C.accent : C.ink, C.ink, 3);
    extraText(label, x + 6, y + 10, 42, 32, n % 2 ? C.ink : C.panel, 'mono', 750);
  } else {
    extraText(label, x, y, 66, STYLE_ID === 'newspaper' ? 27 : size, STYLE_ID === 'swiss' ? C.muted : STYLE_ID === 'neon' && n % 2 === 0 ? C.signal : STYLE_ID === 'neon' ? C.accent : C.signal, STYLE_ID === 'newspaper' ? 'title' : 'mono', C.titleWeight);
  }
}
function extraHero(lines, x, y, w, size) {
  const padding = STYLE_ID === 'brutal' ? 20 : 0;
  const b = extraBlock(Array.isArray(lines) ? lines.join('\n') : lines, w - padding * 2, size, 'title', 1.22);
  if (padding) extraSurface(x, y, w, b.h + padding * 2, 'hero');
  b.rows.forEach((row, i) => {
    if (STYLE_ID === 'notebook') {
      ctx.font = extraFont('title', size, C.titleWeight);
      box(x, y + i * b.step + size * .55, Math.min(w, ctx.measureText(row).width + 8), size * .45, C.accent);
    }
    extraText(row, x + padding, y + padding + i * b.step, b.w, size, STYLE_ID === 'neon' && i % 2 ? C.accent : C.ink, 'title', C.titleWeight);
  });
  const end = y + b.h + padding * 2;
  if (end > 1330) extraDiagnostic({type:'headline',text:b.source,bottom:end,maxBottom:1330});
  return end;
}
function extraLimit(items, max, field) {
  // Render excess entries too; diagnostics makes an out-of-contract input explicit.
  if (items.length > max) extraDiagnostic({type:'count',field,count:items.length,max});
}

// One measured entry, with a Swiss comparison grid, an engineering node gutter,
// or a compact summary row. Newspaper columns are arranged by extraEntries.
function extraEntry(d, n, x, y, w, kind='stack') {
  const blueprint = STYLE_ID === 'blueprint', news = STYLE_ID === 'newspaper';
  const framed = STYLE_ID === 'brutal' || STYLE_ID === 'neon' || blueprint;
  const pad = kind === 'table' ? 14 : framed ? 20 : 12;
  const surfaceX = blueprint ? x + 66 : x, surfaceW = blueprint ? w - 66 : w;
  const tx = blueprint ? surfaceX + pad : x + pad + (news ? 0 : 72);
  const tw = x + w - pad - tx;
  const titleSize = kind === 'table' ? 30 : 32;
  const side = ((STYLE_ID === 'swiss' || news) && w > 700) || (kind === 'table' && !news);
  const titleW = side ? Math.min(270, tw * .38) : news ? tw - 48 : tw;
  const bodyW = side ? tw - titleW - 24 : tw;
  const title = extraBlock(d.title, titleW - (side && news ? 48 : 0), titleSize, 'title', 1.2);
  const body = extraBlock(d.body, bodyW, 25, 'body', 1.4);
  const note = extraBlock(d.note, tw, 22, 'body', 1.38);
  const primaryH = side ? Math.max(title.h, body.h) : title.h + (body.h ? 8 + body.h : 0);
  const h = Math.max(kind === 'table' ? 92 : 100, pad * 2 + primaryH + (note.h ? 6 + note.h : 0));
  extraSurface(surfaceX, y, surfaceW, h, 'panel', n - 1);
  if (blueprint) {
    extraMark(n, x, y + pad);
    line(x + 46, y + pad + 23, surfaceX - 6, y + pad + 23, C.accent, 1.5);
    line(surfaceX - 12, y + pad + 19, surfaceX - 6, y + pad + 23, C.accent, 1.5);
    line(surfaceX - 12, y + pad + 27, surfaceX - 6, y + pad + 23, C.accent, 1.5);
  } else extraMark(n, x + pad, y + pad, kind === 'table' ? 34 : 44);
  if (side && news) line(tx + titleW + 12, y + pad, tx + titleW + 12, y + pad + primaryH, C.soft);
  extraDraw(title, tx + (news ? 48 : 0), y + pad);
  extraDraw(body, side ? tx + titleW + 24 : tx, y + pad + (side ? 0 : title.h + 8), C.muted);
  if (note.h) extraDraw(note, tx, y + pad + primaryH + 6, C.muted);
  return y + h;
}
function extraEntries(items, x, y, w, kind='stack', columns=1) {
  const gap = kind === 'table' ? 12 : STYLE_ID === 'brutal' ? 18 : 16;
  if (STYLE_ID === 'newspaper' && items.length > 1) {
    const cw = (w - 64) / 2, split = Math.ceil(items.length / 2), ends = [y,y];
    items.forEach((d, i) => {
      const col = i < split ? 0 : 1;
      ends[col] = extraEntry(d, i + 1, x + col * (cw + 64), ends[col], cw, 'stack') + gap;
    });
    const end = Math.max(...ends) - gap;
    line(x + w / 2, y, x + w / 2, end, C.soft);
    return end;
  }
  const cw = (w - (columns - 1) * 32) / columns;
  let yy = y, previousRow;
  for (let i = 0; i < items.length; i += columns) {
    let end = yy;
    for (let col = 0; col < columns && i + col < items.length; col++) {
      const xx = x + col * (cw + 32);
      if (STYLE_ID === 'blueprint' && previousRow !== undefined) line(xx + 23, previousRow, xx + 23, yy + 18, C.accent);
      end = Math.max(end, extraEntry(items[i + col], i + col + 1, xx, yy, cw, kind));
    }
    previousRow = yy + 66;
    yy = end + gap;
  }
  return items.length ? yy - gap : y;
}
function extraTags(tags, x, y, w) {
  let xx = x, yy = y, rowH = 0;
  for (const tag of tags) {
    ctx.font = extraFont('body', 22, 600);
    const tw = Math.min(w, ctx.measureText(String(tag)).width + 28);
    const b = extraBlock(tag, tw - 28, 22, 'body', 1.3, 600), h = b.h + 14;
    if (xx > x && xx + tw > x + w) { xx = x; yy += rowH + 10; rowH = 0; }
    extraRect(xx, yy, tw, h, STYLE_ID === 'neon' ? C.light : STYLE_ID === 'blueprint' ? C.panel : C.light, C.rule, STYLE_ID === 'brutal' ? 2 : 1, STYLE_ID === 'neon' ? 12 : 2);
    extraDraw(b, xx + 14, yy + 7, C.ink);
    rowH = Math.max(rowH, h); xx += tw + 12;
  }
  return tags.length ? yy + rowH : y;
}

function extendedCover(total) {
  const d = CONTENT.cover, frame = extraStart(1, total), {x,w} = frame;
  let y = extraDraw(extraBlock(d.badge, w, 23, 'title', 1.3), x, frame.y, C.signal) + 16;
  const countW = 140, title = extraBlock(d.title, w - countW - 22, 72, 'title', 1.2);
  const countH = Math.max(132, title.h);
  if (STYLE_ID === 'brutal' || STYLE_ID === 'blueprint' || STYLE_ID === 'neon') extraSurface(x, y, countW, countH, 'hero');
  if (STYLE_ID === 'notebook') box(x, y + 70, countW, 50, C.accent);
  extraText(d.count, x + 10, y + 6, countW - 20, 106, STYLE_ID === 'swiss' ? C.muted : STYLE_ID === 'newspaper' ? C.signal : C.ink, 'title', C.titleWeight);
  extraDraw(title, x + countW + 22, y + Math.max(0, (countH - title.h) / 2));
  y += countH + 22;
  y = extraHero(d.headline, x, y, w, 62) + 18;
  y = extraDraw(extraBlock(d.subtitle, w, 28, 'body', 1.4), x, y, C.muted) + 30;
  extraLimit(d.items, 6, 'cover.items');
  y = extraEntries(d.items.map(item => ({title:item.name,body:item.detail})), x, Math.max(y, 610), w, 'stack', 2);
  const scope = extraBlock(d.scope, w - 48, 26, 'body', 1.4, 550), h = scope.h + 40;
  y = Math.max(y + 28, 1210);
  const colors = extraSurface(x, y, w, h, 'callout');
  extraDraw(scope, x + 24, y + 20, colors.ink);
  extraFooter(1);
  finish('01-cover.png', '01 / 封面');
}

function extraPricing(d, x, y, w) {
  const pad = 20, gap = 48, cw = (w - pad * 2 - gap) / 2;
  const free = extraBlock(d.freeTitle, cw, 32, 'title', 1.2);
  const freeNote = extraBlock(d.freeNote, cw, 22, 'body', 1.38);
  const label = extraBlock(d.paidLabel, cw, 22, 'title', 1.3);
  // Price and unit may wrap, but are never replaced with invented amounts or copy.
  const price = extraBlock(d.price, cw, 48, 'title', 1.15);
  const unit = extraBlock(d.priceUnit, cw, 23, 'body', 1.3);
  ctx.font = extraFont('title', 48, C.titleWeight);
  const priceWidth = price.rows.length === 1 ? ctx.measureText(price.rows[0]).width : cw;
  ctx.font = extraFont('body', 23, 400);
  const unitWidth = unit.rows.length === 1 ? ctx.measureText(unit.rows[0]).width : cw;
  const inline = price.rows.length === 1 && unit.rows.length <= 1 && priceWidth + 16 + unitWidth <= cw;
  const amountH = inline ? Math.max(price.h, unit.h) : price.h + (unit.h ? 4 + unit.h : 0);
  const paidNote = extraBlock(d.paidNote, cw, 22, 'body', 1.38);
  const rightH = label.h + 6 + amountH + 8 + paidNote.h;
  const h = pad * 2 + Math.max(free.h + 16 + freeNote.h, rightH);
  const colors = extraSurface(x, y, w, h);
  const rx = x + pad + cw + gap;
  line(x + w / 2, y + pad, x + w / 2, y + h - pad, C.rule);
  extraDraw(free, x + pad, y + pad, colors.ink);
  extraDraw(freeNote, x + pad, y + pad + free.h + 16, colors.muted);
  extraDraw(label, rx, y + pad, colors.muted);
  const amountY = y + pad + label.h + 6;
  extraDraw(price, rx, amountY, STYLE_ID === 'neon' || STYLE_ID === 'blueprint' ? C.accent : colors.ink);
  extraDraw(unit, inline ? rx + priceWidth + 16 : rx, inline ? amountY + Math.max(0, price.size - unit.size) : amountY + price.h + 4, colors.muted);
  extraDraw(paidNote, rx, amountY + amountH + 8, colors.muted);
  return y + h;
}
function extraPromo(d, x, y, w) {
  const labelW = Math.min(160, w * .19), bodyW = w - labelW - 76;
  const label = extraBlock(d.promoLabel, labelW, 23, 'title', 1.3);
  const main = extraBlock(d.promoMain, bodyW, 32, 'title', 1.2);
  const note = extraBlock(d.promoNote, bodyW, 22, 'body', 1.38);
  const h = Math.max(label.h, main.h + (note.h ? 8 + note.h : 0)) + 40;
  const colors = extraSurface(x, y, w, h, 'callout');
  extraDraw(label, x + 20, y + 20, colors.ink);
  line(x + labelW + 36, y + 20, x + labelW + 36, y + h - 20, STYLE_ID === 'brutal' ? C.codeInk : C.rule);
  extraDraw(main, x + labelW + 56, y + 20, colors.ink);
  extraDraw(note, x + labelW + 56, y + 20 + main.h + 8, colors.muted);
  return y + h;
}
function extendedProduct(d, index, total) {
  const {x,w,y:startY} = extraStart(index, total);
  let y = extraDraw(extraBlock(d.name, w, 76, 'title', 1.2), x, startY) + 8;
  y = extraDraw(extraBlock(d.sub, w, 26, 'body', 1.35), x, y, C.muted) + 14;
  y = extraHero(d.headline, x, y, w, 44) + 16;
  y = extraTags(d.tags, x, y, w) + 18;
  extraLimit(d.features, 3, 'product.features');
  y = extraEntries(d.features.map(([title,body]) => ({title,body})), x, y, w);
  y = extraPricing(d, x, Math.max(y + 24, 944), w) + 24;
  extraPromo(d, x, y, w);
  extraFooter(index);
}

// Source is never trimmed, wrapped, abbreviated or passed through a formatter.
// Tabs use four-column stops; the source itself (including trailing blank lines) is unchanged.
function extraCode(source, x, y, w, codeTitle) {
  const raw = String(source), rows = raw.split('\n');
  const label = extraBlock(codeTitle ?? '代码', w - 48, 24, 'title', 1.3);
  const top = label.h ? label.h + 36 : 20, h = top + rows.length * 34 + 20;
  extraRect(x, y, w, h, C.dark, STYLE_ID === 'neon' ? C.signal : C.rule, STYLE_ID === 'brutal' ? 3 : 1.5, STYLE_ID === 'neon' ? 14 : 3);
  extraDraw(label, x + 24, y + 16, STYLE_ID === 'newspaper' ? C.accent : C.codeInk);
  if (label.h) line(x + 24, y + label.h + 25, x + w - 24, y + label.h + 25, C.rule);
  ctx.font = extraFont('mono', 24, 400);
  const space = ctx.measureText(' ').width;
  rows.forEach((row, i) => {
    let column = 0, offset = 0;
    const parts = row.split('\t');
    parts.forEach((part, j) => {
      const width = extraText(part, x + 24 + offset, y + top + i * 34, w - 48 - offset, 24, /^\s*#/.test(row) ? C.codeComment : C.codeInk, 'mono');
      column += Array.from(part).length; offset += width;
      if (j < parts.length - 1) { const spaces = 4 - column % 4; offset += spaces * space; column += spaces; }
    });
    if (offset > w - 48 + .5) extraDiagnostic({type:'code-width',text:row,source:raw,width:offset,max:w - 48});
  });
  if (y + h > 1330) extraDiagnostic({type:'code',text:raw,bottom:y + h,maxBottom:1330});
  return y + h;
}
function extendedGuide(d, index, total) {
  const {x,w,y:startY} = extraStart(index, total);
  let y = extraDraw(extraBlock(d.title, w, 72, 'title', 1.2), x, startY) + 12;
  y = extraDraw(extraBlock(d.sub, w, 26, 'body', 1.4), x, y, C.muted) + 28;
  extraLimit(d.sections, 3, 'guide.sections');
  d.sections.forEach((section, i) => {
    const hasCode = section.code !== undefined && section.code !== null;
    y = extraEntry({title:section.title,body:hasCode ? '' : section.body}, i + 1, x, y, w);
    if (hasCode) {
      y = extraCode(section.code, x, y + 16, w, section.codeTitle);
      y = extraDraw(extraBlock(section.body, w - 48, 26), x + 24, y + 18, C.muted);
    } else if (section.codeTitle !== undefined) {
      y = extraDraw(extraBlock(section.codeTitle, w, 24, 'title'), x, y + 12);
    }
    y += 24;
  });
  extraFooter(index);
}

function extendedClosing(index, total) {
  const d = CONTENT.closing, {x,w,y:startY} = extraStart(index, total);
  let y = extraHero(d.title, x, startY, w, 60) + 14;
  y = extraDraw(extraBlock(d.sub, w, 26, 'body', 1.35), x, y, C.muted) + 18;
  y = extraDraw(extraBlock(d.tableTitle, w, 26, 'title', 1.2), x, y, C.signal) + 16;
  extraLimit(d.rows, 6, 'closing.rows');
  y = extraEntries(d.rows.map(([name,task,note]) => ({title:name,body:task,note})), x, y, w, 'table');
  const tip = extraBlock(d.tip, w - 48, 30, 'title', 1.3);
  const warning = extraBlock(d.warning, w - 48, 25, 'body', 1.4);
  const note = extraBlock(d.note, w - 48, 22, 'body', 1.38);
  const h = 40 + tip.h + 10 + warning.h + 8 + note.h;
  y = Math.max(y + 26, 1140);
  const colors = extraSurface(x, y, w, h, 'callout');
  let yy = extraDraw(tip, x + 24, y + 20, colors.ink) + 10;
  yy = extraDraw(warning, x + 24, yy, colors.ink) + 8;
  extraDraw(note, x + 24, yy, colors.muted);
  extraFooter(index);
  finish(`${String(index).padStart(2, '0')}-summary.png`, `${String(index).padStart(2, '0')} / 总结`);
}
