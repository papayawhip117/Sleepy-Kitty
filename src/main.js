import { createKitty } from './kitty.js';
// Sleepy Kitty. The room is authored at 480x270 and drawn from separate layers, back to front.
// Viewport: the room is scaled uniformly (never stretched) until it covers the whole window, so there is
// no letterboxing. On a window that is not 16:9, the outer edge of the room is cropped, so the ceiling edge and
// outer wall margins are what get cropped; the floor and window stay in view.
const W = 480, H = 270;
const K = 2;   // the room buffer is 2x (960x540): room layers are doubled exactly, furniture is cut at 2x for finer detail
const canvas = document.getElementById('room');
const ctx = canvas.getContext('2d');
const buf = document.createElement('canvas'); buf.width = W * K; buf.height = H * K;
const b = buf.getContext('2d'); b.imageSmoothingEnabled = false;

const load = (src) => new Promise((res, rej) => { const i = new Image(); i.onload = () => res(i); i.onerror = rej; i.src = src; });
const [shell, scenery, sunbeams, deskImg, bedImg, rugImg, shelvesImg, hangImg, kittyImg, scene, shelfGlow, kittyMeta] = await Promise.all([load('./art/room-shell.png'), load('./art/scenery-day.png'), load('./art/sunbeams.png'), load('./art/desk-body.png'), load('./art/bed.png'), load('./art/rug.png'), load('./art/shelves.png'), load('./art/plant-hanging.png'), load('./art/kitty.png'), fetch('./art/scene.json').then((r) => r.json()), fetch('./art/shelves.glow.json').then((r) => r.json()), fetch('./art/kitty.json').then((r) => r.json())]);
const [wx0, wy0, wx1, wy1] = scene.window;
// Where the kitty may go (feet positions, room units). Floor band is y 234-270; the desk stands on the left and the bed
// fills the right, so she walks the open middle freely and only in front of the bed on the right.
const kitty = createKitty(kittyImg, kittyMeta, K, {
  floor: { x0: 200, x1: 425, y0: 240, y1: 268, bedX: 296, yFront: 262 },
  perches: {   // the only places she may lie down besides the floor
    bed: { approach: { x: 292, y: 263 }, spot: { x: 372, y: 224 }, spotMin: 340, spotMax: 420, zone: [305, 180, 445, 245] },
    sill: { approach: { x: 245, y: 240 }, spot: { x: 245, y: 192 }, spotMin: 205, spotMax: 290, zone: [195, 150, 300, 205] },
  },
});

// ---- outdoor scenery ----
const hex = (h) => [1, 3, 5].map((i) => parseInt(h.slice(i, i + 2), 16));
const mixc = (a, c, t) => a.map((v, i) => Math.round(v + (c[i] - v) * t));
const KEYS = [ // hour, top, bottom
  [0, '#141B3D', '#2B2F6B'], [5.5, '#141B3D', '#5B4B9A'], [6.75, '#7E6BB8', '#FFB09E'],
  [9, '#6BA4CF', '#CDEBFA'], [17, '#6BA4CF', '#CDEBFA'], [18.75, '#5B4B9A', '#FF8A78'],
  [20.5, '#141B3D', '#2B2F6B'], [24, '#141B3D', '#2B2F6B'],
];
function skyAt(h) {
  let i = 0; while (i < KEYS.length - 2 && h >= KEYS[i + 1][0]) i++;
  const [h0, t0, b0] = KEYS[i], [h1, t1, b1] = KEYS[i + 1];
  const t = Math.min(1, Math.max(0, (h - h0) / (h1 - h0)));
  return [mixc(hex(t0), hex(t1), t), mixc(hex(b0), hex(b1), t)];
}
const params = new URLSearchParams(location.search);
let hourOverride = params.has('hour') ? +params.get('hour') : null;   // null = follow the real clock
const hourNow = () => hourOverride ?? new Date().getHours() + new Date().getMinutes() / 60;

