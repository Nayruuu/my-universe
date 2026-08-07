# Changelog

All notable changes to Universe Map are documented in this file.

## [Unreleased]

### Changed

- Added a dedicated Observable-view night sky. Selecting **Locate from Earth** now leaves the 3D map
  for a target-centred horizon projection built from up to 3,500 bright HYG J2000 stars, rendered in
  one Canvas layer with magnitude-aware size, opacity, colour, halos, and restrained labels. The map
  is freely explorable with mouse or touch panning, wheel or pinch field-of-view zoom, explicit
  recentering, and independently switchable names and projected Stellarium constellation figures;
  the target's constellation is highlighted. Map panels disappear while the shared timeline remains
  available, and selecting a star alone never opens the observer view. The details panel still
  exposes apparent altitude, azimuth, compass
  bearing, a predefined or private custom Earth location, and an accessible azimuthal sky map;
  targets below the horizon remain explicitly identified instead of being presented as visible.
  Sirius from Paris, catalogue and constellation extraction, astronomical domain limits, projection,
  batched drawing, gesture limits, explicit activation, desktop, and mobile behavior are covered.
  Weather, local terrain, and proper motion remain outside this slice and are stated as such in the
  interface.
- Added a permanent scientific-distance audit to the deployment gate. It validates 361,748 bundled
  catalogue records and published filament points across their declared units, Cartesian norms,
  hierarchy, metadata cardinality, and reference-frame contracts, while reporting the explicitly
  illustrative NASA exoplanet fallbacks.
- Replaced the one-second average-FPS fallback with a render-loop-native adaptive-resolution
  controller. It evaluates bounded 120-frame windows, uses p95 and severe-frame ratios, applies
  hysteresis before reducing or recovering pixel density, and pauses sampling during semantic
  camera transitions or while the page is hidden. The policy is split from sampling and engine
  integration, fully covered at every threshold, exposed in the localized debug panel, and reported
  by the repeatable frame benchmark. A cold desktop/high journey remained stable at native browser
  density with a 9.1 ms p95 and 0.23% long-frame ratio.
- Added a repeatable cold-context Tempel transition benchmark across desktop and emulated-mobile
  profiles at low, medium, and high graphics quality. It reports medians for Three.js preparation,
  scene insertion, first visible frame, activation and total latency, preload hits, draw calls, and
  geometries, with an optional strict 30 FPS budget. The initial three-run local matrix measured
  less than 5 ms of preparation, at most 0.1 ms of scene insertion, and sub-27 ms median first
  frames, so the engine keeps its lazy shaders instead of adding unproven eager GPU compilation.
- Smoothed the nearby-Universe-to-cosmic-web transition by preloading the lazy Tempel rendering
  module in parallel with its existing Worker catalogue preparation. Three.js objects remain absent
  until the cosmic-web scale, while progressive reveal now updates only the newly visible or hidden
  range of the 520,356-vertex picking mask instead of clearing and rebuilding its complete active
  prefix on successive frames. Retry and failure behavior, exact selection visibility, and the
  no-geometry-before-activation boundary remain covered by unit and browser tests.
- Disabled production synchronization of the visually dormant HYG aggregate hierarchy. Galactic,
  Local Group, and exact-star navigation now issue no request to its 35-file static dataset and
  perform no aggregate parsing, sorting, or GPU-batch construction, while preserving the exact
  10,000-star HYG batch, search, constellations, labels, and volumetric Milky Way. Unit coverage
  protects the feature boundary and Chromium verifies the absence of aggregate network requests.
- Tempel now begins its Worker fetch and binary decoding one scale earlier, in the nearby-universe
  view, while keeping all Three.js geometry absent until the cosmic-web view actually needs it. The
  decoded catalogue promise is shared with the later installation, so scale traversal performs one
  request and one Worker run. Debug telemetry identifies preload hits and lead time and separately
  reports activation-to-visible latency, with unit and real-browser coverage for the complete path.
- Added end-to-end Tempel transition telemetry to the built-in debug panel. It now separates static
  catalogue fetch time, binary decoding inside the dedicated Worker, Worker round-trip, main-thread
  geometry preparation, scene installation, first visible render submission, and total time to the
  first visible frame. The timing state is isolated from Angular and covered with deterministic
  clocks plus a real Chromium scale-transition assertion, providing the measurements required
  before deciding whether GPU-tile preparation should also move off the main thread.
- Moved the lazy Tempel filament fetch, binary validation, and decoding of all 275,599 published
  spine points into a dedicated module Web Worker. The six resulting typed-array buffers are
  transferred back to the engine without a second structured-clone copy, the Worker is terminated
  after every result, and browsers or policies without Worker support fall back to the same
  validated main-thread loader. A separately type-checked worker target, complete fallback unit
  coverage, and a real-browser assertion now protect this path; GPU tile construction remains on
  the main thread pending cross-device profiling.
