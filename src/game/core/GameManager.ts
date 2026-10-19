/**
 * GameManager.ts — قلب بازی: حلقه، وضعیت‌ها، اتصال همه مدیرها
 * ============================================================
 * - Fixed Timestep 1/120 (ARCHITECTURE بخش ۳) — رفتار یکسان روی هر صفحه‌نمایش
 * - ماشین‌حالت: menu / playing / paused
 * - هیچ خطایی حلقه را نمی‌بندد (ARCHITECTURE بخش ۸)
 */

import { AssetManager } from './AssetManager';
import { InputManager } from './InputManager';
import { Camera } from './Camera';
import { SaveManager } from './SaveManager';
import { AudioManager } from '../managers/AudioManager';
import { VoiceManager } from '../managers/VoiceManager';
import { TrafficManager } from '../managers/TrafficManager';
import { RandomEventManager } from '../managers/RandomEventManager';
import { PedestrianManager } from '../managers/PedestrianManager';
import { MissionManager, faNum, type MissionHud, type GuardCar } from '../managers/MissionManager';
import type { MissionCategory } from '../data/missions';
import { Vehicle } from '../entities/Vehicle';
import { DIR_INFO } from '../entities/TrafficCar';
import { obbFromAngle, satOverlapMTV } from '../entities/obb';
import { World, type WorldProp } from '../world/World';
import { TrafficLights } from '../world/TrafficLights';
import { WorldRenderer } from '../world/WorldRenderer';
import { WorldRenderer3D } from '../render3d/WorldRenderer3D';
import type { CarVariant } from '../render3d/CarFactory3D';
import { RENDER, VEHICLE_PHYSICS, REPUTATION, IDLE_EVENTS, CAMERA as CAM, COLLISION, TRAFFIC, DRIFT, MISSIONS, RENDER3D, DAMAGE, BREAKABLE, PEDESTRIANS, PARKED_HIT, TRAFFIC_LIGHTS, DEBRIS } from '../data/balance';
import { UPGRADES, PAINTS, nextUpgradePrice, upgradeTuning, upgradeById, paintById, NEUTRAL_TUNING, type UpgradeId, type VehicleTuning } from '../data/garage';
import { HORN_LIST, HORN_REACT, HORN_OWNER_EVENT, HORN_FLAVOR, hornById, type HornId } from '../data/horns';
import { MISSION_LIST } from '../data/missions';
import { PLAYER_VEHICLES, vehicleById } from '../data/vehicles';
import { roadCenter, WORLD as WR } from '../world/World';
import { SPEAKER_PORTRAIT } from '../data/assets.manifest';
import { DIALOGUES } from '../data/dialogues';

export type GameState = 'boot' | 'menu' | 'playing' | 'paused';

  /** مشترک بین دو رندرر — افکت‌هایی که GameManager مستقیماً صدا می‌زند */
interface EffectsRenderer {
  update(dt: number): void;
  pushBubble(text: string, x: number, y: number, portraitId?: string, ttl?: number): void;
  spawnBurst(x: number, y: number, color: string, count?: number, power?: number): void;
  addSkidMark(x: number, y: number, angle: number): void;
  /** لاشه تصادف (اختیاری — فقط رندر سه‌بعدی) */
  spawnDebris?(x: number, y: number, color: string, count?: number, power?: number, size?: number): void;
}

export interface HudData {
  speedKmh: number;
  coins: number;
  reputation: number;
  fps: number;
  showFps: boolean;
  placeholders: number;
  mission: MissionHud | null;
  /** سلامت ماشین ۰..۱۰۰ (فاز BIG-IR) */
  health: number;
  /** موتور خاموش است؟ (اورلی اسکران) */
  engineDead: boolean;
}

/** نتیجه مأموریت برای پوسته React (فاز 4) */
export interface MissionResultData {
  success: boolean;
  /** رتبهٔ عملکرد مأموریت: صفر در شکست، ۱ تا ۳ ستاره در پیروزی */
  stars: number;
  missionId: string;
  title: string;
  /** جایزه نهایی سکه (با بونوس آبروی بالا) */
  coins: number;
  /** تغییر آبرو (+) */
  rep: number;
  /** علت شکست (time_up / engine_died / ...) */
  reason: string | null;
  /** جمله طنز انتخاب‌شده */
  line: string;
  /** فاز ۷ — عنوان مأموریت زنجیره‌ای که با این پیروزی باز شد (null = هیچ) */
  unlockedNext: string | null;
}

export interface GameCallbacks {
  onStateChange?: (s: GameState) => void;
  onHud?: (h: HudData) => void;
  onMissionEnd?: (r: MissionResultData) => void;
}

/** نمای کامل گاراژ برای پوسته React (فاز ۶) */
export interface GarageView {
  coins: number;
  vehicles: Array<{
    id: string;
    name: string;
    variant: string;
    speed: number;
    acceleration: number;
    handling: number;
    durability: number;
    price: number;
    description: string;
    flavor: string;
    owned: boolean;
    selected: boolean;
  }>;
  upgrades: Array<{
    id: UpgradeId;
    title: string;
    effect: string;
    level: number;
    maxLevel: number;
    /** null = حداکثر رسیده */
    nextPrice: number | null;
  }>;
  paints: Array<{
    id: string;
    name: string;
    hex: string;
    price: number;
    owned: boolean;
    selected: boolean;
  }>;
  /** فاز ۷ — فروشگاه بوق‌ها */
  horns: Array<{
    id: string;
    name: string;
    price: number;
    desc: string;
    owned: boolean;
    selected: boolean;
  }>;
}

/** نتیجه خرید گاراژ برای toast پوسته */
export interface PurchaseResult {
  ok: boolean;
  coins: number;
  msg: string;
}

const FIXED_DT = 1 / 120;

export class GameManager {
  /** ⭐ گارد تک‌نمونه: در هر لحظه فقط یک GameManager زنده مجاز است
   *  (جلوگیری از نمونه زامبی در StrictMode/HMR که کانواس را دوباره می‌کشد) */
  private static live: GameManager | null = null;

  private ctx: CanvasRenderingContext2D | null = null;
  private assets = new AssetManager();
  private input = new InputManager();
  private camera = new Camera();
  private save = new SaveManager();
  private audio = new AudioManager();
  private voice = new VoiceManager();
  private world = new World();
  /** رندر دوبعدی (fallback وقتی WebGL نیست) */
  private renderer: WorldRenderer | null = null;
  /** رندر سه‌بعدی (مسیر اصلی — فاز 3D) */
  private renderer3d: WorldRenderer3D | null = null;
  /** افکت‌های مشترک دو رندرر */
  private fx: EffectsRenderer;
  /** حالت رندر (برای QA) */
  readonly is3D: boolean;
  private vehicle = new Vehicle();
  private traffic: TrafficManager;
  private randomEvents: RandomEventManager;
  private peds: PedestrianManager;
  private mission: MissionManager;
  /** چراغ‌های راهنما (فاز OVERHAUL) */
  private lights = new TrafficLights();
  /** آخرین ورودی — برای رندر (ترمز/فرمان) */
  private lastInput = { gas: false, brake: false, steer: 0 };
  private redRunnerCooldown = 0;

  private state: GameState = 'boot';
  private raf = 0;
  private lastFrame = 0;
  private accumulator = 0;
  /** سقف رندر ۶۰فریم (ادغام از شاخهٔ کاربر) — شبیه‌سازی مستقل ادامه دارد */
  private lastRenderAt = 0;
  private visualAccumulator = 0;
  private scale = 1;
  private showFps = false;
  private fpsAccum = 0;
  private fpsCount = 0;
  private fpsValue = 60;

  private idleTimerSec = 12;
  private crashCooldown = 0;
  private bumpCooldown = 0;
  private breakCooldown = 0;
  private damageSmokeTimer = 0;
  private repairVoiceLatch = false;
  private engineDeadShown = false;
  private brakeSoundLatch = false;
  private skidSoundTimer = 0;
  private smokeTimer = 0;
  private hudThrottle = 0;
  private disposed = false;
  /** فاز ۵: لچ برخورد شدید همین گام — برای واکنش مسافر تاکسی */
  private hardCrashLatch = false;

