"""Make Cabin Chaos logo background transparent; keep wood + text."""
from __future__ import annotations

from collections import deque
from pathlib import Path

import numpy as np
from PIL import Image

SRC = Path(
    r"C:\Users\Kaspe\.cursor\projects\c-Users-Kaspe-exposed\assets\cabin-chaos-logo.png"
)
DST = Path(r"C:\Users\Kaspe\exposed\client\public\cabin-chaos-logo.png")


def is_bg_rgb(r: int, g: int, b: int) -> bool:
    """Checkerboard / flat backdrop (not wood, not cream text, not ember)."""
    mx = max(r, g, b)
    mn = min(r, g, b)
    sat = mx - mn
    mean = (r + g + b) / 3.0
    # Pure-ish gray cells (checkerboard)
    if sat < 35 and 70 <= mean <= 245:
        return True
    # Near black
    if mean < 22:
        return True
    return False


def is_keep_rgb(r: int, g: int, b: int) -> bool:
    mx = max(r, g, b)
    mn = min(r, g, b)
    sat = mx - mn
    mean = (r + g + b) / 3.0
    # Warm wood
    if r >= g - 5 and g >= b - 10 and r > 40 and sat > 18 and mean < 175:
        if r > b + 12:
            return True
    # Cream / off-white lettering (warm, not neutral gray)
    if mean > 155 and r > 160 and r >= b + 8 and sat < 90:
        return True
    # Ember / sparks
    if r > 140 and g > 50 and b < 130 and r > b + 35:
        return True
    return False


def flood_clear_background(arr: np.ndarray) -> np.ndarray:
    h, w, _ = arr.shape
    rgb = arr[:, :, :3].astype(np.int16)
    alpha = arr[:, :, 3].copy()
    visited = np.zeros((h, w), dtype=bool)
    q: deque[tuple[int, int]] = deque()

    def try_seed(y: int, x: int) -> None:
        r, g, b = int(rgb[y, x, 0]), int(rgb[y, x, 1]), int(rgb[y, x, 2])
        if is_keep_rgb(r, g, b):
            return
        if is_bg_rgb(r, g, b) or (not is_keep_rgb(r, g, b) and max(r, g, b) - min(r, g, b) < 40):
            q.append((y, x))
            visited[y, x] = True

    for x in range(w):
        try_seed(0, x)
        try_seed(h - 1, x)
    for y in range(h):
        try_seed(y, 0)
        try_seed(y, w - 1)

    while q:
        y, x = q.popleft()
        alpha[y, x] = 0
        for ny, nx in ((y - 1, x), (y + 1, x), (y, x - 1), (y, x + 1)):
            if ny < 0 or nx < 0 or ny >= h or nx >= w or visited[ny, nx]:
                continue
            r, g, b = int(rgb[ny, nx, 0]), int(rgb[ny, nx, 1]), int(rgb[ny, nx, 2])
            if is_keep_rgb(r, g, b):
                visited[ny, nx] = True
                continue
            if is_bg_rgb(r, g, b) or (max(r, g, b) - min(r, g, b) < 32 and (r + g + b) / 3 > 60):
                visited[ny, nx] = True
                q.append((ny, nx))

    out = arr.copy()
    out[:, :, 3] = alpha
    return out


def trim_transparent(img: Image.Image, pad: int = 12) -> Image.Image:
    bbox = img.split()[-1].getbbox()
    if not bbox:
        return img
    l, t, r, b = bbox
    l = max(0, l - pad)
    t = max(0, t - pad)
    r = min(img.width, r + pad)
    b = min(img.height, b + pad)
    return img.crop((l, t, r, b))


def main() -> None:
    img = Image.open(SRC).convert("RGBA")
    arr = np.array(img)
    out = flood_clear_background(arr)
    result = trim_transparent(Image.fromarray(out, "RGBA"))
    # Reasonable web size
    max_w = 900
    if result.width > max_w:
        nh = int(result.height * (max_w / result.width))
        result = result.resize((max_w, nh), Image.Resampling.LANCZOS)
    DST.parent.mkdir(parents=True, exist_ok=True)
    result.save(DST, "PNG", optimize=True)
    a = np.array(result)[:, :, 3]
    print(
        f"Wrote {DST} size={result.size} bytes={DST.stat().st_size} "
        f"transparent={100 * (a == 0).mean():.1f}% cornerA={a[0, 0]}"
    )


if __name__ == "__main__":
    main()
