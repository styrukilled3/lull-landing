"""Pack sprites from assets/src into assets/sprites.png (4 cols x 3 rows, 256px cells).

Row 0-1: flower-1..8, row 2: leaf-1..4.
Transparent pixels get the colour of the nearest opaque pixel so linear filtering
and mipmaps never pull a dark or white fringe into the petal edges.
Usage: python3 -I tools/build_atlas.py <repo_root>
"""
import sys
from pathlib import Path
import numpy as np
from PIL import Image
from scipy import ndimage

root = Path(sys.argv[1])
src = root / "assets" / "src"
names = [f"flower-{i}" for i in range(1, 9)] + [f"leaf-{i}" for i in range(1, 5)]
CELL, COLS, ROWS, INNER = 256, 4, 3, 240

atlas = Image.new("RGBA", (CELL * COLS, CELL * ROWS), (0, 0, 0, 0))
for idx, name in enumerate(names):
    im = Image.open(src / f"{name}.png").convert("RGBA").resize((INNER, INNER), Image.LANCZOS)
    a = np.array(im)
    alpha = a[..., 3]
    opaque = alpha >= 128
    _, (iy, ix) = ndimage.distance_transform_edt(~opaque, return_indices=True)
    fill = a[iy, ix, :3]
    a[~opaque, :3] = fill[~opaque]
    tile = Image.fromarray(a, "RGBA")
    col, row = idx % COLS, idx // COLS
    atlas.paste(tile, (col * CELL + (CELL - INNER) // 2, row * CELL + (CELL - INNER) // 2))

out = root / "assets" / "sprites.png"
atlas.save(out, optimize=True)
print("wrote", out, atlas.size, out.stat().st_size // 1024, "KB")
