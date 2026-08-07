# Navigation zoom model

This document is the mathematical contract for interactive zoom in Universe Map. It separates
structural equations from product calibration so navigation changes can be evaluated from traces and
invariants instead of by repeatedly tuning unrelated constants.

The model applies to the cosmic map. The Earth-observer planetarium changes field of view and remains
an isolated control mode.

## References and scope

The model builds on established zoomable-interface work:

- Jarke J. van Wijk and Wim A.A. Nuij define a perceptual metric and analytic paths for combined pan
  and zoom in [A Model for Smooth Viewing and Navigation of Large 2D Information
  Spaces](https://vanwijk.win.tue.nl/zptvcg.pdf). Their path model is appropriate for explicit camera
  flights between two known views.
- [D3 zoom interpolation](https://d3js.org/d3-interpolate/zoom) is a maintained implementation of
  that model using viewport center and visible width as the view state.
- [Cesium ScreenSpaceCameraController](https://cesium.com/learn/cesiumjs/ref-doc/ScreenSpaceCameraController.html)
  separates pointer input, inertia, movement limits, and minimum/maximum zoom distance in a
  production 3D globe controller.
- Gaia Sky documents why speed based only on the focus distance can produce an excessive first
  movement, then derives a smooth blend of focus distance and closest-object distance in
  [Towards smoother interstellar trips](https://gaiasky.space/news/2025/smooth-interstellar-trips/).

These references provide the geometry and state model, not universal sensitivity values. Device
normalization, maximum speed, and the preferred pan/zoom trade-off remain calibrated UX parameters.

## View scale

For a perspective camera at distance `d` from its navigation plane and vertical field of view
`theta`, the visible world height is

```text
w = 2 d tan(theta / 2)
```

`w`, not raw camera distance, is the fundamental scale. In the cosmic map `theta` is fixed, so
`log(w2 / w1) = log(d2 / d1)` and distance is a valid implementation coordinate. The explicit use of
`w` keeps the model valid if field of view later changes. It also lets the Earth-observer controller
use the same scale definition while changing `theta` instead of `d`.

## Interactive wheel law

After device normalization, wheel input `Delta` changes scale in logarithmic space:

```text
lambda = kappa Delta
w1 = w0 exp(lambda)
```

Positive input increases the visible extent and negative input decreases it. This law gives four
required properties by construction:

```text
composition:   Z(a) Z(b) = Z(a + b)
reciprocity:   Z(a) Z(-a) = 1
scale parity:  equal input changes every scale by the same ratio
continuity:    no finite input produces a scale jump
```

`kappa`, the maximum octaves per impulse, and the maximum octaves per second are the only current
wheel calibration values. They live in
`client/src/engine/camera/zoom-model.config.json`; equations remain in `zoom-physics.ts`. The input
normalizer may depend on event timing and device `deltaMode`, but the camera kinematics must depend
only on the resulting normalized input.

## Pointer invariant

Let `A` be either the world point obtained by intersecting the pointer ray with the navigation plane
or the exact world position of the navigable object locked at the start of an inward wheel burst.
Let `C` be the camera position, `T` the geometric orbit pivot, and `r = exp(lambda)`.
Pointer-directed zoom is the affine transform

```text
C1 = A + r (C0 - A)
T1 = A + r (T0 - A)
```

Under a fixed perspective projection, `A` remains under the same screen pixel. A new wheel target
deliberately replaces the navigation-plane anchor with its object position once, then retains that
anchor throughout the burst. Hierarchy and LOD changes must not replace it mid-burst.

## Distance-driven reference-frame morphing

A reference-frame boundary must never add a second camera trajectory on top of pointer zoom. The
wheel remains the sole source of camera motion: changing LOD may update the logical navigation
target and its constraints, but it preserves the geometric pivot established at the start of the
wheel burst.

Visual representations instead converge as deterministic functions of camera distance. During the
Milky-Way-to-stellar transition, the external procedural volume, granular Galactic layer, local
panorama, registered nearby stars, and streamed catalogue cross-fade over overlapping intervals.
The local catalogue remains compact and contained in the Galactic disc at the outer end, then
unfolds into its readable stellar projection over `3,600 -> 700`. Scene catalogues and registered
objects use the same distance-derived transform without an additional time-domain lag.

This separation is deliberate:

- input chooses the path and preserves the point under the cursor;
- navigation hierarchy changes semantic context without repositioning the camera;
- rendering morphs between compatible scales around that path;
- reversing the same normalized input retraces the same geometric zoom.

No object type may install an independent wheel cadence, forced camera direction, roll, or moving
orbit pivot. Cinematic focus transitions are allowed for explicit commands, but they end before a
wheel gesture begins and cannot participate in a semantic scale crossing.

## One coordinate across the minimum-distance boundary

A minimum distance is a geometric boundary, not a second input law. While an object remains the
locked wheel target, its boundary is a hard stop. Empty-space input may release that target and enter
free travel. For this released state, define a signed navigation coordinate `zeta` and a non-negative
minimum-traversal debt `tau`:

```text
zeta = log(d / d_min) - tau
zeta1 = zeta0 + kappa Delta
```

Resolve it as follows:

```text
if zeta >= 0:  d = d_min exp(zeta), tau = 0
if zeta <  0:  d = d_min,           tau = -zeta
```

The upper coordinate is clamped to `log(d_max / d_min)`. The lower coordinate is not clamped because
it records how far the user has travelled beyond the magnification floor. Reversing input first
reduces `tau`; distance zoom cannot resume while `tau > 0`. This is the state-machine form of the
reversibility fix already applied by `MinimumDistanceTraversal`.

When pointer direction changes during free travel, the controller records each translation vector.
The scalar debt above determines how much input each vector consumes, and the LIFO vector history
restores the exact spatial path. Floating-origin rebasing translates the stored vectors' anchors but
does not change `zeta`.

## Free-travel speed field

The scalar coordinate does not by itself choose how many world units correspond to one unit of
`tau`. Spatial travel is the integral

```text
dC / d tau = S(C, scene) q
```

where `q` is the normalized pointer-ray direction and `S` is a scene scale. The current bounded UX
calibration separates a contextual base `B` from a multiplier `m(tau)`:

```text
B(d_min) = max(1,800, 8 d_min)
R = 0.5
M = 4

m(tau) = 1 + (M - 1) tau / R    for 0 <= tau < R
m(tau) = M                       for tau >= R
S(tau, d_min) = B(d_min) m(tau)
```

Travel uses the analytic integral of `S`, evaluated between the previous and next `tau`. It is
therefore continuous, bounded, and composable even when a browser splits one physical gesture into
different wheel-event batches. Rewinding the recorded vector segments restores that same integral
in reverse. In the Solar System frame, a first normalized `-12` sample travels about `2.28 AU`; a
strong initial impulse travels about `13.1 AU`; sustained input eventually reaches four times the
base rate. These are explicitly interaction-calibration values, not physical or literature-derived
constants.

The base remains provisional because one universal contextual floor cannot be ideal near a moon,
between planets, and between stars.

While an explicit target remains active, wheel input routed to the pointer applies a symmetric `3x`
maximum multiplier to the local logarithmic zoom amount. Over the final three distance octaves
before the active minimum, a logarithmic smoothstep reduces that multiplier continuously to the
standard `1x` object rate. An object anchor therefore keeps the semantic-scale cadence, while the
empty-space approach reaches the same rate before its minimum-distance handoff instead of changing
gear at the boundary. The same resolved multiplier is recorded when rewinding a local approach, so
its inward transformation remains exactly reversible. Observer presentation keeps its dedicated
rate, and a target released at its minimum distance uses the separate free-travel acceleration
above. The debug trace continues to expose the unmultiplied normalized input; `3x` and the
three-octave taper are interaction-calibration values, not scientific data.

The adaptive minimum used while approaching a newly intercepted target is recomputed inside every
wheel transformation. It must not depend on the next rendered frame: a high-frequency burst may
otherwise reuse a stale floor, report `minimum`, and stop before reaching the object's actual
boundary.

That adaptive value is also bounded by 32 units in the last place at the current camera/pivot
coordinate magnitude. Below that separation, the two absolute positions and their direction cannot
survive the affine pointer transform reliably. If an empty-space route reaches this numerical floor
while the logical object is still farther than its contextual boundary, the approach is ended and
the next inward sample releases the target into free travel without registering it for automatic
restoration. Restoration is reserved for a target actually reached at its object boundary. The ULP
margin is a numerical safety calibration, not astronomical data.

Once minimum traversal starts, camera and pivot are no longer translated as two independent
absolute points. The controller preserves their relative view vector, translates the camera once,
then reconstructs the pivot from that vector. Minimum-distance comparisons accept the four-ULP
write-back band at the current coordinate magnitude. When floating origin recenters the scene, that
temporary large-coordinate error is removed and the same view direction is projected back onto the
exact minimum. This prevents a representational wobble from repeatedly re-entering distance zoom or
changing the free-travel path.

The target model follows the Gaia Sky approach. Let `d_c` be distance to the closest relevant object,
`d_f` distance to the explicit focus or contextual landmark, and `d0 < d1` a smoothing interval:

```text
a = clamp((d_c - d0) / (d1 - d0), 0, 1)
S = mix(d_c, d_f, smoothstep(a))
```

Near an object, local clearance limits the first movement. Farther away, focus/context distance
allows acceleration across astronomical gaps. Implementing this requires a stable nearest-relevant-
object query from the spatial indexes. That future scene-aware field should replace the current
bounded `tau` calibration, while preserving its continuity, composability, and reversal invariants.

## Semantic scales and LOD

Semantic levels are thresholds on the same scale coordinate:

```text
zeta_i = log(w_i / w_min)
```

They may trigger representation, label, reference-frame, or hierarchy changes with hysteresis, but
they must not redefine camera velocity. The current `SemanticZoomJourney` instead assigns 480 input
units to every interval, even though the intervals have very different logarithmic widths:

| Distance interval  | Width (octaves) | Input required by `kappa` | Current fixed input |
| ------------------ | --------------: | ------------------------: | ------------------: |
| 4.8 -> 520         |           6.759 |                   3,123.5 |                 480 |
| 520 -> 1,400       |           1.429 |                     660.3 |                 480 |
| 1,400 -> 3,600     |           1.363 |                     629.6 |                 480 |
| 3,600 -> 17,000    |           2.239 |                   1,034.9 |                 480 |
| 17,000 -> 120,000  |           2.819 |                   1,302.9 |                 480 |
| 120,000 -> 420,000 |           1.807 |                     835.2 |                 480 |
| 420,000 -> 600,000 |           0.515 |                     237.8 |                 480 |

Consequently, effective logarithmic velocity varies by more than a factor of 13 between intervals.
This is the next structural migration: retain the semantic thresholds and existing LOD hysteresis,
but advance distance only through `zeta`.

## Automatic focus transitions

Wheel interaction directly integrates `zeta` and remains immediately interruptible. Explicit focus,
search, and scale-shortcut flights have known start and end views; those transitions should use a
van Wijk-Nuij path over projected center and visible extent. A 3D orientation interpolation remains
separate from the view-scale path. Fixed-duration, independently interpolated position and distance
are retained only until that path is implemented and tested.

## Executable invariants

Every implementation must satisfy these properties outside deliberate clamping:

1. `Delta` split across any number of camera-model steps produces the same final `zeta`.
2. Applying `Delta` and then `-Delta` restores scale and the recorded pointer path.
3. The pointer anchor's normalized device coordinates remain invariant during one zoom transform.
4. Crossing `d_min` consumes only the residual logarithmic input and introduces no jump.
5. Distance remains `d_min`, within the current local-ULP write-back band, until all
   minimum-traversal debt is repaid.
6. LOD changes do not change camera position, geometric pivot, or unconsumed input.
7. Floating-origin shifts do not change visible extent, camera-target direction, or `zeta`; an
   active minimum traversal is reprojected onto exact `d_min` once recentered.
8. Normalized high-rate input respects the configured octave-per-second bound.
9. Free-travel speed is continuous, reaches no more than four times its contextual base, and is
   independent of wheel-event batching.
10. Camera/pivot separation never falls below its locally representable floor while an unreached
    logical target prevents minimum traversal.

`zoom-physics.spec.ts`, `minimum-distance-traversal.spec.ts`, and
`camera-zoom-controller.spec.ts` exercise the pure equations and controller state. The trace auditor
can be run after copying a debug trace:

```bash
cd client
npm run debug:navigation:audit
# or: node tools/audit-navigation-zoom.mjs path/to/navigation-wheel-trace.json
```

For the captured Pluto journey, sequences 677-728 contain 717.490510 normalized inward units and
sequences 729-760 contain only 483.476627 outward units. The unified coordinate therefore retains a
logarithmic debt of approximately 0.351021 and predicts distance `0.3584` at sequence 760. The capture
instead resumes distance zoom at sequence 729 and ends at `4.965683`; the auditor reports that exact
first violation. A fresh trace produced by the corrected controller must remain at the minimum until
the remaining debt has been unwound.

## Migration order

1. Keep trace capture, the pure coordinate equations, and invariant tests as the baseline.
2. Replace fixed-input semantic interpolation with continuous `zeta`; retain thresholds and LOD
   hysteresis.
3. Add the nearest-relevant-object scale query and replace the provisional base/ramp calibration by
   the smooth scene scale field.
4. Replace explicit focus transitions with the van Wijk-Nuij projected-view path.
5. Calibrate only the isolated UX parameters on a device matrix, reporting octaves per gesture,
   octaves per second, pointer drift, boundary continuity, and round-trip error.

No later phase should be tuned before the preceding invariants pass on synthetic cases and captured
browser traces.