- Extended local solar-eclipse circumstances from the predefined French locations to any validated
  latitude and longitude, calculated entirely in the browser without geocoding or a backend. The
  timeline now exposes C1, optional C2, maximum, optional C3, and C4 in the observer time zone (UTC
  for custom coordinates), and marks contacts that occur below the local horizon. Paris contact
  fixtures for 12 August 2026 are checked against NASA GSFC local circumstances, with additional
  partial, total, annular, and sunset-boundary coverage.
- Updated the Angular 21 toolchain and framework packages to their patched 21.2 releases, and pinned
  vulnerable transitive build dependencies to compatible fixed versions. `npm audit` now reports
  zero known vulnerabilities without requiring an Angular 22 migration. Weekly grouped Dependabot
  updates now cover both the client npm tree and GitHub Actions while leaving Angular major-version
  migrations explicit.
- Scoped Azure deployment concurrency to eligible jobs so ignored workflow events can no longer
  cancel a verified production deployment.
- Applied the verified Dependabot patch and minor updates for Playwright, Node.js and Three.js
  typings, ESLint, typescript-eslint, and the pinned Azure login action. Major jsdom and
  angular-eslint migrations remain explicit.
- Added deterministic visual-regression coverage for the production Earth view, the Sun, the Solar
  System, the 12 August 2026 eclipse, the Milky Way, Sagittarius A*, and the cosmic web. The Earth
  check now proves that its local 2048×1024 Blue Marble texture is loaded, opaque, depth-tested,
  depth-writing, in the expected LOD, and materially contributes to the rendered framebuffer.
  Typed target-surface diagnostics are also exposed in `?debug=true`, while the dedicated visual
  matrix runs on Chromium, Firefox, and WebKit to catch engine-specific WebGL regressions.
- Split solar-eclipse cartography into two scientifically distinct layers. The default globe now
  shows the shadow at the selected instant, while the optional event map adds a body-fixed blue
  envelope for every sampled partial-eclipse footprint and a bounded coral or amber corridor for
  totality or annularity, including its northern limit, southern limit, and central line. The 12
  August 2026 maximum and the 18:00 UTC center, limits, and width are checked against NASA GSFC
  Besselian elements and path tables. The cumulative envelope is rasterized once when requested, so
  it remains continuous without adding per-sample Three.js objects or recurring frame work.
- Replaced the remaining generic axial spinners with date-dependent IAU body-fixed orientations.
  The Sun, eight planets, Moon, Galilean moons, Titan, Pluto, Ceres, and Vesta now resolve through
  explicitly sourced rotation definitions; the additional satellite and minor-body coefficients
  are transcribed from JPL NAIF `pck00011.tpc` and covered by independent reference fixtures. Earth
  still receives a readability cap at extreme playback speeds, but now snaps to the exact selected
  orientation as soon as playback pauses. East-positive Earth, Moon, Mars, and Venus maps are also
  aligned with the renderer's body-fixed longitude direction, while Jupiter's dated cloud map is
  explicitly identified as an illustrative source-epoch alignment.
- Disabled native page magnification on iOS and iPadOS while preserving the canvas-owned pinch
  gesture used to navigate the 3D Universe. Other browsers retain their native viewport behavior.
- Rebuilt the mobile shell around measured 320 px, 360 px, short-screen, and landscape layouts.
  Timeline controls now use fluid grids without clipping, essential touch targets are at least 44
  px, detail and catalogue panels scroll inside the free scene area, and compact landscape keeps a
  single-row timeline while hiding controls obscured by an open object card. Safe-area insets and
  visual-viewport resizing protect notches, home indicators, and the on-screen keyboard. Automated
  browser coverage now verifies portrait, landscape, short screens, touch gestures, panel spacing,
  and all eight interface languages.
- Rebuilt both sides of the Milky Way transition. Planetary, Solar System, and stellar views now
  share one lazily loaded 8192×1024 WebP interior sky band derived from ESO/S. Brunier's observed
  6000×3000 full-sky panorama. Its central 60-degree source crop is presented across 32 degrees of
  latitude and pitched into a stable diagonal cinematic composition, while direct direction lookup,
  mipmap-free upload, and one existing sphere draw keep the Galaxy sharp and inexpensive. The
  source credit, crop, display grade, orientation, and illustrative confidence remain available as
  renderer metadata. Solar System paths and primary labels now reuse one stable body-specific map
  palette, making the orbital hierarchy readable without adding geometry or draw calls. The layer
  fades continuously into the external galaxy both while zooming out and while the observer leaves
  the heliocentric neighborhood, preventing the local panorama from following a remote target. The
  outside view now
  uses an asymmetric two-major/two-minor
  barred-spiral atlas with domain warping and discontinuous dust rifts; its procedural point model
  is retained only as a load-failure fallback so it cannot duplicate the atlas as concentric rings.
