"use client";

/**
 * GameShell.tsx — پوسته بازی: بوت، منو، HUD، توقف، تنظیمات
 * ============================================================
 * - تمام متن‌ها فارسی RTL با اعداد فارسی
 * - مرز لایه‌ها: این کامپوننت فقط از API عمومی موتور (createGame) استفاده می‌کند
 * - دکمه‌های لمسی: HoldButton/TapButton (touch-controls.tsx)
 */

import { useCallback, useEffect, useRef, useState } from "react";
import {
  Anchor,
  ArrowUp,
  Bike,
  Bird,
  Car,
  Check,
  ChevronLeft,
  ChevronRight,
  CircleDot,
  Coffee,
  Coins,
  FolderOpen,
  FlaskConical,
  Gauge,
  Home,
  Loader2,
  Lock,
  Map,
  Megaphone,
  Mic,
  Music,
  Octagon,
  PartyPopper,
  Pause,
  Play,
  Radio,
  Shield,
  Siren,
  Square,
  Target,
  Users,
  Volume2,
  Wrench,
  X,
} from "lucide-react";
import type { MissionCategory, UpgradeId } from "@/game";
import {
  createGame,
  GARAGE_FOOTER,
  PAINT_FLAVOR,
  HORN_FOOTER,
  HORN_FLAVOR,
  type GameInstance,
  type GarageView,
  type GameState,
  type HudData,
  type MissionListItem,
  type MissionResultData,
} from "@/game";
import { HoldButton, TapButton } from "./touch-controls";

/** تبدیل اعداد به فارسی */
const FA = ["۰", "۱", "۲", "۳", "۴", "۵", "۶", "۷", "۸", "۹"];
const fa = (n: number | string): string => String(n).replace(/[0-9]/g, (d) => FA[Number(d)]);

interface Settings {
  music: number;
  sfx: number;
  voice: number;
}

/** پنل تنظیمات صدا (در منو و Pause استفاده می‌شود) */
function SettingsPanel({ game, onClose }: { game: GameInstance; onClose?: () => void }) {
  const [s, setS] = useState<Settings>(game.getSettings());
  const rows: Array<{ key: keyof Settings; label: string; icon: React.ReactNode }> = [
    { key: "music", label: "موسیقی", icon: <Music className="h-5 w-5" /> },
    { key: "sfx", label: "افکت‌ها", icon: <Volume2 className="h-5 w-5" /> },
    { key: "voice", label: "جملات طنز", icon: <Mic className="h-5 w-5" /> },
  ];
  return (
    <div className="w-full space-y-3">
      {rows.map((r) => (
        <div key={r.key} className="flex items-center gap-3">
          <span className="text-[#3a2e2a]">{r.icon}</span>
          <span className="w-24 text-sm font-bold text-[#3a2e2a]">{r.label}</span>
          <input
            type="range"
            className="fc-range flex-1"
            min={0}
            max={1}
            step={0.05}
            value={s[r.key]}
            aria-label={`صدای ${r.label}`}
            onChange={(e) => {
              const v = Number(e.target.value);
              setS((p) => ({ ...p, [r.key]: v }));
              game.setSetting(r.key, v);
            }}
          />
          <span className="w-10 text-center text-sm font-bold text-[#3a2e2a]">{fa(Math.round(s[r.key] * 100))}٪</span>
        </div>
      ))}
      <div className="flex items-center gap-3 opacity-50">
        <span className="text-sm font-bold text-[#3a2e2a]">لرزش گوشی</span>
        <span className="text-xs text-[#3a2e2a]">(فازهای بعدی)</span>
      </div>
      {onClose && (
        <button
          type="button"
          className="fc-btn mt-2 w-full rounded-2xl bg-[#3a2e2a] py-2.5 text-white"
          onPointerDown={(e) => {
            e.preventDefault();
            onClose();
          }}
        >
          بستن
        </button>
      )}
    </div>
  );
}

/** متن علت شکست مأموریت برای نمایش */
const FAIL_REASON_FA: Record<string, string> = {
  time_up: "وقت تموم شد!",
  engine_died: "ماشین خاموش شد!",
  too_many_crashes: "تصادف‌ها از حد گذشت!",
  too_many_potholes: "چاله‌ها بیشتر از حد مجاز!",
  park_missed: "پارک نشد! یه بار دیگه امتحان کن",
};

/** عنوان و توضیح هر دسته مأموریت (فاز ۵) */
const CATEGORY_FA: Record<MissionCategory, { title: string; hint: string }> = {
  story: { title: "مأموریت‌ها", hint: "زنجیره «شاگردی عمو نقی» هم اینجاست — هر مرحله، مرحله بعد را باز می‌کند!" },
  park: { title: "پارک دوبل", hint: "دنده‌عقب برو تو جای پارک، تراز وایسا، ترمز! هر دو جهت قبوله" },
  taxi: { title: "مسافرکشی", hint: "وایسا سر جای سوارشدن، بعد برسون مقصد — سریع برسی انعام هم داره!" },
  challenge: { title: "چالش‌ها", hint: "چالش سخت‌تر، جایزه بزرگ‌تر — آبروی راننده توی اینه!" },
};

/** آیکون هر آپگرید گاراژ (فاز ۶) */
const UPGRADE_ICON: Record<UpgradeId, React.ReactNode> = {
  engine: <Gauge className="h-6 w-6" />,
  brake: <Octagon className="h-6 w-6" />,
  tire: <CircleDot className="h-6 w-6" />,
  armor: <Shield className="h-6 w-6" />,
};

/** آیکون هر بوق (فاز ۷) */
const HORN_ICON: Record<string, React.ReactNode> = {
  classic: <Megaphone className="h-6 w-6" />,
  doble: <Volume2 className="h-6 w-6" />,
  moto: <Bike className="h-6 w-6" />,
  klaxon: <Radio className="h-6 w-6" />,
  steam: <Anchor className="h-6 w-6" />,
  melody: <Music className="h-6 w-6" />,
  crow: <Bird className="h-6 w-6" />,
  police: <Siren className="h-6 w-6" />,
};

