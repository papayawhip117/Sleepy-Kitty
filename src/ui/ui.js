// The interface layer: a small control cluster (settings, Cozy Mode) and the Cozy Mode switch itself.
// Cozy Mode only hides DOM. The canvas keeps drawing, so weather, curtains, the kitty, lighting and (later) audio carry on untouched.
import { settings } from '../state/settings.js';
import { closeAllPanels } from './panel.js';

// tiny pixel icons: '#' is a filled pixel, drawn as crisp SVG rects
const icon = (rows, cls = '') => {
  const rects = rows.flatMap((r, y) => [...r].map((c, x) => (c === '#' ? `<rect x="${x}" y="${y}" width="1" height="1"/>` : ''))).join('');
  return `<svg class="px ${cls}" viewBox="0 0 ${rows[0].length} ${rows.length}" shape-rendering="crispEdges" aria-hidden="true" fill="currentColor">${rects}</svg>`;
};
const EYE = ['...#####...', '..#.....#..', '.#..###..#.', '#..#####..#', '.#..###..#.', '..#.....#..', '...#####...'];
const EYE_CLOSED = ['...........', '...........', '#.........#', '.#########.', '..#.#.#.#..', '...........', '...........'];

export function initControls({ onSettings }) {
  const cluster = document.getElementById('controls');
  cluster.innerHTML = `
    <button type="button" id="gear" aria-label="Settings" title="Settings">&#9881;</button>
    <button type="button" id="cozy-on" aria-label="Cozy mode: hide the interface" title="Cozy mode (H)">${icon(EYE_CLOSED)}</button>`;
  const restore = document.getElementById('cozy-off');
  restore.innerHTML = icon(EYE); restore.setAttribute('aria-label', 'Show the interface'); restore.title = 'Show the interface (H)';
  cluster.querySelector('#gear').addEventListener('click', onSettings);
  cluster.querySelector('#cozy-on').addEventListener('click', () => setCozy(true));
  restore.addEventListener('click', () => setCozy(false));

  let fade;
  const wake = () => { restore.classList.add('awake'); clearTimeout(fade); fade = setTimeout(() => restore.classList.remove('awake'), 2500); };   // the restore eye is nearly invisible when idle
  addEventListener('pointermove', () => { if (document.body.classList.contains('cozy')) wake(); });
  addEventListener('keydown', (e) => {
    if (e.key.toLowerCase() === 'h' && !e.ctrlKey && !e.metaKey && !e.altKey && !/input|textarea|select/i.test(document.activeElement?.tagName || '')) setCozy(!settings.get('cozy'));
  });
  function setCozy(on) {
    settings.set('cozy', on);
    document.body.classList.toggle('cozy', on);
    if (on) { closeAllPanels(); wake(); restore.focus({ preventScroll: true }); } else { restore.classList.remove('awake'); cluster.querySelector('#gear').focus({ preventScroll: true }); }
  }
  document.body.classList.toggle('cozy', !!settings.get('cozy'));
  return { setCozy };
}
export const isCozy = () => document.body.classList.contains('cozy');
