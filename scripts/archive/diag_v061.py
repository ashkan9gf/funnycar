#!/home/z/.venv/bin/python3
"""diag_v061.py — quantify remaining fine paint spill on final GLBs.
Checks: (1) wheel-part membership & rim colors per wheel
        (2) body-part faces inside wheel disc (white/red specks on tire)
        (3) glass outlier faces (<=1 glass neighbor)
Usage: diag_v061.py player [pride ...]
"""
import sys
import numpy as np
import trimesh

FLIP = np.diag([1.0, 1.0, -1.0]).astype(np.float64)  # mask space: +Z front

for key in sys.argv[1:]:
    path = f"/home/z/my-project/public/assets/models/vehicles/{key}.glb"
    sc = trimesh.load(path, process=False)
    print(f"\n================ {key} ================")
    geoms = sc.geometry if hasattr(sc, "geometry") else {}
    allV, allF = [], []
    off = 0
    parts = {}
    for name, g in geoms.items():
        v = np.asarray(g.vertices)
        f = np.asarray(g.faces) + off
        allV.append(v)
        allF.append(f)
        parts[name] = (off, len(f))
        off += len(v)
    V = np.vstack(allV)
    F = np.vstack(allF)
    Vm = V @ FLIP
    bmin, bmax = Vm.min(0), Vm.max(0)
    ext = np.maximum(bmax - bmin, 1e-6)
    meshA = trimesh.Trimesh(Vm, F, process=False)
    fn = np.asarray(meshA.face_normals)
    fc = Vm[F].mean(axis=1)
    ny = (fc[:, 1] - bmin[1]) / ext[1]
    print(f"parts: {[(n, pf[1]) for n, pf in parts.items()]}")

    # ---- (1) wheel parts ----
    wheel_names = [n for n in parts if "wheel" in n.lower()]
    # wheel axis centers from each wheel part bbox
    for wn in wheel_names:
        o, nf = parts[wn]
        wv = Vm[F[o:o + nf]].reshape(-1, 3)
        wmin, wmax = wv.min(0), wv.max(0)
        cy = 0.5 * (wmin[1] + wmax[1])
        cz = 0.5 * (wmin[2] + wmax[2])
        dia = wmax[1] - wmin[1]
        cx = float(np.median(wv[:, 0]))
        print(f"  {wn}: n={nf} center=({cx:.2f},{cy:.2f},{cz:.2f}) dia={dia:.2f}")
    # ---- (2) body faces inside wheel discs (speck candidates) ----
    body_names = [n for n in parts if "body" in n.lower() or n == "geometry_0"]
    for bn in body_names:
        o, nf = parts[bn]
        bf = np.arange(o, o + nf)
        bfc = fc[bf]
        bfn = fn[bf]
        for wn in wheel_names:
            wo, wnf = parts[wn]
            wv = Vm[F[wo:wo + wnf]].reshape(-1, 3)
            wmin, wmax = wv.min(0), wv.max(0)
            cy = 0.5 * (wmin[1] + wmax[1])
            cz = 0.5 * (wmin[2] + wmax[2])
            dia = wmax[1] - wmin[1]
            cx = float(np.median(wv[:, 0]))
            rho = np.sqrt((bfc[:, 1] - cy) ** 2 + (bfc[:, 2] - cz) ** 2)
            inside = (rho <= 0.55 * dia) & (np.abs(bfc[:, 0] - cx) <= 0.35 * dia)
            rimlike = inside & (np.abs(bfn[:, 0]) > 0.72) & (rho < 0.62 * dia * 0.5 + 0.02 * dia)
            lowside = inside & (bfc[:, 1] < cy + 0.30 * dia)
            print(f"  {bn} in {wn} disc: inside55={int(inside.sum())} rimlike={int(rimlike.sum())} "
                  f"lowside={int(lowside.sum())}")
    # ---- (3) glass outliers ----
    gmask = (ny > 0.42) & (ny < 0.90) & (np.abs(fn[:, 1]) < 0.42)
    fa = np.asarray(meshA.face_adjacency)
    nbr = {}
    for a, b in fa:
        nbr.setdefault(int(a), []).append(int(b))
        nbr.setdefault(int(b), []).append(int(a))
    gidx = np.where(gmask)[0]
    iso = [i for i in gidx if sum(1 for n2 in nbr.get(i, ()) if gmask[n2]) <= 1]
    print(f"  glass-ish faces={len(gidx)} isolated(<=1 gnb)={len(iso)}")
