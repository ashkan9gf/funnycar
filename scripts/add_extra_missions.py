#!/usr/bin/env python3
"""Add my 14 missions (t03-t08, c04-c11 from c812fa5) to current missions.ts with renamed ids."""
import re, subprocess

# از کامیت c812fa5 نسخه مال من رو بگیر
old = subprocess.run(
    ["git", "show", "c812fa5:src/game/data/missions.ts"],
    capture_output=True, text=True, check=True,
).stdout

# بلاک‌های مأموریت‌های من رو جدا کن
my_ids = ["t03_taxi_terminal", "t04_taxi_doctor", "t05_taxi_engineer", "t06_taxi_student",
          "t07_taxi_bride", "t08_taxi_grandma",
          "c04_rush_hour", "c05_coin_hunt_12", "c06_north_south_flawless",
          "c07_five_checkpoints", "c08_pothole_strict", "c09_one_hit_wonder",
          "c10_coin_master", "c11_east_loop"]

blocks = []
for mid in my_ids:
    m = re.search(r"\n  \{\n    id: '" + mid + r"',.*?\n  \},\n", old, re.DOTALL)
    assert m, f"block not found: {mid}"
    blocks.append(m.group(0).rstrip("\n"))

# تغییر شناسه‌ها (t03→t09 ... c11→c19)
rename = {"t03": "t09", "t04": "t10", "t05": "t11", "t06": "t12", "t07": "t13", "t08": "t14",
          "c04": "c12", "c05": "c13", "c06": "c14", "c07": "c15", "c08": "c16",
          "c09": "c17", "c10": "c18", "c11": "c19"}
renamed_blocks = []
for b in blocks:
    for old_p, new_p in rename.items():
        b = re.sub(r"id: '" + old_p + r"_", f"id: '{new_p}_", b)
    renamed_blocks.append(b)

path = "src/game/data/missions.ts"
cur = open(path, encoding="utf-8").read()

# درج پیش از پایان MISSION_LIST
anchor = "\n];"
idx = cur.rfind(anchor)
assert idx > 0, "MISSION_LIST end not found"
insert = "\n  // ================= مأموریت‌های تکمیلی (v0.2.39) =================\n" + "\n".join(renamed_blocks) + "\n"
cur = cur[:idx] + insert + cur[idx:]

open(path, "w", encoding="utf-8").write(cur)
count = len(re.findall(r"    id: '", cur))
print(f"added={len(renamed_blocks)} total_missions={count}")
