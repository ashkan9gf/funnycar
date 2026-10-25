#!/usr/bin/env python3
"""پردازش نهایی مش سفید → GLB تکسچرخورده (هم‌ترازی BBOX + z-buffer + NN).
Usage: python3 scripts/mesh_tex2.py <mesh.glb> <name> [faces]
نماها: /tmp/views/<name>_{front,back,side,top}.png
"""
import os, sys

import numpy as np
import trimesh
import xatlas
from PIL import Image
import pyfqmr
from scipy.spatial import cKDTree

MESH = sys.argv[1] if len(sys.argv) > 1 else "/home/z/my-project/download/tripo/player_shape.glb"
NAME = sys.argv[2] if len(sys.argv) > 2 else "player"
TARGET_FACES = int(sys.argv[3]) if len(sys.argv) > 3 else 45000
ATLAS = 1024
RES = 512
VDIR = f"/tmp/views/{NAME}"
OUT = f"/home/z/my-project/download/tripo/{NAME}.glb"

# محورهای (u,v,depth-axis,depth-sign,cam-sign) هر نما — cam-sign جهت دوربین برای dot نرمال
AXES = {
    "front": (0, 1, 2, +1, +1),   # دوربین در +Z — جلو مش
    "back":  (0, 1, 2, -1, -1),   # دوربین در −Z
    "side":  (2, 1, 0, +1, +1),   # دوربین در +X — تصویر رو به چپ (u=−z)
    "top":   (0, 2, 1, -1, +1),   # دوربین بالا (+Y) — جلو بالای تصویر
}


def load_view(k):
    p = os.path.join(VDIR, f"{k}.png")
    if not os.path.exists(p):
        return None
    img = Image.open(p).convert("RGBA")
    a = np.asarray(img)[:, :, 3]
    ys, xs = np.where(a > 128)
    if len(ys) == 0:
        return None
    pad = 8
    x0, x1 = max(0, xs.min() - pad), min(img.width, xs.max() + pad)
    y0, y1 = max(0, ys.min() - pad), min(img.height, ys.max() + pad)
    img = img.crop((x0, y0, x1, y1))
    # 🔑 بلور سنگین: عدم تطابق نسبت تصویر AI با مش → گرادیان نرم به‌جای لکهٔ تیره
    return img.filter(__import__("PIL.ImageFilter", fromlist=["GaussianBlur"]).GaussianBlur(14))


