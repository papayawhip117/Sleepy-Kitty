import { mix, rgba } from './palette.js';

// ── a cozy, hand-drawn-feeling pixel room, seen straight on ──────────────
// Internal resolution is 480x270; main.js scales it up by whole numbers so pixels stay crisp.
export const W = 480, H = 270;

export const GLASS = { x: 112, y: 40, w: 176, h: 112 };

// Where the kitty can sleep (feet position) and the clickable area around each spot.
export const SPOTS = {
  bed:  { x: 372, y: 196 },
  sill: { x: 224, y: 156 },
  desk: { x: 192, y: 186 },
  rug:  { x: 200, y: 252 },
};
export const HIT = {
  bed:  [310, 168, 140, 44],
  sill: [112, 128, 176, 30],
  desk: [128, 160, 130, 30],
  rug:  [92, 228, 216, 38],
};
// Things that glow at night: [x, y, radius, strength]
export const GLOWS = { lamp: [270, 152], laptop: [78, 168], bulbs: [] };

const ink = '#2A2230';
const light = (c, t) => mix(c, '#FFF3E6', t);
const dark = (c, t) => mix(c, '#2A2230', t);
const hash = (x, y, s = 0) => { let h = (x * 374761393 + y * 668265263 + s * 2246822519) | 0; h = (h ^ (h >>> 13)) * 1274126177 | 0; return ((h ^ (h >>> 16)) >>> 0) / 4294967295; };
const rng = (seed) => () => (seed = (seed * 16807) % 2147483647) / 2147483647;

