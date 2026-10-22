# FunnyCar — AAA Quality Gate & Test Plan

This checklist is a measurable quality gate, not a claim that the game is already AAA. Keep all work on a feature branch until build checks and device tests pass.

## Visual acceptance

- [ ] Capture matching gameplay frames at daytime, dusk, night, and wet-road conditions.
- [ ] Inspect each player car at close, chase-camera, and side angles: body silhouette, wheel alignment, glass, headlights/brake lights, materials, and damage states.
- [ ] Inspect Iranian street identity: readable Persian signs, lane markings, sidewalks, buildings, traffic lights, roadside props, and landmarks.
- [ ] Check that road reflections remain subtle and do not make dry asphalt look wet.
- [ ] Check that particles, skid marks, smoke, and collision sparks read clearly without hiding the car or the road.
- [ ] Check HUD legibility in portrait orientation and on low-brightness screens.

## Performance and stability acceptance

- [ ] Target 60 FPS on a capable device and a stable 30 FPS fallback on lower-tier devices.
- [ ] Frame-time targets: 16.7 ms for 60 FPS; 33.3 ms for 30 FPS.
- [ ] Test a continuous 10-minute drive, including traffic, pedestrians, collision particles, and day/night transitions.
- [ ] Record average FPS, 1% low FPS (or equivalent frame-time percentile), device model, Android version, render resolution, and graphics preset.
- [ ] Verify no progressive slowdown, repeated garbage-collection stutter, WebGL context loss, crash, or black frame.
- [ ] Verify rendering recovers after backgrounding and returning to the game.
- [ ] Verify adaptive render scaling on both a high-density screen and a lower-end device.
- [ ] Compare draw calls and triangle counts with the in-game debug overlay; investigate regressions rather than relying on subjective smoothness.

## Gameplay and UX acceptance

- [ ] Steering, braking, acceleration, wheel rotation, suspension/body pitch, and camera follow remain readable and responsive.
- [ ] Camera shake feels smooth after impacts and does not create persistent jitter.
- [ ] Touch controls remain reachable and do not cover essential HUD information.
- [ ] Persian text is readable, correctly shaped, and not clipped.
- [ ] Save/load, pause/resume, restart, and returning to the menu do not lose progress or leak rendering resources.

## Build and release gates

- [ ] Lint and TypeScript checks pass.
- [ ] Production web build passes.
- [ ] Android debug APK builds and is installed/launched on a real device.
- [ ] Automated/static checks pass for the changed branch.
- [ ] No merge to `main` until the user has reviewed the build and the relevant CI checks pass.
- [ ] Cafe Bazaar release requires a separately signed release build, a permissions/privacy review, asset/license review, and device compatibility tests.

## Evidence log

For each test run, attach:
- Git commit SHA and APK artifact link
- Device model, Android version, and screen resolution
- Day/night/wet-road screenshots
- 10-minute run FPS/frame-time evidence
- Crash or console logs, if any
- Pass/fail notes and the next concrete fix

## Current known status

The previous graphics branch passed CI and produced a debug APK. Real-device visuals, sustained FPS, thermal behavior, and release-signing have not yet been verified. Therefore AAA status remains **unverified** until the evidence above is collected.
