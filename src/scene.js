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
  bed:  spot(178, 70, 0.55),
  sill: spot(70, 56, 0.94),
  desk: spot(-190, 92, 0.72),
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
let room;
export function buildRoom() {
  room = document.createElement('canvas'); room.width = W; room.height = H;
  const c = room.getContext('2d');
  img = c.createImageData(W, H); d = img.data;

  // structure: ceiling, floor, back wall (with a window-shaped hole), side walls
  paintV(270, -243, 243, -0.02, 1.0, 0.8, ceilingShader);
  paintV(0, -243, 243, -0.02, 1.0, 1, floorShader);
  paintZ(1, -243, 243, -2, 272, 1, (u, v) => (Math.abs(u) < WIN.u && v > WIN.v0 && v < WIN.v1 ? null : plaster(u, v)));
  paintU(-240, -0.02, 1.0, -3, 272, 0.82, (z, v) => plaster(z * 300, v));
  paintU(240, -0.02, 1.0, -3, 272, 0.82, (z, v) => plaster(z * 300 + 40, v));

  ceilingBeams(); windowParts(); backWallBits(); desk(); chair(); bed(); sideWallDecor();
  c.putImageData(img, 0, 0);
  decorations(c);
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
  frame(-228, -186, 150, 200, (a, b) => { if (b < 0.45 + Math.sin(a * 6) * 0.08) return a > 0.5 ? P.slate : P.night; const t = 1 - (b - 0.45) * 1.5; const c = mc(P.peach, P.slate, 1 - t); return (Math.hypot(a - 0.68, b - 0.62) < 0.13) ? P.gold : c; });
}

function desk() {
  const top = 92, z0 = 0.16, z1 = 0.9;
  box(-240, -122, top - 8, top, z0, z1, wood(P.woodL, 13));                 // desktop
  box(-240, -132, 0, top - 8, 0.52, z1, wood(P.woodM, 14));                   // drawer unit
  // drawers on its side
  paintU(-132, 0.545, 0.885, 8, top - 11, 1, (z, v) => {
    const q = (v - 8) / 24, n = Math.floor(q), f = q - n, zz = (z - 0.545) / 0.34;
    if (n > 2 || n < 0) return null;
    if (f < 0.07 || zz < 0.03 || zz > 0.97) return dk(P.woodM, 0.45);
    if (Math.abs(zz - 0.5) < 0.12 && Math.abs(f - 0.5) < 0.1) return P.gold;
    return f > 0.88 ? lt(P.woodL, 0.2) : P.woodL;
  });
  for (const z of [z0 + 0.005, 0.5]) box(-128, -122, 0, top - 8, z, z + 0.022, wood(P.woodM, 15)); // front legs
  box(-240, -236, 0, top - 8, z0, z1, wood(P.woodD, 16));                    // back panel
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
  box(-210, -178, top, top + 2, 0.7, 0.83, solid(P.rose)); box(-208, -180, top + 2, top + 4, 0.71, 0.82, solid(P.cream));
  // shelf with books above the desk
  box(-240, -214, 152, 157, 0.22, 0.86, wood(P.woodM, 17));
  const rand = rng(21), cols = [P.rose, P.blue, P.peach, P.plum, P.leaf, P.cream, P.sky, P.pot];
  for (let z = 0.23; z < 0.62; z += 0.026) { const h = 14 + Math.floor(rand() * 12); box(-238, -224, 157, 157 + h, z, z + 0.022, solid(cols[Math.floor(rand() * cols.length)])); }
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
  const x0 = 108, x1 = 240, z0 = 0.2, z1 = 0.9;
  box(x0, x1, 0, 104, z1, z1 + 0.03, wood(P.woodM, 23));                        // headboard
  box(x0, x1, 10, 38, z0, z1, wood(P.woodM, 22));                              // frame
  box(x0 + 4, x1 - 2, 0, 10, z0 + 0.01, z0 + 0.04, solid(P.woodD)); box(x0 + 4, x1 - 2, 0, 10, z1 - 0.04, z1 - 0.01, solid(P.woodD)); // feet
  box(x0 + 6, x1 - 4, 38, 62, z0 + 0.02, z1 - 0.02, solid(P.cream));            // mattress
  // quilt: folds on the sides, patchwork on top, cream hem at the foot
  box(x0 + 2, x1 - 2, 38, 70, 0.3, 0.84, (f, p, q, A, B) => {
    const fold = 0.5 + 0.5 * Math.sin(p * 0.13 + (f === 'f' ? 0 : 1));
    if (f === 't') {
      const gx = Math.floor(p / 22), gz = Math.floor(q / 22), cell = (gx + gz) % 2 === 0 ? P.rose : lt(P.rose, 0.22);
      let c = (gx * 2 + gz) % 5 === 0 ? P.peach : (gx + gz * 3) % 7 === 0 ? P.lilac : cell;
      return (p % 22 < 1.3 || q % 22 < 1.3) ? dk(c, 0.22) : (hash(p, q, 14) < 0.05 ? lt(c, 0.12) : c);
    }
    return mc(lt(P.rose, 0.05), dk(P.rose, 0.3), fold * 0.4 + (1 - q / B) * 0.2);
  });
  box(x0, x1, 0, 46, z0, z0 + 0.025, wood(P.woodM, 24));                        // low footboard
}

