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
import { MissionManager, type MissionHud } from '../managers/MissionManager';
import { Vehicle } from '../entities/Vehicle';
import { World } from '../world/World';
import { WorldRenderer } from '../world/WorldRenderer';
import { WorldRenderer3D } from '../render3d/WorldRenderer3D';
import { RENDER, VEHICLE_PHYSICS, REPUTATION, IDLE_EVENTS, CAMERA as CAM, COLLISION, TRAFFIC, DRIFT, MISSIONS } from '../data/balance';
import { SPEAKER_PORTRAIT } from '../data/assets.manifest';
import { DIALOGUES } from '../data/dialogues';

export type GameState = 'boot' | 'menu' | 'playing' | 'paused';

  /** مشترک بین دو رندرر — افکت‌هایی که GameManager مستقیماً صدا می‌زند */
interface EffectsRenderer {
  update(dt: number): void;
  pushBubble(text: string, x: number, y: number, portraitId?: string, ttl?: number): void;
  spawnBurst(x: number, y: number, color: string, count?: number, power?: number): void;
  addSkidMark(x: number, y: number, angle: number): void;
}

export interface HudData {
  speedKmh: number;
  coins: number;
  reputation: number;
  fps: number;
  showFps: boolean;
  placeholders: number;
  mission: MissionHud | null;
}

/** نتیجه مأموریت برای پوسته React (فاز 4) */
export interface MissionResultData {
  success: boolean;
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
}

export interface GameCallbacks {
  onStateChange?: (s: GameState) => void;
  onHud?: (h: HudData) => void;
  onMissionEnd?: (r: MissionResultData) => void;
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
  private mission: MissionManager;

  private state: GameState = 'boot';
  private raf = 0;
  private lastFrame = 0;
  private accumulator = 0;
  private scale = 1;
  private showFps = false;
  private fpsAccum = 0;
  private fpsCount = 0;
  private fpsValue = 60;

  private idleTimerSec = 12;
  private crashCooldown = 0;
  private brakeSoundLatch = false;
  private skidSoundTimer = 0;
  private smokeTimer = 0;
  private hudThrottle = 0;
  private disposed = false;