- HYG stars and NASA exoplanet hosts now fade before a camera leaving the heliocentric catalogue
  volume can reveal its artificial selection boundary as a dense spherical clump. Selected objects
  remain navigable through their reusable marker while the photographic sky supplies continuous
  context. Bulk exoplanet-host rings are suppressed at planetary scale and return progressively in
  the stellar neighborhood, preventing thousands of catalogue symbols from forming a false sphere.
- Restored native pointer interaction for all three exoplanet catalogue filters by removing the
  panel-wide pointer cancellation. Every timeline control now shares the same visual vertical
  center, while its compact label floats above without shifting the interactive field. The desktop
  frame reserves six additional pixels of balanced vertical breathing room around both layers.
- Added a compact astronomical breadcrumb and a camera-derived scale bar to keep the current parent
  hierarchy and adapted map distance visible while zooming. Every ancestor remains directly
  navigable without opening search.
- Reworked the eclipse browser as a bounded, independently scrollable catalogue with eight-event
  pages, explicit earlier/later navigation, and a one-click return to the simulated date.
- Planet cards now distinguish close axial-rotation framing from full-orbit framing. Stellar
  photospheres now write the same logarithmic depth representation as the multi-scale renderer;
  selection markers and selected labels also respect depth occlusion, so bodies, paths, guides, and
  names behind the Sun no longer render through its visible disk. Stellar emissive intensity is now
  applied directly to the photosphere, preserving the Sun's radiance without drawing its glow over
  foreground objects.
- Raised Solar System map hierarchy without changing scientific spacing. Planet, dwarf-planet, and
  major-moon labels now enter the collision pass before stellar names, use a stronger interactive
  cartouche, and search nearby safe slots instead of disappearing when two bodies overlap on
  screen. A shared warm accent now identifies Solar System labels and orbital paths independently
  from the stellar catalogue, while the selected path remains stronger. The persistent Sun landmark
  respects the open detail panel's safe area instead of being rendered underneath it.
- Pointer-anchored target tracking now follows only the target's actual displacement and rebases that
  tracking state with the floating origin, preventing static galaxies from snapping to screen center
  after zoom.
- Replaced the Local Group's screen-filling galaxy sprites with a continuous two-stage visual LOD.
  Compact shared impostors now hand off to an inclined procedural disk with explicit core, arms,
  dust attenuation, irregular structure, and a quality-bounded 360/900/2,200-point stellar volume.
  The disk fades when the camera enters its adapted radius instead of becoming a flat full-screen
  wash. All particles remain inside one `THREE.Points` object per resolved galaxy, while the
  720-object Local Volume overview retains one draw call with smaller, sharper, normal-blended
  silhouettes. Positions remain catalogue-backed; internal morphology, orientation, particle
  placement, and visual dimensions remain explicitly illustrative.
- Upgraded the existing one-draw-call HYG star shader with a Moffat-like point-spread profile,
  temperature-colored halo, near-white core, restrained Airy ring, magnitude-gated diffraction,
  and a procedural photosphere for every catalogue entry. Surface detail appears progressively as a
  star grows on screen, so the 10,000-star layer retains one GPU draw call and no per-star scene
  objects. Spectral and luminosity classes, with B−V as a documented fallback, select one of eight
  bounded visual families: blue-white, white dwarf, yellow dwarf, orange dwarf, red dwarf, red
  giant, red supergiant, and brown dwarf. The selected-star impostor and close-focus 3D sphere share
  stable seeded granulation, dark cells, faculae, restrained illustrative tint, and a turbulent
  corona. Low quality reduces surface detail and disables Airy and diffraction terms; medium and
  high progressively restore them.
- Reworked Solar System and stellar-neighborhood atmosphere without adding per-star scene objects.
  One quality-bounded GPU point batch now combines an isotropic unresolved sky with a denser,
  temperature-colored galactic-plane population, while the full constellation network recedes
  behind its interactive highlight. Every observed HYG point now receives a magnitude-aware
  emissive footprint with a chromatic halo, near-white core, and restrained bright-star diffraction
  inside the existing single draw call. The one reusable constellation highlight now distinguishes
  hover from selection and gives the selected figure a near-opaque cyan-white additive core. Three
  explicitly illustrative local layers add integrated Milky Way light and dust, ecliptic zodiacal
  scattering, and a distance-aware procedural solar corona. Every layer uses damped distance fades,
  disappears before galactic scale, and the local environment is capped at three additional draw
  calls.
