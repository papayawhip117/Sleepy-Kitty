// One saved-settings object for the whole game (browser localStorage, no accounts). Versioned so later milestones can add keys.
const KEY = 'sleepy-kitty-settings-v1', OLD = 'window-kitty-settings';
const DEFAULTS = { time: 'auto', weather: 'clear', season: 'summer', lamp: null, cozy: false, coat: 'white', bedColor: 'original', rugColor: 'original', curtainColor: 'original',
  masterVol: 0.8, muted: false, musicOn: false, musicVol: 0.5, track: 0, rainOn: false, rainVol: 0.5, rainHeavy: false, natureOn: false, natureVol: 0.5 };   // audio is off until the player turns it on   // lamp: null follows the clock, true/false is the player's choice
let data = { ...DEFAULTS };
const read = (k) => { try { return JSON.parse(localStorage.getItem(k)); } catch { return null; } };
const write = () => { try { localStorage.setItem(KEY, JSON.stringify(data)); } catch { /* private mode: settings just will not persist */ } };
data = { ...DEFAULTS, ...(read(OLD) || {}), ...(read(KEY) || {}) };   // the old time/weather key is picked up once, then superseded
data.time = { midday: 'afternoon', evening: 'dusk' }[data.time] || data.time;   // names from the first start page
const listeners = new Set();
export const settings = {
  get: (k) => data[k],
  set(k, v) { if (data[k] === v) return; data[k] = v; write(); listeners.forEach((f) => f(k, v)); },
  onChange: (f) => { listeners.add(f); return () => listeners.delete(f); },
};
