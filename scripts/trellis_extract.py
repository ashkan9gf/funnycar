#!/usr/bin/env python3
"""Extract GLB از state ذخیره‌شدهٔ TRELLIS.2 — جدا از تولید تا rerun ارزان باشد.
Usage: python3 scripts/trellis_extract.py <state.json> <name> [decim] [tex]
"""
import json, os, random, shutil, sys, time, urllib.request

BASE = "https://microsoft-trellis-2.hf.space"
API = BASE + "/gradio_api"
TOKEN = os.environ.get("HF_TOKEN", "")
STATE = sys.argv[1] if len(sys.argv) > 1 else "/tmp/player_state.json"
NAME = sys.argv[2] if len(sys.argv) > 2 else "player"
DECIM = int(float(sys.argv[3])) if len(sys.argv) > 3 else 100000
TEX = int(float(sys.argv[4])) if len(sys.argv) > 4 else 1024
OUT = f"/home/z/my-project/download/tripo/{NAME}.glb"

HDRS = {
    "Authorization": f"Bearer {TOKEN}" if TOKEN else "",
    "Origin": BASE, "Referer": BASE + "/",
    "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) Chrome/131.0.0.0 Safari/537.36",
}


def join(session: str, fn_index: int, data: list, trigger_id: int):
    payload = {"data": data, "event_data": None, "fn_index": fn_index,
               "session_hash": session, "trigger_id": trigger_id}
    req = urllib.request.Request(f"{API}/queue/join",
                                 data=json.dumps(payload).encode(), method="POST",
                                 headers=HDRS | {"Content-Type": "application/json"})
    with urllib.request.urlopen(req, timeout=60) as resp:
        print("join:", resp.read().decode()[:120], flush=True)


def sse(session: str):
    t0 = time.time()
    for attempt in range(12):
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
                            if msg == "process_completed":
                                out = ev.get("output", {})
                                if out.get("error"):
                                    print("ERR:", str(out.get("error"))[:300], flush=True)
                                    return None
                                return out.get("data", [])
                            if msg in ("queue_full", "unexpected_error", "close_stream"):
                                print(f"{msg}: {str(ev)[:250]}", flush=True)
                                return None
                        buf = b""
            print(f"stream closed, reconnect {attempt+1}", flush=True)
        except Exception as e:
            print(f"sse error: {type(e).__name__}: {str(e)[:120]}; retry {attempt+1}", flush=True)
            time.sleep(3)
    return None


def main() -> int:
    state = json.load(open(STATE))
    session = "fc" + str(random.randint(10**8, 10**9))
    print("session:", session, flush=True)
    join(session, 9, [state, DECIM, TEX], 9)
    data = sse(session)
    if not data:
        return 5
    glb = ""
    for item in data:
        it = item.get("value", item) if isinstance(item, dict) else item
        if isinstance(it, dict):
            u = it.get("url") or (f"{BASE}/gradio_api/file={it.get('path')}" if it.get("path") else "")
            if str(u).endswith(".glb"):
                glb = u
                break
    if not glb:
        print("no glb:", str(data)[:500], flush=True)
        return 6
    print("glb:", glb, flush=True)
    req = urllib.request.Request(glb, headers=HDRS)
    with urllib.request.urlopen(req, timeout=600) as r, open(OUT, "wb") as f:
        shutil.copyfileobj(r, f)
    print(f"OK → {OUT} ({os.path.getsize(OUT)//1024} KB)", flush=True)
    return 0


if __name__ == "__main__":
    try:
        sys.exit(main())
    except Exception:
        import traceback
        traceback.print_exc()
        sys.exit(9)
