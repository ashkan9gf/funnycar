/**
 * VoiceManager.ts — مدیر جملات طنز (صوتی/متنی)
 * ============================================================
 * (بخش Funny Voice سند مادر — فلوچارت رسمی:)
 *   Event → Voice Pool → Random Selection → Cooldown Check → Play
 *
 * - هر رویداد یک Pool جمله دارد (dialogues.ts — Data-Driven)
 * - Random: جمله تکراری پشت سر هم نمی‌آید
 * - Cooldown: همین رویداد / همین گوینده / فاصله جهانی
 * - Priority: جمله مهم‌تر، جمله در حال پخشِ کم‌اهمیت‌تر را قطع می‌کند
 * - فاز 1: پخش به‌صورت حباب متنی؛ فایل صوتی voice_*.ogg وقتی آمد خودکار پخش می‌شود
 */

import { DIALOGUES, type SpeakerId } from '../data/dialogues';

export interface SpeakInfo {
  key: string;         // رویداد
  line: string;        // جمله
  speaker: SpeakerId;
  priority: number;
  /** مدت نمایش حباب (ثانیه) */
  durationSec: number;
}

export interface VoiceAudioHook {
  /** اگر فایل صوتی رویداد موجود بود پخش شود (فاز 7/9) — فعلاً no-op */
  playVoiceFile?: (eventKey: string, index: number) => void;
}

/** v0.2.45 — قلاب گفتار فارسی: جملهٔ انتخاب‌شده با TTS بلند خوانده می‌شود */
export interface SpeechHook {
  speak?: (line: string, speaker: SpeakerId, priority: number) => void;
}

export class VoiceManager {
  private lastEventAt = new Map<string, number>();
  private lastSpeakerAt = new Map<SpeakerId, number>();
  private lastGlobalAt = 0;
  /** 🔑 v0.2.48 — کیسهٔ بُر هر رویداد: همهٔ جمله‌ها به‌ترتیب تصادفی مصرف می‌شوند
   *  و وقتی استخر خالی شد دوباره بُر می‌خورد — هیچ جمله‌ای پشت‌سرهم تکرار نمی‌شود */
  private bags = new Map<string, number[]>();
  private active: SpeakInfo | null = null;
  private elapsed = 0;
  private speechHook?: SpeechHook;

  constructor(private audioHook?: VoiceAudioHook) {}

  setAudioHook(hook?: VoiceAudioHook): void {
    this.audioHook = hook;
  }

  /** v0.2.45 — اتصال SpeechService؛ هر جملهٔ تریگرشده با صدای فارسی خوانده می‌شود */
  setSpeechHook(hook?: SpeechHook): void {
    this.speechHook = hook;
  }

  /** 🔑 v0.2.48 — انتخاب جمله از کیسهٔ بُر (بدون تکرار تا تمام‌شدن استخر) */
  private pickIndex(key: string, n: number): number {
    if (n <= 1) return 0;
    let bag = this.bags.get(key);
    if (!bag || bag.length === 0) {
      bag = Array.from({ length: n }, (_, i) => i);
      // بُر فیشر-ییتس
      for (let i = bag.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [bag[i], bag[j]] = [bag[j], bag[i]];
      }
    }
    const idx = bag.pop() as number;
    this.bags.set(key, bag);
    return idx;
  }

  /**
   * تریگر یک رویداد — همه چیز وابسته به کلید رویداد است (نه متن)
   */
  trigger(key: string, nowMs: number): SpeakInfo | null {
    const ev = DIALOGUES[key];
    if (!ev) return null;

    // احتمال (بعضی رویدادها همیشه نمی‌آیند)
    if (ev.chance !== undefined && Math.random() > ev.chance) return null;

    // ---------- Cooldown رویداد ----------
    const lastEv = this.lastEventAt.get(key) ?? -Infinity;
    if (nowMs - lastEv < ev.cooldownMs) return null;

    // ---------- Priority نسبت به جمله در حال پخش ----------
    if (this.active && ev.priority < this.active.priority) return null;

    // ---------- Cooldown گوینده ----------
    const lastSp = this.lastSpeakerAt.get(ev.speaker) ?? -Infinity;
    if (nowMs - lastSp < 1600 && ev.priority < 4) return null;

    // ---------- Cooldown جهانی ----------
    if (nowMs - this.lastGlobalAt < 700 && ev.priority < 4) return null;

    // ---------- 🔑 v0.2.48 — انتخاب از کیسهٔ بُر (بدون تکرار) ----------
    const idx = this.pickIndex(key, ev.lines.length);

    const info: SpeakInfo = {
      key,
      line: ev.lines[idx],
      speaker: ev.speaker,
      priority: ev.priority,
      durationSec: Math.max(1.7, Math.min(3.6, ev.lines[idx].length * 0.075)),
    };

    this.active = info;
    this.elapsed = 0;
    this.lastEventAt.set(key, nowMs);
    this.lastSpeakerAt.set(ev.speaker, nowMs);
    this.lastGlobalAt = nowMs;

    // اگر فایل صوتی موجود باشد پخش می‌شود (فعلاً فقط متن)
    this.audioHook?.playVoiceFile?.(key, idx);
    // v0.2.45 — خواندن بلند جملهٔ فارسی (همان خطی که حباب/توست نشان می‌دهد)
    this.speechHook?.speak?.(info.line, ev.speaker, ev.priority);
    return info;
  }

  /** به‌روزرسانی انقضای جمله فعال — هر فریم */
  update(dtSec: number): void {
    if (!this.active) return;
    this.elapsed += dtSec;
    if (this.elapsed >= this.active.durationSec) this.active = null;
  }

  get current(): SpeakInfo | null {
    return this.active;
  }

  /** قطع فوری (مثلاً هنگام Pause) */
  clear(): void {
    this.active = null;
  }
}
