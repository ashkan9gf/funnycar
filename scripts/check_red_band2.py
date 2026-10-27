#!/usr/bin/env python3
# check_red_band2.py — فیس‌های قرمزِ قابل‌دیدن داخل باند شیشه؛ نرمالایز با باکس کل خودرو + نمونه‌گیری تکسچر
import sys

import numpy as np
import trimesh

KEY = sys.argv[1] if len(sys.argv) > 1 else "player"
PATH = f"public/assets/models/vehicles/{KEY}.glb"

sc = trimesh.load(PATH, force="scene")
FLIP = np.diag([-1.0, 1.0, -1.0])

# باکس global از همهٔ جئومتری‌ها (مثل ماسک: کل خودرو شامل چرخ)
allV = np.vstack([np.asarray(g.vertices, np.float64) for g in sc.geometry.values()])
Gbmin, Gbmax = (allV @ FLIP).min(0), (allV @ FLIP).max(0)
Gext = np.maximum(Gbmax - Gbmin, 1e-6)

for name, geom in sc.geometry.items():
    V = np.asarray(geom.vertices, np.float64)
    F = np.asarray(geom.faces, np.int64)
    Vm = V @ FLIP
    mesh = trimesh.Trimesh(Vm, F, process=False)
    fn = np.asarray(mesh.face_normals)
    fc = Vm[F].mean(axis=1)
    ny = (fc[:, 1] - Gbmin[1]) / Gext[1]
    nz = (fc[:, 2] - Gbmin[2]) / Gext[2]
    color0 = None
    try:
        color0 = np.asarray(geom.visual.to_color().vertex_colors, np.float64) / 255.0
    except Exception:
        pass
    if color0 is None:
        print(f"[{name}] no COLOR_0")
        continue
    cface = color0[F].mean(axis=1)
    is_bodytint = (cface[:, 3] >= 0.994) & (cface[:, 1] < 0.45)
    band = (ny > 0.50) & (ny < 0.92) & (nz > 0.16) & (nz < 0.80)
    red_band = is_bodytint & band & (np.abs(fn[:, 1]) < 0.97)
    # نمونه‌گیری تکسچر در مرکز UV هر فیس
    texbright = np.zeros(len(F))
    try:
        tv = geom.visual
        if hasattr(tv, "uv") and tv.uv is not None and tv.image is not None:
            uv = np.asarray(tv.uv, np.float64)
            img = np.asarray(tv.image.convert("RGB"), np.float64) / 255.0
            H, W = img.shape[:2]
            fuv = uv[F].mean(axis=1)
            px = np.clip((fuv[:, 0] % 1.0) * W, 0, W - 1).astype(int)
            py = np.clip((1.0 - (fuv[:, 1] % 1.0)) * H, 0, H - 1).astype(int)
            texbright = img[py, px].mean(axis=1)
    except Exception as e:
        print("tex sample fail:", e)
    visible = red_band & (texbright > 0.5)
    print(f"[{name}] f={len(F)} bodytint={int(is_bodytint.sum())} red-in-band={int(red_band.sum())} visible-red(bright tex)={int(visible.sum())}")
    if visible.sum():
        a = np.abs(fn[visible, 1])
        hist, edges = np.histogram(a, bins=[0, 0.2, 0.4, 0.6, 0.8, 0.9, 0.95, 1.01])
        print("  |fn_y| hist:", dict(zip([f"{edges[i]:.2f}-{edges[i+1]:.2f}" for i in range(len(hist))], hist.tolist())))
        print(f"  ny: p05={np.percentile(ny[visible],5):.2f} p50={np.percentile(ny[visible],50):.2f} p95={np.percentile(ny[visible],95):.2f}")
        print(f"  nz: p05={np.percentile(nz[visible],5):.2f} p50={np.percentile(nz[visible],50):.2f} p95={np.percentile(nz[visible],95):.2f}")
