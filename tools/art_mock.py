#!/usr/bin/env python3
"""Compose the current layers into a full-room mock (magenta window filled with a simple day sky)."""
import json, sys
from pathlib import Path
import numpy as np
from PIL import Image

ROOT = Path(__file__).resolve().parent.parent
LAYERS = ROOT / "art" / "layers"


def L(n):
    return Image.open(LAYERS / f"{n}.png").convert("RGBA")


def sky(img, top=(110, 170, 230), bottom=(250, 214, 200)):
    a = np.array(img)
    key = (a[..., 0] > 240) & (a[..., 1] < 20) & (a[..., 2] > 240)
    h = a.shape[0]
    for y in range(h):
        t = y / h
        a[y, key[y], :3] = [round(top[i] + (bottom[i] - top[i]) * t) for i in range(3)]
    return Image.fromarray(a)


def main(scene_file, out):
    scene = json.loads(Path(scene_file).read_text())
    c = sky(L(scene["room"]))
    kit = json.loads((LAYERS / "kitty-sheet.json").read_text())
    cw, ch = kit["cell"]
    sheet = L("kitty-sheet")
    for item in scene["items"]:
        if "kitty" in item:
            row, i = item["kitty"]
            r = kit["rows"][row]["row"]
            im = sheet.crop((i * cw, r * ch, (i + 1) * cw, (r + 1) * ch))
        else:
            im = L(item["layer"])
        if item.get("flip"):
            im = im.transpose(Image.FLIP_LEFT_RIGHT)
        c.alpha_composite(im, tuple(item["at"]))
    c.resize((c.width * 4, c.height * 4), Image.NEAREST).save(out)


if __name__ == "__main__":
    main(*sys.argv[1:3])
