"use client";

/**
 * test/page.tsx — «کنسول تست فانی‌کار»
 * ============================================================
 * - نمایشگر سه‌بعدی مدل‌ها با همان کد واقعی بازی (GlbLibrary + assembleCarFromGLB)
 * - چک‌لیست لود ۷ مدل: ۵ خودروی مسیر بازی + اسکایلاین + پراپ‌های شهر
 * - آمار هر مدل: مثلث‌ها، mesh ها، چرخ‌ها، ابعاد جعبه محیطی
 * - پیوندهای ورود به بازی و مرور فایل‌های پروژه
 */

import { useCallback, useEffect, useRef, useState } from "react";
import * as THREE from "three";
import { OrbitControls } from "three/examples/jsm/controls/OrbitControls.js";
import { GlbLibrary, assembleCarFromGLB } from "@/game/render3d/GlbModels";
import { spinWheels, type CarModel3D, type CarVariant } from "@/game/render3d/CarFactory3D";

type Status = "idle" | "loading" | "ok" | "fail";
type Stats = { tri: number; meshes: number; wheels: number; extWheels: number; lightBar: string; dims: string };
type Cached = { group: THREE.Group; model: CarModel3D | null };

const MODELS: {
  id: string;
  label: string;
  sub: string;
  rel: string;
  variant: CarVariant | null;
  size: string;
}[] = [
  { id: "player", label: "تیزبوق", sub: "ماشین بازیکن — قرمز", rel: "vehicles/player.glb", variant: "player", size: "۵٫۸MB" },
  { id: "peugeot405", label: "فشفاهی", sub: "ترافیک — سدان سفید", rel: "vehicles/peugeot405.glb", variant: "peugeot405", size: "۳٫۶MB" },
  { id: "samand", label: "دبه‌کش", sub: "ترافیک — سدان نقره‌ای", rel: "vehicles/samand.glb", variant: "samand", size: "۳٫۹MB" },
  { id: "taxi", label: "کرایه‌چی", sub: "ترافیک — تاکسی زرد", rel: "vehicles/taxi.glb", variant: "taxi", size: "۴۱۶KB" },
  { id: "police", label: "آژیرخان", sub: "ترافیک — پلیس", rel: "vehicles/police.glb", variant: "police", size: "۱۶۸KB" },
  { id: "renault4", label: "چهاردَنده (جدید)", sub: "ترافیک — کلاسیک کرم", rel: "vehicles/renault4.glb", variant: "renault4", size: "۴٫۵MB" },
  { id: "vintage", label: "تُف‌تُفی (جدید)", sub: "ترافیک — قدیمی زیتونی", rel: "vehicles/vintage.glb", variant: "vintage", size: "۲٫۸MB" },
  { id: "props", label: "پراپ‌های شهری", sub: "اجسام شهر — cities شما", rel: "city/props.glb", variant: null, size: "۹۶۰KB" },
];

const STATUS_FA: Record<Status, string> = {
  idle: "—",
  loading: "در حال لود…",
  ok: "لود شد",
  fail: "خطا!",
};

interface T3 {
  renderer: THREE.WebGLRenderer;
  scene: THREE.Scene;
  camera: THREE.PerspectiveCamera;
  controls: OrbitControls;
  holder: THREE.Group;
  grid: THREE.GridHelper;
  current: Cached | null;
  isCar: boolean;
  spin: boolean;
  lib: GlbLibrary;
  cache: Map<string, Cached>;
}

