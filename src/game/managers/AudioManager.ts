/**
 * AudioManager.ts — صداهای WebAudio
 * ============================================================
 * (ARCHITECTURE بخش ۹)
 *  - 4 کانال مستقل: Music / SFX / Voice / UI — هر کدام Volume جدا
 *  - فاز 7: اگر فایل واقعی در AssetManager بود (AudioBuffer) همان پخش می‌شود؛
 *    وگرنه fallback سینتی oscillator/noise — بازی در هر حالت صدا دارد
 *  - هر خطا → بی‌صدایی امن؛ هرگز Crash (TEST-AUD-005)
 */

import { ASSETS_MANIFEST } from '../data/assets.manifest';

export type AudioChannel = 'music' | 'sfx' | 'voice' | 'ui';

export class AudioManager {
  private ctx: AudioContext | null = null;
  private gains: Record<AudioChannel, GainNode> | null = null;
  private volumes: Record<AudioChannel, number> = { music: 0.7, sfx: 0.9, voice: 1.0, ui: 0.9 };

  /** دسترسی به AudioBufferهای واقعی (فاز 7) — از AssetManager */
  private getAsset: ((id: string) => unknown) | null = null;

  // موتور ماشین — سینتی
  private engOsc1: OscillatorNode | null = null;
  private engOsc2: OscillatorNode | null = null;
  private engFilter: BiquadFilterNode | null = null;
  private engGain: GainNode | null = null;
  // موتور ماشین — فایل واقعی (لوپ)
  private engSrc: AudioBufferSourceNode | null = null;
  private engFileGain: GainNode | null = null;
  private engineRunning = false;

  /** اتصال AssetManager — برای استفاده از فایل‌های واقعی (فاز 7) */
  attachAssets(get: (id: string) => unknown): void {
    this.getAsset = get;
  }

  /** AudioBuffer واقعی برای یک شناسه — اگر نبود null (fallback سینتی) */
  private buffer(id: string): AudioBuffer | null {
    const a = this.getAsset?.(id);
    return a instanceof AudioBuffer ? a : null;
  }

  /** باید با اولین لمس کاربر صدا زده شود (سیاست مرورگرها) */
  ensure(): void {
    if (this.ctx) {
      void this.ctx.resume();
      return;
    }
    try {
      const Ctor = window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
      if (!Ctor) return;
      const ctx = new Ctor();
      const master = ctx.createGain();
      master.gain.value = 0.9;
      master.connect(ctx.destination);

      const mk = (v: number): GainNode => {
        const g = ctx.createGain();
        g.gain.value = v;
        g.connect(master);
        return g;
      };
      this.gains = { music: mk(this.volumes.music), sfx: mk(this.volumes.sfx), voice: mk(this.volumes.voice), ui: mk(this.volumes.ui) };
      this.ctx = ctx;
    } catch (err) {
      console.warn('[Audio] unavailable — game continues silent:', err);
      this.ctx = null;
    }
  }

  setVolumes(v: { music?: number; sfx?: number; voice?: number }): void {
    if (typeof v.music === 'number') this.volumes.music = v.music;
    if (typeof v.sfx === 'number') this.volumes.sfx = v.sfx;
    if (typeof v.voice === 'number') this.volumes.voice = v.voice;
    if (!this.gains || !this.ctx) return;
    const t = this.ctx.currentTime;
    this.gains.music.gain.setTargetAtTime(this.volumes.music, t, 0.05);
    this.gains.sfx.gain.setTargetAtTime(this.volumes.sfx, t, 0.05);
    this.gains.voice.gain.setTargetAtTime(this.volumes.voice, t, 0.05);
  }

  private now(): number {
    return this.ctx ? this.ctx.currentTime : 0;
  }

