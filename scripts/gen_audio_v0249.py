#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
gen_audio_v0249.py — پنج صدای نو فانی‌کار (v0.2.49)
==============================================================
درخواست کاربر:
  «صدای مسافرِ دم‌گذار موقع رسیدن، صدای آچارخوردن لحظه‌ای هنگام تعمیر،
   باران روی شیشه، دو ایستگاه رادیویی قابل‌انتخاب، صدای پرنده/شهر صبحگاهی»

خروجی‌ها (mono 44.1kHz OGG libvorbis):
  sfx_door_01.ogg    — دم‌گذار مسافر: کوبش در + قفل لچ + دینگ خوشامد
  sfx_ratchet_01.ogg — آچارخوردن (راچت) سریع تعمیرگاه
  sfx_rain_loop.ogg  — حلقه بی‌درز باران روی شیشه (۶ ثانیه)
  sfx_birds_loop.ogg — حلقه بی‌درز پرنده/شهر صبحگاهی (۱۰ ثانیه)
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


def make_loop_seamless(sig, xf_sec=0.12):
    """حلقه بی‌درز: کراس‌فید آخر به اول"""
    xf = int(xf_sec * SR)
    fade = np.linspace(0, 1, xf)
    sig[:xf] = sig[:xf] * fade + sig[-xf:] * (1 - fade)
    return sig[:-xf]


# ================= ۱) دم‌گذار مسافر — «رسیدیم، پیاده شو!» =================
def gen_door():
    dur = 1.15
    n = int(SR * dur)
    sig = np.zeros(n)
    r = rng(33)
    # کوبش بدنهٔ در: سویپ 110→42Hz با پاکت تند
    xs = t(0.22)
    fsw = 110 * np.exp(-6.0 * xs) + 42
    phase = 2 * np.pi * np.cumsum(fsw) / SR
    sig[:len(xs)] += 0.95 * np.sin(phase) * exp_decay(len(xs), 13)
    # تد لحظهٔ برخورد لبهٔ در
    click = r.standard_normal(int(0.005 * SR))
    sig[:len(click)] += 0.8 * click
    # قفل لچ: دو «تِق» فلزی ریز (بسته شدن قفل)
    for st, a in [(0.05, 0.5), (0.085, 0.34)]:
        i0 = int(st * SR)
        tick = r.standard_normal(int(0.014 * SR))
        tick = tick - lowpass(tick, 2600)
        end = min(n, i0 + len(tick))
        sig[i0:end] += a * tick[:end - i0] * exp_decay(len(tick), 30)[:end - i0]
    # دینگ خوشامد کوچک داخل کابین (زنگ درِ ماشین قدیمی)
    for f, st, a, k in [(1568, 0.16, 0.4, 9), (2093, 0.16, 0.28, 11)]:
        seg = int(0.5 * SR)
        xr = np.arange(seg) / SR
        tone = np.sin(2 * np.pi * f * xr) + 0.3 * np.sin(2 * np.pi * f * 2.4 * xr)
        i0 = int(st * SR)
        end = min(n, i0 + seg)
        sig[i0:end] += a * tone[:end - i0] * exp_decay(seg, k)[:end - i0]
    # کمی فنر بدنه
    body = r.standard_normal(int(0.3 * SR))
    sig[int(0.01 * SR):int(0.01 * SR) + len(body)] += 0.22 * lowpass(body, 500) * exp_decay(len(body), 14)
    sig = np.tanh(sig * 1.35) / np.tanh(1.35)
    save('sfx_door_01', sig, 0.82)


# ================= ۲) آچارخوردن (راچت) — «تخت‌تخت‌تخت» =================
def gen_ratchet():
    dur = 0.62
    n = int(SR * dur)
    sig = np.zeros(n)
    r = rng(44)
    # ۸ دندانهٔ راچت با ریتم مکانیکی (تند و تند، هر دند کمی بلندتر از قبلی)
    for k in range(8):
        st = int((0.03 + k * 0.055) * SR)
        # کلیک فلزی: نویز باندبالا + رزونانس ۳۲۰۰Hz
        tick = r.standard_normal(int(0.018 * SR))
        tick = tick - lowpass(tick, 3400)
        xr = np.arange(len(tick)) / SR
        tick += 0.55 * np.sin(2 * np.pi * 3200 * xr) * exp_decay(len(tick), 60)
        amp = 0.5 + k * 0.06
        end = min(n, st + len(tick))
        sig[st:end] += amp * tick[:end - st]
    # فنر فلزی کوچک در پایان
    xr = t(0.14)
    ring = np.sin(2 * np.pi * 2450 * xr) * exp_decay(len(xr), 22)
    i0 = int(0.47 * SR)
    end = min(n, i0 + len(ring))
    sig[i0:end] += 0.2 * ring[:end - i0]
    sig = softclip(sig, 1.5)
    save('sfx_ratchet_01', sig, 0.66)


