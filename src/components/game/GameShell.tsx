"use client";

/**
 * GameShell.tsx — پوسته بازی: بوت، منو، HUD، توقف، تنظیمات
 * ============================================================
 * - تمام متن‌ها فارسی RTL با اعداد فارسی
 * - مرز لایه‌ها: این کامپوننت فقط از API عمومی موتور (createGame) استفاده می‌کند
 * - دکمه‌های لمسی: HoldButton/TapButton (touch-controls.tsx)
 */

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
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
  Infinity as InfinityIcon,
  Loader2,
  Lock,
  Map,
  Megaphone,
  Mic,
  MoveHorizontal,
  Music,
  Octagon,
  PartyPopper,
  Pause,
  Play,
  Radio,
  RotateCw,
  Shield,
  Siren,
  Square,
  Star,
  Target,
  Users,
  Vibrate,
  Volume2,
  Wrench,
  X,
  Hand,
} from "lucide-react";
import type { MissionCategory, UpgradeId, UiPrefs } from "@/game";
import type { CarVariant } from "@/game/render3d/CarFactory3D";
import { renderCarPreview, renderCarPreviewAsync, renderCarPreviewSpin, SPIN_STEPS } from "@/game/render3d/CarPreview";
import { LOADING_LINES } from "@/game/data/dialogues";
import { ASSETS_MANIFEST } from "@/game/data/assets.manifest";
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
import { HoldButton, TapButton, setHapticsEnabled } from "./touch-controls";

/** تبدیل اعداد به فارسی */
const FA = ["۰", "۱", "۲", "۳", "۴", "۵", "۶", "۷", "۸", "۹"];
const fa = (n: number | string): string => String(n).replace(/[0-9]/g, (d) => FA[Number(d)]);

interface Settings {
  music: number;
  sfx: number;
  voice: number;
  graphicsQuality: 'performance' | 'balanced' | 'quality';
}

/** 🔑 v0.2.43 — سوییچ دوتایی تنظیمات */
function ToggleRow({ label, icon, value, onChange, hint }: { label: string; icon: React.ReactNode; value: boolean; onChange: (v: boolean) => void; hint?: string }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={value}
      className="flex w-full items-center gap-3 py-1 text-right"
      onClick={() => onChange(!value)}
    >
      <span className="text-[#3a2e2a]">{icon}</span>
      <span className="min-w-0 flex-1">
        <span className="block text-sm font-bold text-[#3a2e2a]">{label}</span>
        {hint && <span className="block text-[10px] font-bold leading-4 text-[#3a2e2a]/55">{hint}</span>}
      </span>
      <span className={`relative h-7 w-12 shrink-0 rounded-full border-[3px] border-[#3a2e2a] transition-colors ${value ? "bg-[#8AC926]" : "bg-[#e2d7c0]"}`}>
        <span className={`absolute top-1/2 h-4 w-4 -translate-y-1/2 rounded-full border-2 border-[#3a2e2a] bg-white transition-all ${value ? "left-[3px]" : "right-[3px]"}`} />
      </span>
    </button>
  );
}

/** پنل تنظیمات (منو و Pause) — v0.2.43: + تنظیم دکمه‌های لمسی */
function SettingsPanel({ game, ui, onChangeUi, onReplayTutorial, onClose }: {
  game: GameInstance;
  ui: UiPrefs;
  onChangeUi: (p: Partial<UiPrefs>) => void;
  onReplayTutorial?: () => void;
  onClose?: () => void;
}) {
  const [s, setS] = useState<Settings>(game.getSettings());
  const rows: Array<{ key: 'music' | 'sfx' | 'voice'; label: string; icon: React.ReactNode }> = [
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
      <div className="flex flex-wrap items-center gap-3 pt-2">
        <span className="w-24 text-sm font-bold text-[#3a2e2a]">کیفیت گرافیک</span>
        <select
          aria-label="کیفیت گرافیک"
          className="min-w-0 flex-1 rounded-xl border border-[#c8b89b] bg-[#fffaf0] px-3 py-2 text-sm font-bold text-[#3a2e2a]"
          value={s.graphicsQuality}
          onChange={(e) => {
            const quality = e.target.value as Settings['graphicsQuality'];
            setS((p) => ({ ...p, graphicsQuality: quality }));
            game.setGraphicsQuality(quality);
          }}
        >
          <option value="performance">روان‌تر — مناسب گوشی ضعیف</option>
          <option value="balanced">متعادل — پیشنهاد ما</option>
          <option value="quality">کیفیت بالاتر — مناسب گوشی قوی</option>
        </select>
      </div>
      <p className="text-xs leading-5 text-[#6b5b49]">
        تغییر کیفیت فوراً اعمال و ذخیره می‌شود؛ جزئیات جهان ثابت می‌ماند و فقط بودجهٔ وضوح رندر سه‌بعدی تغییر می‌کند.
      </p>
      {/* ---------- 🔑 v0.2.43 — دکمه‌های رانندگی: اندازه/شفافیت/چپ‌دست/ویبره ---------- */}
      <div className="rounded-2xl bg-[#FFF3D6] p-3">
        <p className="mb-2 flex items-center gap-1.5 text-xs font-extrabold text-[#3a2e2a]">
          <MoveHorizontal className="h-4 w-4" />
          دکمه‌های رانندگی — هر جور راحتی!
        </p>
        <div className="space-y-2.5">
          <div className="flex items-center gap-2">
            <span className="w-[74px] shrink-0 text-[11px] font-bold text-[#3a2e2a]">اندازه</span>
            <input
              type="range"
              className="fc-range flex-1"
              min={0.8}
              max={1.4}
              step={0.05}
              value={ui.controlsScale}
              aria-label="اندازه دکمه‌های رانندگی"
              onChange={(e) => onChangeUi({ controlsScale: Number(e.target.value) })}
            />
            <span className="w-10 text-center text-[11px] font-extrabold text-[#3a2e2a]">{fa(Math.round(ui.controlsScale * 100))}٪</span>
          </div>
          <div className="flex items-center gap-2">
            <span className="w-[74px] shrink-0 text-[11px] font-bold text-[#3a2e2a]">شفافیت</span>
            <input
              type="range"
              className="fc-range flex-1"
              min={0.4}
              max={1}
              step={0.05}
              value={ui.controlsOpacity}
              aria-label="شفافیت دکمه‌های رانندگی"
              onChange={(e) => onChangeUi({ controlsOpacity: Number(e.target.value) })}
            />
            <span className="w-10 text-center text-[11px] font-extrabold text-[#3a2e2a]">{fa(Math.round(ui.controlsOpacity * 100))}٪</span>
          </div>
          <ToggleRow
            label="حالت چپ‌دست"
            icon={<Hand className="h-5 w-5" />}
            value={ui.leftHanded}
            onChange={(v) => onChangeUi({ leftHanded: v })}
            hint="فرمان می‌ره راست، گاز و ترمز می‌آن چپ"
          />
          <ToggleRow
            label="ویبره لمس"
            icon={<Vibrate className="h-5 w-5" />}
            value={ui.vibration}
            onChange={(v) => onChangeUi({ vibration: v })}
            hint="با لمس دکمه‌ها تیک ملایم می‌کشه"
          />
        </div>
        {onReplayTutorial && (
          <button
            type="button"
            className="fc-btn mt-2.5 w-full rounded-xl bg-[#FFF9EC] py-2 text-[11px] font-extrabold text-[#3a2e2a]"
            onClick={onReplayTutorial}
          >
            دیدن دوبارهٔ آموزش رانندگی
          </button>
        )}
      </div>
      {onClose && (
        <button
          type="button"
          className="fc-btn mt-2 w-full rounded-2xl bg-[#3a2e2a] py-2.5 text-white"
          onClick={() => {
            onClose();
          }}
        >
          بستن
        </button>
      )}
    </div>
  );
}

