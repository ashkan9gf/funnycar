/**
 * SpeechService.ts — خواندن جملات فارسی بازی با صدای بلند (v0.2.45)
 * ============================================================
 * درخواست کاربر: «صداهای وسط بازی باید فارسی باشند؛ آلرت‌ها را بخواند، خنده‌دارها و...»
 *
 * موتور TTS ابری با فارسی غیرقابل‌اعتماد بود → راه‌حل حرفه‌ای:
 *  1) پل بومی اندروید (window.AndroidTTS از NativeTTS.java) — موتور گوگل فارسیِ خود گوشی
 *  2) fallback مرورگر: window.speechSynthesis با صدای fa-* (کروم اندروید)
 *  3) هیچ‌کدام نبود → ساکت (متن حباب/توست هست؛ بازی هیچ‌وقت نمی‌شکند)
 *
 * هر شخصیت «زیر و بمی» خودش را دارد تا مثل چند آدم مختلف به نظر برسد:
 *   راننده عادی، پلیس بم‌تر، مسافر زیرتر، عمو نقی (مکانیک) بم و آروم،
 *   رادیو تندتر، گربه خیلی زیر!
 */

export interface SpeechVoice {
  pitch: number; // 0.5..2 — زیر و بمی
  rate: number;  // 0.5..2 — سرعت
}

/** امضای صوتی هر گوینده — SpeakerId از dialogues.ts */
export const SPEECH_VOICES: Record<string, SpeechVoice> = {
  driver:    { pitch: 1.0,  rate: 1.05 },
  police:    { pitch: 0.7,  rate: 1.0 },
  passenger: { pitch: 1.4,  rate: 1.1 },
  mechanic:  { pitch: 0.75, rate: 0.9 },
  radio:     { pitch: 0.9,  rate: 1.2 },
  cat:       { pitch: 1.9,  rate: 1.15 },
};

interface AndroidTTSBridge {
  speak(text: string, pitch: number, rate: number, volume: number, interrupt: boolean): boolean;
  stop(): void;
  isReady(): boolean;
  isPersian(): boolean;
}

class SpeechService {
  private bridge: AndroidTTSBridge | null = null;
  /** null = هنوز امتحان نشده؛ بعد از اولین تلاش true/false */
  private bridgeOk: boolean | null = null;
  private webOk: boolean | null = null;
  private faVoice: SpeechSynthesisVoice | null = null;

  private enabled = true;
  private volume = 1.0;
  private lastSpokenAt = 0;
  private lastLine = '';
  /** آمار QA — window.__funnycar.speech */
  spokenCount = 0;
  droppedCount = 0;

  /** اتصال پل بومی — GameShell در بوت صدا می‌زند */
  detectBridge(): boolean {
    if (this.bridgeOk !== null) return this.bridgeOk === true;
    try {
      const b = (window as unknown as { AndroidTTS?: AndroidTTSBridge }).AndroidTTS;
      if (b && typeof b.speak === 'function') {
        this.bridge = b;
        this.bridgeOk = true;
        return true;
      }
    } catch { /* بی‌خطر */ }
    this.bridgeOk = false;
    return false;
  }

  /** گرم کردن speechSynthesis مرورگر (لیست صداها async می‌آید) */
  warmup(): void {
    this.detectBridge();
    if (this.bridgeOk) return;
    try {
      if (typeof window === 'undefined' || !('speechSynthesis' in window)) {
        this.webOk = false;
        return;
      }
      const pick = (): void => {
        try {
          const voices = window.speechSynthesis.getVoices();
          if (voices.length === 0) return;
          this.faVoice = voices.find((v) => v.lang.toLowerCase().startsWith('fa')) ?? null;
          this.webOk = true;
        } catch { /* بی‌خطر */ }
      };
      pick();
      window.speechSynthesis.onvoiceschanged = () => pick();
      // برخی مرورگرها تا اولین getVoices بعد از gesture لیست خالی می‌دهند
      window.setTimeout(pick, 350);
      window.setTimeout(pick, 1500);
    } catch { /* بی‌خطر */ }
  }

  setEnabled(on: boolean): void {
    this.enabled = on;
    if (!on) this.stop();
  }

  setVolume(v: number): void {
    this.volume = Math.max(0, Math.min(1, v));
    if (this.volume <= 0.05) this.stop();
  }

  /**
   * خواندن یک جمله با صدای گوینده‌اش.
   * @param priority اولویت رویداد دیالوگ (۵=بحرانی) — بحرانی‌ها جملهٔ قبلی را قطع می‌کنند
   */
  speak(line: string, speaker: string, priority: number): void {
    if (!this.enabled || this.volume <= 0.05) return;
    if (!line || !line.trim()) return;
    const now = performance.now();
    // لِمیتر: جملات مهم فوری می‌آیند؛ بقیه حداقل ۲.۲ ثانیه فاصله (تا شلوغ نشود)
    const gap = priority >= 4 ? 650 : 2200;
    if (now - this.lastSpokenAt < gap) {
      this.droppedCount++;
      return;
    }
    this.lastSpokenAt = now;
    this.lastLine = line;
    this.spokenCount++;

    const v = SPEECH_VOICES[speaker] ?? SPEECH_VOICES.driver;
    const interrupt = priority >= 4;

    // ---------- 1) پل بومی اندروید ----------
    if (this.bridgeOk === null) this.detectBridge();
    if (this.bridgeOk && this.bridge) {
      try {
        if (this.bridge.isReady() && this.bridge.speak(line, v.pitch, v.rate, this.volume, interrupt)) return;
      } catch { /* بی‌خطر → fallback */ }
    }

    // ---------- 2) speechSynthesis مرورگر ----------
    this.speakWeb(line, v, interrupt);
  }

  private speakWeb(line: string, v: SpeechVoice, interrupt: boolean): void {
    if (this.webOk === false) return;
    try {
      if (typeof window === 'undefined' || !('speechSynthesis' in window)) {
        this.webOk = false;
        return;
      }
      const synth = window.speechSynthesis;
      if (interrupt) synth.cancel();
      const u = new SpeechSynthesisUtterance(line);
      u.lang = 'fa-IR';
      if (this.faVoice) u.voice = this.faVoice;
      u.pitch = v.pitch;
      u.rate = v.rate;
      u.volume = this.volume;
      synth.speak(u);
      this.webOk = true;
    } catch {
      this.webOk = false;
    }
  }

  /** قطع فوری — Pause/مینیمایز */
  stop(): void {
    try {
      this.bridge?.stop();
    } catch { /* بی‌خطر */ }
    try {
      if (typeof window !== 'undefined' && 'speechSynthesis' in window) window.speechSynthesis.cancel();
    } catch { /* بی‌خطر */ }
  }

  /** وضعیت برای window.__funnycar.speech (QA) */
  debugState(): Record<string, unknown> {
    return {
      bridge: this.bridgeOk,
      web: this.webOk,
      faVoice: this.faVoice ? this.faVoice.name : null,
      enabled: this.enabled,
      volume: this.volume,
      spoken: this.spokenCount,
      dropped: this.droppedCount,
      lastLine: this.lastLine,
    };
  }
}

/** سینگلتون سراسری */
export const speech = new SpeechService();
