#!/usr/bin/env python3
"""Copy the approved layers into public/art for the game, turning the magenta window into real transparency
and writing art/scene manifest data the game reads (window rectangle)."""
import json
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
near = (shell[..., 0] > 200) & (shell[..., 1] < 90) & (shell[..., 2] > 150)
for _ in range(2):
    grow = key.copy(); grow[1:] |= key[:-1]; grow[:-1] |= key[1:]; grow[:, 1:] |= key[:, :-1]; grow[:, :-1] |= key[:, 1:]
    key = key | (grow & near)
shell[key, 3] = 0
Image.fromarray(shell).save(OUT / "room-shell.png")
json.dump({"size": [480, 270], "window": window}, open(OUT / "scene.json", "w"))
print("window", window)

import shutil
for n in ("scenery-day-v1",):
    shutil.copy(SRC / f"{n}.png", OUT / (n.replace("-v1", "") + ".png"))
