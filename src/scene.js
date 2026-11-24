import { mix, rgba } from './palette.js';

// ── a cozy, hand-drawn-feeling pixel room, seen straight on ──────────────
// Internal resolution is 480x270; main.js scales it up by whole numbers so pixels stay crisp.
// Layout: desk on the left, big window in the middle, bed on the right (both fully visible).
export const W = 480, H = 270;

export const GLASS = { x: 178, y: 26, w: 124, h: 128 };

// Where the kitty can sleep (feet position) and the clickable area around each spot.
export const SPOTS = {
  bed:  { x: 392, y: 196 },
  sill: { x: 262, y: 160 },
  desk: { x: 148, y: 188 },
  rug:  { x: 240, y: 252 },
};
export const HIT = {
  bed:  [334, 166, 130, 44],
  sill: [178, 128, 124, 32],
  desk: [118, 160, 50, 30],
  rug:  [150, 232, 180, 36],
};
export const GLOWS = { lamp: [146, 156], laptop: [46, 168], bulbs: [] };

// One small palette: Cody's dusk + berry colours, warm woods, and soft sage for plants.
const P = {
  ink: '#2A2230', night: '#302E3B', slate: '#525871', plum: '#61647C', mauve: '#857C91', blue: '#7C8DA6', sky: '#89A2BA', lilac: '#BEB3C3',
  rose: '#CD9FA0', peach: '#F2C1A3', gold: '#F8CCAA', cream: '#F2E4DB',
  woodD: '#4A3540', wood: '#6E4D52', woodM: '#946B66', woodL: '#BC8A78',
  leafD: '#34524F', leaf: '#4F7A68', leafL: '#86AA86', pot: '#B9776A',
};
const light = (c, t) => mix(c, '#FFF3E6', t);
const dark = (c, t) => mix(c, '#2A2230', t);
const hash = (x, y, s = 0) => { let h = (x * 374761393 + y * 668265263 + s * 2246822519) | 0; h = (h ^ (h >>> 13)) * 1274126177 | 0; return ((h ^ (h >>> 16)) >>> 0) / 4294967295; };
const rng = (seed) => () => (seed = (seed * 16807) % 2147483647) / 2147483647;

let ctx;
const r = (x, y, w, h, c) => { ctx.fillStyle = c; ctx.fillRect(Math.round(x), Math.round(y), w, h); };
const px = (x, y, c) => { ctx.fillStyle = c; ctx.fillRect(Math.round(x), Math.round(y), 1, 1); };
const tex = (x, y, w, h, base, alt, amt, seed = 1) => {
  if (base) r(x, y, w, h, base);
  ctx.fillStyle = alt;
  for (let j = 0; j < h; j++) for (let i = 0; i < w; i++) if (hash(x + i, y + j, seed) < amt) ctx.fillRect(x + i, y + j, 1, 1);
};
const disc = (cx, cy, rad, c) => {
  ctx.fillStyle = c;
  for (let dy = -rad; dy <= rad; dy++) {
    const w = Math.floor(Math.sqrt(rad * rad - dy * dy + 0.5));
    ctx.fillRect(Math.round(cx - w), Math.round(cy + dy), w * 2 + 1, 1);
  }
};
const ellipse = (cx, cy, rx, ry, c) => {
  ctx.fillStyle = c;
  for (let dy = -ry; dy <= ry; dy++) {
    const w = Math.floor(rx * Math.sqrt(Math.max(0, 1 - (dy * dy) / (ry * ry + 0.5))));
    ctx.fillRect(Math.round(cx - w), Math.round(cy + dy), w * 2 + 1, 1);
  }
};
const line = (x0, y0, x1, y1, c, t = 1) => {
  ctx.fillStyle = c;
  const n = Math.max(Math.abs(x1 - x0), Math.abs(y1 - y0)) || 1;
  for (let i = 0; i <= n; i++) ctx.fillRect(Math.round(x0 + ((x1 - x0) * i) / n), Math.round(y0 + ((y1 - y0) * i) / n), t, t);
};
// chunky pixel object: lit top, shaded bottom and right edge
const block = (x, y, w, h, c) => { r(x, y, w, h, c); r(x, y, w, 1, light(c, 0.35)); r(x, y + h - 1, w, 1, dark(c, 0.35)); r(x, y, 1, h, light(c, 0.12)); r(x + w - 1, y, 1, h, dark(c, 0.22)); };

