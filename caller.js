// Sędzia (caller): niski, męski głos, ogłasza sumy kolejek w stylu turniejowym + efekt hali (publiczność z syntezatora, offline).
'use strict';
const Caller = (() => {
  const S = window.speechSynthesis;
  let opts = { on: true, crowd: true, voiceName: '' };
  let voices = [];
  const load = () => { voices = S ? S.getVoices() : []; };
  if (S) { load(); S.onvoiceschanged = load; }

  // głosy dla języka; „auto” = męski, jeśli system go ma (nazwy różnią się między telefonami)
  const MALE = /\bmale\b|\bman\b|adam|marek|krzysztof|jacek|jan\b|daniel|george|ryan|guy|arthur|oliver|thomas|james|-x-.*(bmg|bmh|bmj|rjs|gbb|gbd|jmn|oda)|#male/i;
  const FEMALE = /female|woman|zosia|ewa|paulina|maja|agnieszka|kate|susan|serena|hazel|libby|sonia|emma|amy|-x-.*(afb|bfb|zfg)/i;
  function list(lang) { const p = lang.slice(0, 2); return voices.filter(v => v.lang.replace('_', '-').toLowerCase().startsWith(p)); }
  function pick(lang) {
    const vs = list(lang); if (!vs.length) return null;
    if (opts.voiceName) { const v = vs.find(v => v.name === opts.voiceName); if (v) return v; }
    return vs.find(v => MALE.test(v.name) && !/female/i.test(v.name)) || vs.find(v => !FEMALE.test(v.name) && v.lang.toLowerCase().replace('_', '-') === lang.toLowerCase()) || vs.find(v => !FEMALE.test(v.name)) || vs[0];
  }
  // naturalny ton (pitch 1) – sztuczne obniżanie brzmiało jak dziecko; parts = [[tekst, tempo], ...] mówione po kolei
  function speak(parts, { cut = false } = {}) {
    if (!opts.on || !S) return;
    if (cut) S.cancel();
    const lang = I18N.speechLang(), v = pick(lang);
    for (const p of [].concat(typeof parts === 'string' ? [[parts]] : parts)) {
      const u = new SpeechSynthesisUtterance(p[0]); u.lang = v ? v.lang : lang; if (v) u.voice = v;
      u.rate = p[1] || 1; u.pitch = 1; u.volume = 1; S.speak(u);
    }
  }

  // ---------- publiczność (WebAudio, bez plików – działa offline) ----------
  let ctx = null, noise = null;
  function ac() {
    if (!ctx) { try { ctx = new (window.AudioContext || window.webkitAudioContext)(); } catch { return null; } }
    if (ctx.state === 'suspended') ctx.resume();
    if (!noise) { // ~3 s różowego szumu
      const n = ctx.sampleRate * 3, b = ctx.createBuffer(1, n, ctx.sampleRate), d = b.getChannelData(0);
      let b0 = 0, b1 = 0, b2 = 0; for (let i = 0; i < n; i++) { const w = Math.random() * 2 - 1; b0 = .997 * b0 + w * .029; b1 = .985 * b1 + w * .032; b2 = .95 * b2 + w * .048; d[i] = (b0 + b1 + b2 + w * .02) * .9; }
      noise = b;
    }
    return ctx;
  }
  function roar(level, dur) { // szum tłumu: narasta i opada
    const c = ac(); if (!c) return; const t0 = c.currentTime;
    const src = c.createBufferSource(); src.buffer = noise; src.loop = true; src.playbackRate.value = 0.9 + Math.random() * 0.2;
    const bp = c.createBiquadFilter(); bp.type = 'bandpass'; bp.frequency.value = 650; bp.Q.value = 0.5;
    const lfo = c.createOscillator(), lg = c.createGain(); lfo.frequency.value = 3.5; lg.gain.value = 180; lfo.connect(lg); lg.connect(bp.frequency); // „wołanie” tłumu
    const g = c.createGain(); g.gain.setValueAtTime(0.0001, t0); g.gain.exponentialRampToValueAtTime(level, t0 + 0.35); g.gain.setValueAtTime(level, t0 + dur * 0.55); g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
    src.connect(bp); bp.connect(g); g.connect(c.destination); src.start(t0); lfo.start(t0); src.stop(t0 + dur + 0.1); lfo.stop(t0 + dur + 0.1);
  }
  function claps(level, dur, density) { // brawa: tysiące krótkich klaśnięć
    const c = ac(); if (!c) return; const t0 = c.currentTime;
    const hp = c.createBiquadFilter(); hp.type = 'highpass'; hp.frequency.value = 1100;
    const g = c.createGain(); g.gain.setValueAtTime(level, t0); g.gain.setValueAtTime(level, t0 + dur * 0.6); g.gain.linearRampToValueAtTime(0.0001, t0 + dur);
    hp.connect(g); g.connect(c.destination);
    const count = Math.round(dur * density);
    for (let i = 0; i < count; i++) {
      const at = t0 + Math.random() * dur * (0.6 + 0.4 * Math.random()), s = c.createBufferSource(), e = c.createGain();
      s.buffer = noise; e.gain.setValueAtTime(0.0001, at); e.gain.exponentialRampToValueAtTime(0.4 + Math.random() * 0.6, at + 0.004); e.gain.exponentialRampToValueAtTime(0.0001, at + 0.03 + Math.random() * 0.04);
      s.connect(e); e.connect(hp); s.start(at, Math.random() * 2.5, 0.09);
    }
  }
  function crowd(kind) {
    if (!opts.crowd) return;
    if (kind === 'big') { roar(0.5, 4.5); claps(0.5, 4, 260); }        // 180, wygrany mecz
    else if (kind === 'leg') { roar(0.32, 3.2); claps(0.45, 3, 200); }
    else if (kind === 'ton') { roar(0.16, 2); claps(0.32, 2, 140); }   // 100+
    else if (kind === 'nice') claps(0.2, 1.4, 90);                     // 60–99
    else if (kind === 'ooh') roar(0.12, 1.3);                          // bust
  }

  return {
    set(o) { Object.assign(opts, o); },
    voicesFor: (lang) => list(lang),
    unlock() { ac(); }, // po pierwszym dotknięciu (wymóg przeglądarek)
    say: (txt) => speak(txt),
    // każda rzutka: liczba punktów (T20 → „60”) albo nazwa pola (T20 → „potrójne 20”)
    dart(h, mode) {
      if (mode === 'off') return;
      if (h.mult === 0) return speak(t('cMiss'));
      if (mode === 'field') return speak(h.num === 25 ? (h.mult === 2 ? t('cBull') : t('c25')) : (h.mult === 3 ? t('cT') : h.mult === 2 ? t('cD') : '') + h.num);
      speak(String(h.value));
    },
    // suma kolejki po 3 lotkach (w kolejce po ostatniej rzutce): 180 przeciągnięte, 0 = „bez punktów”
    score(n) {
      if (n === 180) { speak([[t('c180a'), 0.9], [t('c180b'), 0.7]]); return crowd('big'); }
      if (n === 0) return speak([[t('cNoScore'), 0.95]]);
      speak([[t('cTotal', { n }), n >= 100 ? 0.85 : 0.95]]);
      crowd(n >= 100 ? 'ton' : n >= 60 ? 'nice' : '');
    },
    bust() { speak([[t('cBust'), 0.9]]); crowd('ooh'); },
    gameOn(name) { speak([[t('cGameOn'), 0.9], [name, 0.95]], { cut: true }); },
    require(name, rest) { speak([[t('cRequire', { n: name, x: rest }), 0.95]]); },
    player(name) { speak([[name, 0.95]]); },
    leg(name) { speak([[t('cLeg', { n: name }), 0.9]]); crowd('leg'); },
    match(name) { speak([[t('cMatch', { n: name }), 0.88]]); crowd('big'); },
    wins(name) { speak([[t('cWins', { n: name }), 0.9]]); crowd('big'); },
    test() { this.unlock(); speak([['60', 1], ['60', 1], ['20', 1], [t('cTotal', { n: 140 }), 0.85]], { cut: true }); crowd('ton'); }
  };
})();
