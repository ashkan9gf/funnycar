/** تست سریع مولد مأموریت بی‌پایان — قطعی بودن، تنوع، مختصات معتبر */
import { generateMission, listEndlessMissions, nextEndlessId, endlessLevel } from "../src/game/data/missionGen";

const CENTERS = new Set([280, 1680, 3080, 4480, 5880, 7280, 8680]);
const MIDS = new Set([980, 2380, 3780, 5180, 6580, 7630]);
const PARK_EAST = new Set([1150, 2550, 3950, 5350, 6750, 7800]);
const PARK_WEST = new Set([2230, 5030, 7480]);

let failures = 0;
const fail = (msg: string): void => { failures++; console.log("FAIL:", msg); };

// 1) قطعی بودن
for (const n of [1, 5, 12, 33]) {
  const a = JSON.stringify(generateMission(n));
  const b = JSON.stringify(generateMission(n));
  if (a !== b) fail(`gen_${n} deterministic`);
}

// 2) تنوع نوع در ۱۶ سطح اول (هر ۸ نوع حداقل یک بار)
const kinds = new Set<string>();
for (let n = 1; n <= 16; n++) kinds.add(generateMission(n).kind);
console.log("kinds in 16 levels:", [...kinds].sort().join(","));
if (kinds.size < 8) fail(`only ${kinds.size} kinds in first 16 levels`);

// 3) مختصات روی جادهٔ معتبر
let checked = 0;
for (let n = 1; n <= 64; n++) {
  const m = generateMission(n);
  const onRoad = (p: { x: number; y: number }): boolean =>
    (CENTERS.has(p.x) && (CENTERS.has(p.y) || MIDS.has(p.y))) ||
    (CENTERS.has(p.y) && (CENTERS.has(p.x) || MIDS.has(p.x)));
  const pts: Array<{ x: number; y: number }> = [m.target, ...(m.pickup ? [m.pickup] : []), ...(m.checkpoints ?? [])];
  for (const p of pts) {
    checked++;
    const isPark = (p.x === 1990 && PARK_EAST.has(p.y)) || (p.x === 1370 && PARK_WEST.has(p.y));
    if (!onRoad(p) && !isPark) fail(`gen_${n} off-road point ${JSON.stringify(p)} kind=${m.kind}`);
  }
  if (m.timeLimitSec !== 0 && m.timeLimitSec < 40) fail(`gen_${n} too-short time ${m.timeLimitSec}`);
  if (m.rewardCoins < 30 || m.rewardCoins > 170) fail(`gen_${n} coins out of range ${m.rewardCoins}`);
  if (m.category !== "endless") fail(`gen_${n} category ${m.category}`);
  if (m.id !== `gen_${n}`) fail(`gen_${n} id mismatch`);
}

// 4) پنجرهٔ منو + nextId
const win1 = listEndlessMissions([]);
if (win1.length !== 6 || win1.some((m) => m.id === "gen_7")) fail("window-1 shape");
const win2 = listEndlessMissions(["gen_1", "gen_2", "gen_3"]);
if (win2.length !== 6 || win2.some((m) => ["gen_1", "gen_2", "gen_3"].includes(m.id))) fail("window-2 skips completed");
if (nextEndlessId(["gen_1", "gen_2"]) !== "gen_3") fail("nextEndlessId skip");
if (nextEndlessId([]) !== "gen_1") fail("nextEndlessId empty");
if (endlessLevel("gen_42") !== 42 || endlessLevel("m01_passenger") !== null) fail("endlessLevel parse");

// 5) نمونه‌ها
console.log("\n— نمونه‌ها —");
for (const n of [1, 2, 3]) {
  const m = generateMission(n);
  console.log(`gen_${n} [${m.kind}] «${m.title}» | ${m.intro} | ${m.timeLimitSec}s | +${m.rewardCoins}c/+${m.rewardRep}r | t=${JSON.stringify(m.target)}${m.pickup ? " p=" + JSON.stringify(m.pickup) : ""}${m.checkpoints ? " cps=" + m.checkpoints.length : ""}${m.coinTarget ? " coins=" + m.coinTarget : ""}`);
}
console.log(`\nchecked ${checked} points — ${failures === 0 ? "ALL PASS ✓" : failures + " FAILURES"}`);
process.exit(failures === 0 ? 0 : 1);
