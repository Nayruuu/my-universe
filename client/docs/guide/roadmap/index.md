---
title: Roadmap
description: See what Universe Map has delivered, what is being improved now, and which scientific and performance work remains deliberately deferred.
---

# Roadmap

_Last reviewed: 28 August 2026._

This page is the canonical public roadmap for Universe Map. It describes outcomes and evidence gates
rather than promising release dates. Scientific accuracy, readable navigation, stable frame time,
and a fully static browser architecture remain constraints for every item.

## How to read the roadmap

| Status    | Meaning                                                                  |
| --------- | ------------------------------------------------------------------------ |
| Delivered | Available in the current application and covered by automated tests      |
| Current   | The next improvements to the existing experience                         |
| Next      | Work that first needs a scientific contract or physical measurements     |
| Deferred  | Useful only when new evidence, source data, or a denser catalogue exists |

## Delivered

- The **Earth-observer planetarium** provides a freely pannable 10,000-star HYG sky, modern
  constellations, altitude and azimuth, a 102°–2° pointer-anchored field of view, 461 URL-restorable
  observing places, consent-based browser geolocation rounded to three decimal degrees, and
  illustrative local scene contexts.
- An on-demand local observation planner ranks the visible Moon, planets, and catalogued satellites
  by altitude and evaluates the 48 brightest catalogue stars to propose up to eight visible stars.
  Selecting a suggestion opens its existing details and recentres the sky. Calculated horizon and
  terrain obstruction are applied when available. The active target now has a calculated 24-hour
  altitude curve with rise, culmination, set, USNO twilight bands, Moon interference, an explicitly
  illustrative best-window index, and an action that moves both shared time and camera. The curve
  target can be replaced from the same local catalogue without moving the current sky; only that
  action commits the target, shared time, and camera. A compact comparison applies the same
  calculation to seven consecutive nights; selecting one moves directly to that night's best instant,
  locally refined to five-minute resolution. Live weather, light pollution, and unsurveyed local
  obstacles remain outside the model.
- Every fixed catalogue location has a 360° obstruction profile calculated from the authoritative
  NOAA/NCEI ETOPO 2022 v1 60-arc-second surface-relief product. The compact profiles load lazily and
  can hide stars, the Moon, planets, and satellites behind modelled terrain; buildings, vegetation,
  microrelief, and custom-coordinate locations remain explicitly outside that model. Three calculated
  envelopes (0–30, 30–100, and 100–300 km) give the silhouette depth; colour and lighting are
  stylistic.
- The Moon, seven visible planets, and twenty other catalogued satellites reuse their existing
  Three.js objects, materials, lighting, and deferred textures in the observer view. Topocentric
  directions and angular diameters use physical orbital distances: Galilean positions are calculated,
  while the sixteen mean-J2000-element paths remain labelled extrapolated. Satellite markers appear
  from a 12° field of view, or immediately when targeted, to avoid overlap at wide angles; the bounded
  readability floor remains explicitly illustrative.
- Stellar points and the Milky Way now gain useful detail continuously under zoom instead of relying
  on a fixed pixel footprint. Navigation also clears stale targets and selections when their visual
  context disappears.
- HYG J2000 Cartesian velocities now propagate the shared star catalogue, observer sky, and
  constellation figures through time with explicit extrapolated confidence and a ±10,000-Julian-year
  validity clamp.
- The **Received light** temporal mode now treats the selected date as reception time. It backdates
  the Sun, Moon, and planets from an Earth observer with Astronomy Engine, and solves an individual
  retarded epoch for every HYG star from the Solar System barycentre. Supported axial rotations use
  that emission epoch, object cards expose delay and emission date, and the HYG model keeps its
  explicit ±10,000-Julian-year clamp.
- Galilean moons now use Astronomy Engine at their Earth-received epoch. Other documented
  satellites, dwarf planets, asteroids, and comets iteratively solve geometric light time with their
  existing JPL two-body elements; their confidence remains extrapolated and visual distance
  amplification stays outside the scientific calculation.
