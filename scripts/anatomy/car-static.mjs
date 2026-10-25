/* car-static.mjs — همهٔ قطعات ایستای فیگور «فانی‌کار روی بالانسر قیچی»
 * فقط برای Node؛ توابع متحرک (قیچی/میلهٔ جک) اینجا تعریف می‌شوند تا با toString() به صفحهٔ زنده هم بروند.
 */
import * as k from "./iso-kit.mjs";
import * as G from "./lathe.mjs";
import * as SH from "./car-shared.mjs";

const { GEO } = SH;
const S = (paths, style) => k.solidSvg(paths, style);
const L = (d, style) => k.lineSvg(d, style);
const D = (points, style) => k.dotsSvg(points, style);
const iso = (p, P) => k.iso(p, P);
const RR = GEO.RIDE;

/* ---------- گروه قیچی (در صفحهٔ زنده هم با همین تابع بازسازی می‌شود) ---------- */
export function scissorSvg(hz, yC, P, tone = "mid") {
  const hx = Math.sqrt(GEO.L * GEO.L - hz * hz);
  const topZ = GEO.BASE_H + 2 * hz;
  const out = [];
  for (const off of [-GEO.BEAM_OFF, GEO.BEAM_OFF]) {
    const y = yC + off;
    out.push(SH.boxSvg(SH.beamBox([-hx, y, GEO.BASE_H], [hx, y, topZ], y, 4.6, GEO.BEAM_T), P, { tone }));
  }
  const pins = [
    [-hx, yC, GEO.BASE_H], [hx, yC, GEO.BASE_H],
    [-hx, yC, topZ], [hx, yC, topZ],
  ].map((p) => iso(p, P));
  out.push(k.dotsSvg(pins, { size: 0.9, tone: "mid" }));
  out.push(k.dotsSvg([iso([0, yC, GEO.BASE_H + hz], P)], { size: 1.1, tone: "hi" }));
  return out.join("");
}

export function rodSvg(hz, P) {
  const topZ = GEO.BASE_H + 2 * hz;
  const out = [];
  out.push(S(k.cylinder(0, GEO.ROD_Y, GEO.ROD_R, GEO.BASE_H + 6, topZ - GEO.BASE_H - 6, P, 20), { tone: "hi", crease: "none" }));
  out.push(L(k.ring(0, GEO.ROD_Y, GEO.ROD_R + 0.5, topZ, P, 20), { tone: "lo" }));
  out.push(D([iso([0, GEO.ROD_Y, topZ], P)], { size: 1.1, tone: "hi" }));
  return out.join("");
}

/* ---------- زمین کارگاه ---------- */
export function floorParts(P) {
  const out = [];
  const F = GEO.FLOOR, H = GEO.FLOOR_H;
  out.push(`<path class="iso-halo" d="${k.haloOf(GEO.BASE, -1, 2, P)}"/>`);
  for (const [x, y] of k.corners(F, 14)) {
    out.push(S(k.cylinder(x, y, 7, -H - 1.6, 1.6, P, 24), { tone: "lo" }));
    out.push(S(k.cylinder(x, y, 5.4, -H, 3.4, P, 24), { tone: "mid" }));
  }
  out.push(S(k.slabOf(F, -H, H, P, 8, 1.6), { tone: "lo" }));
  out.push(L(k.planOutline(k.insetPlan(F, 5), 0, P), { tone: "lo" }));
  const screws = k.corners(F, 12);
  out.push(L(screws.map(([x, y]) => k.ring(x, y, 2.2, 0, P, 16)).join(""), { tone: "lo" }));
  out.push(D(screws.map(([x, y]) => iso([x, y, 0], P)), { size: 0.5 }));
  const strip = { x: -110, y: 84, w: 220, d: 7, r: 1 };
  out.push(S(k.slabOf(strip, 0, 0.6, P, 3), { tone: "lo", crease: "none" }));
  const ticks = k.topTicks(strip.x + 4, strip.x + strip.w - 4, 4, 5, strip.y + 0.8, 0.6, [2, 3.6], P);
  out.push(L(ticks.minor, { tone: "lo" }), L(ticks.major, { tone: "mid" }));
  out.push(D([iso([strip.x + 2, strip.y + 3.5, 0.6], P), iso([strip.x + strip.w - 2, strip.y + 3.5, 0.6], P)], { size: 0.45 }));
  out.push(L(k.ring(118, -52, 8, 0.2, P, 32) + k.ring(118, -52, 5.5, 0.2, P, 24), { tone: "lo" }));
  out.push(D(k.dotGrid(118, -52, 3, 3, 2.2, 0.25, P), { size: 0.4, tone: "lo" }));
  out.push(L(k.ring(30, 70, 10, 0.2, P, 28) + k.ring(30, 70, 6.5, 0.2, P, 22), { tone: "faint" }));
  out.push(D([iso([30, 70, 0.2], P)], { size: 0.5, tone: "lo" }));
  return out.join("");
}

