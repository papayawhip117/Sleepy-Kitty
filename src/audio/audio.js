// Audio engine: one AudioContext, one master bus, and three independent channels (music, rain, nature) with their own on/off and volume.
// Sounds come from real files in public/audio when they exist (see AUDIO_FILES) and fall back to PLACEHOLDER sounds generated in code.
// Browsers block sound until the player interacts, so nothing starts before a click, tap or key press (saved "on" settings arm and wait).
// Audio is not tied to the DOM or to the environment state: weather and season changes never touch it, and Cozy Mode keeps it playing.
import { settings } from '../state/settings.js';

// Drop real loops here (ogg or mp3 in public/audio) and they replace the generated placeholders with no code changes.
export const AUDIO_FILES = {
  music: [],                                   // e.g. [{ name: 'Lo-fi one', url: './audio/lofi-1.ogg' }]
  rainLight: './audio/rain-light.ogg', rainHeavy: './audio/rain-heavy.ogg',
  wind: './audio/wind.ogg', birds: './audio/birds.ogg', crickets: './audio/crickets.ogg', forest: './audio/forest.ogg',
};
const TRACKS = [   // placeholder lo-fi loops, generated: chords as MIDI notes
  { name: 'Rainy window', bpm: 62, chords: [[53, 57, 60, 64], [52, 55, 59, 62], [50, 53, 57, 60], [48, 52, 55, 59]] },
  { name: 'Warm blanket', bpm: 70, chords: [[48, 52, 55, 59], [45, 48, 52, 55], [53, 57, 60, 64], [43, 47, 50, 53]] },
];
export const trackNames = () => (AUDIO_FILES.music.length ? AUDIO_FILES.music : TRACKS).map((t) => t.name);
const mtof = (m) => 440 * 2 ** ((m - 69) / 12);

let ctx = null, master = null, bus = {}, noiseBuf = null, started = false, getEnv = () => ({ hour: 12, rain: false });
let analyser = null;
let files = {};   // decoded real files by key, when present
const rand = (a, b) => a + Math.random() * (b - a);

function ensureContext() {
  if (ctx) { if (ctx.state === 'suspended') ctx.resume(); return; }
  const AC = window.AudioContext || window.webkitAudioContext; if (!AC) return;
  ctx = new AC();
  master = ctx.createGain(); master.gain.value = 0; master.connect(ctx.destination);
  for (const k of ['music', 'rain', 'nature']) { bus[k] = ctx.createGain(); bus[k].gain.value = 0; bus[k].connect(master); }
  noiseBuf = ctx.createBuffer(2, ctx.sampleRate * 4, ctx.sampleRate);
  for (let c = 0; c < 2; c++) { const d = noiseBuf.getChannelData(c); let last = 0; for (let i = 0; i < d.length; i++) { const w = Math.random() * 2 - 1; last = (last + 0.02 * w) / 1.02; d[i] = w * 0.5 + last * 3.5 * 0.5; } }   // white plus a little brown, loops without clicks
  if (new URLSearchParams(location.search).has('debug')) { analyser = ctx.createAnalyser(); analyser.fftSize = 2048; master.connect(analyser); }
  loadFiles();
  applyAll();
}
async function loadFiles() {                   // real files, if the project has any
  const tryLoad = async (url) => { try { const r = await fetch(url); const t = r.headers.get('content-type') || ''; if (!r.ok || /html|text/.test(t)) return null; return await ctx.decodeAudioData(await r.arrayBuffer()); } catch { return null; } };
  for (const k of ['rainLight', 'rainHeavy', 'wind', 'birds', 'crickets', 'forest']) { const buf = await tryLoad(AUDIO_FILES[k]); if (buf) { files[k] = buf; rebuild(k); } }
}

