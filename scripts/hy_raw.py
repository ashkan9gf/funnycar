#!/usr/bin/env python3
"""Hunyuan3D-2 raw pipeline — POST /upload + /queue/join + SSE /queue/data.
Usage: nohup /tmp/genv/bin/python scripts/hy_raw.py <img> <name> &
Output: /home/z/my-project/download/tripo/{name}.glb
"""
import json, os, random, shutil, sys, time, urllib.request

BASE = "https://tencent-hunyuan3d-2.hf.space"
TOKEN = os.environ.get("HF_TOKEN", "")
SRC = sys.argv[1] if len(sys.argv) > 1 else "/tmp/ref_384.png"
NAME = sys.argv[2] if len(sys.argv) > 2 else "player"
OUT = f"/home/z/my-project/download/tripo/{NAME}.glb"

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
    with urllib.request.urlopen(r, timeout=120) as resp:
        paths = json.loads(resp.read())
    return paths[0]


def join(session: str, server_path: str):
    data = [
        None,  # caption
        {"path": server_path, "meta": {"_type": "gradio.FileData"}, "orig_name": os.path.basename(SRC)},
        None, None, None, None,  # mv_front/back/left/right
        30,    # steps
        5.0,   # guidance_scale
        1234,  # seed
        256,   # octree_resolution
        True,  # check_box_rembg
        8000,  # num_chunks
        False, # randomize_seed
    ]
    payload = {
        "data": data, "event_data": None, "fn_index": 5,
        "session_hash": session, "trigger_id": 18,
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
    with urllib.request.urlopen(urllib.request.Request(url, headers=HDRS), timeout=900) as resp:
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
    session = "fc" + str(random.randint(10**8, 10**9))
    print("session:", session, flush=True)
    sp = upload()
    print("uploaded:", sp, flush=True)
    join(session, sp)
    ev = sse_listen(session)
    if not ev:
        print("no completion event"); return 5
    out = ev.get("output", {})
    data = out.get("data", [])
    if out.get("error"):
        print("error:", out.get("error"), str(out)[:400], flush=True)
        return 6
    glb_url = None
    for item in data:
        it = item.get("value", item) if isinstance(item, dict) else item
        if isinstance(it, dict):
            u = it.get("url") or (f"{BASE}/file={it.get('path')}" if it.get("path") else "")
            if str(u).endswith(".glb") or str(u).endswith(".obj"):
                glb_url = u
                break
    if not glb_url:
        print("no glb in output:", str(data)[:400], flush=True)
        return 7
    print("glb:", glb_url, flush=True)
    os.makedirs(os.path.dirname(OUT), exist_ok=True)
    req = urllib.request.Request(glb_url, headers=HDRS)
    with urllib.request.urlopen(req, timeout=300) as r, open(OUT, "wb") as f:
        shutil.copyfileobj(r, f)
    print(f"OK → {OUT} ({os.path.getsize(OUT)//1024} KB)", flush=True)
    return 0


if __name__ == "__main__":
    sys.exit(main())
