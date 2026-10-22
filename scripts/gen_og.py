#!/usr/bin/env python3
"""Generate public/og.png — the 1200x630 social preview card.

Hand-rolled, dependency-free (stdlib + macOS `sips`), mirroring the icon
pipeline in Round 2 so the build stays reproducible with zero npm deps.

We paint the card with a small rect rasterizer, hand-draw a blocky
"TALHACADE" wordmark from a 5x7 font, lay down the tagline / daily / URL
text, and stamp a row of tinted game-tile squares. Anti-aliasing comes for
free from `sips` downscaling a 2x supersampled render.

Usage:  python3 scripts/gen_og.py   (writes public/og.png)
"""

from __future__ import annotations

import os
import struct
import subprocess
import sys
import tempfile
import zlib

# Card geometry (final, post-downscale). We render at 2x for AA then shrink.
W, H = 1200, 630
SS = 2  # supersample factor
RW, RH = W * SS, H * SS

BG = (7, 7, 14)  # #07070e
GLOW_A = (139, 92, 246)  # violet
GLOW_B = (6, 182, 212)  # cyan
ACCENT_A = (167, 139, 250)  # violet-400
ACCENT_B = (34, 211, 238)  # cyan-400
INK = (255, 255, 255)
PROOF = (230, 230, 240)
MUTED = (154, 154, 176)
KICKER = (139, 233, 253)  # #8be9fd

# 5x7 pixel font for the uppercase wordmark + digits we need. Each glyph is
# 7 rows of 5-bit masks (MSB = leftmost pixel).
FONT = {
    "A": ["01110", "10001", "10001", "11111", "10001", "10001", "10001"],
    "B": ["11110", "10001", "10001", "11110", "10001", "10001", "11110"],
    "C": ["01110", "10001", "10000", "10000", "10000", "10001", "01110"],
    "D": ["11110", "10001", "10001", "10001", "10001", "10001", "11110"],
    "E": ["11111", "10000", "10000", "11110", "10000", "10000", "11111"],
    "F": ["11111", "10000", "10000", "11110", "10000", "10000", "10000"],
    "G": ["01110", "10001", "10000", "10111", "10001", "10001", "01111"],
    "H": ["10001", "10001", "10001", "11111", "10001", "10001", "10001"],
    "I": ["01110", "00100", "00100", "00100", "00100", "00100", "01110"],
    "J": ["00111", "00010", "00010", "00010", "00010", "10010", "01100"],
    "K": ["10001", "10010", "10100", "11000", "10100", "10010", "10001"],
    "L": ["10000", "10000", "10000", "10000", "10000", "10000", "11111"],
    "M": ["10001", "11011", "10101", "10101", "10001", "10001", "10001"],
    "N": ["10001", "11001", "10101", "10011", "10001", "10001", "10001"],
    "O": ["01110", "10001", "10001", "10001", "10001", "10001", "01110"],
    "P": ["11110", "10001", "10001", "11110", "10000", "10000", "10000"],
    "Q": ["01110", "10001", "10001", "10001", "10101", "10010", "01101"],
    "R": ["11110", "10001", "10001", "11110", "10100", "10010", "10001"],
    "S": ["01111", "10000", "10000", "01110", "00001", "00001", "11110"],
    "T": ["11111", "00100", "00100", "00100", "00100", "00100", "00100"],
    "U": ["10001", "10001", "10001", "10001", "10001", "10001", "01110"],
    "V": ["10001", "10001", "10001", "10001", "10001", "01010", "00100"],
    "W": ["10001", "10001", "10001", "10101", "10101", "11011", "10001"],
    "X": ["10001", "10001", "01010", "00100", "01010", "10001", "10001"],
    "Y": ["10001", "10001", "01010", "00100", "00100", "00100", "00100"],
    "Z": ["11111", "00001", "00010", "00100", "01000", "10000", "11111"],
    "0": ["01110", "10001", "10011", "10101", "11001", "10001", "01110"],
    "1": ["00100", "01100", "00100", "00100", "00100", "00100", "01110"],
    "2": ["01110", "10001", "00001", "00010", "00100", "01000", "11111"],
    "3": ["11110", "00001", "00001", "01110", "00001", "00001", "11110"],
    "4": ["00010", "00110", "01010", "10010", "11111", "00010", "00010"],
    "5": ["11111", "10000", "11110", "00001", "00001", "10001", "01110"],
    "6": ["00110", "01000", "10000", "11110", "10001", "10001", "01110"],
    "7": ["11111", "00001", "00010", "00100", "01000", "01000", "01000"],
    "8": ["01110", "10001", "10001", "01110", "10001", "10001", "01110"],
    "9": ["01110", "10001", "10001", "01111", "00001", "00010", "01100"],
    " ": ["00000", "00000", "00000", "00000", "00000", "00000", "00000"],
    ".": ["00000", "00000", "00000", "00000", "00000", "01100", "01100"],
    "-": ["00000", "00000", "00000", "11111", "00000", "00000", "00000"],
    "/": ["00001", "00010", "00010", "00100", "01000", "01000", "10000"],
    ":": ["00000", "01100", "01100", "00000", "01100", "01100", "00000"],
}

