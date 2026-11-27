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

// the choices per target: { id, name, sw (swatch colour), dh (hue shift) } for bed and rug, { hue, sat } for the curtains
export const COLOR_OPTIONS = {
  bed: [{ id: 'original', name: 'Blush', sw: '#f0b4c4' }, { id: 'sage', name: 'Sage', sw: '#a8c8a0', dh: 110 }, { id: 'sky', name: 'Sky', sw: '#a0c4e8', dh: -160 }, { id: 'lilac', name: 'Lilac', sw: '#c4a8e0', dh: -75 }, { id: 'butter', name: 'Butter', sw: '#f0d890', dh: 25 }, { id: 'coral', name: 'Coral', sw: '#f4a890', dh: 12 }],
  rug: [{ id: 'original', name: 'Cream', sw: '#f6e2c0' }, { id: 'sage', name: 'Sage', sw: '#a8c8a0', dh: 150 }, { id: 'sky', name: 'Sky', sw: '#a0c4e8', dh: -130 }, { id: 'lilac', name: 'Lilac', sw: '#c4a8e0', dh: -70 }, { id: 'butter', name: 'Butter', sw: '#f0d890', dh: 55 }, { id: 'coral', name: 'Coral', sw: '#f4a890', dh: 30 }],
  curtains: [{ id: 'original', name: 'White', sw: '#fbeee6' }, { id: 'rose', name: 'Rose', sw: '#f4b8c8', hue: 345, sat: 0.55 }, { id: 'sage', name: 'Sage', sw: '#b8d8b0', hue: 120, sat: 0.4 }, { id: 'sky', name: 'Sky', sw: '#b0d0f0', hue: 208, sat: 0.6 }, { id: 'lilac', name: 'Lilac', sw: '#d0b8f0', hue: 270, sat: 0.5 }, { id: 'butter', name: 'Butter', sw: '#f4e0a0', hue: 45, sat: 0.7 }],
};

function recolour(img, target, opt) {
  const w = img.width, h = img.height, cv = document.createElement('canvas'); cv.width = w; cv.height = h;
  const c = cv.getContext('2d', { willReadFrequently: true }); c.drawImage(img, 0, 0);
  const id = c.getImageData(0, 0, w, h), d = id.data, skip = SKIP[target];
  for (let i = 0; i < w * h; i++) {
    if (d[i * 4 + 3] === 0) continue;
    const [H, S, L] = rgb2hsl(d[i * 4], d[i * 4 + 1], d[i * 4 + 2]);
    if (skip(H, S, L)) continue;
    const [r, g, b] = opt.hue !== undefined ? hsl2rgb(opt.hue, Math.max(S * 1.1, opt.sat * Math.min(1, (1 - Math.abs(2 * L - 1)) * 2.2)), L)   // curtains: tint the pale cloth, folds stay
      : hsl2rgb(H + opt.dh, S, L);                                                                                                  // bed and rug: turn the hue
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
