import os
import sys

sys.path.insert(0, os.path.dirname(__file__))
from make_icons import make_buf, fill_rect, fill_circle, fill_poly, fill_round_rect, hexrgb, lerp, write_png

OUT = os.path.join(os.path.dirname(__file__), '..', 'store')


def vgrad(buf, w, h, c1, c2):
    for y in range(h):
        c = lerp(c1, c2, y / max(1, h - 1))
        fill_rect(buf, w, h, 0, y, w, y + 1, c)


def draw_road(buf, w, h, cx, y0, y1, hw0, hw1, road, edge):
    fill_poly(buf, w, h, [(cx - hw0, y0), (cx + hw0, y0), (cx + hw1, y1), (cx - hw1, y1)], hexrgb(road))
    ew = max(4, int(hw1 * 0.035))
    fill_poly(buf, w, h, [(cx - hw0 - ew, y0), (cx - hw0, y0), (cx - hw1, y1), (cx - hw1 - ew, y1)], hexrgb(edge))
    fill_poly(buf, w, h, [(cx + hw0, y0), (cx + hw0 + ew, y0), (cx + hw1 + ew, y1), (cx + hw1, y1)], hexrgb(edge))
    for y in range(int(y0 + 20), int(y1), 90):
        t = (y - y0) / (y1 - y0)
        hw = hw0 + (hw1 - hw0) * t
        dw = max(6, int(14 * (0.5 + t)))
        fill_rect(buf, w, h, int(cx - dw / 2), y, int(cx + dw / 2), y + 44, hexrgb('#f7d154'))


def draw_car(buf, w, h, cx, base_y, bw, color):
    ch = int(bw * 1.15)
    fill_circle(buf, w, h, cx - int(bw * 0.4), base_y, int(bw * 0.17), hexrgb('#14161f'))
    fill_circle(buf, w, h, cx + int(bw * 0.4), base_y, int(bw * 0.17), hexrgb('#14161f'))
    fill_round_rect(buf, w, h, int(cx - bw / 2), base_y - ch, int(bw), ch, int(bw * 0.2), hexrgb(color))
    fill_round_rect(buf, w, h, int(cx - bw * 0.34), base_y - ch - int(bw * 0.5), int(bw * 0.68), int(bw * 0.55), int(bw * 0.15), hexrgb(color))
    fill_round_rect(buf, w, h, int(cx - bw * 0.27), base_y - ch - int(bw * 0.44), int(bw * 0.54), int(bw * 0.32), 6, hexrgb('#bfe6ff'))
    fill_circle(buf, w, h, cx - int(bw * 0.3), base_y - ch + 6, 6, hexrgb('#fff8dc'))
    fill_circle(buf, w, h, cx + int(bw * 0.3), base_y - ch + 6, 6, hexrgb('#fff8dc'))


def feature_graphic():
    w, h = 1024, 500
    buf = make_buf(w, h)
    vgrad(buf, w, h, hexrgb('#1b2a5e'), hexrgb('#0a0f24'))
    for i in range(70):
        x = (i * 137) % w
        y = (i * 89) % int(h * 0.55)
        fill_circle(buf, w, h, x, y, 1 + (i % 3) * 0.7, hexrgb('#e8ecff'))
    cx = w // 2
    draw_road(buf, w, h, cx, 90, h + 40, 60, 300, '#3d4250', '#f2f2f2')
    ty = 330
    t = (ty - 90) / (h + 40 - 90)
    hw = 60 + (300 - 60) * t
    for i in range(3):
        seg = (hw - 20) / 3
        fill_rect(buf, w, h, int(cx - hw + 12 + i * seg), ty - 16, int(cx - hw + 12 + (i + 0.7) * seg), ty + 16, hexrgb('#ffd54a'))
    draw_car(buf, w, h, int(cx + 150), h - 30, 130, '#e0393e')
    fill_round_rect(buf, w, h, 40, 40, 230, 120, 26, hexrgb('#ffd54a'))
    bx, by = 66, 62
    fill_poly(buf, w, h, [(bx, by + 76), (bx + 30, by), (bx + 52, by), (bx + 82, by + 76)], hexrgb('#0d1226'))
    fill_rect(buf, w, h, bx + 37, by + 10, bx + 45, by + 28, hexrgb('#ffffff'))
    fill_rect(buf, w, h, bx + 35, by + 40, bx + 47, by + 58, hexrgb('#ffffff'))
    return buf, w, h


def screenshot_menu():
    w, h = 1080, 1920
    buf = make_buf(w, h)
    vgrad(buf, w, h, hexrgb('#1b2450'), hexrgb('#0d1226'))
    cx = w // 2
    fill_round_rect(buf, w, h, cx - 260, 260, 520, 300, 40, hexrgb('#ffd54a'))
    fill_round_rect(buf, w, h, cx - 200, 320, 400, 60, 20, hexrgb('#0d1226'))
    fill_round_rect(buf, w, h, cx - 200, 400, 400, 60, 20, hexrgb('#0d1226'))
    for i, bw in enumerate([520, 520, 520, 380, 380, 380, 380, 380]):
        y = 720 + i * 130
        c = '#ffb020' if i == 0 else '#232c4d'
        fill_round_rect(buf, w, h, cx - bw // 2, y, bw, 92, 24, hexrgb(c))
        fill_round_rect(buf, w, h, cx - 150, y + 34, 300, 24, 12, hexrgb('#0d1226') if i == 0 else hexrgb('#dfe6ff'))
    fill_circle(buf, w, h, cx, h - 160, 34, hexrgb('#ffd54a'))
    return buf, w, h


def screenshot_gameplay():
    w, h = 1080, 1920
    buf = make_buf(w, h)
    vgrad(buf, w, h, hexrgb('#6fb9f2'), hexrgb('#d8efff'))
    road_w = 640
    road_x = (w - road_w) // 2
    fill_rect(buf, w, h, 0, 0, w, h, hexrgb('#3f9e4d'))
    fill_rect(buf, w, h, road_x, 0, road_w, h, hexrgb('#3d4250'))
    fill_rect(buf, w, h, road_x, 0, 10, h, hexrgb('#e8e8e8'))
    fill_rect(buf, w, h, road_x + road_w - 10, 0, 10, h, hexrgb('#e8e8e8'))
    for y in range(0, h, 128):
        fill_rect(buf, w, h, w // 2 - 8, y, w // 2 + 8, y + 64, hexrgb('#f7d154'))
    for y in [300, 700, 1100, 1500]:
        for x in range(road_x + 30, road_x + road_w - 30, 90):
            fill_rect(buf, w, h, x, y, x + 56, y + 16, hexrgb('#ffffff'))
    fill_round_rect(buf, w, h, 30, 40, 300, 70, 16, hexrgb('#10173a'))
    fill_round_rect(buf, w, h, 50, 62, 180, 26, 13, hexrgb('#ffffff'))
    draw_car(buf, w, h, int(road_x + road_w * 0.72), h - 160, 150, '#e0393e')
    fill_round_rect(buf, w, h, cx0(w) - 200, h - 420, 400, 80, 40, hexrgb('#ffd54a'))
    return buf, w, h


def cx0(w):
    return w // 2


def main():
    os.makedirs(OUT, exist_ok=True)
    for name, fn in [('feature-graphic-1024x500.png', feature_graphic), ('screenshot-menu-1080x1920.png', screenshot_menu), ('screenshot-gameplay-1080x1920.png', screenshot_gameplay)]:
        buf, w, h = fn()
        write_png(os.path.join(OUT, name), w, h, buf)
        print('wrote', name, f'{w}x{h}')


if __name__ == '__main__':
    main()
