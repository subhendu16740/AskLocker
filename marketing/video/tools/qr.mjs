// A QR code for the pamphlets, with no package: byte mode, error correction M,
// versions 1 to 9 (up to 180 bytes), the mask with the lowest penalty, as
// ISO/IEC 18004 has it. qrSvg(text) is the code as an SVG, with its quiet zone.
//
//   node tools/qr.mjs --check     the spec's own test values, and every
//                                 pamphlet's address read back from its code

// ─── GF(256), x^8 + x^4 + x^3 + x^2 + 1 ─────────────────────────────────
const EXP = new Array(512);
const LOG = new Array(256);
for (let i = 0, x = 1; i < 255; i++) {
  EXP[i] = x;
  LOG[x] = i;
  x <<= 1;
  if (x & 0x100) x ^= 0x11d;
}
for (let i = 255; i < 512; i++) EXP[i] = EXP[i - 255];
const mul = (a, b) => (a && b ? EXP[LOG[a] + LOG[b]] : 0);

/** Reed-Solomon: n error-correction codewords for data. */
export function rsEc(data, n) {
  let g = [1];
  for (let i = 0; i < n; i++) {
    const next = new Array(g.length + 1).fill(0);
    for (let j = 0; j < g.length; j++) {
      next[j] ^= g[j];
      next[j + 1] ^= mul(g[j], EXP[i]);
    }
    g = next;
  }
  const r = [...data, ...new Array(n).fill(0)];
  for (let i = 0; i < data.length; i++) {
    const c = r[i];
    if (c) for (let j = 0; j < g.length; j++) r[i + j] ^= mul(g[j], c);
  }
  return r.slice(data.length);
}

// Error correction M: codewords per block, and [blocks, data codewords] groups.
const EC_M = {
  1: [10, [[1, 16]]], 2: [16, [[1, 28]]], 3: [26, [[1, 44]]], 4: [18, [[2, 32]]], 5: [24, [[2, 43]]],
  6: [16, [[4, 27]]], 7: [18, [[4, 31]]], 8: [22, [[2, 38], [2, 39]]], 9: [22, [[3, 36], [2, 37]]],
};
const ALIGN = { 1: [], 2: [6, 18], 3: [6, 22], 4: [6, 26], 5: [6, 30], 6: [6, 34], 7: [6, 22, 38], 8: [6, 24, 42], 9: [6, 26, 46] };
const dataCapacity = (v) => EC_M[v][1].reduce((s, [b, d]) => s + b * d, 0);

/** The format information: M (00), the mask, BCH(15,5), XORed with 101010000010010. */
export function formatBits(mask) {
  const data = (0 << 3) | mask;
  let rem = data;
  for (let i = 0; i < 10; i++) rem = (rem << 1) ^ ((rem >>> 9) * 0x537);
  return ((data << 10) | (rem & 0x3ff)) ^ 0x5412;
}
/** The version information, from version 7: BCH(18,6). */
export function versionBits(v) {
  let rem = v;
  for (let i = 0; i < 12; i++) rem = (rem << 1) ^ ((rem >>> 11) * 0x1f25);
  return (v << 12) | (rem & 0xfff);
}

function codewords(bytes, v) {
  const cap = dataCapacity(v);
  const bits = [];
  const put = (val, n) => { for (let i = n - 1; i >= 0; i--) bits.push((val >>> i) & 1); };
  put(0b0100, 4);
  put(bytes.length, 8);
  bytes.forEach((b) => put(b, 8));
  put(0, Math.min(4, cap * 8 - bits.length));
  while (bits.length % 8) bits.push(0);
  const data = [];
  for (let i = 0; i < bits.length; i += 8) data.push(bits.slice(i, i + 8).reduce((a, b) => (a << 1) | b, 0));
  for (let pad = 0xec; data.length < cap; pad ^= 0xec ^ 0x11) data.push(pad);
  // Split into blocks, add each one's error correction, interleave.
  const [ecn, groups] = EC_M[v];
  const blocks = [];
  let k = 0;
  for (const [count, len] of groups) for (let b = 0; b < count; b++) { blocks.push(data.slice(k, k + len)); k += len; }
  const ecs = blocks.map((b) => rsEc(b, ecn));
  const out = [];
  const longest = Math.max(...blocks.map((b) => b.length));
  for (let i = 0; i < longest; i++) for (const b of blocks) if (i < b.length) out.push(b[i]);
  for (let i = 0; i < ecn; i++) for (const e of ecs) out.push(e[i]);
  return out;
}

