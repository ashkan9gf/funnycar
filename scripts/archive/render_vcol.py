#!/usr/bin/env python3
"""رندر چند-زاویه از GLB با vertex colors (COLOR_0) — /tmp/vcol_check.png"""
import json, struct, sys

import numpy as np

GLB = sys.argv[1] if len(sys.argv) > 1 else "/home/z/my-project/download/tripo/player.glb"
OUT = sys.argv[2] if len(sys.argv) > 2 else "/tmp/vcol_check.png"
VIEWS = [(10, -90, "front-Z"), (10, 90, "back+Z"), (8, 0, "left-X"), (8, 180, "right+X"), (88, -90, "top")]
if len(sys.argv) > 3:
    # "elev,azim,label;..." — نمای سفارشی
    VIEWS = []
    for spec in sys.argv[3].split(";"):
        e, a, lab = spec.split(",")
        VIEWS.append((float(e), float(a), lab))


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
    col = None
    if "COLOR_0" in prim["attributes"]:
        ai = prim["attributes"]["COLOR_0"]
        c = read_acc(ai).astype(np.float32)
        mx = c.max()
        if acc[ai].get("normalized") or (mx > 2.0):
            c = c / 255.0 if mx > 2.0 else c
        col = c[:, :3] if c.shape[1] >= 3 else np.repeat(c, 3, axis=1)
    return pos, idx, col


def main():
    pos, idx, col = read_glb(GLB)
    # نرمال‌سازی برای پیش‌نمایش
    mn, mx = pos.min(0), pos.max(0)
    print("bbox:", (mx - mn).round(1))
    ext = (mx - mn).max()
    p = (pos - (mn + mx) / 2) / ext
    if col is None:
        print("NO COLOR_0!")
        col = np.full((len(pos), 3), 0.7)
    fc = col[idx].reshape(-1, 3, 3).mean(axis=1)
    tri = p[idx].reshape(-1, 3, 3)

    import matplotlib
    matplotlib.use("Agg")
    import matplotlib.pyplot as plt
    from mpl_toolkits.mplot3d.art3d import Poly3DCollection

    fig = plt.figure(figsize=(18, 4.2), constrained_layout=True)
    for i, (elev, azim, name) in enumerate(VIEWS):
        ax = fig.add_subplot(1, len(VIEWS), i + 1, projection="3d")
        ax.add_collection3d(Poly3DCollection(tri, facecolors=np.clip(fc, 0, 1), edgecolors="none"))
        ax.set_xlim(-0.55, 0.55); ax.set_ylim(-0.55, 0.55); ax.set_zlim(-0.4, 0.7)
        ax.view_init(elev=elev, azim=azim)
        ax.set_axis_off(); ax.set_title(name)
    plt.savefig(OUT, dpi=85)
    print("saved", OUT, "| vcol mean:", col.mean(0).round(3))


if __name__ == "__main__":
    main()