// ---- looping layers ----
const layers = {};   // name -> { gain, nodes }
function noiseSource(filters) {                 // placeholder: filtered noise loop
  const src = ctx.createBufferSource(); src.buffer = noiseBuf; src.loop = true; src.loopStart = 0; src.loopEnd = 4; src.start(0, rand(0, 3));
  let node = src; filters.forEach(([type, f, q]) => { const fl = ctx.createBiquadFilter(); fl.type = type; fl.frequency.value = f; if (q) fl.Q.value = q; node.connect(fl); node = fl; });
  return { src, out: node };
}
function layer(name, build) {                   // builds a layer once, returns its gain node; real files take over if present
  if (layers[name]) return layers[name];
  const gain = ctx.createGain(); gain.gain.value = 0;
  let stop = () => {};
  if (files[name]) { const s = ctx.createBufferSource(); s.buffer = files[name]; s.loop = true; s.connect(gain); s.start(); stop = () => s.stop(); } else stop = build(gain) || stop;
  return (layers[name] = { gain, stop });
}
function rebuild(name) { if (layers[name]) { layers[name].stop(); layers[name].gain.disconnect(); delete layers[name]; applyAll(); } }
const ramp = (g, v, t = 0.6) => g.gain.setTargetAtTime(v, ctx.currentTime, t / 3);

function buildRain(heavy) {
  return layer(heavy ? 'rainHeavy' : 'rainLight', (g) => {
    const n = noiseSource(heavy ? [['highpass', 350], ['lowpass', 9000]] : [['highpass', 900], ['lowpass', 7000]]);
    const body = ctx.createGain(); body.gain.value = heavy ? 0.9 : 0.5; n.out.connect(body); body.connect(g);
    if (heavy) { const low = noiseSource([['lowpass', 380]]); const lg = ctx.createGain(); lg.gain.value = 0.35; low.out.connect(lg); lg.connect(g); }
    return () => { try { n.src.stop(); } catch {} };
  });
}
function buildWind() {
  return layer('wind', (g) => {
    const n = noiseSource([['lowpass', 520], ['bandpass', 260, 0.4]]); const lfo = ctx.createOscillator(), lg = ctx.createGain(), base = ctx.createGain();
    lfo.frequency.value = 0.07; lg.gain.value = 0.22; base.gain.value = 0.42; lfo.connect(lg); lg.connect(base.gain); n.out.connect(base); base.connect(g); lfo.start();
    return () => { try { n.src.stop(); lfo.stop(); } catch {} };
  });
}
function buildCrickets() {
  return layer('crickets', (g) => {
    const oscs = [];
    [4300, 4750, 5200].forEach((f, i) => {
      const o = ctx.createOscillator(), a = ctx.createGain(), lfo = ctx.createOscillator(), lg = ctx.createGain(), gate = ctx.createOscillator(), gg = ctx.createGain();
      o.frequency.value = f; lfo.type = 'square'; lfo.frequency.value = 9 + i * 1.7; lg.gain.value = 0.05; a.gain.value = 0.05;
      gate.frequency.value = 0.13 + i * 0.05; gg.gain.value = 0.04; gate.connect(gg); gg.connect(a.gain);     // each cricket drifts in and out
      lfo.connect(lg); lg.connect(a.gain); o.connect(a); a.connect(g); [o, lfo, gate].forEach((x) => x.start()); oscs.push(o, lfo, gate);
    });
    return () => oscs.forEach((o) => { try { o.stop(); } catch {} });
  });
}
let birdTimer = null;
function buildBirds() {
  return layer('birds', (g) => {
    const chirp = (t0, f0) => { const o = ctx.createOscillator(), a = ctx.createGain(); o.type = 'sine'; o.frequency.setValueAtTime(f0, t0); o.frequency.exponentialRampToValueAtTime(f0 * rand(1.25, 1.6), t0 + 0.07);
      a.gain.setValueAtTime(0, t0); a.gain.linearRampToValueAtTime(0.12, t0 + 0.01); a.gain.exponentialRampToValueAtTime(0.001, t0 + 0.11); o.connect(a); a.connect(g); o.start(t0); o.stop(t0 + 0.13); };
    const phrase = () => { const e = getEnv(); if (e.hour >= 6 && e.hour <= 18.5 && !e.rain) { const f = rand(2400, 3600), n = 2 + Math.floor(rand(0, 4)); for (let i = 0; i < n; i++) chirp(ctx.currentTime + i * rand(0.11, 0.17), f * rand(0.95, 1.1)); }
      birdTimer = setTimeout(phrase, rand(2500, 9000)); };
    phrase();
    return () => clearTimeout(birdTimer);
  });
}

