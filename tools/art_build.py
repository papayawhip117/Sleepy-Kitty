#!/usr/bin/env python3
"""Copy the approved layers into public/art for the game, turning the magenta window into real transparency
and writing art/scene manifest data the game reads (window rectangle)."""
import json, sys
from pathlib import Path
import numpy as np
from PIL import Image

ROOT = Path(__file__).resolve().parent.parent
SRC, OUT = ROOT / "art" / "layers", ROOT / "public" / "art"
OUT.mkdir(parents=True, exist_ok=True)

shell = np.array(Image.open(SRC / "shell-flat-v1.png").convert("RGBA"))
key = (shell[..., 0] == 255) & (shell[..., 1] == 0) & (shell[..., 2] == 255)
ys, xs = key.nonzero()
window = [int(xs.min()), int(ys.min()), int(xs.max()) + 1, int(ys.max()) + 1]
# also clear a 1px fringe of near-magenta pixels around the window so no pink edge shows
near = (shell[..., 0] > 190) & (shell[..., 1] < 150) & (shell[..., 2] > 140) & (shell[..., 2] > shell[..., 1] + 30)
for _ in range(3):
    grow = key.copy(); grow[1:] |= key[:-1]; grow[:-1] |= key[1:]; grow[:, 1:] |= key[:, :-1]; grow[:, :-1] |= key[:, 1:]
    key = key | (grow & near)
shell[key, 3] = 0
Image.fromarray(shell).save(OUT / "room-shell.png")
json.dump({"size": [480, 270], "scale": 2, "window": window}, open(OUT / "scene.json", "w"))
print("window", window)

import shutil
for n in ("scenery-day-v1",):
    shutil.copy(SRC / f"{n}.png", OUT / (n.replace("-v1", "") + ".png"))

shutil.copy(SRC / "sunbeams-v1.png", OUT / "sunbeams.png")

# ---- furniture layers (Stage 2) ----
from PIL import ImageOps
desk = Image.open(SRC / "desk-v3.png").convert("RGBA")
import colorsys
da = np.array(desk)
for y in range(desk.height):
    for x in range(desk.width):
        r, g, b_, a_ = da[y, x]
        if not a_:
            continue
        h, l, sat = colorsys.rgb_to_hls(r / 255, g / 255, b_ / 255)
        if y >= 180 and 0.80 <= h <= 0.97 and 0.55 <= l <= 0.85:
            da[y, x, 3] = 0                                  # lilac floor/knee shadow baked into the desk art
        if y >= 286 and l > 0.78 and (h < 0.06 or h > 0.9):
            da[y, x, 3] = 0                                  # pink floor shadow under the legs
        if 30 <= x <= 100 and 76 <= y <= 104:
            da[y, x, 3] = 0                                  # remnant of a small wall frame
        if 190 <= x <= 260 and 82 <= y <= 84:
            da[y, x, 3] = 0                                  # tail of the shelf vine above the lamp
desk = Image.fromarray(da)
body = desk.crop((0, 82, desk.width, desk.height))          # below the wall shelf, which is placed separately
body = ImageOps.mirror(body)                                 # lamp ends up on the left, clear of the window
sys.path.insert(0, str(Path(__file__).parent))
from art_tidy import tidy, hls
ba = np.array(body)
yy, xx = np.mgrid[0:ba.shape[0], 0:ba.shape[1]]
l_, s_ = hls(ba)
pale_pink = (l_ > 0.72) & (ba[..., 0] > ba[..., 1])
ba[pale_pink & (yy >= 176) & ((xx < 180) | (xx > 260) | (yy >= 208)), 3] = 0   # floor-shadow specks (blanket sits x90-130, y<104)
ba = tidy(ba, min_island=120, fringe=lambda a: (xx >= 192) & (yy <= 160) & (hls(a)[0] > 0.72))  # cream fringe on the leaves
# desk plant: the two top leaves were cut flat by the original sheet's edge; round their tops and outline them
for (x0, x1) in ((217, 246), (247, 276)):                    # leaf spans at the flat row (body coords)
    ba[22:31, 275:280, 3] = 0; ba[19:23, 255:275, 3] = 0                                    # stray tip above the right leaf
    for y, trim in ((23, 13), (24, 13), (25, 9), (26, 9), (27, 5), (28, 5), (29, 2), (30, 2)):
        ba[y, x0:x0 + trim, 3] = 0; ba[y, x1 - trim:x1, 3] = 0
    for x in range(x0, x1):
        col = np.nonzero(ba[19:32, x, 3])[0]
        if len(col):
            y = 19 + col[0]
            if y >= 23:
                ba[y, x] = (82, 79, 69, 255)                 # leaf outline colour used elsewhere on the plant
body = Image.fromarray(ba)
body.save(OUT / "desk-body.png")
Image.fromarray(tidy(np.array(Image.open(SRC / "bed-v4.png").convert("RGBA")), min_island=160, spur_passes=2)).save(OUT / "bed.png")   # drop stray 1px specks on the duvet edge
ra = np.array(Image.open(SRC / "rug-v5.png").convert("RGBA"))
for _ in range(2):                                           # majority filter: smooths the ragged silhouette
    op = (ra[..., 3] > 0).astype(int); pad = np.pad(op, 1)
    cnt = sum(pad[1 + dy:pad.shape[0] - 1 + dy, 1 + dx:pad.shape[1] - 1 + dx] for dy in (-1, 0, 1) for dx in (-1, 0, 1))
    newop = cnt >= 5
    fill = newop & (ra[..., 3] == 0)                         # grow into a gap: copy the nearest opaque neighbour colour
    for y, x in zip(*np.nonzero(fill)):
        for dy, dx in ((0, 1), (0, -1), (1, 0), (-1, 0)):
            yy, xx = y + dy, x + dx
            if 0 <= yy < ra.shape[0] and 0 <= xx < ra.shape[1] and ra[yy, xx, 3]:
                ra[y, x] = ra[yy, xx]; break
    ra[~newop, 3] = 0
