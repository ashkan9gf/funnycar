# Graphics Phase 40 — Android Release Build Hardening

## Goal
Reduce the chance of a misleading green Android build and prevent temporary build-only changes from being left in the working tree if the export fails or is interrupted.

## Changes
- Enable Bash `pipefail` so a failing `next build` cannot be masked by the final `tail` command.
- Use a unique temporary directory instead of a fixed `/tmp/api_backup_ci` path.
- Restore `next.config.ts` and `src/app/api` through an exit trap, including normal failures and INT/TERM interruption.
- Restore temporary files immediately after the export attempt before checking the build result.
- Verify that the exported HTML is non-empty and at least one JavaScript chunk exists before Capacitor sync.
- Keep the existing APK job and app behavior unchanged.

## Validation
GitHub Actions is the source of truth for lint, production build, offline export, Android Gradle build, and APK artifact creation. A successful CI run does not replace installation and gameplay testing on a real Android device.

## Manual release smoke test
- Install the generated debug APK on a clean Android device.
- Launch offline and confirm the main menu and 3D scene load.
- Drive, steer, brake, drift, and trigger a collision.
- Background/resume the app and rotate/reopen if supported by the device.
- Verify WebGL context recovery after returning from background where the WebView/device permits it.
- Check console/logcat for fatal JS, WebGL, or Android errors.
- Confirm frame pacing and heat after 10–15 minutes on a low/mid-range device.
