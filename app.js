'use strict';
(() => {
  const $ = (s) => document.querySelector(s), $$ = (s) => [...document.querySelectorAll(s)];
  const store = { get(k, d) { try { const v = localStorage.getItem('dart.' + k); return v ? JSON.parse(v) : d; } catch { return d; } },
                  set(k, v) { try { localStorage.setItem('dart.' + k, JSON.stringify(v)); } catch {} } };
  const show = (id) => { $$('.screen').forEach(s => s.hidden = s.id !== id); };
  const VERSION = '3'; // przy każdej aktualizacji podbić też CACHE w sw.js (dart-v3 itd.)
  $$('.ver').forEach(e => e.textContent = 'wersja ' + VERSION);

  // ---------- 1. ustawienia ----------
  let players = store.get('players', ['Gracz 1', 'Gracz 2']), kind = store.get('kind', 'x01');
  for (let i = 1; i <= 11; i += 1) $('#o-legs').insertAdjacentHTML('beforeend', `<option ${i === 1 ? 'selected' : ''}>${i}</option>`);
  for (let i = 1; i <= 7; i++) $('#o-sets').insertAdjacentHTML('beforeend', `<option>${i}</option>`);
  const savedOpts = store.get('opts', null);
  if (savedOpts) { $('#o-start').value = savedOpts.start; $('#o-legs').value = savedOpts.legs; $('#o-sets').value = savedOpts.sets; $('#o-dout').checked = savedOpts.doubleOut; $('#o-din').checked = savedOpts.doubleIn; }

  function renderPlayers() {
    $('#players').innerHTML = players.map((p, i) => `<div class="player-row"><input type="text" value="${p.replace(/"/g, '&quot;')}" data-i="${i}" aria-label="Gracz ${i + 1}">
      <button class="btn ghost" data-del="${i}" aria-label="Usuń gracza" ${players.length < 2 ? 'disabled' : ''}>✕</button></div>`).join('');
  }
  $('#players').addEventListener('input', (e) => { if (e.target.dataset.i) players[+e.target.dataset.i] = e.target.value; });
  $('#players').addEventListener('click', (e) => { const d = e.target.dataset.del; if (d != null) { players.splice(+d, 1); renderPlayers(); } });
  $('#add-player').onclick = () => { if (players.length < 8) { players.push('Gracz ' + (players.length + 1)); renderPlayers(); } };
  function setKind(k) { kind = k; $$('#game-kind button').forEach(b => b.classList.toggle('on', b.dataset.k === k)); $$('.opts').forEach(o => o.hidden = o.id !== 'opts-' + k); }
  $('#game-kind').onclick = (e) => { if (e.target.dataset.k) setKind(e.target.dataset.k); };
  renderPlayers(); setKind(kind);

  function gameOpts() {
    if (kind === 'x01') return { start: +$('#o-start').value, legs: +$('#o-legs').value, sets: +$('#o-sets').value, doubleOut: $('#o-dout').checked, doubleIn: $('#o-din').checked };
    if (kind === 'atc') return { multSkip: $('#o-skip').checked };
    if (kind === 'shanghai') return { rounds: +$('#o-sh-rounds').value };
    if (kind === 'high') return { rounds: +$('#o-hi-rounds').value };
    return {};
  }
  function saveSetup() { players = players.map(p => p.trim() || 'Gracz'); store.set('players', players); store.set('kind', kind); if (kind === 'x01') store.set('opts', gameOpts()); }

  // ---------- 2. kamera i kalibracja ----------
  const video = $('#video'), ov = $('#overlay'), octx = ov.getContext('2d');
  let calPts = [], vw = 0, vh = 0, Hb2i = null, cameraOn = false, dragIdx = -1;
  const CAL_TXT = ['środek pola 20 (góra)', 'środek pola 6 (prawo)', 'środek pola 3 (dół)', 'środek pola 11 (lewo)'];

  function fit(boxW, boxH) { const s = Math.min(boxW / vw, boxH / vh); return { s, ox: (boxW - vw * s) / 2, oy: (boxH - vh * s) / 2 }; }
  function toVideo(ev) { const r = ov.getBoundingClientRect(), f = fit(r.width, r.height); return [(ev.clientX - r.left - f.ox) / f.s, (ev.clientY - r.top - f.oy) / f.s]; }
  function calMsg() {
    if (calPts.length < 4) $('#cal-msg').innerHTML = `Kalibracja ${calPts.length + 1}/4: dotknij <b>zewnętrzną krawędź podwójnego pola</b> – ${CAL_TXT[calPts.length]}.`;
    else $('#cal-msg').innerHTML = 'Sprawdź, czy siatka pokrywa się z tarczą. Możesz przeciągać punkty palcem. Potem <b>Start gry</b> (tarcza bez lotek).';
    $('#cal-ok').disabled = calPts.length < 4;
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
    if (!cameraOn || $('#scr-camera').hidden) return;
    const r = ov.getBoundingClientRect(); ov.width = r.width * devicePixelRatio; ov.height = r.height * devicePixelRatio;
    octx.setTransform(devicePixelRatio, 0, 0, devicePixelRatio, 0, 0); octx.clearRect(0, 0, r.width, r.height);
    if (vw) {
      const f = fit(r.width, r.height);
      if (Hb2i) drawWire(octx, Hb2i, f, 0.9);
      calPts.forEach(([x, y], i) => { octx.beginPath(); octx.arc(f.ox + x * f.s, f.oy + y * f.s, 11, 0, 7); octx.fillStyle = 'rgba(242,193,78,.35)'; octx.fill(); octx.lineWidth = 2; octx.strokeStyle = '#f2c14e'; octx.stroke();
        octx.fillStyle = '#fff'; octx.font = 'bold 12px system-ui'; octx.fillText(Board.CAL[i].n, f.ox + x * f.s + 14, f.oy + y * f.s - 12); });
    }
    requestAnimationFrame(calLoop);
  }
  ov.addEventListener('pointerdown', (e) => {
    if (!vw) return; const p = toVideo(e);
    if (calPts.length < 4) { calPts.push(p); recomputeH(); calMsg(); return; }
    const r = ov.getBoundingClientRect(), f = fit(r.width, r.height);
    let best = -1, bd = 40 / f.s; calPts.forEach((q, i) => { const d = Math.hypot(q[0] - p[0], q[1] - p[1]); if (d < bd) { bd = d; best = i; } });
    dragIdx = best; if (best >= 0) ov.setPointerCapture(e.pointerId);
  });
  ov.addEventListener('pointermove', (e) => { if (dragIdx >= 0) { calPts[dragIdx] = toVideo(e); recomputeH(); } });
  ov.addEventListener('pointerup', () => { dragIdx = -1; });

  async function openCamera() {
    show('scr-camera'); $('#cal-msg').textContent = 'Uruchamiam kamerę…';
    try {
      const d = await Vision.startCamera(video); vw = d.w; vh = d.h; cameraOn = true;
      await Vision.unlockCamera(); // w trakcie kalibracji autofokus działa normalnie
      const saved = store.get('cal', null);
      calPts = saved && saved.vw === vw && saved.vh === vh ? saved.pts : [];
      recomputeH(); calMsg(); requestWake(); calLoop();
    } catch (err) {
      $('#cal-msg').innerHTML = 'Nie mam dostępu do kamery. Zezwól na kamerę w przeglądarce albo wybierz <b>Nagranie testowe</b>. (' + err.message + ')';
    }
  }
  $('#cal-file').onchange = async (e) => { const f = e.target.files[0]; if (!f) return; const d = await Vision.useVideoFile(video, f); vw = d.w; vh = d.h; cameraOn = true; calPts = []; recomputeH(); calMsg(); calLoop(); };
  $('#cal-reset').onclick = () => { calPts = []; recomputeH(); calMsg(); };
  $('#cal-back').onclick = () => { Vision.stop(); show('scr-setup'); };
  $('#cal-ok').onclick = async () => {
    store.set('cal', { vw, vh, pts: calPts });
    $('#cal-ok').disabled = true; $('#cal-msg').innerHTML = 'Ustawiam ostrość na środek tarczy i ją blokuję… nie ruszaj telefonu.';
    const lock = await Vision.lockCamera(Vision.apply(Hb2i, 0, 0));
    const txt = lock.focus === 'zablokowana' ? '🔒 Ostrość zablokowana' : lock.focus === 'ustawiona raz' ? '🔒 Ostrość ustawiona (bez autofokusu)' : '⚠ Telefon nie pozwala zablokować ostrości';
    $('#cam-lock').textContent = txt + (lock.exposure ? ' · ekspozycja ✓' : '') + (lock.wb ? ' · balans bieli ✓' : '');
    $('#cal-ok').disabled = false;
    Vision.setCalibration(calPts, vw, vh);
    if (Pair.role === 'remote' && Pair.connected()) { $('#r-lock').textContent = $('#cam-lock').textContent; return startRemote(); }
    startMatch(true);
    if (lock.focus === 'brak') setStatus('Ten telefon nie pozwala aplikacji zablokować ostrości – unikaj stania przed kamerą przy wyjmowaniu lotek', 'take');
  };

  // ---------- 3. gra ----------
  let match = null, useCam = false, turnDarts = [], editSlot = -1, voice = store.get('voice', true);
  const pc = $('#play-canvas'), pctx = pc.getContext('2d');
  $('#m-voice').checked = voice; $('#m-voice').onchange = (e) => { voice = e.target.checked; store.set('voice', voice); };
  $('#m-sens').value = 78 - Vision.cfg.diffThr; // suwak: w prawo = czulej
  $('#m-sens').oninput = (e) => { Vision.cfg.diffThr = 78 - +e.target.value; };

  function say(t) { if (!voice || !window.speechSynthesis) return; const u = new SpeechSynthesisUtterance(t); u.lang = 'pl-PL'; speechSynthesis.cancel(); speechSynthesis.speak(u); }
  function speakHit(h) { return h.mult === 0 ? 'pudło' : h.num === 25 ? (h.mult === 2 ? 'bull' : 'dwadzieścia pięć') : (h.mult === 3 ? 'potrójne ' : h.mult === 2 ? 'podwójne ' : '') + h.num; }

  function startMatch(withCam) {
    saveSetup(); useCam = withCam;
    match = Games.Match(kind, players.slice(), gameOpts()); turnDarts = [];
    show('scr-play'); $('#play-stage').hidden = !withCam;
    $('#g-title').textContent = match.title();
    if (withCam) { Vision.start(onVision); playLoop(); }
    render(); setStatus(`${match.state.players[match.state.cur].name} – rzucaj!`);
  }
  $('#go-camera').onclick = openCamera;
  $('#go-manual').onclick = () => startMatch(false);

  function setStatus(t, cls) { const s = $('#status'); s.textContent = t; s.className = 'status' + (cls ? ' ' + cls : ''); mirror(); }
  function render() {
    const st = match.state;
    $('#g-header').textContent = match.header();
    $('#board-view').innerHTML = match.view().map(r => `<div class="ps${r.active ? ' active' : ''}"><span class="nm">${r.name}</span><span class="big">${r.big}</span>
      <span class="sub">${r.sub}</span>${r.hint ? `<span class="hint">Zejście: ${r.hint}</span>` : ''}</div>`).join('');
    const t = st.turn || [], sum = t.reduce((a, h) => a + h.value, 0);
    $('#slots').innerHTML = [0, 1, 2].map(i => t[i] ? `<div class="slot" data-s="${i}">${t[i].label}</div>` : `<div class="slot empty" data-s="${i}">rzutka ${i + 1}</div>`).join('') + `<div class="slot sum">${sum}</div>`;
    mirror();
  }
  function mirror() { // podgląd wyników na drugiej kamerze
    if (Pair.role === 'host' && Pair.connected() && match) Pair.send({ t: 'view', rows: match.view(), turn: (match.state.turn || []).map(h => h.label), status: $('#status').textContent });
  }

  function addHit(hit, fromCam) {
    if (!match || match.state.done) return;
    if (match.state.awaitNext) { setStatus('Wyjmij lotki albo naciśnij „Następny gracz”', 'take'); return; }
    const r = match.dart(hit); if (!r) return;
    say(speakHit(hit)); render();
    afterDart(r);
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
    Pair.send({ t: 'reset' }); // druga kamera zapamiętuje pustą tarczę jako tło
  }

  function onVision(ev) {
    const pill = $('#cam-state'), st = match && match.state;
    if (ev.type === 'ready') { pill.textContent = 'Kamera gotowa'; pill.className = 'pill ok'; }
    if (ev.type === 'moving') { pill.textContent = 'Ruch…'; pill.className = 'pill warn'; }
    if (ev.type === 'clear') { pill.textContent = 'Kamera gotowa'; pill.className = 'pill ok'; }
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

  // ---------- łączenie rzutek z dwóch kamer ----------
  // ta sama rzutka zwykle pojawia się w obu kamerach w odstępie < 1,5 s: wtedy uśredniamy położenie
  let pend = null;
  function commitDart(board, img, both) {
    const score = Board.score(board[0], board[1]);
    if (!img && Hb2i) img = Vision.apply(Hb2i, board[0], board[1]);
    turnDarts.push({ img: img || [0, 0], board, score, both });
    addHit(score, true);
  }
  function candidate(src, board, img) {
    if (!match || match.state.done || match.state.awaitNext) return;
    if (!Pair.connected() || Pair.role !== 'host') return commitDart(board, img);
    if (pend && pend.src !== src) {
      clearTimeout(pend.t); const p = pend; pend = null;
      return commitDart([(p.board[0] + board[0]) / 2, (p.board[1] + board[1]) / 2], src === 'local' ? img : p.img, true);
    }
    if (pend) { clearTimeout(pend.t); const p = pend; pend = null; commitDart(p.board, p.img); }
    pend = { src, board, img, t: setTimeout(() => { const p = pend; pend = null; if (p) commitDart(p.board, p.img); }, 1500) };
  }

  function playLoop() {
    if ($('#scr-play').hidden || !useCam) return;
    const r = pc.getBoundingClientRect(); pc.width = r.width * devicePixelRatio; pc.height = r.height * devicePixelRatio;
    pctx.setTransform(devicePixelRatio, 0, 0, devicePixelRatio, 0, 0);
    const f = fit(r.width, r.height); pctx.fillStyle = '#000'; pctx.fillRect(0, 0, r.width, r.height);
    if (video.readyState >= 2) pctx.drawImage(video, f.ox, f.oy, vw * f.s, vh * f.s);
    if (Hb2i) drawWire(pctx, Hb2i, f, 0.45);
    const n = (match && match.state.turn.length) || 0;
    turnDarts.slice(-n).forEach((d) => { const x = f.ox + d.img[0] * f.s, y = f.oy + d.img[1] * f.s;
      pctx.beginPath(); pctx.arc(x, y, 7, 0, 7); pctx.fillStyle = '#e2453c'; pctx.fill(); pctx.strokeStyle = '#fff'; pctx.lineWidth = 2; pctx.stroke();
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
    else if (editSlot >= 0 && editSlot < st.turn.length) { setStatus('Poprawić można ostatnią rzutkę – albo cofnij kolejne', 'take'); }
    else addHit(hit, false);
  }
  $('#dlg-svg').addEventListener('click', (e) => {
    const svg = e.currentTarget.querySelector('svg'), pt = svg.createSVGPoint(); pt.x = e.clientX; pt.y = e.clientY;
    const p = pt.matrixTransform(svg.getScreenCTM().inverse());
    chooseHit(Board.score(p.x, -p.y));
  });
  $$('[data-q]').forEach(b => b.onclick = () => chooseHit(Board.fromLabel(b.dataset.q)));
  $$('[data-close]').forEach(b => b.onclick = () => b.closest('dialog').close());
  $('#slots').addEventListener('click', (e) => { const s = e.target.closest('.slot[data-s]'); if (s) openBoard(+s.dataset.s); });

  $('#a-manual').onclick = () => openBoard(-1);
  $('#a-miss').onclick = () => addHit(Board.fromLabel('0'), false);
  $('#a-undo').onclick = () => { match.undo(); turnDarts.pop(); render(); setStatus('Cofnięto'); if (useCam) Vision.resetReference(false); Pair.send({ t: 'reset' }); };
  $('#a-next').onclick = next;
  $('#g-menu').onclick = () => $('#dlg-menu').showModal();
  $('#m-recal').onclick = () => { $('#dlg-menu').close(); Vision.stop(); openCamera(); };
  $('#m-reset').onclick = () => { $('#dlg-menu').close(); Vision.resetReference(true); setStatus('Zapamiętano tło tarczy'); };
  $('#m-new').onclick = () => { $('#dlg-menu').close(); Vision.stop(); show('scr-setup'); };

  function endGame() {
    Vision.stop();
    const rows = match.view();
    $('#end-title').textContent = `🏆 ${match.state.winner} wygrywa!`;
    $('#end-table').innerHTML = `<table><tr><th>Gracz</th><th>Wynik</th><th></th></tr>${rows.map(r => `<tr><td>${r.name}</td><td>${r.big}</td><td class="muted">${r.sub}</td></tr>`).join('')}</table>`;
    $('#dlg-end').showModal();
  }
  $('#end-again').onclick = () => { $('#dlg-end').close(); if (useCam) Vision.setCalibration(calPts, vw, vh); startMatch(useCam); };
  $('#end-new').onclick = () => { $('#dlg-end').close(); show('scr-setup'); };

  // ---------- parowanie dwóch telefonów ----------
  const dlgPair = $('#dlg-pair');
  function pairState(txt, ok) {
    $('#pair-state').textContent = txt; $('#pair-state').className = 'small ' + (ok ? 'paired' : 'muted');
    $('#g-pair').textContent = ok && Pair.role === 'host' ? '🔗 2 kamery' : ''; $('#g-pair').className = 'small paired';
  }
  function pairView(step, { qr, scanBtn } = {}) {
    $('#pair-step').innerHTML = step;
    $('#pair-qr').hidden = !qr; $('#pair-scan').hidden = !scanBtn; $('#pair-manual').hidden = true; $('#pair-video').hidden = true;
    if (qr) QR.toCanvas(qr, $('#pair-qr'));
  }
  async function readCode() { // skan kodu QR z ekranu drugiego telefonu
    if (Pair.canScan()) { $('#pair-video').hidden = false; try { return await Pair.scan($('#pair-video')); } finally { $('#pair-video').hidden = true; } }
    $('#pair-manual').hidden = false;
    return new Promise(res => { $('#pair-text-ok').onclick = () => res($('#pair-text').value); });
  }
  $('#pair-host').onclick = async () => {
    dlgPair.showModal(); $('#pair-title').textContent = 'Paruj drugi telefon';
    pairView('Przygotowuję kod… Upewnij się, że oba telefony są w tej samej sieci Wi‑Fi (np. hotspot z jednego z nich).');
    try {
      const code = await Pair.host();
      pairView('<b>Krok 1/2.</b> Na drugim telefonie otwórz aplikację, wybierz <b>„Ten telefon to druga kamera”</b> i zeskanuj ten kod.<br>Gdy drugi telefon pokaże swój kod, naciśnij przycisk poniżej.', { qr: code, scanBtn: true });
      $('#pair-scan').onclick = async () => {
        pairView('<b>Krok 2/2.</b> Skieruj aparat na kod wyświetlony na drugim telefonie.');
        try { await Pair.hostAccept(await readCode()); pairView('Łączę telefony…'); }
        catch (e) { pairView('Nie udało się: ' + e.message + '. Spróbuj od nowa.'); }
      };
    } catch (e) { pairView('Nie udało się przygotować parowania: ' + e.message); }
  };
  $('#pair-join').onclick = async () => {
    dlgPair.showModal(); $('#pair-title').textContent = 'Druga kamera';
    pairView('<b>Krok 1/2.</b> Skieruj aparat na kod wyświetlony na <b>głównym telefonie</b>.');
    try {
      const answer = await Pair.join(await readCode());
      pairView('<b>Krok 2/2.</b> Pokaż ten kod głównemu telefonowi – tam naciśnij <b>„Skanuj kod z drugiego telefonu”</b>.', { qr: answer });
    } catch (e) { pairView('Nie udało się: ' + e.message + '. Spróbuj od nowa.'); }
  };
  $('#pair-cancel').onclick = () => { Pair.stopScan(); dlgPair.close(); if (!Pair.connected()) Pair.close(); };

  Pair.on((m) => {
    if (Pair.role === 'host') { if (m.t === 'dart' && match && !$('#scr-play').hidden) candidate('remote', m.b, null); return; }
    if (m.t === 'reset') { Vision.resetReference(false); remoteDarts = []; }
    if (m.t === 'view') renderRemoteView(m);
  }, (s) => {
    if (s === 'connected') {
      Pair.stopScan(); dlgPair.close();
      if (Pair.role === 'host') { pairState('🔗 Druga kamera połączona', true); mirror(); }
      else { pairState('🔗 Połączono z głównym telefonem', true); openCamera(); }
    } else {
      pairState('Rozłączono – sparuj ponownie', false);
      $('#r-conn').textContent = 'Rozłączono'; $('#r-conn').className = 'pill warn';
    }
  });

  // tryb drugiej kamery: wykrywa rzutki i wysyła je do głównego telefonu
  let remoteDarts = [];
  const rc = $('#remote-canvas'), rctx = rc.getContext('2d');
  function startRemote() {
    show('scr-remote'); $('#r-conn').textContent = 'Połączono'; $('#r-conn').className = 'pill ok';
    Vision.start(onRemoteVision); remoteLoop();
  }
  function onRemoteVision(ev) {
    const pill = $('#r-cam');
    if (ev.type === 'ready' || ev.type === 'clear') { pill.textContent = 'Kamera gotowa'; pill.className = 'pill ok'; }
    if (ev.type === 'moving') { pill.textContent = 'Ruch…'; pill.className = 'pill warn'; }
    if (ev.type === 'dart') { remoteDarts.push(ev.dart); Pair.send({ t: 'dart', b: ev.dart.board, ts: Date.now() }); $('#r-status').textContent = 'Wysłano: ' + ev.dart.score.label; pill.textContent = 'Kamera gotowa'; pill.className = 'pill ok'; }
    if (ev.type === 'big') ev.accept(); // o kolejce decyduje główny telefon
  }
  function remoteLoop() {
    if ($('#scr-remote').hidden) return;
    const r = rc.getBoundingClientRect(); rc.width = r.width * devicePixelRatio; rc.height = r.height * devicePixelRatio;
    rctx.setTransform(devicePixelRatio, 0, 0, devicePixelRatio, 0, 0);
    const f = fit(r.width, r.height); rctx.fillStyle = '#000'; rctx.fillRect(0, 0, r.width, r.height);
    if (video.readyState >= 2) rctx.drawImage(video, f.ox, f.oy, vw * f.s, vh * f.s);
    if (Hb2i) drawWire(rctx, Hb2i, f, 0.45);
    remoteDarts.slice(-3).forEach(d => { const x = f.ox + d.img[0] * f.s, y = f.oy + d.img[1] * f.s;
      rctx.beginPath(); rctx.arc(x, y, 7, 0, 7); rctx.fillStyle = '#2f7fe2'; rctx.fill(); rctx.strokeStyle = '#fff'; rctx.lineWidth = 2; rctx.stroke();
      rctx.fillStyle = '#fff'; rctx.font = 'bold 13px system-ui'; rctx.fillText(d.score.label, x + 10, y - 8); });
    requestAnimationFrame(remoteLoop);
  }
  function renderRemoteView(m) {
    $('#r-board').innerHTML = (m.rows || []).map(r => `<div class="ps${r.active ? ' active' : ''}"><span class="nm">${r.name}</span><span class="big">${r.big}</span><span class="sub">${r.sub}</span></div>`).join('');
    $('#r-status').textContent = (m.status || '') + (m.turn && m.turn.length ? ' · ' + m.turn.join(' ') : '');
  }
  $('#r-recal').onclick = () => { Vision.stop(); openCamera(); };
  $('#r-leave').onclick = () => { Vision.stop(); Pair.close(); pairState('Nie sparowano', false); show('scr-setup'); };

  // ekran nie gaśnie w trakcie gry
  let wake = null;
  async function requestWake() { try { wake = await navigator.wakeLock.request('screen'); } catch {} }
  document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'visible' && cameraOn) requestWake(); });

  const dev = ['localhost', '127.0.0.1'].includes(location.hostname);
  if ('serviceWorker' in navigator) {
    if (dev) navigator.serviceWorker.getRegistrations().then(rs => rs.forEach(r => r.unregister()));
    else navigator.serviceWorker.register('sw.js').catch(() => {});
  }
})();
