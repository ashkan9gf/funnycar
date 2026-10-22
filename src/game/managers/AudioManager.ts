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
    this.startWind(); // v0.2.45 — ویند همراه موتور روشن/خاموش می‌شود
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
    this.stopWind(); // v0.2.45
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

  // ---------- آژیر پلیس (v0.2.42 — تعقیب پیوسته) ----------
  private sirenOsc: OscillatorNode | null = null;
  private sirenLfo: OscillatorNode | null = null;
  private sirenGain: GainNode | null = null;
  private sirenOn = false;
  private sirenFilter: BiquadFilterNode | null = null;
  private sirenAmGain: GainNode | null = null;
  private sirenAmDepth: GainNode | null = null;
  private sirenAmLfo: OscillatorNode | null = null;

  /** آژیر دو‌تُنهٔ پیوسته — تا پایان تعقیب روشن می‌ماند؛ حجم با فاصله تنظیم می‌شود */
  sirenStart(): void {
    if (!this.ctx || !this.gains || this.sirenOn) return;
    try {
      const ctx = this.ctx;
      this.sirenOsc = ctx.createOscillator();
      this.sirenOsc.type = 'sawtooth';
      this.sirenOsc.frequency.value = 720;
      // موج‌گیر: LFO مربعی — تناوب کلاسیک دو‌تُنه ۵۴۰/۹۰۰
      this.sirenLfo = ctx.createOscillator();
      this.sirenLfo.type = 'square';
      this.sirenLfo.frequency.value = 0.85;
      const lfoGain = ctx.createGain();
      lfoGain.gain.value = 180;
      this.sirenLfo.connect(lfoGain);
      lfoGain.connect(this.sirenOsc.frequency);
      this.sirenGain = ctx.createGain();
      this.sirenGain.gain.value = 0;
      const tone = ctx.createBiquadFilter();
      tone.type = 'lowpass';
      tone.frequency.value = 1600;
      this.sirenFilter = tone;
      this.sirenOsc.connect(tone);
      // 🔑 v0.2.48 — لایهٔ «از داخل ماشین»: AM (تیک‌تیک برق‌گردان/روله) + فیلتر متغیر
      this.sirenAmGain = ctx.createGain();
      this.sirenAmGain.gain.value = 1;
      this.sirenAmDepth = ctx.createGain();
      this.sirenAmDepth.gain.value = 0; // عمق با نزدیکی پلیس پر می‌شود
      this.sirenAmLfo = ctx.createOscillator();
      this.sirenAmLfo.type = 'sine';
      this.sirenAmLfo.frequency.value = 5.2;
      this.sirenAmLfo.connect(this.sirenAmDepth);
      this.sirenAmDepth.connect(this.sirenAmGain.gain);
      tone.connect(this.sirenAmGain);
      this.sirenAmGain.connect(this.sirenGain);
      this.sirenGain.connect(this.gains.sfx);
      this.sirenOsc.start();
      this.sirenLfo.start();
      this.sirenAmLfo.start();
      this.sirenOn = true;
    } catch { /* بی‌خطر */ }
  }

  /** فاصلهٔ پلیس/تاکسی تا بازیکن → بلندی آژیر (۰ = دور/خاموش)
   *  🔑 v0.2.48 — پلیسِ نزدیک = آژیر «از داخل ماشین»: بم‌تر + تیک برق‌گردان */
  setSirenProximity(dist: number): void {
    if (!this.sirenGain || !this.ctx) return;
    const p = Math.max(0, Math.min(1, 1 - dist / 2900));
    this.sirenGain.gain.setTargetAtTime(0.028 + p * 0.075, this.ctx.currentTime, 0.12);
    if (this.sirenFilter) {
      // دور = آژیر خیابانی (۱٬۶۰۰Hz باز)؛ نزدیک = پشت شیشه (۵۵۰Hz مافول)
      const cutoff = 1600 - p * 1050; // 1600 → 550
      this.sirenFilter.frequency.setTargetAtTime(cutoff, this.ctx.currentTime, 0.25);
    }
    if (this.sirenAmLfo) {
      // تیک‌تیک چراغ‌گردان فقط وقتی نزدیک است شنیده می‌شود
      this.sirenAmLfo.frequency.setTargetAtTime(4.4 + p * 1.4, this.ctx.currentTime, 0.3);
    }
    if (this.sirenAmDepth) {
      // عمق AM: پلیس چسبیده = صدا مثل از داخل بدنه/شیشه می‌آید
      this.sirenAmDepth.gain.setTargetAtTime(p * 0.38, this.ctx.currentTime, 0.3);
    }
  }

  sirenStop(): void {
    if (!this.sirenOn) return;
    try {
      this.sirenOsc?.stop();
      this.sirenLfo?.stop();
      this.sirenAmLfo?.stop();
    } catch { /* بی‌خطر */ }
    this.sirenOsc = null;
    this.sirenLfo = null;
    this.sirenAmLfo = null;
    this.sirenGain = null;
    this.sirenFilter = null;
    this.sirenAmGain = null;
    this.sirenAmDepth = null;
    this.sirenOn = false;
  }

  /** نسبت سرعت 0..1 → زیر و بمی و بلندی موتور (فایل یا سینتی) */
  setEngineSpeed(ratio: number): void {
    if (!this.ctx || !this.engineRunning) return;
    const r = Math.max(0, Math.min(1, ratio));
    this.setWind(r); // v0.2.45 — ویند با سرعت
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

  // ---------- v0.2.45 — ویند سرعت (نویز پیوسته با بلندی وابسته به سرعت) ----------
  private windSrc: AudioBufferSourceNode | null = null;
  private windGain: GainNode | null = null;

  private startWind(): void {
    if (!this.ctx || !this.gains || this.windSrc) return;
    try {
      // نویز لوپ ۲ ثانیه‌ای — فیلتر lowpass تا «باد» شود نه «خرش»
      const dur = 2;
      const len = Math.floor(this.ctx.sampleRate * dur);
      const buf = this.ctx.createBuffer(1, len, this.ctx.sampleRate);
      const d = buf.getChannelData(0);
      let acc = 0;
      for (let i = 0; i < len; i++) {
        acc += (Math.random() * 2 - 1 - acc) * 0.045; // lowpass یک‌قطبی
        d[i] = acc * 2.4;
      }
      // حلقه بی‌درز: کراس‌فید لبه‌ها
      const xf = Math.floor(0.05 * this.ctx.sampleRate);
      for (let i = 0; i < xf; i++) {
        const f = i / xf;
        d[i] = d[i] * f + d[len - xf + i] * (1 - f);
      }
      this.windSrc = this.ctx.createBufferSource();
      this.windSrc.buffer = buf;
      this.windSrc.loop = true;
      this.windGain = this.ctx.createGain();
      this.windGain.gain.value = 0;
      this.windSrc.connect(this.windGain);
      this.windGain.connect(this.gains.sfx);
      this.windSrc.start();
    } catch { /* بی‌خطر */ }
  }

  private stopWind(): void {
    try {
      this.windSrc?.stop();
    } catch { /* بی‌خطر */ }
    this.windSrc = null;
    this.windGain = null;
  }

  /** نسبت سرعت 0..1 → بلندی ویند (فقط بالای ۴۵٪ سرعت شنیده می‌شود) */
  private setWind(ratio: number): void {
    if (!this.windGain || !this.ctx) return;
    const r = Math.max(0, Math.min(1, ratio));
    const w = Math.max(0, (r - 0.45) / 0.55); // ۰ تا ۴۵٪ = ساکت
    this.windGain.gain.setTargetAtTime(w * 0.055, this.ctx.currentTime, 0.25);
  }

  /** v0.2.45 — «ورووووم» شروع رانندگی (سینتی کوتاه، بعد از startEngine) */
  engineStart(): void {
    if (!this.ctx || !this.gains) return;
    try {
      const t = this.now();
      const osc = this.ctx.createOscillator();
      const g = this.ctx.createGain();
      const f = this.ctx.createBiquadFilter();
      f.type = 'lowpass';
      f.frequency.value = 700;
      osc.type = 'sawtooth';
      osc.frequency.setValueAtTime(42, t);
      osc.frequency.exponentialRampToValueAtTime(130, t + 0.28); // گاز دادن
      osc.frequency.exponentialRampToValueAtTime(64, t + 0.62);  // آرام گرفتن به دور آرام
      g.gain.setValueAtTime(0.0001, t);
      g.gain.linearRampToValueAtTime(0.2, t + 0.1);
      g.gain.setValueAtTime(0.16, t + 0.4);
      g.gain.exponentialRampToValueAtTime(0.0001, t + 0.75);
      osc.connect(f);
      f.connect(g);
      g.connect(this.gains.sfx);
      osc.start(t);
      osc.stop(t + 0.8);
      this.noise(0.18, 0.05, 900, 'bandpass'); // استارتر
    } catch { /* بی‌خطر */ }
  }

  // ---------- افکت‌های تک‌شوت ----------
  /** v0.2.45 — پخش فایل SFX با fallback سینتی؛ هر خطا بی‌خطر */
  private sfxFile(id: string, vol: number, rate = 1): boolean {
    const buf = this.buffer(id);
    if (!buf) return false;
    this.playBuffer(buf, 'sfx', vol, rate);
    return true;
  }

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
    // v0.2.45 — سکه براق فایل واقعی؛ fallback سینتی قبلی
    if (this.sfxFile('sfx_coin_01', 0.5, 0.94 + Math.random() * 0.12)) return;
    this.blip(990, 0.07, 'sine', 0.18, 'sfx');
    window.setTimeout(() => this.blip(1320, 0.1, 'sine', 0.16, 'sfx'), 70);
  }

  /** v0.2.45 — چایم زنگی چک‌پوینت (متمایز از سکه) */
  checkpoint(): void {
    if (this.sfxFile('sfx_checkpoint_01', 0.7)) return;
    this.blip(880, 0.3, 'sine', 0.14, 'sfx');
    window.setTimeout(() => this.blip(1175, 0.34, 'sine', 0.16, 'sfx'), 110);
  }

  /** v0.2.45 — ژینگل شاد مأموریت موفق */
  success(): void {
    if (this.sfxFile('sfx_success_01', 0.85)) return;
    const notes = [523, 659, 784, 1047];
    notes.forEach((n, i) => window.setTimeout(() => this.blip(n, 0.16, 'triangle', 0.16, 'sfx'), i * 130));
  }

  /** v0.2.45 — ترومبون غمگین مأموریت شکست */
  fail(): void {
    if (this.sfxFile('sfx_fail_01', 0.7)) return;
    const notes = [233, 220, 208, 196];
    notes.forEach((n, i) => window.setTimeout(() => this.blip(n, i === 3 ? 0.5 : 0.2, 'sawtooth', 0.1, 'sfx'), i * 260));
  }

  /** v0.2.45 — آچارباد تعمیرگاه (حین ترمیم در زون) */
  repair(): void {
    this.sfxFile('sfx_repair_01', 0.45, 0.92 + Math.random() * 0.16);
  }

  /** 🔑 v0.2.49 — دم‌گذار مسافر موقع رسیدن: کوبش در + لچ + دینگ خوشامد */
  dropoffDoor(): void {
    if (this.sfxFile('sfx_door_01', 0.8, 0.95 + Math.random() * 0.1)) return;
    // fallback سینتی: کوبش + تق لچ
    this.blip(95, 0.2, 'sine', 0.3, 'sfx', 40);
    this.noise(0.05, 0.16, 1800, 'bandpass');
    window.setTimeout(() => this.blip(1568, 0.3, 'sine', 0.08, 'sfx'), 150);
  }

  /** 🔑 v0.2.49 — آچارخوردن (راچت) لحظه‌ای هنگام تعمیر — «تخت‌تخت‌تخت» */
  ratchet(): void {
    if (this.sfxFile('sfx_ratchet_01', 0.55, 0.9 + Math.random() * 0.2)) return;
    // fallback: ۵ تاک سریع فلزی
    for (let k = 0; k < 5; k++) {
      window.setTimeout(() => this.noise(0.03, 0.1, 2800, 'bandpass'), k * 55);
    }
  }

  /** 🔑 v0.2.49 — خش‌خش تنظیم رادیو موقع تعویض ایستگاه */
  radioStatic(): void {
    if (!this.ctx || !this.gains) return;
    try {
      this.noise(0.14, 0.09, 3800, 'bandpass');
      this.noise(0.07, 0.06, 2400, 'bandpass');
    } catch { /* بی‌خطر */ }
  }

  // ---------- 🔑 v0.2.49 — حلقهٔ باران روی شیشه ----------
  private rainSrc: AudioBufferSourceNode | null = null;
  private rainGain: GainNode | null = null;
  private rainOn = false;

  /** شروع حلقهٔ باران (فید ملایم ۱.۵s) — کانال SFX با ولوم کم */
  rainStart(): void {
    if (!this.ctx || !this.gains || this.rainOn) return;
    this.rainOn = true;
    try {
      const t = this.now();
      const buf = this.buffer('sfx_rain_loop');
      const g = this.ctx.createGain();
      g.gain.setValueAtTime(0.0001, t);
      g.gain.linearRampToValueAtTime(0.34, t + 1.5);
      g.connect(this.gains.sfx);
      this.rainGain = g;
      if (buf) {
        const src = this.ctx.createBufferSource();
        src.buffer = buf;
        src.loop = true;
        src.connect(g);
        src.start(t);
        this.rainSrc = src;
      } else {
        // fallback سینتی: نویز لوپ لو-پاس
        const len = Math.floor(this.ctx.sampleRate * 2);
        const nb = this.ctx.createBuffer(1, len, this.ctx.sampleRate);
        const d = nb.getChannelData(0);
        let acc = 0;
        for (let i = 0; i < len; i++) {
          acc += 0.22 * ((Math.random() * 2 - 1) - acc);
          d[i] = acc;
        }
        const src = this.ctx.createBufferSource();
        src.buffer = nb;
        src.loop = true;
        src.connect(g);
        src.start(t);
        this.rainSrc = src;
      }
    } catch {
      this.rainOn = false;
    }
  }

  /** توقف حلقهٔ باران (فید بیرون ۱.۲s) */
  rainStop(): void {
    if (!this.rainOn) return;
    this.rainOn = false;
    const src = this.rainSrc;
    const g = this.rainGain;
    this.rainSrc = null;
    this.rainGain = null;
    if (this.ctx && g) {
      try {
        const t = this.now();
        g.gain.cancelScheduledValues(t);
        g.gain.setValueAtTime(Math.max(0.0001, g.gain.value), t);
        g.gain.exponentialRampToValueAtTime(0.0001, t + 1.2);
        if (src) {
          src.stop(t + 1.3);
          src.onended = () => { try { g.disconnect(); } catch { /* بی‌خطر */ } };
        }
      } catch { /* بی‌خطر */ }
    }
  }

  get rainActive(): boolean {
    return this.rainOn;
  }

  // ---------- 🔑 v0.2.49 — آمبرینس پرنده/شهر صبحگاهی ----------
  private ambSrc: AudioBufferSourceNode | null = null;
  private ambGain: GainNode | null = null;
  private ambOn = false;

  /** شروع آمبرینس صبحگاهی (پرنده + هوم شهر دور) — ولوم خیلی کم */
  ambienceStart(): void {
    if (!this.ctx || !this.gains || this.ambOn) return;
    this.ambOn = true;
    try {
      const t = this.now();
      const g = this.ctx.createGain();
      g.gain.setValueAtTime(0.0001, t);
      g.gain.linearRampToValueAtTime(0.16, t + 2.2);
      g.connect(this.gains.sfx);
      this.ambGain = g;
      const buf = this.buffer('sfx_birds_loop');
      const src = this.ctx.createBufferSource();
      if (buf) {
        src.buffer = buf;
      } else {
        // fallback: سکوت امن — لوپ ۱ ثانیه‌ای خالی نمی‌سازیم؛ فقط بی‌صدا رد شویم
        this.ambOn = false;
        g.disconnect();
        this.ambGain = null;
        return;
      }
      src.loop = true;
      src.connect(g);
      src.start(t);
      this.ambSrc = src;
    } catch {
      this.ambOn = false;
    }
  }

  ambienceStop(): void {
    if (!this.ambOn) return;
    this.ambOn = false;
    const src = this.ambSrc;
    const g = this.ambGain;
    this.ambSrc = null;
    this.ambGain = null;
    if (this.ctx && g) {
      try {
        const t = this.now();
        g.gain.cancelScheduledValues(t);
        g.gain.setValueAtTime(Math.max(0.0001, g.gain.value), t);
        g.gain.exponentialRampToValueAtTime(0.0001, t + 0.9);
        if (src) {
          src.stop(t + 1.0);
          src.onended = () => { try { g.disconnect(); } catch { /* بی‌خطر */ } };
        }
      } catch { /* بی‌خطر */ }
    }
  }

  get ambienceActive(): boolean {
    return this.ambOn;
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

  // ==================== 🔑 v0.2.48 — صداهای درخواستی کاربر ====================

  /** لایی لاستیک موقع ترمز شدید/پارک — کشیده‌تر و واقعی‌تر از skid درفت */
  tireScreech(intensity = 1): void {
    if (!this.ctx || !this.gains) return;
    try {
      const v = Math.max(0.3, Math.min(1, intensity));
      const t = this.now();
      // نویز باندپس با سوییپ نزولی (لایی واقعی لاستیک)
      const len = Math.floor(this.ctx.sampleRate * 0.55);
      const buf = this.ctx.createBuffer(1, len, this.ctx.sampleRate);
      const d = buf.getChannelData(0);
      for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
      const src = this.ctx.createBufferSource();
      src.buffer = buf;
      const f = this.ctx.createBiquadFilter();
      f.type = 'bandpass';
      f.Q.value = 9;
      f.frequency.setValueAtTime(2100, t);
      f.frequency.exponentialRampToValueAtTime(880, t + 0.5);
      const g = this.ctx.createGain();
      g.gain.setValueAtTime(0.0001, t);
      g.gain.linearRampToValueAtTime(0.16 * v, t + 0.06);
      g.gain.exponentialRampToValueAtTime(0.0001, t + 0.55);
      src.connect(f); f.connect(g); g.connect(this.gains.sfx);
      src.start(t); src.stop(t + 0.6);
      // زیرلایه ساییدگی
      this.blip(1450, 0.3, 'sawtooth', 0.05 * v, 'sfx', 820);
    } catch { /* بی‌خطر */ }
  }

  /** صدای دنده — موقع توقف کامل (پارک) یا عقب */
  gearClunk(): void {
    if (!this.ctx || !this.gains) return;
    try {
      // تق مکانیکی کوتاه
      this.noise(0.05, 0.14, 900, 'bandpass');
      this.blip(120, 0.09, 'square', 0.12, 'sfx', 70);
      window.setTimeout(() => this.blip(95, 0.07, 'square', 0.09, 'sfx', 60), 90);
    } catch { /* بی‌خطر */ }
  }

  /** صدای دندهٔ جلو/عقب — وییز کوتاه گیربکس */
  gearWhine(): void {
    if (!this.ctx || !this.gains) return;
    try {
      this.blip(340, 0.18, 'triangle', 0.05, 'sfx', 520);
      this.noise(0.08, 0.06, 1600, 'bandpass');
    } catch { /* بی‌خطر */ }
  }

  /** 🔑 v0.2.48 — «کشیدن پول»: جریمهٔ پلیس (good=false) یا جایزه (good=true) */
  cashOut(good: boolean): void {
    if (!this.ctx || !this.gains) return;
    try {
      const t = this.now();
      if (good) {
        // ka-ching شاد: دو زنگ + وییز پول
        this.blip(1244, 0.14, 'sine', 0.14, 'sfx');
        window.setTimeout(() => this.blip(1864, 0.22, 'sine', 0.12, 'sfx'), 90);
        this.noise(0.25, 0.07, 3200, 'highpass');
      } else {
        // کشیدن برگه/پول جریمه: وییز نزولی + تق دفترچه + زنگ حقوق‌سالاری
        this.blip(880, 0.3, 'triangle', 0.09, 'sfx', 220);
        window.setTimeout(() => this.noise(0.12, 0.1, 1100, 'bandpass'), 140);
        window.setTimeout(() => {
          this.blip(660, 0.1, 'square', 0.07, 'sfx');
          this.blip(440, 0.16, 'square', 0.06, 'sfx');
        }, 260);
      }
      void t;
    } catch { /* بی‌خطر */ }
  }

  // ---------- 🔑 v0.2.48 — رادیو ماشین (آهنگ کوتاه شاد پشت‌زمینه) ----------
  // 🔑 v0.2.49 — دو ایستگاه رادیویی قابل‌انتخاب
  private radioTimer: number | null = null;
  private radioStep = 0;
  private radioNextT = 0;
  private radioOn = false;
  private radioStation: 1 | 2 = 1;

  /** شروع رادیو — لوپ با زمان‌بند WebAudio؛ ایستگاه ۱ شاد پاپ، ایستگاه ۲ سنتیِ ۶/۸ */
  radioStart(station?: 1 | 2): void {
    if (!this.ctx || !this.gains) return;
    if (station && station !== this.radioStation && this.radioOn) {
      // تعویض ایستگاه وسط پخش: خش‌خش کوتاه + ری‌استارت
      this.radioStop();
      this.radioStatic();
    }
    if (station) this.radioStation = station;
    if (this.radioOn) return;
    this.radioOn = true;
    this.radioStep = 0;
    this.radioNextT = this.now() + 0.1;
    const stepSec = this.radioStation === 1 ? 0.19 : 0.155;
    const tick = (): void => {
      if (!this.radioOn || !this.ctx) return;
      const ahead = this.now() + 0.55;
      while (this.radioNextT < ahead) {
        this.radioNote(this.radioStep, this.radioNextT);
        this.radioStep++;
        this.radioNextT += stepSec;
      }
      this.radioTimer = window.setTimeout(tick, 160);
    };
    tick();
  }

  /** 🔑 v0.2.49 — تعویض ایستگاه رادیو (حین پخش → خش‌خش + ری‌استارت) */
  setRadioStation(station: 1 | 2): void {
    if (station === this.radioStation) return;
    if (this.radioOn) {
      this.radioStart(station);
    } else {
      this.radioStation = station;
    }
  }

  get radioStationId(): 1 | 2 {
    return this.radioStation;
  }

  radioStop(): void {
    this.radioOn = false;
    if (this.radioTimer !== null) {
      window.clearTimeout(this.radioTimer);
      this.radioTimer = null;
    }
  }

  get radioPlaying(): boolean {
    return this.radioOn;
  }

  /** یک نُت رادیو در زمان t — 🔑 v0.2.49: بسته به ایستگاه، دو سبک متفاوت */
  private radioNote(step: number, t: number): void {
    if (!this.ctx || !this.gains) return;
    try {
      if (this.radioStation === 2) this.radioNote2(step, t);
      else this.radioNote1(step, t);
    } catch { /* بی‌خطر */ }
  }

  /** کیک بم مشترک هر دو ایستگاه */
  private radioKick(t: number, f0 = 150, amp = 0.1): void {
    if (!this.ctx || !this.gains) return;
    const o = this.ctx.createOscillator();
    const g = this.ctx.createGain();
    o.type = 'sine';
    o.frequency.setValueAtTime(f0, t);
    o.frequency.exponentialRampToValueAtTime(46, t + 0.1);
    g.gain.setValueAtTime(amp, t);
    g.gain.exponentialRampToValueAtTime(0.0001, t + 0.12);
    o.connect(g); g.connect(this.gains.music);
    o.start(t); o.stop(t + 0.14);
  }

  /** پرکاشن نویزی مشترک (هی‌هت / تنبک) */
  private radioTick(t: number, cutoff: number, amp: number, durSec = 0.035): void {
    if (!this.ctx || !this.gains) return;
    const len = Math.floor(this.ctx.sampleRate * durSec);
    const buf = this.ctx.createBuffer(1, len, this.ctx.sampleRate);
    const d = buf.getChannelData(0);
    for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * (1 - i / len);
    const src = this.ctx.createBufferSource();
    src.buffer = buf;
    const f = this.ctx.createBiquadFilter();
    f.type = 'highpass';
    f.frequency.value = cutoff;
    const g = this.ctx.createGain();
    g.gain.value = amp;
    src.connect(f); f.connect(g); g.connect(this.gains.music);
    src.start(t);
  }

  /** 🔑 v0.2.49 — ایستگاه ۱: «رادیو شاد» — همان الگوی محور اِمینور پاپ (آرپژ پلاکی) */
  private radioNote1(step: number, t: number): void {
    const s = step % 64; // ۴ میزان × ۱۶ شانزدهم
    const bar = Math.floor(s / 16);
    // پیش‌روی آکورد: Am - F - C - G
    const roots = [220.0, 174.6, 130.8, 196.0];
    const root = roots[bar];
    // باس — روی ۴م و ۱۲م شانزدهم
    if (s % 8 === 0 || s % 16 === 11) {
      const o = this.ctx!.createOscillator();
      const g = this.ctx!.createGain();
      o.type = 'triangle';
      o.frequency.value = root / 2;
      g.gain.setValueAtTime(0.0001, t);
      g.gain.linearRampToValueAtTime(0.085, t + 0.015);
      g.gain.exponentialRampToValueAtTime(0.0001, t + 0.17);
      o.connect(g); g.connect(this.gains!.music);
      o.start(t); o.stop(t + 0.2);
    }
    // ملودی پلاکی — آرپژ پنتاتونیک
    const mel = [0, 7, 12, 7, 3, 7, 10, 7, 0, 7, 12, 15, 12, 7, 3, 0];
    if (s % 2 === 0) {
      const semi = mel[(s / 2) % 16];
      const freq = root * Math.pow(2, semi / 12);
      const o = this.ctx!.createOscillator();
      const g = this.ctx!.createGain();
      o.type = 'square';
      o.frequency.value = freq * 2;
      g.gain.setValueAtTime(0.0001, t);
      g.gain.linearRampToValueAtTime(0.032, t + 0.01);
      g.gain.exponentialRampToValueAtTime(0.0001, t + 0.13);
      const f = this.ctx!.createBiquadFilter();
      f.type = 'lowpass';
      f.frequency.value = 2600;
      o.connect(f); f.connect(g); g.connect(this.gains!.music);
      o.start(t); o.stop(t + 0.15);
    }
    // کیک — بیت‌های ۰/۸
    if (s % 8 === 0) this.radioKick(t);
    // هی‌هت — شانزدهم‌های زوج ضعیف
    if (s % 4 === 2) this.radioTick(t, 6500, 0.045);
  }

  /** 🔑 v0.2.49 — ایستگاه ۲: «رادیو گل‌ها» — ریتم ۶/۸ ایرانی، گام هارمونیک، نِی‌وار */
  private radioNote2(step: number, t: number): void {
    const s = step % 48; // ۴ میزان × ۱۲ شانزدهم (حس ۶/۸)
    const bar = Math.floor(s / 12);
    // پیش‌روی هارمونیک مینور ایرانی: Dm - Gm - A# - A7
    const roots = [146.83, 196.0, 233.08, 220.0];
    const root = roots[bar];
    // باس روی ضرب‌های اصلی ۶/۸ (۰، ۶) + پس‌ضرب (۹)
    if (s % 12 === 0 || s % 12 === 6) {
      const o = this.ctx!.createOscillator();
      const g = this.ctx!.createGain();
      o.type = 'triangle';
      o.frequency.value = root / 2;
      g.gain.setValueAtTime(0.0001, t);
      g.gain.linearRampToValueAtTime(0.09, t + 0.02);
      g.gain.exponentialRampToValueAtTime(0.0001, t + 0.24);
      o.connect(g); g.connect(this.gains!.music);
      o.start(t); o.stop(t + 0.27);
    }
    // تنبک: بم (کیک) روی ۰، «تک» تیز روی ۳/۶/۹ + ریز در ۱۱
    if (s % 12 === 0) this.radioKick(t, 130, 0.11);
    if (s % 12 === 3 || s % 12 === 6 || s % 12 === 9) this.radioTick(t, 1400, 0.06, 0.05);
    if (s % 12 === 11) this.radioTick(t, 1600, 0.035, 0.028);
    // ملودی نِی‌وار (ساوتوث نرم با فیلتر) — گام D هارمونیک مینور
    const mel = [0, 4, 7, 12, 11, 7, 4, 2, 0, 4, 7, 14];
    if (s % 2 === 0) {
      const semi = mel[(s / 2) % 12];
      const freq = root * Math.pow(2, semi / 12);
      const o = this.ctx!.createOscillator();
      const g = this.ctx!.createGain();
      o.type = 'sawtooth';
      // ویبروی خوانشی نرم
      o.frequency.setValueAtTime(freq * 2, t);
      if (s % 12 === 0) o.frequency.linearRampToValueAtTime(freq * 2 * 1.012, t + 0.22);
      g.gain.setValueAtTime(0.0001, t);
      g.gain.linearRampToValueAtTime(0.028, t + 0.02);
      g.gain.exponentialRampToValueAtTime(0.0001, t + 0.2);
      const f = this.ctx!.createBiquadFilter();
      f.type = 'lowpass';
      f.frequency.value = 1900; // نرم — حس ساز بادی
      f.Q.value = 1.2;
      o.connect(f); f.connect(g); g.connect(this.gains!.music);
      o.start(t); o.stop(t + 0.22);
    }
    // سنتوروار: نُت پراکنده براق هر آغاز میزان
    if (s % 12 === 0 || s % 24 === 8) {
      const semi = [12, 16, 19][bar];
      const freq = roots[bar] * Math.pow(2, semi / 12) * 2;
      const o = this.ctx!.createOscillator();
      const g = this.ctx!.createGain();
      o.type = 'sine';
      o.frequency.value = freq;
      g.gain.setValueAtTime(0.0001, t);
      g.gain.linearRampToValueAtTime(0.02, t + 0.005);
      g.gain.exponentialRampToValueAtTime(0.0001, t + 0.4);
      o.connect(g); g.connect(this.gains!.music);
      o.start(t); o.stop(t + 0.45);
    }
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
