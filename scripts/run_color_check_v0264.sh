#!/bin/bash
# v0.2.64 — رندر نرم‌افزاری هر ۱۱ خودرو برای راستی‌آزمایی نهایی رنگ
set -u
cd /home/z/my-project
mkdir -p scripts/v0264_check
for car in player pride peugeot405 samand nissan tiba taxi police renault4 vintage challenger; do
  echo "=== $car ==="
  /home/z/.venv/bin/python scripts/diag_glass_extent2.py "$car" "v0264_check/${car}" 2>&1 | tail -2
done
echo "--- ALL DONE ---"
ls -la scripts/v0264_check/
