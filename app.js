'use strict';
(() => {
  const $ = (s) => document.querySelector(s), $$ = (s) => [...document.querySelectorAll(s)];
  const store = { get(k, d) { try { const v = localStorage.getItem('dart.' + k); return v ? JSON.parse(v) : d; } catch { return d; } },
                  set(k, v) { try { localStorage.setItem('dart.' + k, JSON.stringify(v)); } catch {} } };
  const show = (id) => { $$('.screen').forEach(s => s.hidden = s.id !== id); };

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
  $('#cal-ok').onclick = () => { store.set('cal', { vw, vh, pts: calPts }); Vision.setCalibration(calPts, vw, vh); startMatch(true); };

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

  function setStatus(t, cls) { const s = $('#status'); s.textContent = t; s.className = 'status' + (cls ? ' ' + cls : ''); }
  function render() {
    const st = match.state;
    $('#g-header').textContent = match.header();
    $('#board-view').innerHTML = match.view().map(r => `<div class="ps${r.active ? ' active' : ''}"><span class="nm">${r.name}</span><span class="big">${r.big}</span>
      <span class="sub">${r.sub}</span>${r.hint ? `<span class="hint">Zejście: ${r.hint}</span>` : ''}</div>`).join('');
    const t = st.turn || [], sum = t.reduce((a, h) => a + h.value, 0);
    $('#slots').innerHTML = [0, 1, 2].map(i => t[i] ? `<div class="slot" data-s="${i}">${t[i].label}</div>` : `<div class="slot empty" data-s="${i}">rzutka ${i + 1}</div>`).join('') + `<div class="slot sum">${sum}</div>`;
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
  }

  function onVision(ev) {
    const pill = $('#cam-state'), st = match && match.state;
    if (ev.type === 'ready') { pill.textContent = 'Kamera gotowa'; pill.className = 'pill ok'; }
    if (ev.type === 'moving') { pill.textContent = 'Ruch…'; pill.className = 'pill warn'; }
    if (ev.type === 'clear') { pill.textContent = 'Kamera gotowa'; pill.className = 'pill ok'; }
    if (ev.type === 'dart') {
      pill.textContent = 'Kamera gotowa'; pill.className = 'pill ok';
      if (st && st.awaitNext) { next(); return; } // po pełnej kolejce zmiana obrazu = wyjmowanie lotek
      turnDarts.push(ev.dart); addHit(ev.dart.score, true);
    }
    if (ev.type === 'big') {
      if (st && (st.awaitNext || ev.nearEmpty)) { ev.accept(); if (st.awaitNext) next(); turnDarts = []; }
      else { pill.textContent = 'Coś zasłania tarczę'; pill.className = 'pill warn'; }
    }
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
  $('#a-undo').onclick = () => { match.undo(); turnDarts.pop(); render(); setStatus('Cofnięto'); if (useCam) Vision.resetReference(false); };
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
