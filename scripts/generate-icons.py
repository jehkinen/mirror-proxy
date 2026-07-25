#!/usr/bin/env python3
"""Generate Mirror Proxy extension icons (16/32/48/128).

Symbol: Gateway hop — muted entry → mint gate → mint exit arrow.
Reads as traffic routed through a proxy.
"""

from __future__ import annotations

from pathlib import Path

from PIL import Image, ImageDraw

OUT = Path(__file__).resolve().parent.parent / 'icons'

BG_TOP = (10, 16, 18)
BG_BOTTOM = (22, 40, 44)
MINT = (94, 234, 212)
MUTED = (110, 138, 134)
GLOW = (94, 234, 212, 70)
RING = (148, 220, 210, 56)


def lerp(a: float, b: float, t: float) -> float:
    return a + (b - a) * t


def lerp_rgb(c1: tuple[int, ...], c2: tuple[int, ...], t: float) -> tuple[int, int, int]:
    return (
        int(lerp(c1[0], c2[0], t)),
        int(lerp(c1[1], c2[1], t)),
        int(lerp(c1[2], c2[2], t)),
    )


def draw_gradient_bg(size: int, pad: int, radius: int) -> Image.Image:
    inner = size - pad * 2
    canvas = Image.new('RGBA', (inner, inner), (0, 0, 0, 0))
    px = canvas.load()
    for y in range(inner):
        t = y / max(inner - 1, 1)
        color = lerp_rgb(BG_TOP, BG_BOTTOM, t)
        for x in range(inner):
            px[x, y] = (*color, 255)

    glow = Image.new('RGBA', (inner, inner), (0, 0, 0, 0))
    gd = ImageDraw.Draw(glow)
    gd.ellipse(
        [inner * 0.12, inner * 0.08, inner * 0.88, inner * 0.78],
        fill=(94, 234, 212, 24),
    )
    canvas = Image.alpha_composite(canvas.convert('RGBA'), glow)

    mask = Image.new('L', (inner, inner), 0)
    ImageDraw.Draw(mask).rounded_rectangle([0, 0, inner - 1, inner - 1], radius=radius, fill=255)

    slot = Image.new('RGBA', (size, size), (0, 0, 0, 0))
    slot.paste(canvas, (pad, pad), mask)
    return slot


def draw_symbol(draw: ImageDraw.ImageDraw, s: int, output_size: int) -> None:
    cy = s * 0.52
    stroke = max(3, int(s * 0.055 if output_size <= 16 else s * 0.048))
    node_r = max(3, int(s * 0.055 if output_size <= 16 else s * 0.048))

    left_x = s * 0.22
    gate_l = s * 0.42
    gate_r = s * 0.58
    gate_t = s * 0.34
    gate_b = s * 0.70
    right_x = s * 0.78

    glow_pad = int(s * 0.06)
    draw.rounded_rectangle(
        [gate_l - glow_pad, gate_t - glow_pad, gate_r + glow_pad, gate_b + glow_pad],
        radius=max(2, int(s * 0.04)),
        fill=GLOW,
    )

    draw.rounded_rectangle(
        [gate_l, gate_t, gate_r, gate_b],
        radius=max(2, int(s * 0.035)),
        outline=MINT + (255,),
        width=stroke,
    )
    draw.rounded_rectangle(
        [
            gate_l + stroke * 0.9,
            gate_t + stroke * 0.9,
            gate_r - stroke * 0.9,
            gate_b - stroke * 0.9,
        ],
        radius=max(1, int(s * 0.02)),
        fill=(*MINT, 36),
    )

    draw.line(
        [(left_x + node_r, cy), (gate_l - stroke * 0.2, cy)],
        fill=MUTED + (255,),
        width=stroke,
    )
    draw.line(
        [(gate_r + stroke * 0.2, cy), (right_x - node_r * 0.2, cy)],
        fill=MINT + (255,),
        width=stroke,
    )

    draw.ellipse(
        [left_x - node_r, cy - node_r, left_x + node_r, cy + node_r],
        fill=MUTED + (255,),
    )

    tip = right_x + node_r * 0.35
    ah = max(4, int(s * 0.055))
    aw = max(5, int(s * 0.07))
    draw.polygon(
        [
            (tip, cy),
            (tip - aw, cy - ah),
            (tip - aw, cy + ah),
        ],
        fill=MINT + (255,),
    )


def draw_icon(size: int) -> Image.Image:
    scale = 5 if size <= 16 else 4 if size <= 48 else 3
    s = size * scale
    pad_ratio = 0.14 if size <= 16 else 0.11 if size <= 32 else 0.08
    pad = max(1, int(s * pad_ratio))
    radius = max(4, s // 5)

    img = draw_gradient_bg(s, pad, radius - max(1, pad // 3))
    draw = ImageDraw.Draw(img)

    if size >= 32:
        draw.rounded_rectangle(
            [pad, pad, s - pad - 1, s - pad - 1],
            radius=radius - max(1, pad // 3),
            outline=RING,
            width=max(1, scale // 3),
        )

    draw_symbol(draw, s, size)
    return img.resize((size, size), Image.Resampling.LANCZOS)


def main() -> None:
    OUT.mkdir(parents=True, exist_ok=True)
    for size in (16, 32, 48, 128):
        path = OUT / f'icon-{size}.png'
        draw_icon(size).save(path, optimize=True)
        print('wrote', path)


if __name__ == '__main__':
    main()
