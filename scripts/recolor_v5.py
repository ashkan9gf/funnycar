#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""paint v5 — بازرنگ کیفی GLBهای AI (جانشین v4 تخت).

ورودی:  public/assets/models/vehicles/{key}.glb  (هندسهٔ نهایی v0.2.55 — فضای بازی، جلو=-Z)
خروجی:  همان فایل + _lod1.glb (+ کپی در scripts/assets برای هارنس رندر)

v5 نسبت به v4 (تختِ توپلاستیکی که کاربر رد کرد):
  ۱) کاوِیتی AO بیک‌شده: درز درها/قوس چرخ/اتصال سپر تیره می‌شود (برجستگی کمی روشن)
  ۲) گرادیان شیشه: بالای شیشه بازتاب آسمان (روشن‌تر) → پایین تیره
  ۳) حاشیهٔ تریم دور شیشه (۱-۲ حلقهٔ همسایگی) — قاب لاستیکی پنجره
  ۴) گرادیان عمودی بدنه: رکاب کمی تیره‌تر
  ۵) تفکیک چرخ (مثل v4) + متریال جدا: funnycar_tire مات / funnycar_paint براق‌تر
  ۶) تفکیک چراغ جلو/عقب به مش‌های نام‌دار → موتور برایشان emissive می‌گذارد (نور شب)
  ۷) آلفا: فقط رأس‌های ناحیهٔ بدنهٔ واقعی α=۱ → بازرنگ گاراژ شیشه/چراغ را خراب نمی‌کند

