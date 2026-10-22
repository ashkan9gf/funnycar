// split_challenger.js — جدا کردن ۴ چرخ از مش Tyres_Shd + مقیاس/گراند مدل چلنجر
// ورودی: deq.glb (دی‌کوانتیزه‌شده) → خروجی: challenger_split.glb
// چرخ‌ها با نام wheel_fl/fr/rl/rr ذخیره می‌شوند تا مسیر external بازی (assembleCarFromGLB)
// خودکار پیوت چرخش + فرمان بسازد.
const fs = require('fs');
const path = require('path');
const { NodeIO } = require('@gltf-transform/core');
const { ALL_EXTENSIONS } = require('@gltf-transform/extensions');

const IN = process.argv[2] || '/home/z/my-project/upload/challenger/deq.glb';
const OUT = process.argv[3] || '/home/z/my-project/upload/challenger/challenger_split.glb';
const TARGET_LEN = parseFloat(process.argv[4] || '212'); // واحد بازی (سماند ۲۰۸)

async function main() {
  const io = new NodeIO().registerExtensions(ALL_EXTENSIONS);
  const doc = await io.read(IN);
  const root = doc.getRoot();

  // ---------- یافتن مش لاستیک ----------
  const tyresPrims = []; // {node, mesh, prim, mat}
  for (const mesh of root.listMeshes()) {
    for (const prim of mesh.listPrimitives()) {
      const mat = prim.getMaterial();
      if (mat && /tyres/i.test(mat.getName())) {
        tyresPrims.push({ mesh, prim, mat });
      }
    }
  }
  if (tyresPrims.length === 0) throw new Error('Tyres_Shd material mesh not found!');
  console.log('tyres prims:', tyresPrims.length);

  // ---------- جمع‌آوری مراکز مثلث‌ها (فضای جهانی تقریبی: ترنسفورم نود + مقیاس) ----------
  // همه مش‌ها زیر یک نود والد با ترنسفورم ساده هستند؛ ماتریس جهانی هر پریمیو را دقیق حساب می‌کنیم
  const scene = root.listScenes()[0];
  const triPts = []; // {x, z, primIdx, triIdx}
  const primWorld = [];
  for (const tp of tyresPrims) {
    // world matrix والد پریمیو (نودهایی که این مش را استفاده می‌کنند)
    const node = root.listNodes().find((n) => n.getMesh() === tp.mesh);
    if (!node) throw new Error('node for tyres mesh not found');
    const w = matMul(worldMatrixOf(scene, node), identity4());
    primWorld.push(w);
    const pos = tp.prim.getAttribute('POSITION');
    const idx = tp.prim.getIndices();
    const count = idx ? idx.getCount() : pos.getCount();
    const pa = pos.getArray(); // دی‌کوانتیزه → Float32Array فشرده
    const stride = pos.getElementSize();
    for (let t = 0; t < count; t += 3) {
      const a = idx ? idx.getScalar(t) : t;
      const b = idx ? idx.getScalar(t + 1) : t + 1;
      const c = idx ? idx.getScalar(t + 2) : t + 2;
      const cx = (pa[a * stride] + pa[b * stride] + pa[c * stride]) / 3;
      const cy = (pa[a * stride + 1] + pa[b * stride + 1] + pa[c * stride + 1]) / 3;
      const cz = (pa[a * stride + 2] + pa[b * stride + 2] + pa[c * stride + 2]) / 3;
      // اعمال ماتریس جهانی کامل
      const wx = w[0] * cx + w[4] * cy + w[8] * cz + w[12];
      const wz = w[2] * cx + w[6] * cy + w[10] * cz + w[14];
      triPts.push({ x: wx, z: wz, primIdx: tyresPrims.indexOf(tp), triIdx: t });
    }
  }
  console.log('triangles:', triPts.length);
  const xs = triPts.map(p => p.x), zs = triPts.map(p => p.z);
  const xm = Math.min(...xs), xM = Math.max(...xs), zm = Math.min(...zs), zM = Math.max(...zs);
  console.log('tyres world bbox: x', xm.toFixed(2), '..', xM.toFixed(2), ' z', zm.toFixed(2), '..', zM.toFixed(2));

  // ---------- k-means k=4 روی (x,z) — init از چهارجانب bbox ----------
  const zMid = (zm + zM) / 2;
  let centers = [
    { x: (xm + xM) / 2 - (xM - xm) * 0.3, z: (zm + zMid) / 2 },
    { x: (xm + xM) / 2 + (xM - xm) * 0.3, z: (zm + zMid) / 2 },
    { x: (xm + xM) / 2 - (xM - xm) * 0.3, z: (zMid + zM) / 2 },
    { x: (xm + xM) / 2 + (xM - xm) * 0.3, z: (zMid + zM) / 2 },
  ];
  for (let iter = 0; iter < 40; iter++) {
    const sums = centers.map(() => ({ x: 0, z: 0, n: 0 }));
    for (const p of triPts) {
      let bi = 0, bd = Infinity;
      for (let i = 0; i < 4; i++) {
        const dx = p.x - centers[i].x, dz = p.z - centers[i].z;
        const d = dx * dx + dz * dz;
        if (d < bd) { bd = d; bi = i; }
      }
      sums[bi].x += p.x; sums[bi].z += p.z; sums[bi].n++;
    }
    centers = sums.map((s, i) => (s.n > 0 ? { x: s.x / s.n, z: s.z / s.n } : centers[i]));
  }
  centers.sort((a, b) => a.z - b.z || a.x - b.x);
  console.log('wheel centers (GLB space):', JSON.stringify(centers.map(c => ({ x: +c.x.toFixed(2), z: +c.z.toFixed(2) }))));

  const assign = (p) => {
    let bi = 0, bd = Infinity;
    for (let i = 0; i < 4; i++) {
      const dx = p.x - centers[i].x, dz = p.z - centers[i].z;
      const d = dx * dx + dz * dz;
      if (d < bd) { bd = d; bi = i; }
    }
    return bi;
  };

  // ---------- ساخت ۴ مش چرخ ----------
  const names = ['wheel_rl', 'wheel_rr', 'wheel_fl', 'wheel_fr']; // z sort: -زودتر = عقب
  // توجه: centers sort صعودی z → دو اول = z کوچک‌تر. جلو مدل -Z است → z کوچک‌تر = جلو!
  // پس دو اول «جلو» هستند: wheel_fl/wheel_fr — اصلاح نام:
  const frontFirst = centers[0].z < centers[2].z;
  const orderedNames = frontFirst
    ? ['wheel_fl', 'wheel_fr', 'wheel_rl', 'wheel_rr']
    : ['wheel_rl', 'wheel_rr', 'wheel_fl', 'wheel_fr'];

  const tyresNode = root.listNodes().find((n) => n.getMesh() === tyresPrims[0].mesh);
  const parent = tyresNode.getParentNode() || scene;
  const matTyres = tyresPrims[0].mat;
  const tyreWorldM = matMul(worldMatrixOf(scene, tyresNode), identity4());
  const tyreT = [tyreWorldM[12], tyreWorldM[13], tyreWorldM[14]];
  const tyreS = [
    Math.hypot(tyreWorldM[0], tyreWorldM[1], tyreWorldM[2]),
    Math.hypot(tyreWorldM[4], tyreWorldM[5], tyreWorldM[6]),
    Math.hypot(tyreWorldM[8], tyreWorldM[9], tyreWorldM[10]),
  ];

  for (let w = 0; w < 4; w++) {
    const wheelMesh = doc.createMesh(orderedNames[w] + '_mesh');
    // گروه‌بندی مثلث‌ها بر اساس (پریمیو، خوشه)
    for (let pi = 0; pi < tyresPrims.length; pi++) {
      const tp = tyresPrims[pi];
      const pos = tp.prim.getAttribute('POSITION');
      const nrm = tp.prim.getAttribute('NORMAL');
      const uv = tp.prim.getAttribute('TEXCOORD_0');
      const idx = tp.prim.getIndices();
      const count = idx ? idx.getCount() : pos.getCount();
      const stride = pos.getElementSize();
      const pa = pos.getArray();
      const na = nrm ? nrm.getArray() : null;
      const ua = uv ? uv.getArray() : null;

      const keepTri = [];
      for (let t = 0; t < count; t += 3) {
        const a = idx ? idx.getScalar(t) : t;
        const b = idx ? idx.getScalar(t + 1) : t + 1;
        const c = idx ? idx.getScalar(t + 2) : t + 2;
        const cx = (pa[a * stride] + pa[b * stride] + pa[c * stride]) / 3;
        const cz = (pa[a * stride + 2] + pa[b * stride + 2] + pa[c * stride + 2]) / 3;
        if (assign({ x: cx, z: cz }) === w) keepTri.push(a, b, c);
      }
      if (keepTri.length === 0) continue;
      // ایندکس جدید + فشرده‌سازی رأس‌های استفاده‌شده
      const used = new Map();
      const remap = [];
      let next = 0;
      for (const v of keepTri) {
        if (!used.has(v)) used.set(v, next++);
        remap.push(used.get(v));
      }
      const n = next;
      const pOut = new Float32Array(n * stride);
      const nOut = nrm ? new Float32Array(n * 3) : null;
      const uOut = uv ? new Float32Array(n * uv.getElementSize()) : null;
      for (const [src, dst] of used) {
        for (let k = 0; k < stride; k++) pOut[dst * stride + k] = pa[src * stride + k];
        if (nrm) for (let k = 0; k < 3; k++) nOut[dst * 3 + k] = na[src * 3 + k];
        if (uv) for (let k = 0; k < uv.getElementSize(); k++) uOut[dst * uv.getElementSize() + k] = ua[src * uv.getElementSize() + k];
      }
      const pAcc = doc.createAccessor()
        .setType('VEC3').setArray(pOut).setBuffer(root.listBuffers()[0] || doc.createBuffer());
      const newPrim = doc.createPrimitive().setAttribute('POSITION', pAcc).setMaterial(matTyres);
      if (nrm) {
        const nAcc = doc.createAccessor().setType('VEC3').setArray(nOut).setBuffer(pAcc.getBuffer());
        newPrim.setAttribute('NORMAL', nAcc);
      }
      if (uv) {
        const uAcc = doc.createAccessor().setType('VEC2').setArray(uOut).setBuffer(pAcc.getBuffer());
        newPrim.setAttribute('TEXCOORD_0', uAcc);
      }
      const iAcc = doc.createAccessor().setType('SCALAR').setArray(new Uint32Array(remap)).setBuffer(pAcc.getBuffer());
      newPrim.setIndices(iAcc);
      wheelMesh.addPrimitive(newPrim);
    }
    if (wheelMesh.listPrimitives().length === 0) continue;
    const wheelNode = doc.createNode(orderedNames[w]);
    wheelNode.setMesh(wheelMesh);
    // ترنسفورم همان نود لاستیک اصلی (موقعیت جهانی حفظ شود)
    wheelNode.setTranslation(tyreT);
    wheelNode.setScale(tyreS);
    parent.addChild(wheelNode);
    console.log(`wheel ${orderedNames[w]}: tris=${wheelMesh.listPrimitives().reduce((s, p) => s + (p.getIndices() ? p.getIndices().getCount() : p.getAttribute('POSITION').getCount()) / 3, 0)}`);
  }
  // حذف مش اصلی لاستیک
  tyresNode.detach();

  // ---------- مقیاس + گراند + سنترینگ ----------
  // نود ریگ زیر صحنه — Scene خودش ترنسفورم ندارد
  const rig = doc.createNode('rig');
  for (const child of scene.listChildren()) rig.addChild(child);
  scene.addChild(rig);
  const bb = computeBounds(root);
  const len = bb.max[2] - bb.min[2];
  const s = TARGET_LEN / len;
  rig.setScale([s, s, s]);
  const bb2 = computeBounds(root);
  // گراند: minY → 0 و مرکز X/Z → 0
  const tx = -(bb2.min[0] + bb2.max[0]) / 2;
  const tz = -(bb2.min[2] + bb2.max[2]) / 2;
  rig.setTranslation([tx, -bb2.min[1], tz]);
  const bb3 = computeBounds(root);
  const fmt = (b) => ({ min: b.min.map(v => +v.toFixed(2)), max: b.max.map(v => +v.toFixed(2)), size: b.max.map((v, i) => +(v - b.min[i]).toFixed(2)) });
  console.log('bounds before:', fmt(bb));
  console.log('scale:', +s.toFixed(4));
  console.log('bounds final:', fmt(bb3));

  await io.write(OUT, doc);
  console.log('WROTE', OUT);
}

