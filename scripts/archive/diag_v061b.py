#!/home/z/.venv/bin/python3
"""diag_v061b.py — where are the red spokes? Direct GLB COLOR_0 analysis."""
import sys
import numpy as np
import trimesh
from pygltflib import GLTF2

key = sys.argv[1] if len(sys.argv) > 1 else "player"
path = f"/home/z/my-project/public/assets/models/vehicles/{key}.glb"

gl = GLTF2().load(path)
blob = gl.binary_blob()

def read_acc(idx):
    acc = gl.accessors[idx]
    bva = gl.bufferViews[acc.bufferView]
    off = (bva.byteOffset or 0) + (acc.byteOffset or 0)
    comp = {5126: "f4", 5123: "u2", 5125: "u4", 5121: "u1"}[acc.componentType]
    ncomp = {"SCALAR": 1, "VEC2": 2, "VEC3": 3, "VEC4": 4}[acc.type]
    stride = bva.byteStride or (4 * ncomp if comp == "f4" else None)
    dt = {"f4": np.float32, "u4": np.uint32, "u2": np.uint16, "u1": np.uint8}[comp]
    if stride and stride != 4 * ncomp:
        # interleaved — build strided view
        raw = np.frombuffer(blob, dtype=np.uint8, count=acc.count * stride, offset=off)
        raw = raw.reshape(acc.count, stride)
        out = np.zeros((acc.count, ncomp), np.float32)
        for c in range(ncomp):
            out[:, c] = np.frombuffer(raw[:, c * 4:c * 4 + 4].tobytes(), dtype=dt)
        return out
    end = off + acc.count * 4 * ncomp
    arr = np.frombuffer(blob[off:end], dtype=dt, count=acc.count * ncomp)
    out = arr.reshape(acc.count, ncomp).astype(np.float32)
    if comp != "f4":
        out /= 255.0
    return out

# map mesh name -> node world transform (nodes may be transformed)
import json
node_xf = {}
def walk(ni, xf):
    n = gl.nodes[ni]
    m = np.array(n.matrix, np.float64).reshape(4, 4) if n.matrix else None
    if m is None:
        m = np.eye(4)
        if n.translation: m[:3, 3] = n.translation
        if n.rotation:
            x, y, z, w = n.rotation
            R = np.array([[1-2*y*y-2*z*z, 2*x*y-2*z*w, 2*x*z+2*y*w],
                          [2*x*y+2*z*w, 1-2*x*x-2*z*z, 2*y*z-2*x*w],
                          [2*x*z-2*y*w, 2*y*z+2*x*w, 1-2*x*x-2*y*y]])
            m[:3, :3] = R
        if n.scale: m[:3, :3] *= np.array(n.scale)[:, None]
    xf = xf @ m
    if n.mesh is not None:
        node_xf[n.mesh] = xf
    for c in n.children or []:
        walk(c, xf)
for ni in gl.scene_nodes if hasattr(gl, "scene_nodes") else range(len(gl.nodes)):
    if gl.nodes[ni].mesh is not None or gl.nodes[ni].children:
        pass
for ni in range(len(gl.nodes)):
    pass
# simpler: walk from root nodes
roots = [i for i, n in enumerate(gl.nodes) if n.mesh is not None or True]
visited = set()
for ni in range(len(gl.nodes)):
    if ni in visited:
        continue
    # only start from nodes without parents
    if not any(ni in (n.children or []) for n in gl.nodes):
        walk(ni, np.eye(4))
        visited.update()

sc = trimesh.load(path, process=False)
geo_list = list(sc.geometry.items())

for mi, m in enumerate(gl.meshes):
    name = m.name or f"mesh{mi}"
    xf = node_xf.get(mi, np.eye(4))
    for prim in m.primitives:
        pos = read_acc(prim.attributes.POSITION)
        nverts = len(pos)
        faces = read_acc(prim.indices).ravel().astype(np.int64).reshape(-1, 3)
        vworld = (np.column_stack([pos, np.ones(nverts)]) @ xf.T)[:, :3]
        col0 = read_acc(prim.attributes.COLOR_0) if prim.attributes.COLOR_0 is not None else None
        if col0 is None or "wheel" not in name:
            if col0 is None:
                print(f"{name}: no COLOR_0, nfaces={len(faces)}")
            continue
        fc0 = col0[faces].mean(axis=1)
        bright = fc0[:, :3].mean(axis=1) > 0.45
        wmin, wmax = vworld.min(0), vworld.max(0)
        dia = wmax[1] - wmin[1]
        cy, cz = 0.5 * (wmin[1] + wmax[1]), 0.5 * (wmin[2] + wmax[2])
        cen = vworld[faces].mean(axis=1)
        rad = np.sqrt((cen[:, 1] - cy) ** 2 + (cen[:, 2] - cz) ** 2)
        r_est = 0.5 * dia
        silver_in = int((bright & (rad < 0.62 * r_est)).sum())
        print(f"{name}: nf={len(faces)} bright={int(bright.sum())} silver(rad<0.62r)={silver_in}")

# body part COLOR_0 red faces in wheel discs
for mi, m in enumerate(gl.meshes):
    name = m.name or f"mesh{mi}"
    if name != "body":
        continue
    xf = node_xf.get(mi, np.eye(4))
    for prim in m.primitives:
        pos = read_acc(prim.attributes.POSITION)
        faces = read_acc(prim.indices).ravel().astype(np.int64).reshape(-1, 3)
        nverts = len(pos)
        vworld = (np.column_stack([pos, np.ones(nverts)]) @ xf.T)[:, :3]
        col0 = read_acc(prim.attributes.COLOR_0)
        fc0 = col0[faces].mean(axis=1)
        reddish = (fc0[:, 0] > 0.5) & (fc0[:, 1] < 0.4) & (fc0[:, 2] < 0.4)
        cen = vworld[faces].mean(axis=1)
        for wmi, wm in enumerate(gl.meshes):
            wname = wm.name or f"mesh{wmi}"
            if "wheel" not in wname:
                continue
            wxf = node_xf.get(wmi, np.eye(4))
            for wprim in wm.primitives:
                wpos = read_acc(wprim.attributes.POSITION)
                wv = (np.column_stack([wpos, np.ones(len(wpos))]) @ wxf.T)[:, :3]
                wmin, wmax = wv.min(0), wv.max(0)
                dia = wmax[1] - wmin[1]
                cy, cz = 0.5 * (wmin[1] + wmax[1]), 0.5 * (wmin[2] + wmax[2])
                cx = float(np.median(wv[:, 0]))
                rho = np.sqrt((cen[:, 1] - cy) ** 2 + (cen[:, 2] - cz) ** 2)
                inside = (rho <= 0.36 * dia) & (np.abs(cen[:, 0] - cx) <= 0.20 * dia)
                print(f"body faces in {wname} rim-disc: n={int(inside.sum())} red={int((inside & reddish).sum())}")
