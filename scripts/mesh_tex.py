#!/usr/bin/env python3
"""پردازش محلی مش سفید Hunyuan → GLB تکسچرخورده مناسب بازی.
مراحل: decimate → xatlas UV → نمونه‌رنگ از نمای‌های مرجع → atlas rasterize → GLB
Usage: python3 scripts/mesh_tex.py <mesh.glb> <name> [faces=45000]
نماها: /tmp/views/<name>_{front,back,side,top}.png (RGBA، پس‌زمینه شفاف)
"""
import os, sys

import numpy as np
import trimesh
import xatlas
from PIL import Image
import pyfqmr

MESH = sys.argv[1] if len(sys.argv) > 1 else "/home/z/my-project/download/tripo/player_shape.glb"
NAME = sys.argv[2] if len(sys.argv) > 2 else "player"
TARGET_FACES = int(sys.argv[3]) if len(sys.argv) > 3 else 45000
ATLAS = 1024
VDIR = f"/tmp/views/{NAME}"
OUT = f"/home/z/my-project/download/tripo/{NAME}.glb"


def load_views():
    """نماها: front(+z→−z دید از جلو), back, side, top — هر کدام RGBA یا None"""
    views = {}
    for k in ("front", "back", "side", "top"):
        p = os.path.join(VDIR, f"{k}.png")
        views[k] = Image.open(p).convert("RGBA") if os.path.exists(p) else None
    return views