// ── STATIC ROOM (drawn once) ────────────────────────────────────────────
function wallAndFloor() {
  r(0, 0, W, 214, P.plum);
  tex(0, 0, W, 214, null, P.blue, 0.012, 2);
  for (let x = 0; x < W; x += 24) r(x, 14, 1, 154, rgba(P.slate, 0.35)); // soft vertical boards
  // soft pool of light around the window, shadow toward the corners
  for (let y = 0; y < 214; y += 2) for (let x = 0; x < W; x += 2) {
    const d = Math.hypot((x - 240) / 240, (y - 90) / 130);
    if (d < 0.55 && hash(x, y, 4) < (0.55 - d) * 0.5) r(x, y, 2, 2, P.blue);
    else if (d > 0.85 && hash(x, y, 5) < (d - 0.85) * 0.6) r(x, y, 2, 2, P.slate);
  }
  for (let y = 0; y < 44; y++) { ctx.fillStyle = rgba(P.night, 0.4 - y * 0.009); ctx.fillRect(0, y, W, 1); }
  block(0, 0, W, 12, P.woodD); r(0, 12, W, 2, dark(P.woodD, 0.4));
  // wainscot
  r(0, 168, W, 46, P.slate); r(0, 168, W, 3, P.mauve); r(0, 171, W, 1, dark(P.slate, 0.4));
  for (let x = 4; x < W; x += 40) { r(x, 178, 34, 28, dark(P.slate, 0.18)); r(x + 1, 179, 32, 26, P.slate); r(x + 1, 179, 32, 1, light(P.slate, 0.2)); }
  // floor: warm wood
  tex(0, 214, W, 56, P.wood, P.woodM, 0.07, 5);
  r(0, 208, W, 6, P.woodL); r(0, 208, W, 1, light(P.woodL, 0.35)); r(0, 213, W, 1, P.woodD);
  for (let y = 222, row = 0; y < H; y += 10, row++) {
    r(0, y, W, 1, P.woodD);
    for (let x = (row * 41) % 80; x < W; x += 80) r(x, y, 1, 10, P.woodD);
  }
}

function pictureFrame(x, y, w, h, art) {
  block(x - 4, y - 4, w + 8, h + 8, P.woodM); r(x - 1, y - 1, w + 2, h + 2, P.cream);
  ctx.save(); ctx.beginPath(); ctx.rect(x, y, w, h); ctx.clip(); art(x, y, w, h); ctx.restore();
  r(x - 3, y + h + 5, w + 6, 2, rgba(P.ink, 0.25));
}
const sunsetArt = (x, y, w, h) => {
  for (let j = 0; j < h; j++) r(x, y + j, w, 1, mix(P.slate, P.peach, j / h));
  disc(x + w * 0.65, y + h * 0.55, 6, P.gold);
  for (let i = 0; i < w; i++) r(x + i, y + h * 0.72 + Math.sin(i * 0.25) * 3, 1, h, P.night);
};
const moonArt = (x, y, w, h) => {
  r(x, y, w, h, P.night); disc(x + w / 2, y + h / 2, 9, P.lilac); disc(x + w / 2 + 4, y + h / 2 - 2, 8, P.night);
  for (let i = 0; i < 12; i++) px(x + hash(i, 1, 4) * w, y + hash(i, 2, 4) * h, P.lilac);
};
const hillsArt = (x, y, w, h) => {
  r(x, y, w, h, P.lilac); disc(x + w * 0.3, y + h * 0.3, 5, P.peach);
  for (let i = 0; i < w; i++) { r(x + i, y + h * 0.5 + Math.sin(i * 0.15) * 4, 1, h, P.blue); r(x + i, y + h * 0.75 + Math.sin(i * 0.2 + 2) * 3, 1, h, P.slate); }
};

function stringLights() {
  const bulbs = []; let prev = null;
  for (let x = 0; x <= W; x += 2) {
    const y = 18 + Math.sin((x / W) * Math.PI * 4) * 5 + 4;
    if (prev) line(prev[0], prev[1], x, y, P.woodD); prev = [x, y];
  }
  for (let x = 14; x < W; x += 30) {
    const y = 18 + Math.sin((x / W) * Math.PI * 4) * 5 + 4;
    r(x, y, 1, 3, P.ink); disc(x, y + 6, 2, P.gold); px(x - 1, y + 5, '#FFF3E6'); bulbs.push([x, y + 6]);
  }
  GLOWS.bulbs = bulbs;
}

