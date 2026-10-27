#!/usr/bin/env python3
"""Hunyuan3D-2 generation_all — shape + TEXTURE (خروجی دوم = textured_mesh.glb).
پارامترها عیناً مثل hy_raw.py (seed=1234, steps=30, octree=256) → همان شکل + تکسچر.
Usage: HF_TOKEN=... python3 scripts/hy_tex_raw.py <img> <name>
Output: /home/z/my-project/download/tripo/{name}_tex.glb
"""
import json, os, random, shutil, sys, time, urllib.request

# پروفایل: 21 = Hunyuan3D-2.1 (کیفیت بالا، درخواست ۲۷۰ث) | mini = 2mini-Turbo (سریع، درخواست ۹۰ث)
PROFILE = os.environ.get("HY_PROFILE", "mini")
if PROFILE == "21":
    BASE = "https://tencent-hunyuan3d-2-1.hf.space"
    FN, TRIG, STEPS = 5, 17, 30
else:
    BASE = "https://tencent-hunyuan3d-2mini-turbo.hf.space"
    FN, TRIG, STEPS = 7, 19, 5
TOKEN = os.environ.get("HF_TOKEN", "")
SRC = sys.argv[1] if len(sys.argv) > 1 else "/tmp/ref_384.png"
NAME = sys.argv[2] if len(sys.argv) > 2 else "player"
OUT = f"/home/z/my-project/download/tripo/{NAME}_tex.glb"

HDRS = {
    "Authorization": f"Bearer {TOKEN}" if TOKEN else "",
    "Content-Type": "application/json",
    "Origin": BASE,
    "Referer": BASE + "/",
    "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) Chrome/131.0.0.0",
}


def upload() -> str:
    boundary = "----fc" + str(random.randint(10**8, 10**9))
    fname = os.path.basename(SRC)
    body = (
        f"--{boundary}\r\n"
        f'Content-Disposition: form-data; name="files"; filename="{fname}"\r\n'
        f"Content-Type: image/png\r\n\r\n"
    ).encode() + open(SRC, "rb").read() + f"\r\n--{boundary}--\r\n".encode()
    r = urllib.request.Request(
        f"{BASE}/upload", data=body, method="POST",
        headers={k: v for k, v in HDRS.items() if k != "Content-Type"} | {
            "Content-Type": f"multipart/form-data; boundary={boundary}"},
    )
    last = None
    for attempt in range(3):
        try:
            with urllib.request.urlopen(r, timeout=300) as resp:
                paths = json.loads(resp.read())
            return paths[0]
        except Exception as e:
            last = e
            print(f"upload retry {attempt + 1}: {e}", flush=True)
            time.sleep(5)
    raise last


def join(session: str, server_path: str):
    # 2.1 generation_all: fn_index=5, trigger_id=17 — خروجی: [white OBJ, textured GLB, html, stats, seed]
    data = [
        None,  # caption
        {"path": server_path, "meta": {"_type": "gradio.FileData"}, "orig_name": os.path.basename(SRC)},
        None, None, None, None,  # mv_front/back/left/right
        STEPS,  # steps
        5.0,   # guidance_scale
        1234,  # seed
        256,   # octree_resolution
        True,  # check_box_rembg
        8000,  # num_chunks
        False, # randomize_seed
    ]
    payload = {
        "data": data, "event_data": None, "fn_index": FN,
        "session_hash": session, "trigger_id": TRIG,
    }
    req = urllib.request.Request(
        f"{BASE}/queue/join", data=json.dumps(payload).encode(), method="POST",
        headers=HDRS,
    )
    with urllib.request.urlopen(req, timeout=60) as resp:
        print("join:", resp.read().decode()[:200], flush=True)


def sse_listen(session: str) -> dict | None:
    url = f"{BASE}/queue/data?session_hash={session}"
    t0 = time.time()
    with urllib.request.urlopen(urllib.request.Request(url, headers=HDRS), timeout=300) as resp:
        buf = b""
        while True:
            chunk = resp.read(1)
            if not chunk:
                break
            buf += chunk
            if chunk == b"\n" and buf.strip():
                for line in buf.decode(errors="replace").splitlines():
                    if line.startswith("data:"):
                        try:
                            ev = json.loads(line[5:].strip())
                        except Exception:
                            ev = None
                        if ev:
                            msg = ev.get("msg", "")
                            rank = ev.get("rank", "")
                            print(f"[{int(time.time()-t0)}s] {msg} {rank} {ev.get('progress_data') or ''}", flush=True)
                            if msg == "process_completed":
                                return ev
                            if msg in ("queue_full", "unexpected_error"):
                                return ev
                buf = b""
    return None


def main() -> int:
    session = "fct" + str(random.randint(10**8, 10**9))
    print("session:", session, flush=True)
    sp = upload()
    print("uploaded:", sp, flush=True)
    join(session, sp)
    ev = None
    for attempt in range(3):
        try:
            ev = sse_listen(session)
            break
        except Exception as e:
            print(f"sse retry {attempt + 1}: {e}", flush=True)
            time.sleep(4)
    if not ev:
        print("no completion event"); return 5
    out = ev.get("output", {})
    data = out.get("data", [])
    if out.get("error"):
        print("error:", out.get("error"), str(out)[:400], flush=True)
        return 6
    # data[0]=white OBJ، data[1]=TEXTURED GLB — آخرین glb را بردار
    glb_url = None
    for item in reversed(data):
        it = item.get("value", item) if isinstance(item, dict) else item
        if isinstance(it, dict):
            u = it.get("url") or (f"{BASE}/file={it.get('path')}" if it.get("path") else "")
            if str(u).endswith(".glb"):
                glb_url = u
                break
    if not glb_url:
        print("no textured glb in output:", str(data)[:400], flush=True)
        return 7
    print("textured glb:", glb_url, flush=True)
    os.makedirs(os.path.dirname(OUT), exist_ok=True)
    req = urllib.request.Request(glb_url, headers=HDRS)
    with urllib.request.urlopen(req, timeout=300) as r, open(OUT, "wb") as f:
        shutil.copyfileobj(r, f)
    print(f"OK → {OUT} ({os.path.getsize(OUT)//1024} KB)", flush=True)
    return 0


if __name__ == "__main__":
    sys.exit(main())
