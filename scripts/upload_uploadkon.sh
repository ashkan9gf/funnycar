#!/bin/bash
# upload_uploadkon.sh — آپلود zip به uploadkon.ir (روش اثبات‌شده: POST به «/»)
set -e
FILE="$1"
[ -f "$FILE" ] || { echo "usage: upload_uploadkon.sh <file.zip>"; exit 1; }
UA="Mozilla/5.0 (Linux; Android 13) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0 Mobile Safari/537.36"
JAR=/tmp/uploadkon_cookies.txt
RESP=/tmp/uploadkon_resp.txt

echo "=== [1/3] دریافت کوکی ==="
curl -s -c $JAR -A "$UA" https://uploadkon.ir/ -o /tmp/uploadkon_home.html
grep -c "upload" /tmp/uploadkon_home.html >/dev/null && echo "home OK"

echo "=== [2/3] POST فایل ==="
curl -s -b $JAR -A "$UA" \
  -e "https://uploadkon.ir/" \
  -H "X-Requested-With: XMLHttpRequest" \
  -F "submitr=1" -F "ajax=1" \
  -F "file=@$FILE" \
  https://uploadkon.ir/ -o $RESP
echo "--- پاسخ خام (اول پاسخ) ---"
head -c 400 $RESP; echo

echo "=== [3/3] استخراج لینک ==="
URL=$(sed 's/\\\//\//g' $RESP | rg -o 'https://uploadkon\.ir/uploads/[A-Za-z0-9._-]+' | head -1)
if [ -z "$URL" ]; then echo "❌ لینک پیدا نشد"; cat $RESP | head -c 800; exit 1; fi
echo "URL: $URL"
echo "--- HEAD verify ---"
curl -sI "$URL" | head -8
