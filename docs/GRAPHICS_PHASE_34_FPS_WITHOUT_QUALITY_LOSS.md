# Graphics Phase 34 — FPS optimization without visual downgrade

## Scope
This pass targets avoidable CPU/JavaScript work. It does not lower render resolution, shadow-map size, material quality, geometry detail, effects, or traffic density.

## Changes
- Traffic wheel animation reuses the frame delta already sampled at the start of `draw3D`, rather than calling `drawDt()` separately for each traffic vehicle. This keeps wheel animation on a consistent frame clock and avoids repeated time sampling.
- Collected coin instances are hidden by updating their instance matrix once when their collected state changes. Previously, every collected coin's matrix was rewritten on every frame. Uncollected coins keep the same per-frame bobbing and rotation, preserving their appearance.
- The coin instance buffer is marked dirty only when at least one instance matrix changed.

## Validation
- CI lint, production build, and Android debug APK build must pass.
- On-device comparison should use the same device, scene, traffic count, camera, and day/night conditions as the previous build.
- Record average FPS and frame-time spikes before/after; inspect collected/uncollected coin visibility and traffic wheel animation.
- This is a targeted optimization, not a claim that all frame drops are solved on every phone. If drops remain, use the in-game debug panel (FPS, draw calls, triangles, geometry/texture counts, object count) to isolate GPU vs CPU pressure without lowering visual settings.
