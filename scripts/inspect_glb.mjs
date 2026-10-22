/**
 * inspect_glb.mjs — dump GLB JSON structure (nodes/meshes/materials/accessor counts)
 * usage: bun scripts/inspect_glb.mjs public/assets/models/vehicles/police.glb
 */
import { readFileSync } from 'node:fs';

const file = process.argv[2];
const buf = readFileSync(file);
const dv = new DataView(buf.buffer, buf.byteOffset, buf.byteLength);
const jsonLen = dv.getUint32(12, true);
const jsonBytes = new Uint8Array(buf.buffer, buf.byteOffset + 20, jsonLen);
const json = JSON.parse(new TextDecoder().decode(jsonBytes));

console.log('===', file);
console.log('meshes:', (json.meshes ?? []).map((m, i) => ({ i, name: m.name, prims: m.primitives.length })));
console.log('nodes:', (json.nodes ?? []).map((n, i) => ({ i, name: n.name, mesh: n.mesh, trans: n.translation, scale: n.scale, rot: n.rotation })));
console.log('materials:', (json.materials ?? []).map((m, i) => ({ i, name: m.name })));
for (const [i, m] of (json.meshes ?? []).entries()) {
  const prim = m.primitives[0];
  const posAcc = json.accessors[prim.attributes.POSITION];
  const n = posAcc.count;
  // bounding box from accessor min/max
  console.log(`mesh[${i}] ${m.name}: verts=${n} min=${posAcc.min} max=${posAcc.max}`);
}
