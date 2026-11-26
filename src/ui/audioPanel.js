// Compact audio panel: master mute and volume, then music, rain and nature, each with its own on/off and volume.
// Rain sound is separate from rain weather: you can have rain outside without hearing it, and the other way round.
import { createPanel } from './panel.js';
import { settings } from '../state/settings.js';
import { trackNames, nextTrack, currentTrack, audioRunning, usingFiles } from '../audio/audio.js';

export function initAudioPanel() {
  return createPanel({
    id: 'audio', title: 'Sounds', modal: false, anchor: 'corner',
    render(body, p) {
      const toggle = (key, label) => `<button type="button" class="chip tog${settings.get(key) ? ' on' : ''}" data-tog="${key}" aria-pressed="${!!settings.get(key)}">${label}</button>`;
      const slider = (key, label) => `<label class="vol"><span>${label}</span><input type="range" min="0" max="100" value="${Math.round(settings.get(key) * 100)}" data-vol="${key}" aria-label="${label}" /></label>`;
      body.innerHTML = `
        <div class="row"><span class="label">Everything</span><div class="line">${toggle('muted', 'Mute all')}${slider('masterVol', 'Volume')}</div></div>
        <div class="row"><span class="label">Music</span><div class="line">${toggle('musicOn', 'Music')}${slider('musicVol', 'Volume')}</div>
          <div class="line track"><button type="button" class="chip" id="prev" aria-label="Previous track">&lt;</button><span id="trackname">${currentTrack()}</span><button type="button" class="chip" id="next" aria-label="Next track">&gt;</button></div></div>
        <div class="row"><span class="label">Rain sound</span><div class="line">${toggle('rainOn', 'Rain')}${toggle('rainHeavy', 'Heavier')}${slider('rainVol', 'Volume')}</div></div>
        <div class="row"><span class="label">Nature</span><div class="line">${toggle('natureOn', 'Birds, crickets, wind')}${slider('natureVol', 'Volume')}</div></div>
        <p class="hint" id="audionote"></p>
        <button type="button" class="go small" id="close">Done</button>`;
      const note = body.querySelector('#audionote');
      const refresh = () => { note.textContent = (audioRunning() ? '' : 'Sound starts after your first tap or key press. ') + (usingFiles() ? '' : 'These sounds are placeholders made in code.'); };
      refresh(); setTimeout(refresh, 400);
      const tick = setInterval(() => { if (p.isOpen) body.querySelector('#trackname').textContent = currentTrack(); else clearInterval(tick); }, 1500);
      body.querySelectorAll('[data-tog]').forEach((b) => b.addEventListener('click', () => { const k = b.dataset.tog, v = !settings.get(k); settings.set(k, v); b.classList.toggle('on', v); b.setAttribute('aria-pressed', v); setTimeout(refresh, 300); }));
      body.querySelectorAll('[data-vol]').forEach((r) => r.addEventListener('input', () => settings.set(r.dataset.vol, r.value / 100)));
      body.querySelector('#prev').addEventListener('click', () => { nextTrack(-1); body.querySelector('#trackname').textContent = currentTrack(); });
      body.querySelector('#next').addEventListener('click', () => { nextTrack(1); body.querySelector('#trackname').textContent = currentTrack(); });
      body.querySelector('#close').addEventListener('click', p.close);
    },
  });
}
