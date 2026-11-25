// Start page: title, time-of-day and weather choices, Start button. Reopened from the small settings button.
const KEY = 'window-kitty-settings';
const TIMES = [['auto', 'Real time', null], ['morning', 'Morning', 7.5], ['midday', 'Midday', 12.5], ['evening', 'Evening', 18.2], ['night', 'Night', 22]];
const WEATHERS = [['clear', 'Clear'], ['overcast', 'Cloudy'], ['rain', 'Rain'], ['snow', 'Snow']];

const load = () => { try { return JSON.parse(localStorage.getItem(KEY)) || {}; } catch { return {}; } };
const save = (v) => { try { localStorage.setItem(KEY, JSON.stringify(v)); } catch { /* private mode: settings just won't persist */ } };

export function initStart(api) {
  const st = { time: 'auto', weather: 'clear', ...load() };
  const root = document.getElementById('start');
  if (!api.hasUrlOverrides) { apply(); }
  function apply() { api.setTime(TIMES.find((t) => t[0] === st.time)?.[2] ?? null); api.setWeather(st.weather); }

  const chip = (group, id, label, on) => `<button type="button" class="chip${on ? ' on' : ''}" data-group="${group}" data-id="${id}" aria-pressed="${on}">${label}</button>`;
  function render(first) {
    if (first) {                                   // title screen: cream page, logo, start button (Cody's art)
      root.className = 'title';
      root.innerHTML = `
        <div class="titlebox">
          <picture><source media="(max-width: 700px)" srcset="./art/title-logo-half.png" /><img class="logo" src="./art/title-logo.png" alt="Sleepy Kitty" width="377" height="310" /></picture>
          <button type="button" class="startbtn" id="go" aria-label="Start"><picture><source media="(max-width: 700px)" srcset="./art/title-button-half.png" /><img src="./art/title-button.png" alt="" width="465" height="120" /></picture></button>
        </div>`;
      root.querySelector('#go').addEventListener('click', hide);
      root.querySelector('#go').focus();
      return;
    }
    root.className = 'panel';
    root.innerHTML = `
      <div class="card" role="dialog" aria-label="Settings">
        <h1>Settings</h1>
        <p class="sub">a cozy little room with a sleepy kitty</p>
        <div class="group"><span class="label">Time of day</span><div class="chips">${TIMES.map((t) => chip('time', t[0], t[1], st.time === t[0])).join('')}</div></div>
        <div class="group"><span class="label">Weather</span><div class="chips">${WEATHERS.map((w) => chip('weather', w[0], w[1], st.weather === w[0])).join('')}</div></div>
        <button type="button" class="go" id="go">Back to the room</button>
        <p class="hint">Tap the kitty to pet her. Drag her to pick her up. Click the lamp to switch it. Click the window to change the weather.</p>
      </div>`;
    root.querySelectorAll('.chip').forEach((b) => b.addEventListener('click', () => {
      st[b.dataset.group] = b.dataset.id; save(st); apply();
      root.querySelectorAll(`.chip[data-group="${b.dataset.group}"]`).forEach((o) => { const on = o === b; o.classList.toggle('on', on); o.setAttribute('aria-pressed', on); });
    }));
    root.querySelector('#go').addEventListener('click', hide);
    root.querySelector('#go').focus();
  }
  function show(first) { render(first); root.hidden = false; requestAnimationFrame(() => root.classList.add('open')); }
  function hide() { root.classList.remove('open'); setTimeout(() => { root.hidden = true; }, 350); }

  const gear = document.getElementById('gear');
  gear.addEventListener('click', () => show(false));
  addEventListener('keydown', (e) => { if (e.key === 'Escape' && !root.hidden) hide(); });
  if (api.skip) { root.hidden = true; return; }
  show(true);
}
