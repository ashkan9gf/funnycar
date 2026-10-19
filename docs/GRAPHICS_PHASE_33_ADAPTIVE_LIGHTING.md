# Graphics Phase 33 — Adaptive Lighting, Shadows & Reflections

## Scope
This pass tunes the existing Three.js renderer without changing vehicle physics, controls, save data, or game rules.

## Changes
- Selects a shadow budget once at renderer startup from available WebGL texture limits and coarse device hints.
- Low-end devices use a 1024² shadow map and refresh it every 4 frames to reduce GPU work.
- Standard devices retain the 2048² shadow map and refresh every 3 frames.
- Devices reporting both high CPU parallelism and at least 8 GB device memory retain 2048² shadows and refresh every 2 frames for lower shadow-update latency.
- Adds a modest normal bias and radius per profile to reduce shadow acne while avoiding an expensive soft-shadow implementation.
- Keeps the existing PMREM environment, day/night light color, exposure, fog, and road reflection response intact.

## Safety and fallback behavior
- If device memory is not exposed by the browser, it is treated as unknown rather than automatically classifying the phone as low-end.
- If capability hints are unavailable, the standard profile is used unless the core count or WebGL texture limit indicates a constrained device.
- No GPU renderer strings are read, and no extra lights, post-processing passes, or per-frame allocations are introduced by the profile selector.
- Shadow quality is selected at startup; the profile does not oscillate during gameplay.

## Validation status
- Source change committed on `graphics/phase-33-adaptive-lighting-shadows`.
- CI build, lint/type checks, E2E, and artifact creation must pass before this phase is considered build-validated.
- Real-device validation is still required: compare close vehicle shadows, moving shadows while driving, dusk/night lighting, temperature, and frame pacing on at least one low/mid-range and one higher-end Android phone.
- This pass alone does not establish AAA quality. Art quality, material response, frame-time stability, and device screenshots remain separate acceptance gates.
