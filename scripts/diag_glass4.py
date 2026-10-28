#!/usr/bin/env python3
# diag_glass4.py <key> — هویت‌یابی اجزای بدنه‌رنگ داخل باند شیشه: ستون است یا رگه؟
import sys
import numpy as np
import trimesh
import trimesh.graph as tgraph
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

Vs, Fs, Cs = [], [], []
off_v = 0
for mesh in gltf.meshes:
    for prim in mesh.primitives:
        pos = acc_array(prim.attributes.POSITION).astype(np.float64)
        c0 = acc_array(prim.attributes.COLOR_0).astype(np.float64)
        if c0.max() > 1.5:
            c0 = c0 / 255.0
        if c0.shape[1] == 3:
            c0 = np.hstack([c0, np.ones((len(c0), 1))])
        idx = acc_array(prim.indices).astype(np.int64).ravel()
        Vs.append(pos); Fs.append(idx + off_v); Cs.append(c0)
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

fcol = C[F].mean(axis=1)
R, G, B, A = fcol[:, 0], fcol[:, 1], fcol[:, 2], fcol[:, 3]

# کاندیدهای vein با جعبهٔ پهن و بدون سقف سایز
band = (ny > 0.50) & (ny < 0.95) & (nz > 0.14) & (nz < 0.84) & (np.abs(fn[:, 1]) < 0.97)
red = band & (R > 0.45) & (G < 0.40) & (A >= 0.994)

fa = np.asarray(mesh.face_adjacency)
edges = fa[red[fa[:, 0]] & red[fa[:, 1]]]
comps = tgraph.connected_components(edges, nodes=np.where(red)[0], min_len=1)
comps = sorted(comps, key=len, reverse=True)
print(f"[{KEY}] red comps={len(comps)} total={int(red.sum())}")
for ci, comp in enumerate(comps[:12]):
    m = np.zeros(len(F), bool); m[list(comp)] = True
    cny, cnz, cnx, cfy = ny[m], nz[m], nx_abs[m], np.abs(fn[m, 1])
    name = "?"
    # تفکیک حدودی: جلو/عقب با nz، کناری با nx
    front = cnz.mean() > 0.62
    rear = cnz.mean() < 0.30
    side = cnx.mean() > 0.45
    pos = "FRONT" if front else ("REAR" if rear else ("SIDE" if side else "MID"))
    vert_span = cny.max() - cny.min()
    horiz_span = cnz.max() - cnz.min()
    print(f"  comp#{ci}: n={len(comp):4d} nz̄={cnz.mean():.2f} nȳ={cny.mean():.2f} "
          f"ny∈[{cny.min():.2f},{cny.max():.2f}] spanV={vert_span:.2f} spanH={horiz_span:.2f} "
          f"|fn_y|p50={np.median(cfy):.2f} nx̄={cnx.mean():.2f} → {pos}")