/** پیش‌نمایش سه‌بعدی خودرو (بازار v0.2.39) — رندر تک‌فریمی کش‌شده؛ بدون WebGL → کارت رنگی */
function CarPreviewImg({ variant, paint, className }: { variant: string; paint: string | null; className?: string }) {
  // 🔑 v0.2.41: تصویر فوری procedural (کش) → بعد از رسیدن GLB، همان «مدل واقعی» جایگزین می‌شود
  const syncSrc = renderCarPreview(variant as CarVariant, paint);
  const glbKey = `${variant}|${paint ?? "default"}`;
  const [glbSrc, setGlbSrc] = useState<Record<string, string>>({});
  useEffect(() => {
    let alive = true;
    void renderCarPreviewAsync(variant as CarVariant, paint).then((url) => {
      if (alive && url) setGlbSrc((m) => (m[glbKey] === url ? m : { ...m, [glbKey]: url }));
    });
    return () => {
      alive = false;
    };
  }, [variant, paint, glbKey]);
  const src = glbSrc[glbKey] ?? syncSrc;
  const fallbackPaint = paint ?? '#d9d9d4';
  if (src) {
    return <img src={src} alt="پیش‌نمایش خودرو" className={className} draggable={false} />;
  }
  return (
    <div
      className={`flex items-center justify-center ${className ?? ""}`}
      style={{ background: `linear-gradient(135deg, ${fallbackPaint} 0%, ${fallbackPaint}bb 55%, #3a2e2a 135%)` }}
    >
      <Car className="h-10 w-10 text-white/85" />
    </div>
  );
}

// ==================== 🔑 v0.2.44 — سرعت‌سنج عقربه‌ای فشرده (پایین صفحه — دیگر جلوی دید نیست) ====================
const GAUGE_MAX = 180;

function gaugePolar(ang: number, rad: number): [number, number] {
  const t = ((ang - 90) * Math.PI) / 180; // ۰ درجه = بالا
  return [60 + rad * Math.cos(t), 58 + rad * Math.sin(t)];
}
function gaugeArc(a1: number, a2: number, rad: number): string {
  const [x1, y1] = gaugePolar(a1, rad);
  const [x2, y2] = gaugePolar(a2, rad);
  const large = Math.abs(a2 - a1) > 180 ? 1 : 0;
  return `M ${x1.toFixed(1)} ${y1.toFixed(1)} A ${rad} ${rad} 0 ${large} 1 ${x2.toFixed(1)} ${y2.toFixed(1)}`;
}

/** پیکان ۲۲۰° (۱۱۰- تا ۱۱۰+) — هندسهٔ بدون بریدگی؛ w = پهنای کل پنل */
function SpeedGauge({ kmh, w = 112 }: { kmh: number; w?: number }) {
  const frac = Math.max(0, Math.min(1, kmh / GAUGE_MAX));
  const ang = -110 + frac * 220;
  return (
    <div className="fc-panel bg-[#FFF9EC]/88 px-1.5 pb-0.5 pt-1" style={{ borderRadius: "999px", width: w }}>
      <svg width={w - 12} height={((w - 12) * 74) / 120} viewBox="0 0 120 74" aria-hidden="true">
        {/* قوس زمینه */}
        <path d={gaugeArc(-110, 110, 40)} fill="none" stroke="#eadfc6" strokeWidth="9" strokeLinecap="round" />
        {/* ناحیهٔ خطر: ۱۵۰ به بالا */}
        <path d={gaugeArc(73, 110, 40)} fill="none" stroke="#e8b6b6" strokeWidth="9" strokeLinecap="round" />
        {/* قوس سرعت فعلی */}
        {frac > 0.005 && <path d={gaugeArc(-110, ang, 40)} fill="none" stroke="#2A9D8F" strokeWidth="9" strokeLinecap="round" />}
        {/* تیک‌ها */}
        {[-110, -55, 0, 55, 110].map((a) => {
          const [x1, y1] = gaugePolar(a, 26);
          const [x2, y2] = gaugePolar(a, 32);
          return <line key={a} x1={x1} y1={y1} x2={x2} y2={y2} stroke="#3a2e2a" strokeWidth="2" opacity="0.45" strokeLinecap="round" />;
        })}
        {/* عقربه — بین آپدیت‌های HUD نرم حرکت می‌کند */}
        <g className="fc-needle" style={{ transform: `rotate(${ang}deg)`, transformOrigin: "60px 58px" }}>
          <line x1="60" y1="62" x2="60" y2="26" stroke="#D64545" strokeWidth="4" strokeLinecap="round" />
        </g>
        <circle cx="60" cy="58" r="5.5" fill="#3a2e2a" />
      </svg>
      <div className="-mt-1 text-center text-[14px] font-black leading-4 text-[#3a2e2a]">{fa(kmh)}</div>
      <div className="text-center text-[8px] font-bold leading-2.5 text-[#3a2e2a]/50">km/h</div>
    </div>
  );
}

// ==================== 🔑 v0.2.43 — کاغذرنگی موفقیت ====================
function Confetti() {
  const pieces = useMemo(() => {
    const colors = ["#F2B705", "#8AC926", "#2A9D8F", "#D64545", "#5b8dd9", "#e07be0"];
    return Array.from({ length: 26 }, (_, i) => ({
      id: i,
      left: Math.random() * 100,
      delay: Math.random() * 0.9,
      dur: 1.7 + Math.random() * 1.5,
      color: colors[i % colors.length],
      w: 6 + Math.random() * 6,
    }));
  }, []);
  return (
    <div className="pointer-events-none absolute inset-0 overflow-hidden" aria-hidden="true">
      {pieces.map((p) => (
        <span
          key={p.id}
          className="fc-confetti-piece"
          style={{ left: `${p.left}%`, backgroundColor: p.color, width: p.w, height: p.w * 1.6, animationDelay: `${p.delay}s`, animationDuration: `${p.dur}s` }}
        />
      ))}
    </div>
  );
}

