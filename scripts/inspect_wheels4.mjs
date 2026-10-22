/**
 * inspect_wheels4.mjs — compare the 4 wheel meshes of a GLB (verts/tris/bbox/material)
 * usage: node scripts/inspect_wheels4.mjs <file.glb>
 */
import { readFileSync } from 'node:fs';

const file = process.argv[2];
const buf = readFileSync(file);
const dv = new DataView(buf.buffer, buf.byteOffset, buf.byteLength);
const jsonLen = dv.getUint32(12, true);
const json = JSON.parse(new TextDecoder().decode(new Uint8Array(buf.buffer, buf.byteOffset + 20, jsonLen)));
const binStart = 20 + jsonLen + 8;

function readAccessor(acc) {
  const bv = json.bufferViews[acc.bufferView];
  const off = binStart + (bv.byteOffset ?? 0) + (acc.byteOffset ?? 0);
  const comp = acc.componentType;
  const ncomp = { SCALAR: 1, VEC2: 2, VEC3: 3, VEC4: 4 }[acc.type];
  const arrs = {
    5126: () => new Float32Array(buf.buffer.slice(off, off + acc.count * ncomp * 4)),
    5123: () => new Uint16Array(buf.buffer.slice(off, off + acc.count * ncomp * 2)),
    5125: () => new Uint32Array(buf.buffer.slice(off, off + acc.count * ncomp * 4)),
    5121: () => new Uint8Array(buf.buffer.slice(off, off + acc.count * ncomp)),
  };
  return arrs[comp] ? arrs[comp]() : null;
}

for (const [ni, n] of (json.nodes ?? []).entries()) {
  if (n.mesh === undefined || !/wheel|roue|tyre|tire/i.test(n.name ?? '')) continue;
  const mesh = json.meshes[n.mesh];
  const prim = mesh.primitives[0];
  const pos = readAccessor(json.accessors[prim.attributes.POSITION]);
  const idxAcc = prim.indices !== undefined ? json.accessors[prim.indices] : null;
  const idx = idxAcc ? readAccessor(idxAcc) : null;
  let min = [1e9, 1e9, 1e9], max = [-1e9, -1e9, -1e9];
  for (let i = 0; i < pos.length; i += 3) {
    for (let k = 0; k < 3; k++) {
      const v = pos[i + k];
      if (v < min[k]) min[k] = v;
      if (v > max[k]) max[k] = v;
    }
  }
  const sz = [max[0] - min[0], max[1] - min[1], max[2] - min[2]];
  const uvPresent = prim.attributes.TEXCOORD_0 !== undefined;
  const matIdx = prim.material;
  const matName = matIdx !== undefined && json.materials[matIdx] ? json.materials[matIdx].name : '?';
  console.log(`node[${ni}] ${n.name}: verts=${pos.length / 3} tris=${idx ? idx.length / 3 : pos.length / 3}`);
  console.log(`   bbox min=[${min.map((v) => v.toFixed(1))}] size=[${sz.map((v) => v.toFixed(1))}] uv=${uvPresent} mat=${matName}`);
}
