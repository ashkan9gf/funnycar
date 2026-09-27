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
  ArrowUp,
  Car,
  ChevronLeft,
  ChevronRight,
  Coffee,
  Coins,
  Gauge,
  Home,
  Loader2,
  Map,
  Megaphone,
  Mic,
  Music,
  PartyPopper,
  Pause,
  Play,
  Square,
  Target,
  Users,
  Volume2,
  X,
} from "lucide-react";
import { createGame, type GameInstance, type GameState, type HudData } from "@/game";
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

export default function GameShell() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const gameRef = useRef<GameInstance | null>(null);
  const steerRef = useRef({ left: false, right: false });
  const toastTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  /** نمونه بازی در state برای رندر امن React (gameRef فقط در event handlerها استفاده می‌شود) */
  const [game, setGame] = useState<GameInstance | null>(null);

  const [phase, setPhase] = useState<GameState | "boot">("boot");
  const [bootProgress, setBootProgress] = useState(0);
  const [hud, setHud] = useState<HudData>({ speedKmh: 0, coins: 0, reputation: 50, fps: 60, showFps: false, placeholders: 0 });
  const [toast, setToast] = useState<string | null>(null);
  const [showSettings, setShowSettings] = useState(false);

  const showToast = useCallback((msg: string) => {
    setToast(msg);
    if (toastTimer.current) clearTimeout(toastTimer.current);
    toastTimer.current = setTimeout(() => setToast(null), 1800);
  }, []);

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
      },
      (done, total) => setBootProgress(Math.round((done / total) * 100)),
    ).then((inst) => {
      if (cancelled) {
        inst.dispose();
        return;
      }
      gameRef.current = inst;
      setGame(inst);
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

  const comingSoon = useCallback(() => showToast("این حالت به‌زودی می‌آید! طبق نقشه راه فاز ۴ به ۷ ساخته می‌شود."), [showToast]);

  const repColor = hud.reputation >= 70 ? "#8AC926" : hud.reputation >= 35 ? "#F2B705" : "#D64545";

  return (
    <div className="fixed inset-0 overflow-hidden bg-[#C9B98A] font-vazir" dir="rtl">
      {/* بوم بازی — زیر همه لایه‌ها */}
      <canvas ref={canvasRef} className="fc-canvas absolute inset-0 h-full w-full" />

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
        <div className="absolute inset-0 z-30 flex flex-col overflow-y-auto bg-gradient-to-b from-[#3a2e2a]/10 via-transparent to-[#3a2e2a]/55">
          <div className="fc-pop mx-auto flex w-full max-w-md flex-1 flex-col items-center justify-center gap-5 px-6 py-8">
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
              onPointerDown={(e) => {
                e.preventDefault();
                gameRef.current?.startGameplay();
              }}
            >
              رانندگی آزاد
            </button>

            {/* حالت‌های بعدی */}
            <div className="grid w-full max-w-xs grid-cols-2 gap-3">
              {[
                { icon: <Map className="h-6 w-6" />, label: "مأموریت‌ها" },
                { icon: <Target className="h-6 w-6" />, label: "پارک دوبل" },
                { icon: <Users className="h-6 w-6" />, label: "مسافرکشی" },
                { icon: <PartyPopper className="h-6 w-6" />, label: "چالش‌ها" },
              ].map((m) => (
                <button
                  key={m.label}
                  type="button"
                  className="fc-btn flex flex-col items-center gap-1 rounded-2xl bg-[#FFF3D6] py-3 text-[#3a2e2a]"
                  onPointerDown={(e) => {
                    e.preventDefault();
                    comingSoon();
                  }}
                >
                  {m.icon}
                  <span className="text-sm font-extrabold">{m.label}</span>
                  <span className="text-[10px] font-bold opacity-60">به‌زودی</span>
                </button>
              ))}
            </div>

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
                onPointerDown={(e) => {
                  e.preventDefault();
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
              نسخه فاز ۱ • موتور اختصاصی HTML5
            </p>
          </div>
        </div>
      )}

      {/* ============ HUD گیم‌پلی ============ */}
      {phase === "playing" && (
        <>
          {/* نوار بالا */}
          <div className="pointer-events-none absolute inset-x-0 top-0 z-20 flex items-start justify-between p-3">
            <div className="pointer-events-auto">
              <TapButton ariaLabel="توقف بازی" className="h-12 w-12 bg-[#FFF9EC] text-[#3a2e2a]" onTap={() => gameRef.current?.pause()}>
                <Pause className="h-6 w-6" />
              </TapButton>
            </div>
            <div className="flex flex-col items-end gap-2">
              <div className="fc-panel flex items-center gap-2 bg-[#FFF9EC]/95 px-3 py-1.5">
                <Coins className="h-5 w-5 text-[#B8801A]" />
                <span className="font-extrabold text-[#3a2e2a]">{fa(hud.coins)}</span>
              </div>
              <div className="fc-panel flex items-center gap-2 bg-[#FFF9EC]/95 px-3 py-1.5">
                <Coffee className="h-5 w-5 text-[#D64545]" />
                <div className="h-3 w-20 overflow-hidden rounded-full border-[3px] border-[#3a2e2a] bg-white">
                  <div className="h-full transition-all" style={{ width: `${hud.reputation}%`, backgroundColor: repColor }} />
                </div>
              </div>
              <div className="fc-panel flex items-center gap-2 bg-[#FFF9EC]/95 px-3 py-1.5">
                <Gauge className="h-5 w-5 text-[#2A9D8F]" />
                <span className="font-extrabold text-[#3a2e2a]">{fa(hud.speedKmh)} کیلومتر/ساعت</span>
              </div>
              {hud.showFps && (
                <div className="fc-panel bg-[#3a2e2a]/85 px-3 py-1">
                  <span className="text-xs font-extrabold text-white">FPS: {fa(hud.fps)}</span>
                </div>
              )}
            </div>
          </div>

          {/* کنترل‌ها: فرمان پایین-چپ، گاز/ترمز پایین-راست (GAME_DESIGN بخش ۱۳) */}
          <div className="pointer-events-none absolute inset-0 z-20">
            <div className="pointer-events-auto absolute" style={{ left: 20, bottom: 28, display: "flex", gap: 14 }}>
              <HoldButton
                ariaLabel="فرمان چپ"
                onHold={steerLeft}
                className="h-[88px] w-[88px] bg-[#FFF3D6] text-[#3a2e2a]"
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
            <div className="pointer-events-auto absolute flex items-end gap-3" style={{ right: 20, bottom: 28 }}>
              <div className="flex flex-col items-center gap-3">
                <TapButton
                  ariaLabel="بوق"
                  onTap={() => gameRef.current?.pressHorn()}
                  className="h-[60px] w-[60px] bg-[#F2B705] text-[#3a2e2a]"
                >
                  <Megaphone className="h-7 w-7" />
                </TapButton>
                <HoldButton
                  ariaLabel="ترمز"
                  onHold={(d) => gameRef.current?.setVirtualBrake(d)}
                  className="h-[76px] w-[76px] bg-[#D64545] text-white"
                >
                  <Square className="h-8 w-8" strokeWidth={2.6} />
                </HoldButton>
              </div>
              <HoldButton
                ariaLabel="گاز"
                onHold={(d) => gameRef.current?.setVirtualGas(d)}
                className="h-[100px] w-[100px] bg-[#8AC926] text-[#3a2e2a]"
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
