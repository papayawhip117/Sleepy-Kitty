// The window's environment panel: three horizontal rows of little icon buttons (season, weather, time of day).
// It does not own any environment state: it reads and writes the settings store, and the room reacts to that.
import { createPanel } from './panel.js';
import { pixelIcon } from './icons.js';
import { settings } from '../state/settings.js';

const ROWS = [
  { key: 'season', label: 'Season', items: [['spring', 'Spring'], ['summer', 'Summer'], ['autumn', 'Autumn'], ['winter', 'Winter']] },
  { key: 'weather', label: 'Weather', items: [['clear', 'Clear'], ['overcast', 'Cloudy'], ['rain', 'Rain'], ['snow', 'Snow']] },
  { key: 'time', label: 'Time of day', items: [['morning', 'Morning'], ['afternoon', 'Afternoon'], ['dusk', 'Dusk'], ['night', 'Night']], extra: ['auto', 'Real time'] },
];
const iconFor = (key, id) => (key === 'weather' && id === 'overcast' ? 'cloudy' : id);

export function initWindowPanel() {
  return createPanel({
    id: 'window', title: 'The window', modal: false, anchor: 'corner',
    render(body, p) {
      body.innerHTML = ROWS.map((r) => `
        <div class="row" data-key="${r.key}"><span class="label">${r.label}</span>
          <div class="icons">${[...r.items, ...(r.extra ? [r.extra] : [])].map(([id, name]) => `
            <button type="button" class="ico${settings.get(r.key) === id ? ' on' : ''}" data-key="${r.key}" data-id="${id}" aria-pressed="${settings.get(r.key) === id}" title="${name}">
              ${pixelIcon(iconFor(r.key, id))}<span class="cap">${name}</span></button>`).join('')}
          </div></div>`).join('') + '<button type="button" class="go small" id="close">Done</button>';
      body.querySelectorAll('.ico').forEach((b) => b.addEventListener('click', () => {
        settings.set(b.dataset.key, b.dataset.id);
        body.querySelectorAll(`.ico[data-key="${b.dataset.key}"]`).forEach((o) => { const on = o === b; o.classList.toggle('on', on); o.setAttribute('aria-pressed', on); });
      }));
      body.querySelector('#close').addEventListener('click', p.close);
    },
  });
}
