/**
 * AudioManager.ts — صداهای سینتی WebAudio (Phase 1)
 * ============================================================
 * (ARCHITECTURE بخش ۹ — تصمیم جلسه: «صدای سینتی»)
 *  - 4 کانال مستقل: Music / SFX / Voice / UI — هر کدام Volume جدا
 *  - افکت‌ها با oscillator/noise ساخته می‌شوند (بدون فایل — آفلاین کامل)
 *  - در فاز 7/9 فایل‌های OGG جایگزین می‌شوند بدون تغییر کد فراخوان
 *  - هر خطا → بی‌صدایی امن؛ هرگز Crash (TEST-AUD-005)
 */

export type AudioChannel = 'music' | 'sfx' | 'voice' | 'ui';

export class AudioManager {
  private ctx: AudioContext | null = null;
  private gains: Record<AudioChannel, GainNode> | null = null;
  private volumes: Record<AudioChannel, number> = { music: 0.7, sfx: 0.9, voice: 1.0, ui: 0.9 };

  // موتور ماشین
  private engOsc1: OscillatorNode | null = null;
  private engOsc2: OscillatorNode | null = null;
  private engFilter: BiquadFilterNode | null = null;
  private engGain: GainNode | null = null;
  private engineRunning = false;

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
    } catch { /* بی‌خطر */ }
    this.engOsc1 = null;
    this.engOsc2 = null;
    this.engineRunning = false;
  }

  /** نسبت سرعت 0..1 → زیر و بمی و بلندی موتور */
  setEngineSpeed(ratio: number): void {
    if (!this.ctx || !this.engineRunning || !this.engOsc1 || !this.engOsc2 || !this.engGain) return;
    const r = Math.max(0, Math.min(1, ratio));
    const t = this.ctx.currentTime;
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

  horn(variant = 0): void {
    const base = [340, 300, 380][variant % 3];
    this.blip(base, 0.26, 'triangle', 0.22, 'sfx');
    this.blip(base * 1.26, 0.26, 'triangle', 0.16, 'sfx');
  }

  crash(hard: boolean): void {
    this.noise(hard ? 0.3 : 0.16, hard ? 0.4 : 0.22, hard ? 900 : 1400, 'bandpass');
    this.blip(hard ? 120 : 160, 0.22, 'sine', 0.3, 'sfx', 45);
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
