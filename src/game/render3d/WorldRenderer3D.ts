/**
 * WorldRenderer3D.ts — رندر سه‌بعدی «تهران بزرگ» v3 (فاز BIG-IR)
 * ============================================================
 * منطق بازی دوبعدی می‌ماند؛ این کلاس فقط «نمایش» است:
 *  - نقشه بزرگ ۸۹۶۰px با جاده‌های دوطرفه ۵۶۰px (۷×۷)
 *  - لندمارک‌ها: برج آزادی + برج میلاد (از همه‌جا پیداست)
 *  - عابرهای پیاده کارتونی با انیمیشن راه رفتن + پرش ترس
 *  - شکستنی‌ها: با برخورد مخفی می‌شوند (منطق در GameManager) + ذرات
 *  - آسیب ماشین: تیره‌شدن بدنه + جدا شدن سپر + دود
 *  - چراغ‌گردان پلیس فلاش می‌زند — مینی‌مپ GTA با لندمارک‌ها
 */

import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import type { AssetManager } from '../core/AssetManager';
import type { Camera } from '../core/Camera';
import type { Vehicle } from '../entities/Vehicle';
import type { TrafficCar } from '../entities/TrafficCar';
import type { World, WorldProp } from '../world/World';
import type { EventCat, EventCone } from '../managers/RandomEventManager';
import type { Pothole } from '../managers/MissionManager';
import type { Pedestrian } from '../managers/PedestrianManager';
import { faNum } from '../managers/MissionManager';
import { RENDER3D, MISSIONS as M, RANDOM_EVENTS as RE, PEDESTRIANS as PEDS, DEBRIS, TRAFFIC_LIGHTS } from '../data/balance';
import { WORLD as WR, WORLD_SIZE, roadCenter } from '../world/World';
import { buildCar3D, variantFromAssetId, applyDamageVisual, detachBumper, spinWheels, steerWheels, type CarModel3D, type CarVariant } from './CarFactory3D';
import { GlbLibrary, assembleCarFromGLB, decorateWheelSpin } from './GlbModels';

/** واریانت‌های با مدل خارجی کاربر — متریال GLB حفظ می‌شود (بدون پره مصنوعی) */
const EXTERNAL_MODELS = new Set<string>(['samand', 'peugeot405', 'police', 'taxi']);
import type { GuardCar } from '../managers/MissionManager';
import { buildParkedGeometry, type VehicleVariant } from './vehicleGeometry';
import type { TrafficLights } from '../world/TrafficLights';
import {
  buildRooftopCluster, buildStreetSign, buildBusStop, buildVendorCart,
  buildMotorcycle, buildTrashBags, buildBillboard, buildSpeedBump,
  buildAzadiTower, buildMiladTower, buildCrate,
  buildFountain, buildBench, buildFlowers, buildBanner,
} from './StreetProps3D';
import {
  getRoadStraightTexture, getSidewalkTexture, getGrassTexture, getFacadeTextures,
  getCrossroadTexture, getSkyTexture, getSkyDomeTexture, getCloudTexture, getAwningTexture,
  getBillboardTexture,
} from './textures3d';

// ---------- فاز CITY-FULL — پالت اشباع ایرانی برای نماها (رنگی‌تر!) ----------
const BUILDING_TINTS = [
  '#f5edda', // کرم روشن
  '#e8b06a', // شنی گرم اشباع
  '#7ac4c2', // فیروزه‌ای
  '#7aaee0', // آبی کاشی
  '#e8897a', // گلبهی
  '#a3d477', // پسته‌ای
  '#e8c93e', // زعفرانی
  '#d984b8', // صورتی شیرازی
  '#a08cd8', // بنفش
  '#e07850', // نارنجی آجری
  '#74cfae', // سبز روشن
  '#d9b088', // بژ گرم
];

// ---------- انواع ورودی ----------
export interface Draw3DOptions {
  car: Vehicle;
  traffic: TrafficCar[];
  cat: EventCat | null;
  cones: EventCone[];
  potholes: Pothole[];
  peds: Pedestrian[];
  target: { x: number; y: number } | null;
  /** فاز ۵: ماشین‌های نگهبان جای پارک دوبل (فقط مأموریت فعال) */
  guardCars?: GuardCar[];
  /** حباب بازیکن (اگر جمله فعال دارد) */
  playerBubble: { line: string; x: number; y: number; portrait: string } | null;
  // ---------- فاز GRAPHICS_OVERHAUL ----------
  /** پدال ترمز بازیکن (چراغ ترمز + پیک بدنه) */
  braking?: boolean;
  /** گاز (پیک بدنه) */
  accelerating?: boolean;
  /** فرمان -1..1 (فرمان بصری چرخ‌های جلو) */
  steer?: number;
  /** نمایش اطلاعات دیباگ (کلید F) */
  debug?: boolean;
  fps?: number;
}

interface AmbientBubble { text: string; x: number; y: number; portraitId?: string; ttl: number; maxTtl: number }
/** 'rgba(...)' یا '#hex' → رنگ + آلفا */
function parseColor(c: string): { color: THREE.Color; alpha: number } {
  const m = /rgba?\(([^)]+)\)/.exec(c);
  if (m) {
    const p = m[1].split(',').map((s) => parseFloat(s.trim()));
    return { color: new THREE.Color(p[0] / 255, p[1] / 255, p[2] / 255), alpha: p[3] ?? 1 };
  }
  return { color: new THREE.Color(c), alpha: 1 };
}

const SKID_LIFE = 3.4;

interface Particle3D {
  x: number; z: number; y: number; vx: number; vz: number; vy: number;
  life: number; maxLife: number; size: number; active: boolean; color: THREE.Color;
  /** لاشه: با جهش و چرخش روی زمین می‌ماند (فاز OVERHAUL) */
  debris?: boolean;
  spin?: number; spinRate?: number; rested?: boolean;
}

/**
 * دی‌کوانتیزه کردن اتریبیوت‌ها به Float32 — mergeGeometries نوع یکسان می‌خواهد؛ NaN → null
 *
 * 🔑 فیکس ریشه‌ای «خطای NaN کنسول» (فاز PARKED-NAN):
 * GLBهای peugeot405/samand اتریبیوت INTERLEAVED دارند — position داخل بافر مشترک با
 * normal/uv (stride=۸ المنت) قرار دارد. کد قبلی `pos.array` می‌خواند = کل بافر اینترلیو
 * (شامل normal/uv همسایه!) → BufferAttribute(f, 3) با طول غلط → count غیرصحیح (۱۰۹۳٫۳)
 * → خواندن خارج از محدوده در computeBoundingBox → NaN → خطای کنسول + حذف ۸۰٪ مش‌های
 * پارکی از merge (ماشین‌های پارکی نامرئی!).
 *
 * راه‌حل: خواندن per-vertex با getComponent (اینترلیو-امن + دینرمالایز-امن) و ساخت
 * هندسه‌ی «جدید» — هندسه‌ی منبع دست‌نخورده می‌ماند (کش GlbLibrary سالم می‌ماند).
 */
function dequantizeGeoNew(src: THREE.BufferGeometry): THREE.BufferGeometry | null {
  const pos = src.getAttribute('position') as THREE.BufferAttribute | undefined;
  if (!pos || pos.count === 0) return null;
  const count = pos.count;
  const out = new THREE.BufferGeometry();
  for (const name of Object.keys(src.attributes)) {
    const attr = src.getAttribute(name) as THREE.BufferAttribute;
    if (!attr || attr.count !== count) return null; // اتریبیوت ناهم‌راستا — مش معیوب
    const isz = attr.itemSize;
    const f = new Float32Array(count * isz);
    for (let i = 0; i < count; i++) {
      for (let c = 0; c < isz; c++) {
        const v = attr.getComponent(i, c); // اینترلیو + normalized را خودش حل می‌کند
        if (!Number.isFinite(v)) return null; // هندسه معیوب مدل — رد
        f[i * isz + c] = v;
      }
    }
    out.setAttribute(name, new THREE.BufferAttribute(f, isz));
  }
  const idx = src.getIndex();
  if (idx) {
    // 🔑 index هم یکدست Uint32 می‌شود — mergeGeometries تایپ‌های قاطی (Uint16/Uint32)
    // را نمی‌پذیرد (خطای کنسول «merge the uv/index attribute»)
    const i32 = new Uint32Array(idx.count);
    const srcIdx = idx.array as ArrayLike<number>;
    for (let i = 0; i < idx.count; i++) i32[i] = srcIdx[i];
    out.setIndex(new THREE.BufferAttribute(i32, 1));
  }
  return out;
}

export class WorldRenderer3D {
  private r3: THREE.WebGLRenderer;
  private scene = new THREE.Scene();
  private cam3: THREE.PerspectiveCamera;
  private sun: THREE.DirectionalLight;
  private octx: CanvasRenderingContext2D;

  // افکت‌ها
  private particles: Particle3D[] = [];
  private particleMesh: THREE.InstancedMesh;
  private skidMesh: THREE.InstancedMesh;
  private skidIdx = 0;
  private skidData: Array<{ x: number; z: number; rot: number; life: number }> = [];
  private bubbles: AmbientBubble[] = [];

  // پویاها
  private playerModel: CarModel3D;
  private trafficModels = new Map<TrafficCar, CarModel3D>();
  private coinMesh: THREE.InstancedMesh;
  private coinSeeds: number[] = [];
  private conePool: THREE.Mesh[] = [];
  private catGroup: THREE.Group;
  private potholeMeshes: THREE.Mesh[] = [];
  private beacon: THREE.Group;
  private beaconRing: THREE.Mesh;
  private beaconDisc: THREE.Mesh;
  private beaconArrow: THREE.Mesh;
  /** فاز ۵: مدل‌های ماشین نگهبان پارک (cache برای مأموریت فعال) */
  private guardModels: CarModel3D[] = [];

  // عابرهای پیاده + شکستنی‌ها + زون تعمیر
  private pedModels: Array<{ g: THREE.Group; legL: THREE.Mesh; legR: THREE.Mesh; armL: THREE.Mesh; armR: THREE.Mesh }> = [];
  private propGroups = new Map<WorldProp, THREE.Group>();
  private repairRings: THREE.Group[] = [];

  // ---------- فاز GRAPHICS_OVERHAUL ----------
  /** کتابخانه GLB (خودرو/ساختمان) — fallback: procedural */
  private glb = new GlbLibrary();
  /** صحنه‌های GLB آماده‌شده (واریانت → گروه) */
  private glbCars = new Map<string, THREE.Group>();
  private glbCars1 = new Map<string, THREE.Group>();
  /** نمونه‌های دوبله‌پارکی: هر (kind، رنگ) یک InstancedMesh */
  private parkedInstanced: THREE.Object3D[] = [];
  /** فاز FPS-1: شهرک‌های اسکایلاین — برای culling فاصله‌ای هر فریم */
  private skylineTowns: THREE.Object3D[] = [];
  /** فاز FPS-1: merge گروهی — متریال مشترک vertexColors (ساختمان/پشت‌بام/شهرک) */
  private vcMergeMat: THREE.MeshLambertMaterial | null = null;
  /** نگاشت شکستنی‌ها به نمونه (prop → instanced mesh + شماره نمونه) */
  private breakableInst = new Map<WorldProp, { mesh: THREE.InstancedMesh; idx: number }>();
  /** وضعیت رندر قبلی شکستنی‌ها (فقط تغییرها sync شوند) */
  private breakableDirty = true;
  /** نمونه‌سازی درخت‌ها و پراپ‌های کوچک */
  private propInstanced = new Map<string, THREE.InstancedMesh>();
  /** چراغ راهنما: تیرها + ۳ لامپ Instanced (قرمز/زرد/سبز) */
  private lightPoleMesh: THREE.InstancedMesh | null = null;
  private lightLamps: THREE.InstancedMesh[] = [];
  private lightStateCache: Uint8Array | null = null;
  /** فاصله سوییچ LOD خودرو */
  private lodDist = 1500;
  /** نرمال‌سازی فرمان/ترمز/رول بازیکن */
  private steerVis = 0;
  private pitchVis = 0;
  private rollVis = 0;

  // دوربین
  private camAngle = 0;
  private lastDrawMs = 0;
  private dpr = 1;
  private overlayW = 1;
  private overlayH = 1;
  /** FOV پایه (با extraFov صفحه باریک) — فاز OVERHAUL برای FOV سرعتی */
  private fovBase: number = RENDER3D.fov;

  // ابزار موقت (بدون new در فریم)
  private tmpM = new THREE.Matrix4();
  private tmpQ = new THREE.Quaternion();
  private tmpV = new THREE.Vector3();
  private tmpS = new THREE.Vector3(1, 1, 1);
  private tmpP = new THREE.Vector3();
  private projV = new THREE.Vector3();
  private eul = new THREE.Euler();
  private tmpC = new THREE.Color();
  private asphaltC = new THREE.Color('#5c5c60');
  private darkC = new THREE.Color('#1a1512');

  constructor(
    glCanvas: HTMLCanvasElement,
    gl: WebGL2RenderingContext | WebGLRenderingContext,
    private overlay: HTMLCanvasElement,
    private assets: AssetManager,
    private world: World,
    private camera: Camera,
    /** چراغ‌های تقاطع (فاز OVERHAUL) — برای رندر لامپ‌ها */
    private lights: TrafficLights,
  ) {
    this.r3 = new THREE.WebGLRenderer({ canvas: glCanvas, context: gl as WebGL2RenderingContext, antialias: true });
    this.r3.shadowMap.enabled = true;
    // PCFSoftShadowMap در three r186 حذف شده — PCF استاندارد
    this.r3.shadowMap.type = THREE.PCFShadowMap;
    // فاز OVERHAUL: مدیریت رنگ صریح (خروجی sRGB)
    this.r3.outputColorSpace = THREE.SRGBColorSpace;

    const octx = overlay.getContext('2d');
    if (!octx) throw new Error('Overlay 2D not supported');
    this.octx = octx;

    // ---------- فاز CINEMATIC: گنبد آسمان + مه گرم غبار افق تهران ----------
    this.scene.fog = new THREE.Fog('#e6dcc4', 1300, RENDER3D.fogFar);
    this.buildSkyDome();
    this.buildClouds();

    this.cam3 = new THREE.PerspectiveCamera(RENDER3D.fov, 1, 10, 5200);
    this.cam3.position.set(0, RENDER3D.camHeight, 0);

    // تون‌مپینگ سینمایی سبک GTA (رنگ‌ها غنی‌تر)
    this.r3.toneMapping = THREE.ACESFilmicToneMapping;
    this.r3.toneMappingExposure = 1.14;

    // نور: خورشید طلایی با سایه‌های بلند + آسمان روشن
    const hemi = new THREE.HemisphereLight('#eaf2f8', '#c9a97a', RENDER3D.hemiIntensity);
    this.scene.add(hemi);
    this.sun = new THREE.DirectionalLight('#ffdfb0', RENDER3D.sunIntensity);
    this.sun.castShadow = true;
    this.sun.shadow.mapSize.set(1024, 1024);
    // فاز FPS-1: محدوده سایه تنگ‌تر (±۸۲۰ → ±۶۲۰) — رندر سایه ~۲ برابر سبک‌تر
    // و کیفیت سایه نزدیک ماشین بهتر؛ دوردست در مه گم است و سایه‌اش دیده نمی‌شود
    this.sun.shadow.camera.left = -620;
    this.sun.shadow.camera.right = 620;
    this.sun.shadow.camera.top = 620;
    this.sun.shadow.camera.bottom = -620;
    this.sun.shadow.camera.near = 100;
    this.sun.shadow.camera.far = 2600;
    this.sun.shadow.bias = -0.0006;
    this.scene.add(this.sun, this.sun.target);

    // دنیا
    this.buildStaticWorld();

    // ---------- فاز OVERHAUL: پیش‌بارگذاری GLB خودروها (fallback: procedural) ----------
    this.preloadCars();
    // ---------- چراغ‌های راهنما ----------
    this.buildTrafficLights();

    // ماشین بازیکن (ابعاد منطقی پیش‌فرض؛ نسبت 4:7 مثل Asset) — رنگ گاراژ (فاز ۶)
    const pw = 112;
    this.playerModel = buildCar3D('player', pw, Math.round(pw * 1.75), { paint: this.playerPaint });
    this.scene.add(this.playerModel.group);

    // سکه‌ها
    const coinGeo = new THREE.CylinderGeometry(17, 17, 6, 18);
    coinGeo.rotateX(Math.PI / 2);
    const coinMat = new THREE.MeshLambertMaterial({ color: '#F2B705', emissive: '#5c4200' });
    this.coinMesh = new THREE.InstancedMesh(coinGeo, coinMat, Math.max(1, this.world.coins.length));
    this.coinMesh.count = this.world.coins.length;
    this.scene.add(this.coinMesh);
    this.coinSeeds = this.world.coins.map((c) => c.seed);

    // Pool مخروط‌های رویداد
    const coneGeo = new THREE.ConeGeometry(22, 52, 10);
    for (let i = 0; i < RE.coneCount + 2; i++) {
      const m = new THREE.Mesh(coneGeo, new THREE.MeshLambertMaterial({ color: '#F4A261', transparent: true }));
      m.position.y = 26;
      m.visible = false;
      m.castShadow = true;
      this.conePool.push(m);
      this.scene.add(m);
    }

    // گربه
    this.catGroup = this.buildCat();
    this.catGroup.visible = false;
    this.scene.add(this.catGroup);

    // رد لاستیک (Instanced)
    const skidGeo = new THREE.PlaneGeometry(1, 1);
    skidGeo.rotateX(-Math.PI / 2);
    this.skidMesh = new THREE.InstancedMesh(
      skidGeo,
      new THREE.MeshBasicMaterial({ transparent: true, opacity: 0.55, depthWrite: false }),
      RENDER3D.skidMax,
    );
    this.skidMesh.count = 0;
    this.skidMesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    this.skidMesh.renderOrder = 2;
    this.scene.add(this.skidMesh);
    for (let i = 0; i < RENDER3D.skidMax; i++) this.skidData.push({ x: 0, z: 0, rot: 0, life: 0 });

    // ذرات (Instanced)
    this.particleMesh = new THREE.InstancedMesh(
      new THREE.BoxGeometry(1, 1, 1),
      new THREE.MeshBasicMaterial(),
      RENDER3D.particleMax,
    );
    this.particleMesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    this.particleMesh.count = 0;
    this.particleMesh.instanceColor = new THREE.InstancedBufferAttribute(new Float32Array(RENDER3D.particleMax * 3).fill(1), 3);
    this.scene.add(this.particleMesh);

    // نشانگر مأموریت
    const ringGeo = new THREE.TorusGeometry(M.reachRadius * 0.92, 6, 8, 48);
    ringGeo.rotateX(Math.PI / 2);
    this.beaconRing = new THREE.Mesh(ringGeo, new THREE.MeshBasicMaterial({ color: '#F2B705' }));
    this.beaconRing.position.y = 6;
    const discGeo = new THREE.CircleGeometry(M.reachRadius, 40);
    discGeo.rotateX(-Math.PI / 2);
    this.beaconDisc = new THREE.Mesh(discGeo, new THREE.MeshBasicMaterial({ color: '#F2B705', transparent: true, opacity: 0.16, depthWrite: false }));
    this.beaconDisc.position.y = 4;
    this.beaconArrow = new THREE.Mesh(
      new THREE.ConeGeometry(26, 58, 4),
      new THREE.MeshBasicMaterial({ color: '#F2B705' }),
    );
    this.beaconArrow.rotation.x = Math.PI; // نوک به پایین
    this.beacon = new THREE.Group();
    this.beacon.add(this.beaconDisc, this.beaconRing, this.beaconArrow);
    this.beacon.visible = false;
    this.scene.add(this.beacon);
  }

