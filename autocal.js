// Automatyczna kalibracja: aplikacja sama znajduje tarczę w obrazie z kamery (kolory pól), bez dotykania punktów.
// 1) klasyfikacja kolorów (czerwony / zielony / ciemny / jasny), 2) największy kolorowy pierścień = pole podwójne → elipsa,
// 3) obrót tarczy z naprzemiennych kolorów podwójnego pola (20 na górze), 4) dopracowanie homografii z ~100 krawędzi pól.
'use strict';
const AutoCal = (() => {
  const PW = 640;                     // szerokość obrazu roboczego
  const RED = 1, GREEN = 2, DARK = 3, LIGHT = 4;
  let W = 0, H = 0, cls = null, cv = null, cx = null;

  // ---------- kolory ----------
  function classify(r, g, b) {
    const mx = r > g ? (r > b ? r : b) : (g > b ? g : b), mn = r < g ? (r < b ? r : b) : (g < b ? g : b), d = mx - mn;
    const s = mx ? d / mx : 0;
    if (s > 0.33 && mx > 45 && d > 30) {
      let h = mx === r ? ((g - b) / d + 6) % 6 : mx === g ? (b - r) / d + 2 : (r - g) / d + 4; h *= 60;
      if (h < 22 || h > 320) return RED;
      if (h > 70 && h < 185) return GREEN;
      if (h <= 70 && s < 0.55 && mx > 110) return LIGHT;   // kremowe pole w ciepłym świetle
      return 0;
    }
    if (mx < 75) return DARK;
    if (s < 0.32 && mx > 110) return LIGHT;
    return 0;
  }
  function load(src, sw, sh) {
    W = PW; H = Math.round(sh / sw * PW);
    cv = cv || document.createElement('canvas'); cv.width = W; cv.height = H;
    cx = cx || cv.getContext('2d', { willReadFrequently: true });
    cx.drawImage(src, 0, 0, W, H);
    const d = cx.getImageData(0, 0, W, H).data; cls = new Uint8Array(W * H);
    // wyrównanie światła: balans szarości (ciepłe/zimne światło) + jasność (ciemna piwnica)
    let sr = 0, sg = 0, sb = 0; const hist = new Uint32Array(256);
    for (let i = 0; i < d.length; i += 4) { sr += d[i]; sg += d[i + 1]; sb += d[i + 2]; }
    const m = (sr + sg + sb) / 3 || 1, kr = Math.min(1.6, Math.max(0.6, m / (sr || 1))), kg = Math.min(1.6, Math.max(0.6, m / (sg || 1))), kb = Math.min(1.6, Math.max(0.6, m / (sb || 1)));
    for (let i = 0; i < d.length; i += 4) { const mx = Math.max(d[i] * kr, d[i + 1] * kg, d[i + 2] * kb) | 0; hist[mx > 255 ? 255 : mx]++; }
    let acc = 0, p95 = 255; for (let v = 255; v >= 0; v--) { acc += hist[v]; if (acc > cls.length * 0.05) { p95 = v; break; } }
    const gain = Math.min(3, Math.max(1, 225 / (p95 || 1)));
    for (let p = 0, i = 0; p < cls.length; p++, i += 4) cls[p] = classify(Math.min(255, d[i] * kr * gain), Math.min(255, d[i + 1] * kg * gain), Math.min(255, d[i + 2] * kb * gain));
  }
  const at = (x, y) => { x = Math.round(x); y = Math.round(y); return x < 0 || y < 0 || x >= W || y >= H ? -1 : cls[y * W + x]; };
  const colored = (c) => c === RED || c === GREEN;

  // ---------- algebra ----------
  function solve(A, b) {
    const n = b.length;
    for (let i = 0; i < n; i++) {
      let p = i; for (let r = i + 1; r < n; r++) if (Math.abs(A[r][i]) > Math.abs(A[p][i])) p = r;
      [A[i], A[p]] = [A[p], A[i]]; [b[i], b[p]] = [b[p], b[i]];
      if (Math.abs(A[i][i]) < 1e-12) return null;
      for (let r = i + 1; r < n; r++) { const f = A[r][i] / A[i][i]; for (let c = i; c < n; c++) A[r][c] -= f * A[i][c]; b[r] -= f * b[i]; }
    }
    const x = new Array(n);
    for (let i = n - 1; i >= 0; i--) { let s = b[i]; for (let c = i + 1; c < n; c++) s -= A[i][c] * x[c]; x[i] = s / A[i][i]; }
    return x;
  }
  function lsq(rows, rhs) { // najmniejsze kwadraty: (AᵀA)x = Aᵀb
    const n = rows[0].length, A = Array.from({ length: n }, () => new Array(n).fill(0)), b = new Array(n).fill(0);
    rows.forEach((r, k) => { for (let i = 0; i < n; i++) { b[i] += r[i] * rhs[k]; for (let j = 0; j < n; j++) A[i][j] += r[i] * r[j]; } });
    return solve(A, b);
  }
  const apply = (Hm, x, y) => { const w = Hm[6] * x + Hm[7] * y + Hm[8]; return [(Hm[0] * x + Hm[1] * y + Hm[2]) / w, (Hm[3] * x + Hm[4] * y + Hm[5]) / w]; };
  function fitH(pairs) { // pary [bx,by,ix,iy] → homografia tarcza(mm)→obraz, z normalizacją
    let mx = 0, my = 0; pairs.forEach(p => { mx += p[2]; my += p[3]; }); mx /= pairs.length; my /= pairs.length;
    let sd = 0; pairs.forEach(p => { sd += Math.hypot(p[2] - mx, p[3] - my); }); const s = sd / pairs.length || 1;
    const rows = [], rhs = [];
    for (const [X, Y, ix, iy] of pairs) {
      const x = X / 170, y = Y / 170, u = (ix - mx) / s, v = (iy - my) / s;
      rows.push([x, y, 1, 0, 0, 0, -u * x, -u * y]); rhs.push(u);
      rows.push([0, 0, 0, x, y, 1, -v * x, -v * y]); rhs.push(v);
    }
    const h = lsq(rows, rhs); if (!h) return null;
    // odwrócenie normalizacji: obraz = T⁻¹ · Hn · S
    const Hn = [h[0], h[1], h[2], h[3], h[4], h[5], h[6], h[7], 1];
    const S = 1 / 170, out = new Array(9);
    const Ti = [s, 0, mx, 0, s, my, 0, 0, 1], M = [Hn[0] * S, Hn[1] * S, Hn[2], Hn[3] * S, Hn[4] * S, Hn[5], Hn[6] * S, Hn[7] * S, Hn[8]];
    for (let r = 0; r < 3; r++) for (let c = 0; c < 3; c++) out[r * 3 + c] = Ti[r * 3] * M[c] + Ti[r * 3 + 1] * M[3 + c] + Ti[r * 3 + 2] * M[6 + c];
    return out.map(v => v / out[8]);
  }

  // ---------- 2) pierścienie: spójne kolorowe plamy (z domknięciem szczelin po drucikach) ----------
  function components() {
    const m = new Uint8Array(W * H);
    for (let y = 1; y < H - 1; y++) for (let x = 1; x < W - 1; x++) {
      const p = y * W + x;
      if (colored(cls[p]) || colored(cls[p - 1]) || colored(cls[p + 1]) || colored(cls[p - W]) || colored(cls[p + W])) m[p] = 1;
    }
    const lab = new Int32Array(W * H), comps = [], st = [];
    for (let s = 0; s < m.length; s++) {
      if (!m[s] || lab[s]) continue;
      const id = comps.length + 1, px = []; lab[s] = id; st.push(s);
      while (st.length) {
        const p = st.pop(); px.push(p); const x = p % W;
        const nb = [p - W, p + W, x > 0 ? p - 1 : -1, x < W - 1 ? p + 1 : -1];
        for (const q of nb) if (q >= 0 && q < m.length && m[q] && !lab[q]) { lab[q] = id; st.push(q); }
      }
      if (px.length > 150) comps.push(px);
    }
    return comps.sort((a, b) => b.length - a.length).slice(0, 6);
  }
  function fitEllipse(px) {
    let mx = 0, my = 0; for (const p of px) { mx += p % W; my += (p / W) | 0; } mx /= px.length; my /= px.length;
    let sc = 0; for (const p of px) sc += Math.hypot(p % W - mx, ((p / W) | 0) - my); sc = sc / px.length || 1;
    const step = Math.max(1, Math.floor(px.length / 4000)), rows = [], rhs = [];
    for (let i = 0; i < px.length; i += step) { const x = (px[i] % W - mx) / sc, y = (((px[i] / W) | 0) - my) / sc; rows.push([x * x, x * y, y * y, x, y]); rhs.push(1); }
    const c = lsq(rows, rhs); if (!c) return null;
    const [A, B, C, D, E] = c, F = -1;
    if (B * B - 4 * A * C >= 0) return null;                       // nie elipsa
    const det = 4 * A * C - B * B, x0 = (B * E - 2 * C * D) / det, y0 = (B * D - 2 * A * E) / det;
    const F0 = A * x0 * x0 + B * x0 * y0 + C * y0 * y0 + D * x0 + E * y0 + F;
    const tr = A + C, dd = Math.sqrt((A - C) * (A - C) + B * B), l1 = (tr + dd) / 2, l2 = (tr - dd) / 2;
    if (-F0 / l1 <= 0 || -F0 / l2 <= 0) return null;
    const a1 = Math.sqrt(-F0 / l1) * sc, a2 = Math.sqrt(-F0 / l2) * sc;   // półosie dla wartości własnych l1, l2
    const th = 0.5 * Math.atan2(B, A - C);                             // kierunek osi dla l1
    return { cx: x0 * sc + mx, cy: y0 * sc + my, a1, a2, th };
  }
  // jak dobrze plama leży na elipsie (pierścień = mały rozrzut znormalizowanego promienia)
  function ringScore(px, e) {
    const c = Math.cos(e.th), s = Math.sin(e.th); let n = 0, bad = 0;
    const step = Math.max(1, Math.floor(px.length / 3000));
    for (let i = 0; i < px.length; i += step) {
      const dx = px[i] % W - e.cx, dy = ((px[i] / W) | 0) - e.cy, u = (dx * c + dy * s) / e.a1, v = (-dx * s + dy * c) / e.a2;
      const r = Math.hypot(u, v); n++; if (r < 0.88 || r > 1.12) bad++;
    }
    return 1 - bad / n;
  }

  // ---------- 3) obrót: naprzemienne kolory pola podwójnego ----------
  function affineH(e, psi) { // tarcza(mm) → obraz: środek + elipsa (r≈166 mm) + obrót psi; oś y tarczy w górę
    const c = Math.cos(e.th), s = Math.sin(e.th), k1 = e.a1 / 166, k2 = e.a2 / 166, cp = Math.cos(psi), sp = Math.sin(psi);
    // V·diag(k1,k2)·Rot(psi)·diag(1,-1)
    const R = [cp, sp, sp, -cp];                                       // Rot(psi)·diag(1,-1)
    const M = [c * k1, -s * k2, s * k1, c * k2];                       // V·diag
    const A = [M[0] * R[0] + M[1] * R[2], M[0] * R[1] + M[1] * R[3], M[2] * R[0] + M[3] * R[2], M[2] * R[1] + M[3] * R[3]];
    return [A[0], A[1], e.cx, A[2], A[3], e.cy, 0, 0, 1];
  }
  const segDark = (deg) => { const sc = Board.score(Math.cos(deg * Math.PI / 180) * 100, Math.sin(deg * Math.PI / 180) * 100); return Board.ORDER.indexOf(sc.num) % 2 === 0; };
  function findRotation(e) {
    const scores = [];
    for (let k = 0; k < 360; k++) {
      const Hm = affineH(e, k * Math.PI / 180); let ok = 0, n = 0;
      for (let a = 0; a < 360; a += 3) {
        const dark = segDark(a), rad = a * Math.PI / 180;
        for (const r of [166, 103]) {
          const [x, y] = apply(Hm, Math.cos(rad) * r, Math.sin(rad) * r), c = at(x, y);
          if (c < 0) continue; n++;
          if (c === (dark ? RED : GREEN)) ok++; else if (colored(c)) ok -= 0.5;
        }
      }
      scores.push(n ? ok / n : -1);
    }
    // co 36° wzór się powtarza – z 10 kandydatów wybieramy ten, w którym pole 20 jest najbliżej góry obrazu
    let best = 0; for (let k = 1; k < 360; k++) if (scores[k] > scores[best]) best = k;
    let pick = -1, pickUp = -Infinity;
    for (let j = 0; j < 10; j++) {
      let k = (best + j * 36) % 360, top = k;
      for (let d = -3; d <= 3; d++) { const q = (k + d + 360) % 360; if (scores[q] > scores[top]) top = q; }
      if (scores[top] < scores[best] - 0.15) continue;
      const Hm = affineH(e, top * Math.PI / 180), [x20, y20] = apply(Hm, 0, 120), up = (e.cy - y20) / Math.hypot(x20 - e.cx, y20 - e.cy);
      if (up > pickUp) { pickUp = up; pick = top; }
    }
    return { psi: pick * Math.PI / 180, match: scores[pick] };
  }

  // ---------- 4) dopracowanie: krawędzie pól pierścieni i druciki między polami ----------
  function collect(Hm) {
    const pairs = [], step = 0.5;
    for (let i = 0; i < 20; i++) {
      const phi = (90 - i * 18) * Math.PI / 180, ux = Math.cos(phi), uy = Math.sin(phi);
      // promieniowo: wejście/wyjście z pola potrójnego i podwójnego
      for (const [r, inward] of [[99, true], [107, false], [162, true], [170, false]]) {
        let prev = null, found = null, bestD = 99;
        for (let t = r - 10; t <= r + 10; t += step) {
          const [x, y] = apply(Hm, ux * t, uy * t), c = at(x, y); if (c < 0) { prev = null; continue; }
          const col = colored(c);
          if (prev !== null && col !== prev && col === inward && Math.abs(t - r) < bestD) { bestD = Math.abs(t - r); found = t - step / 2; }
          prev = col;
        }
        if (found !== null) { const [x, y] = apply(Hm, ux * found, uy * found); pairs.push([ux * r, uy * r, x * sx, y * sx]); }
      }
      // po łuku: granica między polami (zmiana koloru) w polu podwójnym, potrójnym i obu pojedynczych
      const b = (90 - 9 - i * 18);
      for (const r of [166, 103, 135, 60]) {
        let prev = null, found = null, bestD = 99;
        for (let d = -6; d <= 6; d += 0.25) {
          const a = (b + d) * Math.PI / 180, [x, y] = apply(Hm, Math.cos(a) * r, Math.sin(a) * r), c = at(x, y);
          if (c <= 0) { prev = null; continue; }
          if (prev !== null && c !== prev && Math.abs(d) < bestD) { bestD = Math.abs(d); found = b + d - 0.125; }
          prev = c;
        }
        if (found !== null) { const a = found * Math.PI / 180, [x, y] = apply(Hm, Math.cos(a) * r, Math.sin(a) * r), a0 = b * Math.PI / 180; pairs.push([Math.cos(a0) * r, Math.sin(a0) * r, x * sx, y * sx]); }
      }
    }
    return pairs;
  }
  let sx = 1; // skala obraz roboczy → piksele źródła
  function refine(Hwork) {
    let Hs = Hwork.slice(); // w pikselach źródła
    const toSrc = (Hm) => [Hm[0] * sx, Hm[1] * sx, Hm[2] * sx, Hm[3] * sx, Hm[4] * sx, Hm[5] * sx, Hm[6], Hm[7], Hm[8]];
    const toWork = (Hm) => [Hm[0] / sx, Hm[1] / sx, Hm[2] / sx, Hm[3] / sx, Hm[4] / sx, Hm[5] / sx, Hm[6], Hm[7], Hm[8]];
    Hs = toSrc(Hs); let used = 0;
    for (let it = 0; it < 4; it++) {
      let pairs = collect(toWork(Hs));
      if (pairs.length < 16) break;
      let Hn = fitH(pairs); if (!Hn) break;
      // odrzuć punkty odstające i dopasuj jeszcze raz
      const err = pairs.map(p => { const [x, y] = apply(Hn, p[0], p[1]); return Math.hypot(x - p[2], y - p[3]); });
      const med = err.slice().sort((a, b) => a - b)[err.length >> 1] || 1;
      pairs = pairs.filter((p, k) => err[k] <= Math.max(3 * med, 1.5 * sx));
      if (pairs.length >= 16) Hn = fitH(pairs) || Hn;
      Hs = Hn; used = pairs.length;
    }
    return { H: Hs, used };
  }

  // ---------- ocena: ile próbek ma kolor zgodny z modelem tarczy ----------
  function quality(Hs) {
    const Hw = [Hs[0] / sx, Hs[1] / sx, Hs[2] / sx, Hs[3] / sx, Hs[4] / sx, Hs[5] / sx, Hs[6], Hs[7], Hs[8]];
    let ok = 0, n = 0;
    for (let a = 4.5; a < 360; a += 9) for (const r of [11, 40, 75, 103, 130, 150, 166]) {
      const rad = a * Math.PI / 180, bx = Math.cos(rad) * r, by = Math.sin(rad) * r, [x, y] = apply(Hw, bx, by), c = at(x, y);
      if (c < 0) continue;
      const s = Board.score(bx, by), dark = Board.ORDER.indexOf(s.num) % 2 === 0;
      let exp;
      if (s.num === 25) exp = s.mult === 2 ? RED : GREEN;
      else if (s.mult >= 2) exp = dark ? RED : GREEN; else exp = dark ? DARK : LIGHT;
      n++; if (c === exp) ok++;
    }
    return n ? ok / n : 0;
  }

  // ---------- główna funkcja ----------
  // src: <video>/<canvas>, sw/sh: jego rozmiar w pikselach. Zwraca { H (tarcza mm → piksele źródła), pts (4 punkty jak Board.CAL), quality } albo null
  const dbg = [];
  function detect(src, sw, sh) {
    load(src, sw, sh); sx = sw / W; dbg.length = 0;
    let best = null;
    for (const comp of components()) {
      const e0 = fitEllipse(comp), info = { n: comp.length };
      dbg.push(info);
      if (!e0 || !isFinite(e0.a1) || !isFinite(e0.a2)) { info.why = 'fit'; continue; }
      info.e = e0;
      const minAx = Math.min(e0.a1, e0.a2), maxAx = Math.max(e0.a1, e0.a2);
      if (minAx < W * 0.03 || maxAx > W * 1.2 || minAx / maxAx < 0.3) { info.why = 'size'; continue; }
      info.ring = ringScore(comp, e0);
      if (info.ring < 0.6) { info.why = 'ring'; continue; }
      // pierścień może być polem podwójnym (r≈166 mm) albo potrójnym (r≈103 mm)
      for (const rr of [166, 103]) {
        const k = 166 / rr, e = { cx: e0.cx, cy: e0.cy, a1: e0.a1 * k, a2: e0.a2 * k, th: e0.th };
        const rot = findRotation(e); if (rot.match < 0.2) continue;
        const H0 = affineH(e, rot.psi), ref = refine(H0); if (ref.used < 16) continue;
        const q = quality(ref.H);
        (info.tries = info.tries || []).push({ rr, match: rot.match, q, used: ref.used });
        if (!best || q > best.quality) best = { H: ref.H, quality: q, used: ref.used };
      }
    }
    if (!best) return null;
    best.pts = Board.CAL.map(p => apply(best.H, p.x, p.y));
    return best;
  }
  return { detect, classify, dbg };
})();
