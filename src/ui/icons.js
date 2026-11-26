// Small coloured pixel icons, drawn in code as crisp SVG rectangles (11x11 grids). Placeholders until illustrated icons are supplied.
const PAL = { o: '#5a3a4a', y: '#f5c542', Y: '#e8a35e', g: '#7fb069', G: '#4f8a4f', p: '#f4a6b8', P: '#d9748a', w: '#ffffff', b: '#8ec5f0', B: '#5b8fd0', c: '#e9eef8', r: '#d9534f', v: '#b9a0e0', n: '#3b3f7a', m: '#fbe7a1', R: '#b9452c', k: '#9aa3bd' };
const ICONS = {
  spring: ['...........', '...pp.pp...', '..pPPpPPp..', '...pPyPp...', '..pPpyPpP..', '...pPyPp...', '..pPPpPPp..', '...pp.pp...', '.....g.....', '....gG.....', '...........'],
  summer: ['.....y.....', '.y...y...y.', '..y.yyy.y..', '...yyyyy...', 'yy.yyyyy.yy', '...yyyyy...', '..y.yyy.y..', '.y...y...y.', '.....y.....', '...........', '...........'],
  autumn: ['.....R.....', '....RYR....', '..R.RYR.R..', '..RRYYYRR..', '...RYYYR...', '..RRYYYRR..', '.RYYYYYYYR.', '...RYYYR...', '.....R.....', '.....R.....', '...........'],
  winter: ['.....b.....', '..b..b..b..', '...b.b.b...', '....bbb....', '.bbbbwbbbb.', '....bbb....', '...b.b.b...', '..b..b..b..', '.....b.....', '...........', '...........'],
  clear: ['...........', '..bbbbbbb..', '.bbbbbbbbb.', '.bbbyybbbb.', '.bbyyyybbb.', '.bbbyybbbb.', '.bbbbbbbbb.', '.bbbbbbbbb.', '..bbbbbbb..', '...........', '...........'],
  cloudy: ['...........', '....ccc....', '...ccccc.c.', '.cc.ccccccc', 'ccccccccccc', 'ccccccccccc', '.kkkkkkkkk.', '...........', '...........', '...........', '...........'],
  rain: ['...........', '....kkk....', '...kkkkk.k.', '.kk.kkkkkkk', 'kkkkkkkkkkk', '.kkkkkkkkk.', '..B..B..B..', '.B..B..B...', '..B..B..B..', '...........', '...........'],
  snow: ['...........', '....ccc....', '...ccccc.c.', '.cc.ccccccc', 'ccccccccccc', '.kkkkkkkkk.', '..w..w..w..', '....w..w...', '..w..w..w..', '...........', '...........'],
  morning: ['...........', '...........', '.....y.....', '..y.yyy.y..', '...yyyyy...', 'YYYYYYYYYYY', '...........', '..YYYYYYY..', '...........', '...........', '...........'],
  afternoon: ['...........', '.....y.....', '..y..y..y..', '...yyyyy...', '.yyyyyyyyy.', '...yyyyy...', '..y..y..y..', '.....y.....', '...........', '...........', '...........'],
  dusk: ['...........', '...........', '....PPP....', '..P.PPP.P..', '...PPPPP...', 'vvvvvvvvvvv', '...........', '.vvvvvvvvv.', '...........', '...........', '...........'],
  night: ['...........', '...mmmm....', '..mmm......', '.mmm...w...', '.mmm.......', '.mmm.......', '..mmm...w..', '...mmmm....', '...........', '...........', '...........'],
  auto: ['...........', '...ooooo...', '..o..o..o..', '.o...o...o.', '.o...ooo.o.', '.o.......o.', '..o.....o..', '...ooooo...', '...........', '...........', '...........'],
};
export const pixelIcon = (name, scale = 3) => {
  const rows = ICONS[name], w = rows[0].length, h = rows.length;
  const rects = rows.flatMap((r, y) => [...r].map((c, x) => (c === '.' ? '' : `<rect x="${x}" y="${y}" width="1" height="1" fill="${PAL[c] || '#000'}"/>`))).join('');
  return `<svg class="pxi" width="${w * scale}" height="${h * scale}" viewBox="0 0 ${w} ${h}" shape-rendering="crispEdges" aria-hidden="true">${rects}</svg>`;
};
