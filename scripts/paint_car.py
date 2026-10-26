#!/usr/bin/env python3
"""رنگ‌آمیزی پروسیجرال v3 — کاملاً هندسی (بدون نمونهٔ رنگ بیک → ضد لکه، ضد نویز).
v2 از «darkish» روی رنگ بیک استفاده می‌کرد → لکه‌های خاکستری پراکنده روی بدنه.
v3: شیشه/بدنه فقط با هندسه (نرمال + ارتفاع + طولی) → بدنهٔ کاملاً یکدست.

دو حالت:
  ۱) shape:  paint_car.py <car>_shape.glb <key> shape [faces] [game_len]  → GLB نهایی + lod1
  ۲) final:  paint_car.py <key>.glb <key> final                          → بازرنگ همان GLB (بدون GPU)
نکتهٔ فضایی: GLB نهایی جلو = -Z (بعد از چرخش ۱۸۰°)؛ فضای مش جلو = +Z — با diag[-1,1,-1] (خودوارون) برگرد.
"""
import os
import sys

import numpy as np
import trimesh
import scipy.spatial as spt
from pygltflib import GLTF2

IN = sys.argv[1]
KEY = sys.argv[2]
MODE = sys.argv[3] if len(sys.argv) > 3 else "final"
TARGET = int(sys.argv[4]) if len(sys.argv) > 4 else 45000
GAME_LEN = float(sys.argv[5]) if len(sys.argv) > 5 else 172.0
FLIP = np.diag([-1.0, 1.0, -1.0]).astype(np.float32)

# ---------------- پالت‌ها (هر خودرو) ----------------
CARS: dict[str, dict] = {
    "player": {  # پراید قرمز — بدنهٔ قرمز یکدست، کمربند شیشهٔ دودی
        "body": [0.70, 0.085, 0.10],
        "fix_normals": False,  # winding تأییدشدهٔ v0.2.53 دست نمی‌خورد
        "glass": [0.085, 0.12, 0.155],
        "plastic": [0.145, 0.135, 0.125],
        "tire": [0.11, 0.10, 0.095],
        "grille": [0.10, 0.095, 0.09],
        "head": [0.97, 0.94, 0.82],
        "plate": [0.93, 0.93, 0.91],
        "tail": [0.55, 0.05, 0.06],
        "glass_ny": (0.52, 0.93),   # کمربند شیشه — بالای خط کمر
        "glass_nz": (0.14, 0.84),   # داخل کابین — نه گلگیر جلو/عقب
        "glass_fn_y": 0.55,         # نرمال سرکش (نه سقف/کاپوت)
        "low_ny": 0.30,             # سپر جلو/عقب فقط
        "rocker_ny": 0.13,          # رکاب زیر در
        "tire_ny": 0.20, "tire_nx": 0.52,
        "grille_r": (0.88, 0.42, 0.28, 0.47),
        "head_r": (0.88, 0.30, 0.62, 0.40),
        "plate_ny": (0.10, 0.28), "plate_nz": (0.84, 0.16), "plate_fn_z": 0.72, "plate_nx": 0.45,
        "tail_r": (0.10, 0.32, 0.62), "tail_nx": 1.0,  # پراید: چراغ پهن تمام‌عرض
        "bed": None,
    },
    "nissan": {  # نیسان آبی — وانت؛ کابین جلو، بستر بار تیره عقب
        "body": [0.30, 0.50, 0.68],   # آبی نیسانی روشن (نه سرمه‌ای)
        "fix_normals": True,   # هندسهٔ مقعر (تخت باز) — heuristic مرکز غلط می‌زند
        "glass": [0.09, 0.13, 0.17],
        "plastic": [0.14, 0.135, 0.13],
        "tire": [0.11, 0.10, 0.095],
        "grille": [0.13, 0.125, 0.12],
        "head": [0.97, 0.94, 0.82],
        "plate": [0.93, 0.93, 0.91],
        "tail": [0.55, 0.05, 0.06],
        "glass_ny": (0.60, 0.92),   # کابین بلند است — زیر پنجره‌ها بدنه بماند (diag تأیید شد)
        "glass_nz": (0.52, 0.88),   # فقط کابین+جلوشیشه — نه گلگیر/تخت (لکهٔ تیره)
        "glass_fn_y": 0.55,
        "low_ny": 0.26,
        "rocker_ny": 0.12,
        "tire_ny": 0.18, "tire_nx": 0.52,
        "grille_r": (0.88, 0.40, 0.35, 0.58),
        "head_r": (0.88, 0.32, 0.62, 0.35),
        "plate_ny": (0.10, 0.28), "plate_nz": (0.84, 0.16), "plate_fn_z": 0.72, "plate_nx": 0.45,
        "tail_r": (0.07, 0.30, 0.62), "tail_nx": 0.55,  # نیسان: چراغ گوشه‌ای فقط
        "bed": {"nz": 0.50, "ny": (0.28, 0.62), "fn_y": 0.55, "color": [0.20, 0.20, 0.21]},
    },
}
cfg = CARS[KEY]

