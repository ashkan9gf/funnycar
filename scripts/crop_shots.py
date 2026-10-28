#!/usr/bin/env python3
"""Crop and upscale car regions from user screenshots to diagnose remaining color spill."""
from PIL import Image
import os

UP = '/home/z/my-project/upload'
OUT = '/home/z/my-project/scripts/shots'
os.makedirs(OUT, exist_ok=True)

jobs = [
    # (file, box(l,t,r,b), name)  — car regions (eyeballed from 1366x768 screenshots)
    ('pasted_image_1793218635401.png', (860, 470, 1080, 650), 's1_redcar'),
    ('pasted_image_1793218635401.png', (1080, 490, 1270, 610), 's1_whitecar'),
    ('pasted_image_1793218640803.png', (790, 480, 1020, 660), 's2_redcar'),
    ('pasted_image_1793218645087.png', (600, 400, 850, 620), 's3_redcar'),
    ('pasted_image_1793218645087.png', (830, 420, 1000, 560), 's3_whitecar'),
]
for fn, box, name in jobs:
    p = os.path.join(UP, fn)
    if not os.path.exists(p):
        print('missing', fn); continue
    im = Image.open(p).convert('RGB')
    W, H = im.size
    l, t, r, b = box
    l, t = max(0, l), max(0, t)
    r, b = min(W, r), min(H, b)
    c = im.crop((l, t, r, b))
    scale = max(1, int(900 / max(c.size)))
    c = c.resize((c.width * scale, c.height * scale), Image.LANCZOS)
    out = os.path.join(OUT, f'{name}.png')
    c.save(out)
    print('saved', out, c.size)
