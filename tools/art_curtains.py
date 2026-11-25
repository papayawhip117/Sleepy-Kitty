#!/usr/bin/env python3
"""Cut the 8-frame curtain sheet (art/raw/curtains-v1.png, 4x2 frames, each a rod with a left and a right panel)
into game assets: a static rod and 8 left + 8 right panel frames in fixed cells, hung from the rod.

Cleanup: the raw alpha is noisy (soft haze, stray specks). Alpha under 200 is dropped, small islands are removed, and the
art is reduced 2:1 (2x2 block mode) so one art pixel matches one room pixel; the game draws it at that size with no resampling.
Outputs public/art/curtains.png (cells: row 0 left panels, row 1 right panels), curtains-rod.png, curtains.json.
"""
import json
from pathlib import Path
import numpy as np
from PIL import Image
from collections import deque

ROOT = Path(__file__).resolve().parent.parent
SRC, OUT = ROOT / "art" / "raw" / "curtains-v1.png", ROOT / "public" / "art"
FW, FH, R = 543, 362, 2                                     # source frame size, reduction factor

a = np.array(Image.open(SRC).convert("RGBA"))
a[..., 3] = np.where(a[..., 3] > 200, 255, 0)


def islands(mask, minimum):
    seen = np.zeros_like(mask); H, W = mask.shape
    for y0 in range(H):
        for x0 in range(W):
            if mask[y0, x0] and not seen[y0, x0]:
                comp, q = [], deque([(y0, x0)]); seen[y0, x0] = True
                while q:
                    y, x = q.popleft(); comp.append((y, x))
                    for dy in (-1, 0, 1):
                        for dx in (-1, 0, 1):
                            yy, xx = y + dy, x + dx
                            if 0 <= yy < H and 0 <= xx < W and mask[yy, xx] and not seen[yy, xx]:
                                seen[yy, xx] = True; q.append((yy, xx))
                if len(comp) < minimum:
                    for y, x in comp: mask[y, x] = False
    return mask


frames = []
for fi in range(8):
    c, r = fi % 4, fi // 4
    f = a[r * FH:(r + 1) * FH, c * FW:(c + 1) * FW].copy()
    m = islands(f[..., 3] > 0, 400)                          # drop specks and haze fragments
    f[~m] = 0
    frames.append(f)

# panel split: the empty gap between the panels, measured below the rod
def split_of(f):
    occ = (f[90:, :, 3] > 0).any(0)
    xs = np.nonzero(~occ)[0]; best = (0, 0)
    for run in np.split(xs, np.where(np.diff(xs) > 1)[0] + 1):
        if len(run) > best[1] - best[0] and run[0] > 40 and run[-1] < FW - 40: best = (run[0], run[-1] + 1)
    return best

def reduce(img):                                            # 2x2 block mode, opaque if at least 2 of 4 pixels are
    h, w = (img.shape[0] // R) * R, (img.shape[1] // R) * R
    out = np.zeros((h // R, w // R, 4), np.uint8)
    for y in range(h // R):
        for x in range(w // R):
            blk = img[y * R:y * R + R, x * R:x * R + R].reshape(-1, 4); op = blk[blk[:, 3] > 0]
            if len(op) >= 2:
                vals, cnt = np.unique(op, axis=0, return_counts=True); out[y, x] = vals[cnt.argmax()]
    return out

L, Rt, rods = [], [], []
for f in frames:
    g0, g1 = split_of(f)
    left, right = f.copy(), f.copy()
    left[:, g0:] = 0; right[:, :g1] = 0
    rod = f.copy(); rod[:, :g0] = 0; rod[:, g1:] = 0
    # the rod reaches into each panel's header rows: trim anything beyond the body's own width in the top 40 rows
    lb = np.nonzero(left[75:95, :, 3].any(0))[0]; rb = np.nonzero(right[75:95, :, 3].any(0))[0]
    left[:75, lb.max() + 8:] = 0; right[:75, :rb.min() - 8] = 0
    top = 46
    lx = np.nonzero(left[top:top + 14, :, 3].any(0))[0].min(); rx = np.nonzero(right[top:top + 14, :, 3].any(0))[0].max()
    L.append((left, lx)); Rt.append((right, rx)); rods.append((rod, g0, g1))

# align: left panels on their header's left edge, right panels on their header's right edge
PW, PH, MARGIN = 360, 300, 36                                          # cell size in source pixels (before reduction)
def place(img, anchor_x, from_right):
    cell = np.zeros((PH, PW, 4), np.uint8)
    ys, xs = np.nonzero(img[..., 3] > 0)
    y0 = 40
    sub = img[y0:y0 + PH]
    if from_right:
        x1 = anchor_x + 1 + MARGIN; x0 = x1 - PW; sx0 = max(0, x0); cell[:sub.shape[0], sx0 - x0:sx0 - x0 + (x1 - sx0)] = sub[:, sx0:x1]
    else:
        x0 = max(0, anchor_x - MARGIN); x1 = min(FW, x0 + PW); cell[:sub.shape[0], :x1 - x0] = sub[:, x0:x1]
    return cell

cellsL = [place(img, ax, False) for img, ax in L]
cellsR = [place(img, ax, True) for img, ax in Rt]
cw, ch = PW // R, PH // R
sheet = np.zeros((2 * ch, 8 * cw, 4), np.uint8)
for i in range(8):
    sheet[0:ch, i * cw:(i + 1) * cw] = reduce(cellsL[i])[:ch, :cw]
    sheet[ch:2 * ch, i * cw:(i + 1) * cw] = reduce(cellsR[i])[:ch, :cw]
Image.fromarray(sheet).save(OUT / "curtains.png")

# the rod: one modal colour per row taken from the gap between the panels (frame 7), tiled across the panels' span
rod, g0, g1 = rods[7]
ys, xs = np.nonzero(rod[:, g0 + 12:g1 - 12, 3] > 0)
y0r, y1r = ys.min(), ys.max() + 1
rows = []
for y in range(y0r, y1r):
    px = rod[y, g0 + 12:g1 - 12]; px = px[px[:, 3] > 0]
    vals, cnt = np.unique(px, axis=0, return_counts=True); rows.append(vals[cnt.argmax()] if len(px) else np.zeros(4, np.uint8))
span = Rt[7][1] - L[7][1] + 1
rod_img = np.repeat(np.array(rows, np.uint8)[:, None, :], span, axis=1)
rod_img = reduce(np.repeat(rod_img, 1, axis=0))
Image.fromarray(rod_img).save(OUT / "curtains-rod.png")
rod_y = int((y0r - 40) // R)                                 # rod's top, in art pixels below the cell top
meta = {"cell": [cw, ch], "frames": 8, "scale": "1 art pixel = 1 room pixel (draw at 2 buffer pixels)",
        "gap_px_source": [int(g0), int(g1)], "span_source": [int(L[7][1]), int(Rt[7][1])], "rod_y": rod_y, "header_x": MARGIN // R}
json.dump(meta, open(OUT / "curtains.json", "w"), indent=1)
print(meta, sheet.shape)
