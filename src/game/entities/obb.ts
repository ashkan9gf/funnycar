/**
 * obb.ts — جعبه برخورد چرخان (OBB) + تست برخورد دقیق SAT (فاز HITBOX-EXACT)
 * ============================================================
 * چرا؟ دایره/AABB قدیمی «نچسبیدن» به ماشین را هم تصادف می‌گرفت:
 *  - دایره بزرگ = گوشه‌های ماشین همیشه داخل برخورد
 *  - AABB بدون چرخش = در حرکت مورب جعبه خیلی بزرگ‌تر از بدنه
 * SAT دو OBB: دقیق‌ترین حالت — «اگر واقعاً نخوردی، تصادف نیست»
 */

export interface OBB2D {
  cx: number; cy: number;
  /** محور اول (واحد) — مثلاً بردار جلوی ماشین */
  ax: number; ay: number;
  /** محور دوم (واحد) — مثلاً بردار راست ماشین */
  bx: number; by: number;
  /** نصف‌طول روی محور اول/دوم */
  ha: number; hb: number;
}

/** OBB از زاویه منطقی بازی (0 = رو به شمال/-Y): جلو = (sinA, -cosA)، راست = (cosA, sinA) */
export function obbFromAngle(cx: number, cy: number, angle: number, halfLen: number, halfWid: number): OBB2D {
  const s = Math.sin(angle);
  const c = Math.cos(angle);
  return {
    cx, cy,
    ax: s, ay: -c,
    bx: c, by: s,
    ha: halfLen, hb: halfWid,
  };
}

/** AABB به شکل OBB — برای ساختمان‌ها/مانع‌های axis-aligned */
export function obbFromAABB(x: number, y: number, w: number, h: number): OBB2D {
  return { cx: x + w / 2, cy: y + h / 2, ax: 1, ay: 0, bx: 0, by: 1, ha: w / 2, hb: h / 2 };
}

export interface MTV {
  /** جهت جداسازی (از B به A — جهت بیرون برای A) */
  x: number; y: number;
  /** عمق نفوذ */
  depth: number;
}

/**
 * تست SAT دو جعبه چرخان — اگر برخورد ندارند null، وگرنه کم‌عمق‌ترین محور جداسازی.
 * چهار محور کاندید: دو محور A + دو محور B (کافی و صحیح برای OBB در صفحه)
 */
export function satOverlapMTV(A: OBB2D, B: OBB2D): MTV | null {
  const dx = A.cx - B.cx;
  const dy = A.cy - B.cy;
  // شعاع هر جعبه روی یک محور دلخواه
  const ra = (O: OBB2D, x: number, y: number): number =>
    O.ha * Math.abs(O.ax * x + O.ay * y) + O.hb * Math.abs(O.bx * x + O.by * y);

  let best = Infinity;
  let bx = 0;
  let by = 0;
  const axes: Array<[number, number]> = [[A.ax, A.ay], [A.bx, A.by], [B.ax, B.ay], [B.bx, B.by]];
  for (const [xx, yy] of axes) {
    const rA = ra(A, xx, yy);
    const rB = ra(B, xx, yy);
    const dd = dx * xx + dy * yy;
    const overlap = rA + rB - Math.abs(dd);
    if (overlap <= 0) return null; // محور جداکننده پیدا شد = بدون برخورد
    if (overlap < best) {
      best = overlap;
      const s = dd < 0 ? -1 : 1;
      bx = xx * s;
      by = yy * s;
    }
  }
  return { x: bx, y: by, depth: best };
}