- Documented exoplanet systems now share a barycentric delay derived from the NASA-published host
  distance. The static host direction is unchanged, and each local planetary orbit is evaluated at
  that emission epoch while its phase remains explicitly illustrative; systems without a published
  distance stay simultaneous.
- Nearby galaxies now use geometric catalogue light time. Cosmicflows-4 distance moduli are treated
  as luminosity distances and large-scale-structure map distances as comoving distances; both are
  inverted in the documented flat ΛCDM model. Cards expose the inferred redshift and lookback time,
  while catalogue positions and static appearances remain unchanged and the result is marked
  extrapolated.
- Published walls, probabilistic basins, attractors, and repellers retain separate provenance and
  visual semantics rather than being merged into the Tempel filament network.
- Cold startup, Tempel transition, resource stability, and frame stability have repeatable browser
  benchmarks.
- A repeated physical high-end baseline now records three startup, Tempel, and cold-frame runs plus
  three post-warmup resource cycles on an Apple M5 Max using its real Metal renderer. It is not
  evidence for another device class.
- A dedicated observable-planetarium benchmark now covers real sky panning, recentering, a
  Jupiter-anchored transition into the shared resolved planet, and zoom-out. Three physical
  high-end Retina runs passed at the high-quality DPR 1.5 cap with no long frames. A separate,
  explicitly simulated CPU 4×/6× stress matrix also passes and measures regression headroom only.
- All five manual performance protocols now share a versioned JSON evidence report that records the
  source state, host, renderer, configuration, samples, and summary. A physical-only guard rejects
  simulated, software-rendered, or unclassified measurements before writing the report. A
  clean-checkout campaign runner executes them sequentially and binds the five files into one
  SHA-256-verifiable manifest.
- A separate clean-checkout command now runs the same-host medium and low regression campaign across
  all five protocols: medium quality at CPU 4× and low quality at CPU 6×. Its distinct simulated
  manifest binds ten reports and states that GPU, memory, driver, bandwidth, and thermal behavior
  still belong to the source host.
- The four complementary catalogues now fetch and decode in a dedicated module Worker and transfer
  their typed-array buffers without copying. Worker preparation creates no scene resource; once it
  finishes, main-thread registry, search, geometry, and GPU installation requires a fresh 1.2-second
  stable-camera window. A transition restarts that delay, observable mode suspends background
  installation entirely, and an explicitly requested catalogue target still loads immediately.
  The clean revision-level campaign now passes all ten reports. Medium/CPU 4× scale runs remain at
  9.3 ms p95 with a 66.5 ms worst frame; low/CPU 6× remains at 16.6–16.7 ms p95 with an 83.4 ms
  worst frame. Observable runs resolve Jupiter 3/3 in both profiles, and resource counts do not drift.

## Current priorities

- Keep the clean 10/10 simulated manifest as the regression baseline and repeat it after material
  rendering or catalogue changes. The current evidence does not justify a heavier shader-precompile
  path or a lower-fidelity fallback. Physical validation remains optional if suitable medium/low
  hardware becomes available. Simulated profiles remain regression gates, not device claims.

The observer planetarium remains a separate topocentric projection of the selected observing place.
The temporal Received light map uses an Earth observer for supported Solar System bodies and the
Solar System barycentre for HYG stars and documented exoplanet systems.

## Deliberately deferred

- The prepared stellar aggregate hierarchy stays dormant until a denser source catalogue needs a
  visible cross-scale representation. Any activation must move preparation to a Web Worker and avoid
  invisible network or GPU work.
- Additional irregular-body silhouettes or polygonal models will only ship when an authoritative
  shape product justifies the download, decoding, attribution, and rendering cost.

## Product boundary

This roadmap does not promise an exhaustive Universe, live weather, ground exploration, full
gravitational simulation, or relativistic ray tracing. See [Scientific confidence](/scientific-confidence/)
and [Performance and limits](/performance-and-limits/) for the current contract.

Continue with [About the project](/about/).
