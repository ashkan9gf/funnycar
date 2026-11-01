#!/usr/bin/env python3
"""
color_pipeline_test.py — تست واحد خط لولهٔ رنگ خودروها (v0.2.64)

اینوارنت‌های ریشه‌ای v0.2.63 که هر GLB بافته‌شده باید رعایت کند:
  ۱. فایل + LOD1 موجود و قابل پارس؛ بدون NaN؛ ایندکس‌ها در محدوده
  ۲. محور کانونی: طول روی Z (تضمین canonicalize محور v0.2.63 — وگرنه در بازی
     پهلو رانندگی می‌کند و ماسک‌ها محور عرضی می‌گیرند)
  ۳. «سقف هرگز شیشه نیست»: هیچ فیس رو‌به‌بالای نزدیک صفحهٔ سقف رنگ شیشه ندارد
     (لبهٔ بالای شیشهٔ کناری ذاتاً کمی رو‌به‌بالا است و مجاز است — فقط نوار
     بالاییِ سقف گارد می‌شود)
  ۴. «شیشهٔ پهلو زیر خط کمر ممنوع»: خط کمر = بالای دیسک چرخ + ۳۰٪ تا سقف
  ۵. باند شیشهٔ کارتونی [0.22,0.30,0.38] با گرادیان — حتماً مقداری شیشه وجود دارد

تشخیص شیشه: آبی خنثی (b>g>r با فاصلهٔ کم) — چراغ عقب (g-r بزرگ) و خاکستری متال
(r=g=b) را نمی‌گیرد.

اجرا:  /home/z/.venv/bin/python tests/color_pipeline_test.py
خروجی: جدول PASS/FAIL + کد خروج ۱ در صورت شکست (برای CI)
"""
import sys
import numpy as np
import trimesh

VEH_DIR = "/home/z/my-project/public/assets/models/vehicles"
CARS = ["player", "pride", "peugeot405", "samand", "nissan", "tiba",
        "taxi", "police", "renault4", "vintage", "challenger"]

UP, LEN = 1, 2  # محور کانونی GLB بعد از v0.2.63: Y=بالا، Z=طول


def glass_mask(rgb: np.ndarray) -> np.ndarray:
    r, g, b = rgb[..., 0], rgb[..., 1], rgb[..., 2]
    return (b - r > 0.08) & (b > 0.30) & ((g - r) < 0.16) & ((g - r) > 0.02)


def face_colors(path: str):
    """→ (face_tri_centers, face_normals, face_colors, wheel_top_y یا None، bbox)
    هندسه و رنگ جدا جمع می‌شوند: LOD1 ممکن است رنگ قابل‌استخراج نداشته باشد ولی
    گاردهای هندسی/محوری برایش باید اجرا شوند."""
    m = trimesh.load(path, process=False, force="scene")
    tris_all, tris_col, cols = [], [], []
    wheel_top = None
    for name, geom in m.geometry.items():
        g = geom.copy()
        try:
            T = m.graph.get(name)[0]
            if T is not None:
                g.apply_transform(T)
        except Exception:
            pass
        f = np.asarray(g.faces, np.int64)
        if len(f) == 0:
            continue
        v = np.asarray(g.vertices, np.float32)
        if not np.isfinite(v).all():
            raise AssertionError(f"NaN vertex در {path}:{name}")
        if f.min() < 0 or f.max() >= len(v):
            raise AssertionError(f"ایندکس خارج از محدوده در {path}:{name}")
        if "wheel" in name.lower():
            wt = float(v[:, UP].max())
            wheel_top = wt if wheel_top is None else max(wheel_top, wt)
        tris_all.append(v[f])
        fc = None
        if g.visual.kind == "texture" and g.visual.uv is not None:
            try:
                img = np.asarray(g.visual.material.baseColorTexture, np.float32)[..., :3]
                uv = np.asarray(g.visual.uv, np.float32)
                H, W = img.shape[:2]
                fuv = uv[f].mean(1)
                xs = np.clip((fuv[:, 0] * (W - 1)).round().astype(int), 0, W - 1)
                ys = np.clip(((1.0 - fuv[:, 1]) * (H - 1)).round().astype(int), 0, H - 1)
                fc = img[ys, xs] / 255.0
            except Exception:
                fc = None
        if fc is None and g.visual.kind == "vertex" and g.visual.vertex_colors is not None:
            vc = np.asarray(g.visual.vertex_colors, np.float32)[:, :3] / 255.0
            if vc.ndim == 2 and len(vc) == len(v):
                fc = vc[f].mean(1)
        if fc is not None:
            tris_col.append(v[f]); cols.append(fc)
    if not tris_all:
        return None, None, None, wheel_top, None
    P3all = np.vstack(tris_all)
    lo = P3all.reshape(-1, 3).min(0); hi = P3all.reshape(-1, 3).max(0)
    if not tris_col:
        return None, None, None, wheel_top, (lo, hi)  # هندسه سالم، رنگ استخراج‌نشدنی
    P3 = np.vstack(tris_col); FC = np.vstack(cols)
    v1 = P3[:, 1] - P3[:, 0]; v2 = P3[:, 2] - P3[:, 0]
    fn = np.cross(v1, v2)
    nl = np.linalg.norm(fn, axis=1, keepdims=True); nl[nl == 0] = 1
    return P3.mean(1), fn / nl, FC, wheel_top, (lo, hi)


