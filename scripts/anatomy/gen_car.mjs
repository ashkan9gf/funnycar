/* gen_car.mjs — مونتاژ فیگور «فانی‌کار روی بالانسر قیچی» و نوشتن صفحهٔ مستقل
 * خروجی: public/assets/iso/funnycar-lift.html (برای iframe داخل بازی + مشاهدهٔ مستقیم)
 */
import { writeFileSync, mkdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import * as k from "./iso-kit.mjs";
import { kitScript } from "./inline-kit.mjs";
import * as SH from "./car-shared.mjs";
import * as CS from "./car-static.mjs";

const HERE = dirname(fileURLToPath(import.meta.url));
const OUT = join(HERE, "..", "..", "public", "assets", "iso", "funnycar-lift.html");

/* هلوپرهای car-shared به نام‌های برهنهٔ کیت نیاز دارند — در Node روی globalThis سیم‌کشی می‌شوند */
Object.assign(globalThis, {
  iso: k.iso, pathOf: k.pathOf, depthOf: k.depthOf, solidSvg: k.solidSvg,
});

const P = k.fitProjection(CS.fitPoints(), SH.GEO.W, SH.GEO.H, {
  pad: SH.GEO.PAD, azimuth: SH.GEO.AZ, elevation: SH.GEO.EL,
});

/* ---------- بدنهٔ ایستا + پیش‌بارگذاری گروه‌های متحرک در وضعیت اولیه ---------- */
const far0 = CS.scissorSvg(SH.GEO.HZ0, SH.GEO.BEAM_Y[0], P, "mid");
const near0 = CS.scissorSvg(SH.GEO.HZ0, SH.GEO.BEAM_Y[1], P, "hi");
const rod0 = CS.rodSvg(SH.GEO.HZ0, P);
const ride0 = CS.rideParts(P);

const svg = k.figureSvg({
  width: SH.GEO.W,
  height: SH.GEO.H,
  label: "فانی‌کار روی بالانسر قیچی — آناتومی شاسی و تعلیق",
  body: [
    CS.floorParts(P),
    CS.cabinetParts(P),
    CS.liftStatic(P),
    `<g data-part="scissor-far">${far0}</g>`,
    `<g data-part="rod">${rod0}</g>`,
    `<g data-part="scissor-near">${near0}</g>`,
    `<g data-part="ride" transform="${k.translateAlong(P, [0, 0, SH.GEO.BASE_H + 2 * SH.GEO.HZ0])}">${ride0}</g>`,
    CS.propsParts(P),
  ],
});

/* ---------- اسکریپت زنده: کیت inline + هلوپرهای سری‌شده + حلقهٔ حرکت ---------- */
/* توجه: توابع arrow حتماً با «const name =» سری شوند وگرنه module کل crash می‌کند */
const helpers = `
const LIGHT_UP = 1.2;
const BANDS = [0, 0.2, 0.42, 0.62];
const dot3 = ${SH.dot3.toString()};
const unit3 = ${SH.unit3.toString()};
${SH.viewOfL.toString()}
${SH.lightOfL.toString()}
${SH.toneOfL.toString()}
${SH.hull2.toString()}
${SH.beamBox.toString()}
${SH.boxSvg.toString()}
`;

const dynSrc = `
function scissorSvg(hz, yC, P, tone) {
  const hx = Math.sqrt(GEO.L * GEO.L - hz * hz);
  const topZ = GEO.BASE_H + 2 * hz;
  const out = [];
  for (const off of [-GEO.BEAM_OFF, GEO.BEAM_OFF]) {
    const y = yC + off;
    out.push(boxSvg(beamBox([-hx, y, GEO.BASE_H], [hx, y, topZ], y, 4.6, GEO.BEAM_T), P, { tone: tone || "mid" }));
  }
  const pins = [[-hx, yC, GEO.BASE_H], [hx, yC, GEO.BASE_H], [-hx, yC, topZ], [hx, yC, topZ]].map((p) => iso(p, P));
  out.push(dotsSvg(pins, { size: 0.9, tone: "mid" }));
  out.push(dotsSvg([iso([0, yC, GEO.BASE_H + hz], P)], { size: 1.1, tone: "hi" }));
  return out.join("");
}
function rodSvg(hz, P) {
  const topZ = GEO.BASE_H + 2 * hz;
  const out = [];
  out.push(solidSvg(cylinder(0, GEO.ROD_Y, GEO.ROD_R, GEO.BASE_H + 6, topZ - GEO.BASE_H - 6, P, 20), { tone: "hi", crease: "none" }));
  out.push(lineSvg(ring(0, GEO.ROD_Y, GEO.ROD_R + 0.5, topZ, P, 20), { tone: "lo" }));
  out.push(dotsSvg([iso([0, GEO.ROD_Y, topZ], P)], { size: 1.1, tone: "hi" }));
  return out.join("");
}
`;

const live = `
window.__fcErrs = [];
addEventListener("error", (e) => window.__fcErrs.push(String((e && e.message) || e)));
const P = ${JSON.stringify(P)};
const GEO = ${JSON.stringify(SH.GEO)};
${helpers}
${dynSrc}
const faNum = ${SH.faNum.toString()};
const clamp = ${SH.clamp.toString()};
const stage = document.querySelector(".iso-stage");
const svg = stage.querySelector("svg");
const ride = svg.querySelector('[data-part="ride"]');
const far = svg.querySelector('[data-part="scissor-far"]');
const near = svg.querySelector('[data-part="scissor-near"]');
const rod = svg.querySelector('[data-part="rod"]');
const readout = document.querySelector("[data-readout]");
const still = matchMedia("(prefers-reduced-motion: reduce)");
let hz = GEO.HZ0, target = hz, touring = !still.matches, clock = 0, last = 0, frame = 0, visible = false, drawnAt = -1;
let idleTimer = 0, dragging = false, dragY = 0, dragH = 0;
const phaseOf = (value) => (Math.acos(1 - (2 * (value - GEO.HZ_MIN)) / (GEO.HZ_MAX - GEO.HZ_MIN)) * 18) / (Math.PI * 2);
function draw() {
  const topZ = GEO.BASE_H + 2 * hz;
  far.innerHTML = scissorSvg(hz, GEO.BEAM_Y[0], P, "mid");
  near.innerHTML = scissorSvg(hz, GEO.BEAM_Y[1], P, "hi");
  rod.innerHTML = rodSvg(hz, P);
  ride.setAttribute("transform", translateAlong(P, [0, 0, topZ]));
  const cm = Math.round(2 * hz);
  const status = hz <= GEO.HZ_MIN + 2 ? "جک خوابیده" : hz >= GEO.HZ_MAX - 2 ? "بیشترین ارتفاع" : "آمادهٔ کار";
  const text = "ارتفاع " + faNum(cm) + " سانتی‌متر · " + status;
  if (readout.textContent !== text) readout.textContent = text;
  stage.setAttribute("aria-valuenow", String(cm));
  stage.setAttribute("aria-valuetext", text);
  drawnAt = hz;
}
function tick(now) {
  const dt = last ? Math.min((now - last) / 1000, 1 / 30) : 1 / 60;
  last = now;
  if (touring) { clock += dt; target = GEO.HZ_MIN + (GEO.HZ_MAX - GEO.HZ_MIN) * (0.5 - 0.5 * Math.cos((clock * Math.PI * 2) / 18)); }
  hz += (target - hz) * (1 - Math.exp(-dt / 0.3));
  if (Math.abs(target - hz) < 0.01) hz = target;
  draw();
  const settled = !touring && hz === target;
  frame = visible && !settled ? requestAnimationFrame(tick) : 0;
}
const run = () => { if (!frame && visible) { last = 0; frame = requestAnimationFrame(tick); } };
const steer = (next, resume = true) => {
  touring = false;
  target = clamp(next, GEO.HZ_MIN, GEO.HZ_MAX);
  clearTimeout(idleTimer);
  if (resume) idleTimer = setTimeout(() => { if (!still.matches) { touring = true; clock = phaseOf(target); run(); } }, 5200);
  run();
};
new IntersectionObserver((entries) => { visible = entries[entries.length - 1].isIntersecting; if (visible) run(); }, { rootMargin: "120px 0px" }).observe(stage);
if (still.matches) { touring = false; draw(); }
stage.addEventListener("pointerdown", (event) => {
  dragging = true; dragY = event.clientY; dragH = target;
  try { stage.setPointerCapture(event.pointerId); } catch {}
  steer(target, false);
});
stage.addEventListener("pointermove", (event) => { if (dragging) steer(dragH + (dragY - event.clientY) * 0.28, false); });
const endDrag = () => { if (!dragging) return; dragging = false; steer(target); };
stage.addEventListener("pointerup", endDrag);
stage.addEventListener("pointercancel", endDrag);
stage.addEventListener("keydown", (event) => {
  let to = null;
  if (event.key === "ArrowUp") to = target + 4;
  if (event.key === "ArrowDown") to = target - 4;
  if (event.key === "Home") to = GEO.HZ_MIN;
  if (event.key === "End") to = GEO.HZ_MAX;
  if (to === null) return;
  event.preventDefault();
  steer(to);
});
draw();
window.__fc = { get hz() { return hz; }, get target() { return target; }, get visible() { return visible; }, steer, draw };
`;

const body = k.plateHtml({
  fig: "شکل ۱ — آناتومی فانی‌کار",
  title: "فانی‌کار روی بالانسر قیچی",
  hint: "بکش بالا و پایین تا بالانسر حرکت کنه",
  readout: `ارتفاع ${SH.faNum(Math.round(2 * SH.GEO.HZ0))} سانتی‌متر · آمادهٔ کار`,
  keys: [
    { mark: "lit", label: "کالیپر و دیسک ترمز — چرخ جلو-چپ باز شده" },
    { mark: "raised", label: "شاسی، موتور، فنرها و بازوهای ضربدری" },
  ],
  caption:
    "بالانسر قیچی با جک هیدرولیک وسط، سکو و شاسی فانی‌کار را بالا می‌برد: میلهٔ جک بلند می‌شود، بازوهای ضربدری باز می‌شوند و سکو با چهار بالشتک لاستیکی بالا می‌رود. چرخ جلو-چپ باز شده تا دیسک، کالیپر، فنر و بازوی تعلیق دیده شود؛ چرخِ باز شده لای جعبه‌چرخ‌ها تکیه داده. سه چرخ دیگر سر جایشان هستند و موتور، گیربکس، کارترانسیشن و باک از بالا پیدا هستند.",
  body: `<div class="iso-stage" tabindex="0" role="slider" aria-label="ارتفاع بالانسر قیچی" aria-valuemin="24" aria-valuemax="68" aria-valuenow="${Math.round(2 * SH.GEO.HZ0)}">${svg}</div>`,
});

const RTL_CSS = `<style>
.iso-plate-corners,.iso-legend{direction:rtl}
[data-corner="title"],[data-corner="hint"],[data-corner="readout"],.iso-key,.iso-caption{direction:rtl;text-align:right}
.iso-keys{justify-content:flex-end}
</style>`;

let html = k.pageHtml({
  title: "فانی‌کار روی بالانسر قیچی",
  theme: "dark",
  width: 720,
  body,
  script: kitScript() + live,
});
html = html.replace('<html lang="en">', '<html lang="fa">').replace("</head>", `${RTL_CSS}</head>`);

mkdirSync(dirname(OUT), { recursive: true });
writeFileSync(OUT, html);
console.log("wrote", OUT, `${Math.round(html.length / 1024)}KB`);
