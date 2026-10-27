#!/usr/bin/env python3
"""رنگ‌آمیزی از تکسچر واقعی Hunyuan — tex_paint.py
ورودی: {key}_tex.glb (مش + تکسچر از generation_all) → خروجی: {key}.glb + _lod1.glb
۱) نمونه‌برداری تکسچر per-face (بایلینر روی UV) → ضدلکهٔ ذاتی (تراز کامل UV)
۲) نرم‌سازی همسایگی (KDTree k=7، دو دور) → حذف نویز بیک
۳) ماسک‌های هندسی فقط برای نواحی قاعده‌مند: لاستیک/پلاک/باربند/نوار + شیشهٔ شرطی
۴) آلفا: بدنه=۱٫۰ (بازرنگ گاراژ) / بقیه=۰٫۹۹ — عین قرارداد v0.2.55
۵) تفکیک ۴ چرخ + رینگ نقره‌ای + lod1 — عین paint_car v4
Usage: python3 scripts/tex_paint.py <key> [faces]
"""
import os
import sys

import numpy as np
import trimesh
import scipy.spatial as spt
from PIL import Image
from pygltflib import GLTF2

KEY = sys.argv[1]
TARGET = int(sys.argv[2]) if len(sys.argv) > 2 else 45000
TRIPO = "/home/z/my-project/download/tripo"
SRC = f"{TRIPO}/{KEY}_tex.glb"
OUT = f"{TRIPO}/{KEY}.glb"
FLIP = np.diag([-1.0, 1.0, -1.0]).astype(np.float32)

# ---------- پالت‌ها از paint_car.py (فقط بخش قبل از توابع) ----------
# pride همان player است (پالت «پراید قرمز») — argv[2] باید کلیدِ معتبر پالت باشد
sys.argv = ["paint_car", "in.glb", KEY if KEY != "pride" else "player", "shape", str(TARGET), "0"]
_src = open("/home/z/my-project/scripts/paint_car.py", encoding="utf-8").read()
_ns: dict = {}
exec(_src.split("def srgb_to_linear")[0], _ns)
CARS: dict = _ns["CARS"]
cfg = CARS[KEY if KEY in CARS else "player"]


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


# ---------- بارگذاری مش + تکسچر ----------
def load_textured(path: str):
    sc = trimesh.load(path, force="scene")
    Vs, Fs, UVs = [], [], []
    voff = 0
    tex_img = None
    for gname, g in sc.geometry.items():
        v = np.asarray(g.vertices, np.float64)
        f = np.asarray(g.faces, np.int64)
        vis = g.visual
        uv = None
        if vis is not None and vis.kind == "texture":
            uv = np.asarray(vis.uv, np.float64)
            if tex_img is None:
                mat = getattr(vis.material, "baseColorTexture", None)
                if mat is None:
                    mat = getattr(vis.material, "image", None)
                if mat is not None:
                    tex_img = mat
        if uv is None:
            uv = np.full((len(v), 2), 0.5)
        Vs.append(v); Fs.append(f + voff); UVs.append(uv)
        voff += len(v)
    V = np.concatenate(Vs, 0)
    F = np.concatenate(Fs, 0)
    UV = np.concatenate(UVs, 0)
    assert tex_img is not None, "no texture image in GLB"
    return V, F, UV, tex_img


def bilinear_sample(img: np.ndarray, uv: np.ndarray) -> np.ndarray:
    """uv در [0,1] (GLTF: بالا-چپ) → رنگ sRGB float32."""
    H, W = img.shape[:2]
    x = np.clip(uv[:, 0] * (W - 1), 0, W - 1)
    y = np.clip(uv[:, 1] * (H - 1), 0, H - 1)
    x0 = np.floor(x).astype(np.int64); x1 = np.minimum(x0 + 1, W - 1)
    y0 = np.floor(y).astype(np.int64); y1 = np.minimum(y0 + 1, H - 1)
    fx = (x - x0)[:, None]; fy = (y - y0)[:, None]
    c00 = img[y0, x0].astype(np.float32); c10 = img[y0, x1].astype(np.float32)
    c01 = img[y1, x0].astype(np.float32); c11 = img[y1, x1].astype(np.float32)
    top = c00 * (1 - fx) + c10 * fx
    bot = c01 * (1 - fx) + c11 * fx
    return (top * (1 - fy) + bot * fy).astype(np.float32)


