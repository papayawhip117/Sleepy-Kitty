import { mix as mixHex, rgba } from './palette.js';

// ── A cozy room in real perspective ─────────────────────────────────────
// The room is a 3D box seen from its open front. Every wall, the floor and each piece of furniture is
// painted pixel by pixel in world space, so wood planks, rug rings and panelling all converge toward
// the vanishing point like a painting. Internal size is 480x270 (scaled up by whole numbers).
//   u = left/right (-240..240), v = height (0 floor .. 270 ceiling), z = depth (0 front .. 1 back wall)
export const W = 480, H = 270;
const VPX = 240, VPY = 110, K = 0.667, EYE = 160;
const S = (z) => 1 / (1 + K * z);
export const proj = (u, v, z) => { const s = S(z); return [VPX + u * s, VPY + (EYE - v) * s, s]; };

// Glass area of the window on the back wall (where the sky/outside is drawn)
const WIN = { u: 150, v0: 62, v1: 232 };
export const GLASS = (() => { const a = proj(-WIN.u, WIN.v1, 1), b = proj(WIN.u, WIN.v0, 1); return { x: Math.round(a[0]), y: Math.round(a[1]), w: Math.round(b[0] - a[0]), h: Math.round(b[1] - a[1]) }; })();

// Where the kitty can sleep: world position -> screen position + size
const spot = (u, v, z) => { const [x, y, s] = proj(u, v, z); return { x: Math.round(x), y: Math.round(y), k: s * 1.25 }; };
export const SPOTS = {
  bed:  spot(176, 70, 0.5),
  sill: spot(10, 56, 0.94),
  desk: spot(-190, 92, 0.7),
  rug:  spot(0, 0, 0.46),
};
export const hitSpot = (x, y) => {
  for (const [name, s] of Object.entries(SPOTS)) if (Math.abs(x - s.x) < 46 * s.k && y > s.y - 40 * s.k && y < s.y + 14 * s.k) return name;
  return null;
};
export const GLOWS = { lamp: [0, 0], laptop: [0, 0], bulbs: [] };

// ── palette: Cody's dusk + berry colours, warm woods and sage plants ──
const hx = (h) => [parseInt(h.slice(1, 3), 16), parseInt(h.slice(3, 5), 16), parseInt(h.slice(5, 7), 16)];
const mc = (a, b, t) => [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t];
const P = {
  ink: hx('#2A2230'), night: hx('#302E3B'), slate: hx('#525871'), plum: hx('#61647C'), mauve: hx('#857C91'), blue: hx('#7C8DA6'), sky: hx('#89A2BA'), lilac: hx('#BEB3C3'),
  rose: hx('#CD9FA0'), peach: hx('#F2C1A3'), gold: hx('#F8CCAA'), cream: hx('#F2E4DB'),
  woodD: hx('#4A3540'), wood: hx('#6E4D52'), woodM: hx('#946B66'), woodL: hx('#BC8A78'),
  leafD: hx('#34524F'), leaf: hx('#4F7A68'), leafL: hx('#86AA86'), pot: hx('#B9776A'),
};
const lt = (c, t) => mc(c, [255, 243, 230], t), dk = (c, t) => mc(c, P.ink, t);
const hex = (c) => '#' + c.map((v) => Math.max(0, Math.min(255, Math.round(v))).toString(16).padStart(2, '0')).join('');
const hash = (x, y, s = 0) => { let h = (Math.floor(x) * 374761393 + Math.floor(y) * 668265263 + s * 2246822519) | 0; h = (h ^ (h >>> 13)) * 1274126177 | 0; return ((h ^ (h >>> 16)) >>> 0) / 4294967295; };
const rng = (seed) => () => (seed = (seed * 16807) % 2147483647) / 2147483647;

// ── tiny software renderer ───────────────────────────────────────────
let img, d;
const BAYER = [0, 8, 2, 10, 12, 4, 14, 6, 3, 11, 1, 9, 15, 7, 13, 5];
const LV = 9; // brightness steps; ordered dithering blends between them for that painted pixel-art look

