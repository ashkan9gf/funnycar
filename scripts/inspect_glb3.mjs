/**
 * inspect_glb3.mjs — full node tree dump with mesh names + child hierarchy
 * usage: node scripts/inspect_glb3.mjs <file.glb>
 */
import { readFileSync } from 'node:fs';

const file = process.argv[2];
const buf = readFileSync(file);
const dv = new DataView(buf.buffer, buf.byteOffset, buf.byteLength);
const jsonLen = dv.getUint32(12, true);
const json = JSON.parse(new TextDecoder().decode(new Uint8Array(buf.buffer, buf.byteOffset + 20, jsonLen)));

const kidsOf = (n) => n.children ?? [];
console.log('=== node tree:', file);
(json.nodes ?? []).forEach((n, i) => {
  const meshInfo = n.mesh !== undefined ? ` mesh=${n.mesh}(${json.meshes[n.mesh].name})` : '';
  const tr = n.translation ? ` t=[${n.translation.map((v) => (+v).toFixed(1))}]` : '';
  const sc = n.scale ? ` s=[${n.scale.map((v) => (+v).toFixed(2))}]` : '';
  console.log(`[${i}] ${JSON.stringify(n.name ?? '')}${meshInfo}${tr}${sc} children=[${kidsOf(n)}]`);
});
console.log('materials:', (json.materials ?? []).map((m, i) => `${i}:${m.name}`).join(' | '));