/* ---------- تابلوی فرمان ---------- */
export function cabinetParts(P) {
  const out = [];
  const C = GEO.CAB, H = GEO.CAB_H;
  out.push(`<path class="iso-halo" d="${k.haloOf(C, -0.5, 1, P)}"/>`);
  out.push(S(k.slabOf(C, 0, H, P, 3, 1), { tone: "mid" }));
  out.push(L(k.planOutline(k.insetPlan(C, 2.5), H, P), { tone: "lo" }));
  const zB = H + 2.2;
  for (const [x, chev] of [[-140, 1], [-132, -1]]) {
    out.push(S(k.cylinder(x, -12, 2.6, H, 2.2, P, 20), { tone: "hi" }));
    out.push(L(k.ring(x, -12, 2.6, zB, P, 16), { tone: "lo" }));
    out.push(L(k.pathOf([
      iso([x - 1.2, -12 - 1.2 * chev, zB], P),
      iso([x, -12 + 1.2 * chev, zB], P),
      iso([x + 1.2, -12 - 1.2 * chev, zB], P),
    ]), { tone: "mid" }));
  }
  out.push(S(k.cylinder(-124, -12, 3.2, H, 4, P, 20), { tone: "mid" }));
  out.push(L(k.knurl(-124, -12, 3.2, H, H + 4, 24, P), { tone: "lo" }));
  out.push(D([iso([-124, -12, H + 4], P)], { size: 0.5, tone: "hi" }));
  const plate = { x: -143, y: -26, w: 15, d: 8.5, r: 1.5 };
  out.push(S(k.slabOf(plate, H, 0.7, P, 2), { tone: "hi", crease: "none" }));
  out.push(L(k.lineOnTop([plate.x + 2, plate.y + plate.d - 2.1], [plate.x + plate.w - 2, plate.y + plate.d - 2.1], H + 0.7, P), { tone: "lo" }));
  out.push(L(k.lineOnTop([plate.x + 2, plate.y + 2.1], [plate.x + plate.w - 2, plate.y + 2.1], H + 0.7, P), { tone: "lo" }));
  out.push(k.faceTextSvg(k.topMatrix([plate.x + 2.5, plate.y + 6], H + 0.7, P, "x"), "FC-9000", { size: 2.4, tone: "lo" }));
  /* کابل برق از تابلو به بدنهٔ بالانسر — نقاط wireSvg باید iso Projection‌شده باشند */
  out.push(k.wireSvg(iso([-120, -14, 8], P), iso([-104, -18, 4], P), { via: [iso([-111, -22, 2.4], P)], tone: "lo" }));
  return out.join("");
}

/* ---------- بالانسر: شاسی ثابت + شلنگ + گروه‌های متحرک ---------- */
export function liftStatic(P) {
  const out = [];
  const B = GEO.BASE, H = GEO.BASE_H;
  out.push(S(k.slabOf(B, 0, H, P, 5, 1), { tone: "mid" }));
  for (const y of GEO.BEAM_Y) out.push(L(k.lineOnTop([-98, y], [98, y], H, P), { tone: "faint" }));
  const bolts = k.corners(B, 9);
  out.push(L(bolts.map(([x, y]) => k.ring(x, y, 1.8, H, P, 14)).join(""), { tone: "lo" }));
  out.push(D(bolts.map(([x, y]) => iso([x, y, H], P)), { size: 0.45 }));
  out.push(S(k.cylinder(0, GEO.ROD_Y, GEO.SLEEVE_R, H, GEO.SLEEVE_H, P, 28), { tone: "mid" }));
  out.push(L(k.ring(0, GEO.ROD_Y, GEO.SLEEVE_R, H + GEO.SLEEVE_H, P, 24) + k.ring(0, GEO.ROD_Y, GEO.SLEEVE_R + 0.8, H + 1.6, P, 24), { tone: "lo" }));
  return out.join("");
}