  // ============ دنیای ثابت ============
  private buildStaticWorld(): void {
    const S = WORLD_SIZE;

    // زمین پایه (شن)
    const base = new THREE.Mesh(
      new THREE.PlaneGeometry(S + 2600, S + 2600),
      new THREE.MeshLambertMaterial({ color: '#C9B98A' }),
    );
    base.rotation.x = -Math.PI / 2;
    base.position.set(S / 2, 0, S / 2);
    base.receiveShadow = true;
    this.scene.add(base);

    // ---------- جاده‌های دوطرفه پهن — MERGE به ۲ مش (فاز OVERHAUL: کاهش Draw Call) ----------
    const roadTex = getRoadStraightTexture();
    roadTex.repeat.set(1, S / 560);
    roadTex.wrapT = THREE.RepeatWrapping;
    roadTex.colorSpace = THREE.SRGBColorSpace;
    const roadMat = new THREE.MeshLambertMaterial({ map: roadTex });
    const roadGeo = new THREE.PlaneGeometry(WR.roadW, S);
    roadGeo.rotateX(-Math.PI / 2);
    const nRoads = WR.roadCount + 1;
    const roadPartsV: THREE.BufferGeometry[] = [];
    const roadPartsH: THREE.BufferGeometry[] = [];
    for (let i = 0; i < nRoads; i++) {
      const cx = roadCenter(i);
      const gv = roadGeo.clone();
      gv.translate(cx, 1, S / 2);
      roadPartsV.push(gv);
      const gh = roadGeo.clone();
      gh.rotateY(Math.PI / 2);
      gh.translate(S / 2, 1, cx);
      roadPartsH.push(gh);
    }
    const roadsMerged = mergeGeometries([...roadPartsV, ...roadPartsH], false);
    if (roadsMerged) {
      const m = new THREE.Mesh(roadsMerged, roadMat);
      m.receiveShadow = true;
      this.scene.add(m);
    }

    // تقاطع‌ها — MERGE به ۱ مش (زیبرا + خط توقف سبک ایران)
    const asMat = new THREE.MeshLambertMaterial({ map: getCrossroadTexture() });
    const crossGeo = new THREE.PlaneGeometry(WR.roadW, WR.roadW);
    crossGeo.rotateX(-Math.PI / 2);
    const crossParts: THREE.BufferGeometry[] = [];
    for (let i = 0; i < nRoads; i++) {
      for (let j = 0; j < nRoads; j++) {
        const g = crossGeo.clone();
        g.translate(roadCenter(i), 1.6, roadCenter(j));
        crossParts.push(g);
      }
    }
    const crossMerged = mergeGeometries(crossParts, false);
    if (crossMerged) {
      const m = new THREE.Mesh(crossMerged, asMat);
      m.receiveShadow = true;
      this.scene.add(m);
    }

    // ---------- بلوک‌ها: پیاده‌رو + مرکز — MERGE به ۳ مش ----------
    const swMat = new THREE.MeshLambertMaterial({ map: getSidewalkTexture() });
    const grassMat = new THREE.MeshLambertMaterial({ map: getGrassTexture() });
    const yardMat = new THREE.MeshLambertMaterial({ color: '#d4c49a' });
    const blockS = WR.pitch - WR.roadW; // 840
    const swGeo = new THREE.PlaneGeometry(blockS, blockS);
    swGeo.rotateX(-Math.PI / 2);
    const innerGeo = new THREE.PlaneGeometry(blockS - 200, blockS - 200);
    innerGeo.rotateX(-Math.PI / 2);
    const swParts: THREE.BufferGeometry[] = [];
    const grassParts: THREE.BufferGeometry[] = [];
    const yardParts: THREE.BufferGeometry[] = [];
    for (let i = 0; i < WR.roadCount; i++) {
      for (let j = 0; j < WR.roadCount; j++) {
        const bx = i * WR.pitch + WR.roadW;
        const by = j * WR.pitch + WR.roadW;
        const gs = swGeo.clone();
        gs.translate(bx + blockS / 2, 0.8, by + blockS / 2);
        swParts.push(gs);
        const gi = innerGeo.clone();
        gi.translate(bx + blockS / 2, 1.2, by + blockS / 2);
        if (i === 2 && j === 2 || i === 4 && j === 2) grassParts.push(gi);
        else yardParts.push(gi);
      }
    }
    const addMerged = (parts: THREE.BufferGeometry[], mat: THREE.Material): void => {
      const merged = mergeGeometries(parts, false);
      if (!merged) return;
      const m = new THREE.Mesh(merged, mat);
      m.receiveShadow = true;
      this.scene.add(m);
    };
    addMerged(swParts, swMat);
    addMerged(grassParts, grassMat);
    addMerged(yardParts, yardMat);

    // ساختمان‌ها و پراپ‌ها از داده World
    for (const p of this.world.props) {
      if (p.kind === 'building') this.buildBuilding(p);
    }
    // پراپ‌های کوچک: Instanced (درخت/سطل/مخروط/جعبه/تیر/موتور/کیسه)
    this.buildPropInstanced();
    // کیت شهری GLB (فاز CITY-KIT) — بعد از لود async ساخته می‌شود
    void this.buildCityKitProps();

    // دوبله‌پارکی‌ها (GLB واقعی هر خودرو) و سرعت‌گیرها (زندگی خیابانی ایران)
    this.buildParkedAsync();
    for (const sb of this.world.speedBumps) {
      const bump = buildSpeedBump(500);
      bump.position.set(sb.x, 0, sb.y);
      bump.rotation.y = sb.horiz ? Math.PI / 2 : 0;
      this.scene.add(bump);
    }

    // ---------- زون‌های تعمیرگاه: حلقه سبز پالس‌دار ----------
    for (const z of this.world.repairZones) {
      const ringG = new THREE.Group();
      const ring = new THREE.Mesh(
        new THREE.TorusGeometry(z.r * 0.9, 7, 8, 44).rotateX(Math.PI / 2),
        new THREE.MeshBasicMaterial({ color: '#2A9D8F', transparent: true, opacity: 0.75 }),
      );
      ring.position.y = 8;
      const disc = new THREE.Mesh(
        new THREE.CircleGeometry(z.r * 0.88, 36).rotateX(-Math.PI / 2),
        new THREE.MeshBasicMaterial({ color: '#2A9D8F', transparent: true, opacity: 0.12, depthWrite: false }),
      );
      disc.position.y = 5;
      ringG.add(ring, disc);
      ringG.position.set(z.x, 0, z.y);
      this.scene.add(ringG);
      this.repairRings.push(ringG);
    }

    // ---------- فاز OPEN-WORLD: دیوار شهر حذف شد — شهرک‌های اسکایلاین همه قابل ورود!
    // زمین بزرگ برای کل جهان + شهرک‌ها (شهرک تا ۵۱۰۰ بیرون مرز)
    const outer = S + 12000;
    const bigBase = new THREE.Mesh(
      new THREE.PlaneGeometry(outer, outer),
      new THREE.MeshLambertMaterial({ color: '#C9B98A' }),
    );
    bigBase.rotation.x = -Math.PI / 2;
    bigBase.position.set(S / 2, -0.2, S / 2);
    bigBase.receiveShadow = true;
    this.scene.add(bigBase);

    // ---------- اسکایلاین شهر (مدل شهر کاربر — ۶ شهرکِ قابل ورود دور دنیا) ----------
    void this.buildSkyline();
  }

  /** شهرک‌های دور: city_scene کاربر — ۶ کپی باکیفیت، همه قابل ورود با برخورد + جاده دسترسی + دروازه
   *  فاز FPS-1: هر شهرک = merge کل مش‌ها per (متریال × امضای اتریبیوت) → به‌جای ~۹۰ مش،
   *  فقط چند مش — Draw Call شهرک‌ها ~۹۰×۷=۶۳۰ → ~۲۵. کولایدرها از کلون کامل محاسبه می‌شوند. */
  private async buildSkyline(): Promise<void> {
    // همه شهرک‌ها با نسخه باکیفیت (درخواست کاربر: «مثل فایل اولی با کیفیت‌تر») — fallback: سبک
    const townScene = await this.glb.load('city/skyline_town.glb');
    const scene = townScene ?? await this.glb.load('city/skyline.glb');
    if (!scene) return;
    scene.traverse((o) => {
      const m = o as THREE.Mesh;
      if (m.isMesh) { m.castShadow = false; m.receiveShadow = false; }
    });
    // ---------- merge قالب per (متریال × امضای اتریبیوت) ----------
    scene.updateMatrixWorld(true);
    const byKey = new Map<string, { mat: THREE.Material; geos: THREE.BufferGeometry[] }>();
    scene.traverse((o) => {
      const m = o as THREE.Mesh;
      if (!m.isMesh) return;
      // 🔑 دی‌کوانتیز: همه اتریبیوت‌ها Float32 یکدست می‌شوند — هم NaN رد می‌شود
      // هم «array types mismatch» در mergeGeometries (خطای کنسول) ریشه‌کن می‌شود
      const g = dequantizeGeoNew(m.geometry);
      if (!g) return; // مش معیوب (NaN/اتریبوت ناهم‌راستا) → رد بی‌صدا
      g.applyMatrix4(m.matrixWorld);
      g.computeBoundingBox(); // هندسه تمیز — بدون warning
      const bb = g.boundingBox;
      if (!bb || !Number.isFinite(bb.min.x)) return; // مش معیوب → رد
      const mats = Array.isArray(m.material) ? m.material : [m.material];
      const mat = (mats[0] ?? this.vcToonMat()) as THREE.Material;
      const sig = Object.keys(g.attributes).sort().join(',') + (g.index ? '|i' : '|n');
      const key = `${mat.uuid}##${sig}`;
      const e = byKey.get(key);
      if (e) e.geos.push(g);
      else byKey.set(key, { mat, geos: [g] });
    });
    const template = new THREE.Group();
    template.name = 'skyline_merged';
    for (const { mat, geos } of byKey.values()) {
      const merged = mergeGeometries(geos, false);
      if (!merged) continue;
      merged.computeBoundingBox();
      merged.computeBoundingSphere();
      const mesh = new THREE.Mesh(merged, mat);
      mesh.castShadow = false;
      mesh.receiveShadow = false;
      template.add(mesh);
    }
    // اگر merge به هر دلیل ممکن نشد → مسیر قبلی (کلون کامل)
    const useMerged = template.children.length > 0;
    const S = WORLD_SIZE;
    const half = 2550; // عمق نرمال‌شده مدل (±۲۶۰۰)
    const edge = -(half + 60); // ۶۰ واحد بیرونِ لبه — هیچ‌گاه داخل نقشه نفوذ نمی‌کند
    // ۶ شهرک + نام دروازه هرکدام (فاز OPEN-WORLD — همه قابل ورود)
    // ⚠️ همه ورودی‌ها روی امتداد جاده‌های واقعی شهر — جاده دسترسی ادامه جاده است
    const placements: Array<[number, number, number, string]> = [
      [roadCenter(1), edge, 0, 'شهرک گلستان'], [roadCenter(4), edge, 0, 'شهرک نور'], // شمال
      [S - edge, roadCenter(3), -Math.PI / 2, 'شهرک غرب'],                            // شرق
      [roadCenter(4), S - edge, Math.PI, 'شهرک یاس'], [roadCenter(1), S - edge, Math.PI, 'شهرک بهار'], // جنوب
      [edge, roadCenter(4), Math.PI / 2, 'شهرک زیتون'], [edge, roadCenter(1), Math.PI / 2, 'شهرک الغدیر'], // غرب
    ];
    let idx = 0;
    for (const [x, z, ry, name] of placements) {
      // کولایدرها: از کلون کامل (مش‌های per-building) — منطق گرید سلولی دست‌نخورده
      const colliderProbe = useMerged ? scene.clone(true) : null;
      const g = useMerged ? template.clone(true) : scene.clone(true);
      g.position.set(x, 0, z);
      g.rotation.y = ry;
      this.scene.add(g);
      if (colliderProbe) {
        // پروب موقت فقط برای کولایدر — بعد از محاسبه دور انداخته می‌شود
        colliderProbe.position.set(x, 0, z);
        colliderProbe.rotation.y = ry;
        colliderProbe.updateMatrixWorld(true);
        this.addCityBuildingColliders(colliderProbe, S, x, z, ry);
      } else {
        // همه شهرک‌ها: برخورد ساختمان‌های بزرگ → شهرک واقعیِ قابل رانندگی
        g.updateMatrixWorld(true);
        this.addCityBuildingColliders(g, S, x, z, ry);
      }
      // جاده دسترسی + دروازه + بیلبورد نام
      this.buildAccessRoad(x, z, ry);
      this.buildGateArch(x, z, ry, name, idx === 2);
      this.skylineTowns.push(g);
      idx++;
    }
  }

  /** جاده دسترسی از لبه شهر تا شهرک — در امتداد ورودی شهرک */
  private buildAccessRoad(x: number, z: number, ry: number): void {
    const S = WORLD_SIZE;
    const accLen = 2600;
    const vertical = ry === 0 || ry === Math.PI; // شمال/جنوب: جاده در راستای Z
    const geo = new THREE.PlaneGeometry(WR.roadW, accLen);
    geo.rotateX(-Math.PI / 2);
    if (!vertical) geo.rotateY(Math.PI / 2);
    let rx: number, rz: number;
    if (ry === 0) { rx = x; rz = -accLen / 2 + 60; }
    else if (ry === Math.PI) { rx = x; rz = S + accLen / 2 - 60; }
    else if (ry === -Math.PI / 2) { rx = S + accLen / 2 - 60; rz = z; }
    else { rx = -accLen / 2 + 60; rz = z; }
    geo.translate(rx, 1.1, rz);
    const tex = getRoadStraightTexture().clone();
    tex.wrapT = THREE.RepeatWrapping;
    tex.repeat.set(1, accLen / 560);
    tex.needsUpdate = true;
    const road = new THREE.Mesh(geo, new THREE.MeshLambertMaterial({ map: tex }));
    road.receiveShadow = true;
    this.scene.add(road);
  }

  /** دروازه شهرک — دو پایه بلند + تیر تابلو + ستون نور دیدنی از دور (هر ۶ ورودی) */
  private buildGateArch(x: number, z: number, ry: number, name: string, _labeled: boolean): void {
    const g = new THREE.Group();
    const vertical = ry === 0 || ry === Math.PI; // ورود شمال/جنوب: پایه‌ها در راستای X
    // نقطه دروازه روی لبه شهر
    const ex = vertical ? x : (ry === -Math.PI / 2 ? WORLD_SIZE - 40 : 40);
    const ez = vertical ? (ry === 0 ? 40 : WORLD_SIZE - 40) : z;
    g.position.set(ex, 0, ez);
    const pylonMat = new THREE.MeshLambertMaterial({ color: '#2a7fb8' });
    const pylonGeo = new THREE.BoxGeometry(64, 560, 64);
    for (const d of [-470, 470]) {
      const p = new THREE.Mesh(pylonGeo, pylonMat);
      p.position.set(vertical ? d : 0, 280, vertical ? 0 : d);
      p.castShadow = true;
      g.add(p);
      const cap = new THREE.Mesh(new THREE.BoxGeometry(84, 46, 84), new THREE.MeshLambertMaterial({ color: '#F2B705' }));
      cap.position.set(vertical ? d : 0, 580, vertical ? 0 : d);
      g.add(cap);
    }
    // تیر بالا با تابلو — عمود بر جاده ورودی
    const beam = new THREE.Mesh(
      vertical ? new THREE.BoxGeometry(830, 130, 70) : new THREE.BoxGeometry(70, 130, 830),
      new THREE.MeshLambertMaterial({ color: '#fff6e3' }),
    );
    beam.position.set(0, 520, 0);
    beam.castShadow = true;
    g.add(beam);
    const signMat = new THREE.MeshBasicMaterial({
      map: getBillboardTexture(name, 'خوش آمدید!', '#2a7fb8'), side: THREE.DoubleSide,
    });
    const sign = new THREE.Mesh(new THREE.PlaneGeometry(700, 100), signMat);
    sign.position.set(0, 520, vertical ? -32 : -32);
    sign.rotation.y = vertical ? (ry === 0 ? 0 : Math.PI) : -Math.PI / 2;
    g.add(sign);
    const sign2 = sign.clone();
    sign2.position.set(0, 520, 32);
    sign2.rotation.y = (sign.rotation.y ?? 0) + Math.PI;
    g.add(sign2);
    // ستون نور طلایی — از دور دیده می‌شود (سینمایی) — سمت بیرون شهر
    const outX = vertical ? 0 : (ry === -Math.PI / 2 ? 100 : -100);
    const outZ = vertical ? (ry === 0 ? -100 : 100) : 0;
    const beamLight = new THREE.Mesh(
      new THREE.CylinderGeometry(55, 90, 1900, 12, 1, true),
      new THREE.MeshBasicMaterial({
        color: '#ffd98a', transparent: true, opacity: 0.16,
        blending: THREE.AdditiveBlending, side: THREE.DoubleSide, depthWrite: false,
      }),
    );
    beamLight.position.set(outX, 950, outZ);
    g.add(beamLight);
    this.scene.add(g);
  }

