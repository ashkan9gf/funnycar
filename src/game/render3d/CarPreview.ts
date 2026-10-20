/**
 * CarPreview.ts — رندر تک‌فریمی خودرو برای بازار عمو نقی (v0.2.38)
 * ============================================================
 * یک WebGLRenderer کوچک مشترک (بدون ساخت کانتکست تکراری) + کش dataURL
 * به کلید «واریانت|رنگ». اگر WebGL نبود → null (UI کارت رنگی جایگزین نشان می‌دهد).
 *
 * نکته‌ها:
 *  - buildCar3D خودش ensureShared() دارد → بدون وابستگی به WorldRenderer صدا می‌خورد.
 *  - رندر یک‌باره است؛ هیچ حلقه/RAF ای نداریم (صفر بار اضافه روی منو).
 *  - dispose فقط در قطع کامل؛ به‌اشتراک‌گذاری هندسه‌ها دست نمی‌زنیم.
 *  - 🔑 v0.2.42: خودرو بعد از هر ضبط «همیشه» از صحنه برداشته می‌شود (finally) —
 *    اگر یک ضبط شکست بخورد و ماشینی روی صحنه بماند، همهٔ پیش‌نمایش‌های بعدی
 *    با همان ماشین دوبله ضبط می‌شوند (باگ «همه کارت‌ها پلیسی شدند»!)
 */

import * as THREE from 'three';
import { buildCar3D, type CarVariant } from './CarFactory3D';
import { GlbLibrary, assembleCarFromGLB, pickBodyColor } from './GlbModels';

const PREVIEW_W = 384;
const PREVIEW_H = 232;

let sharedRenderer: THREE.WebGLRenderer | null = null;
let sharedScene: THREE.Scene | null = null;
let sharedCamera: THREE.PerspectiveCamera | null = null;
/** گروه فعلی سوار روی صحنه — قبل از رندر بعدی برداشته می‌شود */
let currentCar: THREE.Group | null = null;
const previewCache = new Map<string, string>();

function ensurePreviewStage(): boolean {
  if (sharedRenderer && sharedScene && sharedCamera) return true;
  try {
    const canvas = document.createElement('canvas');
    canvas.width = PREVIEW_W;
    canvas.height = PREVIEW_H;
    const renderer = new THREE.WebGLRenderer({
      canvas,
      alpha: true,
      antialias: true,
      preserveDrawingBuffer: true,
    });
    renderer.setSize(PREVIEW_W, PREVIEW_H, false);
    renderer.setPixelRatio(1);

    const scene = new THREE.Scene();
    const hemi = new THREE.HemisphereLight('#ffffff', '#7a6a55', 1.15);
    scene.add(hemi);
    const dir = new THREE.DirectionalLight('#fff6e0', 1.5);
    dir.position.set(180, 260, 160);
    scene.add(dir);
    const rim = new THREE.DirectionalLight('#c8d8ff', 0.7);
    rim.position.set(-160, 120, -180);
    scene.add(rim);

    const camera = new THREE.PerspectiveCamera(36, PREVIEW_W / PREVIEW_H, 10, 2000);
    camera.position.set(200, 130, 235);
    camera.lookAt(0, 26, 0);

    sharedRenderer = renderer;
    sharedScene = scene;
    sharedCamera = camera;
    return true;
  } catch {
    sharedRenderer = null;
    sharedScene = null;
    sharedCamera = null;
    return false;
  }
}

/** ضبط یک فریم از صحنه با تضمین پاک‌سازی خودرو — ضد «ماشین زامبی» روی صحنه */
function captureCar(build: () => THREE.Group | null): string | null {
  if (!sharedRenderer || !sharedScene || !sharedCamera) return null;
  if (currentCar) {
    sharedScene.remove(currentCar);
    currentCar = null;
  }
  const group = build();
  if (!group) return null;
  sharedScene.add(group);
  let url: string | null = null;
  try {
    sharedRenderer.render(sharedScene, sharedCamera);
    url = sharedRenderer.domElement.toDataURL('image/png');
  } finally {
    sharedScene.remove(group);
  }
  return url;
}

/** تصویر PNG (dataURL) خودروی واریانت مشخص با رنگ مشخص — کش‌شده. null = بدون WebGL */
export function renderCarPreview(variant: CarVariant, paintHex: string | null): string | null {
  const key = `${variant}|${paintHex ?? 'default'}`;
  const cached = previewCache.get(key);
  if (cached) return cached;
  if (!ensurePreviewStage()) return null;

  try {
    const url = captureCar(() => {
      const model = buildCar3D(variant, 112, 196, paintHex ? { paint: paintHex } : {});
      if (!model) return null;
      model.group.rotation.y = -0.62; // نمای سه‌رخ — جلو به سمت بیننده
      return model.group;
    });
    if (!url) return null;
    previewCache.set(key, url);
    return url;
  } catch {
    return null;
  }
}

// ==================== 🔑 v0.2.41 — پیش‌نمایش با «مدل واقعی» (GLB) ====================
// درخواست کاربر: «الگوی خودروهایی که زدی باید از مدل‌هایی که داریم باشه»
// و «ماشین‌هایی که مدل دارن با بدنه رنگی متفاوت» — رنگ روی همان مدل واقعی اعمال می‌شود.
// مسیر همگام (procedural) تصویر فوری می‌دهد؛ مسیر GLB هر بار که مدل رسید جایگزین می‌شود.

let previewGlb: GlbLibrary | null = null;
const glbPreviewJobs = new Map<string, Promise<string | null>>();

export function renderCarPreviewAsync(variant: CarVariant, paintHex: string | null): Promise<string | null> {
  const key = `${variant}|${paintHex ?? 'default'}|glb`;
  const cached = previewCache.get(key);
  if (cached) return Promise.resolve(cached);
  const running = glbPreviewJobs.get(key);
  if (running) return running;
  const job = (async (): Promise<string | null> => {
    try {
      if (!previewGlb) previewGlb = new GlbLibrary('/assets/models');
      const scene = await previewGlb.loadCar(variant, false);
      if (!scene || !ensurePreviewStage()) return null;
      const url = captureCar(() => {
        const model = assembleCarFromGLB(variant, scene, {
          external: true,
          bodyColor: paintHex ?? pickBodyColor(variant),
        });
        if (!model) return null;
        model.group.rotation.y = -0.62;
        return model.group;
      });
      if (!url) return null;
      previewCache.set(key, url);
      return url;
    } catch {
      return null;
    } finally {
      glbPreviewJobs.delete(key);
    }
  })();
  glbPreviewJobs.set(key, job);
  return job;
}
