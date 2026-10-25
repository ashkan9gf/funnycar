#!/usr/bin/env python3
"""TRELLIS.2 full pipeline with LOCAL preprocessing (رایگان — HF_TOKEN).
الگو: خروجی inline SSE مرز ~128KB دارد → preprocess را محلی می‌کنیم و
مستقیم /image_to_3d صدا می‌زنیم (خروجی HTML کوچک).

Usage: nohup python3 scripts/trellis_full.py <img> <name> [decim] [tex] &
"""
import os, shutil, sys, time

import numpy as np
from PIL import Image

HF_TOKEN = os.environ.get("HF_TOKEN", "") or None
SPACE = "microsoft/TRELLIS.2"

SRC = sys.argv[1] if len(sys.argv) > 1 else "download/tripo/player_ref_alpha.png"
NAME = sys.argv[2] if len(sys.argv) > 2 else "player"
DECIM = float(sys.argv[3]) if len(sys.argv) > 3 else 100000
TEX = float(sys.argv[4]) if len(sys.argv) > 4 else 1024
OUT = f"/home/z/my-project/download/tripo/{NAME}.glb"
PP = f"/tmp/{NAME}_preprocessed.jpg"


def local_preprocess() -> str:
    """بازسازی دقیق preprocess_image از کد TRELLIS.2 (بدون rmbg داخلی)"""
    img = Image.open(SRC)
    has_alpha = False
    if img.mode == "RGBA":
        a = np.array(img)[:, :, 3]
        if not np.all(a == 255):
            has_alpha = True
    if not has_alpha:
        raise SystemExit("تصویر ورودی باید آلفای حذف-پس‌زمینه داشته باشد (remove_bg.py)")
    max_size = max(img.size)
    scale = min(1, 1024 / max_size)
    if scale < 1:
        img = img.resize((int(img.width * scale), int(img.height * scale)), Image.LANCZOS)
    out_np = np.array(img).astype(np.float32)
    alpha = out_np[:, :, 3]
    bbox = np.argwhere(alpha > 0.8 * 255)
    y0, x0 = np.min(bbox[:, 0]), np.min(bbox[:, 1])
    y1, x1 = np.max(bbox[:, 0]), np.max(bbox[:, 1])
    cx, cy = (x0 + x1) / 2, (y0 + y1) / 2
    size = int(max(x1 - x0, y1 - y0) * 1)
    box = (int(cx - size // 2), int(cy - size // 2), int(cx + size // 2), int(cy + size // 2))
    cropped = img.crop(box)
    cnp = np.array(cropped).astype(np.float32) / 255
    cnp = cnp[:, :, :3] * cnp[:, :, 3:4]
    result = Image.fromarray((cnp * 255).astype(np.uint8))
    result.convert("RGB").save(PP, "JPEG", quality=82)
    print(f"preprocessed → {PP} {result.size} ({os.path.getsize(PP)//1024}KB)", flush=True)
    return PP


def main() -> int:
    from gradio_client import Client, handle_file
    pp = local_preprocess()
    print(f"connecting {SPACE} ...", flush=True)
    c = Client(SPACE, verbose=False, token=HF_TOKEN)
    try:
        c.predict(api_name="/start_session")
        print("session started", flush=True)
    except Exception as e:
        print(f"start_session: {e}", flush=True)

    print("image_to_3d (GPU ۱-۳ دقیقه) ...", flush=True)
    t0 = time.time()
    c.predict(
        handle_file(pp),
        0,      # seed
        "1024", # resolution
        7.5, 0.7, 12, 5.0,   # ss_*
        7.5, 0.5, 12, 3.0,   # shape_slat_*
        7.5, 0.0, 12, 3.0,   # tex_slat_*
        api_name="/image_to_3d",
    )
    print(f"  image_to_3d done {time.time()-t0:.0f}s", flush=True)

    print(f"extract_glb (decim={DECIM:.0f}, tex={TEX:.0f}) ...", flush=True)
    glb_path, _ = c.predict(DECIM, TEX, api_name="/extract_glb")
    print(f"  glb: {glb_path}", flush=True)
    os.makedirs(os.path.dirname(OUT), exist_ok=True)
    shutil.copy(glb_path, OUT)
    print(f"OK → {OUT} ({os.path.getsize(OUT)/1024:.0f} KB)", flush=True)
    return 0


if __name__ == "__main__":
    sys.exit(main())