function corkboardAndShelf() {
  // corkboard with notes + polaroids over the desk
  block(24, 52, 86, 64, P.woodD); r(27, 55, 80, 58, P.woodM); tex(27, 55, 80, 58, null, P.woodL, 0.18, 12); tex(27, 55, 80, 58, null, P.wood, 0.12, 13);
  const note = (x, y, w, h, c) => { r(x + 1, y + 1, w, h, rgba(P.ink, 0.3)); r(x, y, w, h, c); r(x + w / 2 - 1, y - 1, 2, 2, P.rose); };
  note(33, 60, 18, 22, P.cream); for (let i = 0; i < 4; i++) r(36, 65 + i * 4, 12, 1, P.blue);
  note(56, 58, 16, 14, P.peach); r(59, 63, 10, 1, P.wood); r(59, 66, 7, 1, P.wood);
  note(78, 62, 24, 20, P.cream); r(80, 64, 20, 12, P.sky); disc(94, 70, 3, P.gold); for (let i = 80; i < 100; i++) r(i, 72 + Math.sin(i) , 1, 4, P.leaf);
  note(36, 88, 20, 16, P.rose); r(39, 92, 14, 1, P.cream); r(39, 95, 10, 1, P.cream);
  note(62, 86, 18, 20, P.cream); r(64, 88, 14, 12, P.lilac); r(64, 100, 14, 1, P.cream);
  note(86, 90, 14, 12, P.gold);
  line(40, 82, 66, 86, P.rose); line(66, 86, 88, 90, P.rose);
  // little shelf with books + candle
  block(118, 94, 52, 5, P.woodM); r(122, 99, 3, 6, P.woodD); r(163, 99, 3, 6, P.woodD);
  block(122, 80, 7, 14, P.rose); block(129, 84, 6, 10, P.sky); block(135, 78, 7, 16, P.slate); block(145, 84, 10, 10, P.cream); r(149, 78, 2, 6, P.gold); px(149, 77, P.peach);
  block(158, 86, 9, 8, P.pot); r(161, 76, 2, 10, P.leaf); r(157, 78, 4, 3, P.leafL); r(163, 74, 5, 3, P.leaf);
}

function windowFrame() {
  const g = GLASS, fx = g.x - 10, fy = g.y - 8, fw = g.w + 20, fh = g.h + 12;
  block(fx - 3, fy - 3, fw + 6, fh + 3, P.woodD);
  block(fx, fy, fw, fh, P.woodM); tex(fx, fy, fw, fh, null, P.woodL, 0.05, 8); tex(fx, fy, fw, fh, null, P.wood, 0.08, 9);
  r(g.x - 3, g.y - 3, g.w + 6, g.h + 4, P.woodD);
  ctx.clearRect(g.x, g.y, g.w, g.h);
  const mid = g.x + g.w / 2;
  block(mid - 3, g.y, 6, g.h, P.woodM);
  for (const y of [g.y + 40, g.y + 84]) block(g.x, y, g.w, 5, P.woodM);
  r(mid - 7, g.y + 80, 3, 11, P.gold); r(mid - 7, g.y + 80, 3, 1, '#FFF3E6');
  ctx.fillStyle = 'rgba(255,255,255,0.07)';
  for (const [ox, w] of [[16, 10], [32, 4], [76, 12], [94, 4]]) { ctx.beginPath(); ctx.moveTo(g.x + ox + 30, g.y + 4); ctx.lineTo(g.x + ox + 30 + w, g.y + 4); ctx.lineTo(g.x + ox + w, g.y + g.h - 4); ctx.lineTo(g.x + ox, g.y + g.h - 4); ctx.fill(); }
  // half-lowered roller shade at the top, with a slanted edge
  block(g.x - 8, g.y - 8, g.w + 16, 8, P.slate); r(g.x - 8, g.y - 8, g.w + 16, 1, P.mauve);
  ctx.fillStyle = P.lilac; ctx.beginPath(); ctx.moveTo(g.x, g.y); ctx.lineTo(g.x + g.w, g.y); ctx.lineTo(g.x + g.w, g.y + 22); ctx.lineTo(g.x, g.y + 10); ctx.closePath(); ctx.fill();
  ctx.fillStyle = rgba(P.mauve, 0.5); ctx.beginPath(); ctx.moveTo(g.x, g.y + 7); ctx.lineTo(g.x + g.w, g.y + 19); ctx.lineTo(g.x + g.w, g.y + 22); ctx.lineTo(g.x, g.y + 10); ctx.closePath(); ctx.fill();
  tex(g.x, g.y, g.w, 22, null, P.mauve, 0.08, 17);
  r(g.x + g.w - 8, g.y + 18, 2, 8, P.mauve); r(g.x + g.w - 9, g.y + 26, 4, 3, P.gold);
  // sill
  block(g.x - 20, g.y + g.h + 4, g.w + 40, 8, P.woodL); r(g.x - 20, g.y + g.h + 4, g.w + 40, 1, light(P.peach, 0.5)); r(g.x - 16, g.y + g.h + 12, g.w + 32, 3, rgba(P.ink, 0.25));
  // little cactus on the sill, books on the other end
  const px0 = g.x + 6, py = g.y + g.h + 4;
  block(px0, py - 12, 14, 12, P.pot); r(px0 - 1, py - 14, 16, 3, light(P.pot, 0.15));
  r(px0 + 5, py - 28, 4, 16, P.leaf); r(px0 + 5, py - 28, 1, 16, P.leafL); r(px0 + 1, py - 24, 4, 3, P.leaf); r(px0 + 1, py - 24, 3, 8, P.leaf); r(px0 + 9, py - 22, 4, 3, P.leaf); r(px0 + 10, py - 22, 3, 7, P.leaf); px(px0 + 6, py - 30, P.rose);
  block(g.x + 28, py - 8, 12, 8, P.cream); ellipse(g.x + 34, py - 13, 8, 5, P.leaf); ellipse(g.x + 33, py - 14, 5, 3, P.leafL);
  block(g.x + g.w - 36, py - 8, 26, 4, P.rose); block(g.x + g.w - 34, py - 12, 22, 4, P.sky); block(g.x + g.w - 35, py - 15, 24, 3, P.cream);
  // radiator under the window
  r(g.x + 14, 172, g.w - 28, 38, P.slate); block(g.x + 12, 170, g.w - 24, 4, P.mauve);
  for (let x = g.x + 18; x < g.x + g.w - 22; x += 8) { block(x, 176, 6, 30, P.blue); r(x + 1, 178, 1, 26, light(P.blue, 0.3)); }
  block(g.x + 12, 206, g.w - 24, 3, P.mauve);
}

