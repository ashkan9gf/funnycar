# FunnyCar completion pass — honest release gate

This pass adds repeatable release packaging and real-device evidence collection. It does **not** assert AAA status merely because CI succeeds.

## Release signing

Run **Actions → FunnyCar signed Android release → Run workflow** after adding these repository Actions secrets:

- `ANDROID_SIGNING_KEY`: base64-encoded JKS/keystore file
- `ANDROID_KEY_ALIAS`
- `ANDROID_KEYSTORE_PASSWORD`
- `ANDROID_KEY_PASSWORD`

Keep the keystore and passwords private. If this app was previously published, use the existing signing key; a new key may prevent users from updating the existing installation. The workflow fails early if a required secret is missing, then builds and signs a release APK and uploads it as an artifact.

## Real-device benchmark

Connect an Android phone with USB debugging enabled and authorize the computer. Install the debug APK, start the game, enter gameplay, and run:

```bash
bash scripts/android-device-benchmark.sh com.funnycar.app 600
```

The default package ID must match `capacitor.config.json`; check it before running. Keep a demanding scene active (traffic, pedestrians, collisions/particles, night transition) for ten minutes. The report records model, Android version, display resolution/density, GraphicsInfo, memory, and thermal-service output before/after. Save screenshots and note visible stutter/crashes alongside the report. Android's thermal service is device/vendor-dependent; no script can substitute for an actual sustained phone run.

## Six completion gates

1. **Cars/cabins:** inspect every vehicle in close-up and side/chase views; check wheels, glass, headlights, brake lights, damage states, and cabin/driver. Replace remaining procedural approximations with licensed high-quality models where needed.
2. **Iranian city:** inspect readable Persian signs, facade variety, street furniture, landmarks, traffic lights, road markings, and night windows at gameplay camera distance.
3. **Effects:** verify wet/dry road distinction, rain visibility and cost, drift/skid feedback, collision sparks/smoke, and no excessive screen obstruction.
4. **HUD/menus:** verify touch targets, safe areas, text clipping, contrast, pause/resume, settings persistence, and HUD visibility on several aspect ratios.
5. **Performance/thermals:** collect ten-minute phone evidence at both high and low graphics settings. Compare frame-time/FPS and thermal state at start/end; investigate sustained degradation and context loss.
6. **Cafe Bazaar:** use a signed release APK, stable versionCode, correct icon/screenshots, privacy/permissions disclosures, asset/license inventory, and the store's current payment rules.

## Current blockers that cannot be fabricated in CI

- No connected physical Android device is available to this workflow environment, so sustained FPS and thermal results are not yet measured.
- Signing cannot run until the owner configures the four Actions secrets and supplies the correct existing keystore.
- Visual acceptance requires real gameplay screenshots; a green lint/build result is not a visual certification.
