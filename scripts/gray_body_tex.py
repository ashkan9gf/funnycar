#!/usr/bin/env python3
"""t0 (Body_Shd baseColor) — سبز بدنه → خاکستری روشن (تینت‌پذیر)"""
from PIL import Image
import colorsys

src = Image.open('/home/z/my-project/upload/challenger/tex/t0.png').convert('RGB')
w, h = src.size
px = src.load()
out = Image.new('RGB', (w, h))
po = out.load()

changed = 0
for y in range(h):
    for x in range(w):
        r, g, b = px[x, y]
        hh, ss, vv = colorsys.rgb_to_hsv(r / 255, g / 255, b / 255)
        hue_deg = hh * 360
        # سبز: hue 70..190 با اشباع کافی
        if 70 <= hue_deg <= 190 and ss > 0.28 and vv > 0.15:
            # value را حفظ کن (سایه/AO بماند)، اشباع تقریباً صفر، کمی روشن‌تر برای تینت
            nv = min(1.0, vv * 1.06 + 0.10)
            nr, ng, nb = colorsys.hsv_to_rgb(0.0, 0.025, nv)
            po[x, y] = (int(nr * 255), int(ng * 255), int(nb * 255))
            changed += 1
        elif g > r * 1.14 and g > b * 1.14:
            # پاس دوم: سبز تیره/کم‌اشباع باقی‌مانده
            nv = min(1.0, vv * 1.02 + 0.08)
            nr, ng, nb = colorsys.hsv_to_rgb(0.0, 0.02, nv)
            po[x, y] = (int(nr * 255), int(ng * 255), int(nb * 255))
            changed += 1
        else:
            po[x, y] = (r, g, b)

out.save('/home/z/my-project/upload/challenger/tex/t0_gray.png')
print('changed px:', changed, '/', w * h, f'({100*changed/(w*h):.1f}%)')