  // ---------- موتور ماشین (Loop پیوسته) ----------
  startEngine(): void {
    if (!this.ctx || !this.gains || this.engineRunning) return;
    // ---------- اولویت: فایل واقعی (فاز 7) ----------
    const buf = this.buffer('sfx_engine_loop');
    if (buf) {
      try {
        this.engSrc = this.ctx.createBufferSource();
        this.engSrc.buffer = buf;
        this.engSrc.loop = true;
        this.engFileGain = this.ctx.createGain();
        this.engFileGain.gain.value = 0;
        this.engSrc.connect(this.engFileGain);
        this.engFileGain.connect(this.gains.sfx);
        this.engSrc.start();
        this.engineRunning = true;
        return;
      } catch (err) {
        console.warn('[Audio] engine file loop failed — fallback to synth:', err);
        this.engSrc = null;
        this.engFileGain = null;
      }
    }
    // ---------- fallback: سینتی ----------
    try {
      const ctx = this.ctx;
      this.engOsc1 = ctx.createOscillator();
      this.engOsc1.type = 'sawtooth';
      this.engOsc2 = ctx.createOscillator();
      this.engOsc2.type = 'square';
      this.engFilter = ctx.createBiquadFilter();
      this.engFilter.type = 'lowpass';
      this.engFilter.frequency.value = 420;
      this.engGain = ctx.createGain();
      this.engGain.gain.value = 0;
      this.engOsc1.connect(this.engFilter);
      this.engOsc2.connect(this.engFilter);
      this.engFilter.connect(this.engGain);
      this.engGain.connect(this.gains.sfx);
      this.engOsc1.frequency.value = 58;
      this.engOsc2.frequency.value = 29;
      this.engOsc1.start();
      this.engOsc2.start();
      this.engineRunning = true;
    } catch (err) {
      console.warn('[Audio] engine start failed:', err);
    }
  }

  stopEngine(): void {
    if (!this.engineRunning) return;
    try {
      this.engOsc1?.stop();
      this.engOsc2?.stop();
      this.engSrc?.stop();
    } catch { /* بی‌خطر */ }
    this.engOsc1 = null;
    this.engOsc2 = null;
    this.engSrc = null;
    this.engFileGain = null;
    this.engineRunning = false;
  }

  /** نسبت سرعت 0..1 → زیر و بمی و بلندی موتور (فایل یا سینتی) */
  setEngineSpeed(ratio: number): void {
    if (!this.ctx || !this.engineRunning) return;
    const r = Math.max(0, Math.min(1, ratio));
    const t = this.ctx.currentTime;
    if (this.engSrc && this.engFileGain) {
      // فایل: سرعت پخش + بلندی
      this.engSrc.playbackRate.setTargetAtTime(0.55 + r * 0.95, t, 0.08);
      this.engFileGain.gain.setTargetAtTime(0.05 + r * 0.1, t, 0.1);
      return;
    }
    if (!this.engOsc1 || !this.engOsc2 || !this.engGain) return;
    this.engOsc1.frequency.setTargetAtTime(58 + r * 82, t, 0.08);
    this.engOsc2.frequency.setTargetAtTime(29 + r * 41, t, 0.08);
    this.engGain.gain.setTargetAtTime(0.028 + r * 0.05, t, 0.1);
  }

  // ---------- افکت‌های تک‌شوت ----------
  private blip(freq: number, dur: number, type: OscillatorType, vol: number, channel: AudioChannel, freqEnd?: number): void {
    if (!this.ctx || !this.gains) return;
    try {
      const t = this.now();
      const osc = this.ctx.createOscillator();
      const g = this.ctx.createGain();
      osc.type = type;
      osc.frequency.setValueAtTime(freq, t);
      if (freqEnd) osc.frequency.exponentialRampToValueAtTime(Math.max(30, freqEnd), t + dur);
      g.gain.setValueAtTime(vol, t);
      g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
      osc.connect(g);
      g.connect(this.gains[channel]);
      osc.start(t);
      osc.stop(t + dur + 0.02);
    } catch { /* بی‌خطر */ }
  }

  private noise(dur: number, vol: number, filterFreq: number, type: BiquadFilterType): void {
    if (!this.ctx || !this.gains) return;
    try {
      const t = this.now();
      const len = Math.max(1, Math.floor(this.ctx.sampleRate * dur));
      const buf = this.ctx.createBuffer(1, len, this.ctx.sampleRate);
      const data = buf.getChannelData(0);
      for (let i = 0; i < len; i++) data[i] = Math.random() * 2 - 1;
      const src = this.ctx.createBufferSource();
      src.buffer = buf;
      const f = this.ctx.createBiquadFilter();
      f.type = type;
      f.frequency.value = filterFreq;
      const g = this.ctx.createGain();
      g.gain.setValueAtTime(vol, t);
      g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
      src.connect(f);
      f.connect(g);
      g.connect(this.gains.sfx);
      src.start(t);
    } catch { /* بی‌خطر */ }
  }