# GLTF COLOR_0 در فضای خطی تفسیر می‌شود؛ پالت‌ها sRGB نوشته شده‌اند → تبدیل اجباری
# (وگرنه آبی/رنگ‌های میانی به‌شدت تیره می‌شوند — باگ تیرگی نیسان!)
def srgb_to_linear(c: list) -> np.ndarray:
    c = np.asarray(c, np.float32)
    return np.where(c <= 0.04045, c / 12.92, ((c + 0.055) / 1.055) ** 2.4).astype(np.float32)


for _k, _v in list(cfg.items()):
    if isinstance(_v, list) and len(_v) == 3 and all(isinstance(x, (int, float)) for x in _v) and _k not in ("glass_ny",):
        cfg[_k] = srgb_to_linear(_v)
if cfg.get("bed"):
    cfg["bed"]["color"] = srgb_to_linear(cfg["bed"]["color"])


def paint_faces(verts: np.ndarray, faces: np.ndarray) -> np.ndarray:
    """نواحی هندسی → رنگ تخت per-face (v3)."""
    meshA = trimesh.Trimesh(verts, faces, process=False)
    fn = meshA.face_normals
    fc = verts[faces].mean(axis=1)
    bmin, bmax = verts.min(0), verts.max(0)
    ext = np.maximum(bmax - bmin, 1e-6)
    ny = (fc[:, 1] - bmin[1]) / ext[1]
    nz = (fc[:, 2] - bmin[2]) / ext[2]
    nx_abs = np.abs((fc[:, 0] - bmin[0]) / ext[0] - 0.5) * 2

    gny0, gny1 = cfg["glass_ny"]
    gnz0, gnz1 = cfg["glass_nz"]
    GLASS_F = (ny > gny0) & (ny < gny1) & (nz > gnz0) & (nz < gnz1) & (np.abs(fn[:, 1]) < cfg["glass_fn_y"])
    # سپر: پایین جلو/عقب رو به جلو/عقب | رکاب: خیلی پایین زیر در
    pnz0, pnz1 = cfg["plate_nz"]
    pny0, pny1 = (cfg["plate_ny"], cfg["plate_ny"] + 1e-9) if isinstance(cfg["plate_ny"], (int, float)) else cfg["plate_ny"]
    FACING_FB = np.abs(fn[:, 2]) > 0.5
    PLASTIC_F = ((ny < cfg["low_ny"]) & ((nz > 0.78) | (nz < 0.22)) & ~GLASS_F) | \
                ((ny < cfg["rocker_ny"]) & (np.abs(fn[:, 1]) < 0.5) & ~GLASS_F)
    TIRE_F = (ny < cfg["tire_ny"]) & (nx_abs > cfg["tire_nx"])
    gz = cfg["grille_r"]
    GRILLE_F = (nz > gz[0]) & (nx_abs < gz[1]) & (ny > gz[2]) & (ny < gz[3]) & (fn[:, 2] > 0.5)
    hr = cfg["head_r"]
    HEAD_F = (nz > hr[0]) & (ny > hr[1]) & (ny < hr[2]) & (nx_abs > hr[3]) & (fn[:, 2] > 0.3)
    PLATE_F = (ny > pny0) & (ny < pny1) & ((nz > pnz0) | (nz < pnz1)) & (np.abs(fn[:, 2]) > cfg["plate_fn_z"]) & (nx_abs < cfg["plate_nx"])
    tr0, ty0, ty1 = cfg["tail_r"]
    TAIL_F = (nz < tr0) & (ny > ty0) & (ny < ty1) & (np.abs(fn[:, 2]) > 0.3) & (nx_abs > cfg.get("tail_nx", 1.0))
    BED_F = np.zeros(len(faces), bool)
    if cfg.get("bed"):
        b = cfg["bed"]
        BED_F = (nz < b["nz"]) & (ny > b["ny"][0]) & (ny < b["ny"][1]) & (fn[:, 1] > b["fn_y"])

    out = np.tile(np.array(cfg["body"], np.float32), (len(faces), 1)).astype(np.float32)
    out[GLASS_F] = np.array(cfg["glass"], np.float32)
    out[PLASTIC_F] = np.array(cfg["plastic"], np.float32)
    out[TIRE_F] = np.array(cfg["tire"], np.float32)
    if cfg.get("bed"):
        out[BED_F] = np.array(cfg["bed"]["color"], np.float32)
    out[GRILLE_F] = np.array(cfg["grille"], np.float32)
    out[TAIL_F] = np.array(cfg["tail"], np.float32)
    out[PLATE_F] = np.array(cfg["plate"], np.float32)   # پلاک/چراغ بر بقیه ببرند
    out[HEAD_F] = np.array(cfg["head"], np.float32)
    out[PLATE_F & GLASS_F] = np.array(cfg["plate"], np.float32)
    out[HEAD_F & GLASS_F] = np.array(cfg["head"], np.float32)

    # نرم‌سازی مرز شیشه/بدنه — ۲ دور (فقط مرز هندسی)
    cent = verts[faces].mean(axis=1)
    tree = spt.cKDTree(cent)
    _, nn = tree.query(cent, k=7)
    for _ in range(2):
        smooth = out[nn].mean(axis=1)
        border = np.zeros(len(out), bool)
        for i in np.where(GLASS_F)[0]:
            border[nn[i]] = True
        mix = border & ~GLASS_F
        out[mix] = 0.45 * out[mix] + 0.55 * smooth[mix]

    counts = {"glass": int(GLASS_F.sum()), "plastic": int(PLASTIC_F.sum()), "tire": int(TIRE_F.sum()),
              "grille": int(GRILLE_F.sum()), "head": int(HEAD_F.sum()), "plate": int(PLATE_F.sum()),
              "tail": int(TAIL_F.sum()), "bed": int(BED_F.sum())}
    print(f"regions: {counts}", flush=True)
    print(f"mean: {out.mean(0).round(3)}", flush=True)
    return out


