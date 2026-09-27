/**
 * WorldRenderer3D.ts — رندر سه‌بعدی Low-Poly بازی (فاز 3D)
 * ============================================================
 * منطق بازی دوبعدی می‌ماند؛ این کلاس فقط «نمایش» است:
 *  - مپ مختصات: دنیای دوبعدی (x, y) → صحنه (x, y=ارتفاع, z=y)
 *  - دوربین Chase پشت ماشین + لرزش از Camera دوبعدی
 *  - حباب‌های گفتار فارسی RTL روی کانواس اورلی (بالای WebGL)
 *  - رد لاستیک/ذرات/سکه با InstancedMesh (بهره‌وری)
 * همان API رندر دوبعدی: pushBubble/spawnBurst/addSkidMark
 */

import * as THREE from 'three';
import type { AssetManager } from '../core/AssetManager';
import type { Camera } from '../core/Camera';
import type { Vehicle } from '../entities/Vehicle';
import type { TrafficCar } from '../entities/TrafficCar';
import type { World } from '../world/World';
import type { EventCat, EventCone } from '../managers/RandomEventManager';
import type { Pothole } from '../managers/MissionManager';
import { faNum } from '../managers/MissionManager';
import { RENDER3D, MISSIONS as M, RANDOM_EVENTS as RE } from '../data/balance';
import { WORLD_SIZE } from '../world/World';
import { buildCar3D, variantFromAssetId, type CarModel3D } from './CarFactory3D';
import {
  getRoadStraightTexture, getAsphaltPlainTexture, getSidewalkTexture, getGrassTexture, getFacadeTextures,
} from './textures3d';

// ---------- انواع ورودی ----------
export interface Draw3DOptions {
  car: Vehicle;
  traffic: TrafficCar[];
  cat: EventCat | null;
  cones: EventCone[];
  potholes: Pothole[];
  target: { x: number; y: number } | null;
  /** حباب بازیکن (اگر جمله فعال دارد) */
  playerBubble: { line: string; x: number; y: number; portrait: string } | null;
}

