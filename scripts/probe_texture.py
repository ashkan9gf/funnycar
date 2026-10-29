#!/home/z/.venv/bin/python3
"""probe_texture.py — what does the baked body texture contain at the wheel-disc faces?"""
import sys
import numpy as np
from pygltflib import GLTF2
from PIL import Image

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
    dt = {"f4": np.float32, "u4": np.uint32, "u2": np.uint16, "u1": np.uint8}[comp]
    stride = bva.byteStride or 4 * ncomp
    if stride != 4 * ncomp:
        raw = np.frombuffer(blob, dtype=np.uint8, count=acc.count * stride, offset=off).reshape(acc.count, stride)
        out = np.zeros((acc.count, ncomp), np.float32)
        for c in range(ncomp):
            out[:, c] = np.frombuffer(raw[:, c * 4:c * 4 + 4].tobytes(), dtype=dt)
        return out
    end = off + acc.count * 4 * ncomp
    out = np.frombuffer(blob[off:end], dtype=dt, count=acc.count * ncomp).reshape(acc.count, ncomp).astype(np.float32)
    if comp != "f4":
        out /= 255.0
    return out

body = next(m for m in gl.meshes if m.name == "body")
prim = body.primitives[0]
pos = read_acc(prim.attributes.POSITION)
uv = read_acc(prim.attributes.TEXCOORD_0) if prim.attributes.TEXCOORD_0 is not None else None
faces = read_acc(prim.indices).ravel().astype(np.int64).reshape(-1, 3)
col0 = read_acc(prim.attributes.COLOR_0)
print(f"body: v={len(pos)} f={len(faces)} uv={'yes' if uv is not None else 'NO'}")

cen = pos[faces].mean(axis=1)
bmin, bmax = pos.min(0), pos.max(0)
print(f"bbox min={bmin.round(1)} max={bmax.round(1)}")

# wheel part centers
for m in gl.meshes:
    if "wheel" not in (m.name or ""):
        continue
    p = m.primitives[0]
    wpos = read_acc(p.attributes.POSITION)
    wmin, wmax = wpos.min(0), wpos.max(0)
    dia = wmax[1] - wmin[1]
    cy, cz = 0.5 * (wmin[1] + wmax[1]), 0.5 * (wmin[2] + wmax[2])
    cx = float(np.median(wpos[:, 0]))
    rho = np.sqrt((cen[:, 1] - cy) ** 2 + (cen[:, 2] - cz) ** 2)
    inside = (rho <= 0.36 * dia) & (np.abs(cen[:, 0] - cx) <= 0.20 * dia)
    print(f"{m.name}: center=({cx:.1f},{cy:.1f},{cz:.1f}) dia={dia:.1f} body-faces in rim-disc={int(inside.sum())}")
    if inside.sum() and uv is not None:
        # sample texture at UV centroid of those faces
        tex_img = None
        mat = gl.materials[prim.material]
        if mat.pbrMetallicRoughness and mat.pbrMetallicRoughness.baseColorTexture:
            tex_idx = mat.pbrMetallicRoughness.baseColorTexture.index
            src = gl.textures[tex_idx].source
            img_view = gl.bufferViews[gl.images[src].bufferView]
            ioff = (img_view.byteOffset or 0)
            raw = blob[ioff:ioff + img_view.byteLength]
            import io
            tex_img = Image.open(io.BytesIO(raw)).convert("RGB")
            TW, TH = tex_img.size
            ta = np.asarray(tex_img)
            fu = uv[faces[inside]].mean(axis=1)  # uv per face centroid
            px = np.clip(fu[:, 0], 0, 1) * (TW - 1)
            py = np.clip(fu[:, 1], 0, 1) * (TH - 1)
            cols = ta[py.astype(int), px.astype(int)]
            print(f"  texture sample at disc faces: mean={cols.mean(axis=0).round(0)} "
                  f"bright(>120)={int((cols.mean(axis=1) > 120).sum())}/{int(inside.sum())}")
        # COLOR_0 of those faces
        fc0 = col0[faces[inside]].mean(axis=1)
        print(f"  COLOR_0 mean={fc0[:, :3].mean(axis=0).round(2)} alpha-mean={fc0[:, 3].mean():.3f}")
