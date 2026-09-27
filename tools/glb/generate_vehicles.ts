/**
 * generate_vehicles.ts — تولید GLB واقعی خودروهای ایرانی (فاز GRAPHICS_OVERHAUL)
 * اجرا: bun tools/glb/generate_vehicles.ts
 * خروجی: public/assets/models/vehicles/*.glb (LOD0 + LOD1 برای ترافیک)
 */

import * as THREE from 'three';
import { writeGLB } from './glbwriter.mjs';
import {
  buildVehicleParts, linA, VEHICLE_COLORS, FIXED_COLORS,
  type VehicleVariant,
} from '../../src/game/render3d/vehicleGeometry';

const OUT = 'public/assets/models/vehicles';

/** متریال‌های مشترک GLB خودرو — همه baseColor سفید؛ رنگ از COLOR_0 (vertex color) */
const CAR_MATERIALS = [
  { name: 'body', baseColor: linA('#ffffff'), metallic: 0.12, roughness: 0.42 },
  { name: 'glass', baseColor: linA('#ffffff'), metallic: 0.35, roughness: 0.12 },
  { name: 'trim', baseColor: linA('#ffffff'), metallic: 0.05, roughness: 0.8 },
  { name: 'rubber_rim', baseColor: linA('#ffffff'), metallic: 0.1, roughness: 0.85 },
  { name: 'light_front', baseColor: linA('#ffffff'), metallic: 0, roughness: 0.4, emissive: [0.35, 0.32, 0.22] },
  { name: 'light_rear', baseColor: linA('#ffffff'), metallic: 0, roughness: 0.4, emissive: [0.32, 0.04, 0.03] },
  { name: 'plate', baseColor: linA('#ffffff'), metallic: 0.05, roughness: 0.6 },
  { name: 'chrome', baseColor: linA('#ffffff'), metallic: 0.85, roughness: 0.3 },
  { name: 'lightbar_red', baseColor: linA('#ffffff'), metallic: 0, roughness: 0.5, emissive: [0.75, 0.02, 0.02] },
  { name: 'lightbar_blue', baseColor: linA('#ffffff'), metallic: 0, roughness: 0.5, emissive: [0.02, 0.1, 0.75] },
];

const M = { body: 0, glass: 1, trim: 2, rubber: 3, lightF: 4, lightR: 5, plate: 6, chrome: 7, lbRed: 8, lbBlue: 9 };

interface Entry { name: string; geometry: THREE.BufferGeometry; material: number; color?: [number, number, number]; translation?: number[] }

function vehicleEntries(variant: VehicleVariant, lod1: boolean): { entries: Entry[]; info: string[] } {
  const p = buildVehicleParts(variant, { lod1 });
  const entries: Entry[] = [
    { name: 'body', geometry: p.body, material: M.body },
    { name: 'glass', geometry: p.glass, material: M.glass },
    { name: 'trim', geometry: p.trim, material: M.trim },
    { name: 'bumper_front', geometry: p.bumpersF, material: M.trim },
    { name: 'bumper_rear', geometry: p.bumpersR, material: M.trim },
    // چرخ‌ها: هندسه در مبدأ چرخ، جای چرخ روی ترنسلیشن node (اسپین/فرمان ممکن)
    { name: 'wheel_fl', geometry: p.wheels[0], material: M.rubber, translation: p.wheelPos[0] },
    { name: 'wheel_fr', geometry: p.wheels[1], material: M.rubber, translation: p.wheelPos[1] },
    { name: 'wheel_rl', geometry: p.wheels[2], material: M.rubber, translation: p.wheelPos[2] },
    { name: 'wheel_rr', geometry: p.wheels[3], material: M.rubber, translation: p.wheelPos[3] },
    { name: 'lights_front', geometry: p.lightsF, material: M.lightF },
    { name: 'lights_rear', geometry: p.lightsR, material: M.lightR },
    { name: 'plate', geometry: p.plate, material: M.plate },
  ];
  const info: string[] = [];
  for (const [name, geo] of p.extras) {
    let mat = M.trim;
    if (name === 'lightbar_red') mat = M.lbRed;
    else if (name === 'lightbar_blue') mat = M.lbBlue;
    else if (name === 'roofrack') mat = M.chrome;
    entries.push({ name, geometry: geo, material: mat });
    info.push(name);
  }
  return { entries, info };
}

async function main() {
  const stats: string[] = [];
  const trafficVariants: VehicleVariant[] = ['pride', 'peugeot405', 'samand', 'nissan', 'tiba', 'taxi', 'police'];

  // LOD0 همه
  for (const v of ['player', ...trafficVariants] as VehicleVariant[]) {
    const { entries, info } = vehicleEntries(v, false);
    const r = await writeGLB(`${OUT}/${v}.glb`, entries, CAR_MATERIALS);
    stats.push(`${v.padEnd(11)} ${String(r.kb).padStart(4)}KB ${String(r.tris).padStart(6)}tris ${r.meshes}mesh ${info.length ? '+' + info.join(',') : ''}`);
  }
  // LOD1 برای ترافیک (دور)
  for (const v of trafficVariants) {
    const { entries } = vehicleEntries(v, true);
    const r = await writeGLB(`${OUT}/${v}_lod1.glb`, entries, CAR_MATERIALS);
    stats.push(`${v}_lod1   ${String(r.kb).padStart(4)}KB ${String(r.tris).padStart(6)}tris ${r.meshes}mesh`);
  }

  // رنگ‌های پالت برای گزارش
  for (const [k, list] of Object.entries(VEHICLE_COLORS)) stats.push(`palette ${k}: ${list.length} رنگ`);
  for (const [k, v] of Object.entries(FIXED_COLORS)) stats.push(`fixed ${k}: ${v}`);

  console.log('=== GLB Vehicles Generated ===');
  for (const s of stats) console.log(s);
}

main().catch((e) => { console.error(e); process.exit(1); });
