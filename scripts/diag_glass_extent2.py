#!/usr/bin/env python3
# diag_glass_extent2.py — رنگ واقعی هر فیس = نمونه‌برداری تکسچر بافت‌شده در UV
# usage: python3 scripts/diag_glass_extent2.py <car> <outprefix>
import sys
import numpy as np
import trimesh
from PIL import Image

car = sys.argv[1] if len(sys.argv) > 1 else "player"
prefix = sys.argv[2] if len(sys.argv) > 2 else f"diag_{car}"
GLB = f"/home/z/my-project/public/assets/models/vehicles/{car}.glb"

m = trimesh.load(GLB, process=False, force="scene")

tris_all, col_all, uvz_all = [], [], []
for name, geom in m.geometry.items():
    g = geom.copy()
    try:
        T = m.graph.get(name)[0]
        if T is not None:
            g.apply_transform(T)
    except Exception:
        pass
    f = np.asarray(g.faces, np.int64)
    if len(f) == 0:
        continue
    v = np.asarray(g.vertices, np.float32)
    tri = v[f]

    fc = None
    if g.visual.kind == "texture" and g.visual.uv is not None:
        mat = g.visual.material
        img = None
        try:
            img = np.asarray(mat.baseColorTexture, np.float32)[..., :3]
        except Exception:
            img = None
        if img is not None:
            uv = np.asarray(g.visual.uv, np.float32)
            H, W = img.shape[:2]
            # per-face mean uv -> sample (bilinear not needed; nearest with small avg)
            fuv = uv[f].mean(1)  # (nf,2) in 0..1, v flipped?
            xs = np.clip((fuv[:, 0] * (W - 1)).round().astype(int), 0, W - 1)
            ys = np.clip(((1.0 - fuv[:, 1]) * (H - 1)).round().astype(int), 0, H - 1)
            fc = img[ys, xs] / 255.0
    if fc is None and g.visual.kind == "vertex":
        fc = np.asarray(g.visual.vertex_colors, np.float32)[:, :3] / 255.0
        fc = fc[f].mean(1)
    if fc is None:
        fc = np.full((len(f), 3), 0.6)
    tris_all.append(tri); col_all.append(fc)
    # normalized height within this mesh (we fix globally later)
    uvz_all.append(np.zeros(len(f)))

P3 = np.vstack(tris_all); FC = np.vstack(col_all)
lo, hi = P3.reshape(-1, 3).min(0), P3.reshape(-1, 3).max(0)
ext = hi - lo
print(f"faces={len(P3)} bbox ext={ext.round(1)}")
print("face color stats: mean", FC.mean(0).round(3), "min", FC.min(0).round(3), "max", FC.max(0).round(3))

# unique-ish color histogram to find class palette
q = (FC * 24).astype(int)
key = q[:, 0] * 625 + q[:, 1] * 25 + q[:, 2]
uk, uc = np.unique(key, return_counts=True)
order = np.argsort(-uc)[:12]
print("top colors (srgb, count):")
for oi in order:
    k = uk[oi]; r, gg, b = k // 625, (k // 25) % 25, k % 25
    print(f"  ({r/24:.2f},{gg/24:.2f},{b/24:.2f})  n={uc[oi]} ({uc[oi]/len(FC)*100:.1f}%)")

# --- render 4 views with real colors ---
import matplotlib
matplotlib.use("Agg")
import matplotlib.pyplot as plt
from mpl_toolkits.mplot3d.art3d import Poly3DCollection

v1 = P3[:, 1] - P3[:, 0]; v2 = P3[:, 2] - P3[:, 0]
fn = np.cross(v1, v2)
nl = np.linalg.norm(fn, axis=1, keepdims=True); nl[nl == 0] = 1
fn = fn / nl
lightdir = np.array([0.4, 0.5, 0.77]); lightdir /= np.linalg.norm(lightdir)
lamb = np.clip(np.abs(fn @ lightdir), 0, 1) * 0.7 + 0.3
shaded = np.clip(FC * lamb[:, None] * 1.3, 0, 1)

# adaptive axes: up = argmin(ext) (length > width > height for cars)
# 🔑 v0.2.64 — بعد از canonicalize شدن محورها در recolor (v0.2.63)، همهٔ GLBهای
# بافته‌شده طول را روی Z دارند؛ حدس adaptive برای خودروهای جعبه‌ای بلند (رنو۴:
# ارتفاع > عرض) محور بالا را اشتباه می‌گرفت و رندر وارونه می‌شد → محور کانونی ثابت
upax = 1
lnax = 2
wtax = 0
P3d = P3[:, :, [lnax, wtax, upax]]  # display: x=length, y=width, z=up
ctr = (lo + hi) / 2; r = ext.max() * 0.58
ctrd = ctr[[lnax, wtax, upax]]
views = [("3/4 front", -55, 18), ("side", -90, 6), ("3/4 rear", 135, 20), ("top", -90, 70)]
fig = plt.figure(figsize=(16, 12), facecolor="#18181e")
for i, (title, az, el) in enumerate(views):
    ax = fig.add_subplot(2, 2, i + 1, projection="3d", facecolor="#18181e")
    pc = Poly3DCollection(P3d, facecolors=shaded, edgecolors="none")
    ax.add_collection3d(pc)
    ax.set_xlim(ctrd[0] - r, ctrd[0] + r); ax.set_ylim(ctrd[1] - r, ctrd[1] + r); ax.set_zlim(ctr[upax] - r * 0.55, ctr[upax] + r * 0.75)
    ax.view_init(elev=el, azim=az)
    ax.set_axis_off(); ax.set_title(f"{car} {title}", color="w", fontsize=13)
    ax.set_box_aspect((1, 1, 0.7))
plt.tight_layout()
out = f"/home/z/my-project/scripts/{prefix}_soft.png"
plt.savefig(out, dpi=72, facecolor="#18181e")
print("saved", out)
