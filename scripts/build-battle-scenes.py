#!/usr/bin/env python3
"""Build the 50 runtime battle-scene WebP assets from ten tall art masters.

The masters are generated with ImageGen and kept in Codex's generated image
store. Runtime files are deliberately small: one opaque 2000x900 panorama,
one 320x180 picker poster, and three transparent 800x900 parallax zones.
"""

from pathlib import Path
from PIL import Image, ImageEnhance, ImageFilter


ROOT = Path(__file__).resolve().parents[1]
OUT = ROOT / "img" / "battle-scenes"
GENERATED = Path.home() / ".codex" / "generated_images" / "019fea17-18fc-7d11-a6e1-c60fc43cd628"

MASTERS = {
    "cloudstep-meadow": "exec-1913c634-7c85-49f9-ad26-b1398af59ab9.png",
    "clockwork-canyon": "exec-b564a2e1-86db-4f62-9471-c4f6064adf87.png",
    "sakura-shrine": "exec-66160f27-a12c-4ab1-80d3-d52ea48b1493.png",
    "aurora-glacier": "exec-66a4bc8d-186a-4558-b23c-32afb540ceb9.png",
    "ember-caldera": "exec-f5e04bd1-25f6-4593-9f03-629ef9d1bb1b.png",
    "pirate-lagoon": "exec-0d2a88b4-40e8-4a1a-ad15-9d6b20fceb80.png",
    "firefly-forest": "exec-3fc04bbe-5a1a-47cb-9c5b-24a6c91d0bb3.png",
    "moonlit-rooftops": "exec-385f435a-f839-4b90-975e-f698896034d8.png",
    "candy-cloudworks": "exec-7e47bfc7-af27-4e9a-b565-10954fd48798.png",
    "cosmic-observatory": "exec-4f2b561b-925e-4dcb-8f65-8ca08b38f21d.png",
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
    crop = far.crop((left, 0, left + 800, 900)).convert("RGBA")
    crop = ImageEnhance.Color(crop).enhance(1.08)
    crop = ImageEnhance.Contrast(crop).enhance(1.06)
    alpha = Image.new("L", crop.size, 0)
    px = alpha.load()
    for y in range(900):
        # Keep the upper sky in the far strip. Mid/foreground landmarks enter
        # gradually below the horizon, avoiding a visible rectangular seam.
        vertical = max(0.0, min(1.0, (y - 360) / 330.0))
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
        far = cover(master, (2000, 900))
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