main().catch((e) => { console.error(e); process.exit(1); });

function worldMatrixOf(scene, node) {
  // ماتریس جهانی = حاصل‌ضرب زنجیره والد
  const chain = [];
  let cur = node;
  while (cur) { chain.unshift(cur); cur = cur.getParentNode(); }
  let m = identity4();
  for (const n of chain) m = matMul(m, nodeMatrix(n));
  return m;
}

/** محاسبه دقیق AABB کل سند با اعمال ماتریس کامل هر نود روی همه رأس‌ها */
function computeBounds(root, sceneOverride) {
  const scene = sceneOverride || root.listScenes()[0];
  const min = [Infinity, Infinity, Infinity];
  const max = [-Infinity, -Infinity, -Infinity];
  const walk = (node, parentM) => {
    const m = matMul(parentM, nodeMatrix(node));
    const mesh = node.getMesh();
    if (mesh) {
      for (const prim of mesh.listPrimitives()) {
        const pos = prim.getAttribute('POSITION');
        const n = pos.getCount();
        const stride = pos.getElementSize();
        const arr = pos.getArray();
        for (let i = 0; i < n; i++) {
          const x = arr[i * stride], y = arr[i * stride + 1], z = arr[i * stride + 2];
          // m: column-major 4x4 → بردار × ماتریس
          const wx = m[0] * x + m[4] * y + m[8] * z + m[12];
          const wy = m[1] * x + m[5] * y + m[9] * z + m[13];
          const wz = m[2] * x + m[6] * y + m[10] * z + m[14];
          if (wx < min[0]) min[0] = wx; if (wx > max[0]) max[0] = wx;
          if (wy < min[1]) min[1] = wy; if (wy > max[1]) max[1] = wy;
          if (wz < min[2]) min[2] = wz; if (wz > max[2]) max[2] = wz;
        }
      }
    }
    for (const child of node.listChildren()) walk(child, m);
  };
  const rootM = identity4();
  for (const topNode of scene.listChildren()) walk(topNode, rootM);
  return { min, max };
}