  constructor(
    private canvas: HTMLCanvasElement,
    private callbacks: GameCallbacks = {},
  ) {
    // هر نمونه قبلیِ زنده را ببند (بازهم اگر جایی نشتی داشته باشد)
    if (GameManager.live && GameManager.live !== this) GameManager.live.dispose();
    GameManager.live = this;

    // ---------- انتخاب رندرر: اول WebGL (سه‌بعدی)، بعد 2D ----------
    // توجه: بعد از گرفتن یک نوع کانتکست، نوع دیگر روی همان کانواس ممکن نیست
    // فاز FPS-1: در موبایل MSAA گران است — با pixelRatio=1 لازم نیست؛ خاموش می‌کنیم
    const coarsePointer = typeof matchMedia !== 'undefined'
      && matchMedia('(pointer: coarse)').matches;
    const glOpts: WebGLContextAttributes = {
      antialias: !coarsePointer,
      powerPreference: 'high-performance',
    };
    const gl = (canvas.getContext('webgl2', glOpts)
      ?? canvas.getContext('webgl', glOpts)) as WebGL2RenderingContext | WebGLRenderingContext | null;
    if (gl) {
      this.is3D = true;
      const overlay = document.createElement('canvas');
      overlay.style.cssText = 'position:absolute;inset:0;width:100%;height:100%;pointer-events:none;z-index:5;';
      canvas.parentElement?.appendChild(overlay);
      this.renderer3d = new WorldRenderer3D(canvas, gl, overlay, this.assets, this.world, this.camera, this.lights);
      this.fx = this.renderer3d;
    } else {
      this.is3D = false;
      const ctx = canvas.getContext('2d');
      if (!ctx) throw new Error('Canvas 2D not supported');
      this.ctx = ctx;
      const r2d = new WorldRenderer(this.assets, this.world, this.camera);
      this.renderer = r2d;
      this.fx = r2d;
    }

    // ترافیک و رویدادهای تصادفی (فاز 2)
    // فاز GTA-IR v0.2.12: + رنو۴ و قدیمی زنگ‌زده (مدل‌های جدید کاربر)
    this.traffic = new TrafficManager(
      [
        'veh_pride_01', 'veh_sedan_01', 'veh_samand_01', 'veh_renault4_01',
        'veh_samand_01', 'veh_pride_01', 'veh_taxi_01', 'veh_vintage_01',
        'veh_renault4_01', 'veh_pride_01', 'veh_taxi_01', 'veh_samand_01',
        'veh_tiba_01', 'veh_pickup_01', 'veh_police_01', 'veh_renault4_01',
      ],
      { onHonk: (car) => this.onTrafficHonk(car) },
      (() => {
        const s = this.world.playerSpawn();
        return { x: s.x, y: s.y, r: 420 };
      })(),
      this.lights,
    );
    this.randomEvents = new RandomEventManager({
      onEvent: (kind, x, y) => this.onRandomEvent(kind, x, y),
    });
    // عابرهای پیاده (فاز BIG-IR) — ترس از ماشین سریع
    this.peds = new PedestrianManager({
      onScare: (x, y) => this.onPedScare(x, y),
    });
    // مأموریت‌ها (فاز 4 + فاز ۵)
    this.mission = new MissionManager(this.world, {
      onPothole: (x, y) => this.onPotholeHit(x, y),
      onSucceed: (def, stats) => this.finishMission(true, def.id, def.rewardCoins, def.rewardRep, null, stats),
      onFail: (def, reason) => this.finishMission(false, def.id, 0, 0, reason, null),
      // فاز ۵: مسافر سوار شد — حباب مسافر + جمله
      onTaxiPickup: (x, y) => {
        this.fx.pushBubble(this.pickLine('taxi_pickup'), x, y, 'char_pass_m_01_idle', 2.8);
        this.voice.trigger('taxi_pickup', performance.now());
        this.fx.spawnBurst(x, y, '#8AC926', 10, 120);
      },
      // فاز ۵: چک‌پوینت رد شد
      onCheckpoint: (x, y, i) => {
        this.audio.coin();
        this.fx.spawnBurst(x, y, '#F2B705', 12, 140);
        this.fx.pushBubble(`چک‌پوینت ${faNum(i)}!`, x, y, 'char_driver_01_idle', 1.6);
      },
    });

    // فاز 7: اتصال فایل‌های صوتی واقعی + hook جمله صوتی برای VoiceManager
    this.audio.attachAssets((id) => this.assets.get(id));
    this.voice.setAudioHook({
      playVoiceFile: (eventKey, index) => this.audio.playVoiceFile(eventKey, index),
    });

    this.input.attach();

    window.addEventListener('resize', this.handleResize);
    window.addEventListener('keydown', this.onKeyDown);
    document.addEventListener('visibilitychange', this.onVisibility);
    window.addEventListener('beforeunload', this.onBeforeUnload);
    this.handleResize();

    // دسته دیباگ برای کنسول/QA (بی‌خطر در Production) — مثال: __funnycar.pressHorn()
    (window as unknown as { __funnycar?: GameManager }).__funnycar = this;
  }

  // ============ راه‌اندازی ============
  async boot(onProgress?: (done: number, total: number) => void): Promise<void> {
    try {
      await this.assets.loadAll((done, total) => {
        // Keep the loading screen honest: asset files are only 70% of boot; GLB models follow.
        onProgress?.(Math.round((done / Math.max(1, total)) * 70), 100);
      });
    } catch (err) {
      console.warn('[Game] asset boot error (continuing with placeholders):', err);
    }
    // تمام Assetهای دوبعدی و تمام مدل‌های GLB (خودروها، LODها، ساختمان‌ها، پارکی و کیت شهر)
    // باید پیش از بازشدن منو/گاراژ تعیین تکلیف شوند. روی دستگاه کند صبر می‌کنیم؛
    // تا آماده‌شدن همهٔ مدل‌ها صفحهٔ لودینگ فعال می‌ماند؛ زمان لودینگ عمداً محدود نشده است.
    try {
      await this.renderer3d?.whenReady();
      onProgress?.(100, 100);
    } catch (err) {
      console.warn('[Game] GLB preload failed:', err);
    }
    // مقیاس رسم ماشین از اندازه Asset واقعی/Placeholder — نسبت ثابت 4:7
    const size = this.assets.getSize('veh_player_01');
    if (size.w > 0) {
      this.vehicle.drawW = 112;
      this.vehicle.drawH = Math.round(112 * (size.h / size.w));
    }
    const spawn = this.world.playerSpawn();
    this.vehicle.reset(spawn.x, spawn.y, spawn.angle);
    this.camera.snapTo(spawn.x, spawn.y);
    // فاز ۶ گاراژ: اعمال آپگریدهای سیو + رنگ انتخابی روی مدل سه‌بعدی
    this.applyGarageToVehicle();
    const savedPaint = paintById(this.save.get().paint);
    if (savedPaint && this.renderer3d) this.renderer3d.setPlayerPaint(savedPaint.hex);
    const savedVehicle = vehicleById(this.save.get().selectedVehicle);
    if (savedVehicle && this.renderer3d) this.renderer3d.setPlayerVehicle(savedVehicle.variant as CarVariant);
    this.setState('menu');
    this.loop(performance.now());
  }

  // ============ گاراژ عمو نقی (فاز ۶) ============

  /** تیون پایه هر خودرو؛ انتخاب ماشین باید در حس رانندگی هم اثر واقعی داشته باشد. */
  private vehicleHandling(variant: string): VehicleTuning {
    const presets: Record<string, VehicleTuning> = {
      player:    { maxSpeedMul: 1.00, accelMul: 1.00, brakeMul: 1.00, gripMul: 1.00, steerMul: 1.00, armorMul: 1.00 },
      pride:     { maxSpeedMul: 0.97, accelMul: 1.07, brakeMul: 0.98, gripMul: 1.08, steerMul: 1.10, armorMul: 0.92 },
      tiba:      { maxSpeedMul: 1.02, accelMul: 1.03, brakeMul: 1.00, gripMul: 1.04, steerMul: 1.05, armorMul: 0.96 },
      peugeot405:{ maxSpeedMul: 1.05, accelMul: 0.99, brakeMul: 1.04, gripMul: 0.98, steerMul: 0.97, armorMul: 1.08 },
      samand:    { maxSpeedMul: 0.99, accelMul: 0.98, brakeMul: 1.06, gripMul: 1.01, steerMul: 0.95, armorMul: 1.12 },
      nissan:    { maxSpeedMul: 0.89, accelMul: 0.91, brakeMul: 1.08, gripMul: 0.90, steerMul: 0.86, armorMul: 1.25 },
      renault4:  { maxSpeedMul: 0.92, accelMul: 0.96, brakeMul: 1.00, gripMul: 1.10, steerMul: 1.07, armorMul: 0.93 },
      vintage:   { maxSpeedMul: 1.08, accelMul: 1.04, brakeMul: 0.93, gripMul: 0.92, steerMul: 1.02, armorMul: 0.86 },
    };
    return presets[variant] ?? NEUTRAL_TUNING;
  }

  /** ترکیب ویژگی ذاتی خودرو با آپگریدهای گاراژ؛ آپگریدها روی همه خودروها حفظ می‌شوند. */
  private applyGarageToVehicle(): void {
    const d = this.save.get();
    const vehicle = vehicleById(d.selectedVehicle);
    const base = this.vehicleHandling(vehicle?.variant ?? 'player');
    const upgraded = d.upgrades ? upgradeTuning(d.upgrades) : { ...NEUTRAL_TUNING };
    this.vehicle.tune = {
      maxSpeedMul: base.maxSpeedMul * upgraded.maxSpeedMul,
      accelMul: base.accelMul * upgraded.accelMul,
      brakeMul: base.brakeMul * upgraded.brakeMul,
      gripMul: base.gripMul * upgraded.gripMul,
      steerMul: base.steerMul * upgraded.steerMul,
      armorMul: base.armorMul * upgraded.armorMul,
    };
  }

