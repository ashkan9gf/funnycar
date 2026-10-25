#!/usr/bin/env python3
"""فینال: fcol ذخیره‌شدهٔ تأییدشده → اطلس → GLB (تمام مراحل تست‌شده جداگانه).
Usage: python3 scripts/final_bake.py <name> [faces] [scale_to_len]
"""
import os, sys

import numpy as np
import trimesh
import xatlas
import pyfqmr
from PIL import Image
from pygltflib import GLTF2

NAME = sys.argv[1] if len(sys.argv) > 1 else "player"
TARGET_FACES = int(sys.argv[2]) if len(sys.argv) > 2 else 45000
GAME_LEN = float(sys.argv[3]) if len(sys.argv) > 3 else 172.0
SRC = f"/home/z/my-project/download/tripo/{NAME}_shape.glb"
OUT = f"/home/z/my-project/download/tripo/{NAME}.glb"
A = 1024

# ۱) مش
m = trimesh.load(SRC, force="mesh")
m.merge_vertices(merge_tex=True, merge_norm=True)
m.update_faces(m.nondegenerate_faces())
m.update_faces(m.unique_faces())
m.remove_unreferenced_vertices()
if len(m.faces) > TARGET_FACES:
    s = pyfqmr.Simplify()
    s.setMesh(m.vertices.astype(np.float32), m.faces.astype(np.uint32))
    s.simplify_mesh(target_count=TARGET_FACES, verbose=False)
    v, f, _ = s.getMesh()
    m = trimesh.Trimesh(np.asarray(v), np.asarray(f))
print(f"mesh: v={len(m.vertices)} f={len(m.faces)}", flush=True)

# ۲) UV
vmapping, ft, uv = xatlas.parametrize(m.vertices, m.faces)
print(f"uv: {uv.shape}", flush=True)

# ۳) fcol تأییدشده
fcol = np.load(f"/tmp/debug_fcol.npy")
assert len(fcol) == len(ft), f"fcol {len(fcol)} != faces {len(ft)}"
print(f"fcol mean: {fcol.mean(0).round(3)}", flush=True)

# ۴) رنگ رأس — بدون UV/تکسچر (ColorVisuals) — ضد هر مشکل flip/align
verts_atlas0 = m.vertices[vmapping]
fcol = np.load("/tmp/debug_fcol.npy")
assert len(fcol) == len(ft)
# رنگ هر رأس اطلس = میانگین رنگ فیس‌های متصل
vcol = np.zeros((len(verts_atlas0), 3), np.float32)
vcnt = np.zeros(len(verts_atlas0), np.float32)
for fi in range(len(ft)):
    for c in ft[fi]:
        vcol[c] += fcol[fi]
        vcnt[c] += 1
vcnt[vcnt == 0] = 1
vcol /= vcnt[:, None]
print(f"vertex colors: mean {vcol.mean(0).round(3)}", flush=True)

# ۵) GLB — چرخش ۱۸۰° Y + مقیاس بازی + پایه روی زمین + winding — تک‌export
verts_atlas = verts_atlas0 @ np.diag([-1.0, 1.0, -1.0]).astype(np.float32)
ext_z = verts_atlas[:, 2].max() - verts_atlas[:, 2].min()
scl = GAME_LEN / ext_z
verts_atlas = verts_atlas * scl
verts_atlas[:, 1] -= verts_atlas[:, 1].min()
mesh2 = trimesh.Trimesh(verts_atlas, ft, process=False)
_fc = mesh2.triangles.mean(axis=1)
_minc = mesh2.bounds.mean(axis=0)
_fn = mesh2.face_normals
_out = _fc - _minc
_flip = (_fn * _out).sum(axis=1) < 0
ft2 = ft.copy()
ft2[_flip] = ft2[_flip][:, [0, 2, 1]]
print(f"winding fixed: {int(_flip.sum())}/{len(ft2)}", flush=True)
mesh2 = trimesh.Trimesh(verts_atlas, ft2, process=False)
rgba = np.ones((len(verts_atlas), 4), np.float32)
rgba[:, :3] = vcol
mesh2.visual = trimesh.visual.ColorVisuals(mesh2, vertex_colors=rgba)
mesh2.export(OUT)
g = GLTF2().load(OUT)
for mat in g.materials:
    mat.pbrMetallicRoughness.baseColorFactor = [1.0, 1.0, 1.0, 1.0]
    mat.pbrMetallicRoughness.metallicFactor = 0.0
    mat.doubleSided = True
g.save(OUT)
print(f"OK → {OUT} ({os.path.getsize(OUT)//1024} KB) | len {ext_z*scl:.1f}", flush=True)
