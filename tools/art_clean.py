#!/usr/bin/env python3
"""Turn a generated or hand-drawn image into a clean Window Kitty pixel-art layer.

What it does, in order:
  1. Optional crop to an aspect ratio (the room shell must be 16:9).
  2. Background removal: the magenta key (#FF00FF) and, with --bg auto, the flat
     background colour touching the image corners.
  3. Downscale to the piece's true pixel size (--width). Each output pixel takes the
     most common palette colour of its source block, so blurry "fake pixels" from
     AI tools snap back onto a clean grid.
  4. Snap every colour to the Window Kitty palette (OKLab distance).
  5. Despeckle: lone pixels and checkerboard dithering are folded into their
     neighbours (turn off with --keep-noise).
  6. Writes the layer PNG, a 4x preview, and a report with a style check.

Example:
  python3 tools/art_clean.py raw/bed.png --width 200 --bg auto --name bed
"""
import argparse
import json
from collections import Counter
from pathlib import Path

import numpy as np
from PIL import Image

ROOT = Path(__file__).resolve().parent.parent
PALETTE = ROOT / "art" / "palette" / "window-kitty.json"


def hex_rgb(h):
    h = h.lstrip("#")
    return tuple(int(h[i:i + 2], 16) for i in (0, 2, 4))


def to_oklab(rgb):
    c = np.asarray(rgb, dtype=np.float64) / 255.0
    c = np.where(c <= 0.04045, c / 12.92, ((c + 0.055) / 1.055) ** 2.4)
    m1 = np.array([[0.4122214708, 0.5363325363, 0.0514459929],
                   [0.2119034982, 0.6806995451, 0.1073969566],
                   [0.0883024619, 0.2817188376, 0.6299787005]])
    m2 = np.array([[0.2104542553, 0.7936177850, -0.0040720468],
                   [1.9779984951, -2.4285922050, 0.4505937099],
                   [0.0259040371, 0.7827717662, -0.8086757660]])
    lms = np.cbrt(c @ m1.T)
    return lms @ m2.T


def load_palette():
    p = json.loads(PALETTE.read_text())
    names, cols = [], []
    for ramp, hexes in p["ramps"].items():
        for i, h in enumerate(hexes):
            names.append(f"{ramp}{i}")
            cols.append(hex_rgb(h))
    return names, np.array(cols, dtype=np.uint8), hex_rgb(p["key"])


def nearest(lab_pixels, lab_pal):
    d = ((lab_pixels[:, None, :] - lab_pal[None, :, :]) ** 2).sum(-1)
    idx = d.argmin(1)
    return idx, np.sqrt(d[np.arange(len(idx)), idx])


def crop_aspect(img, aspect):
    w, h = img.size
    aw, ah = (float(x) for x in aspect.split(":"))
    target = aw / ah
    if w / h > target:
        nw = round(h * target)
        x = (w - nw) // 2
        return img.crop((x, 0, x + nw, h))
    nh = round(w / target)
    y = (h - nh) // 2
    return img.crop((0, y, w, y + nh))


def background_mask(rgb, key, auto_bg, tol_key=90, tol_bg=28):
    """True where the pixel is background (to become transparent)."""
    f = rgb.astype(np.int32)
    mask = np.abs(f - np.array(key)).sum(-1) < tol_key
    if auto_bg:
        h, w, _ = f.shape
        corners = [f[0, 0], f[0, w - 1], f[h - 1, 0], f[h - 1, w - 1]]
        bg = np.median(np.array(corners), axis=0)
        near = np.abs(f - bg).sum(-1) < tol_bg
        # flood fill from the border so background-coloured pixels inside the art stay
        seen = np.zeros_like(near)
        stack = [(y, x) for y in (0, h - 1) for x in range(w)] + \
                [(y, x) for x in (0, w - 1) for y in range(h)]
        while stack:
            y, x = stack.pop()
            if seen[y, x] or not near[y, x]:
                continue
            seen[y, x] = True
            if y > 0: stack.append((y - 1, x))
            if y < h - 1: stack.append((y + 1, x))
            if x > 0: stack.append((y, x - 1))
            if x < w - 1: stack.append((y, x + 1))
        mask |= seen
    return mask


