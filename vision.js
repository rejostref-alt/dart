// Kamera, kalibracja (homografia) i wykrywanie rzutek metodą różnicy obrazów.
'use strict';
const Vision = (() => {
  // ---------- homografia (4 punkty, DLT) ----------
  function solve(A, b) { // eliminacja Gaussa
    const n = b.length;
    for (let i = 0; i < n; i++) {
      let p = i; for (let r = i + 1; r < n; r++) if (Math.abs(A[r][i]) > Math.abs(A[p][i])) p = r;
      [A[i], A[p]] = [A[p], A[i]]; [b[i], b[p]] = [b[p], b[i]];
      for (let r = i + 1; r < n; r++) { const f = A[r][i] / A[i][i]; for (let c = i; c < n; c++) A[r][c] -= f * A[i][c]; b[r] -= f * b[i]; }
    }
    const x = new Array(n);
    for (let i = n - 1; i >= 0; i--) { let s = b[i]; for (let c = i + 1; c < n; c++) s -= A[i][c] * x[c]; x[i] = s / A[i][i]; }
    return x;
  }
  function homography(src, dst) { // src[i] -> dst[i]
    const A = [], b = [];
    for (let i = 0; i < 4; i++) {
      const [x, y] = src[i], [u, v] = dst[i];
      A.push([x, y, 1, 0, 0, 0, -u * x, -u * y]); b.push(u);
      A.push([0, 0, 0, x, y, 1, -v * x, -v * y]); b.push(v);
    }
    const h = solve(A, b); return [h[0], h[1], h[2], h[3], h[4], h[5], h[6], h[7], 1];
  }
  function apply(H, x, y) { const w = H[6] * x + H[7] * y + H[8]; return [(H[0] * x + H[1] * y + H[2]) / w, (H[3] * x + H[4] * y + H[5]) / w]; }

  // ---------- kamera ----------
  let video = null, stream = null;
  async function startCamera(el) {
    video = el;
    if (stream) stream.getTracks().forEach(t => t.stop());
    stream = await navigator.mediaDevices.getUserMedia({ audio: false, video: { facingMode: { ideal: 'environment' }, width: { ideal: 1920 }, height: { ideal: 1080 } } });
    video.srcObject = stream; await video.play();
    return { w: video.videoWidth, h: video.videoHeight };
  }
  // ---------- blokada ostrości / ekspozycji / balansu bieli ----------
  const sleep = (ms) => new Promise(r => setTimeout(r, ms));
  function track() { return stream ? stream.getVideoTracks()[0] : null; }
  async function tryApply(t, c) { try { await t.applyConstraints({ advanced: [c] }); return true; } catch { return false; } }
  async function unlockCamera() { // na czas kalibracji: autofokus ciągły
    const t = track(); if (!t || !t.getCapabilities) return;
    const caps = t.getCapabilities();
    if ((caps.focusMode || []).includes('continuous')) await tryApply(t, { focusMode: 'continuous' });
    if ((caps.exposureMode || []).includes('continuous')) await tryApply(t, { exposureMode: 'continuous' });
    if ((caps.whiteBalanceMode || []).includes('continuous')) await tryApply(t, { whiteBalanceMode: 'continuous' });
  }
  // center: środek tarczy w pikselach wideo – tam ustawiamy ostrość przed zablokowaniem
  async function lockCamera(center) {
    const res = { focus: 'brak', exposure: false, wb: false };
    const t = track(); if (!t || !t.getCapabilities) return res;
    const caps = t.getCapabilities();
    const fm = caps.focusMode || [];
    if (center && caps.pointsOfInterest && video.videoWidth) {
      await tryApply(t, { pointsOfInterest: [{ x: center[0] / video.videoWidth, y: center[1] / video.videoHeight }] });
    }
    if (fm.includes('single-shot')) { await tryApply(t, { focusMode: 'single-shot' }); await sleep(1500); }
    else await sleep(800);
    const st = t.getSettings ? t.getSettings() : {};
    if (fm.includes('manual') && caps.focusDistance && st.focusDistance != null) {
      if (await tryApply(t, { focusMode: 'manual', focusDistance: st.focusDistance })) res.focus = 'zablokowana';
    }
    if (res.focus === 'brak' && fm.includes('single-shot')) res.focus = 'ustawiona raz'; // single-shot trzyma ostrość do kolejnego wywołania
    const em = caps.exposureMode || [];
    if (em.includes('manual') && st.exposureTime != null) res.exposure = await tryApply(t, { exposureMode: 'manual', exposureTime: st.exposureTime });
    const wm = caps.whiteBalanceMode || [];
    if (wm.includes('manual') && st.colorTemperature != null) res.wb = await tryApply(t, { whiteBalanceMode: 'manual', colorTemperature: st.colorTemperature });
    return res;
  }

  function useVideoFile(el, file) { // tryb testowy: nagranie zamiast kamery
    video = el; if (stream) { stream.getTracks().forEach(t => t.stop()); stream = null; }
    video.srcObject = null; video.src = URL.createObjectURL(file); video.loop = true; video.muted = true;
    return video.play().then(() => ({ w: video.videoWidth, h: video.videoHeight }));
  }

  // ---------- detektor ----------
  const cfg = { procW: 720, diffThr: 28, minArea: 0.0006, maxArea: 0.06, stableFrames: 3, stillThr: 0.0008 };
  let canvas, ctx, W = 0, H = 0, mask = null, ref = null, prev = null, empty = null;
  let state = 'idle', stableCount = 0, Himg2board = null, onEvent = () => {}, timer = null, maskCount = 1, lastDart = null;

  function setCalibration(imgPts, vw, vh) { // imgPts: 4 punkty w pikselach wideo, kolejność jak Board.CAL
    const dst = Board.CAL.map(p => [p.x, p.y]);
    Himg2board = homography(imgPts, dst);
    const Hb2i = homography(dst, imgPts);
    W = cfg.procW; H = Math.round(vh / vw * W);
    canvas = canvas || document.createElement('canvas'); canvas.width = W; canvas.height = H;
    ctx = canvas.getContext('2d', { willReadFrequently: true });
    const sx = vw / W; mask = new Uint8Array(W * H); maskCount = 0;
    for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
      const [bx, by] = apply(Himg2board, x * sx, y * sx);
      if (Math.hypot(bx, by) < 240) { mask[y * W + x] = 1; maskCount++; }
    }
    ref = prev = empty = null; state = 'idle';
    return { Hb2i, Hi2b: Himg2board };
  }

  function grab() { // RGB (bez kanału alfa) – kolor odróżnia żółtą lotkę od kremowego pola lepiej niż jasność
    ctx.drawImage(video, 0, 0, W, H);
    const d = ctx.getImageData(0, 0, W, H).data, g = new Uint8Array(W * H * 3);
    for (let i = 0, j = 0; j < d.length; i += 3, j += 4) { g[i] = d[j]; g[i + 1] = d[j + 1]; g[i + 2] = d[j + 2]; }
    return g;
  }
  function diff(a, b, out) {
    let n = 0; const t = cfg.diffThr;
    for (let p = 0, i = 0; p < mask.length; p++, i += 3) {
      let v = 0;
      if (mask[p]) {
        const dr = Math.abs(a[i] - b[i]), dg = Math.abs(a[i + 1] - b[i + 1]), db = Math.abs(a[i + 2] - b[i + 2]);
        v = (dr > dg ? (dr > db ? dr : db) : (dg > db ? dg : db)) > t ? 1 : 0;
      }
      if (out) out[p] = v; n += v;
    }
    return n / maskCount;
  }

  function largestBlob(bin) { // największa spójna plama (4-sąsiedztwo)
    const lab = new Int32Array(W * H), stack = []; let best = null, id = 0;
    for (let s = 0; s < bin.length; s++) {
      if (!bin[s] || lab[s]) continue;
      id++; const px = []; stack.push(s); lab[s] = id;
      while (stack.length) {
        const p = stack.pop(); px.push(p); const x = p % W, y = (p / W) | 0;
        if (x > 0 && bin[p - 1] && !lab[p - 1]) { lab[p - 1] = id; stack.push(p - 1); }
        if (x < W - 1 && bin[p + 1] && !lab[p + 1]) { lab[p + 1] = id; stack.push(p + 1); }
        if (y > 0 && bin[p - W] && !lab[p - W]) { lab[p - W] = id; stack.push(p - W); }
        if (y < H - 1 && bin[p + W] && !lab[p + W]) { lab[p + W] = id; stack.push(p + W); }
      }
      if (!best || px.length > best.length) best = px;
    }
    return best;
  }

  // grot = cieńszy koniec plamy wzdłuż jej głównej osi (lotka jest szeroka)
  function tipOf(px) {
    let mx = 0, my = 0; for (const p of px) { mx += p % W; my += (p / W) | 0; } mx /= px.length; my /= px.length;
    let sxx = 0, syy = 0, sxy = 0;
    for (const p of px) { const dx = p % W - mx, dy = ((p / W) | 0) - my; sxx += dx * dx; syy += dy * dy; sxy += dx * dy; }
    const ang = 0.5 * Math.atan2(2 * sxy, sxx - syy), ux = Math.cos(ang), uy = Math.sin(ang);
    let tmin = Infinity, tmax = -Infinity; const proj = new Float32Array(px.length);
    px.forEach((p, i) => { const t = (p % W - mx) * ux + (((p / W) | 0) - my) * uy; proj[i] = t; if (t < tmin) tmin = t; if (t > tmax) tmax = t; });
    const len = tmax - tmin, band = Math.max(2, len * 0.18); let nMin = 0, nMax = 0;
    for (const t of proj) { if (t < tmin + band) nMin++; if (t > tmax - band) nMax++; }
    const tEnd = nMin <= nMax ? tmin : tmax; // koniec z mniejszą liczbą pikseli = grot
    // punkt grotu: średnia skrajnych pikseli po stronie grotu
    let ex = 0, ey = 0, c = 0;
    px.forEach((p, i) => { if (Math.abs(proj[i] - tEnd) < 2) { ex += p % W; ey += (p / W) | 0; c++; } });
    return { x: ex / c, y: ey / c, len };
  }

  function step() {
    if (!video || video.readyState < 2 || !mask) return;
    const cur = grab();
    if (!ref) { ref = cur; prev = cur; empty = empty || cur; onEvent({ type: 'ready' }); return; }
    const still = diff(cur, prev) < cfg.stillThr; prev = cur;
    const bin = new Uint8Array(W * H), dRef = diff(cur, ref, bin);
    if (dRef < cfg.minArea) { if (state !== 'idle') onEvent({ type: 'clear' }); state = 'idle'; stableCount = 0; return; }
    if (!still) { stableCount = 0; if (state !== 'moving') { state = 'moving'; onEvent({ type: 'moving', amount: dRef }); } return; }
    if (++stableCount < cfg.stableFrames) return;
    stableCount = 0;
    if (dRef <= cfg.maxArea) {
      const blob = largestBlob(bin);
      if (blob && blob.length / maskCount >= cfg.minArea * 0.6) {
        const tip = tipOf(blob), s = video.videoWidth / W;
        const [bx, by] = apply(Himg2board, tip.x * s, tip.y * s);
        lastDart = { img: [tip.x * s, tip.y * s], board: [bx, by], score: Board.score(bx, by) };
        ref = cur; state = 'idle';
        onEvent({ type: 'dart', dart: lastDart });
        return;
      }
      return; // tylko drobne zakłócenia – czekamy dalej, bez blokowania
    }
    // duża zmiana i spokój: wyjmowanie lotek albo ktoś stoi przed tarczą
    if (state === 'blocked') return;
    const dEmpty = empty ? diff(cur, empty) : 1;
    state = 'blocked';
    onEvent({ type: 'big', amount: dRef, nearEmpty: dEmpty < cfg.minArea * 2, accept: () => { ref = cur; state = 'idle'; } });
  }

  function start(cb) { onEvent = cb; stop(); timer = setInterval(step, 100); }
  function stop() { if (timer) clearInterval(timer); timer = null; }
  function resetReference(asEmpty) { if (!ctx) return; ref = grab(); prev = ref; if (asEmpty) empty = ref; state = 'idle'; }

  return { homography, apply, startCamera, useVideoFile, lockCamera, unlockCamera, setCalibration, start, stop, resetReference, cfg, get video() { return video; } };
})();
