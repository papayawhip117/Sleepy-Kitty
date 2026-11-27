// Room colours: the bedding, the rug and the curtains can be recoloured from the existing art, in code, keeping all the painted shading.
// Every output pixel comes from the same pixel of the source sprite (no resampling), and only hue and saturation change; lightness is kept,
// so folds, highlights and outlines survive. The wooden bed frame, the plants and the curtain rod are left alone.
// Results are cached per sprite and option, so changing a colour costs a few milliseconds once.
const cache = new Map();
function rgb2hsl(r, g, b) {
  r /= 255; g /= 255; b /= 255; const mx = Math.max(r, g, b), mn = Math.min(r, g, b), l = (mx + mn) / 2, d = mx - mn;
  if (!d) return [0, 0, l];
  const s = d / (1 - Math.abs(2 * l - 1)); let h;
  if (mx === r) h = ((g - b) / d) % 6; else if (mx === g) h = (b - r) / d + 2; else h = (r - g) / d + 4;
  return [((h * 60) + 360) % 360, s, l];
}
function hsl2rgb(h, s, l) {
  h = ((h % 360) + 360) % 360; const c = (1 - Math.abs(2 * l - 1)) * s, x = c * (1 - Math.abs(((h / 60) % 2) - 1)), m = l - c / 2;
  const [r, g, b] = h < 60 ? [c, x, 0] : h < 120 ? [x, c, 0] : h < 180 ? [0, c, x] : h < 240 ? [0, x, c] : h < 300 ? [x, 0, c] : [c, 0, x];
  return [Math.round((r + m) * 255), Math.round((g + m) * 255), Math.round((b + m) * 255)];
}
const isFoliage = (h, s, l) => h >= 45 && h <= 170 && s > 0.12 && l > 0.06 && l < 0.88;
const isWood = (h, s, l) => (h >= 5 && h <= 34 && s > 0.45 && l < 0.66) || (h >= 14 && h <= 26 && s > 0.8 && l < 0.76);   // wood frame, including its lit edge; the pale blanket and duvet are lighter

// what each target leaves alone
const isVine = (h, s, l) => h >= 36 && h <= 170 && s > 0.1 && l > 0.06 && l < 0.85;   // the plant on the headboard, including its dark olive outline
const SKIP = { bed: (h, s, l) => isVine(h, s, l) || isWood(h, s, l), rug: isFoliage, curtains: () => false };

// The choices per target. Every choice recolours with { hue, sat, lm, lo }: the pixel keeps its own light and dark (so folds, highlights and
// outlines survive), takes the new hue, and gets saturation `sat` scaled by how coloured the pixel was, and lightness `lo + lm * lightness`.
// The original sprite is the first choice. (swatch colours `sw` are for the panel buttons.)
const choices = (orig, t) => [orig, ...[['brown', 'Brown', '#9a6e50'], ['gray', 'Gray', '#6c6672'], ['purple', 'Purple', '#b08cd8'], ['blue', 'Light blue', '#a8d0f0'], ['pink', 'Pink', '#f0a0bc']].map(([id, name, sw]) => ({ id, name, sw, ...t[id] }))];
export const COLOR_OPTIONS = {
  bed: choices({ id: 'original', name: 'Blush', sw: '#f0b4c4' }, {
    brown: { hue: 27, sat: 0.34, lm: 0.62, lo: 0.2 }, gray: { hue: 268, sat: 0.07, lm: 0.55, lo: 0.1 }, purple: { hue: 272, sat: 0.42, lm: 0.92, lo: 0.04 },
    blue: { hue: 205, sat: 0.62, lm: 0.95, lo: 0.04 }, pink: { hue: 343, sat: 0.62, lm: 0.95, lo: 0.03 } }),
  rug: choices({ id: 'original', name: 'Cream', sw: '#f6e2c0' }, {
    brown: { hue: 28, sat: 0.32, lm: 0.62, lo: 0.2 }, gray: { hue: 268, sat: 0.07, lm: 0.55, lo: 0.12 }, purple: { hue: 272, sat: 0.42, lm: 0.92, lo: 0.04 },
    blue: { hue: 205, sat: 0.62, lm: 0.95, lo: 0.04 }, pink: { hue: 343, sat: 0.62, lm: 0.95, lo: 0.03 } }),
  curtains: choices({ id: 'original', name: 'White', sw: '#fbeee6' }, {
    brown: { hue: 28, sat: 0.3, lm: 0.55, lo: 0.3 }, gray: { hue: 268, sat: 0.06, lm: 0.52, lo: 0.3 }, purple: { hue: 272, sat: 0.4, lm: 0.85, lo: 0.1 },
    blue: { hue: 205, sat: 0.55, lm: 0.9, lo: 0.08 }, pink: { hue: 343, sat: 0.55, lm: 0.9, lo: 0.08 } }),
};

function recolour(img, target, opt) {
  const w = img.width, h = img.height, cv = document.createElement('canvas'); cv.width = w; cv.height = h;
  const c = cv.getContext('2d', { willReadFrequently: true }); c.drawImage(img, 0, 0);
  const id = c.getImageData(0, 0, w, h), d = id.data, skip = SKIP[target];
  for (let i = 0; i < w * h; i++) {
    if (d[i * 4 + 3] === 0) continue;
    const [H, S, L] = rgb2hsl(d[i * 4], d[i * 4 + 1], d[i * 4 + 2]);
    if (skip(H, S, L)) continue;
    const [r, g, b] = hsl2rgb(opt.hue, opt.sat * Math.min(1, 0.45 + S), Math.max(0, Math.min(0.97, opt.lo + opt.lm * L)));
    d[i * 4] = r; d[i * 4 + 1] = g; d[i * 4 + 2] = b;
  }
  c.putImageData(id, 0, 0);
  return cv;
}
// a drawable for the sprite in the chosen colour (the original image for 'original')
export function coloured(img, target, optId) {
  const opt = COLOR_OPTIONS[target].find((o) => o.id === optId);
  if (!opt || opt.id === 'original') return img;
  const k = `${target}-${opt.id}`;
  if (!cache.has(k)) cache.set(k, recolour(img, target, opt));
  return cache.get(k);
}