function lightAt(u, v, z) {
  const gx = u / 330, gy = (v - 125) / 210, gz = (z - 1) * 1.5;
  return 0.74 + 0.5 * Math.exp(-(gx * gx * 1.1 + gy * gy + gz * gz * 0.8)) - 0.05 * (1 - z);
}
function emit(x, y, c, u, v, z, fm) {
  const m = lightAt(u, v, z) * fm, q = Math.floor(m * LV + BAYER[((y & 3) << 2) | (x & 3)] / 16) / LV;
  const i = (y * W + x) * 4, warm = Math.max(0, q - 1) * 40;
  d[i] = Math.min(255, c[0] * q + warm); d[i + 1] = Math.min(255, c[1] * q + warm * 0.7); d[i + 2] = Math.min(255, c[2] * q + warm * 0.4); d[i + 3] = 255;
}
// plane facing the viewer (constant depth)
function paintZ(z, u0, u1, v0, v1, fm, fn) {
  const s = S(z), xa = Math.max(0, Math.floor(VPX + u0 * s)), xb = Math.min(W - 1, Math.ceil(VPX + u1 * s)), ya = Math.max(0, Math.floor(VPY + (EYE - v1) * s)), yb = Math.min(H - 1, Math.ceil(VPY + (EYE - v0) * s));
  for (let y = ya; y <= yb; y++) for (let x = xa; x <= xb; x++) {
    const u = (x + 0.5 - VPX) / s, v = EYE - (y + 0.5 - VPY) / s;
    if (u < u0 || u > u1 || v < v0 || v > v1) continue;
    const c = fn(u, v); if (c) emit(x, y, c, u, v, z, fm);
  }
}
// side plane (constant u): fn(zLocal*300?, v) gets (z, v)
function paintU(u, z0, z1, v0, v1, fm, fn) {
  const corners = [[u, v0, z0], [u, v1, z0], [u, v0, z1], [u, v1, z1]].map((p) => proj(...p));
  const xa = Math.max(0, Math.floor(Math.min(...corners.map((p) => p[0])))), xb = Math.min(W - 1, Math.ceil(Math.max(...corners.map((p) => p[0]))));
  const ya = Math.max(0, Math.floor(Math.min(...corners.map((p) => p[1])))), yb = Math.min(H - 1, Math.ceil(Math.max(...corners.map((p) => p[1]))));
  for (let y = ya; y <= yb; y++) for (let x = xa; x <= xb; x++) {
    const s = (x + 0.5 - VPX) / u; if (s <= 0 || s > 1.001) continue;
    const z = (1 / s - 1) / K, v = EYE - (y + 0.5 - VPY) / s;
    if (z < z0 || z > z1 || v < v0 || v > v1) continue;
    const c = fn(z, v); if (c) emit(x, y, c, u, v, z, fm);
  }
}
// horizontal plane (constant v): fn(u, z)
function paintV(v, u0, u1, z0, z1, fm, fn) {
  const corners = [[u0, v, z0], [u1, v, z0], [u0, v, z1], [u1, v, z1]].map((p) => proj(...p));
  const xa = Math.max(0, Math.floor(Math.min(...corners.map((p) => p[0])))), xb = Math.min(W - 1, Math.ceil(Math.max(...corners.map((p) => p[0]))));
  const ya = Math.max(0, Math.floor(Math.min(...corners.map((p) => p[1])))), yb = Math.min(H - 1, Math.ceil(Math.max(...corners.map((p) => p[1]))));
  for (let y = ya; y <= yb; y++) for (let x = xa; x <= xb; x++) {
    const s = (y + 0.5 - VPY) / (EYE - v); if (s <= 0 || s > 1.001) continue;
    const z = (1 / s - 1) / K, u = (x + 0.5 - VPX) / s;
    if (z < z0 || z > z1 || u < u0 || u > u1) continue;
    const c = fn(u, z); if (c) emit(x, y, c, u, v, z, fm);
  }
}
const ZS = 300; // world units per unit of depth, for textures
// a box with front, inner side and top (or underside) faces, each shaded by the material
function box(u0, u1, v0, v1, z0, z1, mat) {
  const du = u1 - u0, dv = v1 - v0, dz = (z1 - z0) * ZS;
  if (v0 > EYE) paintV(v0, u0, u1, z0, z1, 0.7, (u, z) => mat('b', u - u0, (z - z0) * ZS, du, dz));
  else if (v1 < EYE) paintV(v1, u0, u1, z0, z1, 1.18, (u, z) => mat('t', u - u0, (z - z0) * ZS, du, dz));
  if (u1 <= 0) paintU(u1, z0, z1, v0, v1, 0.86, (z, v) => mat('s', (z - z0) * ZS, v - v0, dz, dv));
  else if (u0 >= 0) paintU(u0, z0, z1, v0, v1, 0.86, (z, v) => mat('s', (z - z0) * ZS, v - v0, dz, dv));
  paintZ(z0, u0, u1, v0, v1, 1, (u, v) => mat('f', u - u0, v - v0, du, dv));
}
// materials
const solid = (c) => (f, p, q, A, B) => { const e = Math.min(p, A - p, q, B - q); return e < 1.6 ? (p < 1.6 || q < 1.6 ? lt(c, 0.28) : dk(c, 0.3)) : c; };
const wood = (c, seed = 3) => (f, p, q, A, B) => {
  const e = Math.min(p, A - p, q, B - q);
  let k = c; const g = hash(p / 3, q / 1.5, seed); if (g < 0.1) k = dk(c, 0.18); else if (g > 0.93) k = lt(c, 0.15);
  return e < 1.8 ? (p < 1.8 || q < 1.8 ? lt(k, 0.3) : dk(k, 0.3)) : k;
};

// ── wall / floor / ceiling shaders ──
function plaster(a, v) {
  if (v < 8) return v < 1.5 ? dk(P.woodM, 0.45) : v > 6 ? lt(P.woodL, 0.3) : P.woodL;
  if (v < 88) {
    const px = ((a % 80) + 80) % 80, inner = px > 8 && px < 72 && v > 18 && v < 78;
    if (inner) { if (px < 10.5 || v < 20.5) return dk(P.slate, 0.25); if (px > 69.5 || v > 75.5) return lt(P.slate, 0.18); return hash(a / 2, v / 2, 2) < 0.05 ? lt(P.slate, 0.08) : P.slate; }
    return dk(P.slate, 0.12);
  }
  if (v < 95) return v > 92 ? lt(P.mauve, 0.35) : P.mauve;
  const grain = hash(a / 2, v / 2, 4);
  let c = mc(P.plum, P.blue, Math.max(0, 1 - Math.abs(v - 150) / 130) * 0.35);
  if (grain < 0.012) c = P.blue; else if (grain > 0.99) c = P.slate;
  if (((a % 60) + 60) % 60 < 1.2) c = dk(c, 0.1);
  return c;
}
function floorShader(u, z) {
  const ru = u / 150, rz = (z - 0.46) / 0.32, e = Math.sqrt(ru * ru + rz * rz);
  if (e < 1) {
    let c = P.slate;
    if (e < 0.92) c = P.rose; if (e < 0.8) c = P.peach; if (e < 0.62) c = P.rose; if (e < 0.44) c = P.mauve; if (e < 0.24) c = P.peach;
    if (e > 0.97) c = P.cream;
    return hash(u / 2, z * 80, 8) < 0.12 ? lt(c, 0.15) : c;
  }
  if (e < 1.06) return dk(P.wood, 0.5);
  const idx = Math.floor((u + 240) / 34), f = (u + 240) - idx * 34;
  let c = mc(P.wood, P.woodM, hash(idx, 0, 5) * 0.55);
  if (f < 1.6) return dk(P.wood, 0.55);
  const zz = z * 9 + hash(idx, 1, 5) * 4; if (zz - Math.floor(zz) < 0.035) return dk(P.wood, 0.5);
  if (hash(u / 2, z * 140, 6) < 0.1) c = lt(c, 0.1); else if (hash(u / 2, z * 140, 7) < 0.06) c = dk(c, 0.15);
  const edge = 240 - Math.abs(u); if (edge < 16) c = dk(c, 0.4 * (1 - edge / 16));
  return c;
}
function ceilingShader(u, z) {
  const idx = Math.floor((u + 240) / 40), f = (u + 240) - idx * 40;
  let c = mc(P.woodD, P.wood, hash(idx, 0, 9) * 0.3);
  if (f < 1.5) c = dk(P.woodD, 0.4);
  return hash(u, z * 90, 3) < 0.07 ? lt(c, 0.12) : c;
}

