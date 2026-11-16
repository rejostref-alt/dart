// Tłumaczenia PL/EN. t('klucz', {zmienne}) – w tekście {n}, {x} itd.
'use strict';
const I18N = (() => {
  const D = {
    pl: {
      appName: 'Dart Licznik', settings: 'Ustawienia', close: 'Zamknij', back: 'Wstecz', version: 'wersja {v}', offline: 'działa offline',
      heroTitle: 'Gotowy do gry?', heroSub: 'Telefon na statywie liczy punkty za Ciebie. Działa bez internetu.',
      newGame: 'Nowa gra', playAgain: '↻ Zagraj ponownie: {x}', or: 'lub',
      savedTile: 'Zapisane gry', savedTileSub: '{n} do dokończenia – dotknij, aby wybrać',
      remoteTile: 'Dołącz jako druga kamera', remoteTileSub: 'Ten telefon stanie z boku tarczy i pomoże liczyć', remoteLost: 'Połączenie przerwane – dotknij, aby dołączyć ponownie',
      chooseGame: 'Wybierz grę', g501sub: 'Zejdź do zera', g301sub: 'Krótsza wersja', gCricketSub: 'Pola 15–20 i bull', gAtc: 'Po kolei', gAtcSub: '1 → 20 → bull', gShSub: 'Runda = cel', gHiSub: 'Najwięcej punktów',
      start: 'Start', legsToWin: 'Legi do wygrania', setsToWin: 'Sety do wygrania', doubleOutSub: 'kończ na podwójnym', doubleInSub: 'zacznij od podwójnego',
      atcSkip: 'Podwójne i potrójne przeskakują', atcSkipSub: 'o 2 / 3 pola', rounds: 'Liczba rund',
      cricketInfo: 'Zamknij pola 15–20 i bull (po 3 trafienia). Punkty zdobywasz na polach zamkniętych przez siebie, a jeszcze otwartych u rywali.',
      whoPlays: 'Kto gra?', addPlayer: '+ Dodaj gracza', recentPlayed: 'Ostatnio grali:', player: 'Gracz', playerN: 'Gracz {n}', removePlayer: 'Usuń gracza',
      cameras: 'Kamery', cam1: '1 kamera', cam1sub: 'Telefon na statywie z przodu tarczy', cam2: '2 kamery', cam2sub: 'Drugi telefon z boku – dokładniej przy ciasnych rzutkach', cam0: 'Bez kamery', cam0sub: 'Wpisuję trafienia klawiaturą',
      twoInfo: 'Oba telefony w tej samej sieci Wi‑Fi – wystarczy hotspot z jednego z nich, internet nie jest potrzebny.',
      pairBtn: 'Połącz drugi telefon', pairAgain: 'Połącz ponownie', notPaired: 'Nie połączono', paired: '🔗 Druga kamera połączona',
      next: 'Dalej', startGame: 'Start gry', nextCalib: 'Dalej: kalibracja kamery',
      calib: 'Kalibracja', calReset: 'Od nowa', camStarting: 'Uruchamiam kamerę…', resuming: 'Wznawiam grę…',
      calStep: '<b>{n} / 4</b> · Dotknij zewnętrzną krawędź podwójnego pola – {x}',
      cal20: 'środek pola 20 (góra)', cal6: 'środek pola 6 (prawo)', cal3: 'środek pola 3 (dół)', cal11: 'środek pola 11 (lewo)',
      calDone: 'Siatka pokrywa tarczę? Punkty możesz przeciągać palcem. Wyjmij lotki i naciśnij <b>Start</b>.',
      calStartRemote: 'Start – wysyłaj rzutki', camDenied: 'Brak dostępu do kamery. Zezwól aplikacji na aparat w ustawieniach telefonu. ({x})',
      locking: 'Ustawiam ostrość na środek tarczy i ją blokuję… nie ruszaj telefonu.',
      lockOk: '🔒 Ostrość zablokowana', lockOnce: '🔒 Ostrość ustawiona', lockNo: '⚠ Bez blokady ostrości', lockExp: ' · ekspozycja', lockWb: ' · balans bieli',
      camera: 'Kamera', camReady: 'Kamera gotowa', moving: 'Ruch…', blocked: 'Coś zasłania tarczę', twoCams: '🔗 2 kamery',
      history: 'Historia kolejek', historyEmpty: 'Tu pojawią się kolejne kolejki', dartN: 'rzutka {n}', fixDartN: 'Popraw rzutkę {n}', checkout: 'Zejście: {x}',
      kpDouble: 'podwójne', kpTreble: 'potrójne', kpBull: 'D+25 = Bull', kpUndo: 'cofnij', kpMiss: 'pudło', kpRemove: '✕ Usuń rzutkę', kpNext: 'Dalej →',
      enterHit: 'Wpisz trafienie', aManual: '✍ Wpisz', aMiss: 'Pudło', aUndo: '↶ Cofnij', aNext: 'Dalej →',
      throwNow: '{n} – rzucaj!', dartOf: '{n} – rzutka {d}', pullDarts: '{x} – wyjmij lotki', enterNext: '{x} – wpisz kolejną rzutkę lub „Dalej”', pts: '{n} pkt',
      bustCam: 'BUST! Wyjmij lotki', bustKp: 'BUST! Dalej → następny gracz', pullOrNext: 'Wyjmij lotki albo naciśnij „Dalej”', pressNext: 'Naciśnij „Dalej”',
      noT25: 'Nie ma potrójnego bulla', turnFull: 'Kolejka pełna – dotknij rzutkę, aby ją poprawić', undone: 'Cofnięto', removed: 'Usunięto rzutkę', bgSaved: 'Zapamiętano tło tarczy',
      resumed: 'Wznowiono grę – rzuca {n}', resumedNoCam: 'Wznowiono grę bez kamery', secondLost: ' (druga kamera rozłączona)',
      menuGame: 'Gra', mSave: '💾 Zapisz grę i wyjdź', mRecal: 'Kalibruj kamerę', mRestart: 'Zacznij tę grę od nowa', mEnd: 'Zakończ grę bez zapisu',
      savedTitle: 'Zapisane gry', savedEmpty: 'Brak zapisanych gier', resume: 'Graj', del: 'Usuń', gameSaved: 'Gra zapisana – wrócisz do niej z ekranu startowego',
      winsTitle: '🏆 {n} wygrywa!', colPlayer: 'Gracz', colScore: 'Wynik', rematch: 'Rewanż',
      sVoice: 'Sędzia ogłasza wyniki', sCaller: 'Głos sędziego', sAuto: 'Automatycznie (męski, jeśli jest)', sTest: '▶ Posłuchaj', sCrowd: 'Efekt hali (publiczność)', sEach: 'Ogłaszaj każdą rzutkę',
      sLang: 'Język', sLock: 'Blokuj ostrość i ekspozycję po kalibracji', sSens: 'Czułość wykrywania', sBg: 'Tarcza pusta – zapamiętaj tło', sHelp: 'Jak ustawić telefon?',
      sHelpTxt: 'Statyw z przodu tarczy, pod kątem 30–45°, 1–1,5 m od niej. Cała tarcza w kadrze, równe światło bez cieni. Przy 2 kamerach: telefony z lewej i prawej strony, lekko pod kątem.',
      sReset: 'Wyczyść zapisane dane', sensVHigh: '· bardzo wysoka', sensNorm: '· normalna', sensLow: '· niższa', sensVLow: '· niska (jasne, migające światło)',
      pairing: 'Parowanie', pairPrep: 'Przygotowuję kod…', pairHost: '<b>1.</b> Na drugim telefonie otwórz aplikację i wybierz <b>„Dołącz jako druga kamera”</b>. Zeskanuj nim ten kod.<br><b>2.</b> Gdy drugi telefon pokaże swój kod – naciśnij przycisk poniżej.',
      pairScanOther: 'Skieruj aparat na kod wyświetlony na drugim telefonie.', pairConnecting: 'Łączę telefony…', pairFail: 'Nie udało się: {x}. Spróbuj od nowa.', pairPrepFail: 'Nie udało się przygotować parowania: {x}',
      secondCam: 'Druga kamera', pairJoin: 'Skieruj aparat na kod wyświetlony na <b>głównym telefonie</b>.<br><span class="muted small">Oba telefony muszą być w tej samej sieci Wi‑Fi (np. hotspot).</span>',
      pairShow: 'Pokaż ten kod głównemu telefonowi – tam naciśnij <b>„Skanuj kod z drugiego telefonu”</b>.', pairPaste: 'Wklej kod parowania (zaczyna się od DART1:)', pairUse: 'Użyj kodu', pairScanBtn: 'Skanuj kod z drugiego telefonu',
      connected: 'Połączono', disconnected: 'Rozłączono', sent: 'Wysłano: {x}', remoteSending: 'Wysyłam rzutki do głównego telefonu', recal: 'Kalibruj ponownie', leave: 'Rozłącz', remoteTitle: '📷 Druga kamera',
      // gry
      needDoubleIn: 'Potrzebne podwójne na start', wonLeg: '{n} wygrywa lega!', wonSet: '{n} wygrywa seta!', wonMatch: '🏆 {n} wygrywa mecz!', wins: '🏆 {n} wygrywa!', shanghaiWin: '🏆 SHANGHAI! {n} wygrywa',
      avg: 'Śr. {x}', legsN: 'Legi {n}', setsN: 'Sety {n}', x01Header: '{s} · Leg {l}', setN: ' · Set {n}', toLegs: ' · do {n} {w}', legW1: 'lega', legWn: 'legów', setsHdr: ', {n} setów',
      roundN: 'runda {n}', roundOf: 'runda {n}/{m}', atcName: 'Po kolei 1–20 + Bull', atcSub: 'Cel · rzutki: {n}', target: 'Cel', shName: 'Shanghai ({n} rund)', shSub: 'Runda {n}: celuj w {n}', hiName: 'High Score ({n} rund)', hiSub: 'Śr. na kolejkę {x}',
      // sędzia
      cGameOn: 'Game on!', cRequire: '{n}, potrzebujesz {x}', cNoScore: 'Bez punktów', cBust: 'Bust!', c180a: 'Sto', c180b: 'osiemdziesiąt!', cLeg: 'Game shot! Leg dla: {n}!', cMatch: 'Game shot i mecz! {n}!', cWins: '{n} wygrywa!', cThrow: '{n}',
      cMiss: 'pudło', cBull: 'bull', c25: 'dwadzieścia pięć', cD: 'podwójne ', cT: 'potrójne '
    },
    en: {
      appName: 'Dart Counter', settings: 'Settings', close: 'Close', back: 'Back', version: 'version {v}', offline: 'works offline',
      heroTitle: 'Ready to play?', heroSub: 'A phone on a tripod keeps the score for you. No internet needed.',
      newGame: 'New game', playAgain: '↻ Play again: {x}', or: 'or',
      savedTile: 'Saved games', savedTileSub: '{n} to finish – tap to choose',
      remoteTile: 'Join as second camera', remoteTileSub: 'This phone stands beside the board and helps scoring', remoteLost: 'Connection lost – tap to join again',
      chooseGame: 'Choose a game', g501sub: 'Get down to zero', g301sub: 'Shorter version', gCricketSub: '15–20 and bull', gAtc: 'Around the clock', gAtcSub: '1 → 20 → bull', gShSub: 'Round = target', gHiSub: 'Most points',
      start: 'Start', legsToWin: 'Legs to win', setsToWin: 'Sets to win', doubleOutSub: 'finish on a double', doubleInSub: 'start on a double',
      atcSkip: 'Doubles and trebles skip', atcSkipSub: '2 / 3 numbers ahead', rounds: 'Rounds',
      cricketInfo: 'Close 15–20 and bull (3 hits each). Score points on numbers you closed that are still open for your opponents.',
      whoPlays: 'Who is playing?', addPlayer: '+ Add player', recentPlayed: 'Recently played:', player: 'Player', playerN: 'Player {n}', removePlayer: 'Remove player',
      cameras: 'Cameras', cam1: '1 camera', cam1sub: 'Phone on a tripod in front of the board', cam2: '2 cameras', cam2sub: 'Second phone at the side – more accurate with tight groupings', cam0: 'No camera', cam0sub: 'I type the scores on a keypad',
      twoInfo: 'Both phones on the same Wi‑Fi – a hotspot from one of them is enough, no internet needed.',
      pairBtn: 'Connect second phone', pairAgain: 'Connect again', notPaired: 'Not connected', paired: '🔗 Second camera connected',
      next: 'Next', startGame: 'Start game', nextCalib: 'Next: camera calibration',
      calib: 'Calibration', calReset: 'Reset', camStarting: 'Starting camera…', resuming: 'Resuming game…',
      calStep: '<b>{n} / 4</b> · Tap the outer edge of the double ring – {x}',
      cal20: 'middle of 20 (top)', cal6: 'middle of 6 (right)', cal3: 'middle of 3 (bottom)', cal11: 'middle of 11 (left)',
      calDone: 'Does the grid cover the board? You can drag the points. Remove the darts and press <b>Start</b>.',
      calStartRemote: 'Start – send darts', camDenied: 'No camera access. Allow camera for this app in phone settings. ({x})',
      locking: 'Focusing on the board centre and locking… don’t move the phone.',
      lockOk: '🔒 Focus locked', lockOnce: '🔒 Focus set', lockNo: '⚠ Focus not locked', lockExp: ' · exposure', lockWb: ' · white balance',
      camera: 'Camera', camReady: 'Camera ready', moving: 'Movement…', blocked: 'Something blocks the board', twoCams: '🔗 2 cameras',
      history: 'Turn history', historyEmpty: 'Turns will appear here', dartN: 'dart {n}', fixDartN: 'Fix dart {n}', checkout: 'Checkout: {x}',
      kpDouble: 'double', kpTreble: 'treble', kpBull: 'D+25 = Bull', kpUndo: 'undo', kpMiss: 'miss', kpRemove: '✕ Remove dart', kpNext: 'Next →',
      enterHit: 'Enter a hit', aManual: '✍ Enter', aMiss: 'Miss', aUndo: '↶ Undo', aNext: 'Next →',
      throwNow: '{n} – throw!', dartOf: '{n} – dart {d}', pullDarts: '{x} – remove darts', enterNext: '{x} – enter next dart or “Next”', pts: '{n} pts',
      bustCam: 'BUST! Remove darts', bustKp: 'BUST! Next → next player', pullOrNext: 'Remove darts or press “Next”', pressNext: 'Press “Next”',
      noT25: 'There is no treble bull', turnFull: 'Turn complete – tap a dart to fix it', undone: 'Undone', removed: 'Dart removed', bgSaved: 'Board background saved',
      resumed: 'Game resumed – {n} to throw', resumedNoCam: 'Game resumed without camera', secondLost: ' (second camera disconnected)',
      menuGame: 'Game', mSave: '💾 Save game and exit', mRecal: 'Calibrate camera', mRestart: 'Restart this game', mEnd: 'End game without saving',
      savedTitle: 'Saved games', savedEmpty: 'No saved games', resume: 'Play', del: 'Delete', gameSaved: 'Game saved – resume it from the start screen',
      winsTitle: '🏆 {n} wins!', colPlayer: 'Player', colScore: 'Score', rematch: 'Rematch',
      sVoice: 'Caller announces scores', sCaller: 'Caller voice', sAuto: 'Automatic (male if available)', sTest: '▶ Listen', sCrowd: 'Arena effect (crowd)', sEach: 'Announce every dart',
      sLang: 'Language', sLock: 'Lock focus and exposure after calibration', sSens: 'Detection sensitivity', sBg: 'Board empty – save background', sHelp: 'How to set up the phone?',
      sHelpTxt: 'Tripod in front of the board, 30–45° angle, 1–1.5 m away. Whole board in frame, even light without shadows. With 2 cameras: phones left and right, slightly angled.',
      sReset: 'Clear saved data', sensVHigh: '· very high', sensNorm: '· normal', sensLow: '· lower', sensVLow: '· low (bright, flickering light)',
      pairing: 'Pairing', pairPrep: 'Preparing code…', pairHost: '<b>1.</b> On the second phone open the app and choose <b>“Join as second camera”</b>. Scan this code with it.<br><b>2.</b> When the second phone shows its code – press the button below.',
      pairScanOther: 'Point the camera at the code shown on the second phone.', pairConnecting: 'Connecting phones…', pairFail: 'Failed: {x}. Try again.', pairPrepFail: 'Could not prepare pairing: {x}',
      secondCam: 'Second camera', pairJoin: 'Point the camera at the code shown on the <b>main phone</b>.<br><span class="muted small">Both phones must be on the same Wi‑Fi (e.g. hotspot).</span>',
      pairShow: 'Show this code to the main phone – press <b>“Scan code from second phone”</b> there.', pairPaste: 'Paste pairing code (starts with DART1:)', pairUse: 'Use code', pairScanBtn: 'Scan code from second phone',
      connected: 'Connected', disconnected: 'Disconnected', sent: 'Sent: {x}', remoteSending: 'Sending darts to the main phone', recal: 'Recalibrate', leave: 'Disconnect', remoteTitle: '📷 Second camera',
      needDoubleIn: 'Double needed to start', wonLeg: '{n} wins the leg!', wonSet: '{n} wins the set!', wonMatch: '🏆 {n} wins the match!', wins: '🏆 {n} wins!', shanghaiWin: '🏆 SHANGHAI! {n} wins',
      avg: 'Avg {x}', legsN: 'Legs {n}', setsN: 'Sets {n}', x01Header: '{s} · Leg {l}', setN: ' · Set {n}', toLegs: ' · first to {n} {w}', legW1: 'leg', legWn: 'legs', setsHdr: ', {n} sets',
      roundN: 'round {n}', roundOf: 'round {n}/{m}', atcName: 'Around the clock 1–20 + Bull', atcSub: 'Target · darts: {n}', target: 'Target', shName: 'Shanghai ({n} rounds)', shSub: 'Round {n}: aim at {n}', hiName: 'High Score ({n} rounds)', hiSub: 'Avg per turn {x}',
      cGameOn: 'Game on!', cRequire: '{n}, you require {x}', cNoScore: 'No score!', cBust: 'Bust!', c180a: 'One hundred', c180b: 'and eighty!', cLeg: 'Game shot, and the leg! {n}!', cMatch: 'Game shot, and the match! {n}!', cWins: '{n} wins!', cThrow: '{n}',
      cMiss: 'miss', cBull: 'bullseye', c25: 'twenty five', cD: 'double ', cT: 'treble '
    }
  };
  let lang = 'pl';
  try { const s = JSON.parse(localStorage.getItem('dart.settings') || '{}'); lang = s.lang || (navigator.language || 'pl').slice(0, 2); } catch {}
  if (!D[lang]) lang = 'en';
  function t(k, v = {}) { let s = (D[lang][k] ?? D.pl[k] ?? k); for (const [a, b] of Object.entries(v)) s = s.split('{' + a + '}').join(b); return s; }
  // elementy z data-i18n (tekst), data-i18n-html (HTML), data-i18n-aria, data-i18n-ph (placeholder)
  function apply(root = document) {
    root.querySelectorAll('[data-i18n]').forEach(e => e.textContent = t(e.dataset.i18n));
    root.querySelectorAll('[data-i18n-html]').forEach(e => e.innerHTML = t(e.dataset.i18nHtml));
    root.querySelectorAll('[data-i18n-aria]').forEach(e => e.setAttribute('aria-label', t(e.dataset.i18nAria)));
    root.querySelectorAll('[data-i18n-ph]').forEach(e => e.placeholder = t(e.dataset.i18nPh));
    document.documentElement.lang = lang; document.title = t('appName');
  }
  return { t, apply, get lang() { return lang; }, set lang(l) { if (D[l]) lang = l; }, speechLang: () => lang === 'pl' ? 'pl-PL' : 'en-GB' };
})();
const t = I18N.t;
