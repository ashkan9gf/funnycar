#!/usr/bin/env python3
"""آماده‌سازی دسته‌ای مراجع: rembg (u2net) → 384px با حاشیه → refs/{name}.png
Usage: python3 scripts/batch_prep_refs.py tiba peugeot405 samand taxi police renault4 vintage challenger
"""
import os
import sys

from PIL import Image
from rembg import remove, new_session

SESSION = new_session("u2net")
SRC_DIR = "/home/z/my-project/download/tripo/refs"
SIZE = 384

for name in sys.argv[1:]:
    raw = os.path.join(SRC_DIR, f"{name}_raw.png")
    out = os.path.join(SRC_DIR, f"{name}.png")
    img = Image.open(raw).convert("RGB")
    cut = remove(img, session=SESSION)
    # کراپ به باندینگ آلفا + مربع‌سازی با حاشیهٔ سفید
    bbox = cut.getbbox()
    cut = cut.crop(bbox)
    side = int(max(cut.size) * 1.08)
    canvas = Image.new("RGBA", (side, side), (255, 255, 255, 255))
    canvas.paste(cut, ((side - cut.width) // 2, (side - cut.height) // 2), cut)
    canvas = canvas.resize((SIZE, SIZE), Image.LANCZOS)
    canvas.save(out)
    print(f"OK {name}: {cut.size} → {out}")
print("done")
