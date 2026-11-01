#!/usr/bin/env python3
# diag_glass3.py <key> — تحلیل عددی رنگ‌های COLOR_0 داخل باند شیشه در GLB نهایی (مستقیم از accessor)
import sys
import numpy as np
import trimesh
from pygltflib import GLTF2

KEY = sys.argv[1] if len(sys.argv) > 1 else "pride"
PATH = f"public/assets/models/vehicles/{KEY}.glb"
FLIP = np.diag([-1.0, 1.0, -1.0])

gltf = GLTF2().load(PATH)
bin_blob = gltf.binary_blob() if callable(gltf.binary_blob) else gltf.binary_blob

def acc_array(idx):
    a = gltf.accessors[idx]
    bv = gltf.bufferViews[a.bufferView]
    off = (bv.byteOffset or 0) + (a.byteOffset or 0)
    comp = {5126: 'f4', 5121: 'u1', 5123: 'u2', 5125: 'u4'}[a.componentType]
    ncomp = {'SCALAR': 1, 'VEC2': 2, 'VEC3': 3, 'VEC4': 4}[a.type]
    arr = np.frombuffer(bin_blob, dtype=np.dtype(comp), count=a.count * ncomp, offset=off)
    return arr.reshape(a.count, ncomp)

# هر primitive → positions + color0
Vs, Fs, Cs = [], [], []
off_v = 0
for mi, mesh in enumerate(gltf.meshes):
    for prim in mesh.primitives:
        pos = acc_array(prim.attributes.POSITION).astype(np.float64)
        c0 = acc_array(prim.attributes.COLOR_0).astype(np.float64)
        if c0.max() > 1.5:  # uint8
            c0 = c0 / 255.0
        if c0.shape[1] == 3:
            c0 = np.hstack([c0, np.ones((len(c0), 1))])
        idx = np.asarray(gltf.accessors[prim.indices]._data if hasattr(gltf.accessors[prim.indices], '_data') else acc_array(prim.indices), np.int64).ravel()
        Vs.append(pos)
        Fs.append(idx + off_v)
        Cs.append(c0)
        off_v += len(pos)
V = np.concatenate(Vs, 0)
F = np.concatenate(Fs, 0).reshape(-1, 3)
C = np.concatenate(Cs, 0)

Vm = V @ FLIP
mesh = trimesh.Trimesh(Vm, F, process=False)
fn = np.asarray(mesh.face_normals)
fc = Vm[F].mean(axis=1)
bmin, bmax = Vm.min(0), Vm.max(0)
ext = np.maximum(bmax - bmin, 1e-6)
ny = (fc[:, 1] - bmin[1]) / ext[1]
nz = (fc[:, 2] - bmin[2]) / ext[2]
nx_abs = np.abs((fc[:, 0] - bmin[0]) / ext[0] - 0.5) * 2

fcol = C[F].mean(axis=1)  # (F,4) RGBA
R, G, B, A = fcol[:, 0], fcol[:, 1], fcol[:, 2], fcol[:, 3]

band = (ny > 0.50) & (ny < 0.95) & (nz > 0.14) & (nz < 0.84) & (np.abs(fn[:, 1]) < 0.97)
body_red = band & (R > 0.45) & (G < 0.40) & (A >= 0.994)
dark = band & (R < 0.30) & (G < 0.30) & (B < 0.30)

print(f"[{KEY}] total faces={len(F)} band={int(band.sum())} body_red={int(body_red.sum())} dark={int(dark.sum())}")
if body_red.any():
    print(f"  red ny<0.55: {int((body_red & (ny<0.55)).sum())} | 0.55-0.65: {int((body_red & (ny>=0.55) & (ny<0.65)).sum())} | 0.65-0.80: {int((body_red & (ny>=0.65) & (ny<0.80)).sum())} | >=0.80: {int((body_red & (ny>=0.80)).sum())}")
    print(f"  red |fn_y|<0.42: {int((body_red & (np.abs(fn[:,1])<0.42)).sum())} | >=0.42: {int((body_red & (np.abs(fn[:,1])>=0.42)).sum())}")
    print(f"  red nx>0.55: {int((body_red & (nx_abs>0.55)).sum())} | α>=0.995: {int((body_red & (A>=0.995)).sum())}")
    import trimesh.graph as tgraph
    fa = np.asarray(mesh.face_adjacency)
    edges = fa[body_red[fa[:, 0]] & body_red[fa[:, 1]]]
    comps = tgraph.connected_components(edges, nodes=np.where(body_red)[0], min_len=1)
    sizes = sorted([len(c) for c in comps], reverse=True)[:8]
    print(f"  red components top8: {sizes}")
# بدنهٔ کلی چند قرمز؟ (صحت رنگ‌سنجی)
body_red_all = (R > 0.45) & (G < 0.40) & (A >= 0.994)
print(f"  body_red ALL: {int(body_red_all.sum())} faces")