function hangingPlants() {
  const cx = 336;
  r(cx, 12, 1, 112, P.woodD);
  const planter = (y, vineLen, seed) => {
    line(cx, y - 14, cx - 12, y + 2, P.woodD); line(cx, y - 14, cx + 12, y + 2, P.woodD);
    ellipse(cx, y + 6, 13, 8, P.woodD); ellipse(cx, y + 5, 12, 7, P.pot); ellipse(cx, y + 3, 12, 3, P.woodD);
    const rand = rng(seed);
    for (let i = 0; i < 16; i++) { const a = (i / 16) * 3.14 + 3.14, lx = cx + Math.cos(a) * 14 * (0.6 + rand() * 0.6), ly = y + Math.sin(a) * 8 - 4; disc(lx, ly, 3, P.leaf); disc(lx - 1, ly - 1, 1, P.leafL); }
    for (let i = 0; i < 6; i++) { const vx = cx - 12 + i * 5, vl = vineLen * (0.5 + rand() * 0.6); r(vx, y + 8, 1, vl, P.leafD); for (let k = 4; k < vl; k += 5) { px(vx - 1, y + 8 + k, P.leaf); px(vx + 1, y + 10 + k, P.leafL); } }
  };
  planter(42, 18, 3); planter(78, 22, 4); planter(114, 26, 5);
}