- Reworked the Nearby Universe as a catalogue-backed deep field instead of a sparse point cloud.
  The 720 observed Local Volume galaxies now use varied GPU impostors with elliptical and spiral
  profiles, inclination, dust attenuation, warm/cool stellar populations, and bounded luminous
  cores. A quality-capped sample of calculated Cosmicflows-4 groups supplies subdued unresolved
  background light during the transition. Positions remain catalogue-derived while shapes,
  orientations, and luminosities are explicitly labelled illustrative; both layers remain one draw
  call each and discard pixels outside their silhouettes. The observed layer now starts fading in
  before the Milky Way overview and reaches full opacity at the Local Group boundary. A dedicated
  lightweight backdrop adds a quality-bounded sample of the same calculated Cosmicflows-4 positions
  as unresolved light. It preserves catalogue directions while compressing radial depth into a
  documented LOD shell, removing the previously sparse interval without decorative directions or
  interactive targets. Quality budgets now expose approximately 3,800/9,100/16,600 groups with a
  brighter bounded halo, while the scale-aware foundation uses a near-black palette so catalogue
  stars and galaxies provide the scene's color and light.
- Made the published Tempel network readable at overview scale with a broader deterministic sample,
  exact one-pixel scientific axes, and a separately tagged screen-space halo. The halo uses bounded
  quality profiles, strengthens whole-spine hover and selection, and caps its own instance detail so
  close cosmic-web views can still expose every source segment without widening all 260,178 lines.
- Made the published Tempel spine network discoverable without search: its progressively sampled
  lines are now enabled by default at the cosmic-web scale, remain directly hoverable and clickable,
  and still defer the 4.53 MB binary request until that scale is reached. Replaced the BOSS voids'
  hard blue rings with larger, softly filled underdensity volumes whose organic cool extents remain
  an adaptive visual encoding. The 1,228 robust detections are enabled by default, receive an earlier
  progressive reveal, and keep cosmic-structure focus inside the correct semantic scale. Browser
  coverage now selects a visible filament segment directly and checks active void records by
  scientific type.
- Restored luminous large-scale landmarks without bringing back a decorative star wallpaper. The
  single Cosmicflows-4 point batch now reveals a broader quality-bounded sample, uses larger
  white-core halos, and maps relative catalogue depth from warm nearby groups to cool violet remote
  groups. The simulated density volume and scale-aware background add restrained cyan, violet, and
  amber separation, while the map key documents that the point color is a visual depth encoding.
- Reworked the cosmic-web view as a semantic, progressively disclosed map instead of drawing every
  catalogue symbol at once. Stable zoom- and quality-dependent prefixes now reveal Cosmicflows
  groups and documented structures without spatial popping, labels use a smaller collision-aware
  budget, and normal alpha blending prevents the central survey footprint from becoming an
  overexposed blob. An interactive layer panel keeps calculated groups, illustrative links,
  clusters, superclusters, filament centers, and voids distinguishable; the default synthesis keeps
  exact filaments and the progressively sampled BOSS void overlay visible. Every record remains
  searchable and directly focusable.
- Reduced the full-screen cosmic-volume cost with 16/26/40-step quality budgets, shader-side empty
  space leaping, 1×/1.25×/1.5× renderer pixel-ratio caps, and an immediate fallback to 1× after a
  severely slow frame-rate sample. A Retina browser regression test now bounds the combined
  `ray-march steps × pixel ratio²` budget at 90 instead of the previous worst case of 256.

### Added

- Added a localized creator profile to the in-app help and an About page in all eight guide
  languages. The presentation credits Nayruuu, links to the independent developer portfolio at
  `super-dev.app`, and offers an optional Buy Me a Coffee link without loading third-party widgets
  or tracking scripts. WebSite and WebApplication structured data now reference a dedicated Person
  entity connected to the portfolio, GitHub profile, and support page.
- Replaced the Angular placeholder favicon with a dedicated dark orbital Universe Map mark. SVG,
  48 px ICO, 180 px Apple touch, and 192/512 px install variants now cover browser tabs, bookmarks,
  home screens, and maskable PWA launchers across every localized manifest and the guide.
- Added a curated static layer for SN 1006, the Crab Nebula, Tycho's Supernova, Kepler's Supernova,
  Cassiopeia A, and SN 1987A. All six remain locally searchable and focusable, preserve documented
  J2000 coordinates, distance, type, host context, date, and source links where available, and use
  distinct label colors for explosions and remnants. Dated cards can jump directly to the historic
  event. One temporal model drives a quality-aware flash and a three-layer remnant through
  pre-event, rise, peak, fade, and remnant phases. The displaced outer envelope, braided cyan/green/
  warm filaments, and sparse emission knots replace the former regular dotted sphere; low quality
  omits the knot layer. Positions and historic epochs retain their catalogue confidence; light
  curves, composite colors, morphology, shell expansion, and apparent scale are explicitly
  illustrative and covered by the 100% scientific-calculation coverage gate.
