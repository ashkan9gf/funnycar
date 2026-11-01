#!/usr/bin/env python3
"""دیباگ ماسک‌ها روی مش یک خودرو — توزیع ny/nz هر ناحیه را چاپ می‌کند."""
import sys

import numpy as np
import trimesh

KEY = sys.argv[1] if len(sys.argv) > 1 else "samand"
path = f"/home/z/my-project/download/tripo/{KEY}.glb"
m = trimesh.load(path, force="mesh")
V = np.asarray(m.vertices, np.float32)
F = np.asarray(m.faces)
meshA = trimesh.Trimesh(V, F, process=False)
fn = meshA.face_normals
fc = V[F].mean(axis=1)
bmin, bmax = V.min(0), V.max(0)
ext = np.maximum(bmax - bmin, 1e-6)
ny = (fc[:, 1] - bmin[1]) / ext[1]
nz = (fc[:, 2] - bmin[2]) / ext[2]
print(f"v={len(V)} f={len(F)} | bbox ext={ext.round(1)}")
print(f"hood check: faces fn.y>0.85: {(fn[:,1]>0.85).sum()} | their ny median: {np.median(ny[fn[:,1]>0.85]):.3f}")
# شبیه‌سازی ماسک شیشه سمند
gny0, gny1 = 0.52, 0.90
gnz0, gnz1 = 0.18, 0.84
GLASS = (ny > gny0) & (ny < gny1) & (nz > gnz0) & (nz < gnz1) & (np.abs(fn[:, 1]) < 0.55)
print(f"GLASS faces: {GLASS.sum()} ({GLASS.mean():.1%})")
if GLASS.sum():
    print("glass ny hist:", np.histogram(ny[GLASS], bins=8, range=(0, 1))[0])
    print("glass fn.y med:", np.median(np.abs(fn[GLASS][:, 1])).round(2))
    print("glass fn.y>0.3 frac:", (np.abs(fn[GLASS][:, 1]) > 0.3).mean().round(2))
# چقدر از فیس‌های رو به بالا (سقف/کاپوت) داخل ماسک‌اند؟
up = fn[:, 1] > 0.7
print(f"upward faces caught by GLASS: {(GLASS & up).sum()} / {up.sum()}")