interface AmbientBubble { text: string; x: number; y: number; portraitId?: string; ttl: number; maxTtl: number }
interface Particle3D { x: number; z: number; y: number; vx: number; vz: number; vy: number; life: number; maxLife: number; size: number; active: boolean; color: THREE.Color }

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

  // دوربین
  private camAngle = 0;
  private lastDrawMs = 0;
  private dpr = 1;
  private overlayW = 1;
  private overlayH = 1;

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
  ) {
    this.r3 = new THREE.WebGLRenderer({ canvas: glCanvas, context: gl as WebGL2RenderingContext, antialias: true });
    this.r3.shadowMap.enabled = true;
    // PCFSoftShadowMap در three r186 حذف شده — PCF استاندارد
    this.r3.shadowMap.type = THREE.PCFShadowMap;

    const octx = overlay.getContext('2d');
    if (!octx) throw new Error('Overlay 2D not supported');
    this.octx = octx;

    const sky = new THREE.Color(RENDER3D.skyColor);
    this.scene.background = sky;
    this.scene.fog = new THREE.Fog(sky, RENDER3D.fogNear, RENDER3D.fogFar);

    this.cam3 = new THREE.PerspectiveCamera(RENDER3D.fov, 1, 10, 4200);
    this.cam3.position.set(0, RENDER3D.camHeight, 0);

    // نور
    const hemi = new THREE.HemisphereLight('#ffffff', '#c9b98a', RENDER3D.hemiIntensity);
    this.scene.add(hemi);
    this.sun = new THREE.DirectionalLight('#fff2dd', RENDER3D.sunIntensity);
    this.sun.castShadow = true;
    this.sun.shadow.mapSize.set(1024, 1024);
    this.sun.shadow.camera.left = -780;
    this.sun.shadow.camera.right = 780;
    this.sun.shadow.camera.top = 780;
    this.sun.shadow.camera.bottom = -780;
    this.sun.shadow.camera.near = 100;
    this.sun.shadow.camera.far = 2600;
    this.sun.shadow.bias = -0.0006;
    this.scene.add(this.sun, this.sun.target);

    // دنیا
    this.buildStaticWorld();

    // ماشین بازیکن (ابعاد منطقی پیش‌فرض؛ نسبت 4:7 مثل Asset)
    const pw = 112;
    this.playerModel = buildCar3D('player', pw, Math.round(pw * 1.75));
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
      new THREE.PlaneGeometry(S + 2200, S + 2200),
      new THREE.MeshLambertMaterial({ color: '#C9B98A' }),
    );
    base.rotation.x = -Math.PI / 2;
    base.position.set(S / 2, 0, S / 2);
    base.receiveShadow = true;
    this.scene.add(base);

    // جاده‌ها (۴ عمودی + ۴ افقی)
    const roadTex = getRoadStraightTexture();
    roadTex.repeat.set(1, S / 256);
    const roadMat = new THREE.MeshLambertMaterial({ map: roadTex });
    const roadGeo = new THREE.PlaneGeometry(256, S);
    roadGeo.rotateX(-Math.PI / 2);
    for (let i = 0; i < 4; i++) {
      const cx = i * 1024 + 128;
      const v = new THREE.Mesh(roadGeo, roadMat);
      v.position.set(cx, 1, S / 2);
      v.receiveShadow = true;
      this.scene.add(v);
      const h = new THREE.Mesh(roadGeo, roadMat);
      h.position.set(S / 2, 1, cx);
      h.rotation.y = Math.PI / 2;
      h.receiveShadow = true;
      this.scene.add(h);
    }

    // تقاطع‌ها (آسفالت ساده روی خط‌کشی)
    const asTex = getAsphaltPlainTexture();
    const asMat = new THREE.MeshLambertMaterial({ map: asTex });
    const crossGeo = new THREE.PlaneGeometry(256, 256);
    crossGeo.rotateX(-Math.PI / 2);
    for (let i = 0; i < 4; i++) {
      for (let j = 0; j < 4; j++) {
        const c = new THREE.Mesh(crossGeo, asMat);
        c.position.set(i * 1024 + 128, 1.6, j * 1024 + 128);
        c.receiveShadow = true;
        this.scene.add(c);
      }
    }

    // بلوک‌ها: پیاده‌رو + مرکز (چمن پارک / شن ساختمان‌ها)
    const swMat = new THREE.MeshLambertMaterial({ map: getSidewalkTexture() });
    const grassMat = new THREE.MeshLambertMaterial({ map: getGrassTexture() });
    const yardMat = new THREE.MeshLambertMaterial({ color: '#d4c49a' });
    const swGeo = new THREE.PlaneGeometry(768, 768);
    swGeo.rotateX(-Math.PI / 2);
    const innerGeo = new THREE.PlaneGeometry(640, 640);
    innerGeo.rotateX(-Math.PI / 2);
    for (let i = 0; i < 3; i++) {
      for (let j = 0; j < 3; j++) {
        const bx = i * 1024 + 256;
        const by = j * 1024 + 256;
        const sw = new THREE.Mesh(swGeo, swMat);
        sw.position.set(bx + 384, 0.8, by + 384);
        sw.receiveShadow = true;
        this.scene.add(sw);
        const isPark = i === 1 && j === 1;
        const inner = new THREE.Mesh(innerGeo, isPark ? grassMat : yardMat);
        inner.position.set(bx + 384, 1.2, by + 384);
        inner.receiveShadow = true;
        this.scene.add(inner);
      }
    }

    // ساختمان‌ها و پروپ‌ها از داده World
    for (const p of this.world.props) {
      if (p.kind === 'building') this.buildBuilding(p);
      else this.buildProp(p);
    }

    // جدول مرزی (دید بصری دیوار محدوده)
    const curbMat = new THREE.MeshLambertMaterial({ color: '#a89a72' });
    const curbLen = S + 60;
    const curbH = 30;
    const walls: Array<[number, number, number, number]> = [
      [S / 2, -20, curbLen, 40],
      [S / 2, S + 20, curbLen, 40],
      [-20, S / 2, 40, curbLen],
      [S + 20, S / 2, 40, curbLen],
    ];
    for (const [wx, wz, ww, wd] of walls) {
      const m = new THREE.Mesh(new THREE.BoxGeometry(ww, curbH, wd), curbMat);
      m.position.set(wx, curbH / 2, wz);
      m.castShadow = true;
      m.receiveShadow = true;
      this.scene.add(m);
    }
  }

  private buildBuilding(p: { x: number; y: number; w: number; h: number; assetId?: string; landmark?: boolean }): void {
    const cx = p.x + p.w / 2;
    const cz = p.y + p.h / 2;

    if (p.landmark) {
      // پمپ بنزین: مغازه + سقف سایبان + ستون‌ها + پمپ‌ها
      const shopH = RENDER3D.gasStationShopHeight;
      const shopTex = getFacadeTextures('env_building_shop_01');
      const shopMats = shopTex.map((t) => new THREE.MeshLambertMaterial({ map: t }));
      const shop = new THREE.Mesh(new THREE.BoxGeometry(320, shopH, 300), shopMats);
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

    const h = RENDER3D.buildingHeights[p.assetId as keyof typeof RENDER3D.buildingHeights] ?? 340;
    const tex = getFacadeTextures(p.assetId ?? 'env_building_home_01');
    const mats = tex.map((t) => new THREE.MeshLambertMaterial({ map: t }));
    const box = new THREE.Mesh(new THREE.BoxGeometry(p.w, h, p.h), mats);
    box.position.set(cx, h / 2, cz);
    box.castShadow = true;
    box.receiveShadow = true;
    this.scene.add(box);
  }

  private buildProp(p: { kind: string; x: number; y: number; w: number; h: number }): void {
    const cx = p.x + p.w / 2;
    const cz = p.y + p.h / 2;
    const r = Math.min(p.w, p.h) / 2;
    switch (p.kind) {
      case 'tree': {
        const trunk = new THREE.Mesh(
          new THREE.CylinderGeometry(r * 0.16, r * 0.22, r * 1.1, 8),
          new THREE.MeshLambertMaterial({ color: '#8a5a33' }),
        );
        trunk.position.set(cx, r * 0.55, cz);
        trunk.castShadow = true;
        const blob = new THREE.Mesh(
          new THREE.IcosahedronGeometry(r * 0.92, 0),
          new THREE.MeshLambertMaterial({ color: '#5FA84B' }),
        );
        blob.position.set(cx, r * 1.5, cz);
        blob.castShadow = true;
        const blob2 = new THREE.Mesh(
          new THREE.IcosahedronGeometry(r * 0.55, 0),
          new THREE.MeshLambertMaterial({ color: '#8AC926' }),
        );
        blob2.position.set(cx + r * 0.3, r * 1.9, cz - r * 0.2);
        blob2.castShadow = true;
        this.scene.add(trunk, blob, blob2);
        break;
      }
      case 'trash': {
        const bin = new THREE.Mesh(
          new THREE.CylinderGeometry(r * 0.8, r * 0.66, r * 1.5, 10),
          new THREE.MeshLambertMaterial({ color: '#4F772D' }),
        );
        bin.position.set(cx, r * 0.75, cz);
        bin.castShadow = true;
        this.scene.add(bin);
        break;
      }
      case 'pole': {
        const pole = new THREE.Mesh(
          new THREE.CylinderGeometry(r * 0.14, r * 0.16, r * 4.2, 8),
          new THREE.MeshLambertMaterial({ color: '#8D99AE' }),
        );
        pole.position.set(cx, r * 2.1, cz);
        pole.castShadow = true;
        const lamp = new THREE.Mesh(
          new THREE.SphereGeometry(r * 0.3, 10, 8),
          new THREE.MeshBasicMaterial({ color: '#EF476F' }),
        );
        lamp.position.set(cx, r * 4.3, cz);
        this.scene.add(pole, lamp);
        break;
      }
      case 'cone': {
        const cone = new THREE.Mesh(
          new THREE.ConeGeometry(r * 0.75, r * 1.7, 10),
          new THREE.MeshLambertMaterial({ color: '#F4A261' }),
        );
        cone.position.set(cx, r * 0.85, cz);
        cone.castShadow = true;
        const band = new THREE.Mesh(
          new THREE.CylinderGeometry(r * 0.42, r * 0.5, r * 0.28, 10),
          new THREE.MeshLambertMaterial({ color: '#FFFFFF' }),
        );
        band.position.set(cx, r * 1.0, cz);
        this.scene.add(cone, band);
        break;
      }
    }
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

  // ============ API عمومی (هم‌امضای رندر دوبعدی) ============

  /** حباب گفتار محیطی (ترافیک/تاکسی) */
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

  /** رد لاستیک درفت — حلقه‌ای (قدیمی‌ها fade با رنگ نزدیک آسفالت) */
  addSkidMark(x: number, y: number, angle: number): void {
    const idx = this.skidIdx;
    this.skidData[idx] = { x, z: y, rot: -angle, life: SKID_LIFE };
    this.skidIdx = (this.skidIdx + 1) % RENDER3D.skidMax;
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
      p.x += p.vx * dt;
      p.z += p.vz * dt;
      p.y += p.vy * dt;
      p.vy -= 560 * dt;
      p.vx *= 0.94;
      p.vz *= 0.94;
      if (p.y < 12) { p.y = 12; p.vy *= -0.3; }
      anyAlive = true;
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
  draw3D(opts: Draw3DOptions): void {
    const t = performance.now() / 1000;
    const car = opts.car;

    // ---------- ماشین بازیکن ----------
    this.playerModel.group.position.set(car.x, 0, car.y);
    this.playerModel.group.rotation.y = -car.angle;
    const wheelR = car.drawH * 0.135;
    const spin = (car.speed / wheelR) * (1 / 60);
    for (const w of this.playerModel.wheels) w.rotation.x += spin;

    // ---------- ترافیک ----------
    const seen = new Set<TrafficCar>();
    for (const c of opts.traffic) {
      seen.add(c);
      let model = this.trafficModels.get(c);
      if (!model) {
        model = buildCar3D(variantFromAssetId(c.assetId), c.drawW, c.drawH);
        this.trafficModels.set(c, model);
        this.scene.add(model.group);
      }
      model.group.position.set(c.x, 0, c.y);
      model.group.rotation.y = -c.angle;
      const wr = c.drawH * 0.135;
      for (const w of model.wheels) w.rotation.x += (c.speed / wr) * (1 / 60);
    }
    for (const [tc, model] of this.trafficModels) {
      if (!seen.has(tc)) {
        this.scene.remove(model.group);
        this.trafficModels.delete(tc);
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

    // ---------- نور خورشید دنبال بازیکن ----------
    this.sun.position.set(car.x + 420, 760, car.y + 320);
    this.sun.target.position.set(car.x, 0, car.y);
    this.sun.target.updateMatrixWorld();

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
  }

  private syncParticles(): void {
    let n = 0;
    for (const p of this.particles) {
      if (!p.active) continue;
      const k = Math.max(0, p.life / p.maxLife);
      this.tmpQ.identity();
      this.tmpM.compose(this.tmpV.set(p.x, p.y, p.z), this.tmpQ, this.tmpS.setScalar(p.size * (0.5 + k * 0.5)));
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

    // فلش هدف بیرون کادر
    if (opts.target) {
      this.drawOffscreenArrow(ctx, opts.target, opts.car);
    }

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
   * هم‌ظاهر WorldRenderer.drawBubbleBox دوبعدی
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
    ctx.font = '700 24px Vazirmatn, Tahoma, sans-serif';
    ctx.textBaseline = 'middle';
    ctx.textAlign = 'center';

    const maxTextW = 260;
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

    const lineH = 32;
    const portraitR = 26;
    const bubbleW = Math.min(maxTextW + portraitR * 2 + 40, 360);
    const bubbleH = Math.max(72, lines.length * lineH + 34);

    let bx = anchorX - bubbleW / 2;
    let by = anchorY - anchorH / 2 - bubbleH - 22;
    let tailBelow = false;
    if (by < 8) {
      by = anchorY + anchorH / 2 + 22;
      tailBelow = true;
    }
    if (by + bubbleH > this.overlayH - 8) by = this.overlayH - 8 - bubbleH;
    if (by < 8) by = 8;
    bx = Math.min(Math.max(bx, 8), this.overlayW - 8 - bubbleW);
    if (bx < 8) bx = 8;

    // دم
    ctx.fillStyle = '#FFF9EC';
    ctx.strokeStyle = '#3A2E2A';
    ctx.lineWidth = 4;
    ctx.beginPath();
    if (tailBelow) {
      ctx.moveTo(anchorX - 13, by + 2);
      ctx.lineTo(anchorX, by - 20);
      ctx.lineTo(anchorX + 13, by + 2);
    } else {
      ctx.moveTo(anchorX - 13, by + bubbleH - 2);
      ctx.lineTo(anchorX, by + bubbleH + 20);
      ctx.lineTo(anchorX + 13, by + bubbleH - 2);
    }
    ctx.closePath();
    ctx.fill();
    ctx.stroke();

    // بدنه
    ctx.beginPath();
    const r = 18;
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
    ctx.lineWidth = 3.5;
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
    // اندازه CSS اورلی = ۱۰۰٪ والد (در DOM تنظیم شده)
    // ابعاد منطقی برای پروجکشن = پیکسل CSS
    const rect = this.overlay.getBoundingClientRect();
    this.overlayW = rect.width || pixelW / dpr;
    this.overlayH = rect.height || pixelH / dpr;
    // FOV تطبیقی: در صفحه‌های باریک (موبایل عمودی) زاویه دید بازتر می‌شود
    const aspect = this.overlayW / Math.max(1, this.overlayH);
    const extraFov = Math.min(26, Math.max(0, (1 / Math.max(aspect, 0.2) - 1) * 22));
    this.cam3.fov = RENDER3D.fov + extraFov;
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