function deskAndLaptop() {
  // desk top and storage
  r(8, 194, 160, 6, rgba(P.ink, 0.25));
  block(8, 187, 160, 8, P.woodL); r(8, 187, 160, 1, light(P.peach, 0.6)); tex(9, 188, 158, 6, null, P.woodM, 0.12, 11);
  block(116, 195, 50, 56, P.woodM);
  for (let i = 0; i < 3; i++) { block(119, 198 + i * 17, 44, 14, P.woodL); r(134, 203 + i * 17, 14, 2, P.gold); }
  block(122, 251, 4, 4, P.woodD); block(156, 251, 4, 4, P.woodD);
  block(10, 195, 8, 58, P.woodM); r(11, 196, 1, 56, P.woodL);
  r(18, 195, 98, 5, dark(P.slate, 0.2));
  // floor cushion tucked under the desk
  ellipse(64, 241, 30, 9, dark(P.rose, 0.3)); ellipse(64, 238, 30, 9, P.rose); ellipse(64, 236, 24, 5, light(P.rose, 0.3));
  // laptop
  block(20, 148, 56, 38, P.mauve); r(20, 148, 56, 1, P.lilac);
  r(23, 151, 50, 32, '#3A4565');
  r(23, 151, 50, 4, '#4D5A7C'); px(26, 153, P.rose); px(29, 153, P.peach); px(32, 153, P.sky);
  for (let i = 0; i < 5; i++) r(28 + (i % 2) * 2, 159 + i * 4, 14 + hash(i, 1, 3) * 18, 1, i % 3 ? P.blue : P.peach);
  r(52, 168, 14, 7, P.sky); r(62, 165, 5, 5, P.sky); px(62, 164, P.sky); px(66, 164, P.sky); px(63, 167, '#3A4565'); px(65, 167, '#3A4565'); // sleepy cat icon
  block(14, 186, 68, 3, P.lilac);
  // mug, pencil cup, lamp
  block(88, 176, 11, 11, P.cream); r(99, 178, 4, 5, P.cream); r(101, 179, 1, 3, P.plum); r(89, 177, 9, 2, '#6E4A44');
  block(104, 172, 8, 15, P.sky); r(106, 164, 1, 9, P.gold); r(109, 166, 1, 7, P.rose); r(110, 168, 1, 5, P.leafL);
  block(124, 182, 20, 5, P.slate); r(132, 176, 5, 6, P.slate);
  line(134, 178, 128, 162, P.slate, 3); line(128, 162, 142, 152, P.slate, 3); r(126, 160, 5, 5, P.gold);
  block(136, 146, 20, 9, P.mauve); r(138, 155, 16, 2, '#FFF1D6');
}

function bed() {
  const x0 = 330, x1 = 476;
  // legs, frame, headboard, footboard
  block(x0, 242, x1 - x0, 10, P.woodM); tex(x0, 243, x1 - x0, 8, null, P.woodL, 0.1, 14);
  block(x0 + 2, 252, 8, 8, P.woodD); block(x1 - 12, 252, 8, 8, P.woodD);
  r(x0 + 2, 260, 8, 3, rgba(P.ink, 0.25)); r(x1 - 12, 260, 8, 3, rgba(P.ink, 0.25));
  block(x1 - 16, 116, 16, 136, P.woodM); tex(x1 - 16, 117, 16, 134, null, P.woodL, 0.08, 15);
  for (let x = x1 - 13; x < x1 - 3; x += 4) { r(x, 126, 2, 108, P.wood); r(x, 126, 1, 108, P.woodL); }
  block(x1 - 20, 112, 24, 6, P.woodL);
  block(x0, 196, 10, 56, P.woodM); r(x0, 192, 10, 6, P.woodL); r(x0, 192, 10, 1, light(P.woodL, 0.4));
  // mattress side
  block(x0 + 10, 224, x1 - 16 - x0 - 10, 18, P.cream); for (let x = x0 + 14; x < x1 - 18; x += 12) r(x, 231, 7, 1, P.lilac);
  // blanket: lit top, folded drape, scalloped hem
  const base = P.rose, topY = 196;
  for (let x = x0 + 10; x < x1 - 16; x++) {
    const bump = Math.round(Math.sin(x * 0.11) * 2 + Math.sin(x * 0.27)), y0 = topY + bump, fold = 0.5 + 0.5 * Math.sin(x * 0.32 + 1);
    r(x, y0, 1, 7, light(base, 0.28 + fold * 0.1));
    const hem = 232 + Math.round(Math.sin(x * 0.18) * 3);
    for (let y = y0 + 7; y < hem; y++) { ctx.fillStyle = mix(base, P.slate, 0.04 + fold * 0.2 + (y - y0) / 150); ctx.fillRect(x, y, 1, 1); }
    r(x, hem, 1, 3, P.cream);
  }
  ctx.fillStyle = 'rgba(42,34,48,0.25)';
  for (let y = 208; y < 232; y += 8) for (let x = x0 + 12; x < x1 - 18; x += 4) ctx.fillRect(x, y, 1, 1);
  for (let x = x0 + 22, i = 0; x < x1 - 40; x += 28, i++) { const c = i % 2 ? P.peach : P.lilac; r(x, 211, 18, 14, c); r(x + 1, 212, 16, 12, light(c, 0.15)); }
  // pillows + plush
  const pillow = (cx, cy, rx, ry, c) => { ellipse(cx, cy + 2, rx, ry, dark(c, 0.3)); ellipse(cx, cy, rx, ry, c); ellipse(cx - 3, cy - 3, rx - 5, ry - 4, light(c, 0.35)); line(cx - rx + 8, cy + 3, cx + rx - 12, cy + 4, dark(c, 0.15)); };
  pillow(x1 - 48, 188, 28, 14, P.cream); pillow(x1 - 64, 181, 20, 11, P.peach);
  ellipse(352, 190, 8, 7, P.woodM); ellipse(352, 190, 6, 5, P.woodL); disc(346, 182, 3, P.woodM); disc(358, 182, 3, P.woodM); ellipse(352, 184, 5, 4, P.woodL); px(350, 184, P.ink); px(354, 184, P.ink); r(351, 186, 2, 1, P.ink);
  // art above the bed
  pictureFrame(366, 54, 50, 38, hillsArt); pictureFrame(430, 64, 22, 30, sunsetArt);
  line(448, 108, 466, 118, P.woodD); [[450, 109], [458, 113]].forEach(([x, y], i) => { block(x, y, 7, 9, P.cream); r(x + 1, y + 1, 5, 5, [P.rose, P.sky][i]); });
}

