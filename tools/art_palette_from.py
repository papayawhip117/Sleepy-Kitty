#!/usr/bin/env python3
"""Build the house palette from an approved image (k-means in OKLab, magenta key ignored).

  python3 tools/art_palette_from.py art/raw/room-base-v1.png --colours 48
writes art/palette/window-kitty.json (old one kept as window-kitty.prev.json), sorted into
light-to-dark ramps by hue so it stays readable, plus .gpl/.hex/ramps.png.
"""
import argparse, json, colorsys
from pathlib import Path
import numpy as np
from PIL import Image
import sys
sys.path.insert(0, str(Path(__file__).resolve().parent))
from art_clean import to_oklab, PALETTE

M2_INV = None


def from_oklab(lab):
    m2 = np.array([[0.2104542553, 0.7936177850, -0.0040720468],
                   [1.9779984951, -2.4285922050, 0.4505937099],
                   [0.0259040371, 0.7827717662, -0.8086757660]])
    m1 = np.array([[0.4122214708, 0.5363325363, 0.0514459929],
                   [0.2119034982, 0.6806995451, 0.1073969566],
                   [0.0883024619, 0.2817188376, 0.6299787005]])
    lms = (lab @ np.linalg.inv(m2).T) ** 3
    c = lms @ np.linalg.inv(m1).T
    c = np.clip(c, 0, 1)
    c = np.where(c <= 0.0031308, c * 12.92, 1.055 * c ** (1 / 2.4) - 0.055)
    return np.round(c * 255).astype(int)


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("src")
    ap.add_argument("--colours", type=int, default=48)
    a = ap.parse_args()
    rgb = np.array(Image.open(a.src).convert("RGB")).reshape(-1, 3)
    rgb = rgb[np.abs(rgb.astype(int) - [255, 0, 255]).sum(-1) >= 120]
    rng = np.random.default_rng(1)
    sample = rgb[rng.choice(len(rgb), min(len(rgb), 60000), replace=False)]
    lab = to_oklab(sample)
    cent = lab[rng.choice(len(lab), a.colours, replace=False)]
    for _ in range(40):
        lbl = ((lab[:, None] - cent[None]) ** 2).sum(-1).argmin(1)
        cent = np.array([lab[lbl == k].mean(0) if (lbl == k).any() else cent[k] for k in range(a.colours)])
    cols = from_oklab(cent)
    # group by hue family (12 buckets, plus greys), each ramp dark -> light
    fam = {}
    for c in cols:
        h, l, s = colorsys.rgb_to_hls(*(c / 255))
        key = "grey" if s < 0.12 else f"h{int(h * 12) % 12:02d}"
        fam.setdefault(key, []).append(c)
    ramps = {k: ['#%02X%02X%02X' % tuple(c) for c in sorted(v, key=lambda c: colorsys.rgb_to_hls(*(c / 255))[1])]
             for k, v in sorted(fam.items())}
    if PALETTE.exists():
        PALETTE.with_name("window-kitty.prev.json").write_text(PALETTE.read_text())
    PALETTE.write_text(json.dumps({"name": "Window Kitty",
                                   "note": f"Extracted from {Path(a.src).name}. Every piece is snapped to these colours.",
                                   "key": "#FF00FF", "ramps": ramps}, indent=2) + "\n")
    print(sum(len(v) for v in ramps.values()), "colours in", len(ramps), "ramps")


if __name__ == "__main__":
    main()