// ---- placeholder music: a gentle generated lo-fi loop ----
let musicLayer = null, sched = null, trackIdx = 0, step = 0, nextT = 0, musicBus = null;
function note(t, midi, dur, vol, bright) {
  const o = ctx.createOscillator(), o2 = ctx.createOscillator(), a = ctx.createGain(), lp = ctx.createBiquadFilter();
  o.type = 'sine'; o2.type = 'triangle'; o.frequency.value = mtof(midi); o2.frequency.value = mtof(midi) * 2.005; lp.type = 'lowpass'; lp.frequency.value = bright ? 2600 : 1500;
  a.gain.setValueAtTime(0, t); a.gain.linearRampToValueAtTime(vol, t + 0.015); a.gain.exponentialRampToValueAtTime(0.0008, t + dur);
  const g2 = ctx.createGain(); g2.gain.value = 0.22; o.connect(a); o2.connect(g2); g2.connect(a); a.connect(lp); lp.connect(musicBus);
  o.start(t); o2.start(t); o.stop(t + dur + 0.05); o2.stop(t + dur + 0.05);
}
function tick(t, vol, hp, dur = 0.03) { const s = ctx.createBufferSource(); s.buffer = noiseBuf; const f = ctx.createBiquadFilter(), a = ctx.createGain(); f.type = 'highpass'; f.frequency.value = hp; a.gain.setValueAtTime(vol, t); a.gain.exponentialRampToValueAtTime(0.0005, t + dur); s.connect(f); f.connect(a); a.connect(musicBus); s.start(t, rand(0, 3)); s.stop(t + dur + 0.02); }
function kick(t) { const o = ctx.createOscillator(), a = ctx.createGain(); o.frequency.setValueAtTime(110, t); o.frequency.exponentialRampToValueAtTime(42, t + 0.12); a.gain.setValueAtTime(0.32, t); a.gain.exponentialRampToValueAtTime(0.001, t + 0.22); o.connect(a); a.connect(musicBus); o.start(t); o.stop(t + 0.25); }
function scheduleMusic() {
  const tr = TRACKS[trackIdx % TRACKS.length], eighth = 60 / tr.bpm / 2;
  while (nextT < ctx.currentTime + 0.35) {
    const s = step % 8, bar = Math.floor(step / 8) % tr.chords.length, ch = tr.chords[bar];
    const swing = s % 2 ? eighth * 0.12 : 0, t = nextT + swing;
    if (s === 0) { ch.forEach((m, i) => note(t + i * 0.035, m + 12, eighth * 7, 0.07, false)); note(t, ch[0] - 12, eighth * 3.6, 0.2, false); kick(t); }
    if (s === 5) { note(t, ch[0] - 12, eighth * 2.4, 0.14, false); }
    if (s === 4) { kick(t); tick(t, 0.05, 2500, 0.08); }
    if (s % 2 === 1 || s === 2 || s === 6) tick(t, 0.012, 7000, 0.03);                  // soft hat
    if ((s === 3 || s === 6 || s === 7) && Math.random() < 0.55) note(t, ch[Math.floor(rand(0, ch.length))] + 24 - (Math.random() < 0.3 ? 12 : 0), eighth * rand(2, 4), 0.05, true);   // sparse melody
    if (Math.random() < 0.18) tick(t + rand(0, eighth), rand(0.015, 0.035), 3500, 0.006);   // vinyl crackle
    nextT += eighth; step++;
  }
}
function buildMusic() {
  if (musicLayer) return musicLayer;
  const gain = ctx.createGain(); gain.gain.value = 0; musicBus = ctx.createGain(); musicBus.gain.value = 1;
  const lp = ctx.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 3200; const dly = ctx.createDelay(1), fb = ctx.createGain(), wet = ctx.createGain();
  dly.delayTime.value = 0.36; fb.gain.value = 0.3; wet.gain.value = 0.25; musicBus.connect(lp); lp.connect(gain); lp.connect(dly); dly.connect(fb); fb.connect(dly); dly.connect(wet); wet.connect(gain);
  gain.connect(bus.music); return (musicLayer = { gain, stop() {} });
}
function startMusic() {
  if (sched) return; buildMusic(); step = 0; nextT = ctx.currentTime + 0.1; scheduleMusic(); sched = setInterval(scheduleMusic, 100);
}
function stopMusic() { clearInterval(sched); sched = null; }
let fileMusic = null;
function startFileMusic() {
  const list = AUDIO_FILES.music; if (fileMusic || !list.length) return;
  const el = new Audio(list[trackIdx % list.length].url); el.loop = true; const src = ctx.createMediaElementSource(el); src.connect(bus.music); el.play().catch(() => {}); fileMusic = el;
}
function stopFileMusic() { fileMusic?.pause(); fileMusic = null; }

