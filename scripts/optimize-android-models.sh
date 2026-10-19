#!/usr/bin/env bash
# Optimize GLB delivery for Android WebView without simplifying model geometry or
# flattening/joining named meshes (wheel pivots and animation names must survive).
set -Eeuo pipefail
cd "$(dirname "$0")/.."
MODEL_ROOT="public/assets/models"
TMP_DIR="$(mktemp -d)"
trap 'rm -rf "$TMP_DIR"' EXIT

command -v bun >/dev/null 2>&1 || { echo "ERROR: Bun is required"; exit 1; }
mapfile -t MODELS < <(find "$MODEL_ROOT" -type f -name '*.glb' | sort)
if [ "${#MODELS[@]}" -eq 0 ]; then
  echo "ERROR: no GLB models found under $MODEL_ROOT" >&2
  exit 1
fi

before=0
after=0
optimized=0
for file in "${MODELS[@]}"; do
  rel="${file#"$MODEL_ROOT/"}"
  out="$TMP_DIR/$rel"
  mkdir -p "$(dirname "$out")"
  size_before=$(stat -c '%s' "$file")
  before=$((before + size_before))

  # Preserve scene hierarchy and geometry detail. WebP + 1024px texture cap
  # reduces download/decode/VRAM cost; Meshopt is decoded by the existing GLTFLoader.
  if bunx --no-install gltf-transform optimize "$file" "$out" \
      --compress meshopt --texture-compress webp --texture-size 1024 \
      --simplify false --flatten false --join false --palette false --instance false; then
    if [ -s "$out" ]; then
      size_after=$(stat -c '%s' "$out")
      if [ "$size_after" -lt "$size_before" ]; then
        cp "$out" "$file"
        after=$((after + size_after))
        optimized=$((optimized + 1))
        printf 'optimized %-38s %8s -> %8s bytes\n' "$rel" "$size_before" "$size_after"
      else
        after=$((after + size_before))
        printf 'kept      %-38s %8s bytes (no size win)\n' "$rel" "$size_before"
      fi
    else
      after=$((after + size_before))
      echo "WARN: optimizer produced empty output for $rel; original retained" >&2
    fi
  else
    after=$((after + size_before))
    echo "WARN: optimizer failed for $rel; original retained" >&2
  fi
done

saved=$((before - after))
printf 'GLB mobile optimization: %s/%s files smaller; %s -> %s bytes; saved %s bytes\n' \
  "$optimized" "${#MODELS[@]}" "$before" "$after" "$saved"