function sideWallDecor() {
  // right wall: shelf + pictures above the bed
  box(228, 240, 150, 155, 0.3, 0.88, wood(P.woodM, 26));
  const art = [(a, b) => (b < 0.5 ? mc(P.lilac, P.peach, b * 1.5) : (b < 0.55 + Math.sin(a * 9) * 0.1 ? P.blue : P.slate)), (a, b) => (b < 0.5 + Math.sin(a * 7) * 0.1 ? mc(P.slate, P.peach, b) : P.night)];
  [[0.34, 0.5, 170, 222, 0], [0.56, 0.74, 176, 220, 1]].forEach(([za, zb, v0, v1, i]) => {
    paintU(239.2, za - 0.02, zb + 0.02, v0 - 4, v1 + 4, 1, () => P.woodM);
    paintU(239.0, za, zb, v0, v1, 1, (z, v) => art[i]((z - za) / (zb - za), (v - v0) / (v1 - v0)));
  });
}

// ── billboard details: plants, cushions, lights (drawn onto the finished room) ──
function decorations(c) {
  const R = (x, y, w, h, col) => { c.fillStyle = typeof col === 'string' ? col : hex(col); c.fillRect(Math.round(x), Math.round(y), Math.max(1, Math.round(w)), Math.max(1, Math.round(h))); };
  const disc = (cx, cy, rad, col) => { c.fillStyle = typeof col === 'string' ? col : hex(col); rad = Math.max(1, Math.round(rad)); for (let dy = -rad; dy <= rad; dy++) { const w = Math.floor(Math.sqrt(rad * rad - dy * dy + 0.5)); c.fillRect(Math.round(cx - w), Math.round(cy + dy), w * 2 + 1, 1); } };
  const ell = (cx, cy, rx, ry, col) => { c.fillStyle = typeof col === 'string' ? col : hex(col); for (let dy = -Math.round(ry); dy <= Math.round(ry); dy++) { const w = Math.floor(rx * Math.sqrt(Math.max(0, 1 - (dy * dy) / (ry * ry + 0.5)))); c.fillRect(Math.round(cx - w), Math.round(cy + dy), w * 2 + 1, 1); } };
  const leafPlant = (u, z, h, n, seed, potCol = P.pot) => {
    const [x, y, s] = proj(u, 0, z), rand = rng(seed), pw = 16 * s * 1.6, ph = 15 * s * 1.6;
    ell(x, y - 1, pw * 0.8, 3 * s, rgba('#2A2230', 0.3) && '#3a2c38');
    R(x - pw / 2, y - ph, pw, ph, potCol); R(x - pw / 2 - 1, y - ph - 2, pw + 2, 3, lt(potCol, 0.2)); R(x - pw / 2, y - 3, pw, 2, dk(potCol, 0.3));
    for (let i = 0; i < n; i++) {
      const a = -1.25 + (i / (n - 1)) * 2.5 + (rand() - 0.5) * 0.2, len = h * s * (0.6 + rand() * 0.5), x1 = x + Math.sin(a) * len, y1 = y - ph - Math.cos(a) * len;
      c.strokeStyle = hex(P.leafD); c.lineWidth = Math.max(1, s * 1.3); c.beginPath(); c.moveTo(x, y - ph); c.lineTo(x1, y1); c.stroke();
      ell(x1, y1, 10 * s * 1.3, 5 * s * 1.3, P.leaf); ell(x1 - 1, y1 - 1, 7 * s * 1.3, 3 * s * 1.3, P.leafL);
    }
  };
  leafPlant(-205, 0.06, 70, 11, 41);      // big leafy plant framing the front-left corner
  leafPlant(-215, 0.95, 46, 8, 33, P.rose); // small one in the back-left corner
  // sill: cactus, succulent, books
  const sillPlant = (u, col, tall) => { const [x, y, s] = proj(u, 56, 0.95); R(x - 6 * s * 1.5, y - 9 * s * 1.5, 12 * s * 1.5, 9 * s * 1.5, col); R(x - 2 * s * 1.5, y - (9 + tall) * s * 1.5, 4 * s * 1.5, tall * s * 1.5, P.leaf); R(x - 6 * s * 1.5, y - (6 + tall * 0.7) * s * 1.5, 4 * s * 1.5, 3 * s * 1.5, P.leaf); R(x + 3 * s * 1.5, y - (6 + tall * 0.5) * s * 1.5, 4 * s * 1.5, 3 * s * 1.5, P.leaf); };
  sillPlant(-95, P.pot, 20); sillPlant(-60, P.cream, 9);
  const [bx, by, bs] = proj(105, 56, 0.95);
  R(bx - 22 * bs, by - 5 * bs * 1.5, 44 * bs, 5 * bs * 1.5, P.rose); R(bx - 20 * bs, by - 10 * bs * 1.5, 40 * bs, 5 * bs * 1.5, P.sky); R(bx - 21 * bs, by - 14 * bs * 1.5, 42 * bs, 4 * bs * 1.5, P.cream);
  // hanging planters (right of window) on the back wall
  for (const [u, v, n] of [[205, 232, 18], [205, 190, 22], [235, 215, 16]]) {
    const [x, y, s] = proj(u, v, 0.99), rand = rng(u + v);
    R(x, proj(u, 270, 0.99)[1], 1, y - proj(u, 270, 0.99)[1], P.woodD);
    ell(x, y + 3 * s, 11 * s * 1.5, 6 * s * 1.5, P.pot); ell(x, y, 11 * s * 1.5, 3 * s * 1.5, P.woodD);
    for (let i = 0; i < 12; i++) disc(x + (rand() - 0.5) * 20 * s * 1.5, y - 2 + (rand() - 0.5) * 5, 2.5 * s * 1.5, i % 3 ? P.leaf : P.leafL);
    for (let i = 0; i < 5; i++) { const vx = x - 9 * s * 1.5 + i * 4.5 * s * 1.5, vl = n * s * (0.5 + rand() * 0.6); R(vx, y + 5 * s * 1.5, 1, vl, P.leafD); for (let k = 3; k < vl; k += 4) { R(vx - 1, y + 5 * s * 1.5 + k, 2, 1, P.leaf); R(vx + 1, y + 7 * s * 1.5 + k, 1, 1, P.leafL); } }
  }
  // pillows + plush on the bed
  const pillow = (u, v, z, col, sc) => { const [x, y, s] = proj(u, v, z); ell(x, y + 2 * s, 26 * s * sc, 11 * s * sc, dk(col, 0.3)); ell(x, y, 26 * s * sc, 11 * s * sc, col); ell(x - 3 * s, y - 3 * s, 18 * s * sc, 6 * s * sc, lt(col, 0.35)); };
  pillow(172, 76, 0.79, P.cream, 1.2); pillow(214, 80, 0.8, P.peach, 1.1);
  { const [x, y, s] = proj(140, 70, 0.42), k = s * 1.4; ell(x, y - 6 * k, 7 * k, 6 * k, P.woodM); ell(x, y - 6 * k, 5 * k, 4 * k, P.woodL); disc(x - 5 * k, y - 12 * k, 2.5 * k, P.woodM); disc(x + 5 * k, y - 12 * k, 2.5 * k, P.woodM); ell(x, y - 10 * k, 4 * k, 3 * k, P.woodL); R(x - 2 * k, y - 11 * k, 1, 1, P.ink); R(x + 2 * k, y - 11 * k, 1, 1, P.ink); }
  // desk lamp (articulated)
  { const [x, y, s] = proj(-208, 92, 0.86), k = s * 1.5; c.strokeStyle = hex(P.slate); c.lineWidth = Math.max(2, 2.5 * k);
    R(x - 9 * k, y - 3 * k, 18 * k, 3 * k, P.slate); c.beginPath(); c.moveTo(x, y - 3 * k); c.lineTo(x - 10 * k, y - 28 * k); c.lineTo(x + 8 * k, y - 42 * k); c.stroke();
    ell(x + 12 * k, y - 42 * k, 11 * k, 5 * k, P.mauve); ell(x + 12 * k, y - 39 * k, 8 * k, 2 * k, '#FFF1D6'); GLOWS.lamp = [x + 12 * k, y - 36 * k]; }
  { const [x, y] = proj(-214, 125, 0.39); GLOWS.laptop = [x, y]; }
  // floor bowls + a toy mouse
  { const [x, y, s] = proj(60, 0, 0.58); R(x - 8 * s * 1.5, y - 4 * s * 1.5, 16 * s * 1.5, 4 * s * 1.5, P.cream); R(x - 6 * s * 1.5, y - 5 * s * 1.5, 12 * s * 1.5, 2 * s * 1.5, P.pot); const [x2, y2] = proj(95, 0, 0.58); R(x2 - 6 * s * 1.5, y2 - 3 * s * 1.5, 12 * s * 1.5, 3 * s * 1.5, P.sky); }
  // string lights draped along the ceiling edge of the back and side walls
  const bulbs = [];
  const swag = (pt, n) => { let prev = null; for (let i = 0; i <= 60; i++) { const t = i / 60, [x, y] = pt(t); if (prev) { c.strokeStyle = hex(P.woodD); c.lineWidth = 1; c.beginPath(); c.moveTo(prev[0], prev[1]); c.lineTo(x, y); c.stroke(); } prev = [x, y]; } for (let i = 1; i < n; i++) { const [x, y] = pt(i / n); R(x, y, 1, 3, P.ink); disc(x, y + 5, 2, P.gold); R(x - 1, y + 4, 1, 1, '#FFF3E6'); bulbs.push([x, y + 5]); } };
  swag((t) => { const [x, y] = proj(-240 + 480 * t, 252 - Math.sin(t * Math.PI * 3) * 6, 0.99); return [x, y + 5]; }, 14);
  swag((t) => { const [x, y] = proj(-240, 258 - Math.sin(t * Math.PI * 2) * 7, 0.02 + t * 0.96); return [x, y]; }, 7);
  swag((t) => { const [x, y] = proj(240, 258 - Math.sin(t * Math.PI * 2) * 7, 0.02 + t * 0.96); return [x, y]; }, 7);
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
    for (let i = 0; i < 20; i++) { const a = rand() * 6.28, dd = Math.sqrt(rand()); blobs.push([cx + Math.cos(a) * dd * rx, cy + Math.sin(a) * dd * ry, 5 + rand() * 6]); }
    blobs.forEach(([x, y, r]) => disc(x, y + 3, Math.round(r), dkc)); blobs.forEach(([x, y, r]) => disc(x, y, Math.round(r), mdc)); blobs.forEach(([x, y, r]) => disc(x - 2, y - 3, Math.round(r * 0.6), ltc));
    for (let i = 0; i < 150; i++) { const a = rand() * 6.28, dd = 0.75 + rand() * 0.45; R(cx + Math.cos(a) * rx * dd, cy + Math.sin(a) * ry * dd, 2, 2, rand() > 0.5 ? mdc : a < 3.3 && a > 0.3 ? dkc : ltc); }
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
