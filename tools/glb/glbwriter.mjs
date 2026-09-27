/**
 * glbwriter.mjs — تولیدکننده GLB بدون وابستگی (GLB 2.0 binary glTF)
 * ============================================================
 * ورودی: [{ name, geometry (THREE.BufferGeometry), material: index, color? }]
 *  - geometry باید position/normal/uv داشته باشد (indexed یا non-indexed)
 *  - color اختیاری: COLOR_0 (رأس‌رنگ) — برای merge با یک متریال مشترک
 * خروجی: بافر GLB معتبر با متریال‌های PBR (pbrMetallicRoughness)
 *
 * نکته: GLTFLoader هنگام وجود COLOR_0 خودش vertexColors=true می‌گذارد.
 */

const JSON_CHUNK = 0x4E4F534A; // 'JSON'
const BIN_CHUNK = 0x004E4942;  // 'BIN\0'
const MAGIC = 0x46546C67;      // 'glTF'

function align4(n) {
  return (n + 3) & ~3;
}

/**
 * ساخت یک primitive از BufferGeometry
 */
function primitiveFromGeometry(geometry, materialIndex, vertexColor) {
  const pos = geometry.getAttribute('position');
  if (!pos) throw new Error('geometry without position');
  const idx = geometry.getIndex();
  const uv = geometry.getAttribute('uv');
  const nor = geometry.getAttribute('normal');

  const attributes = {};
  const views = []; // {array, type, componentType}

  if (nor) {
    attributes.NORMAL = views.length;
    views.push({ array: nor.array, type: 'VEC3', componentType: 5126 });
  } else {
    geometry.computeVertexNormals();
    const n2 = geometry.getAttribute('normal');
    attributes.NORMAL = views.length;
    views.push({ array: n2.array, type: 'VEC3', componentType: 5126 });
  }

  if (uv) {
    attributes.TEXCOORD_0 = views.length;
    views.push({ array: uv.array, type: 'VEC2', componentType: 5126 });
  }

  if (vertexColor) {
    const colors = new Float32Array(pos.count * 3);
    for (let i = 0; i < pos.count; i++) {
      colors[i * 3] = vertexColor[0];
      colors[i * 3 + 1] = vertexColor[1];
      colors[i * 3 + 2] = vertexColor[2];
    }
    attributes.COLOR_0 = views.length;
    views.push({ array: colors, type: 'VEC3', componentType: 5126 });
  }

  attributes.POSITION = views.length;
  views.push({ array: pos.array, type: 'VEC3', componentType: 5126 });

  let indicesView = -1;
  if (idx) {
    indicesView = views.length;
    views.push({ array: new Uint32Array(idx.array), type: 'SCALAR', componentType: 5125 });
  }

  return { attributes, views, indicesView };
}

/**
 * ساخت GLB کامل
 * @param {Array<{name:string, geometry:object, material:number, color?:number[], translation?:number[]}>} entries
 * @param {Array<object>} materials — matDef: {name, baseColor, metallic, roughness, alphaMode?, doubleSided?, emissive?}
 * @returns {ArrayBuffer}
 */
