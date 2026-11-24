import { SPOTS } from './scene.js';

// Placeholder kitty for now: a sleepy loaf that hops between the four spots.
// (Stage 2 replaces this with the real kitty that walks, stretches, grooms, etc.)
const FUR = '#3A3345', FUR_HI = '#5A4F6C', FUR_LO = '#2A2432', EAR_IN = '#CD9FA0';

export const cat = { spot: 'bed', x: SPOTS.bed.x, y: SPOTS.bed.y, k: SPOTS.bed.k, from: null, to: null, t: 1 };

export function moveTo(name) {
  if (name === cat.spot && cat.t >= 1) return;
  cat.from = { x: cat.x, y: cat.y, k: cat.k }; cat.to = SPOTS[name]; cat.spot = name; cat.t = 0;
}

export function update(dt) {
  if (cat.t >= 1) return;
  cat.t = Math.min(1, cat.t + dt / 1.0);
  const e = cat.t * cat.t * (3 - 2 * cat.t);
  cat.x = cat.from.x + (cat.to.x - cat.from.x) * e;
  cat.k = cat.from.k + (cat.to.k - cat.from.k) * e;
  cat.y = cat.from.y + (cat.to.y - cat.from.y) * e - Math.sin(cat.t * Math.PI) * 26 * cat.k; // little hop
}

export function drawCat(ctx, rr, time) {
  const x = Math.round(cat.x), y = Math.round(cat.y), k = cat.k;
  const r = (dx, dy, w, h, col) => rr(x + Math.round(dx * k), y + Math.round(dy * k), Math.max(1, Math.round(w * k)), Math.max(1, Math.round(h * k)), col);
  r(-15, -1, 30, 2, 'rgba(42,34,48,0.28)');              // soft shadow
  r(-14, -9, 28, 9, FUR); r(-12, -12, 24, 3, FUR); r(-8, -13, 14, 1, FUR); // loaf body
  r(-12, -12, 18, 1, FUR_HI); r(-14, -2, 28, 2, FUR_LO);                       // rim light + belly shade
  r(4, -14, 11, 12, FUR); r(5, -15, 9, 1, FUR); r(5, -15, 9, 1, FUR_HI); // head
  r(4, -19, 3, 5, FUR); r(12, -19, 3, 5, FUR); r(5, -18, 1, 3, EAR_IN); r(13, -18, 1, 3, EAR_IN); // ears
  r(6, -10, 3, 1, '#14111A'); r(11, -10, 3, 1, '#14111A'); r(9, -8, 2, 1, EAR_IN); // closed eyes + nose
  r(-18, -5, 5, 4, FUR); r(-20, -3, 4, 3, FUR); r(-20, -2, 2, 1, FUR_HI);   // tail
  r(1, -3, 6, 3, FUR_HI);                                                              // paws tucked
  if (cat.t >= 1) { // slow floating z's while asleep
    const ph = (time / 2.6) % 1;
    ctx.fillStyle = `rgba(248,204,170,${1 - ph})`;
    const zx = x + Math.round((14 + ph * 6) * k), zy = y - Math.round((24 + ph * 12) * k);
    ctx.fillRect(zx, zy, 4, 1); ctx.fillRect(zx + 3, zy + 1, 1, 1); ctx.fillRect(zx + 2, zy + 2, 1, 1); ctx.fillRect(zx + 1, zy + 3, 1, 1); ctx.fillRect(zx, zy + 4, 4, 1);
  }
}