// ── STATIC ROOM (painted once into its own canvas) ──────────────────
let room, rc, layer, lc;
// painted geometry is flushed onto the room canvas in layers, so billboard details (plants, pillows)
// can sit between pieces of furniture and be hidden by whatever is in front of them.
function flush() { lc.putImageData(img, 0, 0); rc.drawImage(layer, 0, 0); d.fill(0); }
export function buildRoom() {
  room = document.createElement('canvas'); room.width = W; room.height = H; rc = room.getContext('2d');
  layer = document.createElement('canvas'); layer.width = W; layer.height = H; lc = layer.getContext('2d');
  img = lc.createImageData(W, H); d = img.data;
  GLOWS.bulbs = [];
  // 1. the shell of the room, back wall and window
  paintV(270, -243, 243, -0.02, 1.0, 0.8, ceilingShader);
  paintV(0, -243, 243, -0.02, 1.0, 1, floorShader);
  paintZ(1, -243, 243, -2, 272, 1, (u, v) => (Math.abs(u) < WIN.u && v > WIN.v0 && v < WIN.v1 ? null : plaster(u, v)));
  paintU(-240, -0.02, 1.0, -3, 272, 0.82, (z, v) => plaster(z * 300, v));
  paintU(240, -0.02, 1.0, -3, 272, 0.82, (z, v) => plaster(z * 300 + 40, v));
  ceilingBeams(); windowParts(); backWallBits(); flush();
  // 2. things that sit against the back wall, behind the furniture
  backDecor(rc);
  // 3. furniture (far to near) and shelves
  sideShelves(); desk(); bed(); chair(); flush();
  // 4. details on top of the furniture, then foreground plants and lights
  frontDecor(rc);
}

function ceilingBeams() {
  for (const z of [0.22, 0.5, 0.78]) box(-240, 240, 262, 270, z, z + 0.035, wood(P.woodD, 11));
}

function windowParts() {
  const w = WIN.u, z0 = 0.985;
  // deep reveal around the window
  paintU(-w, 1.0, 1.1, WIN.v0, WIN.v1, 0.8, (z, v) => lt(P.woodL, 0.1 + hash(z * 200, v / 4, 2) * 0.1));
  paintU(w, 1.0, 1.1, WIN.v0, WIN.v1, 0.95, (z, v) => lt(P.woodL, 0.1 + hash(z * 200, v / 4, 3) * 0.1));
  paintV(WIN.v1, -w, w, 1.0, 1.1, 0.9, () => P.woodM);
  paintV(WIN.v0, -w, w, 1.0, 1.1, 1.3, () => lt(P.woodL, 0.2));
  // frame, mullion + transoms
  const fr = wood(P.woodM, 8);
  box(-w - 14, -w, WIN.v0 - 12, WIN.v1 + 12, z0 - 0.02, 1.0, fr); box(w, w + 14, WIN.v0 - 12, WIN.v1 + 12, z0 - 0.02, 1.0, fr);
  box(-w - 14, w + 14, WIN.v1, WIN.v1 + 12, z0 - 0.02, 1.0, fr);
  box(-4, 4, WIN.v0, WIN.v1, z0, 1.0, fr);
  for (const v of [112, 166]) box(-w, w, v, v + 6, z0, 1.0, fr);
  // sill (cat spot on top)
  box(-w - 28, w + 28, 46, 56, 0.9, 1.0, wood(P.woodL, 12));
  // sheer curtains on both sides
  const cur = (f, p, q, A, B) => { const k = 0.5 + 0.5 * Math.sin(p * 0.9); return mc(lt(P.lilac, 0.25), dk(P.lilac, 0.25), k * 0.7 + (1 - q / B) * 0.1); };
  box(-w - 42, -w - 8, 30, 255, 0.95, 0.975, cur); box(w + 8, w + 42, 30, 255, 0.95, 0.975, cur);
  box(-w - 50, w + 50, 252, 258, 0.93, 0.975, solid(P.woodD));
  // radiator under the window
  box(-95, 95, 14, 46, 0.94, 1.0, (f, p, q, A, B) => ((f === 'f' && Math.floor(p / 7) % 2 === 0) ? lt(P.blue, 0.15) : dk(P.blue, 0.2)));
}

function backWallBits() {
  // framed picture left of the window, mirror-ish frame right
  const frame = (u0, u1, v0, v1, art) => {
    box(u0 - 5, u1 + 5, v0 - 5, v1 + 5, 0.985, 1.0, wood(P.woodM, 5));
    paintZ(0.984, u0, u1, v0, v1, 1, (u, v) => art((u - u0) / (u1 - u0), (v - v0) / (v1 - v0)));
  };
  frame(-232, -208, 140, 186, (a, b) => { if (b < 0.45 + Math.sin(a * 6) * 0.08) return a > 0.5 ? P.slate : P.night; const t = 1 - (b - 0.45) * 1.5; const c = mc(P.peach, P.slate, 1 - t); return (Math.hypot(a - 0.68, b - 0.62) < 0.13) ? P.gold : c; });
}

function desk() {
  const top = 92, z0 = 0.16, z1 = 0.8;
  box(-240, -122, top - 8, top, z0, z1, wood(P.woodL, 13));                 // desktop
  box(-240, -132, 0, top - 8, 0.46, z1, wood(P.woodM, 14));                   // drawer unit
  // drawers on its side
  paintU(-132, 0.485, 0.795, 8, top - 11, 1, (z, v) => {
    const q = (v - 8) / 24, n = Math.floor(q), f = q - n, zz = (z - 0.485) / 0.31;
    if (n > 2 || n < 0) return null;
    if (f < 0.07 || zz < 0.03 || zz > 0.97) return dk(P.woodM, 0.45);
    if (Math.abs(zz - 0.5) < 0.12 && Math.abs(f - 0.5) < 0.1) return P.gold;
    return f > 0.88 ? lt(P.woodL, 0.2) : P.woodL;
  });
  for (const z of [z0 + 0.005, 0.5]) box(-128, -122, 0, top - 8, z, z + 0.022, wood(P.woodM, 15)); // front legs
  box(-240, -236, 0, top - 8, z0, z1, wood(P.woodM, 16));                    // back panel
  // laptop
  box(-218, -176, top, top + 3, 0.28, 0.5, solid(P.mauve));
  box(-218, -214, top + 3, top + 52, 0.28, 0.5, solid(P.mauve));
  paintU(-214, 0.288, 0.492, top + 6, top + 49, 1, (z, v) => {
    const a = (z - 0.288) / 0.204, b = (v - top - 6) / 43;
    if (b > 0.9) return a < 0.1 ? P.rose : a < 0.17 ? P.peach : a < 0.24 ? P.sky : [74, 88, 122];
    if (a > 0.55 && a < 0.9 && b > 0.12 && b < 0.45) { // sleepy cat icon
      return (b < 0.3 || (a > 0.72 && b < 0.45)) ? P.sky : [58, 69, 101]; }
    const row = Math.floor(b * 9);
    return (b > 0.15 && b < 0.82 && row % 2 === 0 && a > 0.08 && a < 0.1 + hash(row, 1, 3) * 0.4) ? (row % 4 ? P.blue : P.peach) : [58, 69, 101];
  });
  // mug, pencil cup, notebook
  box(-168, -158, top, top + 11, 0.545, 0.58, solid(P.cream)); box(-205, -197, top, top + 14, 0.52, 0.55, solid(P.sky));
  box(-210, -178, top, top + 2, 0.62, 0.74, solid(P.rose)); box(-208, -180, top + 2, top + 4, 0.63, 0.73, solid(P.cream));
  // shelf with books above the desk
  box(-240, -214, 152, 157, 0.22, 0.8, wood(P.woodM, 17));
  const rand = rng(21), cols = [P.rose, P.blue, P.peach, P.plum, P.leaf, P.cream, P.sky, P.pot];
  for (let z = 0.23; z < 0.5; z += 0.026) { const h = 14 + Math.floor(rand() * 12); box(-238, -224, 157, 157 + h, z, z + 0.022, solid(cols[Math.floor(rand() * cols.length)])); }
  // pinned corkboard + notes on the left wall
  paintU(-239.5, 0.3, 0.8, 104, 150, 1, (z, v) => {
    const a = (z - 0.3) / 0.5, b = (v - 104) / 46;
    if (a < 0.03 || a > 0.97 || b < 0.04 || b > 0.96) return P.woodD;
    const notes = [[0.08, 0.15, 0.22, 0.5, P.cream], [0.38, 0.1, 0.2, 0.3, P.peach], [0.62, 0.2, 0.3, 0.55, P.cream], [0.12, 0.65, 0.2, 0.25, P.rose], [0.45, 0.58, 0.22, 0.3, P.lilac]];
    for (const [na, nb, w, h, c] of notes) if (a > na && a < na + w && b > nb && b < nb + h) return (Math.floor(b * 30) % 3 === 0 && c === P.cream) ? P.blue : c;
    return hash(z * 300, v, 12) < 0.25 ? P.woodL : P.woodM;
  });
}

