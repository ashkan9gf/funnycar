#!/usr/bin/env python3
"""تست دستی UV یک GLB — بدون trimesh. Usage: python3 scripts/glb_uv_test.py <file.glb>"""
import base64
import io
import json
import struct
import sys

import numpy as np
from PIL import Image

path = sys.argv[1]
data = open(path, "rb").read()
clen, _ = struct.unpack("<II", data[12:20])
js = json.loads(data[20:20 + clen])
off = 20 + clen
blen, _ = struct.unpack("<II", data[off:off + 8])
bin_data = data[off + 8:off + 8 + blen]


def read_acc(idx):
    acc = js["accessors"][idx]
    bv = js["bufferViews"][acc["bufferView"]]
    start = bv.get("byteOffset", 0) + acc.get("byteOffset", 0)
    n = acc["count"]
    comp = {5126: "<f4", 5123: "<u2", 5125: "<u4", 5121: "<u1"}[acc["componentType"]]
    ncomp = {"SCALAR": 1, "VEC2": 2, "VEC3": 3, "VEC4": 4}[acc["type"]]
    itemsize = int(comp[-1]) * ncomp
    stride = bv.get("byteStride") or itemsize
    out = np.zeros((n, ncomp), np.float32 if acc["componentType"] == 5126 else np.int64)
    if stride == itemsize:
        out = np.frombuffer(bin_data[start:start + stride * n], dtype=np.dtype(comp)).reshape(n, ncomp).astype(out.dtype)
    else:
        for i in range(n):
            out[i] = np.frombuffer(bin_data[start + i * stride:start + i * stride + itemsize], dtype=np.dtype(comp))
    return out


prim = js["meshes"][0]["primitives"][0]
attrs = prim["attributes"]
uv = read_acc(attrs["TEXCOORD_0"])
F = read_acc(prim["indices"]).ravel().reshape(-1, 3)
print("uv head:", uv[:4].round(3).tolist())
print("uv min/max:", uv.min(0).round(3).tolist(), uv.max(0).round(3).tolist())

uri = js["images"][0]["uri"]
tex = Image.open(io.BytesIO(base64.b64decode(uri.split(",", 1)[1]))).convert("L")
W, H = tex.size
tl = np.asarray(tex)
fuv = uv[F].mean(axis=1)
x = np.clip(fuv[:, 0] * (W - 1), 0, W - 1).astype(int)
y = np.clip(fuv[:, 1] * (H - 1), 0, H - 1).astype(int)
lum = tl[y, x]
print(f"MANUAL black frac: {float((lum < 12).mean()):.3f}  (faces={len(F)})")