let lampOn = null;   // null = follow the clock, true/false = switched by clicking the desk lamp
const LAMP_HIT = [44, 136, 92, 172];   // room units around the lamp shade and arm
// ---- lighting: one neutral room, lit in code ----
// Every look is a preset on the hour clock, blended smoothly. No second room image is ever needed.
//   tint  : multiply colour over the room (white = untouched)       beam : sunbeam overlay strength
//   warm  : how orange the sunbeams are (low sun)                    lamp : desk-lamp glow strength
const LIGHT = [ // hour, tint, beam, warm, lamp
  [0,    [78, 88, 160],   0,    0,   1],
  [5.5,  [84, 94, 164],   0,    0,   1],
  [7,    [255, 232, 222], 0.38, 0.7, 0.25],   // morning: soft, low and warm
  [9,    [255, 247, 238], 0.5,  0.3, 0],
  [12,   [255, 255, 255], 0.55, 0,   0],      // bright midday
  [16,   [255, 250, 240], 0.5,  0.25, 0],
  [18,   [255, 214, 178], 0.45, 0.95, 0.3],   // warm evening sun
  [19.5, [196, 150, 172], 0.14, 1,   0.8],
  [21,   [80, 90, 160],   0,    0,   1],      // cool night
  [24,   [78, 88, 160],   0,    0,   1],
];
function lightAt(h) {
  let i = 0; while (i < LIGHT.length - 2 && h >= LIGHT[i + 1][0]) i++;
  const [h0, t0, be0, w0, l0] = LIGHT[i], [h1, t1, be1, w1, l1] = LIGHT[i + 1];
  const t = Math.min(1, Math.max(0, (h - h0) / (h1 - h0))), m = (x, y) => x + (y - x) * t;
  return { tint: mixc(t0, t1, t), beam: m(be0, be1), warm: m(w0, w1), lamp: m(l0, l1) };
}
const skyTintAlpha = (h) => h >= 9 && h <= 17 ? 0 : 0.62 * Math.min(1, h < 9 ? (9 - h) / 2.25 : (h - 17) / 1.75);

// Weather is an overlay too: the scenery is dimmed and drawn over with rain or snow, and the room dims a little.
const WEATHER = { clear: { dim: 0, room: [255, 255, 255], beam: 1 }, overcast: { dim: 0.3, room: [226, 232, 242], beam: 0.12 },
  rain: { dim: 0.5, room: [205, 215, 232], beam: 0.05 }, snow: { dim: 0.28, room: [238, 243, 252], beam: 0.2 } };
const WEATHER_ORDER = ['clear', 'overcast', 'rain', 'snow'];
let weather = params.get('weather') in WEATHER ? params.get('weather') : 'clear';
const wlevel = Object.fromEntries(WEATHER_ORDER.map((k) => [k, k === weather ? 1 : 0]));   // eased 0..1 per weather
function stepWeather(dt) { for (const k of WEATHER_ORDER) wlevel[k] += Math.sign((k === weather ? 1 : 0) - wlevel[k]) * Math.min(Math.abs((k === weather ? 1 : 0) - wlevel[k]), dt / 1.5); }
const wmix = (f) => WEATHER_ORDER.reduce((acc, k) => acc + f(WEATHER[k]) * wlevel[k], 0);
const wmixRoom = () => [0, 1, 2].map((i) => Math.round(WEATHER_ORDER.reduce((a, k) => a + WEATHER[k].room[i] * wlevel[k], 0)));

const beamBuf = document.createElement('canvas'); beamBuf.width = W * K; beamBuf.height = H * K;
const bb = beamBuf.getContext('2d');
function drawSunbeams(L) {
  const beam = L.beam * wmix((w) => w.beam);
  if (beam <= 0.005) return;
  bb.imageSmoothingEnabled = false; bb.clearRect(0, 0, W * K, H * K); bb.globalCompositeOperation = 'source-over'; bb.globalAlpha = 1;
  bb.drawImage(sunbeams, 0, 0, W * K, H * K);
  if (L.warm > 0) { bb.globalCompositeOperation = 'source-atop'; bb.globalAlpha = 0.65 * L.warm; bb.fillStyle = '#FF8A78'; bb.fillRect(0, 0, W * K, H * K); }
  b.save(); b.globalAlpha = beam; b.setTransform(1, 0, 0, 1, 0, 0); b.drawImage(beamBuf, 0, 0); b.restore();
}