def tex_face_colors(V, F, UV, tex_img):
    """میانگین ۴ نمونه (۳رأس + مرکز) per-face → inpaint سیاه‌های بیک (فیس‌های نادیده) → نرم‌سازی ۱ دور."""
    img = np.asarray(tex_img.convert("RGB"))
    fuv = UV[F]                       # (nF,3,2)
    cent = fuv.mean(axis=1, keepdims=True)
    samp = bilinear_sample(img, np.concatenate([fuv.reshape(-1, 2), cent.reshape(-1, 2)], 0))
    nF = len(F)
    fcol = samp[: 3 * nF].reshape(nF, 3, 3).mean(axis=1) * 0.7 + samp[3 * nF:] * 0.3
    fcol = srgb_to_linear(fcol / 255.0)
    # 🔑 بیک hy3dpaint: فیس‌های نادیده از دوربین‌ها = سیاه (پیکسل بیک‌نشده) — قبل از هر نرم‌سازی inpaint شود
    lum = fcol.mean(axis=1)
    painted = lum > 0.004  # سیاهِ بیک ≈ ۰؛ لاستیک/شیشهٔ تیره خطی ~۰٫۰۰۸-۰٫۰۱۲ — بالاتر از آستانه می‌ماند
    print(f"painted faces: {painted.mean():.2%}", flush=True)
    fc3 = V[F].mean(axis=1)
    tree = spt.cKDTree(fc3)
    _, nn = tree.query(fc3, k=9)
    for it in range(24):
        if painted.all():
            break
        bad = ~painted
        nb = nn[bad]                     # (nBad,9)
        vals = fcol[nn[bad]]             # رنگ همسایه‌ها
        ok = painted[nn[bad]]            # فقط رنگی‌ها
        w = ok.astype(np.float32)
        s = (vals * w[:, :, None]).sum(axis=1)
        cnt = w.sum(axis=1)
        fill = cnt > 0
        idx = np.where(bad)[0][fill]
        fcol[idx] = s[fill] / cnt[fill, None]
        painted[idx] = True
    if (~painted).any():
        fcol[~painted] = np.array([0.06, 0.06, 0.065], np.float32)  # زیربدنه — خاکستری تیره
    # نرم‌سازی ۱ دور فقط روی فیس‌های رنگی (سیاه دیگر وجود ندارد)
    _, nn2 = tree.query(fc3, k=7)
    fcol = fcol[nn2].mean(axis=1)
    return fcol.astype(np.float32)


# ---------- ماسک‌های هندسی (عین paint_car v4) ----------
def zone_masks(verts: np.ndarray, faces: np.ndarray):
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
    cent0 = fc
    tree0 = spt.cKDTree(cent0)
    _, nn0 = tree0.query(cent0, k=7)
    if GLASS_F.sum() > 0:
        gcnt = GLASS_F[nn0].sum(axis=1)
        GLASS_F = gcnt >= 3
    PLASTIC_F = ((ny < cfg["low_ny"]) & ((nz > 0.78) | (nz < 0.22)) & ~GLASS_F) | \
                ((ny < cfg["rocker_ny"]) & (np.abs(fn[:, 1]) < 0.5) & ~GLASS_F)
    TIRE_F = (ny < cfg["tire_ny"]) & (nx_abs > cfg["tire_nx"])
    pnz0, pnz1 = cfg["plate_nz"]
    pny = cfg["plate_ny"]
    pny0, pny1 = (pny, pny + 1e-9) if isinstance(pny, (int, float)) else pny
    PLATE_F = (ny > pny0) & (ny < pny1) & ((nz > pnz0) | (nz < pnz1)) & (np.abs(fn[:, 2]) > cfg["plate_fn_z"]) & (nx_abs < cfg["plate_nx"])
    BED_F = np.zeros(len(faces), bool)
    if cfg.get("bed"):
        b = cfg["bed"]
        BED_F = (nz < b["nz"]) & (ny > b["ny"][0]) & (ny < b["ny"][1]) & (fn[:, 1] > b["fn_y"])
    STRIPE_F = np.zeros(len(faces), bool)
    if cfg.get("stripe"):
        s = cfg["stripe"]
        STRIPE_F = (ny > s["ny"][0]) & (ny < s["ny"][1]) & (nz > s["nz"][0]) & (nz < s["nz"][1]) & \
                   (np.abs(fn[:, 2]) < 0.40) & ~GLASS_F
    gz = cfg["grille_r"]
    GRILLE_F = (nz > gz[0]) & (nx_abs < gz[1]) & (ny > gz[2]) & (ny < gz[3]) & (fn[:, 2] > 0.5)
    hr = cfg["head_r"]
    HEAD_F = (nz > hr[0]) & (ny > hr[1]) & (ny < hr[2]) & (nx_abs > hr[3]) & (fn[:, 2] > 0.3)
    tr0, ty0, ty1 = cfg["tail_r"]
    TAIL_F = (nz < tr0) & (ny > ty0) & (ny < ty1) & (np.abs(fn[:, 2]) > 0.70) & (nx_abs > cfg.get("tail_nx", 1.0))
    return GLASS_F, PLASTIC_F, TIRE_F, PLATE_F, BED_F, STRIPE_F, GRILLE_F, HEAD_F, TAIL_F