ra = tidy(ra, min_island=160, spur_passes=2)
Image.fromarray(ra).save(OUT / "rug.png")

# ---- wall pieces (Stage 3): the shelf is cut at 0.1 so one art pixel is one 2x-buffer pixel (71x50 room units);
# the hanging plant is cut at 2x (56x101 room units). Both are cut from the raw sheets in one pass.
for n, o in (("shelves-v1", "shelves.png"), ("plant-hanging-v2", "plant-hanging.png")):
    wa = np.array(Image.open(SRC / f"{n}.png").convert("RGBA"))
    cream = (wa[..., 0] > 232) & (wa[..., 1] > 222) & (wa[..., 2] > 205) & (wa[..., 3] > 0)   # leftover cream background caught inside leaf gaps and lantern/dome edges
    if n == "shelves-v1":                                    # keep the white-hot lantern flame and candle glow: they are not background
        yy, xx = np.mgrid[0:wa.shape[0], 0:wa.shape[1]]
        for lt in json.load(open(SRC / "shelves-v1.glow.json"))["lights"]:
            cream &= ((xx - lt["x"]) ** 2 + (yy - lt["y"]) ** 2) > (lt["radius"] * 0.9) ** 2
    wa[cream, 3] = 0
    for _ in range(2):                                       # then peel the pale pixels that now touch the new gaps (soft cream rims on leaves)
        op = wa[..., 3] > 0
        edge = op & ~(np.roll(op, 1, 0) & np.roll(op, -1, 0) & np.roll(op, 1, 1) & np.roll(op, -1, 1))
        l_ = (wa[..., :3].astype(int).sum(-1)) / 765
        wa[edge & (l_ > 0.86) & (wa[..., 1] > wa[..., 2] + 18), 3] = 0   # pale yellow-cream rims only: keeps white lantern glow and glass highlights
    if n == "shelves-v1":                                    # glass dome + mushrooms: the glass was ragged and half-transparent, so the whole display is removed and the shelf top left clear
        wa[0:35, 101:142, 3] = 0
        wa[40:48, 122:142, 3] = 0                            # pale glass reflection under the shelf
    Image.fromarray(tidy(wa, min_island=70, spur_passes=1)).save(OUT / o)   # drops floating specks
shutil.copy(SRC / "shelves-v1.glow.json", OUT / "shelves.glow.json")

# ---- kitty (Stage 4): the 2x sheet, cut from the raw sheet by tools/art_sprites.py (see art/README.md) ----
ka = np.array(Image.open(SRC / "kitty-sheet-2x-sheet.png").convert("RGBA"))
for _ in range(4):                                           # peel the pale background fringe that sits outside her brown outline
    op = ka[..., 3] > 0
    edge = op & ~(np.roll(op, 1, 0) & np.roll(op, -1, 0) & np.roll(op, 1, 1) & np.roll(op, -1, 1))
    ka[edge & (hls(ka)[0] > 0.78), 3] = 0
ka = tidy(ka, min_island=10, spur_passes=0)                  # keep whiskers; drop stray specks
Image.fromarray(ka).save(OUT / "kitty.png")
shutil.copy(SRC / "kitty-sheet-2x-sheet.json", OUT / "kitty.json")

# ---- start page art: Cody's original title screen (art/raw/title-screen-v2.png, 1672x941). The logo and the button are cut out
# at full size (no resampling) with the cream page colour keyed to transparent; a 2:1 box-filtered half-size copy of each is made for
# narrow screens. The page background is the same cream (#fcf3e9), so the art sits on it with no visible box. ----
ts = np.array(Image.open(ROOT / "art" / "raw" / "title-screen-v2.png").convert("RGB")).astype(int)
cream = np.array([252, 243, 233]); dist = np.abs(ts - cream).sum(-1)
alpha = np.clip((dist - 8) / 24, 0, 1)                    # soft key: crisp pixel edges stay crisp, noise in the cream goes fully clear
ts_rgba = np.dstack([ts.clip(0, 255), (alpha * 255).round()]).astype(np.uint8)
for name, (y0, y1, x0, x1) in {"title-logo": (223, 533, 648, 1025), "title-button": (597, 717, 603, 1068)}.items():
    crop = ts_rgba[y0:y1, x0:x1]
    Image.fromarray(crop).save(OUT / f"{name}.png")
    h, w = crop.shape[0] // 2 * 2, crop.shape[1] // 2 * 2                 # half size: average each 2x2 block (premultiplied)
    f = crop[:h, :w].astype(float); pa = f[..., 3:4] / 255
    pm = np.concatenate([f[..., :3] * pa, f[..., 3:4]], -1).reshape(h // 2, 2, w // 2, 2, 4).mean((1, 3))
    a2 = pm[..., 3:4] / 255; rgb = np.where(a2 > 0, pm[..., :3] / np.maximum(a2, 1e-6), 0)
    Image.fromarray(np.concatenate([rgb, pm[..., 3:4]], -1).round().clip(0, 255).astype(np.uint8)).save(OUT / f"{name}-half.png")
