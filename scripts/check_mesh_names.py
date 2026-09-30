#!/usr/bin/env python3
"""List mesh node names in vehicle GLBs (traffic coloring depends on mesh names)."""
import json, struct, sys, os

def load_gltf(path):
    with open(path, 'rb') as f:
        data = f.read()
    off = 12
    while off < len(data):
        clen, ctype = struct.unpack('<II', data[off:off+8])
        chunk = data[off+8:off+8+clen]
        if ctype == 0x4E4F534A:
            gltf = json.loads(chunk.decode('utf-8', errors='replace'))
        off += 8 + clen
    return gltf

base = '/home/z/my-project/public/assets/models/vehicles/'
for name in ['pride.glb', 'tiba.glb', 'nissan.glb']:
    gltf = load_gltf(base + name)
    mesh_names = []
    for n in gltf['nodes']:
        if 'mesh' in n:
            mesh_names.append(n.get('name', '?'))
    print(f"{name}: mesh nodes = {mesh_names}")
