// process_user_models.mjs — آماده‌سازی دو مدل Sketchfab برای فانی‌کار
// قواعد بازی: جلو=-Z، بالا=+Y، ۱ متر=۴۸ واحد؛ نام چرخ: wheel_fl/fr/rl/rr
// خروجی: public/assets/models/vehicles/{renault4,vintage}{,_lod1}.glb
import { NodeIO } from '@gltf-transform/core';
import { ALL_EXTENSIONS } from '@gltf-transform/extensions';
import { prune, simplify, weld } from '@gltf-transform/functions';
import { MeshoptSimplifier } from 'meshoptimizer';
import sharp from 'sharp';
import fs from 'fs';

const io = new NodeIO().registerExtensions(ALL_EXTENSIONS);

// ---------- mat4 helpers (COLUMN-MAJOR، هماهنگ با glTF: m[c*4+r]) ----------
const IDENT = [1,0,0,0, 0,1,0,0, 0,0,1,0, 0,0,0,1];
function mul(a, b) {
  const o = new Array(16).fill(0);
  for (let c = 0; c < 4; c++) for (let r = 0; r < 4; r++) {
    let s = 0;
    for (let k = 0; k < 4; k++) s += a[k*4+r] * b[c*4+k];
    o[c*4+r] = s;
  }
  return o;
}
function xfp(m, p) {
  return [m[0]*p[0]+m[4]*p[1]+m[8]*p[2]+m[12], m[1]*p[0]+m[5]*p[1]+m[9]*p[2]+m[13], m[2]*p[0]+m[6]*p[1]+m[10]*p[2]+m[14]];
}
function xdir(m, v) {
  return [m[0]*v[0]+m[4]*v[1]+m[8]*v[2], m[1]*v[0]+m[5]*v[1]+m[9]*v[2], m[2]*v[0]+m[6]*v[1]+m[10]*v[2]];
}
function invM(m) {
  // general 4x4 inverse (cofactor) — only needed for normal matrix
  const a = m;
  const inv = (i, j) => {
    const s = [];
    for (let r = 0; r < 4; r++) for (let c = 0; c < 4; c++) if (r !== i && c !== j) s.push(a[r*4+c]);
    const get = (r, c) => s[r*3+c];
    return (get(0,0)*get(1,1)*get(2,2) + get(0,1)*get(1,2)*get(2,0) + get(0,2)*get(1,0)*get(2,1)
          - get(0,2)*get(1,1)*get(2,0) - get(0,1)*get(1,0)*get(2,2) - get(0,0)*get(1,2)*get(2,1))
          * (((i+j) % 2) ? -1 : 1);
  };
  const o = new Array(16);
  for (let c = 0; c < 4; c++) for (let r = 0; r < 4; r++) o[c*4+r] = inv(r, c);
  return o;
}
function rotX(deg) { const r = deg*Math.PI/180, c = Math.cos(r), s = Math.sin(r); return [1,0,0,0, 0,c,s,0, 0,-s,c,0, 0,0,0,1]; }
function rotY(deg) { const r = deg*Math.PI/180, c = Math.cos(r), s = Math.sin(r); return [c,0,-s,0, 0,1,0,0, s,0,c,0, 0,0,0,1]; }
function rotZ(deg) { const r = deg*Math.PI/180, c = Math.cos(r), s = Math.sin(r); return [c,s,0,0, -s,c,0,0, 0,0,1,0, 0,0,0,1]; }
function scaleM(s) { return [s,0,0,0, 0,s,0,0, 0,0,s,0, 0,0,0,1]; }
function transM(x, y, z) { return [1,0,0,0, 0,1,0,0, 0,0,1,0, x,y,z,1]; }

