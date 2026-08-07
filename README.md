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
  reversible parent-frame journey, pointer-directed free-space navigation, and equivalent mouse and
  touch context changes.
- One persistent clickable landmark across the whole journey: the Sun through stellar scales, then
  the Milky Way through intergalactic scales, clamped to a collision-free safe position when it is
  off-camera and kept outside an open object card without changing the visual priority of the
  underlying object.
- The Sun, all eight planets, the Moon, the four Galilean moons, Titan, Pluto, Ceres, Vesta, and
  Halley's Comet, with searchable cards and selectable orbital paths. In the Solar System overview,
  primary-body names receive map priority, collision-safe placement, and a stable body-specific map
  accent. Orbital paths reuse the same Mercury-to-Pluto palette without adding draw calls.
- A complete local snapshot of 6,333 confirmed exoplanets around 4,747 host systems from the NASA
  Exoplanet Archive, including ten richer featured planets in the Kepler-186, Kepler-22,
  Kepler-452, and TRAPPIST-1 systems. Every record is searchable and filterable without a backend;
  one GPU point batch maps the hosts, while only the focused system receives detailed Three.js
  objects. Catalogue facts remain distinct from derived or illustrative orbit dimensions, phase,
  orientation, scale, lighting, and surface appearance.
- Date-dependent IAU axial orientations for the Sun, eight planets, Moon, Galilean moons, Titan,
  Pluto, Ceres, and Vesta, with sourced body-fixed frames exposed in the object card. Atmospheres,
  Saturn's rings, and the active equatorial guide inherit the same orientation.
- Locally calculated planetary and lunar ephemerides with an editable UTC timeline and multiple time
  speeds.
- A compact observed catalogue of 10,000 HYG v4.1 stars, rendered as one GPU batch with adaptive
  point sizes, a photographic Moffat-like halo, temperature-colored envelope, near-white core,
  subtle Airy ring, and quality-bounded diffraction for genuinely bright entries. Every catalogue
  point carries a stable procedural surface profile that becomes visible as its screen diameter
  grows, without leaving the single GPU draw call. Eight illustrative families distinguish
  blue-white stars, white dwarfs, yellow and orange dwarfs, red dwarfs, red giants, red
  supergiants, and brown dwarfs through color, granulation, dark cells, corona, and apparent size.
  Up to 144 collision-free names are exposed through three user-selectable density profiles, while
  one reusable selected-star detail grows into a limb-darkened 3D surface at close focus. The 16
  featured star cards resolve to their exact HYG J2000 entries instead of maintaining a second set
  of hand-authored directions.
- Six searchable historical supernovas and remnants — SN 1006, the Crab Nebula, Tycho's Supernova,
  Kepler's Supernova, Cassiopeia A, and SN 1987A — with documented J2000 positions, distances, host
  context, dates where available, and direct event replay from each information card. A
  three-layer procedural remnant — broken outer envelope, braided filaments, and sparse emission
  knots — plus a date-driven flash make the events readable without presenting the illustrative
  light curve, composite color, morphology, or expansion as measured time-resolved data.
- A continuous local-space cinematic environment for Solar System and stellar-neighborhood views:
  a GPU-integrated 360-degree Milky Way sky built from an 8K runtime crop of ESO/S. Brunier's
  observed full-sky panorama, presented as a distant 32-degree photographic band with an explicitly
  illustrative diagonal composition, subtle ecliptic zodiacal light, a distance-aware solar corona,
  and a quality-bounded
  3,000/7,000/14,000-point unresolved sky. The Galactic Center remains fixed in the galactic
  reference frame instead of following the camera. The crop and presentation are explicitly
  illustrative even though the source pixels are observational. These layers fade
  continuously into the external galaxy before galactic scale or when the observer leaves the
  heliocentric neighborhood, and add at most three draw calls.
- A camera-driven stellar loose octree that streams only visible 640/320-parsec regions from 34
  shared static packs, progressively refining calculated 160/40-parsec aggregates without changing
  search or focus precision.
- A cinematic layered 3D Milky Way with an asymmetric barred-spiral emissive atlas, domain-warped
  view parallax, three physical depths, discontinuous dust rifts, restrained glow, and a volumetric
  barred bulge. Its procedural point field is now fallback-only, preventing duplicated rings once
  the atlas is ready. The observed Solar neighborhood remains correctly offset from the center and
  is hidden before it can collapse into an artificial galactic clump.
- A searchable black-hole layer containing Sagittarius A*, Cygnus X-1, and Gaia BH1, with
  catalogue-backed positions and masses, activity-aware silhouettes, and a quality-aware,
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
  Compact shared impostors cross-fade into inclined procedural disks and bounded 3D particle
  volumes when approached, exposing spiral, elliptical, or irregular structure instead of scaling
  a flat halo across the viewport. Catalogue positions remain observed; internal morphology,
  particle placement, orientation, and adapted dimensions are identified as illustrative.