  constructor(
    private canvas: HTMLCanvasElement,
    private callbacks: GameCallbacks = {},
  ) {
    // هر نمونه قبلیِ زنده را ببند (بازهم اگر جایی نشتی داشته باشد)
    if (GameManager.live && GameManager.live !== this) GameManager.live.dispose();
    GameManager.live = this;

    // ---------- انتخاب رندرر: اول WebGL (سه‌بعدی)، بعد 2D ----------
    // توجه: بعد از گرفتن یک نوع کانتکست، نوع دیگر روی همان کانواس ممکن نیست
    const gl = (canvas.getContext('webgl2', { antialias: true })
      ?? canvas.getContext('webgl', { antialias: true })) as WebGL2RenderingContext | WebGLRenderingContext | null;
    if (gl) {
      this.is3D = true;
      const overlay = document.createElement('canvas');
      overlay.style.cssText = 'position:absolute;inset:0;width:100%;height:100%;pointer-events:none;z-index:5;';
      canvas.parentElement?.appendChild(overlay);
      this.renderer3d = new WorldRenderer3D(canvas, gl, overlay, this.assets, this.world, this.camera);
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
    this.traffic = new TrafficManager(
      ['veh_taxi_01', 'veh_sedan_01', 'veh_pickup_01', 'veh_police_01'],
      { onHonk: (car) => this.onTrafficHonk(car) },
      (() => {
        const s = this.world.playerSpawn();
        return { x: s.x, y: s.y, r: 420 };
      })(),
    );
    this.randomEvents = new RandomEventManager(this.world, {
      onEvent: (kind, x, y) => this.onRandomEvent(kind, x, y),
    });
    // مأموریت‌ها (فاز 4)
    this.mission = new MissionManager(this.world, {
      onPothole: (x, y) => this.onPotholeHit(x, y),
      onSucceed: (def, stats) => this.finishMission(true, def.id, def.rewardCoins, def.rewardRep, null, stats),
      onFail: (def, reason) => this.finishMission(false, def.id, 0, 0, reason, null),
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
      await this.assets.loadAll(onProgress);
    } catch (err) {
      console.warn('[Game] asset boot error (continuing with placeholders):', err);
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
    this.setState('menu');
    this.loop(performance.now());
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
    this.audio.horn(Math.floor(Math.random() * 3));
    this.voice.trigger('horn_joke', performance.now());
    // واکنش ترافیک (فاز 2): جواب بوق + حباب طنز روی ماشینِ جواب‌دهنده
    const reacted = this.traffic.onPlayerHorn(this.vehicle.x, this.vehicle.y);
    if (reacted.length > 0) {
      const car = reacted[0];
      this.fx.pushBubble(this.pickLine('traffic_honk'), car.x, car.y, 'char_driver_01_idle', 2.6);
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

  // ============ مأموریت‌ها (فاز 4) ============

  /** لیست مأموریت‌ها برای منو (با وضعیت انجام‌شدگی از ذخیره) */
  listMissions(): Array<{ id: string; title: string; intro: string; objective: string; rewardCoins: number; rewardRep: number; timeLimitSec: number; done: boolean }> {
    return this.mission.list(this.save.get().completedMissions);
  }

  /** شروع مأموریت: ورود به گیم‌پلی + ریست موقعیت برای شروع منصفانه */
  startMission(id: string): void {
    if (!this.mission.start(id)) return;
    if (this.state !== 'playing') this.startGameplay();
    const spawn = this.world.playerSpawn();
    this.vehicle.reset(spawn.x, spawn.y, spawn.angle);
    this.camera.snapTo(spawn.x, spawn.y);
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
    _stats: unknown,
  ): void {
    if (this.state !== 'playing') return;
    const def = this.mission.getDef();
    const title = def?.title ?? missionId;

    let coins = 0;
    let rep = 0;
    if (success) {
      // بونوس آبروی بالا (سند بخش ۷: ×1.25 وقتی آبرو ≥ ۸۰)
      const repNow = this.save.get().reputation;
      coins = Math.round(baseCoins * (repNow >= MISSIONS.bonusRepThreshold ? MISSIONS.bonusFactor : 1));
      rep = baseRep;
      this.save.mutate((d) => {
        d.coins += coins;
        d.reputation = Math.min(REPUTATION.max, d.reputation + rep);
        if (!d.completedMissions.includes(missionId)) d.completedMissions.push(missionId);
      });
    }

    this.audio.coin();
    if (success) this.fx.spawnBurst(this.vehicle.x, this.vehicle.y - 30, '#F2B705', 16, 150);
    this.voice.trigger(success ? 'mission_success' : 'mission_fail', performance.now());

    const line = this.pickLine(success ? 'mission_success' : 'mission_fail');
    this.callbacks.onMissionEnd?.({ success, missionId, title, coins, rep, reason, line });
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

  /** برخورد بازیکن با خودروی ترافیک — بازیکن کنار می‌رود، ترافیک مکث می‌کند */
  private resolveTrafficCollisions(dt: number): void {
    const v = this.vehicle;
    this.crashCooldown = Math.max(0, this.crashCooldown - dt);
    for (const c of this.traffic.cars) {
      const hw = v.hitW / 2 + c.hitW / 2;
      const hh = v.hitH / 2 + c.hitH / 2;
      const dx = v.x - c.x;
      const dy = v.y - c.y;
      const penX = hw - Math.abs(dx);
      const penY = hh - Math.abs(dy);
      if (penX <= 0 || penY <= 0) continue;

      const impact = Math.hypot(v.vx, v.vy);
      if (penX < penY) v.x += dx >= 0 ? penX : -penX;
      else v.y += dy >= 0 ? penY : -penY;
      v.speed *= 0.5;
      v.latVel *= 0.4;
      c.stun(TRAFFIC.stunnedSec);

      if (this.crashCooldown <= 0 && impact > COLLISION.softCrashSpeed) {
        this.crashCooldown = 0.8;
        // برخورد با ترافیک هم برای مأموریت شمرده می‌شود (فاز 4)
        this.mission.onCrash(impact > COLLISION.hardCrashSpeed ? 'hard' : 'soft');
        this.audio.crash(false);
        this.camera.addShake(CAM.maxShake * 0.5);
        this.fx.spawnBurst(v.x, v.y, '#B9B9B9', 10);
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

  // ============ حلقه ============
  private loop = (now: number): void => {
    // اگر نمونه دیگری جای این را گرفته، خودکشی کن (ضد زامبی)
    if (this.disposed || GameManager.live !== this) return;
    this.raf = requestAnimationFrame(this.loop);

    try {
      const rawDt = Math.min(0.1, (now - this.lastFrame) / 1000 || 0);
      this.lastFrame = now;

      // FPS
      this.fpsAccum += rawDt;
      this.fpsCount++;
      if (this.fpsAccum >= 0.5) {
        this.fpsValue = Math.round(this.fpsCount / this.fpsAccum);
        this.fpsAccum = 0;
        this.fpsCount = 0;
      }

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

      this.fx.update(rawDt);
      this.draw();
      this.emitHud(rawDt);
    } catch (err) {
      // خطای یک فریم هرگز بازی را نمی‌بندد
      console.warn('[Game] frame error:', err);
      this.accumulator = 0;
    }
  };

  private step(dt: number): void {
    const input = this.input.collect();

    // بوق از کیبورد (H)
    if (input.hornPressed) this.pressHorn();

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
      this.fx.spawnBurst(this.vehicle.x, this.vehicle.y, hard ? '#9B9B9B' : '#D6D6D6', hard ? 14 : 8);
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

    // ---------- ترافیک (فاز 2) ----------
    this.traffic.update(dt, this.vehicle);
    this.resolveTrafficCollisions(dt);

    // ---------- رویدادهای تصادفی (فاز 2) ----------
    this.randomEvents.update(dt, this.vehicle);

    // ---------- مأموریت (فاز 4) ----------
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

    // ---------- سکه ----------
    const got = this.world.collectCoins(this.vehicle.x, this.vehicle.y, 60);
    if (got > 0) {
      this.audio.coin();
      this.fx.spawnBurst(this.vehicle.x, this.vehicle.y - 30, '#F2B705', 10, 120);
      this.save.mutate((d) => { d.coins += got; });
      this.voice.trigger('coin_pickup', nowMs);
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

  // ============ رسم ============
  private draw(): void {
    // ---------- مسیر سه‌بعدی (فاز 3D) ----------
    if (this.renderer3d) {
      this.draw3DFrame();
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
      this.mission.getState() === 'active' ? this.mission.getDef()?.target ?? null : null,
    );
    // حباب گفتار با مختصات دنیاست — باید با همان ترنسلیت دوربین رسم شود
    // (renderer.draw ترنسلیت را داخل save/restore خودش دارد و بعد از restore حذف می‌شود)
    ctx.save();
    ctx.translate(-this.camera.offsetX(), -this.camera.offsetY());
    this.drawSpeechBubble(ctx);
    ctx.restore();
    ctx.setTransform(1, 0, 0, 1, 0, 0);

    // فلش جهت‌نمای هدف وقتی بیرون کادر است (فضای صفحه — فاز 4)
    if (this.mission.getState() === 'active') {
      const def = this.mission.getDef();
      if (def) this.renderer.drawOffscreenArrow(ctx, def.target, this.vehicle, cw, ch, this.scale);
    }
  }

  /** یک فریم کامل سه‌بعدی: صحنه + اورلی (حباب‌ها و فلش هدف) */
  private draw3DFrame(): void {
    const active = this.mission.getState() === 'active';
    const def = active ? this.mission.getDef() : null;
    const speech = this.voice.current;
    this.renderer3d!.draw3D({
      car: this.vehicle,
      traffic: this.traffic.cars,
      cat: this.randomEvents.cat,
      cones: this.randomEvents.cones,
      potholes: this.mission.getPotholes(),
      target: def?.target ?? null,
      playerBubble: speech
        ? {
            line: speech.line,
            x: this.vehicle.x,
            y: this.vehicle.y,
            portrait: SPEAKER_PORTRAIT[speech.speaker] ?? 'char_driver_01_idle',
          }
        : null,
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
    });
  }

  // ============ رویدادهای صفحه ============
  private handleResize = (): void => {
    const dpr = Math.min(RENDER.maxDevicePixelRatio, window.devicePixelRatio || 1);
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
