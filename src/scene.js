import { DUSK, BERRY, mix, rgba } from './palette.js';

export const W = 320, H = 180;

// Window glass area and the four places the kitty can sleep (feet position).
export const GLASS = { x: 140, y: 20, w: 90, h: 76 };
export const SPOTS = {
  bed:  { x: 78,  y: 104, label: 'bed' },
  sill: { x: 160, y: 99,  label: 'window sill' },
  desk: { x: 292, y: 114, label: 'desk' },
  rug:  { x: 176, y: 160, label: 'rug' },
};

const WALL = '#8B7C95', WALL2 = '#82738D', FLOOR = '#B58C80', FLOOR2 = '#A67E75', WOOD = '#6B4F4F', WOOD_D = '#4F3A40';
const LAMP = '#F8CCAA';

let ctx;
const r = (x, y, w, h, c) => { ctx.fillStyle = c; ctx.fillRect(Math.round(x), Math.round(y), w, h); };
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
    const w = Math.floor(rx * Math.sqrt(1 - (dy * dy) / (ry * ry + 0.5)));
    ctx.fillRect(Math.round(cx - w), Math.round(cy + dy), w * 2 + 1, 1);
  }
};
// tiny seeded random so stars/leaves are always in the same places
const rng = (seed) => () => (seed = (seed * 16807) % 2147483647) / 2147483647;

// ── static room pieces ──────────────────────────────────────
function drawRoom() {
  r(0, 0, W, 124, WALL);
  for (let x = 0; x < W; x += 16) r(x, 0, 8, 124, WALL2); // soft wallpaper stripes
  for (let y = 6; y < 124; y += 12) for (let x = 4; x < W; x += 16) r(x, y, 1, 1, '#9A8BA4'); // dots
  r(0, 124, W, 4, '#F2C1A3'); r(0, 127, W, 1, '#CD9FA0'); // baseboard
  r(0, 128, W, 52, FLOOR);
  for (let y = 128; y < H; y += 10) r(0, y, W, 1, FLOOR2);
  for (let y = 128, row = 0; y < H; y += 10, row++)
    for (let x = (row % 2) * 24; x < W; x += 48) r(x, y, 1, 10, FLOOR2);
}

function drawRug() {
  ellipse(176, 158, 52, 13, '#525871');
  ellipse(176, 158, 49, 11, '#CD9FA0');
  ellipse(176, 158, 40, 8, '#F2C1A3');
  ellipse(176, 158, 28, 5, '#CD9FA0');
  ellipse(176, 158, 16, 3, '#857C91');
}

function drawBed() {
  r(6, 84, 9, 52, WOOD); r(6, 84, 9, 2, '#86645F'); r(6, 124, 9, 12, WOOD_D);       // headboard
  r(15, 112, 107, 18, WOOD); r(15, 112, 107, 2, '#86645F');                          // frame
  r(112, 100, 10, 36, WOOD); r(112, 100, 10, 2, '#86645F');                          // footboard
  r(15, 130, 5, 6, WOOD_D); r(117, 130, 5, 6, WOOD_D);                               // feet
  r(15, 104, 97, 9, '#F8CCAA');                                                      // mattress
  r(18, 98, 26, 8, '#F2E4DB'); r(18, 98, 26, 1, '#FFF6EE'); r(18, 105, 26, 1, '#D9C3BD'); // pillow
  r(40, 104, 72, 12, '#7C8DA6'); r(40, 104, 72, 2, '#89A2BA');                       // blanket
  for (let x = 44; x < 110; x += 12) { r(x, 108, 6, 2, '#89A2BA'); r(x + 6, 112, 6, 2, '#61647C'); }
  r(40, 116, 72, 2, '#61647C');
}

function drawDesk() {
  r(246, 114, 68, 4, WOOD); r(246, 114, 68, 1, '#86645F');
  r(250, 118, 4, 34, WOOD_D); r(306, 118, 4, 34, WOOD_D);
  r(256, 118, 46, 12, WOOD); r(256, 118, 46, 1, WOOD_D); r(276, 123, 6, 2, '#F2C1A3');  // drawer
  // books
  r(268, 108, 14, 3, '#CD9FA0'); r(269, 105, 12, 3, '#61647C'); r(268, 111, 14, 3, '#F2C1A3');
  // little plant
  r(306, 108, 6, 6, '#CD9FA0'); r(307, 100, 1, 8, '#6B8F5E'); r(309, 98, 1, 10, '#87A96B'); r(305, 102, 2, 2, '#87A96B'); r(310, 100, 2, 2, '#6B8F5E');
}