/* ---------- چرخ کامل ---------- */
function wheel(P, x, y) {
  const out = [];
  const F = G.frameAlong([x, y, RR + 21], [0, 1, 0]);
  out.push(S(G.lathe([[-4.5, 10.4], [-3.2, 12.5, 1], [3.2, 12.5, 1], [4.5, 10.4]], F, P, { steps: 44 }), { tone: "lo" }));
  out.push(L(G.circleOf(F, y < 0 ? -4.4 : 4.4, 10.6, P, 30), { tone: "mid" }));
  out.push(S(G.disc(-5.2, 5.2, 5.4, F, P), { tone: "mid" }));
  const outer = y < 0 ? -5.2 : 5.2;
  out.push(L(G.circleOf(F, outer, 5.4, P, 24), { tone: "lo" }));
  out.push(D(G.dotsOf(F, outer, 3.2, 4, P, { all: true, phase: 0.6 }), { size: 0.45 }));
  out.push(D([iso(G.pointOf(F, outer, 0, 0), P)], { size: 0.6, tone: "hi" }));
  return out.join("");
}

/* ---------- گروه متحرک: صفحه + بالشتک‌ها + شاسی کامل خودرو ---------- */
export function rideParts(P) {
  const out = [];
  out.push(`<path class="iso-halo" d="${k.haloOf({ x: -98, y: -36, w: 196, d: 72, r: 10 }, -0.3, 0.5, P)}"/>`);
  /* صفحهٔ بالانسر */
  out.push(S(k.slabOf(GEO.PLAT, 0, GEO.PLAT_H, P, 5, 0.8), { tone: "mid" }));
  const stripes = k.topTicks(-100, 100, 5, 4, 47, GEO.PLAT_H, [2, 3], P);
  out.push(L(stripes.minor, { tone: "lo" }), L(stripes.major, { tone: "mid" }));
  for (const [x, y] of k.corners(GEO.PLAT, 6)) out.push(D([iso([x, y, GEO.PLAT_H], P)], { size: 0.45, tone: "lo" }));
  /* بالشتک‌های لاستیکی */
  for (const px of [61, -79]) for (const py of [13, -31]) {
    out.push(S(k.slabOf({ x: px, y: py, w: 18, d: 18, r: 4 }, GEO.PLAT_H, GEO.PAD_H, P, 3, 0.5), { tone: "lo" }));
    out.push(D([iso([px + 9, py + 9, GEO.PLAT_H + GEO.PAD_H], P)], { size: 0.4, tone: "lo" }));
  }
  /* چرخ‌های سمت دور */
  out.push(wheel(P, GEO.WHEEL_X, -GEO.WHEEL_Y));
  out.push(wheel(P, -GEO.WHEEL_X, -GEO.WHEEL_Y));
  /* اکسل‌ها + دیفرانسیل + رک فرمان */
  out.push(S(G.lathe([[0, 2.4], [40, 2.4]], G.frameAlong([GEO.WHEEL_X, -20, RR + 20.5], [0, 1, 0]), P, { steps: 22 }), { tone: "mid" }));
  out.push(S(G.lathe([[0, 2.4], [40, 2.4]], G.frameAlong([-GEO.WHEEL_X, -20, RR + 20.5], [0, 1, 0]), P, { steps: 22 }), { tone: "mid" }));
  out.push(S(G.sphereOf([-GEO.WHEEL_X, 0, RR + 20.5], 4.5, P, { steps: 30 }), { tone: "mid" }));
  out.push(S(G.lathe([[0, 1.4], [44, 1.4]], G.frameAlong([92, -18, RR + 15], [-1, 0, 0]), P, { steps: 18 }), { tone: "mid" }));
  /* کارترانسیشن + گیربکس + موتور */
  out.push(S(G.lathe([[0, 2], [65, 2]], G.frameAlong([0, 0, RR + 20.5], [-1, 0, 0]), P, { steps: 18 }), { tone: "mid" }));
  out.push(S(k.slabOf({ x: -86, y: -15, w: 26, d: 30, r: 5 }, RR + 10, 9, P, 3, 0.8), { tone: "mid" }));
  out.push(L(k.lineOnTop([-80, -15], [-80, 15], RR + 19, P) + k.lineOnTop([-66, -15], [-66, 15], RR + 19, P), { tone: "faint" }));
  out.push(S(k.cylinder(-80, 12, 2.2, RR + 19, 2.5, P, 16), { tone: "mid" }));
  out.push(L(k.ring(-80, 12, 2.2, RR + 21.5, P, 14), { tone: "lo" }));
  out.push(S(k.slabOf({ x: 0, y: -11, w: 26, d: 22, r: 4 }, RR + 10, 12, P, 3, 0.8), { tone: "mid" }));
  out.push(S(k.slabOf({ x: 26, y: -16, w: 36, d: 32, r: 2.5 }, RR + 9, 16, P, 2.5, 0.8), { tone: "hi" }));
  out.push(S(k.slabOf({ x: 32, y: -12, w: 24, d: 24, r: 4 }, RR + 25, 4, P, 3, 0.8), { tone: "hi" }));
  out.push(L([36, 40, 44, 48].map((x) => k.lineOnTop([x, -9], [x, 9], RR + 29, P)).join(""), { tone: "faint" }));
  out.push(S(k.cylinder(44, 4, 5.5, RR + 29, 3.5, P, 24), { tone: "mid" }));
  out.push(L(k.ring(44, 4, 5.5, RR + 32.5, P, 20), { tone: "lo" }));
  out.push(D([iso([44, 4, RR + 32.5], P)], { size: 0.6, tone: "hi" }));
  out.push(S(k.cylinder(64, -8, 3, RR + 10, 2.5, P, 18), { tone: "mid" }));
  out.push(L(k.ring(64, -8, 3, RR + 12.5, P, 16), { tone: "lo" }));
  /* شاسی‌ها: دو لنگر + دوجهت‌کن */
  out.push(S(k.slabOf({ x: -92, y: 12, w: 184, d: 8, r: 2 }, RR + 25.5, 6, P, 2, 0.5), { tone: "hi" }));
  out.push(S(k.slabOf({ x: -92, y: -20, w: 184, d: 8, r: 2 }, RR + 25.5, 6, P, 2, 0.5), { tone: "hi" }));
  out.push(S(k.slabOf({ x: -34, y: -20, w: 5, d: 40, r: 1.5 }, RR + 25.5, 6, P, 2, 0.4), { tone: "mid" }));
  out.push(S(k.slabOf({ x: -6, y: -20, w: 5, d: 40, r: 1.5 }, RR + 25.5, 6, P, 2, 0.4), { tone: "mid" }));
  for (const y of [16, -16]) out.push(D([-80, -48, -16, 16, 48, 80].map((x) => iso([x, y, RR + 31.5], P)), { size: 0.4, tone: "lo" }));
  /* بازوها + فنرها + کمک‌فنرها */
  for (const ax of [GEO.WHEEL_X, -GEO.WHEEL_X]) for (const ay of [16, -25]) {
    out.push(S(k.slabOf({ x: ax < 0 ? ax - 16 : ax, y: ay, w: 16, d: 9, r: 2 }, RR + 12, 3, P, 2, 0.4), { tone: "mid" }));
  }
  for (const sx of [GEO.WHEEL_X, -GEO.WHEEL_X]) for (const sy of [16, -16]) {
    const coil = SH.coilZ(RR + 15, RR + 25.5, [sx, sy], 5.6, 6, P, 14);
    out.push(L(coil.back, { tone: "lo" }));
    out.push(S(k.cylinder(sx, sy, 1.5, RR + 15, 10.5, P, 12), { tone: "hi", crease: "none" }));
    out.push(L(coil.front, { tone: "mid" }));
    out.push(D([iso([sx, sy, RR + 25.5], P)], { size: 0.45, tone: "mid" }));
  }
  /* کابین: کف + صندلی‌ها + ستون فرمان + غربیلک */
  out.push(S(k.slabOf({ x: -50, y: -27, w: 102, d: 54, r: 5 }, RR + 31.5, 4, P, 4, 0.6), { tone: "hi" }));
  out.push(S(k.slabOf({ x: -16, y: 2, w: 15, d: 12, r: 3 }, RR + 35.5, 4.5, P, 2.5, 0.6), { tone: "hi" }));
  out.push(S(k.slabOf({ x: -16, y: -15, w: 15, d: 12, r: 3 }, RR + 35.5, 4.5, P, 2.5, 0.6), { tone: "hi" }));
  out.push(S(k.slabOf({ x: -25, y: 2.5, w: 7, d: 11, r: 2 }, RR + 35.5, 12, P, 2, 0.5), { tone: "hi" }));
  out.push(S(k.slabOf({ x: -25, y: -16.5, w: 7, d: 11, r: 2 }, RR + 35.5, 12, P, 2, 0.5), { tone: "hi" }));
  const colDir = SH.unit3([12, -22, -19.5]);
  out.push(S(G.lathe([[0, 1.3], [30, 1.3]], G.frameAlong([36, 8, RR + 35.5], colDir), P, { steps: 14 }), { tone: "mid" }));
  const SW = G.frameAlong([36, 8, RR + 35.5], colDir);
  out.push(L(G.circleOf(SW, -2.5, 5.2, P, 30) + G.circleOf(SW, -2.5, 4.1, P, 24), { tone: "mid" }));
  out.push(L(G.spokesOf(SW, -2.5, 1.1, 5, 3, P, { phase: 0.4 }), { tone: "mid" }));
  out.push(D([iso(G.pointOf(SW, -2.5, 0, 0), P)], { size: 0.7, tone: "hi" }));
  /* شیشه‌ها + آینه‌ها */
  out.push(S(k.slabOf({ x: 46, y: -24, w: 6, d: 48, r: 2 }, RR + 35.5, 13, P, 2, 0.5), { tone: "mid", crease: "lo" }));
  out.push(S(k.slabOf({ x: -48, y: -24, w: 6, d: 48, r: 2 }, RR + 35.5, 9.5, P, 2, 0.5), { tone: "mid", crease: "lo" }));
  out.push(S(k.slabOf({ x: 40, y: 27, w: 5, d: 3.5, r: 1.5 }, RR + 40, 3, P, 2, 0.4), { tone: "mid" }));
  out.push(S(k.slabOf({ x: 40, y: -30.5, w: 5, d: 3.5, r: 1.5 }, RR + 40, 3, P, 2, 0.4), { tone: "mid" }));
  /* سپرها + چراغ‌ها */
  out.push(S(k.slabOf({ x: 92, y: -30, w: 6, d: 60, r: 3 }, RR + 10, 8, P, 2.5, 0.6), { tone: "mid" }));
  out.push(S(k.slabOf({ x: -98, y: -30, w: 6, d: 60, r: 3 }, RR + 10, 8, P, 2.5, 0.6), { tone: "mid" }));
  for (const y of [22, -22]) {
    out.push(S(k.cylinder(95, y, 2.8, RR + 18, 2, P, 18), { tone: "hi" }));
    out.push(L(k.ring(95, y, 2.8, RR + 20, P, 16), { tone: "lo" }));
    out.push(S(k.slabOf({ x: -99, y: y - 4, w: 3, d: 8, r: 1 }, RR + 15, 3, P, 1.5, 0.4), { tone: "lo" }));
  }
  /* چرخ‌های سمت نزدیک */
  out.push(wheel(P, -GEO.WHEEL_X, GEO.WHEEL_Y));
  out.push(wheel(P, GEO.WHEEL_X, GEO.WHEEL_Y));
  /* گوشهٔ چرخ‌باز جلو-چپ: توپی + دیسک + کالیپر (قطعهٔ lit) */
  const HF = G.frameAlong([GEO.WHEEL_X, 20, RR + 21], [0, 1, 0]);
  out.push(S(G.lathe([[0, 4.6], [11, 4.6]], HF, P, { steps: 24 }), { tone: "hi" }));
  out.push(L(G.circleOf(HF, 11, 4.6, P, 20), { tone: "lo" }));
  out.push(D(G.dotsOf(HF, 11, 3.1, 4, P, { all: true, phase: 0.6 }), { size: 0.45 }));
  const BF = G.frameAlong([GEO.WHEEL_X, RR * 0 + 26.2, RR + 21], [0, 1, 0]);
  out.push(S(G.lathe([[0, 9.6], [2.4, 9.6]], BF, P, { steps: 40 }), { tone: "hi", lit: true }));
  out.push(L(G.circleOf(BF, 0, 9.6, P, 32) + G.circleOf(BF, 2.4, 9.6, P, 32), { tone: "lo" }));
  out.push(D(G.dotsOf(BF, 1.2, 6.6, 8, P, { all: true }), { size: 0.35, tone: "lo" }));
  out.push(D(G.dotsOf(BF, 2.4, 3.1, 5, P, { all: true, phase: 0.5 }), { size: 0.45, tone: "mid" }));
  out.push(SH.boxSvg(SH.beamBox([GEO.WHEEL_X - 5, 27.4, RR + 29.5], [GEO.WHEEL_X + 5, 27.4, RR + 29.5], 27.4, 4.5, 5.5), P, { tone: "hi" }));
  out.push(k.wireSvg(iso([GEO.WHEEL_X, 29, RR + 32.5], P), iso([GEO.WHEEL_X, 16, RR + 31.5], P), { via: [iso([GEO.WHEEL_X, 24, RR + 34], P)], tone: "lo" }));
  out.push(L(k.ring(GEO.WHEEL_X, 30, 5, GEO.PLAT_H + 0.2, P, 20) + k.ring(GEO.WHEEL_X, 30, 3, GEO.PLAT_H + 0.2, P, 16), { tone: "faint" }));
  return out.join("");
}