  /** پخش یک AudioBuffer روی یک کانال (فاز 7) — خطاها بی‌خطر */
  private playBuffer(buf: AudioBuffer, channel: AudioChannel, vol: number, rate = 1): void {
    if (!this.ctx || !this.gains) return;
    try {
      const t = this.now();
      const src = this.ctx.createBufferSource();
      src.buffer = buf;
      src.playbackRate.value = Math.max(0.1, rate);
      const g = this.ctx.createGain();
      g.gain.value = vol;
      src.connect(g);
      g.connect(this.gains[channel]);
      src.start(t);
    } catch { /* بی‌خطر */ }
  }

  horn(variant = 0): void {
    // فایل واقعی: ۳ واریانت با تغییر زیر و بمی
    const buf = this.buffer('sfx_horn_01');
    if (buf) {
      this.playBuffer(buf, 'sfx', 0.8, [0.94, 1.0, 1.12][variant % 3]);
      return;
    }
    const base = [340, 300, 380][variant % 3];
    this.blip(base, 0.26, 'triangle', 0.22, 'sfx');
    this.blip(base * 1.26, 0.26, 'triangle', 0.16, 'sfx');
  }

  /**
   * فاز ۷ — بوق شخصی بازیکن: هر بوق یک امضای صوتی سینتی دارد.
   * همه مسیرها بی‌خطرند؛ اگر AudioContext نبود ساکت رد می‌شود.
   */
  hornById(id: string): void {
    switch (id) {
      case 'doble': {
        // دو تُنه فاصله‌دار (نسبت ۱.۲۶) — پرحجم و جدی
        this.blip(310, 0.34, 'triangle', 0.24, 'sfx');
        this.blip(310 * 1.26, 0.34, 'triangle', 0.2, 'sfx');
        this.blip(310 * 0.5, 0.34, 'sine', 0.14, 'sfx');
        break;
      }
      case 'moto': {
        // دو بوق نازک کوتاه — عصبی!
        this.blip(920, 0.09, 'square', 0.1, 'sfx');
        window.setTimeout(() => this.blip(920, 0.12, 'square', 0.12, 'sfx'), 130);
        break;
      }
      case 'klaxon': {
        // آنتیک: دو پالس مربعی بم با فاصله — «تَق تُق»
        this.blip(235, 0.18, 'square', 0.16, 'sfx');
        window.setTimeout(() => this.blip(235, 0.26, 'square', 0.18, 'sfx'), 210);
        break;
      }
      case 'steam': {
        // کشتی بخار: بم با شروع نرم + نویز نفس — «فوووو»
        if (this.ctx && this.gains) {
          try {
            const t = this.now();
            const osc = this.ctx.createOscillator();
            const g = this.ctx.createGain();
            osc.type = 'sawtooth';
            osc.frequency.setValueAtTime(96, t);
            osc.frequency.exponentialRampToValueAtTime(62, t + 0.75);
            g.gain.setValueAtTime(0.0001, t);
            g.gain.linearRampToValueAtTime(0.22, t + 0.08);
            g.gain.exponentialRampToValueAtTime(0.0001, t + 0.85);
            osc.connect(g);
            g.connect(this.gains.sfx);
            osc.start(t);
            osc.stop(t + 0.9);
          } catch { /* بی‌خطر */ }
        }
        this.noise(0.7, 0.1, 480, 'lowpass');
        break;
      }
      case 'melody': {
        // آهنگ‌دار نیسانی: آرپژ شاد ۶ نتی — سلطان خیابان
        const notes = [660, 784, 880, 784, 660, 587];
        notes.forEach((n, i) => {
          window.setTimeout(() => {
            this.blip(n, 0.12, 'triangle', 0.16, 'sfx');
            this.blip(n * 2, 0.1, 'sine', 0.05, 'sfx');
          }, i * 115);
        });
        break;
      }
      case 'crow': {
        // کلاغ: دو «قار» نزولی + نویز خشن
        this.blip(640, 0.14, 'sawtooth', 0.14, 'sfx', 380);
        this.noise(0.12, 0.09, 1500, 'bandpass');
        window.setTimeout(() => {
          this.blip(590, 0.16, 'sawtooth', 0.14, 'sfx', 330);
          this.noise(0.14, 0.09, 1300, 'bandpass');
        }, 170);
        break;
      }
      case 'police': {
        // آژیر: سه دور تناوب دو تُنه
        for (let i = 0; i < 3; i++) {
          window.setTimeout(() => this.blip(740, 0.22, 'square', 0.09, 'sfx'), i * 440);
          window.setTimeout(() => this.blip(560, 0.22, 'square', 0.09, 'sfx'), i * 440 + 220);
        }
        break;
      }
      default:
        // classic — بوق همیشگی
        this.horn(Math.floor(Math.random() * 3));
    }
  }

