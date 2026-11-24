import { SPOTS } from './scene.js';

// Placeholder kitty for now: a sleepy loaf that hops between the four spots.
// (Stage 2 replaces this with the real kitty that walks, stretches, grooms, etc.)
const FUR = '#3A3345', FUR_HI = '#5A4F6C', FUR_LO = '#2A2432', EAR_IN = '#CD9FA0';

export const cat = { spot: 'bed', x: SPOTS.bed.x, y: SPOTS.bed.y, from: null, to: null, t: 1 };

export function moveTo(name) {
  if (name === cat.spot && cat.t >= 1) return;
  cat.from = { x: cat.x, y: cat.y }; cat.to = SPOTS[name]; cat.spot = name; cat.t = 0;
}

export function update(dt) {
  if (cat.t >= 1) return;
  cat.t = Math.min(1, cat.t + dt / 1.0);
  const e = cat.t * cat.t * (3 - 2 * cat.t);
  cat.x = cat.from.x + (cat.to.x - cat.from.x) * e;
  cat.y = cat.from.y + (cat.to.y - cat.from.y) * e - Math.sin(cat.t * Math.PI) * 26; // little hop
}

export function drawCat(ctx, r, time) {
  const x = Math.round(cat.x), y = Math.round(cat.y);
  ctx.fillStyle = 'rgba(42,34,48,0.28)'; ctx.fillRect(x - 15, y - 1, 30, 2);              // soft shadow
  r(x - 14, y - 9, 28, 9, FUR); r(x - 12, y - 12, 24, 3, FUR); r(x - 8, y - 13, 14, 1, FUR); // loaf body
  r(x - 12, y - 12, 18, 1, FUR_HI); r(x - 14, y - 2, 28, 2, FUR_LO);                       // rim light + belly shade
  r(x + 4, y - 14, 11, 12, FUR); r(x + 5, y - 15, 9, 1, FUR); r(x + 5, y - 15, 9, 1, FUR_HI); // head
  r(x + 4, y - 19, 3, 5, FUR); r(x + 12, y - 19, 3, 5, FUR); r(x + 5, y - 18, 1, 3, EAR_IN); r(x + 13, y - 18, 1, 3, EAR_IN); // ears
  r(x + 6, y - 10, 3, 1, '#14111A'); r(x + 11, y - 10, 3, 1, '#14111A'); r(x + 9, y - 8, 2, 1, EAR_IN); // closed eyes + nose
  r(x - 18, y - 5, 5, 4, FUR); r(x - 20, y - 3, 4, 3, FUR); r(x - 20, y - 2, 2, 1, FUR_HI);   // tail
  r(x + 1, y - 3, 6, 3, FUR_HI);                                                              // paws tucked
  if (cat.t >= 1) { // slow floating z's while asleep
    const k = (time / 2.6) % 1;
    ctx.fillStyle = `rgba(248,204,170,${1 - k})`;
    const zx = x + 14 + Math.round(k * 6), zy = y - 24 - Math.round(k * 12);
    ctx.fillRect(zx, zy, 4, 1); ctx.fillRect(zx + 3, zy + 1, 1, 1); ctx.fillRect(zx + 2, zy + 2, 1, 1); ctx.fillRect(zx + 1, zy + 3, 1, 1); ctx.fillRect(zx, zy + 4, 4, 1);
  }
}