- Added the complete 2026-08-05 NASA Exoplanet Archive `PSCompPars` snapshot: 6,333 confirmed
  planets around 4,747 host systems in a validated 1.05 MiB `UMEX` v1 binary. Every object is
  searchable locally, while a discovery panel filters distance, radius class, detection method,
  and an indicative temperate subset. One quality-bounded GPU point batch renders host systems and
  one reusable marker handles selection; only the focused host and its planets are materialized as
  detailed Three.js objects. ICRS J2000 directions are rotated into the Galactic map, all missing
  data remain explicit, and the 27 hosts without a NASA distance use a disclosed 1,000 pc
  illustrative depth. Published orbital dimensions retain their source, a missing counterpart may
  be calculated with Kepler's third law, and all phase, orientation, orbit scale, surface, and
  lighting choices remain labelled illustrative. Import, metadata, parsing, validation, search,
  filtering, rendering, lazy lifecycle, object cards, URL focus, and browser navigation are covered
  by the project's 100% coverage gate and end-to-end regression suite.
- Added the complete published Tempel et al. SDSS DR8 filament spines as a lazily loaded `UMFS` v1
  binary: 15,421 indexed filaments, 275,599 source points, and 260,178 consecutive line segments.
  The import preserves J2000 Cartesian positions plus visit-map, weighted-density, and orientation
  metrics, converts Mpc/h with the documented `h = 0.7`, and performs no curve smoothing. Four
  non-empty spatial GPU tiles share one shader material, use quality- and distance-aware progressive
  disclosure, support direct picking, and reuse whole-spine hover and selection lines. The deferred
  request remains non-blocking so it cannot place the startup overlay over an ongoing wheel gesture.
  Static data, runtime parsing, rendering, lazy lifecycle, error handling, and browser navigation
  are covered by regression tests and new debug counters.
- Added an optional Illustris-inspired cosmic-density envelope generated offline from the 37,730
  Cosmicflows-4 groups, a spatial sample of 10,987 of their 49,939 derived proximity links, and a
  deterministic 6³ cellular continuity field. Radial selection compensation prevents the nearby
  survey footprint from collapsing into a central blob. The validated 128³ `UMCV` v1 volume occupies
  about 2 MiB, uploads once as a single-channel `Data3DTexture`, and ray-marches through one box mesh
  with bounded 16/26/40-step quality profiles. The UI, metadata, and scene graph all label the
  continuous field `simulated`: it is an educational reconstruction, not Illustris data and not an
  observed matter-density measurement.
- Added a systematic, provenance-preserving large-scale-structure layer containing 26,500
  positionable detections from seven public catalogues: 8,757 SDSS DR7 supercluster detections,
  1,228 robust BOSS DR12 voids, all 15,421 Tempel SDSS DR8 filament envelopes, and the 1,094 Planck
  PSZ2 cluster detections that have a published redshift. One typed-array GPU batch, one reusable
  selection marker, lazy object cards, local search, confidence-aware symbols, bounded labels, and
  a survey-coverage warning expose every retained record without allocating one Three.js object per
  detection. Overlapping methods remain separate instead of being merged into invented physical
  identities.
- Added a single-draw-call overview of all 720 observed Local Volume galaxies directly from the
  static tile index. It fades in at the outer Milky Way boundary, remains behind streamed galaxy
  detail, and fades out before the Cosmicflows map dominates, removing the empty visual gap without
  inventing a decorative star field. Local Group galaxy impostors also receive a larger adaptive
  screen-space floor for readable continuous-scale navigation.
- Added a deterministic large-scale structure scaffold derived from the 37,730 Cosmicflows-4 group
  positions. A 20 Mpc spatial hash connects at most two nearby groups within 52 Mpc, producing 49,939
  illustrative edges in one GPU `LineSegments` batch. Low, medium, and high quality draw 28%, 62%,
  or 100% of a spatially distributed edge order; distance and radiance fades remain independent
  from the calculated group points. A continuously damped camera-distance LOD emphasizes the
  shortest, best-constrained links in the overview and progressively strengthens secondary
  connections while zooming in without adding draw calls. A compact scale-specific legend, debug
  counts, metadata, and the object card explicitly distinguish this visual interpretation from
  observed filaments.
- Added a validated static catalogue of Sagittarius A*, Cygnus X-1, and Gaia BH1 with searchable
  aliases, galactocentric positions, masses, Schwarzschild radii, activity states, scientific
  sources, object cards, direct focus, and shareable URL restoration.
- Added quality- and activity-aware black-hole representations with a true black silhouette, a
  restrained photon-ring cue, optional accretion emission, and jets only for active sources. A
  bounded screen-space pass now hides only the focused object's foreground subtree, captures the
  live background, applies the qualitative thin-lens relation `beta = theta - thetaE² / theta`, and
  then recomposes the opaque horizon, ring, disc, and optional jets in front. This prevents those
  foreground structures from being copied or stretched by their own lens while preserving the
  visual Einstein radius and inverted image. A full-color framebuffer remap deforms diffuse sky and
  bright objects together. Smooth inner and outer masks make the mapping meet the direct scene
  without a circular post-process seam. Its composition decouples the displayed lens radius from
  the bounded 768- or 1024-pixel source capture, keeping the effect stable across DPR 1 and Retina
  DPR 2 while avoiding an opaque square seam. The close foreground silhouette remains below a fixed
  screen-space radius so deeper zoom cannot hide the surrounding distortion. The shader samples
  only the live scene capture and never injects a fixed photographic or procedural sky texture.
  The pass stays disabled in low quality. Every non-observed visual element is explicitly marked
  illustrative, and selected black holes omit the generic reticle so it cannot be mistaken for
  physical structure.
