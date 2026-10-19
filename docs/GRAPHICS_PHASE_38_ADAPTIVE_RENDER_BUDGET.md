# Graphics phase 38 — adaptive render-buffer budget

## Goal
Reduce GPU fill-rate and framebuffer memory pressure on lower-end Android devices without removing world geometry, reducing texture assets, or changing the overlay resolution.

## Implementation
- Select a conservative render-buffer pixel budget from available hardware concurrency and optional `navigator.deviceMemory`.
- Low-end: 1.45 megapixels; standard/unknown: 2.3 megapixels; high-end: 3.6 megapixels.
- Keep full resolution when the input buffer is already under the tier budget; never upscale.
- Clamp downscaling to 0.72 to avoid unexpectedly soft output on very large screens.
- Scale only the WebGL renderer drawing buffer. Keep overlay canvas dimensions, camera aspect calculation, world geometry, textures, shadow settings, and gameplay unchanged.

## Validation required
- CI lint, production build, and Android debug APK.
- Compare portrait and landscape layouts at DPR 1, 2, and 3; ensure HUD/minimap remain aligned with the 3D canvas.
- Verify small phones retain crisp output, larger screens avoid excessive framebuffer size, and camera aspect/FOV remains unchanged.
- Check memory use and frame pacing on low-, mid-, and high-tier Android hardware.

This is a measured performance safeguard, not a claim of AAA quality or proof of device FPS. Hardware testing is still required.
