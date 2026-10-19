# Graphics phase 39 — Android WebGL recovery

## Changes
- Detect WebGL context loss on the renderer canvas and call `preventDefault()` so the browser can attempt restoration.
- Pause only the Three.js render call while the context is unavailable; the surrounding game loop and 2D overlay continue.
- On restoration, resume rendering and request a fresh shadow-map update.
- Remove event listeners during renderer disposal to avoid stale canvas references.

## Validation
- CI lint, production build, and Android debug APK must pass.
- On supported Android devices, background/resume the app and test a controlled WebGL context loss/restoration where tooling permits.
- Confirm the game loop, HUD, camera, and shadows recover without a reload; repeat resize/orientation changes afterward.
- Actual device validation is required: browsers and WebViews differ in whether and when context restoration succeeds.

This is a compatibility safeguard, not a guarantee that every context-loss scenario is recoverable or a claim of AAA completion.
