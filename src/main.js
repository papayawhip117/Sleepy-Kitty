// Window Kitty. The room is authored at 480x270 and drawn from separate layers, back to front.
// Viewport: the room is scaled uniformly (never stretched) until it covers the whole window, so there is
// no letterboxing. On a window that is not 16:9, the outer edge of the room is cropped, so the ceiling edge and
// outer wall margins are what get cropped; the floor and window stay in view.
const W = 480, H = 270;
const canvas = document.getElementById('room');
const ctx = canvas.getContext('2d');
const buf = document.createElement('canvas'); buf.width = W; buf.height = H;
const b = buf.getContext('2d');

const load = (src) => new Promise((res, rej) => { const i = new Image(); i.onload = () => res(i); i.onerror = rej; i.src = src; });
const [shell, scene] = await Promise.all([load('./art/room-shell.png'), fetch('./art/scene.json').then((r) => r.json())]);
const [wx0, wy0, wx1, wy1] = scene.window;

// ---- sky (placeholder until the outdoor scenery art exists) ----
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
const hourNow = () => params.has('hour') ? +params.get('hour') : new Date().getHours() + new Date().getMinutes() / 60;
const clouds = [{ x: 150, y: 70, w: 34 }, { x: 260, y: 105, w: 26 }, { x: 330, y: 60, w: 40 }];

function drawSky(t) {
  const [top, bot] = skyAt(hourNow());
  for (let y = wy0; y < wy1; y++) {
    const c = mixc(top, bot, (y - wy0) / (wy1 - wy0));
    b.fillStyle = `rgb(${c})`; b.fillRect(wx0, y, wx1 - wx0, 1);
  }
  b.save(); b.beginPath(); b.rect(wx0, wy0, wx1 - wx0, wy1 - wy0); b.clip();
  b.fillStyle = 'rgba(255,243,222,0.85)';
  for (const c of clouds) {
    const x = Math.round(((c.x - wx0 + t * 1.5) % (wx1 - wx0 + 60)) + wx0 - 30);
    b.fillRect(x + 4, c.y, c.w - 8, 5); b.fillRect(x, c.y + 4, c.w, 5); b.fillRect(x + 8, c.y - 3, c.w / 2, 5);
  }
  b.restore();
}

// ---- viewport ----
let view = { s: 1, ox: 0, oy: 0 };
function resize() {
  const dpr = window.devicePixelRatio || 1;
  canvas.width = Math.round(innerWidth * dpr); canvas.height = Math.round(innerHeight * dpr);
  const s = Math.max(canvas.width / W, canvas.height / H); // cover: fill, never stretch
  view = { s, ox: (canvas.width - W * s) / 2, oy: (canvas.height - H * s) * 0.8 }; // crop mostly ceiling, keep floor for the kitty
}
addEventListener('resize', resize); resize();

function frame(ms) {
  const t = ms / 1000;
  b.clearRect(0, 0, W, H);
  drawSky(t);                 // 2. outdoor scenery, behind the window
  b.drawImage(shell, 0, 0);   // 1+3. room architecture and window frame (window glass is transparent)
  // 4-10 (shelves, furniture, plants, rug, kitty, weather) come in later stages
  ctx.imageSmoothingEnabled = false;
  ctx.drawImage(buf, view.ox, view.oy, W * view.s, H * view.s);
  requestAnimationFrame(frame);
}
requestAnimationFrame(frame);
