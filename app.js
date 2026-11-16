'use strict';
(() => {
  const $ = (s) => document.querySelector(s), $$ = (s) => [...document.querySelectorAll(s)];
  const store = { get(k, d) { try { const v = localStorage.getItem('dart.' + k); return v ? JSON.parse(v) : d; } catch { return d; } },
                  set(k, v) { try { localStorage.setItem('dart.' + k, JSON.stringify(v)); } catch {} } };
  const VERSION = '12'; // przy każdej aktualizacji podbić też CACHE w sw.js
  const GEAR = $('[data-settings] svg').outerHTML;
  $$('[data-settings]').forEach(b => { b.innerHTML = GEAR; b.onclick = openSettings; });
  let screen = 'scr-home';
  const show = (id) => { screen = id; $$('.screen').forEach(s => s.hidden = s.id !== id); window.scrollTo(0, 0); persist(); };
  // zapis stanu na bieżąco: odświeżenie strony (np. przypadkowe przeciągnięcie) wraca w to samo miejsce
  function persist() {
    store.set('cfg', cfg); store.set('players', players);
    store.set('session', { screen, step, useCam, calMode, savedId });
    if (match && !match.state.done && (screen === 'scr-play' || screen === 'scr-camera')) store.set('match', match.dump());
    else if (screen !== 'scr-camera') localStorage.removeItem('dart.match');
  }
  const esc = (t) => String(t).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  const lbl = (x) => x === 'Pudło' ? t('aMiss') : x; // etykieta pudła w języku aplikacji
  document.addEventListener('pointerdown', () => Caller.unlock(), { once: true }); // dźwięk wolno włączyć dopiero po dotknięciu

  // ---------- ustawienia (tylko pod ikoną ⚙) ----------
  const settings = Object.assign({ voice: true, lock: true, sens: 50, crowd: true, each: 'pts', caller: '', lang: I18N.lang }, store.get('settings', {}));
  if (typeof settings.each !== 'string') settings.each = 'pts'; // v10 miało przełącznik true/false
  const applySettings = () => {
    Vision.cfg.diffThr = 78 - settings.sens; I18N.lang = settings.lang;
    Caller.set({ on: settings.voice, crowd: settings.crowd, voiceName: settings.caller });
    store.set('settings', settings);
  };
  function sensLabel() { return t(settings.sens >= 56 ? 'sensVHigh' : settings.sens >= 44 ? 'sensNorm' : settings.sens >= 32 ? 'sensLow' : 'sensVLow'); }
  function fillVoices() {
    const vs = Caller.voicesFor(I18N.speechLang());
    $('#s-caller').innerHTML = `<option value="">${esc(t('sAuto'))}</option>` + vs.map(v => `<option value="${esc(v.name)}">${esc(v.name)}</option>`).join('');
    $('#s-caller').value = vs.some(v => v.name === settings.caller) ? settings.caller : '';
    // jeden głos = lista nic nie daje, głos męski wybiera się w Androidzie → zamiast listy wskazówka
    $('#s-voice-hint').hidden = !settings.voice || vs.length > 1;
    $('#s-caller-row').hidden = !settings.voice || vs.length <= 1;
  }
  function openSettings() {
    $$('#s-lang button').forEach(b => b.classList.toggle('on', b.dataset.v === settings.lang));
    $('#s-voice').checked = settings.voice; $('#s-crowd').checked = settings.crowd;
    $$('#s-each button').forEach(b => b.classList.toggle('on', b.dataset.v === settings.each));
    $('#s-lock').checked = settings.lock; $('#s-sens').value = settings.sens; $('#s-sens-v').textContent = sensLabel();
    fillVoices();
    $('#s-bg').hidden = screen !== 'scr-play' || !useCam;
    $('#dlg-settings').showModal();
  }
  if (window.speechSynthesis) speechSynthesis.addEventListener && speechSynthesis.addEventListener('voiceschanged', () => { if ($('#dlg-settings').open) fillVoices(); });
  $('#s-lang').onclick = (e) => { const b = e.target.closest('button'); if (!b) return; settings.lang = b.dataset.v; applySettings(); relabel(); openSettings(); };
  $('#s-voice').onchange = (e) => { settings.voice = e.target.checked; applySettings(); fillVoices(); };
  $('#s-caller').onchange = (e) => { settings.caller = e.target.value; applySettings(); Caller.test(); };
  $('#s-test').onclick = () => Caller.test();
  $('#s-crowd').onchange = (e) => { settings.crowd = e.target.checked; applySettings(); };
  $('#s-each').onclick = (e) => { const b = e.target.closest('button'); if (!b) return; settings.each = b.dataset.v; applySettings(); $$('#s-each button').forEach(x => x.classList.toggle('on', x === b)); };
  $('#s-lock').onchange = (e) => { settings.lock = e.target.checked; applySettings(); };
  $('#s-sens').oninput = (e) => { settings.sens = +e.target.value; $('#s-sens-v').textContent = sensLabel(); applySettings(); };
  $('#s-bg').onclick = () => { Vision.resetReference(true); $('#dlg-settings').close(); setStatus(t('bgSaved')); };
  $('#s-reset').onclick = () => { ['players', 'cfg', 'cal', 'recent', 'settings', 'saved', 'match', 'session'].forEach(k => localStorage.removeItem('dart.' + k)); location.reload(); };
  $$('[data-close]').forEach(b => b.onclick = () => b.closest('dialog').close());
  applySettings();

  // zmiana języka: teksty stałe + odświeżenie bieżącego ekranu
  function relabel() {
    I18N.apply(); $$('.ver').forEach(e => e.textContent = t('version', { v: VERSION }));
    $('#recent').dataset.label = t('recentPlayed');
    kpInline && kpInline.relabel(); kpDlg && kpDlg.relabel();
    if (screen === 'scr-home') home();
    if (screen === 'scr-new') renderWizard();
    if (screen === 'scr-camera' && cameraOn) calMsg();
    if (screen === 'scr-play' && match) { $('#g-title').textContent = match.title(); render(); if (!match.state.awaitNext && !match.state.done) setStatus(t('throwNow', { n: curName() })); }
    if (screen === 'scr-remote') { $('#r-conn').textContent = t(Pair.connected() ? 'connected' : 'disconnected'); }
  }

  // ---------- konfiguracja gry ----------
  const cfg = Object.assign({ kind: 'x01', start: 501, legs: 1, sets: 1, doubleOut: true, doubleIn: false, multSkip: false, shRounds: 7, hiRounds: 10, cams: 'one' }, store.get('cfg', {}));
  let players = store.get('players', [t('playerN', { n: 1 }), t('playerN', { n: 2 })]);
  let recent = store.get('recent', []);
  const isDefaultName = (p) => /^(Gracz|Player) \d+$/.test(p);
  function gameOpts() {
    if (cfg.kind === 'x01') return { start: cfg.start, legs: cfg.legs, sets: cfg.sets, doubleOut: cfg.doubleOut, doubleIn: cfg.doubleIn };
    if (cfg.kind === 'atc') return { multSkip: cfg.multSkip };
    if (cfg.kind === 'shanghai') return { rounds: cfg.shRounds };
    if (cfg.kind === 'high') return { rounds: cfg.hiRounds };
    return {};
  }
  const kindName = (k, start) => ({ x01: String(start), cricket: 'Cricket', atc: t('gAtc'), shanghai: 'Shanghai', high: 'High Score' }[k]);
  function gameLabel() { return kindName(cfg.kind, cfg.start) + ' · ' + players.join(' vs '); }
  function saveCfg() {
    players = players.map(p => p.trim() || t('player'));
    recent = [...new Set([...players, ...recent])].slice(0, 12);
    store.set('cfg', cfg); store.set('players', players); store.set('recent', recent);
  }

  // ---------- START ----------
  function home() {
    Vision.stop(); match = null; savedId = null; show('scr-home');
    const has = store.get('cfg', null);
    $('#home-again').hidden = !has; if (has) $('#home-again').textContent = t('playAgain', { x: gameLabel() });
    const saved = store.get('saved', []);
    $('#home-saved').hidden = !saved.length; $('#home-saved-sub').textContent = t('savedTileSub', { n: saved.length });
    $('.home').classList.toggle('has-saved', saved.length > 0);
  }
  $('#home-new').onclick = () => wizard(0);
  $('#home-again').onclick = () => { if (cfg.cams === 'two' && !Pair.connected()) return wizard(2); launch(); };
  $('#home-remote').onclick = joinAsRemote;
  $('#home-saved').onclick = openSaved;

  // ---------- ZAPISANE GRY ----------
  let savedId = null; // id zapisu, z którego wznowiono bieżącą grę (ponowny zapis nadpisuje go)
  function saveGame() {
    const list = store.get('saved', []), id = savedId || Date.now().toString(36);
    const entry = { id, ts: Date.now(), cfg: Object.assign({}, cfg), players: players.slice(), useCam, dump: match.dump(), header: match.header(),
      rows: match.view().map(r => ({ name: r.name, big: r.big })) };
    const i = list.findIndex(e => e.id === id); if (i >= 0) list.splice(i, 1);
    list.unshift(entry); store.set('saved', list.slice(0, 20));
  }
  function openSaved() {
    const list = store.get('saved', []);
    const fmt = (ts) => new Date(ts).toLocaleString(settings.lang === 'pl' ? 'pl-PL' : 'en-GB', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' });
    $('#saved-list').innerHTML = list.length ? list.map(e => `<div class="saved-row">
        <div class="saved-info"><b>${esc(kindName(e.cfg.kind, e.cfg.start))} · ${e.rows.map(r => `${esc(r.name)} <span class="sc">${r.big}</span>`).join(' · ')}</b>
        <small class="muted">${esc(e.header)} · ${fmt(e.ts)}${e.useCam ? ' · 📷' : ''}</small></div>
        <button class="btn primary" data-play="${e.id}">${esc(t('resume'))}</button><button class="icon-btn" data-del="${e.id}" aria-label="${esc(t('del'))}">🗑</button></div>`).join('')
      : `<p class="muted center">${esc(t('savedEmpty'))}</p>`;
    $('#dlg-saved').showModal();
  }
  $('#saved-list').onclick = (e) => {
    const del = e.target.closest('[data-del]'), play = e.target.closest('[data-play]');
    if (del) { store.set('saved', store.get('saved', []).filter(x => x.id !== del.dataset.del)); openSaved(); home(); return; }
    if (!play) return;
    const entry = store.get('saved', []).find(x => x.id === play.dataset.play); if (!entry) return;
    $('#dlg-saved').close();
    Object.assign(cfg, entry.cfg); players = entry.players.slice(); savedId = entry.id;
    match = Games.Match(entry.dump.kind, entry.dump.players, entry.dump.opts, entry.dump);
    if (entry.useCam) return resumeCamera();
    startMatch(false, true); setStatus(t('resumed', { n: match.state.players[match.state.cur].name }));
  };
  function dropSaved() { if (savedId) { store.set('saved', store.get('saved', []).filter(x => x.id !== savedId)); savedId = null; } }

  // ---------- KREATOR ----------
  let step = 0;
  function wizard(s) { step = s; show('scr-new'); renderWizard(); }
  function renderWizard() {
    $$('.step').forEach(el => el.hidden = +el.dataset.step !== step);
    $$('#w-steps span').forEach((el, i) => el.classList.toggle('on', i <= step));
    const last = step === 2;
    $('#w-next').textContent = !last ? t('next') : cfg.cams === 'none' ? t('startGame') : t('nextCalib');
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
      <input type="text" value="${esc(p)}" data-i="${i}" aria-label="${esc(t('playerN', { n: i + 1 }))}" enterkeyhint="next">
      <button class="icon-btn" data-del="${i}" aria-label="${esc(t('removePlayer'))}" ${players.length < 2 ? 'disabled' : ''}>✕</button></div>`).join('');
    $('#players').classList.toggle('two-col', players.length > 4);
    const free = recent.filter(r => !players.includes(r)).slice(0, players.length > 4 ? 3 : 6);
    $('#recent').innerHTML = free.map(r => `<button class="chip" data-r="${esc(r)}">+ ${esc(r)}</button>`).join('');
    $('#add-player').hidden = players.length >= 8;
    persist();
  }
  $('#players').oninput = (e) => { if (e.target.dataset.i) { players[+e.target.dataset.i] = e.target.value; persist(); } };
  $('#players').onclick = (e) => { const d = e.target.closest('[data-del]'); if (d) { players.splice(+d.dataset.del, 1); renderPlayers(); } };
  $('#players').onfocusin = (e) => { if (e.target.tagName === 'INPUT' && isDefaultName(e.target.value)) e.target.select(); };
  $('#add-player').onclick = () => { players.push(t('playerN', { n: players.length + 1 })); renderPlayers(); const ins = $$('#players input'); ins[ins.length - 1].focus(); };
  $('#recent').onclick = (e) => {
    const c = e.target.closest('[data-r]'); if (!c || players.length >= 8) return;
    const i = players.findIndex(isDefaultName);
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

  function launch() { saveCfg(); match = null; savedId = null; keepMatch = false; if (cfg.cams === 'none') return startMatch(false); openCamera(); }

  // ---------- KALIBRACJA ----------
  const video = $('#video'), ov = $('#overlay'), octx = ov.getContext('2d');
  let calPts = [], vw = 0, vh = 0, Hb2i = null, cameraOn = false, dragIdx = -1, calMode = 'host';
  const CAL_KEYS = ['cal20', 'cal6', 'cal3', 'cal11'];

  function fit(boxW, boxH) { const s = Math.min(boxW / vw, boxH / vh); return { s, ox: (boxW - vw * s) / 2, oy: (boxH - vh * s) / 2 }; }
  function toVideo(ev) { const r = ov.getBoundingClientRect(), f = fit(r.width, r.height); return [(ev.clientX - r.left - f.ox) / f.s, (ev.clientY - r.top - f.oy) / f.s]; }
  function calMsg() {
    if (calPts.length < 4) $('#cal-msg').innerHTML = t('calStep', { n: calPts.length + 1, x: t(CAL_KEYS[calPts.length]) });
    else $('#cal-msg').innerHTML = t('calDone');
    $('#cal-ok').disabled = calPts.length < 4;
    $('#cal-ok').textContent = calMode === 'remote' ? t('calStartRemote') : t('startGame');
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
    calMode = mode || 'host'; show('scr-camera'); $('#cal-msg').textContent = t('camStarting');
    try {
      const d = await Vision.startCamera(video); vw = d.w; vh = d.h; cameraOn = true;
      await Vision.unlockCamera();
      const saved = store.get('cal', null);
      calPts = saved && saved.vw === vw && saved.vh === vh ? saved.pts : [];
      recomputeH(); calMsg(); requestWake(); calLoop();
    } catch (err) {
      $('#cal-msg').innerHTML = t('camDenied', { x: esc(err.message) });
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
    if (settings.lock) $('#cal-msg').textContent = t('locking');
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
      txt = t(lock.focus === 'zablokowana' ? 'lockOk' : lock.focus === 'ustawiona raz' ? 'lockOnce' : 'lockNo');
      txt += (lock.exposure ? t('lockExp') : '') + (lock.wb ? t('lockWb') : '');
    }
    $('#cam-lock').textContent = $('#r-lock').textContent = txt;
  }

  // ---------- GRA ----------
  let match = null, useCam = false, turnDarts = [], editSlot = -1, keepMatch = false;
  const pc = $('#play-canvas'), pctx = pc.getContext('2d');
  const curName = () => match.state.players[match.state.cur].name;
  // sędzia na początku kolejki: imię, a w X01 – „potrzebujesz X”, gdy jest zejście
  function announcePlayer(first) {
    if (!match || screen !== 'scr-play') return;
    const st = match.state, p = st.players[st.cur];
    if (first) return Caller.gameOn(p.name);
    if (st.kind === 'x01' && p.rest <= 170 && Games.checkout(p.rest, 3, st.o.doubleOut)) Caller.require(p.name, p.rest);
    else Caller.player(p.name);
  }

  function startMatch(withCam, keep) {
    useCam = withCam;
    const fresh = !keep || !match;
    if (fresh) match = Games.Match(cfg.kind, players.slice(), gameOpts());
    turnDarts = []; pend = null;
    show('scr-play'); $('#play-stage').hidden = !withCam; $('.play-main').classList.toggle('nocam', !withCam);
    $('#scr-play').classList.toggle('nocam', !withCam); $('#kp-inline').hidden = withCam; $('.actions').hidden = !withCam; kpInline.reset();
    $('#g-title').textContent = match.title();
    $('#g-pair').textContent = Pair.connected() && Pair.role === 'host' ? t('twoCams') : '';
    if (withCam) { Vision.start(onVision); playLoop(); }
    render(); setStatus(t('throwNow', { n: curName() }));
    if (fresh) setTimeout(() => announcePlayer(true), 300);
  }
  function setStatus(txt, cls) { const s = $('#status'); s.textContent = txt; s.className = 'status' + (cls ? ' ' + cls : ''); mirror(); }
  function render() {
    const st = match.state;
    $('#g-header').textContent = match.header();
    $('#board-view').classList.toggle('many', st.players.length > 4);
    const log = (st.log || []).slice().reverse();
    $('#history').innerHTML = log.length ? log.map(e => `<div class="h-row${e.bust ? ' bust' : ''}${e.tag ? '' : ' notag'}">${e.tag ? `<span class="h-t">${e.tag}</span>` : ''}<span class="h-n">${esc(st.players[e.p].name)}</span>
      <span class="h-d">${e.d.map(lbl).join(' ')}</span><b>${e.bust ? 'BUST' : e.sum}${e.rest != null ? `<span class="h-rest">→ ${e.rest}</span>` : ''}</b></div>`).join('')
      : `<p class="muted small h-empty">${esc(t('historyEmpty'))}</p>`;
    $('#board-view').innerHTML = match.view().map(r => `<div class="ps${r.active ? ' active' : ''}"><span class="nm">${esc(r.name)}</span><span class="big">${r.big}</span>
      <span class="sub">${r.sub}</span>${r.hint ? `<span class="hint">${esc(t('checkout', { x: r.hint }))}</span>` : ''}</div>`).join('');
    // pole następnej rzutki jest podświetlone – tam trafi wpisana / wykryta wartość
    const tr = st.turn || [], sum = tr.reduce((a, h) => a + h.value, 0), nextIdx = st.awaitNext || st.done ? -1 : tr.length;
    $('#slots').innerHTML = [0, 1, 2].map(i => tr[i] ? `<button class="slot" data-s="${i}" aria-label="${esc(t('fixDartN', { n: i + 1 }))}">${lbl(tr[i].label)}<span class="edit">✎</span></button>`
      : `<div class="slot empty${i === nextIdx ? ' next' : ''}" data-s="${i}">${i === nextIdx ? '▸ ' : ''}${esc(t('dartN', { n: i + 1 }))}</div>`).join('') + `<div class="slot sum">${sum}</div>`;
    const nk = $('#kp-inline [data-k=N]'); if (nk) nk.classList.toggle('pulse', !!st.awaitNext);
    mirror(); persist();
  }
  function mirror() {
    if (Pair.role === 'host' && Pair.connected() && match) Pair.send({ t: 'view', rows: match.view(), turn: (match.state.turn || []).map(h => lbl(h.label)), status: $('#status').textContent });
  }
  function addHit(hit) {
    if (!match || match.state.done) return;
    if (match.state.awaitNext) { setStatus(t(useCam ? 'pullOrNext' : 'pressNext'), 'take'); return; }
    const r = match.dart(hit); if (!r) return;
    Caller.dart(hit, settings.each); // punkty każdej rzutki – od razu wiadomo, czy odczyt jest dobry
    render(); afterDart(r);
  }
  function afterDart(r) {
    const st = match.state, sum = st.turn.reduce((a, h) => a + h.value, 0);
    if (r.gameOver) { setStatus(r.msg, 'win'); (st.kind === 'x01' ? Caller.match : Caller.wins).call(Caller, st.winner); return endGame(); }
    if (r.bust) { setStatus(t(useCam ? 'bustCam' : 'bustKp'), 'bust'); Caller.bust(); return; }
    if (r.legOver) { setStatus(r.msg + (useCam ? ' ' + t('bustCam').replace(/^BUST! /, '') : ''), 'win'); Caller.leg(curName()); return; }
    if (r.turnOver) {
      const p = t('pts', { n: sum });
      setStatus(useCam ? t('pullDarts', { x: p }) : t('enterNext', { x: p }), 'take');
      Caller.score(sum); // po 3 lotkach: łączna liczba punktów
      return;
    }
    setStatus(r.msg || t('dartOf', { n: curName(), d: st.turn.length + 1 }));
  }
  function next() {
    if (!match) return;
    const msg = match.nextPlayer(); render();
    if (match.state.done) { setStatus(msg, 'win'); Caller.wins(match.state.winner); return endGame(); }
    setStatus(t('throwNow', { n: curName() })); announcePlayer(false);
    if (useCam) Vision.resetReference(false);
    if (pend) { clearTimeout(pend.t); pend = null; }
    Pair.send({ t: 'reset' });
  }
  function onVision(ev) {
    const pill = $('#cam-state'), st = match && match.state;
    if (ev.type === 'ready' || ev.type === 'clear') { pill.textContent = t('camReady'); pill.className = 'pill ok'; }
    if (ev.type === 'moving') { pill.textContent = t('moving'); pill.className = 'pill warn'; }
    if (ev.type === 'dart') {
      pill.textContent = t('camReady'); pill.className = 'pill ok';
      if (st && st.awaitNext) { next(); return; } // po pełnej kolejce zmiana obrazu = wyjmowanie lotek
      candidate('local', ev.dart.board, ev.dart.img);
    }
    if (ev.type === 'big') {
      if (st && (st.awaitNext || ev.nearEmpty)) { ev.accept(); if (st.awaitNext) next(); turnDarts = []; }
      else { pill.textContent = t('blocked'); pill.className = 'pill warn'; }
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
      pctx.fillStyle = '#fff'; pctx.font = 'bold 13px system-ui'; pctx.fillText(lbl(d.score.label), x + 10, y - 8); });
    if (n === 0) turnDarts = [];
    requestAnimationFrame(playLoop);
  }

  // ---------- klawiatura trafień: [D/T] + liczba; 3–9 od razu, „1”/„2” czeka na drugą cyfrę ----------
  function Keypad(el, { onHit, onPending, mode }) {
    let mult = 1, pend = null, timer = 0;
    const K = (k, txt, cls = '') => `<button class="kp ${cls}" data-k="${k}">${txt}</button>`;
    const build = () => {
      el.innerHTML = K(1, 1) + K(2, 2) + K(3, 3) + K('D', `D<small>${t('kpDouble')}</small>`, 'mod') +
        K(4, 4) + K(5, 5) + K(6, 6) + K('T', `T<small>${t('kpTreble')}</small>`, 'mod') +
        K(7, 7) + K(8, 8) + K(9, 9) + K(25, `25<small>${t('kpBull')}</small>`, 'mod') +
        (mode === 'inline' ? K('U', `↶<small>${t('kpUndo')}</small>`, 'fn') + K(0, `0<small>${t('kpMiss')}</small>`) + K('N', t('kpNext'), 'primary span2')
                           : K(0, `0<small>${t('kpMiss')}</small>`, 'span2') + K('X', t('kpRemove'), 'fn danger span2'));
    };
    build();
    const paint = () => {
      el.querySelectorAll('.mod').forEach(b => b.classList.toggle('on', (b.dataset.k === 'D' && mult === 2) || (b.dataset.k === 'T' && mult === 3)));
      onPending && onPending(pend ? (mult === 3 ? 'T' : mult === 2 ? 'D' : '') + pend + '…' : mult > 1 ? (mult === 3 ? 'T' : 'D') + ' …' : '');
    };
    const commit = (num) => {
      clearTimeout(timer);
      const hit = num === 0 ? Board.fromLabel('0') : num === 25 ? Board.fromLabel(mult === 2 ? 'BULL' : '25') : Board.fromLabel((mult === 3 ? 'T' : mult === 2 ? 'D' : '') + num);
      mult = 1; pend = null; paint(); onHit(hit);
    };
    const flushPend = () => { if (pend) commit(+pend); };
    el.addEventListener('click', (e) => {
      const b = e.target.closest('.kp'); if (!b) return;
      if (navigator.vibrate) navigator.vibrate(12);
      const k = b.dataset.k;
      if (k === 'D' || k === 'T') { flushPend(); const m = k === 'T' ? 3 : 2; mult = mult === m ? 1 : m; return paint(); }
      if (k === 'U') { if (pend || mult > 1) { clearTimeout(timer); pend = null; mult = 1; return paint(); } return undoDart(); }
      if (k === 'N') { flushPend(); return next(); }
      if (k === 'X') return onHit(null);
      if (k === '25') { flushPend(); if (mult === 3) { mult = 1; paint(); return setStatus(t('noT25'), 'take'); } return commit(25); }
      const d = +k;
      if (pend === '1') return commit(10 + d);
      if (pend === '2') { if (d === 0) return commit(20); commit(2); }
      if (d === 0) return commit(0);
      if (d >= 3) return commit(d);
      pend = String(d); paint(); clearTimeout(timer); timer = setTimeout(flushPend, 1300); // 1 lub 2 bez drugiej cyfry
    });
    return { reset() { clearTimeout(timer); mult = 1; pend = null; paint(); }, relabel() { build(); paint(); } };
  }
  let kpInline = null, kpDlg = null;
  kpInline = Keypad($('#kp-inline'), {
    mode: 'inline',
    onPending: (txt) => { const e = $('#slots .slot.next'); if (e) { e.textContent = txt || '▸ ' + t('dartN', { n: +e.dataset.s + 1 }); e.classList.toggle('pending', !!txt); } },
    onHit: (hit) => { if (match.state.awaitNext) next(); addHit(hit); } // kolejna liczba po pełnej kolejce = następny gracz
  });
  const dlg = $('#dlg-board');
  kpDlg = Keypad($('#kp-dlg'), {
    mode: 'dlg',
    onPending: (txt) => { $('#dlg-title').textContent = (editSlot >= 0 ? t('fixDartN', { n: editSlot + 1 }) : t('enterHit')) + (txt ? ': ' + txt : ''); },
    onHit: (hit) => {
      dlg.close();
      if (editSlot < 0) { if (hit) addHit(hit); return; }
      const st = match.state, n = st.turn.length, idx = turnDarts.length - n + editSlot;
      const r = match.replaceAt(editSlot, hit); if (!r) return;
      if (hit) Caller.dart(hit, settings.each);
      if (useCam && idx >= 0 && turnDarts[idx]) { if (hit) turnDarts[idx].score = hit; else turnDarts.splice(idx, 1); }
      render(); afterDart(r); if (!hit) setStatus(t('removed'));
    }
  });
  function openKeypad(slot) {
    editSlot = slot >= 0 && slot < match.state.turn.length ? slot : -1;
    if (editSlot < 0 && match.state.awaitNext) return setStatus(t('turnFull'), 'take');
    $('#kp-dlg [data-k=X]').hidden = editSlot < 0; $('#kp-dlg [data-k="0"]').classList.toggle('span4', editSlot < 0);
    kpDlg.reset(); dlg.showModal();
  }
  dlg.addEventListener('close', () => kpDlg.reset());
  function undoDart() { match.undo(); turnDarts.pop(); render(); setStatus(t('undone')); if (useCam) Vision.resetReference(false); Pair.send({ t: 'reset' }); }
  $('#slots').addEventListener('click', (e) => {
    const s = e.target.closest('.slot[data-s]'); if (!s) return;
    if (!useCam && s.classList.contains('empty')) return; // bez kamery wpisuje się klawiaturą poniżej
    openKeypad(+s.dataset.s);
  });
  $('#a-manual').onclick = () => openKeypad(-1);
  $('#a-miss').onclick = () => addHit(Board.fromLabel('0'));
  $('#a-undo').onclick = undoDart;
  $('#a-next').onclick = next;
  $('#g-menu').onclick = () => { $('#m-recal').hidden = !useCam; $('#dlg-menu').showModal(); };
  $('#m-save').onclick = () => { $('#dlg-menu').close(); saveGame(); home(); toast(t('gameSaved')); };
  $('#m-recal').onclick = () => { $('#dlg-menu').close(); Vision.stop(); keepMatch = true; openCamera(); }; // ta sama gra po kalibracji
  $('#m-restart').onclick = () => { $('#dlg-menu').close(); if (useCam) Vision.setCalibration(calPts, vw, vh); startMatch(useCam); };
  $('#m-end').onclick = () => { $('#dlg-menu').close(); home(); };
  function toast(txt) {
    let el = $('#toast'); if (!el) { el = document.createElement('div'); el.id = 'toast'; el.className = 'toast'; document.body.appendChild(el); }
    el.textContent = txt; el.classList.add('on'); clearTimeout(el._t); el._t = setTimeout(() => el.classList.remove('on'), 3200);
  }

  function endGame() {
    Vision.stop(); localStorage.removeItem('dart.match'); dropSaved();
    $('#end-title').textContent = t('winsTitle', { n: match.state.winner });
    $('#end-table').innerHTML = `<table><tr><th>${esc(t('colPlayer'))}</th><th>${esc(t('colScore'))}</th><th></th></tr>${match.view().map(r => `<tr><td>${esc(r.name)}</td><td>${r.big}</td><td class="muted">${r.sub}</td></tr>`).join('')}</table>`;
    $('#dlg-end').showModal();
  }
  $('#end-again').onclick = () => { $('#dlg-end').close(); if (useCam) Vision.setCalibration(calPts, vw, vh); startMatch(useCam); };
  $('#end-new').onclick = () => { $('#dlg-end').close(); wizard(0); };

  // ---------- PAROWANIE ----------
  const dlgPair = $('#dlg-pair');
  function pairState() {
    const ok = Pair.connected() && Pair.role === 'host';
    $('#pair-state').textContent = t(ok ? 'paired' : 'notPaired');
    $('#pair-state').className = 'small ' + (ok ? 'paired' : 'muted');
    $('#pair-host').textContent = t(ok ? 'pairAgain' : 'pairBtn');
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
    dlgPair.showModal(); $('#pair-title').textContent = t('pairBtn');
    pairView(t('pairPrep'));
    try {
      const code = await Pair.host();
      pairView(t('pairHost'), { qr: code, scanBtn: true });
      $('#pair-scan').onclick = async () => {
        pairView(t('pairScanOther'));
        try { await Pair.hostAccept(await readCode()); pairView(t('pairConnecting')); } catch (e) { pairView(t('pairFail', { x: esc(e.message) })); }
      };
    } catch (e) { pairView(t('pairPrepFail', { x: esc(e.message) })); }
  };
  async function joinAsRemote() {
    dlgPair.showModal(); $('#pair-title').textContent = t('secondCam');
    pairView(t('pairJoin'));
    try {
      const answer = await Pair.join(await readCode());
      pairView(t('pairShow'), { qr: answer });
    } catch (e) { pairView(t('pairFail', { x: esc(e.message) })); }
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
      $('#r-conn').textContent = t('disconnected'); $('#r-conn').className = 'pill static warn';
      $('#g-pair').textContent = '';
    }
  });

  // ---------- DRUGA KAMERA ----------
  let remoteDarts = [];
  const rc = $('#remote-canvas'), rctx = rc.getContext('2d');
  function startRemote() {
    show('scr-remote'); $('#r-conn').textContent = t('connected'); $('#r-conn').className = 'pill static ok';
    Vision.start(onRemoteVision); remoteLoop();
  }
  function onRemoteVision(ev) {
    const pill = $('#r-cam');
    if (ev.type === 'ready' || ev.type === 'clear') { pill.textContent = t('camReady'); pill.className = 'pill ok'; }
    if (ev.type === 'moving') { pill.textContent = t('moving'); pill.className = 'pill warn'; }
    if (ev.type === 'dart') { remoteDarts.push(ev.dart); Pair.send({ t: 'dart', b: ev.dart.board, ts: Date.now() }); $('#r-status').textContent = t('sent', { x: lbl(ev.dart.score.label) }); pill.textContent = t('camReady'); pill.className = 'pill ok'; }
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
      rctx.fillStyle = '#fff'; rctx.font = 'bold 13px system-ui'; rctx.fillText(lbl(d.score.label), x + 10, y - 8); });
    requestAnimationFrame(remoteLoop);
  }
  function renderRemoteView(m) {
    $('#r-board').innerHTML = (m.rows || []).map(r => `<div class="ps${r.active ? ' active' : ''}"><span class="nm">${esc(r.name)}</span><span class="big">${r.big}</span><span class="sub">${r.sub}</span></div>`).join('');
    $('#r-status').textContent = (m.status || '') + (m.turn && m.turn.length ? ' · ' + m.turn.join(' ') : '');
  }
  $('#r-recal').onclick = () => { Vision.stop(); openCamera('remote'); };
  $('#r-leave').onclick = () => { Pair.close(); home(); };

  // wysokość aplikacji = faktycznie widoczny obszar (Android potrafi po starcie podać wysokość razem z paskiem nawigacji)
  function fitHeight() {
    const hs = [window.innerHeight, document.documentElement.clientHeight];
    if (window.visualViewport) hs.push(Math.round(visualViewport.height * visualViewport.scale));
    const h = Math.min(...hs.filter(x => x > 100));
    if (isFinite(h)) document.documentElement.style.setProperty('--app-h', h + 'px');
  }
  ['resize', 'orientationchange', 'pageshow', 'focus'].forEach(ev => window.addEventListener(ev, () => { fitHeight(); setTimeout(fitHeight, 250); }));
  if (window.visualViewport) visualViewport.addEventListener('resize', fitHeight);
  document.addEventListener('visibilitychange', () => setTimeout(fitHeight, 100));
  [0, 100, 400, 1000, 2500].forEach(ms => setTimeout(fitHeight, ms));

  // ekran nie gaśnie w trakcie gry
  async function requestWake() { try { await navigator.wakeLock.request('screen'); } catch {} }
  document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'visible' && cameraOn) requestWake(); });

  const dev = ['localhost', '127.0.0.1'].includes(location.hostname);
  if ('serviceWorker' in navigator) {
    if (dev) navigator.serviceWorker.getRegistrations().then(rs => rs.forEach(r => r.unregister()));
    else navigator.serviceWorker.register('sw.js').catch(() => {});
  }

  // ---------- wznowienie po odświeżeniu / ponownym otwarciu / z zapisu ----------
  async function resumeCamera() {
    keepMatch = true; calMode = 'host';
    show('scr-camera'); $('#cal-msg').textContent = t('resuming'); $('#cal-ok').disabled = true;
    try {
      const d = await Vision.startCamera(video); vw = d.w; vh = d.h; cameraOn = true;
      const savedCal = store.get('cal', null);
      if (!savedCal || savedCal.vw !== vw || savedCal.vh !== vh) return openCamera(); // trzeba skalibrować, gra zostaje
      calPts = savedCal.pts; recomputeH();
      await lockNow(); Vision.setCalibration(calPts, vw, vh); requestWake();
      keepMatch = false; startMatch(true, true);
      setStatus(t('resumed', { n: curName() }) + (cfg.cams === 'two' ? t('secondLost') : ''));
    } catch { keepMatch = false; startMatch(false, true); setStatus(t('resumedNoCam')); }
  }
  function restore() {
    $$('.screen').forEach(s => s.hidden = true);
    const ses = store.get('session', null), saved = store.get('match', null);
    if (!ses) return home();
    calMode = ses.calMode || 'host';
    if (ses.screen === 'scr-new') return wizard(ses.step || 0);
    if (ses.screen === 'scr-remote' || calMode === 'remote') {
      home(); $('#home-remote').classList.add('warn'); $('#home-remote-sub').textContent = t('remoteLost'); return;
    }
    if ((ses.screen === 'scr-play' || ses.screen === 'scr-camera') && saved) {
      match = Games.Match(saved.kind, saved.players, saved.opts, saved); savedId = ses.savedId || null;
      if (ses.screen === 'scr-camera' || ses.useCam) return resumeCamera();
      startMatch(false, true); return setStatus(t('resumed', { n: curName() }));
    }
    if (ses.screen === 'scr-camera') return launch(); // kalibracja nowej gry
    home();
  }
  I18N.apply(); $$('.ver').forEach(e => e.textContent = t('version', { v: VERSION })); $('#recent').dataset.label = t('recentPlayed');
  restore();
})();