// Lamp glow anchor (room units, the lamp shade on the desk).
const LAMP = { x: 66, y: 160 };
function drawAmbient(L) {
  const h = hourNow();
  const dayness = Math.max(0, Math.min(1, 1 - Math.abs(h - 13) / 5.5)) * (1 - 0.8 * wmix((w) => w.dim));
  if (dayness > 0) {                                      // soft warm daylight spilling from the window
    const cx = (wx0 + wx1) / 2, g = b.createRadialGradient(cx, wy1, 10, cx, wy1 + 30, 230);
    g.addColorStop(0, `rgba(255,230,170,${0.30 * dayness})`); g.addColorStop(1, 'rgba(255,230,170,0)');
    b.save(); b.globalCompositeOperation = 'screen'; b.fillStyle = g; b.fillRect(0, 0, W, H); b.restore();
  }
  // room tint: time of day x weather, multiplied over everything (scenery included) so plants and furniture at the glass match.
  const wt = wmixRoom(), tint = [0, 1, 2].map((i) => Math.round(L.tint[i] * wt[i] / 255));
  b.save(); b.globalCompositeOperation = 'multiply'; b.fillStyle = `rgb(${tint})`; b.fillRect(0, 0, W, H); b.restore();
  if (L.lamp > 0.01) {                                    // shelf lantern and candle glow (anchors are in shelf art pixels)
    for (const l of shelfGlow.lights) {
      const gx = LAYOUT.shelves.x + l.x / K, gy = LAYOUT.shelves.y + l.y / K, r = l.radius / K * 1.8, g = b.createRadialGradient(gx, gy, 1, gx, gy, r);
      g.addColorStop(0, `${l.colour}${Math.round(150 * L.lamp).toString(16).padStart(2, '0')}`); g.addColorStop(1, `${l.colour}00`);
      b.save(); b.globalCompositeOperation = 'screen'; b.fillStyle = g; b.fillRect(gx - r, gy - r, r * 2, r * 2); b.restore();
    }
  }
  if (L.lamp > 0.01) {                                    // lamp glow: warm pool on the desk, wall and floor
    const g = b.createRadialGradient(LAMP.x, LAMP.y, 2, LAMP.x, LAMP.y, 70);
    g.addColorStop(0, `rgba(255,200,120,${0.55 * L.lamp})`); g.addColorStop(0.5, `rgba(255,170,100,${0.18 * L.lamp})`); g.addColorStop(1, 'rgba(255,170,100,0)');
    b.save(); b.globalCompositeOperation = 'screen'; b.fillStyle = g; b.fillRect(0, 0, W, H); b.restore();
  }
}

function drawSky() {
  b.drawImage(scenery, wx0, wy0, wx1 - wx0, wy1 - wy0);
  // Extend the scenery's edge pixels 2px under the frame, so no unpainted gap at the glass edge can show through
  // (that gap was catching the page colour and reading as light specks around the window, unaffected by the lighting).
  const sw = scenery.width, sh = scenery.height, gw = wx1 - wx0, gh = wy1 - wy0;
  b.drawImage(scenery, 0, sh - 1, sw, 1, wx0, wy1, gw, 2); b.drawImage(scenery, 0, 0, sw, 1, wx0, wy0 - 2, gw, 2);
  b.drawImage(scenery, 0, 0, 1, sh, wx0 - 2, wy0, 2, gh); b.drawImage(scenery, sw - 1, 0, 1, sh, wx1, wy0, 2, gh);
  const h = hourNow(), [top, bot] = skyAt(h), a = skyTintAlpha(h), dim = wmix((w) => w.dim);
  b.save(); b.beginPath(); b.rect(wx0, wy0, wx1 - wx0, wy1 - wy0); b.clip();
  if (a > 0) {
    const g = b.createLinearGradient(0, wy0, 0, wy1);
    g.addColorStop(0, `rgba(${top},${a})`); g.addColorStop(1, `rgba(${bot},${a * 0.8})`);
    b.fillStyle = g; b.fillRect(wx0, wy0, wx1 - wx0, wy1 - wy0);
  }
  if (dim > 0) { b.fillStyle = `rgba(105,120,146,${dim})`; b.fillRect(wx0, wy0, wx1 - wx0, wy1 - wy0); }
  b.restore();
}

// Falling rain and snow, drawn on the 2x buffer in window-glass space. Deterministic particles (no allocation per frame).
const rng = (n) => { const x = Math.sin(n * 127.1) * 43758.5453; return x - Math.floor(x); };
function drawPrecip(t) {
  const gw = wx1 - wx0, gh = wy1 - wy0;
  b.save(); b.beginPath(); b.rect(wx0, wy0, gw, gh); b.clip();
  if (wlevel.rain > 0.01) {
    b.fillStyle = `rgba(215,230,250,${0.9 * wlevel.rain})`;
    for (let i = 0; i < 170; i++) {
      const sp = 150 + rng(i + 3) * 80;
      const px = wx0 + ((rng(i) * gw + t * 30 * (0.5 + rng(i + 5))) % gw), py = wy0 + ((rng(i + 1) * gh + t * sp) % gh);
      b.fillRect(Math.round(px * K) / K, Math.round(py * K) / K, 1 / K, 5 / K);            // slanted streak, 1 art pixel wide
      b.fillRect(Math.round((px + 0.5) * K) / K, Math.round((py + 5) * K) / K, 1 / K, 3 / K);
    }
  }
  if (wlevel.snow > 0.01) {
    for (let i = 0; i < 110; i++) {
      const sp = 14 + rng(i + 2) * 16, sway = Math.sin(t * (0.6 + rng(i + 4)) + i) * 4;
      const px = wx0 + ((rng(i) * gw + sway + gw) % gw), py = wy0 + ((rng(i + 1) * gh + t * sp) % gh), big = rng(i + 6) > 0.6 ? 3 : 2;
      b.fillStyle = `rgba(255,255,255,${(0.55 + 0.4 * rng(i + 7)) * wlevel.snow})`;
      b.fillRect(Math.round(px * K) / K, Math.round(py * K) / K, big / K * 1, big / K * 1);
    }
  }
  b.restore();
}