def main() -> int:
    m = trimesh.load(MESH, force="mesh")
    m.merge_vertices(merge_tex=True, merge_norm=True)
    m.update_faces(m.nondegenerate_faces())
    m.update_faces(m.unique_faces())
    m.remove_unreferenced_vertices()
    if len(m.faces) > TARGET_FACES:
        s = pyfqmr.Simplify()
        s.setMesh(m.vertices.astype(np.float32), m.faces.astype(np.uint32))
        s.simplify_mesh(target_count=TARGET_FACES, verbose=False)
        v, f, _ = s.getMesh()
        m = trimesh.Trimesh(np.asarray(v), np.asarray(f))
    print(f"mesh: v={len(m.vertices)} f={len(m.faces)}", flush=True)

    vmapping, ft, uv = xatlas.parametrize(m.vertices, m.faces)
    verts = m.vertices[vmapping]
    faces = ft
    meshA = trimesh.Trimesh(verts, faces, process=False)
    fnorm = meshA.face_normals
    fcent = verts[faces].mean(axis=1)
    print(f"uv: {uv.shape}", flush=True)

    # نرمال‌سازی مستقل per-axis به [−0.5,0.5] برای هم‌ترازی با کراپ تصویر
    bmin, bmax = verts.min(0), verts.max(0)
    ext = np.maximum(bmax - bmin, 1e-6)
    Pn = (verts - (bmin + bmax) / 2) / ext  # [−0.5, 0.5]
    fc = (fcent - (bmin + bmax) / 2) / ext

    fcol = np.full((len(faces), 3), 0.85)
    bestd = np.full(len(faces), -1.0)

    views = {k: load_view(k) for k in AXES}
    print("views:", [k for k, v in views.items() if v is not None], flush=True)

    for k, img in views.items():
        if img is None:
            continue
        ua, va, dax, dsgn, csgn = AXES[k]
        W, H = img.size
        arr = np.asarray(img, dtype=np.float32)
        d = fnorm[:, dax] * csgn

        # عمق‌نقشهٔ z-buffer برای دید (فقط فیس‌های رو به دوربین)
        q = np.stack([Pn[faces][:, :, ua], Pn[faces][:, :, va]], 2)  # (F,3,2)
        qd = Pn[faces][:, :, dax].mean(1) * dsgn
        zb = np.full((RES, RES), 1e9, np.float32)
        qx = (q[:, :, 0] + 0.5) * (RES - 1)
        qy = (1 - (q[:, :, 1] + 0.5)) * (RES - 1)
        order = np.argsort(qd)  # دور сначала تا نزدیک رو زده شود
        for fi in order:
            x0 = max(0, int(qx[fi].min())); x1 = min(RES - 1, int(qx[fi].max()) + 1)
            y0 = max(0, int(qy[fi].min())); y1 = min(RES - 1, int(qy[fi].max()) + 1)
            if x1 <= x0 or y1 <= y0:
                continue
            xs, ys = np.meshgrid(np.arange(x0, x1), np.arange(y0, y1))
            dd = ((qx[fi, 1] - qx[fi, 0]) * (qy[fi, 2] - qy[fi, 0])
                  - (qx[fi, 2] - qx[fi, 0]) * (qy[fi, 1] - qy[fi, 0]))
            if abs(dd) < 1e-9:
                continue
            w0 = ((qx[fi, 1] - xs) * (qy[fi, 2] - ys) - (qx[fi, 2] - xs) * (qy[fi, 1] - ys)) / dd
            w1 = ((qx[fi, 2] - xs) * (qy[fi, 0] - ys) - (qx[fi, 0] - xs) * (qy[fi, 2] - ys)) / dd
            w2 = 1 - w0 - w1
            ins = (w0 >= 0) & (w1 >= 0) & (w2 >= 0)
            if not ins.any():
                continue
            yy, xx = ys[ins], xs[ins]
            upd = qd[fi] < zb[yy, xx]
            zb[yy[upd], xx[upd]] = qd[fi]

        # نمونهٔ رنگ مرکز هر فیس = میانهٔ پنجرهٔ ۱۱×۱۱ پیکسل‌های alpha>128 (مقاوم به خط/لبه)
        cu = (fc[:, ua] + 0.5) * (W - 1)
        cv = (1 - (fc[:, va] + 0.5)) * (H - 1)
        cu_r = np.clip((fc[:, ua] + 0.5) * (RES - 1), 0, RES - 1).astype(int)
        cv_r = np.clip((1 - (fc[:, va] + 0.5)) * (RES - 1), 0, RES - 1).astype(int)
        cd = fc[:, dax] * dsgn
        a8 = arr[:, :, 3]
        ok = np.zeros(len(faces), bool)
        samp = np.zeros((len(faces), 3), np.float32)
        R = 5
        for fi2 in range(len(faces)):
            cx, cy = int(cu[fi2]), int(cv[fi2])
            x0, x1 = max(0, cx - R), min(W, cx + R + 1)
            y0, y1 = max(0, cy - R), min(H, cy + R + 1)
            patch = arr[y0:y1, x0:x1]
            pm = patch[:, :, 3] > 128
            if pm.sum() < 8:
                continue
            samp[fi2] = np.median(patch[:, :, :3][pm], axis=0)
            ok[fi2] = True
        visible = cd <= (zb[cv_r, cu_r] + 0.04)
        d = fnorm[:, dax] * csgn
        ok &= (d > 0.35) & visible
        upd = ok & (d > bestd)
        fcol[upd] = samp[upd] / 255.0
        bestd[upd] = d[upd]
        print(f"  {k}: {int((ok & (d > bestd + 1)).sum())}+", flush=True)

    good = bestd > 0
    print(f"visible faces: {int(good.sum())}/{len(faces)}", flush=True)
    if good.any() and not good.all():
        tree = cKDTree((verts[faces].mean(1))[good])
        _, nn = tree.query(verts[faces].mean(1)[~good])
        fcol[~good] = fcol[good][nn]
    print("colors done", flush=True)
    np.save('/tmp/debug_fcol.npy', fcol)
    trimesh.Trimesh(verts, faces, process=False).export('/tmp/debug_mesh.ply')

    # رستر اطلس با رنگ یکدست فیس
    teximg = np.full((ATLAS, ATLAS, 3), 245, dtype=np.uint8)
    uvpx = np.stack([np.clip(uv[:, 0], 0, 1) * (ATLAS - 1),
                     np.clip(uv[:, 1], 0, 1) * (ATLAS - 1)], axis=1)
    for fi in range(len(faces)):
        p0, p1, p2 = uvpx[faces[fi]]
        cc = fcol[fi]
        x0 = int(max(0, np.floor(min(p0[0], p1[0], p2[0]))))
        x1 = int(min(ATLAS - 1, np.ceil(max(p0[0], p1[0], p2[0]))))
        y0 = int(max(0, np.floor(min(p0[1], p1[1], p2[1]))))
        y1 = int(min(ATLAS - 1, np.ceil(max(p0[1], p1[1], p2[1]))))
        if x1 < x0 or y1 < y0:
            continue
        xs, ys = np.meshgrid(np.arange(x0, x1 + 1), np.arange(y0, y1 + 1))
        dd = ((p1[0] - p0[0]) * (p2[1] - p0[1]) - (p2[0] - p0[0]) * (p1[1] - p0[1]))
        if abs(dd) < 1e-9:
            continue
        w0 = ((p1[0] - xs) * (p2[1] - ys) - (p2[0] - xs) * (p1[1] - ys)) / dd
        w1 = ((p2[0] - xs) * (p0[1] - ys) - (p0[0] - xs) * (p2[1] - ys)) / dd
        w2 = 1 - w0 - w1
        ins = (w0 >= -0.02) & (w1 >= -0.02) & (w2 >= -0.02)
        if not ins.any():
            continue
        teximg[ys[ins], xs[ins]] = (np.clip(cc, 0, 1) * 255).astype(np.uint8)

    # gap-fill + بلور
    filled = teximg.astype(np.float32)
    empty = (filled[:, :, 0] == 245) & (filled[:, :, 1] == 245) & (filled[:, :, 2] == 245)
    for _ in range(24):
        if not empty.any():
            break
        acc = np.zeros_like(filled)
        cnt = np.zeros(filled.shape[:2], np.float32)
        for dy, dx in ((1, 0), (-1, 0), (0, 1), (0, -1)):
            vs = np.roll(filled, (dy, dx), axis=(0, 1))
            es = np.roll(empty, (dy, dx), axis=(0, 1))
            w = (~es).astype(np.float32)
            acc += vs * w[..., None]
            cnt += w
        fb = empty & (cnt > 0)
        filled[fb] = acc[fb] / cnt[fb][..., None]
        empty = empty & ~fb
    teximg = filled.astype(np.uint8)
    p = np.pad(teximg.astype(np.float32), ((1, 1), (1, 1), (0, 0)), mode="edge")
    teximg = ((p[:-2, :-2] + p[:-2, 1:-1] + p[:-2, 2:] + p[1:-1, :-2] + p[1:-1, 1:-1]
               + p[1:-1, 2:] + p[2:, :-2] + p[2:, 1:-1] + p[2:, 2:]) / 9.0).astype(np.uint8)
    print("atlas cleaned", flush=True)

    tex = Image.fromarray(teximg)
    verts_atlas = m.vertices[vmapping]
    # چرخش ۱۸۰° حول Y — جلو مش +Z → −Z برای بازی
    verts_atlas = verts_atlas @ np.diag([-1.0, 1.0, -1.0]).astype(np.float32)
    mesh2 = trimesh.Trimesh(verts_atlas, ft, process=False)
    mesh2.visual = trimesh.visual.texture.TextureVisuals(uv=uv, image=tex)
    mesh2.export(OUT)
    from pygltflib import GLTF2
    g = GLTF2().load(OUT)
    for mat in g.materials:
        mat.pbrMetallicRoughness.baseColorFactor = [1.0, 1.0, 1.0, 1.0]
        mat.pbrMetallicRoughness.metallicFactor = 0.0
    g.save(OUT)
    print(f"OK → {OUT} ({os.path.getsize(OUT)//1024} KB)", flush=True)
    return 0


if __name__ == "__main__":
    sys.exit(main())
