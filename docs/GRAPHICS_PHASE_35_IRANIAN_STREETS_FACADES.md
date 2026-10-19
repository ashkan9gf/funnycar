# Graphics Phase 35 — Iranian streets, facades, and Persian signage

## Scope
Improve readability and visual finish of the existing procedural Iranian street/building assets without changing driving physics, collision, world scale, road layout, or draw-call count.

## Changes
- Street-name plaques now use a wide texture matching the in-world plaque proportions, layered reflective blue finish, double border, small reflective markers, and fitted Persian text.
- Long Persian street names are measured against the available canvas width and their font size is reduced only as needed to prevent clipping.
- Storefront/garage signs gain a restrained dark gradient, warm metallic border, inner keyline, subtle text shadow, and text fitting so shop labels remain inside the sign.
- Textures remain cached by the existing keys; no canvas generation is added to the frame loop.

## Validation
- Lint/typecheck and production build must pass.
- Android debug APK artifact must be produced before device testing.
- On-device checks: inspect short and long Persian street names at near/far distances, shop/garage labels, texture orientation, day/night readability, and frame pacing.
- This is a signage/facade polish pass, not a claim that all environment assets are AAA. Building silhouettes, texture quality, and real-device screenshots remain acceptance gates.