def check_car(car: str) -> tuple[list[str], float]:
    errs: list[str] = []
    glass_frac = 0.0
    for suffix in ("", "_lod1"):
        path = f"{VEH_DIR}/{car}{suffix}.glb"
        try:
            ctr, fn, fc, wheel_top, bb = face_colors(path)
        except AssertionError as e:
            errs.append(f"GLB{suffix}: {e}")
            continue
        if ctr is None:
            if bb is None:
                errs.append(f"GLB{suffix}: هندسه استخراج نشد")
            else:
                # رنگ قابل‌استخراج نیست (طبیعی برای LOD1) — فقط گارد محور
                ext = bb[1] - bb[0]
                if int(np.argmax(ext)) != LEN:
                    errs.append(f"GLB{suffix}: محور طول روی {int(np.argmax(ext))} است نه Z=2 ({ext.round(1)})")
            continue
        lo, hi = bb
        ext = hi - lo
        # ── گارد ۲: محور کانونی (طول روی Z)
        if int(np.argmax(ext)) != LEN:
            errs.append(f"GLB{suffix}: محور طول روی {int(np.argmax(ext))} است نه Z=2 ({ext.round(1)})")
        if suffix:
            continue  # رنگ‌گاردها فقط روی GLB اصلی
        # ── گارد ۵: شیشه وجود دارد
        gm = glass_mask(fc)
        glass_frac = float(gm.mean())
        if glass_frac < 0.005:
            errs.append(f"شیشه یافت نشد ({glass_frac:.3%})")
            continue
        rel_y = (ctr[:, UP] - lo[UP]) / max(1e-6, ext[UP])
        # ── گارد ۳: سقف هرگز شیشه نیست
        up_face = fn[:, UP] > 0.7
        if up_face.any():
            roof_y = float(rel_y[up_face].max())
            roof_glass = int((up_face & gm & (rel_y > roof_y - 0.05)).sum())
            if roof_glass > 0:
                errs.append(f"{roof_glass} فیس شیشه در نوار بالایی سقف (roof_y={roof_y:.2f})")
        # ── گارد ۴: شیشهٔ پهلو زیر خط کمر ممنوع
        if wheel_top is not None:
            wheel_rel = (wheel_top - lo[UP]) / max(1e-6, ext[UP])
            beltline = wheel_rel + 0.30 * (1.0 - wheel_rel)
        else:
            beltline = 0.42
        side_glass = gm & (np.abs(fn[:, UP]) < 0.4)
        low_glass = int((side_glass & (rel_y < beltline - 0.02)).sum())
        if low_glass > 3:
            errs.append(f"{low_glass} فیس شیشهٔ پهلو زیر خط کمر ({beltline:.2f})")
    return errs, glass_frac


def main() -> int:
    print(f"{'car':<12} {'glass%':>7}  verdict")
    print("-" * 38)
    failed = 0
    for car in CARS:
        try:
            errs, frac = check_car(car)
        except FileNotFoundError as e:
            errs, frac = [f"فایل نبود: {e}"], 0.0
        except Exception as e:  # noqa: BLE001
            errs, frac = [f"خطا: {type(e).__name__}: {e}"], 0.0
        if errs:
            failed += 1
            print(f"{car:<12} {'—':>7}  FAIL")
            for e in errs:
                print(f"{'':<12}          • {e}")
        else:
            print(f"{car:<12} {frac:>6.1%}  PASS")
    print("-" * 38)
    print(f"نتیجه: {len(CARS) - failed}/{len(CARS)} PASS")
    return 1 if failed else 0


if __name__ == "__main__":
    sys.exit(main())
