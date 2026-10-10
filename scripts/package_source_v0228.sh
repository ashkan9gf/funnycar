#!/bin/bash
# package_source_v0228.sh — بسته‌بندی سورس نهایی فانی‌کار v0.2.28
# شامل: src + public + android-build (بدون خروجی‌های بازتولیدشدنی) + اسکریپت‌ها + کانفیگ‌ها + worklog
set -e
ROOT=/home/z/my-project
AB=/tmp/my-project/android-build
OUT=$ROOT/download/FunnyCarIR-Source-v0.2.28.zip
STAGE=/tmp/fc-source-stage

echo "=== [1/5] آماده‌سازی stage ==="
rm -rf $STAGE && mkdir -p $STAGE/FunnyCarIR
S=$STAGE/FunnyCarIR

echo "=== [2/5] کپی سورس اصلی ==="
cp -r $ROOT/src $S/src
cp -r $ROOT/public $S/public
cp -r $ROOT/docs $S/docs
cp -r $ROOT/db $S/db
cp -r $ROOT/prisma $S/prisma
cp -r $ROOT/tests $S/tests
mkdir -p $S/scripts
# اسکریپت‌ها بدون اسکرین‌شات‌های E2E (فقط کد + raw_assets)
find $ROOT/scripts -maxdepth 1 -type f ! -name "*.png" -exec cp {} $S/scripts/ \;
cp -r $ROOT/scripts/raw_assets $S/scripts/raw_assets

echo "=== [3/5] android-build (بدون APK بازتولیدشدنی و assets/www) ==="
mkdir -p $S/android-build
for item in AndroidManifest.xml api_route_backup_wp classes debug.keystore dexout java res resources.zip next.config.ts.bak; do
  cp -r $AB/$item $S/android-build/
done

echo "=== [4/5] فایل‌های ریشه ==="
for f in package.json bun.lock tsconfig.json next.config.ts tailwind.config.ts postcss.config.mjs eslint.config.mjs components.json next-env.d.ts README_FA.md Caddyfile worklog.md; do
  cp $ROOT/$f $S/ 2>/dev/null || echo "  ⚠️ $f یافت نشد"
done

echo "=== [5/5] زیپ نهایی ==="
rm -f $OUT
cd $STAGE && zip -q -r -9 $OUT FunnyCarIR
echo "--- محتویات کلیدی ---"
unzip -l $OUT | rg "src/game/render3d/world|public/assets/models/buildings|android-build/AndroidManifest|build_apk_v0228|worklog.md|package.json" | head -10
echo "--- تعداد کل فایل‌ها و حجم ---"
unzip -l $OUT | tail -1
ls -la $OUT
echo "=== DONE ==="