def faces_to_vcol4(faces, fcol, alpha_f, nverts):
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


def export_split(verts, faces, fcol, alpha_f, tire_f, out_path) -> int:
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
    cand = []
    for c in comps:
        cf = faces[list(c)]
        fv = verts[np.unique(cf)]
        e = fv.max(0) - fv.min(0)
        if len(c) >= 40 and e[0] <= 0.22 * ext[0] + 1e-3 and e[2] <= 0.22 * ext[2] + 1e-3:
            cand.append((list(c), verts[np.unique(cf)].mean(axis=0)))
    print(f"split: {len(comps)} comps → {len(cand)} compact candidates", flush=True)
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
    face_rgba = np.ones((len(faces), 4), np.float32)
    face_rgba[:, :3] = fcol
    face_rgba[:, 3] = 0.99
    face_rgba[alpha_f, 3] = 1.0
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
            col[:, 3] = 1.0
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


# ================= اجرا =================
print(f"loading {SRC}", flush=True)
V0, F0, UV0, TEX = load_textured(SRC)
print(f"tex mesh: v={len(V0)} f={len(F0)} tex={TEX.size}", flush=True)
fcol0 = tex_face_colors(V0, F0, UV0, TEX)
print(f"fcol0 mean: {fcol0.mean(0).round(3)}", flush=True)

# --- هندسه: ادغام → ساده‌سازی → fix_normals (عین حالت shape در paint_car) ---
m = trimesh.Trimesh(V0, F0, process=False)
m.merge_vertices(merge_tex=True, merge_norm=True)
m.update_faces(m.nondegenerate_faces())
m.update_faces(m.unique_faces())
m.remove_unreferenced_vertices()
import pyfqmr
if len(m.faces) > TARGET:
    s = pyfqmr.Simplify()
    s.setMesh(m.vertices.astype(np.float32), m.faces.astype(np.uint32))
    s.simplify_mesh(target_count=TARGET, verbose=False)
    v, f, _ = s.getMesh()
    m = trimesh.Trimesh(np.asarray(v), np.asarray(f))
if cfg.get("fix_normals", True):
    m.fix_normals(multibody=True)
    print("winding: fix_normals", flush=True)
m.remove_unreferenced_vertices()
V = np.asarray(m.vertices, np.float64)
F = np.asarray(m.faces)
print(f"final mesh: v={len(V)} f={len(F)}", flush=True)

# --- انتقال رنگ: نزدیک‌ترین فیسِ مشِ تکسچری (KDTree مراکز) ---
V_mesh = V @ FLIP
fcent_final = V_mesh[F].mean(axis=1)
fc0_mesh = V0 @ FLIP
cent0 = fc0_mesh[F0].mean(axis=1)
tree0 = spt.cKDTree(cent0)
_, nearest = tree0.query(fcent_final, k=1)
fcol = fcol0[nearest].astype(np.float32)

# --- ماسک‌ها + طبقه‌بندی بدنه از خود تکسچر (k-means + رشد ناحیه‌ای) + اوررایدها ---
GLASS_F, PLASTIC_F, TIRE_F, PLATE_F, BED_F, STRIPE_F, GRILLE_F, HEAD_F, TAIL_F = zone_masks(V_mesh, F)
PROT = TIRE_F | PLATE_F | BED_F | STRIPE_F | GRILLE_F | HEAD_F | TAIL_F


def hue_sat(c):
    mx = c.max(1)
    mn = c.min(1)
    dlt = mx - mn
    r, g, b = c[:, 0], c[:, 1], c[:, 2]
    hue = np.zeros(len(c), np.float32)
    m = dlt > 1e-6
    rm = m & (mx == r)
    gm = m & (mx == g) & ~rm
    bm = m & ~rm & ~gm
    hue[rm] = (((g - b)[rm] / dlt[rm]) / 6.0) % 1.0
    hue[gm] = ((b - r)[gm] / dlt[gm] + 2.0) / 6.0
    hue[bm] = ((r - g)[bm] / dlt[bm] + 4.0) / 6.0
    sat = dlt / np.maximum(mx, 1e-6)
    return hue, sat


