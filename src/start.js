// Title screen, plus the "how to play" panel (built on the shared panel system in ui/panel.js).
import { createPanel } from './ui/panel.js';
import { initControls } from './ui/ui.js';
import { initAudioPanel } from './ui/audioPanel.js';

export function initStart(api) {
  const root = document.getElementById('start');
  const panel = createPanel({
    id: 'settings', title: 'Sleepy Kitty', subtitle: 'a cozy little room with a sleepy kitty',
    render(body, p) {
      body.innerHTML = `
        <p class="hint first">Tap the kitty to pet her. Drag her to pick her up: she can rest on the bed, the windowsill or the floor. Click the lamp to switch it. Click the window to change the season, weather and time of day. Press H to hide or show the interface.</p>
        <button type="button" class="go" id="back">Back to the room</button>`;
      body.querySelector('#back').addEventListener('click', p.close);
    },
  });
  const audioPanel = initAudioPanel();
  initControls({ onSettings: () => panel.toggle(), onAudio: () => audioPanel.toggle(), onColors: api.onColors });

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
