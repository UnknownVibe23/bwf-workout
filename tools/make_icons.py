#!/usr/bin/env python3
"""Generate PWA icons (plain PNG writer, no external deps).

Draws a rounded-square accent tile with a simple dumbbell glyph, at 4x
supersampling then downscaled for smooth edges.
"""
import struct
import zlib
import os

ACCENT = (74, 222, 128)      # #4ade80
DARK = (5, 46, 18)           # #052e12
SS = 4  # supersampling factor


def make_canvas(size):
    return [[(0, 0, 0, 0) for _ in range(size)] for _ in range(size)]


def blend(px, color, a):
    if a <= 0:
        return px
    if a >= 255:
        return (color[0], color[1], color[2], 255)
    dr, dg, db, da = px
    f = a / 255.0
    return (
        int(color[0] * f + dr * (1 - f)),
        int(color[1] * f + dg * (1 - f)),
        int(color[2] * f + db * (1 - f)),
        255,
    )


def fill_rounded_rect(img, x0, y0, x1, y1, r, color):
    h = len(img)
    w = len(img[0])
    for y in range(max(0, y0), min(h, y1)):
        for x in range(max(0, x0), min(w, x1)):
            # signed distance to rounded rect
            cx = min(max(x + 0.5, x0 + r), x1 - r)
            cy = min(max(y + 0.5, y0 + r), y1 - r)
            dx = x + 0.5 - cx
            dy = y + 0.5 - cy
            d = (dx * dx + dy * dy) ** 0.5 - r
            a = max(0, min(255, int(255 * (0.5 - d))))
            img[y][x] = blend(img[y][x], color, a)


def fill_rect(img, x0, y0, x1, y1, color):
    h = len(img)
    w = len(img[0])
    for y in range(max(0, y0), min(h, y1)):
        for x in range(max(0, x0), min(w, x1)):
            img[y][x] = (color[0], color[1], color[2], 255)


def draw_dumbbell(img, size, pad_frac):
    # geometry in unit space, scaled to canvas
    s = size
    pad = s * pad_frac
    cx = s / 2
    cy = s / 2
    bar_h = s * 0.09
    bar_y0, bar_y1 = int(cy - bar_h / 2), int(cy + bar_h / 2)
    bar_x0 = int(pad + s * 0.18)
    bar_x1 = int(s - pad - s * 0.18)
    fill_rect(img, bar_x0, bar_y0, bar_x1, bar_y1, DARK)
    plate_w = s * 0.09
    plate_h = s * 0.34
    for side in (0, 1):
        px0 = int(pad + s * 0.06 + side * (s - pad * 2 - s * 0.06 - plate_w))
        px1 = px0 + int(plate_w)
        py0 = int(cy - plate_h / 2)
        py1 = int(cy + plate_h / 2)
        fill_rect(img, px0, py0, px1, py1, DARK)
        # smaller outer plate
        ow = s * 0.06
        oh = s * 0.46
        ox0 = int(pad + (side * (s - pad * 2 - ow)))
        ox1 = ox0 + int(ow)
        oy0 = int(cy - oh / 2)
        oy1 = int(cy + oh / 2)
        fill_rect(img, ox0, oy0, ox1, oy1, DARK)


def downscale(img, ss):
    h = len(img) // ss
    w = len(img[0]) // ss
    out = make_canvas(h)
    for y in range(h):
        for x in range(w):
            r = g = b = a = 0
            for dy in range(ss):
                for dx in range(ss):
                    pr, pg, pb, pa = img[y * ss + dy][x * ss + dx]
                    r += pr
                    g += pg
                    b += pb
                    a += pa
            n = ss * ss
            out[y][x] = (r // n, g // n, b // n, a // n)
    return out


def write_png(path, img):
    h = len(img)
    w = len(img[0])
    raw = b''
    for row in img:
        raw += b'\x00' + b''.join(struct.pack('4B', *px) for px in row)

    def chunk(tag, data):
        c = struct.pack('>I', len(data)) + tag + data
        return c + struct.pack('>I', zlib.crc32(tag + data) & 0xFFFFFFFF)

    png = b'\x89PNG\r\n\x1a\n'
    png += chunk(b'IHDR', struct.pack('>IIBBBBB', w, h, 8, 6, 0, 0, 0))
    png += chunk(b'IDAT', zlib.compress(raw, 9))
    png += chunk(b'IEND', b'')
    with open(path, 'wb') as f:
        f.write(png)


def make_icon(path, size, maskable=False):
    big = size * SS
    img = make_canvas(big)
    r = big * (0.22 if not maskable else 0.0)
    fill_rounded_rect(img, 0, 0, big, big, int(r), ACCENT)
    draw_dumbbell(img, big, 0.30 if maskable else 0.16)
    small = downscale(img, SS)
    write_png(path, small)
    print('wrote', path, f'{size}x{size}')


if __name__ == '__main__':
    here = os.path.dirname(os.path.abspath(__file__))
    icons = os.path.join(here, '..', 'icons')
    os.makedirs(icons, exist_ok=True)
    make_icon(os.path.join(icons, 'icon-192.png'), 192)
    make_icon(os.path.join(icons, 'icon-512.png'), 512)
    make_icon(os.path.join(icons, 'icon-maskable-512.png'), 512, maskable=True)
