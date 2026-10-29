#!/home/z/.venv/bin/python3
"""hunt_red.py — find which faces own the dark-red texels in the baked body texture."""
import numpy as np
import trimesh
from PIL import Image
from scipy import ndimage
import io, sys
from pygltflib import GLTF2

key = sys.argv[1] if len(sys.argv) > 1 else "player"
path = f"/home/z/my-project/public/assets/models/vehicles/{key}.glb"

# 1) extract texture
sc = trimesh.load(path, process=False)
body = sc.geometry["body"]
img = body.visual.image if hasattr(body.visual, "image") else None
if img is None:
    img = body.visual.material.baseColorTexture
ta = np.asarray(img.convert("RGB")).copy()
TH, TW = ta.shape[:2]
print(f"texture {TW}x{TH}")

# 2) dark-red mask (tail color 0.55,0.05,0.06 → sRGB ~ (196,60,64); body 0.70,0.085,0.10 → (222,60,66))
# both are dark red; distinguish from white (body texel) and black (tire/plastic) and blue (glass)
r, g, b = ta[:, :, 0].astype(int), ta[:, :, 1].astype(int), ta[:, :, 2].astype(int)
redm = (r > 90) & (g < 80) & (b < 80) & (r - g > 50)
print(f"red texels: {int(redm.sum())} ({redm.mean()*100:.1f}%)")
lab, n = ndimage.label(redm)
sizes = np.bincount(lab.ravel())[1:]
big = np.argsort(sizes)[::-1][:12]
print(f"red islands: {n}, top sizes: {sizes[big][:12]}")

# 3) faces whose UV centroid lands on red texels
F = np.asarray(body.faces)
UV = np.asarray(body.visual.uv)  # (v,2) in trimesh convention (v flipped)
# trimesh visual.uv: origin bottom-left? glTF origin top-left. The exporter stores native.
# We'll check both interpretations by matching.
def faces_at(u, v):
    px = np.clip(u, 0, 1) * (TW - 1)
    py = np.clip(v, 0, 1) * (TH - 1)
    return redm[py.astype(int), px.astype(int)]

fc_uv = UV[F].mean(axis=1)
hit_a = faces_at(fc_uv[:, 0], fc_uv[:, 1])
hit_b = faces_at(fc_uv[:, 0], 1.0 - fc_uv[:, 1])
hits = hit_a.sum() if hit_a.sum() > hit_b.sum() else hit_b
flip = hit_b.sum() > hit_a.sum()
print(f"faces on red texels: interpA={int(hit_a.sum())} interpB={int(hit_b.sum())} (flip={flip})")

V = np.asarray(body.vertices)
fcent = V[F].mean(axis=1)
bmin, bmax = V.min(0), V.max(0)
ext = np.maximum(bmax - bmin, 1e-6)
sel = hit_b if flip else hit_a
idx = np.where(sel)[0]
nz = (fcent[:, 2] - bmin[2]) / ext[2]
ny = (fcent[:, 1] - bmin[1]) / ext[1]
nx = (fcent[:, 0] - bmin[0]) / ext[0]
print(f"red-face position stats: nz p10/50/90 = {np.percentile(nz[idx],[10,50,90]).round(2)} "
      f"ny p10/50/90 = {np.percentile(ny[idx],[10,50,90]).round(2)} "
      f"nx p10/50/90 = {np.percentile(np.abs(nx[idx]-0.5)*2,[10,50,90]).round(2)}")
print(f"red-face y abs: {np.percentile(fcent[idx,1],[10,50,90]).round(1)} z abs: {np.percentile(fcent[idx,2],[10,50,90]).round(1)}")
# distance to nearest wheel center (wheel parts)
for wname in ["wheel_0", "wheel_1", "wheel_2", "wheel_3"]:
    wg = sc.geometry[wname]
    wv = np.asarray(wg.vertices)
    wmin, wmax = wv.min(0), wv.max(0)
    dia = wmax[1] - wmin[1]
    cy, cz = 0.5 * (wmin[1] + wmax[1]), 0.5 * (wmin[2] + wmax[2])
    cx = float(np.median(wv[:, 0]))
    rho = np.sqrt((fcent[idx, 1] - cy) ** 2 + (fcent[idx, 2] - cz) ** 2)
    print(f"  vs {wname}: rho/dia p10/50/90 = {(np.percentile(rho,[10,50,90])/dia).round(2)} "
          f"within0.66dia={int((rho<=0.66*dia).sum())}/{len(idx)}")
