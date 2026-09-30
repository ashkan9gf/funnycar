// inspect_user_models.mjs — بازرسی عمیق مدل‌های جدید کاربر طبق قواعد فانی‌کار
// قواعد: مقیاس ۱ متر ≈ ۴۸ واحد؛ جلو = -Z؛ نام‌گذاری body/glass/wheel_fl..rr/lights_front/_rear/plate
import { NodeIO } from '@gltf-transform/core';
import { ALL_EXTENSIONS } from '@gltf-transform/extensions';

const io = new NodeIO().registerExtensions(ALL_EXTENSIONS);
const files = process.argv.slice(2);
const fmt = (v) => (Math.round(v * 10) / 10).toString();
const mat4 = () => new Float32Array([1,0,0,0, 0,1,0,0, 0,0,1,0, 0,0,0,1]);
const xform = (m, p) => {
  const [x,y,z] = p;
  const o = [0,0,0];
  for (let r = 0; r < 3; r++) o[r] = m[r*4+0]*x + m[r*4+1]*y + m[r*4+2]*z + m[r*4+3];
  return o;
};

for (const f of files) {
  console.log('\n================', f.split('/').pop(), '================');
  const doc = await io.read(f);
  const root = doc.getRoot();
  const scene = root.getDefaultScene();

  console.log('extensions used:', root.listExtensionsUsed().map(e => e.extensionName).join(', ') || '(none)');
  const mats = root.listMaterials();
  console.log('materials:', mats.length);
  for (const m of mats) {
    if (typeof m.getPBRMetallicRoughness !== 'function') {
      console.log(`  - "${m.getName()}" [non-PBR material class: ${m.constructor.name}]`);
      continue;
    }
    const pbr = m.getPBRMetallicRoughness();
    const c = pbr.getBaseColorFactor();
    const hex = '#' + c.slice(0,3).map(x => Math.round(x*255).toString(16).padStart(2,'0')).join('');
    console.log(`  - "${m.getName()}" base=${hex} metal=${fmt(pbr.getMetallicFactor())} rough=${fmt(pbr.getRoughnessFactor())} tex=${pbr.getBaseColorTexture() ? 'YES' : 'no'}`);
  }
  const texs = root.listTextures();
  console.log('textures:', texs.length, texs.map(t => `${t.getMimeType()}(${t.getImage()?.length||0}b)`).join(', '));
  console.log('animations:', root.listAnimations().length);

  let totalTri = 0, totalVert = 0, meshCount = 0;
  const names = [];
  const bb = { min: [1e9,1e9,1e9], max: [-1e9,-1e9,-1e9] };
  let interleaved = 0, quantized = 0, noNormal = 0, noUV = 0, noname = 0;

  const walk = (node) => {
    const wm = node.getWorldMatrix();
    for (const mesh of node.listMeshes()) {
      meshCount++;
      const nm = mesh.getName() || node.getName() || `__noname${noname++}`;
      for (const prim of mesh.listPrimitives()) {
        const pos = prim.getAttribute('POSITION');
        if (!pos) continue;
        totalVert += pos.getCount();
        const idx = prim.getIndices();
        totalTri += (idx ? idx.getCount() : pos.getCount()) / 3;
        if (pos.getInterleavedBuffer()) interleaved++;
        if (pos.getComponentType() !== 5126) quantized++;
        if (!prim.getAttribute('NORMAL')) noNormal++;
        if (!prim.getAttribute('TEXCOORD_0')) noUV++;
        for (let i = 0; i < pos.getCount(); i++) {
          const w = xform(wm, [pos.getX(i), pos.getY(i), pos.getZ(i)]);
          for (let a = 0; a < 3; a++) {
            if (w[a] < bb.min[a]) bb.min[a] = w[a];
            if (w[a] > bb.max[a]) bb.max[a] = w[a];
          }
        }
      }
      names.push(nm);
    }
    node.listChildren().forEach(walk);
  };
  scene.listChildren().forEach(walk);

  console.log('meshes:', meshCount, ' tris:', Math.round(totalTri), ' verts:', totalVert);
  console.log('mesh names:', names.join(', ').slice(0, 500));
  console.log('attr: interleaved='+interleaved, 'quantized='+quantized, 'noNormal='+noNormal, 'noUV='+noUV);
  const dim = [bb.max[0]-bb.min[0], bb.max[1]-bb.min[1], bb.max[2]-bb.min[2]];
  console.log(`BBOX min=[${bb.min.map(fmt)}] max=[${bb.max.map(fmt)}]`);
  console.log(`SIZE X(عرض)=${fmt(dim[0])} Y(ارتفاع)=${fmt(dim[1])} Z(طول)=${fmt(dim[2])}  |  متر: طول=${fmt(dim[2]/48)} عرض=${fmt(dim[0]/48)} ارتفاع=${fmt(dim[1]/48)} (۱م=48u، پراید=172u)`);
}
