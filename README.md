# Universe Map

[![Verify](https://github.com/Nayruuu/my-universe/actions/workflows/verify.yml/badge.svg)](https://github.com/Nayruuu/my-universe/actions/workflows/verify.yml)
[![Angular](https://img.shields.io/badge/Angular-21-DD0031?logo=angular)](https://angular.dev/)
[![Three.js](https://img.shields.io/badge/Three.js-r185-000000?logo=threedotjs)](https://threejs.org/)
[![License: MIT](https://img.shields.io/badge/License-MIT-7dd3fc.svg)](LICENSE)

An interactive 3D map of the Universe — explore the Solar System, nearby stars, the Milky Way, the
Local Group, the nearby Universe, and the Cosmicflows-4 cosmic web through time. Built with Angular
and Three.js, with no backend.

![Universe Map showing the Milky Way and nearby named stars](docs/assets/universe-map-preview.png)

Universe Map is a browser-only experiment at the intersection of a 3D map, a planetarium, and a
scientific visualization tool. Its long-term goal is to provide a continuous, Google Maps-like
journey across astronomical scales while clearly distinguishing measured, calculated, simulated,
and illustrative data.

> **Project status:** `v0.1.0` is a functional prototype. It prioritizes navigation, scale
> transitions, visual clarity, and scientific transparency over exhaustive astronomical coverage.

[Read the complete technical reference](docs/TECHNICAL_REFERENCE.md).

[Open the public guide](https://super-universe.app/guide/) for navigation, time, eclipses, scientific
confidence, catalogues, performance guidance, and frequently asked questions.

## Highlights

- Continuous semantic zoom from any planet, star, or galaxy group to the cosmic web, with a
  reversible parent-frame journey and pointer-directed navigation. Inward wheel input locks a
  navigable object under the pointer, adopts it as the target, and stops at its contextual distance
  floor. Empty-space input accelerates long local approaches while preserving their active target
  and the pace of named scale transitions, then can release a reached target into reversible
  constant-distance travel whose speed rises smoothly to a bounded cruise rate during a sustained
  wheel gesture.
- One persistent clickable landmark across the whole journey: the Sun through stellar scales, then
  the Milky Way through intergalactic scales, clamped to a collision-free safe position when it is
  off-camera and kept outside an open object card without changing the visual priority of the
  underlying object.
- A 41-object Solar System catalogue: the Sun, all eight planets, 21 major moons, five dwarf
  planets, four notable asteroids, and two comets. Every object has a searchable card and selectable
  orbital path. Satellite mean elements are oriented in their documented J2000 equatorial or local
  Laplace plane, while visual separation remains explicitly adaptive. In the overview, labels use
  collision-safe placement and moons inherit their parent system's stable map accent.
- Spacecraft-derived global mosaics for 23 additional surfaces from NASA/JPL and USGS products,
  deferred observed textured 3D shapes for Phobos, Deimos, Ceres, Vesta, and Bennu, an observed
  ESA/OSIRIS shape for comet 67P, and sourced triaxial fallbacks or silhouettes for six irregular
  bodies. Object cards distinguish observed or calculated structure from processed color, filled
  cartographic gaps, and illustrative surface treatment.
- A complete local snapshot of 6,333 confirmed exoplanets around 4,747 host systems from the NASA
  Exoplanet Archive, including ten richer featured planets in the Kepler-186, Kepler-22,
  Kepler-452, and TRAPPIST-1 systems. Every record is searchable and filterable without a backend;
  one GPU point batch maps the hosts, while only the focused system receives detailed Three.js
  objects. Catalogue facts remain distinct from derived or illustrative orbit dimensions, phase,
  orientation, scale, lighting, and surface appearance.
- Date-dependent IAU axial orientations for the Sun, eight planets, Moon, Phobos, Deimos, Galilean
  moons, Titan, Pluto, Ceres, and Vesta, with sourced body-fixed frames exposed in the object card.
  Atmospheres, Saturn's rings, and the active equatorial guide inherit the same orientation.
- Locally calculated planetary and lunar ephemerides with an editable UTC timeline and multiple time
  speeds.
- Responsive map panels up to 1,100 CSS pixels: a compact, expandable timeline and object cards
  with summary, preview, and expanded reading states. Cards become side panels on short landscape
  screens; controls reserve the timeline's measured height, including eclipse and received-light
  context. Search and essential actions remain reachable without changing the 3D camera.
  Cards keep their close control in the header and expose the orbit action beside orbital data
  instead of a third footer button. Received-light explanations remain in the timeline and cards
  without a redundant orange notification across the sky.
- An Earth-observer view on the shared WebGL canvas, with local apparent sky coordinates, an
  Earth-fixed horizon, azimuth and field-of-view controls, shareable observer state, and 461 static
  places across 246 countries and territories. An explicit browser-permission action can instead use
  the current position, rounded to three decimal degrees before it is stored in the shareable URL.
  Eight featured cities have hand-composed contexts; every place lazily loads four nearby landmark
  records from nine regional packs. The 461 catalogue locations also lazily load 360° terrain
  obstruction profiles calculated from the NOAA/NCEI ETOPO 2022 60 arc-second relief model. The
  skyline, buildings, lights, custom-coordinate plains, and generic silhouettes remain explicitly
  illustrative even when their facts are sourced.
  In this planetarium view, wheel and pinch change a 102°–2° field of view rather than the semantic
  map scale. Pointer-anchored zoom keeps an edge star or planet in view. Planet and Moon markers use
  locally calculated topocentric angular diameters and progressively resolve into sourced textures;
  their bounded minimum display size is explicitly illustrative. To locate Sirius from Earth, use a
  star card. Reported values include altitude, azimuth, local horizon, location, and time.
  **Return to the 3D map** lifts away from the observing place over 2.4 seconds on the same canvas:
  the initial gaze is preserved, the horizon fades, and the existing Earth becomes the map pivot.
  This camera path is illustrative. Drag, wheel, or pinch interrupts it immediately; reduced-motion
  preferences skip the animation. Ordinary map navigation is unchanged.
- A compact observed catalogue of 10,000 HYG v4.1 stars, rendered as one GPU batch with adaptive
  point sizes, a photographic Moffat-like halo, temperature-colored envelope, near-white core,
  subtle Airy ring, and quality-bounded diffraction for genuinely bright entries. Every catalogue
  point carries a stable procedural surface profile that becomes visible as its screen diameter
  grows, without leaving the single GPU draw call. Eight illustrative families distinguish
  blue-white stars, white dwarfs, yellow and orange dwarfs, red dwarfs, red giants, red
  supergiants, and brown dwarfs through color, granulation, dark cells, corona, and apparent size.
  Up to 144 collision-free names are exposed through three user-selectable density profiles, while
  one reusable active-star detail follows either the selected entry or the current wheel target and
  grows into a limb-darkened 3D surface at close focus. The 16 featured star cards resolve to their
  exact HYG J2000 entries instead of maintaining a second set of hand-authored directions.
- Six searchable historical supernovas and remnants — SN 1006, the Crab Nebula, Tycho's Supernova,
  Kepler's Supernova, Cassiopeia A, and SN 1987A — with documented J2000 positions, distances, host
  context, dates where available, and direct event replay from each information card. A
  three-layer procedural remnant — broken outer envelope, braided filaments, and sparse emission
  knots — plus a date-driven flash make the events readable without presenting the illustrative
  light curve, composite color, morphology, or expansion as measured time-resolved data.
- A local-space environment with subtle illustrative ecliptic zodiacal light and a distance-aware
  solar corona. The Earth-observer presentation alone uses a distant 32-degree Milky Way band
  built from an 8K crop of ESO/S. Brunier's observed panorama; its crop and presentation remain
  illustrative. That camera-centred photographic sphere is absent from ordinary 3D-map traversal.
  A separate quality-bounded 3,000/7,000/14,000-point unresolved background follows camera
  translations through floating-origin shifts. Its positions are procedural and its colours sample
  Gaia BP−RP statistics without identifying individual catalogue sources. This decorative shell
  is distinct from the galactocentric cloud actually crossed during entry.
- One exact 10,000-entry HYG GPU batch remains the source for named stellar rendering, search,
  selection, and focus. A separate Gaia DR3 snapshot contributes 2,923,790 quality-filtered sources
  through distant calculated 512-parsec aggregates and 133,526 deterministically selected measured
  source samples in the stellar-neighborhood overview. Only visible branches are fetched, parsed in
  module Workers, and transferred as typed arrays. Refinement inspects the tighter child-cell bounds
  rather than rejecting a branch whose broad root center is off-screen, then prioritizes the number
  of measured samples actually intersecting the view. This prevents an orbit around the Sun from
  leaving one side of the screen with only coarse aggregates. High quality can refine at most 16
  root branches while rendering them in at most two active GPU point batches plus one
  retiring cross-fade batch. Orientation-driven tile replacements retain the outgoing detailed batch
  and transfer any interrupted fade opacity, so rapid rotations do not momentarily dim the Gaia
  field. A bounded faint-source curve slightly enlarges and sharpens only dim measured samples. It
  narrows the perceived density gap between viewing directions without adding sources, moving
  coordinates, or making rotations pump the global exposure. Detailed sources become calculated
  root aggregates at galactic scale, then fade through the
  Local Group. During Galactic entry, the local reference frame unfolds while its catalogues are
  masked; HYG and measured Gaia points appear only after their world positions have stabilized, so
  zoom changes perspective without making stars slide. Every retained measured sample preserves
  its Gaia DR3 `source_id` and can be selected or focused directly from the shared GPU batch; its
  generated detail card reports the J2016.0 source position, G magnitude, measured BP−RP colour
  index, and inverse-parallax distance. Samples remain absent from global search and labels to keep
  those interfaces bounded, while calculated aggregate cells remain non-interactive because they
  do not identify one source. The `G <= 12`, parallax-S/N, BP−RP, 5 kpc, and bounded-sampling cuts
  make this local field incomplete by design.
- A point-built, explicitly illustrative Milky Way. One deterministic GPU batch draws
  144,000/168,000/336,000 samples of the same barred spiral and thick disc. These stars define the
  exterior galaxy and remain in place during entry; there is no route-specific tunnel, Solar-centred
  substitute population, analytic surface, galaxy image, or ray-marched volume. World-space point
  diameters are projected using camera depth, field of view, model scale, and the actual viewport.
  Subpixel sources retain area-weighted light; resolved samples remain fine dust-like grain within
  four-pixel antialiasing support, without halos or near-camera brightening. Individual grains fade
  smoothly as they pass the lens. This is illustrative Galactic density, not measured dust particles;
  HYG/Gaia retain their separate stellar rendering. Irregular branched filaments and a fainter interarm population leave dark
  gaps between the arms. A broad illustrative luminosity distribution separates fine grain from
  brighter stars; blue-white, ivory, and amber populations include sparse pink H II-like knots.
  A denser ivory-to-golden bulge evokes its old stellar population, not black-hole emission.
  Neither their positions nor their colours identify measured catalogue sources.
  A second bounded GPU batch resolves the nearby cloud into three depths of fine dust-like grain
  and a faint unresolved component. Its density is derived from the displayed Galactic points.
  Grains have fixed Galactic cell addresses; only invisible cells beyond the draw support are
  streamed. They therefore pass around the observer instead of translating with a background
  shell, remain still when navigation stops, and return to the same places on reverse travel.
  This additional detail is illustrative cloud density, not added HYG/Gaia sources.
  The adapted arm pitch is 22 degrees over a 13-degree structural reference. The rendered disc
  shares the canonical Galactic metric used by the Sun at every zoom level: its documented
  100,000-light-year diameter places the Sun at 8.178 kpc, about 53% of the disc radius. No independent
  enlargement makes the Sun appear inside the bulge. Catalogue coordinates, camera distance,
  wheel response, and picking do not change; the nearby density-grain detail remains active.
  Cloud opacity stays constant through Galactic entry down to 220 scene units, then fades to zero
  at 70. The Gaia/HYG reveal spans a full logarithmic decade from 900 to 90 units, overlapping the
  actual nearby cloud passage instead of preceding it. Ordinary planets, orbits, and their labels
  have a separate 240-to-90-unit reveal. Moon names appear in their selected or targeted system,
  or on direct selection/hover; universe-scale annotations stay out of the local cloud. Active
  objects remain accessible. These are presentation thresholds, not changed distances or data.
  A separate static 12,000/26,000/48,000-point halo supplies sparse surroundings and 48 illustrative
  globular-like concentrations without fog. More distant, camera-centred extragalactic batches
  provide representative galaxy silhouettes and an external-only deep-field background.
- A searchable black-hole layer containing Sagittarius A*, Cygnus X-1, and Gaia BH1, with
  catalogue-backed positions and masses, scale-specific galactocentric or heliocentric placement,
  activity-aware silhouettes, and a quality-aware,
  HiDPI-stable background-first lens composition. A qualitative thin-lens mapping bends the live
  framebuffer into a visual Einstein ring and inverted image across the full influence annulus.
  Sagittarius A* additionally owns one deterministic GPU point batch representing an illustrative
  3D nuclear star cluster; it has real scene depth and parallax, remains in the framebuffer capture,
  and cannot persist as a screen-space image after navigation. Only the horizon, photon ring, and
  optional accretion emission are removed from the capture and composited back in front. No fixed
  photographic or procedural sky texture is substituted, and abstract navigation references such
  as the cosmic web have no opaque geometry. Every adapted element is explicitly marked illustrative.
- An optional layer of all 88 modern constellation figures, mapped to the bundled HYG identifiers
  and rendered as one 644-segment illustrative batch with scale-aware fading, collision-free names,
  reusable hover highlighting, directly interactive segments, direct framing, and searchable
  information cards.
- A map layer of 31 catalogued Local Group galaxies around the procedural Milky Way, with adaptive
  collision-free names, contextual host/satellite visibility, and searchable scientific facts.
  Fixed 3D grain clouds resolve progressively from the distant silhouette into a traversable
  spiral, elliptical, or irregular volume, without a flat disk or a camera-facing image swap.
  The same seeded points persist as detail increases; warm cores and softer cool arms are illustrative.
  Documented diameters are converted linearly in each catalogue
  reference frame; catalogue positions remain observed, while internal morphology, particle
  placement, orientation, luminosity, minimum screen size, and undocumented fallback dimensions are
  identified as illustrative.
- A searchable layer of 720 observed nearby-Universe galaxies, backed by five curated regions and a
  110-tile static Local Volume octree with screen-size refinement, 2/3/5-tile quality budgets,
  target pinning, and parsed-data reuse. A lightweight one-draw-call overview keeps all 720 real
  catalogue positions visible across the Local Group transition. Varied elliptical and spiral GPU
  impostors provide a photographic deep-field hierarchy while their shapes, orientations, and
  luminosities remain explicitly illustrative. Streamed tiles add labels, picking, and detail;
  resolving or focusing an entry reveals its bounded 3D grain cloud.
- A seventh cosmic-web scale containing 37,730 calculated Cosmicflows-4 galaxy groups from 11.1 to
  772.7 Mpc. The exact catalogue remains searchable while one GPU point batch progressively reveals
  a deterministic, spatially distributed sample as the camera approaches. A separate one-draw-call,
  non-interactive deep-sky batch introduces about 3,800/9,100/16,600 calculated groups in
  low/medium/high quality between the Milky Way and Local Group scales. It preserves each catalogue
  direction while compressing radial depth into a clearly documented LOD shell, maintaining spatial
  continuity with inclined, multi-lobed unresolved group light rather than circular star-like
  marks. A second GPU batch adds
  a quality-aware nearest-neighbor scaffold precomputed from those positions without presenting the
  lines as observed physical filaments. An optional 128³ static density volume combines a
  distance-compensated sample of those data with a deterministic cellular continuity field, then
  ray-marches the resulting Illustris-inspired cyan, violet, and amber envelope in one mesh. A
  broader sample of catalogue-backed luminous points maps relative depth from warm nearby groups to
  cool remote groups without restoring a decorative star wallpaper. The added continuity is
  explicitly marked `simulated` and never presented as an observed matter field. Independent map
  layers, bounded labels, uncertainty-aware styling, reusable selection
  highlighting, scientific cards, and URL-addressable focus keep this dense scale readable and
  inspectable.
- A second scientific batch containing 26,500 positionable large-scale-structure detections from
  seven versioned public catalogues: SDSS superclusters and filament envelopes, robust BOSS voids,
  and redshift-positioned Planck SZ clusters. The default synthesis shows progressively sampled
  clusters, superclusters, robust BOSS voids, and exact Tempel filament spines so the network can be
  explored directly without knowing an object name. The map panel exposes groups, links, filaments,
  and voids as independent layers. Void centers and effective radii remain catalogue-derived while
  larger, softly filled blue volumes make their underdensity readable without hard map rings. Every
  record remains searchable and focusable, preserves its detection method and source, and remains
  separate when survey methods overlap. Missing survey coverage is explicitly not rendered as a
  cosmic void.
- A lazily loaded, non-blocking 4.53 MB binary line layer preserving all 275,599 points and 260,178
  consecutive segments published for the 15,421 Tempel SDSS DR8 filaments. A dedicated module Web
  Worker fetches, validates, and decodes the source before transferring six typed-array buffers back
  without copying; unsupported browsers use the same validated main-thread fallback. The browser
  groups the survey into four non-empty spatial GPU tiles, progressively reveals lines by zoom and
  quality, and highlights the complete source spine when selected. A separately identified,
  quality-aware screen-space halo improves overview readability without changing the source axis or
  claiming a physical diameter; no smoothing or per-segment Three.js object is introduced. The
  render chunk is fetched alongside the Worker preload, and progressive picking-mask updates touch
  only the newly revealed or hidden segment range instead of rewriting all 520,356 vertices.
- A continuously blended deep-space backdrop whose restrained navy, indigo haze, and vignette
  evolve with camera distance without a hard visual cut between semantic scales.
- Searchable and clickable names, object details, confidence levels, and shareable URL state.
- A continuously visible astronomical breadcrumb and camera-derived scale bar, both explicitly
  marked as adapted visual cartography rather than a globally physical projection.
- Solar and lunar eclipse visualization, including an instantaneous shadow, an optional whole-event
  visibility envelope and bounded central corridor, local circumstances for predefined or arbitrary
  observer coordinates, detailed C1–C4 contact times with horizon status, a scrollable past/future
  event catalogue, and direct return to the simulated date.
- Three graphics profiles with progressive runtime resolution adaptation, desktop and touch
  navigation, and a built-in debug panel that reports adaptive status, p95 frame time, long-frame
  ratio, and current/target pixel density alongside the detailed Tempel timings. The Tempel
  catalogue and its rendering module are preloaded while the nearby-universe view is active, but
  Three.js objects are only constructed and installed on entry to the cosmic web.
- Static local datasets only: no account, application API, database, or backend service.

## Scientific transparency

Every astronomical object carries an explicit confidence level:

`observed` · `calculated` · `extrapolated` · `simulated` · `procedural` · `illustrative`

Scientific source units remain in the datasets and are converted by hierarchical coordinate frames.
Visual radii, inter-scale distances, brightness, and some morphologies are intentionally adapted when
physical scale would make the map unreadable. Those adaptations are identified in the interface.

The ephemeris model is suitable for educational visualization, not spacecraft navigation or
professional astronomical prediction.

## Getting started

Requirements: a current Node.js LTS release and npm.

```bash
git clone https://github.com/Nayruuu/my-universe.git
cd my-universe/client
npm ci
npm start
```

Open `http://localhost:4200`.

The root `Makefile` provides the same repository-level workflow as the Portfolio project:

```bash
make install
make dev
```

To use another port:

```bash
npm start -- --port 4203
```

## Controls

| Action                     | Desktop                                      | Touch                    |
| -------------------------- | -------------------------------------------- | ------------------------ |
| Orbit around a target      | Left-click and drag                          | One-finger drag          |
| Pan                        | Right-click and drag                         | Two-finger drag          |
| Zoom toward the pointer    | Mouse wheel, semantic across scales          | Pinch                    |
| Select                     | Click an object                              | Tap                      |
| Focus                      | Click a name, double-click an object, or `F` | Tap a name or double-tap |
| Play or pause time         | `Space`                                      | Timeline button          |
| Change simulation speed    | `+` / `-`                                    | Timeline selector        |
| Close the information card | `Escape`                                     | Close button             |

The scale selector provides direct shortcuts to planetary, Solar System, stellar, galactic, Local
Group, nearby-Universe, and cosmic-web views. Floating controls independently toggle orbits,
constellation figures, and astronomical names.

When inward wheel input starts over a navigable label or rendered object, that object is locked for
the burst and becomes the logical target and geometric anchor. The camera approaches it continuously
and remains in front of its contextual distance floor even if more inward samples arrive. A fresh
capture of another galaxy, such as Andromeda, takes priority over the Milky Way entry guide. A
reversed planetary-to-cosmic journey uses its original local destination for the final approach,
rather than leaving the camera around the host star. Over empty
space, the geometric pivot follows the pointer. A new inward gesture starting at the distance floor
can release the logical target when the pointer no longer targets that object. The burst that first
reaches the floor stops there. Subsequent free traversal translates camera and pivot at a
constant separation while the selected card remains open. Sustained input accelerates progressively
to a bounded cruise speed. Reversing the wheel unwinds the recorded free-space route before distance
zoom resumes. The Earth-horizon planetarium keeps separate controls: wheel and pinch modify field of
view only, preserve the astronomical direction under the pointer, and span 102° down to 2°.

## Public documentation

The Markdown sources under `docs/guide/` generate an indexable VitePress site at `/guide/`. Local
full-text search runs in the browser and requires no documentation backend.

```bash
cd client
npm run docs:dev      # http://localhost:4204/guide/
npm run docs:build    # writes into the Angular production output
npm run docs:preview  # previews the generated site
```

The standard `npm run build` command builds Angular and the guide, then verifies every generated
page, canonical URL, and sitemap entry.

## Quality gates

The project uses strict TypeScript, ESLint, Angular template linting, Stylelint, Prettier, Vitest,
Playwright, and a production build check.

```bash
npm run verify
```

From the repository root, the equivalent command is `make verify`.
`npm run verify:ci` runs the deployment gate without the GPU-heavy browser journeys.

During local development, a focused journey can reuse an already-running application instead of
starting a second Angular server. For example, the browser-geolocation slice runs one Chromium test
against the development server on port 4203:

```bash
UNIVERSE_E2E_BASE_URL=http://127.0.0.1:4203 npm run test:e2e:geolocation
```

The complete 180-journey matrix remains available through `npm run verify` and in the nightly
**Browser journeys** workflow.

The permanent scientific-distance audit can also be run independently:

```bash
npm run audit:science
```

It currently inspects 361,748 scientific records across the curated objects, nearby galaxies, HYG
stars, NASA exoplanets, Cosmicflows groups, documented cosmic structures, and published Tempel
filament points. It fails on invalid units, non-finite or inconsistent Cartesian distances,
reference-frame drift, broken catalogue links, or metadata cardinality mismatches. Its report keeps
the explicitly labelled exoplanet distance and orbit fallbacks visible instead of treating them as
observations.

Cold startup and the deferred Tempel transition both have repeatable browser benchmarks. The startup
benchmark records the engine-module, static-data, scene-ready, and first-usable-map milestones. The
Tempel benchmark reports Three.js preparation, scene installation, first visible frame, activation
latency, and total latency. Both support desktop and emulated-mobile profiles at every quality:

```bash
npm run benchmark:startup
npm run benchmark:tempel
npm run benchmark:resources
npm run benchmark:frames
npm run benchmark:observer
UNIVERSE_BENCHMARK_DEVICE_CLASS=medium \
UNIVERSE_BENCHMARK_DEVICE_LABEL="Representative laptop" npm run benchmark:campaign
npm run benchmark:campaign:simulated
UNIVERSE_BENCHMARK_RUNS=5 UNIVERSE_BENCHMARK_STRICT=1 npm run benchmark:startup
UNIVERSE_BENCHMARK_RUNS=5 UNIVERSE_BENCHMARK_STRICT=1 npm run benchmark:tempel
UNIVERSE_RESOURCE_CYCLES=5 UNIVERSE_BENCHMARK_STRICT=1 npm run benchmark:resources
UNIVERSE_FRAME_COLD=1 UNIVERSE_BENCHMARK_STRICT=1 npm run benchmark:frames
UNIVERSE_OBSERVER_DPR=2 UNIVERSE_BENCHMARK_STRICT=1 npm run benchmark:observer
UNIVERSE_CPU_THROTTLE_RATE=4 UNIVERSE_BENCHMARK_QUALITY=medium npm run benchmark:observer
UNIVERSE_CPU_THROTTLE_RATE=6 UNIVERSE_BENCHMARK_QUALITY=low npm run benchmark:observer
UNIVERSE_BENCHMARK_DEVICE_CLASS=medium \
UNIVERSE_BENCHMARK_DEVICE_LABEL="Representative laptop" \
UNIVERSE_BENCHMARK_REQUIRE_PHYSICAL=1 \
UNIVERSE_BENCHMARK_REPORT_PATH=/tmp/universe-observer-medium.json \
UNIVERSE_BENCHMARK_QUALITY=medium npm run benchmark:observer
```

The benchmarks expect a local application at `http://127.0.0.1:4203` by default. Override it with
`UNIVERSE_BENCHMARK_BASE_URL`, or limit a run with the comma-separated
`UNIVERSE_BENCHMARK_PROFILES` and `UNIVERSE_BENCHMARK_QUALITIES` variables. It remains a manual
device-profiling tool rather than a software-rendered CI gate. The resource benchmark first warms a
complete Earth → Milky Way → nearby universe → cosmic web → Earth journey, then checks WebGL and
garbage-collected JavaScript heap drift across repeated journeys. The startup strict threshold defaults
to 7 seconds and can be changed with `UNIVERSE_STARTUP_BUDGET_MS`. The frame benchmark measures a
complete scale journey after the map becomes interactive and reports mean, p50, p95, p99, maximum,
long-frame ratio, per-transition phases, and the final adaptive-resolution state. It waits for a
complete post-transition adaptive window before reading that state. The journey is warmed by
default; set `UNIVERSE_FRAME_COLD=1` to measure the first interactive journey.
`benchmark:observer` runs a focused 1440 × 900 observable-planetarium journey: wide-sky panning,
recentering, pointer-anchored zoom until Jupiter resolves, and zooming back out. It reports the
requested browser DPR, actual canvas DPR, per-phase frame distribution, adaptive-resolution state,
and whether the existing planet representation resolved. Set `UNIVERSE_OBSERVER_DPR` and
`UNIVERSE_BENCHMARK_QUALITY` to change that profile. `UNIVERSE_CPU_THROTTLE_RATE` applies a
controlled Chrome CPU slowdown for regression stress only; it is not evidence for another physical
device class. Each of the five performance benchmarks can use `UNIVERSE_BENCHMARK_REPORT_PATH` to
write a versioned JSON evidence report containing the Git revision and dirty state, non-identifying
host characteristics, browser and WebGL renderer, configuration, raw samples, and summary. Use a
distinct output path for startup, Tempel, resources, scale frames, and the observable planetarium.
The declared `UNIVERSE_BENCHMARK_DEVICE_CLASS` remains an explicit operator claim.
`UNIVERSE_BENCHMARK_REQUIRE_PHYSICAL=1` rejects CPU throttling, software renderers, and an
unclassified device before writing the report instead of allowing simulated evidence into the
physical matrix.

`npm run benchmark:campaign` is the evidence-grade wrapper for a representative physical machine.
It requires a clean Git checkout plus an explicit device class and label, defaults the measured
quality to that class, and runs the five protocols sequentially to avoid cross-benchmark resource
contention. It forces strict budgets, disables CPU throttling, collects at least three runs and three
resource cycles, and writes the five reports outside the repository. The resulting
`universe-map/performance-campaign@1` manifest binds their common source, host, browser, renderer,
configuration, and summaries to the report files with SHA-256 digests. Set
`UNIVERSE_BENCHMARK_CAMPAIGN_DIR` to a new path outside the checkout when the default temporary
directory is not suitable. This command packages evidence; it does not emulate missing medium- or
low-end hardware.

`npm run benchmark:campaign:simulated` is the separate same-host regression campaign for cases where
representative hardware is unavailable. It applies Chrome CPU throttling to all five protocols, runs
medium quality at 4× with observer DPR 1.25 and low quality at 6× with observer DPR 1, and executes
the resulting ten browser benchmarks sequentially. A clean checkout is still required. Its external
`universe-map/simulated-performance-campaign@1` manifest records both profiles, report digests, and
explicit limitations: GPU, graphics memory, driver, memory bandwidth, and thermal behavior still
belong to the source host. These profile names are regression proxies, not physical device claims.
Every child benchmark records its report without aborting on a budget regression, so one failure
cannot hide later evidence. The manifest then records a `withinBudget` result for every protocol,
profile, and the whole campaign. The command exits non-zero after writing that complete manifest when
any budget fails; set `UNIVERSE_BENCHMARK_STRICT=0` only to collect a known-regressing baseline. The
command is intentionally manual because a complete ten-protocol run is long.

The first repeated physical high-end baseline was recorded on 27 August 2026 with a MacBook Pro
(Apple M5 Max, 18 CPU cores, 40 GPU cores, 128 GB), macOS 26.6, and Chrome 151 using the real Metal
renderer. Across three desktop/high runs, the median first usable map arrived in 259.3 ms and the
median Tempel first visible frame in 7.1 ms. Three cold scale journeys stayed at 9.1–9.2 ms p95,
16.7 ms p99, 66.6–75 ms maximum, and 0.24–0.36% long frames. After three warmups, three resource
cycles remained at 100 geometries, 18 textures, and 44 draw calls, with a −0.77 MiB collected-heap
drift. A separate three-run observable-planetarium profile requested browser DPR 2 at 1440 × 900;
the high-quality renderer applied its documented DPR 1.5 cap and remained stable there. Each run
sampled 1,452–1,455 frames at 9.1 ms p95, 9.3 ms p99, 9.4–9.5 ms maximum, and zero long frames,
while Jupiter reached its resolved representation in all three runs. Representative medium- and
low-end physical devices still need to be measured.

A clean same-host simulated campaign recorded on 28 August 2026 at revision `27db0e1` passes all ten
protocol/profile reports. At medium quality with Chrome CPU throttled 4×, the median first usable
map is 1.26 s, the median Tempel first visible frame is 24.2 ms, three cold scale journeys remain at
9.3 ms p95 with a 66.5 ms worst frame, and the observable journey has a 9.2 ms median p95 with a
24.9 ms worst frame and Jupiter resolved 3/3. At low quality and CPU 6×, the corresponding values
are 1.85 s, 33.1 ms, 16.6–16.7 ms p95 with an 83.4 ms worst scale frame, and 9.4 ms observable p95
with a 41.7 ms worst frame and Jupiter resolved 3/3. Both three-cycle resource protocols report zero
geometry, texture, and draw-call drift.

An earlier clean campaign after complementary-catalogue Worker decoding had exposed two scheduling
races and passed only 8/10 protocols: prepared data could return while the first low/CPU 6× scale
transition or the medium/CPU 4× observable pan was already active. Worker preparation and
main-thread installation are now separate phases. Preparation creates no scene resource; after it
completes, registry, search, geometry, and GPU installation requires a fresh 1.2-second stable-camera
window and is suspended entirely in observable mode. The complete clean rerun above confirms that
both failures are removed. These simulated numbers retain the M5 Max GPU and therefore measure
regression headroom, not representative medium- or low-end hardware.

Local consolidation diagnostics on 10 September 2026 used the uncommitted work based on
`95e51fb`, Chrome 153, and the host's M5 Max Metal renderer, running the same ten protocol/profile
combinations sequentially with three runs or resource cycles each. **7/10 meet their budgets.**
Cold scale journeys fail in medium/CPU 4× and low/CPU 6×, with worst frames of 200 ms and 149.9 ms;
low Tempel also fails at a 49.8 ms median first visible frame. Startup passes at 1.73 s and 3.16 s
median; both resource checks retain identical geometry, texture, and draw-call counts, and both
planetarium profiles pass with Jupiter resolved 3/3. These dirty-source reports are diagnostics,
not a new clean manifest or a claim about representative devices. The historical 10/10 baseline
above is retained; profiling the overruns and repeating the clean campaign remain open priorities.

A subsequent CPU pass reduces repeated work without changing camera paths, catalogue positions,
shaders, or quality budgets: cosmic-structure selection masks update only the changed visible
prefix, label-ranking scores are computed once per record, and search builds reuse up to 256
normalized catalogue keywords. Three new cold journeys per profile meet the whole-journey frame
budgets (worst frames 66.7 ms low/CPU 6× and 83.4 ms medium/CPU 4×). Some individual phases still
exceed their diagnostic p99 or long-frame-ratio targets, so this does not close the cold-loading
work or establish a new 10/10 campaign.

Cosmicflows point, link, and local-depth geometry preparation, as well as large-scale-structure
symbols, now yield between 512-record batches, including stable sorting and picking-index creation.
Posted-message tasks allow animation and input to proceed without nested timer delays. A replacement
keeps the previous catalogue live until its geometry is ready, uses the latest display configuration,
and discards obsolete work on replacement or scene disposal. Both catalogues retain identical
geometry attributes and object ordering. The Cosmicflows and large-scale-structure registries now
also prepare IDs, positions, label ranks, and search names/aliases in bounded batches before being
published. Deferred installation checks runtime validity at each pause and before handing a prepared
registry to the scene, so closing the map cannot install a late result. Exoplanet registration now
uses the same cooperative path for featured aliases, unique IDs, spatial/orbital preparation,
host ranking, and complete search entries. All 4,747 host and 6,333 planet definitions, positions,
IDs, and search results match the pre-change snapshot; individual systems are still materialized
only on demand. Complete search entries are cached, avoiding a late synchronous rebuild during
the data-ready event. Stellar tile indexing now yields while building the ID lookup (512 nodes per
batch) and projecting visibility bounds (128 nodes per batch, retaining all 27 samples per node).
Concurrent requests share one complete preparation; no partial index is exposed. All 3,964 Gaia
cells and selections across 378 camera/quality/LOD combinations match the pre-change snapshot.
HYG search entries and normalized label candidates now also prepare in 256-record batches. Label
refreshes reuse those candidates while reevaluating current exclusions and rank limits. Merged runtime
search entries are cached until a deferred catalogue is installed. Search and exoplanet discovery
prepare off to the side and publish together; the previous complete pair remains usable meanwhile.
New data, a language change, or service destruction invalidates obsolete preparation. Positions,
labels, all 6,333 discovery entries, ranking, and scientific filter values remain unchanged.
Other stellar-catalogue work and first-use GPU work remain separate performance targets.

Before the exoplanet slice on 11 September, low/CPU 6× passes only 1/3 targeted journeys in each
of two series (up to 150 ms), and low Tempel's 34.0 ms median exceeds budget. After this slice,
three new journeys pass in both low/CPU 6× (worst 66.7 ms) and medium/CPU 4× (worst 83.4 ms).
Tempel first-visible medians are 28.7 and 33.3 ms, with 3/3 preload hits per profile. Individual
phase tails remain above diagnostic budgets. These dirty-source checks do not replace the
historical clean campaign or isolate causal gains; stellar indexing, search/label publication,
and first-use GPU work remain targets.

After the stellar-index slice, another three cold journeys pass per profile (worst 66.7 ms low
and 83.3 ms medium). Tempel preload hits remain 3/3; its medians are 35.0 ms low (above budget)
and 30.7 ms medium. Individual phase tails remain open. In an isolated CPU 6× comparison, index
preparation returns control between at most 6.0–7.1 ms slices, versus 47.7–51.3 ms synchronously;
total preparation takes 57.7–60.9 ms. This improves scheduling, not the amount of work, and does
not establish a causal whole-journey gain or replace the clean campaign.

The search/label slice removes a publication path found in a 69.0 ms instrumented task. A fresh
trace no longer samples publication in tasks above 50 ms; first-use shader compilation and buffer/
texture uploads remain. In three isolated Chrome 153 / CPU 6× comparisons, discovery over 86,020
input entries takes 31.2–37.8 ms synchronously versus 2.4–3.9 ms maximum cooperative slices
(54.4–61.0 ms total). HYG preparation takes 132.1–151.4 ms total in slices of at most 6.9–8.9 ms;
subsequent label refreshes take 4.7–14.0 ms after a first refresh of 29.3–30.1 ms, versus 70.3–93.7 ms
without the cache. These isolated measurements exclude fetch/parsing and do not establish an
end-to-end gain or close the clean performance campaign.
Separate targeted cold journeys pass 3/3 per profile (worst 100.0 ms low/CPU 6× and 99.9 ms
medium/CPU 4×). Tempel preload hits remain 3/3, with first-visible medians of 33.7 ms low (above
budget) and 32.6 ms medium. Worst-frame latency has not improved over the previous series;
individual phase tails and first-use GPU work remain open.

The first GPU-upload slice prepares the unchanged 8192 × 1024 local panorama as an asynchronous
ImageBitmap. In three isolated Chrome 153 / CPU 6× comparisons, the synchronous upload falls from
742.7–790.8 ms to 96.2–102.8 ms. A 256 × 128 GPU readback has identical pixels before and after,
also checked on Firefox and WebKit. The bitmap is released with its texture, including late
completion after scene disposal; unsupported bitmap decoding retains the ordinary image loader.
Initial prewarming gives the optional panorama at most 500 ms alongside shader compilation;
it proceeds earlier when ready and does not wait indefinitely for a stalled download.
This reduces a large first-use stall without changing the camera, resolution, or colors, but the
remaining synchronous upload and shader/buffer work are not yet within every frame budget.
Final targeted cold journeys pass 3/3 in low/CPU 6× (worst 66.7 ms) and 2/3 in medium/CPU 4×
(worst 100.1 ms, above the strict 100 ms limit). Tempel preload hits are 3/3 per profile;
first-visible medians are 26.6 and 28.4 ms, with worst frames of 30.4 and 30.9 ms. These small
local series do not establish a causal whole-journey gain or replace the clean full campaign.

The active-ancestor LOD slice rebuilds the navigation hierarchy once per frame, instead of walking
and allocating it for each object. Rebuilding each frame preserves target/selection precedence and
deferred catalogue changes, including missing parents and cycles. In three isolated Chrome / CPU 6×
comparisons, 200 updates of a synthetic 503-entry fixture take 95.2–98.2 ms before and 74.6–80.3 ms
after, with identical sampled LOD states. This is a CPU-only component measurement, not a frame-time
or rendering-speed claim for the full application.
New targeted cold journeys pass 3/3 per profile (worst 66.8 ms low/CPU 6× and 100.0 ms medium/CPU
4×). Tempel preload hits remain 3/3, with medians of 27.0 / 31.2 ms but worst frames of
31.6 / 78.2 ms. The medium outlier remains above the 33.3 ms target; no clean campaign is closed.

The current automated test matrix contains:

- 2,950 unit and integration tests plus 168 static-data, documentation, deployment, benchmark, and
  scientific-audit tests;
- 100% statements, branches, functions, and lines coverage across production code;
- individual 100% coverage gates for declared scientific modules;
- 180 end-to-end journeys, including desktop and mobile Chromium coverage plus deterministic visual
  signatures on Chromium, Firefox, and WebKit.

GitHub Actions runs `npm run verify:ci` on every push and pull request. The complete Playwright suite
runs in the separate **Browser journeys** workflow every night and on demand, so production
deployments are not blocked by software-rendered WebGL performance.

## Architecture

```text
.
├── client/              Self-contained Angular application
│   ├── src/
│   │   ├── app/         Angular UI, application state, search, URL and settings
│   │   ├── engine/      Framework-independent Three.js engine
│   │   └── data/        Strict models and runtime validation
│   ├── public/data/     Versioned static astronomical datasets
│   ├── e2e/             Desktop and mobile browser journeys
│   └── tools/           Coverage and catalogue preparation scripts
├── docs/                Technical reference and coding rules
├── .agents/             Tool-independent coding-agent roles
├── .github/             Repository automation
└── Makefile             Repository-level development commands
```

As in the Portfolio repository, project governance and documentation remain at the root while the
Angular runtime is isolated in `client/`. The engine has no dependency on Angular components. It
publishes typed events through a small facade, while the render loop runs outside Angular change
detection.

## Static deployment

```bash
npm run build
```

The deployable application is generated in `client/dist/universe-map/browser/` and can be hosted by
any static file server or CDN.

Production uses a dedicated Azure Static Web App named `swa-um-web`. Its lifecycle is managed by the
private `Nayruuu/Infrastructure` Terraform repository, while this repository owns the application
build and deployment. A successful `Verify` run on `main` automatically triggers
`.github/workflows/deploy.yml`, which checks out the verified revision, builds it, obtains the
deployment token at runtime through Azure OIDC, publishes the static output, and smoke-tests the
Azure production endpoint.

One-time setup:

1. Apply the Infrastructure Terraform configuration to create `swa-um-web` in `rg-infra-web`.
2. Add `AZURE_CLIENT_ID`, `AZURE_TENANT_ID`, and `AZURE_SUBSCRIPTION_ID` as GitHub Actions secrets in
   `Nayruuu/my-universe`.
3. Add an Azure federated credential for `repo:Nayruuu/my-universe:ref:refs/heads/main` to the same
   application registration used by the Portfolio deployment identity.
4. Push a verified revision to `main`, or run the deployment workflow manually from `main`.

The Azure-generated hostname remains available for diagnostics. The public URL is
`https://super-universe.app`; its DNS validation and attachment are managed through the Infrastructure
Terraform variable `universe_map_custom_domain`. `client/public/staticwebapp.config.json` provides SPA
fallback, binary catalogue MIME types, security headers, and cache rules suitable for the versioned
Angular bundles and local astronomical assets.

## Data provenance

- Planetary and lunar calculations use
  [Astronomy Engine](https://github.com/cosinekitty/astronomy), executed locally in the browser.
- Major-moon mean elements and physical properties come from the
  [NASA/JPL planetary satellite tables](https://ssd.jpl.nasa.gov/sats/), while the bundled dwarf
  planets, asteroids, and comets use explicitly extrapolated two-body elements from the
  [NASA/JPL Small-Body Database](https://ssd.jpl.nasa.gov/tools/sbdb_lookup.html).
- The 6,333-planet, 4,747-host exoplanet snapshot and its four richer featured systems are derived
  from the
  [NASA Exoplanet Archive](https://exoplanetarchive.ipac.caltech.edu/) `PSCompPars` table through
  its [TAP service](https://exoplanetarchive.ipac.caltech.edu/docs/TAP/usingTAP.html), captured on
  2026-08-05. Host ICRS coordinates, confirmed status, periods, semi-major axes, radii, masses, and
  equilibrium temperatures retain their catalogue provenance. The 27 hosts without a published
  distance retain their observed sky direction and use an explicitly labelled 1,000 pc illustrative
  map depth. Orbital phase, display orientation, visual separation, lighting, and procedural
  surfaces are explicitly illustrative.
- The dense stellar field is derived from
  [HYG Database v4.1](https://github.com/astronexus/HYG-Database) under CC BY-SA 4.0.
  Its fixed-size brightness selection explicitly retains all 16 featured stars, including faint
  nearby objects such as Proxima Centauri, Barnard's Star, and Wolf 359.
- The cross-scale stellar hierarchy is derived from
  [Gaia Data Release 3](https://www.cosmos.esa.int/web/gaia/data-release-3), using the
  `gaiadr3.gaia_source_lite` table at reference epoch J2016.0. The static source snapshot and every
  derived aggregate or retained measured sample credit ESA/Gaia/DPAC; query, partition hashes,
  selection limits, sampling method, and transformations are recorded beside the data.
- The illustrative four-arm Milky Way density model is informed by the maser-parallax structure
  compiled by [Reid et al. (2019)](https://doi.org/10.3847/1538-4357/ab4a11).
- The compact black-hole layer combines the
  [Event Horizon Telescope Sagittarius A* result](https://eventhorizontelescope.org/blog/astronomers-reveal-first-image-black-hole-heart-our-galaxy),
  [Miller-Jones et al. (2021) Cygnus X-1 measurements](https://arxiv.org/abs/2102.09091), and the
  [updated Gaia BH1 orbit](https://arxiv.org/abs/2312.05313). Positions are cross-referenced against
  SIMBAD or ESA Gaia metadata. Gaia BH1 and Cygnus X-1 use heliocentric Galactic vectors in the
  stellar map, while Sagittarius A* remains at the Galactic origin; unrelated scale layers are
  hidden before their compressed coordinates can imply false proximity. All horizons and emission
  structures are strongly enlarged visual adaptations rather than relativistic reconstructions.
  The local lens is an achromatic thin-lens approximation applied only to the background; it is not
  a general-relativistic ray tracer.
- Modern constellation figures are derived from
  [Stellarium's Modern sky culture](https://github.com/Stellarium/stellarium/tree/master/skycultures/modern)
  under CC BY-SA 4.0. They are cultural line conventions, not physical stellar links or official
  IAU boundaries.
- Local Group positions are based on the
  [VizieR J/AJ/144/4 catalogue](https://vizier.cfa.harvard.edu/viz-bin/VizieR-3?-source=J%2FAJ%2F144%2F4)
  published with McConnachie's database of nearby galaxies.
- Galaxies beyond the Local Group use the
  [Updated Nearby Galaxy Catalog](https://vizier.cfa.harvard.edu/viz-bin/VizieR-3?-source=J%2FAJ%2F145%2F101)
  and the
  [ACS Virgo Cluster Survey distance catalogue](https://arxiv.org/abs/astro-ph/0702510).
- The outer cosmic-web scale uses the
  [Cosmicflows-4 group catalogue](https://cdsarc.cds.unistra.fr/viz-bin/cat/J/ApJ/944/94),
  published by [Tully et al. (2023)](https://doi.org/10.3847/1538-4357/ac94d8).
- Documented large-scale structures use the
  [SDSS DR7 supercluster catalogues](https://cdsarc.cds.unistra.fr/viz-bin/cat/J/A+A/539/A80),
  [BOSS DR12 robust void catalogue](https://cdsarc.cds.unistra.fr/viz-bin/cat/J/ApJ/835/161),
  [Tempel SDSS DR8 filament catalogue](https://cdsarc.cds.unistra.fr/viz-bin/cat/J/MNRAS/438/3465),
  and the redshift-positioned subset of
  [Planck PSZ2](https://cdsarc.cds.unistra.fr/viz-bin/cat/J/A+A/594/A27).
- The Earth texture uses NASA Visible Earth Blue Marble imagery stored with the application.

See [client/data-sources/README.md](client/data-sources/README.md) and the in-app confidence labels
for detailed provenance and known visual adaptations.

## Roadmap

The maintained public roadmap is the localized
[Universe Map roadmap](client/docs/guide/roadmap/index.md). It separates delivered work, current
priorities, measurement-gated investments, and deliberately deferred extensions. This README and
the technical reference link to that page instead of maintaining independent ordered backlogs.

## License

The application source code is available under the [MIT License](LICENSE). Bundled datasets and
third-party assets remain subject to their respective licenses and attribution requirements.