  /** فهرست کامل گاراژ برای پوسته React (آپگریدها + رنگ‌ها + سکه) */
  listGarage(): GarageView {
    const d = this.save.get();
    return {
      coins: d.coins,
      vehicles: PLAYER_VEHICLES.map((v) => {
        const base = this.vehicleHandling(v.variant);
        const upgraded = d.upgrades ? upgradeTuning(d.upgrades) : { ...NEUTRAL_TUNING };
        // Show the actual car setup, not just its factory baseline. The same
        // upgrade tuning is applied to the live vehicle in applyGarageToVehicle().
        const tuned = {
          maxSpeedMul: base.maxSpeedMul * upgraded.maxSpeedMul,
          accelMul: base.accelMul * upgraded.accelMul,
          gripMul: base.gripMul * upgraded.gripMul,
          steerMul: base.steerMul * upgraded.steerMul,
          armorMul: base.armorMul * upgraded.armorMul,
        };
        return {
          id: v.id,
          name: v.name,
          variant: v.variant,
          speed: Math.round(tuned.maxSpeedMul * 100),
          acceleration: Math.round(tuned.accelMul * 100),
          handling: Math.round(((tuned.gripMul + tuned.steerMul) / 2) * 100),
          durability: Math.round(tuned.armorMul * 100),
          price: v.price,
          description: v.description,
          flavor: v.flavor,
          owned: d.unlockedVehicles.includes(v.id),
          selected: d.selectedVehicle === v.id,
        };
      }),
      upgrades: UPGRADES.map((u) => {
        const level = d.upgrades[u.id] ?? 0;
        return {
          id: u.id,
          title: u.title,
          effect: u.effectFmt(u.perLevelPct * level),
          level,
          maxLevel: u.maxLevel,
          nextPrice: nextUpgradePrice(u.id, level),
        };
      }),
      paints: PAINTS.map((p) => ({
        id: p.id,
        name: p.name,
        hex: p.hex,
        price: p.price,
        owned: d.ownedPaints.includes(p.id),
        selected: d.paint === p.id,
      })),
      // فاز ۷ — بوق‌ها
      horns: HORN_LIST.map((h) => ({
        id: h.id,
        name: h.name,
        price: h.price,
        desc: h.desc,
        owned: d.ownedHorns.includes(h.id),
        selected: d.horn === h.id,
      })),
    };
  }

  /** خرید خودروی جدید با سکه و انتخاب آن */
  buyVehicle(id: string): { ok: boolean; coins: number; msg: string } {
    const vehicle = vehicleById(id);
    const d = this.save.get();
    if (!vehicle) return { ok: false, coins: d.coins, msg: 'این ماشین تو نمایشگاه عمو نقی نیست!' };
    if (d.unlockedVehicles.includes(id)) return this.selectVehicle(id);
    if (d.coins < vehicle.price) return { ok: false, coins: d.coins, msg: 'سکه‌ات کمه؛ چند مسافر دیگه ببر!' };
    this.save.mutate((s) => {
      s.coins -= vehicle.price;
      s.unlockedVehicles.push(id);
      s.selectedVehicle = id;
    });
    this.applyGarageToVehicle();
    this.renderer3d?.setPlayerVehicle(vehicle.variant as CarVariant);
    const paint = paintById(this.save.get().paint);
    if (paint) this.renderer3d?.setPlayerPaint(paint.hex);
    this.audio.coin();
    return { ok: true, coins: this.save.get().coins, msg: `ماشین «${vehicle.name}» خریدی؛ عمو نقی هم یه دور افتخار زد!` };
  }

  /** انتخاب خودرویی که قبلاً خریداری شده */
  selectVehicle(id: string): { ok: boolean; coins: number; msg: string } {
    const vehicle = vehicleById(id);
    const d = this.save.get();
    if (!vehicle || !d.unlockedVehicles.includes(id)) {
      return { ok: false, coins: d.coins, msg: 'اول باید این ماشین رو بخری!' };
    }
    this.save.mutate((s) => { s.selectedVehicle = id; });
    this.applyGarageToVehicle();
    this.renderer3d?.setPlayerVehicle(vehicle.variant as CarVariant);
    const paint = paintById(this.save.get().paint);
    if (paint) this.renderer3d?.setPlayerPaint(paint.hex);
    return { ok: true, coins: this.save.get().coins, msg: `ماشین «${vehicle.name}» آمادهٔ حرکته!` };
  }

  /** خرید یک سطح آپگرید — خروجی برای toast پوسته */
  buyUpgrade(id: UpgradeId): { ok: boolean; coins: number; msg: string } {
    const u = upgradeById(id);
    const d = this.save.get();
    const level = d.upgrades[id] ?? 0;
    if (level >= u.maxLevel) return { ok: false, coins: d.coins, msg: 'این بخش دیگه حداکثره!' };
    const price = nextUpgradePrice(id, level) ?? 0;
    if (d.coins < price) return { ok: false, coins: d.coins, msg: 'پول کمه! برو مسافرکشی...' };
    this.save.mutate((s) => {
      s.coins -= price;
      s.upgrades[id] = level + 1;
    });
    this.applyGarageToVehicle();
    // اگر ماشین وسط بازی خراب بود، آپگرید موتور سرعتش را فوری درست می‌کند (سقف جدید در گام بعد اعمال می‌شود)
    const flavor = u.flavor[Math.min(u.flavor.length - 1, level)];
    this.audio.coin();
    return { ok: true, coins: this.save.get().coins, msg: flavor };
  }

  /** خرید رنگ (اگر خریده نشده) + انتخاب آن — رنگ مدل سه‌بعدی همان لحظه عوض می‌شود */
  buyPaint(id: string): { ok: boolean; coins: number; msg: string } {
    const p = paintById(id);
    const d = this.save.get();
    if (!p) return { ok: false, coins: d.coins, msg: 'این رنگ تو کارنامه ما نیست!' };
    if (d.ownedPaints.includes(id)) return this.selectPaint(id);
    if (d.coins < p.price) return { ok: false, coins: d.coins, msg: 'برای این رنگ سکه کم داری!' };
    this.save.mutate((s) => {
      s.coins -= p.price;
      s.ownedPaints.push(id);
      s.paint = id;
    });
    this.renderer3d?.setPlayerPaint(p.hex);
    this.audio.coin();
    return { ok: true, coins: this.save.get().coins, msg: `رنگ «${p.name}» زده شد!` };
  }

  /** انتخاب رنگ خریده‌شده */
  selectPaint(id: string): { ok: boolean; coins: number; msg: string } {
    const p = paintById(id);
    const d = this.save.get();
    if (!p || !d.ownedPaints.includes(id)) return { ok: false, coins: d.coins, msg: 'اول باید بخریش!' };
    this.save.mutate((s) => { s.paint = id; });
    this.renderer3d?.setPlayerPaint(p.hex);
    return { ok: true, coins: this.save.get().coins, msg: `رنگ «${p.name}» انتخاب شد` };
  }

  // ============ فروشگاه بوق‌ها (فاز ۷) ============

  /** خرید بوق (اگر خریده نشده) + انتخاب آن + پیش‌نمایش صدا */
  buyHorn(id: string): { ok: boolean; coins: number; msg: string } {
    const h = hornById(id);
    const d = this.save.get();
    if (!h) return { ok: false, coins: d.coins, msg: 'این بوق تو قفسه‌مون نیست!' };
    if (d.ownedHorns.includes(id)) return this.selectHorn(id);
    if (d.coins < h.price) return { ok: false, coins: d.coins, msg: 'برای این بوق سکه کم داری! برو مسافرکشی...' };
    this.save.mutate((s) => {
      s.coins -= h.price;
      s.ownedHorns.push(id);
      s.horn = id;
    });
    this.audio.ensure();
    this.audio.hornById(id); // پیش‌نمایش نصب!
    this.audio.coin();
    const flavor = HORN_FLAVOR[h.id as HornId];
    return { ok: true, coins: this.save.get().coins, msg: flavor ?? `بوق «${h.name}» نصب شد!` };
  }

  /** انتخاب بوق خریده‌شده + پیش‌نمایش صدا */
  selectHorn(id: string): { ok: boolean; coins: number; msg: string } {
    const h = hornById(id);
    const d = this.save.get();
    if (!h || !d.ownedHorns.includes(id)) return { ok: false, coins: d.coins, msg: 'اول باید بخریش!' };
    this.save.mutate((s) => { s.horn = id; });
    this.audio.ensure();
    this.audio.hornById(id); // پیش‌نمایش!
    return { ok: true, coins: this.save.get().coins, msg: `بوق «${h.name}» وصل شد!` };
  }

  // ============ وضعیت‌ها ============
  getState(): GameState {
    return this.state;
  }

  private setState(s: GameState): void {
    this.state = s;
    this.callbacks.onStateChange?.(s);
  }

  startGameplay(): void {
    this.audio.ensure();
    this.audio.startEngine();
    this.audio.setVolumes(this.save.get().settings);
    this.setState('playing');
    this.voice.trigger('game_start', performance.now());
  }

  pause(): void {
    if (this.state !== 'playing') return;
    this.audio.setEngineSpeed(0);
    this.voice.clear();
    this.input.setEnabled(false);
    this.save.flush();
    this.setState('paused');
  }

  resume(): void {
    if (this.state !== 'paused') return;
    this.input.setEnabled(true);
    this.lastFrame = performance.now();
    this.setState('playing');
  }

  backToMenu(): void {
    this.audio.setEngineSpeed(0);
    this.save.flush();
    this.mission.abort();
    const spawn = this.world.playerSpawn();
    this.vehicle.reset(spawn.x, spawn.y, spawn.angle);
    this.camera.snapTo(spawn.x, spawn.y);
    this.setState('menu');
  }

