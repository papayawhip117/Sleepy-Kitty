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
const [shell, scenery, scene] = await Promise.all([load('./art/room-shell.png'), load('./art/scenery-day.png'), fetch('./art/scene.json').then((r) => r.json())]);
const [wx0, wy0, wx1, wy1] = scene.window;

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
const hourNow = () => params.has('hour') ? +params.get('hour') : new Date().getHours() + new Date().getMinutes() / 60;

function drawSky() {
  // Outdoor scenery plate fits the window glass exactly. Time of day tints it for now;
  // dedicated dusk/night plates replace the tint later.
  b.drawImage(scenery, wx0, wy0, wx1 - wx0, wy1 - wy0);
  const [top, bot] = skyAt(hourNow());
  const day = (hourNow() >= 9 && hourNow() <= 17);
  if (!day) {
    b.save(); b.beginPath(); b.rect(wx0, wy0, wx1 - wx0, wy1 - wy0); b.clip();
    const g = b.createLinearGradient(0, wy0, 0, wy1);
    g.addColorStop(0, `rgba(${top},0.62)`); g.addColorStop(1, `rgba(${bot},0.5)`);
    b.fillStyle = g; b.fillRect(wx0, wy0, wx1 - wx0, wy1 - wy0); b.restore();
  }
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
  drawSky();                  // 2. outdoor scenery, behind the window
  b.drawImage(shell, 0, 0);   // 1+3. room architecture and window frame (window glass is transparent)
  // 4-10 (shelves, furniture, plants, rug, kitty, weather) come in later stages
  ctx.imageSmoothingEnabled = false;
  ctx.drawImage(buf, view.ox, view.oy, W * view.s, H * view.s);
  requestAnimationFrame(frame);
}
requestAnimationFrame(frame);
