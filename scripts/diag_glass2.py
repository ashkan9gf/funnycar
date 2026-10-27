#!/usr/bin/env python3
# diag_glass2.py — تشخیص رگه‌های قرمز باقی‌مانده داخل باند شیشه با ماسک واقعی recolor_v5
# استفاده: python3 scripts/diag_glass2.py <key>
import ast
import sys
from pathlib import Path

import numpy as np
import trimesh
import scipy.spatial as spt
from scipy import ndimage

KEY = sys.argv[1] if len(sys.argv) > 1 else "player"
ROOT = Path(__file__).resolve().parents[1]
SRC = (ROOT / "scripts/recolor_v5.py").read_text(encoding="utf-8")

# ۱) اجرای پیش‌فرضِ ماژول تا قبل از بارگذاری مش (cfg + srgb_to_linear + RIM_LIN)
prefix = SRC.split("# ---------- بارگذاری merged ----------")[0]
sys.argv = ["recolor_v5", KEY]
_g: dict = {"__file__": str(ROOT / "scripts/recolor_v5.py")}
exec(prefix, _g)
cfg = _g["cfg"]

# ۲) استخراج تابع zone_masks با AST و اجرای مستقل
tree = ast.parse(SRC)
zm_src = None
for node in tree.body:
    if isinstance(node, ast.FunctionDef) and node.name == "zone_masks":
        zm_src = ast.get_source_segment(SRC, node)
        break
assert zm_src, "zone_masks not found"
exec(zm_src, {"np": np, "trimesh": trimesh, "spt": spt, "cfg": cfg}, _g)
zone_masks = _g["zone_masks"]

# ۳) بارگذاری مش خام و محاسبهٔ ماسک واقعی
sc = trimesh.load(str(ROOT / f"scripts/raw_assets/models/vehicles/{KEY}.glb"), force="scene")
_Vs, _Fs, _off = [], [], 0
for g in sc.geometry.values():
    v = np.asarray(g.vertices, np.float64)
    f = np.asarray(g.faces, np.int64)
    _Vs.append(v); _Fs.append(f + _off); _off += len(v)
V = np.concatenate(_Vs, 0); F = np.concatenate(_Fs, 0)
Vm = V @ _g["FLIP"]
M = zone_masks(Vm, F)
glass, plastic, tire, grille = M["glass"], M["plastic"], M["tire"], M["grille"]
head, plate, tail, stripe = M["head"], M["plate"], M["tail"], M["stripe"]
ny, fn, fc = M["ny"], M["fn"], M["fc"]
bmin, bmax = Vm.min(0), Vm.max(0)
ext = np.maximum(bmax - bmin, 1e-6)
nz = (fc[:, 2] - bmin[2]) / ext[2]
prot = head | tail | plate | grille | stripe

gny0, gny1 = cfg["glass_ny"]
gnz0, gnz1 = cfg["glass_ny"] and cfg["glass_nz"]
gfy = cfg["glass_fn_y"] if cfg.get("glass_fn_y_raw") else min(cfg["glass_fn_y"], 0.42)
box = (ny > gny0) & (ny < min(gny1, 0.92)) & (nz > gnz0) & (nz < gnz1)
cand = box & ~glass & ~prot & ~tire & ~plastic & (np.abs(fn[:, 1]) < 0.5)
print(f"== {KEY} == glass={glass.sum()} cand(red-in-band)={cand.sum()}")
if cand.sum() == 0:
    sys.exit(0)
a = np.abs(fn[cand, 1])
print(f"cand |fn_y|: p50={np.percentile(a,50):.2f} p90={np.percentile(a,90):.2f}")
print(f"cand ny: p05={np.percentile(ny[cand],5):.2f} p50={np.percentile(ny[cand],50):.2f} p95={np.percentile(ny[cand],95):.2f}")

# ۴) تحلیل اجزای همبند (adjacency کامل) + رأی شیشه
fa = np.asarray(trimesh.Trimesh(Vm, F, process=False).face_adjacency)
_par = np.arange(len(F))
def _find(x):
    while _par[x] != x:
        _par[x] = _par[_par[x]]
        x = _par[x]
    return x
for A, B in fa:
    if cand[A] and cand[B]:
        ra, rb = _find(int(A)), _find(int(B))
        if ra != rb:
            _par[ra] = _rb = rb
comp = np.array([_find(i) for i in range(len(F))])
sizes = {}
for i in np.where(cand)[0]:
    sizes[comp[i]] = sizes.get(comp[i], 0) + 1
big = sorted(sizes.values(), reverse=True)[:8]
print(f"cand components: {len(sizes)} | biggest: {big}")

# ۵) کدام‌ها با fill_holes دوبعدی (nz,ny) پر می‌شوند؟
G = 200
nz_i = np.clip(((nz - gnz0) / (gnz1 - gnz0) * G).astype(int), 0, G - 1)
ny_i = np.clip(((ny - gny0) / (min(gny1, 0.92) - gny0) * G).astype(int), 0, G - 1)
gr = np.zeros((G, G), bool)
gr[nz_i[glass], ny_i[glass]] = True
filled2d = ndimage.binary_fill_holes(gr)
in2d = filled2d[nz_i[cand], ny_i[cand]]
print(f"cand inside 2D-enclosed holes: {in2d.sum()}/{cand.sum()}")

# ۶) رأی همسایگی ۷ و ۱۵
tree0 = spt.cKDTree(fc)
_, nn7 = tree0.query(fc, k=7)
_, nn15 = tree0.query(fc, k=16)
v7 = glass[nn7].sum(axis=1)
v15 = glass[nn15[:, 1:]].sum(axis=1)
print(f"cand v7>=4: {(v7[cand]>=4).sum()}  v15>=8: {(v15[cand]>=8).sum()}  v15>=10: {(v15[cand]>=10).sum()}")

# ۷) نمونهٔ موقعیت بزرگ‌ترین جزء
if sizes:
    r = max(sizes, key=sizes.get)
    sel = np.where(cand & (comp == r))[0]
    c = fc[sel].mean(axis=0)
    print(f"biggest comp: {sizes[r]} faces | center xyz_norm=({(c[0]-Vm[:,0].min())/(Vm[:,0].max()-Vm[:,0].min()):.2f},{ny[sel].mean():.2f},{nz[sel].mean():.2f}) | |fn_y| p50={np.percentile(np.abs(fn[sel,1]),50):.2f}")
