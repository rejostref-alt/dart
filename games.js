// Zasady gier. Każda gra: init(players, opts) -> state; dart(state, hit) -> {msg, turnOver, gameOver}; view(state) -> wiersze tablicy.
'use strict';
const Games = (() => {
  const clone = (o) => JSON.parse(JSON.stringify(o));

  // ---------- podpowiedź zejścia (X01, ostatnia rzutka na podwójne/bull) ----------
  const ALL = [];
  for (let n = 20; n >= 1; n--) ALL.push({ l: 'T' + n, v: 3 * n, d: false });
  for (let n = 20; n >= 1; n--) ALL.push({ l: 'D' + n, v: 2 * n, d: true });
  ALL.push({ l: 'BULL', v: 50, d: true }, { l: '25', v: 25, d: false });
  for (let n = 20; n >= 1; n--) ALL.push({ l: String(n), v: n, d: false });
  // ulubione podwójne na zejście (kolejność preferencji) i rzutki ustawiające
  const PREF = [20, 16, 8, 18, 12, 10, 4, 14, 6, 2, 19, 17, 15, 13, 11, 9, 7, 5, 3, 1];
  const DOUBLES = PREF.map(n => ({ l: 'D' + n, v: 2 * n, d: true })).concat([{ l: 'BULL', v: 50, d: true }]);
  const SETUP = [];
  for (let n = 20; n >= 1; n--) SETUP.push({ l: String(n), v: n });
  SETUP.push({ l: '25', v: 25 });
  for (let n = 20; n >= 1; n--) SETUP.push({ l: 'T' + n, v: 3 * n });
  SETUP.push({ l: 'BULL', v: 50 });
  const FIRST = SETUP.filter(x => x.l[0] === 'T').concat(SETUP.filter(x => x.l[0] !== 'T'));
  const checkoutCache = {};
  function checkout(rest, darts, doubleOut) {
    const key = rest + ':' + darts + ':' + doubleOut;
    if (key in checkoutCache) return checkoutCache[key];
    let res = null;
    const finals = doubleOut ? DOUBLES : ALL;
    outer: for (let k = 1; k <= darts; k++) {
      if (k === 1) { const f = finals.find(x => x.v === rest); if (f) { res = [f.l]; break; } continue; }
      if (k === 2) { for (const f of finals) { const a = SETUP.find(x => x.v === rest - f.v); if (a) { res = [a.l, f.l]; break outer; } } continue; }
      for (const f of finals) for (const a of FIRST) { const b = SETUP.find(x => x.v === rest - f.v - a.v); if (b) { res = [a.l, b.l, f.l]; break outer; } }
    }
    return (checkoutCache[key] = res);
  }

  // ---------- X01 ----------
  const X01 = {
    name: (o) => `${o.start}${o.doubleOut ? ' double out' : ''}`,
    init(players, o) {
      return { kind: 'x01', o, players: players.map(n => ({ name: n, rest: o.start, legs: 0, sets: 0, darts: 0, scored: 0, opened: !o.doubleIn })),
        cur: 0, legStarter: 0, turn: [], turnStartRest: o.start, leg: 1, set: 1, done: false };
    },
    dart(s, hit) {
      const p = s.players[s.cur], o = s.o;
      if (s.turn.length === 0) s.turnStartRest = p.rest;
      s.turn.push(hit); p.darts++;
      if (!p.opened) { if (hit.mult === 2) p.opened = true; else return this._after(s, t('needDoubleIn')); }
      const left = p.rest - hit.value;
      const bust = left < 0 || (o.doubleOut && left === 1) || (left === 0 && o.doubleOut && hit.mult !== 2);
      if (bust) {
        p.scored -= (s.turnStartRest - p.rest); p.rest = s.turnStartRest;
        return { msg: 'BUST!', turnOver: true, bust: true };
      }
      p.rest = left; p.scored += hit.value;
      if (left === 0) return this._legWon(s);
      return this._after(s);
    },
    _after(s, msg) { return { msg, turnOver: s.turn.length >= 3 }; },
    _legWon(s) {
      const p = s.players[s.cur], o = s.o; p.legs++;
      let msg = t('wonLeg', { n: p.name }), gameOver = false;
      if (o.sets > 1) {
        if (p.legs >= o.legs) { p.sets++; s.players.forEach(q => q.legs = 0); msg = t('wonSet', { n: p.name }); s.set++; }
        if (p.sets >= o.sets) gameOver = true;
      } else if (p.legs >= o.legs) gameOver = true;
      if (gameOver) { s.done = true; s.winner = p.name; return { msg: t('wonMatch', { n: p.name }), turnOver: true, gameOver: true, x01: true }; }
      s.leg++; s.players.forEach(q => { q.rest = o.start; q.opened = !o.doubleIn; });
      s.legStarter = (s.legStarter + 1) % s.players.length; s.nextOverride = s.legStarter;
      return { msg, turnOver: true, legOver: true };
    },
    view(s) {
      return s.players.map((p, i) => {
        const avg = p.darts ? (p.scored / p.darts * 3) : 0, co = p.rest <= 170 ? checkout(p.rest, 3, s.o.doubleOut) : null;
        return { name: p.name, big: p.rest, sub: t('avg', { x: avg.toFixed(1) }) + (s.o.legs > 1 || s.o.sets > 1 ? ' · ' + t('legsN', { n: p.legs }) : '') + (s.o.sets > 1 ? ' · ' + t('setsN', { n: p.sets }) : ''),
          hint: i === s.cur && co ? co.join(' · ') : '', active: i === s.cur };
      });
    },
    header(s) { return t('x01Header', { s: s.o.start, l: s.leg }) + (s.o.sets > 1 ? t('setN', { n: s.set }) : '') + t('toLegs', { n: s.o.legs, w: t(s.o.legs > 1 ? 'legWn' : 'legW1') }) + (s.o.sets > 1 ? t('setsHdr', { n: s.o.sets }) : ''); }
  };

  // ---------- Cricket ----------
  const CR = [20, 19, 18, 17, 16, 15, 25];
  const Cricket = {
    name: () => 'Cricket',
    init(players, o) { return { kind: 'cricket', o, players: players.map(n => ({ name: n, marks: Object.fromEntries(CR.map(k => [k, 0])), pts: 0 })), cur: 0, turn: [], round: 1, done: false }; },
    dart(s, hit) {
      s.turn.push(hit);
      const p = s.players[s.cur];
      if (CR.includes(hit.num) && hit.mult > 0) {
        let m = hit.mult;
        while (m-- > 0) {
          if (p.marks[hit.num] < 3) p.marks[hit.num]++;
          else if (s.players.some(q => q !== p && q.marks[hit.num] < 3)) p.pts += hit.num;
        }
      }
      const closedAll = CR.every(k => p.marks[k] >= 3);
      if (closedAll && s.players.every(q => q === p || p.pts >= q.pts)) { s.done = true; s.winner = p.name; return { msg: t('wins', { n: p.name }), turnOver: true, gameOver: true }; }
      return { turnOver: s.turn.length >= 3 };
    },
    view(s) {
      const sym = (m) => m >= 3 ? 'Ⓧ' : m === 2 ? 'X' : m === 1 ? '/' : '·';
      return s.players.map((p, i) => ({ name: p.name, big: p.pts, sub: CR.map(k => `${k === 25 ? 'B' : k}${sym(p.marks[k])}`).join(' '), active: i === s.cur }));
    },
    header: (s) => 'Cricket · ' + t('roundN', { n: s.round })
  };

  // ---------- Around the Clock (po kolei) ----------
  const ATC = {
    name: () => t('atcName'),
    init(players, o) { return { kind: 'atc', o, players: players.map(n => ({ name: n, target: 1, darts: 0 })), cur: 0, turn: [], round: 1, done: false }; },
    dart(s, hit) {
      s.turn.push(hit); const p = s.players[s.cur]; p.darts++;
      if (hit.num === p.target && hit.mult > 0) {
        const step = s.o.multSkip ? hit.mult : 1;
        if (p.target === 25) { s.done = true; s.winner = p.name; return { msg: t('wins', { n: p.name }), turnOver: true, gameOver: true }; }
        p.target = p.target + step > 20 ? 25 : p.target + step;
      }
      return { turnOver: s.turn.length >= 3 };
    },
    view: (s) => s.players.map((p, i) => ({ name: p.name, big: p.target === 25 ? 'Bull' : p.target, sub: t('atcSub', { n: p.darts }), active: i === s.cur })),
    header: (s) => t('gAtc') + ' · ' + t('roundN', { n: s.round })
  };

  // ---------- Shanghai ----------
  const Shanghai = {
    name: (o) => t('shName', { n: o.rounds }),
    init(players, o) { return { kind: 'shanghai', o, players: players.map(n => ({ name: n, pts: 0 })), cur: 0, turn: [], round: 1, done: false }; },
    dart(s, hit) {
      s.turn.push(hit); const p = s.players[s.cur];
      if (hit.num === s.round) p.pts += hit.value;
      if (s.turn.length === 3) {
        const m = new Set(s.turn.filter(h => h.num === s.round).map(h => h.mult));
        if (m.has(1) && m.has(2) && m.has(3)) { s.done = true; s.winner = p.name; return { msg: t('shanghaiWin', { n: p.name }), turnOver: true, gameOver: true }; }
      }
      return { turnOver: s.turn.length >= 3 };
    },
    onRoundEnd(s) {
      if (s.round >= s.o.rounds) { const w = [...s.players].sort((a, b) => b.pts - a.pts)[0]; s.done = true; s.winner = w.name; return t('wins', { n: w.name }); }
      return null;
    },
    view: (s) => s.players.map((p, i) => ({ name: p.name, big: p.pts, sub: t('shSub', { n: s.round }), active: i === s.cur })),
    header: (s) => 'Shanghai · ' + t('roundOf', { n: s.round, m: s.o.rounds })
  };

  // ---------- High Score ----------
  const High = {
    name: (o) => t('hiName', { n: o.rounds }),
    init(players, o) { return { kind: 'high', o, players: players.map(n => ({ name: n, pts: 0 })), cur: 0, turn: [], round: 1, done: false }; },
    dart(s, hit) { s.turn.push(hit); s.players[s.cur].pts += hit.value; return { turnOver: s.turn.length >= 3 }; },
    onRoundEnd: Shanghai.onRoundEnd,
    view: (s) => s.players.map((p, i) => ({ name: p.name, big: p.pts, sub: t('hiSub', { x: (p.pts / Math.max(1, s.round - (i >= s.cur ? 1 : 0) || 1)).toFixed(1) }), active: i === s.cur })),
    header: (s) => 'High Score · ' + t('roundOf', { n: s.round, m: s.o.rounds })
  };

  const ENGINES = { x01: X01, cricket: Cricket, atc: ATC, shanghai: Shanghai, high: High };

  // ---------- mecz: tury, historia do cofania ----------
  function Match(kind, players, opts, saved) {
    const E = ENGINES[kind];
    let s = saved ? saved.s : E.init(players, opts); const hist = saved && saved.hist ? saved.hist : [];
    // historia kolejek do wyświetlenia na ekranie gry (część stanu – działa z cofaniem i zapisem)
    function logTurn(pre, r) {
      const p = s.players[s.cur], x01 = s.kind === 'x01';
      s.log = s.log || [];
      s.log.push({ p: s.cur, d: s.turn.map(h => h.label), sum: s.turnBust ? 0 : s.turn.reduce((a, h) => a + h.value, 0), bust: !!s.turnBust,
        tag: x01 ? (s.o.legs > 1 || s.o.sets > 1 ? 'L' + pre.leg : '') : 'R' + (pre.round || 1),
        rest: x01 ? (r.legOver || r.gameOver ? 0 : p.rest) : null });
      if (s.log.length > 200) s.log.shift();
      s.turnBust = false;
    }
    return {
      get state() { return s; }, engine: E,
      dump() { return { kind, players, opts, s, hist: hist.slice(-80) }; }, // do zapisu – gra przetrwa odświeżenie strony
      dart(hit) {
        if (s.done || s.awaitNext) return null;
        hist.push(clone(s));
        const pre = { leg: s.leg, round: s.round };
        const r = E.dart(s, hit) || {};
        if (r.bust) s.turnBust = true;
        if (r.turnOver) { s.awaitNext = true; logTurn(pre, r); }
        s.lastMsg = r.msg || '';
        return r;
      },
      nextPlayer() { // po wyjęciu lotek
        if (s.done) return null;
        hist.push(clone(s));
        if (!s.awaitNext && s.turn.length) logTurn({ leg: s.leg, round: s.round }, {}); // „Dalej” przed 3. rzutką
        s.awaitNext = false; s.turn = [];
        let msg = null;
        if (s.nextOverride != null) { s.cur = s.nextOverride; s.nextOverride = null; }
        else {
          s.cur = (s.cur + 1) % s.players.length;
          if (s.cur === 0) { if (E.onRoundEnd) msg = E.onRoundEnd(s); if (!s.done) s.round = (s.round || 1) + 1; }
        }
        s.lastMsg = msg || '';
        return msg;
      },
      undo() { if (hist.length) s = hist.pop(); },
      replaceAt(i, hit) { // korekta dowolnej rzutki bieżącej kolejki (hit = null → usuń rzutkę)
        const n = s.turn.length; if (i < 0 || i >= n || hist.length < n - i) return null;
        const later = s.turn.slice(i + 1);
        for (let k = 0; k < n - i; k++) s = hist.pop();
        s.awaitNext = false;
        let r = {};
        for (const h of (hit ? [hit] : []).concat(later)) { if (s.done || s.awaitNext) break; r = this.dart(h) || r; }
        return r;
      },
      replaceLast(hit) { // korekta ostatniej rzutki
        if (!s.turn.length || !hist.length) return;
        s = hist.pop(); s.awaitNext = false;
        return this.dart(hit);
      },
      view() { return E.view(s); }, header() { return E.header(s); }, title() { return E.name(s.o); }
    };
  }

  return { Match, checkout, ENGINES };
})();
