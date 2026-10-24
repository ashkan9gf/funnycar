/* car-shared.mjs — هندسهٔ مشترک فیگور «فانی‌کار روی بالانسر قیچی»
 * خالص و بدون وابستگی: هم در Node (build) و هم به‌صورت toString() در صفحهٔ زنده inline می‌شود.
 * واحدهای جهان: ~۱ پیکسل. x/y روی زمین، z بالا. این فیگور آناتومی شاسیِ خودروی بازی است.
 */

export const GEO = {
  W: 800, H: 560, AZ: 38, EL: 33, PAD: 18,
  FLOOR: { x: -150, y: -96, w: 300, d: 196, r: 12 }, FLOOR_H: 13,
  BASE: { x: -104, y: -50, w: 208, d: 100, r: 6 }, BASE_H: 7,
  PLAT: { x: -104, y: -50, w: 208, d: 100, r: 5 }, PLAT_H: 6, PAD_H: 2.5,
  L: 64, HZ_MIN: 12, HZ_MAX: 34, HZ0: 22,
  BEAM_Y: [-42, 42], BEAM_W: 9.2, BEAM_T: 6.5, BEAM_OFF: 2.3,
  SLEEVE_R: 6, SLEEVE_H: 20, ROD_R: 3.6, ROD_Y: 42,
  CAB: { x: -146, y: -30, w: 26, d: 26, r: 3 }, CAB_H: 42,
  WHEEL_X: 62, WHEEL_Y: 26.5, WHEEL_Z: 21,
  RIDE: 8.5, /* padTop نسبی در گروه متحرک: صفحه ۰..۶ + بالشتک ۶..۸.۵ */
};

const LIGHT_UP = 1.2;
const BANDS = [0, 0.2, 0.42, 0.62];

