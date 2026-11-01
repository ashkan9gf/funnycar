#!/usr/bin/env python3
"""Check all vehicle GLBs: materials, textures, triangle counts."""
import json, struct, glob, os

def load_gltf(path):
    with open(path, 'rb') as f:
        data = f.read()
    off = 12
    gltf = None
    while off < len(data):
        clen, ctype = struct.unpack('<II', data[off:off+8])
        chunk = data[off+8:off+8+clen]
        if ctype == 0x4E4F534A:
            gltf = json.loads(chunk.decode('utf-8', errors='replace'))
        off += 8 + clen
    return gltf, len(data)

def analyze(path):
    gltf, size = load_gltf(path)
    name = os.path.basename(path)
    mats = gltf.get('materials', [])
    imgs = gltf.get('images', [])
    tris = 0
    for m in gltf.get('meshes', []):
        for p in m.get('primitives', []):
            if 'indices' in p:
                tris += gltf['accessors'][p['indices']]['count'] // 3
            else:
                pa = gltf['accessors'][p['attributes']['POSITION']]
                tris += pa['count'] // 3
    mat_info = []
    for m in mats:
        pbr = m.get('pbrMetallicRoughness', {})
        bc = pbr.get('baseColorFactor')
        has_tex = 'baseColorTexture' in pbr
        mat_info.append(f"{m.get('name','?')}:bc={bc and [round(c,2) for c in bc]}:tex={has_tex}")
    print(f"{name:28s} {size/1e3:8.0f}KB tris={tris:7,d} mats={len(mats)} imgs={len(imgs)}")
    for mi in mat_info[:6]:
        print(f"    {mi}")

base = '/home/z/my-project/public/assets/models/vehicles/'
for f in sorted(glob.glob(base + '*.glb')):
    if '_lod1' in f: continue
    analyze(f)
