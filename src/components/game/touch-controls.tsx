"use client";

/**
 * touch-controls.tsx — دکمه‌های لمسی رانندگی
 * ============================================================
 * - حداقل 44px لمس (استاندارد دسترس‌پذیری)
 * - pointer events برای چند لمس هم‌زمان (TEST-INPUT-003)
 * - no-select و touch-action:none (TEST-INPUT-004)
 */

import { useCallback, useRef, useState } from "react";

// ---------- 🔑 v0.2.43 — ویبرهٔ لمس (قابل خاموشی از تنظیمات) ----------
let hapticsEnabled = true;
export function setHapticsEnabled(v: boolean): void {
  hapticsEnabled = v;
}
function buzz(ms = 8): void {
  try {
    if (hapticsEnabled && typeof navigator !== "undefined" && typeof navigator.vibrate === "function") {
      navigator.vibrate(ms);
    }
  } catch {
    /* بی‌خطر */
  }
}

interface HoldButtonProps {
  label?: React.ReactNode;
  /** محتوای دکمه — نام‌ترجیحی با children (هم‌خوان با عرف React) */
  children?: React.ReactNode;
  ariaLabel: string;
  className?: string;
  style?: React.CSSProperties;
  onHold: (down: boolean) => void;
  disabled?: boolean;
}

/** دکمه نگه‌داشتنی (گاز/ترمز/فرمان) */
export function HoldButton({ label, children, ariaLabel, className = "", style, onHold, disabled }: HoldButtonProps) {
  const [pressed, setPressed] = useState(false);
  const ref = useRef<HTMLButtonElement>(null);

  const down = useCallback(
    (e: React.PointerEvent) => {
      if (disabled) return;
      e.preventDefault();
      ref.current?.setPointerCapture?.(e.pointerId);
      setPressed(true);
      buzz();
      onHold(true);
    },
    [disabled, onHold],
  );
  const up = useCallback(
    (e: React.PointerEvent) => {
      e.preventDefault();
      setPressed(false);
      onHold(false);
    },
    [onHold],
  );

  return (
    <button
      ref={ref}
      type="button"
      aria-label={ariaLabel}
      className={`fc-btn flex items-center justify-center rounded-full ${className}`}
      style={{ touchAction: "none", opacity: disabled ? 0.5 : 1, ...style }}
      data-pressed={pressed}
      onPointerDown={down}
      onPointerUp={up}
      onPointerCancel={up}
      onContextMenu={(e) => e.preventDefault()}
      disabled={disabled}
    >
      {children ?? label}
    </button>
  );
}

interface TapButtonProps {
  label?: React.ReactNode;
  children?: React.ReactNode;
  ariaLabel: string;
  className?: string;
  style?: React.CSSProperties;
  onTap: () => void;
}

/** دکمه ضربه‌ای (بوق/Pause) */
export function TapButton({ label, children, ariaLabel, className = "", style, onTap }: TapButtonProps) {
  return (
    <button
      type="button"
      aria-label={ariaLabel}
      className={`fc-btn flex items-center justify-center rounded-full active:brightness-110 ${className}`}
      style={{ touchAction: "manipulation", ...style }}
      onPointerDown={(e) => {
        e.preventDefault();
        buzz(6);
        onTap();
      }}
      onContextMenu={(e) => e.preventDefault()}
    >
      {children ?? label}
    </button>
  );
}