- Kept the `cosmic-web` universe object as a navigation and scientific-data reference only. It no
  longer receives the generic opaque spherical body that overlapped Sagittarius A* at their shared
  origin and hid the inner part of the lens.
- Replaced Sagittarius A*'s former fixed lens-source image with a deterministic 3D nuclear star
  cluster rendered as one quality-aware GPU point batch. The live thin-lens framebuffer capture now
  keeps that world-space cluster while withholding only the black-hole foreground, restoring dense
  Einstein arcs without leaving a screen-space image behind after navigation.
- Added a quality-aware photographic Earth stack using local NASA Blue Marble surface and cloud
  composites, 2012 Black Marble night lights, and a Fresnel atmospheric rim. Cloud and night layers
  remain disabled in low quality.
- Added NASA/ESA Hubble's 2015 global Jupiter map at 1024×512 and 2048×1024, with the illustrative
  polar treatment documented alongside the asset.
- Added quality-aware LRO/LOLA Moon, Viking MDIM 2.1 Mars, and Magellan radar Venus maps, with local
  1024/2048 browser derivatives and explicit visual-confidence metadata in object details.
- Added a scale-aware photographic rendering profile across all seven navigation levels, with
  smoothly damped ACES exposure and quality-aware stellar and galactic radiance.
- Added a two-triangle, scale-aware deep-space background with continuously damped color, haze,
  vignette, and fog transitions. The layer is explicitly illustrative and quality-aware.
- Added a deferred 1024-pixel emissive Milky Way atlas rendered across three offset disc depths and
  one volumetric bulge. Low, medium, and high quality use bounded two-, three-, or four-mesh budgets.
- Added a quality-aware cinematic Milky Way profile with view-dependent atlas parallax, warm-core
  and cool-arm grading, analytical dust absorption, compressed highlights, and restrained glow
  without increasing the existing mesh budget.
- Added a second chromatic nebula layer and analytical dust rifts to the two-triangle cosmic
  background, continuously interpolated by camera distance and reduced by graphics quality.
- Added subtle temperature-colored diffraction to the brightest HYG stars inside the existing GPU
  batch, preserving one draw call for the complete catalogue.
- Added the four Galilean moons, Titan, Pluto, Ceres, Vesta, and Halley's Comet as searchable,
  selectable, URL-addressable Solar System objects with physical facts and orbital views.
- Added jovicentric Astronomy Engine positions for Io, Europa, Ganymede, and Callisto, plus strict
  JPL-backed catalogue tests for satellite and small-body orbital data.
- Added optional visual-distance scaling to Keplerian providers so satellite readability remains
  separate from stored scientific units, with extrapolated confidence labels for simplified
  two-body trajectories.

### Changed

- Moved the 49,939-edge Cosmicflows-4 nearest-neighbor search from browser startup into the static
  data pipeline. The UMCG v2 asset now stores validated 8-byte index pairs after its 37,730 group
  records, so runtime work is limited to typed-array decoding and GPU-attribute creation while the
  rendered graph and quality budgets remain unchanged.
- Replaced the hand-authored directions of the 16 featured stars with catalogue links to their HYG
  v4.1 J2000 entries. Search, cards, labels, picking, URLs, and rendering now share one canonical
  identity and one GPU point per star; the fixed 10,000-entry import also guarantees that faint
  featured neighbors remain bundled.
- Replaced the axisymmetric Milky Way placeholder with a deterministic, single-batch
  galactocentric density field combining a diffuse disc, a barred bulge, and four noisy logarithmic
  arm families based on Reid et al. (2019), while keeping every exact shape parameter explicitly
  illustrative.
- Rotated the heliocentric HYG catalogue into the Galactic J2000 basis, attached it to the Sun at
  `R0 = 8.178 kpc`, and removed exact stars, aggregate cells, constellation lines, and their labels
  from the galactic view so the catalogue boundary no longer resembles a physical stellar sphere.
- Replaced the procedural Moon, Mars, and Venus surfaces with instrument-derived static maps while
  retaining texture-free color fallbacks in low quality.
- Corrected procedural planet colors from linear RGB to sRGB, restored Saturn's golden atmospheric
  bands, and added a subtle illustrative shadow fill to the four giant planets.