فضا: ماسک‌ها مثل paint_car در فضای +Z جلو (V_mesh = V @ FLIP) اجرا می‌شوند.
Usage: python3 scripts/recolor_v5.py <key>
"""
import os
import shutil
import sys

import numpy as np
import trimesh
import scipy.spatial as spt
from pygltflib import GLTF2

KEY = sys.argv[1]
PUB = "/home/z/my-project/public/assets/models/vehicles"
HARN = "/home/z/my-project/scripts/assets/models/vehicles"
# منبع همیشه پاک‌ترین نسخه (v0.2.55) — خروجی روی public می‌نویسد؛ اسکریپت idempotent می‌ماند
IN = f"/home/z/my-project/scripts/raw_assets/models/vehicles/{KEY}.glb"
OUT = f"{PUB}/{KEY}.glb"
FLIP = np.diag([-1.0, 1.0, -1.0]).astype(np.float64)

# ---------- پالت‌ها از paint_car.py (بخش CARS — sRGB) ----------
_src = open("/home/z/my-project/scripts/paint_car.py", encoding="utf-8").read()
_ns: dict = {}
sys.argv = ["paint_car", "in.glb", KEY if KEY != "pride" else "player", "shape", "45000", "0"]
exec(_src.split("def srgb_to_linear")[0], _ns)
CARS: dict = _ns["CARS"]
cfg = CARS[KEY if KEY in CARS else "player"]
# پراید قرمز کمی روشن‌تر و اشباع‌تر (بازخورد کاربر: رنگ تختِ تیره توپلاستیکی بود)
if KEY in ("player", "pride"):
    cfg["body"] = [0.78, 0.105, 0.115]
    cfg["tail_nx"] = 0.55  # چراغ عقب پراید — v4 با ۱٫۰ هیچ‌وقت روشن نمی‌شد
    # شیشهٔ کارتونی: آبی‌خاکستری متوسط (نه سیاه) + هایلایت آسمان
    cfg["glass"] = [0.20, 0.27, 0.33]
    cfg["tail_r"] = (0.10, 0.34, 0.50)
# 🔧 v5r2: ماسک‌های شیشه/چراغ تنگ‌تر (r1: شیشه تا پشت سقف می‌رفت، چراغ کل گوشهٔ جلو را می‌گرفت)
if KEY in ("player", "pride"):
    cfg["glass_fn_y"] = 0.30
    cfg["glass_ny"] = (0.52, 0.90)
    cfg["glass_nz"] = (0.18, 0.78)
    cfg["head_r"] = (0.90, 0.34, 0.50, 0.60)
    cfg["head_fn_z"] = 0.55
    cfg["low_ny"] = 0.24


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
RIM_LIN = srgb_to_linear([0.70, 0.72, 0.75])
TRIM_LIN = np.array(cfg["plastic"], np.float32) * 0.72


# ---------- بارگذاری merged ----------
def load_merged(path: str):
    sc = trimesh.load(path, force="scene")
    Vs, Fs = [], []
    off = 0
    for g in sc.geometry.values():
        v = np.asarray(g.vertices, np.float64)
        f = np.asarray(g.faces, np.int64)
        Vs.append(v)
        Fs.append(f + off)
        off += len(v)
    V = np.concatenate(Vs, 0)
    F = np.concatenate(Fs, 0)
    return V, F


# ---------- ماسک‌های هندسی (مثل paint_faces — فضای +Z جلو) ----------
def zone_masks(Vm: np.ndarray, F: np.ndarray):
    meshA = trimesh.Trimesh(Vm, F, process=False)
    fn = np.asarray(meshA.face_normals)
    fc = Vm[F].mean(axis=1)
    bmin, bmax = Vm.min(0), Vm.max(0)
    ext = np.maximum(bmax - bmin, 1e-6)
    ny = (fc[:, 1] - bmin[1]) / ext[1]
    nz = (fc[:, 2] - bmin[2]) / ext[2]
    nx_abs = np.abs((fc[:, 0] - bmin[0]) / ext[0] - 0.5) * 2

    gny0, gny1 = cfg["glass_ny"]
    gnz0, gnz1 = cfg["glass_nz"]
    # 🔒 سقف سراسری — بیکِ v4 برای رأس تخت تنظیم بود؛ در تکسچرِ تیز، سرریز فاحش دیده می‌شود
    gny1 = min(gny1, 0.90)
    gnz0 = max(gnz0, 0.16)
    gnz1 = min(gnz1, 0.80)
    gfy = min(cfg["glass_fn_y"], 0.42)
    GLASS_F = (ny > gny0) & (ny < gny1) & (nz > gnz0) & (nz < gnz1) & (np.abs(fn[:, 1]) < gfy)
    cent0 = fc
    tree0 = spt.cKDTree(cent0)
    _, nn0 = tree0.query(cent0, k=7)
    if GLASS_F.sum() > 0:
        # صاف‌سازی مرز شیشه: open (حذف نقطهٔ پراکنده) بعد close (پُرکردن حفرهٔ داخلی)
        for _ in range(2):
            gcnt = GLASS_F[nn0].sum(axis=1)
            GLASS_F = GLASS_F & (gcnt >= 3)
        gcnt = GLASS_F[nn0].sum(axis=1)
        GLASS_F = GLASS_F | (gcnt >= 5)
        gcnt = GLASS_F[nn0].sum(axis=1)
        GLASS_F = GLASS_F | (gcnt >= 4)
        # یک دور open پایانی برای لبهٔ صاف‌تر
        gcnt = GLASS_F[nn0].sum(axis=1)
        GLASS_F = GLASS_F & (gcnt >= 2)
    PLASTIC_F = ((ny < cfg.get("low_ny", 0.26)) & ((nz > cfg.get("plastic_nz_hi", 0.90)) | (nz < cfg.get("plastic_nz_lo", 0.10))) & ~GLASS_F) | \
                ((ny < cfg["rocker_ny"]) & (np.abs(fn[:, 1]) < 0.5) & ~GLASS_F) | \
                ((fn[:, 1] < -0.62) & (ny < 0.42) & ~GLASS_F)
    # حذف اسپیک‌های پراکندهٔ پلاستیک (۱ دور open)
    if PLASTIC_F.sum() > 0:
        PLASTIC_F = PLASTIC_F & (PLASTIC_F[nn0].sum(axis=1) >= 3)
    TIRE_F = (ny < cfg["tire_ny"]) & (nx_abs > cfg["tire_nx"])
    gz = cfg["grille_r"]
    GRILLE_F = (nz > gz[0]) & (nx_abs < gz[1]) & (ny > gz[2]) & (ny < gz[3]) & (fn[:, 2] > 0.5)
    hr = cfg["head_r"]
    HEAD_F = (nz > hr[0]) & (ny > max(hr[1], 0.30)) & (ny < min(hr[2], 0.52)) & \
             (nx_abs > max(hr[3], 0.45)) & (fn[:, 2] > max(cfg.get("head_fn_z", 0.3), 0.62))
    pnz0, pnz1 = cfg["plate_nz"]
    pny = cfg["plate_ny"]
    pny0, pny1 = (pny, pny + 1e-9) if isinstance(pny, (int, float)) else pny
    PLATE_F = (ny > pny0) & (ny < pny1) & ((nz > pnz0) | (nz < pnz1)) & (np.abs(fn[:, 2]) > cfg["plate_fn_z"]) & (nx_abs < cfg["plate_nx"])
    tr0, ty0, ty1 = cfg["tail_r"]
    TAIL_F = (nz < min(tr0, 0.08)) & (ny > ty0) & (ny < ty1) & \
             (np.abs(fn[:, 2]) > 0.82) & (nx_abs > max(cfg.get("tail_nx", 1.0), 0.60))
    BED_F = np.zeros(len(F), bool)
    if cfg.get("bed"):
        b = cfg["bed"]
        BED_F = (nz < b["nz"]) & (ny > b["ny"][0]) & (ny < b["ny"][1]) & (fn[:, 1] > b["fn_y"])
    STRIPE_F = np.zeros(len(F), bool)
    if cfg.get("stripe"):
        s = cfg["stripe"]
        STRIPE_F = (ny > s["ny"][0]) & (ny < s["ny"][1]) & (nz > s["nz"][0]) & (nz < s["nz"][1]) & \
                   (np.abs(fn[:, 2]) < 0.40) & ~GLASS_F
    return {"glass": GLASS_F, "plastic": PLASTIC_F, "tire": TIRE_F, "grille": GRILLE_F,
            "head": HEAD_F, "plate": PLATE_F, "tail": TAIL_F, "bed": BED_F, "stripe": STRIPE_F,
            "ny": ny, "fn": fn, "fc": fc}


# ---------- کاوِیتی AO per-face ----------
def cavity_face(V: np.ndarray, F: np.ndarray):
    tm = trimesh.Trimesh(V, F, process=False)
    vn = np.asarray(tm.vertex_normals, np.float64)
    tree = spt.cKDTree(V)
    _, nn = tree.query(V, k=17)
    nb = V[nn[:, 1:]]
    cen = nb.mean(axis=1)
    off = ((cen - V) * vn).sum(1)
    # نرمال‌سازی خودکار: عمق واقعی درزها ≈ صدک ۹۶ آفست‌های مثبت
    pos = off[off > 1e-4]
    scale = float(np.percentile(pos, 96)) if len(pos) > 200 else 0.02 * float((V.max(0) - V.min(0))[2])
    scale = max(scale, 1e-3)
    cav_v = np.clip(off / scale, 0.0, 1.0)
    conv_v = np.clip(-off / scale, 0.0, 1.0)
    fc = V[F].mean(axis=1)
    tf = spt.cKDTree(fc)
    _, n2 = tf.query(fc, k=8)
    cav_f = cav_v[F].mean(1)
    conv_f = conv_v[F].mean(1)
    cav_f = cav_f[n2].mean(1)
    cav_f = cav_f[n2].mean(1)
    conv_f = conv_f[n2].mean(1)
    return cav_f.astype(np.float32), conv_f.astype(np.float32)


# ---------- تفکیک چرخ (v5: reach مقیاس‌لاستیک + fallback ته باند برای چرخ عقب) ----------
def split_wheels(V: np.ndarray, F: np.ndarray, tire_f: np.ndarray):
    import trimesh.graph as tgraph
    sub = trimesh.Trimesh(V, F, process=False)
    try:
        fa = np.asarray(sub.face_adjacency)
        fa_edges = fa[(tire_f[fa[:, 0]]) & (tire_f[fa[:, 1]])]
        comps = tgraph.connected_components(fa_edges, nodes=np.where(tire_f)[0], min_len=1)
    except Exception as e:
        print("split: adjacency failed:", e, flush=True)
        return None
    bmin, bmax = V.min(0), V.max(0)
    ext = np.maximum(bmax - bmin, 1e-6)
    cx = 0.5 * (bmin[0] + bmax[0])
    cz = 0.5 * (bmin[2] + bmax[2])
    fcent = V[F].mean(axis=1)

    cand = []          # (face_list, centroid, ext, dia)
    for c in comps:
        cf = F[list(c)]
        fv = V[np.unique(cf)]
        e = fv.max(0) - fv.min(0)
        if len(comps) <= 24:
            cen_c = fv.mean(axis=0)
            print(f"  comp n={len(c)} ext=({e[0]:.1f},{e[1]:.1f},{e[2]:.1f}) cen=({cen_c[0]:.1f},{cen_c[2]:.1f})", flush=True)
        if len(c) >= 40 and e[0] <= 0.22 * ext[0] + 1e-3 and e[2] <= 0.22 * ext[2] + 1e-3:
            cen = fv.mean(axis=0)
            cand.append({"faces": list(c), "cen": cen, "dia": float(e[1])})
    print(f"split: {len(comps)} comps → {len(cand)} compact candidates", flush=True)

    # باکت چهارگوشه: کاندید به محلهٔ خودش
    buckets: dict[tuple, list] = {}
    for cd in cand:
        key = (bool(cd["cen"][0] >= cx), bool(cd["cen"][2] >= cz))
        buckets.setdefault(key, []).append(cd)

    # fallback: محلهٔ خالی/خراب (تکه‌های ریز) ← دیسک دور مرکز لاستیکِ تخمینی از بزرگ‌ترین کامپوننتِ همان محله
    def fallback_bucket(key: tuple) -> list | None:
        qmask = np.array([k0 == key[0] and k1 == key[1] for k0, k1 in
                          zip(fcent[:, 0] >= cx, fcent[:, 2] >= cz)])
        qf = np.where(tire_f & qmask)[0]
        if len(qf) < 80:
            return None
        best, best_n = None, 0
        for c in comps:
            inter = len(np.intersect1d(np.asarray(c), qf, assume_unique=False))
            if inter > best_n:
                best_n, best = inter, c
        if best is None or best_n < 80:
            return None
        cf = F[list(best)]
        fv = V[np.unique(cf)]
        e = fv.max(0) - fv.min(0)
        dia = float(e[1])
        wy = float(fv[:, 1].min() + 0.5 * e[1])
        wz = float(fv[:, 2].max() - 0.5 * e[1]) if key[1] else float(fv[:, 2].min() + 0.5 * e[1])
        wx = float(fv[:, 0].mean())
        cc = fcent[best]
        disc = (np.sqrt((cc[:, 1] - wy) ** 2 + (cc[:, 2] - wz) ** 2) <= 0.62 * dia) & \
               (np.abs(cc[:, 0] - wx) <= 0.40 * dia)
        sub_faces = list(np.asarray(best)[disc])
        if len(sub_faces) < 60:
            return None
        return [{"faces": sub_faces, "cen": fcent[sub_faces].mean(axis=0), "dia": dia}]

    ref_dia = max((cd["dia"] for cd in cand), default=0.0)
    for key in [(True, True), (True, False), (False, True), (False, False)]:
        cur = buckets.get(key, [])
        cur_max_dia = max((cd["dia"] for cd in cur), default=0.0)
        print(f"  bucket {key}: n_items={len(cur)} max_dia={cur_max_dia:.1f} "
              f"faces={[len(cd['faces']) for cd in cur]}", flush=True)
        if not cur or cur_max_dia < 0.62 * ref_dia:
            fb = fallback_bucket(key)
            if fb is not None:
                buckets[key] = fb
                print(f"  fallback {key}: disc faces={len(fb[0]['faces'])} dia={fb[0]['dia']:.1f}", flush=True)

    anchors: dict[tuple, list] = {}
    for key, items in buckets.items():
        anchor = max(items, key=lambda t: len(t["faces"]))
        af = np.asarray(anchor["faces"], np.int64)
        afc = fcent[af]
        dia = anchor["dia"]
        # مرکز لاستیک = مرکز bbox خود لاستیک؛ دیسک per-face — تکهٔ گلگیر/زیربدنه حذف می‌شود
        wy = 0.5 * (afc[:, 1].min() + afc[:, 1].max())
        wz = 0.5 * (afc[:, 2].min() + afc[:, 2].max())
        wx = float(np.median(afc[:, 0]))
        reach = 0.62 * dia
        keep = []
        for cd in items:
            cc = fcent[cd["faces"]]
            dmask = (np.sqrt((cc[:, 1] - wy) ** 2 + (cc[:, 2] - wz) ** 2) <= reach) & \
                    (np.abs(cc[:, 0] - wx) <= 0.40 * dia)
            keep.extend(np.asarray(cd["faces"])[dmask].tolist())
        anchors[key] = keep

    if len(anchors) != 4 or any(len(v) < 60 for v in anchors.values()):
        print(f"split: anchors={ {k: len(v) for k, v in anchors.items()} } → single mesh", flush=True)
        return None
    wheel_of_face = np.full(len(F), -1, np.int64)
    wi = 0
    for key in sorted(anchors.keys()):
        wheel_of_face[np.asarray(anchors[key], np.int64)] = wi
        wi += 1
    print(f"split: wheel sizes={[len(v) for v in anchors.values()]}", flush=True)
    return wheel_of_face


# ---------- رنگ بدنه ----------
def paint_body(fidx: np.ndarray, M: dict, cav: np.ndarray, conv: np.ndarray):
    """fidx: اندیس فیس‌های بدنه در فضای مش کامل → رنگ per-face + ماسک بازرنگ‌پذیر."""
    n = len(fidx)
    col = np.tile(np.array(cfg["body"], np.float32), (n, 1))
    ny = M["ny"][fidx]
    fn = M["fn"][fidx]
    cavb = cav[fidx]
    convb = conv[fidx]
    # ۱) کاوِیتی: فقط درزهای واقعاً عمیق (شیب‌دار) — دره‌های پهن نباید لکهٔ تیره بسازند
    cavb2 = np.clip((cavb - 0.50) / 0.35, 0.0, 1.0)
    shade = 1.0 - 0.30 * cavb2 + 0.05 * convb
    shade = np.clip(shade, 0.80, 1.08)
    # ۲) گرادیان عمودی: رکاب کمی تیره‌تر (گردوخاک جاده)
    shade *= 1.0 - 0.12 * np.clip(1.0 - ny, 0, 1) ** 1.7
    col *= shade[:, None]

    glass_m = M["glass"][fidx]
    trim1 = M["trim1"][fidx]
    trim2 = M["trim2"][fidx]
    plastic_m = M["plastic"][fidx] & ~glass_m
    grille_m = M["grille"][fidx]
    head_m = M["head"][fidx]
    tail_m = M["tail"][fidx]
    plate_m = M["plate"][fidx]
    bed_m = M["bed"][fidx] if cfg.get("bed") else np.zeros(n, bool)
    stripe_m = M["stripe"][fidx] if cfg.get("stripe") else np.zeros(n, bool)

    if plastic_m.any():
        col[plastic_m] = np.array(cfg["plastic"], np.float32) * (1 - 0.25 * cavb[plastic_m])[:, None]
    if bed_m.any():
        col[bed_m] = np.array(cfg["bed"]["color"], np.float32) * (1 - 0.25 * cavb[bed_m])[:, None]
    if stripe_m.any():
        col[stripe_m] = np.array(cfg["stripe"]["color"], np.float32) * (1 - 0.15 * cavb[stripe_m])[:, None]
    if grille_m.any():
        col[grille_m] = np.array(cfg["grille"], np.float32) * (1 - 0.2 * cavb[grille_m])[:, None]
    if plate_m.any():
        col[plate_m] = np.array(cfg["plate"], np.float32)
    if head_m.any():
        col[head_m] = np.array(cfg["head"], np.float32) * (1 - 0.15 * cavb[head_m])[:, None]
    if tail_m.any():
        col[tail_m] = np.array(cfg["tail"], np.float32) * (1 - 0.15 * cavb[tail_m])[:, None]
    # ۳) شیشه: گرادیان آسمان — بالا روشن‌تر (بازتاب)، پایین تیره
    if glass_m.any():
        gny0, gny1 = cfg["glass_ny"]
        t = np.clip((ny[glass_m] - gny0) / max(gny1 - gny0, 1e-6), 0, 1) ** 1.2
        g0 = np.array(cfg["glass"], np.float32)
        g1 = np.clip(np.array(cfg["glass"], np.float32) * np.array([2.3, 2.4, 2.6], np.float32), 0, 1)
        col[glass_m] = g0[None, :] * (1 - t)[:, None] + g1[None, :] * t[:, None]

    # ۴) حاشیهٔ تریم دور شیشه — فقط در باند شیشه و کمی پایین‌تر (لبهٔ سقف خط تیره نگیرد)
    UP = np.abs(fn[:, 1]) >= 0.60
    ny_top = cfg["glass_ny"][1] + 0.04
    below_band = ny <= ny_top
    prot = grille_m | head_m | tail_m | plate_m | stripe_m | bed_m | glass_m
    t1v = trim1 & ~prot & ~UP & below_band
    t2v = trim2 & ~prot & ~UP & ~t1v & below_band
    if t1v.any():
        col[t1v] = 0.70 * col[t1v] + 0.30 * TRIM_LIN[None, :]
    if t2v.any():
        col[t2v] = 0.88 * col[t2v] + 0.12 * TRIM_LIN[None, :]

    # ۵) صاف‌سازی مرز شیشه/بدنه — فقط در نوار مرزی؛ بعداً نواحی محافظت‌شده دوباره قفل می‌شوند
    gzone = glass_m | trim1 | trim2
    if gzone.sum() > 0:
        loc = -np.ones(len(_FULL_F), np.int64)
        loc[fidx] = np.arange(n)
        for _rnd in range(2):
            sums = np.zeros((n, 3), np.float32)
            cnts = np.zeros(n, np.float32)
            for i in np.where(gzone)[0]:
                g = int(fidx[i])
                for nb in _NBRs.get(g, ()):
                    li = loc[nb]
                    if li >= 0:
                        sums[i] += col[li]
                        cnts[i] += 1
            ok = cnts > 0
            col[ok] = 0.55 * col[ok] + 0.45 * (sums[ok] / cnts[ok][:, None])

    # قفل متریال‌های حساس پس از هموارسازی: هموارسازی نباید رنگ لاستیک/تریم را به بدنه بکشد.
    tire_m = M["tire"][fidx]
    if tire_m.any():
        col[tire_m] = np.array(cfg["tire"], np.float32) * (1.0 - 0.28 * cavb[tire_m])[:, None]
    if trim1.any():
        col[trim1] = 0.70 * np.array(cfg["plastic"], np.float32) + 0.30 * TRIM_LIN
    if trim2.any():
        col[trim2] = 0.88 * np.array(cfg["body"], np.float32) + 0.12 * TRIM_LIN

    # تریم و لاستیک نواحی مستقل‌اند و نباید COLOR_0 بدنه روی آن‌ها ضرب شود.
    body_region = ~(glass_m | plastic_m | grille_m | head_m | tail_m | plate_m |
                    bed_m | stripe_m | trim1 | trim2 | tire_m)
    alpha = np.where(body_region, 1.0, 0.99).astype(np.float32)
    # 🔑 تکسچر جدا: بدنه = سفید×سایه (رنگ فقط در COLOR_0 — وگرنه ضربِ دوباره تیره می‌کند)
    tex_col = col.copy()
    tex_col[body_region] = shade[body_region][:, None]
    return col, alpha, body_region, tex_col


# ---------- رنگ چرخ ----------
def paint_wheel(fidx: np.ndarray, Vf: np.ndarray, cav: np.ndarray):
    sub = trimesh.Trimesh(Vf, F[fidx], process=False)
    fn = np.asarray(sub.face_normals)
    fv = Vf[np.unique(F[fidx])]
    wmin, wmax = fv.min(0), fv.max(0)
    r_est = 0.5 * (wmax[1] - wmin[1])
    cy = 0.5 * (wmin[1] + wmax[1])
    cz = 0.5 * (wmin[2] + wmax[2])
    cen = Vf[F[fidx]].mean(axis=1)
    rad = np.sqrt((cen[:, 1] - cy) ** 2 + (cen[:, 2] - cz) ** 2)
    rim = (np.abs(fn[:, 0]) > 0.72) & (rad < 0.62 * r_est)
    n = len(fidx)
    col = np.tile(np.array(cfg["tire"], np.float32), (n, 1))
    shade = 1.0 - 0.28 * cav[fidx]
    col *= shade[:, None]
    if rim.sum():
        col[rim] = RIM_LIN[None, :] * (1 - 0.12 * cav[fidx][rim])[:, None]
    print(f"wheel: rim faces={int(rim.sum())}/{n}", flush=True)
    return col, np.full(n, 0.99, np.float32)


# ---------- متریال‌ها per-part (تکسچر بدنه حفظ می‌شود) ----------
def set_gltf_mats_v5(path: str):
    import pygltflib as pg
    g = GLTF2().load(path)
    for mesh in g.meshes:
        nm = mesh.name or "funnycar_paint"
        rough = 0.85 if "tire" in nm else (0.3 if "light" in nm else 0.5)
        for prim in mesh.primitives:
            tex_ref = None
            if prim.material is not None and prim.material < len(g.materials):
                old = g.materials[prim.material]
                pbr = old.pbrMetallicRoughness
                if pbr is not None:
                    tex_ref = pbr.baseColorTexture
            pbr = pg.PbrMetallicRoughness(baseColorFactor=[1.0, 1.0, 1.0, 1.0],
                                          metallicFactor=0.0, roughnessFactor=rough)
            if tex_ref is not None:
                pbr.baseColorTexture = tex_ref
            mat = pg.Material(name=nm, pbrMetallicRoughness=pbr)
            g.materials.append(mat)
            prim.material = len(g.materials) - 1
    g.save(path)


def inject_color0(path: str, mesh_name: str, rgba8: np.ndarray, ref_pos: np.ndarray):
    """COLOR_0 (uchar normalized) به پریمیتوی body اضافه می‌کند — ترتیب رأس‌ها با POSITION چک می‌شود."""
    import pygltflib as pg
    g = GLTF2().load(path)
    done = False
    for mesh in g.meshes:
        if (mesh.name or "") != mesh_name or done:
            continue
        prim = mesh.primitives[0]
        pa = g.accessors[prim.attributes.POSITION]
        bv = g.bufferViews[pa.bufferView]
        bb = g.binary_blob() if callable(g.binary_blob) else g.binary_blob
        if bb is None:
            blob0 = b""
        elif isinstance(bb, bytes):
            blob0 = bb
        else:
            blob0 = bb.getvalue()
        off0 = bv.byteOffset or 0
        pos = np.frombuffer(blob0[off0:off0 + bv.byteLength], np.float32).reshape(-1, 3)[: pa.count]
        assert pa.count == len(ref_pos), f"pos count {pa.count} != {len(ref_pos)}"
        if not np.allclose(pos, ref_pos.astype(np.float32), atol=2e-3):
            raise RuntimeError("vertex order mismatch after export — رنگ رأسی امن نیست")
        while len(blob0) % 4:
            blob0 += b"\x00"
        off = len(blob0)
        payload = rgba8.astype(np.uint8).tobytes()
        g.set_binary_blob(blob0 + payload)
        g.bufferViews.append(pg.BufferView(buffer=0, byteOffset=off, byteLength=len(payload)))
        g.accessors.append(pg.Accessor(bufferView=len(g.bufferViews) - 1, componentType=5121,
                                       count=len(rgba8), type="VEC4", normalized=True))
        prim.attributes.COLOR_0 = len(g.accessors) - 1
        g.buffers[0].byteLength = len(blob0) + len(payload)
        done = True
    assert done, f"mesh {mesh_name} not found"
    g.save(path)


def lin_to_srgb(c: np.ndarray) -> np.ndarray:
    c = np.clip(c, 0.0, 1.0)
    return np.where(c <= 0.0031308, c * 12.92, 1.055 * np.power(c, 1.0 / 2.4) - 0.055)


def bake_body_texture(uv_vert: np.ndarray, ft: np.ndarray, fcol_lin: np.ndarray, size: int = 1024):
    """رنگ per-face را در فضای UV رستر می‌کند → تکسچر PNG.
    🔑 پس از رستر، پیکسل‌های خالی (مرز چارت‌ها) با نزدیک‌ترین رنگ foreground پر می‌شوند
    (EDT) — وگرنه bilinear/mipmap رنگ تیرهٔ پس‌زمینه را داخل بدنه می‌کشد (لکه‌های سیاه)."""
    from PIL import Image, ImageDraw
    from scipy import ndimage
    img = Image.new("RGB", (size, size), (40, 40, 44))
    cm = Image.new("L", (size, size), 0)
    dr = ImageDraw.Draw(img)
    drc = ImageDraw.Draw(cm)
    cols8 = (lin_to_srgb(fcol_lin) * 255.0).astype(np.uint8)
    uvpx = np.clip(uv_vert, 0, 1) * size
    for fi in range(len(ft)):
        tri = uvpx[ft[fi]]
        pts = [(float(tri[0, 0]), float(tri[0, 1])),
               (float(tri[1, 0]), float(tri[1, 1])),
               (float(tri[2, 0]), float(tri[2, 1]))]
        c = (int(cols8[fi, 0]), int(cols8[fi, 1]), int(cols8[fi, 2]))
        dr.polygon(pts, fill=c)
        drc.polygon(pts, fill=255)
    arr = np.asarray(img).copy()
    cov = np.asarray(cm) > 0
    if (~cov).any():
        idx = ndimage.distance_transform_edt(~cov, return_distances=False, return_indices=True)
        arr = arr[idx[0], idx[1]]
    return Image.fromarray(arr, "RGB")


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


# ================= اجرا =================
print(f"loading {IN}", flush=True)
V, F = load_merged(IN)
_FULL_F = F
print(f"mesh: v={len(V)} f={len(F)}", flush=True)
Vm = V @ FLIP  # فضای ماسک: جلو=+Z

M = zone_masks(Vm, F)
print("regions(full):", {k: int(M[k].sum()) for k in ("glass", "plastic", "tire", "grille", "head", "plate", "tail", "bed", "stripe")}, flush=True)

# حاشیهٔ تریم دور شیشه — روی همسایگی فیس‌های مش کامل (قبل از تفکیک)
from collections import defaultdict
_fa = np.asarray(trimesh.Trimesh(Vm, F, process=False).face_adjacency)
_nbrs = defaultdict(list)
for _a, _b in _fa:
    _nbrs[int(_a)].append(int(_b))
    _nbrs[int(_b)].append(int(_a))
_trim1 = np.zeros(len(F), bool)
_trim2 = np.zeros(len(F), bool)
for _s in np.where(M["glass"])[0]:
    for _nb in _nbrs.get(int(_s), ()):
        _trim1[_nb] = True
_trim1 &= ~M["glass"]
for _s in np.where(_trim1)[0]:
    for _nb in _nbrs.get(int(_s), ()):
        _trim2[_nb] = True
_trim2 &= ~_trim1 & ~M["glass"]
M["trim1"] = _trim1
M["trim2"] = _trim2
print(f"trim(global): ring1={int(_trim1.sum())} ring2={int(_trim2.sum())}", flush=True)
_NBRs = _nbrs  # برای صاف‌سازی مرز در paint_body

cav, conv = cavity_face(V, F)
print(f"cavity: mean={cav.mean():.3f} p90={np.percentile(cav, 90):.3f}", flush=True)

wof = split_wheels(V, F, M["tire"])
nF = len(F)
if wof is not None:
    parts_faces = [("body", np.where(wof < 0)[0])] + [(f"wheel_{w}", np.where(wof == w)[0]) for w in range(4)]
else:
    parts_faces = [("body", np.arange(nF))]

# چراغ‌ها از بدنه جدا شوند (مش نام‌دار → emissive موتور)
body_idx = dict(parts_faces)["body"]
HEAD_F = M["head"][body_idx]
TAIL_F = M["tail"][body_idx]
head_local = np.where(HEAD_F)[0]
tail_local = np.where(TAIL_F)[0]
light_parts = []
keep = np.ones(len(body_idx), bool)
if head_local.sum() >= 24:
    light_parts.append(("headlights_front", body_idx[head_local]))
    keep[head_local] = False
if tail_local.sum() >= 24:
    light_parts.append(("taillights_rear", body_idx[tail_local]))
    keep[tail_local] = False
print(f"light split: head={len(head_local)} tail={len(tail_local)}", flush=True)
parts_faces = [(nm, bi[keep]) if nm == "body" else (nm, bi) for nm, bi in parts_faces]
parts_faces += light_parts

scene = trimesh.Scene()
full_fcol = np.zeros((nF, 3), np.float32)
full_falpha = np.full(nF, 0.99, np.float32)
full_fbody = np.zeros(nF, bool)
body_rgba8 = None
body_pos = None

for name, fidx in parts_faces:
    if name == "body":
        col, alpha, body_region, tex_col = paint_body(fidx, M, cav, conv)
        full_fbody[fidx[body_region]] = True
    elif name.startswith("wheel"):
        col, alpha = paint_wheel(fidx, V, cav)
    else:  # چراغ‌ها — رنگ از ماسک خودشان (سرُمت/قرمز) با paint_body زیرمجموعه‌ای
        col, alpha, _, _ = paint_body(fidx, M, cav, conv)
    full_fcol[fidx] = col
    full_falpha[fidx] = alpha
    used = np.unique(F[fidx])
    remap = -np.ones(len(V), np.int64)
    remap[used] = np.arange(len(used))
    if name == "body":
        # ---------- بدنه: تکسچر بیک + COLOR_0 فقط کانال رنگ بدنه ----------
        import xatlas
        verts_b = V[used]
        faces_b = remap[F[fidx]]
        is_body = body_region
        # جداسازی رأس‌های مرزی: رأس مشترک بدنه/غیربدنه برای فیس‌های غیربدنه کپی می‌شود
        ref_nb = np.zeros(len(verts_b), bool)
        ref_nb[faces_b[~is_body].ravel()] = True
        mixed_idx = np.where(ref_nb)[0]
        dup_idx = np.full(len(verts_b), -1, np.int64)
        dup_idx[mixed_idx] = len(verts_b) + np.arange(len(mixed_idx))
        verts_s = np.vstack([verts_b, verts_b[mixed_idx]])
        faces_s = faces_b.copy()
        rows, cols2 = np.where(~is_body[:, None] & ref_nb[faces_b])
        faces_s[rows, cols2] = dup_idx[faces_b[rows, cols2]]
        print(f"body split: mixed verts={len(mixed_idx)} → v={len(verts_s)} f={len(faces_s)}", flush=True)
        # UV اتلس — خروجی xatlas: (vmapping, faces, uv per-NEW-vertex)
        # 🔑 xatlas مبدا بالا-چپ (مثل glTF) ولی trimesh مبدا پایین-چپ است و موقع اکسپورت
        # خودش v را برمی‌گرداند → باید از قبل به قرارداد trimesh تبدیل کنیم وگرنه دوبار فلیپ!
        vmapping, ft, uvc = xatlas.parametrize(verts_s.astype(np.float32), faces_s.astype(np.uint32))
        nv = verts_s[vmapping]
        uvc = np.asarray(uvc, np.float32)
        uv_vert = np.stack([uvc[:, 0], 1.0 - uvc[:, 1]], axis=1)
        assert len(uv_vert) == len(nv), f"uv {len(uv_vert)} != verts {len(nv)}"
        # 🔑 xatlas ممکن است ترتیب فیس‌ها را به‌هم بریزد — رنگ/آلفا/بدنه باید با ft هم‌تراز شوند
        # (رنگ‌ها روی ترتیبِ ورودی محاسبه شده‌اند؛ بدون این نگاشت، رنگ‌ها روی سطح جابه‌جا می‌شوند!)
        def _keys(parr):
            p = np.round(np.asarray(parr, np.float64), 3)
            p.sort(axis=1)
            return [tuple(map(tuple, pi)) for pi in p]
        _in_map: dict = {}
        for _li, _k in enumerate(_keys(verts_s[faces_s])):
            _in_map.setdefault(_k, _li)
        _perm = np.empty(len(ft), np.int64)
        _miss = 0
        for _oi, _k in enumerate(_keys(nv[ft])):
            _li = _in_map.get(_k, -1)
            if _li < 0:
                _miss += 1
                _li = _oi
            _perm[_oi] = _li
        if _miss:
            print(f"WARN: {_miss} faces unmatched in atlas alignment", flush=True)
        print(f"atlas face alignment: reordered={int((_perm != np.arange(len(ft))).sum())}/{len(ft)}", flush=True)
        col = col[_perm]
        alpha = alpha[_perm]
        body_region = body_region[_perm]
        tex_col = tex_col[_perm]
        is_body = body_region
        # کلاس رأس‌ها روی مش جداشده
        ref_nb2 = np.zeros(len(verts_s), bool)
        ref_nb2[faces_s[~is_body].ravel()] = True
        vert_body_new = (~ref_nb2)[vmapping]
        # 🔍 دیباگ: سازگاری کلاس رأس با کلاس فیس
        _nb_faces = np.where(~is_body)[0]
        _bad = 0
        for _fi in _nb_faces[:4000]:
            if vert_body_new[ft[_fi]].any():
                _bad += 1
        print(f"DBG: non-body faces with any body-vert: {_bad}/{min(4000, len(_nb_faces))}", flush=True)
        _bright = (tex_col.mean(axis=1) > 0.5)
        print(f"DBG: bright(body) texel faces: {_bright.mean():.3f}  body verts: {vert_body_new.mean():.3f}", flush=True)
        # 🔑 رستر باید با همان UVهایی باشد که در GLB نهایی اکسپورت می‌شوند = xatlas native —
        # (uv_vert برای trimesh فلیپ است؛ اکسپورتر خودش برمی‌گرداند → نهایی = native)
        uv_draw = np.stack([uvc[:, 0], uvc[:, 1]], axis=1)
        # رستر تکسچر (رنگ per-face → پیکسل)
        img = bake_body_texture(uv_draw, ft, tex_col, 1024)
        if os.environ.get("DEBUG_TEX"):
            # نقشهٔ کلاس‌ها: بدنه=قرمز، شیشه=آبی، پلاستیک=سبز، تریم۱=زرد، تریم۲=نارنجی،
            # چراغ=سفید، پلاک=فیروزه‌ای، grille=بنفش
            import trimesh as _tm
            fnl = np.asarray(_tm.Trimesh(verts_s, faces_s, process=False).face_normals)
            fcl = verts_s[faces_s].mean(axis=1)
            bm2, bx2 = verts_s.min(0), verts_s.max(0)
            ex2 = np.maximum(bx2 - bm2, 1e-6)
            _ny2 = (fcl[:, 1] - bm2[1]) / ex2[1]
            cls = np.zeros((len(ft), 3), np.float32)
            cls[:, 0] = 0.8  # بدنه قرمز
            gm = M["glass"][fidx]
            cls[gm] = [0.2, 0.4, 0.9]
            cls[M["plastic"][fidx] & ~gm] = [0.2, 0.8, 0.2]
            cls[M["trim1"][fidx] & ~gm] = [0.9, 0.9, 0.2]
            cls[M["trim2"][fidx] & ~gm] = [0.9, 0.5, 0.1]
            cls[M["head"][fidx]] = [1, 1, 1]
            cls[M["tail"][fidx]] = [1, 1, 1]
            cls[M["plate"][fidx]] = [0.1, 0.9, 0.9]
            cls[M["grille"][fidx]] = [0.6, 0.2, 0.9]
            bake_body_texture(uv_draw, ft, cls, 1024).save("/tmp/classes.png")
            # 🔍 در حالت DEBUG تکسچر خروجی = نقشهٔ کلاس‌ها تا روی خود ماشین دیده شود
            img = bake_body_texture(uv_draw, ft, cls, 1024)
            print("DEBUG: /tmp/classes.png saved + class texture exported", flush=True)
        print(f"texture: {img.size} uniq_colors≈{len(np.unique((lin_to_srgb(col)*255).astype(np.uint8).reshape(-1,3), axis=0))}", flush=True)
        # COLOR_0: بدنه = رنگ فابریک (α=۱) / بقیه = سفید (α=۰٫۹۹)
        rgba8 = np.full((len(nv), 4), 255, np.uint8)
        rgba8[~vert_body_new, 3] = 252
        blin = np.array(cfg["body"], np.float32)
        rgba8[vert_body_new, 0] = int(round(float(blin[0]) * 255))
        rgba8[vert_body_new, 1] = int(round(float(blin[1]) * 255))
        rgba8[vert_body_new, 2] = int(round(float(blin[2]) * 255))
        body_rgba8 = rgba8
        body_pos = nv
        m = trimesh.Trimesh(nv, ft, process=False)
        m.visual = trimesh.visual.TextureVisuals(uv=uv_vert, image=img)
    else:
        vsum = np.zeros((len(used), 4), np.float32)
        vcnt = np.zeros(len(used), np.float32)
        fa4 = np.concatenate([col, alpha[:, None]], 1)
        for fi_local, fi in enumerate(fidx):
            vs = F[fi]
            vsum[remap[vs]] += fa4[fi_local]
            vcnt[remap[vs]] += 1
        vcnt[vcnt == 0] = 1
        vrgba = vsum / vcnt[:, None]
        m = trimesh.Trimesh(V[used], remap[F[fidx]], process=False)
        m.visual = trimesh.visual.ColorVisuals(m, vertex_colors=vrgba)
    scene.add_geometry(m, node_name=name, geom_name=name)
    print(f"part {name}: faces={len(fidx)} verts={len(used)}", flush=True)

scene.export(OUT)
set_gltf_mats_v5(OUT)
if body_rgba8 is not None:
    inject_color0(OUT, "body", body_rgba8, body_pos)
print(f"exported: {OUT} ({os.path.getsize(OUT)//1024}KB, {len(parts_faces)} parts)", flush=True)

# ---------- LOD1 ----------
import pyfqmr
s2 = pyfqmr.Simplify()
s2.setMesh(V.astype(np.float32), F.astype(np.uint32))
s2.simplify_mesh(target_count=max(6000, int(nF * 0.38)), verbose=False)
lv, lf, _ = s2.getMesh()
lv = np.asarray(lv)
lf = np.asarray(lf)
vcol_full, valpha_full = faces_to_vcol4(F, full_fcol, np.where(full_fbody)[0] if full_fbody.any() else np.array([], np.int64), len(V))
_, lnn = spt.cKDTree(V).query(lv, k=1)
lrgba = np.ones((len(lv), 4), np.float32)
lrgba[:, :3] = vcol_full[lnn]
lrgba[:, 3] = np.where(valpha_full[lnn] > 0.5, 1.0, 0.99)
lm = trimesh.Trimesh(lv, lf, process=False)
lm.visual = trimesh.visual.ColorVisuals(lm, vertex_colors=lrgba)
LOUT = OUT.replace(".glb", "_lod1.glb")
lm.export(LOUT)
set_gltf_mats_v5(LOUT)
print(f"LOD1: {LOUT} ({os.path.getsize(LOUT)//1024}KB, f={len(lf)})", flush=True)

# کپی برای هارنس رندر
os.makedirs(HARN, exist_ok=True)
shutil.copy(OUT, f"{HARN}/{KEY}.glb")
shutil.copy(LOUT, f"{HARN}/{KEY}_lod1.glb")
print("DONE", flush=True)
