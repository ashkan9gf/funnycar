#!/usr/bin/env python3
"""لاگین فرم HuggingFace (بدون CSRF) + ساخت توکن write → .hf_token
Usage: python3 scripts/hf_login.py <email> <password>
"""
import http.cookiejar
import json
import sys
import urllib.parse
import urllib.request

EMAIL = sys.argv[1]
PASS = sys.argv[2]
UA = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/131.0.0.0 Safari/537.36"

jar = http.cookiejar.CookieJar()
opener = urllib.request.build_opener(urllib.request.HTTPCookieProcessor(jar))


def post(url: str, data: dict, is_json=False):
    body = json.dumps(data).encode() if is_json else urllib.parse.urlencode(data).encode()
    h = {"User-Agent": UA, "Referer": url}
    if is_json:
        h["Content-Type"] = "application/json"
    req = urllib.request.Request(url, data=body, method="POST", headers=h)
    with opener.open(req, timeout=60) as r:
        return r.status, r.read().decode("utf-8", "replace")


st, body = post("https://huggingface.co/login", {"username": EMAIL, "password": PASS})
print(f"login: {st}")
if st != 200:
    print(body[:300])
    sys.exit(1)
print("cookies: " + ", ".join(c.name for c in jar))

st2, body2 = post(
    "https://huggingface.co/api/settings/tokens",
    {"displayName": "funnycar3d", "role": "write"},
    is_json=True,
)
print(f"token: {st2}")
if st2 != 200:
    print(body2[:300])
    sys.exit(1)
tok = json.loads(body2)
t = tok.get("accessToken") or tok.get("token") or tok
print(f"token starts: {str(t)[:12]}...")
open("/home/z/my-project/.hf_token", "w").write(str(t))
print("saved .hf_token")
