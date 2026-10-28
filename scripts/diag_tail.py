#!/usr/bin/env python3
"""Diag: where are player's tail/head/plate faces? (find the torn bright-red stain source)"""
import sys
import numpy as np
import trimesh

KEY = sys.argv[1] if len(sys.argv) > 1 else "player"
RAW = f"/home/z/my-project/scripts/raw_assets/models/vehicles/{KEY}.glb"

m = trimesh.load(RAW, process=False)
if isinstance(m, trimesh.Scene):
    m = trimesh.util.concatenate([g for g in m.geometry.values()])
V = np.asarray(m.vertices, np.float64)
F = np.asarray(m.faces, np.int64)
# game space: front = -Z  →  mask space front = +Z (FLIP like recolor_v5)
Vm = V @ np.diag([-1.0, 1.0, -1.0])
fn = np.asarray(trimesh.Trimesh(Vm, F, process=False).face_normals)
fc = Vm[F].mean(axis=1)
bmin, bmax = Vm.min(0), Vm.max(0)
ext = np.maximum(bmax - bmin, 1e-6)
ny = (fc[:, 1] - bmin[1]) / ext[1]
nz = (fc[:, 2] - bmin[2]) / ext[2]
nx_abs = np.abs((fc[:, 0] - bmin[0]) / ext[0] - 0.5) * 2

# player cfg (from recolor_v5 overrides): tail_r=(0.10,0.34,0.50), tail_nx=0.55
tr0, ty0, ty1 = 0.10, 0.34, 0.50
TAIL = (nz < tr0) & (ny > ty0) & (ny < ty1) & (np.abs(fn[:, 2]) > 0.70) & (nx_abs > 0.55)
print(f"total faces={len(F)}  TAIL={int(TAIL.sum())}")
if TAIL.any():
    tfc = fc[TAIL]
    # cluster by x side and print bbox of each side
    for tag, sel in [("left(x<0)", tfc[:, 0] < 0), ("right(x>=0)", tfc[:, 0] >= 0)]:
        if sel.any():
            q = tfc[sel]
            qy = ny[TAIL][sel]; qz = nz[TAIL][sel]; qx = nx_abs[TAIL][sel]
            print(f"  {tag}: n={int(sel.sum())} ny[{qy.min():.2f},{qy.max():.2f}] "
                  f"nz[{qz.min():.2f},{qz.max():.2f}] nx[{qx.min():.2f},{qx.max():.2f}] "
                  f"y_mm[{q[:,1].min():.0f},{q[:,1].max():.0f}] z_mm[{q[:,2].min():.0f},{q[:,2].max():.0f}]")
# distribution of rear-facing faces at nx>0.55 to see scatter
REARF = (np.abs(fn[:, 2]) > 0.70) & (nz < 0.25) & (nx_abs > 0.55) & (ny > 0.25) & (ny < 0.70)
print(f"rear-facing scattered (nz<0.25, ny .25-.70, nx>.55): {int(REARF.sum())}")
for thr in [0.60, 0.70, 0.78, 0.85]:
    T2 = (nz < 0.10) & (ny > 0.34) & (ny < 0.50) & (np.abs(fn[:, 2]) > 0.70) & (nx_abs > thr)
    print(f"  tail with nx>{thr}: {int(T2.sum())}")
