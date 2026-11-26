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
ba[2:7, 36:50, 3] = 0                                        # olive stub of a vine above the lamp arm
body = Image.fromarray(ba)
body.save(OUT / "desk-body.png")
# lamp OFF: an overlay for the lit inside of the shade (lamp ON is the art as painted); only the glowing pixels are recoloured
LX0, LY0, LX1, LY1 = 40, 22, 96, 50
reg = ba[LY0:LY1, LX0:LX1].copy()
r_, g_, b_ = (reg[..., i].astype(int) for i in range(3))
lit = (reg[..., 3] > 0) & (r_ > 235) & (g_ > 165) & (b_ < 215) & (g_ > b_ + 20)       # the yellow-orange glow and the white-hot bulb
white = (reg[..., 3] > 0) & (r_ > 240) & (g_ > 235) & (b_ > 215)
off = np.zeros_like(reg)
lum = (r_ * 0.3 + g_ * 0.59 + b_ * 0.11) / 255
for m, base in ((lit, (226, 168, 160)), (white, (236, 196, 190))):
    for c in range(3):
        off[..., c][m] = np.clip(np.array(base[c]) * (0.8 + 0.3 * lum[m]), 0, 255)
    off[..., 3][m] = 255
Image.fromarray(off).save(OUT / "lamp-off.png")
json.dump({"x": LX0, "y": LY0}, open(OUT / "lamp-off.json", "w"))
ba = tidy(np.array(Image.open(SRC / "bed-v4.png").convert("RGBA")), min_island=160, spur_passes=2)
for _ in range(2):                                           # peel the near-white background halo that sits on the outer rim of the bed (2026-11-26 review)
    op = ba[..., 3] > 0
    edge = op & ~(np.roll(op, 1, 0) & np.roll(op, -1, 0) & np.roll(op, 1, 1) & np.roll(op, -1, 1))
    rgb = ba[..., :3].astype(int)
    ba[edge & (rgb.sum(-1) / 765 > 0.84) & (rgb.max(-1) - rgb.min(-1) < 40), 3] = 0