// ---- layout (480x270 room pixels). Floor starts at y=234 (baseboard ends), back wall spans x=37..439. ----
// One shared floor line: the furniture's lowest feet/hem land on FLOOR_Y. The rug sits flat in the open floor
// between the desk's right edge (x~183) and the bed's left edge (x~307), toward the foreground.
const FLOOR_Y = 256;
const LAYOUT = {
  rug:  { img: rugImg,  x: 142, y: 234 },            // 206x57 (was 130x38, +58%), centre x=245, runs toward the foreground, top on the floor line
  desk: { img: deskImg, x: 40,  y: FLOOR_Y - 114 },  // feet end at sprite row 114; left wall
  shelves: { img: shelvesImg, x: 40, y: 72 },    // wall shelf above the desk, 142x99 art px = 71x50 room units, left of the window frame
  hang: { img: hangImg, x: 390, y: 26 },         // hanging plant from the ceiling beam, right of the window, above the bed
  bed:  { img: bedImg,  x: 303, y: FLOOR_Y - 123 },  // hem ends at sprite row 123; right corner, edge past the frame
};

// Contact shadows are built from each sprite's own silhouette (lowest opaque pixel per column), so they follow
// legs, drawers and the duvet hem exactly. Hard-edged 1px steps, no blur: pixel-art friendly.
function contactShadow(img) {
  const c = document.createElement('canvas'); c.width = img.width; c.height = img.height + 14;
  const g = c.getContext('2d'); g.drawImage(img, 0, 0);
  const d = g.getImageData(0, 0, c.width, c.height), out = g.createImageData(c.width, c.height);
  let lowest = 0; const bottom = [];
  for (let x = 0; x < img.width; x++) { let y = img.height - 1; while (y >= 0 && d.data[(y * c.width + x) * 4 + 3] < 128) y--; bottom.push(y); lowest = Math.max(lowest, y); }
  const steps = [150, 150, 120, 90, 60, 30].flatMap((a) => [a, a]);   // 1 logical px = K art pixels
  bottom.forEach((y, x) => { if (y < lowest - 8 * K) return;       // only columns that actually touch the floor
    steps.forEach((a, i) => { out.data.set([70, 36, 80, a], ((y - K + 1 + i) * c.width + x) * 4); }); });
  g.clearRect(0, 0, c.width, c.height); g.putImageData(out, 0, 0); return c;
}
for (const k of ['desk', 'bed']) LAYOUT[k].shadow = contactShadow(LAYOUT[k].img);

// ---- viewport ----
let view = { s: 1, ox: 0, oy: 0 };
function resize() {
  const dpr = window.devicePixelRatio || 1;
  const vw = document.documentElement.clientWidth || innerWidth, vh = document.documentElement.clientHeight || innerHeight;
  canvas.width = Math.round(vw * dpr); canvas.height = Math.round(vh * dpr);
  const cover = Math.max(canvas.width / W, canvas.height / H);          // smallest scale that fills the window
  // Whole-number scale keeps every art pixel the same size. Round up only when that crops little extra (<=12%);
  // otherwise keep the exact cover scale, since going smaller would leave bars.
  const up = Math.ceil(cover / K - 1e-6) * K, s = up / cover <= 1.12 ? up : cover;   // multiples of K keep the 2x buffer pixels even
  view = { s, ox: (canvas.width - W * s) / 2, oy: (canvas.height - H * s) * 0.8 }; // crop mostly ceiling, keep floor for the kitty
}
addEventListener('resize', resize); visualViewport?.addEventListener('resize', resize); resize();