- Rebuilt shared galaxy impostors as 256/384/512-pixel quality-aware compositions with cool stellar
  halos, warm cores, diffuse spiral filaments, and carved dust lanes; focused galaxies now remain
  smooth instead of revealing stretched point sprites.
- Softened the shared selection reticle so close astronomical imagery remains readable while the
  selected object is still explicit.
- Replaced the binary Milky Way-to-Local Group swap with a distance-driven crossfade: the detailed
  disc now contracts while the distant galaxy impostor fades in, without a transition gap or an
  auxiliary aura draw call.
- Faded the procedural star backdrop out before galactic scales and limited aggregated HYG cells to
  the Milky Way transition, removing the artificial stellar sphere from the Local Group map.
- Reduced the galactic particle veil so it adds depth and isolated highlights without washing out
  the atlas dust lanes or producing an opaque stellar skirt at oblique camera angles.
- Increased the Playwright test timeout from 35 to 60 seconds so real-Chrome context teardown stays
  reliable on saturated development machines without relaxing any navigation assertion.
- Made orbital line geometries scale-driven: they are created only for Solar System views or an
  explicitly requested orbit, then removed and disposed outside those LODs so additional bodies do
  not increase the galactic renderer budget.
- Deferred nearby-Universe tile synchronization until camera transitions settle, isolated streamed
  galaxies from the permanent Solar System registry, and stopped rebuilding the complete local
  search index when visible tiles change.

- Generalized semantic navigation from the fixed Earth route to every hierarchical object: planets,
  catalogue stars, galaxies, and galaxy clusters now retain their own reversible parent-frame
  journey across all seven scales.
- Separated focus, mouse, semantic-wheel, and native-pinch settlement events so labels always frame
  the object that was clicked and canonical routes advance only on real LOD-crossing zoom gestures.
- Applied the same automatic context changes after native touch pinch gestures, and prevented a
  second touch from releasing the active target.
- Added smooth reference-frame pivot transitions that preserve camera distance and direction and
  complete safely before rapid follow-up wheel, pointer, or touch input.
- Expanded debug mode with the active scientific frame, navigation origin, and physical camera
  target.
- Replaced the monolithic stellar LOD files with a camera-driven loose octree: 26 root cells, 85
  child cells, 34 shared static packs, frustum and screen-size selection, quality-aware refinement,
  bounded LRU caching, parent-to-child cross-fades, and one merged GPU batch per active resolution.
- Capped rapid stellar cross-fades to one active and one retiring GPU batch to prevent transient draw
  calls and resources from accumulating during long camera journeys.
- Added end-to-end hierarchy validation, active/cache diagnostics, failure-safe streaming that keeps
  the previous field visible, and a reversible browser journey across exact and aggregated views.
- Replaced upright decorative planet spinning with date-dependent IAU 2015 pole and prime-meridian
  orientations for the Sun, Moon, and all eight planets.
- Attached planetary rings and the active rotation guide to each body's physical equatorial frame.
- Preserved the active camera target when zooming over empty space so mouse orbit and pan controls
  remain available after zooming.
- Removed the inherited free-navigation zoom floor so repeated wheel input continues toward the
  pointer after the current target is released.
- Added restrained type-aware label colors for stars, planets, moons, small bodies, galaxies, and
  constellations while preserving one consistent interactive highlight.
- Added one persistent, clickable navigation landmark at every scale: the Sun for planetary through
  stellar views, then the Milky Way for galactic through cosmic-web views. Off-screen landmarks
  remain as restrained edge labels without arrow clutter, relocate around ordinary labels, and do
  not alter the visual LOD of their astronomical object.
- Added LOD-scaled HYG catalogue points and a reusable halo-to-volume representation for the active
  star without creating an individual Three.js object for every catalogue entry.
- Prevented the outer semantic boundary from consuming wheel input without moving the camera.
- Kept pointer-selected objects as zoom targets during active scale journeys and exposed the last
  wheel anchor, requested distance, applied distance, bounds, and clamp status through debug mode.
- Stabilized outward wheel zoom around the current camera pivot, and rebased the physical pivot
  whenever the semantic reference target changes.
- Added an off-axis HYG-star regression journey that traverses the Milky Way, Local Group, nearby
  Universe, and cosmic web before restoring the original catalogue-star context.
- Bounded the procedural Milky Way to screen-space particles, preventing near-camera points from
  expanding into large additive rectangles.
- Matched the reusable HYG close-range volume to its navigation radius, allowing useful close zoom
  without flooding the viewport.
- Prevented unlabelled points from the dense HYG batch from silently capturing mouse-wheel
  navigation while preserving explicit label, click, and search targeting.
- Restricted the procedural Milky Way and its galaxy impostor to their intended LODs so neither
  remains over stellar, Solar System, or planetary views, even while the galaxy stays selected.