function rugAndBits() {
  ellipse(242, 251, 94, 18, dark(P.wood, 0.4));
  ellipse(242, 249, 90, 16, P.slate); ellipse(242, 249, 86, 14, P.rose); ellipse(242, 249, 78, 12, P.peach); ellipse(242, 249, 64, 9, P.rose); ellipse(242, 249, 48, 6, P.mauve); ellipse(242, 249, 30, 3, P.peach);
  for (let a = 0; a < 360; a += 10) { const rad = a * Math.PI / 180; px(242 + Math.cos(rad) * 90, 249 + Math.sin(rad) * 16, P.cream); }
  for (let i = 0; i < 160; i++) { const a = hash(i, 1, 7) * 6.28, d = Math.sqrt(hash(i, 2, 7)); px(242 + Math.cos(a) * d * 84, 249 + Math.sin(a) * d * 13, hash(i, 3, 7) > 0.5 ? light(P.rose, 0.25) : dark(P.mauve, 0.1)); }
  block(166, 254, 14, 5, P.cream); r(168, 253, 10, 2, P.pot); block(184, 255, 12, 4, P.sky); r(186, 254, 8, 2, P.blue);
}

function floorPlant() {
  block(306, 192, 22, 20, P.pot); r(304, 190, 26, 4, light(P.pot, 0.2)); r(308, 196, 18, 1, light(P.pot, 0.3));
  const rand = rng(33);
  for (let i = 0; i < 9; i++) {
    const a = -1.2 + i * 0.3, len = 30 + rand() * 22, x1 = 317 + Math.sin(a) * len, y1 = 190 - Math.cos(a) * len;
    line(317, 190, x1, y1, P.leafD, 2); ellipse(x1, y1, 7, 4, P.leaf); ellipse(x1 - 1, y1 - 1, 5, 2, P.leafL);
  }
}

let room;
export function buildRoom() {
  room = document.createElement('canvas'); room.width = W; room.height = H;
  ctx = room.getContext('2d');
  wallAndFloor(); stringLights(); corkboardAndShelf(); hangingPlants(); rugAndBits(); windowFrame(); deskAndLaptop(); bed(); floorPlant();
}

// ── DYNAMIC: what's outside the window ──────────────────────────────────
const LEAVES = {
  spring: ['#34524F', '#5E8F6E', '#A6C98A'],
  summer: ['#2C4A47', '#4F7A68', '#86AA86'],
  autumn: ['#7E3A33', '#C0703F', '#E8A857'],
};
const treeCache = {};