export function buildGLB(entries, materials) {
  const json = {
    asset: { version: '2.0', generator: 'FunnyCarIR GLB Builder (Node)' },
    scene: 0,
    scenes: [{ name: 'Scene', nodes: [] }],
    nodes: [],
    meshes: [],
    materials: materials.map((m) => {
      const pbr = {
        baseColorFactor: m.baseColor ?? [1, 1, 1, 1],
        metallicFactor: m.metallic ?? 0,
        roughnessFactor: m.roughness ?? 0.85,
      };
      const out = { name: m.name, pbrMetallicRoughness: pbr };
      if (m.emissive) out.emissiveFactor = m.emissive;
      if (m.alphaMode) { out.alphaMode = m.alphaMode; if (m.alphaCutoff) out.alphaCutoff = m.alphaCutoff; }
      if (m.doubleSided) out.doubleSided = true;
      return out;
    }),
    accessors: [],
    bufferViews: [],
    buffers: [],
  };

  // ---------- جمع‌کردن داده باینری ----------
  const bins = [];
  let binOffset = 0;

  const pushView = (typedArray) => {
    const pad = align4(binOffset) - binOffset;
    if (pad > 0) { bins.push(new Uint8Array(pad)); binOffset += pad; }
    const bytes = new Uint8Array(typedArray.buffer, typedArray.byteOffset, typedArray.byteLength);
    const offset = binOffset;
    bins.push(bytes);
    binOffset += bytes.byteLength;
    json.bufferViews.push({ buffer: 0, byteOffset: offset, byteLength: bytes.byteLength });
    return json.bufferViews.length - 1;
  };

  for (const e of entries) {
    const pos = e.geometry.getAttribute('position');
    const nor = e.geometry.getAttribute('normal')
      ?? (e.geometry.computeVertexNormals(), e.geometry.getAttribute('normal'));
    const uv = e.geometry.getAttribute('uv');
    const idx = e.geometry.getIndex();

    const attributes = {};

    // POSITION min/max (الزامی spec)
    const arr = pos.array;
    const min = [Infinity, Infinity, Infinity];
    const max = [-Infinity, -Infinity, -Infinity];
    for (let i = 0; i < pos.count; i++) {
      for (let k = 0; k < 3; k++) {
        const v = arr[i * 3 + k];
        if (v < min[k]) min[k] = v;
        if (v > max[k]) max[k] = v;
      }
    }

    const push = (typedArray, componentType, type, accExtra) => {
      const vi = pushView(typedArray);
      const count = type === 'SCALAR' ? typedArray.length : typedArray.length / (type === 'VEC3' ? 3 : 2);
      json.accessors.push({ bufferView: vi, componentType, count, type, ...accExtra });
      return json.accessors.length - 1;
    };

    if (nor) attributes.NORMAL = push(nor.array, 5126, 'VEC3');
    if (uv) attributes.TEXCOORD_0 = push(uv.array, 5126, 'VEC2');
    if (e.color) {
      const colors = new Float32Array(pos.count * 3);
      for (let i = 0; i < pos.count; i++) {
        colors[i * 3] = e.color[0];
        colors[i * 3 + 1] = e.color[1];
        colors[i * 3 + 2] = e.color[2];
      }
      attributes.COLOR_0 = push(colors, 5126, 'VEC3');
    }
    attributes.POSITION = push(arr, 5126, 'VEC3', { min, max });

    const primitive = { attributes, material: e.material, mode: 4 };
    if (idx) {
      primitive.indices = push(new Uint32Array(idx.array), 5125, 'SCALAR');
    }

    json.meshes.push({ name: e.name, primitives: [primitive] });
    // node با ترنسلیشن اختیاری (مثلاً چرخ‌ها: هندسه در مبدأ، جای چرخ روی node)
    const node = { name: e.name, mesh: json.meshes.length - 1 };
    if (e.translation) node.translation = e.translation;
    json.nodes.push(node);
    json.scenes[0].nodes.push(json.nodes.length - 1);
  }

  json.buffers.push({ byteLength: binOffset });

  // ---------- باینری نهایی ----------
  const binTotal = bins.reduce((s, b) => s + b.byteLength, 0);
  const binBuf = new Uint8Array(binTotal);
  let off = 0;
  for (const b of bins) { binBuf.set(b, off); off += b.byteLength; }

  let jsonStr = JSON.stringify(json);
  const jsonPad = align4(jsonStr.length) - jsonStr.length;
  jsonStr = jsonStr + ' '.repeat(jsonPad);
  const jsonBytes = new TextEncoder().encode(jsonStr);

  const binPad = align4(binTotal) - binTotal;
  const binPadded = new Uint8Array(binTotal + binPad);
  binPadded.set(binBuf);

  const total = 12 + 8 + jsonBytes.length + 8 + binPadded.length;
  const out = new ArrayBuffer(total);
  const dv = new DataView(out);
  let o = 0;
  dv.setUint32(o, MAGIC, true); o += 4;
  dv.setUint32(o, 2, true); o += 4;
  dv.setUint32(o, total, true); o += 4;
  dv.setUint32(o, jsonBytes.length, true); o += 4;
  dv.setUint32(o, JSON_CHUNK, true); o += 4;
  new Uint8Array(out, o, jsonBytes.length).set(jsonBytes); o += jsonBytes.length;
  dv.setUint32(o, binPadded.length, true); o += 4;
  dv.setUint32(o, BIN_CHUNK, true); o += 4;
  new Uint8Array(out, o, binPadded.length).set(binPadded);

  return out;
}

/** ذخیره GLB روی دیسک (Node) */
export async function writeGLB(filePath, entries, materials) {
  const { writeFile, mkdir } = await import('node:fs/promises');
  const { dirname } = await import('node:path');
  await mkdir(dirname(filePath), { recursive: true });
  const buf = buildGLB(entries, materials);
  await writeFile(filePath, Buffer.from(buf));
  let tris = 0;
  for (const e of entries) {
    const idx = e.geometry.getIndex();
    tris += (idx ? idx.count : e.geometry.getAttribute('position').count) / 3;
  }
  return { file: filePath, kb: Math.round(buf.byteLength / 1024), tris: Math.round(tris), meshes: entries.length };
}
