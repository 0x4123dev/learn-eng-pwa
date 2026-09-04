#!/usr/bin/env python3
"""Build img/farm/*.webp from the art manifest.

    python3 scripts/build-farm-art.py --placeholder
        Draw 48 simple stand-in pictures (a coloured isometric block with the
        file name) so the code, tests and a small test group can run before
        the real art exists. Re-running overwrites them.

    python3 scripts/build-farm-art.py --masters DIR
        Read DIR/<name>.png (one master per manifest entry, generated with an
        image model from the prompt in js/farm-art-manifest.js), trim the
        transparent margin, fit into px x px, and write WebP. A missing master
        keeps the existing placeholder and is listed at the end.

The manifest (names, sizes, prompts) is read from js/farm-art-manifest.js by
running node, so Python never holds a second copy of the list.
"""
import argparse
import json
import subprocess
import sys
from pathlib import Path

from PIL import Image, ImageDraw

ROOT = Path(__file__).resolve().parents[1]
OUT = ROOT / "img" / "farm"


def manifest():
    js = ("const M=require(process.argv[1]);"
          "console.log(JSON.stringify(M.FILES.map(f=>({name:f.name,px:f.px}))))")
    out = subprocess.check_output(["node", "-e", js, str(ROOT / "js" / "farm-art-manifest.js")])
    return json.loads(out)


def trim_and_fit(image: Image.Image, px: int) -> Image.Image:
    image = image.convert("RGBA")
    bbox = image.getbbox()
    if bbox:
        image = image.crop(bbox)
    w, h = image.size
    scale = min((px * 0.9) / w, (px * 0.9) / h)
    image = image.resize((max(1, round(w * scale)), max(1, round(h * scale))), Image.Resampling.LANCZOS)
    canvas = Image.new("RGBA", (px, px), (0, 0, 0, 0))
    canvas.paste(image, ((px - image.width) // 2, px - image.height - px // 20), image)
    return canvas


def tint(name: str):
    if "wilted" in name:
        return (176, 140, 80)
    if name.startswith("sprout"):
        return (120, 190, 90)
    if name == "dry-ground":
        return (196, 170, 130)
    for crop, colour in (("lettuce", (110, 200, 110)), ("tomato", (220, 80, 70)), ("carrot", (240, 140, 50)),
                         ("rice", (210, 190, 90)), ("rose", (230, 90, 150)), ("pumpkin", (240, 150, 40))):
        if name.startswith(crop):
            return colour
    return (150, 110, 70)  # buildings


def shade(colour, amount):
    """Darken without ever leaving the 0-255 byte range."""
    return tuple(max(0, min(255, channel - amount)) for channel in colour) + (255,)


def placeholder(name: str, px: int) -> Image.Image:
    """A flat isometric block in the family colour with the name on it."""
    img = Image.new("RGBA", (px, px), (0, 0, 0, 0))
    d = ImageDraw.Draw(img)
    base = tint(name)
    if name == "dry-ground":
        d.rectangle((0, 0, px, px), fill=shade(base, 0))
        for i in range(0, px, max(1, px // 8)):
            d.line((i, 0, px - i, px), fill=shade(base, 30), width=2)
        return img
    cx, top, w, h = px // 2, px * 0.30, px * 0.72, px * 0.36
    d.polygon([(cx, top), (cx + w / 2, top + h / 2), (cx, top + h), (cx - w / 2, top + h / 2)], fill=shade(base, 0))
    d.polygon([(cx - w / 2, top + h / 2), (cx, top + h), (cx, px * 0.86), (cx - w / 2, px * 0.68)], fill=shade(base, 40))
    d.polygon([(cx + w / 2, top + h / 2), (cx, top + h), (cx, px * 0.86), (cx + w / 2, px * 0.68)], fill=shade(base, 70))
    d.text((px * 0.06, px * 0.04), name, fill=(40, 30, 20, 255))
    return img


def main() -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("--placeholder", action="store_true")
    ap.add_argument("--masters", type=Path)
    args = ap.parse_args()
    if not args.placeholder and not args.masters:
        ap.error("pass --placeholder or --masters DIR")
    OUT.mkdir(parents=True, exist_ok=True)
    missing = []
    for entry in manifest():
        name, px = entry["name"], entry["px"]
        target = OUT / f"{name}.webp"
        if args.masters:
            src = args.masters / f"{name}.png"
            if not src.exists():
                missing.append(name)
                continue
            image = trim_and_fit(Image.open(src), px)
        else:
            image = placeholder(name, px)
        image.save(target, "WEBP", quality=82, method=6)
    if missing:
        print("no master for:", ", ".join(missing), file=sys.stderr)
        return 1
    return 0


if __name__ == "__main__":
    sys.exit(main())
