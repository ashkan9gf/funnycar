#!/usr/bin/env python3
"""پروبه GLB — ابعاد باکس هر مدل خودرو: اگر محور طول به جای Z روی Y باشد = مدل چپ شده!"""
import json, struct, sys, glob

for path in sorted(glob.glob('/home/z/my-project/public/assets/models/vehicles/*.glb')):
    with open(path, 'rb') as f:
        magic, ver, total = struct.unpack('<III', f.read(12))
        clen, ctype = struct.unpack('<II', f.read(8))
        js = json.loads(f.read(clen))
    mins = [None, None, None]; maxs = [None, None, None]
    for a in js.get('accessors', []):
        if a.get('type') == 'VEC3' and 'min' in a and 'max' in a and a.get('componentType') == 5126:
            for k in range(3):
                if mins[k] is None or a['min'][k] < mins[k]: mins[k] = a['min'][k]
                if maxs[k] is None or a['max'][k] > maxs[k]: maxs[k] = a['max'][k]
    if mins[0] is None:
        print(f"{path.split('/')[-1]:28s} — no POS accessor")
        continue
    dx, dy, dz = maxs[0]-mins[0], maxs[1]-mins[1], maxs[2]-mins[2]
    # توجه: ممکن است نود ریشه چرخش داشته باشد — آن را هم چک می‌کنیم
    nodes = js.get('nodes', [])
    root_rots = []
    for n in nodes[:4]:
        if 'rotation' in n: root_rots.append([round(x,3) for x in n['rotation']])
    longest = max('X','Y','Z', key=lambda ax: {'X':dx,'Y':dy,'Z':dz}[ax])
    flag = '  <<< احتمال چپ‌شدگی (طول روی Y)!' if longest == 'Y' and dy > 1.5*dz else ''
    print(f"{path.split('/')[-1]:28s} X={dx:7.2f} Y={dy:7.2f} Z={dz:7.2f}  longest={longest}{flag}  rootRot={root_rots}")