  /** برخورد ساختمان‌های شهرک — فاز OPEN-WORLD
   *  مدل شهرک meshهای «ادغام‌شده ناحیه‌ای» دارد (۲–۳ هزار واحدی!) — کولایدر per-mesh
   *  ممکن نیست. راه‌حل: گرید ۴۶۰تایی روی پلن مدل؛ هر سلول که مرکزش داخل bbox
   *  یکی از مش‌های ساختمانی است = کولایدر ۳۸۰×۳۸۰. راهرو ورودی (بلوار) آزاد می‌ماند. */
  private addCityBuildingColliders(district: THREE.Object3D, S: number, copyX: number, copyZ: number, ry: number): void {
    // ۱) bbox همه مش‌های ساختمانی مدل (بدون زمین/جاده/درخت ریز)
    const boxes: THREE.Box3[] = [];
    district.traverse((o) => {
      const m = o as THREE.Mesh;
      if (!m.isMesh) return;
      const box = new THREE.Box3().setFromObject(m);
      if (!Number.isFinite(box.min.x) || !Number.isFinite(box.max.x) || !Number.isFinite(box.max.y)) return;
      const size = box.getSize(new THREE.Vector3());
      const foot = Math.max(size.x, size.z);
      if (foot > 3600 || foot < 60 || size.y < 120) return; // زمین عظیم/ریزخردها حذف
      boxes.push(box);
    });
    if (boxes.length === 0) return;
    district.updateMatrixWorld(true);
    const gb = new THREE.Box3().setFromObject(district);
    if (!Number.isFinite(gb.min.x)) return;
    // ۲) راهرو ورودی: هم‌راستا با جاده دسترسی
    const vertical = ry === 0 || ry === Math.PI;
    const entryX = vertical ? copyX : (ry === -Math.PI / 2 ? S : 0);
    const entryZ = vertical ? (ry === 0 ? 0 : S) : copyZ;
    const corHalf = 560;
    // ۳) گرید سلول‌ها
    const CELL = 460;
    const COL = 380; // کولایدر کمی کوچک‌تر از سلول — کوچه‌های نفس‌دار
    const x0 = Math.ceil((gb.min.x + 60) / CELL) * CELL;
    const z0 = Math.ceil((gb.min.z + 60) / CELL) * CELL;
    let added = 0;
    for (let gx = x0; gx <= gb.max.x - 60; gx += CELL) {
      for (let gz = z0; gz <= gb.max.z - 60; gz += CELL) {
        if (added >= 90) return;
        // راهرو ورودی آزاد
        const perp = vertical ? Math.abs(gx - entryX) : Math.abs(gz - entryZ);
        if (perp < corHalf) continue;
        // فقط سلول‌هایی که توده ساختمان بخش عمده‌شان را پوشش می‌دهد
        let inside = false;
        for (const b of boxes) {
          if (gx + 150 > b.min.x + 40 && gx - 150 < b.max.x - 40 && gz + 150 > b.min.z + 40 && gz - 150 < b.max.z - 40) { inside = true; break; }
        }
        if (!inside) continue;
        this.world.colliders.push({ x: gx - COL / 2, y: gz - COL / 2, w: COL, h: COL });
        added++;
      }
    }
  }

  /** پیش‌بارگذاری GLB همه واریانت‌ها + تعویض بازیکن/ترافیک پس از آماده‌شدن */
  private preloadCars(): void {
    const variants: CarVariant[] = ['player', 'pride', 'peugeot405', 'samand', 'nissan', 'tiba', 'taxi', 'police'];
    for (const v of variants) {
      void this.glb.loadCar(v, false).then((scene) => {
        if (!scene) return;
        this.glbCars.set(v, scene);
        if (v === 'player') this.upgradePlayerToGLB();
        else this.upgradeTrafficToGLB(v);
      });
      void this.glb.loadCar(v, true).then((scene) => {
        if (scene) this.glbCars1.set(v, scene);
      });
    }
  }

  /** 🔑 فیکس «ماشین‌ها حالت قبلی»:
   *  ترافیکی که قبل از رسیدن GLB اسپاون شده، برای همیشه procedural می‌ماند.
   *  اینجا همه نمونه‌های موجود آن واریانت به مدل GLB ارتقا می‌یابند. */
  private upgradeTrafficToGLB(variant: CarVariant): void {
    for (const [car, old] of [...this.trafficModels]) {
      if (variantFromAssetId(car.assetId) !== variant) continue;
      const model = this.trafficModelFor(car);
      if (!model) continue;
      model.group.position.copy(old.group.position);
      model.group.rotation.copy(old.group.rotation);
      this.scene.remove(old.group);
      this.scene.add(model.group);
      this.trafficModels.set(car, model);
    }
  }

  /** تعویض مدل بازیکن به GLB (حفظ موقعیت/چرخش فعلی) */
  private upgradePlayerToGLB(): void {
    const scene = this.glbCars.get('player');
    if (!scene || !this.playerModel) return;
    const old = this.playerModel;
    const model = assembleCarFromGLB('player', scene, { bodyColor: old.bodyColor });
    const s = old.group.scale.x; // مقیاس قبلی حفظ شود
    model.group.scale.setScalar(s);
    model.group.position.copy(old.group.position);
    model.group.rotation.copy(old.group.rotation);
    this.scene.remove(old.group);
    this.scene.add(model.group);
    this.playerModel = model;
  }

  /** ترافیک GLB موجود؟ — مدل‌های خارجی کاربر از نسخه سبک lod1 (عملکرد — فیکس FPS) */
  private trafficModelFor(c: TrafficCar): CarModel3D | null {
    const variant = variantFromAssetId(c.assetId);
    const external = EXTERNAL_MODELS.has(variant);
    const scene = external
      ? (this.glbCars1.get(variant) ?? this.glbCars.get(variant))
      : this.glbCars.get(variant);
    if (!scene) return null;
    // مدل‌های خارجی کاربر: متریال PBR + پیوت هندسی چرخ (بدون پره مصنوعی)
    const model = assembleCarFromGLB(variant, scene, { external });
    // مقیاس مثل قبل: drawH / len
    model.group.scale.setScalar(c.drawH / model.len);
    // LOD1 به‌عنوان فرزند (فاصله‌سوییچ در draw3D) — فقط برای مدل‌های سبک داخلی
    const lod1 = external ? undefined : this.glbCars1.get(variant);
    if (lod1) {
      const lodGroup = lod1.clone(true);
      lodGroup.name = '__lod1';
      lodGroup.visible = false;
      model.group.add(lodGroup);
      (model as unknown as { lod1Group?: THREE.Group }).lod1Group = lodGroup;
      // چرخ‌های LOD هم وارد لیست چرخش شوند + پره بگیرند (فاز APK-FIX)
      lodGroup.traverse((o) => {
        const m = o as THREE.Mesh;
        if (m.isMesh && m.name.startsWith('wheel_')) {
          if (!external) decorateWheelSpin(m);
          model.wheels.push(m);
        }
      });
    }
    return model;
  }

  // ============ فاز OVERHAUL: InstancedMesh helpers ============

  /** merge قطعات رنگی به یک هندسه (Vertex-Color) — نرمال‌سازی non-indexed */
  private mergeColored(parts: Array<{ g: THREE.BufferGeometry; color: string }>): THREE.BufferGeometry {
    const geos = parts.map((p) => {
      const g = p.g.index ? p.g.toNonIndexed() : p.g;
      const c = new THREE.Color(p.color);
      const n = g.getAttribute('position').count;
      const arr = new Float32Array(n * 3);
      for (let i = 0; i < n; i++) { arr[i * 3] = c.r; arr[i * 3 + 1] = c.g; arr[i * 3 + 2] = c.b; }
      g.setAttribute('color', new THREE.BufferAttribute(arr, 3));
      if (!g.getAttribute('uv')) g.setAttribute('uv', new THREE.BufferAttribute(new Float32Array(n * 2), 2));
      return g;
    });
    const merged = mergeGeometries(geos, false);
    if (!merged) throw new Error('mergeColored failed');
    merged.clearGroups();
    return merged;
  }

  /** متریال تون با Vertex-Color (برای Instanced با instanceColor) */
  private vcToonMat(): THREE.MeshToonMaterial {
    // فاز CITY-FULL: پله تیره ملایم‌تر — سایه‌ی درخت‌ها/پراپ‌ها سیاه سوخته نمی‌شود
    const data = new Uint8Array([196, 196, 196, 255, 228, 228, 228, 255, 255, 255, 255, 255]);
    const grad = new THREE.DataTexture(data, 3, 1, THREE.RGBAFormat);
    grad.minFilter = THREE.NearestFilter;
    grad.magFilter = THREE.NearestFilter;
    grad.needsUpdate = true;
    return new THREE.MeshToonMaterial({ color: '#ffffff', vertexColors: true, gradientMap: grad });
  }

  /**
   * دوبله‌پارکی‌ها — از GLB واقعی هر خودرو (درخواست کاربر: «همه ماشین‌ها مدل سه‌بعدی»)
   * هر kind = چند مش merge‌شده (per material) → چند Draw Call برای ده‌ها ماشین
   * اگر GLB نرسید/شکست خورد → همان نسخه procedural قبلی
   */
  private buildParkedAsync(): void {
    const kinds: Array<{ kind: VehicleVariant; target: number }> = [
      { kind: 'pride', target: 188 },
      { kind: 'peugeot405', target: 196 },
      { kind: 'tiba', target: 168 },
      { kind: 'nissan', target: 200 },
      { kind: 'samand', target: 206 },
    ];
    void (async () => {
      for (const entry of kinds) {
        const cars = this.world.parkedCars.filter((pc) => pc.kind === entry.kind);
        if (cars.length === 0) continue;
        // 🔑 فیکس «توده‌های سیاه» (فاز CITY-FULL): lod1 واحدهای خام + نوداسکیل دارد و
        // در merge قطعه‌ای بهم می‌ریزد — حالا از GLB کامل (همیشه در کش و سالم) استفاده می‌کنیم
        let scene = await this.glb.loadCar(entry.kind, false);
        if (!scene) scene = await this.glb.loadCar(entry.kind, true);
        if (!scene) {
          this.buildParkedProceduralKind(entry.kind, cars);
          continue;
        }
        this.buildParkedGLBKind(entry.kind, entry.target, scene, cars);
      }
    })();
  }

  /** یک kind دوبله‌پارکی از GLB — merge به‌ازای (متریال × قطعه نقشه × امضای اتریبیوت) */
  private buildParkedGLBKind(
    kind: VehicleVariant,
    target: number,
    src: THREE.Group,
    cars: Array<{ x: number; y: number; angle: number }>,
  ): void {
    void kind;
    // 🔑 فیکس NaN (فاز PARKED-NAN-2): دی‌کوانتیز «قبل از» هر setFromObject/
    // computeBoundingBox انجام می‌شود تا هندسه NaN هرگز به three.js نرسد
    // (دیگر هیچ warning از computeBoundingBox/computeBoundingSphere صادر نمی‌شود)
    const tmpl = src.clone(true); // هندسه‌ها مشترک — فقط گره‌ها کپی می‌شوند
    const broken: THREE.Object3D[] = [];
    tmpl.traverse((o) => {
      const m = o as THREE.Mesh;
      if (!m.isMesh) return;
      const dq = dequantizeGeoNew(m.geometry);
      if (dq) m.geometry = dq;
      else broken.push(m); // مش معیوب (NaN/اتریبوت ناهم‌راستا) → حذف از قالب
    });
    for (const b of broken) b.parent?.remove(b);
    const box = new THREE.Box3().setFromObject(tmpl); // ← حالا تمیز و بدون NaN
    const size = box.getSize(new THREE.Vector3());
    // 🔒 اگر bbox منبع سالم نیست (GLB خراب/خالی) → همان نسخه procedural
    if (!Number.isFinite(box.min.x) || !Number.isFinite(box.min.y) || !Number.isFinite(size.x)) {
      this.buildParkedProceduralKind(kind, cars);
      return;
    }
    const rawLen = Math.max(size.x, size.z, 1);
    const s = target / rawLen;
    const CHUNK = 2240; // ۴×۴ قطعه در نقشه ۸۹۶۰ — هر قطعه فقط وقتی در دید است رندر می‌شود
    const chunkOf = (pc: { x: number; y: number }): string =>
      `${Math.floor(Math.min(Math.max(pc.x, 0), WORLD_SIZE + 2400) / CHUNK)}_${Math.floor(Math.min(Math.max(pc.y, 0), WORLD_SIZE - 1) / CHUNK)}`;
    // (قطعه × متریال × امضای اتریبیوت) → هندسه‌ها — mergeGeometries مجموعه اتریبیوت یکسان می‌خواهد
    const byKey = new Map<string, { mat: THREE.Material; geos: THREE.BufferGeometry[] }>();
    for (const pc of cars) {
      const ck = chunkOf(pc);
      const clone = tmpl.clone(true); // هندسه‌ها مشترک — فقط گره‌ها کپی می‌شوند
      clone.scale.setScalar(s);
      clone.position.set(pc.x, -box.min.y * s, pc.y);
      clone.rotation.y = -pc.angle;
      clone.updateMatrixWorld(true);
      clone.traverse((o) => {
        const m = o as THREE.Mesh;
        if (!m.isMesh) return;
        // 🔒 ماتریس جهانی نود باید سالم باشد — ماتریس NaN کل ورتکس‌ها را NaN می‌کند
        const me = m.matrixWorld.elements;
        let matOk = true;
        for (let i = 0; i < 16; i++) {
          if (!Number.isFinite(me[i])) { matOk = false; break; }
        }
        if (!matOk) return;
        // هندسه قالب تمیز است → کپی per-car فقط برای بیک‌کردن ترنسفورم
        const g = m.geometry.clone();
        g.applyMatrix4(m.matrixWorld);
        // 🔒 فیکس «توده‌های سیاه/آبی غول‌پیکر»: هندسه خراب (NaN یا پراکندگی وحشتناک)
        // را قبل از merge دور بریز — یک خودروی خراب کل قطعه را خراب می‌کرد
        g.computeBoundingBox();
        const bb = g.boundingBox!;
        if (!Number.isFinite(bb.min.x) || !Number.isFinite(bb.max.z)) return;
        const span = Math.max(bb.max.x - bb.min.x, bb.max.y - bb.min.y, bb.max.z - bb.min.z);
        if (!Number.isFinite(span) || span > 700 || span < 4) return;
        const mats = Array.isArray(m.material) ? m.material : [m.material];
        const mat = (mats[0] ?? this.vcToonMat()) as THREE.Material;
        // امضای اتریبیوت‌ها — GLBهای کاربر مجموعه‌های متفاوت دارند (با/بدون uv+tangent)
        const sig = Object.keys(g.attributes).sort().join(',') + (g.index ? '|i' : '|n');
        const key = `${ck}##${mat.uuid}##${sig}`;
        const entry = byKey.get(key);
        if (entry) entry.geos.push(g);
        else byKey.set(key, { mat, geos: [g] });
      });
    }
    for (const { mat, geos } of byKey.values()) {
      const merged = mergeGeometries(geos, false);
      if (!merged) continue;
      // محاسبه bbox برای culling درست
      merged.computeBoundingBox();
      merged.computeBoundingSphere();
      const mesh = new THREE.Mesh(merged, mat);
      // سایه‌اندازی پارکی‌ها = رندر دوباره ~۱M مثلث در shadow map — فیکس FPS
      mesh.castShadow = false;
      mesh.receiveShadow = true;
      this.scene.add(mesh);
      this.parkedInstanced.push(mesh);
    }
  }

  /** fallback procedural برای یک kind (نسخه قبلی Instanced) */
  private buildParkedProceduralKind(
    kind: VehicleVariant,
    cars: Array<{ x: number; y: number; angle: number }>,
  ): void {
    const palette: Record<string, string[]> = {
      pride: ['#f4f4f0', '#3f7fd4', '#b03a2e', '#e8d9b0', '#d9d9d4'],
      peugeot405: ['#f7f7f2', '#5d6d7e'],
      tiba: ['#b03a2e', '#d5dbdb'],
      nissan: ['#2f6fae'],
      samand: ['#bfc9ca'],
    };
    const colors = palette[kind] ?? ['#d9d9d4'];
    const mat = this.vcToonMat();
    const tmpQ = new THREE.Quaternion();
    const tmpE = new THREE.Euler();
    const geo = buildParkedGeometry(kind, {});
    const mesh = new THREE.InstancedMesh(geo, mat, cars.length);
    mesh.castShadow = true;
    mesh.instanceColor = new THREE.InstancedBufferAttribute(new Float32Array(cars.length * 3).fill(1), 3);
    let count = 0;
    cars.forEach((pc, i) => {
      const c = new THREE.Color(colors[i % colors.length]);
      mesh.setColorAt(i, c);
      tmpQ.setFromEuler(tmpE.set(0, -pc.angle, 0));
      const s = 188 / { player: 172, pride: 172, peugeot405: 196, samand: 206, nissan: 200, tiba: 168, taxi: 196, police: 206 }[kind];
      this.tmpM.compose(this.tmpV.set(pc.x, 0, pc.y), tmpQ, this.tmpS.set(s, s, s));
      mesh.setMatrixAt(count, this.tmpM);
      count++;
    });
    mesh.count = count;
    mesh.instanceMatrix.needsUpdate = true;
    if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
    this.scene.add(mesh);
    this.parkedInstanced.push(mesh);
  }