  // ============ ورودی‌های بیرونی (React) ============
  setVirtualSteer(dir: -1 | 0 | 1): void {
    this.input.setVirtualLeft(dir === -1);
    this.input.setVirtualRight(dir === 1);
  }
  setVirtualGas(v: boolean): void { this.input.setVirtualGas(v); }
  setVirtualBrake(v: boolean): void { this.input.setVirtualBrake(v); }
  pressHorn(): void {
    if (this.state !== 'playing') return;
    // فاز ۷: بوق شخصی بازیکن — امضای صوتی هر بوق جداست
    const hornId = (this.save.get().horn || 'classic') as HornId;
    this.audio.hornById(hornId);
    // جملات طنز خودِ راننده — بوق‌های خاص جمله مخصوص خودشان را دارند
    const selfEvent = HORN_OWNER_EVENT[hornId];
    if (selfEvent) {
      this.voice.trigger(selfEvent, performance.now());
    } else {
      this.voice.trigger('horn_joke', performance.now());
    }
    // شکایت مسافر تاکسی اگر سرنشین داریم و داریم بوق‌بازی می‌کنیم (فاز ۷)
    if (
      this.mission.getState() === 'active' &&
      this.mission.getDef()?.kind === 'taxi_fare' &&
      this.mission.getPhase() === 'to_target'
    ) {
      this.voice.trigger('passenger_horn', performance.now());
    }
    // واکنش ترافیک: جواب بوق + حباب طنز روی ماشینِ جواب‌دهنده — متن متناسب با بوق (فاز ۷)
    const reacted = this.traffic.onPlayerHorn(this.vehicle.x, this.vehicle.y);
    if (reacted.length > 0) {
      const car = reacted[0];
      const ev = HORN_REACT[hornId] ?? 'traffic_honk';
      this.fx.pushBubble(this.pickLine(ev), car.x, car.y, 'char_driver_01_idle', 2.6);
    }
  }
  setSetting<K extends 'music' | 'sfx' | 'voice'>(k: K, v: number): void {
    this.save.mutate((d) => { d.settings[k] = v; });
    this.audio.setVolumes(this.save.get().settings);
  }
  getSettings() { return this.save.get().settings; }
  getSave() { return this.save.get(); }

  toggleDebugFps(): void {
    this.showFps = !this.showFps;
  }

  // ============ مأموریت‌ها (فاز 4 + فاز ۵) ============

  /** لیست مأموریت‌ها برای منو (با فیلتر دسته — فاز ۵: park/taxi/challenge)
   *  فاز ۷: قفل زنجیره + عنوان مأموریت پیش‌نیاز */
  listMissions(category?: MissionCategory): Array<{ id: string; title: string; intro: string; objective: string; category: MissionCategory; rewardCoins: number; rewardRep: number; timeLimitSec: number; done: boolean; locked: boolean; requiresTitle: string | null }> {
    return this.mission.list(this.save.get().completedMissions, category).map((m) => ({
      id: m.id,
      title: m.title,
      intro: m.intro,
      objective: m.objective,
      category: m.category ?? 'story',
      rewardCoins: m.rewardCoins,
      rewardRep: m.rewardRep,
      timeLimitSec: m.timeLimitSec,
      done: m.done,
      locked: m.locked,
      requiresTitle: m.requiresTitle,
    }));
  }

  /** شروع مأموریت: ورود به گیم‌پلی + ریست موقعیت و ماشین برای شروع منصفانه */
  startMission(id: string): void {
    if (!this.mission.start(id)) return;
    if (this.state !== 'playing') this.startGameplay();
    const spawn = this.world.playerSpawn();
    this.vehicle.reset(spawn.x, spawn.y, spawn.angle);
    this.camera.snapTo(spawn.x, spawn.y);
    this.resetPlayerCar();
    this.voice.clear();
    this.voice.trigger('game_start', performance.now());
  }

  /** انصراف از مأموریت فعال */
  abandonMission(): void {
    this.mission.abort();
  }

  /** چاله! — لرزش + غرش + کند شدن + دیالوگ */
  private onPotholeHit(x: number, y: number): void {
    this.camera.addShake(CAM.maxShake * 0.55);
    this.audio.crash(false);
    this.vehicle.speed *= MISSIONS.potholeSlowFactor;
    this.fx.spawnBurst(x, y, 'rgba(90,72,60,0.9)', 8, 90);
    this.voice.trigger('pothole', performance.now());
  }

  /** پایان مأموریت — جایزه/جریمه + ذخیره + رویداد به پوسته */
  private finishMission(
    success: boolean,
    missionId: string,
    baseCoins: number,
    baseRep: number,
    reason: string | null,
    stats: unknown,
  ): void {
    if (this.state !== 'playing') return;
    const def = this.mission.getDef();
    const title = def?.title ?? missionId;

    let coins = 0;
    let rep = 0;
    let stars = 0;
    if (success) {
      // رتبه‌بندی سه‌ستاره: زمان، تصادف و برخورد با چاله روی پاداش اثر می‌گذارند.
      const s = stats && typeof stats === 'object' ? stats as { elapsedSec?: number; hardCrashes?: number; potholeHits?: number } : {};
      const elapsed = Math.max(0, s.elapsedSec ?? 0);
      const crashes = Math.max(0, s.hardCrashes ?? 0);
      const potholes = Math.max(0, s.potholeHits ?? 0);
      const limit = def?.timeLimitSec ?? 0;
      stars = crashes === 0 && potholes === 0 && (limit <= 0 || elapsed <= limit * 0.7)
        ? 3
        : crashes <= 1 && (limit <= 0 || elapsed <= limit)
          ? 2
          : 1;
      // بونوس عملکرد: ۳ ستاره +۱۵٪، ۲ ستاره +۷٪؛ بدون تغییر پاداش پایه.
      const performanceBonus = stars === 3 ? 0.15 : stars === 2 ? 0.07 : 0;
      // بونوس آبروی بالا (سند بخش ۷: ×1.25 وقتی آبرو ≥ ۸۰)
      const repNow = this.save.get().reputation;
      coins = Math.round(baseCoins * (repNow >= MISSIONS.bonusRepThreshold ? MISSIONS.bonusFactor : 1));
      coins += Math.round(baseCoins * performanceBonus);
      // فاز ۵: انعام تاکسی (اگر سریع برسی)
      const statsBonus = stats && typeof stats === 'object' && 'bonusCoins' in stats
        ? (stats as { bonusCoins?: number }).bonusCoins ?? 0
        : 0;
      coins += statsBonus;
      rep = baseRep;
      this.save.mutate((d) => {
        d.coins += coins;
        d.reputation = Math.min(REPUTATION.max, d.reputation + rep);
        if (!d.completedMissions.includes(missionId)) d.completedMissions.push(missionId);
      });
    }

    this.audio.coin();
    if (success) this.fx.spawnBurst(this.vehicle.x, this.vehicle.y - 30, '#F2B705', 16, 150);
    // فاز ۵: حباب پایانی مخصوص هر حالت
    if (success && def?.kind === 'taxi_fare') {
      this.fx.pushBubble(this.pickLine('taxi_dropoff'), def.target.x, def.target.y, 'char_pass_m_01_idle', 2.8);
    } else if (success && def?.kind === 'parallel_park') {
      this.fx.pushBubble(this.pickLine('parking_good'), this.vehicle.x, this.vehicle.y, 'char_driver_01_idle', 2.4);
    }
    this.voice.trigger(success ? 'mission_success' : 'mission_fail', performance.now());

    // فاز ۷: زنجیره عمو نقی — جمله تبریک مکانیکی جای جمله معمولی
    const isChain = success && def?.chain === 'naghi';
    const line = isChain ? this.pickLine('naghi_chain') : this.pickLine(success ? 'mission_success' : 'mission_fail');

    // فاز ۷: کدام مأموریت زنجیره‌ای با این پیروزی باز شد؟
    let unlockedNext: string | null = null;
    if (success) {
      const completed = this.save.get().completedMissions;
      const next = MISSION_LIST.find((m) => m.requires === missionId && !completed.includes(m.id));
      if (next) unlockedNext = next.title;
    }

    this.callbacks.onMissionEnd?.({ success, stars, missionId, title, coins, rep, reason, line, unlockedNext });
  }

  // ============ ترافیک و رویدادها (فاز 2) ============

  /** جمله تصادفی از یک رویداد دیالوگ (Data-Driven) */
  private pickLine(event: keyof typeof DIALOGUES): string {
    const ev = DIALOGUES[event];
    return ev.lines[Math.floor(Math.random() * ev.lines.length)];
  }

  /** بوق ماشین ترافیک (گیر افتاده یا جواب بوق) — فقط صدا؛ حباب جدا داده می‌شود */
  private onTrafficHonk(_car: unknown): void {
    if (this.state !== 'playing') return;
    this.audio.horn(Math.floor(Math.random() * 3));
  }

  /** رویداد تصادفی فعال شد → صدا + دیالوگ */
  private onRandomEvent(kind: 'cat' | 'cones' | 'taxi', x: number, y: number): void {
    if (this.state !== 'playing') return;
    const nowMs = performance.now();
    if (kind === 'cat') {
      this.voice.trigger('cat_event', nowMs);
    } else if (kind === 'cones') {
      this.voice.trigger('cones_ahead', nowMs);
    } else if (kind === 'taxi') {
      const taxi = this.randomEvents.nearestTaxi(this.traffic.cars, x, y);
      if (taxi) {
        this.audio.horn(Math.floor(Math.random() * 3));
        this.fx.pushBubble(this.pickLine('traffic_honk'), taxi.x, taxi.y, 'char_driver_01_idle', 2.6);
      }
    }
  }

