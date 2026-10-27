#!/usr/bin/env python3
# diag_glass.py — توزیع ویژگی فیس‌های بدنه‌رنگِ داخل باند شیشه (چرا شیشه نمی‌گیردشان؟)
import sys
import numpy as np
import trimesh
import scipy.spatial as spt

KEY = sys.argv[1] if len(sys.argv) > 1 else "player"
IN = f"/home/z/my-project/scripts/raw_assets/models/vehicles/{KEY}.glb"
FLIP = np.diag([-1.0, 1.0, -1.0]).astype(np.float64)

sc = trimesh.load(IN, force="scene")
Vs, Fs = [], []
off = 0
for g in sc.geometry.values():
    v = np.asarray(g.vertices, np.float64)
    f = np.asarray(g.faces, np.int64)
    Vs.append(v); Fs.append(f + off); off += len(v)
V = np.concatenate(Vs, 0); F = np.concatenate(Fs, 0)
Vm = V @ FLIP
mesh = trimesh.Trimesh(Vm, F, process=False)
fn = np.asarray(mesh.face_normals)
fc = Vm[F].mean(axis=1)
bmin, bmax = Vm.min(0), Vm.max(0)
ext = np.maximum(bmax - bmin, 1e-6)
ny = (fc[:, 1] - bmin[1]) / ext[1]
nz = (fc[:, 2] - bmin[2]) / ext[2]
nx_abs = np.abs((fc[:, 0] - bmin[0]) / ext[0] - 0.5) * 2

# ماسک شیشهٔ فعلی پراید (r2)
GLASS = (ny > 0.52) & (ny < 0.90) & (nz > 0.18) & (nz < 0.78) & (np.abs(fn[:, 1]) < 0.42)
tree = spt.cKDTree(fc)
_, nn = tree.query(fc, k=7)
for _ in range(2):
    gc = GLASS[nn].sum(axis=1); GLASS = GLASS & (gc >= 3)
gc = GLASS[nn].sum(axis=1); GLASS = GLASS | (gc >= 5)
gc = GLASS[nn].sum(axis=1); GLASS = GLASS | (gc >= 4)
gc = GLASS[nn].sum(axis=1); GLASS = GLASS & (gc >= 2)

# باند شیشه: فیس‌های غیرشیشه‌ای که در ۷همسایگی‌شان ≥۳ شیشه دارید و در باند کابین‌اند
gc = GLASS[nn].sum(axis=1)
band = (~GLASS) & (gc >= 3) & (ny > 0.44) & (ny < 0.95)
print(f"glass={GLASS.sum()}  band-body={band.sum()}")
if band.sum():
    a = np.abs(fn[band, 1])
    print(f"band |fn_y|: p50={np.percentile(a,50):.2f} p75={np.percentile(a,75):.2f} p90={np.percentile(a,90):.2f} max={a.max():.2f}")
    print(f"band ny   : p05={np.percentile(ny[band],5):.2f} p50={np.percentile(ny[band],50):.2f} p95={np.percentile(ny[band],95):.2f}")
    print(f"band nz   : p05={np.percentile(nz[band],5):.2f} p50={np.percentile(nz[band],50):.2f} p95={np.percentile(nz[band],95):.2f}")
    print(f"band fn_z : p05={np.percentile(fn[band,2],5):.2f} p50={np.percentile(fn[band,2],50):.2f} p95={np.percentile(fn[band,2],95):.2f}")
    # چه نسبتشان با |fn_y|<0.42 رد شدند؟
    print(f"band with |fn_y|>=0.42: {(a >= 0.42).mean():.2f}   >=0.55: {(a >= 0.55).mean():.2f}")
    # آیا داخل باکس ny/nz هستند ولی fn_y ردشان کرده؟
    inbox = (ny > 0.52) & (ny < 0.90) & (nz > 0.18) & (nz < 0.78)
    print(f"band inside ny/nz box: {(inbox & band).sum()}/{band.sum()}  (fn_y rejected: {(inbox & band & (np.abs(fn[:,1]) >= 0.42)).sum()})")