export const dot3 = (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
export const unit3 = (a) => {
  const l = Math.hypot(a[0], a[1], a[2]) || 1;
  return [a[0] / l, a[1] / l, a[2] / l];
};

/* دید viewer و نور — همان ریاضی kit/lathe.mjs ولی از azimuth/elevation داخل P */
export function viewOfL(P) {
  const a = P.azimuth * (Math.PI / 180), e = P.elevation * (Math.PI / 180);
  return [Math.cos(a) * Math.cos(e), Math.sin(a) * Math.cos(e), Math.sin(e)];
}
export function lightOfL(P) {
  const a = P.azimuth * (Math.PI / 180);
  return unit3([-Math.sin(a), Math.cos(a), LIGHT_UP]);
}
export function toneOfL(normal, P) {
  let tone = 0;
  const score = dot3(unit3(normal), lightOfL(P));
  while (tone < BANDS.length && score >= BANDS[tone]) tone++;
  return tone;
}

/* پوشٔ محدب دوبعدی (monotone chain) — برای سیلوئت تیرهای مورب */
export function hull2(points) {
  const pts = [...points].sort((a, b) => a[0] - b[0] || a[1] - b[1]);
  if (pts.length < 3) return pts;
  const cross = (o, a, b) => (a[0] - o[0]) * (b[1] - o[1]) - (a[1] - o[1]) * (b[0] - o[0]);
  const lower = [];
  for (const p of pts) {
    while (lower.length > 1 && cross(lower[lower.length - 2], lower[lower.length - 1], p) <= 0) lower.pop();
    lower.push(p);
  }
  const upper = [];
  for (let i = pts.length - 1; i >= 0; i--) {
    const p = pts[i];
    while (upper.length > 1 && cross(upper[upper.length - 2], upper[upper.length - 1], p) <= 0) upper.pop();
    upper.push(p);
  }
  return [...lower.slice(0, -1), ...upper.slice(0, -1)];
}

/* تیر مورب صندوقی: ۸ گوشه از A تا B، مقطع w در راستای y و t عمود بر تیر در صفحهٔ x-z */
export function beamBox(A, B, yC, w, t) {
  const dx = B[0] - A[0], dz = B[2] - A[2];
  const len = Math.hypot(dx, dz) || 1;
  const px = (-dz / len) * (t / 2), pz = (dx / len) * (t / 2);
  const y0 = yC - w / 2, y1 = yC + w / 2;
  const at = (P0) => [
    [P0[0] + px, y0, P0[2] + pz], [P0[0] - px, y0, P0[2] - pz],
    [P0[0] - px, y1, P0[2] - pz], [P0[0] + px, y1, P0[2] + pz],
  ];
  const a = at(A), b = at(B);
  const faces = [
    { q: [a[0], a[3], b[3], b[0]], n: [-dz / len, 0, dx / len] },   /* ۰ پهلو +p */
    { q: [a[1], a[2], b[2], b[1]], n: [dz / len, 0, -dx / len] },   /* ۱ پهلو −p */
    { q: [a[3], a[2], b[2], b[3]], n: [0, 1, 0] },                  /* ۲ رو به بیننده */
    { q: [a[0], a[1], b[1], b[0]], n: [0, -1, 0] },                 /* ۳ پشت */
    { q: [a[0], a[1], a[2], a[3]], n: [-dx / len, 0, -dz / len] },  /* ۴ سر A */
    { q: [b[0], b[1], b[2], b[3]], n: [dx / len, 0, dz / len] },    /* ۵ سر B */
  ];
  /* مرز مشترک هر جفت رویِ نمایان: [indexFaceI, indexFaceJ, corner1, corner2] */
  const seams = [
    [0, 2, a[3], b[3]], [1, 2, a[2], b[2]], [0, 3, a[0], b[0]], [1, 3, a[1], b[1]],
    [4, 0, a[0], a[3]], [4, 1, a[1], a[2]], [4, 2, a[2], a[3]], [4, 3, a[0], a[1]],
    [5, 0, b[0], b[3]], [5, 1, b[1], b[2]], [5, 2, b[2], b[3]], [5, 3, b[0], b[1]],
  ];
  return { a, b, faces, seams };
}

/* رسم صندوق: سایهٔ چهارنوانه + سیلوئت هال + شیار مرز روی‌های نمایانِ مختلف‌نوار */
export function boxSvg(box, P, { tone = "mid" } = {}) {
  const toward = viewOfL(P);
  const drawn = box.faces.map((f, index) => ({ f, index })).filter(({ f }) => dot3(f.n, toward) > 1e-9);
  for (const d of drawn) {
    d.quad = d.f.q.map((p) => iso(p, P));
    const c = d.f.q.reduce((s, p) => [s[0] + p[0] / 4, s[1] + p[1] / 4, s[2] + p[2] / 4], [0, 0, 0]);
    d.depth = depthOf(c, P);
    d.band = toneOfL(d.f.n, P);
  }
  drawn.sort((u, v) => v.depth - u.depth);
  const shades = ["", "", "", ""];
  for (const d of drawn) shades[d.band] += pathOf(d.quad, true);
  const upward = drawn.filter((d) => d.f.n[2] > 0.3).sort((u, v) => v.f.n[2] - u.f.n[2])[0];
  const top = upward ? pathOf(upward.quad, true) : "";
  const proj = [...box.a, ...box.b].map((p) => iso(p, P));
  const hull = hull2(proj);
  const fill = pathOf(hull, true);
  const bandOf = new Map(drawn.map((d) => [d.index, d.band]));
  let crease = "";
  for (const [i, j, c1, c2] of box.seams) {
    if (bandOf.has(i) && bandOf.has(j) && bandOf.get(i) !== bandOf.get(j)) {
      crease += pathOf([iso(c1, P), iso(c2, P)]);
    }
  }
  return solidSvg({ fill, shades, top, crease, outline: fill }, { tone });
}

/* فنر کولی عمودی (محور z) — کیت فقط محور افقی دارد؛ برگشت: { back, front } */
export function coilZ(from, to, center, radius, turns, P, perTurn = 14) {
  const count = Math.max(1, Math.round(turns * perTurn));
  const back = [], front = [];
  let run = [], near = null;
  for (let index = 0; index <= count; index++) {
    const share = index / count;
    const angle = share * turns * Math.PI * 2;
    const u = radius * Math.cos(angle), v = radius * Math.sin(angle);
    const along = from + (to - from) * share;
    const point = [center[0] + u, center[1] + v, along];
    const normal = [Math.cos(angle), Math.sin(angle), 0];
    const facing = depthOf(normal, P) > 0;
    const flat = iso(point, P);
    if (near === null) near = facing;
    if (facing !== near) {
      run.push(flat);
      (near ? front : back).push(pathOf(run));
      run = [flat];
      near = facing;
      continue;
    }
    run.push(flat);
  }
  if (run.length > 1) (near ? front : back).push(pathOf(run));
  return { back: back.join(""), front: front.join("") };
}

export const faNum = (n) => String(n).replace(/\d/g, (d) => "۰۱۲۳۴۵۶۷۸۹"[d]);
export const clamp = (v, lo, hi) => Math.min(hi, Math.max(lo, v));
