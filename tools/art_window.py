"""Cut the dusk and night window plates from art/raw/window-dusk-night-v1.png (two stacked panels).
Each panel is trimmed inside its soft border, centre-cropped to the window's aspect (224x137) and reduced to 446x274
(2 buffer px per room unit) by block mode, so every output pixel is an existing colour: no blur, no new shades."""
import numpy as np
from pathlib import Path
from PIL import Image

ROOT = Path(__file__).parent.parent
raw = np.array(Image.open(ROOT / "art/raw/window-dusk-night-v1.png").convert("RGB"))
OW, OH = 446, 274
X0, X1 = 299, 1287                                   # inside the antialiased left/right edges
PANELS = {"dusk": (2, 489), "night": (499, 986)}     # inside the soft top/bottom edges (rows, end exclusive)

def block_mode(src, ow, oh):
    h, w, _ = src.shape
    q = (src >> 3).astype(np.int32)                  # 5-bit per channel, so JPEG-style noise folds together
    key = (q[..., 0] << 10) | (q[..., 1] << 5) | q[..., 2]
    out = np.zeros((oh, ow, 3), np.uint8)
    ys = np.linspace(0, h, oh + 1).astype(int); xs = np.linspace(0, w, ow + 1).astype(int)
    for j in range(oh):
        for i in range(ow):
            blk = key[ys[j]:ys[j + 1], xs[i]:xs[i + 1]].ravel()
            m = np.bincount(blk).argmax()
            sel = (blk == m)
            px = src[ys[j]:ys[j + 1], xs[i]:xs[i + 1]].reshape(-1, 3)[sel]
            out[j, i] = np.median(px, axis=0).astype(np.uint8)
    return out

for name, (y0, y1) in PANELS.items():
    p = raw[y0:y1, X0:X1]
    h, w, _ = p.shape
    cw = int(round(h * OW / OH)); x0 = (w - cw) // 2
    Image.fromarray(block_mode(p[:, x0:x0 + cw], OW, OH)).save(ROOT / f"public/art/scenery-{name}.png")
    print(name, p.shape, "->", (OW, OH))
