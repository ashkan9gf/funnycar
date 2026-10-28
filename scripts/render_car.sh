#!/bin/bash
# render_car.sh <car> <prefix> [spins] — agent-browser render of car views
export AGENT_BROWSER_SESSION="v06x_${RANDOM}"
cd /home/z/my-project
CAR=${1:-police}
PREFIX=${2:-v0248_$CAR}
SPINS=${3:-0}
agent-browser open "http://localhost:8899/render_car_page.html?car=$CAR&spins=$SPINS" > /dev/null 2>&1
for i in $(seq 1 30); do
  N=$(agent-browser eval "document.querySelectorAll('img').length" 2>/dev/null | tail -1)
  if [ "$N" == "6" ]; then break; fi
  sleep 0.7
done
sleep 1.5
agent-browser screenshot --full "scripts/${PREFIX}_views.png" > /dev/null 2>&1
echo "saved scripts/${PREFIX}_views.png (imgs=$N)"