  /** درخت/سطل/مخروط/جعبه/تیر/موتور/کیسه — هر نوع یک InstancedMesh */
  private buildPropInstanced(): void {
    const r = (seed: number): number => {
      const x = Math.sin(seed * 127.1 + 311.7) * 43758.5453;
      return x - Math.floor(x);
    };
    const mkTemplates = (): Record<string, THREE.BufferGeometry> => {
      const t: Record<string, THREE.BufferGeometry> = {};
      // درخت
      const trunk = new THREE.CylinderGeometry(9, 12, 66, 8); trunk.translate(0, 33, 0);
      const blob = new THREE.IcosahedronGeometry(55, 0); blob.translate(0, 92, 0);
      const blob2 = new THREE.IcosahedronGeometry(33, 0); blob2.translate(18, 118, -12);
      t.tree = this.mergeColored([{ g: trunk, color: '#8a5a33' }, { g: blob, color: '#5FA84B' }, { g: blob2, color: '#8AC926' }]);
      // سطل زباله
      const bin = new THREE.CylinderGeometry(24, 20, 45, 10); bin.translate(0, 22, 0);
      const lid = new THREE.CylinderGeometry(26, 26, 6, 10); lid.translate(2, 47, 0);
      t.trash = this.mergeColored([{ g: bin, color: '#4F772D' }, { g: lid, color: '#3d5c22' }]);
      // تیر چراغ
      const pole = new THREE.CylinderGeometry(3.2, 3.7, 125, 8); pole.translate(0, 62, 0);
      const lamp = new THREE.SphereGeometry(8, 10, 8); lamp.translate(0, 129, 0);
      t.pole = this.mergeColored([{ g: pole, color: '#8D99AE' }, { g: lamp, color: '#EF476F' }]);
      // مخروط
      const cone = new THREE.ConeGeometry(20, 46, 10); cone.translate(0, 23, 0);
      const band = new THREE.CylinderGeometry(12.5, 15, 8, 10); band.translate(0, 30, 0);
      t.cone = this.mergeColored([{ g: cone, color: '#F4A261' }, { g: band, color: '#FFFFFF' }]);
      // جعبه
      const crate = new THREE.BoxGeometry(62, 62, 62); crate.translate(0, 31, 0);
      const slat = new THREE.BoxGeometry(64, 10, 64); slat.translate(0, 31, 0);
      t.crate = this.mergeColored([{ g: crate, color: '#b07b3f' }, { g: slat, color: '#8d6231' }]);
      // کیسه زباله
      const b1 = new THREE.SphereGeometry(20, 8, 6); b1.translate(-14, 16, 0);
      const b2 = new THREE.SphereGeometry(17, 8, 6); b2.translate(12, 14, 6);
      const b3 = new THREE.SphereGeometry(15, 8, 6); b3.translate(0, 12, -12);
      t.bags = this.mergeColored([{ g: b1, color: '#3a3f3a' }, { g: b2, color: '#454a45' }, { g: b3, color: '#333833' }]);
      // موتور (ساده: بدنه + زین + ۲ چرخ + فرمان)
      const mb = new THREE.BoxGeometry(22, 18, 74); mb.translate(0, 26, 0);
      const seat = new THREE.BoxGeometry(18, 8, 26); seat.translate(0, 38, 8);
      const wf = new THREE.TorusGeometry(13, 5, 8, 12); wf.rotateY(Math.PI / 2); wf.translate(0, 14, -28);
      const wr2 = new THREE.TorusGeometry(13, 5, 8, 12); wr2.rotateY(Math.PI / 2); wr2.translate(0, 14, 28);
      const hb = new THREE.BoxGeometry(34, 4, 4); hb.translate(0, 44, -22);
      t.moto = this.mergeColored([
        { g: mb, color: '#8f8f8f' }, { g: seat, color: '#23211f' },
        { g: wf, color: '#23211f' }, { g: wr2, color: '#23211f' }, { g: hb, color: '#3a3a3a' },
      ]);
      return t;
    };
    const templates = mkTemplates();
    const mat = this.vcToonMat();
    const tmpQ = new THREE.Quaternion();
    const tmpE = new THREE.Euler();

    // گروه‌بندی پراپ‌ها بر اساس kind
    const groups = new Map<string, WorldProp[]>();
    for (const p of this.world.props) {
      if (p.kind === 'building') continue;
      // فاز CITY-FULL: فواره/نیمکت/گلکاری هم مدل دارند — نباید نامرئی بمانند!
      if (p.kind === 'busstop' || p.kind === 'vendor' || p.kind === 'billboard' || p.kind === 'streetSign'
        || p.kind === 'azadiTower' || p.kind === 'miladTower' || p.kind === 'fountain'
        || p.kind === 'bench' || p.kind === 'flowers') {
        // غیر Instanced: مثل قبل گروه جدا (تابلوها بافت یگانه دارند)
        this.buildProp(p);
        continue;
      }
      const key = p.kind === 'moto' ? 'moto' : p.kind;
      if (!groups.has(key)) groups.set(key, []);
      groups.get(key)!.push(p);
    }

    for (const [kind, props] of groups) {
      const geo = templates[kind];
      if (!geo) continue;
      const mesh = new THREE.InstancedMesh(geo, mat, props.length);
      mesh.castShadow = true;
      mesh.instanceColor = new THREE.InstancedBufferAttribute(new Float32Array(props.length * 3).fill(1), 3);
      props.forEach((p, i) => {
        const cx = p.x + p.w / 2;
        const cz = p.y + p.h / 2;
        const scale = Math.min(p.w, p.h) / 60; // مقیاس نسبی از اندازه کولایدر
        if (p.kind === 'tree') {
          const s = Math.min(p.w, p.h) / 120;
          this.tmpM.compose(this.tmpV.set(cx, 0, cz), tmpQ.identity(), this.tmpS.set(s, s, s));
        } else if (p.kind === 'pole') {
          this.tmpM.compose(this.tmpV.set(cx, 0, cz), tmpQ.identity(), this.tmpS.setScalar(1));
        } else if (p.kind === 'moto') {
          // رنگ موتور از hash مختصات (مثل قبل ۳ رنگ)
          const cc = new THREE.Color(['#c0392b', '#2e6da4', '#3a3a3a'][Math.abs(Math.round(cx + cz)) % 3]);
          mesh.setColorAt(i, cc);
          this.tmpM.compose(this.tmpV.set(cx, 0, cz), tmpQ.setFromEuler(tmpE.set(0, r(cx) * Math.PI * 2, 0)), this.tmpS.setScalar(1));
        } else {
          const s = Math.max(0.7, Math.min(1.4, scale));
          this.tmpM.compose(this.tmpV.set(cx, 0, cz), tmpQ.setFromEuler(tmpE.set(0, r(cx * 3 + cz) * 0.6, 0)), this.tmpS.set(s, s, s));
        }
        mesh.setMatrixAt(i, this.tmpM);
        // شکستنی‌ها: نگاشت برای مخفی/ظاهر شدن
        if (p.breakable) this.breakableInst.set(p, { mesh, idx: i });
      });
      mesh.count = props.length;
      mesh.instanceMatrix.needsUpdate = true;
      if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
      this.scene.add(mesh);
      this.propInstanced.set(kind, mesh);
    }
  }

  /**
   * کیت شهری GLB (فاز CITY-KIT) — پراپ‌های استخراجی از پک مودولار کاربر
   * (باریکه/مخروط/استوانه/پایه/درخت‌ک) — بعد از لود async، هر نوع یک InstancedMesh
   * همه تزئینی‌اند (بدون کلاژر جدید)؛ شکستنی‌ها فقط بصری می‌شکنند.
   */
  private async buildCityKitProps(): Promise<void> {
    const scene = await this.glb.load('city/props.glb');
    if (!scene) return;
    const geoms = new Map<string, THREE.BufferGeometry>();
    scene.updateMatrixWorld(true);
    scene.traverse((o) => {
      const m = o as THREE.Mesh;
      if (m.isMesh && m.name.startsWith('prop_')) {
        // 🔑 فیکس «لکه‌های سیاه»: رنگ‌های vertex کیت در اکسپورت دو بار گاما خورده‌اند
        // (سبز درخت ۰٫۴۰ → ۰٫۱۳ ذخیره شده!) — بازیابی: pow(c, 1/2.2)
        const col = m.geometry.getAttribute('color') as THREE.BufferAttribute | undefined;
        if (col && !m.geometry.userData.vcFixed) {
          const arr = col.array as Float32Array;
          for (let i = 0; i < arr.length; i++) arr[i] = Math.pow(arr[i], 1 / 2.2);
          col.needsUpdate = true;
          m.geometry.userData.vcFixed = true;
        }
        geoms.set(m.name.slice(5), m.geometry);
      }
    });
    if (geoms.size === 0) return;
    // متریال تون DoubleSide — مش‌های باز کیت (بدون درپوش) از داخل هم دیده شوند
    const mat = this.vcToonMat();
    mat.side = THREE.DoubleSide;
    const tmpQ = new THREE.Quaternion();
    const tmpE = new THREE.Euler();
    // فاز CITY-FULL: مقیاس هر پراپ به اندازه کولایدرش (درخت GLB ۳۴۲ بود ولی کولایدر ۱۳۰!)
    const spanOf = new Map<string, number>();
    for (const [kind, geo] of geoms) {
      if (!geo.boundingBox) geo.computeBoundingBox();
      const s = geo.boundingBox!.getSize(new THREE.Vector3());
      spanOf.set(kind, Math.max(s.x, s.z, 1));
    }
    for (const [kind, geo] of geoms) {
      const props = this.world.props.filter((p) => p.kind === kind);
      if (props.length === 0) continue;
      const mesh = new THREE.InstancedMesh(geo, mat, props.length);
      mesh.castShadow = true;
      mesh.instanceColor = new THREE.InstancedBufferAttribute(new Float32Array(props.length * 3).fill(1), 3);
      const span = spanOf.get(kind) ?? 1;
      props.forEach((p, i) => {
        const cx = p.x + p.w / 2;
        const cz = p.y + p.h / 2;
        const sc = Math.max(0.5, Math.min(1.6, Math.min(p.w, p.h) / span)); // فیت در پلن + کف مقیاس برای درخت‌ها
        tmpQ.setFromEuler(tmpE.set(0, p.rot ?? 0, 0));
        this.tmpM.compose(this.tmpV.set(cx, 0, cz), tmpQ, this.tmpS.setScalar(sc));
        mesh.setMatrixAt(i, this.tmpM);
        if (p.breakable) this.breakableInst.set(p, { mesh, idx: i });
      });
      mesh.count = props.length;
      mesh.instanceMatrix.needsUpdate = true;
      if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
      this.scene.add(mesh);
      this.propInstanced.set('glb_' + kind, mesh);
    }
  }

  /** همگام‌سازی شکستنی‌های Instanced — فقط وقتی وضعیت عوض شده */
  private syncBreakableInstances(): void {
    if (!this.breakableDirty) return;
    this.breakableDirty = false;
    const tmpQ = new THREE.Quaternion();
    for (const [prop, ref] of this.breakableInst) {
      const s = prop.broken ? 0.0001 : 1;
      ref.mesh.getMatrixAt(ref.idx, this.tmpM);
      this.tmpM.decompose(this.tmpV, tmpQ, this.tmpS);
      if (this.tmpS.x === s) continue;
      this.tmpS.setScalar(s);
      this.tmpM.compose(this.tmpV, tmpQ, this.tmpS);
      ref.mesh.setMatrixAt(ref.idx, this.tmpM);
      ref.mesh.instanceMatrix.needsUpdate = true;
    }
  }

  /** شکستنی تغییر کرد → فریم بعد sync شود (از GameManager از طریق markBreakablesDirty) */
  markBreakablesDirty(): void {
    this.breakableDirty = true;
  }

  // ============ چراغ راهنما (فاز OVERHAUL) ============

  private buildTrafficLights(): void {
    const n = WR.roadCount + 1;
    const half = WR.roadW / 2;
    // تیر: میله + بازوی افقی + ۲ پنل سر چراغ دوردیفه (NS: نازک در Z | EW: نازک در X)
    const poleParts = [
      { g: (() => { const g = new THREE.CylinderGeometry(6, 8, 210, 8); g.translate(0, 105, 0); return g; })(), color: '#3c4440' },
      { g: (() => { const g = new THREE.BoxGeometry(half + 40, 8, 8); g.translate(-half / 2 - 10, 205, 0); return g; })(), color: '#3c4440' },
      // پنل NS روی بازو (وجه ±Z رو به راننده شمال/جنوب)
      { g: (() => { const g = new THREE.BoxGeometry(28, 78, 6); g.translate(-half + 10, 168, 0); return g; })(), color: '#23211f' },
      // پنل EW کنار تیر (وجه ±X رو به راننده شرق/غرب)
      { g: (() => { const g = new THREE.BoxGeometry(6, 78, 28); g.translate(half + 30, 168, -half - 20); return g; })(), color: '#23211f' },
    ];
    const poleGeo = this.mergeColored(poleParts);
    this.lightPoleMesh = new THREE.InstancedMesh(poleGeo, this.vcToonMat(), n * n);
    this.lightPoleMesh.castShadow = true;
    let idx = 0;
    const tmpQ = new THREE.Quaternion();
    for (let i = 0; i < n; i++) {
      for (let j = 0; j < n; j++) {
        this.tmpM.compose(this.tmpV.set(roadCenter(i) + half + 26, 0, roadCenter(j) + half + 26), tmpQ.identity(), this.tmpS.setScalar(1));
        this.lightPoleMesh.setMatrixAt(idx++, this.tmpM);
      }
    }
    this.lightPoleMesh.instanceMatrix.needsUpdate = true;
    this.scene.add(this.lightPoleMesh);

    // لامپ‌ها: ۳ InstancedMesh (قرمز/زرد/سبز) — هر تقاطع ۴ نمونه (NS ±Z | EW ±X)
    const lampGeo = new THREE.SphereGeometry(8, 8, 6);
    const mkLampMat = (color: string): THREE.MeshBasicMaterial => new THREE.MeshBasicMaterial({ color });
    const lampColors = ['#ff3b30', '#ffcc00', '#2ecc71'];
    for (let k = 0; k < 3; k++) {
      const mesh = new THREE.InstancedMesh(lampGeo, mkLampMat(lampColors[k]), n * n * 4);
      mesh.count = n * n * 4;
      this.scene.add(mesh);
      this.lightLamps.push(mesh);
    }
    this.lightStateCache = new Uint8Array(n * n * 2).fill(255); // 255 = نیاز به sync
  }

  /** به‌روزرسانی لامپ‌ها (هر فریم — فقط تغییرها) */
  private updateTrafficLightLamps(): void {
    const n = WR.roadCount + 1;
    const half = WR.roadW / 2;
    if (!this.lightStateCache || this.lightLamps.length !== 3) return;
    const tmpQ = new THREE.Quaternion();
    let idx = 0;
    for (let i = 0; i < n; i++) {
      for (let j = 0; j < n; j++) {
        const ns = this.lights.stateNS(i, j);
        const ew = this.lights.stateEW(i, j);
        const nsCode = ns === 'green' ? 2 : ns === 'yellow' ? 1 : 0;
        const ewCode = ew === 'green' ? 2 : ew === 'yellow' ? 1 : 0;
        if (this.lightStateCache[idx] === nsCode && this.lightStateCache[idx + 1] === ewCode) { idx += 2; continue; }
        this.lightStateCache[idx] = nsCode;
        this.lightStateCache[idx + 1] = ewCode;
        // لامپ NS روی بازوی جلو (-X)، لامپ EW روی بازوی کنار (+X جعبه کنار جاده)
        const lx = roadCenter(i) + half + 26 - half + 10; // مرکز جعبه NS
        const lz = roadCenter(j) + half + 26;
        const ex = roadCenter(i) + half + 26 + half + 30;
        const ez = roadCenter(j) + half + 26 - half - 20;
        for (let k = 0; k < 3; k++) {
          // NS: لامپ دو‌رو (±Z) | EW: لامپ دو‌رو (±X) — بالا قرمز k=0، وسط زرد، پایین سبز
          // روشن وقتی کد حالت = رنگ (قرمز=0، زرد=1، سبز=2)
          const lampNS = this.lightLamps[k];
          const qIdx = idx * 4; // ۴ نمونه در هر تقاطع برای هر رنگ
          for (let side = 0; side < 2; side++) {
            this.tmpM.compose(
              this.tmpV.set(lx, 196 - k * 24, lz + (side === 0 ? 7 : -7)),
              tmpQ.identity(),
              this.tmpS.setScalar(nsCode === k ? 1 : 0.0001),
            );
            lampNS.setMatrixAt(qIdx + side, this.tmpM);
          }
          const lampEW = this.lightLamps[k];
          for (let side = 0; side < 2; side++) {
            this.tmpM.compose(
              this.tmpV.set(ex + (side === 0 ? 7 : -7), 196 - k * 24, ez),
              tmpQ.identity(),
              this.tmpS.setScalar(ewCode === k ? 1 : 0.0001),
            );
            lampEW.setMatrixAt(qIdx + 2 + side, this.tmpM);
          }
        }
        idx += 1; // هر تقاطع یک واحد منطقی (×۲ در شماره لامپ)
      }
    }
    for (const l of this.lightLamps) l.instanceMatrix.needsUpdate = true;
  }


