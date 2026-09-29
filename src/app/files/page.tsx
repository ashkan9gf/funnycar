"use client";

/**
 * files/page.tsx — مرورگر فایل‌های پروژه (مخصوص تست کاربر)
 * ============================================================
 * - ریشه‌های سفیدلیست‌شده از api/files خوانده می‌شود
 * - پوشه‌ها قابل پیمایش، فایل‌ها قابل مشاهده/دانلود
 */

import { useCallback, useEffect, useState } from "react";

type Entry = { name: string; dir: boolean; size: number };

const ROOTS: { key: string; label: string }[] = [
  { key: "models", label: "مدل‌های GLB" },
  { key: "src", label: "کد بازی" },
  { key: "docs", label: "اسناد" },
  { key: "android", label: "پوسته اندروید" },
  { key: "download", label: "خروجی‌ها" },
];

function faSize(n: number): string {
  if (n >= 1024 * 1024) return `${(n / 1024 / 1024).toFixed(1)} مگابایت`;
  if (n >= 1024) return `${(n / 1024).toFixed(0)} کیلوبایت`;
  return `${n} بایت`;
}

function extOf(name: string): string {
  const i = name.lastIndexOf(".");
  return i >= 0 ? name.slice(i + 1).toLowerCase() : "";
}

const BADGE: Record<string, string> = {
  glb: "bg-[#F2B705]/25 text-[#B8801A]",
  ts: "bg-[#2f6fae]/20 text-[#2f6fae]",
  tsx: "bg-[#2f6fae]/20 text-[#2f6fae]",
  md: "bg-[#8AC926]/25 text-[#4c7a12]",
  apk: "bg-[#D64545]/20 text-[#D64545]",
  zip: "bg-[#D64545]/20 text-[#D64545]",
};

export default function FilesPage() {
  const [root, setRoot] = useState("models");
  const [sub, setSub] = useState("");
  const [entries, setEntries] = useState<Entry[]>([]);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState("");

  const load = useCallback(async (r: string, s: string) => {
    setLoading(true);
    setErr("");
    try {
      const res = await fetch(`/api/files?op=list&root=${r}&sub=${encodeURIComponent(s)}`, { cache: "no-store" });
      const j = await res.json();
      if (!res.ok) throw new Error(j.error ?? "خطا");
      setEntries(j.entries ?? []);
    } catch (e) {
      setErr(e instanceof Error ? e.message : "خطای ناشناخته");
      setEntries([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load(root, sub);
  }, [root, sub, load]);

  const crumbs = sub ? sub.split("/").filter(Boolean) : [];

  return (
    <main dir="rtl" className="min-h-screen bg-[#241d19] px-4 py-6 text-[#3a2e2a]">
      <div className="mx-auto flex w-full max-w-3xl flex-col gap-4">
        {/* سربرگ */}
        <header className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h1 className="text-2xl font-extrabold text-[#FFF9EC]">پوشه فایل‌های پروژه</h1>
            <p className="text-xs font-bold text-[#FFF9EC]/60">
              مدل‌های سه‌بعدی، کد بازی، اسناد و خروجی‌ها — قابل مشاهده و دانلود
            </p>
          </div>
          <div className="flex gap-2">
            <a
              href="/test"
              className="rounded-xl bg-[#F2B705] px-3 py-2 text-xs font-extrabold text-[#3a2e2a] no-underline"
            >
              کنسول تست
            </a>
            <a
              href="/"
              className="rounded-xl bg-[#8AC926] px-3 py-2 text-xs font-extrabold text-[#3a2e2a] no-underline"
            >
              ورود به بازی
            </a>
          </div>
        </header>

        {/* تب ریشه‌ها */}
        <nav className="flex flex-wrap gap-2">
          {ROOTS.map((r) => (
            <button
              key={r.key}
              type="button"
              onClick={() => {
                setRoot(r.key);
                setSub("");
              }}
              className={`rounded-xl px-3 py-1.5 text-xs font-extrabold transition-colors ${
                root === r.key ? "bg-[#F2B705] text-[#3a2e2a]" : "bg-[#3a2e2a] text-[#FFF9EC]/70"
              }`}
            >
              {r.label}
            </button>
          ))}
        </nav>

        {/* مسیر جاری */}
        <div className="flex flex-wrap items-center gap-1 text-xs font-bold text-[#FFF9EC]/70">
          <button type="button" className="underline-offset-2 hover:underline" onClick={() => setSub("")}>
            ریشه
          </button>
          {crumbs.map((c, i) => (
            <span key={i} className="flex items-center gap-1">
              <span className="opacity-40">/</span>
              <button
                type="button"
                className="underline-offset-2 hover:underline"
                onClick={() => setSub(crumbs.slice(0, i + 1).join("/"))}
              >
                {c}
              </button>
            </span>
          ))}
        </div>

        {/* لیست */}
        <section className="overflow-hidden rounded-2xl bg-[#FFF9EC] shadow-lg">
          {loading && <p className="p-6 text-center text-sm font-bold">در حال خواندن…</p>}
          {!loading && err && <p className="p-6 text-center text-sm font-bold text-[#D64545]">{err}</p>}
          {!loading && !err && entries.length === 0 && (
            <p className="p-6 text-center text-sm font-bold opacity-60">این پوشه خالی است</p>
          )}
          {!loading && !err && (
            <ul className="divide-y divide-[#3a2e2a]/10">
              {entries.map((e) => {
                const ext = extOf(e.name);
                const subQ = sub ? `${sub}/` : "";
                return (
                  <li key={e.name} className="flex items-center gap-3 px-4 py-2.5">
                    <span
                      className={`rounded-lg px-2 py-0.5 text-[10px] font-extrabold uppercase ${
                        e.dir ? "bg-[#3a2e2a]/10 text-[#3a2e2a]" : BADGE[ext] ?? "bg-[#3a2e2a]/5 text-[#3a2e2a]/60"
                      }`}
                    >
                      {e.dir ? "پوشه" : ext || "فایل"}
                    </span>
                    {e.dir ? (
                      <button
                        type="button"
                        className="flex-1 truncate text-right text-sm font-extrabold hover:text-[#B8801A]"
                        onClick={() => setSub(subQ + e.name)}
                      >
                        {e.name}
                      </button>
                    ) : (
                      <span className="flex-1 truncate text-right text-sm font-bold">{e.name}</span>
                    )}
                    <span className="shrink-0 text-[11px] font-bold opacity-50">{faSize(e.size)}</span>
                    {!e.dir && (
                      <span className="flex shrink-0 gap-1.5">
                        <a
                          href={`/api/files?op=get&root=${root}&sub=${encodeURIComponent(subQ + e.name)}`}
                          target="_blank"
                          rel="noreferrer"
                          className="rounded-lg bg-[#2f6fae]/15 px-2.5 py-1 text-[11px] font-extrabold text-[#2f6fae] no-underline"
                        >
                          مشاهده
                        </a>
                        <a
                          href={`/api/files?op=get&root=${root}&sub=${encodeURIComponent(subQ + e.name)}&dl=1`}
                          className="rounded-lg bg-[#8AC926]/25 px-2.5 py-1 text-[11px] font-extrabold text-[#4c7a12] no-underline"
                        >
                          دانلود
                        </a>
                      </span>
                    )}
                  </li>
                );
              })}
            </ul>
          )}
        </section>

        <p className="text-center text-[11px] font-bold text-[#FFF9EC]/40">
          فانی‌کار v0.2.6 — مدل‌های ارسالی شما در مسیر public/assets/models نصب شده‌اند
        </p>
      </div>
    </main>
  );
}
