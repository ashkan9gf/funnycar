/**
 * generate_city.ts — تولید GLB ساختمان‌های تهران (فاز GRAPHICS_OVERHAUL)
 * اجرا: bun tools/glb/generate_city.ts
 * خروجی: public/assets/models/buildings/{apartment,shop,home,garage}.glb
 * هر فایل ۳ واریانس seed دارد تا ۳۶ بلوک تکراری به نظر نرسد.
 */

import { writeGLB } from './glbwriter.mjs';
import { buildBuildingGeometry, type BuildingType } from '../../src/game/render3d/cityGeometry';
import { linA } from '../../src/game/render3d/vehicleGeometry';

const OUT = 'public/assets/models/buildings';
const HEIGHTS: Record<BuildingType, number> = {
  apartment: 560,
  shop: 300,
  home: 400,
  garage: 235,
};

const MATERIALS = [
  { name: 'building', baseColor: linA('#ffffff'), metallic: 0.0, roughness: 0.9 },
];

async function main() {
  console.log('=== GLB Buildings Generated ===');
  for (const type of ['apartment', 'shop', 'home', 'garage'] as BuildingType[]) {
    for (let v = 0; v < 3; v++) {
      const geo = buildBuildingGeometry(type, HEIGHTS[type], seedOf(type, v));
      const r = await writeGLB(`${OUT}/${type}_${v}.glb`, [
        { name: 'building', geometry: geo, material: 0 },
      ], MATERIALS);
      console.log(`${type}_${v}  ${String(r.kb).padStart(4)}KB  ${String(r.tris).padStart(6)}tris`);
    }
  }
}

function seedOf(type: BuildingType, v: number): number {
  const base: Record<BuildingType, number> = { apartment: 11, shop: 23, home: 37, garage: 53 };
  return base[type] + v * 17;
}

main().catch((e) => { console.error(e); process.exit(1); });