  private buildBuilding(p: { x: number; y: number; w: number; h: number; assetId?: string; landmark?: boolean }): void {
    const cx = p.x + p.w / 2;
    const cz = p.y + p.h / 2;

    if (p.landmark) {
      // پمپ بنزین: مغازه + سقف سایبان + ستون‌ها + پمپ‌ها
      const shopH = RENDER3D.gasStationShopHeight;
      const shopTex = getFacadeTextures('env_building_shop_01');
      const shopMats = shopTex.map((t) => new THREE.MeshLambertMaterial({ map: t }));
      const shop = new THREE.Mesh(new THREE.BoxGeometry(360, shopH, 320), shopMats);
      shop.position.set(cx + p.w * 0.2, shopH / 2, cz - p.h * 0.18);
      shop.castShadow = true; shop.receiveShadow = true;
      this.scene.add(shop);

      const canopy = new THREE.Mesh(
        new THREE.BoxGeometry(p.w * 0.82, 26, p.h * 0.66),
        new THREE.MeshLambertMaterial({ color: '#e2574c' }),
      );
      canopy.position.set(cx - p.w * 0.08, 178, cz + p.h * 0.16);
      canopy.castShadow = true;
      this.scene.add(canopy);
      const poleGeo = new THREE.CylinderGeometry(12, 12, 168, 8);
      const poleMat = new THREE.MeshLambertMaterial({ color: '#8f8f8a' });
      for (const dx of [-p.w * 0.36, p.w * 0.2]) {
        for (const dz of [-p.h * 0.14, p.h * 0.44]) {
          const pole = new THREE.Mesh(poleGeo, poleMat);
          pole.position.set(cx - p.w * 0.08 + dx, 84, cz + p.h * 0.16 + dz);
          pole.castShadow = true;
          this.scene.add(pole);
        }
      }
      const pumpGeo = new THREE.BoxGeometry(34, 66, 22);
      const pumpMat = new THREE.MeshLambertMaterial({ color: '#d8d3c8' });
      for (const dx of [-p.w * 0.2, p.w * 0.04]) {
        const pump = new THREE.Mesh(pumpGeo, pumpMat);
        pump.position.set(cx - p.w * 0.08 + dx, 33, cz + p.h * 0.16);
        pump.castShadow = true;
        this.scene.add(pump);
      }
      return;
    }

    const hBase = RENDER3D.buildingHeights[p.assetId as keyof typeof RENDER3D.buildingHeights] ?? 340;
    const tex = getFacadeTextures(p.assetId ?? 'env_building_home_01');
    // فاز CITY-BEAUTY: پالت اشباع ایرانی + تنوع ارتفاع واقعی (آسمان‌خط بهتر)
    const hash = Math.abs(Math.round(cx * 7 + cz * 13));
    const tint = BUILDING_TINTS[hash % BUILDING_TINTS.length];
    const tintC = new THREE.Color(tint);
    const hVar = 0.85 + ((hash >> 2) % 5) * 0.14; // 0.85..1.41
    const h = hBase * hVar;
    const mats = tex.map((t) => {
      const mm = new THREE.MeshLambertMaterial({ map: t });
      mm.color.multiply(tintC);
      return mm;
    });
    const box = new THREE.Mesh(new THREE.BoxGeometry(p.w, h, p.h), mats);
    box.position.set(cx, h / 2, cz);
    box.castShadow = true;
    box.receiveShadow = true;
    this.scene.add(box);
    // خوشه پشت‌بام ایرانی: ظرف ماهواره + منبع آب + آنتن چتری + کولر آبی
    // فاز FPS-1: ~۷ مش → «یک» مش merge‌شده (رنگ‌ها بیک می‌شوند)
    const roof = buildRooftopCluster(p.w, p.h, Math.round(cx * 7 + cz * 13));
    roof.position.set(cx, h, cz);
    const roofMesh = this.mergeGroupToVertexMesh(roof);
    if (roofMesh) this.scene.add(roofMesh);
    else this.scene.add(roof);

    // ---------- فاز OVERHAUL: ارتقا به GLB (با پشت‌بام baked) — fallback بالا می‌ماند ----------
    const type = p.assetId?.includes('apartment') ? 'apartment'
      : p.assetId?.includes('shop') ? 'shop'
        : p.assetId?.includes('garage') ? 'garage' : 'home';
    const variance = Math.abs(Math.round(cx * 7 + cz * 13));
    void this.glb.loadBuilding(type, variance).then((scene) => {
      if (!scene) return;
      const g = scene.clone(true);
      const tintGlb = BUILDING_TINTS[variance % BUILDING_TINTS.length];
      const tintCG = new THREE.Color(tintGlb);
      // فاز CITY-FULL: فیت کردن GLB در پلن دلخواه (بلوک‌های چندساختمانه)
      g.updateMatrixWorld(true);
      const gb = new THREE.Box3().setFromObject(g);
      const gs = gb.getSize(new THREE.Vector3());
      const fit = Math.min(p.w / Math.max(gs.x, 1), p.h / Math.max(gs.z, 1));
      const sy = h / Math.max(gs.y, 1); // ارتفاع هدف از buildingHeights × hVar
      g.traverse((o) => {
        const m = o as THREE.Mesh;
        if (!m.isMesh) return;
        m.castShadow = true; m.receiveShadow = true;
        // رنگ نما per building — کلون متریال تا ساختمان‌ها رنگ‌های متفاوت بگیرند
        // 🔑🔑 فیکس «بلوک‌های خالی + برخورد نامرئی» (فاز VIS-BUILDING):
        // کد قبلی متریالِ تکی را هم داخل آرایه می‌پیچید ([mat]) در حالی که
        // geometry.groups خالی است → three.js برای متریال آرایه‌ای فقط از روی
        // groups رندر می‌کند → صفر Draw Call = ساختمان کاملاً نامرئی!
        // اکنون: متریال تکی → تکی می‌ماند. Standard (GLB) → Lambert تون‌شهر.
        const srcMats = m.material;
        const convert = (mm: THREE.Material): THREE.Material => {
          const c = mm.clone();
          const std = c as THREE.MeshStandardMaterial;
          if (std.isMeshStandardMaterial) { std.metalness = 0; std.roughness = 1; }
          const cm = c as THREE.MeshLambertMaterial;
          if (cm.color) {
            if (cm.map) cm.color.multiply(tintCG);
            else cm.color.set(tintGlb); // فاز CITY-FULL: اشباع کامل
          }
          return c;
        };
        m.material = Array.isArray(srcMats)
          ? (srcMats as THREE.Material[]).map(convert)
          : convert(srcMats as THREE.Material);
      });
      // GLB: مرکز پلن + پایه روی زمین + بدون چرخش (پلن مستطیلی تراز می‌ماند)
      g.position.set(cx, -gb.min.y * sy, cz);
      g.scale.set(fit, sy, fit);
      // فاز CITY-BEAUTY: مغازه‌ها سایه‌بان راه‌راه + تابلوی رنگی می‌گیرند
      if (type === 'shop' || type === 'garage') {
        this.decorateShopFront(g, variance);
      }
      // فاز FPS-1: هر دو نسخه placeholder (باکس و خوشه پشت‌بام merge‌شده) برداشته می‌شوند
      this.scene.remove(box);
      if (roofMesh) this.scene.remove(roofMesh);
      else this.scene.remove(roof);
      this.scene.add(g);
    });
  }

  /** سایه‌بان راه‌راه + تابلوی مغازه روی نمای ساختمان GLB — جلوه خیابان ایرانی */
  private decorateShopFront(g: THREE.Group, variance: number): void {
    g.updateMatrixWorld(true);
    const bb = new THREE.Box3().setFromObject(g);
    const size = bb.getSize(new THREE.Vector3());
    const span = Math.min(size.x, size.z); // عرض نما
    const depth = Math.max(size.x, size.z); // طول بدنه
    const AW_COLORS = ['#E63946', '#2D7DD2', '#F2B705', '#8AC926', '#E07A5F', '#7B5EA7'];
    const awColor = AW_COLORS[variance % AW_COLORS.length];
    const NAMES = [
      'نانایی سعید', 'قهوه‌خانه عمو نقی', 'خیاطی ستاره', 'میوه‌فروشی برادران',
      'آهنگری کربایی', 'خشکشویی تهران', 'قنادی گل‌ها', 'لوازم یدکی کیان',
    ];
    const name = NAMES[variance % NAMES.length];
    const awningTex = getAwningTexture(awColor);
    const signTex = getBillboardTexture(name, 'فانی‌کار', awColor);
    const y = Math.max(95, size.y * 0.3);
    const faceZ = (depth / 2) * 0.99;
    // فاز FPS-1: دو طرف در «یک» مش merge می‌شوند — ۴ مش → ۲ مش برای هر مغازه
    const awParts: THREE.BufferGeometry[] = [];
    const signParts: THREE.BufferGeometry[] = [];
    for (const s of [1, -1]) {
      // سایه‌بان = جعبه نازک شیب‌دار — از هر زاویه مثل سایه‌بان واقعی دیده می‌شود
      const awGeo = new THREE.BoxGeometry(span * 0.45, 7, 38);
      awGeo.rotateX(s * 0.18);
      awGeo.translate(0, y, s * (faceZ + 16));
      awParts.push(awGeo);
      const signGeo = new THREE.PlaneGeometry(span * 0.5, span * 0.09);
      if (s < 0) signGeo.rotateY(Math.PI);
      signGeo.translate(0, y + 30, s * faceZ);
      signParts.push(signGeo);
    }
    const awMerged = mergeGeometries(awParts, false);
    if (awMerged) {
      awMerged.computeBoundingBox();
      awMerged.computeBoundingSphere();
      const awning = new THREE.Mesh(awMerged, new THREE.MeshLambertMaterial({ map: awningTex }));
      awning.castShadow = true;
      g.add(awning);
    }
    const sgMerged = mergeGeometries(signParts, false);
    if (sgMerged) {
      sgMerged.computeBoundingBox();
      sgMerged.computeBoundingSphere();
      const sign = new THREE.Mesh(
        sgMerged,
        new THREE.MeshBasicMaterial({ map: signTex, transparent: true, side: THREE.DoubleSide }),
      );
      g.add(sign);
    }
  }

  /** همه پراپ‌ها داخل گروه wrapper — شکستنی‌ها با hide/show کنترل می‌شوند */
  private buildProp(p: WorldProp): void {
    const wrap = new THREE.Group();
    const cx = p.x + p.w / 2;
    const cz = p.y + p.h / 2;
    const r = Math.min(p.w, p.h) / 2;

    switch (p.kind) {
      case 'tree': {
        // فاز CITY-BEAUTY: درخت‌های چندرنگ — سبز، گل‌های گیلاس صورتی، پاییزی
        const thash = Math.abs(Math.round(cx * 7 + cz * 13));
        const FOLIAGE: Array<[string, string]> = [
          ['#5FA84B', '#8AC926'], // سبز کلاسیک
          ['#6db850', '#a4d96a'], // سبز روشن
          ['#e58fb1', '#f4b8cf'], // گل بهاری (شیرازی!)
          ['#d98f3d', '#e8b45a'], // پاییزی طلایی
        ];
        const [f1, f2] = FOLIAGE[thash % FOLIAGE.length];
        const trunk = new THREE.Mesh(
          new THREE.CylinderGeometry(r * 0.16, r * 0.22, r * 1.1, 8),
          new THREE.MeshLambertMaterial({ color: '#8a5a33' }),
        );
        trunk.position.y = r * 0.55;
        trunk.castShadow = true;
        const blob = new THREE.Mesh(
          new THREE.IcosahedronGeometry(r * 0.92, 0),
          new THREE.MeshLambertMaterial({ color: f1 }),
        );
        blob.position.y = r * 1.5;
        blob.castShadow = true;
        const blob2 = new THREE.Mesh(
          new THREE.IcosahedronGeometry(r * 0.55, 0),
          new THREE.MeshLambertMaterial({ color: f2 }),
        );
        blob2.position.set(r * 0.3, r * 1.9, -r * 0.2);
        blob2.castShadow = true;
        wrap.add(trunk, blob, blob2);
        break;
      }
      case 'trash': {
        const bin = new THREE.Mesh(
          new THREE.CylinderGeometry(r * 0.8, r * 0.66, r * 1.5, 10),
          new THREE.MeshLambertMaterial({ color: '#4F772D' }),
        );
        bin.position.y = r * 0.75;
        bin.castShadow = true;
        // درِ باز سطل — تا سطل «مترسک‌وار» دیده شود
        wrap.add(bin);
        break;
      }
      case 'pole': {
        const pole = new THREE.Mesh(
          new THREE.CylinderGeometry(r * 0.14, r * 0.16, r * 4.2, 8),
          new THREE.MeshLambertMaterial({ color: '#8D99AE' }),
        );
        pole.position.y = r * 2.1;
        pole.castShadow = true;
        const lamp = new THREE.Mesh(
          new THREE.SphereGeometry(r * 0.3, 10, 8),
          new THREE.MeshBasicMaterial({ color: '#EF476F' }),
        );
        lamp.position.y = r * 4.3;
        wrap.add(pole, lamp);
        break;
      }
      case 'cone': {
        const cone = new THREE.Mesh(
          new THREE.ConeGeometry(r * 0.75, r * 1.7, 10),
          new THREE.MeshLambertMaterial({ color: '#F4A261' }),
        );
        cone.position.y = r * 0.85;
        cone.castShadow = true;
        const band = new THREE.Mesh(
          new THREE.CylinderGeometry(r * 0.42, r * 0.5, r * 0.28, 10),
          new THREE.MeshLambertMaterial({ color: '#FFFFFF' }),
        );
        band.position.y = r * 1.0;
        wrap.add(cone, band);
        break;
      }
      case 'crate': {
        const crate = buildCrate();
        wrap.add(crate);
        break;
      }
      // ---------- پراپ‌های خیابان ایرانی ----------
      case 'busstop': {
        const stop = buildBusStop();
        stop.rotation.y = Math.PI; // پنل رو به جاده
        wrap.add(stop);
        break;
      }
      case 'vendor': {
        wrap.add(buildVendorCart());
        break;
      }
      case 'billboard': {
        const [l1, l2] = (p.label ?? 'فانی‌کار|در حال ساخت!').split('|');
        const bb = buildBillboard(l1, l2);
        bb.rotation.y = p.rot ?? 0;
        wrap.add(bb);
        break;
      }
      case 'streetSign': {
        wrap.add(buildStreetSign(p.label ?? 'خیابان'));
        break;
      }
      case 'moto': {
        const moto = buildMotorcycle(['#c0392b', '#2e6da4', '#3a3a3a'][Math.abs(Math.round(cx + cz)) % 3]);
        wrap.add(moto);
        break;
      }
      case 'bags': {
        wrap.add(buildTrashBags());
        break;
      }
      // ---------- فاز CITY-BEAUTY — پارک و زندگی رنگی ----------
      case 'fountain': {
        wrap.add(buildFountain());
        break;
      }
      case 'bench': {
        wrap.rotation.y = p.rot ?? 0;
        wrap.add(buildBench());
        break;
      }
      case 'flowers': {
        wrap.add(buildFlowers(Math.abs(Math.round(cx * 7 + cz * 13))));
        break;
      }
      case 'banner': {
        const span = Math.max(p.w, p.h);
        const b = buildBanner(p.label ?? 'فانی‌کار', p.tint ?? '#E63946', span);
        b.rotation.y = p.rot ?? 0;
        wrap.add(b);
        break;
      }
      // ---------- لندمارک‌های تهران ----------
      case 'azadiTower': {
        const t = buildAzadiTower();
        wrap.add(t);
        break;
      }
      case 'miladTower': {
        const t = buildMiladTower();
        wrap.add(t);
        break;
      }
    }

    wrap.position.set(cx, 0, cz);
    this.scene.add(wrap);
    if (p.breakable) this.propGroups.set(p, wrap);
  }

  /** فاز FPS-1: merge کل اجزای یک گروه ایستا (مثل خوشه پشت‌بام) به «یک» مش
   *  رنگ هر جزء به vertex color بیک می‌شود → یک متریال مشترک Lambert.
   *  خوشه پشت‌بام ~۷ مش بود → ۱ مش (۴۰۰+ Draw Call صرفه‌جویی روی کل شهر). */
  private mergeGroupToVertexMesh(g: THREE.Object3D): THREE.Mesh | null {
    if (!this.vcMergeMat) {
      this.vcMergeMat = new THREE.MeshLambertMaterial({ vertexColors: true });
    }
    g.updateMatrixWorld(true);
    const geos: THREE.BufferGeometry[] = [];
    g.traverse((o) => {
      const m = o as THREE.Mesh;
      if (!m.isMesh) return;
      const src = m.geometry.clone();
      src.applyMatrix4(m.matrixWorld);
      const mats = Array.isArray(m.material) ? m.material : [m.material];
      const mat = mats[0] as THREE.MeshLambertMaterial | undefined;
      const col = mat && (mat as THREE.MeshLambertMaterial).color
        ? (mat as THREE.MeshLambertMaterial).color!
        : new THREE.Color(1, 1, 1);
      const pos = src.getAttribute('position') as THREE.BufferAttribute | undefined;
      if (!pos || pos.count === 0) return;
      const arr = new Float32Array(pos.count * 3);
      for (let i = 0; i < pos.count; i++) {
        arr[i * 3] = col.r; arr[i * 3 + 1] = col.g; arr[i * 3 + 2] = col.b;
      }
      src.setAttribute('color', new THREE.BufferAttribute(arr, 3));
      // امضای اتریبیوت — فقط مجموعه‌های یکسان merge می‌شوند
      geos.push(src);
    });
    if (geos.length === 0) return null;
    const sig0 = Object.keys(geos[0].attributes).sort().join(',');
    const same = geos.every((gg) => Object.keys(gg.attributes).sort().join(',') === sig0);
    if (!same) return null; // ناهم‌راستا → مسیر قبلی (گروه عادی)
    const merged = mergeGeometries(geos, false);
    if (!merged) return null;
    merged.computeBoundingBox();
    merged.computeBoundingSphere();
    const mesh = new THREE.Mesh(merged, this.vcMergeMat);
    mesh.castShadow = true;
    mesh.receiveShadow = false;
    return mesh;
  }

