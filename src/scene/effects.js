// Window effects drawn in window-glass space (outside the room, behind the frame): falling leaves, fireflies, twinkling stars.
const rng = (n) => { const x = Math.sin(n * 127.1) * 43758.5453; return x - Math.floor(x); };
const px = (b, K, x, y, w, h) => b.fillRect(Math.round(x * K) / K, Math.round(y * K) / K, w / K, h / K);   // snap to the 2x pixel grid

export function drawLeaves(b, K, win, t, amount) {
  if (amount <= 0.01) return;
  const [x0, y0, x1, y1] = win, gw = x1 - x0, gh = y1 - y0, colours = ['#d9792f', '#e8a23a', '#b9452c', '#f0c05a'];
  for (let i = 0; i < 16; i++) {
    const sp = 9 + rng(i + 2) * 7, ph = rng(i + 9) * gh;
    const y = y0 + ((rng(i + 1) * gh + t * sp) % gh), sway = Math.sin(t * (0.5 + rng(i + 4) * 0.5) + i * 2) * 6;
    const x = x0 + ((rng(i) * gw + sway + t * 3 + gw) % gw);
    b.fillStyle = colours[i % 4]; b.globalAlpha = Math.min(1, 0.9 * amount) * Math.min(1, Math.min(y - y0, y1 - y) / 6);
    px(b, K, x, y, 3, 2); px(b, K, x + 0.5 * K / K, y + 1, 1, 1);
  }
  b.globalAlpha = 1;
}
export function drawFireflies(b, K, win, t, amount) {
  if (amount <= 0.01) return;
  const [x0, y0, x1, y1] = win, gw = x1 - x0, gh = y1 - y0;
  for (let i = 0; i < 9; i++) {
    const cx = x0 + rng(i) * gw, cy = y0 + gh * (0.55 + rng(i + 1) * 0.4);          // they hover over the trees in the lower part
    const x = cx + Math.sin(t * (0.2 + rng(i + 2) * 0.25) + i * 3) * 10, y = cy + Math.sin(t * (0.25 + rng(i + 3) * 0.2) + i) * 5;
    const glow = Math.max(0, Math.sin(t * (0.5 + rng(i + 4) * 0.5) + i * 7)) ** 2 * amount;   // slow pulse, irregular per firefly
    if (glow < 0.03) continue;
    b.fillStyle = `rgba(255,230,120,${0.22 * glow})`; px(b, K, x - 1, y - 1, 3, 3);
    b.fillStyle = `rgba(255,244,170,${0.95 * glow})`; px(b, K, x, y, 1, 1);
  }
}
// star positions are read from the night plate itself (small bright pixels in the sky), so the twinkles sit on the painted stars
export function findStars(img, win) {
  const w = img.width, h = img.height, c = document.createElement('canvas'); c.width = w; c.height = h;
  const g = c.getContext('2d', { willReadFrequently: true }); g.drawImage(img, 0, 0); const d = g.getImageData(0, 0, w, Math.floor(h * 0.5)).data, out = [];
  const lum = (x, y) => { const i = (y * w + x) * 4; return (d[i] * 0.3 + d[i + 1] * 0.59 + d[i + 2] * 0.11); };
  for (let y = 2; y < h * 0.5 - 2; y++) for (let x = 2; x < w - 2; x++) {
    const l = lum(x, y); if (l < 150) continue;
    if (lum(x - 2, y) < 90 && lum(x + 2, y) < 90 && lum(x, y - 2) < 90 && lum(x, y + 2) < 90) out.push([win[0] + x / w * (win[2] - win[0]), win[1] + y / h * (win[3] - win[1])]);   // isolated bright dot
  }
  return out;
}
export function drawStars(b, K, stars, t, amount) {
  if (amount <= 0.01) return;
  stars.forEach(([x, y], i) => {
    const a = Math.max(0, Math.sin(t * (0.7 + rng(i) * 0.9) + i * 5)) ** 3 * amount;
    if (a < 0.05) return;
    b.fillStyle = `rgba(255,248,215,${0.7 * a})`; px(b, K, x - 1, y, 3, 1); px(b, K, x, y - 1, 1, 3);   // a little cross glint
  });
}
