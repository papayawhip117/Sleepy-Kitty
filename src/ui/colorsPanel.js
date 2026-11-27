// Room colours: three rows of colour swatches (bedding, rug, curtains). It only writes the settings store; the room reacts to that.
import { createPanel } from './panel.js';
import { settings } from '../state/settings.js';
import { COLOR_OPTIONS } from '../scene/roomColors.js';

const ROWS = [['bed', 'Bedding', 'bedColor'], ['rug', 'Rug', 'rugColor'], ['curtains', 'Curtains', 'curtainColor']];

export function initColorsPanel() {
  return createPanel({
    id: 'colors', title: 'Room colours', modal: false, anchor: 'corner',
    render(body, p) {
      body.innerHTML = ROWS.map(([target, label, key]) => `
        <div class="row"><span class="label">${label}</span>
          <div class="icons">${COLOR_OPTIONS[target].map((o) => `
            <button type="button" class="ico swatch${settings.get(key) === o.id ? ' on' : ''}" data-key="${key}" data-id="${o.id}" aria-pressed="${settings.get(key) === o.id}" title="${o.name}">
              <span class="dot" style="background:${o.sw}"></span><span class="cap">${o.name}</span></button>`).join('')}
          </div></div>`).join('') + '<button type="button" class="go small" id="close">Done</button>';
      body.querySelectorAll('.swatch').forEach((b) => b.addEventListener('click', () => {
        settings.set(b.dataset.key, b.dataset.id);
        body.querySelectorAll(`.swatch[data-key="${b.dataset.key}"]`).forEach((o) => { const on = o === b; o.classList.toggle('on', on); o.setAttribute('aria-pressed', on); });
      }));
      body.querySelector('#close').addEventListener('click', p.close);
    },
  });
}
