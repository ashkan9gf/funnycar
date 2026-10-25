#!/usr/bin/env python3
"""Hunyuan3D-2.1 Space → GLB for FunnyCarIR (رایگان؛ HF_TOKEN برای سهمیهٔ ZeroGPU).
Usage: python3 scripts/hf3d_hunyuan.py <image> <name> [steps] [octree]
Pipeline: /generation_all → GLB تکسچرخورده در download/tripo/{name}.glb
"""
import os, shutil, sys, time

HF_TOKEN = os.environ.get("HF_TOKEN", "") or None

IMG = sys.argv[1] if len(sys.argv) > 1 else "download/tripo/player_ref.png"
NAME = sys.argv[2] if len(sys.argv) > 2 else "player"
STEPS = float(sys.argv[3]) if len(sys.argv) > 3 else 30
OCTREE = float(sys.argv[4]) if len(sys.argv) > 4 else 256
OUT = f"/home/z/my-project/download/tripo/{NAME}.glb"


def main() -> int:
    from gradio_client import Client, handle_file
    print("connecting tencent/Hunyuan3D-2 ...")
    c = Client("tencent/Hunyuan3D-2", hf_token=HF_TOKEN)

    t0 = time.time()
    res = c.predict(
        None,               # caption (فقط اسپیس 2.0)
        handle_file(IMG),   # image
        None, None, None, None,  # mv_* تک‌دید کافی است
        STEPS,              # steps
        5.0,                # guidance_scale
        1234,               # seed
        OCTREE,             # octree_resolution
        True,               # rembg
        8000,               # num_chunks
        False,              # randomize_seed
        api_name="/generation_all",
    )
    print(f"generation done in {time.time()-t0:.0f}s")
    files = [r for r in (res or []) if isinstance(r, (str, dict))]
    print(f"returns: {files}")

    src = None
    for r in res or []:
        if isinstance(r, str) and r.endswith(".glb"):
            src = r
            break
        if isinstance(r, dict) and str(r.get("path", "")).endswith(".glb"):
            src = r["path"]
            break
    if not src:
        print("no GLB in returns"); return 4

    os.makedirs(os.path.dirname(OUT), exist_ok=True)
    shutil.copy(src, OUT)
    print(f"OK → {OUT} ({os.path.getsize(OUT)/1024:.0f} KB)")
    return 0


if __name__ == "__main__":
    sys.exit(main())