function chair() {
  const seat = 48;
  for (const [u, z] of [[-114, 0.42], [-82, 0.42], [-114, 0.6], [-82, 0.6]]) box(u, u + 5, 0, seat, z, z + 0.02, wood(P.woodD, 18));
  box(-120, -76, seat, seat + 7, 0.4, 0.64, (f, p, q, A, B) => { const e = Math.min(p, A - p, q, B - q); return e < 2 ? dk(P.rose, 0.25) : (f === 't' ? lt(P.rose, 0.2) : P.rose); });
  box(-80, -74, seat + 7, seat + 52, 0.4, 0.64, wood(P.woodM, 19));
  for (let v = seat + 14; v < seat + 48; v += 12) box(-80.5, -74, v, v + 5, 0.41, 0.63, wood(P.woodL, 20));
}

function bed() {
  const x0 = 112, x1 = 240, z0 = 0.2, z1 = 0.86, qz0 = 0.3, qz1 = 0.8;
  box(x0, x1, 0, 112, z1, z1 + 0.03, wood(P.woodM, 23));                        // headboard
  box(x0, x1, 12, 36, z0, z1, wood(P.woodM, 22));                               // slim frame
  box(x0 + 4, x1 - 2, 0, 12, z0 + 0.01, z0 + 0.04, solid(P.woodD)); box(x0 + 4, x1 - 2, 0, 12, z1 - 0.04, z1 - 0.01, solid(P.woodD));
  box(x0 + 5, x1 - 4, 36, 60, z0 + 0.02, z1 - 0.02, solid(P.cream));            // mattress
  const base = P.rose, qa = x0 + 1, qb = x1 - 1;
  // rumpled top: soft fold light/dark, quilting stitches, puffy edges
  paintV(70, qa, qb, qz0, qz1, 1.08, (u, z) => {
    const zz = z * ZS, n = Math.sin(u * 0.075 + z * 7) * 0.5 + Math.sin(u * 0.16 - zz * 0.05 + 1.3) * 0.3 + Math.sin(zz * 0.09 + u * 0.03) * 0.25;
    const ed = Math.min(u - qa, qb - u, zz - qz0 * ZS, qz1 * ZS - zz);
    if (ed < 3.5) { const cx = Math.min(u - qa, qb - u), cz = Math.min(zz - qz0 * ZS, qz1 * ZS - zz); if (cx < 3.5 && cz < 3.5 && Math.hypot(3.5 - cx, 3.5 - cz) > 3.5) return null; }
    let c = n > 0 ? lt(base, n * 0.3) : dk(base, -n * 0.28);
    if (Math.abs(((u + zz * 0.7) % 36) - 18) < 0.8 || Math.abs(((u - zz * 0.7) % 36) - 18) < 0.8) c = dk(c, 0.1);
    if (ed < 2) c = lt(c, 0.25);
    return hash(u, zz, 14) < 0.04 ? lt(c, 0.12) : c;
  });
  // draped side (toward the room) with a wavy hem
  paintU(qa, qz0, qz1, 30, 70, 0.9, (z, v) => {
    const zz = z * ZS, hem = 44 + Math.sin(zz * 0.16) * 4 + Math.sin(zz * 0.07 + 1) * 3;
    if (v < hem) return null; if (v < hem + 1.6) return dk(base, 0.5);
    const f = 0.5 + 0.5 * Math.sin(zz * 0.19 + 0.6 * Math.sin(v * 0.2));
    return mc(lt(base, 0.08), dk(base, 0.45), f * 0.45 + (70 - v) / 90);
  });
  // draped foot end
  paintZ(qz0, qa, qb, 30, 70, 1, (u, v) => {
    const hem = 42 + Math.sin(u * 0.13) * 4 + Math.sin(u * 0.05 + 2) * 3;
    if (v < hem) return null; if (v < hem + 1.6) return dk(base, 0.5);
    const f = 0.5 + 0.5 * Math.sin(u * 0.2 + 0.5 * Math.sin(v * 0.25));
    return mc(lt(base, 0.05), dk(base, 0.4), f * 0.4 + (70 - v) / 100);
  });
  // folded throw at the foot of the bed
  box(x0 + 6, x1 - 8, 70, 76, 0.32, 0.46, (f, p, q, A, B) => { const stripe = Math.floor(q / 6) % 2 ? P.peach : lt(P.peach, 0.2); return (f === 't' && p < 3) ? dk(P.peach, 0.2) : (f === 't' ? stripe : P.peach); });
}

