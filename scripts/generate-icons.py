#!/usr/bin/env python3
"""
Titlo logo: ikone i splash za PWA, Android, iOS i sajt.

Znak je "T" sastavljen od tri riječi titla (gornji red) i stuba. Treća
riječ je prigušena, kao riječ koja tek dolazi u karaoke titlu. Sve je
geometrija, bez fonta, pa SVG i PNG izgledaju isto na svakom uređaju.

Pokreni:
    python3 scripts/generate-icons.py
    npx capacitor-assets generate --android --ios
"""
from pathlib import Path

from PIL import Image, ImageDraw, ImageFont

ROOT = Path(__file__).resolve().parent.parent
PUBLIC = ROOT / "apps" / "web" / "public" / "icons"
ASSETS = ROOT / "assets"
SITE = ROOT / "site"

BG = (16, 16, 18)
YELLOW_TOP = (255, 228, 92)
YELLOW_BOTTOM = (255, 196, 36)
INK = (16, 16, 18)
TEXT = (244, 243, 238)
MUTED = (168, 167, 160)
UPCOMING_ALPHA = 0.34

# Geometrija na platnu 1024 × 1024. Prečka "T" su tri riječi; srednja riječ
# i stub su jedan oblik, pa se znak čita kao slovo, a ne kao tri tačke.
PILL_Y = (226, 346)
WORDS = [(140, 380), (400, 624), (644, 884)]
STEM = (400, 226, 624, 790)
RADIUS = 60
SS = 4  # supersampling za glatke ivice


def lerp(a: tuple, b: tuple, t: float) -> tuple:
    return tuple(round(a[i] + (b[i] - a[i]) * t) for i in range(3))


def gradient(size: int) -> Image.Image:
    image = Image.new("RGB", (1, size))
    for y in range(size):
        image.putpixel((0, y), lerp(YELLOW_TOP, YELLOW_BOTTOM, y / max(1, size - 1)))
    return image.resize((size, size))


def draw_mark(size: int, scale: float, color=INK) -> Image.Image:
    """Znak na providnoj podlozi, centriran; `scale` je udio punog znaka."""
    big = size * SS
    k = big / 1024 * scale
    shift = big / 2 - 512 * k

    def box(x0: float, y0: float, x1: float, y1: float) -> tuple:
        return (shift + x0 * k, shift + y0 * k, shift + x1 * k, shift + y1 * k)

    solid = Image.new("RGBA", (big, big), (0, 0, 0, 0))
    draw = ImageDraw.Draw(solid)
    radius = RADIUS * k
    x0, x1 = WORDS[0]
    draw.rounded_rectangle(box(x0, PILL_Y[0], x1, PILL_Y[1]), radius=radius, fill=(*color, 255))
    draw.rounded_rectangle(box(*STEM), radius=radius, fill=(*color, 255))

    ghost = Image.new("RGBA", (big, big), (0, 0, 0, 0))
    gx0, gx1 = WORDS[2]
    ImageDraw.Draw(ghost).rounded_rectangle(
        box(gx0, PILL_Y[0], gx1, PILL_Y[1]), radius=radius, fill=(*color, round(255 * UPCOMING_ALPHA))
    )
    return Image.alpha_composite(ghost, solid).resize((size, size), Image.LANCZOS)


def tile(size: int, scale: float = 1.0, rounded: bool = False) -> Image.Image:
    """Žuta pločica sa znakom. `rounded` daje providne uglove (za 'any' ikone)."""
    image = Image.alpha_composite(gradient(size).convert("RGBA"), draw_mark(size, scale))
    if rounded:
        mask = Image.new("L", (size * SS, size * SS), 0)
        ImageDraw.Draw(mask).rounded_rectangle(
            (0, 0, size * SS - 1, size * SS - 1), radius=size * SS * 0.225, fill=255
        )
        image.putalpha(mask.resize((size, size), Image.LANCZOS))
    return image


