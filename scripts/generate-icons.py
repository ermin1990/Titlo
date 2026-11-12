#!/usr/bin/env python3
"""Generiše ikone i splash za PWA, Android i iOS. Pokreni: python3 scripts/generate-icons.py"""
from pathlib import Path

from PIL import Image, ImageDraw, ImageFont

ROOT = Path(__file__).resolve().parent.parent
PUBLIC = ROOT / "apps" / "web" / "public" / "icons"
ASSETS = ROOT / "assets"

BG = (16, 16, 18, 255)
YELLOW = (255, 225, 74, 255)
INK = (16, 16, 18, 255)
TEXT = (244, 243, 238, 255)
MUTED = (168, 167, 160, 255)

FONT_BOLD = "/System/Library/Fonts/Supplemental/Arial Bold.ttf"
FONT_REG = "/System/Library/Fonts/Supplemental/Arial.ttf"


def font(path: str, size: int) -> ImageFont.FreeTypeFont:
    try:
        return ImageFont.truetype(path, size)
    except OSError:
        return ImageFont.load_default(size)


def draw_icon(size: int, padding_ratio: float) -> Image.Image:
    image = Image.new("RGBA", (size, size), BG)
    draw = ImageDraw.Draw(image)
    side = int(size * (1 - padding_ratio * 2))
    offset = (size - side) // 2
    radius = int(side * 0.24)
    draw.rounded_rectangle(
        (offset, offset, offset + side, offset + side),
        radius=radius,
        fill=YELLOW,
    )
    glyph = font(FONT_BOLD, int(side * 0.62))
    draw.text(
        (size / 2, size / 2 - side * 0.03),
        "T",
        font=glyph,
        fill=INK,
        anchor="mm",
    )
    return image


def draw_splash(size: int) -> Image.Image:
    image = Image.new("RGBA", (size, size), BG)
    draw = ImageDraw.Draw(image)
    icon_side = int(size * 0.24)
    x0 = (size - icon_side) // 2
    y0 = int(size * 0.38)
    draw.rounded_rectangle(
        (x0, y0, x0 + icon_side, y0 + icon_side),
        radius=int(icon_side * 0.24),
        fill=YELLOW,
    )
    glyph = font(FONT_BOLD, int(icon_side * 0.62))
    draw.text(
        (x0 + icon_side / 2, y0 + icon_side / 2 - icon_side * 0.03),
        "T",
        font=glyph,
        fill=INK,
        anchor="mm",
    )
    wordmark = font(FONT_BOLD, int(size * 0.075))
    draw.text(
        (size / 2, y0 + icon_side + size * 0.09),
        "Titlo",
        font=wordmark,
        fill=TEXT,
        anchor="mm",
    )
    tagline = font(FONT_REG, int(size * 0.028))
    draw.text(
        (size / 2, y0 + icon_side + size * 0.145),
        "titlovi u ritmu",
        font=tagline,
        fill=MUTED,
        anchor="mm",
    )
    return image


def save(image: Image.Image, path: Path) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    image.save(path)
    print("napisano", path.relative_to(ROOT))


def main() -> None:
    icon = draw_icon(1024, 0.18)
    maskable = draw_icon(1024, 0.26)

    save(icon, ASSETS / "icon.png")
    save(maskable, ASSETS / "icon-maskable.png")
    save(draw_splash(2732), ASSETS / "splash.png")
    save(draw_splash(2732), ASSETS / "splash-dark.png")

    save(icon.resize((512, 512), Image.LANCZOS), PUBLIC / "icon-512.png")
    save(icon.resize((192, 192), Image.LANCZOS), PUBLIC / "icon-192.png")
    save(maskable.resize((512, 512), Image.LANCZOS), PUBLIC / "maskable-512.png")
    save(icon.resize((180, 180), Image.LANCZOS), PUBLIC / "apple-touch-icon.png")


if __name__ == "__main__":
    main()