  crash(hard: boolean): void {
    const buf = this.buffer('sfx_crash_01');
    if (buf) {
      this.playBuffer(buf, 'sfx', hard ? 1.0 : 0.65, hard ? 0.85 : 1.05 + Math.random() * 0.1);
      return;
    }
    this.noise(hard ? 0.3 : 0.16, hard ? 0.4 : 0.22, hard ? 900 : 1400, 'bandpass');
    this.blip(hard ? 120 : 160, 0.22, 'sine', 0.3, 'sfx', 45);
  }

  /** سرعت‌گیر — «تَق» بم و کوتاه (فاز GTA-IR) */
  bump(): void {
    this.noise(0.12, 0.22, 420, 'lowpass');
    this.blip(85, 0.16, 'sine', 0.3, 'sfx', 30);
  }

  /**
   * فایل صوتی جمله (فاز 7) — از hook گرفته می‌شود (VoiceAudioHook).
   * جستجو در manifest: entry.voice.event === eventKey && entry.voice.index === index
   */
  playVoiceFile(eventKey: string, index: number): void {
    if (!this.ctx || !this.gains) return; // قبل از gesture کاربر — ساکت
    for (const [id, entry] of Object.entries(ASSETS_MANIFEST)) {
      if (entry.voice && entry.voice.event === eventKey && entry.voice.index === index) {
        const buf = this.buffer(id);
        if (buf) this.playBuffer(buf, 'voice', 1.0);
        return;
      }
    }
  }

  coin(): void {
    this.blip(990, 0.07, 'sine', 0.18, 'sfx');
    window.setTimeout(() => this.blip(1320, 0.1, 'sine', 0.16, 'sfx'), 70);
  }

  brake(): void {
    this.noise(0.22, 0.12, 2600, 'highpass');
  }

  /** سایش لاستیک هنگام درفت (فاز 2) — نویز فرکانس بالا با پچ کوتاه */
  skid(intensity = 1): void {
    const v = Math.max(0.04, Math.min(1, intensity)) * 0.14;
    this.noise(0.16, v, 2200 + Math.random() * 600, 'bandpass');
    this.blip(1500 + Math.random() * 250, 0.1, 'sawtooth', v * 0.25, 'sfx', 900);
  }

  click(): void {
    this.blip(700, 0.05, 'square', 0.08, 'ui');
  }

  /** موسیقی موقت منو: آرپژ ساده شاد (تا فایل موسیقی فاز 9 بیاید) */
  startMenuMusic(): void {
    if (!this.ctx || !this.gains) return;
    try {
      const notes = [523, 659, 784, 659, 587, 784, 880, 784];
      const t0 = this.now();
      notes.forEach((n, i) => {
        const osc = this.ctx!.createOscillator();
        const g = this.ctx!.createGain();
        osc.type = 'triangle';
        osc.frequency.value = n;
        const st = t0 + i * 0.22;
        g.gain.setValueAtTime(0.0001, st);
        g.gain.exponentialRampToValueAtTime(0.09, st + 0.03);
        g.gain.exponentialRampToValueAtTime(0.0001, st + 0.2);
        osc.connect(g);
        g.connect(this.gains!.music);
        osc.start(st);
        osc.stop(st + 0.24);
      });
    } catch { /* بی‌خطر */ }
  }
}