const MASKS = [
  (x, y) => (x + y) % 2 === 0, (x, y) => y % 2 === 0, (x) => x % 3 === 0, (x, y) => (x + y) % 3 === 0,
  (x, y) => (Math.floor(x / 3) + Math.floor(y / 2)) % 2 === 0, (x, y) => ((x * y) % 2) + ((x * y) % 3) === 0,
  (x, y) => (((x * y) % 2) + ((x * y) % 3)) % 2 === 0, (x, y) => (((x + y) % 2) + ((x * y) % 3)) % 2 === 0,
];

/** The modules of the code for text (true is dark), as rows. */
export function qrMatrix(text, { mask: forced = null, version: minVersion = 1 } = {}) {
  const bytes = [...new TextEncoder().encode(text)];
  let v = minVersion;
  while (v <= 9 && 4 + 8 + bytes.length * 8 > dataCapacity(v) * 8) v++;
  if (v > 9) throw new Error(`Too long for a QR code here: ${bytes.length} bytes`);
  const size = 17 + 4 * v;
  const m = Array.from({ length: size }, () => new Array(size).fill(false));
  const fn = Array.from({ length: size }, () => new Array(size).fill(false));
  const set = (x, y, dark) => { m[y][x] = dark; fn[y][x] = true; };
  for (let i = 0; i < size; i++) { set(6, i, i % 2 === 0); set(i, 6, i % 2 === 0); }
  for (const [cx, cy] of [[3, 3], [size - 4, 3], [3, size - 4]]) {
    for (let dy = -4; dy <= 4; dy++) for (let dx = -4; dx <= 4; dx++) {
      const x = cx + dx;
      const y = cy + dy;
      if (x < 0 || y < 0 || x >= size || y >= size) continue;
      const d = Math.max(Math.abs(dx), Math.abs(dy));
      set(x, y, d !== 2 && d !== 4);
    }
  }
  const al = ALIGN[v];
  al.forEach((ay, i) => al.forEach((ax, j) => {
    if ((i === 0 && j === 0) || (i === 0 && j === al.length - 1) || (i === al.length - 1 && j === 0)) return;
    for (let dy = -2; dy <= 2; dy++) for (let dx = -2; dx <= 2; dx++) set(ax + dx, ay + dy, Math.max(Math.abs(dx), Math.abs(dy)) !== 1);
  }));
  const drawFormat = (mask) => {
    const bits = formatBits(mask);
    const bit = (i) => ((bits >>> i) & 1) === 1;
    for (let i = 0; i <= 5; i++) set(8, i, bit(i));
    set(8, 7, bit(6));
    set(8, 8, bit(7));
    set(7, 8, bit(8));
    for (let i = 9; i < 15; i++) set(14 - i, 8, bit(i));
    for (let i = 0; i < 8; i++) set(size - 1 - i, 8, bit(i));
    for (let i = 8; i < 15; i++) set(8, size - 15 + i, bit(i));
    set(8, size - 8, true);
  };
  drawFormat(0);
  if (v >= 7) {
    const bits = versionBits(v);
    for (let i = 0; i < 18; i++) {
      const dark = ((bits >>> i) & 1) === 1;
      const a = size - 11 + (i % 3);
      const b = Math.floor(i / 3);
      set(a, b, dark);
      set(b, a, dark);
    }
  }
  // The data, two columns at a time from the right, up then down.
  const cw = codewords(bytes, v);
  let k = 0;
  for (let right = size - 1; right >= 1; right -= 2) {
    if (right === 6) right = 5;
    for (let vert = 0; vert < size; vert++) {
      for (let j = 0; j < 2; j++) {
        const x = right - j;
        const up = ((right + 1) & 2) === 0;
        const y = up ? size - 1 - vert : vert;
        if (!fn[y][x] && k < cw.length * 8) {
          m[y][x] = ((cw[k >>> 3] >>> (7 - (k & 7))) & 1) === 1;
          k++;
        }
      }
    }
  }
  const masked = (mask) => {
    const out = m.map((row, y) => row.map((d, x) => (fn[y][x] ? d : d !== MASKS[mask](x, y))));
    const save = m.map((r) => [...r]);
    drawFormat(mask);
    const withFormat = out.map((row, y) => row.map((d, x) => (fn[y][x] ? m[y][x] : d)));
    m.forEach((r, y) => r.forEach((_, x) => { m[y][x] = save[y][x]; }));
    return withFormat;
  };
  if (forced !== null) return { version: v, size, modules: masked(forced), mask: forced };
  let best = null;
  for (let mask = 0; mask < 8; mask++) {
    const mm = masked(mask);
    const p = penalty(mm);
    if (!best || p < best.p) best = { p, mask, mm };
  }
  return { version: v, size, modules: best.mm, mask: best.mask };
}