const SHELVES = [{ v: 150, z0: 0.3, z1: 0.82 }, { v: 190, z0: 0.3, z1: 0.82 }];
function sideShelves() {
  for (const sh of SHELVES) {
    box(220, 240, sh.v, sh.v + 5, sh.z0, sh.z1, wood(P.woodM, 26));
    for (const z of [sh.z0 + 0.03, sh.z1 - 0.06]) box(228, 240, sh.v - 12, sh.v, z, z + 0.02, wood(P.woodD, 27)); // brackets
  }
  // a stack of books on the lower shelf
  const rand = rng(77), cols = [P.rose, P.blue, P.plum, P.leaf, P.cream, P.pot];
  for (let k = 0; k < 6; k++) box(228, 238, 195, 195 + 16 + Math.floor(rand() * 8), 0.33 + k * 0.022, 0.352 + k * 0.022, solid(cols[k % cols.length]));
  box(226, 238, 195, 199, 0.5, 0.62, solid(P.sky)); box(227, 238, 199, 203, 0.51, 0.61, solid(P.rose)); box(228, 237, 203, 206, 0.52, 0.6, solid(P.cream));
}

// ── billboard details: plants, pillows, lights (drawn onto the room between furniture layers) ──
const INK = hx('#1E3330');
function kit(c) {
  const col = (v) => (typeof v === 'string' ? v : hex(v));
  const R = (x, y, w, h, v) => { c.fillStyle = col(v); c.fillRect(Math.round(x), Math.round(y), Math.max(1, Math.round(w)), Math.max(1, Math.round(h))); };
  const disc = (cx, cy, rad, v) => { c.fillStyle = col(v); rad = Math.max(1, Math.round(rad)); for (let dy = -rad; dy <= rad; dy++) { const w = Math.floor(Math.sqrt(rad * rad - dy * dy + 0.5)); c.fillRect(Math.round(cx - w), Math.round(cy + dy), w * 2 + 1, 1); } };
  const ell = (cx, cy, rx, ry, v) => { c.fillStyle = col(v); for (let dy = -Math.round(ry); dy <= Math.round(ry); dy++) { const w = Math.floor(rx * Math.sqrt(Math.max(0, 1 - (dy * dy) / (ry * ry + 0.5)))); c.fillRect(Math.round(cx - w), Math.round(cy + dy), w * 2 + 1, 1); } };
  // one outlined, shaded leaf pointing from (cx,cy) along angle `ang`
  const leaf = (cx, cy, len, wid, ang, tones, style = 'oval') => {
    const ca = Math.cos(ang), sa = Math.sin(ang), Rr = len + wid + 2;
    for (let y = Math.floor(cy - Rr); y <= cy + Rr; y++) for (let x = Math.floor(cx - Rr); x <= cx + Rr; x++) {
      const dx = x + 0.5 - cx, dy = y + 0.5 - cy, a = dx * ca + dy * sa, b = -dx * sa + dy * ca;
      if (a < 0 || a > len) continue;
      const t = a / len, w = wid * Math.pow(Math.sin(Math.PI * Math.min(1, t * 0.9 + 0.05)), style === 'bird' ? 0.55 : 0.75), ab = Math.abs(b);
      if (ab > w) continue;
      if (style === 'monstera' && t > 0.3 && ab > w * 0.4 && ((a * 0.55 + (b > 0 ? 1.5 : 0)) % 3) < 0.9) continue;
      let v = tones[1];
      if (ab > w - 1.1) v = INK; else if (ab < 0.7) v = tones[0]; else if (b < -w * 0.25) v = tones[2];
      c.fillStyle = col(v); c.fillRect(x, y, 1, 1);
    }
  };
  // round pot with rim, outline and a lit side
  const pot = (x, y, w, h, v) => {
    for (let r = 0; r < h; r++) {
      const ww = Math.round(w * (0.74 + 0.26 * (1 - r / h)) * (r < 3 ? 1.12 : 1)), x0 = Math.round(x - ww / 2);
      R(x0, y - h + r, ww, 1, r < 3 ? lt(v, 0.2) : v); R(x0, y - h + r, 1, 1, INK); R(x0 + ww - 1, y - h + r, 1, 1, INK);
      if (r >= 3) { R(x0 + 1, y - h + r, Math.max(1, ww * 0.22), 1, lt(v, 0.18)); R(x0 + ww - Math.max(2, ww * 0.25), y - h + r, Math.max(1, ww * 0.22), 1, dk(v, 0.25)); }
    }
    R(Math.round(x - w * 0.56), y - h, Math.round(w * 1.12), 1, INK); R(Math.round(x - w * 0.37), y - 1, Math.round(w * 0.74), 1, INK);
    R(Math.round(x - w * 0.5), y - h + 1, Math.round(w), 1, dk(P.woodD, 0.1));
  };
  const GREENS = [[hx('#5E8F6E'), hx('#4F7A68'), hx('#86AA86')], [hx('#6FA070'), hx('#558A5E'), hx('#9CC48A')], [hx('#4F7A68'), hx('#3E6658'), hx('#7FA383')]];
  const plant = (x, y, sc, kind, potCol, seed = 1) => {
    const rand = rng(seed), pw = 15 * sc, ph = 13 * sc, tones = GREENS[seed % 3];
    pot(x, y, pw, ph, potCol);
    const top = y - ph;
    if (kind === 'bird') { [[-0.95, 26, 6], [0.9, 24, 6], [-0.35, 36, 7], [0.4, 38, 7], [0.02, 44, 7]].forEach(([a, l, w]) => leaf(x, top, l * sc, w * sc * 0.55, -Math.PI / 2 + a * 0.9, tones, 'bird')); }
    else if (kind === 'monstera') { [[-1.3, 22, 9], [1.25, 22, 9], [-0.7, 30, 11], [0.7, 30, 11], [0.05, 34, 12]].forEach(([a, l, w]) => leaf(x, top, l * sc, w * sc * 0.6, -Math.PI / 2 + a, tones, 'monstera')); }
    else { for (let i = 0; i < 6; i++) { const a = -1.25 + i * 0.5 + (rand() - 0.5) * 0.2, l = (16 + rand() * 10) * sc; leaf(x, top, l, 6 * sc * 0.85, -Math.PI / 2 + a, tones, 'oval'); } }
  };
  // vines that trail down from a pot (small paired leaves)
  const trail = (x, y, n, len, seed) => { const rand = rng(seed); for (let i = 0; i < n; i++) { const vx = x - 8 + (i / Math.max(1, n - 1)) * 16, vl = len * (0.5 + rand() * 0.6); R(vx, y, 1, vl, INK); for (let k = 3; k < vl; k += 4) { disc(vx - 1, y + k, 1.4, k % 8 < 4 ? P.leaf : P.leafL); disc(vx + 2, y + k + 2, 1.4, P.leaf); } } };
  const pillow = (u, v, z, v0, sc) => { const [x, y, s] = proj(u, v, z), rx = 24 * s * sc, ry = 11 * s * sc; ell(x, y + 2 * s, rx + 1, ry + 1, INK); ell(x, y, rx, ry, v0); ell(x - 4 * s, y - 3 * s, rx * 0.65, ry * 0.5, lt(v0, 0.4)); R(x - rx * 0.5, y + ry * 0.35, rx * 0.9, 1, dk(v0, 0.2)); R(x + rx * 0.3, y - ry * 0.2, 1, ry * 0.7, dk(v0, 0.15)); };
  return { R, disc, ell, leaf, pot, plant, trail, pillow };
}

