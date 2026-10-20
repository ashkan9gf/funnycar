#!/usr/bin/env python3
"""پارسر خروجی probe پارک — تحلیل گزارش از فایل"""
import json, sys, re

raw = open(sys.argv[1]).read().strip()
# خروجی agent-browser: رشته JSON با escape
s = raw.strip('"').replace('\\"', '"')
try:
    r = json.loads(s)
except Exception:
    # تلاش دوم: unicode_escape
    r = json.loads(raw.strip('"').encode().decode('unicode_escape'))

print('total parked:', r['total'])
cc = r['carCar']
cc_n = len(cc) if isinstance(cc, list) else cc
print('carCar:', cc_n, '| carBuilding:', len(r['carBuilding']), '| carTree:', len(r['carTree']), '| inCrossRoad:', len(r['inCrossRoad']))
for row in r['carBuilding'][:6]: print('  BLD', row)
for row in r['carTree'][:6]: print('  TREE', row)
for row in r['inCrossRoad'][:6]: print('  CROSS', row)
