/**
 * test_voice.ts — تست واحد VoiceManager (بدون مرورگر)
 * اجرا: bun scripts/test_voice.ts
 * پوشش: TEST-VOICE-001 (Pool تصادفی)، 002 (Cooldown)، 003 (Priority)
 */

import { VoiceManager } from '../src/game/managers/VoiceManager';

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
check('POOL: همه جمله‌ها از Pool رسمی‌اند', [...lines].every((l) =>
  ['داداش چیزی نشد!', 'ماشین فقط یه کم ناراحت شد.', 'این دیگه ماشین نیست، خاطره‌ست!', 'بیمه داری؟ 😅', 'جدول حق داشت وایسه، ولی این‌قدر نه!'].includes(l),
));

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
