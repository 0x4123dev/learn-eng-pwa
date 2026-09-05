#!/usr/bin/env python3
"""Remove a baked flat backdrop from draggable game artwork.

The source artwork must have a mostly uniform colour touching the canvas edge.
Only pixels connected to that outer edge are removed, so similarly coloured
details enclosed by the object are preserved.  The result is saved as a WebP
with a real alpha channel; a fake checkerboard is never an acceptable output.
"""
import argparse
import math
from collections import deque
from pathlib import Path

from PIL import Image


def median(values):
    values = sorted(values)
    return values[len(values) // 2]


def background_colour(image):
    """Estimate the backdrop from small patches in all four corners."""
    w, h = image.size
    inset = max(4, min(w, h) // 32)
    samples = []
    for y0 in (0, h - inset):
        for x0 in (0, w - inset):
            for y in range(y0, y0 + inset):
                for x in range(x0, x0 + inset):
                    samples.append(image.getpixel((x, y))[:3])
    return tuple(median([pixel[channel] for pixel in samples]) for channel in range(3))


def distance(pixel, background):
    return math.sqrt(sum((pixel[channel] - background[channel]) ** 2 for channel in range(3)))


def cut_out(image):
    image = image.convert("RGBA")
    w, h = image.size
    bg = background_colour(image)
    reachable = bytearray(w * h)
    queue = deque()

    def enqueue(x, y):
        index = y * w + x
        if reachable[index] or distance(image.getpixel((x, y)), bg) > 72:
            return
        reachable[index] = 1
        queue.append((x, y))

    for x in range(w):
        enqueue(x, 0)
        enqueue(x, h - 1)
    for y in range(h):
        enqueue(0, y)
        enqueue(w - 1, y)

    while queue:
        x, y = queue.popleft()
        if x:
            enqueue(x - 1, y)
        if x + 1 < w:
            enqueue(x + 1, y)
        if y:
            enqueue(x, y - 1)
        if y + 1 < h:
            enqueue(x, y + 1)

    pixels = list(image.getdata())
    for index, is_background in enumerate(reachable):
        if not is_background:
            continue
        d = distance(pixels[index], bg)
        # Fully remove the flat backdrop and retain a short feathered edge for
        # artwork antialiasing and natural shadows.
        alpha = 0 if d <= 24 else round(255 * min(1, (d - 24) / 48))
        r, g, b, old_alpha = pixels[index]
        pixels[index] = (r, g, b, min(old_alpha, alpha))
    image.putdata(pixels)
    return image


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("images", nargs="+", type=Path)
    args = parser.parse_args()

    for path in args.images:
        with Image.open(path) as source:
            rgba = source.convert("RGBA")
            alpha = rgba.getchannel("A")
            corners = [alpha.getpixel((0, 0)), alpha.getpixel((rgba.width - 1, 0)),
                       alpha.getpixel((0, rgba.height - 1)), alpha.getpixel((rgba.width - 1, rgba.height - 1))]
            if alpha.getextrema()[0] == 0 and max(corners) == 0:
                print(f"already transparent: {path}")
                continue
            result = cut_out(rgba)
        result.save(path, "WEBP", quality=92, method=6, exact=True)
        check = Image.open(path).convert("RGBA").getchannel("A")
        if check.getextrema() != (0, 255) or any(check.getpixel(point) for point in (
                (0, 0), (result.width - 1, 0), (0, result.height - 1), (result.width - 1, result.height - 1))):
            raise RuntimeError(f"alpha validation failed: {path}")
        print(f"true-alpha cutout: {path}")


if __name__ == "__main__":
    main()
