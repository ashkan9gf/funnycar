#!/bin/bash
# build_apk_v0233.sh — خط لوله کامل APK فانی‌کار v0.2.27 (INFINITE-IR + HITBOX-EXACT + IR-SIGNS) (CITY-FULL + OPEN-WORLD + FPS-OPT)
# نسخه → export وب (با جابجایی api/) → sync www → aapt2 → dex موجود → امضا
set -e
ROOT=/home/z/my-project
AB=$ROOT/android-build
SDK=/tmp/my-project/android-sdk
BT=$SDK/build-tools-35
AJ=$SDK/android-35/android.jar
WWW=$AB/assets/www
VER=0.2.33
VCODE=33

cd $ROOT
echo "=== [1/7] نسخه: versionCode=$VCODE versionName=$VER ==="
sed -i "s/android:versionCode=\"[0-9]*\"/android:versionCode=\"$VCODE\"/" $AB/AndroidManifest.xml
sed -i "s/android:versionName=\"[^\"]*\"/android:versionName=\"$VER\"/" $AB/AndroidManifest.xml
grep -o 'versionCode="[0-9]*"\|versionName="[^"]*"' $AB/AndroidManifest.xml

echo "=== [2/7] export وب (output: export + جابجایی api/) ==="
cp next.config.ts /tmp/next.config.ts.bak233
cat > next.config.ts <<'EOF'
import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  output: "export",
  typescript: {
    ignoreBuildErrors: true,
  },
  reactStrictMode: false,
};

export default nextConfig;
EOF
# مسیرهای api در حالت استاتیک جمع نمی‌شوند — موقتاً کنار می‌روند (روش اثبات‌شده v0.2.8)
rm -rf /tmp/api_backup233
mv src/app/api /tmp/api_backup233
set +e
NEXT_PUBLIC_ANDROID_BUILD=1 NEXT_TELEMETRY_DISABLED=1 bunx next build 2>&1 | tail -4
BUILD_RC=$?
set -e
mv /tmp/api_backup233 src/app/api
cp /tmp/next.config.ts.bak233 next.config.ts
if [ $BUILD_RC -ne 0 ]; then echo "BUILD FAILED rc=$BUILD_RC"; exit 1; fi
test -f out/index.html && echo "out/index.html OK"

echo "=== [3/7] sync www ==="
rm -rf $WWW
mkdir -p $AB/assets
cp -r out $WWW
du -sh $WWW

echo "=== [4/7] dex موجود (MainActivity بدون تغییر — classes/dexout از بیلد قبلی) ==="
test -f $AB/dexout/classes.dex && echo "dex OK ($(stat -c%s $AB/dexout/classes.dex) bytes)"
test -f $AB/classes/com/funnycar/ir/MainActivity.class && echo "classes OK"

echo "=== [5/7] aapt2 ==="
cd $AB
rm -f res.zip base.apk aligned.apk resources.zip
$BT/aapt2 compile --dir res -o res.zip
$BT/aapt2 link -o base.apk -I $AJ --manifest AndroidManifest.xml -A assets --min-sdk-version 24 --target-sdk-version 34 res.zip

echo "=== [6/7] اضافه کردن dex ==="
cp dexout/classes.dex ./classes.dex
zip -q -j base.apk classes.dex

echo "=== [7/7] zipalign + امضا ==="
$BT/zipalign -f 4 base.apk aligned.apk
$BT/apksigner sign --ks debug.keystore --ks-pass pass:android --key-pass pass:android --out $ROOT/download/FunnyCarIR-v$VER-test.apk aligned.apk
$BT/apksigner verify $ROOT/download/FunnyCarIR-v$VER-test.apk && echo "SIGN OK"
ls -la $ROOT/download/FunnyCarIR-v$VER-test.apk
echo "=== DONE v$VER ==="