function identity4() { return [1,0,0,0, 0,1,0,0, 0,0,1,0, 0,0,0,1]; }
function nodeMatrix(node) {
  const t = node.getTranslation(), r = node.getRotation(), s = node.getScale();
  const m = mat4FromQuat(r || [0, 0, 0, 1]);
  for (let i = 0; i < 3; i++) {
    m[i] *= s[0]; m[4 + i] *= s[1]; m[8 + i] *= s[2];
  }
  m[12] = t[0]; m[13] = t[1]; m[14] = t[2];
  return m;
}
function matMul(a, b) {
  const o = new Array(16).fill(0);
  for (let c = 0; c < 4; c++) for (let r = 0; r < 4; r++) {
    let v = 0;
    for (let k = 0; k < 4; k++) v += a[k * 4 + r] * b[c * 4 + k];
    o[c * 4 + r] = v;
  }
  return o;
}
function mat4FromQuat(q) {
  const [x, y, z, w] = q;
  const x2 = x + x, y2 = y + y, z2 = z + z;
  const xx = x * x2, xy = x * y2, xz = x * z2;
  const yy = y * y2, yz = y * z2, zz = z * z2;
  const wx = w * x2, wy = w * y2, wz = w * z2;
  return [
    1 - (yy + zz), xy + wz, xz - wy, 0,
    xy - wz, 1 - (xx + zz), yz + wx, 0,
    xz + wy, yz - wx, 1 - (xx + yy), 0,
    0, 0, 0, 1,
  ];
}
