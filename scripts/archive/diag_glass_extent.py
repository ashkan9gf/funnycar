#!/usr/bin/env python3
# diag_glass_extent.py — کدام فیس‌ها «شیشه» هستند و کجا؟ رندر نرم‌افزاری COLOR_0 واقعی GLB
# usage: python3 scripts/diag_glass_extent.py <car> <outprefix>
import sys, json
import numpy as np
import trimesh
from pygltflib import GLTF2

car = sys.argv[1] if len(sys.argv) > 1 else "player"
prefix = sys.argv[2] if len(sys.argv) > 2 else f"diag_{car}"
GLB = f"/home/z/my-project/public/assets/models/vehicles/{car}.glb"

# --- load with pygltflib to get COLOR_0 + node transforms via trimesh ---
m = trimesh.load(GLB, process=False, force="scene")
meshes = []
for name, geom in m.geometry.items():
    g = geom.copy()
    T = m.graph.get(name)[0] if hasattr(m.graph, "get") else None
    if T is not None:
        g.apply_transform(T)
    meshes.append(g)

pos_all, col_all, fid_all, mid_all = [], [], [], []
voff = 0
for mi, g in enumerate(meshes):
    v = np.asarray(g.vertices, np.float32)
    f = np.asarray(g.faces, np.int64)
    c = None
    attr = g.visual.kind if hasattr(g.visual, "kind") else None
    try:
        if g.visual.kind == "vertex":
            c = np.asarray(g.visual.vertex_colors, np.float32)[:, :3] / 255.0
    except Exception:
        pass
    if c is None or len(c) != len(v):
        c = np.tile(np.array([[0.5, 0.5, 0.5]], np.float32), (len(v), 1))
    pos_all.append(v); col_all.append(c)
    fid_all.append(f + voff); mid_all.append(np.full(len(f), mi))
    voff += len(v)

V = np.vstack(pos_all); C = np.vstack(col_all); F = np.vstack(fid_all); MID = np.concatenate(mid_all)
print(f"verts={len(V)} faces={len(F)} meshes={len(meshes)}")

# normalize: x right, y forward, z up
P = V.copy()
lo, hi = P.min(0), P.max(0)
ext = hi - lo
print("bbox min", lo.round(3), "max", hi.round(3), "ext", ext.round(3))
Pn = (P - lo) / max(ext.max(), 1e-6)  # 0..1

# --- classify per vertex color (linear space) ---
def dist2(c, ref):
    return ((c - np.array(ref, np.float32)) ** 2).sum(-1)

# glass: dark blue-gray  linear(0.20,0.27,0.33) ~= (0.0331,0.0595,0.0884)
GLASS = (0.0331, 0.0595, 0.0884)
BODY_RED = (0.5700, 0.0110, 0.0126)
BLACK = (0.0, 0.0, 0.0)
WHITE = (1.0, 1.0, 1.0)

cls = np.full(len(V), 4, np.int8)  # 0 glass 1 body 2 dark 3 light 4 other
dg = dist2(C, GLASS)
cls[dg < 0.004] = 0
db = dist2(C, BODY_RED)
cls[(db < 0.02) & (cls != 0)] = 1
dk = dist2(C, BLACK)
cls[(dk < 0.002) & (cls != 0) & (cls != 1)] = 2
dw = dist2(C, WHITE)
cls[(dw < 0.01) & (cls != 0)] = 3

# per-face class = majority of 3 verts
fc = cls[F]
majority = np.zeros(len(F), np.int8)
for k in range(5):
    cnt = (fc == k).sum(1)
    mask = (cnt >= 2) & (majority == 4)
    majority[mask] = k
# leftover: first vert class
leftover = majority == 4
majority[leftover] = fc[leftover, 0]

names = ["GLASS", "BODY", "DARK", "LIGHT", "OTHER"]
for k in range(5):
    print(f"{names[k]:6s} faces={int((majority==k).sum()):6d} ({(majority==k).mean()*100:.1f}%)")

# --- glass spatial profile ---
gf = majority == 0
if gf.sum() > 0:
    z = Pn[F[gf]].reshape(-1, 3)
    print("GLASS nz range p05-p95:",
          np.percentile(z[:, 2], 5).round(3), np.percentile(z[:, 2], 95).round(3),
          "| ny p05-p95:", np.percentile(z[:, 1], 5).round(3), np.percentile(z[:, 1], 95).round(3))
    # distribution by height band
    for z0 in np.arange(0.4, 1.01, 0.05):
        band = (z[:, 2] >= z0 - 0.025) & (z[:, 2] < z0 + 0.025)
        if band.sum() > 30:
            print(f"  nz~{z0:.2f}: {int(band.sum()):5d} verts")

# --- render 4 views, flat color w/ lambert shading ---
import matplotlib
matplotlib.use("Agg")
import matplotlib.pyplot as plt
from mpl_toolkits.mplot3d.art3d import Poly3DCollection

FN = None
tris = P[F]  # (nf,3,3) in metric units
# face normals for shading
v1 = tris[:, 1] - tris[:, 0]; v2 = tris[:, 2] - tris[:, 0]
fn = np.cross(v1, v2)
nl = np.linalg.norm(fn, axis=1, keepdims=True); nl[nl == 0] = 1
fn = fn / nl

PAL = {0: (0.25, 0.42, 0.55), 1: (0.85, 0.12, 0.12), 2: (0.08, 0.08, 0.08),
       3: (0.92, 0.92, 0.92), 4: (0.55, 0.5, 0.45)}
# NOTE: for non-player cars BODY ref differs — recolor by dominant hue instead:
# we simply use per-face vertex color, boosted, so it works for all cars
fc_lin = C[F].mean(1)  # face color in linear
fc_srgb = np.where(fc_lin <= 0.0031308, fc_lin * 12.92, 1.055 * np.power(np.clip(fc_lin, 0, 1), 1 / 2.4) - 0.055)
lightdir = np.array([0.4, 0.5, 0.77]); lightdir /= np.linalg.norm(lightdir)
lamb = np.clip(fn @ lightdir, 0, 1) * 0.75 + 0.25
shaded = np.clip(fc_srgb * lamb[:, None] * 1.25, 0, 1)

views = [("3/4 front", -55, 22), ("side", -90, 8), ("3/4 rear", 135, 24), ("top", -90, 72)]
fig = plt.figure(figsize=(16, 12), facecolor="#202028")
for i, (title, az, el) in enumerate(views):
    ax = fig.add_subplot(2, 2, i + 1, projection="3d", facecolor="#202028")
    pc = Poly3DCollection(tris, facecolors=shaded, edgecolors="none")
    ax.add_collection3d(pc)
    ctr = (lo + hi) / 2; r = ext.max() * 0.62
    ax.set_xlim(ctr[0] - r, ctr[0] + r); ax.set_ylim(ctr[1] - r, ctr[1] + r); ax.set_zlim(ctr[2] - r * 0.7, ctr[2] + r * 1.0)
    ax.view_init(elev=el, azim=az)
    ax.set_axis_off(); ax.set_title(f"{car} {title}", color="w", fontsize=13)
    ax.set_box_aspect((1, 1, 0.85))
plt.tight_layout()
out = f"/home/z/my-project/scripts/{prefix}_soft.png"
plt.savefig(out, dpi=72, facecolor="#202028")
print("saved", out)
