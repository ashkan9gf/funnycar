#!/usr/bin/env python3
"""Check blob shadow presence: compare ground brightness under traffic car vs nearby road."""
from PIL import Image
import sys

img = Image.open('/home/z/my-project/scripts/e2e_v0222_b_gfx0_drive.png').convert('RGB')
px = img.load()

def avg(x0, y0, x1, y1):
    s = [0, 0, 0]
    n = 0
    for x in range(x0, x1):
        for y in range(y0, y1):
            for i in range(3):
                s[i] += px[x, y][i]
            n += 1
    return tuple(round(v / n) for v in s)

# traffic car near intersection right side ~ (700-745, 205-235); its blob would extend below (~y 230-245)
car_under = avg(700, 228, 748, 242)
road_near = avg(760, 228, 800, 242)   # asphalt to its right, no car
print('under traffic car:', car_under, ' near road:', road_near)

# player red car ~ (590-680, 360-500); blob extends in front of bumper (~y 500-515)
p_under = avg(600, 498, 670, 512)
p_road = avg(720, 498, 790, 512)
print('under player car:', p_under, ' near road:', p_road)
