# Graphics Phase 36 — Car animation, suspension and chase camera

## Scope
- Add a damped chassis spring response and small speed-scaled road vibration.
- Animate wheel travel independently from chassis movement while preserving wheel spin and steering.
- Improve chase-camera follow distance, height and look-ahead as speed increases.
- Add a restrained, damped camera bank in turns; clamp the effect to protect horizon stability.
- Keep existing car physics, collision geometry, render resolution, materials, shadow settings and effects unchanged.

## Validation required
- CI lint and production build.
- Android debug APK artifact from CI.
- On-device check: wheels remain attached during acceleration, braking, reversing and turns; camera does not oscillate at rest or clip the car; no visible wheel/body separation; FPS remains stable on low/mid/high-tier phones.
- This is a visual animation pass, not a claim of AAA completion. Real-device footage and performance measurements are still required.
