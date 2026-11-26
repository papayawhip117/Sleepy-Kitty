// Reusable UI panel: a small pixel-framed card laid over the room. Only one panel is open at a time, Escape closes it,
// and the whole UI layer can be hidden by Cozy Mode (see ui.js) without ever touching the canvas or its animation loop.
const open = new Set();
let root;
const rootEl = () => root || (root = document.getElementById('ui-root'));
export function createPanel({ id, title, subtitle = '', render, onClose, modal = true }) {
  const el = document.createElement('div');
  el.className = 'kpanel' + (modal ? ' modal' : ''); el.id = 'panel-' + id; el.hidden = true;
  el.innerHTML = `<div class="card" role="dialog" aria-label="${title}"><h1>${title}</h1>${subtitle ? `<p class="sub">${subtitle}</p>` : ''}<div class="body"></div></div>`;
  el.addEventListener('pointerdown', (e) => { if (e.target === el) api.close(); });   // click outside the card closes it
  rootEl().appendChild(el);
  const api = {
    el, get isOpen() { return !el.hidden; },
    open() {
      for (const p of [...open]) if (p !== api) p.close();
      render(el.querySelector('.body'), api); el.hidden = false; open.add(api);
      requestAnimationFrame(() => el.classList.add('shown'));
      el.querySelector('button')?.focus();
    },
    close() {
      if (el.hidden) return;
      el.classList.remove('shown'); el.hidden = true; open.delete(api); onClose?.();
    },
    toggle() { api.isOpen ? api.close() : api.open(); },
  };
  return api;
}
export const closeAllPanels = () => [...open].forEach((p) => p.close());
export const anyPanelOpen = () => open.size > 0;
addEventListener('keydown', (e) => { if (e.key === 'Escape') closeAllPanels(); });