from scipy.cluster.vq import kmeans2

sub = fcol[:: max(1, len(fcol) // 20000)]
ccent, _ = kmeans2(sub, 4, minit="++", seed=7, iter=14)
_d = ((fcol[:, None, :] - ccent[None, :, :]) ** 2).sum(-1)
lab = _d.argmin(1)
lum_all = fcol.mean(1)
best_k, best_n = -1, -1
for k in range(4):
    mk = lab == k
    if mk.sum() < 100:
        continue
    if lum_all[mk].mean() > 0.12 and mk.sum() > best_n:
        best_k, best_n = k, int(mk.sum())
assert best_k >= 0, f"no body cluster: {[int((lab == k).sum()) for k in range(4)]}"
seed = (lab == best_k) & ~PROT
body_col = np.median(fcol[seed], axis=0).astype(np.float32)
hue_all, sat_all = hue_sat(fcol)
hue_b, sat_b = hue_sat(body_col[None, :])
hue_b = float(hue_b[0])
sat_b = float(sat_b[0])
if sat_b > 0.10:
    hd = np.abs(((hue_all - hue_b + 0.5) % 1.0) - 0.5)
    accept = ((hd < 0.09) & (sat_all > 0.06) & (lum_all > 0.015)) | \
             ((sat_all < 0.10) & (lum_all > 0.05) & (lum_all < 0.50))  # بلور خاکستری بیک هم به بدنه می‌پیوندد
    mode = f"sat hue={hue_b:.2f}+gray"
else:
    accept = ((sat_all < 0.07) & (lum_all > 0.10)) | ((sat_all < 0.10) & (lum_all > 0.05) & (lum_all < 0.50))
    mode = "neutral+gray"
print(f"body cluster #{best_k} n={best_n} col={body_col.round(3)} mode={mode}", flush=True)

# رشد ناحیه‌ای از seed — فقط از مرزهای واقعی (شیشه/چراغ/لاستیک/پلاک) عبور نمی‌کند
meshA = trimesh.Trimesh(V_mesh, F, process=False)
fa = np.asarray(meshA.face_adjacency)
fn_m = np.asarray(meshA.face_normals)
fc_m = V_mesh[F].mean(axis=1)
bm, bx = V_mesh.min(0), V_mesh.max(0)
ex = np.maximum(bx - bm, 1e-6)
ny_m = (fc_m[:, 1] - bm[1]) / ex[1]
UP_SURFACE = (ny_m > 0.82) & (np.abs(fn_m[:, 1]) > 0.5)  # سقف/کاپوت/سقف‌عقب — همیشه رنگ بدنه
if sat_b > 0.10:
    hd = np.abs(((hue_all - hue_b + 0.5) % 1.0) - 0.5)
    accept = ((hd < 0.12) & (sat_all > 0.05) & (lum_all > 0.008)) | \
             ((sat_all < 0.12) & (lum_all > 0.035) & (lum_all < 0.50) & ~PLASTIC_F) | \
             UP_SURFACE
    mode = f"sat hue={hue_b:.2f}+gray+up"
else:
    accept = ((sat_all < 0.07) & (lum_all > 0.10)) | \
             ((sat_all < 0.10) & (lum_all > 0.03) & (lum_all < 0.50) & ~PLASTIC_F) | \
             UP_SURFACE
    mode = "neutral+gray+up"
grown = seed.copy()
for _ in range(600):
    a, b = fa[:, 0], fa[:, 1]
    ea = grown[a] & ~grown[b] & ~PROT[b] & accept[b]
    eb = grown[b] & ~grown[a] & ~PROT[a] & accept[a]
    if not (ea.any() or eb.any()):
        break
    grown[b[ea]] = True
    grown[a[eb]] = True
body_f = grown
print(f"body faces: {body_f.mean():.2%} (seed {seed.mean():.2%})", flush=True)

# بدنه تخت = رنگ میانهٔ واقعی تکسچر — ضد سایه/لکه
fcol[body_f] = body_col

# اوررایدهای قاعده‌مند (ترتیب مهم: بعد از بدنه)
if TIRE_F.sum():
    fcol[TIRE_F] = np.array(cfg["tire"], np.float32)
if PLATE_F.sum():
    fcol[PLATE_F] = np.array(cfg["plate"], np.float32)
if BED_F.sum():
    fcol[BED_F] = np.array(cfg["bed"]["color"], np.float32)
if STRIPE_F.sum():
    fcol[STRIPE_F] = np.array(cfg["stripe"]["color"], np.float32)
# شیشه: همهٔ فیس‌های باقی‌مانده در باند شیشه → پالت تیرهٔ یکدست (بلور/خاکستری حذف)
if GLASS_F.sum():
    gm = GLASS_F & ~body_f
    if gm.sum():
        fcol[gm] = np.array(cfg["glass"], np.float32)
    print(f"glass: palette={int(gm.sum())}", flush=True)
# پلاستیک/سپر: خاکستری بلور → پلاستیک تیره (پراید سپر مشکی)
pm = PLASTIC_F & ~body_f & (sat_all < 0.10) & (lum_all > 0.04) & (lum_all < 0.45)
if pm.sum():
    fcol[pm] = np.array(cfg["plastic"], np.float32)
    print(f"plastic gray→dark: {int(pm.sum())}", flush=True)
# 🔑 پاکسازی نهایی: هر فیس خاکستریِ باقی‌مانده (بلور بیک) — نیمهٔ بالا=شیشهٔ تخت، نیمهٔ پایین=پلاستیک
LEFT = ~body_f & ~TIRE_F & ~PLATE_F & ~GRILLE_F & ~HEAD_F & ~TAIL_F & ~STRIPE_F & ~BED_F
grayish = LEFT & (sat_all < 0.30) & (lum_all > 0.05) & (lum_all < 0.60)
ghi = grayish & (ny_m > 0.45)
glo = grayish & (ny_m <= 0.45)
if ghi.sum():
    fcol[ghi] = np.array(cfg["glass"], np.float32)
if glo.sum():
    fcol[glo] = np.array(cfg["plastic"], np.float32)
print(f"gray leftover → glass={int(ghi.sum())} plastic={int(glo.sum())}", flush=True)
# چراغ/جلوپنجره: رنگ واقعی تکسچر (جزئیات) — بدون اورراید
counts = {"glass": int(GLASS_F.sum()), "plastic": int(PLASTIC_F.sum()), "tire": int(TIRE_F.sum()),
          "plate": int(PLATE_F.sum()), "bed": int(BED_F.sum()), "stripe": int(STRIPE_F.sum()),
          "body": int(body_f.sum())}
print(f"regions: {counts}", flush=True)
print(f"mean: {fcol.mean(0).round(3)}", flush=True)

# --- مقیاس بازی ---
verts_atlas = V_mesh.astype(np.float64)
ext_z = verts_atlas[:, 2].max() - verts_atlas[:, 2].min()
scl = float(cfg["game_len"]) / ext_z
verts_atlas = verts_atlas * scl
verts_atlas[:, 1] -= verts_atlas[:, 1].min()

# vcol/valpha همیشه محاسبه می‌شود (LOD1 به آلفای map نیاز دارد)
vcol, valpha = faces_to_vcol4(F, fcol, body_f, len(verts_atlas))
n = export_split(verts_atlas.astype(np.float64), F, fcol, body_f, TIRE_F, OUT)
if n != 4:
    rgba = np.ones((len(verts_atlas), 4), np.float32)
    rgba[:, :3] = vcol
    rgba[:, 3] = valpha
    m2 = trimesh.Trimesh(verts_atlas, F, process=False)
    m2.visual = trimesh.visual.ColorVisuals(m2, vertex_colors=rgba)
    m2.export(OUT)
    set_gltf_mats(OUT)
    print(f"GLB single: {OUT} ({os.path.getsize(OUT)//1024}KB)", flush=True)

# --- LOD1 (عین paint_car: ساده‌سازی + رنگ نزدیک‌ترین رأس + آلفا) ---
import pyfqmr as pq2
s2 = pq2.Simplify()
s2.setMesh(verts_atlas.astype(np.float32), F.astype(np.uint32))
s2.simplify_mesh(target_count=max(6000, int(len(F) * 0.38)), verbose=False)
lv, lf, _ = s2.getMesh()
_, lnn = spt.cKDTree(verts_atlas).query(np.asarray(lv), k=1)
lrgba = np.ones((len(lv), 4), np.float32)
lrgba[:, :3] = vcol[lnn]
lrgba[:, 3] = np.where(valpha[lnn] > 0.5, 1.0, 0.99)
lm = trimesh.Trimesh(np.asarray(lv), np.asarray(lf), process=False)
lm.visual = trimesh.visual.ColorVisuals(lm, vertex_colors=lrgba)
LOUT = OUT.replace(".glb", "_lod1.glb")
lm.export(LOUT)
set_gltf_mats(LOUT)
print(f"LOD1: {LOUT} ({os.path.getsize(LOUT)//1024}KB, f={len(lf)})", flush=True)
print("DONE", flush=True)
