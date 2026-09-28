#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
process_batch2.py — پردازش تصاویر خام Batch 2 و ورود به پروژه
============================================================
(همان Workflow فاز 1: Background Removal → Resize → Compression → Import)

نکته مهم فاز 2 — جهت اسپرایت خودروها:
  تصاویر AI «جلوِ ماشین» را در پایین تصویر می‌کشند، ولی در بازی angle=0 یعنی
  رو به بالا (شمال). پس همه اسپرایت خودروها 180 درجه می‌چرخند تا جلو = بالا.
  اسپرایت بازیکن فاز 1 هم که اشتباه وارد شده بود، درجا چرخش می‌شود.

ساختمان‌ها (ENV-005..008): بدون چرخش — ورودی از پایین کادر دیده می‌شود و در
بازی هم بدون دوران رسم می‌شوند.

ورودی:  scripts/raw_assets/*.png
خروجی:  public/assets/...   (ابعاد نهایی طبق ASSET_INVENTORY_FA.md)
"""

from __future__ import annotations

import os
import sys

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from process_batch1 import (  # noqa: E402
    PUBLIC,
    RAW,
    autocrop,
    fit_into,
    quantize_save,
    remove_background,
)

from PIL import Image  # noqa: E402

# (نام خام، مسیر مقصد نسبت به public/assets، ابعاد نهایی، نوع)
# kind: sprite = حذف پس‌زمینه + autocrop
#       sprite_rot180 = مثل sprite + چرخش 180 (جهت جلو = بالا)
JOBS = [
    ("veh_taxi_01.png",          "vehicles/traffic/veh_taxi_01.png",              (256, 448), "sprite_rot180"),
    ("veh_police_01.png",        "npc/vehicles/veh_police_01.png",                (256, 448), "sprite_rot180"),
    ("veh_pickup_01.png",        "vehicles/traffic/veh_pickup_01.png",            (256, 448), "sprite_rot180"),
    ("veh_sedan_01.png",         "vehicles/traffic/veh_sedan_01.png",             (256, 448), "sprite_rot180"),
    ("env_building_shop_01.png", "environments/buildings/env_building_shop_01.png", (512, 640), "sprite"),
    ("env_building_home_01.png", "environments/buildings/env_building_home_01.png", (512, 640), "sprite"),
    ("env_building_garage_01.png", "environments/buildings/env_building_garage_01.png", (512, 640), "sprite"),
    ("env_gas_station_01.png",   "environments/landmarks/env_gas_station_01.png",  (640, 640), "sprite"),
]


def fix_player_orientation() -> None:
    """چرخش 180 درجه اسپرایت بازیکن فاز 1 (جهت جلو در آن تصویر پایین بود)."""
    p = os.path.join(PUBLIC, "vehicles", "player", "veh_player_01.png")
    if not os.path.exists(p):
        print("  ✗ اسپرایت بازیکن پیدا نشد")
        return
    img = Image.open(p).convert("RGBA")
    out = img.rotate(180)
    quantize_save(out, p)
    kb = os.path.getsize(p) / 1024
    print(f"  ✓ veh_player_01.png چرخش 180 شد  ({out.width}×{out.height}, {kb:.0f}KB)")


def main() -> None:
    print("اصلاح جهت اسپرایت بازیکن فاز 1 →")
    fix_player_orientation()

    print("پردازش Batch 2 →")
    ok = 0
    for raw_name, dest_rel, size, kind in JOBS:
        src = os.path.join(RAW, raw_name)
        dest = os.path.join(PUBLIC, dest_rel)
        if not os.path.exists(src):
            print(f"  ✗ {raw_name} پیدا نشد")
            continue
        img = Image.open(src)
        cut = remove_background(img)
        cut = autocrop(cut)
        if kind == "sprite_rot180":
            cut = cut.rotate(180)
        out = fit_into(cut, size)
        quantize_save(out, dest)
        kb = os.path.getsize(dest) / 1024
        print(f"  ✓ {dest_rel}  ({out.width}×{out.height}, {kb:.0f}KB)")
        ok += 1
    print(f"انجام شد: {ok}/{len(JOBS)}")


if __name__ == "__main__":
    main()