  /** گربه کارتونی Low-Poly (رو به -Z) */
  private buildCat(): THREE.Group {
    const g = new THREE.Group();
    const fur = new THREE.MeshLambertMaterial({ color: '#3D3A3A' });
    const s = RE.catSize;
    const body = new THREE.Mesh(new THREE.SphereGeometry(s * 0.42, 10, 8), fur);
    body.scale.set(0.8, 0.75, 1.15);
    body.position.y = s * 0.4;
    body.castShadow = true;
    const head = new THREE.Mesh(new THREE.SphereGeometry(s * 0.3, 10, 8), fur);
    head.position.set(0, s * 0.72, -s * 0.42);
    head.castShadow = true;
    const earGeo = new THREE.ConeGeometry(s * 0.1, s * 0.22, 4);
    for (const dx of [-s * 0.16, s * 0.16]) {
      const ear = new THREE.Mesh(earGeo, fur);
      ear.position.set(dx, s * 0.98, -s * 0.42);
      g.add(ear);
    }
    const eyeGeo = new THREE.SphereGeometry(s * 0.06, 6, 6);
    const eyeMat = new THREE.MeshBasicMaterial({ color: '#F2B705' });
    for (const dx of [-s * 0.11, s * 0.11]) {
      const eye = new THREE.Mesh(eyeGeo, eyeMat);
      eye.position.set(dx, s * 0.76, -s * 0.68);
      g.add(eye);
    }
    const tail = new THREE.Mesh(new THREE.CylinderGeometry(s * 0.06, s * 0.09, s * 0.7, 6), fur);
    tail.position.set(0, s * 0.62, s * 0.52);
    tail.rotation.x = 0.7;
    g.add(body, head, tail);
    return g;
  }

  // ============ عابرهای پیاده (مدل + انیمیشن) ============

  private static readonly PED_SHIRTS = ['#e2574c', '#2A9D8F', '#3f7fd4', '#e8a33d', '#8AC926', '#9b59b6'];
  private static readonly PED_PANTS = ['#3a3f4a', '#5d4a3a', '#2e4a3a'];
  private static readonly PED_SKINS = ['#e8b98e', '#c98d5f', '#a86f45'];

  // ============ فاز CINEMATIC — آسمان/ابر/خورشید/وینیت ============

  private skyDome: THREE.Mesh | null = null;
  private clouds: THREE.Sprite[] = [];
  private sunGlow: THREE.Sprite | null = null;
  private vignette: HTMLCanvasElement | null = null;

  /** گنبد آسمان گرادیانی — دنبال دوربین، بدون مه */
  private buildSkyDome(): void {
    const geo = new THREE.SphereGeometry(4600, 28, 14, 0, Math.PI * 2, 0, Math.PI * 0.52);
    const mat = new THREE.MeshBasicMaterial({ map: getSkyDomeTexture(), side: THREE.BackSide, fog: false, depthWrite: false });
    this.skyDome = new THREE.Mesh(geo, mat);
    this.skyDome.renderOrder = -10;
    this.scene.add(this.skyDome);
  }

  /** ابرهای بیلبوردی نرم — همیشه دور دوربین، رانش آرام */
  private buildClouds(): void {
    const tex = getCloudTexture();
    for (let i = 0; i < 10; i++) {
      const mat = new THREE.SpriteMaterial({ map: tex, transparent: true, opacity: 0.8, depthWrite: false, fog: false });
      const sp = new THREE.Sprite(mat);
      const a = (i / 10) * Math.PI * 2 + 0.55;
      const r = 2400 + (i % 4) * 520;
      const scale = 1100 + (i % 3) * 620;
      sp.userData.cloudOffset = new THREE.Vector3(Math.cos(a) * r, 880 + (i % 5) * 210, Math.sin(a) * r);
      sp.userData.drift = 6 + (i % 4) * 4;
      sp.scale.set(scale, scale * 0.4, 1);
      this.clouds.push(sp);
      this.scene.add(sp);
    }
    // هاله خورشید — اسپرایت افزایشی در جهت نور
    const glowMat = new THREE.SpriteMaterial({
      map: getCloudTexture(), transparent: true, opacity: 0.26,
      color: '#ffdf9e', blending: THREE.AdditiveBlending, depthWrite: false, fog: false,
    });
    this.sunGlow = new THREE.Sprite(glowMat);
    this.sunGlow.scale.set(1150, 1150, 1);
    this.scene.add(this.sunGlow);
  }

