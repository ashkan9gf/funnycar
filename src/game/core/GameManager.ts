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
import { Vehicle } from '../entities/Vehicle';
import { World } from '../world/World';
import { WorldRenderer } from '../world/WorldRenderer';
import { RENDER, VEHICLE_PHYSICS, REPUTATION, IDLE_EVENTS, CAMERA as CAM, COLLISION, TRAFFIC, DRIFT } from '../data/balance';
import { DIALOGUES } from '../data/dialogues';

export type GameState = 'boot' | 'menu' | 'playing' | 'paused';

export interface HudData {
  speedKmh: number;
  coins: number;
  reputation: number;
  fps: number;
  showFps: boolean;
  placeholders: number;
}

export interface GameCallbacks {
  onStateChange?: (s: GameState) => void;
  onHud?: (h: HudData) => void;
}

const FIXED_DT = 1 / 120;

export class GameManager {
  /** ⭐ گارد تک‌نمونه: در هر لحظه فقط یک GameManager زنده مجاز است
   *  (جلوگیری از نمونه زامبی در StrictMode/HMR که کانواس را دوباره می‌کشد) */
  private static live: GameManager | null = null;

  private ctx: CanvasRenderingContext2D;
  private assets = new AssetManager();
  private input = new InputManager();
  private camera = new Camera();
  private save = new SaveManager();
  private audio = new AudioManager();
  private voice = new VoiceManager();
  private world = new World();
  private renderer: WorldRenderer;
  private vehicle = new Vehicle();
  private traffic: TrafficManager;
  private randomEvents: RandomEventManager;

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
  private hudThrottle = 0;
  private disposed = false;

  constructor(
    private canvas: HTMLCanvasElement,
    private callbacks: GameCallbacks = {},
  ) {
    // هر نمونه قبلیِ زنده را ببند (بازهم اگر جایی نشتی داشته باشد)
    if (GameManager.live && GameManager.live !== this) GameManager.live.dispose();
    GameManager.live = this;
    const ctx = canvas.getContext('2d');
    if (!ctx) throw new Error('Canvas 2D not supported');
    this.ctx = ctx;
    this.renderer = new WorldRenderer(this.assets, this.world, this.camera);

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
      this.renderer.pushBubble(this.pickLine('traffic_honk'), car.x, car.y, 'char_driver_01_idle', 2.6);
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
        this.renderer.pushBubble(this.pickLine('traffic_honk'), taxi.x, taxi.y, 'char_driver_01_idle', 2.6);
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
        this.audio.crash(false);
        this.camera.addShake(CAM.maxShake * 0.5);
        this.renderer.spawnBurst(v.x, v.y, '#B9B9B9', 10);
        this.save.mutate((d) => {
          d.reputation = Math.max(REPUTATION.min, d.reputation - REPUTATION.trafficCrashPenalty);
        });
        this.voice.trigger('car_crash', performance.now());
        if (Math.random() < 0.5) {
          this.renderer.pushBubble(this.pickLine('traffic_honk'), c.x, c.y, 'char_driver_01_idle', 2.4);
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

      this.renderer.update(rawDt);
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
      this.crashCooldown = 0.8;
      this.audio.crash(hard);
      this.camera.addShake(hard ? CAM.maxShake : CAM.maxShake * 0.45);
      this.renderer.spawnBurst(this.vehicle.x, this.vehicle.y, hard ? '#9B9B9B' : '#D6D6D6', hard ? 14 : 8);
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
      this.renderer.addSkidMark(ax, ay, this.vehicle.angle);
      this.skidSoundTimer -= dt;
      if (this.skidSoundTimer <= 0) {
        this.skidSoundTimer = DRIFT.skidSoundInterval;
        const intensity = Math.min(1, Math.abs(this.vehicle.latVel) / DRIFT.maxLateral + 0.35);
        this.audio.skid(intensity);
        this.renderer.spawnBurst(ax, ay, 'rgba(160,160,160,0.9)', 2, 60);
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

    // ---------- سکه ----------
    const got = this.world.collectCoins(this.vehicle.x, this.vehicle.y, 60);
    if (got > 0) {
      this.audio.coin();
      this.renderer.spawnBurst(this.vehicle.x, this.vehicle.y - 30, '#F2B705', 10, 120);
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
    this.camera.halfW = RENDER.logicalWidth / 2;
    this.camera.halfH = this.ctx.canvas.height / (this.scale * 2);
    this.camera.update(dt, this.vehicle.x, this.vehicle.y, this.vehicle.vx, this.vehicle.vy);
  }

  // ============ رسم ============
  private draw(): void {
    const ctx = this.ctx;
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

    this.renderer.draw(ctx, this.vehicle, this.traffic.cars, this.randomEvents.cat, this.randomEvents.cones);
    // حباب گفتار با مختصات دنیاست — باید با همان ترنسلیت دوربین رسم شود
    // (renderer.draw ترنسلیت را داخل save/restore خودش دارد و بعد از restore حذف می‌شود)
    ctx.save();
    ctx.translate(-this.camera.offsetX(), -this.camera.offsetY());
    this.drawSpeechBubble(ctx);
    ctx.restore();
    ctx.setTransform(1, 0, 0, 1, 0, 0);
  }

  /** حباب گفتار فارسی (RTL) بازیکن — رسم مشترک با حباب‌های محیطی در WorldRenderer */
  private drawSpeechBubble(ctx: CanvasRenderingContext2D): void {
    const info = this.voice.current;
    if (!info) return;
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
    });
  }

  // ============ رویدادهای صفحه ============
  private handleResize = (): void => {
    const dpr = Math.min(RENDER.maxDevicePixelRatio, window.devicePixelRatio || 1);
    const w = this.canvas.clientWidth || window.innerWidth;
    const h = this.canvas.clientHeight || window.innerHeight;
    this.canvas.width = Math.round(w * dpr);
    this.canvas.height = Math.round(h * dpr);
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
    window.removeEventListener('resize', this.handleResize);
    window.removeEventListener('keydown', this.onKeyDown);
    document.removeEventListener('visibilitychange', this.onVisibility);
    window.removeEventListener('beforeunload', this.onBeforeUnload);
    this.save.flush();
  }
}