  /** برخورد بازیکن با خودروی ترافیک — OBB دقیق (SAT): جدا می‌شوند، ترافیک بر اساس شدت ضربه پرت می‌شود */
  private resolveTrafficCollisions(dt: number): void {
    const v = this.vehicle;
    this.crashCooldown = Math.max(0, this.crashCooldown - dt);
    const pv = obbFromAngle(v.x, v.y, v.angle, v.hitH / 2, v.hitW / 2);
    for (const c of this.traffic.cars) {
      // ترافیک روی جاده‌های axis-aligned حرکت می‌کند → جعبه‌اش با زاویه‌اش ساخته می‌شود
      const cv = obbFromAngle(c.x, c.y, c.angle, c.hitH / 2, c.hitW / 2);
      // رد سریع دورها
      const ddx = c.x - v.x;
      const ddy = c.y - v.y;
      const rr = (v.hitH + c.hitH) / 2 + 60;
      if (ddx * ddx + ddy * ddy > rr * rr) continue;
      const mtv = satOverlapMTV(pv, cv);
      if (!mtv) continue;

      // شدت ضربه = سرعت «نسبی» بازیکن نسبت به ماشین ترافیک
      const relVx = v.vx - DIR_INFO[c.dir].x * c.speed;
      const relVy = v.vy - DIR_INFO[c.dir].y * c.speed;
      const impact = Math.hypot(relVx, relVy);

      // جداسازی نصفه‌نیمه در جهت MT: بازیکن یک نصفه عقب، ترافیک یک نصفه جلوتر
      v.x += mtv.x * mtv.depth * 0.5;
      v.y += mtv.y * mtv.depth * 0.5;
      c.x -= mtv.x * mtv.depth * 0.5;
      c.y -= mtv.y * mtv.depth * 0.5;

      // پرتاب ترافیک: جهت ضربه = بردار سرعت بازیکن (در سایشِ آرام: جهت جداسازی)
      const dx = v.x - c.x;
      const dy = v.y - c.y;
      const kdx = impact > 40 ? relVx : dx;
      const kdy = impact > 40 ? relVy : dy;
      c.knock(kdx, kdy, impact);

      // 🔕 شلاق جانبی بازیکن — تصادف واقعی‌تر: ضربهٔ بغلی ماشین را می‌کشد (مطابق rightX/rightY در Vehicle)
      const sideN = mtv.x * Math.cos(v.angle) + mtv.y * Math.sin(v.angle);
      v.latVel = Math.max(-140, Math.min(140, v.latVel + sideN * Math.min(impact, 200) * 0.28));

      // برخورد خودرو به خودرو: پاسخ سرعت بر پایهٔ جهت تماس به‌جای ضریب ثابت (ادغام از شاخهٔ کاربر)
      const hardImpact = impact > COLLISION.hardCrashSpeed;
      v.applyCollisionResponse(
        mtv.x,
        mtv.y,
        hardImpact ? COLLISION.hardRestitution : COLLISION.restitution,
        hardImpact ? COLLISION.hardTangentRetention : COLLISION.tangentRetention,
      );
      if (impact > COLLISION.softCrashSpeed) {
        c.stun(TRAFFIC.stunnedSec * 1.4);
      } else {
        c.stun(0.5);
      }

      if (this.crashCooldown <= 0 && impact > COLLISION.softCrashSpeed) {
        this.crashCooldown = 0.8;
        // برخورد با ترافیک هم برای مأموریت شمرده می‌شود (فاز 4)
        const hard = impact > COLLISION.hardCrashSpeed;
        this.mission.onCrash(hard ? 'hard' : 'soft');
        if (hard) this.hardCrashLatch = true;
        this.audio.crash(false);
        this.camera.addShake(CAM.maxShake * 0.5);
        this.fx.spawnBurst(v.x, v.y, '#B9B9B9', 10);
        // آسیب برخورد با خودرو (مانع متحرک بزرگ) — جلو/عقب با جهت
        const dmg = Math.min(DAMAGE.trafficHitMax, (DAMAGE.trafficHitBase + impact * DAMAGE.trafficHitScale) * this.vehicle.tune.armorMul);
        const fwd = Math.sin(v.angle) * (c.x - v.x) - Math.cos(v.angle) * (c.y - v.y);
        const front = fwd > 0;
        v.applyDamage(dmg, front);
        this.renderer3d?.onPlayerDamaged(dmg, front, (v.x + c.x) / 2, (v.y + c.y) / 2);
        this.save.mutate((d) => {
          d.reputation = Math.max(REPUTATION.min, d.reputation - REPUTATION.trafficCrashPenalty);
        });
        this.voice.trigger('car_crash', performance.now());
        if (Math.random() < 0.5) {
          this.fx.pushBubble(this.pickLine('traffic_honk'), c.x, c.y, 'char_driver_01_idle', 2.4);
        }
      }
      break; // یک برخورد در هر گام کافی است
    }
  }

  // ============ شکستنی‌ها (فاز BIG-IR) ============

  /** رنگ ذرات هر نوع مانع کوچک */
  private static readonly BREAK_COLORS: Record<string, string> = {
    trash: '#4F772D',
    cone: '#F4A261',
    moto: '#8a8f94',
    bags: '#2b2926',
    crate: '#c98d4b',
  };

  /** مانع‌های کوچک با سرعت می‌شکنند + بعد از مدت‌هایی دوباره می‌آیند */
  private updateBreakables(dt: number): void {
    this.breakCooldown = Math.max(0, this.breakCooldown - dt);
    const v = this.vehicle;

    // تایمر بازگشت شکسته‌ها
    for (const p of this.world.props) {
      if (p.broken) {
        p.brokenTimer = (p.brokenTimer ?? 0) - dt;
        if (p.brokenTimer <= 0) {
          p.broken = false;
          this.renderer3d?.markBreakablesDirty();
        }
      }
    }

    if (this.breakCooldown > 0 || Math.abs(v.speed) < BREAKABLE.breakSpeed) return;
    const hw = v.hitW / 2;
    const hh = v.hitH / 2;

    for (const p of this.world.props) {
      if (!p.breakable || p.broken) continue;
      // برخورد دایره ماشین با مستطیل مانع
      const cx = Math.max(p.x, Math.min(v.x, p.x + p.w));
      const cy = Math.max(p.y, Math.min(v.y, p.y + p.h));
      const dx = v.x - cx;
      const dy = v.y - cy;
      if (dx * dx + dy * dy > hw * hw) continue;

      // شکستن!
      p.broken = true;
      p.brokenTimer = BREAKABLE.respawnSec;
      this.breakCooldown = BREAKABLE.breakCooldownSec;
      this.renderer3d?.markBreakablesDirty();
      const color = GameManager.BREAK_COLORS[p.kind] ?? '#9b9b9b';
      this.fx.spawnBurst(p.x + p.w / 2, p.y + p.h / 2, color, 12, 230);
      // فاز OVERHAUL: تکه‌های پرتابی مانع شکسته
      this.fx.spawnDebris?.(p.x + p.w / 2, p.y + p.h / 2, color, 8, 280, 8);
      this.audio.bump();
      this.camera.addShake(3.2);
      v.speed *= BREAKABLE.speedLoss;
      // گاهی یه سکه از وسطش می‌پرد!
      if (Math.random() < BREAKABLE.coinChance) {
        this.save.mutate((d) => { d.coins += 1; });
        this.fx.spawnBurst(p.x + p.w / 2, p.y + p.h / 2, '#F2B705', 5, 140);
      }
      break; // یک شکستن در هر گام
    }

    // مخروط‌های رویداد هم با سرعت می‌شکنند (تکنیکی — همان سیستم)
    const cones = this.randomEvents.cones;
    for (let i = cones.length - 1; i >= 0; i--) {
      const c = cones[i];
      const dx = v.x - c.x;
      const dy = v.y - c.y;
      if (dx * dx + dy * dy < 60 * 60) {
        cones.splice(i, 1);
        this.fx.spawnBurst(c.x, c.y, '#F4A261', 8, 200);
        this.audio.bump();
        this.camera.addShake(2.4);
      }
    }
  }

  // ============ عابرها و تعمیر (فاز BIG-IR) ============

  /** عابر ترسید — حباب طنز (با احتمال) */
  private onPedScare(x: number, y: number): void {
    if (this.state !== 'playing') return;
    if (Math.random() < PEDESTRIANS.bubbleChance) {
      this.fx.pushBubble(this.pickLine('pedestrian_scare'), x, y, 'char_pass_m_01_idle', 2.2);
    }
  }

  // ============ برخورد با عابر پیاده (فاز SMASH) ============

  private pedCd = 0;

  /** ماشین با عابر برخورد می‌کند → عابر به هوا پرتاب می‌شود (طنز — بدون خشونت) */
  private resolvePedestrianCollisions(dt: number): void {
    this.pedCd = Math.max(0, this.pedCd - dt);
    const v = this.vehicle;
    const speed = Math.abs(v.speed);
    if (speed < PEDESTRIANS.hitMinSpeed) return;
    const rr = 34 + v.hitW * 0.42;
    for (const ped of this.peds.peds) {
      if (ped.knockT > 0 || ped.downT > 0 || ped.riseT > 0) continue;
      const dx = ped.x - v.x;
      const dy = ped.y - v.y;
      const d2 = dx * dx + dy * dy;
      if (d2 > rr * rr) continue;

      // ضربه!
      this.peds.knockPed(ped, v.vx, v.vy, speed);
      v.speed *= PEDESTRIANS.speedLoss;
      if (this.pedCd > 0) break;
      this.pedCd = 0.45;
      this.audio.bump();
      this.camera.addShake(CAM.maxShake * 0.35);
      this.fx.spawnBurst(ped.x, ped.y, '#ffffff', 8, 170);
      if (Math.random() < 0.7) {
        this.fx.pushBubble(this.pickLine('pedestrian_scare'), ped.x, ped.y, 'char_pass_m_01_idle', 2.4);
      }
      this.save.mutate((d) => {
        d.reputation = Math.max(REPUTATION.min, d.reputation - REPUTATION.pedHitPenalty);
      });
      this.voice.trigger('pedestrian_scare', performance.now());
      break;
    }
  }

  // ============ برخورد با خودروهای پارک‌شده (فاز SMASH) ============

