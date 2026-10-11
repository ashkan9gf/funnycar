#!/usr/bin/env bash
set -euo pipefail

# Build a temporary static web export for the Android wrapper.
# Always restore the original Next config and server-only route directories.
ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT"

API_DIR="src/app/api"
FILES_DIR="src/app/files"
TMP_API="src/app/__android_api_disabled"
TMP_FILES="src/app/__android_files_disabled"
CONFIG="next.config.ts"
CONFIG_BACKUP="$(mktemp)"
cp "$CONFIG" "$CONFIG_BACKUP"

restore() {
  cp "$CONFIG_BACKUP" "$CONFIG"
  rm -f "$CONFIG_BACKUP"
  if [[ -d "$TMP_API" && ! -e "$API_DIR" ]]; then mv "$TMP_API" "$API_DIR"; fi
  if [[ -d "$TMP_FILES" && ! -e "$FILES_DIR" ]]; then mv "$TMP_FILES" "$FILES_DIR"; fi
}
trap restore EXIT

[[ ! -e "$TMP_API" && ! -e "$TMP_FILES" ]] || {
  echo "Temporary Android export paths already exist; refusing to overwrite them." >&2
  exit 1
}
[[ -d "$API_DIR" ]] && mv "$API_DIR" "$TMP_API"
[[ -d "$FILES_DIR" ]] && mv "$FILES_DIR" "$TMP_FILES"

cat > "$CONFIG" <<'EOF'
import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  output: "export",
  typescript: { ignoreBuildErrors: true },
  reactStrictMode: false,
};

export default nextConfig;
EOF

BUILD_ANDROID=1 NEXT_PUBLIC_ANDROID_BUILD=1 NEXT_TELEMETRY_DISABLED=1 bunx next build

test -s "out/index.html" || { echo "Static export did not create out/index.html" >&2; exit 1; }
test -d "out/assets" || { echo "Static export did not copy public/assets into out/assets" >&2; exit 1; }
test -s "out/assets/models/vehicles/player.glb" || {
  echo "The main 3D player model is missing from the Android bundle." >&2
  exit 1
}
echo "Android web bundle verified: out/index.html and core game assets exist."
