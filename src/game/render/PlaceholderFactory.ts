/**
 * PlaceholderFactory.ts — تولید تصاویر موقتِ برچسب‌دار
 * ============================================================
 * قانون بخش ۶ و ۳۲ سند مادر:
 *  - تا وقتی Asset واقعی نیست، Placeholder برچسب‌دار ساخته می‌شود
 *  - Placeholder هرگز به‌عنوان Asset نهایی معرفی نمی‌شود (برچسب دارد)
 *  - کد بازی تفاوتی بین Placeholder و Asset واقعی نمی‌گذارد
 */

import type { PlaceholderType } from '../data/assets.manifest';

/** قهوه‌ای تیره خطوط (هم‌خوان با پالت پروژه) */
const OUTLINE = '#3A2E2A';
const WATERMARK = 'rgba(58,46,42,0.42)';

function makeCanvas(w: number, h: number): { cv: HTMLCanvasElement; ctx: CanvasRenderingContext2D } {
  const cv = document.createElement('canvas');
  cv.width = w;
  cv.height = h;
  const ctx = cv.getContext('2d');
  if (!ctx) throw new Error('Canvas 2D context unavailable');
  return { cv, ctx };
}

/** برچسب کوچک و مورب Placeholder — واضح ولی نه مزاحم گیم‌پلی */
function drawWatermark(ctx: CanvasRenderingContext2D, w: number, h: number, label: string): void {
  ctx.save();
  ctx.translate(w / 2, h / 2);
  ctx.rotate(-Math.PI / 9);
  const size = Math.max(11, Math.min(w, h) * 0.085);
  ctx.font = `600 ${size}px Vazirmatn, Tahoma, sans-serif`;
  ctx.fillStyle = WATERMARK;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(label ?? 'PLACEHOLDER', 0, 0);
  ctx.restore();
}

