#!/usr/bin/env python3
# diag_band3d.py — رندر سه‌بعدی باند کابین: شیشه=آبی، باند-بدنه=قرمز، بقیه=خاکستری
import sys
import numpy as np
import trimesh
import scipy.spatial as spt
import matplotlib
matplotlib.use("Agg")
import matplotlib.pyplot as plt
from mpl_toolkits.mplot3d.art3d import Poly3DCollection

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

GLASS = (ny > 0.52) & (ny < 0.90) & (nz > 0.18) & (nz < 0.78) & (np.abs(fn[:, 1]) < 0.42)
tree = spt.cKDTree(fc)
_, nn = tree.query(fc, k=7)
for _ in range(2):
    gc = GLASS[nn].sum(axis=1); GLASS = GLASS & (gc >= 3)
gc = GLASS[nn].sum(axis=1); GLASS = GLASS | (gc >= 5)
gc = GLASS[nn].sum(axis=1); GLASS = GLASS | (gc >= 4)
gc = GLASS[nn].sum(axis=1); GLASS = GLASS & (gc >= 2)
# grab مانند r4
for _it in range(3):
    gv = GLASS[nn].sum(axis=1)
    add = (~GLASS) & (gv >= 3) & (np.abs(fn[:, 1]) < 0.90) & (ny > 0.52) & (ny < 0.90) & (nz > 0.18) & (nz < 0.78)
    if not add.any():
        break
    GLASS |= add

gv = GLASS[nn].sum(axis=1)
band = (~GLASS) & (gv >= 2) & (ny > 0.50) & (ny < 0.92) & (nz > 0.16) & (nz < 0.80)

sel = GLASS | band | (ny > 0.45)
fig = plt.figure(figsize=(16, 7), constrained_layout=True)
for vi, (elev, azim) in enumerate([(8, -90), (8, 90)]):
    ax = fig.add_subplot(1, 2, vi + 1, projection="3d")
    tris = Vm[F[sel]]
    cols = np.full((len(tris), 3), 0.82)
    cols[GLASS[sel]] = [0.25, 0.4, 0.85]
    cols[band[sel]] = [0.9, 0.15, 0.15]
    shade = 0.55 + 0.45 * np.clip(np.abs(fn[sel, 0]), 0, 1)
    cols = cols * shade[:, None]
    pc = Poly3DCollection(tris, facecolors=np.clip(cols, 0, 1), edgecolors="none")
    ax.add_collection3d(pc)
    ax.set_xlim3d(float(bmin[0]), float(bmax[0]))
    ax.set_ylim3d(float(bmin[1]), float(bmax[1]))
    ax.set_zlim3d(float(bmin[2]), float(bmax[2]))
    ax.set_box_aspect((float(bmax[0] - bmin[0]), float(bmax[1] - bmin[1]), float(bmax[2] - bmin[2])))
    ax.view_init(elev=elev, azim=azim)
    ax.set_axis_off()
    ax.set_title(f"{'left' if vi == 0 else 'right'}: blue=glass red=band-body", fontsize=9)
out = f"/home/z/my-project/scripts/diag_band_{KEY}.png"
plt.savefig(out, dpi=110)
print("saved", out)
