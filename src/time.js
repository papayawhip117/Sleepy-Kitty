import { DUSK, BERRY, mix } from './palette.js';

// Look of the sky/room at key hours of the day (24h clock). Values blend smoothly between keys.
//   sun: how much daylight there is (0 night .. 1 midday); stars: star visibility; tintA: strength of room tint
const KEYS = [
  { h: 0,    top: BERRY.a, bot: BERRY.b, tint: BERRY.a, tintA: 0.42, sun: 0,   stars: 1 },
  { h: 5.5,  top: BERRY.a, bot: BERRY.b, tint: BERRY.a, tintA: 0.40, sun: 0,   stars: 1 },
  { h: 6.75, top: DUSK.b,  bot: DUSK.d,  tint: DUSK.d,  tintA: 0.14, sun: 0.6, stars: 0.1 },
  { h: 9,    top: BERRY.d, bot: '#E4E7EA', tint: '#FFFFFF', tintA: 0,  sun: 1,   stars: 0 },
  { h: 17,   top: BERRY.d, bot: '#E4E7EA', tint: '#FFFFFF', tintA: 0,  sun: 1,   stars: 0 },
  { h: 18.75, top: DUSK.a, bot: DUSK.d,  tint: DUSK.c,  tintA: 0.20, sun: 0.6, stars: 0.1 },
  { h: 20.5, top: BERRY.a, bot: BERRY.b, tint: BERRY.a, tintA: 0.40, sun: 0,   stars: 1 },
  { h: 24,   top: BERRY.a, bot: BERRY.b, tint: BERRY.a, tintA: 0.42, sun: 0,   stars: 1 },
];

export function lookAt(hour) {
  let i = 0;
  while (i < KEYS.length - 2 && hour >= KEYS[i + 1].h) i++;
  const a = KEYS[i], b = KEYS[i + 1];
  let t = Math.min(1, Math.max(0, (hour - a.h) / (b.h - a.h)));
  t = t * t * (3 - 2 * t); // ease
  const n = (x, y) => x + (y - x) * t;
  return {
    top: mix(a.top, b.top, t), bot: mix(a.bot, b.bot, t), tint: mix(a.tint, b.tint, t),
    tintA: n(a.tintA, b.tintA), sun: n(a.sun, b.sun), stars: n(a.stars, b.stars),
  };
}

// Hours the manual time buttons jump to.
export const PRESET_HOURS = { sunrise: 6.75, day: 12, sunset: 18.75, night: 23 };

export const realHour = () => { const d = new Date(); return d.getHours() + d.getMinutes() / 60 + d.getSeconds() / 3600; };

export function realSeason() {
  const m = new Date().getMonth(); // 0 = Jan
  if (m >= 2 && m <= 4) return 'spring';
  if (m >= 5 && m <= 7) return 'summer';
  if (m >= 8 && m <= 10) return 'autumn';
  return 'winter';
}
