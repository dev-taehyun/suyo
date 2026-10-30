# Suyo Shape Engine v6 — Reverse-engineering notes

## What changed at the geometric core
The earlier approximation used a superellipse (`n=4`). That is not a faithful model of Apple's continuous rounded-rectangle curve. v6 changes the default Fixed and Concentric renderer to a reconstructed UIKit-style continuous path: **three cubic Bézier segments per corner**, with empirically recovered normalized control points. The path is dimension-independent: each control point is expressed relative to its corner radius and mirrored into the four quadrants.

The coefficients are based on the independent reverse-engineering study by Liam Rosenfeld, *My Quest for the Apple Icon Shape* (2021): https://liamrosenfeld.com/posts/apple_icon_quest/ . The author compared the reconstructed path against the macOS app-icon mask at 1024×1024 and reported zero differing pixels for that target. This is strong empirical evidence for that UIKit/icon curve, not an Apple-published implementation and not proof that every SwiftUI control, window, or current iOS surface uses identical coefficients.

## Continuous curve model
Each corner uses these normalized points and controls, multiplied by its corner radius:

- Start/end extent: `1.528665`
- First cubic: `C1=(1.08849296, 0)`, `C2=(0.86840694, 0)`, `P=(0.63149379, 0.07491139)`
- Second cubic: `C1=(0.37282383, 0.16905956)`, `C2=(0.16905956, 0.37282383)`, `P=(0.07491139, 0.63149379)`
- Third cubic: `C1=(0, 0.86840694)`, `C2=(0, 1.08849296)`, `P=(0, 1.52866498)`

The same template is mirrored/rotated for top-left, top-right, bottom-right, and bottom-left. This is an actual cubic Bézier path, not a sampled squircle polygon. The renderer also applies an overlap factor based on the 1.528665 edge extent so adjacent corners do not cross on small shapes.

`data-shape-curve="superellipse"` retains the parametric superellipse as an explicit comparison mode. `Capsule` is separate and uses circular SVG arc segments, not the continuous rounded-rectangle curve.

## Fixed / Capsule / Concentric
- **Fixed:** preserves each authored corner radius, then generates the reconstructed continuous path.
- **Capsule:** uses `min(width, height) / 2` and true circular end caps.
- **Concentric:** finds the nearest explicit or recognized container and derives child radii from its resolved radii and the measured corner insets.

The default `data-shape-concentric-mode="center"` subtracts x/y insets independently. This preserves the virtual corner-center coordinates exactly when the radii are not clamped. For asymmetric padding it can produce elliptical radii; this is a geometric extension because Apple's public `RectangleCornerRadii` API exposes one scalar radius per corner.

For comparison with the literal scalar interpretation of Apple's public description (“container corner radius minus the distance from the frame corner to the container corner”), `data-shape-concentric-mode="distance"` uses Euclidean distance (`hypot(dx,dy)`) and a scalar-radius reduction. Apple's public documentation does not spell out the norm used for arbitrary asymmetric x/y insets, so both models remain available for screenshot calibration rather than pretending that undocumented behavior is known.

The result is normalized against the continuous path's actual edge extent, not the CSS circular-radius overlap rule. Axis-aligned CSS scaling is accounted for. Rotated, skewed, and perspective-transformed concentric containers are detected and fall back to Fixed.

## Paint and runtime
Backgrounds and borders are painted on a generated pseudo-element so ordinary content and focus indicators are not indiscriminately clipped. The original host keeps its box-shadow, focus outline, interaction, and layout. Scroll/overflow containers that already clip their children (`.sheet`, `.set-group`, `.mem-list`, `.inv-list`, `.law-list`) receive the generated path on the host as well.

Trade-off: the host's native `box-shadow` still follows its native CSS border radius. It is intentionally preserved rather than replaced by a lossy drop-shadow parser. Strong shadow silhouettes may therefore differ slightly from the custom Bézier path and require a separate shadow backend for full parity.

Runtime API:
- `window.SuyoShapeEngine.refresh()` — recalculate all registered shapes.
- `window.SuyoShapeEngine.inspect(element)` — inspect mode, curve, dimensions, resolved radii, parent offsets, center residual, and path commands.
- `window.SuyoShapeEngine.audit()` — report unprocessed visible shapes, missing concentric parents, unsupported transforms, invalid radii, and center residuals.
- `window.SuyoShapeEngine.setMode(element, "fixed" | "capsule" | "concentric", options)` — assign a shape mode. Options can include `minimum` and `corners`.

## Verification status
- JavaScript syntax checks: passed.
- ZIP integrity: passed.
- Pure geometry tests: performed for the cubic path, capsule arcs, radius normalization, equal/asymmetric insets, and scalar-distance mode.
- Actual iOS Safari/iPadOS Safari rendering and screenshot pixel comparison: not performed in this environment.
- Exact parity with every current Apple system component: not claimed; Apple's full renderer and per-surface parameters are not public.

The next empirical step is to compare `shape-lab.html` with screenshots captured from actual Apple system surfaces at known pixel dimensions, then fit the radius and shadow behavior against measured edge coordinates.
