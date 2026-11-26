// Title screen, plus the settings panel (built on the shared panel system in ui/panel.js).
import { settings } from './state/settings.js';
import { createPanel } from './ui/panel.js';
import { initControls } from './ui/ui.js';

const TIMES = [['auto', 'Real time', null], ['morning', 'Morning', 7.5], ['midday', 'Midday', 12.5], ['evening', 'Evening', 18.2], ['night', 'Night', 22]];
const WEATHERS = [['clear', 'Clear'], ['overcast', 'Cloudy'], ['rain', 'Rain'], ['snow', 'Snow']];

export function initStart(api) {
  const root = document.getElementById('start');
  const apply = () => { api.setTime(TIMES.find((t) => t[0] === settings.get('time'))?.[2] ?? null); api.setWeather(settings.get('weather')); };
  if (!api.hasUrlOverrides) apply();

  const chip = (group, id, label, on) => `<button type="button" class="chip${on ? ' on' : ''}" data-group="${group}" data-id="${id}" aria-pressed="${on}">${label}</button>`;
  const panel = createPanel({
    id: 'settings', title: 'Settings', subtitle: 'a cozy little room with a sleepy kitty',
    render(body, p) {
      body.innerHTML = `
        <div class="group"><span class="label">Time of day</span><div class="chips">${TIMES.map((t) => chip('time', t[0], t[1], settings.get('time') === t[0])).join('')}</div></div>
        <div class="group"><span class="label">Weather</span><div class="chips">${WEATHERS.map((w) => chip('weather', w[0], w[1], settings.get('weather') === w[0])).join('')}</div></div>
        <button type="button" class="go" id="back">Back to the room</button>
        <p class="hint">Tap the kitty to pet her. Drag her to pick her up. Click the lamp to switch it. Click the window to change the weather. Press H to hide or show the interface.</p>`;
      body.querySelectorAll('.chip').forEach((b) => b.addEventListener('click', () => {
        settings.set(b.dataset.group, b.dataset.id); apply();
        body.querySelectorAll(`.chip[data-group="${b.dataset.group}"]`).forEach((o) => { const on = o === b; o.classList.toggle('on', on); o.setAttribute('aria-pressed', on); });
      }));
      body.querySelector('#back').addEventListener('click', p.close);
    },
  });
  initControls({ onSettings: () => panel.toggle() });

  function showTitle() {                           // title screen: cream page, logo, start button (Cody's art)
    root.className = 'title';
    root.innerHTML = `
      <div class="titlebox">
        <picture><source media="(max-width: 700px)" srcset="./art/title-logo-half.png" /><img class="logo" src="./art/title-logo.png" alt="Sleepy Kitty" width="377" height="310" /></picture>
        <button type="button" class="startbtn" id="go" aria-label="Start"><picture><source media="(max-width: 700px)" srcset="./art/title-button-half.png" /><img src="./art/title-button.png" alt="" width="465" height="120" /></picture></button>
      </div>`;
    root.hidden = false;
    requestAnimationFrame(() => root.classList.add('open'));
    root.querySelector('#go').addEventListener('click', () => { root.classList.remove('open'); setTimeout(() => { root.hidden = true; }, 350); });
    root.querySelector('#go').focus();
  }
  if (api.skip) { root.hidden = true; return; }
  showTitle();
}