function crown(c, cx, cy, rx, ry, season, seed) {
  const rand = rng(seed), [dk, md, lt] = LEAVES[season];
  ctx = c;
  const blobs = [];
  for (let i = 0; i < 24; i++) { const a = rand() * 6.28, d = Math.sqrt(rand()); blobs.push([cx + Math.cos(a) * d * rx, cy + Math.sin(a) * d * ry, 6 + rand() * 7]); }
  blobs.forEach(([x, y, rr]) => disc(x, y + 3, Math.round(rr), dk));
  blobs.forEach(([x, y, rr]) => disc(x, y, Math.round(rr), md));
  blobs.forEach(([x, y, rr]) => disc(x - 2, y - 3, Math.round(rr * 0.6), lt));
  for (let i = 0; i < 240; i++) {
    const a = rand() * 6.28, d = 0.75 + rand() * 0.45, x = cx + Math.cos(a) * rx * d, y = cy + Math.sin(a) * ry * d;
    r(x, y, 2, 2, rand() > 0.5 ? md : (a < 3.3 && a > 0.3 ? dk : lt));
  }
  if (season === 'spring') for (let i = 0; i < 70; i++) { const a = rand() * 6.28, d = Math.sqrt(rand()); r(cx + Math.cos(a) * d * rx, cy + Math.sin(a) * d * ry, 2, 2, rand() > 0.5 ? P.peach : '#F8E0D0'); }
}

function treeTrunk(c, x, baseY, topY, w, lean, season, seed) {
  ctx = c;
  const trunk = '#3A2C38';
  for (let y = topY; y <= baseY; y++) { const off = Math.round(((baseY - y) / (baseY - topY)) * lean); r(x + off, y, w, 1, trunk); r(x + off, y, 2, 1, '#5A4350'); r(x + off + w - 1, y, 1, 1, P.ink); }
  const rand = rng(seed + 9), n = season === 'winter' ? 7 : 4;
  for (let i = 0; i < n; i++) {
    const by = topY + 4 + i * ((baseY - topY) * 0.6 / n), dir = i % 2 ? 1 : -1, len = 14 + rand() * 24;
    line(x + w / 2, by, x + w / 2 + dir * len, by - len * (0.5 + rand() * 0.4), trunk, 2);
    if (season === 'winter') { line(x + w / 2 + dir * len, by - len * 0.6, x + w / 2 + dir * (len + 9), by - len * 0.6 - 8, trunk, 1); r(x + w / 2 + dir * len - 3, by - len * 0.6 - 2, 8, 2, '#E8EEF4'); }
  }
  if (season === 'winter') r(x - 1, topY - 1, w + 2, 2, '#E8EEF4');
}

function trees(season) {
  if (treeCache[season]) return treeCache[season];
  const g = GLASS, c = document.createElement('canvas'); c.width = g.w; c.height = g.h;
  const t = c.getContext('2d'), prev = ctx;
  treeTrunk(t, 100, g.h + 4, 30, 14, -5, season, 11);
  if (season !== 'winter') crown(t, 98, 50, 42, 32, season, 11);
  treeTrunk(t, 8, g.h + 4, 84, 6, 3, season, 5);
  if (season !== 'winter') crown(t, 12, 96, 22, 16, season, 5);
  ctx = prev;
  return (treeCache[season] = c);
}

function drawSky(c, look, hour, time) {
  ctx = c;
  const g = GLASS;
  c.save(); c.beginPath(); c.rect(g.x, g.y, g.w, g.h); c.clip();
  for (let y = 0; y < g.h; y += 2) r(g.x, g.y + y, g.w, 2, mix(look.top, look.bot, Math.pow(y / g.h, 0.85)));
  if (look.stars > 0.02) {
    const rand = rng(7);
    for (let i = 0; i < 40; i++) {
      const sx = g.x + 3 + rand() * (g.w - 6), sy = g.y + 3 + rand() * (g.h * 0.65), big = rand() > 0.8;
      c.fillStyle = rgba('#F8F4EE', look.stars * (big ? 0.95 : 0.6)); c.fillRect(Math.round(sx), Math.round(sy), big ? 2 : 1, big ? 2 : 1);
    }
  }
  const arc = (p) => ({ x: g.x + 14 + p * (g.w - 28), y: g.y + g.h - 18 - Math.sin(p * Math.PI) * (g.h - 52) });
  const sp = (hour - 6) / 12;
  if (sp > -0.1 && sp < 1.1) { const s = arc(sp); disc(s.x, s.y, 16, rgba(P.gold, 0.18)); disc(s.x, s.y, 11, rgba(P.gold, 0.35)); disc(s.x, s.y, 8, P.gold); disc(s.x, s.y, 6, '#FFF1D6'); }
  const mp = (((hour - 18) % 24 + 24) % 24) / 12;
  if (mp > -0.1 && mp < 1.1) { const m = arc(mp); disc(m.x, m.y, 13, rgba(P.lilac, 0.15)); disc(m.x, m.y, 8, '#EDE7EE'); disc(m.x + 3, m.y - 2, 7, mix(look.top, look.bot, (m.y - g.y) / g.h)); }
  const haze = mix(look.bot, look.top, 0.25);
  for (let x = 0; x < g.w; x++) {
    const h1 = 16 + Math.sin(x * 0.05) * 6 + Math.sin(x * 0.12) * 2, h2 = 8 + Math.sin(x * 0.07 + 2) * 5;
    r(g.x + x, g.y + g.h - h1, 1, h1, mix(haze, P.blue, 0.35)); r(g.x + x, g.y + g.h - h2, 1, h2, mix(haze, P.leafD, 0.45));
  }
  const cloud = mix(look.bot, '#FFFFFF', 0.5), shade = mix(look.bot, look.top, 0.2);
  [[10, 40, 0.5, 1], [80, 70, 0.3, 0.8], [-30, 98, 0.4, 1.1]].forEach(([ox, oy, sp2, s]) => {
    const cx = g.x + ((ox + time * sp2 * 1.5) % (g.w + 100)) - 40, cy = g.y + oy;
    const parts = [[0, 6, 40], [10, 0, 26], [24, 3, 28], [32, 8, 24]];
    parts.forEach(([dx, dy, w]) => ellipse(cx + dx * s, cy + dy * s + 2, (w / 2) * s, 5 * s, shade));
    parts.forEach(([dx, dy, w]) => ellipse(cx + dx * s, cy + dy * s, (w / 2) * s, 5 * s, cloud));
  });
  c.restore();
}

