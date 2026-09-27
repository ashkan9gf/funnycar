#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
process_batch1.py — پردازش تصاویر خام Batch 1 و ورود به پروژه
============================================================
(طبق Workflow بخش ۳۵ سند مادر: Background Removal → Resize → Compression → Naming → Import)

ورودی:  scripts/raw_assets/*.png   (خام AI، 768-1024px)
خروجی:  public/assets/...          (ابعاد نهایی طبق ASSET_INVENTORY_FA.md)

مراحل برای Spriteها (ماشین/پرتره):
  1) حذف پس‌زمینه: BFS از لبه‌ها روی پیکسل‌های نزدیک به رنگ نمونه‌گرفته از گوشه‌ها
  2) feather نرم لبه (بلور 1px روی ماسک آلفا)
  3) autocrop + قرارگیری در کانواس نهایی با حاشیه
  4) کوانتیز 256 رنگ (کاهش حجم — رنگ‌های فلت کارتونی بی‌افت)
مراحل برای کاشی‌ها: فقط resize به 512×512 (پس‌زمینه پر دارند)
"""

from __future__ import annotations

import os
from collections import deque

import numpy as np
from PIL import Image

RAW = os.path.join(os.path.dirname(os.path.abspath(__file__)), "raw_assets")
PUBLIC = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), "public", "assets")

# (نام خام، مسیر مقصد نسبت به public/assets، ابعاد نهایی، نوع)
JOBS = [
    ("veh_player_01.png",        "vehicles/player/veh_player_01.png",        (256, 448), "sprite"),
    ("char_driver_01_idle.png",  "characters/player/char_driver_01_idle.png",  (512, 512), "sprite"),
    ("char_driver_01_happy.png", "characters/player/char_driver_01_happy.png", (512, 512), "sprite"),
    ("char_driver_01_shock.png", "characters/player/char_driver_01_shock.png", (512, 512), "sprite"),
    ("env_road_straight_01.png", "environments/roads/env_road_straight_01.png", (512, 512), "tile"),
    ("env_road_cross_01.png",    "environments/roads/env_road_cross_01.png",    (512, 512), "tile"),
    ("env_sidewalk_01.png",      "environments/roads/env_sidewalk_01.png",      (512, 512), "tile"),
    ("env_ground_01.png",        "environments/roads/env_ground_01.png",        (512, 512), "tile"),
]

MARGIN_RATIO = 0.04  # حاشیه دور سوژه داخل کانواس نهایی


def corner_bg_color(arr: np.ndarray) -> np.ndarray:
    """رنگ پس‌زمینه = میانه پیکسل‌های 4 گوشه (نواحی 12×12)"""
    h, w = arr.shape[:2]
    k = 12
    patches = [
        arr[:k, :k, :3].reshape(-1, 3),
        arr[:k, -k:, :3].reshape(-1, 3),
        arr[-k:, :k, :3].reshape(-1, 3),
        arr[-k:, -k:, :3].reshape(-1, 3),
    ]
    return np.median(np.concatenate(patches, axis=0), axis=0)


def remove_background(img: Image.Image, tol: int = 46) -> Image.Image:
    """حذف پس‌زمینه با flood-fill از لبه‌ها + feather لبه"""
    rgba = img.convert("RGBA")
    arr = np.array(rgba)
    rgb = arr[..., :3].astype(np.int16)
    bg_col = corner_bg_color(arr)
    dist = np.sqrt(((rgb - bg_col.astype(np.int16)) ** 2).sum(axis=2))
    near_bg = dist < tol

    h, w = near_bg.shape
    bg = np.zeros((h, w), dtype=bool)
    dq: deque[tuple[int, int]] = deque()
    for x in range(w):
        for y in (0, h - 1):
            if near_bg[y, x] and not bg[y, x]:
                bg[y, x] = True
                dq.append((y, x))
    for y in range(h):
        for x in (0, w - 1):
            if near_bg[y, x] and not bg[y, x]:
                bg[y, x] = True
                dq.append((y, x))
    while dq:
        y, x = dq.popleft()
        if y > 0 and near_bg[y - 1, x] and not bg[y - 1, x]:
            bg[y - 1, x] = True; dq.append((y - 1, x))
        if y < h - 1 and near_bg[y + 1, x] and not bg[y + 1, x]:
            bg[y + 1, x] = True; dq.append((y + 1, x))
        if x > 0 and near_bg[y, x - 1] and not bg[y, x - 1]:
            bg[y, x - 1] = True; dq.append((y, x - 1))
        if x < w - 1 and near_bg[y, x + 1] and not bg[y, x + 1]:
            bg[y, x + 1] = True; dq.append((y, x + 1))

    # آلفا + feather
    alpha = np.where(bg, 0, 255).astype(np.uint8)
    a_img = Image.fromarray(alpha, mode="L").filter(__import__("PIL.ImageFilter", fromlist=["GaussianBlur"]).GaussianBlur(1.1))
    a = np.array(a_img)
    # سفت‌کردن مجدد: جاهای قطعاً شفاف 0، قطعاً مات 255
    a = np.where(alpha == 0, 0, a)
    a = np.where(alpha == 255, np.maximum(a, 200), a)
    arr[..., 3] = a
    return Image.fromarray(arr, mode="RGBA")


def autocrop(img: Image.Image) -> Image.Image:
    bbox = img.getchannel("A").getbbox()
    return img.crop(bbox) if bbox else img


def fit_into(img: Image.Image, size: tuple[int, int]) -> Image.Image:
    """قرار دادن در کانواس نهایی با حفظ نسبت + حاشیه"""
    tw, th = size
    mw, mh = int(tw * MARGIN_RATIO), int(th * MARGIN_RATIO)
    max_w, max_h = tw - 2 * mw, th - 2 * mh
    scale = min(max_w / img.width, max_h / img.height)
    new_w, new_h = max(1, round(img.width * scale)), max(1, round(img.height * scale))
    resized = img.resize((new_w, new_h), Image.LANCZOS)
    canvas = Image.new("RGBA", size, (0, 0, 0, 0))
    canvas.paste(resized, ((tw - new_w) // 2, (th - new_h) // 2), resized)
    return canvas


def quantize_save(img: Image.Image, path: str) -> None:
    """کوانتیز 256 رنگ برای کاهش حجم؛ اگر خطا کرد، RGBA معمولی"""
    os.makedirs(os.path.dirname(path), exist_ok=True)
    try:
        q = img.quantize(colors=256, method=Image.FASTOCTREE, dither=Image.Dither.NONE)
        q.save(path, optimize=True)
    except Exception:
        img.save(path, optimize=True)


def process_tile(img: Image.Image, size: tuple[int, int]) -> Image.Image:
    """کاشی: resize + کوانتیز 256 رنگ (حجم زیر سقف Inventory)"""
    rgb = img.convert("RGB").resize(size, Image.LANCZOS)
    # نرم‌کردن خیلی ملایم نویز قبل از کوانتیز (بدون از بین بردن بافت)
    rgb = rgb.filter(__import__("PIL.ImageFilter", fromlist=["GaussianBlur"]).GaussianBlur(0.6))
    return rgb.convert("P", palette=Image.Palette.ADAPTIVE, colors=256)


def main() -> None:
    print("پردازش Batch 1 →")
    ok = 0
    for raw_name, dest_rel, size, kind in JOBS:
        src = os.path.join(RAW, raw_name)
        dest = os.path.join(PUBLIC, dest_rel)
        if not os.path.exists(src):
            print(f"  ✗ {raw_name} پیدا نشد")
            continue
        img = Image.open(src)
        if kind == "sprite":
            cut = remove_background(img)
            cut = autocrop(cut)
            out = fit_into(cut, size)
            quantize_save(out, dest)
        else:
            out = process_tile(img, size)
            os.makedirs(os.path.dirname(dest), exist_ok=True)
            out.save(dest, optimize=True)
        kb = os.path.getsize(dest) / 1024
        print(f"  ✓ {dest_rel}  ({out.width}×{out.height}, {kb:.0f}KB)")
        ok += 1
    print(f"انجام شد: {ok}/{len(JOBS)}")


if __name__ == "__main__":
    main()
