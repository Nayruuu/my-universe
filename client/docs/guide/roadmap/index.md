---
title: Roadmap
description: See what Universe Map has delivered, what is being improved now, and which scientific and performance work remains deliberately deferred.
---

# Roadmap

_Last reviewed: 10 September 2026._

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
- Returning from the planetarium to the 3D map now lifts away from the observer over 2.4 seconds:
  the horizon fades and Earth becomes the pivot on the same renderer. This illustrative path
  preserves the initial gaze, yields immediately to input, and respects reduced-motion preferences.
  Ordinary map navigation is unchanged.
- Cards, search, the planner, and timeline now adapt to narrow and short-landscape screens.
  Cards offer summary, preview, and expanded reading states; the compact timeline expands on demand
  and its measured height reserves control space. Closing stays in the header, the orbit action
  moves beside orbital data, and the redundant orange banner is removed without losing scientific
  explanations in the timeline and cards.
- Two fragile wheel journeys now wait for actual inertia to settle and distinguish reaching the
  distance floor from a new traversal burst. Their movement and orientation assertions are unchanged;
  this test stabilization requires no camera-control change.
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
  Galactic centre to the Sun while the same Galactic point cloud remains visible and the measured
  stellar catalogues add local detail over it without a reference-frame cut. This reversible path
  starts in the nearby Universe and
  does not launch a camera recenter at hierarchy changes. Its pivot and elevation are evaluated
  directly from distance: they stop with the wheel and retrace the same curve in reverse, with no
  catch-up that could make the stars bounce. The Gaia volume now stays compact throughout the
  external approach, then unfolds its reference frame from 3,600 to 2,400 units while the catalogues stay
  masked. After a hidden buffer, HYG, Gaia, exoplanet hosts, and constellations appear from 900
  to 90 units in an already stable frame, so zoom no longer makes their stars slide. This full
  decade of zoom overlaps the nearby cloud passage, without changing the camera route. Galactic
  brightness also remains bounded across viewing inclinations.
- The structural Milky Way calibration now gives the rendered disc and the Sun the same canonical
  coordinate metric at every zoom level. Removing the independent ninefold enlargement restores
  the Sun's 8.178-kpc position to about 53% of the radius of the documented 100,000-light-year-diameter disc.
  Near-field dust-like grain remains, while camera distances,
  wheel response, picking, and catalogue placement remain unchanged. The exterior view and traversal
  now use the same batched galactocentric cloud, with no analytic surface, billboard, or raster image.
  From a distance, its point density draws an irregular spiral silhouette—two dominant and two
  secondary arms, branches, a bar, bulge, and dark gaps—then perspective separates those same points
  into stars during approach. Branched,
  wandering filaments concentrate more stars in the arms, leaving fainter interarm space; the core
  favors a denser golden bar around an ivory nucleus, evoking its old stellar population rather
  than black-hole emission. The density and colours remain illustrative, and the luminosity
  distribution favors fine stars over bright grain.
  The externally visible galaxy is therefore the population crossed
  inside, with no visual-object swap. All 336,000 high-quality samples now belong to the bar, arms,
  local spur or diffuse disc. The thick component covers all azimuths and both sides of the plane;
  the former camera-path corridor and separate Solar-centred sphere have been removed. There is no
  zoom-gated replacement population or artificial motion trail. The shader projects world-space
  point diameters with the actual viewport, field of view and camera depth, preserves subpixel
  energy, and caps resolved samples at fine dust-like grain within four-pixel raster support.
  Compact grains have no halos or approach-dependent exposure boost, and fade smoothly only as
  they pass the lens. A fixed opacity normalization preserves cloud legibility. This is an
  illustrative density effect, not observed dust; HYG/Gaia rendering stays unchanged.
  A broad illustrative luminosity distribution keeps
  most stars fine and a smaller number bright. Blue-white, ivory and amber stellar colours, plus
  sparse pink H II-like knots, are illustrative—not individually measured Gaia colours.
  The cloud keeps the same opacity down to 220 units and fades only between 220 and 70 units,
  overlapping the Gaia/HYG reveal from 900 to 90 units. Measured catalogue coordinates and
  camera/navigation behavior are unchanged. Ordinary planets, orbits, and their labels now appear
  separately from 240 to 90 units, leaving a cloud-first stage. Moon names are secondary and
  contextual to the selected or targeted system; direct hover and selection remain available.
  Universe-scale annotations no longer label the local bulge. The low-quality prefix
  increases to 144,000 finer-lit samples to cover the larger thick disc without adding brightness.
  Regression tests check the separate reveals, immutable point data, thick-disc coverage at all qualities,
  and the pixel footprint and energy actually rendered by the production shaders.
  Nearby cloud detail now uses one additional bounded point batch, with three spatial resolutions
  and faint unresolved density between the grains. Its density comes from the displayed galaxy,
  while individual grains keep fixed Galactic cell addresses. Streaming only replaces invisible
  cells, preserving foreground parallax, stationary views and reverse travel. This is illustrative
  dust-like density, not new catalogue stars. Camera motion and HYG/Gaia coordinates are unchanged.
  The exterior pass now adds one 12,000/26,000/48,000-point GPU batch of sparse stars around the disc
  according to quality, with one eighth arranged into 48 compact globular-like concentrations. This
  flattened envelope stays fixed in the Galactic frame for perspective-only parallax and fades out
  before the Solar neighborhood. It is explicitly illustrative and uncatalogued, with no fog or
  diffuse emission. A separate camera-centred pass now adds 10,000/24,000/52,000 extended galaxy
  impostors around the Galactic approach. Their varied elliptical, spiral, and irregular profiles
  form an explicitly illustrative representative sample—not a catalogue or literal galaxy count—
  with an analytic Galactic zone of avoidance and no translational parallax. The Cosmicflows depth
  bridge now uses inclined, multi-lobed unresolved group light instead of circular star-like marks.
  At external galaxy-view distances only, a single runtime-generated spherical shader now sits
  behind those galaxy silhouettes. It adds deep-indigo space, broad cobalt-violet filamentary light,
  near-black rifts, and unresolved elliptical galaxy grain without a raster sky or catalogue
  positions. Its continuous 5,800–12,000-unit fade keeps it entirely out of the Milky Way overview
  and interior traversal.
  The structural pass narrows and strengthens leading-edge
  and paired bar dust lanes, removes most of the diffuse thick-disc pedestal, and composites their
  near-black extinction after the additive stellar batch. A compact ivory nucleus inside the amber bar
  now remains distinct from both the dust and the surrounding arm light.
