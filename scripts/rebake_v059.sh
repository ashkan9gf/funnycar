#!/bin/bash
# v0.2.59 — rebake همهٔ خودروها با اصلاح «Protect wheel components from body-paint spill» (9d23b84)
set -e
cd /home/z/my-project

# pride raw وجود ندارد — همیشه از player کپی می‌شود (Task 76)
cp -f scripts/raw_assets/models/vehicles/player.glb scripts/raw_assets/models/vehicles/pride.glb

for KEY in player pride peugeot405 samand nissan tiba taxi police renault4 vintage challenger; do
  echo "=== recolor: $KEY ==="
  python3 scripts/recolor_v5.py "$KEY" 2>&1 | grep -E "wheel part guard|ERROR|Error|Traceback|saved|OK|✅" || true
done
echo "ALL DONE"