function backDecor(c) {
  const k = kit(c);
  // sill: plants (the cat sits in the middle) + a neat stack of books at the right end
  { const [x, y, s] = proj(-115, 56, 0.95); k.plant(x, y, s * 1.1, 'fiddle', P.pot, 1); }
  { const [x, y, s] = proj(-78, 56, 0.95); k.plant(x, y, s * 0.9, 'bird', P.cream, 2); }
  { const [x, y, s] = proj(66, 56, 0.95), w = 40 * s * 1.4; k.R(x - w / 2, y - 7 * s * 1.5, w, 7 * s * 1.5, P.rose); k.R(x - w / 2 + 2, y - 14 * s * 1.5, w - 4, 7 * s * 1.5, P.sky); k.R(x - w / 2 + 1, y - 20 * s * 1.5, w - 2, 6 * s * 1.5, P.cream); k.R(x - w / 2, y - 7 * s * 1.5, w, 1, dk(P.rose, 0.4)); k.R(x - w / 2 + 2, y - 14 * s * 1.5, w - 4, 1, dk(P.sky, 0.4)); }
  // hanging planters, right of the window
  for (const [u, v, n, seed] of [[205, 236, 20, 3], [232, 205, 24, 4], [205, 182, 22, 5]]) {
    const [x, y, s] = proj(u, v, 0.99), top = proj(u, 270, 0.99)[1];
    k.R(x, top, 1, y - top - 10 * s * 1.5, P.woodD); k.pot(x, y + 8 * s * 1.5, 18 * s * 1.5, 12 * s * 1.5, P.pot);
    const rand = rng(seed); for (let i = 0; i < 7; i++) k.leaf(x, y - 3, (8 + rand() * 6) * s * 1.5, 4 * s * 1.5, -Math.PI / 2 + (i - 3) * 0.5, GREENS_BACK[i % 3]);
    k.trail(x, y + 7 * s * 1.5, 5, n * s * 1.5, seed);
  }
  // tall plant in the back-left corner, standing clear of the desk
  { const [x, y, s] = proj(-212, 0, 0.95); k.plant(x, y, s * 1.5, 'bird', P.rose, 5); }
}
const GREENS_BACK = [[hx('#5E8F6E'), hx('#4F7A68'), hx('#86AA86')], [hx('#6FA070'), hx('#558A5E'), hx('#9CC48A')], [hx('#4F7A68'), hx('#3E6658'), hx('#7FA383')]];

function frontDecor(c) {
  const k = kit(c), { R, disc, ell } = k;
  // shelves: plants, books already placed; fairy lights along the edges
  const shelfPlants = [[0, 0.36, 'monstera', P.pot], [0, 0.5, 'fiddle', P.cream], [0, 0.64, 'bird', P.pot], [0, 0.78, 'fiddle', P.rose]];
  shelfPlants.forEach(([, z, kind, pc], i) => { const [x, y, s] = proj(231, 155, z); k.plant(x, y, s * 0.62, kind, pc, i + 1); });
  { const [x, y, s] = proj(231, 195, 0.72); k.plant(x, y, s * 0.6, 'fiddle', P.pot, 7); k.trail(x - 2, y - 2, 4, 20 * s, 8); }
  { const [x, y, s] = proj(-231, 157, 0.7); k.plant(x, y, s * 0.6, 'fiddle', P.pot, 4); k.trail(x, y - 3, 4, 18 * s, 9); }
  { const [x, y, s] = proj(-231, 157, 0.78); k.plant(x, y, s * 0.55, 'bird', P.cream, 6); }
  // plant on the desk, by the laptop
  { const [x, y, s] = proj(-190, 92, 0.36); k.plant(x, y, s * 0.55, 'fiddle', P.cream, 3); }
  // pillows + plush on the bed
  k.pillow(168, 76, 0.8, P.cream, 1.25); k.pillow(212, 80, 0.81, P.peach, 1.1);
  { const [x, y, s] = proj(138, 72, 0.42), q = s * 1.4; ell(x, y - 6 * q, 8 * q, 7 * q, INK); ell(x, y - 6 * q, 7 * q, 6 * q, P.woodM); ell(x - 1, y - 7 * q, 4 * q, 4 * q, P.woodL); disc(x - 5 * q, y - 12 * q, 3 * q, P.woodM); disc(x + 5 * q, y - 12 * q, 3 * q, P.woodM); R(x - 2 * q, y - 10 * q, 1, 1, INK); R(x + 2 * q, y - 10 * q, 1, 1, INK); }
  // desk lamp (articulated)
  { const [x, y, s] = proj(-208, 92, 0.76), q = s * 1.5; c.strokeStyle = hex(P.slate); c.lineWidth = Math.max(2, 2.5 * q);
    R(x - 9 * q, y - 3 * q, 18 * q, 3 * q, P.slate); c.beginPath(); c.moveTo(x, y - 3 * q); c.lineTo(x - 10 * q, y - 28 * q); c.lineTo(x + 8 * q, y - 42 * q); c.stroke();
    ell(x + 12 * q, y - 42 * q, 11 * q, 5 * q, P.mauve); ell(x + 12 * q, y - 39 * q, 8 * q, 2 * q, '#FFF1D6'); GLOWS.lamp = [x + 12 * q, y - 36 * q]; }
  { const [x, y] = proj(-214, 125, 0.39); GLOWS.laptop = [x, y]; }
  // floor bowls
  { const [x, y, s] = proj(60, 0, 0.62), q = s * 1.5; R(x - 8 * q, y - 4 * q, 16 * q, 4 * q, P.cream); R(x - 6 * q, y - 5 * q, 12 * q, 2 * q, P.pot); const [x2, y2] = proj(95, 0, 0.62); R(x2 - 6 * q, y2 - 3 * q, 12 * q, 3 * q, P.sky); }
  // string lights: along the ceiling edge, and swagged along both shelves
  const bulbs = [];
  const swag = (pt, n, glow = true) => { let prev = null; for (let i = 0; i <= 60; i++) { const [x, y] = pt(i / 60); if (prev) { c.strokeStyle = hex(P.woodD); c.lineWidth = 1; c.beginPath(); c.moveTo(prev[0], prev[1]); c.lineTo(x, y); c.stroke(); } prev = [x, y]; } for (let i = 1; i < n; i++) { const [x, y] = pt(i / n); R(x, y, 1, 3, INK); disc(x, y + 5, 2, P.gold); R(x - 1, y + 4, 1, 1, '#FFF3E6'); if (glow) bulbs.push([x, y + 5]); } };
  swag((t) => { const [x, y] = proj(-240 + 480 * t, 252 - Math.sin(t * Math.PI * 3) * 6, 0.99); return [x, y + 5]; }, 14);
  swag((t) => { const [x, y] = proj(-240, 258 - Math.sin(t * Math.PI * 2) * 7, 0.02 + t * 0.96); return [x, y]; }, 7);
  swag((t) => { const [x, y] = proj(240, 258 - Math.sin(t * Math.PI * 2) * 7, 0.02 + t * 0.96); return [x, y]; }, 7);
  for (const sh of SHELVES) swag((t) => { const [x, y] = proj(221, sh.v + 3 - Math.sin(t * Math.PI * 3) * 2, sh.z0 + (sh.z1 - sh.z0) * t); return [x, y]; }, 8);
  GLOWS.bulbs = bulbs;
}

