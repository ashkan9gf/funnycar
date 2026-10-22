/**
 * generate_city.ts — تولید GLB ساختمان‌های تهران (فاز GRAPHICS_OVERHAUL → v0.2.48 FACADE-TEX)
 * اجرا: bun tools/glb/generate_city.ts
 * خروجی: public/assets/models/buildings/{type}_{0..5}.glb — ۴ نوع × ۶ واریانس = ۲۴ فایل
 * هر واریانس: ارتفاع متمایز + الگوی نمای متمایز (پنجره/پالت/نور داخلی از textures3d.getBuildingFacade)
 * GLB = دو entry: «walls» (باکس UV → متریال facade) + «props» (بام ایرانی، vertex-color)
 */

import { writeGLB } from './glbwriter.mjs';
import {
  buildBuildingGeometry,
  BUILDING_VARIANTS,
  BUILDING_VARIANTS_PER_TYPE,
  type BuildingType,
} from '../../src/game/render3d/cityGeometry';

const OUT = 'public/assets/models/buildings';

const MATERIALS = [
  // 0 — facade: سفید؛ رنگ از تکسچر نما می‌آید (runtime: map + emissiveMap نور داخلی)
  { name: 'facade', baseColor: [1, 1, 1, 1], metallic: 0.0, roughness: 0.9 },
  // 1 — props: سفید + COLOR_0 (vertexColors) — کولر/منبع آب/لبه بام
  { name: 'props', baseColor: [1, 1, 1, 1], metallic: 0.0, roughness: 0.9 },
];

async function main() {
  console.log('=== GLB Buildings Generated (v0.2.48 facade-texture architecture) ===');
  for (const type of ['apartment', 'shop', 'home', 'garage'] as BuildingType[]) {
    for (let v = 0; v < BUILDING_VARIANTS_PER_TYPE; v++) {
      const h = BUILDING_VARIANTS[type][v % BUILDING_VARIANTS[type].length];
      const seed = type.charCodeAt(0) * 31 + v * 17;
      const { walls, props } = buildBuildingGeometry(type, h, seed);
      const file = `${OUT}/${type}_${v}.glb`;
      const r = await writeGLB(file, [
        { name: 'walls', geometry: walls, material: 0 },
        { name: 'props', geometry: props, material: 1 },
      ], MATERIALS);
      console.log(`${type}_${v}  h=${h}  ${String(r.kb).padStart(4)}KB  ${String(r.tris).padStart(6)}tris`);
    }
  }
}

main().catch((e) => { console.error(e); process.exit(1); });
