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
    Image.fromarray(tidy(np.array(Image.open(SRC / f"{n}.png").convert("RGBA")), min_island=60, spur_passes=1)).save(OUT / o)   # drops floating specks
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

# ---- start page art (Cody's own title art, cut from his screenshot; shown at a whole-number scale, never resampled) ----
shutil.copy(SRC / "start-logo-v2.png", OUT / "start-logo.png")
shutil.copy(SRC / "start-button-v2.png", OUT / "start-button.png")