// ---- apply the settings to the graph (idempotent: never builds a second copy of anything) ----
function applyAll() {
  if (!ctx) return;
  const muted = settings.get('muted'); ramp(master, muted ? 0 : settings.get('masterVol'), 0.25);
  const musicOn = settings.get('musicOn'), rainOn = settings.get('rainOn'), natureOn = settings.get('natureOn');
  ramp(bus.music, musicOn ? settings.get('musicVol') : 0, 0.8); ramp(bus.rain, rainOn ? settings.get('rainVol') : 0, 0.8); ramp(bus.nature, natureOn ? settings.get('natureVol') : 0, 0.8);
  if (musicOn) { AUDIO_FILES.music.length ? startFileMusic() : startMusic(); ramp((musicLayer || { gain: bus.music }).gain, 1, 0.4); } else { stopMusic(); stopFileMusic(); }
  if (rainOn) { const heavy = settings.get('rainHeavy'), l = buildRain(false), h = buildRain(true); if (!l.joined) { l.gain.connect(bus.rain); h.gain.connect(bus.rain); l.joined = h.joined = true; } ramp(l.gain, heavy ? 0 : 1, 1.2); ramp(h.gain, heavy ? 1 : 0, 1.2); }
  if (natureOn) {
    const e = getEnv(), night = e.hour >= 19.5 || e.hour < 5.5;
    const w = buildWind(), c = buildCrickets(), b = buildBirds(); [w, c, b].forEach((l) => { if (!l.joined) { l.gain.connect(bus.nature); l.joined = true; } });
    ramp(w.gain, 0.8, 1.5); ramp(c.gain, night ? 1 : 0, 2); ramp(b.gain, night ? 0 : 1, 2);
  } else for (const k of ['wind', 'crickets', 'birds']) if (layers[k]) ramp(layers[k].gain, 0, 1);
}

export function initAudio(envGetter) {
  getEnv = envGetter;
  trackIdx = settings.get('track') || 0;
  const arm = () => { if (!started) { started = true; ensureContext(); } else if (ctx) ctx.resume(); };
  ['pointerdown', 'keydown'].forEach((ev) => addEventListener(ev, arm, { once: false, passive: true }));   // the first gesture arms the saved preferences
  settings.onChange((k) => { if (/^(music|rain|nature|master|muted)/.test(k)) { if (!ctx) { started = true; ensureContext(); } else applyAll(); } });
  setInterval(() => { if (ctx && settings.get('natureOn')) applyAll(); }, 20000);   // day birds / night crickets follow the clock
  document.addEventListener('visibilitychange', () => { if (!document.hidden && ctx) ctx.resume(); });
}
export const nextTrack = (d) => { const n = trackNames().length; trackIdx = (trackIdx + d + n) % n; settings.set('track', trackIdx); if (sched) { stopMusic(); startMusic(); } if (fileMusic) { stopFileMusic(); startFileMusic(); } };
export const currentTrack = () => trackNames()[trackIdx % trackNames().length];
export const audioRunning = () => !!ctx && ctx.state === 'running';
export const usingFiles = () => Object.keys(files).length > 0 || AUDIO_FILES.music.length > 0;
export function audioDebug() {   // test hook: ?debug exposes window.audio
  const d = new Float32Array(analyser ? analyser.fftSize : 1); analyser?.getFloatTimeDomainData(d);
  return { state: ctx?.state, layers: Object.keys(layers), musicScheduler: !!sched, birdTimer: !!birdTimer, rms: Math.sqrt(d.reduce((a, v) => a + v * v, 0) / d.length), master: master?.gain.value };
}