def main() -> int:
    m = trimesh.load(MESH, force="mesh")
    print(f"loaded: v={len(m.vertices)} f={len(m.faces)}")

    # ۱) تمیزکاری + decimate (بدون تمیزکاری، pyfqmr خروجی خراب می‌دهد)
    m.merge_vertices(merge_tex=True, merge_norm=True)
    m.update_faces(m.nondegenerate_faces())
    m.update_faces(m.unique_faces())
    m.update_faces(m.nondegenerate_faces())
    m.remove_unreferenced_vertices()
    print(f"cleaned: v={len(m.vertices)} f={len(m.faces)}")
    if len(m.faces) > TARGET_FACES:
        s = pyfqmr.Simplify()
        s.setMesh(m.vertices.astype(np.float32), m.faces.astype(np.uint32))
        s.simplify_mesh(target_count=TARGET_FACES, verbose=False)
        v, f, _ = s.getMesh()
        m = trimesh.Trimesh(np.asarray(v), np.asarray(f))
    print(f"decimated: v={len(m.vertices)} f={len(m.faces)}")

    # ۲) UV
    vmapping, ft, uv = xatlas.parametrize(m.vertices, m.faces)
    print("uv done:", uv.shape)

    # رأس‌ها/فیس‌ها به ترتیب xatlas
    verts = m.vertices[vmapping]
    faces = ft

    views = load_views()

    # ۳) پروجکشن هر رأس در هر نما (اورتوگرافیک)
    #    front: دید از −Z  → (x,y) | back: +Z → (−x,y) | side: ±X → (z,y) | top: +Y → (x,−z)
    ext = m.extents
    cx, cy, cz = m.bounds.mean(axis=0)
    P = verts - [cx, cy, cz]
    half = (ext / 2).max() * 1.05
    normals = trimesh.Trimesh(verts, faces, process=False).face_normals

    def proj(k):
        if k == "front":
            # جلو مش +Z است — نمای جلو باید به فیس‌های +Z بخورد
            return np.stack([P[:, 0], P[:, 1]], axis=1), np.array([0, 0, 1.0])
        if k == "back":
            return np.stack([-P[:, 0], P[:, 1]], axis=1), np.array([0, 0, -1.0])
        if k == "side":
            # تصویر side رو به چپ است → جلو (+Z) باید سمت چپ تصویر بیفتد
            return np.stack([-P[:, 2], P[:, 1]], axis=1), np.array([1.0, 0, 0])
        if k == "top":
            # تصویر top: جلو بالای تصویر → +Z → ردیف ۰
            return np.stack([P[:, 0], P[:, 2]], axis=1), np.array([0, 1.0, 0])
        raise ValueError(k)

    projs = {k: (proj(k)[0], proj(k)[1], img) for k, img in views.items() if img is not None}

    # ۴) نمونه‌رنگ با رندر نرم‌افزاری + z-buffer (فیس فقط وقتی رنگ می‌گیرد که «واقعاً دیده شود»)
    RES = 512
    fnorm = trimesh.Trimesh(verts, faces, process=False).face_normals
    fcent = verts[faces].mean(axis=1)
    tri2 = verts[faces]

    def zbuffer_and_uv(k):
        """z-buffer ارتوگرافیک + مختصات تصویر مرکز فیس‌ها برای نمای k"""
        if k == "front":
            q = np.stack([tri2[:, :, 0], tri2[:, :, 1]], 2)
            c2d = np.stack([fcent[:, 0], fcent[:, 1]], 1)
            depth = tri2[:, :, 2].mean(1)
            cd = fcent[:, 2]
        elif k == "back":
            q = np.stack([-tri2[:, :, 0], tri2[:, :, 1]], 2)
            c2d = np.stack([-fcent[:, 0], fcent[:, 1]], 1)
            depth = -tri2[:, :, 2].mean(1)
            cd = -fcent[:, 2]
        elif k == "side":
            q = np.stack([-tri2[:, :, 2], tri2[:, :, 1]], 2)
            c2d = np.stack([-fcent[:, 2], fcent[:, 1]], 1)
            depth = tri2[:, :, 0].mean(1)
            cd = fcent[:, 0]
        else:
            q = np.stack([tri2[:, :, 0], tri2[:, :, 2]], 2)
            c2d = np.stack([fcent[:, 0], fcent[:, 2]], 1)
            depth = -tri2[:, :, 1].mean(1)
            cd = -fcent[:, 1]
        px = (c2d[:, 0] / half * 0.5 + 0.5) * (RES - 1)
        py = (1 - (c2d[:, 1] / half * 0.5 + 0.5)) * (RES - 1)
        zb = np.full((RES, RES), 1e9, np.float32)
        qx = (q[:, :, 0] / half * 0.5 + 0.5) * (RES - 1)
        qy = (1 - (q[:, :, 1] / half * 0.5 + 0.5)) * (RES - 1)
        for fi in range(len(faces)):
            x0 = max(0, int(min(qx[fi, 0], qx[fi, 1], qx[fi, 2]))); x1 = min(RES - 1, int(max(qx[fi, 0], qx[fi, 1], qx[fi, 2])) + 1)
            y0 = max(0, int(min(qy[fi, 0], qy[fi, 1], qy[fi, 2]))); y1 = min(RES - 1, int(max(qy[fi, 0], qy[fi, 1], qy[fi, 2])) + 1)
            if x1 <= x0 or y1 <= y0:
                continue
            xs, ys = np.meshgrid(np.arange(x0, x1), np.arange(y0, y1))
            d = ((qx[fi, 1] - qx[fi, 0]) * (qy[fi, 2] - qy[fi, 0]) - (qx[fi, 2] - qx[fi, 0]) * (qy[fi, 1] - qy[fi, 0]))
            if abs(d) < 1e-9:
                continue
            w0 = ((qx[fi, 1] - xs) * (qy[fi, 2] - ys) - (qx[fi, 2] - xs) * (qy[fi, 1] - ys)) / d
            w1 = ((qx[fi, 2] - xs) * (qy[fi, 0] - ys) - (qx[fi, 0] - xs) * (qy[fi, 2] - ys)) / d
            w2 = 1 - w0 - w1
            ins = (w0 >= 0) & (w1 >= 0) & (w2 >= 0)
            if not ins.any():
                continue
            zval = depth[fi]
            sub = zb[ys[ins], xs[ins]]
            upd = zval < sub
            yy, xx = ys[ins][upd], xs[ins][upd]
            zb[yy, xx] = zval
        return zb, px, py, cd

    fcol = np.full((len(faces), 3), 0.85)
    bestd = np.full(len(faces), -1.0)
    for k, (_, vdir, img) in projs.items():
        d = fnorm @ vdir
        zb, px, py, cd = zbuffer_and_uv(k)
        W, H = img.size
        arr = np.asarray(img, dtype=np.float32)
        # مختصات بافر ۵۱۲ → مختصات تصویر نما
        ix = np.clip((px / (RES - 1) * (W - 1)).astype(int), 0, W - 1)
        iy = np.clip((py / (RES - 1) * (H - 1)).astype(int), 0, H - 1)
        rgba = arr[iy, ix]
        # دیده‌شدن: عمق مرکز فیس ≈ z-buffer در همان پیکسل
        visible = cd <= (zb[np.clip(py.astype(int), 0, RES - 1), np.clip(px.astype(int), 0, RES - 1)] + 0.035)
        ok = (rgba[:, 3] > 128) & (d > 0.35) & visible
        upd = ok & (d > bestd)
        fcol[upd] = rgba[upd, :3] / 255.0
        bestd[upd] = d[upd]
    n_good = int((bestd > 0).sum())
    print(f"face colors zbuffer: {n_good}/{len(faces)} دیده‌شده")
    # فیس‌های نادیده (زیرِ خودرو/شیار عمیق) → نزدیک‌ترین فیس دیده‌شده
    from scipy.spatial import cKDTree
    good = bestd > 0
    if good.any() and not good.all():
        tree = cKDTree(fcent[good])
        _, nn = tree.query(fcent[~good])
        fcol[~good] = fcol[good][nn]
    print("face colors done (zbuffer+NN)")

    # ۵) رستر روی اطلس — برای هر فیس، مثلث UV را با رنگ درون‌یابی‌شده پر می‌کنیم
    teximg = np.full((ATLAS, ATLAS, 3), 245, dtype=np.uint8)
    uvpx = np.stack([np.clip(uv[:, 0], 0, 1) * (ATLAS - 1),
                     np.clip(uv[:, 1], 0, 1) * (ATLAS - 1)], axis=1)

    # بردار-سازی سبک: مثلث‌های کوچک → پیکسل‌های داخل باندینگ‌باکس + تست باری‌سنتریک
    order = np.argsort(-((uvpx[faces[:, 0]] - uvpx[faces[:, 1]]) ** 2).sum(1))  # بزرگ اول
    for fi in order:
        tri = faces[fi]
        p0, p1, p2 = uvpx[tri]
        cc = fcol[fi]
        c0 = c1 = c2 = cc
        xmin = int(max(0, np.floor(min(p0[0], p1[0], p2[0]))))
        xmax = int(min(ATLAS - 1, np.ceil(max(p0[0], p1[0], p2[0]))))
        ymin = int(max(0, np.floor(min(p0[1], p1[1], p2[1]))))
        ymax = int(min(ATLAS - 1, np.ceil(max(p0[1], p1[1], p2[1]))))
        if xmax < xmin or ymax < ymin:
            continue
        xs, ys = np.meshgrid(np.arange(xmin, xmax + 1), np.arange(ymin, ymax + 1))
        d = (p1[0] - p0[0]) * (p2[1] - p0[1]) - (p2[0] - p0[0]) * (p1[1] - p0[1])
        if abs(d) < 1e-9:
            continue
        w0 = ((p1[0] - xs) * (p2[1] - ys) - (p2[0] - xs) * (p1[1] - ys)) / d
        w1 = ((p2[0] - xs) * (p0[1] - ys) - (p0[0] - xs) * (p2[1] - ys)) / d
        w2 = 1 - w0 - w1
        inside = (w0 >= -0.02) & (w1 >= -0.02) & (w2 >= -0.02)
        if not inside.any():
            continue
        col = (c0[None, None, :] * w0[..., None] + c1[None, None, :] * w1[..., None]
               + c2[None, None, :] * w2[..., None])
        teximg[ys[inside], xs[inside]] = (np.clip(col, 0, 1) * 255).astype(np.uint8)[inside]
    print("atlas rasterized")

    # ۶) پاکسازی اطلس: پرکردن حفره‌های داخل جزایر با رنگ همسایه + نرم‌کردن نویز
    filled = teximg.astype(np.float32)
    empty = (filled[:, :, 0] == 245) & (filled[:, :, 1] == 245) & (filled[:, :, 2] == 245)
    for _ in range(24):
        if not empty.any():
            break
        src = filled.copy()
        acc = np.zeros_like(filled)
        cnt = np.zeros(filled.shape[:2], np.float32)
        for dy, dx in ((1,0),(-1,0),(0,1),(0,-1)):
            vs = np.roll(src, (dy, dx), axis=(0, 1))
            es = np.roll(empty, (dy, dx), axis=(0, 1))
            w = (~es).astype(np.float32)
            acc += vs * w[..., None]
            cnt += w
        fillable = empty & (cnt > 0)
        filled[fillable] = (acc[fillable] / cnt[fillable][..., None])
        empty = empty & ~fillable
    teximg = filled.astype(np.uint8)
    # بلور سبک ۳×۳ برای از بین بردن خال‌های تک‌پیکسلی (لبه‌ها حفظ نسبی می‌شوند)
    p = np.pad(teximg.astype(np.float32), ((1,1),(1,1),(0,0)), mode="edge")
    teximg = ((p[:-2,:-2]+p[:-2,1:-1]+p[:-2,2:]+p[1:-1,:-2]+p[1:-1,1:-1]+p[1:-1,2:]+p[2:,:-2]+p[2:,1:-1]+p[2:,2:]) / 9.0).astype(np.uint8)
    print("atlas cleaned (gap-fill + blur)")

    tex = Image.fromarray(teximg)
    # ⚠️ مش باید در «فضای اطلس» بازسازی شود تا تعداد رأس با uv یکی باشد
    verts_atlas = m.vertices[vmapping]
    # 🔑 چرخش ۱۸۰° حول Y: جلوی مش +Z است؛ بازی −Z می‌خواهد (x→−x، z→−z)
    verts_atlas = verts_atlas @ np.diag([-1.0, 1.0, -1.0]).astype(np.float32)
    mesh2 = trimesh.Trimesh(verts_atlas, ft, process=False)
    vis = trimesh.visual.texture.TextureVisuals(uv=uv, image=tex)
    mesh2.visual = vis
    mesh2.export(OUT)
    # فیکس متریال: baseColorFactor سفید (پیش‌فرض trimesh 0.4 تیره می‌کند)
    from pygltflib import GLTF2
    g = GLTF2().load(OUT)
    for mat in g.materials:
        mat.pbrMetallicRoughness.baseColorFactor = [1.0, 1.0, 1.0, 1.0]
        mat.pbrMetallicRoughness.metallicFactor = 0.0
    g.save(OUT)
    print(f"OK → {OUT} ({os.path.getsize(OUT)//1024} KB)")
    return 0


if __name__ == "__main__":
    sys.exit(main())
