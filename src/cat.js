import { SPOTS } from './scene.js';

// Placeholder kitty for stage 1: a sleepy loaf that hops between the four spots.
// (Stage 2 replaces this with the real kitty that walks, stretches, grooms, etc.)
const FUR = '#3A3345', FUR_HI = '#4F4660', EAR_IN = '#CD9FA0';

export const cat = { spot: 'bed', x: SPOTS.bed.x, y: SPOTS.bed.y, from: null, to: null, t: 1 };

export function moveTo(name) {
  if (name === cat.spot && cat.t >= 1) return;
  cat.from = { x: cat.x, y: cat.y }; cat.to = SPOTS[name]; cat.spot = name; cat.t = 0;
}

export function update(dt) {
  if (cat.t >= 1) return;
  cat.t = Math.min(1, cat.t + dt / 0.9);
  const e = cat.t * cat.t * (3 - 2 * cat.t);
  cat.x = cat.from.x + (cat.to.x - cat.from.x) * e;
  cat.y = cat.from.y + (cat.to.y - cat.from.y) * e - Math.sin(cat.t * Math.PI) * 16; // little hop
}

export function drawCat(ctx, r, time) {
  const x = Math.round(cat.x), y = Math.round(cat.y);
  r(x - 8, y - 6, 16, 6, FUR); r(x - 7, y - 7, 14, 1, FUR); r(x - 7, y - 6, 12, 1, FUR_HI);   // loaf body
  r(x + 3, y - 9, 7, 7, FUR); r(x + 3, y - 10, 2, 2, FUR); r(x + 8, y - 10, 2, 2, FUR);      // head + ears
  r(x + 4, y - 9, 1, 1, EAR_IN); r(x + 9, y - 9, 1, 1, EAR_IN);
  r(x + 5, y - 6, 2, 1, '#1F1B26'); r(x + 8, y - 6, 2, 1, '#1F1B26');                        // closed eyes
  r(x - 10, y - 3, 3, 3, FUR); r(x - 11, y - 2, 2, 2, FUR);                                   // tail
  if (cat.t >= 1) { // slow floating z's while asleep
    const k = (time / 2.4) % 1;
    ctx.fillStyle = `rgba(248,204,170,${1 - k})`;
    ctx.fillRect(x + 10 + Math.round(k * 4), y - 14 - Math.round(k * 8), 2, 1);
    ctx.fillRect(x + 11 + Math.round(k * 4), y - 13 - Math.round(k * 8), 1, 1);
    ctx.fillRect(x + 10 + Math.round(k * 4), y - 12 - Math.round(k * 8), 2, 1);
  }
}
