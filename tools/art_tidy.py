"""Tidy cutout edges: drop floor-shadow specks, cream fringe on leaves, tiny islands and 1px spurs."""
import numpy as np, colorsys
from collections import deque

def hls(a):
    r, g, b = [a[..., i] / 255 for i in range(3)]
    mx, mn = np.maximum(np.maximum(r, g), b), np.minimum(np.minimum(r, g), b)
    l = (mx + mn) / 2
    s = np.where(mx == mn, 0, (mx - mn) / (1 - np.abs(2 * l - 1) + 1e-6))
    return l, s

def tidy(a, min_island=12, spur_passes=2, fringe=None):
    a = a.copy()
    for _ in range(spur_passes):                       # 1px spurs: opaque with <=1 opaque 4-neighbour
        op = a[..., 3] > 0
        n = sum(np.roll(op, s, ax) for s, ax in ((1, 0), (-1, 0), (1, 1), (-1, 1)))
        a[op & (n <= 1), 3] = 0
    op = a[..., 3] > 0
    seen = np.zeros_like(op)
    H, W = op.shape
    for y0 in range(H):
        for x0 in range(W):
            if op[y0, x0] and not seen[y0, x0]:
                comp, q = [], deque([(y0, x0)]); seen[y0, x0] = True
                while q:
                    y, x = q.popleft(); comp.append((y, x))
                    for dy in (-1, 0, 1):
                        for dx in (-1, 0, 1):
                            yy, xx = y + dy, x + dx
                            if 0 <= yy < H and 0 <= xx < W and op[yy, xx] and not seen[yy, xx]:
                                seen[yy, xx] = True; q.append((yy, xx))
                if len(comp) < min_island:
                    for y, x in comp: a[y, x, 3] = 0
    if fringe is not None:                              # fringe(a) -> mask of pixels eligible for peeling
        for _ in range(2):
            op = a[..., 3] > 0
            edge = op & ~(np.roll(op, 1, 0) & np.roll(op, -1, 0) & np.roll(op, 1, 1) & np.roll(op, -1, 1))
            a[edge & fringe(a), 3] = 0
    return a
