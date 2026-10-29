#!/bin/bash
# v0.2.61 — rebake همهٔ خودروها با اصلاح «سرریز ریز»:
#  ۱) قفل مجدد پلاستیک/پلاک بعد از هموارسازی مرزی (ریشهٔ لکه‌های قرمز/سفید)
#  ۲) استوانهٔ سیاه چرخ (لاینر قوس + پوشش پشت لاستیک)
#  ۳) رأی‌گیری مرز لاستیک/بدنه + حذف جزیره‌های تک‌فیس شیشه
set -e
cd /home/z/my-project
PY=/home/z/.venv/bin/python3

# pride raw همیشه از player کپی می‌شود
cp -f scripts/raw_assets/models/vehicles/player.glb scripts/raw_assets/models/vehicles/pride.glb

FAIL=0
for KEY in player pride peugeot405 samand nissan tiba taxi police renault4 vintage challenger; do
  echo "=== recolor: $KEY ==="
  if ! $PY scripts/recolor_v5.py "$KEY" > /tmp/recolor_$KEY.log 2>&1; then
    echo "!!! FAILED: $KEY"
    tail -5 /tmp/recolor_$KEY.log
    FAIL=1
    continue
  fi
  grep -E "well black|tire boundary|glass iso" /tmp/recolor_$KEY.log | head -3 || true
  grep -E "exported|LOD1" /tmp/recolor_$KEY.log || true
done
echo "ALL DONE (fail=$FAIL)"