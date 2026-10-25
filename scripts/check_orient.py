#!/usr/bin/env python3
"""تشخیص جهت مش با مقایسهٔ IoU سایه‌ها با نمای‌های مرجع."""
import numpy as np, trimesh
from PIL import Image

m = trimesh.load('/home/z/my-project/download/tripo/player_shape.glb', force='mesh')
m.merge_vertices()
m.update_faces(m.nondegenerate_faces())
m.remove_unreferenced_vertices()
v = m.vertices
v = v - m.bounds.mean(axis=0)
half = (m.extents / 2).max() * 1.05

def mask_of(pts2d, res=160):
    px = (pts2d[:, 0] / half * 0.5 + 0.5) * (res - 1)
    py = (1 - (pts2d[:, 1] / half * 0.5 + 0.5)) * (res - 1)
    mm = np.zeros((res, res), bool)
    mm[np.clip(py.astype(int), 0, res-1), np.clip(px.astype(int), 0, res-1)] = True
    # کمی پر کردن (dilate ساده)
    for _ in range(2):
        mm2 = mm.copy()
        mm2[1:] |= mm[:-1]; mm2[:-1] |= mm[1:]
        mm2[:, 1:] |= mm[:, :-1]; mm2[:, :-1] |= mm[:, 1:]
        mm = mm2
    return mm

def iou(a, b):
    return (a & b).sum() / max(1, (a | b).sum())

def img_mask(path, res=160):
    img = Image.open(path).convert('RGBA').resize((res, res))
    a = np.asarray(img)[:, :, 3] > 128
    ys, xs = np.where(a)
    if len(ys) == 0: return None
    # crop به باندینگ باکس و rescale به کل قاب
    a2 = a[ys.min():ys.max()+1, xs.min():xs.max()+1]
    im = Image.fromarray((a2 * 255).astype(np.uint8)).resize((res, res))
    return np.asarray(im) > 128

front = img_mask('/tmp/views/player/front.png')
side = img_mask('/tmp/views/player/side.png')

cands = {
    '-Z (front view)': mask_of(np.stack([v[:, 0], v[:, 1]], 1)),
    '+Z (front view)': mask_of(np.stack([-v[:, 0], v[:, 1]], 1)),
    '+X (front view)': mask_of(np.stack([v[:, 2], v[:, 1]], 1)),
    '-X (front view)': mask_of(np.stack([-v[:, 2], v[:, 1]], 1)),
}
print('== against FRONT image ==')
for k, mm in cands.items():
    print(f'  {k}: IoU={iou(mm, front):.3f}')

cands2 = {
    'x as-is (side view)': mask_of(np.stack([v[:, 2], v[:, 1]], 1)),
    'x mirrored': mask_of(np.stack([-v[:, 2], v[:, 1]], 1)),
}
print('== against SIDE image (facing left) ==')
for k, mm in cands2.items():
    print(f'  {k}: IoU={iou(mm, side):.3f}')
