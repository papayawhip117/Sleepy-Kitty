// Palettes picked by Cody. dusk = sunrise/sunset warmth, berry = night.
export const DUSK = { a: '#525871', b: '#857C91', c: '#CD9FA0', d: '#F2C1A3', e: '#F8CCAA' };
export const BERRY = { a: '#302E3B', b: '#61647C', c: '#7C8DA6', d: '#89A2BA', e: '#BEB3C3' };

export const hex = (h) => [parseInt(h.slice(1, 3), 16), parseInt(h.slice(3, 5), 16), parseInt(h.slice(5, 7), 16)];
export const mix = (h1, h2, t) => {
  const a = hex(h1), b = hex(h2);
  return '#' + a.map((v, i) => Math.round(v + (b[i] - v) * t).toString(16).padStart(2, '0')).join('');
};
export const rgba = (h, a) => { const [r, g, b] = hex(h); return `rgba(${r},${g},${b},${a})`; };