export default function TestConsolePage() {
  const mountRef = useRef<HTMLDivElement>(null);
  const threeRef = useRef<T3 | null>(null);
  const statsRef = useRef<Record<string, Stats>>({});

  const [sel, setSel] = useState("player");
  const [status, setStatus] = useState<Record<string, Status>>({});
  const [stats, setStats] = useState<Record<string, Stats>>({});
  const [spin, setSpin] = useState(true);
  const [rotate, setRotate] = useState(true);
  const [busy, setBusy] = useState(false);

  // ---------- راه‌اندازی صحنه (یک‌بار) ----------
  useEffect(() => {
    const el = mountRef.current;
    if (!el) return;

    const renderer = new THREE.WebGLRenderer({ antialias: true });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.setClearColor("#1d1713");
    renderer.setSize(el.clientWidth || 640, el.clientHeight || 420, false);
    el.appendChild(renderer.domElement);
    renderer.domElement.style.touchAction = "none";

    const scene = new THREE.Scene();
    scene.add(new THREE.HemisphereLight("#ffffff", "#4a3f35", 1.2));
    const dir1 = new THREE.DirectionalLight("#fff6e0", 1.6);
    dir1.position.set(60, 100, 40);
    scene.add(dir1);
    const dir2 = new THREE.DirectionalLight("#dfe8ff", 0.7);
    dir2.position.set(-50, 60, -60);
    scene.add(dir2);

    const camera = new THREE.PerspectiveCamera(45, 1.6, 0.1, 8000);
    camera.position.set(120, 80, 160);

    const controls = new OrbitControls(camera, renderer.domElement);
    controls.enableDamping = true;
    controls.autoRotate = true;
    controls.autoRotateSpeed = 2.2;

    const holder = new THREE.Group();
    scene.add(holder);

    const grid = new THREE.GridHelper(400, 40, new THREE.Color("#5a4a3a"), new THREE.Color("#382c23"));
    grid.position.y = 0;
    scene.add(grid);

    const lib = new GlbLibrary();
    const cache = new Map<string, Cached>();

    threeRef.current = { renderer, scene, camera, controls, holder, grid, current: null, isCar: true, spin: true, lib, cache };

    const clock = new THREE.Clock();
    let raf = 0;
    const loop = () => {
      raf = requestAnimationFrame(loop);
      const dt = clock.getDelta();
      controls.update();
      const T = threeRef.current;
      if (T && T.spin && T.current) {
        if (T.isCar) spinWheels(T.current.model as CarModel3D, dt * 7);
        else T.current.group.rotation.y += dt * 0.25;
      }
      renderer.render(scene, camera);
    };
    loop();

    const ro = new ResizeObserver(() => {
      const w = el.clientWidth || 1;
      const h = el.clientHeight || 1;
      renderer.setSize(w, h, false);
      camera.aspect = w / h;
      camera.updateProjectionMatrix();
    });
    ro.observe(el);

    return () => {
      cancelAnimationFrame(raf);
      ro.disconnect();
      controls.dispose();
      renderer.dispose();
      if (renderer.domElement.parentElement === el) el.removeChild(renderer.domElement);
      threeRef.current = null;
    };
  }, []);

  // ---------- قاب‌بندی دوربین روی مدل ----------
  const frameCamera = useCallback((group: THREE.Object3D) => {
    const T = threeRef.current;
    if (!T) return;
    // دیباگ: دسترسی از کنسول مرورگر (دوربین/مدل)
    (window as unknown as { __fcTest?: unknown }).__fcTest = T;
    group.updateMatrixWorld(true);
    const box = new THREE.Box3().setFromObject(group);
    if (box.isEmpty()) return;
    const sphere = box.getBoundingSphere(new THREE.Sphere());
    const fovRad = (T.camera.fov * Math.PI) / 180;
    const dist = (sphere.radius / Math.sin(fovRad / 2)) * 1.12;
    T.camera.near = Math.max(sphere.radius / 200, 0.01);
    T.camera.far = Math.max(sphere.radius * 60, 400);
    T.camera.position.set(
      sphere.center.x + dist * 0.5,
      sphere.center.y + dist * 0.4,
      sphere.center.z + dist * 0.75,
    );
    T.controls.target.copy(sphere.center);
    T.controls.update();
    T.camera.updateProjectionMatrix();
    T.grid.position.y = box.min.y - sphere.radius * 0.01;
    T.grid.visible = true;
  }, []);

  // ---------- لود یک مدل (با کد واقعی بازی) ----------
  const loadModel = useCallback(
    async (id: string, display: boolean): Promise<boolean> => {
      const T = threeRef.current;
      const m = MODELS.find((x) => x.id === id);
      if (!T || !m) return false;

      if (display) setSel(id);

      // از کش — نمایش فوری
      const hit = T.cache.get(id);
      if (hit) {
        if (display) {
          T.holder.clear();
          T.holder.add(hit.group);
          T.current = hit;
          T.isCar = !!m.variant;
          T.grid.visible = !!m.variant;
          frameCamera(hit.group);
        }
        return true;
      }

      if (statsRef.current[id]) {
        setStatus((s) => ({ ...s, [id]: "ok" }));
      }
      setStatus((s) => ({ ...s, [id]: s[id] === "ok" ? "ok" : "loading" }));

      try {
        const scene = await T.lib.load(m.rel);
        if (!scene) throw new Error("لود ناموفق");

        let group: THREE.Group;
        let model: CarModel3D | null = null;
        if (m.variant) {
          model = assembleCarFromGLB(m.variant, scene, { external: true });
          group = model.group;
        } else {
          group = scene;
        }
        const cached: Cached = { group, model };
        T.cache.set(id, cached);

        // آمار هندسی
        group.updateMatrixWorld(true);
        let tri = 0;
        let meshes = 0;
        let wheelCount = 0;
        group.traverse((o) => {
          const mesh = o as THREE.Mesh;
          if (!mesh.isMesh) return;
          meshes += 1;
          const name = (mesh.name || "").toLowerCase();
          if (name.startsWith("wheel_")) wheelCount += 1;
          const idx = mesh.geometry.getIndex();
          tri += (idx ? idx.count : mesh.geometry.getAttribute("position")?.count ?? 0) / 3;
        });
        const box = new THREE.Box3().setFromObject(group);
        const size = new THREE.Vector3();
        box.getSize(size);
        const st: Stats = {
          tri: Math.round(tri),
          meshes,
          wheels: wheelCount,
          extWheels: model?.extWheels?.length ?? 0,
          lightBar: model?.lightBar ? (model.lightBar.red !== model.lightBar.blue ? "قرمز+آبی ✓" : "تک‌رنگ ✗") : "—",
          dims: `${size.x.toFixed(0)} × ${size.y.toFixed(0)} × ${size.z.toFixed(0)}`,
        };
        statsRef.current = { ...statsRef.current, [id]: st };
        setStats((s) => ({ ...s, [id]: st }));
        setStatus((s) => ({ ...s, [id]: "ok" }));

        if (display) {
          T.holder.clear();
          T.holder.add(group);
          T.current = cached;
          T.isCar = !!m.variant;
          T.grid.visible = !!m.variant;
          frameCamera(group);
        }
        return true;
      } catch {
        setStatus((s) => ({ ...s, [id]: "fail" }));
        return false;
      }
    },
    [frameCamera],
  );

  // اولین مدل در شروع
  useEffect(() => {
    const t = setTimeout(() => void loadModel("player", true), 60);
    return () => clearTimeout(t);
  }, [loadModel]);

  // بررسی زنجیره‌ای همه
  const checkAll = useCallback(async () => {
    setBusy(true);
    for (const m of MODELS) {
      await loadModel(m.id, false);
    }
    setBusy(false);
    await loadModel(sel, true);
  }, [loadModel, sel]);

  const toggleSpin = (v: boolean) => {
    setSpin(v);
    if (threeRef.current) threeRef.current.spin = v;
  };
  const toggleRotate = (v: boolean) => {
    setRotate(v);
    if (threeRef.current) threeRef.current.controls.autoRotate = v;
  };

  const selModel = MODELS.find((m) => m.id === sel);
  const okCount = MODELS.filter((m) => status[m.id] === "ok").length;

  return (
    <main dir="rtl" className="flex min-h-screen flex-col bg-[#241d19] px-4 py-5">
      <div className="mx-auto flex w-full max-w-6xl flex-1 flex-col gap-4">
        {/* سربرگ */}
        <header className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-[#F2B705] text-xl font-black text-[#3a2e2a]">
              FC
            </div>
            <div>
              <h1 className="text-xl font-extrabold text-[#FFF9EC]">کنسول تست فانی‌کار</h1>
              <p className="text-[11px] font-bold text-[#FFF9EC]/55">
                نمایش با کد واقعی بازی — GlbLibrary + assembleCarFromGLB
              </p>
            </div>
            <span className="rounded-full bg-[#8AC926]/25 px-2.5 py-1 text-[11px] font-extrabold text-[#8AC926]">
              v0.2.6
            </span>
          </div>
          <div className="flex gap-2">
            <a href="/" className="rounded-xl bg-[#8AC926] px-3.5 py-2 text-xs font-extrabold text-[#3a2e2a] no-underline">
              ورود به بازی
            </a>
            <a href="/files" className="rounded-xl bg-[#F2B705] px-3.5 py-2 text-xs font-extrabold text-[#3a2e2a] no-underline">
              فایل‌های پروژه
            </a>
          </div>
        </header>

        <div className="flex flex-1 flex-col gap-4 lg:flex-row">
          {/* نمایشگر سه‌بعدی */}
          <section className="relative min-h-[320px] flex-1 overflow-hidden rounded-3xl border border-[#FFF9EC]/10 bg-[#1d1713] lg:min-h-0">
            <div ref={mountRef} className="absolute inset-0" />
            <div className="pointer-events-none absolute right-4 top-4 rounded-xl bg-[#241d19]/70 px-3 py-1.5 text-[11px] font-bold text-[#FFF9EC]/80 backdrop-blur">
              {selModel?.label} — بچرخان / زوم کن
            </div>
            <div className="pointer-events-none absolute bottom-4 right-4 rounded-xl bg-[#241d19]/70 px-3 py-1.5 text-[11px] font-bold text-[#8AC926] backdrop-blur">
              لود موفق: {okCount} از {MODELS.length}
            </div>
          </section>

          {/* پنل کنار */}
          <aside className="flex w-full flex-col gap-3 lg:w-80">
            {/* لیست مدل‌ها */}
            <div className="rounded-2xl bg-[#FFF9EC] p-3 shadow-lg">
              <div className="mb-2 flex items-center justify-between">
                <h2 className="text-sm font-extrabold">مدل‌های بازی</h2>
                <button
                  type="button"
                  onClick={() => void checkAll()}
                  disabled={busy}
                  className="rounded-lg bg-[#8AC926] px-2.5 py-1.5 text-[11px] font-extrabold text-[#3a2e2a] disabled:opacity-50"
                >
                  {busy ? "در حال بررسی…" : "بررسی همه"}
                </button>
              </div>
              <ul className="flex flex-col gap-1.5">
                {MODELS.map((m) => {
                  const st = status[m.id] ?? "idle";
                  const dot =
                    st === "ok" ? "bg-[#8AC926]" : st === "loading" ? "bg-[#F2B705] animate-pulse" : st === "fail" ? "bg-[#D64545]" : "bg-[#3a2e2a]/25";
                  return (
                    <li key={m.id}>
                      <button
                        type="button"
                        onClick={() => void loadModel(m.id, true)}
                        className={`flex w-full items-center gap-2.5 rounded-xl px-3 py-2 text-right transition-colors ${
                          sel === m.id ? "bg-[#F2B705]/30" : "hover:bg-[#3a2e2a]/5"
                        }`}
                      >
                        <span className={`h-2.5 w-2.5 shrink-0 rounded-full ${dot}`} />
                        <span className="flex-1">
                          <span className="block text-[13px] font-extrabold leading-4">{m.label}</span>
                          <span className="block text-[10px] font-bold opacity-55">{m.sub} • {m.size}</span>
                        </span>
                        <span
                          className={`shrink-0 text-[10px] font-extrabold ${
                            st === "ok" ? "text-[#4c7a12]" : st === "fail" ? "text-[#D64545]" : "opacity-50"
                          }`}
                        >
                          {STATUS_FA[st]}
                        </span>
                      </button>
                    </li>
                  );
                })}
              </ul>
            </div>

            {/* آمار مدل انتخابی */}
            <div className="rounded-2xl bg-[#FFF9EC] p-4 shadow-lg">
              <h2 className="mb-2 text-sm font-extrabold">آمار «{selModel?.label}»</h2>
              {stats[sel] ? (
                <ul className="grid grid-cols-2 gap-2 text-[12px] font-bold">
                  <li className="rounded-xl bg-[#3a2e2a]/5 p-2">
                    مثلث‌ها: <span className="font-black">{stats[sel].tri.toLocaleString("fa-IR")}</span>
                  </li>
                  <li className="rounded-xl bg-[#3a2e2a]/5 p-2">
                    Mesh ها: <span className="font-black">{stats[sel].meshes.toLocaleString("fa-IR")}</span>
                  </li>
                  <li className="rounded-xl bg-[#3a2e2a]/5 p-2">
                    چرخ‌ها: <span className="font-black">{stats[sel].wheels.toLocaleString("fa-IR")}</span>
                  </li>
                  <li className="rounded-xl bg-[#3a2e2a]/5 p-2">
                    خوشه چرخ گردان: <span className="font-black">{stats[sel].extWheels.toLocaleString("fa-IR")}</span>
                  </li>
                  <li className="rounded-xl bg-[#3a2e2a]/5 p-2">
                    چراغ‌گردان: <span className="font-black">{stats[sel].lightBar}</span>
                  </li>
                  <li className="rounded-xl bg-[#3a2e2a]/5 p-2">
                    ابعاد: <span className="font-black">{stats[sel].dims}</span>
                  </li>
                </ul>
              ) : (
                <p className="text-[12px] font-bold opacity-55">
                  {status[sel] === "loading" ? "در حال محاسبه…" : "مدل را از لیست انتخاب کن"}
                </p>
              )}
            </div>

            {/* کلیدها */}
            <div className="flex flex-col gap-2 rounded-2xl bg-[#FFF9EC] p-4 shadow-lg">
              <label className="flex items-center justify-between text-[13px] font-extrabold">
                چرخش چرخ‌ها
                <input
                  type="checkbox"
                  checked={spin}
                  onChange={(e) => toggleSpin(e.target.checked)}
                  className="h-4 w-8 accent-[#8AC926]"
                />
              </label>
              <label className="flex items-center justify-between text-[13px] font-extrabold">
                چرخش صحنه
                <input
                  type="checkbox"
                  checked={rotate}
                  onChange={(e) => toggleRotate(e.target.checked)}
                  className="h-4 w-8 accent-[#F2B705]"
                />
              </label>
              <a
                href={`/api/files?op=get&root=models&sub=${encodeURIComponent(selModel?.rel ?? "")}&dl=1`}
                className="mt-1 rounded-xl bg-[#2f6fae]/15 px-3 py-2 text-center text-[12px] font-extrabold text-[#2f6fae] no-underline"
              >
                دانلود همین فایل GLB
              </a>
            </div>

            <p className="px-2 text-center text-[10px] font-bold leading-4 text-[#FFF9EC]/40">
              این صفحه همان مسیر لود بازی را صدا می‌زند؛ اگر اینجا «لود شد» دیدی، در بازی هم همان مدل رندر می‌شود.
            </p>
          </aside>
        </div>
      </div>
    </main>
  );
}