  private parkedCd = 0;

  /** دوبله‌پارکی‌ها مانع‌اند — برخورد OBB دقیق: نچسبیدن = بدون تصادف */
  private resolveParkedCollisions(dt: number): void {
    this.parkedCd = Math.max(0, this.parkedCd - dt);
    const v = this.vehicle;
    const pv = obbFromAngle(v.x, v.y, v.angle, v.hitH / 2, v.hitW / 2);
    const cars = this.world.parkedCars;
    for (const pc of cars) {
      // رد سریع دورها (دایره محاطی)
      const ddx = pc.x - v.x;
      const ddy = pc.y - v.y;
      const rQuick = (v.hitH + 200) / 2 + 40;
      if (ddx * ddx + ddy * ddy > rQuick * rQuick) continue;
      // جعبه دقیق مدل پارکی (زاویه پارکی هم پشتیبانی می‌شود)
      const box = PARKED_HIT.box[pc.kind] ?? { hw: PARKED_HIT.radius[pc.kind] ?? 90, hh: PARKED_HIT.radius[pc.kind] ?? 90 };
      const pcv = obbFromAngle(pc.x, pc.y, pc.angle, box.hh, box.hw);
      const mtv = satOverlapMTV(pv, pcv);
      if (!mtv) continue;

      // بیرون‌اندازی کامل بازیکن (پارکی ثابت است)
      v.x += mtv.x * mtv.depth;
      v.y += mtv.y * mtv.depth;

      // شدت برخورد = مؤلفهٔ سرعت روی نرمال تماس (ادغام از شاخهٔ کاربر):
      // سایشِ کناری با پارکی دیگر سرعت را نمی‌گیرد — فقط ضربهٔ واقعی
      const contactVx = v.vx + Math.cos(v.angle) * v.latVel;
      const contactVy = v.vy + Math.sin(v.angle) * v.latVel;
      const impact = Math.abs(contactVx * mtv.x + contactVy * mtv.y);
      if (impact < PARKED_HIT.softSpeed) {
        v.applyCollisionResponse(mtv.x, mtv.y, 0.025, 0.985);
        continue;
      }
      const hard = impact > PARKED_HIT.hardSpeed;
      v.applyCollisionResponse(
        mtv.x,
        mtv.y,
        hard ? COLLISION.hardRestitution : COLLISION.restitution,
        hard ? COLLISION.hardTangentRetention : COLLISION.tangentRetention,
      );
      if (this.parkedCd > 0) break;
      this.parkedCd = PARKED_HIT.cooldownSec;
      const cx = (v.x + pc.x) / 2;
      const cy = (v.y + pc.y) / 2;
      if (hard) {
        this.audio.crash(true);
        this.camera.addShake(CAM.maxShake * 0.6);
        this.fx.spawnBurst(cx, cy, '#D6D6D6', 12, 220);
        this.fx.spawnDebris?.(cx, cy, '#4a4a48', 6, 260, 8);
        const dmg = Math.min(
          PARKED_HIT.hardDamageMax,
          (PARKED_HIT.hardDamageBase + impact * PARKED_HIT.hardDamageScale) * v.tune.armorMul,
        );
        const fwd = Math.sin(v.angle) * (pc.x - v.x) - Math.cos(v.angle) * (pc.y - v.y);
        v.applyDamage(dmg, fwd > 0);
        this.renderer3d?.onPlayerDamaged(dmg, fwd > 0, cx, cy);
        this.mission.onCrash('soft');
        this.save.mutate((dd) => {
          dd.reputation = Math.max(REPUTATION.min, dd.reputation - REPUTATION.softCrashPenalty);
        });
        this.voice.trigger('car_crash', performance.now());
        if (Math.random() < 0.4) {
          this.fx.pushBubble('وای ماشینم!', pc.x, pc.y, 'char_driver_01_idle', 2.2);
        }
      } else {
        this.audio.bump();
        this.camera.addShake(2.2);
        this.fx.spawnBurst(cx, cy, '#c9c9c9', 5, 130);
      }
      break; // یک برخورد در هر گام
    }
  }

  /** زون تعمیرگاه: ترمیم تدریجی داخل شعاع */
  private updateRepairZones(dt: number, nowMs: number): void {
    const v = this.vehicle;
    if (v.health >= DAMAGE.maxHealth) {
      this.repairVoiceLatch = false;
      return;
    }
    for (const z of this.world.repairZones) {
      const d = Math.hypot(v.x - z.x, v.y - z.y);
      if (d > DAMAGE.repairRadius) continue;

      v.health = Math.min(DAMAGE.maxHealth, v.health + DAMAGE.repairRate * dt);
      if (Math.random() < 0.25) {
        this.fx.spawnBurst(v.x + (Math.random() - 0.5) * 60, v.y + (Math.random() - 0.5) * 60, '#2A9D8F', 2, 90);
      }
      if (v.health >= DAMAGE.maxHealth) {
        v.fullRepair();
        this.engineDeadShown = false;
        this.renderer3d?.resetPlayerDamage();
        this.audio.coin();
        this.fx.spawnBurst(v.x, v.y, '#2A9D8F', 14, 160);
        if (!this.repairVoiceLatch) {
          this.repairVoiceLatch = true;
          this.voice.trigger('repair_done', nowMs);
        }
      }
      break;
    }
  }

  /** اسکران به تعمیرگاه بعد از خاموشی — از پوسته React (فاز BIG-IR) */
  towToRepair(): void {
    if (!this.vehicle.dead) return;
    // هزینه اگر پول داره (بقیه رایگان — رفیق مکانیکی!)
    const coins = this.save.get().coins;
    if (coins >= DAMAGE.towCost) {
      this.save.mutate((d) => { d.coins -= DAMAGE.towCost; });
    }
    // نزدیک‌ترین زون
    let best = this.world.repairZones[0];
    let bestD = Infinity;
    for (const z of this.world.repairZones) {
      const d = Math.hypot(this.vehicle.x - z.x, this.vehicle.y - z.y);
      if (d < bestD) { bestD = d; best = z; }
    }
    this.vehicle.reset(best.x, best.y, 0);
    this.camera.snapTo(best.x, best.y);
    this.resetPlayerCar();
    this.audio.coin();
    this.voice.trigger('repair_done', performance.now());
  }

  /** ریست کامل وضعیت ماشین (مأموریت جدید/اسکران) */
  private resetPlayerCar(): void {
    this.vehicle.fullRepair();
    this.engineDeadShown = false;
    this.renderer3d?.resetPlayerDamage();
  }

  // ============ حلقه ============
  private loop = (now: number): void => {
    // اگر نمونه دیگری جای این را گرفته، خودکشی کن (ضد زامبی)
    if (this.disposed || GameManager.live !== this) return;
    this.raf = requestAnimationFrame(this.loop);

    try {
      const rawDt = Math.min(0.1, (now - this.lastFrame) / 1000 || 0);
      this.lastFrame = now;

      if (this.state === 'playing') {
        this.accumulator += rawDt;
        let steps = 0;
        while (this.accumulator >= FIXED_DT && steps < 5) {
          this.step(FIXED_DT);
          this.accumulator -= FIXED_DT;
          steps++;
        }
        if (steps >= 5) this.accumulator = 0; // جلوگیری از Spiral of Death
        this.voice.update(rawDt);
      }

      // سقف رندر ۶۰فریم (ادغام از شاخهٔ کاربر): شبیه‌سازی با گام ثابت ادامه دارد؛
      // روی نمایشگرهای ۹۰/۱۲۰Hz انرژی/GPU صرفه‌جویی می‌شود، روی ۶۰Hz تغییری حس نمی‌شود.
      // آستانهٔ ۱۵٫۹ms (به‌جای ۱۶٫۶۷) = بدون پرش فریم روی نمایشگر ۶۰Hz.
      this.visualAccumulator += rawDt;
      if (this.lastRenderAt === 0 || now - this.lastRenderAt >= 15.9) {
        const renderDt = this.lastRenderAt > 0 ? Math.min(0.1, (now - this.lastRenderAt) / 1000) : rawDt;
        this.fpsAccum += renderDt;
        this.fpsCount++;
        if (this.fpsAccum >= 0.5) {
          this.fpsValue = Math.round(this.fpsCount / this.fpsAccum);
          this.fpsAccum = 0;
          this.fpsCount = 0;
          this.adaptDpr3d(); // 🔕 ضدلگ: کاهش نرم رزولوشن روی گوشی ضعیف
        }
        this.fx.update(Math.min(0.1, this.visualAccumulator));
        this.visualAccumulator = 0;
        this.draw();
        this.emitHud(renderDt);
        this.lastRenderAt = now;
      }
    } catch (err) {
      // خطای یک فریم هرگز بازی را نمی‌بندد
      console.warn('[Game] frame error:', err);
      this.accumulator = 0;
    }
  };

