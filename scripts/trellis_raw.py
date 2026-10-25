#!/usr/bin/env python3
"""TRELLIS.2 raw pipeline (gradio 6) — /gradio_api/upload + queue/join + SSE.
Usage: nohup python3 scripts/trellis_raw.py <preprocessed_img> <name> [decim] [tex] &
"""
import json, os, random, shutil, sys, time, urllib.request

BASE = "https://microsoft-trellis-2.hf.space"
API = BASE + "/gradio_api"
TOKEN = os.environ.get("HF_TOKEN", "")
SRC = sys.argv[1] if len(sys.argv) > 1 else "/tmp/player_preprocessed.jpg"
NAME = sys.argv[2] if len(sys.argv) > 2 else "player"
DECIM = int(float(sys.argv[3])) if len(sys.argv) > 3 else 100000
TEX = int(float(sys.argv[4])) if len(sys.argv) > 4 else 1024
OUT = f"/home/z/my-project/download/tripo/{NAME}.glb"

HDRS = {
    "Authorization": f"Bearer {TOKEN}" if TOKEN else "",
    "Origin": BASE,
    "Referer": BASE + "/",
    "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) Chrome/131.0.0.0 Safari/537.36",
}


def upload() -> str:
    boundary = "----fc" + str(random.randint(10**8, 10**9))
    fname = os.path.basename(SRC)
    mime = "image/jpeg" if fname.endswith((".jpg", ".jpeg")) else "image/png"
    body = (
        f"--{boundary}\r\n"
        f'Content-Disposition: form-data; name="files"; filename="{fname}"\r\n'
        f"Content-Type: {mime}\r\n\r\n"
    ).encode() + open(SRC, "rb").read() + f"\r\n--{boundary}--\r\n".encode()
    r = urllib.request.Request(
        f"{API}/upload", data=body, method="POST",
        headers={k: v for k, v in HDRS.items() if k != "Content-Type"} | {
            "Content-Type": f"multipart/form-data; boundary={boundary}"},
    )
    with urllib.request.urlopen(r, timeout=120) as resp:
        return json.loads(resp.read())[0]


def join(session: str, fn_index: int, data: list, trigger_id: int):
    payload = {"data": data, "event_data": None, "fn_index": fn_index,
               "session_hash": session, "trigger_id": trigger_id}
    req = urllib.request.Request(f"{API}/queue/join",
                                 data=json.dumps(payload).encode(), method="POST",
                                 headers=HDRS | {"Content-Type": "application/json"})
    with urllib.request.urlopen(req, timeout=60) as resp:
        print("join:", resp.read().decode()[:120], flush=True)


def sse(session: str, want_states: bool = False, max_reconnect: int = 12):
    """با قطع‌شدن اتصال، دوباره به استریم همان سشن وصل می‌شود (جاب سرور زنده می‌ماند)"""
    t0 = time.time()
    for attempt in range(max_reconnect):
        try:
            url = f"{API}/queue/data?session_hash={session}"
            with urllib.request.urlopen(urllib.request.Request(url, headers=HDRS), timeout=1800) as resp:
                buf = b""
                while True:
                    chunk = resp.read(1)
                    if not chunk:
                        break
                    buf += chunk
                    if chunk == b"\n" and buf.strip():
                        for line in buf.decode(errors="replace").splitlines():
                            if not line.startswith("data:"):
                                continue
                            try:
                                ev = json.loads(line[5:].strip())
                            except Exception:
                                continue
                            msg = ev.get("msg", "")
                            if msg == "heartbeat":
                                print(f"[{int(time.time()-t0)}s] hb", flush=True)
                                continue
                            if msg in ("estimation", "progress"):
                                continue
                            if msg == "process_starts":
                                print(f"[{int(time.time()-t0)}s] starts", flush=True)
                                continue
                            if msg == "process_completed":
                                out = ev.get("output", {})
                                if out.get("error"):
                                    print("ERR:", str(out.get("error"))[:300], flush=True)
                                    return None
                                data = out.get("data", [])
                                print(f"[{int(time.time()-t0)}s] completed, items: {len(data)}", flush=True)
                                return data
                            if msg in ("queue_full", "unexpected_error", "close_stream"):
                                print(f"{msg}: {str(ev)[:250]}", flush=True)
                                return None
                        buf = b""
            print(f"stream closed, reconnect {attempt+1}/{max_reconnect} ...", flush=True)
        except Exception as e:
            print(f"sse error: {type(e).__name__}: {str(e)[:120]}; reconnect {attempt+1}/{max_reconnect} in 3s", flush=True)
            time.sleep(3)
    return None


def file_url(item: dict) -> str:
    if isinstance(item, dict):
        u = item.get("url")
        p = item.get("path")
        if u:
            return u
        if p:
            return f"{BASE}/gradio_api/file={p}"
    return ""


def main() -> int:
    session = "fc" + str(random.randint(10**8, 10**9))
    sp = upload()
    print("session:", session, "| uploaded:", sp, flush=True)

    img = {"path": sp, "meta": {"_type": "gradio.FileData"}, "orig_name": os.path.basename(SRC)}
    img["url"] = f"{API}/file={sp}"
    gen_data = [img, 0, "1024",
                7.5, 0.7, 12, 5.0,    # ss_*
                7.5, 0.5, 12, 3.0,    # shape_slat_*
                7.5, 0.0, 12, 3.0]    # tex_slat_*
    join(session, 7, gen_data, 7)
    data = sse(session)
    if data is None:
        return 5
    state = None
    for item in data:
        if isinstance(item, dict) and "shape_slat_feats" in json.dumps(item)[:4000]:
            state = item.get("value", item)
            break
    if state is None:
        print("no state; data preview:", str(data)[:500], flush=True)
        return 6
    with open(f"/tmp/{NAME}_state.json", "w") as f:
        json.dump(state, f)
    print(f"state saved → /tmp/{NAME}_state.json", flush=True)
    return 0


if __name__ == "__main__":
    try:
        sys.exit(main())
    except Exception:
        import traceback
        traceback.print_exc()
        sys.exit(9)
