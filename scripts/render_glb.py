#!/usr/bin/env python3
"""رندر چند-زاویه از GLB نهایی (خواندن مستقیم بافر) — /tmp/render_check.png"""
import json, struct, sys

import numpy as np
from PIL import Image

GLB = sys.argv[1] if len(sys.argv) > 1 else "/home/z/my-project/download/tripo/player.glb"
OUT = sys.argv[2] if len(sys.argv) > 2 else "/tmp/render_check.png"
VIEWS = [(8, -90, "-Z"), (8, 90, "+Z"), (20, 0, "-X"), (20, 180, "+X"), (88, -90, "top")]


def read_glb(path):
    data = open(path, "rb").read()
    clen, _ = struct.unpack("<II", data[12:20])
    js = json.loads(data[20:20 + clen])
    binstart = 20 + clen + 8
    prim = js["meshes"][0]["primitives"][0]
    acc, bv = js["accessors"], js["bufferViews"]
    CT = {5126: ("f4", 4), 5123: ("<u2", 2), 5125: ("<u4", 4), 5121: ("u1", 1)}
    NC = {"VEC2": 2, "VEC3": 3, "SCALAR": 1, "VEC4": 4}

    def read_acc(i):
        a = acc[i]
        v = bv[a["bufferView"]]
        off = binstart + (v.get("byteOffset") or 0) + (a.get("byteOffset") or 0)
        arr = np.frombuffer(data, dtype=CT[a["componentType"]][0],
                            count=a["count"] * NC[a["type"]], offset=off)
        return arr.reshape(a["count"], NC[a["type"]])

    pos = read_acc(prim["attributes"]["POSITION"]).astype(np.float32)
    idx = read_acc(prim["indices"]).flatten()
    uv = read_acc(prim["attributes"]["TEXCOORD_0"]) if "TEXCOORD_0" in prim["attributes"] else None

    tex = None
    if uv is not None and js.get("images"):
        img = js["images"][0]
        v2 = bv[img["bufferView"]]
        off = binstart + (v2.get("byteOffset") or 0)
        blob = data[off:off + v2["byteLength"]]
        import io
        tex = Image.open(io.BytesIO(blob)).convert("RGB")
    return pos, idx, uv, tex


def main():
    pos, idx, uv, tex = read_glb(GLB)
    cols = np.full((len(idx) // 3, 3), 0.75)
    if tex is not None:
        arr = np.asarray(tex)
        H, W = arr.shape[:2]
        cent = uv[idx].reshape(-1, 3, 2).mean(axis=1)
        # glTF: v از بالا؛ تصویر: ردیف ۰ بالا → flip
        iy = np.clip(((1 - cent[:, 1]) * H).astype(int), 0, H - 1)
        ix = np.clip((cent[:, 0] * W).astype(int), 0, W - 1)
        cols = arr[iy, ix] / 255.0

    import matplotlib
    matplotlib.use("Agg")
    import matplotlib.pyplot as plt
    from mpl_toolkits.mplot3d.art3d import Poly3DCollection

    tri = pos[idx].reshape(-1, 3, 3)
    fig = plt.figure(figsize=(18, 5), constrained_layout=True)
    for i, (elev, azim, name) in enumerate(VIEWS):
        ax = fig.add_subplot(1, len(VIEWS), i + 1, projection="3d")
        ax.add_collection3d(Poly3DCollection(tri, facecolors=np.clip(cols, 0, 1), edgecolors="none"))
        ax.set_xlim(-0.6, 0.6); ax.set_ylim(-0.6, 0.6); ax.set_zlim(-0.5, 1.2)
        ax.view_init(elev=elev, azim=azim)
        ax.set_axis_off(); ax.set_title(name)
    plt.savefig(OUT, dpi=80)
    print("saved", OUT)


if __name__ == "__main__":
    main()

def debug_fcol():
    """رندر fcol ذخیره‌شده از mesh_tex2 — دیباگ"""
    import numpy as np
    fcol = np.load('/tmp/debug_fcol.npy')
    m2 = trimesh.load('/tmp/debug_mesh.ply', force='mesh')
    import matplotlib; matplotlib.use('Agg')
    import matplotlib.pyplot as plt
    from mpl_toolkits.mplot3d.art3d import Poly3DCollection
    tri = m2.vertices[m2.faces]
    fig = plt.figure(figsize=(14, 7), constrained_layout=True)
    for i, (elev, azim, name) in enumerate([(15, -110, '3/4'), (0, -90, 'sideL'), (0, 90, 'sideR')]):
        ax = fig.add_subplot(1, 3, i+1, projection='3d')
        ax.add_collection3d(Poly3DCollection(tri, facecolors=np.clip(fcol, 0, 1), edgecolors='none'))
        ax.set_xlim(-0.6, 0.6); ax.set_ylim(-0.6, 0.6); ax.set_zlim(-0.5, 1.2)
        ax.view_init(elev=elev, azim=azim); ax.set_axis_off(); ax.set_title(name)
    plt.savefig('/tmp/debug_fcol.png', dpi=80)
    print('saved /tmp/debug_fcol.png')
