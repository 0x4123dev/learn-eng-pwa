#!/usr/bin/env python3
"""Build the 50 runtime battle-scene WebP assets from ten art masters.

The masters are generated with ImageGen and kept in Codex's generated image
store. Runtime files are deliberately small: one opaque 2000x450 panorama,
one 320x180 picker poster, and three transparent 800x450 parallax zones.
"""

from pathlib import Path
from PIL import Image, ImageEnhance, ImageFilter


ROOT = Path(__file__).resolve().parents[1]
OUT = ROOT / "img" / "battle-scenes"
GENERATED = Path.home() / ".codex" / "generated_images" / "019fea17-18fc-7d11-a6e1-c60fc43cd628"

MASTERS = {
    "cloudstep-meadow": "exec-b8dae364-5abf-49a2-8d1b-2b3aa6b111ac.png",
    "clockwork-canyon": "exec-04f76b63-dd75-465f-bc62-722fc081ef86.png",
    "sakura-shrine": "exec-131f670a-5ce7-4a33-b8ee-2416807520c6.png",
    "aurora-glacier": "exec-fd6b2fc2-757b-4d1a-a8c5-bc55f8fa05b0.png",
    "ember-caldera": "exec-9b3a82cc-5ddf-4a41-a6fb-d5d78799e6a7.png",
    "pirate-lagoon": "exec-fb24739b-72b4-4481-a084-0972d3fb2fe2.png",
    "firefly-forest": "exec-e3a92168-2ce5-46b4-8213-daf4a82a66d7.png",
    "moonlit-rooftops": "exec-15b48506-7970-4144-b342-c0524c85dfab.png",
    "candy-cloudworks": "exec-88b88afa-c80c-4030-bcf1-00cc677705e4.png",
    "cosmic-observatory": "exec-d2ef07f6-399a-4ac8-8ab2-4840129ba8dc.png",
}


def cover(image: Image.Image, size: tuple[int, int]) -> Image.Image:
    """Centre-crop like CSS object-fit: cover, then resize with Lanczos."""
    target_w, target_h = size
    src_w, src_h = image.size
    target_ratio = target_w / target_h
    src_ratio = src_w / src_h
    if src_ratio > target_ratio:
        crop_w = round(src_h * target_ratio)
        left = (src_w - crop_w) // 2
        image = image.crop((left, 0, left + crop_w, src_h))
    else:
        crop_h = round(src_w / target_ratio)
        # Preserve extra sky and the lower landmark line.
        top = max(0, round((src_h - crop_h) * 0.42))
        image = image.crop((0, top, src_w, top + crop_h))
    return image.resize(size, Image.Resampling.LANCZOS)


def zone_layer(far: Image.Image, left: int) -> Image.Image:
    """Make a transparent lower-atmosphere/landmark strip for parallax."""
    crop = far.crop((left, 0, left + 800, 450)).convert("RGBA")
    crop = ImageEnhance.Color(crop).enhance(1.08)
    crop = ImageEnhance.Contrast(crop).enhance(1.06)
    alpha = Image.new("L", crop.size, 0)
    px = alpha.load()
    for y in range(450):
        vertical = max(0.0, min(1.0, (y - 170) / 180.0))
        for x in range(800):
            edge = min(1.0, x / 54.0, (799 - x) / 54.0)
            px[x, y] = round(210 * vertical * edge)
    alpha = alpha.filter(ImageFilter.GaussianBlur(4))
    crop.putalpha(alpha)
    return crop


def build() -> None:
    OUT.mkdir(parents=True, exist_ok=True)
    for theme_id, filename in MASTERS.items():
        source = GENERATED / filename
        if not source.exists():
            raise FileNotFoundError(source)
        theme_dir = OUT / theme_id
        theme_dir.mkdir(parents=True, exist_ok=True)
        master = Image.open(source).convert("RGB")
        far = cover(master, (2000, 450))
        far.save(theme_dir / "far-strip.webp", "WEBP", quality=76, method=6)
        cover(master, (320, 180)).save(
            theme_dir / "poster.webp", "WEBP", quality=72, method=6
        )
        for name, left in (("left", 0), ("center", 600), ("right", 1200)):
            zone_layer(far, left).save(
                theme_dir / f"zone-{name}.webp",
                "WEBP",
                quality=72,
                method=6,
                exact=True,
            )


if __name__ == "__main__":
    build()
