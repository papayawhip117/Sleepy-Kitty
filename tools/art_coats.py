#!/usr/bin/env python3
"""Cut the four-coat sprite sheet (a 2x2 grid of labelled panels, same five rows as the white kitty) into one
fixed-cell sheet per coat, in the same layout and cell size as art/layers/kitty-sheet-2x-sheet.json so the game can
swap sheets without any code change.

  python3 tools/art_coats.py art/raw/kitty-coats-v1.png [--scale 0.93]

Per frame: find the figure on the panel's flat cream, drop the cream (flood fill from the frame border, then a thin
fringe peel), reduce the coat to a small palette of its own colours (the project palette is built from the white kitty
and would recolour the others), block-mode downscale so edges stay crisp, then place it in a cell anchored
bottom-centre (top-centre for the held row). Output: public/art/kitty-<coat>.png (+ the shared kitty.json layout).
"""
import argparse, json, sys
from pathlib import Path
import numpy as np
from PIL import Image
sys.path.insert(0, str(Path(__file__).resolve().parent))
from art_sprites import blobs

ROOT = Path(__file__).resolve().parent.parent
PANELS = {"ginger": (14, 14, 758, 500), "black": (782, 14, 1526, 500), "calico": (14, 526, 758, 1010), "grey": (782, 526, 1526, 1010)}
ROWS = [("sleep", 4, 92, "bottom"), ("blink", 92, 184, "bottom"), ("stretch", 184, 282, "bottom"), ("walk", 282, 366, "bottom"), ("held", 366, 484, "top")]
SKIP_X = 150


EXPECT = {"sleep": 4, "blink": 4, "stretch": 5, "walk": 5, "held": 4}


def frames_of(panel):
    """Find each row's frames by column occupancy: the row has a known number of figures, so the widest gaps separate them
    and the small marks (zz, hearts, yawn ticks) merge into the nearest figure."""
    a = np.array(panel).astype(int)
    fg = np.abs(a - a[3, 3]).sum(-1) > 28
    fg[:, a.shape[1] - 28:] = False; fg[:6] = False; fg[a.shape[0] - 10:] = False      # the rounded panel border
    prof = fg[:, SKIP_X:].sum(1); splits = [int(b - 16 + np.argmin(prof[b - 16:b + 16])) for b in (92, 184, 282, 366)]   # the thinnest stripe near each row boundary
    bands = list(zip([4] + splits, splits + [a.shape[0] - 10]))
    out = {}
    for (name, _a, _b, anchor), (y0, y1) in zip(ROWS, bands):
        sub = fg[y0:y1, SKIP_X:]
        cols = np.where(sub.sum(0) > 1)[0]
        segs = []
        for c in cols:
            if segs and c - segs[-1][1] <= 2: segs[-1][1] = c
            else: segs.append([c, c])
        segs = [s for s in segs if s[1] - s[0] >= 1]
        while len(segs) > EXPECT[name]:                      # merge the pair with the smallest gap (marks next to a figure)
            g = [segs[k + 1][0] - segs[k][1] for k in range(len(segs) - 1)]; k = int(np.argmin(g))
            segs[k] = [segs[k][0], segs[k + 1][1]]; del segs[k + 1]
        boxes = []
        for c0, c1 in segs:
            ys = np.where(sub[:, c0:c1 + 1].any(1))[0]
            boxes.append([c0 + SKIP_X, y0 + int(ys.min()), c1 + SKIP_X + 1, y0 + int(ys.max()) + 1])
        out[name] = (anchor, boxes)
    return out


