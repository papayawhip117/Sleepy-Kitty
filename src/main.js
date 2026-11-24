import { W, H, SPOTS, HIT, drawScene, buildRoom } from './scene.js';
import { lookAt, realHour, realSeason, PRESET_HOURS } from './time.js';
import { cat, moveTo, update as updateCat, drawCat } from './cat.js';

const canvas = document.getElementById('room');
const ctx = canvas.getContext('2d');
canvas.width = W; canvas.height = H;
buildRoom();

// Fit the room into the window with whole-number pixel scaling so pixels stay crisp.
function fit() {
  const s = Math.max(1, Math.floor(Math.min(innerWidth / W, innerHeight / H)));
  canvas.style.width = W * s + 'px'; canvas.style.height = H * s + 'px';
}
addEventListener('resize', fit); fit();

// ── settings: 'auto' follows the real clock / calendar ──
const state = { time: 'auto', season: 'auto', shown: realHour() };

const TIMES = ['auto', 'sunrise', 'day', 'sunset', 'night'];
const SEASONS = ['auto', 'spring', 'summer', 'autumn', 'winter'];
function makeButtons(id, options, key) {
  const box = document.getElementById(id);
  options.forEach((o) => {
    const b = document.createElement('button'); b.textContent = o;
    b.onclick = () => { state[key] = o; refresh(); };
    box.appendChild(b);
  });
  return () => [...box.children].forEach((b) => b.classList.toggle('on', b.textContent === state[key]));
}
const refreshTime = makeButtons('time-btns', TIMES, 'time');
const refreshSeason = makeButtons('season-btns', SEASONS, 'season');
const refresh = () => { refreshTime(); refreshSeason(); };
refresh();

// ── controls fade away when the mouse is still ──
const panel = document.getElementById('panel');
let idle;
let showSpots = false;
function wake() {
  panel.classList.add('show'); showSpots = true;
  clearTimeout(idle); idle = setTimeout(() => { panel.classList.remove('show'); showSpots = false; }, 3500);
}
addEventListener('mousemove', wake);

// ── click a spot to send the kitty there ──
canvas.addEventListener('click', (e) => {
  const b = canvas.getBoundingClientRect();
  const x = ((e.clientX - b.left) / b.width) * W, y = ((e.clientY - b.top) / b.height) * H;
  for (const [name, [hx, hy, hw, hh]] of Object.entries(HIT))
    if (x >= hx && x <= hx + hw && y >= hy && y <= hy + hh) { moveTo(name); return; }
});

// ── main loop ──
let last = performance.now();
function frame(now) {
  const dt = Math.min(0.1, (now - last) / 1000); last = now;
  const target = state.time === 'auto' ? realHour() : PRESET_HOURS[state.time];
  // glide forward through the day to the target time, so changes fade instead of snapping
  const gap = (((target - state.shown) % 24) + 24) % 24;
  state.shown = (state.shown + Math.min(gap, 4 * dt)) % 24;
  const season = state.season === 'auto' ? realSeason() : state.season;

  updateCat(dt);
  const t = now / 1000;
  drawScene(ctx, lookAt(state.shown), state.shown, season, t, (c, r) => drawCat(c, r, t));
  if (showSpots) for (const s of Object.values(SPOTS)) { // faint markers for the four sleep spots
    ctx.fillStyle = 'rgba(248,204,170,0.7)';
    ctx.fillRect(s.x - 1, s.y - 34 - Math.round(Math.sin(t * 2) * 1), 3, 3);
  }
  requestAnimationFrame(frame);
}
requestAnimationFrame(frame);
