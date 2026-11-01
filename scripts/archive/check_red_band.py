#!/usr/bin/env python3
# check_red_band.py — فیس‌های تینت‌بدنه (قرمز) داخل باند شیشه در GLB نهایی را پیدا می‌کند
import struct
import sys

import numpy as np
import trimesh

KEY = sys.argv[1] if len(sys.argv) > 1 else "player"
PATH = f"public/assets/models/vehicles/{KEY}.glb"

sc = trimesh.load(PATH, force="scene")
FLIP = np.diag([-1.0, 1.0, -1.0])
for name, geom in sc.geometry.items():
    V = np.asarray(geom.vertices, np.float64)
    F = np.asarray(geom.faces, np.int64)
    Vm = V @ FLIP
    mesh = trimesh.Trimesh(Vm, F, process=False)
    fn = np.asarray(mesh.face_normals)
    fc = Vm[F].mean(axis=1)
    bmin, bmax = Vm.min(0), Vm.max(0)
    ext = np.maximum(bmax - bmin, 1e-6)
    ny = (fc[:, 1] - bmin[1]) / ext[1]
    nz = (fc[:, 2] - bmin[2]) / ext[2]
    # COLOR_0
    color0 = None
    try:
        attr = geom.visual.to_color().vertex_colors
        color0 = np.asarray(attr, np.float64) / 255.0
    except Exception:
        pass
    if color0 is None:
        print(f"[{name}] no COLOR_0")
        continue
    # تینت بدنه = α≈1 و رنگ قرمز (G پایین) — غیربدنه α=0.99 سفید
    is_bodytint = (color0[F].mean(axis=1)[:, 3] >= 0.994) & (color0[F].mean(axis=1)[:, 1] < 0.45)
    band = (ny > 0.50) & (ny < 0.92) & (nz > 0.16) & (nz < 0.80)
    red_band = is_bodytint & band & (np.abs(fn[:, 1]) < 0.97)
    print(f"[{name}] v={len(V)} f={len(F)} bodytint={int(is_bodytint.sum())} red-in-band={int(red_band.sum())}")
    if red_band.sum():
        a = np.abs(fn[red_band, 1])
        print(f"  |fn_y|: p10={np.percentile(a,10):.2f} p50={np.percentile(a,50):.2f} p90={np.percentile(a,90):.2f} max={a.max():.2f}")
        print(f"  ny: p05={np.percentile(ny[red_band],5):.2f} p50={np.percentile(ny[red_band],50):.2f} p95={np.percentile(ny[red_band],95):.2f}")
        print(f"  nz: p05={np.percentile(nz[red_band],5):.2f} p50={np.percentile(nz[red_band],50):.2f} p95={np.percentile(nz[red_band],95):.2f}")
        # توزیع |fn_y| در باکت‌ها
        hist, edges = np.histogram(a, bins=[0, 0.2, 0.4, 0.6, 0.8, 0.9, 0.95, 1.01])
        print("  |fn_y| hist:", dict(zip([f"{edges[i]:.2f}-{edges[i+1]:.2f}" for i in range(len(hist))], hist.tolist())))
        # چند نمونهٔ موقعیت
        idx = np.where(red_band)[0]
        for i in idx[:: max(1, len(idx) // 5)][:6]:
            print(f"  sample f{i}: ny={ny[i]:.2f} nz={nz[i]:.2f} |fn_y|={abs(fn[i,1]):.2f}")
