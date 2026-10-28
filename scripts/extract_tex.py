#!/usr/bin/env python3
"""Extract baked texture atlas from final GLBs to inspect boundary fringes."""
import os, struct, json
from PIL import Image
import io

VDIR = '/home/z/my-project/public/assets/models/vehicles'
OUT = '/home/z/my-project/scripts/texout'
os.makedirs(OUT, exist_ok=True)

def read_glb_textures(path, tag):
    with open(path, 'rb') as f:
        data = f.read()
    assert data[:4] == b'glTF', 'not glb'
    length = struct.unpack('<I', data[12:16])[0]
    jtxt = data[20:20+length]
    gltf = json.loads(jtxt)
    print(f'--- {tag}: {len(gltf.get("images", []))} images, {len(gltf.get("textures", []))} textures')
    # find BIN chunk
    off = 20 + length
    binchunk = None
    while off < len(data):
        clen, ctype = struct.unpack('<II', data[off:off+8])
        if ctype == 0x004E4942:
            binchunk = data[off+8:off+8+clen]
            break
        off += 8 + clen
    for i, img in enumerate(gltf.get('images', [])):
        bv = img.get('bufferView')
        if bv is None:
            print('  img', i, 'uri', img.get('uri')); continue
        bvg = gltf['bufferViews'][bv]
        s, by = bvg.get('byteOffset', 0), bvg.get('byteLength')
        blob = binchunk[s:s+by]
        try:
            im = Image.open(io.BytesIO(blob))
            name = f'{OUT}/{tag}_tex{i}_{im.width}x{im.height}_{im.mode}.png'
            im.save(name)
            print('  saved', name)
        except Exception as e:
            print('  img', i, 'decode fail', e, 'mime', img.get('mimeType'))

for key in ['peugeot405']:
    p = os.path.join(VDIR, f'{key}.glb')
    if os.path.exists(p):
        read_glb_textures(p, key)
