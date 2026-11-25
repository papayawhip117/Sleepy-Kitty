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
json.dump({"size": [480, 270], "window": window}, open(OUT / "scene.json", "w"))
print("window", window)

import shutil
for n in ("scenery-day-v1",):
    shutil.copy(SRC / f"{n}.png", OUT / (n.replace("-v1", "") + ".png"))

shutil.copy(SRC / "sunbeams-v1.png", OUT / "sunbeams.png")

# ---- furniture layers (Stage 2) ----
from PIL import ImageOps
desk = Image.open(SRC / "desk-v2.png").convert("RGBA")
import colorsys
da = np.array(desk)
for y in range(desk.height):
    for x in range(desk.width):
        r, g, b_, a_ = da[y, x]
        if not a_:
            continue
        h, l, sat = colorsys.rgb_to_hls(r / 255, g / 255, b_ / 255)
        if y >= 90 and 0.80 <= h <= 0.97 and 0.55 <= l <= 0.85:
            da[y, x, 3] = 0                                  # lilac floor/knee shadow baked into the desk art
        if y >= 143 and l > 0.78 and (h < 0.06 or h > 0.9):
            da[y, x, 3] = 0                                  # pink floor shadow under the legs
        if 15 <= x <= 50 and 38 <= y <= 52:
            da[y, x, 3] = 0                                  # remnant of a small wall frame
        if 95 <= x <= 130 and 41 <= y <= 42:
            da[y, x, 3] = 0                                  # tail of the shelf vine above the lamp
desk = Image.fromarray(da)
body = desk.crop((0, 41, desk.width, desk.height))          # below the wall shelf, which is placed separately
body = ImageOps.mirror(body)                                 # lamp ends up on the left, clear of the window
sys.path.insert(0, str(Path(__file__).parent))
from art_tidy import tidy, hls
ba = np.array(body)
yy, xx = np.mgrid[0:ba.shape[0], 0:ba.shape[1]]
l_, s_ = hls(ba)
pale_pink = (l_ > 0.72) & (ba[..., 0] > ba[..., 1])
ba[pale_pink & (yy >= 88) & ((xx < 90) | (xx > 130) | (yy >= 104)), 3] = 0   # floor-shadow specks (blanket sits x90-130, y<104)
ba = tidy(ba, min_island=30, fringe=lambda a: (xx >= 96) & (yy <= 80) & (hls(a)[0] > 0.72))  # cream fringe on the leaves
body = Image.fromarray(ba)
body.save(OUT / "desk-body.png")
shutil.copy(SRC / "bed-v3.png", OUT / "bed.png")
ra = np.array(Image.open(SRC / "rug-v3.png").convert("RGBA"))
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
ra = tidy(ra, min_island=40, spur_passes=2)
Image.fromarray(ra).save(OUT / "rug.png")
