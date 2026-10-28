// تزریق ابزار تشخیص دقیق لگ — Task 45
// جمع‌آوری: renderer.info، آمار صحنه، نمونه‌برداری زمان فریم
(() => {
  if (window.__perfdiag) { window.__perfdiag.reset(); return 'already'; }
  const fc = window.__funnycar;
  const r3 = fc.renderer3d;
  const renderer = r3.r3;

  const diag = {
    t0: performance.now(),
    frames: 0,
    // نمونه‌های زمان فریم (ms)
    samples: [],
    maxSamples: 900,
    // پرف‌کانتر هر فریم
    calls: [], tris: [],
    // نتایج
    sceneStats: null,
    heaviest: null,
    shadowInfo: null,
    programInfo: null,
  };

  diag.reset = () => { diag.samples.length = 0; diag.frames = 0; diag.t0 = performance.now(); };

  // ۱) آمار کامل صحنه — یک‌بار
  diag.analyzeScene = () => {
    let mesh = 0, instanced = 0, points = 0, lines = 0, sprites = 0, groups = 0, others = 0;
    let castShadow = 0, receiveShadow = 0, visible = 0, invisible = 0;
    const matSet = new Set(), geomSet = new Set(), texSet = new Set();
    const matUseCount = new Map(), geomUseCount = new Map();
    let trisTotal = 0;
    const lights = [];
    const byName = new Map(); // نام پایه → {count, tris, castShadow}

    r3.scene.traverse((o) => {
      const t = o.type;
      if (t === 'Mesh') {
        mesh++;
        if (o.isInstancedMesh) instanced++;
        if (o.castShadow) castShadow++;
        if (o.receiveShadow) receiveShadow++;
        if (o.visible) visible++; else invisible++;
        const g = o.geometry;
        if (g) {
          geomSet.add(g);
          const k = g.uuid;
          geomUseCount.set(k, (geomUseCount.get(k) || 0) + 1);
          const idx = g.index;
          const n = idx ? idx.count / 3 : (g.attributes.position ? g.attributes.position.count / 3 : 0);
          trisTotal += o.isInstancedMesh ? n * o.count : n;
          // نام پایه برای گروه‌بندی
          let name = o.name || '(unnamed)';
          name = name.replace(/[\(\)\d\.\-_]+$/, '').replace(/__\d+/, '') || '(unnamed)';
          let nm = byName.get(name);
          if (!nm) { nm = { count: 0, tris: 0, cast: 0, inst: 0 }; byName.set(name, nm); }
          nm.count++;
          nm.tris += (o.isInstancedMesh ? n * o.count : n);
          if (o.castShadow) nm.cast++;
          if (o.isInstancedMesh) nm.inst++;
        }
      } else if (t === 'Points') points++;
      else if (t === 'Line' || t === 'LineSegments' || t === 'LineLoop') lines++;
      else if (t === 'Sprite') sprites++;
      else if (t === 'Group' || t === 'Object3D') groups++;
      else others++;
      if (o.isLight) lights.push({ type: t, castShadow: !!o.castShadow, intensity: o.intensity, color: o.color && o.color.getHexString(), mapSize: o.shadow && o.shadow.mapSize ? o.shadow.mapSize.x : 0 });
      if (o.material) {
        const mats = Array.isArray(o.material) ? o.material : [o.material];
        for (const m of mats) {
          matSet.add(m);
          matUseCount.set(m.uuid, (matUseCount.get(m.uuid) || 0) + 1);
          for (const key in m) {
            const v = m[key];
            if (v && v.isTexture) texSet.add(v);
          }
        }
      }
    });

    // سنگین‌ترین گروه‌ها بر اساس مثلث
    const heaviest = [...byName.entries()].sort((a, b) => b[1].tris - a[1].tris).slice(0, 25)
      .map(([name, s]) => ({ name, count: s.count, tris: Math.round(s.tris), cast: s.cast, inst: s.inst }));

    // متریال‌های پرتکرار (کاندید merge)
    const topMats = [...matUseCount.entries()].sort((a, b) => b[1] - a[1]).slice(0, 10).length;

    diag.sceneStats = {
      mesh, instanced, points, lines, sprites, groups, others,
      castShadow, receiveShadow, visible, invisible,
      uniqueGeoms: geomSet.size, uniqueMats: matSet.size, uniqueTex: texSet.size,
      lights: lights.length, lightDetail: lights,
      trisTotal: Math.round(trisTotal),
      topMatUseCount: topMats,
    };
    diag.heaviest = heaviest;

    // آمار دوربین/فراستوم برای culling
    diag.frustum = (() => {
      const cam = r3.r3s?.cameras ? null : null;
      return null;
    })();
    return diag.sceneStats;
  };

  // ۲) حلقه نمونه‌برداری
  let rafId = 0;
  diag.start = () => {
    const loop = () => {
      const f0 = performance.now();
      rafId = requestAnimationFrame(loop);
      // بعد از رندر واقعی بازی: اطلاعات renderer.info فریم قبل
      const info = renderer.info;
      diag.calls.push(info.render.calls);
      diag.tris.push(Math.round(info.render.triangles));
      diag.frames++;
      const dt = performance.now() - f0;
      if (diag.samples.length < diag.maxSamples) diag.samples.push(dt);
    };
    rafId = requestAnimationFrame(loop);
  };
  diag.stop = () => cancelAnimationFrame(rafId);

  // ۳) برنامه‌های شیدر و حافظه
  diag.gpu = () => ({
    programs: renderer.info.programs ? renderer.info.programs.length : 0,
    geometries: renderer.info.memory.geometries,
    textures: renderer.info.memory.textures,
    calls: renderer.info.render.calls,
    tris: Math.round(renderer.info.render.triangles),
    dpr: renderer.getPixelRatio(),
    drawSize: renderer.getSize(new (r3.scene.constructor.constructor ? Object : Object)()),
  });

  diag.shadow = () => {
    const lights = [];
    r3.scene.traverse((o) => { if (o.isLight && o.castShadow) lights.push({ type: o.type, mapSize: o.shadow.mapSize.x, near: o.shadow.camera.near, far: o.shadow.camera.far, autoUpdate: o.shadow.autoUpdate, enabled: o.shadow.map ? 'hasMap' : 'noMap' }); });
    return { shadowMapEnabled: renderer.shadowMap.enabled, type: renderer.shadowMap.type, autoUpdate: renderer.shadowMap.autoUpdate, lights };
  };

  diag.summary = () => {
    const s = diag.samples.slice().sort((a, b) => a - b);
    const avg = (arr) => arr.length ? Math.round(arr.reduce((a, b) => a + b, 0) / arr.length) : 0;
    const p = (q) => s.length ? Math.round(s[Math.floor(s.length * q)]) : 0;
    return {
      frames: diag.frames,
      durationSec: Math.round((performance.now() - diag.t0) / 100) / 10,
      frameMs: { avg: avg(diag.samples), p50: p(0.5), p90: p(0.9), p99: p(0.99), max: s.length ? Math.round(s[s.length - 1]) : 0 },
      avgCalls: avg(diag.calls), maxCalls: diag.calls.length ? Math.max(...diag.calls) : 0,
      avgTrisK: Math.round(avg(diag.tris) / 1000), maxTrisK: diag.tris.length ? Math.round(Math.max(...diag.tris) / 1000) : 0,
      gpu: diag.gpu(), shadow: diag.shadow(),
    };
  };

  window.__perfdiag = diag;
  diag.analyzeScene();
  diag.start();
  return 'diag-ready';
})();