def cut(panel, box, scale, bgc):
    x0, y0, x1, y1 = [v for v in box]; x0 -= 6; y0 -= 6; x1 += 6; y1 += 6
    a = np.array(panel.crop((x0, y0, x1, y1))).astype(int); H, W = a.shape[:2]
    bgm = np.abs(a - bgc).sum(-1) < 40
    seen = np.zeros((H, W), bool); st = [(y, x) for y in range(H) for x in range(W) if (y in (0, H - 1) or x in (0, W - 1)) and bgm[y, x]]
    for y, x in st: seen[y, x] = True
    while st:
        y, x = st.pop()
        for yy, xx in ((y + 1, x), (y - 1, x), (y, x + 1), (y, x - 1)):
            if 0 <= yy < H and 0 <= xx < W and bgm[yy, xx] and not seen[yy, xx]: seen[yy, xx] = True; st.append((yy, xx))
    fgm = ~seen
    for _ in range(2):                                       # peel the pale fringe around the outline (sticker halo)
        edge = fgm & ~(np.roll(fgm, 1, 0) & np.roll(fgm, -1, 0) & np.roll(fgm, 1, 1) & np.roll(fgm, -1, 1))
        fgm &= ~(edge & (np.abs(a - bgc).sum(-1) < 110))
    keep = np.zeros_like(fgm); lab = np.zeros((H, W), int); n = 0                       # only pieces that belong to this frame (drops edges of neighbouring frames and the panel border)
    fx0, fy0, fx1, fy1 = box[0] - x0, box[1] - y0, box[2] - x0, box[3] - y0
    for y in range(H):
        for x in range(W):
            if fgm[y, x] and not lab[y, x]:
                n += 1; stk = [(y, x)]; lab[y, x] = n; pts = []
                while stk:
                    py, px = stk.pop(); pts.append((py, px))
                    for yy, xx in ((py + 1, px), (py - 1, px), (py, px + 1), (py, px - 1), (py + 1, px + 1), (py - 1, px - 1), (py + 1, px - 1), (py - 1, px + 1)):
                        if 0 <= yy < H and 0 <= xx < W and fgm[yy, xx] and not lab[yy, xx]: lab[yy, xx] = n; stk.append((yy, xx))
                cy, cx = np.mean(pts, 0); big = len(pts) > 60 or (fx0 <= cx <= fx1 and fy0 <= cy <= fy1 and len(pts) > 6)
                ptsa = np.array(pts); thin = (np.ptp(ptsa[:, 0]) <= 6 and np.ptp(ptsa[:, 1]) > 25 and len(pts) < 160) or (np.ptp(ptsa[:, 0]) <= 4 and np.ptp(ptsa[:, 1]) > 40) or (np.ptp(ptsa[:, 1]) <= 4 and np.ptp(ptsa[:, 0]) > 40)
                if big and not thin and fx0 - 4 <= cx <= fx1 + 4 and fy0 - 4 <= cy <= fy1 + 4: keep[ptsa[:, 0], ptsa[:, 1]] = True
    fgm = keep
    ys, xs = np.where(fgm)
    if not len(ys): return None
    rgb = Image.fromarray(a.astype(np.uint8))
    q = rgb.quantize(colors=20, method=Image.Quantize.MEDIANCUT, dither=Image.Dither.NONE).convert("RGB")
    qa = np.array(q); h, w = H, W
    oh, ow = max(1, round(h * scale)), max(1, round(w * scale))
    res = np.zeros((oh, ow, 4), np.uint8)
    for oy in range(oh):
        for ox in range(ow):
            sy0, sy1 = int(oy / scale), max(int(oy / scale) + 1, int((oy + 1) / scale)); sx0, sx1 = int(ox / scale), max(int(ox / scale) + 1, int((ox + 1) / scale))
            m = fgm[sy0:sy1, sx0:sx1]
            if m.mean() < 0.5: continue
            blk = qa[sy0:sy1, sx0:sx1][m]; cols, cnt = np.unique(blk.reshape(-1, 3), axis=0, return_counts=True)
            res[oy, ox, :3] = cols[cnt.argmax()]; res[oy, ox, 3] = 255
    im = Image.fromarray(res); return im.crop(im.getbbox())


def main():
    ap = argparse.ArgumentParser(); ap.add_argument("src"); ap.add_argument("--scale", type=float, default=0.93); a = ap.parse_args()
    meta = json.loads((ROOT / "art" / "layers" / "kitty-sheet-2x-sheet.json").read_text())
    cw, ch = meta["cell"]; src = Image.open(a.src).convert("RGB"); out = ROOT / "public" / "art"; rep = {}
    for coat, box in PANELS.items():
        panel = src.crop(box); bgc = np.array(panel)[3, 3].astype(int); fr = frames_of(panel)
        cells = {n: [cut(panel, f, a.scale, bgc) for f in fs] for n, (anc, fs) in fr.items()}
        cw2 = max(im.width for fs in cells.values() for im in fs) + 2; ch2 = max(im.height for fs in cells.values() for im in fs) + 2
        sheet = Image.new("RGBA", (cw2 * 6, ch2 * 5)); m = {"cell": [cw2, ch2], "rows": {}}
        for r, (name, y0, y1, anchor) in enumerate(ROWS):
            for c, im in enumerate(cells[name]):
                sheet.alpha_composite(im, (c * cw2 + (cw2 - im.width) // 2, r * ch2 + (ch2 - 1 - im.height if anchor == "bottom" else 1)))
            m["rows"][name] = {"row": r, "frames": len(cells[name]), "anchor": anchor, "sizes": [list(im.size) for im in cells[name]]}
        m["rows"]["walk"]["faces"] = "left"                   # the coat sheets walk facing left (the white sheet faces right)
        sheet.save(out / f"kitty-{coat}.png"); (out / f"kitty-{coat}.json").write_text(json.dumps(m, indent=1) + "\n")
        rep[coat] = {n: len(v) for n, v in cells.items()}; rep[coat]["cell"] = [cw2, ch2]
    print(json.dumps(rep))


if __name__ == "__main__":
    main()