  private step(dt: number): void {
    // ---------- شهر بی‌پایان: قطعه‌های فعال دور بازیکن (ارزان — داده منطقی) ----------
    this.world.updateStreaming(this.vehicle.x, this.vehicle.y);

    let input = this.input.collect();
    this.lastInput = { gas: input.gas, brake: input.brake, steer: input.steer };

    // بوق از کیبورد (H)
    if (input.hornPressed) this.pressHorn();

    // ---------- چراغ‌های راهنما (فاز OVERHAUL) ----------
    this.lights.update(dt);
    this.checkRedLightRunner(dt);

    // ---------- موتور خاموش: گاز کار نمی‌کند (فاز BIG-IR) ----------
    if (this.vehicle.dead) {
      input = { ...input, gas: false };
    }

    const result = this.vehicle.update(dt, input, this.world.colliders);
    const nowMs = performance.now();

    // ---------- برخورد با موانع ثابت ----------
    this.crashCooldown = Math.max(0, this.crashCooldown - dt);
    if (result.crashed && this.crashCooldown <= 0) {
      const hard = result.impactSpeed > 260;
      // گزارش برخورد به مأموریت فقط یک‌بار در هر رویداد (نه هر فریم)
      this.mission.onCrash(hard ? 'hard' : 'soft');
      this.crashCooldown = 0.8;
      this.audio.crash(hard);
      this.camera.addShake(hard ? CAM.maxShake : CAM.maxShake * 0.45);
      // نقطه برخورد داینامیک: ذرات + جرقه در نقطه تماس + خرابی بدنه (فاز BIG-IR)
      this.fx.spawnBurst(result.impactX, result.impactY, hard ? '#ffd166' : '#D6D6D6', hard ? 18 : 8, hard ? 280 : 140);
      if (hard) this.fx.spawnBurst(result.impactX, result.impactY, '#ff6b35', 10, 240); // جرقهٔ نارنجی تصادف سخت
      // فاز OVERHAUL: لاشه + شیشه در تصادف سخت
      if (hard) {
        this.fx.spawnDebris?.(result.impactX, result.impactY, '#4a4a48', 10, 300, 10);
        this.fx.spawnDebris?.(result.impactX, result.impactY, '#bfe3ea', 5, 340, 5);
        this.fx.spawnDebris?.(result.impactX, result.impactY, '#3a2e2a', 4, 240, 7);
      }
      this.renderer3d?.onPlayerDamaged(result.damage, result.front, result.impactX, result.impactY);
      this.save.mutate((d) => {
        d.reputation = Math.max(REPUTATION.min, d.reputation - (hard ? REPUTATION.hardCrashPenalty : REPUTATION.softCrashPenalty));
      });
      this.voice.trigger('car_crash', nowMs);
    }

    // ---------- ترمز ----------
    if (input.brake && Math.abs(this.vehicle.speed) > 160) {
      if (!this.brakeSoundLatch) {
        this.audio.brake();
        this.brakeSoundLatch = true;
        this.voice.trigger('hard_brake', nowMs);
      }
    } else if (!input.brake) {
      this.brakeSoundLatch = false;
    }

    // ---------- درفت ملایم (فاز 2): رد لاستیک + صدای سایش + دود ----------
    if (result.skidding) {
      // نقطه محور عقب (کمی پشت مرکز ماشین)
      const back = this.vehicle.drawH * 0.32;
      const ax = this.vehicle.x - Math.sin(this.vehicle.angle) * back;
      const ay = this.vehicle.y + Math.cos(this.vehicle.angle) * back;
      this.fx.addSkidMark(ax, ay, this.vehicle.angle);
      this.skidSoundTimer -= dt;
      if (this.skidSoundTimer <= 0) {
        this.skidSoundTimer = DRIFT.skidSoundInterval;
        const intensity = Math.min(1, Math.abs(this.vehicle.latVel) / DRIFT.maxLateral + 0.35);
        this.audio.skid(intensity);
        this.fx.spawnBurst(ax, ay, 'rgba(160,160,160,0.9)', 2, 60);
      }
      this.voice.trigger('drift', nowMs);
    } else {
      this.skidSoundTimer = 0;
    }

    // ---------- سرعت‌گیرها (فاز GTA-IR): «تق» + کندی + لرزش + غبار ----------
    this.bumpCooldown = Math.max(0, this.bumpCooldown - dt);
    if (this.bumpCooldown <= 0 && Math.abs(this.vehicle.speed) > RENDER3D.bumpMinSpeed) {
      for (const sb of this.world.speedBumps) {
        const dx = this.vehicle.x - sb.x;
        const dy = this.vehicle.y - sb.y;
        // باند عبور عرض جاده: جاده افقی = عبور در راستای X
        const inside = sb.horiz
          ? Math.abs(dx) < 24 && Math.abs(dy) < 100
          : Math.abs(dy) < 24 && Math.abs(dx) < 100;
        if (inside) {
          this.bumpCooldown = RENDER3D.bumpCooldownSec;
          this.vehicle.speed *= RENDER3D.bumpSlowFactor;
          this.camera.addShake(RENDER3D.bumpShake);
          this.audio.bump();
          this.fx.spawnBurst(this.vehicle.x, this.vehicle.y, 'rgba(190,170,130,0.9)', 4, 90);
          break;
        }
      }
    }

      // ---------- ترافیک (فاز 2) ----------
    this.traffic.update(dt, this.vehicle);
    this.resolveTrafficCollisions(dt);

    // ---------- برخورد با پارکی‌ها (فاز SMASH) ----------
    this.resolveParkedCollisions(dt);

    // ---------- شکستنی‌ها (فاز BIG-IR) ----------
    this.updateBreakables(dt);

    // ---------- عابرهای پیاده (فاز BIG-IR + برخورد SMASH) ----------
    this.peds.update(dt, this.vehicle);
    this.resolvePedestrianCollisions(dt);

    // ---------- دود ماشین آسیب‌دیده (فاز BIG-IR) ----------
    if (this.vehicle.health < DAMAGE.smokeBelow) {
      this.damageSmokeTimer -= dt;
      if (this.damageSmokeTimer <= 0) {
        const heavy = this.vehicle.health < DAMAGE.heavySmokeBelow;
        this.damageSmokeTimer = heavy ? 0.09 : 0.16;
        const front = this.vehicle.drawH * 0.36;
        const sx = this.vehicle.x + Math.sin(this.vehicle.angle) * front;
        const sy = this.vehicle.y - Math.cos(this.vehicle.angle) * front;
        this.fx.spawnBurst(sx, sy, heavy ? 'rgba(60,60,64,0.8)' : 'rgba(120,120,125,0.7)', heavy ? 2 : 1, heavy ? 70 : 45);
      }
    }

    // ---------- خاموشی موتور (فاز BIG-IR) ----------
    if (this.vehicle.dead && !this.engineDeadShown) {
      this.engineDeadShown = true;
      this.audio.setEngineSpeed(0);
      this.camera.addShake(CAM.maxShake * 0.6);
      this.fx.spawnBurst(this.vehicle.x, this.vehicle.y, 'rgba(40,40,44,0.9)', 12, 120);
      this.voice.trigger('breakdown', nowMs);
      // اگر مأموریت فعال است، مثل تصادف سخت حساب می‌شود
      this.mission.onCrash('hard');
    }

    // ---------- زون‌های تعمیرگاه (فاز BIG-IR) ----------
    this.updateRepairZones(dt, nowMs);

    // ---------- رویدادهای تصادفی (فاز 2) ----------
    this.randomEvents.update(dt, this.vehicle);

    // ---------- مأموریت (فاز 4 + فاز ۵) ----------
    this.mission.update(dt, this.vehicle);
    // دود ماشین دودکن (m02) — پف دود تا برسد تعمیرگاه
    if (this.mission.getState() === 'active' && this.mission.getDef()?.id === 'm02_smoking_car') {
      this.smokeTimer -= dt;
      if (this.smokeTimer <= 0) {
        this.smokeTimer = MISSIONS.smokeIntervalSec;
        const back = this.vehicle.drawH * 0.42;
        const sx = this.vehicle.x - Math.sin(this.vehicle.angle) * back;
        const sy = this.vehicle.y + Math.cos(this.vehicle.angle) * back;
        this.fx.spawnBurst(sx, sy, 'rgba(120,120,125,0.75)', 1, 40);
      }
    }
    // فاز ۵: مسافر عصبانی — تصادف شدید در مأموریت تاکسی
    if (
      this.mission.getState() === 'active' &&
      this.mission.getDef()?.kind === 'taxi_fare' &&
      this.hardCrashLatch
    ) {
      this.hardCrashLatch = false;
      this.voice.trigger('passenger_scared', nowMs);
    }

    // ---------- سکه ----------
    const got = this.world.collectCoins(this.vehicle.x, this.vehicle.y, 60);
    if (got > 0) {
      this.audio.coin();
      this.fx.spawnBurst(this.vehicle.x, this.vehicle.y - 30, '#F2B705', 10, 120);
      this.save.mutate((d) => { d.coins += got; });
      this.voice.trigger('coin_pickup', nowMs);
      // فاز ۵: گزارش سکه به مأموریت (چالش شکار سکه)
      this.mission.onCoinCollected(got);
    }

    // ---------- موتور ----------
    this.audio.setEngineSpeed(Math.abs(this.vehicle.speed) / VEHICLE_PHYSICS.maxSpeed);

    // ---------- رویداد پس‌زمینه ----------
    this.idleTimerSec -= dt;
    if (this.idleTimerSec <= 0) {
      this.idleTimerSec = IDLE_EVENTS.minIntervalSec + Math.random() * (IDLE_EVENTS.maxIntervalSec - IDLE_EVENTS.minIntervalSec);
      this.voice.trigger('idle_funny', nowMs);
    }

    // ---------- دوربین ----------
    if (this.ctx) {
      this.camera.halfW = RENDER.logicalWidth / 2;
      this.camera.halfH = this.ctx.canvas.height / (this.scale * 2);
    } else {
      // حالت سه‌بعدی: نیم‌اندازه‌های منطقی صرفاً برای clamp حباب‌ها
      this.camera.halfW = RENDER.logicalWidth / 2;
      this.camera.halfH = 640;
    }
    this.camera.update(dt, this.vehicle.x, this.vehicle.y, this.vehicle.vx, this.vehicle.vy);
  }

