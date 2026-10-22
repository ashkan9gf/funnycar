#!/bin/bash
# garage_cards.sh — screenshot each garage card by scrolling
export AGENT_BROWSER_SESSION="v0248diag"
cd /home/z/my-project
for i in 0 1 2 3 4 5; do
  agent-browser eval "window.scrollTo(0, 0); const sc=[...document.querySelectorAll('div')].find(d=>d.scrollHeight>d.clientHeight+200 && d.clientHeight>400); if(sc){sc.scrollTop=$i*520;} 'scrolled'" > /dev/null 2>&1
  sleep 1.2
  agent-browser screenshot "scripts/v0248diag_card_$i.png" > /dev/null 2>&1
done
echo done