function frame(ms) {
  const t = ms / 1000;
  b.setTransform(K, 0, 0, K, 0, 0); b.imageSmoothingEnabled = false;   // draw in 480x270 room units
  b.clearRect(0, 0, W, H);
  const dt = Math.min(0.1, t - (frame.last ?? t)); frame.last = t; stepWeather(dt);
  const L = lightAt(hourNow()), night = L.lamp;       // night (0..1) drives the kitty's habits; the lamp switch only changes the glow
  if (lampOn !== null) L.lamp = lampOn ? 1 : 0;
  drawSky();                  // 2. outdoor scenery, behind the window
  drawPrecip(t);              // rain / snow outside, behind the frame
  b.drawImage(shell, 0, 0);   // 1+3. room architecture and window frame (window glass is transparent)
  drawSunbeams(L);
  for (const k of ['shelves', 'hang']) { const i = LAYOUT[k].img; b.drawImage(i, LAYOUT[k].x, LAYOUT[k].y, i.width / K, i.height / K); }   // wall decor, behind furniture
  // 4-7: floor rug first, then furniture on top of it (back to front by floor position)
  const dw = (i) => i.width / K, dh = (i) => i.height / K;   // sprites are 2x art, drawn at room units
  b.drawImage(LAYOUT.rug.img, LAYOUT.rug.x, LAYOUT.rug.y, dw(LAYOUT.rug.img), dh(LAYOUT.rug.img));
  for (const k of ['desk', 'bed']) { const L = LAYOUT[k]; b.drawImage(L.shadow, L.x, L.y, dw(L.shadow), dh(L.shadow)); b.drawImage(L.img, L.x, L.y, dw(L.img), dh(L.img)); }
  kitty.update(dt, night); kitty.draw(b);   // 8. the kitty, in front of all furniture, lit by the same ambient pass
  drawAmbient(L);
  // 4-10 (shelves, furniture, plants, rug, kitty, weather) come in later stages
  ctx.imageSmoothingEnabled = false;
  ctx.drawImage(buf, view.ox, view.oy, W * view.s, H * view.s);
  requestAnimationFrame(frame);
}
requestAnimationFrame(frame);

// Click the window to change the weather.
canvas.addEventListener('click', (ev) => {
  if (suppressClick) { suppressClick = false; return; }
  { const [lx, ly] = toRoom(ev); if (lx >= LAMP_HIT[0] && lx <= LAMP_HIT[2] && ly >= LAMP_HIT[1] && ly <= LAMP_HIT[3]) { lampOn = !(lampOn ?? lightAt(hourNow()).lamp > 0.5); return; } }
  const r = canvas.getBoundingClientRect(), dpr = canvas.width / r.width;
  const x = ((ev.clientX - r.left) * dpr - view.ox) / view.s, y = ((ev.clientY - r.top) * dpr - view.oy) / view.s;
  if (x >= wx0 - 8 && x <= wx1 + 8 && y >= wy0 - 8 && y <= wy1 + 8) weather = WEATHER_ORDER[(WEATHER_ORDER.indexOf(weather) + 1) % WEATHER_ORDER.length];
});

// Kitty pointer controls: tap her for a happy reaction, press and drag to pick her up, release to drop her
// (over the bed she lands on it, otherwise on the floor).
const toRoom = (ev) => { const r = canvas.getBoundingClientRect(), dpr = canvas.width / r.width; return [((ev.clientX - r.left) * dpr - view.ox) / view.s, ((ev.clientY - r.top) * dpr - view.oy) / view.s]; };
let suppressClick = false;
canvas.addEventListener('pointerdown', (ev) => { const [x, y] = toRoom(ev); if (kitty.hit(x, y)) { kitty.down(x, y); suppressClick = true; canvas.setPointerCapture(ev.pointerId); canvas.style.cursor = 'grabbing'; } });
canvas.addEventListener('pointermove', (ev) => { const [x, y] = toRoom(ev); kitty.move(x, y); if (kitty.k.state !== 'held') canvas.style.cursor = kitty.hit(x, y) ? 'grab' : 'default'; });
canvas.addEventListener('pointerup', () => { if (kitty.k.state === 'held') { kitty.up(lightAt(hourNow()).lamp); canvas.style.cursor = 'grab'; } });
if (params.has('debug')) window.kitty = kitty;   // test hook: ?debug

// Start page and settings (src/start.js). Time and weather choices are remembered in this browser.
import { initStart } from './start.js';
initStart({
  setTime: (h) => { hourOverride = h; },
  setWeather: (w) => { if (w in WEATHER) weather = w; },
  hasUrlOverrides: params.has('hour') || params.has('weather'),
  skip: params.has('nostart'),
});