// ==================== 🔑 v0.2.44 — توست گفتار بازیکن (بالای صفحه، جای حباب وسط کانواس) ====================
function SayToast({ say }: { say: { line: string; speaker: string; portrait: string } }) {
  const [imgOk, setImgOk] = useState(true);
  const entry = ASSETS_MANIFEST[say.portrait];
  const src = entry ? `/${entry.src}` : null; // همان قاعدهٔ AssetManager: از ریشهٔ سایت
  return (
    <div
      className="fc-panel fc-pop flex max-w-[min(320px,64vw)] items-center gap-2 bg-[#FFF9EC]/95 py-1 pl-2.5 pr-1.5"
      style={{ borderRadius: "999px" }}
    >
      {imgOk && src ? (
        <img
          src={src}
          alt=""
          className="h-7 w-7 shrink-0 rounded-full border-2 border-[#3a2e2a] object-cover"
          onError={() => setImgOk(false)}
        />
      ) : (
        <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full border-2 border-[#3a2e2a] bg-[#E8C39E] text-[13px]">🚕</span>
      )}
      <p dir="rtl" className="truncate text-[11px] font-extrabold leading-5 text-[#3a2e2a]">{say.line}</p>
    </div>
  );
}

// ==================== 🔑 v0.2.43 — مدال چرخش سه‌بعدی خودرو ====================
interface SpinCarData {
  id: string;
  variant: string;
  name: string;
  paint: string | null;
  owned: boolean;
  selected: boolean;
  price: number;
}

function SpinModal({ car, coins, colors, onClose, onBuy, onChooseColor }: {
  car: SpinCarData;
  coins: number;
  colors: string[];
  onClose: () => void;
  onBuy: () => void;
  onChooseColor: (hex: string) => void;
}) {
  const [frames, setFrames] = useState<(string | null)[]>(() => new Array(SPIN_STEPS).fill(null));
  const [yaw, setYaw] = useState(0);
  const dragRef = useRef<{ x: number; yaw: number } | null>(null);

  useEffect(() => {
    let alive = true;
    renderCarPreviewSpin(car.variant as CarVariant, car.paint).then((f) => {
      if (alive && f) setFrames(f);
    });
    return () => {
      alive = false;
    };
  }, [car.variant, car.paint]);

  const idx = ((Math.round(yaw) % SPIN_STEPS) + SPIN_STEPS) % SPIN_STEPS;
  const src = frames[idx] ?? frames[0] ?? null;
  const affordable = coins >= car.price;
  const ready = frames.some(Boolean);

  return (
    <div className="absolute inset-0 z-50 flex items-center justify-center bg-[#201914]/88 px-5" onClick={onClose}>
      <div className="fc-pop fc-panel w-full max-w-sm bg-[#FFF9EC] p-4" onClick={(e) => e.stopPropagation()}>
        <div className="mb-2 flex items-center justify-between">
          <span className="text-lg font-extrabold text-[#3a2e2a]">{car.name}</span>
          <TapButton ariaLabel="بستن پیش‌نمایش" className="h-9 w-9 bg-[#D64545] text-white" onTap={onClose}>
            <X className="h-5 w-5" />
          </TapButton>
        </div>

        {/* صحنهٔ چرخش — بکش تا بچرخه */}
        <div
          className="relative mx-auto flex h-44 w-full cursor-grab touch-none items-center justify-center overflow-hidden rounded-2xl border border-[#3a2e2a]/15 active:cursor-grabbing"
          style={{ background: "radial-gradient(ellipse at 50% 62%, #f7efdc 0%, #eadfc4 55%, #d8c8a3 100%)" }}
          onPointerDown={(e) => {
            e.preventDefault();
            try {
              (e.currentTarget as HTMLElement).setPointerCapture?.(e.pointerId);
            } catch {
              /* اشاره‌گر synthestick/آزادشده — بی‌خطر */
            }
            dragRef.current = { x: e.clientX, yaw };
          }}
          onPointerMove={(e) => {
            if (!dragRef.current) return;
            const dx = e.clientX - dragRef.current.x;
            setYaw(dragRef.current.yaw - dx * 0.045);
          }}
          onPointerUp={() => {
            dragRef.current = null;
          }}
          onPointerCancel={() => {
            dragRef.current = null;
          }}
        >
          {src ? (
            <img src={src} alt={`چرخش ${car.name}`} className="h-full w-auto max-w-full object-contain" draggable={false} />
          ) : (
            <div className="flex flex-col items-center gap-2">
              <Loader2 className={`h-7 w-7 text-[#2A9D8F] ${ready ? "" : "animate-spin"}`} />
              <span className="text-[11px] font-bold text-[#3a2e2a]/60">
                {ready ? "فریم بعدی داره میاد..." : "داریم ماشین رو میاریم تو نور..."}
              </span>
            </div>
          )}
          <span className="pointer-events-none absolute bottom-1.5 left-1/2 -translate-x-1/2 rounded-full bg-[#3a2e2a]/75 px-2.5 py-0.5 text-[9px] font-extrabold text-white">
            انگشتت رو بکش تا بچرخه
          </span>
        </div>

        {/* نشانگر فریم‌ها */}
        <div className="mt-2 flex items-center justify-center gap-1">
          {frames.map((f, i) => (
            <span key={i} className={`h-1.5 w-1.5 rounded-full ${i === idx ? "bg-[#F2B705]" : f ? "bg-[#3a2e2a]/25" : "bg-[#3a2e2a]/10"}`} />
          ))}
        </div>

        {/* رنگ‌های کارخانه‌ای — زنده روی مدل */}
        {colors.length > 1 && (
          <div className="mt-2 flex flex-wrap items-center justify-center gap-1.5">
            {colors.map((hex) => (
              <button
                key={hex}
                type="button"
                aria-label={`رنگ ${hex}`}
                className={`h-7 w-7 rounded-full border-2 ${car.paint === hex ? "border-[#3a2e2a] ring-2 ring-[#F2B705]" : "border-[#3a2e2a]/25"}`}
                style={{ backgroundColor: hex }}
                onClick={() => onChooseColor(hex)}
              />
            ))}
            <span className="text-[10px] font-bold text-[#3a2e2a]/55">رنگ بدنه</span>
          </div>
        )}

        <div className="mt-3 flex items-center gap-2">
          <button
            type="button"
            disabled={car.selected}
            className={`fc-btn flex-1 rounded-2xl py-2.5 text-sm font-extrabold ${
              car.selected
                ? "bg-[#3a2e2a]/10 text-[#3a2e2a]/60"
                : car.owned
                  ? "bg-[#8AC926] text-[#3a2e2a]"
                  : affordable
                    ? "bg-[#F2B705] text-[#3a2e2a]"
                    : "bg-[#FFF3D6] text-[#3a2e2a]/60"
            }`}
            onClick={() => {
              if (!car.selected) onBuy();
            }}
          >
            {car.selected ? "ماشین فعلی ✓" : car.owned ? "انتخاب این ماشین" : <><Coins className="h-4 w-4" /> {fa(car.price)} سکه — خرید</>}
          </button>
          <button type="button" className="fc-btn rounded-2xl bg-[#D64545] px-4 py-2.5 text-sm font-extrabold text-white" onClick={onClose}>
            بستن
          </button>
        </div>
        <p className="mt-1.5 text-center text-[10px] font-bold leading-4 text-[#3a2e2a]/55">
          مدل واقعی سه‌بعدی — بچرخونش، رنگ عوض کن، بعد بخر!
        </p>
      </div>
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

/** عنوان و توضیح هر دسته مأموریت (فاز ۵ + بی‌پایان v0.2.40) */
const CATEGORY_FA: Record<MissionCategory, { title: string; hint: string }> = {
  story: { title: "مأموریت‌ها", hint: "زنجیره «شاگردی عمو نقی» هم اینجاست — هر مرحله، مرحله بعد را باز می‌کند!" },
  park: { title: "پارک دوبل", hint: "دنده‌عقب برو تو جای پارک، تراز وایسا، ترمز! هر دو جهت قبوله" },
  taxi: { title: "مسافرکشی", hint: "وایسا سر جای سوارشدن، بعد برسون مقصد — سریع برسی انعام هم داره!" },
  challenge: { title: "چالش‌ها", hint: "چالش سخت‌تر، جایزه بزرگ‌تر — آبروی راننده توی اینه!" },
  endless: { title: "مأموریت‌های بی‌پایان", hint: "هر بار مأموریت تازه ساخته می‌شه؛ هیچ‌وقت تموم نمی‌شه و تکراری هم نیست!" },
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
  /** 🔑 v0.2.43 — مقدار قبلی HUD برای افکت سکه/ضربه */
  const prevCoinsRef = useRef<number | null>(null);
  const prevHealthRef = useRef<number | null>(null);

  /** نمونه بازی در state برای رندر امن React (gameRef فقط در event handlerها استفاده می‌شود) */
  const [game, setGame] = useState<GameInstance | null>(null);

  const [phase, setPhase] = useState<GameState | "boot">("boot");
  const [bootError, setBootError] = useState<string | null>(null);
  const [bootProgress, setBootProgress] = useState(0);
  const isAndroidBuild = process.env.NEXT_PUBLIC_ANDROID_BUILD === "1";
  const [hud, setHud] = useState<HudData>({ speedKmh: 0, coins: 0, reputation: 50, fps: 60, showFps: false, placeholders: 0, mission: null, health: 100, engineDead: false, chase: null, say: null });
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
  /** بازار (v0.2.39): پیش‌نمایش رنگ/بوق قبل از خرید — بدون پرداخت */
  const [previewPaintId, setPreviewPaintId] = useState<string | null>(null);
  const [previewHornId, setPreviewHornId] = useState<string | null>(null);
  /** 🔑 v0.2.41 — رنگ کارخانه‌ای انتخابی هر خودرو در نمایشگاه (id → hex) */
  const [chosenColors, setChosenColors] = useState<Record<string, string>>({});
  /** 🔑 v0.2.43 — تنظیمات کنترل لمسی (اندازه/شفافیت/چپ‌دست/ویبره) */
  const [ui, setUi] = useState<UiPrefs>({ controlsScale: 1, controlsOpacity: 1, leftHanded: false, vibration: true });
  /** v0.2.43 — تب فروشگاه: همه / مال من / خریدنی */
  const [garageTab, setGarageTab] = useState<"all" | "owned" | "shop">("all");
  /** v0.2.43 — مدال چرخش سه‌بعدی خودرو */
  const [spinCar, setSpinCar] = useState<SpinCarData | null>(null);
  /** v0.2.43 — آموزش سه‌قدمی: ۰=گاز، ۱=فرمان، ۲=بوق؛ null=خاموش */
  const [tutStep, setTutStep] = useState<number | null>(null);
  /** v0.2.43 — جملهٔ لودینگ طنز */
  const [loadLineIdx, setLoadLineIdx] = useState(0);
  /** v0.2.43 — افکت سکه پران و وینیت ضربه */
  const [coinFx, setCoinFx] = useState<Array<{ id: number; delta: number }>>([]);
  const [hitFxKey, setHitFxKey] = useState(0);

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

  /** 🔑 v0.2.43 — تغییر تنظیمات کنترل لمسی + اعمال فوری + ذخیره در موتور */
  const changeUi = useCallback((p: Partial<UiPrefs>) => {
    setUi((prev) => {
      const next = { ...prev, ...p };
      setHapticsEnabled(next.vibration);
      return next;
    });
    gameRef.current?.setUiPrefs(p);
  }, []);

  // ---------- v0.2.43 — آموزش سه‌قدمی ----------
  const finishTutorial = useCallback(() => {
    setTutStep(null);
    try {
      window.localStorage.setItem("fc_tutorial_done", "1");
    } catch {
      /* بی‌خطر */
    }
  }, []);
  const replayTutorial = useCallback(() => {
    try {
      window.localStorage.removeItem("fc_tutorial_done");
    } catch {
      /* بی‌خطر */
    }
    setTutStep(0);
  }, []);
  const advanceTutorial = useCallback((step: number) => {
    setTutStep((cur) => {
      if (cur !== step) return cur;
      if (cur >= 2) {
        try {
          window.localStorage.setItem("fc_tutorial_done", "1");
        } catch {
          /* بی‌خطر */
        }
        return null;
      }
      return cur + 1;
    });
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
        // 🔑 v0.2.43 — افکت سکه پران + وینیت ضربه، همین‌جا کنار HUD (بدون setState در useEffect)
        onHud: (h) => {
          const pc = prevCoinsRef.current;
          if (pc !== null && h.coins !== pc) {
            const id = Date.now() + Math.random();
            setCoinFx((l) => [...l.slice(-2), { id, delta: h.coins - pc }]);
            setTimeout(() => setCoinFx((l) => l.filter((c) => c.id !== id)), 1100);
          }
          prevCoinsRef.current = h.coins;
          const ph = prevHealthRef.current;
          if (ph !== null && h.health < ph) {
            setHitFxKey((k) => k + 1);
            if (ph - h.health >= 6) {
              const el = canvasRef.current;
              if (el) {
                el.classList.remove("fc-shake");
                void el.offsetWidth;
                el.classList.add("fc-shake");
                setTimeout(() => el.classList.remove("fc-shake"), 400);
              }
            }
          }
          prevHealthRef.current = h.health;
          setHud(h);
        },
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
      // 🔑 v0.2.43 — بارگذاری تنظیمات کنترل لمسی + آموزش بار اول
      const st = inst.getSettings();
      setUi({ controlsScale: st.controlsScale, controlsOpacity: st.controlsOpacity, leftHanded: st.leftHanded, vibration: st.vibration });
      setHapticsEnabled(st.vibration);
      try {
        setTutStep(window.localStorage.getItem("fc_tutorial_done") === "1" ? null : 0);
      } catch {
        setTutStep(0);
      }
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

  // ---------- v0.2.43 — جمله‌های لودینگ طنز (فقط حین بوت) ----------
  useEffect(() => {
    if (phase !== "boot") return;
    const t = setInterval(() => setLoadLineIdx((i) => i + 1), 2400);
    return () => clearInterval(t);
  }, [phase]);

  // ---------- v0.2.43 — آموزش با کیبورد هم جلو برود (WASD/H) ----------
  useEffect(() => {
    if (tutStep === null) return;
    const onKey = (e: KeyboardEvent) => {
      const k = e.key.toLowerCase();
      if (tutStep === 0 && (k === "w" || k === "arrowup")) advanceTutorial(0);
      else if (tutStep === 1 && (k === "a" || k === "d" || k === "arrowleft" || k === "arrowright")) advanceTutorial(1);
      else if (tutStep === 2 && k === "h") advanceTutorial(2);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [tutStep, advanceTutorial]);

  // ---------- فرمان ترکیبی (چپ+راست هم‌زمان = مستقیم) ----------
  const applySteer = useCallback(() => {
    const { left, right } = steerRef.current;
    gameRef.current?.setVirtualSteer(left === right ? 0 : right ? 1 : -1);
  }, []);
  const steerLeft = useCallback(
    (down: boolean) => {
      steerRef.current.left = down;
      applySteer();
      if (down) advanceTutorial(1); // v0.2.43 — آموزش قدم ۲
    },
    [applySteer, advanceTutorial],
  );
  const steerRight = useCallback(
    (down: boolean) => {
      steerRef.current.right = down;
      applySteer();
      if (down) advanceTutorial(1); // v0.2.43 — آموزش قدم ۲
    },
    [applySteer, advanceTutorial],
  );

  const repColor = hud.reputation >= 70 ? "#8AC926" : hud.reputation >= 35 ? "#F2B705" : "#D64545";
  const healthColor = hud.health >= 60 ? "#8AC926" : hud.health >= 30 ? "#F2B705" : "#D64545";
  const towCostLabel = hud.coins >= 30 ? "−۳۰ سکه" : "رایگان — رفیق مکانیکی!";
  /** 🔑 v0.2.43 — متغیر CSS ضریب اندازهٔ دکمه‌ها */
  const csStyle = { ["--fcCs"]: String(ui.controlsScale) } as React.CSSProperties;
  // ---------- v0.2.43 — هندسهٔ کنترل‌ها: اگر خوشه‌ها در عرض جا نشوند، چیدمان پله‌ای ----------
  const [vp, setVp] = useState<{ w: number; h: number } | null>(null);
  useEffect(() => {
    const upd = () => setVp({ w: window.innerWidth, h: window.innerHeight });
    upd();
    window.addEventListener("resize", upd);
    return () => window.removeEventListener("resize", upd);
  }, []);
  // ---------- 🔑 v0.2.44 — هندسهٔ کنترل‌ها: مقیاس-آگاه + رزرو فضای سرعت‌سنج ----------
  const geom = (() => {
    const W = vp?.w ?? 390;
    const H = vp?.h ?? 844;
    const sc = ui.controlsScale;
    const cp = (min: number, frac: number, max: number) => Math.min(max, Math.max(min, H * frac));
    const steer1 = cp(84, 0.19, 124);
    const gas1 = cp(94, 0.21, 134);
    const brake1 = cp(76, 0.17, 108);
    const horn1 = cp(58, 0.13, 84);
    const edge = Math.min(20, Math.max(10, W * 0.025));
    // ضریب اندازه در «جا شدن» لحاظ می‌شود + دست‌کم ۱۲۶px وسط برای سرعت‌سنج آزاد می‌ماند
    const rowW = (steer1 * 2 + 14 + brake1 + 12 + gas1 + edge * 2) * sc;
    const stacked = rowW + 126 > W;
    const pedalH = Math.max(gas1, horn1 + 10 + brake1);
    // پهنای خوشهٔ هم‌سمت در چیدمان پله‌ای (پدال+فرمان یک طرف‌اند) → گوشهٔ دیگر آزاد است
    const sideW = Math.max(steer1 * 2 + 14, brake1 + 12 + gas1) * sc;
    const cornerFree = W - sideW - edge * 2;
    // 🔑 v0.2.44 — سه حالت: وسط-پایین (عادی) / گوشهٔ آزاد (پله‌ای) / بالای خوشه (پورت‌ریت با دکمه‌های خیلی بزرگ)
    const mode = !stacked ? "center" : cornerFree >= 84 ? "corner" : "raised";
    const gaugeW = mode === "center" ? 112 : mode === "corner" ? Math.max(76, Math.min(112, cornerFree - 8)) : 84;
    return { stacked, steer1, pedalH, edge, gaugeW, gaugeMode: mode };
  })();

  // 🔑 v0.2.44 — پهنای مینی‌مپ (مطابق drawMinimap در WorldRenderer3D) برای اسپیسر نوار بالا
  const mmSize = Math.min(112, (vp?.w ?? 390) * 0.24);

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
            {/* v0.2.43 — جمله‌های لودینگ طنز */}
            <p className="max-w-[250px] text-center text-[11px] font-bold leading-5 text-[#3a2e2a]/65">
              «{LOADING_LINES[loadLineIdx % LOADING_LINES.length]}»
            </p>
          </div>
        </div>
      )}

      {/* ============ منوی اصلی ============ */}
      {phase === "menu" && (
        <div className="absolute inset-0 z-30 flex flex-col overflow-y-auto overscroll-y-contain touch-pan-y bg-gradient-to-b from-[#3a2e2a]/10 via-transparent to-[#3a2e2a]/55">
          <div className="fc-pop mx-auto flex min-h-full w-full max-w-md shrink-0 flex-col items-center justify-start gap-5 px-6 py-8 sm:justify-center">
            {/* لوگو */}
            <div className="fc-rise flex flex-col items-center gap-2">
              <div className="fc-btn flex h-20 w-20 items-center justify-center rounded-3xl bg-[#F2B705]">
                <Car className="h-11 w-11 text-[#3a2e2a]" strokeWidth={2.4} />
              </div>
              <h1 className="mt-2 text-5xl font-extrabold text-white drop-shadow-[0_4px_0_rgba(58,46,42,0.9)]">فانی‌کار</h1>
              <p className="text-sm font-bold text-white/90 drop-shadow-[0_2px_0_rgba(58,46,42,0.7)]">
                آبرو می‌بری یا می‌ریزی؟
              </p>
            </div>

            {/* آمار بازیکن */}
            <div className="fc-rise flex items-center gap-3" style={{ animationDelay: "60ms" }}>
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
              className="fc-btn fc-rise w-full max-w-xs rounded-3xl bg-[#8AC926] py-4 text-2xl font-extrabold text-[#3a2e2a]"
              style={{ animationDelay: "120ms" }}
              onClick={() => {
                gameRef.current?.startGameplay();
              }}
            >
              رانندگی آزاد
            </button>

            {/* حالت‌های بازی — فاز ۵: همه فعال! */}
            {/* v0.2.40 — دسترسی سریع: یک ضربه، مأموریت بعدی */}
            <button
              type="button"
              className="fc-btn fc-rise flex w-full max-w-xs items-center justify-center gap-2 rounded-2xl bg-[#DDF5B4] py-3 text-lg font-extrabold text-[#3a2e2a] shadow-[0_0_0_2px_rgba(58,46,42,0.15)]"
              style={{ animationDelay: "170ms" }}
              onClick={() => {
                const nid = gameRef.current?.nextMissionId();
                if (nid) gameRef.current?.startMission(nid);
              }}
            >
              <Play className="h-5 w-5" />
              مأموریت بعدی
              <ChevronRight className="h-5 w-5" />
            </button>
            <div className="fc-rise grid w-full max-w-xs grid-cols-2 gap-3" style={{ animationDelay: "220ms" }}>
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

            {/* v0.2.40 — مأموریت‌های بی‌پایان: همیشه تازه، هیچ‌وقت تموم نمی‌شن */}
            <button
              type="button"
              className="fc-btn fc-rise flex w-full max-w-xs items-center justify-center gap-2 rounded-2xl bg-[#2A9D8F] py-3 text-lg font-extrabold text-white"
              style={{ animationDelay: "270ms" }}
              onClick={() => {
                setMissionFilter("endless");
                setMissions(gameRef.current?.listMissions("endless") ?? []);
                setShowMissions(true);
              }}
            >
              <InfinityIcon className="h-5 w-5" />
              مأموریت‌های بی‌پایان
              <span className="rounded-full bg-white/20 px-2 py-0.5 text-[10px] font-extrabold">جدید</span>
            </button>

            {/* گاراژ عمو نقی (فاز ۶) */}
            <button
              type="button"
              className="fc-btn fc-rise flex w-full max-w-xs items-center justify-center gap-2 rounded-2xl bg-[#F2B705] py-3 text-lg font-extrabold text-[#3a2e2a]"
              style={{ animationDelay: "320ms" }}
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
                {game && <SettingsPanel game={game} ui={ui} onChangeUi={changeUi} onReplayTutorial={replayTutorial} />}
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
                {missionFilter === "park" ? <Target className="h-7 w-7 text-[#F2B705]" /> : missionFilter === "taxi" ? <Users className="h-7 w-7 text-[#F2B705]" /> : missionFilter === "challenge" ? <PartyPopper className="h-7 w-7 text-[#F2B705]" /> : missionFilter === "endless" ? <InfinityIcon className="h-7 w-7 text-[#F2B705]" /> : <Map className="h-7 w-7 text-[#F2B705]" />}
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
            {/* 🔑 v0.2.43 — تب‌های فروشگاه: همه / مال من / خریدنی */}
            <div className="flex items-center gap-1.5">
              {(["all", "owned", "shop"] as const).map((k) => (
                <button
                  key={k}
                  type="button"
                  className={`fc-btn flex-1 rounded-xl py-1.5 text-[11px] font-extrabold ${
                    garageTab === k ? "bg-[#F2B705] text-[#3a2e2a]" : "bg-[#FFF9EC] text-[#3a2e2a]/70"
                  }`}
                  onClick={() => setGarageTab(k)}
                >
                  {k === "all" ? "همه" : k === "owned" ? "مال من" : "خریدنی"}
                </button>
              ))}
            </div>
            {(() => {
              const visible = garage.vehicles.filter((v) =>
                garageTab === "all" ? true : garageTab === "owned" ? v.owned : !v.owned,
              );
              if (visible.length > 0) return null;
              return (
                <p className="fc-panel bg-[#FFF9EC] p-4 text-center text-xs font-bold leading-5 text-[#3a2e2a]/60">
                  {garageTab === "owned"
                    ? "هنوز ماشینی نخریدی! برو تو تب «خریدنی» یه گزینه بزن."
                    : "همه ماشین‌ها مال تو شدن — آفرین قهرمان!"}
                </p>
              );
  })()}
            <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
              {garage.vehicles
                .filter((v) => (garageTab === "all" ? true : garageTab === "owned" ? v.owned : !v.owned))
                .map((v) => {
                const affordable = garage.coins >= v.price;
                const palette = v.colors ?? ['#f4f4f0'];
                return (
                  <div key={v.id} className={`fc-panel p-3 ${v.selected ? "bg-[#DDF5B4]" : "bg-[#FFF9EC]"}`}>
                    {/* 🔑 v0.2.43 — دکمه چرخش سه‌بعدی روی پیش‌نمایش */}
                    <div className="relative">
                      <CarPreviewImg
                        variant={v.variant}
                        paint={chosenColors[v.id] ?? (v.selected ? (garage.paints.find((p) => p.selected)?.hex ?? null) : null)}
                        className="h-24 w-full rounded-xl border border-[#3a2e2a]/10 object-cover"
                      />
                      <button
                        type="button"
                        aria-label={`چرخاندن ${v.name}`}
                        className="fc-btn absolute bottom-1.5 left-1.5 flex h-8 w-8 items-center justify-center rounded-full bg-[#3a2e2a]/85 text-white"
                        style={{ borderWidth: 3 }}
                        onClick={() =>
                          setSpinCar({
                            id: v.id,
                            variant: v.variant,
                            name: v.name,
                            paint: chosenColors[v.id] ?? (v.selected ? (garage.paints.find((p) => p.selected)?.hex ?? null) : null),
                            owned: v.owned,
                            selected: v.selected,
                            price: v.price,
                          })
                        }
                      >
                        <RotateCw className="h-4 w-4" />
                      </button>
                    </div>
                    {/* 🔑 v0.2.41 — رنگ‌های کارخانه‌ای: خریدار رنگ بدنه را انتخاب می‌کند */}
                    {palette.length > 1 && (
                      <div className="mt-2 flex flex-wrap items-center gap-1.5">
                        {palette.map((hex) => {
                          const active = (chosenColors[v.id] ?? palette[0]) === hex;
                          return (
                            <button
                              key={hex}
                              type="button"
                              aria-label={`رنگ ${hex}`}
                              className={`h-6 w-6 rounded-full border-2 ${active ? "border-[#3a2e2a] ring-2 ring-[#F2B705]" : "border-[#3a2e2a]/25"}`}
                              style={{ backgroundColor: hex }}
                              onClick={() => setChosenColors((m) => ({ ...m, [v.id]: hex }))}
                            />
                          );
                        })}
                        <span className="text-[10px] font-bold text-[#3a2e2a]/55">رنگ بدنه</span>
                      </div>
                    )}
                    <div className="mt-2 flex items-start gap-2">
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
                        purchase(() => v.owned ? gameRef.current!.selectVehicle(v.id) : gameRef.current!.buyVehicle(v.id, chosenColors[v.id]));
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

            {/* رنگ‌ها — اول ببین، بعد بخر! (v0.2.39) */}
            <p className="mt-1 flex items-center gap-1.5 text-xs font-bold text-white/80">
              <Car className="h-4 w-4" /> رنگ ماشین — بزن روی رنگ، همین‌جا ببینش؛ بعد خرید کن:
            </p>
            {(() => {
              const selVehicle = garage.vehicles.find((v) => v.selected) ?? garage.vehicles[0];
              const selPaint = garage.paints.find((p) => p.selected);
              const previewPaint = previewPaintId ? (garage.paints.find((p) => p.id === previewPaintId) ?? selPaint) : selPaint;
              const previewHex = previewPaint?.hex ?? "#f4f4f0";
              const buyLabel = previewPaint?.selected
                ? "وصل شد ✓"
                : previewPaint?.owned
                  ? "انتخاب این رنگ"
                  : `خرید رنگ — ${fa(previewPaint?.price ?? 0)} سکه`;
              return (
                <div className="fc-panel rounded-2xl bg-[#FFF9EC] p-2.5">
                  <div className="flex items-center gap-2.5">
                    <CarPreviewImg
                      variant={selVehicle.variant}
                      paint={previewHex}
                      className="h-20 w-32 shrink-0 rounded-xl border border-[#3a2e2a]/15 object-cover"
                    />
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-extrabold text-[#3a2e2a]">{previewPaint?.name ?? "سفید شوخی"}</p>
                      <p className="text-[10px] font-bold leading-4 text-[#3a2e2a]/65">روی «{selVehicle.name}» — ببین، بعد بخر!</p>
                    </div>
                    <button
                      type="button"
                      disabled={!!previewPaint?.selected}
                      className={`fc-btn shrink-0 rounded-xl px-3 py-2 text-[11px] font-extrabold ${
                        previewPaint?.selected
                          ? "bg-[#3a2e2a]/10 text-[#3a2e2a]/50"
                          : previewPaint?.owned
                            ? "bg-[#8AC926] text-[#3a2e2a]"
                            : "bg-[#F2B705] text-[#3a2e2a]"
                      }`}
                      onClick={() => {
                        if (!previewPaint || previewPaint.selected) return;
                        purchase(() =>
                          previewPaint.owned
                            ? gameRef.current!.selectPaint(previewPaint.id)
                            : gameRef.current!.buyPaint(previewPaint.id),
                        );
                        setPreviewPaintId(null);
                      }}
                    >
                      {buyLabel}
                    </button>
                  </div>
                </div>
              );
            })()}
            <div className="grid grid-cols-4 gap-2">
              {garage.paints.map((p) => (
                <button
                  key={p.id}
                  type="button"
                  title={`${p.name}${p.owned ? "" : ` — ${fa(p.price)} سکه`}`}
                  className={`fc-btn flex flex-col items-center gap-1 rounded-2xl p-2 ${
                    previewPaintId === p.id
                      ? "bg-[#F2B705]"
                      : p.selected
                        ? "bg-[#8AC926]"
                        : "bg-[#FFF9EC]"
                  }`}
                  onClick={() => setPreviewPaintId(p.id)}
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

            {/* بوق‌ها — بزن بشنوی، بعد بخر! (v0.2.39: کلیک = صدا، خرید = دکمه) */}
            <p className="mt-2 flex items-center gap-1.5 text-xs font-bold text-white/80">
              <Megaphone className="h-4 w-4" /> بوق‌ها — روی هر بوق بزن تا صداش رو بشنوی، بعد خرید کن:
            </p>
            <div className="grid grid-cols-2 gap-2">
              {garage.horns.map((h) => (
                <div
                  key={h.id}
                  role="button"
                  tabIndex={0}
                  title={`${h.desc} — بزن بشنوی`}
                  className={`fc-btn flex cursor-pointer items-center gap-2 rounded-2xl p-2.5 text-right ${
                    h.selected ? "bg-[#8AC926]" : previewHornId === h.id ? "bg-[#F2B705]" : "bg-[#FFF9EC]"
                  }`}
                  onClick={() => {
                    setPreviewHornId(h.id);
                    gameRef.current?.previewHorn(h.id);
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
                    <span className="block truncate text-sm font-extrabold text-[#3a2e2a]">
                      {h.name}
                    </span>
                    <span className="block text-[10px] font-bold leading-3.5 text-[#3a2e2a]/60">
                      {h.owned ? (h.selected ? "وصل شد ✓" : "خریده‌شده") : `${fa(h.price)} سکه`}
                    </span>
                    {!h.selected && (
                      <button
                        type="button"
                        className={`fc-btn mt-1 w-full rounded-lg py-1 text-[10px] font-extrabold ${
                          h.owned ? "bg-[#8AC926] text-[#3a2e2a]" : "bg-[#FFF3D6] text-[#3a2e2a]"
                        }`}
                        onClick={(e) => {
                          e.stopPropagation();
                          purchase(() => h.owned ? gameRef.current!.selectHorn(h.id) : gameRef.current!.buyHorn(h.id));
                        }}
                      >
                        {h.owned ? "وصل کن ✓" : "خرید"}
                      </button>
                    )}
                  </span>
                  {!h.owned && <Lock className="h-4 w-4 shrink-0 text-[#3a2e2a]/40" />}
                </div>
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
          {/* 🔑 v0.2.44 — نوار بالا بازچینی شد: چپ=توقف+وضعیت، وسط=تعقیب/مأموریت/گفتار/آموزش — هیچ پنلی جلوی دید رانندگی نیست */}
          <div dir="ltr" className="pointer-events-none absolute inset-x-0 top-0 z-20 flex items-start justify-between gap-2 p-3">
            <div className="flex flex-col items-start gap-1.5">
              <div className="pointer-events-auto">
                <TapButton ariaLabel="توقف بازی" className="h-10 w-10 bg-[#FFF9EC] text-[#3a2e2a]" onTap={() => gameRef.current?.pause()}>
                  <Pause className="h-5 w-5" />
                </TapButton>
              </div>
              <div className="fc-panel relative flex items-center gap-1.5 bg-[#FFF9EC]/95 px-2 py-1">
                <Coins className="h-4 w-4 text-[#B8801A]" />
                <span key={hud.coins} className="fc-pop text-[11px] font-bold text-[#3a2e2a]">{fa(hud.coins)}</span>
                {/* سکه پران +۱۲ / −۸ */}
                {coinFx.map((c) => (
                  <span
                    key={c.id}
                    className={`fc-coin-fly absolute -top-1 left-1/2 -translate-x-1/2 text-[12px] font-black ${c.delta > 0 ? "text-[#5c9e1f]" : "text-[#D64545]"}`}
                  >
                    {c.delta > 0 ? `+${fa(c.delta)}` : `−${fa(-c.delta)}`}
                  </span>
                ))}
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
              {hud.showFps && (
                <div className="fc-panel bg-[#3a2e2a]/85 px-2 py-0.5">
                  <span className="text-[10px] font-bold text-white">FPS: {fa(hud.fps)}</span>
                </div>
              )}
            </div>
            {/* ستون وسط: تعقیب → مأموریت → گفتار → آموزش (همه موقتی/کوچک) */}
            <div className="flex min-w-0 flex-col items-center gap-1.5">
              {/* v0.2.42 — بج تعقیب: پلیس/تاکسی عصبانی */}
              {hud.chase && (
                <div
                  className="fc-panel flex w-[188px] flex-col gap-1 border-2 p-2"
                  style={{
                    borderColor: hud.chase.kind === "police" ? "#5b8dd9" : "#e8a33d",
                    background: hud.chase.kind === "police" ? "rgba(91,141,217,0.14)" : "rgba(232,163,61,0.14)",
                    animation: "fcPulse 0.9s ease-in-out infinite",
                  }}
                >
                  <div className="flex items-center gap-1.5">
                    <Siren className="h-4 w-4 shrink-0" style={{ color: hud.chase.kind === "police" ? "#3b6fb5" : "#c07b1d" }} />
                    <span className="text-[11px] font-extrabold text-[#3a2e2a]">
                      {hud.chase.kind === "police"
                        ? hud.chase.bust > 0.05
                          ? "در حال دستگیری! گاز بزن!"
                          : "پلیس تعقیبت می‌کنه!"
                        : "تاکسیه عصبانیه! فرار کن!"}
                    </span>
                  </div>
                  {/* 🔑 v0.2.43 — ستاره‌های تعقیب (سبک GTA) */}
                  <div className="flex items-center gap-0.5" aria-label={`${hud.chase?.stars ?? 0} ستاره تعقیب`}>
                    {[1, 2, 3].map((s) => (
                      <Star
                        key={s}
                        className={`h-3.5 w-3.5 ${s <= (hud.chase?.stars ?? 0) ? "fill-[#F2B705] text-[#B8801A]" : "text-[#3a2e2a]/25"}`}
                        strokeWidth={2.4}
                      />
                    ))}
                  </div>
                  <div className="flex items-center justify-between text-[9px] font-bold text-[#3a2e2a]/80">
                    <span>{fa(hud.chase.dist)} متر تا گمش کنی</span>
                    {hud.chase.kind === "police" && hud.chase.bust > 0.05 && (
                      <span>دستگیری: {fa(Math.round(hud.chase.bust * 100))}٪</span>
                    )}
                  </div>
                  {hud.chase.kind === "police" && hud.chase.bust > 0.05 && (
                    <div className="h-1.5 w-full overflow-hidden rounded-full bg-white">
                      <div className="h-full bg-[#D64545] transition-all" style={{ width: `${Math.round(hud.chase.bust * 100)}%` }} />
                    </div>
                  )}
                </div>
              )}
              {/* 🔑 v0.2.44 — پنل مأموریت فشرده وسط-بالا + فلش GPS داخل خود پنل (دیگر وسط جاده نیست) */}
              {hud.mission && (
                <div className="fc-panel pointer-events-auto w-[min(230px,52vw)] bg-[#FFF9EC]/95 p-2">
                  <div className="flex items-center justify-between gap-2">
                    <span className="truncate text-[11px] font-bold text-[#3a2e2a]">{hud.mission.title}</span>
                    <TapButton
                      ariaLabel="انصراف از مأموریت"
                      className="h-6 w-6 shrink-0 bg-[#D64545] text-white"
                      onTap={() => gameRef.current?.abandonMission()}
                    >
                      <X className="h-3.5 w-3.5" />
                    </TapButton>
                  </div>
                  <p className="mt-0.5 line-clamp-2 text-[9px] font-medium leading-3 text-[#3a2e2a]/70">{hud.mission.objective}</p>
                  <div className="mt-1 flex items-center justify-between gap-1.5">
                    {hud.mission.dirDeg !== null && hud.mission.distM > 12 && (
                      <span className="flex shrink-0 items-center gap-1 rounded-full bg-[#2A9D8F] px-1.5 py-0.5 text-white">
                        <svg
                          className="fc-gps-arrow"
                          width="11"
                          height="11"
                          viewBox="0 0 24 24"
                          style={{ transform: `rotate(${hud.mission.dirDeg}deg)` }}
                          aria-hidden="true"
                        >
                          <path d="M12 2 L19 21 L12 16 L5 21 Z" fill="#ffffff" stroke="#3a2e2a" strokeWidth="1.6" strokeLinejoin="round" />
                        </svg>
                        <span className="text-[9px] font-extrabold">{fa(hud.mission.distM)} متر</span>
                      </span>
                    )}
                    {hud.mission.timeLeft >= 0 ? (
                      <span className="text-[9px] font-extrabold text-[#3a2e2a]/80">{fa(Math.ceil(hud.mission.timeLeft))} ثانیه</span>
                    ) : (
                      <span className="text-[9px] font-extrabold text-[#3a2e2a]/80">هدف نزدیکه!</span>
                    )}
                  </div>
                  {hud.mission.timeLeft >= 0 && (
                    <div className="mt-1 h-2 w-full overflow-hidden rounded-full border-2 border-[#3a2e2a] bg-white">
                      <div
                        className="h-full transition-all"
                        style={{
                          width: `${hud.mission.timeLimit > 0 ? Math.max(0, Math.min(100, (hud.mission.timeLeft / hud.mission.timeLimit) * 100)) : 0}%`,
                          backgroundColor: hud.mission.timeLeft > 15 ? "#8AC926" : hud.mission.timeLeft > 7 ? "#F2B705" : "#D64545",
                        }}
                      />
                    </div>
                  )}
                  {/* نوار پیشرفت مسیر (v0.2.43) */}
                  {hud.mission.progress !== null && (
                    <div className="mt-1 h-1.5 w-full overflow-hidden rounded-full border border-[#3a2e2a]/35 bg-white">
                      <div className="h-full bg-[#2A9D8F] transition-all" style={{ width: `${Math.round(hud.mission.progress * 100)}%` }} />
                    </div>
                  )}
                  {hud.mission.extra && (
                    <div className="mt-1 truncate rounded-full bg-[#FFF3D6] px-2 py-0.5 text-center text-[9px] font-bold text-[#3a2e2a]">{hud.mission.extra}</div>
                  )}
                </div>
              )}
              {/* 🔑 v0.2.44 — توست گفتار بازیکن (جای حباب وسط کانواس که جلوی دید بود) */}
              {hud.say && <SayToast key={`${hud.say.speaker}:${hud.say.line}`} say={hud.say} />}
              {/* 🔑 v0.2.43 — آموزش سه‌قدمی (وسط، زیر مأموریت — نزدیک دکمه‌هایی که یاد می‌دهد نیست ولی دید را نمی‌بندد) */}
              {tutStep !== null && (
                <div className="fc-panel pointer-events-auto flex items-center gap-2.5 bg-[#3a2e2a] px-4 py-2.5 text-white">
                  {tutStep === 0 ? (
                    <ArrowUp className="h-6 w-6 shrink-0 text-[#8AC926]" />
                  ) : tutStep === 1 ? (
                    <MoveHorizontal className="h-6 w-6 shrink-0 text-[#F2B705]" />
                  ) : (
                    <Megaphone className="h-6 w-6 shrink-0 text-[#e07be0]" />
                  )}
                  <p className="text-[12px] font-extrabold leading-5">
                    {tutStep === 0
                      ? "قدم ۱ از ۳ — دکمهٔ سبزِ گاز رو نگه دار تا راه بیفتی!"
                      : tutStep === 1
                        ? "قدم ۲ از ۳ — حالا با فرمان چپ/راست بپیچون!"
                        : "قدم ۳ از ۳ — بوق بزن تا همه بفهمن اینجایی!"}
                  </p>
                  <button
                    type="button"
                    className="fc-btn shrink-0 rounded-xl bg-[#FFF9EC] px-2.5 py-1 text-[10px] font-extrabold text-[#3a2e2a]"
                    onClick={finishTutorial}
                  >
                    رد کردن
                  </button>
                </div>
              )}
            </div>
            {/* اسپیسر راست هم‌عرض مینی‌مپ تا ستون وسط واقعاً وسط بماند */}
            <div className="shrink-0" style={{ width: mmSize }} aria-hidden="true" />
          </div>

          {/* 🔑 v0.2.44 — سرعت‌سنج فشرده: پایین-وسط (عادی) / گوشهٔ آزاد (پله‌ای) / بالای خوشه (اکستریم) — پیش‌فرض دیگر جلوی دید نیست */}
          <div
            className="pointer-events-none absolute z-20"
            style={
              geom.gaugeMode === "center"
                ? { left: "50%", transform: "translateX(-50%)", bottom: "clamp(8px, 2vh, 14px)" }
                : geom.gaugeMode === "corner"
                  ? ui.leftHanded
                    ? { right: geom.edge, bottom: "clamp(8px, 2vh, 14px)" }
                    : { left: geom.edge, bottom: "clamp(8px, 2vh, 14px)" }
                  : {
                      left: "50%",
                      transform: "translateX(-50%)",
                      bottom: `calc(clamp(10px, 4vh, 28px) + (${geom.pedalH}px + ${geom.steer1}px) * ${ui.controlsScale} + 16px)`,
                    }
            }
          >
            <SpeedGauge kmh={hud.speedKmh} w={geom.gaugeW} />
          </div>

          {/* 🔑 v0.2.43 — وینیت قرمز ضربه */}
          {hitFxKey > 0 && <div key={hitFxKey} className="fc-vignette absolute inset-0 z-30" />}

          {/* کنترل‌ها — v0.2.43: اندازه/شفافیت قابل‌تنظیم + حالت چپ‌دست + چیدمان پله‌ای هوشمند
              (اگر خوشه‌ها در عرض صفحه جا نشوند، فرمان بالا می‌رود تا هرگز هم‌پوشان نشوند) */}
          <div className="pointer-events-none absolute inset-0 z-20" style={csStyle}>
            {(() => {
              const edge = "clamp(10px, 2.5vw, 20px)";
              const bottom = "clamp(10px, 4vh, 28px)";
              // v0.2.43 — چیدمان پله‌ای: اگر خوشه‌ها در عرض جا نشوند، فرمان بالاتر از پدال‌ها
              const steerBottom = geom.stacked
                ? `calc(${bottom} + ${geom.pedalH}px * var(--fcCs, 1) + 12px)`
                : bottom;
              const steerPos: React.CSSProperties = ui.leftHanded
                ? { right: edge, bottom: steerBottom }
                : { left: edge, bottom: steerBottom };
              const pedalPos: React.CSSProperties = ui.leftHanded
                ? { left: edge, bottom }
                : { right: edge, bottom };
              const sz = (base: string) => `calc(${base} * var(--fcCs, 1))`;
              const steerBtn = sz("clamp(84px, 19vh, 124px)");
              const steerIcon = sz("clamp(44px, 10vh, 64px)");
              const gasBtn = sz("clamp(94px, 21vh, 134px)");
              const gasIcon = sz("clamp(48px, 11vh, 70px)");
              const brakeBtn = sz("clamp(76px, 17vh, 108px)");
              const brakeIcon = sz("clamp(36px, 8vh, 52px)");
              const hornBtn = sz("clamp(58px, 13vh, 84px)");
              const hornIcon = sz("clamp(28px, 6.5vh, 42px)");
              return (
                <>
                  <div
                    className="pointer-events-auto absolute flex items-end"
                    style={{ ...steerPos, display: "flex", gap: "clamp(8px, 1.8vw, 14px)", direction: "ltr", opacity: ui.controlsOpacity }}
                  >
                    <HoldButton
                      ariaLabel="فرمان چپ"
                      onHold={steerLeft}
                      className={`bg-[#FFF3D6] text-[#3a2e2a] ${tutStep === 1 ? "fc-tut-target" : ""}`}
                      style={{ width: steerBtn, height: steerBtn }}
                    >
                      <ChevronLeft style={{ width: steerIcon, height: steerIcon }} strokeWidth={3} />
                    </HoldButton>
                    <HoldButton
                      ariaLabel="فرمان راست"
                      onHold={steerRight}
                      className={`bg-[#FFF3D6] text-[#3a2e2a] ${tutStep === 1 ? "fc-tut-target" : ""}`}
                      style={{ width: steerBtn, height: steerBtn }}
                    >
                      <ChevronRight style={{ width: steerIcon, height: steerIcon }} strokeWidth={3} />
                    </HoldButton>
                  </div>
                  <div
                    className="pointer-events-auto absolute flex items-end"
                    style={{ ...pedalPos, display: "flex", direction: "ltr", gap: "clamp(8px, 1.8vw, 12px)", opacity: ui.controlsOpacity }}
                  >
                    <div className="flex flex-col items-center" style={{ gap: "clamp(8px, 1.6vh, 12px)" }}>
                      <TapButton
                        ariaLabel="بوق"
                        onTap={() => {
                          advanceTutorial(2); // v0.2.43 — آموزش قدم ۳
                          gameRef.current?.pressHorn();
                        }}
                        className={`bg-[#F2B705] text-[#3a2e2a] ${tutStep === 2 ? "fc-tut-target" : ""}`}
                        style={{ width: hornBtn, height: hornBtn }}
                      >
                        <Megaphone style={{ width: hornIcon, height: hornIcon }} />
                      </TapButton>
                      <HoldButton
                        ariaLabel="ترمز"
                        onHold={(d) => gameRef.current?.setVirtualBrake(d)}
                        className="bg-[#D64545] text-white"
                        style={{ width: brakeBtn, height: brakeBtn }}
                      >
                        <Square style={{ width: brakeIcon, height: brakeIcon }} strokeWidth={2.8} />
                      </HoldButton>
                    </div>
                    <HoldButton
                      ariaLabel="گاز"
                      onHold={(d) => {
                        if (d) advanceTutorial(0); // v0.2.43 — آموزش قدم ۱
                        gameRef.current?.setVirtualGas(d);
                      }}
                      className={`bg-[#8AC926] text-[#3a2e2a] ${tutStep === 0 ? "fc-tut-target" : ""}`}
                      style={{ width: gasBtn, height: gasBtn }}
                    >
                      <ArrowUp style={{ width: gasIcon, height: gasIcon }} strokeWidth={3} />
                    </HoldButton>
                  </div>
                </>
              );
            })()}
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
                onClick={() => {
                  gameRef.current?.resume();
                }}
              >
                <Play className="h-5 w-5" />
                ادامه بازی
              </button>
              <button
                type="button"
                className="fc-btn flex w-full items-center justify-center gap-2 rounded-2xl bg-[#FFF3D6] py-3 font-extrabold text-[#3a2e2a]"
                onClick={() => {
                  setShowSettings((v) => !v);
                }}
              >
                <Settings className="h-5 w-5" />
                تنظیمات صدا
              </button>
              <button
                type="button"
                className="fc-btn flex w-full items-center justify-center gap-2 rounded-2xl bg-[#D64545] py-3 font-extrabold text-white"
                onClick={() => {
                  gameRef.current?.backToMenu();
                }}
              >
                <Home className="h-5 w-5" />
                منوی اصلی
              </button>
            </div>
            {showSettings && game && (
              <div className="rounded-2xl bg-[#FFF3D6] p-3">
                <SettingsPanel game={game} ui={ui} onChangeUi={changeUi} onReplayTutorial={replayTutorial} />
              </div>
            )}
          </div>
        </div>
      )}

      {/* ============ نتیجه مأموریت (فاز 4) ============ */}
      {phase === "playing" && missionResult && (
        <div className="absolute inset-0 z-40 flex items-center justify-center bg-[#3a2e2a]/45 px-6 backdrop-blur-[2px]">
          <div
            className={`fc-panel fc-pop relative w-full max-w-sm overflow-hidden p-6 text-center ${
              missionResult.success ? "bg-[#FFF9EC]" : "bg-[#F4E7DA]"
            }`}
          >
            {/* 🔑 v0.2.43 — کاغذرنگی موفقیت */}
            {missionResult.success && <Confetti />}
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
              {missionResult.success && (
                <button
                  type="button"
                  className="fc-btn flex w-full items-center justify-center gap-2 rounded-2xl bg-[#2A9D8F] py-3 text-lg font-extrabold text-white"
                  onClick={() => {
                    setMissionResult(null);
                    const nid = gameRef.current?.nextMissionId();
                    if (nid) gameRef.current?.startMission(nid);
                  }}
                >
                  <Play className="h-5 w-5" />
                  مأموریت بعدی
                  <ChevronRight className="h-5 w-5" />
                </button>
              )}
              <button
                type="button"
                className="fc-btn flex w-full items-center justify-center gap-2 rounded-2xl bg-[#8AC926] py-3 text-lg font-extrabold text-[#3a2e2a]"
                onClick={() => {
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
                onClick={() => {
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
                onClick={() => {
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
                onClick={() => {
                  gameRef.current?.towToRepair();
                }}
              >
                <Wrench className="h-5 w-5" />
                اسکران به تعمیرگاه ({towCostLabel})
              </button>
              <button
                type="button"
                className="fc-btn flex w-full items-center justify-center gap-2 rounded-2xl bg-[#FFF3D6] py-3 font-extrabold text-[#3a2e2a]"
                onClick={() => {
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

      {/* 🔑 v0.2.43 — مدال چرخش سه‌بعدی خودرو */}
      {spinCar && garage && (
        <SpinModal
          car={spinCar}
          coins={garage.coins}
          colors={garage.vehicles.find((v) => v.id === spinCar.id)?.colors ?? ["#f4f4f0"]}
          onClose={() => setSpinCar(null)}
          onChooseColor={(hex) => {
            setChosenColors((m) => ({ ...m, [spinCar.id]: hex }));
            setSpinCar((s) => (s ? { ...s, paint: hex } : s));
          }}
          onBuy={() => {
            const c = spinCar;
            purchase(() =>
              c.owned
                ? gameRef.current!.selectVehicle(c.id)
                : gameRef.current!.buyVehicle(c.id, c.paint ?? undefined),
            );
            const g = gameRef.current?.listGarage();
            if (g) {
              setGarage(g);
              const cur = g.vehicles.find((v) => v.id === c.id);
              setSpinCar((s) => (s && cur ? { ...s, owned: cur.owned, selected: cur.selected, price: cur.price } : s));
            }
          }}
        />
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
