// Geometria tarczy stalowej (wymiary w mm, środek = 0,0; oś y w górę) i liczenie punktów.
'use strict';
const Board = (() => {
  const R = { bullIn: 6.35, bullOut: 15.9, trebleIn: 99, trebleOut: 107, doubleIn: 162, doubleOut: 170 };
  // kolejność pól zgodnie z ruchem wskazówek zegara, od góry
  const ORDER = [20, 1, 18, 4, 13, 6, 10, 15, 2, 17, 3, 19, 7, 16, 8, 11, 14, 9, 12, 5];

  // kąt środka pola (stopnie, 0 = w prawo, przeciwnie do wskazówek)
  function segAngle(n) { const i = ORDER.indexOf(n); return 90 - i * 18; }

  // wynik dla punktu na tarczy
  function score(x, y) {
    const r = Math.hypot(x, y);
    if (r <= R.bullIn) return { mult: 2, num: 25, value: 50, label: 'BULL' };
    if (r <= R.bullOut) return { mult: 1, num: 25, value: 25, label: '25' };
    if (r > R.doubleOut) return { mult: 0, num: 0, value: 0, label: 'Pudło' };
    let a = Math.atan2(y, x) * 180 / Math.PI; // -180..180
    let fromTop = (90 - a + 360 + 9) % 360;     // 0 = początek pola 20
    const num = ORDER[Math.floor(fromTop / 18) % 20];
    let mult = 1;
    if (r >= R.trebleIn && r <= R.trebleOut) mult = 3;
    else if (r >= R.doubleIn) mult = 2;
    return { mult, num, value: num * mult, label: (mult === 3 ? 'T' : mult === 2 ? 'D' : '') + num };
  }

  function fromLabel(label) {
    label = String(label).toUpperCase().trim();
    if (label === 'BULL' || label === 'DB' || label === '50') return { mult: 2, num: 25, value: 50, label: 'BULL' };
    if (label === '25' || label === 'SB') return { mult: 1, num: 25, value: 25, label: '25' };
    if (label === '0' || label === 'PUDŁO' || label === 'M') return { mult: 0, num: 0, value: 0, label: 'Pudło' };
    const m = label.match(/^([SDT]?)(\d{1,2})$/);
    if (!m) return null;
    const num = +m[2]; if (num < 1 || num > 20) return null;
    const mult = m[1] === 'T' ? 3 : m[1] === 'D' ? 2 : 1;
    return { mult, num, value: num * mult, label: (mult === 3 ? 'T' : mult === 2 ? 'D' : '') + num };
  }

  // punkty kalibracyjne: zewnętrzna krawędź pola podwójnego, środek pól 20, 6, 3, 11
  const CAL = [20, 6, 3, 11].map(n => {
    const a = segAngle(n) * Math.PI / 180;
    return { n, x: Math.cos(a) * R.doubleOut, y: Math.sin(a) * R.doubleOut };
  });

  // linie tarczy (w mm) do rysowania nakładki na obrazie z kamery
  function wireframe() {
    const circles = [R.bullIn, R.bullOut, R.trebleIn, R.trebleOut, R.doubleIn, R.doubleOut].map(r => {
      const pts = []; for (let i = 0; i <= 72; i++) { const a = i / 72 * 2 * Math.PI; pts.push([Math.cos(a) * r, Math.sin(a) * r]); }
      return pts;
    });
    const spokes = [];
    for (let i = 0; i < 20; i++) {
      const a = (90 - 9 - i * 18) * Math.PI / 180;
      spokes.push([[Math.cos(a) * R.bullOut, Math.sin(a) * R.bullOut], [Math.cos(a) * R.doubleOut, Math.sin(a) * R.doubleOut]]);
    }
    const labels = ORDER.map(n => { const a = segAngle(n) * Math.PI / 180; return { n, x: Math.cos(a) * 190, y: Math.sin(a) * 190 }; });
    return { circles, spokes, labels };
  }

  // tarcza SVG do ręcznego wpisywania (klik = punkt na tarczy)
  function svg(size) {
    const s = 200, k = (v) => v.toFixed(2);
    const P = (r, deg) => [Math.cos(deg * Math.PI / 180) * r, -Math.sin(deg * Math.PI / 180) * r];
    let h = `<svg viewBox="${-s} ${-s} ${2 * s} ${2 * s}" width="${size}" height="${size}" class="board-svg" aria-label="Tarcza – dotknij, aby wpisać trafienie">`;
    h += `<circle r="${s}" fill="#111"/>`;
    const ring = (r1, r2, a1, a2, fill) => {
      const [x1, y1] = P(r2, a1), [x2, y2] = P(r2, a2), [x3, y3] = P(r1, a2), [x4, y4] = P(r1, a1);
      return `<path d="M${k(x1)} ${k(y1)} A${r2} ${r2} 0 0 1 ${k(x2)} ${k(y2)} L${k(x3)} ${k(y3)} A${r1} ${r1} 0 0 0 ${k(x4)} ${k(y4)}Z" fill="${fill}"/>`;
    };
    ORDER.forEach((n, i) => {
      const a1 = 90 + 9 - i * 18, a2 = a1 - 18, dark = i % 2 === 0;
      h += ring(R.trebleOut, R.doubleIn, a1, a2, dark ? '#1b1b1b' : '#efe3c4');
      h += ring(R.bullOut, R.trebleIn, a1, a2, dark ? '#1b1b1b' : '#efe3c4');
      h += ring(R.doubleIn, R.doubleOut, a1, a2, dark ? '#d3312f' : '#1f8f4e');
      h += ring(R.trebleIn, R.trebleOut, a1, a2, dark ? '#d3312f' : '#1f8f4e');
      const [lx, ly] = P(186, segAngle(n));
      h += `<text x="${k(lx)}" y="${k(ly)}" class="board-num">${n}</text>`;
    });
    h += `<circle r="${R.bullOut}" fill="#1f8f4e"/><circle r="${R.bullIn}" fill="#d3312f"/>`;
    h += `<g class="board-marks"></g></svg>`;
    return h;
  }

  return { R, ORDER, score, fromLabel, CAL, wireframe, svg, segAngle };
})();
