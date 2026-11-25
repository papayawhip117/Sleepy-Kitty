#!/usr/bin/env python3
"""Slice a labelled sprite sheet (rows of frames on a flat background) into a clean,
fixed-cell sprite sheet with stable anchors, so frames don't jitter when played.

  python3 tools/art_sprites.py art/raw/kitty-sheet-v1.png --name kitty --scale 0.17 \
      --rows sleep:0:180 blink:190:370 stretch:380:575 walk:590:760 held:765:1010:top --skip-x 285

Each row is name:y0:y1[:top]. Frames are found as the large blobs in the row (labels left of --skip-x
are ignored), small blobs (zzz, hearts, eye marks) join the nearest frame. Each frame is cleaned with
art_clean.py, then placed in a cell anchored bottom-centre (or top-centre for ':top', e.g. held by the scruff).
"""
import argparse, json, subprocess, sys, tempfile
from pathlib import Path
import numpy as np
from PIL import Image

ROOT = Path(__file__).resolve().parent.parent


def blobs(fg, step=4):
    g = fg[::step, ::step]
    h, w = g.shape
    lbl = np.zeros((h, w), int)
    out, n = [], 0
    for y in range(h):
        for x in range(w):
            if g[y, x] and not lbl[y, x]:
                n += 1
                st, pts = [(y, x)], []
                lbl[y, x] = n
                while st:
                    p = st.pop()
                    pts.append(p)
                    for dy in (-1, 0, 1):
                        for dx in (-1, 0, 1):
                            q = (p[0] + dy, p[1] + dx)
                            if 0 <= q[0] < h and 0 <= q[1] < w and g[q] and not lbl[q]:
                                lbl[q] = n
                                st.append(q)
                ys = [p[0] for p in pts]; xs = [p[1] for p in pts]
                out.append([min(xs) * step, min(ys) * step, max(xs) * step + step, max(ys) * step + step, len(pts)])
    return out


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("src")
    ap.add_argument("--name", required=True)
    ap.add_argument("--scale", type=float, required=True)
    ap.add_argument("--rows", nargs="+", required=True)
    ap.add_argument("--skip-x", type=int, default=0)
    ap.add_argument("--min-area", type=int, default=150)
    ap.add_argument("--clean-args", default="--bg grow")
    a = ap.parse_args()

    src = np.array(Image.open(a.src).convert("RGB")).astype(int)
    fg = np.abs(src - src[3, 3]).sum(-1) > 40
    all_b = blobs(fg)
    tmp = Path(tempfile.mkdtemp())
    frames = {}
    for spec in a.rows:
        parts = spec.split(":")
        name, y0, y1 = parts[0], int(parts[1]), int(parts[2])
        anchor = parts[3] if len(parts) > 3 else "bottom"
        inrow = [b for b in all_b if y0 <= (b[1] + b[3]) / 2 < y1 and b[0] >= a.skip_x]
        big = sorted([b[:4] for b in inrow if b[4] >= a.min_area], key=lambda b: b[0])
        for b in inrow:
            if b[4] >= a.min_area:
                continue
            cx, cy = (b[0] + b[2]) / 2, (b[1] + b[3]) / 2
            d = [max(0, f[0] - cx, cx - f[2]) + max(0, f[1] - cy, cy - f[3]) for f in big]
            i = int(np.argmin(d))
            if d[i] < 80:
                f = big[i]
                big[i] = [min(f[0], b[0]), min(f[1], b[1]), max(f[2], b[2]), max(f[3], b[3])]
        frames[name] = (anchor, [])
        for k, f in enumerate(big):
            box = ",".join(str(v) for v in (f[0] - 8, f[1] - 8, f[2] + 8, f[3] + 8))
            nm = f"{name}{k}"
            subprocess.run([sys.executable, str(ROOT / "tools" / "art_clean.py"), a.src, "--box", box,
                            "--scale", str(a.scale), "--name", nm, "--out", str(tmp)] + a.clean_args.split(),
                           check=True, capture_output=True)
            im = Image.open(tmp / f"{nm}.png")
            bb = im.getbbox()
            frames[name][1].append(im.crop(bb))
    cw = max(im.width for _, fs in frames.values() for im in fs) + 2
    ch = max(im.height for _, fs in frames.values() for im in fs) + 2
    cols = max(len(fs) for _, fs in frames.values())
    sheet = Image.new("RGBA", (cw * cols, ch * len(frames)))
    meta = {"cell": [cw, ch], "rows": {}}
    for r, (name, (anchor, fs)) in enumerate(frames.items()):
        for c, im in enumerate(fs):
            x = c * cw + (cw - im.width) // 2
            y = r * ch + (ch - 1 - im.height if anchor == "bottom" else 1)
            sheet.alpha_composite(im, (x, y))
        meta["rows"][name] = {"row": r, "frames": len(fs), "anchor": anchor,
                              "sizes": [list(im.size) for im in fs]}
    od = ROOT / "art" / "layers"
    sheet.save(od / f"{a.name}-sheet.png")
    (od / f"{a.name}-sheet.json").write_text(json.dumps(meta, indent=2) + "\n")
    prev = Image.new("RGBA", sheet.size, (40, 160, 60, 255))
    prev.alpha_composite(sheet)
    prev.resize((sheet.width * 6, sheet.height * 6), Image.NEAREST).save(od / "preview" / f"{a.name}-sheet@6x.png")
    print(json.dumps(meta))


if __name__ == "__main__":
    main()
