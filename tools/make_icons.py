import os
import struct
import zlib

SIZE = 512
OUT = os.path.join(os.path.dirname(__file__), '..', 'icons')


def make_buf(w, h):
    return bytearray(w * h * 4)


def set_px(buf, w, h, x, y, r, g, b, a=255):
    x = int(x)
    y = int(y)
    if 0 <= x < w and 0 <= y < h:
        i = (y * w + x) * 4
        sa = a / 255.0
        da = buf[i + 3] / 255.0
        oa = sa + da * (1 - sa)
        if oa <= 0:
            return
        buf[i] = int((r * sa + buf[i] * da * (1 - sa)) / oa)
        buf[i + 1] = int((g * sa + buf[i + 1] * da * (1 - sa)) / oa)
        buf[i + 2] = int((b * sa + buf[i + 2] * da * (1 - sa)) / oa)
        buf[i + 3] = int(oa * 255)


def fill_rect(buf, w, h, x0, y0, x1, y1, color):
    r, g, b, a = color
    for y in range(int(max(0, y0)), int(min(h, y1))):
        for x in range(int(max(0, x0)), int(min(w, x1))):
            set_px(buf, w, h, x, y, r, g, b, a)


def fill_circle(buf, w, h, cx, cy, rad, color):
    r, g, b, a = color
    for y in range(int(cy - rad - 1), int(cy + rad + 2)):
        for x in range(int(cx - rad - 1), int(cx + rad + 2)):
            if (x - cx) ** 2 + (y - cy) ** 2 <= rad * rad:
                set_px(buf, w, h, x, y, r, g, b, a)


def fill_poly(buf, w, h, pts, color):
    r, g, b, a = color
    ys = [p[1] for p in pts]
    y_min = int(max(0, min(ys)))
    y_max = int(min(h, max(ys)))
    for y in range(y_min, y_max + 1):
        xs = []
        n = len(pts)
        for i in range(n):
            x0, y0 = pts[i]
            x1, y1 = pts[(i + 1) % n]
            if (y0 <= y < y1) or (y1 <= y < y0):
                xs.append(x0 + (y - y0) * (x1 - x0) / (y1 - y0))
        xs.sort()
        for i in range(0, len(xs) - 1, 2):
            for x in range(int(max(0, xs[i])), int(min(w, xs[i + 1])) + 1):
                set_px(buf, w, h, x, y, r, g, b, a)


def fill_round_rect(buf, w, h, x, y, rw, rh, rad, color):
    fill_rect(buf, w, h, x + rad, y, x + rw - rad, y + rh, color)
    fill_rect(buf, w, h, x, y + rad, x + rw, y + rh - rad, color)
    fill_circle(buf, w, h, x + rad, y + rad, rad, color)
    fill_circle(buf, w, h, x + rw - rad, y + rad, rad, color)
    fill_circle(buf, w, h, x + rad, y + rh - rad, rad, color)
    fill_circle(buf, w, h, x + rw - rad, y + rh - rad, rad, color)


def hexrgb(hexstr):
    n = int(hexstr.lstrip('#'), 16)
    return ((n >> 16) & 255, (n >> 8) & 255, n & 255, 255)


def lerp(c1, c2, t):
    return tuple(int(c1[i] + (c2[i] - c1[i]) * t) for i in range(4))