- A searchable layer of 720 observed nearby-Universe galaxies, backed by five curated regions and a
  110-tile static Local Volume octree with screen-size refinement, 2/3/5-tile quality budgets,
  target pinning, and parsed-data reuse. A lightweight one-draw-call overview keeps all 720 real
  catalogue positions visible across the Local Group transition. Varied elliptical and spiral GPU
  impostors provide a photographic deep-field hierarchy while their shapes, orientations, and
  luminosities remain explicitly illustrative. Streamed tiles add labels, picking, and detail;
  focusing an entry temporarily restores its dedicated shaped galaxy impostor.
- A seventh cosmic-web scale containing 37,730 calculated Cosmicflows-4 galaxy groups from 11.1 to
  772.7 Mpc. The exact catalogue remains searchable while one GPU point batch progressively reveals
  a deterministic, spatially distributed sample as the camera approaches. A separate one-draw-call,
  non-interactive deep-sky batch introduces about 3,800/9,100/16,600 calculated groups in
  low/medium/high quality between the Milky Way and Local Group scales. It preserves each catalogue
  direction while compressing radial depth into a clearly documented LOD shell, maintaining spatial
  continuity without a decorative star field. A second GPU batch adds
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
- A lazily loaded, non-blocking 4.53 MB binary line layer preserving all 275,599 points and 260,178 consecutive
  segments published for the 15,421 Tempel SDSS DR8 filaments. The source coordinates and three
  published confidence metrics remain in typed arrays; the browser groups the survey into four
  non-empty spatial GPU tiles, progressively reveals lines by zoom and quality, and highlights the
  complete source spine when selected. A separately identified, quality-aware screen-space halo
  improves overview readability without changing the source axis or claiming a physical diameter;
  no smoothing or per-segment Three.js object is introduced.
- A continuously blended deep-space backdrop whose restrained navy, indigo haze, and vignette
  evolve with camera distance without a hard visual cut between semantic scales.
- Searchable and clickable names, object details, confidence levels, and shareable URL state.
- A continuously visible astronomical breadcrumb and camera-derived scale bar, both explicitly
  marked as adapted visual cartography rather than a globally physical projection.
- Solar and lunar eclipse visualization, including an instantaneous shadow, an optional whole-event
  visibility envelope and bounded central corridor, local circumstances for selected French cities,
  a scrollable past/future event catalogue, and direct return to the simulated date.
- Three adaptive graphics profiles, desktop and touch navigation, and a built-in debug panel.
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
| Zoom                       | Mouse wheel, semantic across scales          | Pinch                    |
| Select                     | Click an object                              | Tap                      |
| Focus                      | Click a name, double-click an object, or `F` | Tap a name or double-tap |
| Play or pause time         | `Space`                                      | Timeline button          |
| Change simulation speed    | `+` / `-`                                    | Timeline selector        |
| Close the information card | `Escape`                                     | Close button             |

The scale selector provides direct shortcuts to planetary, Solar System, stellar, galactic, Local
Group, nearby-Universe, and cosmic-web views. Floating controls independently toggle orbits,
constellation figures, and astronomical names.

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

The current baseline contains:

- 1,590 unit and integration tests plus 72 static-data, documentation, and deployment tests;
- 100% statements, branches, functions, and lines coverage across production code;
- individual 100% coverage gates for declared scientific modules;
- 92 end-to-end journeys, including desktop and mobile Chromium coverage plus deterministic visual
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
- Major-moon mean distances and physical properties come from the
  [NASA/JPL planetary satellite tables](https://ssd.jpl.nasa.gov/sats/), while Ceres, Vesta, and
  Halley use explicitly extrapolated two-body elements from the
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
- The illustrative four-arm Milky Way density model is informed by the maser-parallax structure
  compiled by [Reid et al. (2019)](https://doi.org/10.3847/1538-4357/ab4a11).
- The compact black-hole layer combines the
  [Event Horizon Telescope Sagittarius A* result](https://eventhorizontelescope.org/blog/astronomers-reveal-first-image-black-hole-heart-our-galaxy),
  [Miller-Jones et al. (2021) Cygnus X-1 measurements](https://arxiv.org/abs/2102.09091), and the
  [updated Gaia BH1 orbit](https://arxiv.org/abs/2312.05313). Positions are cross-referenced against
  SIMBAD or ESA Gaia metadata; all horizons and emission structures are strongly enlarged visual
  adaptations rather than relativistic reconstructions. The local lens is an achromatic thin-lens
  approximation applied only to the background; it is not a general-relativistic ray tracer.
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

- Move future larger-catalogue decoding and octree preparation into Web Workers, and add deeper
  hierarchy levels when the source density requires them.
- Move Tempel binary decoding and GPU-tile construction into a Web Worker if the wider device
  benchmark identifies a main-thread transition hitch.
- Extend the same provenance-preserving geometry contract to published wall, basin, attractor, and
  repeller products without merging incompatible survey definitions.
- Expand the Solar System selection with additional scientifically useful moons and small bodies.
- Implement the physically delayed **Observable view** temporal mode.
- Benchmark startup time, memory, and frame rate across a wider device panel.

## License

The application source code is available under the [MIT License](LICENSE). Bundled datasets and
third-party assets remain subject to their respective licenses and attribution requirements.