- Other galaxies also use fixed point clouds with spiral, elliptical, or irregular density,
  visible from multiple directions. Catalogue centres are preserved; internal points and colours
  remain illustrative. Selection keeps the card and interactions without drawing an oversized
  planetary selection ring across the cloud. Browser captures and tests cover the Milky Way,
  Andromeda, M87, and the Large Magellanic Cloud, including rendered pixels and spatial stability;
  aesthetic approval remains a separate step.
- A Gaia DR3 hierarchy turns 2,923,790 quality-filtered sources into distant calculated 512 pc
  aggregates and 133,526 measured-source samples for the stellar-neighborhood overview. Each
  refined 512 pc leaf retains its 32 brightest sources plus a deterministic uniform selection, up
  to 96 points. Frustum- and quality-bounded refinement fetches only visible branches, validates
  them in module Workers, transfers typed arrays without copying, and never creates one Three.js
  object per source. Refinement tests the tighter child-cell bounds even when a broad root center is
  off-screen, then ranks eligible roots by their visible measured-source count. High quality can
  refine at most 16 roots, preventing an orbit around the Sun from leaving one side of the screen
  represented only by coarse aggregates. Tile changes retain the outgoing detailed batch and transfer opacity from an interrupted
  fade, so even rapid rotations no longer cause a temporary brightness drop. A bounded faint-source
  curve slightly enlarges and sharpens only dim measured samples, narrowing the perceived density
  gap between viewing directions without adding sources, moving coordinates, or making rotations
  pump the global exposure. Retained Gaia samples preserve their source identifiers and are now
  directly selectable and focusable from their shared GPU batches; their cards expose measured G
  and BP−RP values plus the calculated inverse-parallax distance. They remain absent from global
  search and labels, and the aggregate cells remain anonymous. The sampled field is incomplete. Under
  zoom-out, detailed samples cross-fade into calculated roots, which remain as a restrained bridge
  through the Local Group while the local volume follows a logarithmic scale blend into the Milky Way
  disc.
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
  The clean campaign of 28 August 2026 at revision `27db0e1` passed all ten reports. Medium/CPU 4× scale runs stayed at
  9.3 ms p95 with a 66.5 ms worst frame; low/CPU 6× remains at 16.6–16.7 ms p95 with an 83.4 ms
  worst frame. Observable runs resolved Jupiter 3/3 in both profiles, with no resource-count drift
  in that historical baseline.

