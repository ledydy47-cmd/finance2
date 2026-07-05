#!/usr/bin/env python3
"""Process category icon PNGs: remove backgrounds, trim, resize."""

from __future__ import annotations

from collections import deque
from pathlib import Path

from PIL import Image

ASSETS = Path(
    "/Users/diana/.cursor/projects/Users-diana-Projects-personal-finance-tracker/assets"
)
OUT = Path("/Users/diana/Projects/personal-finance-tracker/public/images/icons")

MAPPING = {
    "products.png": ASSETS
    / "A_single_flat_illustrated_2D_icon_for_a_finance_ap-1783158665402__2_-0b139e9a-d739-4d37-989c-282cfd2d10d8.png",
    "beauty.png": ASSETS
    / "A_single_flat_illustrated_2D_icon_for_a_finance_ap-1783158665402__3_-a7e524b1-6b17-4055-a0b4-a4febef55dcf.png",
    "transport.png": ASSETS
    / "A_single_flat_illustrated_2D_icon_for_a_finance_ap-1783158665402__4_-37c4dda0-681c-48e7-97f9-025bb5bb2ce3.png",
    "marketplaces.png": ASSETS
    / "A_single_flat_illustrated_2D_icon_for_a_finance_ap-1783158665402__5_-758d4bd1-84bb-4057-88a0-2b0d062b1837.png",
    "cafe-delivery.png": ASSETS
    / "A_single_flat_illustrated_2D_icon_for_a_finance_ap-1783158665402__1_-bb7b28fe-c8ba-47d1-bcc3-48e6fc5808b3.png",
}

STRIP_ALL_BLACK = {"transport.png", "marketplaces.png"}
THRESHOLD = 55


def is_dark(r: int, g: int, b: int, t: int = THRESHOLD) -> bool:
    return r <= t and g <= t and b <= t


def flood_remove_edge_background(img: Image.Image) -> Image.Image:
    px = img.load()
    w, h = img.size
    seen: set[tuple[int, int]] = set()
    q: deque[tuple[int, int]] = deque()

    for x in range(w):
        for y in (0, h - 1):
            if is_dark(*px[x, y][:3]):
                q.append((x, y))
    for y in range(h):
        for x in (0, w - 1):
            if is_dark(*px[x, y][:3]):
                q.append((x, y))

    while q:
        x, y = q.popleft()
        if (x, y) in seen or not (0 <= x < w and 0 <= y < h):
            continue
        r, g, b, a = px[x, y]
        if not is_dark(r, g, b):
            continue
        seen.add((x, y))
        px[x, y] = (0, 0, 0, 0)
        q.extend([(x + 1, y), (x - 1, y), (x, y + 1), (x, y - 1)])

    return img


def strip_all_dark_pixels(img: Image.Image) -> Image.Image:
    px = img.load()
    w, h = img.size
    for y in range(h):
        for x in range(w):
            r, g, b, a = px[x, y]
            if a == 0:
                continue
            if is_dark(r, g, b):
                px[x, y] = (0, 0, 0, 0)
            elif max(r, g, b) < 70 and (r + g + b) < 120:
                px[x, y] = (0, 0, 0, 0)
    return img


def trim_and_pad(img: Image.Image, size: int = 256, padding: int = 16) -> Image.Image:
    bbox = img.getbbox()
    if not bbox:
        return img
    cropped = img.crop(bbox)
    cw, ch = cropped.size
    inner = size - padding * 2
    scale = inner / max(cw, ch)
    nw, nh = max(1, int(cw * scale)), max(1, int(ch * scale))
    resized = cropped.resize((nw, nh), Image.Resampling.LANCZOS)
    canvas = Image.new("RGBA", (size, size), (0, 0, 0, 0))
    ox = (size - nw) // 2
    oy = (size - nh) // 2
    canvas.paste(resized, (ox, oy), resized)
    return canvas


def process(name: str, src: Path) -> None:
    img = Image.open(src).convert("RGBA")
    img = flood_remove_edge_background(img)
    if name in STRIP_ALL_BLACK:
        img = strip_all_dark_pixels(img)
    else:
        img = strip_all_dark_pixels(img)
    img = trim_and_pad(img)
    dest = OUT / name
    img.save(dest, format="PNG", optimize=True)
    print(f"processed {name}")


def main() -> None:
    OUT.mkdir(parents=True, exist_ok=True)
    for name, src in MAPPING.items():
        process(name, src)


if __name__ == "__main__":
    main()