export default function GameShell() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const gameRef = useRef<GameInstance | null>(null);
  const steerRef = useRef({ left: false, right: false });
  const toastTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  /** نمونه بازی در state برای رندر امن React (gameRef فقط در event handlerها استفاده می‌شود) */
  const [game, setGame] = useState<GameInstance | null>(null);

  const [phase, setPhase] = useState<GameState | "boot">("boot");
  const [bootError, setBootError] = useState<string | null>(null);
  const [bootProgress, setBootProgress] = useState(0);
  const isAndroidBuild = process.env.NEXT_PUBLIC_ANDROID_BUILD === "1";
  const [hud, setHud] = useState<HudData>({ speedKmh: 0, coins: 0, reputation: 50, fps: 60, showFps: false, placeholders: 0, mission: null, health: 100, engineDead: false });
  const [toast, setToast] = useState<string | null>(null);
  const [showSettings, setShowSettings] = useState(false);
  const [showMissions, setShowMissions] = useState(false);
  /** فیلتر دسته مأموریت (فاز ۵) — null = همه (مأموریت‌های اصلی) */
  const [missionFilter, setMissionFilter] = useState<MissionCategory | null>(null);
  const [missions, setMissions] = useState<MissionListItem[]>([]);
  const [missionResult, setMissionResult] = useState<MissionResultData | null>(null);
  /** فاز ۶: گاراژ عمو نقی */
  const [showGarage, setShowGarage] = useState(false);
  const [garage, setGarage] = useState<GarageView | null>(null);

  /** باز کردن گاراژ + تازه‌سازی داده */
  const openGarage = useCallback(() => {
    const g = gameRef.current?.listGarage();
    if (g) setGarage(g);
    setShowGarage(true);
  }, []);

  const showToast = useCallback((msg: string) => {
    setToast(msg);
    if (toastTimer.current) clearTimeout(toastTimer.current);
    toastTimer.current = setTimeout(() => setToast(null), 1800);
  }, []);

  /** خرید آپگرید/رنگ + تازه‌سازی گاراژ و toast طنز */
  const purchase = useCallback(
    (fn: () => { ok: boolean; msg: string }) => {
      const r = fn();
      showToast(r.msg);
      const g = gameRef.current?.listGarage();
      if (g) setGarage(g);
    },
    [showToast],
  );

  // ---------- راه‌اندازی موتور ----------
  useEffect(() => {
    let cancelled = false;
    const canvas = canvasRef.current;
    if (!canvas) return;
    createGame(
      canvas,
      {
        onStateChange: (s) => setPhase(s),
        onHud: (h) => setHud(h),
        onMissionEnd: (r) => setMissionResult(r),
      },
      (done, total) => setBootProgress(Math.round((done / total) * 100)),
    ).then((inst) => {
      if (cancelled) {
        inst.dispose();
        return;
      }
      gameRef.current = inst;
      setGame(inst);
    }).catch((err: unknown) => {
      // لایهٔ محافظ UI: اگر boot به هر دلیل شکست خورد، صفحهٔ «تلاش دوباره» می‌آید —
      // کاربر دیگر در لودینگ گیر نمی‌کند (ادغام از شاخهٔ کاربر)
      if (cancelled) return;
      const detail = err instanceof Error ? err.message : String(err);
      console.error("[FunnyCar] game boot failed:", err);
      setBootError(detail);
    });
    return () => {
      cancelled = true;
      gameRef.current?.dispose();
      gameRef.current = null;
    };
  }, []);

  // ---------- فرمان ترکیبی (چپ+راست هم‌زمان = مستقیم) ----------
  const applySteer = useCallback(() => {
    const { left, right } = steerRef.current;
    gameRef.current?.setVirtualSteer(left === right ? 0 : right ? 1 : -1);
  }, []);
  const steerLeft = useCallback(
    (down: boolean) => {
      steerRef.current.left = down;
      applySteer();
    },
    [applySteer],
  );
  const steerRight = useCallback(
    (down: boolean) => {
      steerRef.current.right = down;
      applySteer();
    },
    [applySteer],
  );

  const repColor = hud.reputation >= 70 ? "#8AC926" : hud.reputation >= 35 ? "#F2B705" : "#D64545";
  const healthColor = hud.health >= 60 ? "#8AC926" : hud.health >= 30 ? "#F2B705" : "#D64545";
  const towCostLabel = hud.coins >= 30 ? "−۳۰ سکه" : "رایگان — رفیق مکانیکی!";

  return (
    <div className="fixed inset-0 overflow-hidden bg-[#C9B98A] font-vazir" dir="rtl">
      {/* بوم بازی — زیر همه لایه‌ها */}
      <canvas ref={canvasRef} className="fc-canvas absolute inset-0 h-full w-full" />

      {/* صفحهٔ خطای boot + تلاش دوباره (ادغام از شاخهٔ کاربر) */}
      {bootError && (
        <div className="absolute inset-0 z-[60] flex items-center justify-center bg-[#201914]/95 p-6" role="alert">
          <div className="fc-panel w-full max-w-md rounded-3xl bg-[#FFF9EC] p-6 text-center shadow-2xl">
            <div className="mb-3 text-4xl" aria-hidden="true">🚗</div>
            <h1 className="mb-2 text-xl font-extrabold text-[#3a2e2a]">بازی اجرا نشد</h1>
            <p className="mb-4 text-sm leading-7 text-[#5b4a40]">
              راه‌اندازی بازی با خطا روبه‌رو شد. می‌توانی دوباره تلاش کنی.
            </p>
            <details className="mb-5 text-left" dir="ltr">
              <summary className="cursor-pointer text-xs font-bold text-[#7b6252]">جزئیات فنی</summary>
              <pre className="mt-2 max-h-28 overflow-auto whitespace-pre-wrap break-words rounded-xl bg-[#f0e7d8] p-3 text-xs text-[#3a2e2a]">{bootError}</pre>
            </details>
            <button
              type="button"
              className="fc-btn w-full rounded-2xl bg-[#2A9D8F] py-3 font-extrabold text-white"
              onClick={() => window.location.reload()}
            >
              تلاش دوباره
            </button>
          </div>
        </div>
      )}

      {/* ============ صفحه بوت ============ */}
      {phase === "boot" && (
        <div className="absolute inset-0 z-50 flex items-center justify-center bg-[#2A9D8F]">
          <div className="fc-panel fc-pop flex flex-col items-center gap-4 bg-[#FFF9EC] px-10 py-8">
            <Loader2 className="h-10 w-10 animate-spin text-[#2A9D8F]" />
            <p className="text-xl font-extrabold text-[#3a2e2a]">در حال باز کردن گاراژ...</p>
            <div className="h-4 w-56 overflow-hidden rounded-full border-4 border-[#3a2e2a] bg-[#FFF3D6]">
              <div className="h-full bg-[#8AC926] transition-all" style={{ width: `${bootProgress}%` }} />
            </div>
            <p className="text-sm font-bold text-[#3a2e2a]">٪{fa(bootProgress)}</p>
          </div>
        </div>
      )}

      {/* ============ منوی اصلی ============ */}
      {phase === "menu" && (
        <div className="absolute inset-0 z-30 flex flex-col overflow-y-auto overscroll-y-contain touch-pan-y bg-gradient-to-b from-[#3a2e2a]/10 via-transparent to-[#3a2e2a]/55">
          <div className="fc-pop mx-auto flex min-h-full w-full max-w-md shrink-0 flex-col items-center justify-start gap-5 px-6 py-8 sm:justify-center">
            {/* لوگو */}
            <div className="flex flex-col items-center gap-2">
              <div className="fc-btn flex h-20 w-20 items-center justify-center rounded-3xl bg-[#F2B705]">
                <Car className="h-11 w-11 text-[#3a2e2a]" strokeWidth={2.4} />
              </div>
              <h1 className="mt-2 text-5xl font-extrabold text-white drop-shadow-[0_4px_0_rgba(58,46,42,0.9)]">فانی‌کار</h1>
              <p className="text-sm font-bold text-white/90 drop-shadow-[0_2px_0_rgba(58,46,42,0.7)]">
                آبرو می‌بری یا می‌ریزی؟
              </p>
            </div>

            {/* آمار بازیکن */}
            <div className="flex items-center gap-3">
              <div className="fc-panel flex items-center gap-2 bg-[#FFF9EC] px-4 py-2">
                <Coins className="h-5 w-5 text-[#B8801A]" />
                <span className="font-extrabold text-[#3a2e2a]">{fa(hud.coins)}</span>
              </div>
              <div className="fc-panel flex items-center gap-2 bg-[#FFF9EC] px-4 py-2">
                <Coffee className="h-5 w-5 text-[#D64545]" />
                <span className="font-extrabold text-[#3a2e2a]">آبرو: {fa(hud.reputation)}</span>
              </div>
            </div>

            {/* دکمه اصلی */}
            <button
              type="button"
              className="fc-btn w-full max-w-xs rounded-3xl bg-[#8AC926] py-4 text-2xl font-extrabold text-[#3a2e2a]"
              onClick={() => {
                gameRef.current?.startGameplay();
              }}
            >
              رانندگی آزاد
            </button>

            {/* حالت‌های بازی — فاز ۵: همه فعال! */}
            <div className="grid w-full max-w-xs grid-cols-2 gap-3">
              {([
                { cat: "story" as MissionCategory, icon: <Map className="h-6 w-6" />, label: "مأموریت‌ها" },
                { cat: "park" as MissionCategory, icon: <Target className="h-6 w-6" />, label: "پارک دوبل" },
                { cat: "taxi" as MissionCategory, icon: <Users className="h-6 w-6" />, label: "مسافرکشی" },
                { cat: "challenge" as MissionCategory, icon: <PartyPopper className="h-6 w-6" />, label: "چالش‌ها" },
              ]).map((m) => (
                <button
                  key={m.cat}
                  type="button"
                  className="fc-btn flex flex-col items-center gap-1 rounded-2xl bg-[#8AC926] py-3 text-[#3a2e2a]"
                  onClick={() => {
                    setMissionFilter(m.cat);
                    setMissions(gameRef.current?.listMissions(m.cat) ?? []);
                    setShowMissions(true);
                  }}
                >
                  {m.icon}
                  <span className="text-sm font-extrabold">{m.label}</span>
                </button>
              ))}
            </div>

            {/* گاراژ عمو نقی (فاز ۶) */}
            <button
              type="button"
              className="fc-btn flex w-full max-w-xs items-center justify-center gap-2 rounded-2xl bg-[#F2B705] py-3 text-lg font-extrabold text-[#3a2e2a]"
              onClick={() => {
                openGarage();
              }}
            >
              <Wrench className="h-5 w-5" />
              گاراژ عمو نقی
              <span className="rounded-full bg-[#3a2e2a] px-2 py-0.5 text-[10px] font-extrabold text-[#F2B705]">جدید</span>
            </button>

            {/* کنسول تست + فایل‌های پروژه — ابزار توسعه؛ فقط در نسخهٔ وب نمایش داده می‌شود (ادغام از شاخهٔ کاربر) */}
            {!isAndroidBuild && (
              <div className="flex w-full max-w-xs gap-2">
                <a
                  href="/test"
                  target="_blank"
                  rel="noreferrer"
                  className="fc-btn flex flex-1 items-center justify-center gap-1.5 rounded-2xl bg-[#FFF9EC] py-2.5 text-sm font-extrabold text-[#3a2e2a] no-underline"
                >
                  <FlaskConical className="h-4 w-4" />
                  کنسول تست
                </a>
                <a
                  href="/files"
                  target="_blank"
                  rel="noreferrer"
                  className="fc-btn flex flex-1 items-center justify-center gap-1.5 rounded-2xl bg-[#FFF9EC] py-2.5 text-sm font-extrabold text-[#3a2e2a] no-underline"
                >
                  <FolderOpen className="h-4 w-4" />
                  فایل‌ها
                </a>
              </div>
            )}

            {/* تنظیمات */}
            {showSettings ? (
              <div className="fc-panel fc-pop w-full max-w-xs bg-[#FFF9EC] p-4">
                <div className="mb-3 flex items-center justify-between">
                  <span className="text-lg font-extrabold text-[#3a2e2a]">تنظیمات</span>
                  <TapButton ariaLabel="بستن تنظیمات" className="h-9 w-9 bg-[#D64545] text-white" onTap={() => setShowSettings(false)}>
                    <X className="h-5 w-5" />
                  </TapButton>
                </div>
                {game && <SettingsPanel game={game} />}
              </div>
            ) : (
              <button
                type="button"
                className="fc-btn flex items-center gap-2 rounded-2xl bg-[#FFF9EC] px-6 py-2.5 font-extrabold text-[#3a2e2a]"
                onClick={() => {
                  setShowSettings(true);
                }}
              >
                <Settings className="h-5 w-5" />
                تنظیمات
              </button>
            )}

            {/* یادداشت Placeholder (شفافیت — قانون بخش ۳۲ سند مادر) */}
            {hud.placeholders > 0 && (
              <p className="max-w-xs text-center text-[11px] font-bold leading-5 text-white/80">
                {fa(hud.placeholders)} فایل موقت (Placeholder) فعال است — طبق مستندات
                «ASSET_HANDBOOK» و «ASSET_INVENTORY» به‌تدریج با Assetهای واقعی جایگزین می‌شود.
              </p>
            )}

            <p className="mt-auto text-center text-[11px] font-bold leading-5 text-white/70">
              دسکتاپ: جهت‌نما / WASD رانندگی — H بوق — P توقف — F شمارنده FPS
              <br />
              فاز ۷ • بوق‌های طنز + زنجیره شاگردی عمو نقی • موتور اختصاصی + Three.js
            </p>
          </div>
        </div>
      )}

      {/* ============ انتخاب مأموریت (فاز 4 + فیلتر دسته فاز ۵) ============ */}
      {phase === "menu" && showMissions && (
        <div className="absolute inset-0 z-40 flex flex-col overflow-y-auto bg-[#3a2e2a]/70 px-4 py-6 backdrop-blur-[2px]">
          <div className="fc-pop mx-auto flex w-full max-w-md flex-col gap-3">
            <div className="flex items-center justify-between">
              <h2 className="flex items-center gap-2 text-2xl font-extrabold text-white drop-shadow-[0_2px_0_rgba(58,46,42,0.9)]">
                {missionFilter === "park" ? <Target className="h-7 w-7 text-[#F2B705]" /> : missionFilter === "taxi" ? <Users className="h-7 w-7 text-[#F2B705]" /> : missionFilter === "challenge" ? <PartyPopper className="h-7 w-7 text-[#F2B705]" /> : <Map className="h-7 w-7 text-[#F2B705]" />}
                {CATEGORY_FA[missionFilter ?? "story"].title}
              </h2>
              <TapButton
                ariaLabel="بستن مأموریت‌ها"
                className="h-11 w-11 bg-[#FFF9EC] text-[#3a2e2a]"
                onTap={() => setShowMissions(false)}
              >
                <X className="h-6 w-6" />
              </TapButton>
            </div>
            {missions.map((m) => {
              const locked = m.locked;
              return (
              <button
                key={m.id}
                type="button"
                disabled={locked}
                className={`fc-btn fc-panel flex w-full flex-col items-start gap-1 p-4 text-right ${
                  locked ? "bg-[#FFF9EC]/60 opacity-75" : "bg-[#FFF9EC]"
                }`}
                onClick={() => {
                  if (locked) return;
                  gameRef.current?.startMission(m.id);
                  setShowMissions(false);
                }}
              >
                <div className="flex w-full items-center justify-between">
                  <span className={`text-lg font-extrabold ${locked ? "text-[#3a2e2a]/55" : "text-[#3a2e2a]"}`}>{m.title}</span>
                  {locked && (
                    <span className="flex items-center gap-1 rounded-full bg-[#3a2e2a]/10 px-3 py-0.5 text-xs font-extrabold text-[#3a2e2a]/60">
                      <Lock className="h-3.5 w-3.5" /> قفل
                    </span>
                  )}
                  {!locked && m.done && (
                    <span className="rounded-full bg-[#8AC926] px-3 py-0.5 text-xs font-extrabold text-[#3a2e2a]">انجام شد ✓</span>
                  )}
                </div>
                <p className={`text-xs font-bold leading-5 ${locked ? "text-[#3a2e2a]/45" : "text-[#3a2e2a]/75"}`}>{m.intro}</p>
                {locked && m.requiresTitle && (
                  <p className="mt-0.5 flex items-center gap-1.5 rounded-full bg-[#FFF3D6] px-2.5 py-1 text-[11px] font-extrabold text-[#B8801A]">
                    <Lock className="h-3.5 w-3.5" /> اول «{m.requiresTitle}» را تمام کن!
                  </p>
                )}
                {!locked && (
                <div className="mt-1 flex flex-wrap items-center gap-2 text-[11px] font-extrabold">
                  <span className="flex items-center gap-1 rounded-full bg-[#FFF3D6] px-2.5 py-1 text-[#B8801A]">
                    <Coins className="h-3.5 w-3.5" /> +{fa(m.rewardCoins)}
                  </span>
                  <span className="flex items-center gap-1 rounded-full bg-[#FFF3D6] px-2.5 py-1 text-[#D64545]">
                    <Coffee className="h-3.5 w-3.5" /> +{fa(m.rewardRep)} آبرو
                  </span>
                  {m.timeLimitSec > 0 && (
                    <span className="flex items-center gap-1 rounded-full bg-[#FFF3D6] px-2.5 py-1 text-[#2A9D8F]">
                      <Gauge className="h-3.5 w-3.5" /> {fa(m.timeLimitSec)} ثانیه
                    </span>
                  )}
                </div>
                )}
              </button>
              );
            })}
            <p className="mt-1 text-center text-[11px] font-bold text-white/75">
              {CATEGORY_FA[missionFilter ?? "story"].hint}
            </p>
          </div>
        </div>
      )}

      {/* ============ گاراژ عمو نقی (فاز ۶) ============ */}
      {phase === "menu" && showGarage && garage && (
        <div className="absolute inset-0 z-40 flex flex-col overflow-y-auto overscroll-y-contain touch-pan-y bg-[#3a2e2a]/70 px-4 py-6 backdrop-blur-[2px]">
          <div className="fc-pop mx-auto flex w-full max-w-md flex-col gap-3 pb-4">
            {/* هدر */}
            <div className="flex items-center justify-between">
              <h2 className="flex items-center gap-2 text-2xl font-extrabold text-white drop-shadow-[0_2px_0_rgba(58,46,42,0.9)]">
                <Wrench className="h-7 w-7 text-[#F2B705]" />
                گاراژ عمو نقی
              </h2>
              <div className="flex items-center gap-2">
                <span className="fc-panel flex items-center gap-1.5 bg-[#FFF9EC] px-3 py-1.5">
                  <Coins className="h-5 w-5 text-[#B8801A]" />
                  <span className="font-extrabold text-[#3a2e2a]">{fa(garage.coins)}</span>
                </span>
                <TapButton
                  ariaLabel="بستن گاراژ"
                  className="h-11 w-11 bg-[#FFF9EC] text-[#3a2e2a]"
                  onTap={() => setShowGarage(false)}
                >
                  <X className="h-6 w-6" />
                </TapButton>
              </div>
            </div>

            {/* نمایشگاه خودرو — خرید و تعویض با سکه */}
            <p className="mt-1 flex items-center gap-1.5 text-xs font-bold text-white/85">
              <Car className="h-4 w-4 text-[#F2B705]" /> نمایشگاه ماشین‌ها — با سکه بخر و هر وقت خواستی عوض کن:
            </p>
            <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
              {garage.vehicles.map((v) => {
                const affordable = garage.coins >= v.price;
                return (
                  <div key={v.id} className={`fc-panel p-3 ${v.selected ? "bg-[#DDF5B4]" : "bg-[#FFF9EC]"}`}>
                    <div className="flex items-start gap-2">
                      <span className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-xl ${v.selected ? "bg-[#8AC926]" : "bg-[#FFF3D6]"} text-[#3a2e2a]`}>
                        <Car className="h-6 w-6" />
                      </span>
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center justify-between gap-1">
                          <span className="text-sm font-extrabold text-[#3a2e2a]">{v.name}</span>
                          {v.selected && <Check className="h-4 w-4 shrink-0 text-[#2A7A23]" />}
                        </div>
                        <p className="mt-0.5 text-[10px] leading-4 text-[#3a2e2a]/70">{v.description}</p>
                      </div>
                    </div>
                    <div className="mt-3 grid grid-cols-2 gap-x-3 gap-y-2">
                      {([
                        ["سرعت", v.speed],
                        ["شتاب", v.acceleration],
                        ["فرمان و چسبندگی", v.handling],
                        ["مقاومت بدنه", v.durability],
                      ] as const).map(([label, value]) => (
                        <div key={label}>
                          <div className="mb-1 flex items-center justify-between gap-1 text-[10px] font-bold text-[#3a2e2a]/75">
                            <span>{label}</span><span>{fa(value)}٪</span>
                          </div>
                          <div className="h-1.5 overflow-hidden rounded-full bg-[#3a2e2a]/10">
                            <div className="h-full rounded-full bg-[#F2B705]" style={{ width: `${Math.min(100, Math.max(0, value))}%` }} />
                          </div>
                        </div>
                      ))}
                    </div>
                    <button
                      type="button"
                      disabled={v.selected}
                      className={`fc-btn mt-2 flex w-full items-center justify-center gap-1.5 rounded-xl py-2 text-xs font-extrabold ${
                        v.selected ? "bg-[#3a2e2a]/10 text-[#3a2e2a]/60" : v.owned ? "bg-[#8AC926] text-[#3a2e2a]" : affordable ? "bg-[#F2B705] text-[#3a2e2a]" : "bg-[#FFF3D6] text-[#3a2e2a]/60"
                      }`}
                      onClick={() => {
                        if (v.selected) return;
                        purchase(() => v.owned ? gameRef.current!.selectVehicle(v.id) : gameRef.current!.buyVehicle(v.id));
                      }}
                    >
                      {v.selected ? "ماشین فعلی ✓" : v.owned ? "انتخاب این ماشین" : <><Coins className="h-4 w-4" />{fa(v.price)} سکه — خرید</>}
                    </button>
                  </div>
                );
              })}
            </div>

            {/* آپگریدها */}
            <p className="text-xs font-bold text-white/80">با سکه‌های مأموریت‌ها ماشینت را توپ کن:</p>
            <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
              {garage.upgrades.map((u) => {
                const maxed = u.nextPrice === null;
                const affordable = u.nextPrice !== null && garage.coins >= u.nextPrice;
                return (
                  <div key={u.id} className="fc-panel bg-[#FFF9EC] p-3">
                    <div className="flex items-center gap-2">
                      <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-[#FFF3D6] text-[#3a2e2a]">
                        {UPGRADE_ICON[u.id]}
                      </span>
                      <div className="flex-1">
                        <div className="flex items-center justify-between">
                          <span className="text-base font-extrabold text-[#3a2e2a]">{u.title}</span>
                          {/* پله‌های سطح */}
                          <span className="flex gap-1">
                            {Array.from({ length: u.maxLevel }).map((_, i) => (
                              <span
                                key={i}
                                className={`h-2 w-2 rounded-full ${i < u.level ? "bg-[#8AC926]" : "bg-[#3a2e2a]/15"}`}
                              />
                            ))}
                          </span>
                        </div>
                        <p className="text-[11px] font-bold leading-4 text-[#3a2e2a]/70">
                          {u.level > 0 ? u.effect : "حالت کارخانه"}
                        </p>
                      </div>
                    </div>
                    <button
                      type="button"
                      disabled={maxed}
                      className={`fc-btn mt-2 flex w-full items-center justify-center gap-1.5 rounded-xl py-2 text-sm font-extrabold ${
                        maxed
                          ? "bg-[#3a2e2a]/10 text-[#3a2e2a]/50"
                          : affordable
                            ? "bg-[#8AC926] text-[#3a2e2a]"
                            : "bg-[#FFF3D6] text-[#3a2e2a]/60"
                      }`}
                      onClick={() => {
                        if (maxed) return;
                        purchase(() => gameRef.current!.buyUpgrade(u.id));
                      }}
                    >
                      {maxed ? (
                        "حداکثر ✓"
                      ) : (
                        <>
                          <Coins className="h-4 w-4" />
                          {fa(u.nextPrice ?? 0)} سکه — سطح {fa(u.level + 1)}
                        </>
                      )}
                    </button>
                  </div>
                );
              })}
            </div>

            {/* رنگ‌ها */}
            <p className="mt-1 flex items-center gap-1.5 text-xs font-bold text-white/80">
              <Car className="h-4 w-4" /> رنگ ماشین — همین لحظه تو صحنه عوض می‌شود:
            </p>
            <div className="grid grid-cols-4 gap-2">
              {garage.paints.map((p) => (
                <button
                  key={p.id}
                  type="button"
                  title={`${p.name}${p.owned ? "" : ` — ${fa(p.price)} سکه`}`}
                  className={`fc-btn flex flex-col items-center gap-1 rounded-2xl p-2 ${
                    p.selected ? "bg-[#8AC926]" : "bg-[#FFF9EC]"
                  }`}
                  onClick={() => {
                    if (p.owned) {
                      if (!p.selected) purchase(() => gameRef.current!.selectPaint(p.id));
                    } else {
                      purchase(() => gameRef.current!.buyPaint(p.id));
                    }
                  }}
                >
                  <span
                    className="relative flex h-9 w-9 items-center justify-center rounded-full border-[3px] border-[#3a2e2a]"
                    style={{ backgroundColor: p.hex }}
                  >
                    {p.selected && <Check className="h-5 w-5 text-white drop-shadow-[0_1px_1px_rgba(0,0,0,0.8)]" />}
                    {!p.owned && !p.selected && <Lock className="h-4 w-4 text-white drop-shadow-[0_1px_1px_rgba(0,0,0,0.9)]" />}
                  </span>
                  <span className={`text-[9px] font-extrabold leading-3 ${p.selected ? "text-[#3a2e2a]" : "text-[#3a2e2a]/80"}`}>
                    {p.owned ? p.name : `${fa(p.price)} سکه`}
                  </span>
                </button>
              ))}
            </div>
            {/* جمله طنز رنگ انتخاب‌شده/آخرین */}
            {(() => {
              const sel = garage.paints.find((p) => p.selected);
              const flavor = sel ? PAINT_FLAVOR[sel.id] : null;
              return flavor ? (
                <p className="text-center text-[11px] font-bold text-white/85">«{flavor}»</p>
              ) : null;
            })()}

            {/* بوق‌ها (فاز ۷) — امضای صوتی راننده */}
            <p className="mt-2 flex items-center gap-1.5 text-xs font-bold text-white/80">
              <Megaphone className="h-4 w-4" /> بوق‌ها — بزن بشنوی، بعد بخر! (صدای واقعی پخش می‌شود):
            </p>
            <div className="grid grid-cols-2 gap-2">
              {garage.horns.map((h) => (
                <button
                  key={h.id}
                  type="button"
                  title={h.desc}
                  className={`fc-btn flex items-center gap-2 rounded-2xl p-2.5 text-right ${
                    h.selected ? "bg-[#8AC926]" : "bg-[#FFF9EC]"
                  }`}
                  onClick={() => {
                    if (h.owned) {
                      if (!h.selected) purchase(() => gameRef.current!.selectHorn(h.id));
                    } else {
                      purchase(() => gameRef.current!.buyHorn(h.id));
                    }
                  }}
                >
                  <span
                    className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl ${
                      h.selected ? "bg-[#3a2e2a] text-[#8AC926]" : "bg-[#FFF3D6] text-[#3a2e2a]"
                    }`}
                  >
                    {HORN_ICON[h.id] ?? <Megaphone className="h-6 w-6" />}
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className={`block truncate text-sm font-extrabold ${h.selected ? "text-[#3a2e2a]" : "text-[#3a2e2a]"}`}>
                      {h.name}
                    </span>
                    <span className={`block text-[10px] font-bold leading-3.5 ${h.selected ? "text-[#3a2e2a]/75" : "text-[#3a2e2a]/60"}`}>
                      {h.owned ? (h.selected ? "وصل شد ✓" : "خریده‌شده — بزن وصل شه") : `${fa(h.price)} سکه`}
                    </span>
                  </span>
                  {!h.owned && <Lock className="h-4 w-4 shrink-0 text-[#3a2e2a]/40" />}
                </button>
              ))}
            </div>
            {/* جمله طنز بوق انتخاب‌شده */}
            {(() => {
              const sel = garage.horns.find((x) => x.selected);
              const flavor = sel ? HORN_FLAVOR[sel.id] : null;
              return flavor ? (
                <p className="text-center text-[11px] font-bold text-white/85">«{flavor}»</p>
              ) : null;
            })()}
            <p className="text-center text-[11px] font-bold text-white/75">{HORN_FOOTER}</p>

            <p className="mt-1 text-center text-[11px] font-bold text-white/75">{GARAGE_FOOTER}</p>
          </div>
        </div>
      )}

      {/* ============ HUD گیم‌پلی ============ */}
      {phase === "playing" && (
        <>
          {/* نوار بالا — dir ltr: توقف چپ، پنل‌ها کنارش؛ مینی‌مپ روی بوم بالا-راست است */}
          <div dir="ltr" className="pointer-events-none absolute inset-x-0 top-0 z-20 flex items-start justify-start gap-2 p-3">
            <div className="pointer-events-auto">
              <TapButton ariaLabel="توقف بازی" className="h-10 w-10 bg-[#FFF9EC] text-[#3a2e2a]" onTap={() => gameRef.current?.pause()}>
                <Pause className="h-5 w-5" />
              </TapButton>
            </div>
            <div className="flex flex-col items-start gap-1.5">
              {/* پنل مأموریت فعال (فاز 4) */}
              {hud.mission && (
                <div className="fc-panel pointer-events-auto w-[188px] bg-[#FFF9EC]/95 p-2">
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-[11px] font-bold text-[#3a2e2a]">{hud.mission.title}</span>
                    <TapButton
                      ariaLabel="انصراف از مأموریت"
                      className="h-6 w-6 bg-[#D64545] text-white"
                      onTap={() => gameRef.current?.abandonMission()}
                    >
                      <X className="h-3.5 w-3.5" />
                    </TapButton>
                  </div>
                  <p className="mt-0.5 text-[9px] font-medium leading-3 text-[#3a2e2a]/70">{hud.mission.objective}</p>
                  {hud.mission.timeLeft >= 0 && (
                    <div className="mt-1">
                      <div className="h-2 w-full overflow-hidden rounded-full border-2 border-[#3a2e2a] bg-white">
                        <div
                          className="h-full transition-all"
                          style={{
                            width: `${hud.mission.timeLimit > 0 ? Math.max(0, Math.min(100, (hud.mission.timeLeft / hud.mission.timeLimit) * 100)) : 0}%`,
                            backgroundColor: hud.mission.timeLeft > 15 ? "#8AC926" : hud.mission.timeLeft > 7 ? "#F2B705" : "#D64545",
                          }}
                        />
                      </div>
                      <div className="mt-0.5 flex items-center justify-between text-[9px] font-bold text-[#3a2e2a]/80">
                        <span>{fa(Math.ceil(hud.mission.timeLeft))} ثانیه</span>
                        <span>{fa(hud.mission.distM)} متر</span>
                      </div>
                    </div>
                  )}
                  {hud.mission.timeLeft < 0 && (
                    <div className="mt-1 text-[9px] font-bold text-[#3a2e2a]/80">{fa(hud.mission.distM)} متر تا هدف</div>
                  )}
                  {hud.mission.extra && (
                    <div className="mt-1 rounded-full bg-[#FFF3D6] px-2 py-0.5 text-center text-[9px] font-bold text-[#3a2e2a]">{hud.mission.extra}</div>
                  )}
                </div>
              )}
              <div className="fc-panel flex items-center gap-1.5 bg-[#FFF9EC]/95 px-2 py-1">
                <Coins className="h-4 w-4 text-[#B8801A]" />
                <span className="text-[11px] font-bold text-[#3a2e2a]">{fa(hud.coins)}</span>
              </div>
              <div className="fc-panel flex items-center gap-1.5 bg-[#FFF9EC]/95 px-2 py-1">
                <Coffee className="h-4 w-4 text-[#D64545]" />
                <div className="h-2.5 w-16 overflow-hidden rounded-full border-2 border-[#3a2e2a] bg-white">
                  <div className="h-full transition-all" style={{ width: `${hud.reputation}%`, backgroundColor: repColor }} />
                </div>
              </div>
              {/* سلامت ماشین (فاز BIG-IR) */}
              <div className="fc-panel flex items-center gap-1.5 bg-[#FFF9EC]/95 px-2 py-1">
                <Wrench className="h-4 w-4 text-[#5d6d7e]" />
                <div className="h-2.5 w-16 overflow-hidden rounded-full border-2 border-[#3a2e2a] bg-white">
                  <div className="h-full transition-all" style={{ width: `${hud.health}%`, backgroundColor: healthColor }} />
                </div>
              </div>
              <div className="fc-panel flex items-center gap-1.5 bg-[#FFF9EC]/95 px-2 py-1">
                <Gauge className="h-4 w-4 text-[#2A9D8F]" />
                <span className="text-[11px] font-bold text-[#3a2e2a]">{fa(hud.speedKmh)} km/h</span>
              </div>
              {hud.showFps && (
                <div className="fc-panel bg-[#3a2e2a]/85 px-2 py-0.5">
                  <span className="text-[10px] font-bold text-white">FPS: {fa(hud.fps)}</span>
                </div>
              )}
            </div>
          </div>

          {/* کنترل‌ها: فرمان پایین-چپ، گاز/ترمز پایین-راست — dir ltr تا RTL دکمه‌ها را برعکس نچیند */}
          <div className="pointer-events-none absolute inset-0 z-20">
            <div className="pointer-events-auto absolute" style={{ left: "clamp(10px, 2.5vw, 20px)", bottom: "clamp(10px, 4vh, 28px)", display: "flex", gap: "clamp(8px, 1.8vw, 14px)", direction: "ltr" }}>
              <HoldButton
                ariaLabel="فرمان چپ"
                onHold={steerLeft}
                className="h-[clamp(58px,14vh,88px)] w-[clamp(58px,14vh,88px)] bg-[#FFF3D6] text-[#3a2e2a]"
              >
                <ChevronLeft className="h-12 w-12" strokeWidth={2.6} />
              </HoldButton>
              <HoldButton
                ariaLabel="فرمان راست"
                onHold={steerRight}
                className="h-[88px] w-[88px] bg-[#FFF3D6] text-[#3a2e2a]"
              >
                <ChevronRight className="h-12 w-12" strokeWidth={2.6} />
              </HoldButton>
            </div>
            <div className="pointer-events-auto absolute flex items-end gap-3" style={{ right: "clamp(10px, 2.5vw, 20px)", bottom: "clamp(10px, 4vh, 28px)", direction: "ltr", gap: "clamp(8px, 1.8vw, 12px)" }}>
              <div className="flex flex-col items-center gap-3">
                <TapButton
                  ariaLabel="بوق"
                  onTap={() => gameRef.current?.pressHorn()}
                  className="h-[clamp(44px,10vh,60px)] w-[clamp(44px,10vh,60px)] bg-[#F2B705] text-[#3a2e2a]"
                >
                  <Megaphone className="h-7 w-7" />
                </TapButton>
                <HoldButton
                  ariaLabel="ترمز"
                  onHold={(d) => gameRef.current?.setVirtualBrake(d)}
                  className="h-[clamp(54px,12vh,76px)] w-[clamp(54px,12vh,76px)] bg-[#D64545] text-white"
                >
                  <Square className="h-8 w-8" strokeWidth={2.6} />
                </HoldButton>
              </div>
              <HoldButton
                ariaLabel="گاز"
                onHold={(d) => gameRef.current?.setVirtualGas(d)}
                className="h-[clamp(68px,17vh,100px)] w-[clamp(68px,17vh,100px)] bg-[#8AC926] text-[#3a2e2a]"
              >
                <ArrowUp className="h-12 w-12" strokeWidth={2.6} />
              </HoldButton>
            </div>
          </div>
        </>
      )}

      {/* ============ صفحه توقف ============ */}
      {phase === "paused" && (
        <div className="absolute inset-0 z-40 flex items-center justify-center bg-[#3a2e2a]/45 backdrop-blur-[2px]">
          <div className="fc-panel fc-pop mx-6 w-full max-w-sm bg-[#FFF9EC] p-6">
            <h2 className="mb-1 text-center text-2xl font-extrabold text-[#3a2e2a]">استراحت کوچولو!</h2>
            <p className="mb-4 text-center text-xs font-bold text-[#3a2e2a]/60">ماشین هم نفس تازه می‌کند</p>
            <div className="mb-4 space-y-2">
              <button
                type="button"
                className="fc-btn flex w-full items-center justify-center gap-2 rounded-2xl bg-[#8AC926] py-3 text-lg font-extrabold text-[#3a2e2a]"
                onPointerDown={(e) => {
                  e.preventDefault();
                  gameRef.current?.resume();
                }}
              >
                <Play className="h-5 w-5" />
                ادامه بازی
              </button>
              <button
                type="button"
                className="fc-btn flex w-full items-center justify-center gap-2 rounded-2xl bg-[#FFF3D6] py-3 font-extrabold text-[#3a2e2a]"
                onPointerDown={(e) => {
                  e.preventDefault();
                  setShowSettings((v) => !v);
                }}
              >
                <Settings className="h-5 w-5" />
                تنظیمات صدا
              </button>
              <button
                type="button"
                className="fc-btn flex w-full items-center justify-center gap-2 rounded-2xl bg-[#D64545] py-3 font-extrabold text-white"
                onPointerDown={(e) => {
                  e.preventDefault();
                  gameRef.current?.backToMenu();
                }}
              >
                <Home className="h-5 w-5" />
                منوی اصلی
              </button>
            </div>
            {showSettings && game && (
              <div className="rounded-2xl bg-[#FFF3D6] p-3">
                <SettingsPanel game={game} />
              </div>
            )}
          </div>
        </div>
      )}

      {/* ============ نتیجه مأموریت (فاز 4) ============ */}
      {phase === "playing" && missionResult && (
        <div className="absolute inset-0 z-40 flex items-center justify-center bg-[#3a2e2a]/45 px-6 backdrop-blur-[2px]">
          <div
            className={`fc-panel fc-pop w-full max-w-sm p-6 text-center ${
              missionResult.success ? "bg-[#FFF9EC]" : "bg-[#F4E7DA]"
            }`}
          >
            <div
              className={`mx-auto mb-3 flex h-16 w-16 items-center justify-center rounded-3xl ${
                missionResult.success ? "bg-[#8AC926]" : "bg-[#D64545]"
              }`}
            >
              {missionResult.success ? (
                <PartyPopper className="h-9 w-9 text-[#3a2e2a]" />
              ) : (
                <X className="h-9 w-9 text-white" />
              )}
            </div>
            <h2 className="text-2xl font-extrabold text-[#3a2e2a]">
              {missionResult.success ? "مأموریت موفق!" : "مأموریت شکست!"}
            </h2>
            <p className="mt-0.5 text-sm font-bold text-[#3a2e2a]/70">{missionResult.title}</p>
            {!missionResult.success && missionResult.reason && (
              <p className="mt-1 text-sm font-extrabold text-[#D64545]">
                {FAIL_REASON_FA[missionResult.reason] ?? missionResult.reason}
              </p>
            )}
            {missionResult.success && (
              <div className="mt-3 flex items-center justify-center gap-2">
                <span className="fc-panel flex items-center gap-1.5 bg-[#FFF3D6] px-3 py-1.5 text-[#B8801A]">
                  <Coins className="h-5 w-5" />
                  <span className="font-extrabold">+{fa(missionResult.coins)}</span>
                </span>
                <span className="fc-panel flex items-center gap-1.5 bg-[#FFF3D6] px-3 py-1.5 text-[#D64545]">
                  <Coffee className="h-5 w-5" />
                  <span className="font-extrabold">+{fa(missionResult.rep)} آبرو</span>
                </span>
              </div>
            )}
            <p className="mt-3 rounded-2xl bg-[#FFF3D6] px-3 py-2 text-sm font-bold leading-6 text-[#3a2e2a]">
              «{missionResult.line}»
            </p>
            {missionResult.success && (
              <div className="mt-3 rounded-2xl border border-[#F2B705]/50 bg-[#FFF8DF] px-4 py-3 text-center text-[#3a2e2a]">
                <div className="text-xs font-extrabold opacity-75">رتبهٔ رانندگی</div>
                <div className="mt-1 flex items-center justify-center gap-2 text-2xl" aria-label={`${missionResult.stars} از ۳ ستاره`}>
                  {[1, 2, 3].map((star) => (
                    <span key={star} className={star <= missionResult.stars ? "text-[#E0A800]" : "text-[#B9B3A3]"}>★</span>
                  ))}
                </div>
                <div className="mt-1 text-xs font-bold">
                  {missionResult.stars === 3 ? "رانندگی بی‌نقص! پاداش ویژه گرفتی." : missionResult.stars === 2 ? "خوب بود! برای پاداش کامل تمیزتر برون." : "مأموریت انجام شد؛ برای ستاره‌های بیشتر تصادف نکن."}
                </div>
              </div>
            )}
            {missionResult.success && missionResult.unlockedNext && (
              <p className="mt-2 flex items-center justify-center gap-1.5 rounded-2xl bg-[#8AC926]/25 px-3 py-2 text-sm font-extrabold text-[#3a2e2a]">
                <Lock className="h-4 w-4" />
                مأموریت جدید باز شد: {missionResult.unlockedNext}!
              </p>
            )}
            <div className="mt-4 space-y-2">
              <button
                type="button"
                className="fc-btn flex w-full items-center justify-center gap-2 rounded-2xl bg-[#8AC926] py-3 text-lg font-extrabold text-[#3a2e2a]"
                onPointerDown={(e) => {
                  e.preventDefault();
                  setMissionResult(null);
                  gameRef.current?.startMission(missionResult.missionId);
                }}
              >
                <Play className="h-5 w-5" />
                تلاش دوباره
              </button>
              <button
                type="button"
                className="fc-btn flex w-full items-center justify-center gap-2 rounded-2xl bg-[#FFF3D6] py-3 font-extrabold text-[#3a2e2a]"
                onPointerDown={(e) => {
                  e.preventDefault();
                  setMissionResult(null);
                  gameRef.current?.abandonMission();
                }}
              >
                <Gauge className="h-5 w-5" />
                ادامه رانندگی آزاد
              </button>
              <button
                type="button"
                className="fc-btn flex w-full items-center justify-center gap-2 rounded-2xl bg-[#D64545] py-3 font-extrabold text-white"
                onPointerDown={(e) => {
                  e.preventDefault();
                  setMissionResult(null);
                  gameRef.current?.backToMenu();
                }}
              >
                <Home className="h-5 w-5" />
                منوی اصلی
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ============ اورلی خاموشی موتور (فاز BIG-IR) ============ */}
      {phase === "playing" && hud.engineDead && !missionResult && (
        <div className="absolute inset-0 z-40 flex items-center justify-center bg-[#3a2e2a]/55 backdrop-blur-[2px]">
          <div className="fc-panel fc-pop w-full max-w-sm bg-[#FFF9EC] p-6 text-center">
            <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-[#D64545]">
              <Wrench className="h-9 w-9 text-white" />
            </div>
            <h2 className="mt-3 text-2xl font-extrabold text-[#3a2e2a]">ماشین خاموش شد!</h2>
            <p className="mt-1 text-sm font-bold text-[#3a2e2a]/70">
              موتور از بس ضربه خورده استعفا داد. بریم تعمیرگاه؟
            </p>
            <div className="mt-4 space-y-2">
              <button
                type="button"
                className="fc-btn flex w-full items-center justify-center gap-2 rounded-2xl bg-[#2A9D8F] py-3 text-lg font-extrabold text-white"
                onPointerDown={(e) => {
                  e.preventDefault();
                  gameRef.current?.towToRepair();
                }}
              >
                <Wrench className="h-5 w-5" />
                اسکران به تعمیرگاه ({towCostLabel})
              </button>
              <button
                type="button"
                className="fc-btn flex w-full items-center justify-center gap-2 rounded-2xl bg-[#FFF3D6] py-3 font-extrabold text-[#3a2e2a]"
                onPointerDown={(e) => {
                  e.preventDefault();
                  gameRef.current?.backToMenu();
                }}
              >
                <Home className="h-5 w-5" />
                منوی اصلی
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ============ Toast ============ */}
      {toast && (
        <div className="pointer-events-none absolute inset-x-0 bottom-28 z-50 flex justify-center px-6">
          <div className="fc-pop fc-panel bg-[#3a2e2a] px-5 py-2.5 text-center text-sm font-extrabold text-white">
            {toast}
          </div>
        </div>
      )}
    </div>
  );
}

/* آیکون تنظیمات به‌صورت مستقیم برای جلوگیری از import اضافه */
function Settings(props: React.SVGProps<SVGSVGElement>) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
      {...props}
    >
      <path d="M12.22 2h-.44a2 2 0 0 0-2 2v.18a2 2 0 0 1-1 1.73l-.43.25a2 2 0 0 1-2 0l-.15-.08a2 2 0 0 0-2.73.73l-.22.38a2 2 0 0 0 .73 2.73l.15.1a2 2 0 0 1 1 1.72v.51a2 2 0 0 1-1 1.74l-.15.09a2 2 0 0 0-.73 2.73l.22.38a2 2 0 0 0 2.73.73l.15-.08a2 2 0 0 1 2 0l.43.25a2 2 0 0 1 1 1.73V20a2 2 0 0 0 2 2h.44a2 2 0 0 0 2-2v-.18a2 2 0 0 1 1-1.73l.43-.25a2 2 0 0 1 2 0l.15.08a2 2 0 0 0 2.73-.73l.22-.39a2 2 0 0 0-.73-2.73l-.15-.08a2 2 0 0 1-1-1.74v-.5a2 2 0 0 1 1-1.74l.15-.09a2 2 0 0 0 .73-2.73l-.22-.38a2 2 0 0 0-2.73-.73l-.15.08a2 2 0 0 1-2 0l-.43-.25a2 2 0 0 1-1-1.73V4a2 2 0 0 0-2-2z" />
      <circle cx="12" cy="12" r="3" />
    </svg>
  );
}
