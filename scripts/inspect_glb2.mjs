/**
 * inspect_glb2.mjs — compact node dump + bbox per mesh (finds wheels/hubcaps)
 * usage: node scripts/inspect_glb2.mjs <file.glb> [filterRegex]
 */
import { readFileSync } from 'node:fs';

const file = process.argv[2];
const filter = process.argv[3] ? new RegExp(process.argv[3], 'i') : null;
const buf = readFileSync(file);
const dv = new DataView(buf.buffer, buf.byteOffset, buf.byteLength);
const jsonLen = dv.getUint32(12, true);
const json = JSON.parse(new TextDecoder().decode(new Uint8Array(buf.buffer, buf.byteOffset + 20, jsonLen)));

const binStart = 20 + jsonLen + 8;

function readAccessor(acc) {
  const bv = json.bufferViews[acc.bufferView];
  const off = binStart + (bv.byteOffset ?? 0) + (acc.byteOffset ?? 0);
  const comp = acc.componentType; // 5126 float, 5123 ushort
  const ncomp = { SCALAR: 1, VEC2: 2, VEC3: 3, VEC4: 4 }[acc.type];
  const out = [];
  if (comp === 5126) {
    for (let i = 0; i < acc.count * ncomp; i++) out.push(new DataView(buf.buffer, off + i * 4, 4).getFloat32(0, true));
  } else if (comp === 5123) {
    for (let i = 0; i < acc.count * ncomp; i++) out.push(new DataView(buf.buffer, off + i * 2, 2).getUint16(0, true));
  } else if (comp === 5125) {
    for (let i = 0; i < acc.count * ncomp; i++) out.push(new DataView(buf.buffer, off + i * 4, 4).getUint32(0, true));
  }
  return out;
}

for (const [ni, n] of (json.nodes ?? []).entries()) {
  if (n.mesh === undefined) continue;
  const name = n.name ?? `node${ni}`;
  if (filter && !filter.test(name)) continue;
  const m = json.meshes[n.mesh];
  const prim = m.primitives[0];
  const pos = readAccessor(json.accessors[prim.attributes.POSITION]);
  let min = [1e9, 1e9, 1e9], max = [-1e9, -1e9, -1e9];
  for (let i = 0; i < pos.length; i += 3) {
    for (let k = 0; k < 3; k++) {
      const v = pos[i + k];
      if (v < min[k]) min[k] = v;
      if (v > max[k]) max[k] = v;
    }
  }
  const t = n.translation ?? [0, 0, 0];
  const s = n.scale ?? [1, 1, 1];
  // world-ish center (approx: trans + bbox*s)
  const cmin = min.map((v, k) => t[k] + v * s[k]);
  const cmax = max.map((v, k) => t[k] + v * s[k]);
  console.log(`[${ni}] ${JSON.stringify(name).slice(0, 60)}`);
  console.log(`    local-bbox min=[${min.map((v) => v.toFixed(2))}] max=[${max.map((v) => v.toFixed(2))}]`);
  console.log(`    trans=[${t.map((v) => (+v).toFixed(3))}] scale=[${s.map((v) => (+v).toFixed(3))}] world-bbox=[${cmin.map((v) => v.toFixed(2))}..${cmax.map((v) => v.toFixed(2))}]`);
}
