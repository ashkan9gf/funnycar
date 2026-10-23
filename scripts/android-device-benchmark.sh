#!/usr/bin/env bash
# Collect reproducible Android device performance diagnostics for FunnyCar.
# Usage: bash scripts/android-device-benchmark.sh [package-id] [seconds]
set -Eeuo pipefail
PACKAGE_ID="${1:-com.funnycar.ir}"
DURATION="${2:-600}"
OUT_DIR="${OUT_DIR:-artifacts/device-benchmark}"
mkdir -p "$OUT_DIR"
STAMP="$(date -u +%Y%m%dT%H%M%SZ)"
OUT="$OUT_DIR/funnycar-device-$STAMP.txt"

command -v adb >/dev/null || { echo "ERROR: Android platform-tools (adb) is required." >&2; exit 2; }
adb get-state >/dev/null 2>&1 || { echo "ERROR: connect and authorize a real Android device over USB first." >&2; exit 2; }

{
  echo "FunnyCar Android device benchmark"
  echo "UTC: $STAMP"
  echo "Package: $PACKAGE_ID"
  echo "Duration seconds: $DURATION"
  echo
  echo "=== DEVICE ==="
  adb shell getprop ro.product.manufacturer
  adb shell getprop ro.product.model
  adb shell getprop ro.build.version.release
  adb shell getprop ro.build.version.sdk
  adb shell wm size
  adb shell wm density
  echo
  echo "=== THERMAL BEFORE ==="
  adb shell dumpsys thermalservice 2>&1 || true
  echo
  echo "=== GRAPHICS BEFORE ==="
  adb shell dumpsys gfxinfo "$PACKAGE_ID" 2>&1 || true
  echo
  echo "=== START APP ==="
  adb shell monkey -p "$PACKAGE_ID" 1 2>&1 || true
  echo "Keep gameplay running with traffic, particles, and lighting transitions for $DURATION seconds."
  sleep "$DURATION"
  echo
  echo "=== THERMAL AFTER ==="
  adb shell dumpsys thermalservice 2>&1 || true
  echo
  echo "=== GRAPHICS AFTER ==="
  adb shell dumpsys gfxinfo "$PACKAGE_ID" 2>&1 || true
  echo
  echo "=== MEMORY ==="
  adb shell dumpsys meminfo "$PACKAGE_ID" 2>&1 || true
  echo
  echo "=== APP PROCESS ==="
  adb shell pidof "$PACKAGE_ID" 2>&1 || true
} | tee "$OUT"

echo
echo "Saved benchmark report: $OUT"
echo "Note: this captures device-reported diagnostics, not a laboratory-grade thermal/FPS certification."