let ctx;
const r = (x, y, w, h, c) => { ctx.fillStyle = c; ctx.fillRect(Math.round(x), Math.round(y), w, h); };
const px = (x, y, c) => { ctx.fillStyle = c; ctx.fillRect(Math.round(x), Math.round(y), 1, 1); };
// speckled fill: `amt` of the pixels use `alt`, giving a painted, textured surface
const tex = (x, y, w, h, base, alt, amt, seed = 1) => {
  r(x, y, w, h, base);
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
// a rectangle with a lit top edge, shaded bottom edge and outline: the basic "chunky pixel object"
const block = (x, y, w, h, c) => { r(x, y, w, h, c); r(x, y, w, 1, light(c, 0.35)); r(x, y + h - 1, w, 1, dark(c, 0.35)); r(x, y, 1, h, light(c, 0.12)); r(x + w - 1, y, 1, h, dark(c, 0.22)); };

// ── colours (all pulled from Cody's dusk + berry palettes, with a few warm woods and plants) ──
const C = {
  wall: '#8D809A', wallHi: '#9D91A9', wallLo: '#7B6F8B', wain: '#6E6786', wainHi: '#8179A0',
  wood: '#7A5558', woodHi: '#9A6F68', woodLo: '#523C45',
  floor: '#B28B84', floorLo: '#9C7479', floorHi: '#C79F93',
  cream: '#F2E4DB', peach: '#F2C1A3', rose: '#CD9FA0', mauve: '#857C91', slate: '#525871',
  blue: '#7C8DA6', skyblue: '#89A2BA', plum: '#61647C', night: '#302E3B', gold: '#F8CCAA',
};

// ── STATIC ROOM (drawn once into its own canvas) ────────────────────────
function wallAndFloor() {
  tex(0, 0, W, 212, C.wall, C.wallHi, 0.07, 2);
  tex(0, 0, W, 212, 'rgba(0,0,0,0)', C.wallLo, 0.04, 3);
  for (let y = 0; y < 40; y++) { ctx.fillStyle = rgba(C.night, 0.35 - y * 0.0085); ctx.fillRect(0, y, W, 1); } // ceiling shadow
  block(0, 0, W, 12, C.woodLo); r(0, 12, W, 2, dark(C.woodLo, 0.4));   // ceiling beam
  // wainscot panelling
  r(0, 164, W, 48, C.wain); r(0, 164, W, 3, C.wainHi); r(0, 167, W, 1, dark(C.wain, 0.4));
  for (let x = 6; x < W; x += 44) { block(x, 174, 36, 32, dark(C.wain, 0.1)); r(x + 2, 176, 32, 28, C.wain); }
  // floor planks with grain
  tex(0, 212, W, 58, C.floor, C.floorHi, 0.06, 5);
  r(0, 212, W, 3, C.rose); r(0, 214, W, 1, C.floorLo); r(0, 208, W, 4, '#F2C1A3'); r(0, 211, W, 1, '#CD9FA0'); // baseboard
  for (let y = 218, row = 0; y < H; y += 9, row++) {
    r(0, y, W, 1, C.floorLo);
    for (let x = (row * 37) % 70; x < W; x += 70) r(x, y, 1, 9, C.floorLo);
  }
  for (let i = 0; i < 160; i++) { const x = hash(i, 1, 9) * W, y = 217 + hash(i, 2, 9) * 52; r(x, y, 3 + hash(i, 3, 9) * 5, 1, C.floorLo); }
}

function bookshelf() {
  const x0 = 0, x1 = 46;
  block(x0, 62, x1, 150, C.wood); r(x0 + 3, 66, x1 - 6, 142, dark(C.wood, 0.45));
  const shelves = [66, 104, 142, 180];
  const rand = rng(21);
  const cols = [C.rose, C.blue, C.peach, C.plum, '#6B8F5E', C.cream, '#B9776A', C.skyblue];
  shelves.forEach((sy, k) => {
    let x = x0 + 4;
    while (x < x1 - 6) {
      const w = 3 + Math.floor(rand() * 4), h = 18 + Math.floor(rand() * 14), c = cols[Math.floor(rand() * cols.length)];
      if (k === 3 && x > 28) break;
      r(x, sy + 36 - h, w, h, c); r(x, sy + 36 - h, 1, h, light(c, 0.3)); r(x + w - 1, sy + 36 - h, 1, h, dark(c, 0.3)); r(x + 1, sy + 40 - h, w - 2, 1, dark(c, 0.3));
      x += w;
    }
    block(x0 + 1, sy + 36, x1 - 2, 3, C.woodHi);
  });
  // little plant on top
  block(14, 52, 12, 10, C.rose); r(18, 40, 2, 12, '#4F7F55'); r(14, 42, 4, 3, '#6B9660'); r(21, 38, 5, 3, '#86B067'); r(12, 47, 4, 3, '#86B067'); r(22, 45, 5, 3, '#4F7F55');
}

function pictureFrame(x, y, w, h, art) {
  block(x - 4, y - 4, w + 8, h + 8, C.woodHi); r(x - 1, y - 1, w + 2, h + 2, C.cream);
  ctx.save(); ctx.beginPath(); ctx.rect(x, y, w, h); ctx.clip(); art(x, y, w, h); ctx.restore();
  r(x - 4, y + h + 5, w + 8, 2, rgba(ink, 0.25));
}
const sunsetArt = (x, y, w, h) => {
  for (let j = 0; j < h; j++) r(x, y + j, w, 1, mix('#525871', '#F2C1A3', j / h));
  disc(x + w * 0.65, y + h * 0.55, 6, '#F8CCAA');
  for (let i = 0; i < w; i++) r(x + i, y + h * 0.7 + Math.sin(i * 0.25) * 3, 1, h, '#3C3A52');
};
const moonArt = (x, y, w, h) => {
  r(x, y, w, h, '#302E3B'); disc(x + w / 2, y + h / 2, 9, '#E6E0E8'); disc(x + w / 2 + 4, y + h / 2 - 2, 8, '#302E3B');
  for (let i = 0; i < 12; i++) px(x + hash(i, 1, 4) * w, y + hash(i, 2, 4) * h, '#BEB3C3');
};
const hillsArt = (x, y, w, h) => {
  r(x, y, w, h, '#BEB3C3'); disc(x + w * 0.3, y + h * 0.3, 5, '#F2C1A3');
  for (let i = 0; i < w; i++) { r(x + i, y + h * 0.5 + Math.sin(i * 0.15) * 4, 1, h, '#7C8DA6'); r(x + i, y + h * 0.75 + Math.sin(i * 0.2 + 2) * 3, 1, h, '#525871'); }
};

function wallDecor() {
  pictureFrame(58, 60, 44, 52, sunsetArt);
  pictureFrame(58, 126, 22, 22, moonArt);
  pictureFrame(86, 126, 18, 22, hillsArt);
  // right side above the bed
  pictureFrame(340, 56, 54, 40, hillsArt);
  pictureFrame(406, 64, 26, 34, sunsetArt);
  // little shelf with a plant and a candle
  block(330, 112, 110, 5, C.woodHi); r(334, 117, 3, 5, C.woodLo); r(433, 117, 3, 5, C.woodLo);
  block(346, 104, 10, 8, C.peach); r(349, 94, 2, 10, '#4F7F55'); r(345, 96, 4, 3, '#86B067'); r(352, 92, 5, 3, '#6B9660');
  block(374, 100, 8, 12, C.cream); r(377, 96, 2, 4, C.gold);
  block(392, 98, 6, 14, C.rose); block(398, 102, 6, 10, C.skyblue); block(404, 96, 7, 16, C.plum);
  // hanging ivy from the shelf
  for (let i = 0; i < 5; i++) { const x = 420 + i * 4; r(x, 117, 1, 10 + (i % 3) * 6, '#4F7F55'); px(x + 1, 120 + i * 3, '#86B067'); px(x - 1, 126 + i * 2, '#6B9660'); }
  // polaroids on a string
  line(446, 70, 476, 84, C.woodLo);
  [[451, 73], [459, 77], [467, 81]].forEach(([x, y], i) => { block(x, y, 7, 9, C.cream); r(x + 1, y + 1, 5, 5, [C.rose, C.skyblue, C.peach][i]); });
}

function stringLights() {
  // a warm wire swagged across the top of the room
  const bulbs = [];
  let prev = null;
  for (let x = 0; x <= W; x += 2) {
    const y = 18 + Math.sin((x / W) * Math.PI * 4) * 5 + 4;
    if (prev) line(prev[0], prev[1], x, y, dark(C.woodLo, 0.3));
    prev = [x, y];
  }
  for (let x = 14; x < W; x += 30) {
    const y = 18 + Math.sin((x / W) * Math.PI * 4) * 5 + 4;
    r(x, y, 1, 3, ink); disc(x, y + 6, 2, '#F8CCAA'); px(x - 1, y + 5, '#FFF3E6');
    bulbs.push([x, y + 6]);
  }
  GLOWS.bulbs = bulbs;
}

function windowFrame() {
  const g = GLASS;
  const fx = g.x - 8, fy = g.y - 8, fw = g.w + 16, fh = g.h + 8;
  // recessed wall + outer frame
  block(fx - 4, fy - 4, fw + 8, fh + 4, C.woodLo);
  block(fx, fy, fw, fh, C.wood);
  tex(fx, fy, fw, fh, C.wood, C.woodHi, 0.06, 8);
  r(fx, fy, fw, 1, light(C.woodHi, 0.3));
  // inner light edge
  r(g.x - 2, g.y - 2, g.w + 4, g.h + 3, dark(C.wood, 0.45));
  ctx.clearRect(g.x, g.y, g.w, g.h);        // the glass: the sky/outside layer shows through here
  // mullions and transom
  const mid = g.x + g.w / 2;
  block(mid - 3, g.y, 6, g.h, C.wood); r(mid - 3, g.y, 1, g.h, light(C.woodHi, 0.2));
  block(g.x, g.y + 52, g.w, 5, C.wood);
  // latch
  r(mid - 6, g.y + 50, 3, 9, C.gold); r(mid - 6, g.y + 50, 3, 1, '#FFF3E6');
  // soft reflections on the glass
  ctx.fillStyle = 'rgba(255,255,255,0.07)';
  for (const [ox, w] of [[18, 10], [34, 4], [104, 12], [124, 4]]) {
    ctx.beginPath(); ctx.moveTo(g.x + ox + 22, g.y + 4); ctx.lineTo(g.x + ox + 22 + w, g.y + 4); ctx.lineTo(g.x + ox + w, g.y + g.h - 4); ctx.lineTo(g.x + ox, g.y + g.h - 4); ctx.fill();
  }
  // deep sill
  block(g.x - 18, g.y + g.h + 4, g.w + 36, 8, C.woodHi);
  r(g.x - 18, g.y + g.h + 4, g.w + 36, 1, light(C.peach, 0.5));
  r(g.x - 14, g.y + g.h + 12, g.w + 28, 3, rgba(ink, 0.25));
  // plant on the sill (left) and books (right)
  const potX = g.x + 4, potY = g.y + g.h + 4;
  block(potX, potY - 16, 22, 16, '#B9776A'); r(potX - 2, potY - 18, 26, 4, '#CD8878'); r(potX + 2, potY - 14, 18, 1, '#D99A88');
  const leaf = (x0, y0, x1, y1) => { line(x0, y0, x1, y1, '#3F6B4E', 2); disc(x1, y1, 4, '#4F7F55'); disc(x1 - 1, y1 - 1, 2, '#86B067'); };
  leaf(potX + 11, potY - 18, potX + 3, potY - 50); leaf(potX + 11, potY - 18, potX + 11, potY - 62); leaf(potX + 11, potY - 18, potX + 21, potY - 48); leaf(potX + 11, potY - 18, potX - 5, potY - 34); leaf(potX + 11, potY - 18, potX + 28, potY - 32);
  block(g.x + g.w - 34, potY - 8, 24, 4, C.rose); block(g.x + g.w - 32, potY - 12, 20, 4, C.skyblue); block(g.x + g.w - 33, potY - 15, 22, 3, C.cream);
}

function curtains() {
  const g = GLASS;
  const drape = (x0, w, left) => {
    const base = '#E8D3C2';
    for (let i = 0; i < w; i++) {
      const fold = 0.5 + 0.5 * Math.sin(i * 0.8);
      const edge = left ? i / w : 1 - i / w;
      r(x0 + i, g.y - 14, 1, 172, mix(light(base, 0.15), dark(base, 0.28), fold * 0.8 + edge * 0.15));
    }
    for (let y = g.y - 14; y < g.y + 158; y++) if (hash(x0, y, 6) < 0.1) r(x0 + hash(y, 1, 6) * w, y, 1, 1, dark(base, 0.3));
    r(x0, g.y + 158, w, 2, dark(base, 0.4)); // hem
    r(left ? x0 + w - 5 : x0, g.y + 66, 5, 4, C.rose); // tie-back
  };
  drape(g.x - 34, 24, true); drape(g.x + g.w + 10, 24, false);
  block(g.x - 44, g.y - 22, g.w + 88, 4, C.woodLo); disc(g.x - 44, g.y - 20, 3, C.gold); disc(g.x + g.w + 44, g.y - 20, 3, C.gold); // rod + finials
  for (let x = g.x - 34; x < g.x - 10; x += 6) r(x, g.y - 18, 2, 6, C.gold);
  for (let x = g.x + g.w + 10; x < g.x + g.w + 34; x += 6) r(x, g.y - 18, 2, 6, C.gold);
}

function rugAndFloorBits() {
  ellipse(200, 249, 118, 21, dark(C.floor, 0.35));          // shadow
  ellipse(200, 247, 114, 19, C.slate);
  ellipse(200, 247, 108, 17, C.rose);
  ellipse(200, 247, 98, 15, C.peach);
  ellipse(200, 247, 84, 12, C.rose);
  ellipse(200, 247, 70, 9, C.mauve);
  ellipse(200, 247, 52, 6, C.peach);
  for (let a = 0; a < 360; a += 10) { const rad = a * Math.PI / 180; px(200 + Math.cos(rad) * 114, 247 + Math.sin(rad) * 19, C.cream); px(200 + Math.cos(rad) * 98, 247 + Math.sin(rad) * 15, C.rose); }
  for (let i = 0; i < 220; i++) { const a = hash(i, 1, 7) * 6.28, d = Math.sqrt(hash(i, 2, 7)); px(200 + Math.cos(a) * d * 108, 247 + Math.sin(a) * d * 17, hash(i, 3, 7) > 0.5 ? light(C.rose, 0.25) : dark(C.mauve, 0.1)); }
  // cat bowls and a toy mouse
  block(66, 250, 14, 5, C.cream); r(68, 249, 10, 2, '#B9776A'); block(84, 251, 12, 4, C.skyblue); r(86, 250, 8, 2, '#7C8DA6');
  ellipse(110, 262, 4, 2, C.blue); r(114, 262, 6, 1, C.blue);
}

function laptopAndDesk() {
  // the desk
  r(24, 193, 280, 8, rgba(ink, 0.28));                                   // shadow on wall
  block(24, 186, 280, 8, C.woodHi); r(24, 186, 280, 1, light(C.peach, 0.5)); tex(24, 187, 280, 6, C.woodHi, C.wood, 0.1, 11);
  block(28, 194, 62, 50, C.wood);                                          // drawer unit
  for (let i = 0; i < 3; i++) { block(31, 197 + i * 15, 56, 13, C.woodHi); r(53, 202 + i * 15, 12, 2, C.gold); }
  block(30, 244, 4, 8, C.woodLo); block(84, 244, 4, 8, C.woodLo);
  block(288, 194, 12, 58, C.wood); r(289, 195, 1, 56, C.woodHi);          // right leg
  r(92, 194, 196, 6, dark(C.wain, 0.25));                                 // apron
  // pouf / cushion tucked under the desk
  ellipse(190, 232, 34, 11, dark(C.rose, 0.25)); ellipse(190, 229, 34, 11, C.rose); ellipse(190, 227, 28, 7, light(C.rose, 0.25));
  // ── laptop (open, glowing screen)
  block(44, 150, 64, 36, '#9890A6'); r(44, 150, 64, 1, '#C9C0D2');
  r(47, 153, 58, 30, '#34405C');
  r(47, 153, 58, 4, '#4B5878'); px(50, 155, '#CD9FA0'); px(53, 155, '#F2C1A3'); px(56, 155, '#89A2BA');
  for (let i = 0; i < 6; i++) r(52 + (i % 2) * 2, 161 + i * 3, 16 + hash(i, 1, 3) * 24, 1, i % 3 ? '#7C8DA6' : '#F2C1A3');
  // tiny sleepy cat icon on the screen
  r(84, 170, 14, 7, '#89A2BA'); r(94, 167, 5, 5, '#89A2BA'); px(94, 166, '#89A2BA'); px(98, 166, '#89A2BA'); px(95, 169, '#34405C'); px(97, 169, '#34405C');
  block(38, 186, 76, 3, '#B7AEC4'); r(38, 186, 76, 1, '#E3DCEB');
  // mug, pencil cup, notebook, lamp
  block(122, 176, 11, 10, C.cream); r(133, 178, 4, 5, C.cream); r(135, 179, 1, 3, C.wall); r(123, 177, 9, 2, '#6E4A44');
  block(144, 172, 9, 14, C.skyblue); r(146, 164, 1, 9, C.gold); r(149, 166, 1, 7, C.rose); r(151, 168, 1, 5, '#6B8F5E');
  block(218, 184, 34, 2, C.cream); block(220, 182, 30, 2, C.rose); r(220, 181, 30, 1, C.peach);
  // articulated desk lamp: base, arm, head
  block(256, 182, 22, 4, '#6E6786'); r(264, 176, 6, 6, '#6E6786');
  line(266, 178, 258, 160, '#6E6786', 3); line(258, 160, 276, 148, '#6E6786', 3); r(256, 158, 5, 5, C.gold);
  block(268, 144, 22, 10, '#9890A6'); r(270, 154, 18, 2, '#FFF1D6');
  // ── chair back? skip; cable and keyboard bits
  r(110, 188, 20, 1, rgba(ink, 0.2));
}

function bed() {
  const x0 = 302;
  // frame + legs + headboard
  block(x0, 244, 178, 10, C.wood); tex(x0, 245, 178, 8, C.wood, C.woodHi, 0.08, 14);
  block(x0 + 6, 254, 8, 8, C.woodLo); block(W - 20, 254, 8, 8, C.woodLo);
  r(x0 + 6, 262, 8, 3, rgba(ink, 0.25)); r(W - 20, 262, 8, 3, rgba(ink, 0.25));
  block(W - 26, 110, 26, 144, C.wood); tex(W - 26, 111, 26, 142, C.wood, C.woodHi, 0.07, 15);
  for (let x = W - 22; x < W - 4; x += 6) { r(x, 118, 3, 120, dark(C.wood, 0.28)); r(x + 1, 118, 1, 120, C.woodHi); }
  block(W - 30, 106, 34, 6, C.woodHi);
  // mattress side + sheet
  block(x0 + 2, 226, 174, 18, C.cream); r(x0 + 2, 226, 174, 1, '#FFF8F0'); for (let x = x0 + 6; x < W - 26; x += 14) r(x, 232, 8, 1, '#D9C3BD');
  // blanket: top + draped front with folds
  const base = '#6F7FA0';
  const topY = 194;
  for (let x = x0 + 6; x < W - 24; x++) {
    const bump = Math.round(Math.sin(x * 0.11) * 2 + Math.sin(x * 0.27) * 1);
    const y0 = topY + bump;
    const fold = 0.5 + 0.5 * Math.sin(x * 0.33 + 1);
    // top (lit) then front (shaded folds) with scalloped hem
    r(x, y0, 1, 7, light(base, 0.22 + fold * 0.1));
    const hem = 232 + Math.round(Math.sin(x * 0.18) * 3);
    for (let y = y0 + 7; y < hem; y++) {
      const shade = 0.05 + fold * 0.22 + (y - y0) / 120;
      ctx.fillStyle = mix(base, '#2A2230', shade); ctx.fillRect(x, y, 1, 1);
    }
    r(x, hem, 1, 3, light(C.cream, 0.1));
  }
  // quilt stitches + patchwork squares
  ctx.fillStyle = 'rgba(42,34,48,0.28)';
  for (let y = 206; y < 232; y += 10) for (let x = x0 + 8; x < W - 26; x += 2) if (x % 4 === 0) ctx.fillRect(x, y, 1, 1);
  for (let x = x0 + 18; x < W - 40; x += 36) { r(x, 210, 18, 14, C.rose); r(x + 1, 211, 16, 12, mix(C.rose, '#FFFFFF', 0.12)); r(x + 18, 224 - 14, 0, 0, C.rose); }
  for (let x = x0 + 36; x < W - 40; x += 36) { r(x, 210, 18, 14, C.peach); r(x + 1, 211, 16, 12, light(C.peach, 0.12)); }
  // pillows (big fluffy ones against the headboard)
  const pillow = (cx, cy, rx, ry, c) => { ellipse(cx, cy + 2, rx, ry, dark(c, 0.3)); ellipse(cx, cy, rx, ry, c); ellipse(cx - 3, cy - 3, rx - 5, ry - 4, light(c, 0.35)); line(cx - rx + 8, cy + 3, cx + rx - 12, cy + 4, dark(c, 0.15)); };
  pillow(W - 56, 186, 30, 15, '#F2E4DB'); pillow(W - 74, 178, 22, 12, '#E8C7C0');
  // a tiny plush bear
  ellipse(334, 190, 8, 7, '#9A6F68'); ellipse(334, 190, 6, 5, '#B98A7E'); disc(328, 182, 3, '#9A6F68'); disc(340, 182, 3, '#9A6F68'); ellipse(334, 184, 5, 4, '#B98A7E'); px(332, 184, ink); px(336, 184, ink); r(333, 186, 2, 1, ink);
}

let room;
export function buildRoom() {
  room = document.createElement('canvas'); room.width = W; room.height = H;
  ctx = room.getContext('2d');
  wallAndFloor(); bookshelf(); wallDecor(); stringLights(); windowFrame(); curtains(); rugAndFloorBits(); laptopAndDesk(); bed();
}

// ── DYNAMIC: what's outside the window ──────────────────────────────────
const LEAVES = {
  spring: ['#3F6B4E', '#6B9660', '#A6C98A'],
  summer: ['#2F5A4A', '#4F7F55', '#86B067'],
  autumn: ['#7E3A33', '#C0703F', '#E8A857'],
};
const treeCache = {};

function crown(c, cx, cy, rx, ry, season, seed) {
  const rand = rng(seed), [dk, md, lt] = LEAVES[season];
  const blobs = [];
  for (let i = 0; i < 26; i++) { const a = rand() * 6.28, d = Math.sqrt(rand()); blobs.push([cx + Math.cos(a) * d * rx, cy + Math.sin(a) * d * ry, 6 + rand() * 7]); }
  ctx = c;
  blobs.forEach(([x, y, rr]) => disc(x, y + 3, Math.round(rr), dk));
  blobs.forEach(([x, y, rr]) => disc(x, y, Math.round(rr), md));
  blobs.forEach(([x, y, rr]) => disc(x - 2, y - 3, Math.round(rr * 0.6), lt));
  // leafy speckle around the edges
  for (let i = 0; i < 260; i++) {
    const a = rand() * 6.28, d = 0.75 + rand() * 0.45, x = cx + Math.cos(a) * rx * d, y = cy + Math.sin(a) * ry * d;
    r(x, y, 2, 2, rand() > 0.5 ? md : (a < 3.3 && a > 0.3 ? dk : lt));
  }
  if (season === 'spring') for (let i = 0; i < 70; i++) { const a = rand() * 6.28, d = Math.sqrt(rand()); r(cx + Math.cos(a) * d * rx, cy + Math.sin(a) * d * ry, 2, 2, rand() > 0.5 ? '#F2C1A3' : '#F8E0D0'); }
}

function treeTrunk(c, x, baseY, topY, w, lean, season, seed) {
  ctx = c;
  const trunk = '#40303C';
  for (let y = topY; y <= baseY; y++) { const off = Math.round(((baseY - y) / (baseY - topY)) * lean); r(x + off, y, w, 1, trunk); r(x + off, y, 2, 1, '#5E4650'); r(x + off + w - 1, y, 1, 1, '#2A2230'); }
  const rand = rng(seed + 9);
  const n = season === 'winter' ? 7 : 4;
  for (let i = 0; i < n; i++) {
    const by = topY + 4 + i * ((baseY - topY) * 0.6 / n), dir = i % 2 ? 1 : -1, len = 16 + rand() * 26;
    line(x + w / 2, by, x + w / 2 + dir * len, by - len * (0.5 + rand() * 0.4), trunk, 2);
    if (season === 'winter') { line(x + w / 2 + dir * len, by - len * 0.6, x + w / 2 + dir * (len + 10), by - len * 0.6 - 9, trunk, 1); r(x + w / 2 + dir * len - 3, by - len * 0.6 - 2, 8, 2, '#E8EEF4'); }
  }
  if (season === 'winter') r(x - 1, topY - 1, w + 2, 2, '#E8EEF4');
}

function trees(season) {
  if (treeCache[season]) return treeCache[season];
  const g = GLASS, c = document.createElement('canvas'); c.width = g.w; c.height = g.h;
  const t = c.getContext('2d');
  const prev = ctx; ctx = t;
  // layers drawn in glass-local coordinates
  treeTrunk(t, 148, g.h + 4, 18, 14, -6, season, 11);
  if (season !== 'winter') crown(t, 140, 40, 52, 36, season, 11);
  treeTrunk(t, 10, g.h + 4, 74, 6, 3, season, 5);
  if (season !== 'winter') crown(t, 14, 86, 24, 18, season, 5);
  ctx = prev;
  return (treeCache[season] = c);
}

function drawSky(c, look, hour, time) {
  ctx = c;
  const g = GLASS;
  c.save(); c.beginPath(); c.rect(g.x, g.y, g.w, g.h); c.clip();
  for (let y = 0; y < g.h; y += 2) r(g.x, g.y + y, g.w, 2, mix(look.top, look.bot, Math.pow(y / g.h, 0.85)));
  // stars
  if (look.stars > 0.02) {
    const rand = rng(7);
    for (let i = 0; i < 46; i++) {
      const sx = g.x + 3 + rand() * (g.w - 6), sy = g.y + 3 + rand() * (g.h * 0.65), big = rand() > 0.8;
      c.fillStyle = rgba('#F8F4EE', look.stars * (big ? 0.95 : 0.6));
      c.fillRect(Math.round(sx), Math.round(sy), big ? 2 : 1, big ? 2 : 1);
    }
  }
  const arc = (p) => ({ x: g.x + 12 + p * (g.w - 24), y: g.y + g.h - 14 - Math.sin(p * Math.PI) * (g.h - 38) });
  const sp = (hour - 6) / 12;
  if (sp > -0.1 && sp < 1.1) { const s = arc(sp); disc(s.x, s.y, 16, rgba('#F8CCAA', 0.18)); disc(s.x, s.y, 11, rgba('#F8CCAA', 0.35)); disc(s.x, s.y, 8, '#F8CCAA'); disc(s.x, s.y, 6, '#FFF1D6'); }
  const mp = (((hour - 18) % 24 + 24) % 24) / 12;
  if (mp > -0.1 && mp < 1.1) { const m = arc(mp); disc(m.x, m.y, 13, rgba('#BEB3C3', 0.15)); disc(m.x, m.y, 8, '#EDE7EE'); disc(m.x + 3, m.y - 2, 7, mix(look.top, look.bot, (m.y - g.y) / g.h)); }
  // distant soft hills
  const haze = mix(look.bot, look.top, 0.25);
  for (let x = 0; x < g.w; x++) {
    const h1 = 16 + Math.sin(x * 0.045) * 6 + Math.sin(x * 0.11) * 2, h2 = 8 + Math.sin(x * 0.06 + 2) * 5;
    r(g.x + x, g.y + g.h - h1, 1, h1, mix(haze, '#6E7E8E', 0.35));
    r(g.x + x, g.y + g.h - h2, 1, h2, mix(haze, '#4F6A64', 0.5));
  }
  // layered, slowly drifting cumulus
  const cloud = mix(look.bot, '#FFFFFF', 0.5), shade = mix(look.bot, look.top, 0.15);
  [[20, 22, 0.5, 1], [90, 48, 0.3, 0.8], [-30, 62, 0.4, 1.1]].forEach(([ox, oy, sp2, s]) => {
    const cx = g.x + ((ox + time * sp2 * 1.5) % (g.w + 100)) - 40, cy = g.y + oy;
    [[0, 6, 40], [10, 0, 26], [24, 3, 28], [32, 8, 24]].forEach(([dx, dy, w]) => { ellipse(cx + dx * s, cy + dy * s + 2, (w / 2) * s, 5 * s, shade); });
    [[0, 6, 40], [10, 0, 26], [24, 3, 28], [32, 8, 24]].forEach(([dx, dy, w]) => { ellipse(cx + dx * s, cy + dy * s, (w / 2) * s, 5 * s, cloud); });
  });
  c.restore();
}

export function drawOutside(c, look, hour, season, time) {
  drawSky(c, look, hour, time);
  c.drawImage(trees(season), GLASS.x, GLASS.y);
}

export function drawRoom(c) { c.drawImage(room, 0, 0); }

// ── DYNAMIC: light on top of everything ──────────────────────────────────
export function drawLight(c, look, sunriseGlow) {
  ctx = c;
  const dk = 1 - look.sun;
  // sun/moon beam through the two panes onto the floor, with the mullion's shadow between
  const beam = look.sun > 0.3 ? look.sun * 0.15 : 0.06 * dk;
  c.fillStyle = rgba(look.sun > 0.3 ? '#FFF1D6' : '#BEB3C3', beam);
  const quad = (a, b, d, e) => { c.beginPath(); c.moveTo(...a); c.lineTo(...b); c.lineTo(...d); c.lineTo(...e); c.closePath(); c.fill(); };
  quad([120, 212], [196, 212], [250, 270], [70, 270]);
  quad([206, 212], [284, 212], [350, 270], [262, 270]);
  if (look.sun > 0.3) { c.fillStyle = rgba('#FFF1D6', look.sun * 0.07); c.fillRect(120, 164, 170, 22); } // wash over the wain
  if (dk > 0.05) {
    // lamp, laptop and string lights glowing (stepped rings keep the pixel look)
    for (let i = 7; i >= 1; i--) { c.fillStyle = rgba('#F8CCAA', 0.035 * dk); lightEllipse(c, 270, 152, i * 13, Math.round(i * 11)); }
    for (let i = 4; i >= 1; i--) { c.fillStyle = rgba('#89A2BA', 0.05 * dk); lightEllipse(c, 78, 168, i * 14, Math.round(i * 10)); }
    GLOWS.bulbs.forEach(([x, y]) => { for (let i = 3; i >= 1; i--) { c.fillStyle = rgba('#F8CCAA', 0.09 * dk); lightEllipse(c, x, y, i * 3, i * 3); } });
    c.fillStyle = rgba('#FFF1E2', 0.6 * dk); c.fillRect(270, 154, 18, 2);
    c.fillStyle = rgba('#89A2BA', 0.25 * dk); c.fillRect(47, 153, 58, 30);
  }
}
function lightEllipse(c, cx, cy, rx, ry) { // soft light ellipse on a given context
  for (let dy = -ry; dy <= ry; dy++) { const w = Math.floor(rx * Math.sqrt(Math.max(0, 1 - (dy * dy) / (ry * ry + 0.5)))); c.fillRect(Math.round(cx - w), Math.round(cy + dy), w * 2 + 1, 1); }
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
