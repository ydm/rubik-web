#!/usr/bin/env python3
"""Print the app icon as SVG: an isometric solved cube showing the faces the
app opens on (white top, green front, red right) in its default colours.

    python3 scripts/cube-icon.py [--background HEX] [--padding PX] > icon.svg
"""
import argparse

COLOURS = {"U": "#f7f7f7", "F": "#00923f", "R": "#c8102e"}  # = COLORS in RubiksCube.tsx
BODY = "#111113"

parser = argparse.ArgumentParser()
parser.add_argument("--background", help="fill the square behind the cube")
parser.add_argument("--padding", type=float, default=0, help="space around the cube, in viewBox units")
args = parser.parse_args()

S = 64  # viewBox size
p = args.padding
# Hexagon of an isometric cube filling the box (height-limited).
cx, top, bottom = S / 2, 2 + p, S - 2 - p
h = bottom - top          # hexagon height
edge = h / 2              # a vertical edge
half_w = edge * 3 ** 0.5 / 2
T = (cx, top)
UL, UR = (cx - half_w, top + edge / 2), (cx + half_w, top + edge / 2)
C = (cx, top + edge)
LL, LR = (cx - half_w, top + 1.5 * edge), (cx + half_w, top + 1.5 * edge)
B = (cx, bottom)

def add(a, b, k=1.0):
    return (a[0] + k * b[0], a[1] + k * b[1])

def sub(a, b):
    return (a[0] - b[0], a[1] - b[1])

# Each face: origin corner and the two edge vectors spanning it.
faces = {
    "U": (UL, sub(T, UL), sub(C, UL)),
    "F": (UL, sub(C, UL), sub(LL, UL)),
    "R": (C, sub(UR, C), sub(B, C)),
}

GAP = 0.09  # fraction of a sticker's cell left as dark border
out = []
out.append(f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 {S} {S}">')
if args.background:
    out.append(f'  <rect width="{S}" height="{S}" fill="{args.background}"/>')
hexagon = " ".join(f"{x:.2f},{y:.2f}" for x, y in (T, UR, LR, B, LL, UL))
out.append(f'  <polygon points="{hexagon}" fill="{BODY}" stroke="{BODY}" stroke-width="1.5" stroke-linejoin="round"/>')
for face, (o, u, v) in faces.items():
    for i in range(3):
        for j in range(3):
            a0, a1 = (i + GAP) / 3, (i + 1 - GAP) / 3
            b0, b1 = (j + GAP) / 3, (j + 1 - GAP) / 3
            corners = [add(add(o, u, a), v, b) for a, b in ((a0, b0), (a1, b0), (a1, b1), (a0, b1))]
            pts = " ".join(f"{x:.2f},{y:.2f}" for x, y in corners)
            out.append(f'  <polygon points="{pts}" fill="{COLOURS[face]}" stroke="{COLOURS[face]}" stroke-width="0.6" stroke-linejoin="round"/>')
out.append("</svg>")
print("\n".join(out))
