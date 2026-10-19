# Graphics Phase 37 — Crashes, drift and particles

## Changes
- Add a bounded, directional spark burst at the actual player damage contact point.
- Vary spark count and velocity with damage intensity; sparks have short lifetimes, stronger gravity, drag, and a small ground response.
- Render sparks as velocity-aligned streaks using the existing instanced particle mesh and material path.
- Keep existing bumper detachment, debris, skid marks, and fixed-capacity tire-smoke pool. No new per-frame mesh or material allocations are introduced.

## Validation
- CI lint and production build.
- Android debug APK artifact.
- Device checks: light/heavy collisions, front/rear damage, bumper detachment, repeated collisions near particle cap, drift/braking smoke, and FPS during traffic.
- Confirm no particles persist after their lifetime and that impact sparks appear at the contact point.
- This is a collision-feedback improvement, not a claim that all effects or the overall game have reached AAA quality.
