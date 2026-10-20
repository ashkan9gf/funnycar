#!/usr/bin/env python3
"""Convert onPointerDown UI handlers to onClick in GameShell.tsx (scroll fix)."""
import re

path = "/home/z/my-project/src/components/game/GameShell.tsx"
src = open(path, encoding="utf-8").read()

total_before = src.count("onPointerDown")
# الگوی همه دکمه‌های UI: onPointerDown={(e) => { e.preventDefault(); BODY }}
# → onClick={() => { BODY }}  (مرورگر وقتی لمس به اسکرول تبدیل شود click نمی‌دهد)
pattern = re.compile(r"onPointerDown=\{\(e\) => \{\s*e\.preventDefault\(\);")
new_src, n = pattern.subn("onClick={() => {", src)

open(path, "w", encoding="utf-8").write(new_src)
print(f"before={total_before} replaced={n} after={new_src.count('onPointerDown')}")
