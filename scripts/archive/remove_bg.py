#!/usr/bin/env python3
"""Remove background locally → RGBA (TRELLIS.2 از آلفا مستقیم استفاده می‌کند).
Usage: python3 scripts/remove_bg.py <in.png> <out.png>
"""
import sys
from rembg import remove, new_session
from PIL import Image

src, dst = sys.argv[1], sys.argv[2]
img = Image.open(src).convert("RGB")
session = new_session("u2net")  # مدل سبک — رم ۳GB
out = remove(img, session=session)
out.save(dst)
print(f"OK → {dst} ({out.size[0]}x{out.size[1]}, mode={out.mode})")
