---
title: Roadmap
description: See what Universe Map has delivered, what is being improved now, and which scientific and performance work remains deliberately deferred.
---

# Roadmap

_Last reviewed: 3 September 2026._

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
  calculation to seven consecutive nights. It automatically highlights the strongest night with a
  comparable illustrative index out of 100 and exposes altitude, darkness, moonlight, and terrain
  clearance before its direct action moves to the best instant, locally refined to five-minute
  resolution. Live weather, light pollution, and unsurveyed local obstacles remain outside the model.
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
  context disappears. During Galactic entry, the camera pivot travels continuously from the
  Galactic centre to the Sun while the external volume, stellar catalogue, and local panoramic band
  cross-fade without a reference-frame cut. This reversible path starts in the nearby Universe and
  does not launch a camera recenter at hierarchy changes. Its pivot and elevation are evaluated
  directly from distance: they stop with the wheel and retrace the same curve in reverse, with no
  catch-up that could make the stars bounce. The Gaia volume now stays compact throughout the
  external approach, then unfolds its reference frame from 3,600 to 2,400 units while the catalogues stay
  masked. After a short hidden buffer, HYG, Gaia, exoplanet hosts, and constellations appear from 2,200
  to 520 units in an already stable frame, so zoom no longer makes their stars slide. Galactic
  brightness also remains bounded across viewing inclinations.
- The structural Milky Way calibration now separates its canonical physical and coordinate metric
  from its explicitly illustrative luminous envelope. At Galactic entry, that envelope reaches four times
  the canonical diameter and grows over the complete logarithmic approach, while camera distances,
  wheel response, picking, and catalogue placement remain unchanged. To make the crossing perceptible
  without slowing the camera, the same batched point cloud includes 140,000 deterministic,
  illustrative tracers: 28,000 remain spread through the galactocentric thick disc, 56,000 form a
  curved rotationally symmetric entry shell, and 56,000 form a narrower near-passage core. Every
  quality tier covers the complete radius and azimuth of that core, avoiding empty stretches along
  the route. All positions remain static; only the closest sprites acquire a short trail while the
  camera distance changes and become round again at rest. Their apparent sweep is the perspective cue
  produced while the camera crosses the continuously scaled illustrative Galactic frame. During that crossing, the
  ray-marched veil now starts receding at 9,000 units and yields at 1,200 units, while soft morphology
  particles recede before distant tracers. The tracer proximity field now opens earlier around the
  route, keeps a readable crisp-pixel floor, and compensates lower-density quality profiles without
  allocating more particles. This leaves separated stars moving through several depth planes instead
  of a uniform dusty grain or a late, abrupt reveal. Local Group galaxy annotations now fade
  before the dense crossing while the active target remains readable. The tracers are not catalogued
  individual stars. The white volume component is now explicitly treated as illustrative integrated
  light from unresolved stars, not dust: its continuous inter-arm pedestal is reduced while arms,
  filaments, and clumps retain separated highlights and dark gaps. The colour pass now separates
  warm-ivory integrated light, sapphire and cyan young populations, an amber core, magenta H II
  accents, and near-black dust. It reinforces chroma locally instead of saturating the background. A
  restrained sapphire/cyan/ivory/amber/red temperature sequence in the point-star floor also closes
  the 1,400–2,800-unit handoff without restoring a diffuse dusty veil. These stars remain an
  explicitly procedural, decorative population rather than individually catalogued sources. A
  depth-weighted luminance pass now lifts discrete stellar cores, strongest for near-passage tracers,
  while preserving the black inter-star field.
  The exterior pass now adds one 12,000/26,000/48,000-point GPU batch of sparse stars around the disc
  according to quality, with one eighth arranged into 48 compact globular-like concentrations. This
  flattened envelope stays fixed in the Galactic frame for perspective-only parallax and fades out
  before the Solar neighborhood. It is explicitly illustrative and uncatalogued, with no fog or
  diffuse emission. A separate camera-centred pass now adds 10,000/24,000/52,000 extended galaxy
  impostors around the Galactic approach. Their varied elliptical, spiral, and irregular profiles
  form an explicitly illustrative representative sample—not a catalogue or literal galaxy count—
  with an analytic Galactic zone of avoidance and no translational parallax. The Cosmicflows depth
  bridge now uses inclined, multi-lobed unresolved group light instead of circular star-like marks.
  The structural pass narrows and strengthens leading-edge
  and paired bar dust lanes, removes most of the diffuse thick-disc pedestal, and composites their
  near-black extinction after the additive stellar batch. A compact ivory nucleus inside the amber bar
  now remains distinct from both the dust and the surrounding arm light.
- A Gaia DR3 hierarchy turns 2,923,790 quality-filtered sources into distant calculated 512 pc
  aggregates and 133,526 measured-source samples for the stellar-neighborhood overview. Each
  refined 512 pc leaf retains its 32 brightest sources plus a deterministic uniform selection, up
  to 96 points. Frustum- and quality-bounded refinement fetches only visible branches, validates
  them in module Workers, transfers typed arrays without copying, and never creates one Three.js
  object per source. Exact search, labels, selection, and focus remain on HYG; Gaia samples are
  explicitly anonymous and incomplete. Under zoom-out, detailed samples cross-fade into calculated
  roots, which remain as a restrained bridge through the Local Group while the local volume follows
  a logarithmic scale blend into the Milky Way disc.
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

- Finish the Milky Way visual calibration against the reference passage. Interior clarity,
  integrated-light separation, stellar handoff, quality-density compensation, sparse exterior
  surroundings, near-black dust lanes, the compact core, and the structured
  sapphire/cyan/amber/magenta palette are now in place. The next pass compares arm/core/halo balance
  against the reference footage, then captures final entry, rest, and reverse checkpoints. Canonical
  physical distances remain unchanged.
- Keep the clean 10/10 simulated manifest as the regression baseline and repeat it after material
  rendering or catalogue changes. The current evidence does not justify a heavier shader-precompile
  path or a lower-fidelity fallback. Physical validation remains optional if suitable medium/low
  hardware becomes available. Simulated profiles remain regression gates, not device claims.

The observer planetarium remains a separate topocentric projection of the selected observing place.
The temporal Received light map uses an Earth observer for supported Solar System bodies and the
Solar System barycentre for HYG stars and documented exoplanet systems.

## Deliberately deferred

- Additional irregular-body silhouettes or polygonal models will only ship when an authoritative
  shape product justifies the download, decoding, attribution, and rendering cost.

## Product boundary

This roadmap does not promise an exhaustive Universe, live weather, ground exploration, full
gravitational simulation, or relativistic ray tracing. See [Scientific confidence](/scientific-confidence/)
and [Performance and limits](/performance-and-limits/) for the current contract.

Continue with [About the project](/about/).