export function drawOutside(c, look, hour, season, time) { drawSky(c, look, hour, time); c.drawImage(trees(season), GLASS.x, GLASS.y); }
export function drawRoom(c) { c.drawImage(room, 0, 0); }

// ── DYNAMIC: light on top of everything ──────────────────────────────────
function lightEllipse(c, cx, cy, rx, ry) {
  for (let dy = -ry; dy <= ry; dy++) { const w = Math.floor(rx * Math.sqrt(Math.max(0, 1 - (dy * dy) / (ry * ry + 0.5)))); c.fillRect(Math.round(cx - w), Math.round(cy + dy), w * 2 + 1, 1); }
}
export function drawLight(c, look) {
  const dk = 1 - look.sun;
  const beam = look.sun > 0.3 ? look.sun * 0.15 : 0.06 * dk;
  c.fillStyle = rgba(look.sun > 0.3 ? '#FFF1D6' : P.lilac, beam);
  const quad = (a, b, d, e) => { c.beginPath(); c.moveTo(...a); c.lineTo(...b); c.lineTo(...d); c.lineTo(...e); c.closePath(); c.fill(); };
  quad([182, 214], [236, 214], [300, 270], [196, 270]);
  quad([246, 214], [298, 214], [380, 270], [296, 270]);
  if (look.sun > 0.3) { // window light falling across the blanket and pillows, in pane-shaped squares
    c.fillStyle = rgba('#FFF1D6', look.sun * 0.22);
    for (const [x, w] of [[352, 20], [380, 26], [414, 22]]) { c.beginPath(); c.moveTo(x + 6, 197); c.lineTo(x + 6 + w, 197); c.lineTo(x + w, 226); c.lineTo(x - 6, 226); c.fill(); }
  }
  if (dk > 0.05) {
    for (let i = 7; i >= 1; i--) { c.fillStyle = rgba(P.gold, 0.035 * dk); lightEllipse(c, 146, 156, i * 12, i * 10); }
    for (let i = 4; i >= 1; i--) { c.fillStyle = rgba(P.sky, 0.05 * dk); lightEllipse(c, 48, 168, i * 12, i * 9); }
    GLOWS.bulbs.forEach(([x, y]) => { for (let i = 3; i >= 1; i--) { c.fillStyle = rgba(P.gold, 0.09 * dk); lightEllipse(c, x, y, i * 3, i * 3); } });
    c.fillStyle = rgba('#FFF1E2', 0.6 * dk); c.fillRect(138, 157, 16, 2);
    c.fillStyle = rgba(P.sky, 0.25 * dk); c.fillRect(23, 151, 50, 32);
  }
}

export function drawScene(c, look, hour, season, time, drawCat) {
  c.clearRect(0, 0, W, H);
  drawOutside(c, look, hour, season, time);
  drawRoom(c);
  ctx = c;
  drawCat?.(c, r);
  c.fillStyle = rgba(look.tint, look.tintA); c.fillRect(0, 0, W, H);
  drawLight(c, look);
}
export { r };