## Current priorities

- Active-object ancestors now prepare once per frame instead of once per object, keeping target
  precedence and live catalogue updates. Missing parents and cycles are tested. The isolated
  CPU 6× fixture (503 entries, 200 updates) takes 74.6–80.3 ms versus 95.2–98.2 ms before,
  with identical LOD states. Camera and rendering rules are unchanged; this is not a whole-app FPS gain.
  Cold journeys pass 3/3 per profile (worst 66.8 ms low / 100.0 ms medium). Tempel medians are
  27.0 / 31.2 ms, but the medium worst frame reaches 78.2 ms; phase spikes remain open.
- The 8K panorama now decodes asynchronously before GPU upload, retaining its resolution and colors.
  Isolated Chrome / CPU 6× uploads fall from 742.7–790.8 ms to 96.2–102.8 ms, with identical
  sampled GPU pixels across Chromium, Firefox, and WebKit. Texture disposal releases the bitmap,
  including late loads. Initial prewarming allows at most 500 ms for the optional panorama,
  alongside shader compilation, to avoid shifting a normal local upload into the first navigation.
  Remaining GPU stalls and the clean full campaign stay open.
  Final cold journeys pass 3/3 low and 2/3 medium (worst 66.7 / 100.1 ms); the strict limit
  remains 100 ms. Tempel medians are 26.6 / 28.4 ms, with all six first-visible frames below
  33.3 ms. These small local series do not replace the clean campaign.
- After the search/label slice on 11 September, targeted journeys pass 3/3 in low/CPU 6× and
  medium/CPU 4× (worst 100.0 and 99.9 ms). Tempel medians are 33.7 ms low (above budget) and
  32.6 ms medium, with 3/3 preload hits per profile. Whole-journey worst-frame latency has not
  improved over the previous series. Individual phase tails and the clean full campaign remain
  open; these local results do not replace the historical baseline.
- Cosmicflows geometry and large-scale-structure symbols, including stable sorting and picking
  indices, now prepare in small cooperative batches with atomic publication and cleanup on
  cancellation. Their registries also prepare IDs, positions, label ranks, and search names/aliases
  in batches before publishing a complete search cache. Exoplanet IDs, positions, orbital
  preparation, host ranks, and search entries now use the same approach; featured links and
  scientific values are preserved. Positions and appearance are unchanged.
  Stellar tile indexing now also prepares its ID lookup and visibility bounds cooperatively,
  publishing only a complete index. All 3,964 Gaia cells and 378 tested view combinations are
  unchanged. HYG names and labels now prepare in cached batches. Search and exoplanet discovery
  publish together when complete, keeping the previous version usable and discarding obsolete
  work after data or language changes. Scientific values and result ordering are unchanged.
  Other stellar work, first-use GPU work, and the full clean performance campaign remain open.
- First CPU optimizations are in place: incremental structure-selection masks, cached ranking
  scores, and bounded search-keyword reuse. Camera and rendering are unchanged. Targeted scale
  reruns pass the whole-journey budgets; cold-loading phase spikes and a new clean campaign remain
  open, so the historical 10/10 result is not replaced.
- Confirm the aesthetic arm/core/halo balance and traversal feel against the references.
  The 10 September browser pass checks cloud continuity, parallax, HYG/Gaia overlap, and external
  galaxies without the oversized ring. Technical validation does not replace visual approval.
  Canonical physical distances and the ordinary camera path remain unchanged.
- Address the overruns measured on 10 September in the uncommitted local work:
  **7 of 10 protocol/profile reports meet their budgets**, without constituting an official manifest.
  Scale journeys exceed budgets in medium/CPU 4× and low/CPU 6×, with respective worst frames of
  200 ms and 149.9 ms; low Tempel reaches a 49.8 ms median first visible frame.
  Startup, resources, and the planetarium pass in both profiles, with Jupiter resolved 3/3
  and no geometry, texture, or draw-call-count drift.
- Profile those overruns, then repeat the official campaign on a clean revision. Retain the
  historical 10/10 manifest in the meantime without attributing it to the current renderer.
  Local diagnostics use Chrome 153 and the host Metal renderer: CPU throttling does not simulate
  a different GPU or memory. Physical validation remains optional if suitable medium/low hardware
  becomes available.

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
