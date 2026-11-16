'use strict';
(() => {
  const $ = (s) => document.querySelector(s), $$ = (s) => [...document.querySelectorAll(s)];
  const store = { get(k, d) { try { const v = localStorage.getItem('dart.' + k); return v ? JSON.parse(v) : d; } catch { return d; } },
                  set(k, v) { try { localStorage.setItem('dart.' + k, JSON.stringify(v)); } catch {} } };
  const VERSION = '7'; // przy każdej aktualizacji podbić też CACHE w sw.js
  $$('.ver').forEach(e => e.textContent = 'wersja ' + VERSION);
  const GEAR = $('[data-settings] svg').outerHTML;
  $$('[data-settings]').forEach(b => { b.innerHTML = GEAR; b.onclick = openSettings; });
  let screen = 'scr-home';
  const show = (id) => { screen = id; $$('.screen').forEach(s => s.hidden = s.id !== id); window.scrollTo(0, 0); persist(); };
  // zapis stanu na bieżąco: odświeżenie strony (np. przypadkowe przeciągnięcie) wraca w to samo miejsce
  function persist() {
    store.set('cfg', cfg); store.set('players', players);
    store.set('session', { screen, step, useCam, calMode });
    if (match && !match.state.done && (screen === 'scr-play' || screen === 'scr-camera')) store.set('match', match.dump());
    else if (screen !== 'scr-camera') localStorage.removeItem('dart.match');
  }
  const esc = (t) => String(t).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));

  // ---------- ustawienia (tylko pod ikoną ⚙) ----------
  const settings = Object.assign({ voice: true, lock: true, sens: 50 }, store.get('settings', {}));
  const applySettings = () => { Vision.cfg.diffThr = 78 - settings.sens; store.set('settings', settings); };
  function openSettings() {
    $('#s-voice').checked = settings.voice; $('#s-lock').checked = settings.lock; $('#s-sens').value = settings.sens;
    $('#s-sens-v').textContent = sensLabel();
    $('#s-bg').hidden = screen !== 'scr-play' || !useCam;
    $('#dlg-settings').showModal();
  }
  $('#s-voice').onchange = (e) => { settings.voice = e.target.checked; applySettings(); };
  $('#s-lock').onchange = (e) => { settings.lock = e.target.checked; applySettings(); };
  function sensLabel() { return settings.sens >= 56 ? '· bardzo wysoka' : settings.sens >= 44 ? '· normalna' : settings.sens >= 32 ? '· niższa' : '· niska (jasne, migające światło)'; }
  $('#s-sens').oninput = (e) => { settings.sens = +e.target.value; $('#s-sens-v').textContent = sensLabel(); applySettings(); };
  $('#s-bg').onclick = () => { Vision.resetReference(true); $('#dlg-settings').close(); setStatus('Zapamiętano tło tarczy'); };
  $('#s-reset').onclick = () => { ['players', 'cfg', 'cal', 'recent', 'settings'].forEach(k => localStorage.removeItem('dart.' + k)); location.reload(); };
  $$('[data-close]').forEach(b => b.onclick = () => b.closest('dialog').close());
  applySettings();

  // ---------- konfiguracja gry ----------
  const cfg = Object.assign({ kind: 'x01', start: 501, legs: 1, sets: 1, doubleOut: true, doubleIn: false, multSkip: false, shRounds: 7, hiRounds: 10, cams: 'one' }, store.get('cfg', {}));
  let players = store.get('players', ['Gracz 1', 'Gracz 2']);
  let recent = store.get('recent', []);
  function gameOpts() {
    if (cfg.kind === 'x01') return { start: cfg.start, legs: cfg.legs, sets: cfg.sets, doubleOut: cfg.doubleOut, doubleIn: cfg.doubleIn };
    if (cfg.kind === 'atc') return { multSkip: cfg.multSkip };
    if (cfg.kind === 'shanghai') return { rounds: cfg.shRounds };
    if (cfg.kind === 'high') return { rounds: cfg.hiRounds };
    return {};
  }
  function gameLabel() {
    const n = { x01: String(cfg.start), cricket: 'Cricket', atc: 'Po kolei', shanghai: 'Shanghai', high: 'High Score' }[cfg.kind];
    return n + ' · ' + players.join(' vs ');
  }
  function saveCfg() {
    players = players.map(p => p.trim() || 'Gracz');
    recent = [...new Set([...players, ...recent])].slice(0, 12);
    store.set('cfg', cfg); store.set('players', players); store.set('recent', recent);
  }

  // ---------- START ----------
  function home() {
    Vision.stop(); match = null; show('scr-home');
    const has = store.get('cfg', null);
    $('#home-again').hidden = !has; if (has) $('#home-again').textContent = '↻ Zagraj ponownie: ' + gameLabel();
  }
  $('#home-new').onclick = () => wizard(0);
  $('#home-again').onclick = () => { if (cfg.cams === 'two' && !Pair.connected()) return wizard(2); launch(); };
  $('#home-remote').onclick = joinAsRemote;

  // ---------- KREATOR ----------
  let step = 0;
  function wizard(s) { step = s; show('scr-new'); renderWizard(); }
  function renderWizard() {
    $$('.step').forEach(el => el.hidden = +el.dataset.step !== step);
    $$('#w-steps span').forEach((el, i) => el.classList.toggle('on', i <= step));
    const last = step === 2;
    $('#w-next').textContent = !last ? 'Dalej' : cfg.cams === 'none' ? 'Start gry' : 'Dalej: kalibracja kamery';
    $('#w-next').disabled = last && cfg.cams === 'two' && !Pair.connected();
    if (step === 0) renderGame(); if (step === 1) renderPlayers(); if (step === 2) renderCams();
  }
  $('#w-back').onclick = () => { if (step > 0) { step--; renderWizard(); } else home(); };
  $('#w-next').onclick = () => {
    if (step === 1 && players.every(p => !p.trim())) return;
    if (step < 2) { step++; renderWizard(); return; }
    launch();
  };

  // krok 1: gra
  function renderGame() {
    $$('#game-cards button').forEach(b => b.classList.toggle('on', b.dataset.k === cfg.kind && (b.dataset.k !== 'x01' || +b.dataset.start === cfg.start || (cfg.start === 701 && b.dataset.start === '501'))));
    $$('.opts').forEach(o => o.hidden = o.id !== 'opts-' + cfg.kind);
    $$('#o-start button').forEach(b => b.classList.toggle('on', +b.dataset.v === cfg.start));
    $$('#o-sh-rounds button').forEach(b => b.classList.toggle('on', +b.dataset.v === cfg.shRounds));
    $$('#o-hi-rounds button').forEach(b => b.classList.toggle('on', +b.dataset.v === cfg.hiRounds));
    $$('.stepper').forEach(s => s.querySelector('output').textContent = cfg[s.dataset.id]);
    $('#o-dout').checked = cfg.doubleOut; $('#o-din').checked = cfg.doubleIn; $('#o-skip').checked = cfg.multSkip;
    persist();
  }
  $('#game-cards').onclick = (e) => { const b = e.target.closest('button'); if (!b) return; cfg.kind = b.dataset.k; if (b.dataset.start) cfg.start = +b.dataset.start; renderGame(); };
  $('#o-start').onclick = (e) => { const b = e.target.closest('button'); if (b) { cfg.start = +b.dataset.v; renderGame(); } };
  $('#o-sh-rounds').onclick = (e) => { const b = e.target.closest('button'); if (b) { cfg.shRounds = +b.dataset.v; renderGame(); } };
  $('#o-hi-rounds').onclick = (e) => { const b = e.target.closest('button'); if (b) { cfg.hiRounds = +b.dataset.v; renderGame(); } };
  $$('.stepper').forEach(s => s.onclick = (e) => {
    const b = e.target.closest('button'); if (!b) return;
    const k = s.dataset.id, d = b.textContent === '+' ? 1 : -1;
    cfg[k] = Math.min(+s.dataset.max, Math.max(+s.dataset.min, cfg[k] + d)); renderGame();
  });
  $('#o-dout').onchange = (e) => { cfg.doubleOut = e.target.checked; persist(); };
  $('#o-din').onchange = (e) => { cfg.doubleIn = e.target.checked; persist(); };
  $('#o-skip').onchange = (e) => { cfg.multSkip = e.target.checked; persist(); };

  // krok 2: gracze
  function renderPlayers() {
    $('#players').innerHTML = players.map((p, i) => `<div class="player-row"><span class="num">${i + 1}</span>
      <input type="text" value="${esc(p)}" data-i="${i}" aria-label="Gracz ${i + 1}" enterkeyhint="next">
      <button class="icon-btn" data-del="${i}" aria-label="Usuń gracza" ${players.length < 2 ? 'disabled' : ''}>✕</button></div>`).join('');
    const free = recent.filter(r => !players.includes(r));
    $('#recent').innerHTML = free.map(r => `<button class="chip" data-r="${esc(r)}">+ ${esc(r)}</button>`).join('');
    $('#add-player').hidden = players.length >= 8;
    persist();
  }
  $('#players').oninput = (e) => { if (e.target.dataset.i) { players[+e.target.dataset.i] = e.target.value; persist(); } };
  $('#players').onclick = (e) => { const d = e.target.closest('[data-del]'); if (d) { players.splice(+d.dataset.del, 1); renderPlayers(); } };
  $('#players').onfocusin = (e) => { if (e.target.tagName === 'INPUT' && /^Gracz \d+$/.test(e.target.value)) e.target.select(); };
  $('#add-player').onclick = () => { players.push('Gracz ' + (players.length + 1)); renderPlayers(); const ins = $$('#players input'); ins[ins.length - 1].focus(); };
  $('#recent').onclick = (e) => {
    const c = e.target.closest('[data-r]'); if (!c || players.length >= 8) return;
    const i = players.findIndex(p => /^Gracz \d+$/.test(p));
    if (i >= 0) players[i] = c.dataset.r; else players.push(c.dataset.r);
    renderPlayers();
  };

  // krok 3: kamery
  function renderCams() {
    $$('#cam-choice button').forEach(b => b.classList.toggle('on', b.dataset.c === cfg.cams));
    $('#two-panel').hidden = cfg.cams !== 'two';
    pairState(); persist();
  }
  $('#cam-choice').onclick = (e) => { const b = e.target.closest('button'); if (b) { cfg.cams = b.dataset.c; renderWizard(); } };

  function launch() { saveCfg(); match = null; keepMatch = false; if (cfg.cams === 'none') return startMatch(false); openCamera(); }

  // ---------- KALIBRACJA ----------
  const video = $('#video'), ov = $('#overlay'), octx = ov.getContext('2d');
  let calPts = [], vw = 0, vh = 0, Hb2i = null, cameraOn = false, dragIdx = -1, calMode = 'host';
  const CAL_TXT = ['środek pola 20 (góra)', 'środek pola 6 (prawo)', 'środek pola 3 (dół)', 'środek pola 11 (lewo)'];

  function fit(boxW, boxH) { const s = Math.min(boxW / vw, boxH / vh); return { s, ox: (boxW - vw * s) / 2, oy: (boxH - vh * s) / 2 }; }
  function toVideo(ev) { const r = ov.getBoundingClientRect(), f = fit(r.width, r.height); return [(ev.clientX - r.left - f.ox) / f.s, (ev.clientY - r.top - f.oy) / f.s]; }
  function calMsg() {
    if (calPts.length < 4) $('#cal-msg').innerHTML = `<b>${calPts.length + 1} / 4</b> · Dotknij zewnętrzną krawędź podwójnego pola – ${CAL_TXT[calPts.length]}`;
    else $('#cal-msg').innerHTML = 'Siatka pokrywa tarczę? Punkty możesz przeciągać palcem. Wyjmij lotki i naciśnij <b>Start</b>.';
    $('#cal-ok').disabled = calPts.length < 4;
    $('#cal-ok').textContent = calMode === 'remote' ? 'Start – wysyłaj rzutki' : 'Start gry';
  }
  function recomputeH() { if (calPts.length === 4) { const dst = Board.CAL.map(p => [p.x, p.y]); Hb2i = Vision.homography(dst, calPts); } else Hb2i = null; }
  function drawWire(ctx, H, f, alpha) {
    const wf = Board.wireframe(), P = (x, y) => { const [u, v] = Vision.apply(H, x, y); return [f.ox + u * f.s, f.oy + v * f.s]; };
    ctx.save(); ctx.strokeStyle = `rgba(47,191,113,${alpha})`; ctx.lineWidth = 1.5;
    for (const c of wf.circles) { ctx.beginPath(); c.forEach(([x, y], i) => { const [a, b] = P(x, y); i ? ctx.lineTo(a, b) : ctx.moveTo(a, b); }); ctx.stroke(); }
    for (const [p1, p2] of wf.spokes) { ctx.beginPath(); ctx.moveTo(...P(...p1)); ctx.lineTo(...P(...p2)); ctx.stroke(); }
    ctx.fillStyle = `rgba(255,255,255,${alpha})`; ctx.font = 'bold 13px system-ui'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    for (const l of wf.labels) ctx.fillText(l.n, ...P(l.x, l.y));
    ctx.restore();
  }
  function calLoop() {
    if (!cameraOn || screen !== 'scr-camera') return;
    const r = ov.getBoundingClientRect(); ov.width = r.width * devicePixelRatio; ov.height = r.height * devicePixelRatio;
    octx.setTransform(devicePixelRatio, 0, 0, devicePixelRatio, 0, 0); octx.clearRect(0, 0, r.width, r.height);
    if (vw) {
      const f = fit(r.width, r.height);
      if (Hb2i) drawWire(octx, Hb2i, f, 0.9);
      calPts.forEach(([x, y], i) => { octx.beginPath(); octx.arc(f.ox + x * f.s, f.oy + y * f.s, 12, 0, 7); octx.fillStyle = 'rgba(242,193,78,.35)'; octx.fill(); octx.lineWidth = 2; octx.strokeStyle = '#f2c14e'; octx.stroke();
        octx.fillStyle = '#fff'; octx.font = 'bold 12px system-ui'; octx.fillText(Board.CAL[i].n, f.ox + x * f.s + 15, f.oy + y * f.s - 12); });
    }
    requestAnimationFrame(calLoop);
  }
  ov.addEventListener('pointerdown', (e) => {
    if (!vw) return; const p = toVideo(e);
    if (calPts.length < 4) { calPts.push(p); recomputeH(); calMsg(); return; }
    const r = ov.getBoundingClientRect(), f = fit(r.width, r.height);
    let best = -1, bd = 44 / f.s; calPts.forEach((q, i) => { const d = Math.hypot(q[0] - p[0], q[1] - p[1]); if (d < bd) { bd = d; best = i; } });
    dragIdx = best; if (best >= 0) ov.setPointerCapture(e.pointerId);
  });
  ov.addEventListener('pointermove', (e) => { if (dragIdx >= 0) { calPts[dragIdx] = toVideo(e); recomputeH(); } });
  ov.addEventListener('pointerup', () => { dragIdx = -1; });

  async function openCamera(mode) {
    calMode = mode || 'host'; show('scr-camera'); $('#cal-msg').textContent = 'Uruchamiam kamerę…';
    try {
      const d = await Vision.startCamera(video); vw = d.w; vh = d.h; cameraOn = true;
      await Vision.unlockCamera();
      const saved = store.get('cal', null);
      calPts = saved && saved.vw === vw && saved.vh === vh ? saved.pts : [];
      recomputeH(); calMsg(); requestWake(); calLoop();
    } catch (err) {
      $('#cal-msg').innerHTML = 'Brak dostępu do kamery. Zezwól aplikacji na aparat w ustawieniach telefonu. (' + esc(err.message) + ')';
    }
  }
  $('#cal-reset').onclick = () => { calPts = []; recomputeH(); calMsg(); };
  $('#cal-back').onclick = async () => {
    if (calMode === 'remote') { Pair.close(); return home(); }
    if (keepMatch && match) { // wróć do trwającej gry bez zmiany kalibracji
      keepMatch = false;
      if (calPts.length === 4) { await lockNow(); Vision.setCalibration(calPts, vw, vh); return startMatch(true, true); }
      return startMatch(false, true);
    }
    wizard(2);
  };
  $('#cal-ok').onclick = async () => {
    store.set('cal', { vw, vh, pts: calPts });
    $('#cal-ok').disabled = true;
    if (settings.lock) $('#cal-msg').textContent = 'Ustawiam ostrość na środek tarczy i ją blokuję… nie ruszaj telefonu.';
    await lockNow();
    $('#cal-ok').disabled = false;
    Vision.setCalibration(calPts, vw, vh);
    if (calMode === 'remote') return startRemote();
    startMatch(true, keepMatch); keepMatch = false;
  };
  async function lockNow() {
    let txt = '';
    if (settings.lock) {
      const lock = await Vision.lockCamera(Vision.apply(Hb2i, 0, 0));
      txt = lock.focus === 'zablokowana' ? '🔒 Ostrość zablokowana' : lock.focus === 'ustawiona raz' ? '🔒 Ostrość ustawiona' : '⚠ Bez blokady ostrości';
      txt += (lock.exposure ? ' · ekspozycja' : '') + (lock.wb ? ' · balans bieli' : '');
    }
    $('#cam-lock').textContent = $('#r-lock').textContent = txt;
  }

  // ---------- GRA ----------
  let match = null, useCam = false, turnDarts = [], editSlot = -1, keepMatch = false;
  const pc = $('#play-canvas'), pctx = pc.getContext('2d');
  function say(t) { if (!settings.voice || !window.speechSynthesis) return; const u = new SpeechSynthesisUtterance(t); u.lang = 'pl-PL'; speechSynthesis.cancel(); speechSynthesis.speak(u); }
  function speakHit(h) { return h.mult === 0 ? 'pudło' : h.num === 25 ? (h.mult === 2 ? 'bull' : 'dwadzieścia pięć') : (h.mult === 3 ? 'potrójne ' : h.mult === 2 ? 'podwójne ' : '') + h.num; }

  function startMatch(withCam, keep) {
    useCam = withCam;
    if (!keep || !match) match = Games.Match(cfg.kind, players.slice(), gameOpts());
    turnDarts = []; pend = null;
    show('scr-play'); $('#play-stage').hidden = !withCam; $('.play-grid').classList.toggle('nocam', !withCam);
    $('#g-title').textContent = match.title();
    $('#g-pair').textContent = Pair.connected() && Pair.role === 'host' ? '🔗 2 kamery' : '';
    if (withCam) { Vision.start(onVision); playLoop(); }
    render(); setStatus(`${match.state.players[match.state.cur].name} – rzucaj!`);
  }
  function setStatus(t, cls) { const s = $('#status'); s.textContent = t; s.className = 'status' + (cls ? ' ' + cls : ''); mirror(); }
  function render() {
    const st = match.state;
    $('#g-header').textContent = match.header();
    $('#board-view').innerHTML = match.view().map(r => `<div class="ps${r.active ? ' active' : ''}"><span class="nm">${esc(r.name)}</span><span class="big">${r.big}</span>
      <span class="sub">${r.sub}</span>${r.hint ? `<span class="hint">Zejście: ${r.hint}</span>` : ''}</div>`).join('');
    const t = st.turn || [], sum = t.reduce((a, h) => a + h.value, 0);
    $('#slots').innerHTML = [0, 1, 2].map(i => t[i] ? `<div class="slot" data-s="${i}">${t[i].label}</div>` : `<div class="slot empty" data-s="${i}">rzutka ${i + 1}</div>`).join('') + `<div class="slot sum">${sum}</div>`;
    mirror(); persist();
  }
  function mirror() {
    if (Pair.role === 'host' && Pair.connected() && match) Pair.send({ t: 'view', rows: match.view(), turn: (match.state.turn || []).map(h => h.label), status: $('#status').textContent });
  }
  function addHit(hit) {
    if (!match || match.state.done) return;
    if (match.state.awaitNext) { setStatus('Wyjmij lotki albo naciśnij „Dalej”', 'take'); return; }
    const r = match.dart(hit); if (!r) return;
    say(speakHit(hit)); render(); afterDart(r);
  }
  function afterDart(r) {
    const st = match.state;
    if (r.gameOver) { setStatus(r.msg, 'win'); say(r.msg.replace('🏆', '')); return endGame(); }
    if (r.bust) { setStatus('BUST! Wyjmij lotki', 'bust'); say('bust'); return; }
    if (r.legOver) { setStatus(r.msg + ' Wyjmij lotki', 'win'); say(r.msg); return; }
    if (r.turnOver) {
      const sum = st.turn.reduce((a, h) => a + h.value, 0);
      setStatus(`${sum} pkt – wyjmij lotki`, 'take'); if (st.kind === 'x01' || st.kind === 'high') setTimeout(() => say(String(sum)), 900); return;
    }
    setStatus(r.msg || `${st.players[st.cur].name} – rzutka ${st.turn.length + 1}`);
  }
  function next() {
    if (!match) return;
    const msg = match.nextPlayer(); render();
    if (match.state.done) { setStatus(msg, 'win'); return endGame(); }
    const p = match.state.players[match.state.cur];
    setStatus(`${p.name} – rzucaj!`); say(p.name);
    if (useCam) Vision.resetReference(false);
    if (pend) { clearTimeout(pend.t); pend = null; }
    Pair.send({ t: 'reset' });
  }
  function onVision(ev) {
    const pill = $('#cam-state'), st = match && match.state;
    if (ev.type === 'ready' || ev.type === 'clear') { pill.textContent = 'Kamera gotowa'; pill.className = 'pill ok'; }
    if (ev.type === 'moving') { pill.textContent = 'Ruch…'; pill.className = 'pill warn'; }
    if (ev.type === 'dart') {
      pill.textContent = 'Kamera gotowa'; pill.className = 'pill ok';
      if (st && st.awaitNext) { next(); return; } // po pełnej kolejce zmiana obrazu = wyjmowanie lotek
      candidate('local', ev.dart.board, ev.dart.img);
    }
    if (ev.type === 'big') {
      if (st && (st.awaitNext || ev.nearEmpty)) { ev.accept(); if (st.awaitNext) next(); turnDarts = []; }
      else { pill.textContent = 'Coś zasłania tarczę'; pill.className = 'pill warn'; }
    }
  }
  // łączenie rzutek z dwóch kamer: ta sama rzutka w obu w ciągu 1,5 s → średnie położenie
  let pend = null;
  function commitDart(board, img, both) {
    const score = Board.score(board[0], board[1]);
    if (!img && Hb2i) img = Vision.apply(Hb2i, board[0], board[1]);
    turnDarts.push({ img: img || [0, 0], board, score, both });
    addHit(score);
  }
  function candidate(src, board, img) {
    if (!match || match.state.done || match.state.awaitNext) return;
    if (!Pair.connected() || Pair.role !== 'host') return commitDart(board, img);
    if (pend && pend.src !== src) { clearTimeout(pend.t); const p = pend; pend = null; return commitDart([(p.board[0] + board[0]) / 2, (p.board[1] + board[1]) / 2], src === 'local' ? img : p.img, true); }
    if (pend) { clearTimeout(pend.t); const p = pend; pend = null; commitDart(p.board, p.img); }
    pend = { src, board, img, t: setTimeout(() => { const p = pend; pend = null; if (p) commitDart(p.board, p.img); }, 1500) };
  }
  function playLoop() {
    if (screen !== 'scr-play' || !useCam) return;
    const r = pc.getBoundingClientRect(); pc.width = r.width * devicePixelRatio; pc.height = r.height * devicePixelRatio;
    pctx.setTransform(devicePixelRatio, 0, 0, devicePixelRatio, 0, 0);
    const f = fit(r.width, r.height); pctx.fillStyle = '#000'; pctx.fillRect(0, 0, r.width, r.height);
    if (video.readyState >= 2) pctx.drawImage(video, f.ox, f.oy, vw * f.s, vh * f.s);
    if (Hb2i) drawWire(pctx, Hb2i, f, 0.4);
    const n = (match && match.state.turn.length) || 0;
    turnDarts.slice(-n).forEach((d) => { const x = f.ox + d.img[0] * f.s, y = f.oy + d.img[1] * f.s;
      pctx.beginPath(); pctx.arc(x, y, 7, 0, 7); pctx.fillStyle = d.both ? '#f2c14e' : '#e2453c'; pctx.fill(); pctx.strokeStyle = '#fff'; pctx.lineWidth = 2; pctx.stroke();
      pctx.fillStyle = '#fff'; pctx.font = 'bold 13px system-ui'; pctx.fillText(d.score.label, x + 10, y - 8); });
    if (n === 0) turnDarts = [];
    requestAnimationFrame(playLoop);
  }

  // ręczne wpisywanie / korekta
  const dlg = $('#dlg-board');
  $('#dlg-svg').innerHTML = Board.svg(Math.min(460, innerWidth - 60));
  function openBoard(slot) { editSlot = slot; $('#dlg-title').textContent = slot >= 0 ? `Popraw rzutkę ${slot + 1}` : 'Dotknij miejsce trafienia'; dlg.showModal(); }
  function chooseHit(hit) {
    dlg.close();
    const st = match.state;
    if (editSlot >= 0 && editSlot === st.turn.length - 1) { const r = match.replaceLast(hit); render(); if (r) afterDart(r); }
    else if (editSlot >= 0 && editSlot < st.turn.length) setStatus('Poprawić można ostatnią rzutkę – wcześniejsze cofnij', 'take');
    else addHit(hit);
  }
  $('#dlg-svg').addEventListener('click', (e) => {
    const svg = e.currentTarget.querySelector('svg'), pt = svg.createSVGPoint(); pt.x = e.clientX; pt.y = e.clientY;
    const p = pt.matrixTransform(svg.getScreenCTM().inverse()); chooseHit(Board.score(p.x, -p.y));
  });
  $$('[data-q]').forEach(b => b.onclick = () => chooseHit(Board.fromLabel(b.dataset.q)));
  $('#slots').addEventListener('click', (e) => { const s = e.target.closest('.slot[data-s]'); if (s) openBoard(+s.dataset.s); });
  $('#a-manual').onclick = () => openBoard(-1);
  $('#a-miss').onclick = () => addHit(Board.fromLabel('0'));
  $('#a-undo').onclick = () => { match.undo(); turnDarts.pop(); render(); setStatus('Cofnięto'); if (useCam) Vision.resetReference(false); Pair.send({ t: 'reset' }); };
  $('#a-next').onclick = next;
  $('#g-menu').onclick = () => { $('#m-recal').hidden = !useCam; $('#dlg-menu').showModal(); };
  $('#m-recal').onclick = () => { $('#dlg-menu').close(); Vision.stop(); keepMatch = true; openCamera(); }; // ta sama gra po kalibracji
  $('#m-restart').onclick = () => { $('#dlg-menu').close(); if (useCam) Vision.setCalibration(calPts, vw, vh); startMatch(useCam); };
  $('#m-end').onclick = () => { $('#dlg-menu').close(); home(); };

  function endGame() {
    Vision.stop(); localStorage.removeItem('dart.match');
    $('#end-title').textContent = `🏆 ${match.state.winner} wygrywa!`;
    $('#end-table').innerHTML = `<table><tr><th>Gracz</th><th>Wynik</th><th></th></tr>${match.view().map(r => `<tr><td>${esc(r.name)}</td><td>${r.big}</td><td class="muted">${r.sub}</td></tr>`).join('')}</table>`;
    $('#dlg-end').showModal();
  }
  $('#end-again').onclick = () => { $('#dlg-end').close(); if (useCam) Vision.setCalibration(calPts, vw, vh); startMatch(useCam); };
  $('#end-new').onclick = () => { $('#dlg-end').close(); wizard(0); };

  // ---------- PAROWANIE ----------
  const dlgPair = $('#dlg-pair');
  function pairState() {
    const ok = Pair.connected() && Pair.role === 'host';
    $('#pair-state').textContent = ok ? '🔗 Druga kamera połączona' : 'Nie połączono';
    $('#pair-state').className = 'small ' + (ok ? 'paired' : 'muted');
    $('#pair-host').textContent = ok ? 'Połącz ponownie' : 'Połącz drugi telefon';
    if (screen === 'scr-new' && step === 2) $('#w-next').disabled = cfg.cams === 'two' && !ok;
  }
  function pairView(stepTxt, { qr, scanBtn } = {}) {
    $('#pair-step').innerHTML = stepTxt;
    $('#pair-qr').hidden = !qr; $('#pair-scan').hidden = !scanBtn; $('#pair-manual').hidden = true; $('#pair-video').hidden = true;
    if (qr) QR.toCanvas(qr, $('#pair-qr'));
  }
  async function readCode() {
    if (Pair.canScan()) { $('#pair-video').hidden = false; try { return await Pair.scan($('#pair-video')); } finally { $('#pair-video').hidden = true; } }
    $('#pair-manual').hidden = false;
    return new Promise(res => { $('#pair-text-ok').onclick = () => res($('#pair-text').value); });
  }
  $('#pair-host').onclick = async () => {
    dlgPair.showModal(); $('#pair-title').textContent = 'Połącz drugi telefon';
    pairView('Przygotowuję kod…');
    try {
      const code = await Pair.host();
      pairView('<b>1.</b> Na drugim telefonie otwórz aplikację i wybierz <b>„Ten telefon to druga kamera”</b>. Zeskanuj nim ten kod.<br><b>2.</b> Gdy drugi telefon pokaże swój kod – naciśnij przycisk poniżej.', { qr: code, scanBtn: true });
      $('#pair-scan').onclick = async () => {
        pairView('Skieruj aparat na kod wyświetlony na drugim telefonie.');
        try { await Pair.hostAccept(await readCode()); pairView('Łączę telefony…'); } catch (e) { pairView('Nie udało się: ' + esc(e.message) + '. Spróbuj od nowa.'); }
      };
    } catch (e) { pairView('Nie udało się przygotować parowania: ' + esc(e.message)); }
  };
  async function joinAsRemote() {
    dlgPair.showModal(); $('#pair-title').textContent = 'Druga kamera';
    pairView('Skieruj aparat na kod wyświetlony na <b>głównym telefonie</b>.<br><span class="muted small">Oba telefony muszą być w tej samej sieci Wi‑Fi (np. hotspot).</span>');
    try {
      const answer = await Pair.join(await readCode());
      pairView('Pokaż ten kod głównemu telefonowi – tam naciśnij <b>„Skanuj kod z drugiego telefonu”</b>.', { qr: answer });
    } catch (e) { pairView('Nie udało się: ' + esc(e.message) + '. Spróbuj od nowa.'); }
  }
  $('#pair-cancel').onclick = () => { Pair.stopScan(); dlgPair.close(); if (!Pair.connected()) Pair.close(); };
  Pair.on((m) => {
    if (Pair.role === 'host') { if (m.t === 'dart' && match && screen === 'scr-play') candidate('remote', m.b, null); return; }
    if (m.t === 'reset') { Vision.resetReference(false); remoteDarts = []; }
    if (m.t === 'view') renderRemoteView(m);
  }, (s) => {
    if (s === 'connected') {
      Pair.stopScan(); dlgPair.close();
      if (Pair.role === 'host') { pairState(); mirror(); } else openCamera('remote');
    } else {
      pairState();
      $('#r-conn').textContent = 'Rozłączono'; $('#r-conn').className = 'pill static warn';
      $('#g-pair').textContent = '';
    }
  });

  // ---------- DRUGA KAMERA ----------
  let remoteDarts = [];
  const rc = $('#remote-canvas'), rctx = rc.getContext('2d');
  function startRemote() {
    show('scr-remote'); $('#r-conn').textContent = 'Połączono'; $('#r-conn').className = 'pill static ok';
    Vision.start(onRemoteVision); remoteLoop();
  }
  function onRemoteVision(ev) {
    const pill = $('#r-cam');
    if (ev.type === 'ready' || ev.type === 'clear') { pill.textContent = 'Kamera gotowa'; pill.className = 'pill ok'; }
    if (ev.type === 'moving') { pill.textContent = 'Ruch…'; pill.className = 'pill warn'; }
    if (ev.type === 'dart') { remoteDarts.push(ev.dart); Pair.send({ t: 'dart', b: ev.dart.board, ts: Date.now() }); $('#r-status').textContent = 'Wysłano: ' + ev.dart.score.label; pill.textContent = 'Kamera gotowa'; pill.className = 'pill ok'; }
    if (ev.type === 'big') ev.accept();
  }
  function remoteLoop() {
    if (screen !== 'scr-remote') return;
    const r = rc.getBoundingClientRect(); rc.width = r.width * devicePixelRatio; rc.height = r.height * devicePixelRatio;
    rctx.setTransform(devicePixelRatio, 0, 0, devicePixelRatio, 0, 0);
    const f = fit(r.width, r.height); rctx.fillStyle = '#000'; rctx.fillRect(0, 0, r.width, r.height);
    if (video.readyState >= 2) rctx.drawImage(video, f.ox, f.oy, vw * f.s, vh * f.s);
    if (Hb2i) drawWire(rctx, Hb2i, f, 0.4);
    remoteDarts.slice(-3).forEach(d => { const x = f.ox + d.img[0] * f.s, y = f.oy + d.img[1] * f.s;
      rctx.beginPath(); rctx.arc(x, y, 7, 0, 7); rctx.fillStyle = '#2f7fe2'; rctx.fill(); rctx.strokeStyle = '#fff'; rctx.lineWidth = 2; rctx.stroke();
      rctx.fillStyle = '#fff'; rctx.font = 'bold 13px system-ui'; rctx.fillText(d.score.label, x + 10, y - 8); });
    requestAnimationFrame(remoteLoop);
  }
  function renderRemoteView(m) {
    $('#r-board').innerHTML = (m.rows || []).map(r => `<div class="ps${r.active ? ' active' : ''}"><span class="nm">${esc(r.name)}</span><span class="big">${r.big}</span><span class="sub">${r.sub}</span></div>`).join('');
    $('#r-status').textContent = (m.status || '') + (m.turn && m.turn.length ? ' · ' + m.turn.join(' ') : '');
  }
  $('#r-recal').onclick = () => { Vision.stop(); openCamera('remote'); };
  $('#r-leave').onclick = () => { Pair.close(); home(); };

  // ekran nie gaśnie w trakcie gry
  async function requestWake() { try { await navigator.wakeLock.request('screen'); } catch {} }
  document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'visible' && cameraOn) requestWake(); });

  const dev = ['localhost', '127.0.0.1'].includes(location.hostname);
  if ('serviceWorker' in navigator) {
    if (dev) navigator.serviceWorker.getRegistrations().then(rs => rs.forEach(r => r.unregister()));
    else navigator.serviceWorker.register('sw.js').catch(() => {});
  }

  // ---------- wznowienie po odświeżeniu / ponownym otwarciu ----------
  async function resumeCamera() {
    keepMatch = true; calMode = 'host';
    show('scr-camera'); $('#cal-msg').textContent = 'Wznawiam grę…'; $('#cal-ok').disabled = true;
    try {
      const d = await Vision.startCamera(video); vw = d.w; vh = d.h; cameraOn = true;
      const savedCal = store.get('cal', null);
      if (!savedCal || savedCal.vw !== vw || savedCal.vh !== vh) return openCamera(); // trzeba skalibrować, gra zostaje
      calPts = savedCal.pts; recomputeH();
      await lockNow(); Vision.setCalibration(calPts, vw, vh); requestWake();
      keepMatch = false; startMatch(true, true);
      setStatus(`Wznowiono grę – rzuca ${match.state.players[match.state.cur].name}` + (cfg.cams === 'two' ? ' (druga kamera rozłączona)' : ''));
    } catch { keepMatch = false; startMatch(false, true); setStatus('Wznowiono grę bez kamery'); }
  }
  function restore() {
    $$('.screen').forEach(s => s.hidden = true);
    const ses = store.get('session', null), saved = store.get('match', null);
    if (!ses) return home();
    calMode = ses.calMode || 'host';
    if (ses.screen === 'scr-new') return wizard(ses.step || 0);
    if (ses.screen === 'scr-remote' || calMode === 'remote') {
      home(); $('#home-remote').classList.add('warn'); $('#home-remote-sub').textContent = 'Połączenie przerwane – dotknij, aby dołączyć ponownie'; return;
    }
    if ((ses.screen === 'scr-play' || ses.screen === 'scr-camera') && saved) {
      match = Games.Match(saved.kind, saved.players, saved.opts, saved);
      if (ses.screen === 'scr-camera' || ses.useCam) return resumeCamera();
      startMatch(false, true); return setStatus(`Wznowiono grę – rzuca ${match.state.players[match.state.cur].name}`);
    }
    if (ses.screen === 'scr-camera') return launch(); // kalibracja nowej gry
    home();
  }
  restore();
})();