def faces_to_vcol(faces: np.ndarray, fcol: np.ndarray, nverts: int) -> np.ndarray:
    vcol = np.zeros((nverts, 3), np.float32)
    vcnt = np.zeros(nverts, np.float32)
    for fi in range(len(faces)):
        for c in faces[fi]:
            vcol[c] += fcol[fi]
            vcnt[c] += 1
    vcnt[vcnt == 0] = 1
    return vcol / vcnt[:, None]


def set_gltf_mats(path: str):
    """متریال با metallic=0 — GLB بی‌متریال → پیش‌فرض spec metallic=1 → تیره در بازی!"""
    import pygltflib as pg
    g = GLTF2().load(path)
    if not g.materials:
        pbr = pg.PbrMetallicRoughness(baseColorFactor=[1.0, 1.0, 1.0, 1.0], metallicFactor=0.0, roughnessFactor=0.9)
        mat = pg.Material(name="funnycar_vcol", pbrMetallicRoughness=pbr)
        g.materials.append(mat)
        for mesh in g.meshes:
            for prim in mesh.primitives:
                prim.material = 0
    else:
        for mat in g.materials:
            mat.pbrMetallicRoughness.metallicFactor = 0.0
            mat.pbrMetallicRoughness.roughnessFactor = 0.9
    g.save(path)


