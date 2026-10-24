#!/usr/bin/env python3
"""Tripo text-to-3D → GLB for FunnyCarIR.
Usage: python3 scripts/tripo_gen.py <car_name> [prompt]
Fires one text_to_model task, polls, downloads GLB to download/tripo/.
Requires env TRIPO_KEY. V2 API (retires 2026-11-01); switch V3_BASE when live.
"""
import json, os, sys, time, urllib.request

API = "https://api.tripo3d.ai/v2/openapi"
KEY = os.environ.get("TRIPO_KEY", "")
OUT_DIR = "/home/z/my-project/download/tripo"

CAR_PROMPTS = {
    # خودروی اصلی بازیکن — سفید، سدان جمع‌وجور
    "player": (
        "low-poly stylized compact white sedan car, mobile game asset, "
        "clean cartoon proportions, four separate wheels with dark rubber tires and silver rims, "
        "simple black windows, red tail lights, PBR materials, single body shell, no interior"
    ),
    # پراید — خودروی نمادین ایران
    "pride": (
        "low-poly stylized small hatchback car inspired by classic Iranian city car, "
        "boxy compact shape, mobile game asset, four separate wheels with dark tires and silver rims, "
        "PBR materials, no interior"
    ),
}

NEG = "blurry, low quality, deformed, broken wheels, merged wheels, interior detail, engine detail"


def req(method: str, path: str, payload: dict | None = None) -> dict:
    url = f"{API}{path}"
    data = json.dumps(payload).encode() if payload is not None else None
    r = urllib.request.Request(url, data=data, method=method, headers={
        "Authorization": f"Bearer {KEY}",
        "Content-Type": "application/json",
    })
    with urllib.request.urlopen(r, timeout=60) as resp:
        return json.loads(resp.read())


def balance() -> int:
    try:
        d = req("GET", "/user/balance")
        return int(d.get("data", {}).get("balance", 0))
    except Exception as e:
        print(f"balance check failed: {e}")
        return -1


def main() -> int:
    if not KEY:
        print("ERROR: set TRIPO_KEY env"); return 1
    name = sys.argv[1] if len(sys.argv) > 1 else "player"
    prompt = sys.argv[2] if len(sys.argv) > 2 else CAR_PROMPTS.get(name, CAR_PROMPTS["player"])

    bal = balance()
    print(f"balance: {bal} credits")
    if bal is not None and bal <= 0:
        print("ERROR: zero credit — top up at platform.tripo3d.ai (Billing)")
        return 2

    task = req("POST", "/task", {
        "type": "text_to_model",
        "prompt": prompt,
        "negative_prompt": NEG,
        "format": "glb",
    })
    if task.get("code") != 0:
        print(f"create failed: {task}"); return 3
    tid = task["data"]["task_id"]
    print(f"task_id: {tid}")

    os.makedirs(OUT_DIR, exist_ok=True)
    t0 = time.time()
    while True:
        time.sleep(10)
        d = req("GET", f"/task/{tid}")
        st = d.get("data", {}).get("status", "?")
        prog = d.get("data", {}).get("progress", 0)
        print(f"[{int(time.time()-t0)}s] {st} {prog}%")
        if st == "success":
            out = d["data"]["output"]
            url = out.get("pbr_model") or out.get("model") or ""
            if not url:
                print(f"no model url: {json.dumps(out)[:400]}"); return 4
            dest = os.path.join(OUT_DIR, f"{name}.glb")
            urllib.request.urlretrieve(url, dest)
            sz = os.path.getsize(dest)
            print(f"OK → {dest} ({sz/1024:.0f} KB)")
            print(f"output json: {json.dumps({k: v for k, v in out.items() if isinstance(v, str)})[:500]}")
            return 0
        if st in ("failed", "cancelled", "banned"):
            print(f"task ended: {json.dumps(d.get('data', {}))[:600]}"); return 5


if __name__ == "__main__":
    sys.exit(main())
