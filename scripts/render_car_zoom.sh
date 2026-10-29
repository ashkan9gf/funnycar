#!/bin/bash
# render_car_zoom.sh <car> <prefix> — high-res 6 close-up views (wheels/glass/rear/front)
# Guarantees fresh GLB: unique browser session + cache-busted fetch
export AGENT_BROWSER_SESSION="vz_${CAR:-x}_$$_$RANDOM"
CAR=${1:-pride}
PREFIX=${2:-zoom_$CAR}
cd /home/z/my-project
pkill -f agent-browser 2>/dev/null; sleep 1
BUST=$RANDOM$RANDOM
agent-browser open "http://localhost:8899/render_car_page.html?zoompage=1&car=$CAR&bust=$BUST" > /dev/null 2>&1
N=0
for i in $(seq 1 40); do
  N=$(timeout 15 agent-browser eval "document.querySelectorAll('img').length" 2>/dev/null | tail -1)
  if [ "$N" == "6" ]; then break; fi
  sleep 0.8
done
sleep 1.5
# freshness marker: eval a unique value and require it to echo back
M=$(timeout 15 agent-browser eval "window.__MARK=$BUST; window.__MARK" 2>/dev/null | tail -1)
timeout 40 agent-browser screenshot --full "scripts/${PREFIX}_zoom.png" > /dev/null 2>&1
echo "saved scripts/${PREFIX}_zoom.png (imgs=$N mark=$M bust=$BUST)"