function drawLampBody(on) {
  r(253, 112, 10, 2, WOOD_D); r(257, 100, 2, 12, WOOD_D);
  r(251, 92, 14, 9, on ? LAMP : '#B9A8A4'); r(251, 92, 14, 1, '#FFF1E2');
}

// ── window ──────────────────────────────────────────────────
function drawSky(look, hour, t) {
  const g = GLASS;
  for (let y = 0; y < g.h; y++) r(g.x, g.y + y, g.w, 1, mix(look.top, look.bot, y / g.h)); // banded sky
  // stars
  if (look.stars > 0.02) {
    const rand = rng(7);
    for (let i = 0; i < 26; i++) {
      const sx = g.x + 3 + rand() * (g.w - 6), sy = g.y + 3 + rand() * (g.h * 0.6), big = rand() > 0.8;
      ctx.fillStyle = rgba('#F8F4EE', look.stars * (big ? 0.95 : 0.6));
      ctx.fillRect(Math.round(sx), Math.round(sy), big ? 2 : 1, big ? 2 : 1);
    }
  }
  // sun / moon arcs across the glass
  const arc = (p) => ({ x: g.x + 8 + p * (g.w - 16), y: g.y + g.h - 8 - Math.sin(p * Math.PI) * (g.h - 26) });
  const sp = (hour - 6) / 12;
  if (sp > -0.08 && sp < 1.08) {
    const s = arc(sp);
    disc(s.x, s.y, 9, rgba('#F8CCAA', 0.25)); disc(s.x, s.y, 6, '#F8CCAA'); disc(s.x, s.y, 4, '#FFF1D6');
  }
  const mp = (((hour - 18) % 24 + 24) % 24) / 12;
  if (mp > -0.08 && mp < 1.08) {
    const m = arc(mp);
    disc(m.x, m.y, 8, rgba('#BEB3C3', 0.18)); disc(m.x, m.y, 5, '#E6E0E8'); disc(m.x + 2, m.y - 1, 4, mix(look.top, look.bot, (m.y - g.y) / g.h)); // crescent
  }
  // slow clouds (kept inside the glass)
  ctx.save(); ctx.beginPath(); ctx.rect(g.x, g.y, g.w, g.h); ctx.clip();
  const cloud = mix(look.bot, '#FFFFFF', 0.45);
  [[30, 18, 0.6], [95, 40, 0.4], [-20, 30, 0.5]].forEach(([ox, oy, sp2]) => {
    const cx = g.x + ((ox + t * sp2 * 2) % (g.w + 60)) - 20, cy = g.y + oy;
    r(cx, cy, 26, 4, cloud); r(cx + 5, cy - 3, 14, 3, cloud); r(cx + 3, cy + 4, 18, 2, mix(cloud, look.bot, 0.5));
  });
  ctx.restore();
}

const LEAVES = {
  spring: ['#6B8F5E', '#87A96B', '#F2C1A3'],
  summer: ['#4F7048', '#6B8F5E', '#87A96B'],
  autumn: ['#9C4F3A', '#C0703F', '#E0A050'],
};

function crown(cx, cy, rad, season, seed) {
  if (season === 'winter') return;
  const [dark, mid, light] = LEAVES[season], rand = rng(seed);
  const blobs = [];
  for (let i = 0; i < 9; i++) blobs.push([cx + (rand() - 0.5) * rad * 1.6, cy + (rand() - 0.5) * rad * 1.1, rad * (0.45 + rand() * 0.3)]);
  blobs.forEach(([x, y, rr]) => disc(x, y + 2, Math.round(rr), dark));
  blobs.forEach(([x, y, rr]) => disc(x, y, Math.round(rr), mid));
  blobs.forEach(([x, y, rr]) => disc(x - 2, y - 2, Math.round(rr * 0.55), light));
  if (season === 'spring') for (let i = 0; i < 14; i++) r(cx + (rand() - 0.5) * rad * 2, cy + (rand() - 0.5) * rad * 1.4, 2, 2, '#F8CCAA');
}