if MODE == "final":
    # ---------- حالت ۲: بازرنگ GLB نهایی (هندسه دست‌نخورده) ----------
    m = trimesh.load(IN, force="mesh")
    V = np.asarray(m.vertices, np.float32)
    F = np.asarray(m.faces)
    print(f"final glb: v={len(V)} f={len(F)}", flush=True)
    V_mesh = V @ FLIP                    # جلو: -Z → +Z (فضای مش)
    fcol = paint_faces(V_mesh, F)
    vcol = faces_to_vcol(F, fcol, len(V))
    OUT = IN                             # همان فایل — هندسه/چرخش/مقیاس/جمع‌بندی دست‌نخورده
    rgba = np.ones((len(V), 4), np.float32)
    rgba[:, :3] = vcol
    m2 = trimesh.Trimesh(V, F, process=False)
    m2.visual = trimesh.visual.ColorVisuals(m2, vertex_colors=rgba)
    m2.export(OUT)
    set_gltf_mats(OUT)
    print(f"repainted: {OUT} ({os.path.getsize(OUT)//1024}KB)", flush=True)
    sys.exit(0)

# ---------- حالت ۱: shape.glb خام → GLB بازی ----------
import xatlas
import pyfqmr

m = trimesh.load(IN, force="mesh")
m.merge_vertices(merge_tex=True, merge_norm=True)
m.update_faces(m.nondegenerate_faces())
m.update_faces(m.unique_faces())
m.remove_unreferenced_vertices()
if len(m.faces) > TARGET:
    s = pyfqmr.Simplify()
    s.setMesh(m.vertices.astype(np.float32), m.faces.astype(np.uint32))
    s.simplify_mesh(target_count=TARGET, verbose=False)
    v, f, _ = s.getMesh()
    m = trimesh.Trimesh(np.asarray(v), np.asarray(f))
print(f"mesh: v={len(m.vertices)} f={len(m.faces)}", flush=True)

vmapping, ft, _uv = xatlas.parametrize(m.vertices, m.faces)
verts = m.vertices[vmapping].astype(np.float32)
faces = ft
fcol = paint_faces(verts, faces)
vcol = faces_to_vcol(faces, fcol, len(verts))

OUT = f"/home/z/my-project/download/tripo/{KEY}.glb"
os.makedirs(os.path.dirname(OUT), exist_ok=True)
verts_atlas = verts @ FLIP
ext_z = verts_atlas[:, 2].max() - verts_atlas[:, 2].min()
scl = GAME_LEN / ext_z
verts_atlas = verts_atlas * scl
verts_atlas[:, 1] -= verts_atlas[:, 1].min()
mesh2 = trimesh.Trimesh(verts_atlas, faces, process=False)
if cfg.get("fix_normals"):
    # جهت‌دهی واقعی با حجم/رأی — heuristic مرکز برای تختِ باز (مقعر) غلط می‌زند
    mesh2.fix_normals(multibody=True)
    print("winding: fix_normals (volume-based)", flush=True)
f2 = np.asarray(mesh2.faces)
mesh2 = trimesh.Trimesh(verts_atlas, f2, process=False)
rgba = np.ones((len(verts_atlas), 4), np.float32)
rgba[:, :3] = vcol
mesh2.visual = trimesh.visual.ColorVisuals(mesh2, vertex_colors=rgba)
mesh2.export(OUT)
set_gltf_mats(OUT)
print(f"GLB: {OUT} ({os.path.getsize(OUT)//1024}KB)", flush=True)

# LOD1 = ساده‌سازی ۳۸٪ + رنگ نزدیک‌ترین رأس
s = pyfqmr.Simplify()
s.setMesh(verts_atlas.astype(np.float32), f2.astype(np.uint32))
s.simplify_mesh(target_count=max(6000, int(len(f2) * 0.38)), verbose=False)
lv, lf, _ = s.getMesh()
_, lnn = spt.cKDTree(verts_atlas).query(np.asarray(lv), k=1)
lcol = vcol[lnn]
lm = trimesh.Trimesh(np.asarray(lv), np.asarray(lf), process=False)
lrgba = np.ones((len(lv), 4), np.float32)
lrgba[:, :3] = lcol
lm.visual = trimesh.visual.ColorVisuals(lm, vertex_colors=lrgba)
LOUT = OUT.replace(".glb", "_lod1.glb")
lm.export(LOUT)
set_gltf_mats(LOUT)
print(f"LOD1: {LOUT} ({os.path.getsize(LOUT)//1024}KB, f={len(lf)})", flush=True)
