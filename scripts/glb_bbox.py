#!/usr/bin/env python3
"""Compute world-space bounding box of GLB (after node transforms)."""
import json, struct, sys
import numpy as np

def load_gltf(path):
    with open(path, 'rb') as f:
        data = f.read()
    off = 12
    while off < len(data):
        clen, ctype = struct.unpack('<II', data[off:off+8])
        chunk = data[off+8:off+8+clen]
        if ctype == 0x4E4F534A:
            gltf = json.loads(chunk.decode('utf-8', errors='replace'))
        elif ctype == 0x004E4942:
            bin_data = chunk
        off += 8 + clen
    return gltf, bin_data

def node_matrix(n):
    if 'matrix' in n:
        return np.array(n['matrix']).reshape(4, 4).T
    m = np.eye(4)
    if 't' in n.get('translation', []):
        pass
    T = np.eye(4); R = np.eye(4); S = np.eye(4)
    if 'translation' in n: T[:3, 3] = n['translation']
    if 'rotation' in n:
        x, y, z, w = n['rotation']
        R[:3, :3] = np.array([
            [1-2*(y*y+z*z), 2*(x*y-z*w), 2*(x*z+y*w)],
            [2*(x*y+z*w), 1-2*(x*x+z*z), 2*(y*z-x*w)],
            [2*(x*z-y*w), 2*(y*z+x*w), 1-2*(x*x+y*y)]])
    if 'scale' in n:
        S[0, 0], S[1, 1], S[2, 2] = n['scale']
    return T @ R @ S

def analyze(path):
    gltf, bin_data = load_gltf(path)
    nodes = gltf['nodes']
    # compute world matrix per node
    def world_mats():
        mats = {}
        def visit(idx, parent):
            m = parent @ node_matrix(nodes[idx])
            mats[idx] = m
            for c in nodes[idx].get('children', []):
                visit(c, m)
        for r in gltf['scenes'][gltf.get('scene', 0)]['nodes']:
            visit(r, np.eye(4))
        return mats
    wm = world_mats()
    lo = np.array([1e9]*3); hi = np.array([-1e9]*3)
    for idx, n in enumerate(nodes):
        if 'mesh' not in n: continue
        pa = gltf['accessors'][gltf['meshes'][n['mesh']]['primitives'][0]['attributes']['POSITION']]
        mn, mx = np.array(pa['min']), np.array(pa['max'])
        corners = np.array([[mn[0],mn[1],mn[2],1],[mx[0],mn[1],mn[2],1],[mn[0],mx[1],mn[2],1],[mx[0],mx[1],mn[2],1],
                            [mn[0],mn[1],mx[2],1],[mx[0],mn[1],mx[2],1],[mn[0],mx[1],mx[2],1],[mx[0],mx[1],mx[2],1]])
        wc = (wm[idx] @ corners.T).T[:, :3]
        lo = np.minimum(lo, wc.min(axis=0)); hi = np.maximum(hi, wc.max(axis=0))
    size = hi - lo
    print(f"{path.split('/')[-1]}:")
    print(f"  min={np.round(lo,2)} max={np.round(hi,2)}")
    print(f"  size(X=لن, Y=ارتفاع, Z=طول)= {np.round(size,2)}  → طول={size[2]:.2f} عرض={size[0]:.2f} ارتفاع={size[1]:.2f}")
    # max texture dim
    maxdim = 0
    for im in gltf.get('images', []):
        bv = im.get('bufferView')
        if bv is not None:
            maxdim = max(maxdim, gltf['bufferViews'][bv]['byteLength'])
    return size

for p in sys.argv[1:]:
    analyze(p)