def softclip(x, drive=1.4):
    return np.tanh(x * drive) / np.tanh(drive)


# ================= ۳) باران روی شیشه — حلقه ۶ ثانیه‌ای بی‌درز =================
def gen_rain():
    dur = 6.0
    n = int(SR * dur)
    r = rng(55)
    # بستر باران: نویز پهن‌باند فیلترشده (هیس ملایم جاده خیس)
    noise = r.standard_normal(n)
    bed = lowpass(noise, 1400) * 0.62
    hiss = (noise - lowpass(noise, 3800)) * 0.10  # تیزِ ریزش
    sig = bed + hiss
    # قطره‌های تپندهٔ روی شیشه: تک‌های کوتاه پراکنده + طنین شیشه‌ای
    for _ in range(130):
        st = int(r.uniform(0, dur - 0.05) * SR)
        dlen = int(r.uniform(0.004, 0.016) * SR)
        drop = r.standard_normal(dlen)
        f0 = r.uniform(900, 2600)
        xr = np.arange(dlen) / SR
        drop = drop * np.hanning(dlen) + 0.4 * np.sin(2 * np.pi * f0 * xr) * exp_decay(dlen, 70)
        amp = r.uniform(0.05, 0.3)
        end = min(n, st + dlen)
        sig[st:end] += amp * drop[:end - st]
    sig = lowpass(sig, 3600)
    sig = make_loop_seamless(sig, 0.2)
    save('sfx_rain_loop', sig, 0.58)


# ================= ۴) پرنده/شهر صبحگاهی — حلقه ۱۰ ثانیه‌ای بی‌درز =================
def gen_birds():
    dur = 10.0
    n = int(SR * dur)
    r = rng(66)
    # هم درد شهر دور: نویز بم خیلی ملایم + هوم ترافیک
    noise = r.standard_normal(n)
    city = lowpass(noise, 220) * 0.5
    hum = 0.18 * np.sin(2 * np.pi * 96 * t(dur) + np.sin(2 * np.pi * 0.3 * t(dur)) * 1.5)
    sig = city + hum
    # پرنده‌ها: جیغ‌جیغ‌های FM شیرین (چیروپ ۳-۵ نتی)
    def chirp(st, base, notes, rep_amp):
        i0 = int(st * SR)
        for k, (f0, f1, d) in enumerate(notes):
            seg = int(d * SR)
            xg = np.arange(seg) / SR
            fsw = f0 + (f1 - f0) * (xg / max(d, 1e-4))
            phase = 2 * np.pi * np.cumsum(fsw) / SR
            tone = np.sin(phase) * (0.55 + 0.45 * np.sin(2 * np.pi * 11 * xg))
            tone *= env_ar(seg, 0.006, d * 0.35)
            a = rep_amp * (1.0 - k * 0.12)
            end = min(n, i0 + len(tone))
            if i0 < n:
                sig[i0:end] += a * tone[:end - i0]
                i0 += int(d * SR * 0.75)
    # گنجشک: تند و بالا
    chirp(1.05, 3200, [(3300, 3800, 0.055), (3600, 3000, 0.05), (3400, 3900, 0.06)], 0.34)
    chirp(2.6, 3400, [(3500, 4100, 0.05), (3900, 3300, 0.045)], 0.3)
    # فاختهٔ شوخ: دو نتی معروف «کو-کو» پایین
    for st in (4.4, 6.9):
        i0 = int(st * SR)
        for k, f in enumerate([740, 620]):
            seg = int(0.16 * SR)
            xg = np.arange(seg) / SR
            tone = np.sin(2 * np.pi * f * xg) * env_ar(seg, 0.02, 0.07)
            end = min(n, i0 + len(tone))
            sig[i0:end] += 0.30 * tone[:end - i0]
            i0 += int(0.22 * SR)
    # گنجشک دوم دورتر
    chirp(8.0, 3000, [(3100, 3500, 0.05), (3400, 2900, 0.05), (3200, 3700, 0.055)], 0.22)
    sig = lowpass(sig, 4200)
    sig = make_loop_seamless(sig, 0.25)
    save('sfx_birds_loop', sig, 0.5)


if __name__ == '__main__':
    gen_door()
    gen_ratchet()
    gen_rain()
    gen_birds()
    print('DONE v0.2.49 audio')
