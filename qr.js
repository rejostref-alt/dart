// Generator kodów QR (tryb bajtowy, korekcja L, wersje 1–20) – bez zewnętrznych bibliotek, działa offline.
'use strict';
const QR = (() => {
  // [kody EC na blok, [[liczba bloków, bajty danych na blok], ...]]
  const EC_L = { 1: [7, [[1, 19]]], 2: [10, [[1, 34]]], 3: [15, [[1, 55]]], 4: [20, [[1, 80]]], 5: [26, [[1, 108]]], 6: [18, [[2, 68]]],
    7: [20, [[2, 78]]], 8: [24, [[2, 97]]], 9: [30, [[2, 116]]], 10: [18, [[2, 68], [2, 69]]], 11: [20, [[4, 81]]], 12: [24, [[2, 92], [2, 93]]],
    13: [26, [[4, 107]]], 14: [30, [[3, 115], [1, 116]]], 15: [22, [[5, 87], [1, 88]]], 16: [24, [[5, 98], [1, 99]]], 17: [28, [[1, 107], [5, 108]]],
    18: [30, [[5, 120], [1, 121]]], 19: [28, [[3, 113], [4, 114]]], 20: [28, [[3, 107], [5, 108]]] };
  const ALIGN = { 1: [], 2: [6, 18], 3: [6, 22], 4: [6, 26], 5: [6, 30], 6: [6, 34], 7: [6, 22, 38], 8: [6, 24, 42], 9: [6, 26, 46], 10: [6, 28, 50],
    11: [6, 30, 54], 12: [6, 32, 58], 13: [6, 34, 62], 14: [6, 26, 46, 66], 15: [6, 26, 48, 70], 16: [6, 26, 50, 74], 17: [6, 30, 54, 78],
    18: [6, 30, 56, 82], 19: [6, 30, 58, 86], 20: [6, 34, 62, 90] };
  const EXP = new Array(512), LOG = new Array(256);
  for (let i = 0, x = 1; i < 255; i++) { EXP[i] = x; LOG[x] = i; x <<= 1; if (x & 0x100) x ^= 0x11d; }
  for (let i = 255; i < 512; i++) EXP[i] = EXP[i - 255];
  const mul = (a, b) => (a && b ? EXP[LOG[a] + LOG[b]] : 0);
  function rsGen(n) { let g = [1]; for (let i = 0; i < n; i++) { const ng = new Array(g.length + 1).fill(0); for (let j = 0; j < g.length; j++) { ng[j] ^= g[j]; ng[j + 1] ^= mul(g[j], EXP[i]); } g = ng; } return g; }
  function rsEnc(data, n) { const g = rsGen(n), res = new Array(n).fill(0); for (const d of data) { const f = d ^ res[0]; res.shift(); res.push(0); if (f) for (let j = 0; j < n; j++) res[j] ^= mul(g[j + 1], f); } return res; }

  function encode(text, forceMask) {
    const bytes = Array.from(new TextEncoder().encode(text));
    let ver = 0, cap = 0;
    for (let v = 1; v <= 20; v++) {
      cap = EC_L[v][1].reduce((a, [n, k]) => a + n * k, 0);
      if (4 + (v < 10 ? 8 : 16) + 8 * bytes.length <= cap * 8) { ver = v; break; }
    }
    if (!ver) throw new Error('Za dużo danych na kod QR');
    // strumień bitów
    const bits = [];
    const put = (val, len) => { for (let i = len - 1; i >= 0; i--) bits.push((val >>> i) & 1); };
    put(4, 4); put(bytes.length, ver < 10 ? 8 : 16); bytes.forEach(b => put(b, 8));
    put(0, Math.min(4, cap * 8 - bits.length)); while (bits.length % 8) bits.push(0);
    const data = []; for (let i = 0; i < bits.length; i += 8) data.push(parseInt(bits.slice(i, i + 8).join(''), 2));
    for (let p = 0; data.length < cap; p++) data.push(p % 2 ? 0x11 : 0xec);
    // bloki + przeplot
    const [ecn, groups] = EC_L[ver], blocks = []; let off = 0;
    for (const [n, k] of groups) for (let i = 0; i < n; i++) { const d = data.slice(off, off + k); off += k; blocks.push({ d, e: rsEnc(d, ecn) }); }
    const out = [], maxD = Math.max(...blocks.map(b => b.d.length));
    for (let i = 0; i < maxD; i++) for (const b of blocks) if (i < b.d.length) out.push(b.d[i]);
    for (let i = 0; i < ecn; i++) for (const b of blocks) out.push(b.e[i]);
    // macierz
    const size = ver * 4 + 17, M = [...Array(size)].map(() => new Array(size).fill(false)), F = [...Array(size)].map(() => new Array(size).fill(false));
    const set = (x, y, v) => { M[y][x] = v; F[y][x] = true; };
    for (let i = 0; i < size; i++) { set(6, i, i % 2 === 0); set(i, 6, i % 2 === 0); }
    const finder = (cx, cy) => { for (let dy = -4; dy <= 4; dy++) for (let dx = -4; dx <= 4; dx++) { const d = Math.max(Math.abs(dx), Math.abs(dy)), x = cx + dx, y = cy + dy; if (x >= 0 && x < size && y >= 0 && y < size) set(x, y, d !== 2 && d !== 4); } };
    finder(3, 3); finder(size - 4, 3); finder(3, size - 4);
    const al = ALIGN[ver], last = al.length - 1;
    for (let i = 0; i < al.length; i++) for (let j = 0; j < al.length; j++) {
      if ((i === 0 && j === 0) || (i === 0 && j === last) || (i === last && j === 0)) continue;
      for (let dy = -2; dy <= 2; dy++) for (let dx = -2; dx <= 2; dx++) set(al[i] + dx, al[j] + dy, Math.max(Math.abs(dx), Math.abs(dy)) !== 1);
    }
    const drawFormat = (mask) => {
      const dat = (1 << 3) | mask; let rem = dat; for (let i = 0; i < 10; i++) rem = (rem << 1) ^ ((rem >>> 9) * 0x537);
      const b = ((dat << 10) | rem) ^ 0x5412, bit = (i) => ((b >>> i) & 1) === 1;
      for (let i = 0; i <= 5; i++) set(8, i, bit(i));
      set(8, 7, bit(6)); set(8, 8, bit(7)); set(7, 8, bit(8));
      for (let i = 9; i < 15; i++) set(14 - i, 8, bit(i));
      for (let i = 0; i < 8; i++) set(size - 1 - i, 8, bit(i));
      for (let i = 8; i < 15; i++) set(8, size - 15 + i, bit(i));
      set(8, size - 8, true);
    };
    drawFormat(0);
    if (ver >= 7) {
      let rem = ver; for (let i = 0; i < 12; i++) rem = (rem << 1) ^ ((rem >>> 11) * 0x1f25);
      const b = (ver << 12) | rem;
      for (let i = 0; i < 18; i++) { const v = ((b >>> i) & 1) === 1, a = size - 11 + (i % 3), c = Math.floor(i / 3); set(a, c, v); set(c, a, v); }
    }
    let idx = 0;
    for (let right = size - 1; right >= 1; right -= 2) {
      if (right === 6) right = 5;
      for (let vert = 0; vert < size; vert++) for (let j = 0; j < 2; j++) {
        const x = right - j, up = ((right + 1) & 2) === 0, y = up ? size - 1 - vert : vert;
        if (!F[y][x] && idx < out.length * 8) { M[y][x] = ((out[idx >>> 3] >>> (7 - (idx & 7))) & 1) === 1; idx++; }
      }
    }
    const MASKS = [(x, y) => (x + y) % 2 === 0, (x, y) => y % 2 === 0, (x) => x % 3 === 0, (x, y) => (x + y) % 3 === 0,
      (x, y) => (Math.floor(x / 3) + Math.floor(y / 2)) % 2 === 0, (x, y) => (x * y) % 2 + (x * y) % 3 === 0,
      (x, y) => ((x * y) % 2 + (x * y) % 3) % 2 === 0, (x, y) => ((x + y) % 2 + (x * y) % 3) % 2 === 0];
    const applyMask = (m) => { for (let y = 0; y < size; y++) for (let x = 0; x < size; x++) if (!F[y][x] && MASKS[m](x, y)) M[y][x] = !M[y][x]; };
    const penalty = () => {
      let p = 0, dark = 0;
      for (let y = 0; y < size; y++) for (let line = 0; line < 2; line++) {
        let run = 1;
        for (let x = 1; x < size; x++) {
          const a = line ? M[x][y] : M[y][x], b = line ? M[x - 1][y] : M[y][x - 1];
          if (a === b) { run++; if (run === 5) p += 3; else if (run > 5) p++; } else run = 1;
        }
      }
      for (let y = 0; y < size - 1; y++) for (let x = 0; x < size - 1; x++) { const c = M[y][x]; if (c === M[y][x + 1] && c === M[y + 1][x] && c === M[y + 1][x + 1]) p += 3; }
      for (let y = 0; y < size; y++) for (let x = 0; x < size; x++) if (M[y][x]) dark++;
      return p + Math.floor(Math.abs(dark * 20 - size * size * 10) / (size * size)) * 10;
    };
    let best = forceMask;
    if (best == null) {
      let bp = Infinity;
      for (let m = 0; m < 8; m++) { applyMask(m); drawFormat(m); const pv = penalty(); if (pv < bp) { bp = pv; best = m; } applyMask(m); }
    }
    applyMask(best); drawFormat(best);
    return { size, modules: M, version: ver, mask: best };
  }

  function toCanvas(text, canvas, px) {
    const q = encode(text), border = 4, n = q.size + border * 2;
    px = px || Math.max(2, Math.floor(Math.min(innerWidth - 40, 420) / n));
    canvas.width = canvas.height = n * px;
    const c = canvas.getContext('2d'); c.fillStyle = '#fff'; c.fillRect(0, 0, n * px, n * px); c.fillStyle = '#000';
    for (let y = 0; y < q.size; y++) for (let x = 0; x < q.size; x++) if (q.modules[y][x]) c.fillRect((x + border) * px, (y + border) * px, px, px);
    return q;
  }

  return { encode, toCanvas };
})();