- Expanded the brightness-ranked HYG label pool from 240 to 3,000 entries and raised adaptive
  desktop density to as many as 96 non-overlapping, directly interactive names.
- Added user-selectable minimal, balanced, and dense name profiles, scaling collision-free label
  budgets from 14 to 144 and persisting the preference in shareable URLs.
- Added screen-space body occlusion for astronomical labels, keeping background star names outside
  nearby planetary silhouettes while preserving the selected object and the body's own label.
- Expanded the Local Group map to 31 catalogue-backed galaxies around the procedural Milky Way,
  including Milky Way satellites, Andromeda satellites, and isolated dwarf galaxies.
- Added load-time validation of catalogue-derived galactic coordinates, hierarchical host-relative
  positions, explicit kiloparsec units, and a dedicated 100% scientific coverage gate.
- Added quality-aware galaxy label ranks and contextual host/satellite visibility so the global map
  remains readable while focused subgroup views retain useful neighboring targets and identify the
  active galaxy in the scale selector.
- Enriched galaxy cards with subgroup, absolute magnitude, and half-light radius data while
  preserving search, click focus, and shareable URL state for every mapped galaxy.
- Added a sixth semantic scale for the nearby Universe and extended the reversible wheel journey to
  120,000 rendering units.
- Added a static five-tile index containing 22 observed galaxies beyond the Local Group, with lazy
  search-target loading, lower-LOD unloading, and in-memory reuse.
- Expanded that layer to 720 unique observed galaxies: 698 records from the 1.5–11 Mpc Updated
  Nearby Galaxy Catalog plus the 22 curated entries, exposed through a validated 110-node adaptive
  octree while preserving the five editorial regions.
- Added a reproducible fixed-width catalogue importer, normalized Messier/NGC duplicate removal,
  brightness-ranked overview records, 24-object leaf bounds, `space-tiles-v2` hierarchy validation,
  and static completeness tests across every generated tile.
- Made the external-galaxy layer camera-driven: frustum selection runs at a bounded 4 Hz, graphics
  quality limits the active view to 2, 3, or 5 tiles, and selected or navigation-target tiles remain
  pinned even outside the current field of view.
- Merged generated Local Volume galaxies into the shared distant-object GPU point batch while
  retaining shaped impostors for the focused entry, indexed point picking, and curated galaxy
  visuals; debug mode now reports the active batched-galaxy count.
- Added J2000 equatorial-to-Cartesian validation in megaparsecs for the Updated Nearby Galaxy
  Catalog and ACS Virgo Cluster Survey data.
- Hid the compressed HYG field at the outermost LOD, enlarged the distant procedural backdrop, and
  strengthened galaxy impostors so the new overview remains legible.
- Exposed active, indexed, and cached galaxy-tile counts in debug mode and added browser journeys
  for quality-aware overview streaming, direct search, and shareable URL restoration.
- Added a seventh semantic scale backed by 37,730 Cosmicflows-4 galaxy groups between 11.1 and 772.7
  Mpc, with a reproducible fixed-width importer, compact typed-array binary format, and strict source
  checksum and Cartesian-position validation.
- Rendered the complete cosmic catalogue in one uncertainty-aware GPU point batch, with bounded PGC
  labels, direct search and selection, reusable highlighting, calculated-confidence cards, debug
  counts, shareable URLs, and reversible desktop and mobile navigation through the new outer scale.
- Added all 88 modern Stellarium constellation figures as one optional 644-segment HYG-backed
  `LineSegments` layer, with strict reference validation, LOD fading, CC BY-SA attribution, and
  shareable URL state.
- Added ranked, collision-free constellation names with reusable hover highlighting, click-to-frame
  navigation, local search, shareable targets, and illustrative information cards.
- Made the shared constellation line batch directly hoverable and selectable through indexed
  segment metadata and a screen-scaled raycast threshold.

## [0.1.0] - 2026-07-29

### Added

- Browser-only Angular and Three.js application with strict TypeScript.
- Hierarchical astronomical object model, scientific units, and floating-origin support.
- The Sun, eight planets, the Moon, orbital paths, axial rotation, atmospheres, and rings.
- Editable astronomical time, local ephemeris calculations, and multiple playback speeds.
- Solar and lunar eclipse visualization with selected local circumstances.
- Search, interactive labels, object information, confidence levels, and shareable URL state.
- 10,000 observed HYG stars rendered in a single GPU batch.
- Procedural Milky Way and a selectable Local Group of nearby galaxies.
- Reversible semantic zoom across five astronomical scales.
- Adaptive graphics profiles, touch controls, and renderer diagnostics.
- Automated formatting, linting, strict type checks, 100% production coverage, production build, and
  desktop/mobile Playwright verification.

[Unreleased]: https://github.com/Nayruuu/my-universe/compare/v0.1.0...HEAD
[0.1.0]: https://github.com/Nayruuu/my-universe/releases/tag/v0.1.0
