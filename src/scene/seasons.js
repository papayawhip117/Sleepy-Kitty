// Season looks for the window plates, made in code from the existing summer-style plates (no painted spring, autumn or winter art exists yet).
// Every output pixel is computed from the same pixel of the source plate: no resampling, so the art stays crisp.
// When painted seasonal plates arrive, drop them in via PLATE_OVERRIDES and this colour shifting is skipped for them.
export const SEASONS = ['spring', 'summer', 'autumn', 'winter'];
export const PLATE_OVERRIDES = {};   // e.g. { 'autumn-day': HTMLImageElement } once real plates exist

const cache = new Map();
const hash = (x, y, s = 0) => { const n = Math.sin(x * 127.1 + y * 311.7 + s * 74.7) * 43758.5453; return n - Math.floor(n); };
function rgb2hsl(r, g, b) {
  r /= 255; g /= 255; b /= 255; const mx = Math.max(r, g, b), mn = Math.min(r, g, b), l = (mx + mn) / 2, d = mx - mn;
  if (!d) return [0, 0, l];
  const s = d / (1 - Math.abs(2 * l - 1)); let h;
  if (mx === r) h = ((g - b) / d) % 6; else if (mx === g) h = (b - r) / d + 2; else h = (r - g) / d + 4;
  return [((h * 60) + 360) % 360, s, l];
}
function hsl2rgb(h, s, l) {
  const c = (1 - Math.abs(2 * l - 1)) * s, x = c * (1 - Math.abs(((h / 60) % 2) - 1)), m = l - c / 2;
  const [r, g, b] = h < 60 ? [c, x, 0] : h < 120 ? [x, c, 0] : h < 180 ? [0, c, x] : h < 240 ? [0, x, c] : h < 300 ? [x, 0, c] : [c, 0, x];
  return [Math.round((r + m) * 255), Math.round((g + m) * 255), Math.round((b + m) * 255)];
}
const isFoliage = (h, s, l) => h >= 45 && h <= 170 && s > 0.12 && l > 0.06 && l < 0.88;

function shift(img, season) {
  const w = img.width, h = img.height, cv = document.createElement('canvas'); cv.width = w; cv.height = h;
  const c = cv.getContext('2d', { willReadFrequently: true }); c.drawImage(img, 0, 0);
  const id = c.getImageData(0, 0, w, h), d = id.data, src = new Uint8ClampedArray(d);
  const foliage = new Uint8Array(w * h);
  for (let i = 0; i < w * h; i++) { const [H, S, L] = rgb2hsl(src[i * 4], src[i * 4 + 1], src[i * 4 + 2]); foliage[i] = isFoliage(H, S, L) ? 1 : 0; }
  const put = (i, [r, g, b]) => { d[i * 4] = r; d[i * 4 + 1] = g; d[i * 4 + 2] = b; };
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    const i = y * w + x, [H, S, L] = rgb2hsl(src[i * 4], src[i * 4 + 1], src[i * 4 + 2]);
    if (season === 'spring') {
      if (foliage[i]) {
        put(i, hsl2rgb(H + (105 - H) * 0.4, Math.min(1, S * 1.12), Math.min(0.9, L + 0.05)));
        if (L > 0.32 && hash(x >> 1, y >> 1, 3) < 0.04) put(i, hash(x >> 1, y >> 1, 4) < 0.5 ? [250, 198, 216] : [255, 240, 246]);   // blossoms: 2x2 clusters on lit leaves
      }
    } else if (season === 'autumn') {
      if (foliage[i]) {
        const hills = H > 135, r = hash(x >> 2, y >> 2, 1);
        const base = L < 0.28 ? 12 : L < 0.45 ? 26 : 42;                                   // shaded leaves red-brown, mid orange, lit gold
        const hue = hills ? 30 : base + (r < 0.22 ? 10 : r > 0.82 ? -10 : 0);
        put(i, hsl2rgb(hue, hills ? 0.32 : Math.max(0.5, S * 1.2), Math.min(0.78, L + (hills ? 0.04 : 0.03))));
      }
    } else if (season === 'winter') {
      if (foliage[i]) {
        const up = (dy) => (y - dy >= 0 ? foliage[(y - dy) * w + x] : 0);
        const topEdge = !up(1) || !up(2) || (!up(3) && hash(x, y, 5) < 0.7);                 // the upper rim of every tree and bush is snow
        if (topEdge || L > 0.5) put(i, [236, 244, 252]);                                       // snow on every tree top and on the leaves the light catches
        else if (L > 0.4) put(i, [196, 214, 232]);                                           // snow in the half-light
        else put(i, hsl2rgb(208, 0.22, Math.min(0.7, L * 0.6 + 0.3)));                       // shaded branches stay cool blue-grey
      } else if (H >= 190 && H <= 255 && S > 0.2) put(i, hsl2rgb(H, S * 0.7, Math.min(0.9, L + 0.03)));   // the sky goes pale
      else if ((H > 290 || H < 20) && S > 0.3 && L > 0.5) put(i, hsl2rgb(H, S * 0.25, Math.min(0.92, L + 0.05)));   // flowers fade
    }
  }
  c.putImageData(id, 0, 0);
  return cv;
}
// returns a drawable (the original plate for summer)
export function seasonPlate(img, key, season) {
  const over = PLATE_OVERRIDES[`${season}-${key}`]; if (over) return over;
  if (season === 'summer') return img;
  const k = `${key}-${season}`;
  if (!cache.has(k)) cache.set(k, shift(img, season));
  return cache.get(k);
}