function tree(x, baseY, topY, trunkW, crownR, season, seed, lean) {
  const trunk = '#3F3340', hi = '#5A4650';
  for (let y = topY; y <= baseY; y++) {
    const off = Math.round(((baseY - y) / (baseY - topY)) * lean);
    r(x + off, y, trunkW, 1, trunk); r(x + off, y, 1, 1, hi);
  }
  // a few branches
  const rand = rng(seed + 3);
  for (let i = 0; i < 4; i++) {
    const by = topY + 6 + i * 7, dir = i % 2 ? 1 : -1, len = crownR * (0.6 + rand() * 0.5);
    for (let k = 0; k < len; k++) r(x + dir * k, by - Math.round(k * 0.6), 2, 2, trunk);
  }
  crown(x + Math.round(lean * 0.9), topY + 2, crownR, season, seed);
  if (season === 'winter') { // bare branches get a little snow
    for (let i = 0; i < 5; i++) r(x - crownR * 0.6 + i * crownR * 0.3, topY + 3 + (i % 2) * 5, 3, 1, '#E8EEF4');
    r(x - 1, topY, trunkW + 2, 1, '#E8EEF4');
  }
}

function drawOutside(season) {
  const g = GLASS;
  ctx.save();
  ctx.beginPath(); ctx.rect(g.x, g.y, g.w, g.h); ctx.clip();
  tree(214, g.y + g.h + 4, g.y + 14, 7, 26, season, 11, -3); // big tree, right corner
  tree(152, g.y + g.h + 4, g.y + 48, 4, 13, season, 5, 2);   // small tree, left corner
  ctx.restore();
}

function drawFrame() {
  const g = GLASS;
  r(g.x - 4, g.y - 4, g.w + 8, 4, WOOD); r(g.x - 4, g.y + g.h, g.w + 8, 3, WOOD);
  r(g.x - 4, g.y - 4, 4, g.h + 7, WOOD); r(g.x + g.w, g.y - 4, 4, g.h + 7, WOOD);
  r(g.x - 4, g.y - 4, g.w + 8, 1, '#86645F');
  r(g.x + g.w / 2 - 1, g.y, 3, g.h, WOOD); r(g.x, g.y + 26, g.w, 3, WOOD); // mullions
  r(g.x + g.w / 2 - 1, g.y, 1, g.h, '#86645F');
  // sill ledge
  r(g.x - 10, g.y + g.h + 3, g.w + 20, 5, '#86645F'); r(g.x - 10, g.y + g.h + 3, g.w + 20, 1, '#A47C73'); r(g.x - 8, g.y + g.h + 8, g.w + 16, 2, WOOD_D);
  // curtains
  const cur = '#CD9FA0', curD = '#B98A8E';
  for (const side of [-1, 1]) {
    const x0 = side < 0 ? g.x - 22 : g.x + g.w + 6;
    r(x0, g.y - 8, 16, g.h + 18, cur);
    for (let i = 0; i < 16; i += 4) r(x0 + i, g.y - 8, 2, g.h + 18, curD);
  }
  r(g.x - 28, g.y - 12, g.w + 56, 3, WOOD_D); // rod
}

// ── light on top of everything ──────────────────────────────
function drawLight(look) {
  const dark = 1 - look.sun;
  // sunbeam / moonbeam patch on the floor
  const beam = look.sun > 0.3 ? look.sun * 0.14 : 0.05 * dark;
  ctx.fillStyle = rgba(look.sun > 0.3 ? '#FFF1D6' : '#BEB3C3', beam);
  ctx.beginPath(); ctx.moveTo(148, 128); ctx.lineTo(228, 128); ctx.lineTo(206, 176); ctx.lineTo(112, 176); ctx.closePath(); ctx.fill();
  // lamp glow when it gets dim (stepped rings keep the pixel look)
  if (dark > 0.05) {
    for (let i = 5; i >= 1; i--) {
      ctx.fillStyle = rgba('#F8CCAA', 0.035 * dark);
      const rad = i * 8; ellipse(258, 100, rad, Math.round(rad * 0.85), ctx.fillStyle);
    }
    r(251, 92, 14, 9, rgba('#FFF1E2', 0.55 * dark));
  }
}

export function drawScene(c, look, hour, season, t, drawCat) {
  ctx = c;
  drawRoom();
  drawSky(look, hour, t);
  drawOutside(season);
  drawFrame();
  drawRug();
  drawBed();
  drawDesk();
  drawLampBody(look.sun < 0.95);
  drawCat?.(ctx, r, 'behind-tint');
  ctx.fillStyle = rgba(look.tint, look.tintA); ctx.fillRect(0, 0, W, H); // time-of-day tint
  drawLight(look);
}

export { r, disc, ellipse };
export const palette = { DUSK, BERRY };
