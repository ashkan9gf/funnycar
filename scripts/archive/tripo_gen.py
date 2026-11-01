#!/usr/bin/env python3
"""Tripo V3 text-to-3D → GLB for FunnyCarIR.
Usage: python3 scripts/tripo_gen.py <car_name> [prompt]
Fires one text_to_model task, polls, downloads GLB to download/tripo/.
Requires env TRIPO_KEY. Docs: https://developers.tripo3d.ai/en/docs/quick-start
"""
import json, os, sys, time, urllib.request

API = "https://openapi.tripo3d.ai/v3"
MODEL = "v3.1-20260211"
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


def balance() -> float:
    d = req("GET", "/account/balance")
    return float(d.get("data", {}).get("balance", 0))


def create_task(prompt: str) -> dict:
    body = {"prompt": prompt, "model": MODEL}
    d = req("POST", "/generation/text-to-model", body)
    if d.get("code") == 0:
        return d
    # فیلد ناشناخته رد شد؟ بدون negative_prompt دوباره
    if "negative" in json.dumps(d).lower():
        d = req("POST", "/generation/text-to-model", {"prompt": prompt, "model": MODEL})
    return d


def main() -> int:
    if not KEY:
        print("ERROR: set TRIPO_KEY env"); return 1
    name = sys.argv[1] if len(sys.argv) > 1 else "player"
    prompt = sys.argv[2] if len(sys.argv) > 2 else CAR_PROMPTS.get(name, CAR_PROMPTS["player"])

    bal = balance()
    print(f"balance: {bal} credits")
    if bal <= 0:
        print("ERROR: zero credit — top up at developers.tripo3d.ai (Billing)")
        return 2

    task = create_task(prompt)
    if task.get("code") != 0:
        print(f"create failed: {task}"); return 3
    tid = task["data"].get("task_id") or task["data"].get("id")
    print(f"task_id: {tid}")

    os.makedirs(OUT_DIR, exist_ok=True)
    t0 = time.time()
    while True:
        time.sleep(10)
        d = req("GET", f"/tasks/{tid}")
        data = d.get("data", {})
        st = data.get("status", "?")
        prog = data.get("progress", 0)
        print(f"[{int(time.time()-t0)}s] {st} {prog}%")
        if st in ("success", "succeeded"):
            out = data.get("output") or data.get("result") or {}
            url = ""
            for k in ("pbr_model", "model", "glb", "render_image"):
                if isinstance(out, dict) and out.get(k):
                    url = out[k]
                    if k != "render_image":
                        break
            if not url:
                print(f"no model url: {json.dumps(out)[:400]}"); return 4
            dest = os.path.join(OUT_DIR, f"{name}.glb")
            urllib.request.urlretrieve(url, dest)
            sz = os.path.getsize(dest)
            print(f"OK → {dest} ({sz/1024:.0f} KB)")
            print(f"output: {json.dumps(out if isinstance(out, dict) else {}, default=str)[:500]}")
            return 0
        if st in ("failed", "cancelled", "banned", "error"):
            print(f"task ended: {json.dumps(data)[:600]}"); return 5


if __name__ == "__main__":
    sys.exit(main())
