#!/bin/bash
# build-android-web.sh — build the offline static web bundle for the Android/Capacitor CI job
# Mirrors the proven local pipeline (scripts/build_apk_v0233.sh step 2+3):
#   temp next.config with output:"export" -> move src/app/api out -> next build
#   -> restore -> copy out/ to www/ (Capacitor webDir) -> verify
set -e
cd "$(dirname "$0")/.."

echo "=== [1/3] static export (output: export + api/ temporarily moved) ==="
cp next.config.ts /tmp/next.config.ts.bak-ci
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
# API routes cannot be collected in static export mode — temporarily move aside (proven since v0.2.8)
rm -rf /tmp/api_backup_ci
mv src/app/api /tmp/api_backup_ci
set +e
NEXT_PUBLIC_ANDROID_BUILD=1 NEXT_TELEMETRY_DISABLED=1 bunx next build 2>&1 | tail -6
BUILD_RC=$?
set -e
mv /tmp/api_backup_ci src/app/api
cp /tmp/next.config.ts.bak-ci next.config.ts
if [ $BUILD_RC -ne 0 ]; then echo "BUILD FAILED rc=$BUILD_RC"; exit 1; fi

echo "=== [2/3] sync www/ (Capacitor webDir) ==="
rm -rf www
cp -r out www

echo "=== [3/3] verify offline bundle ==="
test -f www/index.html || { echo "FAIL: www/index.html missing"; exit 1; }
test -d www/_next/static/chunks || { echo "FAIL: www/_next/static/chunks missing"; exit 1; }
FILES=$(find www -type f | wc -l)
SIZE=$(du -sh www | cut -f1)
echo "OK: www/ ready — $FILES files, $SIZE"
if [ "$FILES" -lt 20 ]; then echo "FAIL: bundle suspiciously small"; exit 1; fi
echo "DONE: offline web bundle ready for Capacitor"