def grow_mask(rgb_small, step=0.03, halo=0.06, min_blob=12, hole_tol=0.0):
    """Background on a soft gradient/vignette (no flat colour): grow from the border
    through neighbours whose colour changes only a little per pixel. Then peel halo
    pixels on the edge and drop tiny specks. Works at native resolution."""
    h, w, _ = rgb_small.shape
    lab = to_oklab(rgb_small.reshape(-1, 3).astype(float)).reshape(h, w, 3)
    d = lambda a, b: np.sqrt(((lab[a] - lab[b]) ** 2).sum())
    seen = np.zeros((h, w), bool)
    st = [(y, x) for y in (0, h - 1) for x in range(w)] + [(y, x) for x in (0, w - 1) for y in range(h)]
    for p in st:
        seen[p] = True
    while st:
        y, x = st.pop()
        for q in ((y - 1, x), (y + 1, x), (y, x - 1), (y, x + 1)):
            if 0 <= q[0] < h and 0 <= q[1] < w and not seen[q] and d(q, (y, x)) < step:
                seen[q] = True
                st.append(q)
    for _ in range(2):  # peel soft glow left on the edge
        peel = []
        for y in range(h):
            for x in range(w):
                if seen[y, x]:
                    continue
                nb = [q for q in ((y - 1, x), (y + 1, x), (y, x - 1), (y, x + 1))
                      if 0 <= q[0] < h and 0 <= q[1] < w and seen[q]]
                if nb and min(d((y, x), q) for q in nb) < halo:
                    peel.append((y, x))
        for p in peel:
            seen[p] = True
    lbl = np.zeros((h, w), int)  # drop small opaque specks
    n = 0
    for y in range(h):
        for x in range(w):
            if seen[y, x] or lbl[y, x]:
                continue
            n += 1
            comp, st = [], [(y, x)]
            lbl[y, x] = n
            while st:
                p = st.pop()
                comp.append(p)
                for q in ((p[0] - 1, p[1]), (p[0] + 1, p[1]), (p[0], p[1] - 1), (p[0], p[1] + 1)):
                    if 0 <= q[0] < h and 0 <= q[1] < w and not seen[q] and not lbl[q]:
                        lbl[q] = n
                        st.append(q)
            if len(comp) < min_blob:
                for p in comp:
                    seen[p] = True
    # enclosed background (gaps between leaves, under stools): same colour as the outer background
    if seen.any():
        bgc = np.median(lab[seen], axis=0)
        holes = (~seen) & (np.sqrt(((lab - bgc) ** 2).sum(-1)) < hole_tol)
        seen |= holes
    return seen


def downscale(idx, opaque, out_w, out_h):
    """Mode-of-block resample. idx/opaque are full-res; returns low-res index map (-1 = clear)."""
    h, w = idx.shape
    out = np.full((out_h, out_w), -1, dtype=np.int32)
    ys = np.linspace(0, h, out_h + 1)
    xs = np.linspace(0, w, out_w + 1)
    for j in range(out_h):
        y0, y1 = ys[j], ys[j + 1]
        my = (y1 - y0) * 0.2  # ignore block edges, where AI images blur between pixels
        ya, yb = int(y0 + my), max(int(y0 + my) + 1, int(np.ceil(y1 - my)))
        for i in range(out_w):
            x0, x1 = xs[i], xs[i + 1]
            mx = (x1 - x0) * 0.2
            xa, xb = int(x0 + mx), max(int(x0 + mx) + 1, int(np.ceil(x1 - mx)))
            op = opaque[ya:yb, xa:xb]
            if op.mean() < 0.5:
                continue
            vals = idx[ya:yb, xa:xb][op]
            out[j, i] = np.bincount(vals).argmax()
    return out


def despeckle(q, ramp_of, passes=2):
    """Fold noise into its surroundings while keeping deliberate 1px details.
    A pixel is folded when all four side-neighbours share one other colour and either
    it is checkerboard dithering (same colour on a diagonal) or it is just a nearby
    tone of the same ramp (noise). A lone sparkle in a different colour family stays."""
    h, w = q.shape
    fixed = 0
    for _ in range(passes):
        for y in range(1, h - 1):
            for x in range(1, w - 1):
                c = q[y, x]
                if c < 0:
                    continue
                n4 = {q[y - 1, x], q[y + 1, x], q[y, x - 1], q[y, x + 1]}
                if len(n4) != 1:
                    continue
                b = n4.pop()
                if b < 0 or b == c:
                    continue
                diag = c in (q[y - 1, x - 1], q[y - 1, x + 1], q[y + 1, x - 1], q[y + 1, x + 1])
                if diag or ramp_of.get(int(c)) == ramp_of.get(int(b)):
                    q[y, x] = b
                    fixed += 1
    return fixed