function roundRect(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number): void {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

/** ماشین کارتونی ساده (نمای بالا سه‌ربع‌نما) — قابل تشخیص و بامزه */
function drawVehicle(ctx: CanvasRenderingContext2D, w: number, h: number): void {
  const bw = w * 0.62;
  const bh = h * 0.86;
  const bx = (w - bw) / 2;
  const by = (h - bh) / 2;
  // سایه
  ctx.fillStyle = 'rgba(0,0,0,0.18)';
  ctx.beginPath();
  ctx.ellipse(w / 2 + 8, h / 2 + 12, bw * 0.56, bh * 0.5, 0, 0, Math.PI * 2);
  ctx.fill();
  // بدنه
  ctx.fillStyle = '#8AC926';
  ctx.strokeStyle = OUTLINE;
  ctx.lineWidth = Math.max(5, w * 0.035);
  roundRect(ctx, bx, by, bw, bh, bw * 0.32);
  ctx.fill();
  ctx.stroke();
  // شیشه جلو و عقب
  ctx.fillStyle = '#BDE0FE';
  const gl = bw * 0.62;
  roundRect(ctx, w / 2 - gl / 2, by + bh * 0.09, gl, bh * 0.2, gl * 0.3);
  ctx.fill();
  roundRect(ctx, w / 2 - gl / 2, by + bh * 0.72, gl, bh * 0.16, gl * 0.3);
  ctx.fill();
  // چراغ‌ها
  ctx.fillStyle = '#FFD166';
  roundRect(ctx, bx + 6, by + 4, bw * 0.22, bh * 0.05, 6);
  ctx.fill();
  roundRect(ctx, bx + bw - 6 - bw * 0.22, by + 4, bw * 0.22, bh * 0.05, 6);
  ctx.fill();
}

/** پرتره ساده — دایره چهره + کلاه + سبیل */
function drawPortrait(ctx: CanvasRenderingContext2D, w: number, h: number): void {
  const cx = w / 2;
  const cy = h * 0.55;
  const r = Math.min(w, h) * 0.32;
  ctx.fillStyle = '#FFF3D6';
  ctx.strokeStyle = OUTLINE;
  ctx.lineWidth = Math.max(5, w * 0.03);
  ctx.beginPath();
  ctx.arc(cx, cy, r, 0, Math.PI * 2);
  ctx.fill();
  ctx.stroke();
  // کلاه
  ctx.fillStyle = '#D64545';
  roundRect(ctx, cx - r * 0.9, cy - r * 1.25, r * 1.8, r * 0.55, r * 0.25);
  ctx.fill();
  ctx.stroke();
  // چشم‌ها
  ctx.fillStyle = OUTLINE;
  ctx.beginPath();
  ctx.arc(cx - r * 0.35, cy - r * 0.05, r * 0.09, 0, Math.PI * 2);
  ctx.arc(cx + r * 0.35, cy - r * 0.05, r * 0.09, 0, Math.PI * 2);
  ctx.fill();
  // لبخند
  ctx.strokeStyle = OUTLINE;
  ctx.lineWidth = Math.max(3, w * 0.02);
  ctx.beginPath();
  ctx.arc(cx, cy + r * 0.25, r * 0.4, 0.25 * Math.PI, 0.75 * Math.PI);
  ctx.stroke();
}

/** کاشی‌های زمین — رنگ تخت + الگوی ساده */
function drawTile(ctx: CanvasRenderingContext2D, w: number, h: number, type: PlaceholderType): void {
  if (type === 'tile_road') {
    ctx.fillStyle = '#575757';
    ctx.fillRect(0, 0, w, h);
    ctx.fillStyle = 'rgba(255,243,214,0.85)';
    const dw = w * 0.06;
    for (let y = h * 0.05; y < h; y += h * 0.22) ctx.fillRect(w / 2 - dw / 2, y, dw, h * 0.11);
  } else if (type === 'tile_cross') {
    ctx.fillStyle = '#575757';
    ctx.fillRect(0, 0, w, h);
    ctx.fillStyle = 'rgba(255,243,214,0.85)';
    const s = w * 0.045;
    for (let i = 0; i < 6; i++) {
      ctx.fillRect(w * 0.12 + i * w * 0.14, h * 0.04, s, h * 0.2);
      ctx.fillRect(w * 0.12 + i * w * 0.14, h * 0.96 - h * 0.2, s, h * 0.2);
      ctx.fillRect(w * 0.04, h * 0.12 + i * h * 0.14, w * 0.2, s);
      ctx.fillRect(w * 0.96 - w * 0.2, h * 0.12 + i * h * 0.14, w * 0.2, s);
    }
  } else if (type === 'tile_sidewalk') {
    ctx.fillStyle = '#D9CBA8';
    ctx.fillRect(0, 0, w, h);
    ctx.strokeStyle = 'rgba(58,46,42,0.25)';
    ctx.lineWidth = 3;
    for (let i = 0; i <= 4; i++) {
      ctx.beginPath();
      ctx.moveTo((i * w) / 4, 0);
      ctx.lineTo((i * w) / 4, h);
      ctx.moveTo(0, (i * h) / 4);
      ctx.lineTo(w, (i * h) / 4);
      ctx.stroke();
    }
  } else {
    // tile_ground
    ctx.fillStyle = '#C9B98A';
    ctx.fillRect(0, 0, w, h);
    ctx.fillStyle = 'rgba(58,46,42,0.12)';
    for (let i = 0; i < 26; i++) {
      const px = ((i * 197) % w);
      const py = ((i * 149) % h);
      ctx.beginPath();
      ctx.arc(px, py, w * 0.012, 0, Math.PI * 2);
      ctx.fill();
    }
  }
}

/** ساختمان ساده با پنجره */
function drawBuilding(ctx: CanvasRenderingContext2D, w: number, h: number): void {
  ctx.fillStyle = '#2A9D8F';
  ctx.strokeStyle = OUTLINE;
  ctx.lineWidth = Math.max(5, w * 0.03);
  roundRect(ctx, w * 0.08, h * 0.06, w * 0.84, h * 0.88, w * 0.06);
  ctx.fill();
  ctx.stroke();
  ctx.fillStyle = '#BDE0FE';
  const cols = 3;
  const rows = 4;
  for (let i = 0; i < cols; i++) {
    for (let j = 0; j < rows; j++) {
      const pw = w * 0.16;
      const ph = h * 0.12;
      const px = w * 0.14 + i * w * 0.27;
      const py = h * 0.14 + j * h * 0.19;
      roundRect(ctx, px, py, pw, ph, pw * 0.25);
      ctx.fill();
    }
  }
}

/** پروپ‌های عمومی — دایره‌ای قابل تشخیص */
function drawProp(ctx: CanvasRenderingContext2D, w: number, h: number): void {
  ctx.fillStyle = '#8AC926';
  ctx.strokeStyle = OUTLINE;
  ctx.lineWidth = Math.max(4, w * 0.04);
  ctx.beginPath();
  ctx.arc(w / 2, h / 2, Math.min(w, h) * 0.36, 0, Math.PI * 2);
  ctx.fill();
  ctx.stroke();
  ctx.fillStyle = 'rgba(58,46,42,0.25)';
  ctx.beginPath();
  ctx.arc(w / 2 - w * 0.08, h / 2 - h * 0.08, Math.min(w, h) * 0.1, 0, Math.PI * 2);
  ctx.fill();
}

function drawEffect(ctx: CanvasRenderingContext2D, w: number, h: number): void {
  ctx.strokeStyle = '#9B9B9B';
  ctx.lineWidth = Math.max(4, w * 0.05);
  const cx = w / 2;
  const cy = h / 2;
  const r = Math.min(w, h) * 0.36;
  for (let i = 0; i < 6; i++) {
    const a = (i / 6) * Math.PI * 2;
    ctx.beginPath();
    ctx.moveTo(cx + Math.cos(a) * r * 0.4, cy + Math.sin(a) * r * 0.4);
    ctx.lineTo(cx + Math.cos(a) * r, cy + Math.sin(a) * r);
    ctx.stroke();
  }
}

function drawUi(ctx: CanvasRenderingContext2D, w: number, h: number): void {
  ctx.fillStyle = '#F2B705';
  ctx.strokeStyle = OUTLINE;
  ctx.lineWidth = Math.max(4, w * 0.035);
  roundRect(ctx, w * 0.1, h * 0.25, w * 0.8, h * 0.5, h * 0.2);
  ctx.fill();
  ctx.stroke();
}

/**
 * ساخت تصویر Placeholder برچسب‌دار برای یک نوع مشخص
 */
export function createPlaceholder(type: PlaceholderType, w: number, h: number, label?: string): HTMLCanvasElement {
  const { cv, ctx } = makeCanvas(w, h);
  switch (type) {
    case 'vehicle': drawVehicle(ctx, w, h); break;
    case 'portrait': drawPortrait(ctx, w, h); break;
    case 'tile_road':
    case 'tile_cross':
    case 'tile_sidewalk':
    case 'tile_ground': drawTile(ctx, w, h, type); break;
    case 'building': drawBuilding(ctx, w, h); break;
    case 'prop': drawProp(ctx, w, h); break;
    case 'effect': drawEffect(ctx, w, h); break;
    case 'ui': drawUi(ctx, w, h); break;
  }
  // کاشی‌ها برچسب کوچک‌تر دارند تا الگوی تکرار به‌هم نخورد
  drawWatermark(ctx, w, h, type.startsWith('tile') ? 'PH' : (label ?? 'PLACEHOLDER'));
  return cv;
}