# Blocky glyph built from half-block characters rendered as a tiny bitmap.
BLOCKS = {
    # Each row is a string of "XY" pairs where X/Y are box-drawing halves;
    # we simplify to solid/no-solid per half-cell via the map below.
}


class Canvas:
    """Simple RGB canvas with rect / text / roundrect painting."""

    def __init__(self, w: int, h: int, bg):
        self.w = w
        self.h = h
        self.px = bytearray()
        for _ in range(w * h):
            self.px += bytes(bg)

    def _put(self, x, y, color):
        if 0 <= x < self.w and 0 <= y < self.h:
            i = (y * self.w + x) * 3
            self.px[i] = color[0]
            self.px[i + 1] = color[1]
            self.px[i + 2] = color[2]

    def rect(self, x, y, w, h, color):
        x0, y0 = int(x), int(y)
        x1, y1 = int(x + w), int(y + h)
        for yy in range(max(0, y0), min(self.h, y1)):
            for xx in range(max(0, x0), min(self.w, x1)):
                self._put(xx, yy, color)

    def blend_rect(self, x, y, w, h, color, alpha):
        """Alpha-composited rectangle (used for the soft glows)."""
        x0, y0 = int(x), int(y)
        x1, y1 = int(x + w), int(y + h)
        ia = 1.0 - alpha
        for yy in range(max(0, y0), min(self.h, y1)):
            for xx in range(max(0, x0), min(self.w, x1)):
                i = (yy * self.w + xx) * 3
                self.px[i] = int(self.px[i] * ia + color[0] * alpha)
                self.px[i + 1] = int(self.px[i + 1] * ia + color[1] * alpha)
                self.px[i + 2] = int(self.px[i + 2] * ia + color[2] * alpha)

    def roundrect(self, x, y, w, h, r, fill, border=None):
        r = min(r, w // 2, h // 2)
        for yy in range(int(y), int(y + h)):
            for xx in range(int(x), int(x + w)):
                dx = 0.0
                dy = 0.0
                if xx < x + r:
                    dx = x + r - xx
                elif xx >= x + w - r:
                    dx = xx - (x + w - r - 1)
                if yy < y + r:
                    dy = y + r - yy
                elif yy >= y + h - r:
                    dy = yy - (y + h - r - 1)
                corner = (dx > 0 and dy > 0)
                if corner and (dx * dx + dy * dy) > r * r:
                    if border:
                        self._put(xx, yy, border)
                    continue
                self._put(xx, yy, fill)

    def glow(self, cx, cy, radius, color, peak):
        """Soft radial falloff — quadratic attenuation, alpha-blended."""
        r2 = radius * radius
        x0, x1 = max(0, int(cx - radius)), min(self.w, int(cx + radius))
        y0, y1 = max(0, int(cy - radius)), min(self.h, int(cy + radius))
        for yy in range(y0, y1):
            dy = yy - cy
            for xx in range(x0, x1):
                dx = xx - cx
                d2 = dx * dx + dy * dy
                if d2 >= r2:
                    continue
                # smooth radial falloff, dimming toward the edge
                a = peak * (1.0 - d2 / r2) ** 2
                i = (yy * self.w + xx) * 3
                ia = 1.0 - a
                self.px[i] = int(self.px[i] * ia + color[0] * a)
                self.px[i + 1] = int(self.px[i + 1] * ia + color[1] * a)
                self.px[i + 2] = int(self.px[i + 2] * ia + color[2] * a)

    def glyph(self, ch, x, y, scale, color):
        rows = FONT.get(ch)
        if not rows:
            return 5 * scale  # advance for unknown glyph
        for ry, row in enumerate(rows):
            for rx, bit in enumerate(row):
                if bit == "1":
                    self.rect(x + rx * scale, y + ry * scale, scale, scale, color)
        return 5 * scale

    def text(self, s, x, y, scale, color, spacing=1):
        cx = x
        for ch in s:
            cx += self.glyph(ch, cx, y, scale, color) + spacing * scale
        return cx - x

    def text_width(self, s, scale, spacing=1):
        return len(s) * (5 + spacing) * scale - spacing * scale

    def to_png_bytes(self):
        raw = bytearray()
        stride = self.w * 3
        for y in range(self.h):
            raw.append(0)  # filter type 0 (None)
            start = y * stride
            raw += self.px[start : start + stride]

        def chunk(tag, data):
            out = struct.pack(">I", len(data)) + tag + data
            out += struct.pack(">I", zlib.crc32(tag + data) & 0xFFFFFFFF)
            return out

        sig = b"\x89PNG\r\n\x1a\n"
        ihdr = struct.pack(">IIBBBBB", self.w, self.h, 8, 2, 0, 0, 0)
        idat = zlib.compress(bytes(raw), 9)
        return sig + chunk(b"IHDR", ihdr) + chunk(b"IDAT", idat) + chunk(b"IEND", b"")


def lerp(a, b, t):
    return tuple(int(a[i] + (b[i] - a[i]) * t) for i in range(3))


def render() -> Canvas:
    c = Canvas(RW, RH, BG)

    # Soft radial glows: violet top-right, cyan bottom-left.
    c.glow(int(RW * 0.84), int(RH * 0.02), int(620 * SS), GLOW_A, 0.34)
    c.glow(int(RW * 0.06), int(RH * 0.98), int(560 * SS), GLOW_B, 0.26)

    pad_l = 72 * SS
    pad_t = 64 * SS

    # Kicker: "FREE BROWSER ARCADE" — wide-tracked, cyan.
    kx = pad_l
    ky = pad_t
    ks = 2 * SS
    for ch in "FREE BROWSER ARCADE":
        kx += c.glyph(ch, kx, ky, ks, KICKER) + 4 * SS

    # Wordmark: TALHACADE, gradient violet -> cyan across the width.
    word = "TALHACADE"
    ws = 13 * SS  # glyph scale
    gap = 2 * SS
    total_w = len(word) * (5 * ws) + (len(word) - 1) * gap
    wy = ky + 46 * SS
    wx = pad_l
    for i, ch in enumerate(word):
        t = i / (len(word) - 1)
        col = lerp(ACCENT_A, ACCENT_B, t)
        c.glyph(ch, wx, wy, ws, col)
        wx += 5 * ws + gap

    # Proof line: "160 games · no signup · no downloads · works offline"
    proof = "160 GAMES . NO SIGNUP . NO DOWNLOADS . WORKS OFFLINE"
    ps = 2 * SS
    py = wy + ws * 7 + 26 * SS
    c.text(proof, pad_l, py, ps, PROOF)

    # Game tiles row — tinted rounded squares.
    ty = py + 7 * ps + 34 * SS
    tile = 78 * SS
    tgap = 16 * SS
    tints = [GLOW_A, GLOW_B]
    for i in range(8):
        tx = pad_l + i * (tile + tgap)
        base = lerp(BG, tints[i % 2], 0.16)
        c.roundrect(tx, ty, tile, tile, 20 * SS, base)
        # faint inner glyph mark so each tile reads as a "game"
        mark = lerp(tints[i % 2], INK, 0.55)
        m = tile // 4
        c.rect(tx + tile // 2 - m // 2, ty + tile // 2 - m // 2, m, m, mark)

    # Footer: daily line (left) + URL (right).
    fy = RH - 96 * SS
    fx = pad_l
    # small flame: orange body with a yellow core
    flame_w, flame_h = 10 * SS, 14 * SS
    for row in range(flame_h):
        # flame: rounded base, tapering to a point at the tip
        t = row / flame_h
        half = max(1, int((flame_w / 2) * (1 - t) ** 0.8))
        cx = fx + flame_w // 2
        col = (255, 150, 20) if row > flame_h * 0.35 else (255, 205, 60)
        c.rect(cx - half, fy + row, half * 2, 1, col)
    daily = "NEW DAILY CHALLENGE EVERY DAY . KEEP THE STREAK"
    c.text(daily, fx + flame_w + 8 * SS, fy + 2 * SS, 2 * SS, PROOF)

    url = "TALHAIMRANKKHAN.GITHUB.IO/TALHACADE"
    uw = c.text_width(url, 2 * SS)
    c.text(url, RW - 72 * SS - uw, fy, 2 * SS, MUTED)

    return c


def main() -> int:
    canvas = render()
    tmpdir = tempfile.mkdtemp(prefix="og-")
    raw2x = os.path.join(tmpdir, "og-2x.png")
    out = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), "public", "og.png")

    with open(raw2x, "wb") as fh:
        fh.write(canvas.to_png_bytes())

    # Downscale 2x supersample -> final size (this is where AA comes from).
    scaled = os.path.join(tmpdir, "og-scaled.png")
    subprocess.run(
        ["sips", "-z", str(H), str(W), raw2x, "--out", scaled],
        check=True,
        capture_output=True,
    )
    os.makedirs(os.path.dirname(out), exist_ok=True)
    subprocess.run(["cp", scaled, out], check=True)

    size = os.path.getsize(out)
    print(f"wrote {out} ({W}x{H}, {size} bytes)")
    return 0


if __name__ == "__main__":
    sys.exit(main())