  // ============ چراغ قرمز بازیکن (فاز OVERHAUL) ============

  /** اگر بازیکن با سرعت از تقاطع با چراغ قرمز رد شود — دیالوگ طنز (بدون جریمه) */
  private checkRedLightRunner(dt: number): void {
    this.redRunnerCooldown = Math.max(0, this.redRunnerCooldown - dt);
    if (this.redRunnerCooldown > 0) return;
    const v = this.vehicle;
    if (Math.abs(v.speed) < TRAFFIC_LIGHTS.redRunnerSpeed) return;
    // نزدیک‌ترین جاده عمودی/افقی — فاز ENDLESS: بستهٔ O(1) (بی‌نهایت جاده)
    const bi = Math.round((v.x - WR.roadW / 2) / WR.pitch);
    const bj = Math.round((v.y - WR.roadW / 2) / WR.pitch);
    const di = Math.abs(v.x - roadCenter(bi));
    const dj = Math.abs(v.y - roadCenter(bj));
    // باید داخل محدوده تقاطع باشد (هر دو فاصله کمتر از نصف عرض جاده)
    if (di > WR.roadW / 2 || dj > WR.roadW / 2) return;
    // محور حرکت از زاویه: ۰=شمال؛ سینوس غالب = شرق/غرب
    const movingH = Math.abs(Math.sin(v.angle)) > Math.abs(Math.cos(v.angle));
    const state = movingH
      ? this.lights.stateEW(bi, bj)
      : this.lights.stateNS(bi, bj);
    if (state === 'red') {
      this.redRunnerCooldown = TRAFFIC_LIGHTS.redRunnerCooldown;
      this.voice.trigger('red_light', performance.now());
      this.audio.horn(Math.floor(Math.random() * 3)); // بوق اعتراض ترافیک!
    }
  }

  // ============ رسم ============
  private draw(): void {
    // هدف فعلی مأموریت (فاز ۵: پویا — تاکسی/چک‌پوینت/سکه)
    const activeMission = this.mission.getState() === 'active';
    const mTarget = activeMission ? this.mission.currentTarget(this.vehicle) : null;

    // ---------- مسیر سه‌بعدی (فاز 3D) ----------
    if (this.renderer3d) {
      this.draw3DFrame(mTarget);
      return;
    }
    // ---------- مسیر دوبعدی (fallback) ----------
    const ctx = this.ctx;
    if (!ctx || !this.renderer) return;
    const cw = ctx.canvas.width;
    const ch = ctx.canvas.height;
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.fillStyle = '#C9B98A';
    ctx.fillRect(0, 0, cw, ch);

    // scale منطقی: پیکسل‌های فیزیکی بر واحد منطقی
    this.scale = cw / RENDER.logicalWidth;

    ctx.scale(this.scale, this.scale);
    this.camera.halfW = RENDER.logicalWidth / 2;
    this.camera.halfH = ch / this.scale / 2;

    this.renderer.draw(
      ctx,
      this.vehicle,
      this.traffic.cars,
      this.randomEvents.cat,
      this.randomEvents.cones,
      this.mission.getPotholes(),
      mTarget,
    );
    // حباب گفتار با مختصات دنیاست — باید با همان ترنسلیت دوربین رسم شود
    // (renderer.draw ترنسلیت را داخل save/restore خودش دارد و بعد از restore حذف می‌شود)
    ctx.save();
    ctx.translate(-this.camera.offsetX(), -this.camera.offsetY());
    this.drawSpeechBubble(ctx);
    ctx.restore();
    ctx.setTransform(1, 0, 0, 1, 0, 0);

    // فلش جهت‌نمای هدف وقتی بیرون کادر است (فضای صفحه — فاز 4)
    if (mTarget) {
      this.renderer.drawOffscreenArrow(ctx, mTarget, this.vehicle, cw, ch, this.scale);
    }
  }

  /** یک فریم کامل سه‌بعدی: صحنه + اورلی (حباب‌ها و فلش هدف) */
  private draw3DFrame(mTarget: { x: number; y: number } | null): void {
    const speech = this.voice.current;
    this.renderer3d!.draw3D({
      car: this.vehicle,
      traffic: this.traffic.cars,
      cat: this.randomEvents.cat,
      cones: this.randomEvents.cones,
      potholes: this.mission.getPotholes(),
      peds: this.peds.peds,
      target: mTarget,
      // فاز ۵: ماشین‌های نگهبان جای پارک
      guardCars: this.mission.getGuardCars() as GuardCar[],
      playerBubble: speech
        ? {
            line: speech.line,
            x: this.vehicle.x,
            y: this.vehicle.y,
            portrait: SPEAKER_PORTRAIT[speech.speaker] ?? 'char_driver_01_idle',
          }
        : null,
      // ---------- فاز GRAPHICS_OVERHAUL ----------
      braking: this.lastInput.brake,
      accelerating: this.lastInput.gas && !this.vehicle.dead,
      steer: this.lastInput.steer,
      debug: this.showFps,
      fps: this.fpsValue,
    });
  }

  /** حباب گفتار فارسی (RTL) بازیکن — فقط مسیر دوبعدی (در سه‌بعدی اورلی جای آن را می‌گیرد) */
  private drawSpeechBubble(ctx: CanvasRenderingContext2D): void {
    const info = this.voice.current;
    if (!info || !this.renderer) return;
    const car = this.vehicle;
    // فاز 2: همه گوینده‌ها فعلاً پرتره راننده را دارند؛ با رسیدن پرتره‌های
    // Batch 2-4 کافی است SPEAKER_PORTRAIT در manifest به‌روز شود
    this.renderer.drawBubbleBox(ctx, info.line, car.x, car.y, car.drawH, 'char_driver_01_idle');
  }

  // ============ HUD ============
  private emitHud(dt: number): void {
    this.hudThrottle += dt;
    if (this.hudThrottle < 0.12) return;
    this.hudThrottle = 0;
    this.callbacks.onHud?.({
      speedKmh: Math.round(Math.abs(this.vehicle.speed) / 3),
      coins: this.save.get().coins,
      reputation: this.save.get().reputation,
      fps: this.fpsValue,
      showFps: this.showFps,
      placeholders: this.assets.getReport().placeholders.length,
      mission: this.mission.hud(this.vehicle),
      health: Math.round(this.vehicle.health),
      engineDead: this.vehicle.dead,
    });
  }

  // ============ رویدادهای صفحه ============

  /** 🔕 DPR سه‌بعدی تطبیقی — ضدلگ: اگر FPS پایین ماند، رزولوشن رندر نرم کم می‌شود؛
   *  اگر بالا رفت، برمی‌گردد. کیفیت منو/شهر روی گوشی معمولی دست‌نخورده می‌ماند */
  private dpr3dBase = Math.min(RENDER.maxDevicePixelRatio, (typeof window !== 'undefined' ? window.devicePixelRatio : 1) || 1);
  private dpr3d = this.dpr3dBase;
  private dprCheck = 0;

  private adaptDpr3d(): void {
    if (this.state !== 'playing') return;
    this.dprCheck++;
    if (this.dprCheck < 4) return; // هر ۲ ثانیه — نوسان‌گیر
    this.dprCheck = 0;
    const fps = this.fpsValue;
    let nd = this.dpr3d;
    // React sooner to sustained frame drops, and allow sub-1 DPR on very weak GPUs.
    if (fps < 38) nd = Math.max(1.1, this.dpr3d - 0.3);
    else if (fps > 52 && this.dpr3d < this.dpr3dBase) nd = Math.min(this.dpr3dBase, this.dpr3d + 0.2);
    if (Math.abs(nd - this.dpr3d) > 0.01) {
      this.dpr3d = Math.round(nd * 100) / 100;
      this.handleResize();
      console.warn('[Game] adaptive render scale →', this.dpr3d, 'fps:', fps);
    }
  }

  private handleResize = (): void => {
    const dpr = this.dpr3d; // 🔕 DPR سه‌بعدی تطبیقی (نه dpr خام صفحه)
    const w = this.canvas.clientWidth || window.innerWidth;
    const h = this.canvas.clientHeight || window.innerHeight;
    this.canvas.width = Math.round(w * dpr);
    this.canvas.height = Math.round(h * dpr);
    // رندر سه‌بعدی هم باید بداند (کانواس WebGL + اورلی + aspect دوربین)
    if (this.renderer3d) this.renderer3d.resize(this.canvas.width, this.canvas.height, dpr);
  };

  private onKeyDown = (e: KeyboardEvent): void => {
    const k = e.key.toLowerCase();
    if (k === 'p' || k === 'escape') {
      if (this.state === 'playing') this.pause();
      else if (this.state === 'paused') this.resume();
    } else if (k === 'f') {
      this.toggleDebugFps();
    }
  };

  private onVisibility = (): void => {
    if (document.hidden && this.state === 'playing') this.pause();
  };

  private onBeforeUnload = (): void => {
    this.save.flush();
  };

  dispose(): void {
    this.disposed = true;
    if (GameManager.live === this) GameManager.live = null;
    cancelAnimationFrame(this.raf);
    this.audio.stopEngine();
    this.input.detach();
    this.renderer3d?.dispose(); // حذف اورلی + آزادسازی کانتکست GPU
    window.removeEventListener('resize', this.handleResize);
    window.removeEventListener('keydown', this.onKeyDown);
    document.removeEventListener('visibilitychange', this.onVisibility);
    window.removeEventListener('beforeunload', this.onBeforeUnload);
    this.save.flush();
  }
}