async function processModel(input, outBase, opts) {
  const { targetLen, flip180 = false, maxTex = 512, carve = true } = opts;
  const doc = await io.read(input);
  const root = doc.getRoot();
  const scene = root.getDefaultScene();

  // ---------- 1) بیک ترنسفورم‌ها روی هندسه + صفر کردن همه ترنسفورم نودها ----------
  let triTotal = 0;
  for (const node of root.listNodes()) {
    const mesh = node.getMesh();
    if (!mesh) continue;
    const M = node.getWorldMatrix();
    const nrm = invM(M); // normal matrix = (M^-1)^T on mat3 — برای سادگی full inverse, بعد transpose دستی
    for (const prim of mesh.listPrimitives()) {
      const pos = prim.getAttribute('POSITION');
      const n = pos.getCount();
      const parr = pos.getArray();
      const arr = new Float32Array(n * 3);
      for (let i = 0; i < n; i++) {
        const w = xfp(M, [parr[i*3], parr[i*3+1], parr[i*3+2]]);
        arr[i*3] = w[0]; arr[i*3+1] = w[1]; arr[i*3+2] = w[2];
      }
      pos.setArray(arr);
      const nrmA = prim.getAttribute('NORMAL');
      if (nrmA) {
        const src = nrmA.getArray();
        const a = new Float32Array(n * 3);
        for (let i = 0; i < n; i++) {
          // transpose(inverse(mat3)) — ستون‌های inverse در سطرها
          const v = [src[i*3], src[i*3+1], src[i*3+2]];
          const t = [
            nrm[0]*v[0] + nrm[4]*v[1] + nrm[8]*v[2],
            nrm[1]*v[0] + nrm[5]*v[1] + nrm[9]*v[2],
            nrm[2]*v[0] + nrm[6]*v[1] + nrm[10]*v[2],
          ];
          const l = Math.hypot(t[0], t[1], t[2]) || 1;
          a[i*3] = t[0]/l; a[i*3+1] = t[1]/l; a[i*3+2] = t[2]/l;
        }
        nrmA.setArray(a);
      }
      const tanA = prim.getAttribute('TANGENT');
      if (tanA) {
        const src = tanA.getArray();
        const a = new Float32Array(n * 4);
        for (let i = 0; i < n; i++) {
          const t = xdir(M, [src[i*4], src[i*4+1], src[i*4+2]]);
          const l = Math.hypot(t[0], t[1], t[2]) || 1;
          a[i*4] = t[0]/l; a[i*4+1] = t[1]/l; a[i*4+2] = t[2]/l; a[i*4+3] = src[i*4+3];
        }
        tanA.setArray(a);
      }
      const idx = prim.getIndices();
      triTotal += (idx ? idx.getCount() : n) / 3;
    }
  }
  // همه نودها (حتی بدون مش مثل ریشه Sketchfab) — ترنسفورم صفر شود وگرنه روی بیک اعمال می‌شود!
  for (const node of root.listNodes()) {
    node.setMatrix(IDENT);
    node.setTranslation?.([0,0,0]);
  }

  // ---------- 2) bbox کل + ابزار مشترک ----------
  const bboxOf = () => {
    const mn = [1e9,1e9,1e9], mx = [-1e9,-1e9,-1e9];
    for (const mesh of root.listMeshes()) for (const prim of mesh.listPrimitives()) {
      const parr = prim.getAttribute('POSITION').getArray();
      const cnt = prim.getAttribute('POSITION').getCount();
      for (let i = 0; i < cnt; i++) {
        for (let a = 0; a < 3; a++) { if (parr[i*3+a] < mn[a]) mn[a] = parr[i*3+a]; if (parr[i*3+a] > mx[a]) mx[a] = parr[i*3+a]; }
      }
    }
    return { mn, mx };
  };
  let bb = bboxOf();
  let min = bb.mn, max = bb.mx;
  let dim = [max[0]-min[0], max[1]-min[1], max[2]-min[2]];
  console.log(`  بعد بیک‌شده: X=${dim[0].toFixed(0)} Y=${dim[1].toFixed(0)} Z=${dim[2].toFixed(0)}  tris=${Math.round(triTotal)}`);

  // ---------- 3) قائم‌سازی هوشمند: امتحان هر سه محور عمودی، بهترین پروفایل ماشین ----------
  // امتیاز: طول/ارتفاع ≈ ۲٫۴ | عرض/ارتفاع ≈ ۰٫۹۵
  const scoreOf = (hei, lenA, widA) => Math.abs(lenA/hei - 2.4) + 0.8*Math.abs(widA/hei - 0.95);
  function rotForVert(v) {
    if (v === 1) return IDENT;      // Y قائم
    if (v === 2) return rotX(-90);  // Z → Y
    return rotZ(-90);                // X → Y
  }
  let best = null;
  for (const v of [0,1,2]) {
    const R = rotForVert(v);
    // ابعاد پس از R: محور v می‌رود روی Y؛ دو محور دیگر افقی
    const others = [0,1,2].filter(a => a !== v);
    const h1 = dim[others[0]], h2 = dim[others[1]];
    const lenA = Math.max(h1, h2), widA = Math.min(h1, h2), hei = dim[v];
    const sc = scoreOf(hei, lenA, widA);
    if (!best || sc < best.sc) best = { sc, v, R };
  }
  if (best.v !== 1) { applyWhole(best.R); console.log(`  → محور عمودی = ${'XYZ'[best.v]}؛ چرخش اعمال شد (score=${best.sc.toFixed(2)})`); }
  else console.log(`  → Y قائم بود (score=${best.sc.toFixed(2)})`);

  function applyWhole(M) {
    for (const mesh of root.listMeshes()) {
      for (const prim of mesh.listPrimitives()) {
        const pos = prim.getAttribute('POSITION');
        const src = pos.getArray();
        const n = pos.getCount();
        const arr = new Float32Array(n * 3);
        for (let i = 0; i < n; i++) {
          const w = xfp(M, [src[i*3], src[i*3+1], src[i*3+2]]);
          arr[i*3] = w[0]; arr[i*3+1] = w[1]; arr[i*3+2] = w[2];
        }
        pos.setArray(arr);
        const nrmA = prim.getAttribute('NORMAL');
        if (nrmA) {
          const s2 = nrmA.getArray();
          const a = new Float32Array(n * 3);
          for (let i = 0; i < n; i++) {
            const t = xdir(M, [s2[i*3], s2[i*3+1], s2[i*3+2]]);
            const l = Math.hypot(t[0], t[1], t[2]) || 1;
            a[i*3] = t[0]/l; a[i*3+1] = t[1]/l; a[i*3+2] = t[2]/l;
          }
          nrmA.setArray(a);
        }
      }
    }
  }

  // بازمحاسبه bbox
  bb = bboxOf();
  min = bb.mn; max = bb.mx;
  dim = [max[0]-min[0], max[1]-min[1], max[2]-min[2]];

  // ---------- 4) طول روی Z (اگر روی X است rotY(90)) ----------
  if (dim[0] > dim[2]) { applyWhole(rotY(90)); console.log('  → طول روی X بود؛ rotY(90)'); }
  if (flip180) { applyWhole(rotY(180)); console.log('  → فلیپ ۱۸۰ (جهت جلو)'); }

  // ---------- 5) مقیاس + مرکز + زمین ----------
  bb = bboxOf();
  min = bb.mn; max = bb.mx;
  dim = [max[0]-min[0], max[1]-min[1], max[2]-min[2]];
  const s = targetLen / dim[2];
  applyWhole(scaleM(s));
  const cx = (min[0]+max[0])/2 * s, cz = (min[2]+max[2])/2 * s, gy = min[1] * s;
  applyWhole(transM(-cx, -gy, -cz));
  const len = targetLen, wid = dim[0]*s, hei = dim[1]*s;
  console.log(`  نهایی: len=${len.toFixed(0)} wid=${wid.toFixed(0)} hei=${hei.toFixed(0)} (scale=${s.toFixed(3)})`);

  // ---------- 6) چرخ‌ها: نام‌گذاری چهارگوشه ----------
  let wheelsDone = nameWheelsByMeshes();
  if (!wheelsDone && carve) {
    console.log('  چرخ جدا نداشت → کِیو از مش بدنه…');
    wheelsDone = carveWheelsFromBody();
  }
  console.log(`  چرخ‌ها: ${wheelsDone ? 'فل/فر/آرل/آرر ✓' : 'ناموفق — بدون اسپین'}`);

  function nameWheelsByMeshes() {
    const cand = []; // {mesh, prim, c, md}
    for (const mesh of root.listMeshes()) {
      for (const prim of mesh.listPrimitives()) {
        const pos = prim.getAttribute('POSITION');
        const parr = pos.getArray();
        let pmin = [1e9,1e9,1e9], pmax = [-1e9,-1e9,-1e9];
        for (let i = 0; i < pos.getCount(); i++) {
          const p = [parr[i*3], parr[i*3+1], parr[i*3+2]];
          for (let a = 0; a < 3; a++) { if (p[a] < pmin[a]) pmin[a] = p[a]; if (p[a] > pmax[a]) pmax[a] = p[a]; }
        }
        const c = [(pmin[0]+pmax[0])/2, (pmin[1]+pmax[1])/2, (pmin[2]+pmax[2])/2];
        const md = Math.max(pmax[0]-pmin[0], pmax[1]-pmin[1], pmax[2]-pmin[2]);
        cand.push({ mesh, prim, c, md, pmin, pmax });
      }
    }
    // کاندید: پایین بدنه + نزدیک محور + اندازه لاستیک
    let pool = cand.filter(x => x.c[1] < hei*0.55 && x.md < len*0.30 && x.md > len*0.06
      && Math.abs(x.c[2]) > len*0.10 && Math.abs(x.c[2]) < len*0.45
      && Math.abs(x.c[0]) < wid*0.75);
    if (pool.length < 4) return false;
    // ۴ بذر: بزرگ‌ترین‌ها در ۴ ربع متفاوت
    pool.sort((a,b) => b.md - a.md);
    const seeds = [];
    for (const x of pool) {
      const q = (x.c[2] < 0 ? 'f' : 'r') + (x.c[0] > 0 ? 'l' : 'r');
      if (seeds.some(s => s.q === q)) continue;
      seeds.push({ q, c: x.c });
      if (seeds.length === 4) break;
    }
    if (seeds.length < 4) return false;
    // هر کاندید به نزدیک‌ترین بذر (شعاع خوشه)
    const clusterR = len * 0.22;
    const byCorner = { fl: [], fr: [], rl: [], rr: [] };
    for (const x of pool) {
      let bi = -1, bd = 1e9;
      seeds.forEach((s, i) => {
        const d = Math.hypot(x.c[0]-s.c[0], x.c[1]-s.c[1], x.c[2]-s.c[2]);
        if (d < bd) { bd = d; bi = i; }
      });
      if (bd > clusterR) continue;
      byCorner[seeds[bi].q].push(x);
    }
    if (Object.values(byCorner).some(a => a.length === 0)) return false;
    // نقشه mesh→node — three.js نام نود را می‌بیند نه نام مش!
    const meshToNodes = new Map();
    for (const node of root.listNodes()) {
      const m = node.getMesh();
      if (!m) continue;
      if (!meshToNodes.has(m)) meshToNodes.set(m, []);
      meshToNodes.get(m).push(node);
    }
    for (const [k, list] of Object.entries(byCorner)) {
      list.forEach((x, i) => {
        const nm = `wheel_${k}${i ? '_b'+i : ''}`;
        x.mesh.setName(nm);
        for (const nd of (meshToNodes.get(x.mesh) || [])) nd.setName(nm);
      });
    }
    return true;
  }

    // کِیو چرخ از مش یکپارچه بدنه (مدل rusty) — نود چرخ فرزند scene است، نام نود کافی است
  function carveWheelsFromBody() {
    const wheelR = len * 0.135;
    const axleF = len * 0.32, axleR = len * 0.32;
    const centers = {
      fl: [ wid/2 - wheelR*0.55, wheelR, -axleF],
      fr: [-wid/2 + wheelR*0.55, wheelR, -axleF],
      rl: [ wid/2 - wheelR*0.55, wheelR,  axleR],
      rr: [-wid/2 + wheelR*0.55, wheelR,  axleR],
    };
    // بزرگ‌ترین مش = بدنه
    let bodyMesh = null, bodyTri = 0;
    for (const mesh of root.listMeshes()) {
      let t = 0;
      for (const prim of mesh.listPrimitives()) {
        const idx = prim.getIndices();
        const pos = prim.getAttribute('POSITION');
        t += (idx ? idx.getCount() : pos.getCount()) / 3;
      }
      if (t > bodyTri) { bodyTri = t; bodyMesh = mesh; }
    }
    if (!bodyMesh || bodyMesh.listPrimitives().length !== 1) return false;
    const prim = bodyMesh.listPrimitives()[0];
    const pos = prim.getAttribute('POSITION');
    const idx = prim.getIndices();
    if (!idx) return false;
    const posArr = pos.getArray();
    const idxArr = idx.getArray();
    const keep = [], carved = {};
    for (const k of Object.keys(centers)) carved[k] = [];
    const r2 = Math.pow(wheelR*1.42, 2);
    const nT = idxArr.length / 3;
    for (let t = 0; t < nT; t++) {
      const i0 = idxArr[t*3], i1 = idxArr[t*3+1], i2 = idxArr[t*3+2];
      const vs = [[posArr[i0*3],posArr[i0*3+1],posArr[i0*3+2]], [posArr[i1*3],posArr[i1*3+1],posArr[i1*3+2]], [posArr[i2*3],posArr[i2*3+1],posArr[i2*3+2]]];
      let assigned = null;
      for (const [k, c] of Object.entries(centers)) {
        let inside = true;
        for (const v of vs) {
          const dx = v[0]-c[0], dy = v[1]-c[1], dz = v[2]-c[2];
          if (dx*dx+dy*dy+dz*dz > r2) { inside = false; break; }
        }
        if (inside) { assigned = k; break; }
      }
      if (assigned) carved[assigned].push(i0, i1, i2);
      else keep.push(i0, i1, i2);
    }
    if (Object.values(carved).some(a => a.length/3 < 150)) return false;
    // بدنه بدون مثلث‌های چرخ
    idx.setArray(new Uint32Array(keep));
    // ساخت مش چرخ: position مستقل فقط با رأس‌های همین چرخ (remap) —
    // اگر position مشترک بدنه بماند، bbox چرخ = کل ماشین → خوشه‌بندی ران‌تایم خراب می‌شود!
    for (const [k, arr] of Object.entries(carved)) {
      const remap = new Map();
      const newList = [];
      for (let t = 0; t < arr.length; t += 3) {
        for (let j = 0; j < 3; j++) {
          const old = arr[t+j];
          if (!remap.has(old)) { remap.set(old, remap.size); newList.push(old); }
        }
      }
      const parr = pos.getArray();
      const np = new Float32Array(remap.size * 3);
      for (const [oldI, newI] of remap) {
        np[newI*3] = parr[oldI*3]; np[newI*3+1] = parr[oldI*3+1]; np[newI*3+2] = parr[oldI*3+2];
      }
      const newIdx = new Uint32Array(arr.length);
      for (let t = 0; t < arr.length; t++) newIdx[t] = remap.get(arr[t]);
      const wm = doc.createMesh(`wheel_${k}`);
      const posAcc = doc.createAccessor().setType('VEC3').setArray(np);
      const idxAcc = doc.createAccessor().setType('SCALAR').setArray(newIdx);
      const wp = doc.createPrimitive()
        .setMaterial(prim.getMaterial())
        .setIndices(idxAcc)
        .setAttribute('POSITION', posAcc);
      wm.addPrimitive(wp);
      const node = doc.createNode(`wheel_${k}_node`);
      node.setMesh(wm);
      scene.addChild(node);
    }
    return true;
  }

  // ---------- 7) تکسچرها: ریسایز + فشرده‌سازی ----------
  // نقشه استفاده تکسچر از متریال‌ها (listMaterials روی Texture در این نسخه نیست)
  const texUse = new Map();
  for (const mat of root.listMaterials()) {
    const slots = {
      baseColor: mat.getBaseColorTexture(),
      normal: mat.getNormalTexture(),
      metalRough: mat.getMetallicRoughnessTexture(),
      emissive: mat.getEmissiveTexture?.(),
      occlusion: mat.getOcclusionTexture?.(),
    };
    for (const [slot, t] of Object.entries(slots)) {
      if (!t) continue;
      if (!texUse.has(t)) texUse.set(t, new Set());
      texUse.get(t).add(slot);
    }
  }
  for (const tex of root.listTextures()) {
    const img = tex.getImage();
    if (!img) continue;
    const slots = texUse.get(tex);
    if (!slots || slots.size === 0) { console.log('  تکسچر بی‌استفاده — حذف'); tex.dispose(); continue; }
    const isNormal = slots.has('normal');
    const blend = slots.has('baseColor') && root.listMaterials().some(m => m.getBaseColorTexture() === tex && m.getAlphaMode() !== 'OPAQUE');
    const resized = await sharp(Buffer.from(img))
      .resize(maxTex, maxTex, { fit: 'inside', withoutEnlargement: true })
      .toBuffer();
    if (isNormal) {
      tex.setImage(new Uint8Array(resized)).setMimeType('image/png');
    } else if (blend) {
      const png = await sharp(resized).png({ compressionLevel: 9 }).toBuffer();
      tex.setImage(new Uint8Array(png)).setMimeType('image/png');
    } else {
      const jpg = await sharp(resized).jpeg({ quality: 84 }).toBuffer();
      tex.setImage(new Uint8Array(jpg)).setMimeType('image/jpeg');
    }
  }

  // ---------- 8) متریال‌ها: doubleSided خاموش (به‌جز BLEND) ----------
  for (const mat of root.listMaterials()) {
    if (mat.getAlphaMode() === 'OPAQUE') mat.setDoubleSided(false);
  }

  // این نسخه: همه فانکشن‌ها فکتوری‌اند — (opts) → تابع async که doc می‌گیرد
  await prune({})(doc);

  // ---------- 9) نوشتن نسخه کامل ----------
  await io.write(outBase + '.glb', doc);
  const fullSize = fs.statSync(outBase + '.glb').size;

  // ---------- 10) LOD1 = جوش + ساده‌سازی (سینتکس فکتوری: ()weld/simplify → exec) ----------
  const doc2 = await io.read(outBase + '.glb');
  try {
    await MeshoptSimplifier.ready;
    await weld({})(doc2);
    await simplify({ simplifier: MeshoptSimplifier, ratio: 0.38, error: 0.0012 })(doc2);
  } catch (e) {
    console.log('  simplify خطا: ' + e.message);
  }
  await io.write(outBase + '_lod1.glb', doc2);
  const lodSize = fs.statSync(outBase + '_lod1.glb').size;

  console.log(`  ✅ ${outBase}.glb=${(fullSize/1024/1024).toFixed(2)}MB  lod1=${(lodSize/1024/1024).toFixed(2)}MB`);
}

console.log('== renault4 ==');
await processModel('/tmp/newmodels/extracted/renault_4_cv.glb', 'public/assets/models/vehicles/renault4', { targetLen: 176, flip180: true });
console.log('== vintage ==');
await processModel('/tmp/newmodels/extracted/rusty_vintage_car.glb', 'public/assets/models/vehicles/vintage', { targetLen: 197, flip180: true, carve: false });
