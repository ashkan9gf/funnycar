#!/usr/bin/env python3
"""HuggingFace Space → GLB for FunnyCarIR (رایگان؛ HF_TOKEN برای سهمیهٔ ZeroGPU).
Usage: python3 scripts/hf3d_gen.py <space_id> <image> <name> [decimation] [texture]
Pipeline: start_session → preprocess_image → image_to_3d → extract_glb
"""
import os, shutil, sys, time

HF_TOKEN = os.environ.get("HF_TOKEN", "") or None

SPACE = sys.argv[1] if len(sys.argv) > 1 else "microsoft/TRELLIS.2"
IMG = sys.argv[2] if len(sys.argv) > 2 else "download/tripo/player_ref.png"
NAME = sys.argv[3] if len(sys.argv) > 3 else "player"
DECIM = float(sys.argv[4]) if len(sys.argv) > 4 else 100000
TEX = float(sys.argv[5]) if len(sys.argv) > 5 else 1024
OUT = f"/home/z/my-project/download/tripo/{NAME}.glb"


def main() -> int:
    from gradio_client import Client, handle_file
    print(f"connecting {SPACE} ...")
    c = Client(SPACE, verbose=False, token=HF_TOKEN)

    try:
        c.predict(api_name="/start_session")
        print("session started")
    except Exception as e:
        print(f"start_session skipped: {e}")

    print("preprocess ...")
    t0 = time.time()
    proc = c.predict(handle_file(IMG), api_name="/preprocess_image")
    print(f"  done {time.time()-t0:.0f}s → {proc}")

    print("image_to_3d (GPU — ممکن است ۱-۴ دقیقه طول بکشد) ...")
    t0 = time.time()
    c.predict(
        proc,                      # image
        0,                         # seed
        1024,                      # resolution
        7.5, 0.7, 12, 5.0,         # ss_* (ساختار)
        7.5, 0.5, 12, 3.0,         # shape_slat_*
        7.5, 0.0, 12, 3.0,         # tex_slat_*
        api_name="/image_to_3d",
    )
    print(f"  done {time.time()-t0:.0f}s")

    print(f"extract_glb (decim={DECIM:.0f}, tex={TEX:.0f}) ...")
    glb_path, _dl = c.predict(DECIM, TEX, api_name="/extract_glb")
    print(f"  glb: {glb_path}")

    os.makedirs(os.path.dirname(OUT), exist_ok=True)
    shutil.copy(glb_path, OUT)
    print(f"OK → {OUT} ({os.path.getsize(OUT)/1024:.0f} KB)")
    return 0


if __name__ == "__main__":
    sys.exit(main())
