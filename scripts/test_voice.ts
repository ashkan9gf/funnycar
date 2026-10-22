/**
 * test_voice.ts — تست واحد VoiceManager (بدون مرورگر)
 * اجرا: bun scripts/test_voice.ts
 * پوشش: TEST-VOICE-001 (Pool تصادفی)، 002 (Cooldown)، 003 (Priority)
 */

import { VoiceManager } from '../src/game/managers/VoiceManager';
import { DIALOGUES } from '../src/game/data/dialogues';

let pass = 0;
let fail = 0;
function check(name: string, cond: boolean, extra = ''): void {
  if (cond) {
    pass++;
    console.log(`✓ ${name}`);
  } else {
    fail++;
    console.log(`✗ ${name} ${extra}`);
  }
}

// ---------- TEST-VOICE-001: Pool تصادفی و جلوگیری از تکرار ----------
const vm1 = new VoiceManager();
const lines = new Set<string>();
for (let i = 0; i < 30; i++) {
  const info = vm1.trigger('car_crash', i * 5000); // فاصله بیشتر از cooldown رویداد
  if (info) lines.add(info.line);
}
check('POOL: بیش از یک جمله متفاوت پخش شد', lines.size > 1, `تعداد متن‌های دیده‌شده: ${lines.size}`);
// 🔑 v0.2.48 — استخرها بزرگ شدند؛ اعتبارسنجی پویا برابر Pool رسمی + تست کیسهٔ بُر
check('POOL: همه جمله‌ها از Pool رسمی‌اند', [...lines].every((l) => DIALOGUES.car_crash.lines.includes(l)));
// کیسهٔ بُر: با N×3 تریگر (فاصله > cooldown) باید «همهٔ» جمله‌ها حداقل یک‌بار پخش شوند
{
  const vmBag = new VoiceManager();
  const seen = new Set<string>();
  const n = DIALOGUES.car_crash.lines.length;
  for (let i = 0; i < n * 3; i++) {
    const info = vmBag.trigger('car_crash', i * 5000);
    if (info) seen.add(info.line);
  }
  check('BAG: کیسهٔ بُر همهٔ جمله‌ها را پخش کرد (صفر تکرار زودهنگام)', seen.size === n, `دیده‌شده ${seen.size}/${n}`);
  // هیچ دو تریگر متوالی همان جمله را نمی‌دهد
  const vmSeq = new VoiceManager();
  let repeatAdjacent = 0;
  let prevLine: string | null = null;
  for (let i = 0; i < 40; i++) {
    const info = vmSeq.trigger('drift', i * 20000);
    if (info) {
      if (info.line === prevLine) repeatAdjacent++;
      prevLine = info.line;
    }
  }
  check('BAG: هیچ جمله‌ای پشت‌سرهم تکرار نمی‌شود', repeatAdjacent === 0, `تکرار متوالی: ${repeatAdjacent}`);
}

// ---------- TEST-VOICE-002: Cooldown رویداد ----------
const vm2 = new VoiceManager();
const a = vm2.trigger('car_crash', 1000);
const b = vm2.trigger('car_crash', 2000); // فقط 1 ثانیه بعد
const c = vm2.trigger('car_crash', 1000 + 4001); // بعد از cooldown
check('COOLDOWN: اولین تریگر پخش شد', a !== null);
check('COOLDOWN: تریگر زودهنگام رد شد', b === null);
check('COOLDOWN: تریگر بعد از سپری شدن cooldown پخش شد', c !== null);

// ---------- TEST-VOICE-003: Priority ----------
const vm3 = new VoiceManager();
vm3.trigger('idle_funny', 0); // priority 0 فعال شد (گوینده: radio)
const higher = vm3.trigger('police_stop', 800); // priority 3، گوینده متفاوت، بعد از فاصله جهانی 700ms
check('PRIORITY: جمله مهم‌تر جایگزین شد', higher !== null);
const lowBlocked = vm3.trigger('idle_funny', 900); // 0 < 3 فعال → رد
check('PRIORITY: جمله کم‌اهمیت‌تر هنگام فعالیت جمله مهم رد شد', lowBlocked === null);

// ---------- گوینده cooldown ----------
const vm4 = new VoiceManager();
vm4.trigger('car_crash', 0); // driver
const sp = vm4.trigger('hard_brake', 500); // همان driver، priority 1 < 4 → باید رد شود (فاصله <1600)
check('SPEAKER: گوینده تکراری زودهنگام رد شد', sp === null);

console.log(`\nنتیجه: ${pass} موفق، ${fail} ناموفق`);
if (fail > 0) process.exit(1);