// ── DYNAMIC: what's outside the window ──────────────────────────────────
const LEAVES = {
  spring: ['#34524F', '#5E8F6E', '#A6C98A'],
  summer: ['#2C4A47', '#4F7A68', '#86AA86'],
  autumn: ['#7E3A33', '#C0703F', '#E8A857'],
};
const treeCache = {};
function trees(season) {
  if (treeCache[season]) return treeCache[season];
  const g = GLASS, cv = document.createElement('canvas'); cv.width = g.w; cv.height = g.h;
  const t = cv.getContext('2d');
  const R = (x, y, w, h, c) => { t.fillStyle = c; t.fillRect(Math.round(x), Math.round(y), w, h); };
  const disc = (cx, cy, rad, c) => { t.fillStyle = c; for (let dy = -rad; dy <= rad; dy++) { const w = Math.floor(Math.sqrt(rad * rad - dy * dy + 0.5)); t.fillRect(Math.round(cx - w), Math.round(cy + dy), w * 2 + 1, 1); } };
  const line = (x0, y0, x1, y1, c, th = 1) => { t.fillStyle = c; const n = Math.max(Math.abs(x1 - x0), Math.abs(y1 - y0)) || 1; for (let i = 0; i <= n; i++) t.fillRect(Math.round(x0 + ((x1 - x0) * i) / n), Math.round(y0 + ((y1 - y0) * i) / n), th, th); };
  const trunk = (x, base, top, w, lean, seed) => {
    for (let y = top; y <= base; y++) { const off = Math.round(((base - y) / (base - top)) * lean); R(x + off, y, w, 1, '#3A2C38'); R(x + off, y, 1, 1, '#5A4350'); }
    const rand = rng(seed), n = season === 'winter' ? 6 : 3;
    for (let i = 0; i < n; i++) { const by = top + 3 + i * ((base - top) * 0.55 / n), dir = i % 2 ? 1 : -1, len = 10 + rand() * 16; line(x + w / 2, by, x + w / 2 + dir * len, by - len * 0.6, '#3A2C38', 2); if (season === 'winter') { line(x + w / 2 + dir * len, by - len * 0.6, x + w / 2 + dir * (len + 7), by - len * 0.6 - 6, '#3A2C38'); R(x + w / 2 + dir * len - 2, by - len * 0.6 - 2, 6, 2, '#E8EEF4'); } }
    if (season === 'winter') R(x - 1, top - 1, w + 2, 2, '#E8EEF4');
  };
  const crown = (cx, cy, rx, ry, seed) => {
    if (season === 'winter') return;
    const [dkc, mdc, ltc] = LEAVES[season], rand = rng(seed), blobs = [];
    for (let i = 0; i < 22; i++) { const a = rand() * 6.28, dd = Math.sqrt(rand()); blobs.push([cx + Math.cos(a) * dd * rx, cy + Math.sin(a) * dd * ry, 6 + rand() * 7]); }
    blobs.forEach(([x, y, r]) => disc(x, y + 3, Math.round(r), '#1E3330'));
    blobs.forEach(([x, y, r]) => disc(x, y + 2, Math.round(r) - 1, dkc));
    for (let i = 0; i < 6; i++) { const bx = cx + (rand() - 0.5) * rx, by = cy + 6 + rand() * ry * 0.7; line(cx, cy + ry, bx, by, '#5A4350', 2); }
    blobs.forEach(([x, y, r]) => disc(x, y, Math.round(r) - 1, mdc));
    blobs.forEach(([x, y, r]) => { disc(x - 2, y - 3, Math.round(r * 0.55), ltc); });
    for (let i = 0; i < 140; i++) { const a = rand() * 6.28, dd = 0.7 + rand() * 0.5, x = cx + Math.cos(a) * rx * dd, y = cy + Math.sin(a) * ry * dd; R(x, y, 2, 2, rand() > 0.55 ? ltc : (a < 3.3 && a > 0.3 ? dkc : mdc)); }
    t.fillStyle = '#F6F3B8'; for (let i = 0; i < 12; i++) t.fillRect(Math.round(cx + (rand() - 0.5) * rx * 1.5), Math.round(cy + (rand() - 0.7) * ry * 1.2), 2, 2); // sunlit sparkles
    t.globalCompositeOperation = 'destination-out'; for (let i = 0; i < 10; i++) t.fillRect(Math.round(cx + (rand() - 0.5) * rx * 1.4), Math.round(cy + (rand() - 0.3) * ry * 1.2), 2, 2); t.globalCompositeOperation = 'source-over'; // little gaps where the sky peeks through
    if (season === 'spring') for (let i = 0; i < 50; i++) { const a = rand() * 6.28, dd = Math.sqrt(rand()); R(cx + Math.cos(a) * dd * rx, cy + Math.sin(a) * dd * ry, 2, 2, rand() > 0.5 ? '#F2C1A3' : '#F8E0D0'); }
  };
  trunk(g.w - 42, g.h + 4, 20, 11, -4, 11); crown(g.w - 44, 34, 38, 28, 11);
  trunk(8, g.h + 4, 60, 5, 2, 5); crown(12, 66, 20, 14, 5);
  return (treeCache[season] = cv);
}

