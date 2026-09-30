#!/usr/bin/env python3
"""Analyze GLB files: structure, meshes, materials, textures, wheels, triangles."""
import json, struct, sys

def analyze(path):
    print("=" * 70)
    print(f"FILE: {path}")
    with open(path, 'rb') as f:
        data = f.read()
    magic, version, length = struct.unpack('<III', data[:12])
    if magic != 0x46546C67:
        print("NOT GLB!"); return
    # chunks
    off = 12
    gltf = None
    bin_len = 0
    while off < length:
        clen, ctype = struct.unpack('<II', data[off:off+8])
        chunk = data[off+8:off+8+clen]
        if ctype == 0x4E4F534A:  # JSON
            gltf = json.loads(chunk.decode('utf-8', errors='replace'))
        elif ctype == 0x004E4942:
            bin_len = clen
        off += 8 + clen
    print(f"  size={length/1e6:.1f}MB  bin_chunk={bin_len/1e6:.1f}MB")
    print(f"  generator: {gltf.get('asset', {}).get('generator', '?')}")
    print(f"  nodes={len(gltf.get('nodes', []))} meshes={len(gltf.get('meshes', []))} materials={len(gltf.get('materials', []))} images={len(gltf.get('images', []))} textures={len(gltf.get('textures', []))} animations={len(gltf.get('animations', []))} skins={len(gltf.get('skins', []))}")

    # materials
    print("  --- materials ---")
    for i, m in enumerate(gltf.get('materials', [])):
        pbr = m.get('pbrMetallicRoughness', {})
        base = pbr.get('baseColorFactor')
        tex = 'baseColorTexture' in pbr
        print(f"    [{i}] name={m.get('name','?')!r} baseColor={base} tex={tex} metal={pbr.get('metallicFactor')} rough={pbr.get('roughnessFactor')} ext={list(m.get('extensions', {}).keys())}")

    # images
    for i, im in enumerate(gltf.get('images', [])):
        bv = im.get('bufferView')
        bvsz = gltf['bufferViews'][bv]['byteLength'] if bv is not None else 0
        print(f"    img[{i}] mime={im.get('mimeType')} name={im.get('name','')} size={bvsz/1024:.0f}KB")

    # node tree (top-level names + wheel search)
    print("  --- node tree (names) ---")
    def walk(idx, depth, out):
        n = gltf['nodes'][idx]
        name = n.get('name', f'node{idx}')
        has_mesh = 'mesh' in n
        out.append(f"{'  '*depth}{name}{' [mesh]' if has_mesh else ''}")
        for c in n.get('children', [])[:60]:
            walk(c, depth+1, out)
    scene = gltf['scenes'][gltf.get('scene', 0)]
    for r in scene['nodes'][:20]:
        walk(r, 0, lines := [])
    lines = []
    for r in scene['nodes']:
        walk(r, 0, lines)
    # print only interesting: wheels + top level
    for l in lines[:80]:
        print("    " + l)

    # wheels
    wheels = [n.get('name','') for n in gltf['nodes'] if any(k in n.get('name','').lower() for k in ('wheel','tyre','tire','charkh'))]
    print(f"  WHEEL-like nodes: {wheels}")

    # triangle count
    tris = 0
    verts = 0
    for m in gltf.get('meshes', []):
        for p in m.get('primitives', []):
            acc = gltf['accessors'][p['indices']]
            tris += acc['count'] // 3
            pa = gltf['accessors'][p['attributes']['POSITION']]
            verts += pa['count']
    print(f"  TOTAL triangles={tris:,}  vertices={verts:,}")
    # extensions used overall
    exts = set(gltf.get('extensionsUsed', []))
    print(f"  extensionsUsed={exts}")
    # check draco/KHR
    bad = exts & {'KHR_draco_mesh_compression', 'EXT_meshopt_compression', 'KHR_texture_basisu'}
    print(f"  ⚠ compressed ext (needs three.js support): {bad or 'NONE'}")

for p in sys.argv[1:]:
    analyze(p)