Image.fromarray(ba).save(OUT / "bed.png")   # drop stray 1px specks on the duvet edge
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
    if n == "shelves-v1":                                    # only cream connected to the outside is background; cream enclosed in the lantern glass, picture frame or candle jar is real art
        from collections import deque
        H, W = cream.shape; bgm = cream | (wa[..., 3] == 0); seen = np.zeros_like(cream); dq = deque()
        for y in range(H):
            for x in range(W):
                if (y in (0, H - 1) or x in (0, W - 1)) and bgm[y, x]: seen[y, x] = True; dq.append((y, x))
        while dq:
            y, x = dq.popleft()
            for yy, xx in ((y + 1, x), (y - 1, x), (y, x + 1), (y, x - 1)):
                if 0 <= yy < H and 0 <= xx < W and bgm[yy, xx] and not seen[yy, xx]: seen[yy, xx] = True; dq.append((yy, xx))
        keep = np.zeros_like(cream)
        for x0, y0, x1, y1 in ((72, 6, 99, 37), (58, 46, 90, 76), (32, 60, 48, 76)): keep[y0:y1, x0:x1] = True
        cream &= seen | ~keep
    wa[cream, 3] = 0
    for _ in range(2):                                       # then peel the pale pixels that now touch the new gaps (soft cream rims on leaves)
        op = wa[..., 3] > 0
        edge = op & ~(np.roll(op, 1, 0) & np.roll(op, -1, 0) & np.roll(op, 1, 1) & np.roll(op, -1, 1))
        l_ = (wa[..., :3].astype(int).sum(-1)) / 765
        wa[edge & (l_ > 0.86) & (wa[..., 1] > wa[..., 2] + 18), 3] = 0   # pale yellow-cream rims only: keeps white lantern glow and glass highlights
    if n == "shelves-v1":                                    # glass dome + mushrooms: the glass was ragged and half-transparent, so the whole display is removed and the shelf top left clear
        wa[0:35, 101:142, 3] = 0
        wa[40:48, 122:142, 3] = 0                            # pale glass reflection under the shelf
    wa = tidy(wa, min_island=70, spur_passes=1)              # drops floating specks (before the repairs, which add thin 1px lines)
    if n == "shelves-v1":                                    # repairs found on review (2026-11-26): lantern ring, dome remnants, diffuser reeds, holes behind the frame
        wa[10:35, 98:105, 3] = 0                             # thin leftover edge of the removed glass dome
        copper, dark = wa[9, 84, :3].copy(), wa[12, 77, :3].copy()
        wa[0:8, 78:95, 3] = 0                                # the lantern ring was half eaten by the background cut: redraw it as a closed loop
        for y, xs in {1: range(83, 89), 2: (82, 83, 88, 89), 3: (81, 82, 89, 90), 4: (81, 82, 89, 90), 5: (81, 82, 89, 90), 6: (82, 83, 88, 89), 7: range(83, 89)}.items():
            for x in xs: wa[y, x] = (*copper, 255)
        wa[48:58, 44:62, 3] = 0                              # diffuser reeds: clear the pieces left over, then draw four reeds from the bottle neck
        reed = wa[56, 50, :3].copy() if wa[56, 50, 3] else np.array([196, 120, 72], np.uint8)
        for (x0, y0, x1, y1) in ((51, 57, 46, 49), (52, 57, 50, 48), (53, 57, 55, 48), (54, 57, 59, 49)):
            for i in range(11):
                x, y = round(x0 + (x1 - x0) * i / 10), round(y0 + (y1 - y0) * i / 10); wa[y, x] = (*reed, 255)
        lite = wa[56:68, 54:61, :3].astype(int).sum(-1) > 600; wa[56:68, 54:61, 3][lite] = 0   # pale wall leftover beside the bottle
        hole = wa[62:72, 79:90]; hole[hole[..., 3] == 0] = (*wa[68, 91, :3], 255)                 # crystal and the gap beside it
        lite = wa[22:34, 94:99, :3].astype(int).sum(-1) > 620; wa[22:34, 94:99, 3][lite] = 0       # pale glass bit beside the lantern foot
        from collections import deque                        # any fully enclosed see-through pocket in the lantern, frame, crystal or pot is a hole in the art: fill it from its neighbours
        H, W = wa.shape[:2]; out = np.zeros((H, W), bool); dq = deque((y, x) for y in range(H) for x in range(W) if (y in (0, H - 1) or x in (0, W - 1)) and wa[y, x, 3] == 0)
        for y, x in dq: out[y, x] = True
        while dq:
            y, x = dq.popleft()
            for yy, xx in ((y + 1, x), (y - 1, x), (y, x + 1), (y, x - 1)):
                if 0 <= yy < H and 0 <= xx < W and wa[yy, xx, 3] == 0 and not out[yy, xx]: out[yy, xx] = True; dq.append((yy, xx))
        for x0, y0, x1, y1 in ((72, 6, 99, 36), (66, 44, 110, 78)):
            for y in range(y0, y1):
                for x in range(x0, x1):
                    if wa[y, x, 3] == 0 and not out[y, x]:
                        wa[y, x] = next((wa[y, x - d] for d in range(1, 12) if wa[y, x - d, 3]), wa[y, x]) if any(wa[y, x - d, 3] for d in range(1, 12)) else wa[y, x]
        for _ in range(2):                                   # thin channels to the outside: pixels boxed in on all sides within 6px
            for y in range(48, 76):
                for x in range(62, 100):
                    if wa[y, x, 3]: continue
                    sides = [any(0 <= y + dy * d < H and 0 <= x + dx * d < W and wa[y + dy * d, x + dx * d, 3] for d in range(1, 7)) for dx, dy in ((1, 0), (-1, 0), (0, 1), (0, -1))]
                    if sum(sides) >= 4: wa[y, x] = next((wa[y + dy, x + dx] for dx, dy in ((-1, 0), (1, 0), (0, -1), (0, 1)) if wa[y + dy, x + dx, 3]), wa[y, x]); wa[y, x, 3] = 255
        for x0, y0, x1, y1 in ((63, 50, 90, 73), (93, 62, 107, 74)):   # everything inside the picture frame, crystal and pot is art: grow the neighbours into any remaining see-through pixels
            for _ in range(12):
                z = wa[y0:y1, x0:x1]
                for y in range(z.shape[0]):
                    for x in range(z.shape[1]):
                        if z[y, x, 3] < 200:             # fully clear, or the translucent wall-shadow pixels that landed inside the object
                            nb = [z[y + dy, x + dx] for dx, dy in ((-1, 0), (1, 0), (0, -1), (0, 1)) if 0 <= y + dy < z.shape[0] and 0 <= x + dx < z.shape[1] and z[y + dy, x + dx, 3] >= 200]
                            if len(nb) >= 2: z[y, x] = nb[0]
        sub = wa[56:77, 70:111]                              # holes between frame, crystal and pot: fill what is boxed in on all four sides
        for y in range(sub.shape[0]):
            for x in range(sub.shape[1]):
                if sub[y, x, 3]: continue
                l = next((sub[y, x - d] for d in range(1, 6) if x - d >= 0 and sub[y, x - d, 3]), None)
                r = any(x + d < sub.shape[1] and sub[y, x + d, 3] for d in range(1, 6))
                u = any(y - d >= 0 and sub[y - d, x, 3] for d in range(1, 6)); dn = any(y + d < sub.shape[0] and sub[y + d, x, 3] for d in range(1, 6))
                if l is not None and r and u and dn: sub[y, x] = l
    Image.fromarray(wa).save(OUT / o)
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