function penalty(m) {
  const n = m.length;
  let p = 0;
  const lines = [];
  for (let i = 0; i < n; i++) { lines.push(m[i]); lines.push(m.map((r) => r[i])); }
  for (const line of lines) {
    let run = 1;
    for (let i = 1; i <= n; i++) {
      if (i < n && line[i] === line[i - 1]) run++;
      else { if (run >= 5) p += 3 + run - 5; run = 1; }
    }
    const s = line.map((d) => (d ? '1' : '0')).join('');
    for (const pat of ['10111010000', '00001011101']) for (let i = s.indexOf(pat); i >= 0; i = s.indexOf(pat, i + 1)) p += 40;
  }
  for (let y = 0; y < n - 1; y++) for (let x = 0; x < n - 1; x++) {
    const c = m[y][x];
    if (c === m[y][x + 1] && c === m[y + 1][x] && c === m[y + 1][x + 1]) p += 3;
  }
  const dark = m.flat().filter(Boolean).length;
  p += Math.floor(Math.abs((dark * 100) / (n * n) - 50) / 5) * 10;
  return p;
}

/** The code as an SVG: dark modules in color, a quiet zone of 4 modules. */
export function qrSvg(text, { color = '#111827', background = '#ffffff' } = {}) {
  const { size, modules } = qrMatrix(text);
  const q = 4;
  const n = size + q * 2;
  let d = '';
  modules.forEach((row, y) => row.forEach((dark, x) => { if (dark) d += `M${x + q},${y + q}h1v1h-1z`; }));
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${n} ${n}" shape-rendering="crispEdges"><rect width="${n}" height="${n}" fill="${background}"/><path d="${d}" fill="${color}"/></svg>`;
}

