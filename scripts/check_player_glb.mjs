// check_player_glb.mjs — تأیید GLB بازیکن: COLOR_0 قرمزغالب + ابعاد بازی
import { readFileSync } from 'fs';

const P = process.argv[2] ?? '/home/z/my-project/public/assets/models/vehicles/player.glb';
const buf = readFileSync(P);
const clen = buf.readUInt32LE(12);
const js = JSON.parse(buf.subarray(20, 20 + clen).toString('utf8'));
const binStart = 20 + clen + 8;

const prim = js.meshes[0].primitives[0];
const CT = { 5126: 4, 5123: 2, 5125: 4, 5121: 1 };
const NC = { VEC2: 2, VEC3: 3, VEC4: 4, SCALAR: 1 };

function acc(i) {
  const a = js.accessors[i];
  const v = js.bufferViews[a.bufferView];
  const off = binStart + (v.byteOffset ?? 0) + (a.byteOffset ?? 0);
  const n = a.count * NC[a.type] * CT[a.componentType];
  const t = { 5126: Float32Array, 5123: Uint16Array, 5125: Uint32Array, 5121: Uint8Array }[a.componentType];
  return new t(buf.buffer.slice(buf.byteOffset + off, buf.byteOffset + off + n));
}

const posA = prim.attributes.POSITION;
const pos = acc(posA);
const dim = NC[js.accessors[posA].type];
const mn = [Infinity, Infinity, Infinity], mx = [-Infinity, -Infinity, -Infinity];
for (let i = 0; i < pos.length; i += dim) {
  for (let d = 0; d < 3; d++) {
    const v = pos[i + d];
    if (v < mn[d]) mn[d] = v;
    if (v > mx[d]) mx[d] = v;
  }
}

let mean = [0, 0, 0], cnt = 0;
let hasColor = 'COLOR_0' in prim.attributes;
if (hasColor) {
  const cA = js.accessors[prim.attributes.COLOR_0];
  const c = acc(prim.attributes.COLOR_0);
  const ncomp = NC[cA.type];
  const norm = cA.normalized ?? false;
  for (let i = 0; i < c.length; i += ncomp) {
    mean[0] += norm ? c[i] : c[i] / 255;
    mean[1] += norm ? c[i + 1] : c[i + 1] / 255;
    mean[2] += norm ? c[i + 2] : c[i + 2] / 255;
    cnt++;
  }
  mean = mean.map((x) => x / cnt);
}

const len = mx[2] - mn[2], wid = mx[0] - mn[0], hgt = mx[1] - mn[1];
console.log(`size: ${(buf.length / 1024) | 0}KB | bbox: len(Z)=${len.toFixed(1)} wid(X)=${wid.toFixed(1)} hgt(Y)=${hgt.toFixed(1)}`);
console.log(`COLOR_0: ${hasColor} | mean RGB = [${mean.map((x) => x.toFixed(3)).join(', ')}]`);
const redOK = hasColor && mean[0] > mean[1] * 2.2 && mean[0] > mean[2] * 2.2 && mean[0] > 0.35;
const sizeOK = len > 150 && len < 200;
console.log(`${redOK ? 'PASS' : 'FAIL'}  بدنه قرمز غالب`);
console.log(`${sizeOK ? 'PASS' : 'FAIL'}  مقیاس بازی (طول ~۱۷۲)`);
process.exit(redOK && sizeOK ? 0 : 1);
