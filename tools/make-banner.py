"""Rebuild README animation: python -I tools/make-banner.py assets/tetris.gif"""
import math
import sys
from pathlib import Path
from PIL import Image, ImageDraw, ImageFont

WIDTH, HEIGHT = 1200, 400
BG, PANEL, LINE = '#090b16', '#111525', '#2c324b'
TEXT, MUTED, MINT, PURPLE = '#eef2ff', '#a7b0ca', '#80fbd4', '#b69cff'


def font(size, bold=False):
    names = ['C:/Windows/Fonts/consolab.ttf' if bold else 'C:/Windows/Fonts/consola.ttf',
             '/usr/share/fonts/truetype/dejavu/DejaVuSansMono.ttf']
    for name in names:
        if Path(name).exists():
            return ImageFont.truetype(name, size)
    return ImageFont.load_default(size=size)


def block(draw, x, y, color, size=22, ghost=False):
    if ghost:
        draw.rectangle((x, y, x + size - 2, y + size - 2), outline=color, width=1)
    else:
        draw.rectangle((x, y, x + size - 2, y + size - 2), fill=color)
        draw.line((x, y + size - 2, x, y, x + size - 2, y), fill='#ffffff', width=1)


def render(tick):
    image = Image.new('RGB', (WIDTH, HEIGHT), BG)
    draw = ImageDraw.Draw(image)
    for x in range(0, WIDTH, 40):
        draw.line((x, 0, x, HEIGHT), fill='#101424')
    for y in range(0, HEIGHT, 40):
        draw.line((0, y, WIDTH, y), fill='#101424')
    draw.rounded_rectangle((24, 24, WIDTH - 24, HEIGHT - 24), radius=16, fill=PANEL, outline=LINE)
    draw.text((58, 50), 'RAPURBAE / DEVELOPER ARCADE', font=font(17, True), fill=MINT)
    draw.text((56, 104), 'Building things.', font=font(48, True), fill=TEXT)
    draw.text((56, 164), 'Clearing lines.', font=font(48, True), fill=MINT)
    draw.text((59, 244), 'ASRAF FAHRUDDIN', font=font(24, True), fill=TEXT)
    draw.text((59, 280), 'Fullstack Developer / Yogyakarta', font=font(18), fill=MUTED)
    draw.text((59, 331), 'JAVASCRIPT  /  PHP  /  MYSQL  /  DESIGN', font=font(14), fill=MUTED)
    ox, oy, step = 876, 55, 22
    draw.rounded_rectangle((ox - 18, oy - 20, ox + 10 * step + 16, oy + 13 * step + 25), radius=8, fill=BG, outline=LINE)
    for y in range(14):
        for x in range(10):
            draw.rectangle((ox + x * step, oy + y * step, ox + x * step + 19, oy + y * step + 19), fill='#12192a')
    base = [(0, 13), (1, 13), (2, 13), (6, 13), (7, 13), (8, 13), (9, 13),
            (0, 12), (1, 12), (7, 12), (8, 12), (9, 12), (0, 11), (8, 11), (9, 11)]
    palette = [PURPLE, '#ffc17e', '#7ab7ff']
    for x, y in base:
        block(draw, ox + x * step, oy + y * step, palette[x % 3])
    shape = [(1, 0), (0, 1), (1, 1), (2, 1)]
    if tick < 48:
        row = min(12, int(tick / 4))
        for x, y in shape:
            block(draw, ox + (x + 3) * step, oy + (y + 12) * step, MINT, ghost=True)
            block(draw, ox + (x + 3) * step, oy + (y + row) * step, MINT)
    elif tick < 56:
        for x, y in shape:
            block(draw, ox + (x + 3) * step, oy + (y + 12) * step, MINT)
    else:
        draw.rectangle((ox, oy + 13 * step, ox + 10 * step - 2, oy + 14 * step - 2), fill=MINT if tick % 4 < 2 else PANEL)
    draw.text((ox - 2, 365), 'PRESS PLAY / NO COINS', font=font(13), fill=MINT)
    # Static copy remains readable throughout animation; only blocks move.
    return image.quantize(colors=64)


output = Path(sys.argv[1])
output.parent.mkdir(parents=True, exist_ok=True)
frames = [render(tick) for tick in range(64)]
frames[0].save(output, save_all=True, append_images=frames[1:], duration=85, loop=0, optimize=True, disposal=2)
poster = output.with_name('tetris-poster.png')
render(24).convert('RGB').save(poster)
with Image.open(output) as check:
    assert check.size == (WIDTH, HEIGHT)
    assert check.n_frames > 1
    assert check.info['loop'] == 0
    # Pillow combines identical frames and preserves their duration.
    duration = 0
    for index in range(check.n_frames):
        check.seek(index)
        duration += check.info['duration']
    assert duration == 5440
    frame_count = check.n_frames
print(f'PASS: {output.name}, {frame_count} frames, {duration} ms, {output.stat().st_size:,} bytes; poster: {poster.name}')
