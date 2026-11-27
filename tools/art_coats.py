#!/usr/bin/env python3
"""Cut the coat sprite sheets (one 1536x1024 sheet per coat, same five rows as the white kitty: sleeping 4, blinking 5,
stretching 5, walking 6, picked up 4) into one fixed-cell game sheet per coat, in the same layout as the white kitty's.

  python3 tools/art_coats.py            # reads art/raw/kitty-coat-<coat>.png, writes public/art/kitty-<coat>.png + .json

No resampling and no recolouring: each output pixel is a 2:1 block of the source (scale 0.5, an integer step) and takes
the most common colour of that block, so every colour in the result is a colour that was already in the sheet. The cream
panel is dropped by a flood fill from the frame border, plus a thin pale fringe peel. Frames are placed in a cell anchored
bottom-centre (top-centre for the picked-up row) so she does not jump when frames or coats change.
"""
import json
from pathlib import Path
import numpy as np
from PIL import Image

ROOT = Path(__file__).resolve().parent.parent
RAW, OUT = ROOT / "art" / "raw", ROOT / "public" / "art"
COATS = ["ginger", "black", "calico", "grey"]
STEP = 2                                                     # source pixels per output pixel
ROWS = [("sleep", 4, "bottom", 285), ("blink", 5, "bottom", 285), ("stretch", 5, "bottom", 285), ("walk", 6, "bottom", 262), ("held", 4, "top", 285)]
BOUNDS = (185, 385, 585, 775)                                # approximate row boundaries; the emptiest stripe near each is used


def locate(a):
    bg = a[3, 3]
    fg = np.abs(a - bg).sum(-1) > 28
    prof = fg[:, 300:].sum(1)
    split = [int(b - 25 + np.argmin(prof[b - 25:b + 25])) for b in BOUNDS]
    bands = list(zip([0] + split, split + [a.shape[0]]))
    out = {}
    for (name, n, anchor, skip), (y0, y1) in zip(ROWS, bands):
        sub = fg[y0:y1, skip:]
        cols = np.where(sub.sum(0) > 1)[0]; segs = []
        for c in cols:
            if segs and c - segs[-1][1] <= 3: segs[-1][1] = c
            else: segs.append([c, c])
        while len(segs) > n:                                 # small marks (zz, hearts, yawn ticks) merge into the nearest figure
            g = [segs[k + 1][0] - segs[k][1] for k in range(len(segs) - 1)]; k = int(np.argmin(g)); segs[k] = [segs[k][0], segs[k + 1][1]]; del segs[k + 1]
        assert len(segs) == n, (name, len(segs), n)
        boxes = []
        for c0, c1 in segs:
            ys = np.where(sub[:, c0:c1 + 1].any(1))[0]
            boxes.append((c0 + skip, y0 + int(ys.min()), c1 + skip + 1, y0 + int(ys.max()) + 1))
        out[name] = boxes
    return out


def cut(a, box, bgc):
    x0, y0, x1, y1 = box[0] - 8, box[1] - 8, box[2] + 8, box[3] + 8
    x0, y0 = max(0, x0 - (x0 % STEP)), max(0, y0 - (y0 % STEP)); x1, y1 = min(a.shape[1], x1), min(a.shape[0], y1)
    c = a[y0:y1, x0:x1]; H, W = c.shape[:2]
    bgm = np.abs(c - bgc).sum(-1) < 40
    seen = np.zeros((H, W), bool); st = [(y, x) for y in range(H) for x in range(W) if (y in (0, H - 1) or x in (0, W - 1)) and bgm[y, x]]
    for y, x in st: seen[y, x] = True
    while st:
        y, x = st.pop()
        for yy, xx in ((y + 1, x), (y - 1, x), (y, x + 1), (y, x - 1)):
            if 0 <= yy < H and 0 <= xx < W and bgm[yy, xx] and not seen[yy, xx]: seen[yy, xx] = True; st.append((yy, xx))
    fgm = ~seen
    for _ in range(2):                                       # peel the pale fringe outside the outline
        edge = fgm & ~(np.roll(fgm, 1, 0) & np.roll(fgm, -1, 0) & np.roll(fgm, 1, 1) & np.roll(fgm, -1, 1))
        fgm &= ~(edge & (np.abs(c - bgc).sum(-1) < 90))
    keep = np.zeros_like(fgm); lab = np.zeros((H, W), int); n = 0           # keep only pieces that belong to this frame
    fx0, fy0, fx1, fy1 = box[0] - x0, box[1] - y0, box[2] - x0, box[3] - y0
    for y in range(H):
        for x in range(W):
            if fgm[y, x] and not lab[y, x]:
                n += 1; stk = [(y, x)]; lab[y, x] = n; pts = []
                while stk:
                    py, px = stk.pop(); pts.append((py, px))
                    for yy in (py - 1, py, py + 1):
                        for xx in (px - 1, px, px + 1):
                            if 0 <= yy < H and 0 <= xx < W and fgm[yy, xx] and not lab[yy, xx]: lab[yy, xx] = n; stk.append((yy, xx))
                p = np.array(pts); cy, cx = p.mean(0)
                if len(pts) > 300 or (len(pts) > 40 and fx0 - 4 <= cx <= fx1 + 4 and fy0 - 4 <= cy <= fy1 + 4): keep[p[:, 0], p[:, 1]] = True
    fgm = keep
    oh, ow = H // STEP, W // STEP
    res = np.zeros((oh, ow, 4), np.uint8)
    for oy in range(oh):
        for ox in range(ow):
            m = fgm[oy * STEP:(oy + 1) * STEP, ox * STEP:(ox + 1) * STEP]
            if m.mean() < 0.5: continue
            blk = c[oy * STEP:(oy + 1) * STEP, ox * STEP:(ox + 1) * STEP][m].astype(np.uint8).reshape(-1, 3)
            cols, cnt = np.unique(blk, axis=0, return_counts=True)
            res[oy, ox, :3] = cols[cnt.argmax()]; res[oy, ox, 3] = 255
    im = Image.fromarray(res)
    return im.crop(im.getbbox())


def main():
    rep = {}
    for coat in COATS:
        a = np.array(Image.open(RAW / f"kitty-coat-{coat}.png").convert("RGB")).astype(int)
        boxes = locate(a); bgc = a[3, 3]
        cells = {n: [cut(a, b, bgc) for b in bs] for n, bs in boxes.items()}
        cw = max(im.width for fs in cells.values() for im in fs) + 2; ch = max(im.height for fs in cells.values() for im in fs) + 2
        sheet = Image.new("RGBA", (cw * 6, ch * 5)); meta = {"cell": [cw, ch], "rows": {}}
        for r, (name, n, anchor, _s) in enumerate(ROWS):
            for i, im in enumerate(cells[name]):
                sheet.alpha_composite(im, (i * cw + (cw - im.width) // 2, r * ch + (ch - 1 - im.height if anchor == "bottom" else 1)))
            meta["rows"][name] = {"row": r, "frames": n, "anchor": anchor, "sizes": [list(im.size) for im in cells[name]]}
        sheet.save(OUT / f"kitty-{coat}.png"); (OUT / f"kitty-{coat}.json").write_text(json.dumps(meta, indent=1) + "\n")
        rep[coat] = {"cell": [cw, ch], "blink0": meta["rows"]["blink"]["sizes"][0], "sleep0": meta["rows"]["sleep"]["sizes"][0]}
    print(json.dumps(rep))


if __name__ == "__main__":
    main()