def draw_scene(maskable):
    w = h = SIZE
    buf = make_buf(w, h)
    s = 0.74 if maskable else 1.0
    top = hexrgb('#1b2a5e')
    bottom = hexrgb('#0a0f24')
    for y in range(h):
        c = lerp(top, bottom, y / h)
        fill_rect(buf, w, h, 0, y, w, y + 1, c)
    if not maskable:
        rad = 96
        for y in range(rad):
            for x in range(rad):
                if (x - rad) ** 2 + (y - rad) ** 2 > rad * rad:
                    set_px(buf, w, h, x, y, 0, 0, 0, 0)
                if (w - 1 - x - rad) ** 2 + (y - rad) ** 2 > rad * rad:
                    set_px(buf, w, h, w - 1 - x, y, 0, 0, 0, 0)
        for y in range(h - rad, h):
            for x in range(rad):
                if (x - rad) ** 2 + (y - (h - rad)) ** 2 > rad * rad:
                    set_px(buf, w, h, x, y, 0, 0, 0, 0)
                if (w - 1 - x - rad) ** 2 + (y - (h - rad)) ** 2 > rad * rad:
                    set_px(buf, w, h, w - 1 - x, y, 0, 0, 0, 0)
    cx = w / 2
    y0 = h * 0.17
    y1 = h * 1.04
    hw0 = 46 * s
    hw1 = 205 * s
    fill_poly(buf, w, h, [(cx - hw0, y0), (cx + hw0, y0), (cx + hw1, y1), (cx - hw1, y1)], hexrgb('#3d4250'))
    ew = 7 * s
    fill_poly(buf, w, h, [(cx - hw0 - ew, y0), (cx - hw0, y0), (cx - hw1, y1), (cx - hw1 - ew, y1)], hexrgb('#f2f2f2'))
    fill_poly(buf, w, h, [(cx + hw0, y0), (cx + hw0 + ew, y0), (cx + hw1 + ew, y1), (cx + hw1, y1)], hexrgb('#f2f2f2'))
    for y in range(int(y0 + 14), int(y1), int(58 * s)):
        t = (y - y0) / (y1 - y0)
        hw = hw0 + (hw1 - hw0) * t
        dw = 13 * s * (0.6 + 0.4 * t)
        fill_rect(buf, w, h, cx - dw / 2, y, cx + dw / 2, y + 32 * s, hexrgb('#ffffff'))
    ty = h * (0.66 if maskable else 0.62)
    t = (ty - y0) / (y1 - y0)
    hw = hw0 + (hw1 - hw0) * t
    gold = hexrgb('#ffd54a')
    seg = (hw - 10) / 3
    for i in range(3):
        fill_rect(buf, w, h, cx - hw + 8 + i * seg, ty - 11 * s, cx - hw + 8 + (i + 0.72) * seg, ty + 11 * s, gold)
    car_y = h * (0.88 if maskable else 0.9)
    cw = 118 * s
    ch = 64 * s
    fill_circle(buf, w, h, cx - 44 * s, car_y, 15 * s, hexrgb('#14161f'))
    fill_circle(buf, w, h, cx + 44 * s, car_y, 15 * s, hexrgb('#14161f'))
    fill_circle(buf, w, h, cx - 44 * s, car_y, 6 * s, hexrgb('#8a93a6'))
    fill_circle(buf, w, h, cx + 44 * s, car_y, 6 * s, hexrgb('#8a93a6'))
    fill_round_rect(buf, w, h, cx - cw / 2, car_y - ch - 26 * s, cw, ch + 26 * s, 14 * s, hexrgb('#e0393e'))
    fill_round_rect(buf, w, h, cx - cw * 0.36, car_y - ch - 52 * s, cw * 0.72, 34 * s, 10 * s, hexrgb('#b02a30'))
    fill_round_rect(buf, w, h, cx - cw * 0.28, car_y - ch - 46 * s, cw * 0.56, 20 * s, 6 * s, hexrgb('#bfe6ff'))
    fill_circle(buf, w, h, cx - cw * 0.3, car_y - ch - 20 * s, 6 * s, hexrgb('#ffe9a8'))
    fill_circle(buf, w, h, cx + cw * 0.3, car_y - ch - 20 * s, 6 * s, hexrgb('#ffe9a8'))
    return buf, w, h


def downscale(buf, w, h, t):
    out = bytearray(t * t * 4)
    for y in range(t):
        for x in range(t):
            rs = gs = bs = as_ = 0
            n = 0
            for dy in (0.25, 0.75):
                for dx in (0.25, 0.75):
                    sx = min(w - 1, int((x + dx) * w / t))
                    sy = min(h - 1, int((y + dy) * h / t))
                    i = (sy * w + sx) * 4
                    rs += buf[i]
                    gs += buf[i + 1]
                    bs += buf[i + 2]
                    as_ += buf[i + 3]
                    n += 1
            o = (y * t + x) * 4
            out[o] = rs // n
            out[o + 1] = gs // n
            out[o + 2] = bs // n
            out[o + 3] = as_ // n
    return out


def write_png(path, w, h, rgba):
    def chunk(typ, data):
        return (
            struct.pack('>I', len(data))
            + typ
            + data
            + struct.pack('>I', zlib.crc32(typ + data) & 0xFFFFFFFF)
        )

    raw = b''.join(b'\x00' + bytes(rgba[y * w * 4:(y + 1) * w * 4]) for y in range(h))
    png = (
        b'\x89PNG\r\n\x1a\n'
        + chunk(b'IHDR', struct.pack('>IIBBBBB', w, h, 8, 6, 0, 0, 0))
        + chunk(b'IDAT', zlib.compress(raw, 9))
        + chunk(b'IEND', b'')
    )
    with open(path, 'wb') as f:
        f.write(png)


def main():
    os.makedirs(OUT, exist_ok=True)
    buf, w, h = draw_scene(maskable=False)
    write_png(os.path.join(OUT, 'icon-512.png'), w, h, buf)
    write_png(os.path.join(OUT, 'icon-192.png'), 192, 192, downscale(buf, w, h, 192))
    write_png(os.path.join(OUT, 'apple-touch-icon.png'), 180, 180, downscale(buf, w, h, 180))
    write_png(os.path.join(OUT, 'favicon-32.png'), 32, 32, downscale(buf, w, h, 32))
    bufm, wm, hm = draw_scene(maskable=True)
    write_png(os.path.join(OUT, 'icon-maskable-512.png'), wm, hm, bufm)
    print('icons written to', os.path.abspath(OUT))


if __name__ == '__main__':
    main()