def checker_score(q):
    """Share of 2x2 blocks that are a two-colour checkerboard (dithering)."""
    a, b, c, d = q[:-1, :-1], q[:-1, 1:], q[1:, :-1], q[1:, 1:]
    chk = (a == d) & (b == c) & (a != b) & (a >= 0) & (b >= 0)
    valid = (a >= 0) & (b >= 0) & (c >= 0) & (d >= 0)
    return float(chk.sum()) / max(1, valid.sum())


def main():
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("src")
    ap.add_argument("--width", type=int, help="true pixel width of the finished piece")
    ap.add_argument("--scale", type=float, help="instead of --width: final pixels per source pixel (keeps several crops of one sheet at the same scale)")
    ap.add_argument("--box", help="crop x0,y0,x1,y1 in source pixels first (cut one piece out of a sheet)")
    ap.add_argument("--height", type=int, help="defaults to keeping the aspect ratio")
    ap.add_argument("--aspect", help="centre-crop first, e.g. 16:9 for the room shell")
    ap.add_argument("--bg", choices=["none", "auto", "grow"], default="none", help="auto: flat background from the corners; grow: soft gradient/vignette background")
    ap.add_argument("--halo", type=float, default=0.06, help="--bg grow: how different an edge pixel may be from the background and still be peeled")
    ap.add_argument("--peel-light", type=float, help="peel up to 2px of very light edge fringe (sticker outline) with OKLab lightness above this, e.g. 0.88")
    ap.add_argument("--holes", type=float, default=0.0, help="--bg grow: also clear enclosed pixels this close (OKLab) to the background colour, e.g. 0.03")
    ap.add_argument("--shadow", help="hex colour of a painted wall shadow; those pixels become a soft translucent shadow that works on any wall")
    ap.add_argument("--smooth", action="store_true", help="area-average downscale (smoother, finer detail) instead of block-mode; colours are still snapped to the palette")
    ap.add_argument("--keep-key", action="store_true", help="keep magenta as an opaque colour (window cutout mask)")
    ap.add_argument("--keep-noise", action="store_true")
    ap.add_argument("--name", help="output name, default = source file name")
    ap.add_argument("--out", default=str(ROOT / "art" / "layers"))
    a = ap.parse_args()

    names, pal, key = load_palette()
    lab_pal = to_oklab(pal)
    img = Image.open(a.src).convert("RGBA")
    if a.box:
        img = img.crop(tuple(int(v) for v in a.box.split(",")))
    if a.aspect:
        img = crop_aspect(img, a.aspect)
    rgba = np.array(img)
    rgb, alpha = rgba[..., :3], rgba[..., 3] > 127
    is_key = np.abs(rgb.astype(np.int32) - np.array(key)).sum(-1) < 90
    bg = background_mask(rgb, key, a.bg == "auto")
    if a.keep_key:
        bg &= ~is_key
    opaque = alpha & ~bg

    # Snap full-res pixels to the palette (the key gets its own index at the end).
    flat = rgb.reshape(-1, 3)
    uniq, inv = np.unique(flat, axis=0, return_inverse=True)
    uidx, udist = nearest(to_oklab(uniq), lab_pal)
    idx = uidx[inv.ravel()].reshape(rgb.shape[:2])
    dist = udist[inv.ravel()].reshape(rgb.shape[:2])
    key_i = len(pal)
    if a.keep_key:
        idx[is_key] = key_i

    out_w = a.width or max(1, round(img.size[0] * a.scale))
    out_h = a.height or round(img.size[1] * out_w / img.size[0])
    if a.smooth:
        # average the source colours per output pixel (keeps fine detail and soft shading), then snap to the palette
        avg = np.array(Image.fromarray(rgb).resize((out_w, out_h), Image.Resampling.BOX))
        ai, _ad = nearest(to_oklab(avg.reshape(-1, 3).astype(float)), lab_pal)
        q = ai.reshape(out_h, out_w).astype(np.int32)
        cov = np.array(Image.fromarray((opaque * 255).astype(np.uint8)).resize((out_w, out_h), Image.Resampling.BOX)) > 127
        q[~cov] = -1
        if a.keep_key:
            kk = np.array(Image.fromarray((is_key * 255).astype(np.uint8)).resize((out_w, out_h), Image.Resampling.BOX)) > 127
            q[kk & cov] = key_i
    else:
        q = downscale(idx, opaque, out_w, out_h)
    if a.bg == "grow":
        small = np.array(Image.fromarray(rgb).resize((out_w, out_h), Image.Resampling.BOX))
        q[grow_mask(small, halo=a.halo, hole_tol=a.holes)] = -1
    shadow_mask = None
    if a.shadow:
        small = np.array(Image.fromarray(rgb).resize((out_w, out_h), Image.Resampling.BOX))
        sl = to_oklab(small.reshape(-1, 3).astype(float)).reshape(out_h, out_w, 3)
        sc = to_oklab(np.array([hex_rgb(a.shadow)], dtype=float))[0]
        shadow_mask = np.sqrt(((sl - sc) ** 2).sum(-1)) < 0.04
        q[shadow_mask] = -1
    if a.peel_light:
        full_pal = np.vstack([pal, np.array([key], dtype=np.uint8)])
        L = to_oklab(full_pal)[:, 0]
        for _ in range(2):
            t = q < 0
            edge = np.zeros_like(t)
            edge[1:] |= t[:-1]; edge[:-1] |= t[1:]; edge[:, 1:] |= t[:, :-1]; edge[:, :-1] |= t[:, 1:]
            peel = edge & (q >= 0) & (L[np.maximum(q, 0)] > a.peel_light)
            q[peel] = -1
    checker_before = checker_score(q)
    ramp_of = {i: n.rstrip("0123456789") for i, n in enumerate(names)}
    fixed = 0 if a.keep_noise else despeckle(q, ramp_of)

    full = np.vstack([pal, np.array([key], dtype=np.uint8)])
    out = np.zeros((out_h, out_w, 4), dtype=np.uint8)
    m = q >= 0
    out[m, :3] = full[q[m]]
    out[m, 3] = 255

    if shadow_mask is not None:
        out[shadow_mask] = (58, 35, 80, 56)  # plum at ~22% opacity
    name = a.name or Path(a.src).stem
    od = Path(a.out)
    (od / "preview").mkdir(parents=True, exist_ok=True)
    Image.fromarray(out).save(od / f"{name}.png")
    Image.fromarray(out).resize((out_w * 4, out_h * 4), Image.NEAREST).save(od / "preview" / f"{name}@4x.png")

    used = Counter(int(v) for v in q[m])
    kept = np.array(Image.fromarray((m * 255).astype(np.uint8)).resize(img.size, Image.NEAREST)) > 0
    src_px = opaque & ~is_key & kept
    off = float((dist[src_px] > 0.06).mean()) if src_px.any() else 0.0
    block = img.size[0] / out_w
    report = {
        "piece": name,
        "size": [out_w, out_h],
        "source_px_per_pixel": round(block, 2),
        "colours_used": len(used),
        "top_colours": [(names[i] if i < len(names) else "key", n) for i, n in used.most_common(8)],
        "off_palette_share": round(off, 3),
        "dither_share_before_cleanup": round(checker_before, 3),
        "lone_pixels_fixed": fixed,
        "transparent_share": round(1 - m.mean(), 3),
    }
    warn = []
    if off > 0.25:
        warn.append("Many source colours are far from the palette; the piece will look recoloured. Regenerate with the palette in the prompt.")
    if checker_before > 0.04:
        warn.append("Source has heavy dithering/noise; check the cleaned version still reads well.")
    if block < 3:
        warn.append("Source is barely bigger than the target; it may not be real pixel art at this size.")
    report["warnings"] = warn
    (od / "preview" / f"{name}.report.json").write_text(json.dumps(report, indent=2))
    print(json.dumps(report, indent=2))


if __name__ == "__main__":
    main()
