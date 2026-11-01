/**
 * CinematicPass.ts — پست‌پروسس سینمایی سبک موبایل (v0.2.64)
 *
 * زنجیرهٔ رندر:
 *   RenderPass → UnrealBloomPass (فقط شب) → OutputPass (ACES + sRGB) → GradePass (گرید رنگ + وینیت + گرِین)
 *
 * نکتهٔ فضای رنگی (three ≥ r152): هنگام رندر به RenderTarget تون‌مپینگ و تبدیل sRGB
 * اعمال نمی‌شود؛ بنابراین OutputPass مسئول ACES + sRGB است و GradePass در فضای
 * نمایشی (بعد از تون‌مپینگ) کار می‌کند — دقیقاً مثل مسیر رندر مستقیم.
 *
 * بودجهٔ موبایل:
 *  - ردهٔ ضعیف یا حالت «پرفورمنس»: بلوم خاموش (۳ پاس تمام‌صفحهٔ ارزان: رندر+خروجی+گرید)
 *  - ردهٔ استاندارد/بالا: بلوم فقط شب (قدرت متناسب با عمق شب)
 *  - هر خطای GPU در اولین استفاده → fallback دائمی به رندر مستقیم (بدون کرش)
 *  - بعد از webglcontextrestored → بازسازی کامل زنجیره
 */

import * as THREE from 'three';
import { EffectComposer } from 'three/examples/jsm/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/examples/jsm/postprocessing/RenderPass.js';
import { ShaderPass } from 'three/examples/jsm/postprocessing/ShaderPass.js';
import { UnrealBloomPass } from 'three/examples/jsm/postprocessing/UnrealBloomPass.js';
import { OutputPass } from 'three/examples/jsm/postprocessing/OutputPass.js';

export type QualityLevel = 'performance' | 'balanced' | 'quality';
export type DeviceTier = 'low' | 'standard' | 'high';

/** گرید سینمایی در فضای نمایشی: کنتراست S ملایم + اشباع + گرید دو-تُنه + وینیت + گرِین ریز */
const GradeShader = {
  uniforms: {
    tDiffuse: { value: null as THREE.Texture | null },
    /** ۰ = ظهر کامل، ۱ = نیمه‌شب کامل */
    uNight: { value: 0 },
    /** ثانیهٔ بازی — فقط برای انیمیشن گرِین */
    uTime: { value: 0 },
    /** شدت وینیت پایه (شب خودش اضافه می‌کند) */
    uVignette: { value: 0.44 },
  },
  vertexShader: /* glsl */ `
    varying vec2 vUv;
    void main() {
      vUv = uv;
      gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
    }
  `,
  fragmentShader: /* glsl */ `
    uniform sampler2D tDiffuse;
    uniform float uNight;
    uniform float uTime;
    uniform float uVignette;
    varying vec2 vUv;

    float hash12(vec2 p) {
      return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453123);
    }

    void main() {
      vec3 col = texture2D(tDiffuse, vUv).rgb;

      // کنتراست S-کِرِو ملایم — روز ۱٫۰۵، شب ۱٫۱۱ (سیاه‌های عمیق‌تر سینمایی)
      col = clamp(mix(vec3(0.5), col, 1.05 + 0.06 * uNight), 0.0, 1.0);

      // اشباع: روز پررنگ آرکید، شب کمی خشک‌تر
      float luma = dot(col, vec3(0.2126, 0.7152, 0.0722));
      col = clamp(mix(vec3(luma), col, 1.07 - 0.05 * uNight), 0.0, 1.0);

      // گرید دو-تُنه: روز گرمِ خاک تهران، شب آبیِ فیلم نوآر
      vec3 grade = mix(vec3(1.025, 1.0, 0.965), vec3(0.93, 0.975, 1.11), uNight);
      col *= grade;

      // وینیت نرم — چشم را به مرکز جاده می‌برد؛ شب عمیق‌تر
      vec2 d = vUv - 0.5;
      float vig = 1.0 - dot(d, d) * (uVignette + 0.28 * uNight) * 2.0;
      col *= clamp(vig, 0.0, 1.0);

      // گرِین ریز فیلمی — دانهٔ زندهٔ سنسور؛ شب محسوس‌تر ولی همیشه ظریف
      float g = (hash12(vUv * vec2(917.0, 613.0) + fract(uTime * 0.736) * 41.7) - 0.5) * 0.016;
      col += g * (0.6 + 0.4 * uNight);

      gl_FragColor = vec4(clamp(col, 0.0, 1.0), 1.0);
    }
  `,
};

