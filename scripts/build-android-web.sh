#!/bin/bash
# Build the offline static web bundle for the Android/Capacitor CI job.
# Always restore the original Next.js config and API routes, including on interruption.
set -Eeuo pipefail
cd "$(dirname "$0")/.."

TMP_DIR="$(mktemp -d)"
CONFIG_BACKUP="$TMP_DIR/next.config.ts"
API_BACKUP="$TMP_DIR/api"
CONFIG_BACKED_UP=0
API_MOVED=0

restore_temp_state() {
  if [ "$API_MOVED" -eq 1 ]; then
    mkdir -p src/app
    rm -rf src/app/api
    if [ -d "$API_BACKUP" ]; then
      mv "$API_BACKUP" src/app/api
    fi
    API_MOVED=0
  fi
  if [ "$CONFIG_BACKED_UP" -eq 1 ]; then
    cp "$CONFIG_BACKUP" next.config.ts
    CONFIG_BACKED_UP=0
  fi
}

cleanup() {
  local rc=$?
  trap - EXIT INT TERM
  if ! restore_temp_state; then
    echo "ERROR: failed to restore temporary Android build changes" >&2
    rc=1
  fi
  rm -rf "$TMP_DIR"
  exit "$rc"
}
trap cleanup EXIT
trap 'exit 130' INT
trap 'exit 143' TERM

echo "=== [1/3] static export (output: export + API routes temporarily moved) ==="
cp next.config.ts "$CONFIG_BACKUP"
CONFIG_BACKED_UP=1
cat > next.config.ts <<'EOF'
import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  output: "export",
  // TypeScript is validated in CI and must also block the Android web export.
  reactStrictMode: false,
};

export default nextConfig;
EOF

# API routes cannot be collected in static export mode. Move them into a private temp directory.
mv src/app/api "$API_BACKUP"
API_MOVED=1

set +e
NEXT_PUBLIC_ANDROID_BUILD=1 NEXT_TELEMETRY_DISABLED=1 bunx next build 2>&1 | tail -20
BUILD_RC=$?
set -e
restore_temp_state
if [ "$BUILD_RC" -ne 0 ]; then
  echo "BUILD FAILED rc=$BUILD_RC"
  exit "$BUILD_RC"
fi

echo "=== [2/3] sync www/ (Capacitor webDir) ==="
test -d out || { echo "FAIL: Next.js export directory out/ missing"; exit 1; }
rm -rf www
cp -r out www

echo "=== [3/3] verify offline bundle ==="
test -s www/index.html || { echo "FAIL: www/index.html missing or empty"; exit 1; }
test -d www/_next/static/chunks || { echo "FAIL: www/_next/static/chunks missing"; exit 1; }
CHUNKS=$(find www/_next/static/chunks -type f | wc -l | tr -d ' ')
test "$CHUNKS" -gt 0 || { echo "FAIL: no JavaScript chunks found"; exit 1; }
FILES=$(find www -type f | wc -l | tr -d ' ')
SIZE=$(du -sh www | cut -f1)
echo "OK: offline bundle ready — $FILES files, $CHUNKS JS chunks, $SIZE"
if [ "$FILES" -lt 20 ]; then echo "FAIL: bundle suspiciously small"; exit 1; fi
echo "DONE: offline web bundle ready for Capacitor"