  /** وینیت سینمایی — یک‌بار ساخته می‌شود، هر فریم روی اورلی کشیده می‌شود */
  private ensureVignette(): HTMLCanvasElement {
    if (this.vignette) return this.vignette;
    const c = document.createElement('canvas');
    c.width = 512;
    c.height = 512;
    const ctx = c.getContext('2d')!;
    const g = ctx.createRadialGradient(256, 256, 130, 256, 256, 300);
    g.addColorStop(0, 'rgba(24,14,8,0)');
    g.addColorStop(0.75, 'rgba(24,14,8,0.06)');
    g.addColorStop(1, 'rgba(24,14,8,0.30)');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, 512, 512);
    this.vignette = c;
    return c;
  }

  private buildPedModel(idx: number): { g: THREE.Group; legL: THREE.Mesh; legR: THREE.Mesh; armL: THREE.Mesh; armR: THREE.Mesh } {
    const g = new THREE.Group();
    const shirt = new THREE.MeshToonMaterial({ color: WorldRenderer3D.PED_SHIRTS[idx % 6] });
    const pants = new THREE.MeshToonMaterial({ color: WorldRenderer3D.PED_PANTS[idx % 3] });
    const skin = new THREE.MeshToonMaterial({ color: WorldRenderer3D.PED_SKINS[idx % 3] });
    const dark = new THREE.MeshToonMaterial({ color: '#2e2622' });

    // پاها (پیوت بالا — swing با rotation.x)
    const legGeo = new THREE.BoxGeometry(7, 26, 7);
    legGeo.translate(0, -13, 0);
    const legL = new THREE.Mesh(legGeo, pants);
    legL.position.set(-5.5, 28, 0);
    const legR = new THREE.Mesh(legGeo, pants);
    legR.position.set(5.5, 28, 0);
    // تن
    const torso = new THREE.Mesh(new THREE.BoxGeometry(20, 24, 12), shirt);
    torso.position.y = 40;
    // فاز FPS-1: سایه عابرها غیرفعال — ۲ سایه × ۲۰ عابر در shadow map صرفه‌جویی می‌شود
    torso.castShadow = false;
    // دست‌ها
    const armGeo = new THREE.BoxGeometry(5.5, 22, 5.5);
    armGeo.translate(0, -11, 0);
    const armL = new THREE.Mesh(armGeo, shirt);
    armL.position.set(-12.5, 50, 0);
    const armR = new THREE.Mesh(armGeo, shirt);
    armR.position.set(12.5, 50, 0);
    // سر + مو
    const head = new THREE.Mesh(new THREE.SphereGeometry(8, 10, 8), skin);
    head.position.y = 60;
    head.castShadow = false;
    const hair = new THREE.Mesh(new THREE.SphereGeometry(8.3, 10, 6, 0, Math.PI * 2, 0, Math.PI / 2.2), dark);
    hair.position.y = 61;

    g.add(legL, legR, torso, armL, armR, head, hair);
    g.scale.setScalar(1.18);
    return { g, legL, legR, armL, armR };
  }

  // ============ API عمومی (هم‌امضای رندر دوبعدی) ============

  /** حباب گفتار محیطی (ترافیک/تاکسی/عابر) */
  pushBubble(text: string, x: number, y: number, portraitId?: string, ttl = 2.6): void {
    if (this.bubbles.length >= 3) this.bubbles.shift();
    this.bubbles.push({ text, x, y, portraitId, ttl, maxTtl: ttl });
  }

  /** ذرات برخورد/سکه — Pool با سقف (Instanced) */
  spawnBurst(x: number, y: number, color: string, count = 8, power = 160): void {
    for (let i = 0; i < count; i++) {
      const a = Math.random() * Math.PI * 2;
      const pw = power * (0.4 + Math.random() * 0.6);
      if (this.particles.length >= RENDER3D.particleMax) break;
      const p: Particle3D = {
        x, z: y, y: 30,
        vx: Math.cos(a) * pw,
        vz: Math.sin(a) * pw,
        vy: 130 + Math.random() * 170,
        life: 0.5 + Math.random() * 0.3,
        maxLife: 0.8,
        size: 6 + Math.random() * 8,
        active: true,
        color: parseColor(color).color,
      };
      this.particles.push(p);
    }
  }

  /**
   * لاشه/تکه‌های پرتابی تصادف (فاز OVERHAUL) — تکه‌های ۳بعدی با جهش و چرخش
   * که روی زمین می‌مانند و بعد از چند ثانیه محو می‌شوند.
   */
  spawnDebris(x: number, y: number, color: string, count = 10, power = 260, size = 9): void {
    for (let i = 0; i < count; i++) {
      if (this.particles.length >= DEBRIS.maxCount + RENDER3D.particleMax) break;
      const a = Math.random() * Math.PI * 2;
      const pw = power * (0.35 + Math.random() * 0.65);
      const life = DEBRIS.lifeSec * (0.7 + Math.random() * 0.5);
      const p: Particle3D = {
        x, z: y, y: 26 + Math.random() * 30,
        vx: Math.cos(a) * pw,
        vz: Math.sin(a) * pw,
        vy: 180 + Math.random() * 260,
        life,
        maxLife: life,
        size: size * (0.5 + Math.random() * 0.9),
        active: true,
        color: parseColor(color).color,
        debris: true,
        spin: Math.random() * Math.PI * 2,
        spinRate: (Math.random() - 0.5) * 14,
        rested: false,
      };
      this.particles.push(p);
    }
  }

  /** رد لاستیک درفت — حلقه‌ای (قدیمی‌ها fade با رنگ نزدیک آسفالت) */
  addSkidMark(x: number, y: number, angle: number): void {
    const idx = this.skidIdx;
    this.skidData[idx] = { x, z: y, rot: -angle, life: SKID_LIFE };
    this.skidIdx = (this.skidIdx + 1) % RENDER3D.skidMax;
  }

  /** رنگ انتخابی گاراژ (فاز ۶) — قبل از ساخت مدل ست می‌شود */
  private playerPaint = '#f4f4f0';

  /**
   * فاز ۶ گاراژ — تغییر رنگ بدنه بازیکن (در منو یا حین بازی)
   * روی هر دو مسیر procedural و GLB کار می‌کند (GLB رنگ را از مدل قدیم می‌گیرد)
   */
  setPlayerPaint(hex: string): void {
    if (typeof hex !== 'string' || !hex.startsWith('#')) return;
    this.playerPaint = hex;
    const m = this.playerModel;
    if (!m) return;
    m.bodyColor = hex;
    m.bodyMat.color.set(hex);
  }

  /** رنگ فعلی گاراژ (برای رندررهای که بعداً ساخته می‌شوند) */
  get currentPaint(): string {
    return this.playerPaint;
  }

  /**
   * آسیب بازیکن — نقطه برخورد داینامیک (فاز BIG-IR):
   * تیرگی بدنه + کج شدن + جدا شدن سپر با پرتاب ذرات در نقطه سپر
   */
  onPlayerDamaged(damage: number, front: boolean, contactX: number, contactY: number): void {
    applyDamageVisual(this.playerModel, damage);
    // سپر: بعد از آسیب تجمعی کافی جدا می‌شود
    const cumulative = front ? this.playerFrontHits : this.playerRearHits;
    this.playerFrontHits += front ? damage : 0;
    this.playerRearHits += front ? 0 : damage;
    if (cumulative + damage >= 34) {
      const bumper = front ? this.playerModel.bumpers.front : this.playerModel.bumpers.rear;
      if (bumper && detachBumper(this.playerModel, front)) {
        this.tmpV.setFromMatrixPosition(bumper.matrixWorld);
        this.spawnBurst(this.tmpV.x, this.tmpV.z, '#3a3a3a', 10, 220);
      }
    }
    // جرقه در نقطه تماس
    this.spawnBurst(contactX, contactY, front ? '#ffd27a' : '#c9c9c9', 6, 200);
  }
  private playerFrontHits = 0;
  private playerRearHits = 0;

  /** بعد از تعمیر/اسکران: بدنه تمیز می‌شود (بازگرداندن سپر + رنگ) */
  resetPlayerDamage(): void {
    this.playerFrontHits = 0;
    this.playerRearHits = 0;
    const m = this.playerModel;
    m.bodyMat.color.set(m.bodyColor);
    m.group.rotation.z = 0;
    if (m.bumpers.front) m.bumpers.front.visible = true;
    if (m.bumpers.rear) m.bumpers.rear.visible = true;
  }

  /** به‌روزرسانی افکت‌ها (هر فریم، مستقل از گام فیزیک) */
  update(dt: number): void {
    // ذرات
    let anyAlive = false;
    let anyDead = false;
    for (const p of this.particles) {
      if (!p.active) continue;
      p.life -= dt;
      if (p.life <= 0) { p.active = false; anyDead = true; continue; }
      if (p.debris) {
        // فیزیک لاشه: جهش + اصطکاک + چرخش + آرامش روی زمین
        if (!p.rested) {
          p.x += p.vx * dt;
          p.z += p.vz * dt;
          p.y += p.vy * dt;
          p.vy -= 620 * dt;
          p.spin = (p.spin ?? 0) + (p.spinRate ?? 0) * dt;
          if (p.y <= p.size * 0.5) {
            p.y = p.size * 0.5;
            if (Math.abs(p.vy) < 60) {
              p.rested = true;
              p.vy = 0; p.vx = 0; p.vz = 0; p.spinRate = 0;
            } else {
              p.vy *= -DEBRIS.bounce;
              p.vx *= 0.72; p.vz *= 0.72;
              p.spinRate = (p.spinRate ?? 0) * 0.6;
            }
          }
        }
        // محو در ثانیه آخر
        anyAlive = true;
      } else {
        p.x += p.vx * dt;
        p.z += p.vz * dt;
        p.y += p.vy * dt;
        p.vy -= 560 * dt;
        p.vx *= 0.94;
        p.vz *= 0.94;
        if (p.y < 12) { p.y = 12; p.vy *= -0.3; }
        anyAlive = true;
      }
    }
    if (anyDead) this.particles = this.particles.filter((p) => p.active);
    // رد لاستیک
    for (const s of this.skidData) {
      if (s.life > 0) s.life -= dt;
    }
    // حباب‌ها
    for (let i = this.bubbles.length - 1; i >= 0; i--) {
      this.bubbles[i].ttl -= dt;
      if (this.bubbles[i].ttl <= 0) this.bubbles.splice(i, 1);
    }
    if (anyAlive || anyDead) this.syncParticles();
  }

  // ============ رسم اصلی ============

  /** dt واقعی فریم رندر برای انیمیشن‌ها — فرض ۱/۶۰ روی نمایشگر ۱۲۰Hz دوبرابر سریع می‌شد (فاز APK-FIX) */
  private lastDrawNow = 0;
  private drawDt(): number {
    const now = performance.now();
    const dt = this.lastDrawNow > 0 ? (now - this.lastDrawNow) / 1000 : 1 / 60;
    this.lastDrawNow = now;
    return Math.min(0.05, Math.max(0.001, dt));
  }

  draw3D(opts: Draw3DOptions): void {
    const t = performance.now() / 1000;
    const car = opts.car;

    // ---------- ماشین بازیکن ----------
    this.playerModel.group.position.set(car.x, 0, car.y);
    this.playerModel.group.rotation.y = -car.angle;
    const wheelR = car.drawH * 0.135;
    const spin = (car.speed / wheelR) * this.drawDt();
    spinWheels(this.playerModel, spin);

    // ---------- فاز OVERHAUL: ترمز/فرمان/رول/پیک بدنه بازیکن ----------
    const pmodel = this.playerModel;
    // چراغ ترمز
    if (pmodel.tailMat?.emissive) {
      const on = opts.braking === true;
      pmodel.tailMat.emissive.set(on ? '#ff1a08' : '#5a0f08');
      pmodel.tailMat.emissiveIntensity = on ? 2.4 : 0.7;
    }
    // فرمان بصری چرخ‌های جلو — با محور واقعی هر پیوت
    const steerTarget = (opts.steer ?? 0) * 0.42;
    this.steerVis += (steerTarget - this.steerVis) * Math.min(1, 10 * 0.016);
    steerWheels(pmodel, this.steerVis);
    // رول بدنه (خم به بیرون پیچ) + پیک گاز/ترمز
    const rollTarget = Math.max(-0.08, Math.min(0.08, -car.latVel * 0.0006));
    this.rollVis += (rollTarget - this.rollVis) * Math.min(1, 6 * 0.016);
    const pitchTarget = opts.braking ? 0.035 : opts.accelerating ? -0.022 : 0;
    this.pitchVis += (pitchTarget - this.pitchVis) * Math.min(1, 5 * 0.016);
    pmodel.rollZ = this.rollVis;
    pmodel.pitchX = this.pitchVis;
    pmodel.group.rotation.z = (pmodel.damageTiltZ ?? 0) + this.rollVis;
    pmodel.group.rotation.x = this.pitchVis;

    // ---------- ترافیک (GLB با fallback procedural + LOD + چراغ ترمز) ----------
    const seen = new Set<TrafficCar>();
    for (const c of opts.traffic) {
      seen.add(c);
      let model = this.trafficModels.get(c);
      if (!model) {
        model = this.trafficModelFor(c) ?? buildCar3D(variantFromAssetId(c.assetId), c.drawW, c.drawH);
        (model as unknown as { __prevSpeed?: number }).__prevSpeed = c.speed;
        this.trafficModels.set(c, model);
        this.scene.add(model.group);
      }
      model.group.position.set(c.x, 0, c.y);
      model.group.rotation.y = -c.angle;
      const wr = c.drawH * 0.135;
      spinWheels(model, (c.speed / wr) * this.drawDt());
      // چراغ ترمز ترافیک: کند شدن ناگهانی
      const prev = (model as unknown as { __prevSpeed?: number }).__prevSpeed ?? c.speed;
      const braking = c.speed < prev - 1.5 || (c.speed < 8 && prev < 8 && c.atLight);
      if (model.tailMat?.emissive) {
        model.tailMat.emissive.set(braking ? '#ff1a08' : '#5a0f08');
        model.tailMat.emissiveIntensity = braking ? 2.2 : 0.7;
      }
      (model as unknown as { __prevSpeed?: number }).__prevSpeed = c.speed;
      // LOD: سوییچ نسخه سبک در فاصله دور
      const lodGroup = (model as unknown as { lod1Group?: THREE.Group }).lod1Group;
      if (lodGroup) {
        const dx = c.x - car.x;
        const dy = c.y - car.y;
        const far = dx * dx + dy * dy > this.lodDist * this.lodDist;
        lodGroup.visible = far;
        for (const ch of model.group.children) {
          if (ch === lodGroup) continue;
          ch.visible = !far;
        }
      }
      // چراغ‌گردان پلیس — فلاش متناوب
      if (model.lightBar) {
        const on = Math.sin(t * 9) > 0;
        model.lightBar.red.visible = on;
        model.lightBar.blue.visible = !on;
      }
    }
    for (const [tc, model] of this.trafficModels) {
      if (!seen.has(tc)) {
        this.scene.remove(model.group);
        this.trafficModels.delete(tc);
      }
    }

    // ---------- فاز ۵: ماشین‌های نگهبان جای پارک دوبل ----------
    const guards = opts.guardCars ?? [];
    while (this.guardModels.length < guards.length) {
      const gm = buildCar3D('pride', 104, guards[this.guardModels.length]?.len ?? 195);
      this.guardModels.push(gm);
      this.scene.add(gm.group);
    }
    while (this.guardModels.length > guards.length) {
      const gm = this.guardModels.pop();
      if (gm) this.scene.remove(gm.group);
    }
    for (let i = 0; i < guards.length; i++) {
      const g = guards[i];
      // مدل نگهبان با نوع درست — اگر نوع عوض شد، بساز دوباره (GLB واقعی + fallback procedural)
      let gm = this.guardModels[i];
      if ((gm as unknown as { __kind?: string }).__kind !== g.kind) {
        this.scene.remove(gm.group);
        const kind = g.kind as CarVariant;
        const gscene = this.glbCars.get(kind);
        if (gscene) {
          gm = assembleCarFromGLB(kind, gscene, { external: EXTERNAL_MODELS.has(kind) });
          gm.group.scale.setScalar(g.len / gm.len);
        } else {
          gm = buildCar3D(kind, 104, g.len);
        }
        (gm as unknown as { __kind?: string }).__kind = g.kind;
        this.guardModels[i] = gm;
        this.scene.add(gm.group);
      }
      gm.group.visible = true;
      gm.group.position.set(g.x, 0, g.y);
      gm.group.rotation.set(0, -g.angle, 0);
    }

    // ---------- شکستنی‌ها: همگام با وضعیت World (Instanced) ----------
    this.syncBreakableInstances();

    // ---------- چراغ راهنما ----------
    this.updateTrafficLightLamps();

    // ---------- عابرهای پیاده (با انیمیشن پرتاب/افتادن — فاز SMASH) ----------
    for (let i = 0; i < opts.peds.length; i++) {
      const ped = opts.peds[i];
      if (i >= this.pedModels.length) {
        const m = this.buildPedModel(i);
        this.pedModels.push(m);
        this.scene.add(m.g);
      }
      const pm = this.pedModels[i];
      pm.g.position.set(ped.x, 0, ped.y);
      pm.g.rotation.y = -ped.angle;
      // انیمیشن راه رفتن + پرش ترس
      const swing = Math.sin(t * 8 + ped.phase) * 0.55;
      pm.legL.rotation.x = swing;
      pm.legR.rotation.x = -swing;
      pm.armL.rotation.x = -swing * 0.8;
      pm.armR.rotation.x = swing * 0.8;
      if (ped.knockT > 0) {
        // پرواز: چرخش در هوا + قوس پرتاب
        const k = Math.max(0, Math.min(1, 1 - ped.knockT / PEDS.knockSec));
        pm.g.rotation.z = ped.spin;
        pm.g.rotation.x = 0;
        pm.g.position.y = Math.sin(k * Math.PI) * PEDS.knockHeight;
      } else if (ped.downT > 0) {
        // افتاده روی زمین
        pm.g.rotation.z = 0;
        pm.g.rotation.x = -Math.PI / 2;
        pm.g.position.y = 7;
      } else if (ped.riseT > 0) {
        // بلند شدن تدریجی
        const k = Math.max(0, ped.riseT / PEDS.riseSec);
        pm.g.rotation.z = 0;
        pm.g.rotation.x = -(Math.PI / 2) * k;
        pm.g.position.y = 7 * k;
      } else {
        pm.g.rotation.z = 0;
        pm.g.rotation.x = 0;
        if (ped.hopT > 0) {
          const k = ped.hopT / PEDS.hopSec; // 1→0
          pm.g.position.y = Math.sin((1 - k) * Math.PI) * PEDS.hopHeight;
        } else {
          pm.g.position.y = 0;
        }
      }
    }

    // ---------- سکه‌ها ----------
    const coins = this.world.coins;
    for (let i = 0; i < coins.length; i++) {
      const c = coins[i];
      const bob = Math.sin(t * 3 + this.coinSeeds[i]) * 5;
      if (c.taken) {
        this.tmpS.setScalar(0.0001);
      } else {
        this.tmpS.setScalar(1);
      }
      this.tmpQ.setFromEuler(this.eul.set(0, t * 2.6 + this.coinSeeds[i], 0));
      this.tmpM.compose(this.tmpV.set(c.x, 26 + bob, c.y), this.tmpQ, this.tmpS);
      this.coinMesh.setMatrixAt(i, this.tmpM);
    }
    this.coinMesh.instanceMatrix.needsUpdate = true;
    this.coinMesh.visible = coins.length > 0;

    // ---------- مخروط‌های رویداد ----------
    for (let i = 0; i < this.conePool.length; i++) {
      const mesh = this.conePool[i];
      const c = opts.cones[i];
      if (!c) { mesh.visible = false; continue; }
      mesh.visible = true;
      mesh.position.set(c.x, 26, c.y);
      (mesh.material as THREE.MeshLambertMaterial).opacity = Math.min(1, c.ttl / 2);
    }

    // ---------- گربه ----------
    if (opts.cat) {
      this.catGroup.visible = true;
      const cat = opts.cat;
      this.catGroup.position.set(cat.x, 8 + Math.sin(t * 10 + cat.seed) * 3, cat.y);
      this.catGroup.rotation.y = -Math.atan2(cat.vx, -cat.vy);
    } else {
      this.catGroup.visible = false;
    }

    // ---------- چاله‌های مأموریت ----------
    for (let i = 0; i < opts.potholes.length; i++) {
      if (i >= this.potholeMeshes.length) {
        const geo = new THREE.CircleGeometry(M.potholeRadius * 0.8, 18);
        geo.rotateX(-Math.PI / 2);
        const mesh = new THREE.Mesh(geo, new THREE.MeshBasicMaterial({ color: '#2f2622', depthWrite: false }));
        mesh.position.y = 2.6;
        mesh.renderOrder = 1;
        this.potholeMeshes.push(mesh);
        this.scene.add(mesh);
      }
      const pm = this.potholeMeshes[i];
      const ph = opts.potholes[i];
      pm.visible = true;
      pm.position.set(ph.x, 2.6, ph.y);
      (pm.material as THREE.MeshBasicMaterial).color.set(ph.hit ? '#241c19' : '#2f2622');
    }
    for (let i = opts.potholes.length; i < this.potholeMeshes.length; i++) {
      this.potholeMeshes[i].visible = false;
    }

    // ---------- نشانگر مأموریت ----------
    if (opts.target) {
      this.beacon.visible = true;
      this.beacon.position.set(opts.target.x, 0, opts.target.y);
      const pulse = 0.5 + 0.5 * Math.sin(t * 3.4);
      this.beaconRing.scale.setScalar(0.9 + pulse * 0.12);
      (this.beaconDisc.material as THREE.MeshBasicMaterial).opacity = 0.12 + pulse * 0.1;
      this.beaconArrow.position.y = 130 + Math.sin(t * 4.2) * 14;
      this.beaconArrow.rotation.y = t * 2.2;
    } else {
      this.beacon.visible = false;
    }

    // ---------- حلقه‌های زون تعمیرگاه — پالس آرام ----------
    const rPulse = 0.5 + 0.5 * Math.sin(t * 2.4);
    for (const rz of this.repairRings) {
      rz.children[0].scale.setScalar(0.94 + rPulse * 0.1);
      ((rz.children[0] as THREE.Mesh).material as THREE.MeshBasicMaterial).opacity = 0.55 + rPulse * 0.35;
    }

    // ---------- فاز FPS-1: culling فاصله‌ای شهرک‌های اسکایلاین ----------
    // شهرک‌ها در مه کامل (فاصله > ۳۳۰۰) نامرئی‌اند — رندرشان هدر دادن GPU است.
    // هر شهرک فقط وقتی نزدیک است visible می‌شود (هیچ تغییری بصری ندارد).
    for (const tg of this.skylineTowns) {
      const dx = tg.position.x - car.x;
      const dz = tg.position.z - car.y;
      tg.visible = (dx * dx + dz * dz) < (RENDER3D.townVisRange * RENDER3D.townVisRange);
    }

    // ---------- رد لاستیک (Instanced sync) ----------
    let skidCount = 0;
    for (let i = 0; i < RENDER3D.skidMax; i++) {
      const s = this.skidData[i];
      if (s.life <= 0) continue;
      const k = Math.max(0, Math.min(1, s.life / SKID_LIFE));
      this.tmpQ.setFromEuler(this.eul.set(0, s.rot, 0));
      this.tmpM.compose(this.tmpV.set(s.x, 2.2, s.z), this.tmpQ, this.tmpS.set(24, 1, 15));
      this.skidMesh.setMatrixAt(skidCount, this.tmpM);
      // fade با نزدیک شدن رنگ به آسفالت
      const col = this.tmpC.copy(this.asphaltC).lerp(this.darkC, k * 0.85);
      this.skidMesh.setColorAt(skidCount, col);
      skidCount++;
    }
    this.skidMesh.count = skidCount;
    this.skidMesh.instanceMatrix.needsUpdate = true;
    if (this.skidMesh.instanceColor) this.skidMesh.instanceColor.needsUpdate = true;

    // ---------- دوربین Chase ----------
    const nowMs = performance.now();
    const dt = Math.min(0.1, Math.max(0.0001, (nowMs - this.lastDrawMs) / 1000));
    this.lastDrawMs = nowMs;
    this.updateChaseCamera(car, dt, t);

    // ---------- نور خورشید دنبال بازیکن — زاویه پایین‌تر = سایه‌های بلند سینمایی ----------
    this.sun.position.set(car.x + 520, 640, car.y + 380);
    this.sun.target.position.set(car.x, 0, car.y);
    this.sun.target.updateMatrixWorld();

    // ---------- فاز CINEMATIC: گنبد آسمان + ابرها + هاله خورشید دنبال دوربین ----------
    if (this.skyDome) {
      this.skyDome.position.set(this.cam3.position.x, 0, this.cam3.position.z);
    }
    const ct = t * 0.5;
    for (const cl of this.clouds) {
      const off = cl.userData.cloudOffset as THREE.Vector3;
      const drift = Math.sin(ct + off.x * 0.001) * 260;
      cl.position.set(
        this.cam3.position.x + off.x + drift,
        off.y,
        this.cam3.position.z + off.z,
      );
    }
    if (this.sunGlow) {
      // هاله در جهت نور خورشید نسبت به دوربین
      const dir = this.tmpV.set(520, 640, 380).normalize();
      this.sunGlow.position.set(
        this.cam3.position.x + dir.x * 3600,
        dir.y * 3600,
        this.cam3.position.z + dir.z * 3600,
      );
    }

    // ---------- رندر ----------
    this.r3.render(this.scene, this.cam3);

    // ---------- اورلی (حباب‌ها + فلش هدف) ----------
    this.drawOverlay(opts, t);
  }

  private updateChaseCamera(car: Vehicle, dt: number, _t: number): void {
    // نرم‌سازی زاویه (کوتاه‌ترین مسیر)
    let diff = car.angle - this.camAngle;
    while (diff > Math.PI) diff -= Math.PI * 2;
    while (diff < -Math.PI) diff += Math.PI * 2;
    this.camAngle += diff * Math.min(1, RENDER3D.camAngleLerp * dt);

    const fx = Math.sin(this.camAngle);
    const fz = -Math.cos(this.camAngle);
    const back = RENDER3D.camBack + Math.abs(car.speed) * RENDER3D.camBackPerSpeed;
    const desired = this.tmpP.set(car.x - fx * back, RENDER3D.camHeight, car.y - fz * back);
    const k = 1 - Math.exp(-RENDER3D.camPosLerp * dt);
    this.cam3.position.lerp(desired, k);

    // لرزش از دوربین دوبعدی (برخورد)
    const sh = this.camera.getShake();
    this.cam3.position.x += sh.x * 0.9;
    this.cam3.position.y += Math.abs(sh.y) * 0.5;
    this.cam3.position.z += sh.y * 0.9;

    // نگاه به جلوی ماشین
    const look = this.tmpV.set(car.x + fx * 260, 60, car.y + fz * 260);
    this.cam3.lookAt(look);

    // فاز OVERHAUL: FOV سرعتی — با سرعت، دید کمی بازتر می‌شود (حس سرعت)
    const speedFrac = Math.min(1, Math.abs(car.speed) / 380);
    const targetFov = this.fovBase + speedFrac * 9;
    this.cam3.fov += (targetFov - this.cam3.fov) * Math.min(1, 4 * dt);
    this.cam3.updateProjectionMatrix();
  }

  private syncParticles(): void {
    let n = 0;
    for (const p of this.particles) {
      if (!p.active) continue;
      const k = Math.max(0, p.life / p.maxLife);
      if (p.debris) {
        // لاشه: چرخان + مستطیل‌گونه (تکه واقعی‌تر)
        this.tmpQ.setFromEuler(this.eul.set(p.spin ?? 0, p.spin ?? 0, (p.spin ?? 0) * 0.7));
        const fade = Math.min(1, k * 3); // فقط آخر عمر محو
        this.tmpM.compose(
          this.tmpV.set(p.x, p.y, p.z),
          this.tmpQ,
          this.tmpS.set(p.size, p.size * 0.55, p.size * 0.8).multiplyScalar(0.4 + fade * 0.6),
        );
      } else {
        this.tmpQ.identity();
        this.tmpM.compose(this.tmpV.set(p.x, p.y, p.z), this.tmpQ, this.tmpS.setScalar(p.size * (0.5 + k * 0.5)));
      }
      this.particleMesh.setMatrixAt(n, this.tmpM);
      this.particleMesh.setColorAt(n, p.color);
      n++;
      if (n >= RENDER3D.particleMax) break;
    }
    this.particleMesh.count = n;
    this.particleMesh.instanceMatrix.needsUpdate = true;
    if (this.particleMesh.instanceColor) this.particleMesh.instanceColor.needsUpdate = true;
  }

  // ============ اورلی دوبعدی (متن فارسی RTL) ============

  /** پروجکشن دنیا → صفحه اورلی */
  private worldToScreen(x: number, y: number): { sx: number; sy: number; ok: boolean } {
    this.projV.set(x, 0, y).project(this.cam3);
    if (this.projV.z > 1) return { sx: 0, sy: 0, ok: false };
    return {
      sx: (this.projV.x * 0.5 + 0.5) * this.overlayW,
      sy: (-this.projV.y * 0.5 + 0.5) * this.overlayH,
      ok: true,
    };
  }

  private drawOverlay(opts: Draw3DOptions, _t: number): void {
    const ctx = this.octx;
    const dpr = this.dpr;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, this.overlayW, this.overlayH);

    // فاز CINEMATIC: وینیت ملایم لبه‌ها (زیر HUD — خوانایی حفظ می‌شود)
    const vg = this.ensureVignette();
    ctx.drawImage(vg, 0, 0, this.overlayW, this.overlayH);

    // فلش هدف بیرون کادر
    if (opts.target) {
      this.drawOffscreenArrow(ctx, opts.target, opts.car);
    }

    // مینی‌مپ اول — مستطیلش ذخیره می‌شود تا حباب‌ها رویش نیفتند (فاز APK-FIX)
    this.drawMinimap(ctx, opts);

    // حباب‌های محیطی
    for (const b of this.bubbles) {
      const alpha = Math.max(0, Math.min(1, b.ttl / 0.4));
      ctx.globalAlpha = alpha;
      const p = this.worldToScreen(b.x, b.y);
      if (p.ok) this.drawBubbleBox(ctx, b.text, p.sx, p.sy, 90, b.portraitId);
      ctx.globalAlpha = 1;
    }

    // حباب بازیکن
    if (opts.playerBubble) {
      const p = this.worldToScreen(opts.playerBubble.x, opts.playerBubble.y);
      if (p.ok) this.drawBubbleBox(ctx, opts.playerBubble.line, p.sx, p.sy, opts.car.drawH * 0.75, opts.playerBubble.portrait);
    }

    // فاز OVERHAUL: پنل دیباگ (کلید F) — بخش Y سند مادر
    if (opts.debug) {
      const info = this.r3.info;
      let objs = 0;
      // شمارش فقط هر ۳۰ فریم برای صرفه‌جویی
      this.debugObjCount += 1;
      if (this.debugObjCount % 30 === 0 || this.debugObjCache < 0) {
        this.scene.traverse(() => objs++);
        this.debugObjCache = objs;
      } else objs = this.debugObjCache;
      const lines = [
        `FPS ${opts.fps ?? '-'}`, `DrawCalls ${info.render.calls}`, `Tris ${info.render.triangles.toLocaleString('en')}`,
        `Geoms ${info.memory.geometries} Textures ${info.memory.textures}`, `Objects ${objs}`,
        `Particles ${this.particles.length} Cars ${opts.traffic.length + 1}`,
        `Cam ${Math.round(this.cam3.position.x)},${Math.round(this.cam3.position.y)},${Math.round(this.cam3.position.z)}`,
      ];
      ctx.save();
      ctx.globalAlpha = 0.92;
      ctx.fillStyle = 'rgba(20,16,14,0.88)';
      ctx.fillRect(10, 10, 226, 20 + lines.length * 19);
      ctx.strokeStyle = 'rgba(242,183,5,0.65)';
      ctx.lineWidth = 2;
      ctx.strokeRect(10, 10, 226, 20 + lines.length * 19);
      ctx.fillStyle = '#f2e9c8';
      ctx.font = '600 13px Vazirmatn, monospace, sans-serif';
      ctx.textAlign = 'left';
      ctx.textBaseline = 'top';
      lines.forEach((ln, i) => ctx.fillText(ln, 20, 20 + i * 19));
      ctx.restore();
    }
  }
  private debugObjCount = 0;
  private debugObjCache = -1;

  /** مستطیل مینی‌مپ در فضای اورلی — برای جلوگیری از افتادن حباب متن روی نقشه */
  private minimapRect: { x: number; y: number; w: number; h: number } = { x: 0, y: 0, w: 0, h: 0 };

  /** مینی‌مپ کل تهران بزرگ — بالای صفحه (تا ماشین را نپوشاند) */
  private drawMinimap(ctx: CanvasRenderingContext2D, opts: Draw3DOptions): void {
    const size = Math.min(RENDER3D.minimapSize, this.overlayW * 0.24);
    // فاز CITY-KIT: مینی‌مپ از وسط به گوشه راست رفت (درخواست کاربر — متن‌ها دیگر زیرش نمی‌روند)
    const x0 = this.overlayW - size - 12;
    const y0 = 10;
    const k = size / WORLD_SIZE;
    this.minimapRect = { x: x0, y: y0, w: size, h: size };

    ctx.save();
    // قاب گرد نیمه‌شفاف
    const r = 16;
    ctx.beginPath();
    ctx.moveTo(x0 + r, y0);
    ctx.arcTo(x0 + size, y0, x0 + size, y0 + size, r);
    ctx.arcTo(x0 + size, y0 + size, x0, y0 + size, r);
    ctx.arcTo(x0, y0 + size, x0, y0, r);
    ctx.arcTo(x0, y0, x0 + size, y0, r);
    ctx.closePath();
    ctx.fillStyle = '#2e2622';
    ctx.globalAlpha = 0.97;
    ctx.fill();
    ctx.globalAlpha = 1;
    ctx.strokeStyle = '#F2B705';
    ctx.lineWidth = 3;
    ctx.stroke();
    ctx.clip(); // نقشه از قاب بیرون نزند

    // جاده‌ها (۷ خط سفید دوطرفه — پهن‌تر از قبل)
    ctx.fillStyle = 'rgba(255,255,255,0.78)';
    const nRoads = WR.roadCount + 1;
    for (let i = 0; i < nRoads; i++) {
      const c = roadCenter(i) * k;
      ctx.fillRect(x0 + c - 3, y0, 6, size);
      ctx.fillRect(x0, y0 + c - 3, size, 6);
    }

    // پارک‌ها (زمین سبز)
    ctx.fillStyle = 'rgba(138,201,38,0.35)';
    for (const [pi, pj] of [[2, 2], [4, 2]]) {
      const bx = (pi * WR.pitch + WR.roadW) * k;
      const by = (pj * WR.pitch + WR.roadW) * k;
      ctx.fillRect(x0 + bx, y0 + by, (WR.pitch - WR.roadW) * k, (WR.pitch - WR.roadW) * k);
    }

    // لندمارک‌ها (نقاط برج‌ها — امضای نقشه تهران)
    ctx.fillStyle = '#e8e2d5';
    for (const p of this.world.props) {
      if (p.kind === 'azadiTower' || p.kind === 'miladTower') {
        ctx.beginPath();
        ctx.arc(x0 + (p.x + p.w / 2) * k, y0 + (p.y + p.h / 2) * k, 4.5, 0, Math.PI * 2);
        ctx.fill();
      }
    }

    // زون‌های تعمیرگاه (سبز)
    ctx.fillStyle = '#2A9D8F';
    for (const z of this.world.repairZones) {
      ctx.beginPath();
      ctx.arc(x0 + z.x * k, y0 + z.y * k, 4, 0, Math.PI * 2);
      ctx.fill();
    }

    // ---------- فاز OPEN-WORLD: ۶ شهرک دور نقشه — همه ورودی‌ها همیشه پیدا ----------
    const SW = WORLD_SIZE;
    const half = 2550;
    const edge = -(half - 140);
    const entries: Array<[number, number, number, string]> = [
      [roadCenter(1), edge, 0, ''], [roadCenter(4), edge, 0, ''],
      [SW - edge, roadCenter(3), -Math.PI / 2, 'شهرک غرب ←'],
      [roadCenter(4), SW - edge, Math.PI, ''], [roadCenter(1), SW - edge, Math.PI, ''],
      [edge, roadCenter(4), Math.PI / 2, ''], [edge, roadCenter(1), Math.PI / 2, ''],
    ];
    const gPulse = 0.5 + 0.5 * Math.sin(performance.now() / 300);
    for (const [ex2, ez2, ry2, lbl] of entries) {
      // نوار شهرک (کادر بژ بیرون مرز)
      ctx.fillStyle = 'rgba(196,168,120,0.9)';
      if (ry2 === 0) ctx.fillRect(x0 + ex2 * k - 10, y0, 20, 10);
      else if (ry2 === Math.PI) ctx.fillRect(x0 + ex2 * k - 10, y0 + size - 10, 20, 10);
      else if (ry2 === -Math.PI / 2) ctx.fillRect(x0 + size - 10, y0 + ez2 * k - 10, 10, 20);
      else ctx.fillRect(x0, y0 + ez2 * k - 10, 10, 20);
      // دروازه: نقطه طلایی پالس‌دار
      const gx = x0 + Math.min(Math.max(ex2, -300), SW + 300) * k;
      const gy = y0 + Math.min(Math.max(ez2, -300), SW + 300) * k;
      ctx.fillStyle = `rgba(242,183,5,${0.45 + gPulse * 0.5})`;
      ctx.beginPath();
      ctx.arc(gx, gy, 4.5 + gPulse * 1.2, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = '#3a2e2a';
      ctx.lineWidth = 1.2;
      ctx.stroke();
      if (lbl) {
        ctx.font = `700 ${Math.max(9, size * 0.075)}px Vazirmatn, Tahoma, sans-serif`;
        ctx.textAlign = 'right';
        ctx.textBaseline = 'bottom';
        ctx.fillStyle = 'rgba(255,249,236,0.95)';
        ctx.strokeStyle = 'rgba(30,22,18,0.8)';
        ctx.lineWidth = 2.4;
        ctx.strokeText(lbl, gx - 10, gy - 8);
        ctx.fillText(lbl, gx - 10, gy - 8);
      }
    }

    // هدف مأموریت (لکه زرد پالس‌دار)
    if (opts.target) {
      const pulse = 0.6 + 0.4 * Math.sin(performance.now() / 220);
      ctx.fillStyle = '#F2B705';
      ctx.globalAlpha = pulse;
      ctx.beginPath();
      ctx.arc(x0 + opts.target.x * k, y0 + opts.target.y * k, 6.5, 0, Math.PI * 2);
      ctx.fill();
      ctx.globalAlpha = 1;
    }

    // ترافیک (نقاط سفید کوچک)
    ctx.fillStyle = 'rgba(255,255,255,0.85)';
    for (const c of opts.traffic) {
      ctx.beginPath();
      ctx.arc(x0 + c.x * k, y0 + c.y * k, 2.2, 0, Math.PI * 2);
      ctx.fill();
    }

    // بازیکن: فلش سفید با حاشیه تیره (چرخان با زاویه ماشین) — داخل شهرک = طلایی
    // ⚠️ جهت صحیح: heading دنیا = (sin a, -cos a) → چرخش بوم باید +angle باشد
    // (قبلاً -angle بود → فلش وقتی ماشین شرق/غرب می‌رفت برعکس اشاره می‌کرد!)
    // فاز OPEN-WORLD: مارکر بیرون مرز (شهرک‌ها) هم با هشدار لبه نمایش داده می‌شود
    const OUT = 2600;
    const px = x0 + Math.min(Math.max(opts.car.x, -OUT), WORLD_SIZE + OUT) * k;
    const py = y0 + Math.min(Math.max(opts.car.y, -OUT), WORLD_SIZE + OUT) * k;
    ctx.translate(px, py);
    ctx.rotate(opts.car.angle);
    ctx.beginPath();
    ctx.moveTo(0, -8);
    ctx.lineTo(5.5, 6);
    ctx.lineTo(0, 3);
    ctx.lineTo(-5.5, 6);
    ctx.closePath();
    ctx.fillStyle = opts.car.x > WORLD_SIZE - 100 ? '#F2B705' : '#FFF9EC';
    ctx.fill();
    ctx.lineWidth = 1.6;
    ctx.strokeStyle = '#3a2e2a';
    ctx.stroke();
    ctx.restore();
  }

  /** فلش جهت‌نمای هدف — روی اورلی، هم‌ظاهر نسخه دوبعدی */
  private drawOffscreenArrow(
    ctx: CanvasRenderingContext2D,
    target: { x: number; y: number },
    player: { x: number; y: number },
  ): void {
    const p = this.worldToScreen(target.x, target.y);
    const W = this.overlayW;
    const H = this.overlayH;
    const margin = 84;
    const sx = p.ok ? p.sx : -1e9;
    const sy = p.ok ? p.sy : -1e9;
    if (sx >= margin && sx <= W - margin && sy >= margin && sy <= H - margin) return;

    const cx = Math.min(Math.max(sx, margin), W - margin);
    const cy = Math.min(Math.max(sy, margin), H - margin);
    const ang = Math.atan2(sy - cy, sx - cx);
    const distM = Math.round(Math.hypot(target.x - player.x, target.y - player.y) / M.pxPerMeter);

    ctx.save();
    ctx.fillStyle = 'rgba(58,46,42,0.88)';
    ctx.beginPath();
    ctx.arc(cx, cy, 40, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = '#F2B705';
    ctx.lineWidth = 4;
    ctx.beginPath();
    ctx.arc(cx, cy, 40, 0, Math.PI * 2);
    ctx.stroke();
    ctx.translate(cx, cy);
    ctx.rotate(ang);
    ctx.fillStyle = '#F2B705';
    ctx.beginPath();
    ctx.moveTo(22, 0);
    ctx.lineTo(2, -13);
    ctx.lineTo(2, -5);
    ctx.lineTo(-18, -5);
    ctx.lineTo(-18, 5);
    ctx.lineTo(2, 5);
    ctx.lineTo(2, 13);
    ctx.closePath();
    ctx.fill();
    ctx.rotate(-ang);
    ctx.fillStyle = '#FFF9EC';
    ctx.font = '800 17px Vazirmatn, Tahoma, sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(`${faNum(distM)}م`, 0, 0);
    ctx.restore();
  }

  /**
   * حباب RTL با پرتره — نسخه صفحه‌ای (مختصات پیکسلی اورلی)
   */
  private drawBubbleBox(
    ctx: CanvasRenderingContext2D,
    text: string,
    anchorX: number,
    anchorY: number,
    anchorH = 100,
    portraitId?: string,
  ): void {
    ctx.save();
    ctx.direction = 'rtl';
    // فاز APK-FIX: متن کوچک‌تر برای موبایل (قبلاً ۲۴px خیلی درشت بود)
    ctx.font = '700 16px Vazirmatn, Tahoma, sans-serif';
    ctx.textBaseline = 'middle';
    ctx.textAlign = 'center';

    const maxTextW = 190;
    const words = text.split(' ');
    const lines: string[] = [];
    let current = '';
    for (const w of words) {
      const test = current ? `${current} ${w}` : w;
      if (ctx.measureText(test).width > maxTextW && current) {
        lines.push(current);
        current = w;
      } else current = test;
    }
    if (current) lines.push(current);

    const lineH = 22;
    const portraitR = 19;
    const bubbleW = Math.min(maxTextW + portraitR * 2 + 30, 268);
    const bubbleH = Math.max(52, lines.length * lineH + 26);

    let bx = anchorX - bubbleW / 2;
    let by = anchorY - anchorH / 2 - bubbleH - 18;
    let tailBelow = false;
    if (by < 8) {
      by = anchorY + anchorH / 2 + 18;
      tailBelow = true;
    }
    if (by + bubbleH > this.overlayH - 8) by = this.overlayH - 8 - bubbleH;
    if (by < 8) by = 8;
    bx = Math.min(Math.max(bx, 8), this.overlayW - 8 - bubbleW);
    if (bx < 8) bx = 8;

    // فاز APK-FIX: تداخل با مینی‌مپ؟ اول کنار نقشه برو، وگرنه زیر نقشه
    const mr = this.minimapRect;
    if (mr.w > 0 && bx < mr.x + mr.w && bx + bubbleW > mr.x && by < mr.y + mr.h && by + bubbleH > mr.y) {
      const spaceLeft = mr.x - 10 - bubbleW;
      const spaceRight = this.overlayW - 10 - (mr.x + mr.w) - bubbleW;
      if (spaceLeft >= 0) bx = mr.x - 10 - bubbleW;
      else if (spaceRight >= 0) bx = mr.x + mr.w + 10;
      else {
        const belowMap = mr.y + mr.h + 6;
        if (by < mr.y + mr.h * 0.5 && belowMap + bubbleH < this.overlayH - 8) {
          by = belowMap;
        } else if (!tailBelow && anchorY + anchorH / 2 + 18 + bubbleH < this.overlayH - 8) {
          by = anchorY + anchorH / 2 + 18;
          tailBelow = true;
        }
      }
    }

    // دم — همیشه داخل بدنه بماند (وقتی حباب کنار نقشه می‌رود، دم از لبه بیرون نزند)
    const tailX = Math.min(Math.max(anchorX, bx + 24), bx + bubbleW - 24);
    ctx.fillStyle = '#FFF9EC';
    ctx.strokeStyle = '#3A2E2A';
    ctx.lineWidth = 3;
    ctx.beginPath();
    if (tailBelow) {
      ctx.moveTo(tailX - 10, by + 2);
      ctx.lineTo(tailX, by - 15);
      ctx.lineTo(tailX + 10, by + 2);
    } else {
      ctx.moveTo(tailX - 10, by + bubbleH - 2);
      ctx.lineTo(tailX, by + bubbleH + 15);
      ctx.lineTo(tailX + 10, by + bubbleH - 2);
    }
    ctx.closePath();
    ctx.fill();
    ctx.stroke();

    // بدنه
    ctx.beginPath();
    const r = 14;
    ctx.moveTo(bx + r, by);
    ctx.arcTo(bx + bubbleW, by, bx + bubbleW, by + bubbleH, r);
    ctx.arcTo(bx + bubbleW, by + bubbleH, bx, by + bubbleH, r);
    ctx.arcTo(bx, by + bubbleH, bx, by, r);
    ctx.arcTo(bx, by, bx + bubbleW, by, r);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();

    // پرتره دایره‌ای
    const pid = portraitId ?? 'char_driver_01_idle';
    const pcx = bx + bubbleW - portraitR - 14;
    const pcy = by + bubbleH / 2;
    const asset = this.assets.get(pid);
    const img = asset instanceof AudioBuffer ? undefined : asset;
    if (img) {
      ctx.save();
      ctx.beginPath();
      ctx.arc(pcx, pcy, portraitR, 0, Math.PI * 2);
      ctx.clip();
      ctx.drawImage(img, pcx - portraitR, pcy - portraitR, portraitR * 2, portraitR * 2);
      ctx.restore();
    } else {
      ctx.fillStyle = '#E8C39E';
      ctx.beginPath();
      ctx.arc(pcx, pcy, portraitR, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.strokeStyle = '#3A2E2A';
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.arc(pcx, pcy, portraitR, 0, Math.PI * 2);
    ctx.stroke();

    // متن
    ctx.fillStyle = '#3A2E2A';
    const textAreaCenter = bx + (bubbleW - portraitR * 2 - 18) / 2;
    lines.forEach((ln, i) => {
      ctx.fillText(ln, textAreaCenter, by + bubbleH / 2 + (i - (lines.length - 1) / 2) * lineH);
    });
    ctx.restore();
  }

  // ============ اندازه و پاک‌سازی ============

  /** w/h پیکسل فیزیکی کانواس WebGL + dpr برای اورلی */
  resize(pixelW: number, pixelH: number, dpr: number): void {
    this.dpr = dpr;
    this.r3.setPixelRatio(1);
    this.r3.setSize(pixelW, pixelH, false);
    this.overlay.width = pixelW;
    this.overlay.height = pixelH;
    // ابعاد منطقی برای پروجکشن = پیکسل CSS
    const rect = this.overlay.getBoundingClientRect();
    this.overlayW = rect.width || pixelW / dpr;
    this.overlayH = rect.height || pixelH / dpr;
    // FOV تطبیقی: در صفحه‌های باریک (موبایل عمودی) زاویه دید بازتر می‌شود
    const aspect = this.overlayW / Math.max(1, this.overlayH);
    const extraFov = Math.min(26, Math.max(0, (1 / Math.max(aspect, 0.2) - 1) * 22));
    this.fovBase = RENDER3D.fov + extraFov;
    this.cam3.fov = this.fovBase;
    this.cam3.aspect = aspect;
    this.cam3.updateProjectionMatrix();
  }

  dispose(): void {
    this.scene.traverse((obj) => {
      const mesh = obj as THREE.Mesh;
      if (mesh.geometry) mesh.geometry.dispose();
      const mat = (mesh as unknown as { material?: THREE.Material | THREE.Material[] }).material;
      if (Array.isArray(mat)) mat.forEach((m) => m.dispose());
      else if (mat) mat.dispose();
    });
    // توجه: کانتکت WebGL را نمی‌بندیم (loseContext) — چون کانواس در
    // StrictMode/HMR دوباره استفاده می‌شود و کانتکت همان است.
    this.r3.dispose();
    this.overlay.parentElement?.removeChild(this.overlay);
  }
}