/* ---------- وسایل کنار زمین ---------- */
export function propsParts(P) {
  const out = [];
  out.push(`<path class="iso-halo" d="${k.haloOf({ x: -146, y: 40, w: 30, d: 20, r: 3 }, -0.5, 1, P)}"/>`);
  out.push(S(k.slabOf({ x: -146, y: 40, w: 30, d: 20, r: 3 }, 0, 13, P, 3, 0.8), { tone: "mid" }));
  out.push(L(k.lineOnTop([-144, 53], [-118, 53], 13, P), { tone: "faint" }));
  out.push(S(k.slabOf({ x: -138, y: 46, w: 13, d: 3, r: 1.5 }, 13, 3, P, 2, 0.4), { tone: "mid", crease: "none" }));
  out.push(D([iso([-141, 51, 13], P), iso([-123, 51, 13], P)], { size: 0.5 }));
  const FLAT = [[0, 9], [1.5, 12.3, 1], [8.5, 12.3, 1], [10, 9]];
  const SF = G.frameAlong([114, 64, 0], [0, 0, 1]);
  out.push(S(G.lathe(FLAT, SF, P, { steps: 40 }), { tone: "lo" }));
  out.push(S(G.lathe(FLAT.map(([s, r, sm]) => [s + 10, r, sm]), SF, P, { steps: 40 }), { tone: "lo" }));
  out.push(S(G.disc(20, 20.7, 6.4, SF, P), { tone: "mid" }));
  out.push(D(G.dotsOf(SF, 20.7, 3.4, 4, P, { all: true, phase: 0.6 }), { size: 0.45 }));
  const LF = G.frameAlong([102, 74, 0], SH.unit3([0.42, -0.3, 0.86]));
  out.push(S(G.lathe(FLAT, LF, P, { steps: 40 }), { tone: "lo" }));
  out.push(S(G.disc(10, 10.7, 5.2, LF, P), { tone: "mid" }));
  out.push(D(G.dotsOf(LF, 10.7, 2.9, 4, P, { all: true, phase: 0.6 }), { size: 0.45 }));
  /* سینی پیچه + سطل روغن — گوشهٔ خالی جلوی صفحه */
  out.push(S(k.slabOf({ x: -84, y: 66, w: 24, d: 14, r: 2 }, 0, 3.2, P, 2, 0.4), { tone: "mid" }));
  out.push(S(k.slabOf(k.insetPlan({ x: -84, y: 66, w: 24, d: 14, r: 2 }, 1.6), 3.2, 1.2, P, 2, 0.3), { tone: "lo", crease: "none" }));
  out.push(D([iso([-78, 71, 4.4], P), iso([-72, 74, 4.4], P), iso([-75, 68.5, 4.4], P)], { size: 0.55, tone: "hi" }));
  out.push(S(k.cylinder(58, 80, 6, 0, 9, P, 22), { tone: "mid" }));
  out.push(L(k.ring(58, 80, 6, 9, P, 20) + k.ring(58, 80, 4.6, 9.2, P, 18), { tone: "lo" }));
  out.push(S(k.cylinder(58, 80, 1.2, 9, 2.4, P, 10), { tone: "mid", crease: "none" }));
  return out.join("");
}

/* ---------- نقاط fit دوربین ---------- */
export function fitPoints() {
  return [
    ...k.boxCorners(GEO.FLOOR, -GEO.FLOOR_H - 1.6, 0),
    [-104, -50, 97], [104, 50, 97],
    [0, 27, 132],
    ...k.boxCorners(GEO.CAB, 0, GEO.CAB_H + 4),
    [114, 64, 21], [102, 88, 13],
  ];
}