export class CinematicPass {
  private composer: EffectComposer | null = null;
  private bloom: UnrealBloomPass | null = null;
  private grade: ShaderPass | null = null;
  /** خرابی دائمی GPU → برای همیشه رندر مستقیم بدون پست‌پروسس */
  private dead = false;
  private built = false;
  private sizeW = 2;
  private sizeH = 2;
  private tier: DeviceTier = 'standard';
  private quality: QualityLevel = 'balanced';

  constructor(
    private readonly renderer: THREE.WebGLRenderer,
    private readonly scene: THREE.Scene,
    private readonly camera: THREE.PerspectiveCamera,
  ) {}

  /** ردهٔ دستگاه/کیفیت انتخابی کاربر — هر زمان قابل تغییر */
  setMode(tier: DeviceTier, quality: QualityLevel): void {
    this.tier = tier;
    this.quality = quality;
  }

  /** ابعاد بافر رندر (همان که r3.setSize گرفته) */
  setSize(w: number, h: number): void {
    this.sizeW = Math.max(2, Math.round(w));
    this.sizeH = Math.max(2, Math.round(h));
    if (this.composer) this.composer.setSize(this.sizeW, this.sizeH);
  }

  /** ساخت زنجیره — یک‌بار بعد از ساخت رندرر یا بعد از بازیابی context */
  ensureBuilt(): void {
    if (this.built || this.dead) return;
    try {
      // MSAA متناسب رده: RT شمار قابل تنظیم است (WebGL2) — لبه‌های خنثی بدون هزینهٔ اضافی canvas
      const samples = this.quality === 'quality' && this.tier === 'high' ? 4
        : this.tier === 'low' || this.quality === 'performance' ? 0 : 2;
      const target = new THREE.WebGLRenderTarget(this.sizeW, this.sizeH, {
        type: THREE.HalfFloatType,
        samples,
      });
      const composer = new EffectComposer(this.renderer, target);
      composer.setSize(this.sizeW, this.sizeH);
      composer.addPass(new RenderPass(this.scene, this.camera));

      // بلوم شب: رزولوشن نصف — داخلی خودش چند سطح downsample می‌شود
      const bloom = new UnrealBloomPass(
        new THREE.Vector2(Math.max(2, this.sizeW >> 1), Math.max(2, this.sizeH >> 1)),
        0.0, // قدرت هر فریم از عمق شب تنظیم می‌شود
        0.55,
        0.8, // آستانهٔ HDR خطی: فقط چراغ‌ها/پنجره‌های روشن/هالهٔ ماه
      );
      bloom.enabled = false;
      composer.addPass(bloom);

      composer.addPass(new OutputPass()); // ACES + sRGB — معادل مسیر رندر مستقیم

      const grade = new ShaderPass(GradeShader);
      grade.renderToScreen = true;
      composer.addPass(grade);

      this.composer = composer;
      this.bloom = bloom;
      this.grade = grade;
      this.built = true;
    } catch {
      this.disposeChain();
      this.dead = true;
    }
  }

  /** هر فریم: dayNightFactor (۱=روز، ۰=شب) + زمان بازی برای گرِین */
  render(dayNightFactor: number, timeSec: number): void {
    if (this.dead) {
      this.renderer.render(this.scene, this.camera);
      return;
    }
    if (!this.built) this.ensureBuilt();
    if (!this.composer || !this.grade) {
      this.renderer.render(this.scene, this.camera);
      return;
    }
    const night = 1 - THREE.MathUtils.clamp(dayNightFactor, 0, 1);
    const u = this.grade.uniforms as Record<string, THREE.IUniform>;
    u['uNight'].value = night;
    u['uTime'].value = timeSec;
    u['uVignette'].value = 0.44;
    if (this.bloom) {
      // بلوم = پرهزینه‌ترین پاس؛ فقط ردهٔ متوسط/بالا با کیفیت غیر پرفورمنس و فقط شب
      const allowBloom = this.tier !== 'low' && this.quality !== 'performance';
      this.bloom.enabled = allowBloom && night > 0.06;
      this.bloom.strength = 0.16 + 0.5 * night;
    }
    try {
      this.composer.render(1 / 60);
    } catch {
      // اولین خطای GPU → برای همیشه مسیر مستقیم؛ تجربهٔ بازی هرگز نمی‌شکند
      this.disposeChain();
      this.dead = true;
    }
  }

  /** بعد از webglcontextrestored — همهٔ هدف‌های رندر از نو */
  rebuild(): void {
    this.disposeChain();
    this.built = false;
    this.ensureBuilt();
  }

  dispose(): void {
    this.disposeChain();
    this.dead = true;
  }

  private disposeChain(): void {
    try { this.bloom?.dispose(); } catch { /* ignore */ }
    try { this.grade?.dispose(); } catch { /* ignore */ }
    try { this.composer?.dispose(); } catch { /* ignore */ }
    this.composer = null;
    this.bloom = null;
    this.grade = null;
    this.built = false;
  }
}
