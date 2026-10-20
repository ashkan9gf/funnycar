"use client";

import { useEffect, useRef, useState } from "react";
import * as THREE from "three";
import { buildCar3D, type CarVariant } from "@/game/render3d/CarFactory3D";


function CarRender({ variant, paint }: { variant: CarVariant; paint: string }) {
  const host = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const root = host.current;
    if (!root) return;
    let renderer: THREE.WebGLRenderer;
    try {
      renderer = new THREE.WebGLRenderer({ alpha: true, antialias: true, powerPreference: "low-power" });
    } catch {
      return;
    }
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.5));
    renderer.setSize(Math.max(120, root.clientWidth), 148, false);
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    root.replaceChildren(renderer.domElement);
    renderer.domElement.style.width = "100%";
    renderer.domElement.style.height = "148px";
    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(36, Math.max(120, root.clientWidth) / 148, 1, 1400);
    camera.position.set(245, 150, 310);
    camera.lookAt(0, 48, 0);
    scene.add(new THREE.HemisphereLight(0xffffff, 0x394252, 2.0));
    const key = new THREE.DirectionalLight(0xffe7bf, 3.2);
    key.position.set(220, 320, 250);
    scene.add(key);
    const rim = new THREE.DirectionalLight(0x91c7ff, 1.8);
    rim.position.set(-220, 120, -200);
    scene.add(rim);
    const model = buildCar3D(variant, 100, 200, { lite: true, paint });
    model.group.position.y = 0;
    scene.add(model.group);
    let frame = 0;
    let disposed = false;
    const render = () => {
      if (disposed) return;
      model.group.rotation.y += 0.004;
      renderer.render(scene, camera);
      frame = window.requestAnimationFrame(render);
    };
    render();
    const observer = new ResizeObserver(() => {
      if (!root.clientWidth) return;
      camera.aspect = root.clientWidth / 148;
      camera.updateProjectionMatrix();
      renderer.setSize(root.clientWidth, 148, false);
    });
    observer.observe(root);
    return () => {
      disposed = true;
      window.cancelAnimationFrame(frame);
      observer.disconnect();
      scene.remove(model.group);
      // CarFactory3D intentionally shares geometry caches with the game renderer.
      // Release per-preview materials while leaving globally shared materials untouched.
      model.bodyMat.dispose();
      model.indicatorMat?.dispose();
      model.tailMat?.dispose();
      model.damageMats?.forEach((material) => material.dispose());
      renderer.dispose();
      renderer.domElement.remove();
    };
  }, [variant, paint]);
  return <div ref={host} className="w-full overflow-hidden rounded-xl bg-[radial-gradient(ellipse_at_50%_40%,rgba(255,255,255,0.9),rgba(210,220,230,0.65)_65%,rgba(95,113,130,0.15))]" />;
}

type ShopVehicle = { id: string; name: string; variant: string; price: number; description: string; owned: boolean; selected: boolean };

export default function VehicleShowcase({
  paint = "#f4f4f0",
  vehicles,
  onBuy,
  onSelect,
}: {
  paint?: string;
  vehicles: ShopVehicle[];
  onBuy: (id: string) => void;
  onSelect: (id: string) => void;
}) {
  const [selectedId, setSelectedId] = useState(() => vehicles.find((v) => v.selected)?.id ?? vehicles[0]?.id ?? "veh_player_01");
  const active = vehicles.find((v) => v.id === selectedId) ?? vehicles[0];
  const variant = (active?.variant ?? "player") as CarVariant;
  return (
    <section className="rounded-3xl border border-white/20 bg-gradient-to-br from-[#172536] via-[#24364a] to-[#342a31] p-3 shadow-xl">
      <div className="mb-2 flex items-center justify-between gap-2">
        <div>
          <h3 className="text-sm font-black text-white">نمایشگاه مدل‌های سه‌بعدی</h3>
          <p className="mt-1 text-[10px] font-bold text-white/60">قبل از انتخاب، مدل را بچرخان و از زوایای مختلف ببین</p>
        </div>
        <span className="rounded-full border border-amber-200/40 bg-amber-300/15 px-2 py-1 text-[10px] font-bold text-amber-100">۳D</span>
      </div>
      <div className="rounded-2xl border border-white/10 bg-white/5 p-2">
        <CarRender variant={variant} paint={paint} />
        <div className="flex items-center justify-between px-1 pb-1">
          <div>
            <p className="text-sm font-black text-white">{active?.name ?? "خودرو"}</p>
            <p className="text-[10px] font-bold text-white/60">{active?.description ?? "مدل سه‌بعدی"}</p>
          </div>
          <span className="rounded-xl bg-white/10 px-2 py-1 text-[10px] font-bold text-white/80">پیش‌نمایش زنده</span>
        </div>
      </div>
      <div className="mt-2 grid grid-cols-2 gap-2 sm:grid-cols-4">
        {vehicles.map((car) => (
          <button key={car.id} type="button" onClick={() => setSelectedId(car.id)} className={`rounded-xl border px-2 py-2 text-xs font-extrabold transition ${selectedId === car.id ? "border-amber-200 bg-amber-300 text-[#30261b] shadow-md" : "border-white/15 bg-white/10 text-white hover:bg-white/15"}`}>
            <span className="block">{car.name}</span>
            <span className="mt-1 block text-[9px] opacity-70">{car.selected ? "خودروی فعلی" : car.owned ? "خریداری‌شده" : `${car.price.toLocaleString("fa-IR")} سکه`}</span>
          </button>
        ))}
      </div>
      <button type="button" disabled={!active || (active.owned && active.selected)} onClick={() => active && (active.owned ? onSelect(active.id) : onBuy(active.id))} className="fc-btn mt-3 w-full rounded-2xl border border-amber-100 bg-gradient-to-r from-[#ffe8a1] via-[#f2b705] to-[#d88a18] py-3 text-sm font-black text-[#34271c] disabled:cursor-default disabled:opacity-60">
        {!active ? "خودرویی موجود نیست" : active.selected ? "این خودرو انتخاب شده ✓" : active.owned ? "انتخاب و رانندگی با این خودرو" : `خرید ${active.name} · ${active.price.toLocaleString("fa-IR")} سکه`}
      </button>
      <p className="mt-2 text-center text-[10px] font-bold leading-4 text-white/55">پیش‌نمایش رایگان است؛ فقط با زدن دکمهٔ خرید سکه کم می‌شود.</p>
    </section>
  );
}
