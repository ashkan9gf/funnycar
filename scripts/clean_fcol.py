#!/usr/bin/env python3
"""رنگ تخت پروسیجرال روی fcol — v2 (ضد لکه).
بدنه = قرمز یکدست | شیشه = کمربند کابین تیره | پایین‌تنه = پلاستیک مشکی
Usage: python3 scripts/clean_fcol.py <shape.glb> <faces> → /tmp/debug_fcol.npy → final_bake.py
"""
import sys

import numpy as np
import trimesh
import xatlas
import pyfqmr

MESH = sys.argv[1] if len(sys.argv) > 1 else "/home/z/my-project/download/tripo/player_shape.glb"
TARGET = int(sys.argv[2]) if len(sys.argv) > 2 else 45000

m = trimesh.load(MESH, force="mesh")
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
vmapping, ft, uv = xatlas.parametrize(m.vertices, m.faces)
verts = m.vertices[vmapping]
faces = ft
fcol = np.load("/tmp/debug_fcol.npy")
assert len(fcol) == len(ft), f"fcol {len(fcol)} != faces {len(ft)}"

meshA = trimesh.Trimesh(verts, faces, process=False)
fn = meshA.face_normals
fc = verts[faces].mean(axis=1)
bmin, bmax = verts.min(0), verts.max(0)
ext = np.maximum(bmax - bmin, 1e-6)
ny = (fc[:, 1] - bmin[1]) / ext[1]              # 0=زمین، 1=سقف
nz = (fc[:, 2] - bmin[2]) / ext[2]              # 0=عقب، 1=جلو (مش جلو=+Z)
nx_abs = np.abs((fc[:, 0] - bmin[0]) / ext[0] - 0.5) * 2

r, g, b = fcol[:, 0], fcol[:, 1], fcol[:, 2]
mx = fcol.max(1); mn_ = fcol.min(1)
sat = np.where(mx > 0, (mx - mn_) / np.maximum(mx, 1e-6), 0)
val = mx

# ---------- پالت پراید قرمز (سایپر قرمز خالص) ----------
BODY = np.array([0.70, 0.085, 0.10])      # قرمز پراید — تون‌شیدر بازی سایه می‌دهد
GLASS = np.array([0.085, 0.12, 0.155])    # شیشه دودی
PLASTIC = np.array([0.145, 0.135, 0.125]) # سپر/رکاب پلاستیکی مشکی
TIRE = np.array([0.11, 0.10, 0.095])
HEADLIGHT = np.array([0.97, 0.94, 0.82])
PLATE = np.array([0.93, 0.93, 0.91])
GRILLE = np.array([0.10, 0.095, 0.09])    # جلوپنجره مشکی پراید

# ---------- نواحی ----------
# کابین: کمربند شیشه — نرمال سرکش، ارتفاع میانی-بالا
cabin = (ny > 0.42) & (ny < 0.96) & (nz > 0.06) & (nz < 0.86) & (np.abs(fn[:, 1]) < 0.66)
# شیشه = داخل کابین که نمونهٔ بیک تیره/کم‌اشباع داده (شواهد از نماها)
darkish = (val < 0.72) & (sat < 0.55)
GLASS_F = cabin & darkish
# ستون‌ها/قاب شیشه قرمز بمانند: نمونهٔ قرمز داخل کابین → بدنه

# پایین‌تنه: لاستیک/سپر/رکاب
LOW = ny < 0.27
LOWFIX = LOW & ~GLASS_F & (sat < 0.5) & (val < 0.6)
# لاستیک: پایین + نزدیک گلگیرها
TIRE_F = (ny < 0.20) & (nx_abs > 0.52)
# جلوپنجره: جلو، وسط‌پهنا، ارتفاع چراغ‌ها زیر
GRILLE_F = (nz > 0.88) & (nx_abs < 0.42) & (ny > 0.28) & (ny < 0.47)
# چراغ جلو: جلو بالا، کناره‌ها
HEAD_F = (nz > 0.88) & (ny > 0.30) & (ny < 0.62) & (nx_abs > 0.40)
# پلاک: پایین جلو/عقب
PLATE_F = (ny < 0.33) & ((nz > 0.82) | (nz < 0.18)) & (val > 0.55) & (sat < 0.35)
# چراغ عقب: عقب، ارتفاع میانی
TAIL_F = (nz < 0.10) & (ny > 0.30) & (ny < 0.66)

out = np.tile(BODY, (len(faces), 1)).astype(np.float32)  # پیش‌فرض: همه بدنه
out[GLASS_F] = GLASS
out[LOWFIX] = PLASTIC
out[TIRE_F] = TIRE
out[GRILLE_F] = GRILLE
out[HEAD_F] = HEADLIGHT
out[PLATE_F] = PLATE
out[TAIL_F] = np.array([0.55, 0.05, 0.06])  # قرمز تیره‌تر چراغ عقب

# اولویت‌ها: پلاک و چراغ بر پایین‌تنه/لاستیک ببرند
out[PLATE_F] = PLATE
out[HEAD_F] = HEADLIGHT
# شیشه تا آخر باشد جز جایی که چراغ/پلاک است
out[HEAD_F & GLASS_F] = HEADLIGHT
out[PLATE_F & GLASS_F] = PLATE

# ---------- نرم‌سازی مرز شیشه/بدنه (۲ دور) ----------
import scipy.spatial as spt
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

np.save("/tmp/debug_fcol.npy", out)
print(f"glass: {int(GLASS_F.sum())} | lowfix: {int(LOWFIX.sum())} | tire: {int(TIRE_F.sum())} | grille: {int(GRILLE_F.sum())} | head: {int(HEAD_F.sum())} | plate: {int(PLATE_F.sum())} | tail: {int(TAIL_F.sum())}", flush=True)
print(f"mean: {out.mean(0).round(3)}", flush=True)
