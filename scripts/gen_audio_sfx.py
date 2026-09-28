#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
gen_audio_sfx.py — تولید ۳ فایل SFX واقعی (سینتز numpy → OGG)
============================================================
طبق ASSET_INVENTORY_FA.md:
  SFX-001 موتور لوپ  → public/assets/audio/sfx/sfx_engine_loop.ogg
  SFX-002 تصادف      → public/assets/audio/sfx/sfx_crash_01.ogg
  SFX-003 بوق        → public/assets/audio/sfx/sfx_horn_01.ogg
همه اعداد موسیقیایی کامنت‌دار؛ موتور لوپ بی‌درز است (چرخه کامل هارمونیک‌ها).
"""

from __future__ import annotations

import os
import subprocess

import numpy as np

SR = 44100
RAW_DIR = os.path.join(os.path.dirname(os.path.abspath(__file__)), "raw_assets", "audio")
PUB_SFX = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), "public", "assets", "audio", "sfx")


def write_ogg(wav_path: str, ogg_path: str, q: str = "4") -> None:
    os.makedirs(os.path.dirname(ogg_path), exist_ok=True)
    subprocess.run(
        ["ffmpeg", "-y", "-loglevel", "error", "-i", wav_path,
         "-c:a", "libvorbis", "-q:a", q, ogg_path],
        check=True,
    )


def normalize(x: np.ndarray, peak: float = 0.5) -> np.ndarray:
    m = np.max(np.abs(x))
    return x * (peak / m) if m > 0 else x


def fade_edges(x: np.ndarray, ms: float = 6) -> np.ndarray:
    n = int(SR * ms / 1000)
    if n * 2 < len(x):
        env = np.ones_like(x)
        env[:n] = np.linspace(0, 1, n)
        env[-n:] = np.linspace(1, 0, n)
        return x * env
    return x


# ---------------------------------------------------------------- موتور
def gen_engine_loop() -> np.ndarray:
    """لوپ ۱.۶ ثانیه‌ای بی‌درز: هارمونیک‌های دقیق + نویز کراس‌فید شده.
    هم‌چنین در Audio Manager با playbackRate زیر و بمی می‌شود."""
    dur = 1.6
    n = int(SR * dur)
    t = np.arange(n) / SR
    out = np.zeros(n)
    # هارمونیک‌های موتور — همگی در ۱.۶s چرخهٔ کامل دارند (بی‌درزی لوپ)
    for freq, amp in [(50.0, 1.0), (100.0, 0.55), (150.0, 0.32), (225.0, 0.18), (300.0, 0.1)]:
        cycles = freq * dur  # عدد صحیح → درز ندارد
        out += amp * np.sin(2 * np.pi * cycles * (t / dur) * np.pi * 0 + 0)  # placeholder no-op
        out += amp * np.sin(2 * np.pi * freq * t)
    # نویز موتور خام — با کراس‌فید ۸۰ms لوپ بی‌درز می‌شود
    rng = np.random.default_rng(501)
    noise = rng.uniform(-1, 1, n)
    xf = int(SR * 0.08)
    ramp = np.linspace(0, 1, xf)
    noise[:xf] = noise[:xf] * ramp + noise[-xf:] * (1 - ramp)
    noise = noise[: n]
    # فیلتر پایین‌گذر ساده (میانگین متحرک) برای نرمی
    k = 24
    noise = np.convolve(noise, np.ones(k) / k, mode="same")
    out += 0.35 * noise
    out = normalize(out, 0.45)
    # لوپ نباید fade لبه داشته باشد — برش سخت OK چون فازها کامل‌اند
    return out


# ---------------------------------------------------------------- تصادف
def gen_crash() -> np.ndarray:
    """برخورد: تامپ بم + برست نویز + زنگ فلزی کوتاه."""
    dur = 0.7
    n = int(SR * dur)
    t = np.arange(n) / SR
    out = np.zeros(n)
    # تامپ بم 120→45Hz
    f = 120 * np.exp(-t * 3.2) + 45
    phase = 2 * np.pi * np.cumsum(f) / SR
    out += 0.9 * np.sin(phase) * np.exp(-t * 7)
    # برست نویز (تصادف)
    rng = np.random.default_rng(702)
    noise = rng.uniform(-1, 1, n) * np.exp(-t * 16)
    k = 8
    noise = np.convolve(noise, np.ones(k) / k, mode="same")
    out += 0.8 * noise
    # زنگ فلزی — چند سینوسی میرا
    for freq, amp in [(820, 0.12), (1240, 0.09), (1660, 0.06), (2100, 0.04)]:
        out += amp * np.sin(2 * np.pi * freq * t) * np.exp(-t * 11)
    out = fade_edges(normalize(out, 0.6), 8)
    return out


# ---------------------------------------------------------------- بوق
def gen_horn() -> np.ndarray:
    """بوق دو‌تیونی کلاسیک (۳۴۰+۴۲۸Hz) با ویبراتوی ملایم."""
    dur = 0.55
    n = int(SR * dur)
    t = np.arange(n) / SR
    vib = 1 + 0.004 * np.sin(2 * np.pi * 5.5 * t)
    lo = np.sin(2 * np.pi * 340 * t * vib)
    hi = np.sin(2 * np.pi * 428 * t * vib)
    out = 0.7 * lo + 0.55 * hi
    # شروع/پایان نرم (سرناک بوق)
    a = int(SR * 0.012)
    r = int(SR * 0.05)
    env = np.ones(n)
    env[:a] = np.linspace(0, 1, a)
    env[-r:] = np.linspace(1, 0, r)
    out *= env
    out = normalize(out, 0.5)
    return out


def main() -> None:
    os.makedirs(RAW_DIR, exist_ok=True)
    jobs = [
        ("sfx_engine_loop", gen_engine_loop()),
        ("sfx_crash_01", gen_crash()),
        ("sfx_horn_01", gen_horn()),
    ]
    for name, data in jobs:
        wav = os.path.join(RAW_DIR, f"{name}.wav")
        ogg = os.path.join(PUB_SFX, f"{name}.ogg")
        import scipy.io.wavfile as wavf  # local import — فقط اینجا
        data16 = (np.clip(data, -1, 1) * 32767).astype(np.int16)
        wavf.write(wav, SR, data16)
        write_ogg(wav, ogg)
        kb = os.path.getsize(ogg) / 1024
        dur = len(data) / SR
        print(f"  ✓ audio/sfx/{name}.ogg  ({dur:.2f}s, {kb:.0f}KB)")


if __name__ == "__main__":
    main()
