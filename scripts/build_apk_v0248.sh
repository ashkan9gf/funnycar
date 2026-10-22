#!/bin/bash
# build_apk_v0248.sh — خط لوله کامل APK فانی‌کار v0.2.48 (نمای ساختمان‌ها با نور داخلی + فیکس لاستیک پلیس و قالپاق‌ها + رادیو و صداهای جدید)
# ادغام دو نسخه موازی: پایه = نسخه چلنجر + مرحله کامپایل جاوا (ECJ + d8) برای NativeTTS.java
# (نسخه بعدی همین پایپ‌لاین: scripts/build_apk_v0248.sh — اورهال صدا)
set -e
ROOT=/home/z/my-project
AB=$ROOT/android-build
SDK=/tmp/my-project/android-sdk
BT=$SDK/build-tools-35
AJ=$SDK/android-35/android.jar
WWW=$AB/assets/www
VER=0.2.48
VCODE=48

cd $ROOT
echo "=== [1/8] نسخه: versionCode=$VCODE versionName=$VER ==="
sed -i "s/android:versionCode=\"[0-9]*\"/android:versionCode=\"$VCODE\"/" $AB/AndroidManifest.xml
sed -i "s/android:versionName=\"[^\"]*\"/android:versionName=\"$VER\"/" $AB/AndroidManifest.xml
grep -o 'versionCode="[0-9]*"\|versionName="[^"]*"' $AB/AndroidManifest.xml

echo "=== [2/8] export وب (output: export + جابجایی api/) ==="
cp next.config.ts /tmp/next.config.ts.bak245
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
rm -rf /tmp/api_backup245
mv src/app/api /tmp/api_backup245
set +e
NEXT_PUBLIC_ANDROID_BUILD=1 NEXT_TELEMETRY_DISABLED=1 bunx next build 2>&1 | tail -4
BUILD_RC=$?
set -e
mv /tmp/api_backup245 src/app/api
cp /tmp/next.config.ts.bak245 next.config.ts
if [ $BUILD_RC -ne 0 ]; then echo "BUILD FAILED rc=$BUILD_RC"; exit 1; fi
test -f out/index.html && echo "out/index.html OK"

echo "=== [3/8] sync www ==="
rm -rf $WWW
mkdir -p $AB/assets
cp -r out $WWW
du -sh $WWW

echo "=== [4/8] کامپایل جاوا (ECJ) + dex (d8) — MainActivity + NativeTTS ==="
java -jar $ROOT/scripts/ecj.jar -source 8 -target 8 -nowarn \
  -bootclasspath $AJ -cp $AJ \
  -d $AB/classes $AB/java/com/funnycar/ir/*.java
rm -rf $AB/dexout && mkdir -p $AB/dexout
$BT/d8 --lib $AJ --release --output $AB/dexout $AB/classes/com/funnycar/ir/*.class
test -f $AB/dexout/classes.dex && echo "dex OK ($(stat -c%s $AB/dexout/classes.dex) bytes)"

echo "=== [5/8] aapt2 ==="
cd $AB
rm -f res.zip base.apk aligned.apk resources.zip
$BT/aapt2 compile --dir res -o res.zip
$BT/aapt2 link -o base.apk -I $AJ --manifest AndroidManifest.xml -A assets --min-sdk-version 24 --target-sdk-version 35 res.zip

echo "=== [6/8] اضافه کردن dex ==="
cp dexout/classes.dex ./classes.dex
zip -q -j base.apk classes.dex

echo "=== [7/8] zipalign + امضا ==="
$BT/zipalign -f 4 base.apk aligned.apk
$BT/apksigner sign --ks debug.keystore --ks-pass pass:android --key-pass pass:android --out $ROOT/download/FunnyCarIR-v$VER-test.apk aligned.apk
$BT/apksigner verify $ROOT/download/FunnyCarIR-v$VER-test.apk && echo "SIGN OK"
ls -la $ROOT/download/FunnyCarIR-v$VER-test.apk
echo "=== DONE v$VER ==="
