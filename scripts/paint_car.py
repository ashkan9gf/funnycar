#!/usr/bin/env python3
"""رنگ‌آمیزی پروسیجرال v4 — هندسی + تفکیک چرخ + آلفای ناحیهٔ بدنه.
v3: رنگ تخت هندسی (ضد لکه) — v4 افزودنی‌ها:
  ۱) fix_normals قبل از xatlas → نرمال‌های درست → ماسک‌های دقیق‌تر
  ۲) STRIPE: نوار کناری (پلیس سبز / تاکسی مشکی) با هندسهٔ جانبی
  ۳) RIM: رینگ نقره‌ای روی دیسک بیرونی چرخ‌ها
  ۴) تفکیک چرخ: مش‌های wheel_* جدا → موتور چرخش/فرمان/قالپاق را فعال می‌کند
  ۵) آلفای COLOR_0: بدنه=۱٫۰ بقیه=۰٫۰ → رنگ گاراژ در JS فقط بدنه را عوض می‌کند

دو حالت:
  ۱) shape:  paint_car.py <car>_shape.glb <key> shape [faces] [game_len]  → GLB نهایی + lod1
  ۲) final:  paint_car.py <key>.glb <key> final                          → بازرنگ/تفکیک همان GLB (بدون GPU)
نکتهٔ فضایی: GLB نهایی جلو = -Z؛ فضای مش جلو = +Z — با diag[-1,1,-1] برگرد.
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
GAME_LEN_ARG = sys.argv[5] if len(sys.argv) > 5 else None
FLIP = np.diag([-1.0, 1.0, -1.0]).astype(np.float32)
TRIPO = "/home/z/my-project/download/tripo"

# ---------------- پالت‌ها (هر خودرو) — sRGB ----------------
_STD_PLATE = {"plate_ny": (0.12, 0.26), "plate_nz": (0.90, 0.10), "plate_fn_z": 0.78, "plate_nx": 0.35}

CARS: dict[str, dict] = {
    "player": {  # پراید قرمز
        "body": [0.70, 0.085, 0.10], "fix_normals": False,
        "glass": [0.085, 0.12, 0.155], "plastic": [0.145, 0.135, 0.125],
        "tire": [0.11, 0.10, 0.095], "grille": [0.10, 0.095, 0.09],
        "head": [0.97, 0.94, 0.82], "plate": [0.93, 0.93, 0.91], "tail": [0.55, 0.05, 0.06],
        "glass_ny": (0.52, 0.93), "glass_nz": (0.14, 0.84), "glass_fn_y": 0.55,
        "low_ny": 0.30, "rocker_ny": 0.13, "tire_ny": 0.20, "tire_nx": 0.52,
        "grille_r": (0.88, 0.42, 0.28, 0.47), "head_r": (0.88, 0.30, 0.62, 0.40),
        **_STD_PLATE,
        "tail_r": (0.10, 0.32, 0.62), "tail_nx": 1.0,
        "bed": None, "game_len": 172.0,
    },
    "nissan": {  # نیسان آبی — وانت
        "body": [0.30, 0.50, 0.68], "fix_normals": True,
        "glass": [0.09, 0.13, 0.17], "plastic": [0.14, 0.135, 0.13],
        "tire": [0.11, 0.10, 0.095], "grille": [0.13, 0.125, 0.12],
        "head": [0.97, 0.94, 0.82], "plate": [0.93, 0.93, 0.91], "tail": [0.55, 0.05, 0.06],
        "glass_ny": (0.60, 0.92), "glass_nz": (0.52, 0.88), "glass_fn_y": 0.55,
        "low_ny": 0.26, "rocker_ny": 0.12, "tire_ny": 0.18, "tire_nx": 0.52,
        "grille_r": (0.88, 0.40, 0.35, 0.58), "head_r": (0.88, 0.32, 0.62, 0.35),
        **_STD_PLATE,
        "tail_r": (0.07, 0.30, 0.62), "tail_nx": 0.55,
        "bed": {"nz": 0.50, "ny": (0.28, 0.62), "fn_y": 0.55, "color": [0.20, 0.20, 0.21]},
        "game_len": 204.0,
    },
    "tiba": {  # تیبا فیروزه‌ای — هاچ‌بک جمع‌وجور
        "body": [0.36, 0.62, 0.72], "fix_normals": True,
        "glass": [0.09, 0.13, 0.17], "plastic": [0.14, 0.135, 0.13],
        "tire": [0.11, 0.10, 0.095], "grille": [0.11, 0.105, 0.10],
        "head": [0.97, 0.94, 0.82], "plate": [0.93, 0.93, 0.91], "tail": [0.55, 0.05, 0.06],
        "glass_ny": (0.56, 0.80), "glass_nz": (0.15, 0.80), "glass_fn_y": 0.55,
        "low_ny": 0.24, "rocker_ny": 0.12, "tire_ny": 0.20, "tire_nx": 0.50,
        "grille_r": (0.88, 0.38, 0.36, 0.54), "head_r": (0.88, 0.36, 0.56, 0.38),
        **_STD_PLATE,
        "tail_r": (0.06, 0.34, 0.58), "tail_nx": 0.60,
        "bed": None, "game_len": 158.0,
    },
    "peugeot405": {  # پژو ۴۰۵ سفید — سدان کشیده
        "body": [0.88, 0.885, 0.87], "fix_normals": True,
        "glass": [0.09, 0.13, 0.17], "plastic": [0.14, 0.135, 0.13],
        "tire": [0.11, 0.10, 0.095], "grille": [0.11, 0.105, 0.10],
        "head": [0.97, 0.94, 0.82], "plate": [0.93, 0.93, 0.91], "tail": [0.55, 0.05, 0.06],
        "glass_ny": (0.52, 0.90), "glass_nz": (0.16, 0.84), "glass_fn_y": 0.55,
        "low_ny": 0.26, "rocker_ny": 0.12, "tire_ny": 0.20, "tire_nx": 0.50,
        "grille_r": (0.88, 0.38, 0.32, 0.54), "head_r": (0.88, 0.32, 0.56, 0.40),
        **_STD_PLATE,
        "tail_r": (0.09, 0.32, 0.62), "tail_nx": 0.62,
        "bed": None, "game_len": 200.0,
    },
    "samand": {  # سمند نقره‌ای — سدان ملی
        "body": [0.70, 0.72, 0.74], "fix_normals": True,
        "glass": [0.09, 0.13, 0.17], "plastic": [0.14, 0.135, 0.13],
        "tire": [0.11, 0.10, 0.095], "grille": [0.11, 0.105, 0.10],
        "head": [0.97, 0.94, 0.82], "plate": [0.93, 0.93, 0.91], "tail": [0.55, 0.05, 0.06],
        "glass_ny": (0.52, 0.90), "glass_nz": (0.18, 0.84), "glass_fn_y": 0.55,
        "low_ny": 0.26, "rocker_ny": 0.12, "tire_ny": 0.20, "tire_nx": 0.50,
        "grille_r": (0.88, 0.38, 0.32, 0.54), "head_r": (0.88, 0.32, 0.56, 0.40),
        **_STD_PLATE,
        "tail_r": (0.08, 0.30, 0.66), "tail_nx": 0.50,
        "bed": None, "game_len": 208.0,
    },
    "taxi": {  # تاکسی زرد — نوار مشکی کنار
        "body": [0.96, 0.73, 0.10], "fix_normals": True,
        "glass": [0.09, 0.13, 0.17], "plastic": [0.13, 0.125, 0.12],
        "tire": [0.11, 0.10, 0.095], "grille": [0.11, 0.105, 0.10],
        "head": [0.97, 0.94, 0.82], "plate": [0.93, 0.93, 0.91], "tail": [0.55, 0.05, 0.06],
        "glass_ny": (0.52, 0.90), "glass_nz": (0.16, 0.84), "glass_fn_y": 0.55,
        "low_ny": 0.26, "rocker_ny": 0.12, "tire_ny": 0.20, "tire_nx": 0.50,
        "grille_r": (0.88, 0.38, 0.32, 0.54), "head_r": (0.88, 0.32, 0.56, 0.40),
        **_STD_PLATE,
        "tail_r": (0.08, 0.30, 0.66), "tail_nx": 0.50,
        "stripe": {"ny": (0.13, 0.30), "nz": (0.05, 0.95), "color": [0.08, 0.08, 0.08]},
        "bed": None, "game_len": 200.0,
    },
    "police": {  # پلیس سفید — نوار سبز کنار
        "body": [0.92, 0.93, 0.92], "fix_normals": True,
        "glass": [0.09, 0.13, 0.17], "plastic": [0.14, 0.135, 0.13],
        "tire": [0.11, 0.10, 0.095], "grille": [0.11, 0.105, 0.10],
        "head": [0.97, 0.94, 0.82], "plate": [0.93, 0.93, 0.91], "tail": [0.55, 0.05, 0.06],
        "glass_ny": (0.52, 0.90), "glass_nz": (0.18, 0.84), "glass_fn_y": 0.55,
        "low_ny": 0.26, "rocker_ny": 0.12, "tire_ny": 0.20, "tire_nx": 0.50,
        "grille_r": (0.88, 0.38, 0.32, 0.54), "head_r": (0.88, 0.32, 0.56, 0.40),
        **_STD_PLATE,
        "tail_r": (0.08, 0.30, 0.66), "tail_nx": 0.50,
        "stripe": {"ny": (0.28, 0.47), "nz": (0.05, 0.95), "color": [0.16, 0.50, 0.30]},
        "bed": None, "game_len": 208.0,
    },
    "renault4": {  # رنو ۴ بژ — جعبه‌ای کلاسیک
        "body": [0.80, 0.74, 0.60], "fix_normals": True,
        "glass": [0.09, 0.13, 0.17], "plastic": [0.14, 0.135, 0.13],
        "tire": [0.11, 0.10, 0.095], "grille": [0.11, 0.105, 0.10],
        "head": [0.97, 0.94, 0.82], "plate": [0.93, 0.93, 0.91], "tail": [0.55, 0.05, 0.06],
        "glass_ny": (0.46, 0.88), "glass_nz": (0.24, 0.78), "glass_fn_y": 0.55,
        "low_ny": 0.25, "rocker_ny": 0.12, "tire_ny": 0.18, "tire_nx": 0.50,
        "grille_r": (0.84, 0.42, 0.28, 0.58), "head_r": (0.84, 0.30, 0.58, 0.42),
        **_STD_PLATE,
        "tail_r": (0.08, 0.28, 0.75), "tail_nx": 0.40,
        "bed": None, "game_len": 176.0,
    },
    "vintage": {  # کلاسیک زیتونی — آبچرین کروم
        "body": [0.34, 0.38, 0.27], "fix_normals": True,
        "glass": [0.09, 0.13, 0.17], "plastic": [0.62, 0.63, 0.65],
        "tire": [0.11, 0.10, 0.095], "grille": [0.55, 0.56, 0.58],
        "head": [0.97, 0.94, 0.82], "plate": [0.93, 0.93, 0.91], "tail": [0.55, 0.05, 0.06],
        "glass_ny": (0.50, 0.88), "glass_nz": (0.20, 0.60), "glass_fn_y": 0.55,
        "low_ny": 0.26, "rocker_ny": 0.12, "tire_ny": 0.20, "tire_nx": 0.50,
        "grille_r": (0.86, 0.44, 0.28, 0.55), "head_r": (0.86, 0.30, 0.60, 0.40),
        **_STD_PLATE,
        "tail_r": (0.08, 0.30, 0.66), "tail_nx": 0.45,
        "bed": None, "game_len": 197.0,
    },
    "challenger": {  # چلنجر نارنجی — موسکل
        "body": [0.90, 0.40, 0.05], "fix_normals": True,
        "glass": [0.08, 0.11, 0.15], "plastic": [0.12, 0.115, 0.11],
        "tire": [0.10, 0.095, 0.09], "grille": [0.10, 0.095, 0.09],
        "head": [0.97, 0.94, 0.82], "plate": [0.93, 0.93, 0.91], "tail": [0.55, 0.05, 0.06],
        "glass_ny": (0.50, 0.90), "glass_nz": (0.28, 0.66), "glass_fn_y": 0.55,
        "low_ny": 0.22, "rocker_ny": 0.11, "tire_ny": 0.18, "tire_nx": 0.50,
        "grille_r": (0.88, 0.45, 0.25, 0.48), "head_r": (0.88, 0.28, 0.55, 0.45),
        **_STD_PLATE,
        "tail_r": (0.06, 0.30, 0.60), "tail_nx": 0.30,
        "bed": None, "game_len": 212.0,
    },
}
cfg = CARS[KEY]
GAME_LEN = float(GAME_LEN_ARG) if GAME_LEN_ARG else float(cfg["game_len"])


def srgb_to_linear(c) -> np.ndarray:
    c = np.asarray(c, np.float32)
    return np.where(c <= 0.04045, c / 12.92, ((c + 0.055) / 1.055) ** 2.4).astype(np.float32)


for _k, _v in list(cfg.items()):
    if isinstance(_v, list) and len(_v) == 3 and all(isinstance(x, (int, float)) for x in _v) and _k not in ("glass_ny",):
        cfg[_k] = srgb_to_linear(_v)
if cfg.get("bed"):
    cfg["bed"]["color"] = srgb_to_linear(cfg["bed"]["color"])
if cfg.get("stripe"):
    cfg["stripe"]["color"] = srgb_to_linear(cfg["stripe"]["color"])
RIM_LIN = srgb_to_linear([0.72, 0.73, 0.75])


def paint_faces(verts: np.ndarray, faces: np.ndarray):
    """نواحی هندسی → رنگ تخت per-face + ماسک چرخ/بدنه (v4)."""
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
    # پاکسازی ماسک شیشه — حذف تک‌فیس‌های پراکنده (میانهٔ همسایگی ۷تایی)
    cent0 = verts[faces].mean(axis=1)
    tree0 = spt.cKDTree(cent0)
    _, nn0 = tree0.query(cent0, k=7)
    if GLASS_F.sum() > 0:
        gcnt = GLASS_F[nn0].sum(axis=1)
        GLASS_F = gcnt >= 3
    FACING_FB = np.abs(fn[:, 2]) > 0.5
    PLASTIC_F = ((ny < cfg["low_ny"]) & ((nz > 0.78) | (nz < 0.22)) & ~GLASS_F) | \
                ((ny < cfg["rocker_ny"]) & (np.abs(fn[:, 1]) < 0.5) & ~GLASS_F)
    TIRE_F = (ny < cfg["tire_ny"]) & (nx_abs > cfg["tire_nx"])
    gz = cfg["grille_r"]
    GRILLE_F = (nz > gz[0]) & (nx_abs < gz[1]) & (ny > gz[2]) & (ny < gz[3]) & (fn[:, 2] > 0.5)
    hr = cfg["head_r"]
    HEAD_F = (nz > hr[0]) & (ny > hr[1]) & (ny < hr[2]) & (nx_abs > hr[3]) & (fn[:, 2] > 0.3)
    pnz0, pnz1 = cfg["plate_nz"]
    pny = cfg["plate_ny"]
    pny0, pny1 = (pny, pny + 1e-9) if isinstance(pny, (int, float)) else pny
    PLATE_F = (ny > pny0) & (ny < pny1) & ((nz > pnz0) | (nz < pnz1)) & (np.abs(fn[:, 2]) > cfg["plate_fn_z"]) & (nx_abs < cfg["plate_nx"])
    tr0, ty0, ty1 = cfg["tail_r"]
    TAIL_F = (nz < tr0) & (ny > ty0) & (ny < ty1) & (np.abs(fn[:, 2]) > 0.70) & (nx_abs > cfg.get("tail_nx", 1.0))
    BED_F = np.zeros(len(faces), bool)
    if cfg.get("bed"):
        b = cfg["bed"]
        BED_F = (nz < b["nz"]) & (ny > b["ny"][0]) & (ny < b["ny"][1]) & (fn[:, 1] > b["fn_y"])
    STRIPE_F = np.zeros(len(faces), bool)
    if cfg.get("stripe"):
        s = cfg["stripe"]
        STRIPE_F = (ny > s["ny"][0]) & (ny < s["ny"][1]) & (nz > s["nz"][0]) & (nz < s["nz"][1]) & \
                   (np.abs(fn[:, 2]) < 0.40) & ~GLASS_F

    out = np.tile(np.array(cfg["body"], np.float32), (len(faces), 1)).astype(np.float32)
    out[PLASTIC_F] = np.array(cfg["plastic"], np.float32)
    out[TIRE_F] = np.array(cfg["tire"], np.float32)
    if cfg.get("bed"):
        out[BED_F] = np.array(cfg["bed"]["color"], np.float32)
    out[STRIPE_F] = np.array(cfg["stripe"]["color"], np.float32) if cfg.get("stripe") else out[STRIPE_F]
    out[GLASS_F] = np.array(cfg["glass"], np.float32)
    out[GRILLE_F] = np.array(cfg["grille"], np.float32)
    out[TAIL_F] = np.array(cfg["tail"], np.float32)
    out[PLATE_F] = np.array(cfg["plate"], np.float32)
    out[HEAD_F] = np.array(cfg["head"], np.float32)
    out[PLATE_F & GLASS_F] = np.array(cfg["plate"], np.float32)
    out[HEAD_F & GLASS_F] = np.array(cfg["head"], np.float32)

    # نرم‌سازی مرز شیشه/بدنه — ۱ دور، فقط سطوح کناری (سقف/کاپوت/چراغ‌ها محافظت می‌شوند)
    # 🔑 بدون محافظت، نرم‌سازی تاریکی شیشه را تا وسط سقف/کاپوت می‌کشد (باگ سمند!)
    cent = cent0
    tree = tree0
    _, nn = tree.query(cent, k=7)
    UP_PROT = (np.abs(fn[:, 1]) >= 0.60) | GRILLE_F | HEAD_F | TAIL_F | PLATE_F
    smooth = out[nn].mean(axis=1)
    border = np.zeros(len(out), bool)
    for i in np.where(GLASS_F)[0]:
        border[nn[i]] = True
    mix = border & ~GLASS_F & ~UP_PROT
    out[mix] = 0.45 * out[mix] + 0.55 * smooth[mix]

    body_f = ~(GLASS_F | PLASTIC_F | TIRE_F | GRILLE_F | TAIL_F | PLATE_F | HEAD_F | BED_F | STRIPE_F)
    counts = {"glass": int(GLASS_F.sum()), "plastic": int(PLASTIC_F.sum()), "tire": int(TIRE_F.sum()),
              "grille": int(GRILLE_F.sum()), "head": int(HEAD_F.sum()), "plate": int(PLATE_F.sum()),
              "tail": int(TAIL_F.sum()), "bed": int(BED_F.sum()), "stripe": int(STRIPE_F.sum()),
              "body": int(body_f.sum())}
    print(f"regions: {counts}", flush=True)
    print(f"mean: {out.mean(0).round(3)}", flush=True)
    return out, body_f, TIRE_F


def faces_to_vcol4(faces: np.ndarray, fcol: np.ndarray, alpha_f: np.ndarray, nverts: int):
    """رنگ + آلفای بدنه per-face → per-vertex (آلفا: هر رأسی که به بدنه می‌رسد = ۱)."""
    vcol = np.zeros((nverts, 3), np.float32)
    vcnt = np.zeros(nverts, np.float32)
    for fi in range(len(faces)):
        for c in faces[fi]:
            vcol[c] += fcol[fi]
            vcnt[c] += 1
    vcnt[vcnt == 0] = 1
    vcol /= vcnt[:, None]
    valpha = np.full(nverts, 0.99, np.float32)
    valpha[faces[alpha_f].ravel()] = 1.0
    return vcol, valpha


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


def export_split(verts: np.ndarray, faces: np.ndarray, fcol: np.ndarray, alpha_f: np.ndarray,
                 tire_f: np.ndarray, out_path: str) -> int:
    """تفکیک ۴ چرخ از بدنه → Scene با نام wheel_N → GLB. بازگشت: تعداد چرخ جدا شده.
    کامپوننت‌های لاستیک فیلتر اندازه می‌شوند، به ۴ گوشه باکت می‌شوند،
    رینگ نقره‌ای per-wheel رنگ می‌شود و هر باکت یک مش wheel می‌شود."""
    import trimesh.graph as tgraph
    sub = trimesh.Trimesh(verts, faces, process=False)
    fn_all = np.asarray(sub.face_normals)
    try:
        fa = sub.face_adjacency
        fa_edges = fa[(tire_f[fa[:, 0]]) & (tire_f[fa[:, 1]])]
        comps = tgraph.connected_components(fa_edges, nodes=np.where(tire_f)[0], min_len=1)
    except Exception as e:
        print("split: adjacency failed:", e, flush=True)
        return 0

    bmin, bmax = verts.min(0), verts.max(0)
    ext = np.maximum(bmax - bmin, 1e-6)
    cx = 0.5 * (bmin[0] + bmax[0])
    cz = 0.5 * (bmin[2] + bmax[2])

    # فیلتر قطعات: چرخ واقعی فشرده است — نوارهای زیربدنه حذف
    cand = []
    for c in comps:
        cf = faces[list(c)]
        fv = verts[np.unique(cf)]
        e = fv.max(0) - fv.min(0)
        if len(c) >= 40 and e[0] <= 0.22 * ext[0] + 1e-3 and e[2] <= 0.22 * ext[2] + 1e-3:
            cand.append((list(c), verts[np.unique(cf)].mean(axis=0)))
    print(f"split: {len(comps)} comps → {len(cand)} compact candidates", flush=True)

    # باکت چهارگوشه: (x−cx) × (z−cz) — سپس فقط قطعات نزدیک لنگر (بزرگ‌ترین کامپوننت)
    buckets: dict[tuple, list] = {}
    for c, cen in cand:
        key = (bool(cen[0] >= cx), bool(cen[2] >= cz))
        buckets.setdefault(key, []).append((c, cen))
    anchors: dict[tuple, list] = {}
    for key, items in buckets.items():
        anchor = max(items, key=lambda t: len(t[0]))
        reach = 0.30 * max(ext[0], ext[2])
        keep = [(c, cen) for c, cen in items if np.linalg.norm(cen - anchor[1]) <= reach]
        anchors[key] = [c for c, _ in keep]
    if len(anchors) != 4 or any(sum(len(c) for c in v) < 100 for v in anchors.values()):
        print(f"split: anchors={ {k: sum(len(c) for c in v) for k, v in anchors.items()} } → single mesh", flush=True)
        return 0

    # رنگ per-face ۴کاناله: rgb از fcol — آلفا فقط نقشهٔ بازرنگ است، هرگز ۰ نمی‌شود
    # (GLTF COLOR_0 VEC4 → three.js آلفا را در رندر ضرب می‌کند؛ ۰ = شفاف/سوراخ!)
    face_rgba = np.ones((len(faces), 4), np.float32)
    face_rgba[:, :3] = fcol
    face_rgba[:, 3] = 0.99
    face_rgba[alpha_f, 3] = 1.0

    # چرخ‌ها + رینگ نقره‌ای per-wheel
    wheel_of_face = np.full(len(faces), -1, np.int64)
    wi = 0
    for key in sorted(anchors.keys()):
        fl = np.asarray([f for c in anchors[key] for f in c])
        fv = verts[np.unique(faces[fl])]
        wmin, wmax = fv.min(0), fv.max(0)
        r_est = 0.5 * (wmax[1] - wmin[1])
        cen = verts[faces[fl]].mean(axis=1)
        cy = 0.5 * (wmin[1] + wmax[1])
        cz2 = 0.5 * (wmin[2] + wmax[2])
        rad = np.sqrt((cen[:, 1] - cy) ** 2 + (cen[:, 2] - cz2) ** 2)
        rim_mask = (np.abs(fn_all[fl][:, 0]) > 0.72) & (rad < 0.62 * r_est)
        rim_idx = fl[rim_mask]
        if len(rim_idx) > 0:
            face_rgba[rim_idx, :3] = RIM_LIN
            face_rgba[rim_idx, 3] = 0.99
        wheel_of_face[fl] = wi
        wi += 1

    # خروجی: body + ۴ چرخ
    parts: list[tuple[str, np.ndarray]] = []
    for name, fmask in [("body", wheel_of_face < 0)] + [(f"wheel_{w}", wheel_of_face == w) for w in range(4)]:
        fis = fmask.nonzero()[0]
        vf = faces[fis]
        used = np.unique(vf)
        remap = -np.ones(len(verts), np.int64)
        remap[used] = np.arange(len(used))
        col = np.zeros((len(used), 4), np.float32)
        cnt = np.zeros(len(used), np.float32)
        for fi in fis:
            vs = faces[fi]
            col[remap[vs]] += face_rgba[fi]
            cnt[remap[vs]] += 1
        cnt[cnt == 0] = 1
        col /= cnt[:, None]
        if name == "body":
            col[:, 3] = 1.0  # همهٔ فیس‌های بدنه α=۱ (رنگ گاراژ فقط اینجا؛ آلفای شیشه/چرخ ۰٫۹۹ می‌ماند)
        else:
            col[:, 3] = 0.99
        m = trimesh.Trimesh(verts[used], remap[vf], process=False)
        m.visual = trimesh.visual.ColorVisuals(m, vertex_colors=col)
        parts.append((name, m))

    scene = trimesh.Scene()
    for name, m in parts:
        scene.add_geometry(m, node_name=name, geom_name=name)
    scene.export(out_path)
    set_gltf_mats(out_path)
    print(f"exported split: {out_path} ({os.path.getsize(out_path)//1024}KB, {len(parts)} parts)", flush=True)
    return 4

if MODE == "final":
    # ---------- حالت ۲: بازرنگ + تفکیک GLB نهایی (هندسهٔ مقیاس‌شده دست‌نخورده) ----------
    m = trimesh.load(IN, force="mesh")
    V = np.asarray(m.vertices, np.float32)
    F = np.asarray(m.faces)
    print(f"final glb: v={len(V)} f={len(F)}", flush=True)
    V_mesh = V @ FLIP
    fcol, body_f, tire_f = paint_faces(V_mesh, F)
    vcol, valpha = faces_to_vcol4(F, fcol, body_f, len(V))
    n = export_split(V, F, fcol, body_f, tire_f, IN)
    if n != 4:
        rgba = np.ones((len(V), 4), np.float32)
        rgba[:, :3] = vcol
        rgba[:, 3] = valpha
        m2 = trimesh.Trimesh(V, F, process=False)
        m2.visual = trimesh.visual.ColorVisuals(m2, vertex_colors=rgba)
        m2.export(IN)
        set_gltf_mats(IN)
        print(f"repainted single: {IN} ({os.path.getsize(IN)//1024}KB)", flush=True)
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
if cfg.get("fix_normals", True):
    m.fix_normals(multibody=True)
    print("winding: fix_normals (volume-based, pre-atlas)", flush=True)
m.remove_unreferenced_vertices()
print(f"mesh: v={len(m.vertices)} f={len(m.faces)}", flush=True)

vmapping, ft, _uv = xatlas.parametrize(m.vertices, m.faces)
verts = m.vertices[vmapping].astype(np.float32)
faces = ft
fcol, body_f, tire_f = paint_faces(verts, faces)
vcol, valpha = faces_to_vcol4(faces, fcol, body_f, len(verts))

OUT = f"{TRIPO}/{KEY}.glb"
os.makedirs(TRIPO, exist_ok=True)
verts_atlas = verts @ FLIP
ext_z = verts_atlas[:, 2].max() - verts_atlas[:, 2].min()
scl = GAME_LEN / ext_z
verts_atlas = verts_atlas * scl
verts_atlas[:, 1] -= verts_atlas[:, 1].min()
n = export_split(verts_atlas, faces, fcol, body_f, tire_f, OUT)
if n != 4:
    rgba = np.ones((len(verts_atlas), 4), np.float32)
    rgba[:, :3] = vcol
    rgba[:, 3] = valpha
    mesh2 = trimesh.Trimesh(verts_atlas, faces, process=False)
    mesh2.visual = trimesh.visual.ColorVisuals(mesh2, vertex_colors=rgba)
    mesh2.export(OUT)
    set_gltf_mats(OUT)
    print(f"GLB single: {OUT} ({os.path.getsize(OUT)//1024}KB)", flush=True)

# LOD1 = ساده‌سازی ۳۸٪ + رنگ نزدیک‌ترین رأس (تک‌مش — برای دوردست)
s = pyfqmr.Simplify()
s.setMesh(verts_atlas.astype(np.float32), faces.astype(np.uint32))
s.simplify_mesh(target_count=max(6000, int(len(faces) * 0.38)), verbose=False)
lv, lf, _ = s.getMesh()
_, lnn = spt.cKDTree(verts_atlas).query(np.asarray(lv), k=1)
lcol = vcol[lnn]
lrgba = np.ones((len(lv), 4), np.float32)
lrgba[:, :3] = lcol
lrgba[:, 3] = np.where(valpha[lnn] > 0.5, 1.0, 0.99)
lm = trimesh.Trimesh(np.asarray(lv), np.asarray(lf), process=False)
lm.visual = trimesh.visual.ColorVisuals(lm, vertex_colors=lrgba)
LOUT = OUT.replace(".glb", "_lod1.glb")
lm.export(LOUT)
set_gltf_mats(LOUT)
print(f"LOD1: {LOUT} ({os.path.getsize(LOUT)//1024}KB, f={len(lf)})", flush=True)
