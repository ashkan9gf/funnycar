// تست قطعی SAT — برخورد دقیق (بدون برخورد خیالی)
const { obbFromAngle, obbFromAABB, satOverlapMTV } = require('/home/z/my-project/node_modules/.bin/../src/game/entities/obb.ts');

let pass = 0, fail = 0;
function check(name, cond) {
  if (cond) { pass++; console.log('  ✓', name); }
  else { fail++; console.log('  ✗ FAIL:', name); }
}

// ابعاد بازیکن: drawW=112, drawH=196 → hitW=91.8, hitH=176.4
function playerBox(x, y, angle) {
  return obbFromAngle(x, y, angle, 176.4 / 2, 91.8 / 2);
}

console.log('--- 1) رد شدن نزدیکِ کنار پارکی (بدون تماس) → بدون برخورد ---');
{
  // پارکی رنو۴ (hw 35, hh 81) در x=5000 رو به شمال؛ بازیکن در لاین کناری با گپ ۳۰px
  const parked = obbFromAngle(5000, 3000, 0, 81, 35);
  const gap = 30;
  const px = 5000 + 35 + (91.8 / 2) + gap;
  const mtv = satOverlapMTV(playerBox(px, 3000, 0), parked);
  check('گپ ۳۰px → null', mtv === null);
  // گپ ۱px هم باید null باشد
  const px2 = 5000 + 35 + (91.8 / 2) + 1;
  check('گپ ۱px → null', satOverlapMTV(playerBox(px2, 3000, 0), parked) === null);
  // گپ ۰ (چسبیده) → برخورد با عمق کم
  const mtv0 = satOverlapMTV(playerBox(5000 + 35 + 91.8 / 2, 3000, 0), parked);
  check('تماس کامل → برخورد کم‌عمق', mtv0 !== null && mtv0.depth < 12);
  // نیم‌بدنه داخل پارکی (۱۰۰px هم‌پوشانی)
  const mtv100 = satOverlapMTV(playerBox(5000 + 35 + 91.8 / 2 - 100, 3000, 0), parked);
  check('۱۰۰px نفوذ → MT به راست (+X)', mtv100 !== null && mtv100.x > 0.9 && mtv100.depth > 80);
}

console.log('--- 2) حرکت مورب کنار دیوار (AABB قدیمی می‌گرفت!) ---');
{
  // دیوار AABB بزرگ در x=6000..6400؛ بازیکن ۴۵° نزدیک گوشه با گپ
  const wall = obbFromAABB(6000, 2000, 400, 400);
  // نقطه گوشه دیوار: (6000, 2000). بازیکن مورب با فاصله ۸۰px از گوشه
  const px = 6000 - 80 * Math.SQRT1_2;
  const py = 2000 - 80 * Math.SQRT1_2;
  const mtv = satOverlapMTV(playerBox(px, py, Math.PI / 4), wall);
  check('مورب با گپ ۸۰px از گوشه → null', mtv === null);
  // ۲۰px از گوشه (AABB قدیمی: hw+hh روی قطر ~134 → برخورد خیالی!)
  const px2 = 6000 - 20 * Math.SQRT1_2;
  const py2 = 2000 - 20 * Math.SQRT1_2;
  const mtv2 = satOverlapMTV(playerBox(px2, py2, Math.PI / 4), wall);
  check('مورب با گپ ۲۰px از گوشه → null (قبلاً برخورد خیالی بود)', mtv2 === null);
  // نفوذ واقعی ۵۰px داخل دیوار
  const px3 = 6000 + 50 * Math.SQRT1_2;
  const py3 = 2000 + 50 * Math.SQRT1_2;
  const mtv3 = satOverlapMTV(playerBox(px3, py3, Math.PI / 4), wall);
  check('نفوذ واقعی → MT به بیرون (هر دو مؤلفه منفی)', mtv3 !== null && mtv3.x < 0 && mtv3.y < 0);
}

console.log('--- 3) برخورد سر-به-سر ترافیک (MTV محور جلو) ---');
{
  const a = playerBox(0, 0, 0); // رو به شمال
  const b = obbFromAngle(0, -200, 0, 95, 39); // ترافیک جلورو، هم‌محور
  const mtv = satOverlapMTV(a, b);
  check('دو ماشین در ۲۰۰px (جمع نصف‌طول‌ها ۱۸۳ → نفوذ ۱۷px)', mtv !== null && mtv.depth > 10 && mtv.depth < 25);
  // MT باید روی Y باشد (محور برخورد)
  check('MT عمودی است', Math.abs(mtv.y) > Math.abs(mtv.x));
}

console.log('--- 4) پارکی چرخیده ۹۰° (دوبله‌پارک افقی) ---');
{
  const parked = obbFromAngle(5000, 3000, Math.PI / 2, 81, 35); // افقی خوابیده
  const mtv = satOverlapMTV(playerBox(5000 + 35 + 91.8 / 2 + 25, 3000, 0), parked);
  check('گپ ۲۵px کنار پارکی افقی → null', mtv === null);
  const mtv2 = satOverlapMTV(playerBox(5000, 3000 - 81 - 88.2 + 10, 0), parked);
  check('۱۰px نفوذ از سر پارکی افقی → برخورد', mtv2 !== null);
}

console.log(`\nنتیجه: ${pass} ✓ / ${fail} ✗`);
process.exit(fail > 0 ? 1 : 0);
