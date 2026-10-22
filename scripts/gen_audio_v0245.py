#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
gen_audio_v0245.py — بازتولید کامل افکت‌های صوتی فانی‌کار (v0.2.45)
==============================================================
درخواست کاربر: «صدای بوق اول خیلی زشته؛ صداهای توی بازی رو کلا بهبود بده»

خروجی‌ها (mono 44.1kHz OGG libvorbis):
  sfx_horn_01.ogg      — بوق دوگل واقعی پراید (۴۲۰+۵۰۰ هرتز + هارمونیک + saturation)
  sfx_engine_loop.ogg  — موتور نرم‌تر و کم‌سروصدا با حلقه بی‌درز
  sfx_crash_01.ogg     — تصادف چندلایه (تد + کوبش + رینگ فلزی + خرده‌ریز)
  sfx_coin_01.ogg      — سکه براق دو‌دینگی
  sfx_success_01.ogg   — ژینگل شاد مأموریت موفق
  sfx_fail_01.ogg      — ترومبون غمگین مأموریت شکست
  sfx_checkpoint_01.ogg— چایم زنگی چک‌پوینت
  sfx_repair_01.ogg    — آچارباد تعمیرگاه عمو نقی
"""
import numpy as np
import subprocess
import os

SR = 44100
OUT = '/home/z/my-project/public/assets/audio/sfx'
os.makedirs(OUT, exist_ok=True)


def t(dur):
    return np.arange(int(SR * dur)) / SR


def env_ar(n, attack, release, sr=SR):
    """پاکت حمله-رهاسازی خطی"""
    a = int(attack * sr)
    r = int(release * sr)
    e = np.ones(n)
    a = min(a, n)
    if a > 0:
        e[:a] = np.linspace(0, 1, a)
    r = min(r, n - a)
    if r > 0:
        e[-r:] *= np.linspace(1, 0, r)
    return e


def exp_decay(n, k):
    return np.exp(-k * np.arange(n) / SR)


def softclip(x, drive=1.4):
    return np.tanh(x * drive) / np.tanh(drive)


def lowpass(x, cutoff, sr=SR):
    """فیلتر RC یک‌قطبی ساده"""
    dt = 1.0 / sr
    rc = 1.0 / (2 * np.pi * cutoff)
    alpha = dt / (rc + dt)
    y = np.zeros_like(x)
    acc = 0.0
    for i in range(len(x)):
        acc += alpha * (x[i] - acc)
        y[i] = acc
    return y


def rng(seed):
    return np.random.default_rng(seed)


def save(name, sig, gain=0.9):
    sig = sig / (np.max(np.abs(sig)) + 1e-9) * gain
    pcm = (sig * 32767).astype('<i2')
    raw = name + '.raw'
    with open(os.path.join(OUT, raw), 'wb') as f:
        f.write(pcm.tobytes())
    ogg = os.path.join(OUT, name + '.ogg')
    subprocess.run([
        'ffmpeg', '-y', '-loglevel', 'error',
        '-f', 's16le', '-ar', str(SR), '-ac', '1', '-i', os.path.join(OUT, raw),
        '-c:a', 'libvorbis', '-q:a', '4', ogg,
    ], check=True)
    os.remove(os.path.join(OUT, raw))
    kb = os.path.getsize(ogg) / 1024
    print(f'{name}.ogg  {kb:.1f} KB  {len(sig)/SR:.2f}s')


# ================= ۱) بوق دوگل واقعی — «صدای بوق اول خیلی زشته» =================
def gen_horn():
    dur = 0.55
    x = t(dur)
    sig = np.zeros_like(x)
    # دو تُن اصلی پراید + هم‌نوایی جزئی (beat طبیعی بوق واقعی)
    for f, amp in [(420, 1.0), (500, 0.85)]:
        for h, ha in [(1.0, 1.0), (2.0, 0.42), (3.0, 0.18), (4.0, 0.08)]:
            det = 1.0 + rng(11).uniform(-0.004, 0.004)
            sig += amp * ha * np.sin(2 * np.pi * f * h * det * x)
    # پاکت: حمله تند (بوق واقعی)، نگه، رهاسازی کوتاه
    sig *= env_ar(len(x), 0.012, 0.14)
    sig = softclip(sig, 1.6)  # پانچ
    save('sfx_horn_01', sig, 0.88)


# ================= ۲) موتور نرم‌تر با حلقه بی‌درز =================
def gen_engine():
    dur = 1.6
    n = int(SR * dur)
    x = t(dur)
    sig = np.zeros(n)
    # موتور ۴ سیلندر در دور آرام: فرکانس احتراق ~26Hz + هارمونیک‌های نرم
    parts = [(26, 1.0), (52, 0.7), (78, 0.45), (104, 0.3), (130, 0.22), (156, 0.14)]
    for f, a in parts:
        sig += a * np.sin(2 * np.pi * f * x + 0.5 * np.sin(2 * np.pi * 0.7 * x))
    # غرش زیر (sine بم) + بافت مکانیکی
    sig += 0.5 * np.sin(2 * np.pi * 52 * x)
    noise = rng(7).standard_normal(n)
    sig += 0.16 * lowpass(noise, 340)
    sig = lowpass(sig, 820)  # کل: نرم و بم — بدون خش‌صدا
    # حلقه بی‌درز: کراس‌فید ۸۰ms آخر به اول
    xf = int(0.08 * SR)
    fade = np.linspace(0, 1, xf)
    sig[:xf] = sig[:xf] * fade + sig[-xf:] * (1 - fade)
    sig = sig[:-xf]
    save('sfx_engine_loop', sig, 0.6)


# ================= ۳) تصادف چندلایه =================
def gen_crash():
    dur = 0.9
    n = int(SR * dur)
    sig = np.zeros(n)
    r = rng(3)
    # تد لحظه تماس
    click = r.standard_normal(int(0.004 * SR))
    sig[:len(click)] += 1.2 * click
    # کوبش بدنه: سویپ 130→40Hz
    xs = t(0.3)
    fsw = 130 * np.exp(-3.5 * xs) + 40
    phase = 2 * np.pi * np.cumsum(fsw) / SR
    sig[:len(xs)] += 0.95 * np.sin(phase) * exp_decay(len(xs), 11)
    # رینگ فلزی: سه پارشیال میرا
    for f, a, k in [(2150, 0.16, 9), (3350, 0.11, 12), (5150, 0.07, 15)]:
        xr = t(0.4)
        sig[:len(xr)] += a * np.sin(2 * np.pi * f * xr + r.uniform(0, 6)) * exp_decay(len(xr), k)
    # خرده‌ریز (debris): نویز باندپاس + چند «تق» پراکنده
    dn = r.standard_normal(n)
    dn = dn - lowpass(dn, 1200)  # highpass ساده
    sig += 0.5 * dn * exp_decay(n, 7)
    for i in range(5):
        st = int((0.08 + r.uniform(0, 0.4)) * SR)
        tick = r.standard_normal(int(0.012 * SR))
        end = min(n, st + len(tick))
        sig[st:end] += 0.35 * tick[:end - st]
    sig = softclip(sig, 1.5)
    save('sfx_crash_01', sig, 0.9)


# ================= ۴) سکه براق =================
def gen_coin():
    dur = 0.3
    n = int(SR * dur)
    sig = np.zeros(n)
    # دو دینگ بالارونده + هارمونیک
    for f, st, a, k in [(1245, 0.0, 1.0, 14), (1661, 0.06, 0.9, 12), (3322, 0.06, 0.2, 16)]:
        seg = int(0.22 * SR)
        xs = np.arange(seg) / SR
        i0 = int(st * SR)
        end = min(n, i0 + seg)
        sig[i0:end] += a * (np.sin(2 * np.pi * f * xs[:end - i0]) + 0.3 * np.sin(4 * np.pi * f * xs[:end - i0])) * exp_decay(seg, k)[:end - i0]
    save('sfx_coin_01', sig, 0.55)


# ================= ۵) ژینگل موفقیت =================
def gen_success():
    notes = [(523.25, 0.0, 0.14), (659.25, 0.13, 0.14), (783.99, 0.26, 0.14), (1046.5, 0.39, 0.5)]
    dur = 1.0
    n = int(SR * dur)
    sig = np.zeros(n)
    for f, st, d in notes:
        seg = int(d * SR)
        xs = np.arange(seg) / SR
        tone = 0.8 * np.sin(2 * np.pi * f * xs) + 0.35 * np.sin(2 * np.pi * 2 * f * xs) + 0.12 * np.sin(2 * np.pi * 3 * f * xs)
        vib = 1 + 0.006 * np.sin(2 * np.pi * 6 * xs) if d > 0.3 else 1
        e = env_ar(seg, 0.008, min(0.22, d * 0.6))
        i0 = int(st * SR)
        end = min(n, i0 + seg)
        sig[i0:end] += tone[:end - i0] * e[:end - i0] * vib if isinstance(vib, np.ndarray) else tone[:end - i0] * e[:end - i0]
    save('sfx_success_01', sig, 0.7)


# ================= ۶) ترومبون غمگین (شکست) =================
def gen_fail():
    notes = [(233.08, 0.0, 0.24), (220.0, 0.26, 0.24), (207.65, 0.52, 0.24), (196.0, 0.78, 0.6)]
    dur = 1.45
    n = int(SR * dur)
    sig = np.zeros(n)
    for f, st, d in notes:
        seg = int(d * SR)
        xs = np.arange(seg) / SR
        saw = 2 * ((f * xs) % 1.0) - 1
        tone = lowpass(saw, 780)
        if d > 0.5:  # نت آخر: ویبراتوی «واه واه واه‌اه»
            tone *= (1 + 0.25 * np.sin(2 * np.pi * 5.2 * xs) * np.minimum(1, xs * 6))
        e = env_ar(seg, 0.03, min(0.2, d * 0.4))
        i0 = int(st * SR)
        end = min(n, i0 + seg)
        sig[i0:end] += 0.9 * tone[:end - i0] * e[:end - i0]
    save('sfx_fail_01', sig, 0.62)


# ================= ۷) چایم چک‌پوینت =================
def gen_checkpoint():
    dur = 0.65
    n = int(SR * dur)
    sig = np.zeros(n)
    for f, st, a in [(880, 0.0, 0.9), (1174.7, 0.11, 1.0)]:
        seg = int(0.5 * SR)
        xs = np.arange(seg) / SR
        # پارشیال زنگی (نسبت 2.76 مثل bell واقعی)
        tone = np.sin(2 * np.pi * f * xs) + 0.35 * np.sin(2 * np.pi * f * 2.76 * xs) + 0.15 * np.sin(2 * np.pi * f * 5.4 * xs)
        i0 = int(st * SR)
        end = min(n, i0 + seg)
        sig[i0:end] += a * tone[:end - i0] * exp_decay(seg, 6)[:end - i0]
    save('sfx_checkpoint_01', sig, 0.6)


# ================= ۸) آچارباد تعمیرگاه =================
def gen_repair():
    dur = 1.5
    n = int(SR * dur)
    sig = np.zeros(n)
    r = rng(21)
    pos = 0.02
    while pos < 1.3:
        # هر بورست: ۵ تاک سریع + هیس باد
        for k in range(5):
            st = int((pos + k * 0.028) * SR)
            tick = r.standard_normal(int(0.005 * SR)) * np.hanning(int(0.005 * SR))
            end = min(n, st + len(tick))
            if st < n:
                sig[st:end] += 0.9 * tick[:end - st]
        st = int(pos * SR)
        hiss = r.standard_normal(int(0.16 * SR))
        hiss = hiss - lowpass(hiss, 2500)  # باند بالا
        end = min(n, st + len(hiss))
        if st < n:
            sig[st:end] += 0.4 * hiss[:end - st] * env_ar(len(hiss), 0.01, 0.08)[:end - st]
        pos += 0.3
    save('sfx_repair_01', sig, 0.5)


if __name__ == '__main__':
    gen_horn()
    gen_engine()
    gen_crash()
    gen_coin()
    gen_success()
    gen_fail()
    gen_checkpoint()
    gen_repair()
    print('DONE v0.2.45 audio')