// ─── A reader, to check what was written: the format both ways, the mask
// removed, the codewords taken back out, each block's syndromes, the text.
export function qrRead(modules) {
  const size = modules.length;
  const v = (size - 17) / 4;
  const dark = (x, y) => modules[y][x];
  // Format, first copy (around the top-left finder), and second.
  let f1 = 0;
  const one = [[8, 0], [8, 1], [8, 2], [8, 3], [8, 4], [8, 5], [8, 7], [8, 8], [7, 8], [5, 8], [4, 8], [3, 8], [2, 8], [1, 8], [0, 8]];
  one.forEach(([x, y], i) => { if (dark(x, y)) f1 |= 1 << i; });
  let f2 = 0;
  for (let i = 0; i < 8; i++) if (dark(size - 1 - i, 8)) f2 |= 1 << i;
  for (let i = 8; i < 15; i++) if (dark(8, size - 15 + i)) f2 |= 1 << i;
  if (f1 !== f2) throw new Error('the two format copies differ');
  const mask = [...Array(8).keys()].find((k) => formatBits(k) === f1);
  if (mask === undefined) throw new Error('format information is not M');
  // Which modules are not data: rebuild only the function patterns.
  const fn = Array.from({ length: size }, () => new Array(size).fill(false));
  const mark = (x, y) => { if (x >= 0 && y >= 0 && x < size && y < size) fn[y][x] = true; };
  for (let i = 0; i < size; i++) { mark(6, i); mark(i, 6); }
  for (const [cx, cy] of [[3, 3], [size - 4, 3], [3, size - 4]]) for (let dy = -4; dy <= 4; dy++) for (let dx = -4; dx <= 4; dx++) mark(cx + dx, cy + dy);
  const al = ALIGN[v];
  al.forEach((ay, i) => al.forEach((ax, j) => {
    if ((i === 0 && j === 0) || (i === 0 && j === al.length - 1) || (i === al.length - 1 && j === 0)) return;
    for (let dy = -2; dy <= 2; dy++) for (let dx = -2; dx <= 2; dx++) mark(ax + dx, ay + dy);
  }));
  for (let i = 0; i < 9; i++) { mark(8, i); mark(i, 8); }
  for (let i = 0; i < 8; i++) { mark(size - 1 - i, 8); mark(8, size - 1 - i); }
  if (v >= 7) for (let i = 0; i < 18; i++) { const a = size - 11 + (i % 3); const b = Math.floor(i / 3); mark(a, b); mark(b, a); }
  const bits = [];
  for (let right = size - 1; right >= 1; right -= 2) {
    if (right === 6) right = 5;
    const up = ((right + 1) & 2) === 0;
    for (let vert = 0; vert < size; vert++) for (let j = 0; j < 2; j++) {
      const x = right - j;
      const y = up ? size - 1 - vert : vert;
      if (!fn[y][x]) bits.push(dark(x, y) !== MASKS[mask](x, y) ? 1 : 0);
    }
  }
  const [ecn, groups] = EC_M[v];
  const total = groups.reduce((s, [b, d]) => s + b * (d + ecn), 0);
  const cw = [];
  for (let i = 0; i < total; i++) cw.push(bits.slice(i * 8, i * 8 + 8).reduce((a, b) => (a << 1) | b, 0));
  // Undo the interleaving.
  const lens = groups.flatMap(([b, d]) => new Array(b).fill(d));
  const blocks = lens.map(() => []);
  let k = 0;
  for (let i = 0; i < Math.max(...lens); i++) lens.forEach((len, b) => { if (i < len) blocks[b].push(cw[k++]); });
  const ecs = lens.map(() => []);
  for (let i = 0; i < ecn; i++) lens.forEach((_, b) => ecs[b].push(cw[k++]));
  // Each block's syndromes are zero when nothing is wrong.
  blocks.forEach((b, i) => {
    const all = [...b, ...ecs[i]];
    for (let s = 0; s < ecn; s++) {
      let acc = 0;
      for (const c of all) acc = mul(acc, EXP[s]) ^ c;
      if (acc !== 0) throw new Error(`block ${i} fails its check`);
    }
  });
  const data = blocks.flat();
  const dbits = data.flatMap((c) => [7, 6, 5, 4, 3, 2, 1, 0].map((s) => (c >>> s) & 1));
  const take = (n, at) => dbits.slice(at, at + n).reduce((a, b) => (a << 1) | b, 0);
  if (take(4, 0) !== 0b0100) throw new Error('not byte mode');
  const len = take(8, 4);
  const out = [];
  for (let i = 0; i < len; i++) out.push(take(8, 12 + i * 8));
  return { version: v, mask, text: new TextDecoder().decode(new Uint8Array(out)) };
}

if (process.argv[1] && import.meta.url.endsWith(process.argv[1].split('/').pop()) && process.argv.includes('--check')) {
  const eq = (a, b, what) => {
    if (JSON.stringify(a) !== JSON.stringify(b)) throw new Error(`${what}: ${JSON.stringify(a)} is not ${JSON.stringify(b)}`);
    console.log(`ok  ${what}`);
  };
  // "HELLO WORLD" at 1-M, the standard worked example: its error correction.
  eq(rsEc([32, 91, 11, 120, 209, 114, 220, 77, 67, 64, 236, 17, 236, 17, 236, 17], 10), [196, 35, 39, 119, 235, 215, 231, 226, 93, 23], 'Reed-Solomon, HELLO WORLD 1-M');
  eq(formatBits(0).toString(2).padStart(15, '0'), '101010000010010', 'format bits, M and mask 0');
  eq(versionBits(7).toString(2).padStart(18, '0'), '000111110010010100', 'version bits, version 7');
  const { SECTORS, pamphletUrl } = await import('../src/sectors.js');
  const texts = [...Object.keys(SECTORS).map(pamphletUrl), 'https://asklocker.com/', 'x'.repeat(150)];
  for (const text of texts) for (let mask = 0; mask < 8; mask++) {
    const r = qrRead(qrMatrix(text, { mask }).modules);
    if (r.text !== text) throw new Error(`read back ${r.text}`);
  }
  for (let v = 1; v <= 9; v++) eq(qrRead(qrMatrix('asklocker', { version: v, mask: v % 8 }).modules).version, v, `version ${v} read back`);
  console.log(`ok  ${texts.length} addresses, every mask, read back`);
}