def font(size: int) -> ImageFont.FreeTypeFont:
    """Debeli sistemski font za natpis na splash ekranu (woff Pillow ne čita)."""
    collection = Path("/System/Library/Fonts/Avenir Next.ttc")
    for index in range(16):
        try:
            candidate = ImageFont.truetype(str(collection), size, index=index)
        except OSError:
            break
        if candidate.getname()[1] == "Bold":
            return candidate
    try:
        return ImageFont.truetype("/System/Library/Fonts/Supplemental/Arial Bold.ttf", size)
    except OSError:
        return ImageFont.load_default(size)


def splash(size: int) -> Image.Image:
    image = Image.new("RGBA", (size, size), (*BG, 255))
    side = int(size * 0.2)
    x0 = (size - side) // 2
    y0 = int(size * 0.36)
    image.alpha_composite(tile(side, rounded=True), (x0, y0))
    draw = ImageDraw.Draw(image)
    draw.text((size / 2, y0 + side + size * 0.085), "Titlo", font=font(int(size * 0.07)), fill=TEXT, anchor="mm")
    return image


def svg_mark(color: str = "#101012") -> str:
    height = PILL_Y[1] - PILL_Y[0]
    a0, a1 = WORDS[0]
    c0, c1 = WORDS[2]
    x0, y0, x1, y1 = STEM
    return (
        f'<g fill="{color}">'
        f'<rect x="{a0}" y="{PILL_Y[0]}" width="{a1 - a0}" height="{height}" rx="{RADIUS}"/>'
        f'<rect x="{x0}" y="{y0}" width="{x1 - x0}" height="{y1 - y0}" rx="{RADIUS}"/>'
        f'<rect x="{c0}" y="{PILL_Y[0]}" width="{c1 - c0}" height="{height}" rx="{RADIUS}" fill-opacity="{UPCOMING_ALPHA}"/>'
        "</g>"
    )


def svg_logo() -> str:
    top = "#%02x%02x%02x" % YELLOW_TOP
    bottom = "#%02x%02x%02x" % YELLOW_BOTTOM
    return (
        '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1024 1024">'
        '<defs><linearGradient id="g" x1="0" y1="0" x2="0" y2="1">'
        f'<stop offset="0" stop-color="{top}"/><stop offset="1" stop-color="{bottom}"/>'
        "</linearGradient></defs>"
        '<rect width="1024" height="1024" rx="230" fill="url(#g)"/>' + svg_mark() + "</svg>\n"
    )


def save(image: Image.Image, path: Path) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    image.save(path, optimize=True)
    print("napisano", path.relative_to(ROOT))


def write(text: str, path: Path) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(text)
    print("napisano", path.relative_to(ROOT))


def main() -> None:
    full = tile(1024)
    rounded = tile(1024, rounded=True)

    # Ulazi za `npx capacitor-assets generate` (Android adaptive + iOS).
    save(full.convert("RGB"), ASSETS / "icon-only.png")
    save(draw_mark(1024, 0.74), ASSETS / "icon-foreground.png")
    save(gradient(1024), ASSETS / "icon-background.png")
    save(full.convert("RGB"), ASSETS / "icon.png")
    save(tile(1024, scale=0.78).convert("RGB"), ASSETS / "icon-maskable.png")
    save(splash(2732), ASSETS / "splash.png")
    save(splash(2732), ASSETS / "splash-dark.png")
    write(svg_logo(), ASSETS / "logo.svg")

    # PWA: 'any' ikone sa zaobljenim uglovima; maskable i iOS preko cijelog kvadrata.
    save(rounded.resize((512, 512), Image.LANCZOS), PUBLIC / "icon-512.png")
    save(rounded.resize((192, 192), Image.LANCZOS), PUBLIC / "icon-192.png")
    save(tile(512, scale=0.78).convert("RGB"), PUBLIC / "maskable-512.png")
    save(full.resize((180, 180), Image.LANCZOS).convert("RGB"), PUBLIC / "apple-touch-icon.png")
    write(svg_logo(), PUBLIC / "logo.svg")

    # Sajt.
    save(rounded.resize((192, 192), Image.LANCZOS), SITE / "icon-192.png")
    save(full.resize((180, 180), Image.LANCZOS).convert("RGB"), SITE / "apple-touch-icon.png")
    write(svg_logo(), SITE / "logo.svg")


if __name__ == "__main__":
    main()