function drawSky(c, look, hour, time) {
  const g = GLASS;
  c.save(); c.beginPath(); c.rect(g.x, g.y, g.w, g.h); c.clip();
  const rr = (x, y, w, h, col) => { c.fillStyle = col; c.fillRect(Math.round(x), Math.round(y), w, h); };
  const disc = (cx, cy, rad, col) => { c.fillStyle = col; for (let dy = -rad; dy <= rad; dy++) { const w = Math.floor(Math.sqrt(rad * rad - dy * dy + 0.5)); c.fillRect(Math.round(cx - w), Math.round(cy + dy), w * 2 + 1, 1); } };
  const ell = (cx, cy, rx, ry, col) => { c.fillStyle = col; for (let dy = -Math.round(ry); dy <= Math.round(ry); dy++) { const w = Math.floor(rx * Math.sqrt(Math.max(0, 1 - (dy * dy) / (ry * ry + 0.5)))); c.fillRect(Math.round(cx - w), Math.round(cy + dy), w * 2 + 1, 1); } };
  for (let y = 0; y < g.h; y += 2) rr(g.x, g.y + y, g.w, 2, mixHex(look.top, look.bot, Math.pow(y / g.h, 0.85)));
  if (look.stars > 0.02) { const rand = rng(7); for (let i = 0; i < 40; i++) { const sx = g.x + 3 + rand() * (g.w - 6), sy = g.y + 3 + rand() * (g.h * 0.65), big = rand() > 0.8; c.fillStyle = rgba('#F8F4EE', look.stars * (big ? 0.95 : 0.6)); c.fillRect(Math.round(sx), Math.round(sy), big ? 2 : 1, big ? 2 : 1); } }
  const arc = (p) => ({ x: g.x + 14 + p * (g.w - 28), y: g.y + g.h - 14 - Math.sin(p * Math.PI) * (g.h - 34) });
  const sp = (hour - 6) / 12;
  if (sp > -0.1 && sp < 1.1) { const s = arc(sp); disc(s.x, s.y, 14, rgba('#F8CCAA', 0.18)); disc(s.x, s.y, 10, rgba('#F8CCAA', 0.35)); disc(s.x, s.y, 7, '#F8CCAA'); disc(s.x, s.y, 5, '#FFF1D6'); }
  const mp = (((hour - 18) % 24 + 24) % 24) / 12;
  if (mp > -0.1 && mp < 1.1) { const m = arc(mp); disc(m.x, m.y, 12, rgba('#BEB3C3', 0.15)); disc(m.x, m.y, 7, '#EDE7EE'); disc(m.x + 3, m.y - 2, 6, mixHex(look.top, look.bot, (m.y - g.y) / g.h)); }
  const haze = mixHex(look.bot, look.top, 0.25);
  for (let x = 0; x < g.w; x++) { const h1 = 13 + Math.sin(x * 0.05) * 5 + Math.sin(x * 0.12) * 2, h2 = 7 + Math.sin(x * 0.07 + 2) * 4; rr(g.x + x, g.y + g.h - h1, 1, h1, mixHex(haze, '#7C8DA6', 0.35)); rr(g.x + x, g.y + g.h - h2, 1, h2, mixHex(haze, '#34524F', 0.45)); }
  const cloud = mixHex(look.bot, '#FFFFFF', 0.5), shade = mixHex(look.bot, look.top, 0.2);
  [[10, 24, 0.5, 1], [80, 48, 0.3, 0.8], [-30, 66, 0.4, 1.1]].forEach(([ox, oy, sp2, s]) => {
    const cx = g.x + ((ox + time * sp2 * 1.5) % (g.w + 100)) - 40, cy = g.y + oy, parts = [[0, 6, 40], [10, 0, 26], [24, 3, 28], [32, 8, 24]];
    parts.forEach(([dx, dy, w]) => ell(cx + dx * s, cy + dy * s + 2, (w / 2) * s, 5 * s, shade)); parts.forEach(([dx, dy, w]) => ell(cx + dx * s, cy + dy * s, (w / 2) * s, 5 * s, cloud));
  });
  c.restore();
}

export function drawOutside(c, look, hour, season, time) { drawSky(c, look, hour, time); c.drawImage(trees(season), GLASS.x, GLASS.y); }

// ── DYNAMIC: light on top of everything ──────────────────────────────────
function lightEllipse(c, cx, cy, rx, ry) {
  for (let dy = -Math.round(ry); dy <= Math.round(ry); dy++) { const w = Math.floor(rx * Math.sqrt(Math.max(0, 1 - (dy * dy) / (ry * ry + 0.5)))); c.fillRect(Math.round(cx - w), Math.round(cy + dy), w * 2 + 1, 1); }
}
const polygon = (c, pts) => { c.beginPath(); pts.forEach(([x, y], i) => (i ? c.lineTo(x, y) : c.moveTo(x, y))); c.closePath(); c.fill(); };
export function drawLight(c, look) {
  const dk2 = 1 - look.sun;
  // the two window panes cast soft shafts across the floor and onto the bed
  const beam = look.sun > 0.3 ? look.sun * 0.11 : 0.05 * dk2;
  c.fillStyle = rgba(look.sun > 0.3 ? '#FFF1D6' : '#BEB3C3', beam);
  for (const [a, b] of [[-140, -10], [10, 140]]) polygon(c, [proj(a, 0, 0.99), proj(b, 0, 0.99), proj(b * 1.25 + 40, 0, 0.5), proj(a * 1.25 + 40, 0, 0.5)]);
  if (look.sun > 0.3) { c.fillStyle = rgba('#FFF1D6', look.sun * 0.18); for (const [a, b] of [[122, 154], [166, 198]]) polygon(c, [proj(a, 70, 0.4), proj(b, 70, 0.4), proj(b, 70, 0.78), proj(a, 70, 0.78)]); }
  if (dk2 > 0.05) {
    const [lx, ly] = GLOWS.lamp, [px, py] = GLOWS.laptop;
    for (let i = 7; i >= 1; i--) { c.fillStyle = rgba('#F8CCAA', 0.035 * dk2); lightEllipse(c, lx, ly + 6, i * 11, i * 9); }
    for (let i = 4; i >= 1; i--) { c.fillStyle = rgba('#89A2BA', 0.05 * dk2); lightEllipse(c, px, py, i * 9, i * 8); }
    GLOWS.bulbs.forEach(([x, y]) => { for (let i = 3; i >= 1; i--) { c.fillStyle = rgba('#F8CCAA', 0.09 * dk2); lightEllipse(c, x, y, i * 3, i * 3); } });
  }
}

export function drawScene(c, look, hour, season, time, drawCat) {
  c.clearRect(0, 0, W, H);
  drawOutside(c, look, hour, season, time);
  c.drawImage(room, 0, 0);
  const r = (x, y, w, h, col) => { c.fillStyle = col; c.fillRect(Math.round(x), Math.round(y), w, h); };
  drawCat?.(c, r);
  c.fillStyle = rgba(look.tint, look.tintA); c.fillRect(0, 0, W, H);
  drawLight(c, look);
}
