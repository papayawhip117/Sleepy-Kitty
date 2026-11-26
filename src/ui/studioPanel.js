// Kitty Studio: the laptop on the desk opens this panel, where the player picks the kitty's coat. Each coat is its own
// sprite sheet (no colour filters), so choosing one just swaps the sheet. The choice is saved in the settings store.
import { createPanel } from './panel.js';
import { settings } from '../state/settings.js';

export function initStudioPanel(coats) {   // coats: [{ id, name, img, meta }]
  const preview = (c) => {                                   // the first "blinking" frame (eyes open), drawn from the sheet at its own pixel size
    const m = c.meta.rows.blink, [w, h] = m.sizes[0], [cw, ch] = c.meta.cell, cv = document.createElement('canvas');
    cv.width = w; cv.height = h; cv.className = 'pxi'; cv.getContext('2d').drawImage(c.img, Math.floor((cw - w) / 2), m.row * ch + ch - 1 - h, w, h, 0, 0, w, h);
    return cv;
  };
  return createPanel({
    id: 'studio', title: 'Kitty Studio', subtitle: 'pick her coat', modal: false, anchor: 'corner',
    render(body, p) {
      body.innerHTML = '<div class="row"><div class="icons coats"></div></div><button type="button" class="go small" id="close">Done</button>';
      const box = body.querySelector('.coats');
      for (const c of coats) {
        const b = document.createElement('button'); b.type = 'button'; b.className = 'ico coat' + (settings.get('coat') === c.id ? ' on' : ''); b.title = c.name;
        b.setAttribute('aria-pressed', settings.get('coat') === c.id); b.append(preview(c));
        const cap = document.createElement('span'); cap.className = 'cap'; cap.textContent = c.name; b.append(cap);
        b.addEventListener('click', () => { settings.set('coat', c.id); box.querySelectorAll('.coat').forEach((o) => { const on = o === b; o.classList.toggle('on', on); o.setAttribute('aria-pressed', on); }); });
        box.append(b);
      }
      body.querySelector('#close').addEventListener('click', p.close);
    },
  });
}
