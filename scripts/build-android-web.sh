#!/usr/bin/env bash
set -euo pipefail

# The browser game itself is client-side. These developer-only routes depend on
# a Node server and must not be included in the offline Android static bundle.
API_DIR="src/app/api"
FILES_DIR="src/app/files"
TMP_API="src/app/__android_api_disabled"
TMP_FILES="src/app/__android_files_disabled"

restore_routes() {
  if [[ -d "$TMP_API" && ! -e "$API_DIR" ]]; then mv "$TMP_API" "$API_DIR"; fi
  if [[ -d "$TMP_FILES" && ! -e "$FILES_DIR" ]]; then mv "$TMP_FILES" "$FILES_DIR"; fi
}
trap restore_routes EXIT

[[ ! -e "$TMP_API" && ! -e "$TMP_FILES" ]] || {
  echo "Temporary Android export paths already exist; refusing to overwrite them." >&2
  exit 1
}

mv "$API_DIR" "$TMP_API"
mv "$FILES_DIR" "$TMP_FILES"

BUILD_ANDROID=1 NEXT_PUBLIC_ANDROID_BUILD=1 NEXT_TELEMETRY_DISABLED=1 bunx next build

test -s "out/index.html" || { echo "Static export did not create out/index.html" >&2; exit 1; }
test -d "out/assets" || { echo "Static export did not copy public/assets into out/assets" >&2; exit 1; }
test -s "out/assets/models/vehicles/player.glb" || {
  echo "The main 3D player model is missing from the Android bundle." >&2
  exit 1
}
echo "Android web bundle verified: out/index.html and core game assets exist."
