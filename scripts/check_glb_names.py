#!/usr/bin/env python3
"""نام مش‌ها و متریال‌های هر GLB خودرو — برای تعیین مسیر رندر."""
import struct, json, sys

def glb_json(path):
    with open(path, 'rb') as f:
        data = f.read()
    assert data[:4] == b'glTF'
    ln = struct.unpack('<I', data[12:16])[0]
    return json.loads(data[20:20+ln])

for key in ['player', 'pride', 'tiba', 'challenger', 'police', 'taxi']:
    p = f'public/assets/models/vehicles/{key}.glb'
    j = glb_json(p)
    names = [n.get('name', '?') for n in j.get('nodes', []) if 'mesh' in n]
    mats = [m.get('name', '?') for m in j.get('materials', [])]
    print(f'{key}: nodes={names[:14]}')
    print(f'   materials={mats[:10]}')
