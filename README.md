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

## Highlights

- Continuous semantic zoom from any planet, star, or galaxy group to the cosmic web, with a
  reversible parent-frame journey, pointer-directed free-space navigation, and equivalent mouse and
  touch context changes.
- One persistent clickable landmark across the whole journey: the Sun through stellar scales, then
  the Milky Way through intergalactic scales, clamped to a collision-free safe position when it is
  off-camera without changing the visual priority of the underlying object.
- The Sun, all eight planets, the Moon, the four Galilean moons, Titan, Pluto, Ceres, Vesta, and
  Halley's Comet, with searchable cards and selectable orbital paths.
- Date-dependent IAU axial orientations for supported bodies, atmospheres, and Saturn's rings.
- Locally calculated planetary and lunar ephemerides with an editable UTC timeline and multiple time
  speeds.
- A compact observed catalogue of 10,000 HYG v4.1 stars, rendered as one GPU batch with adaptive
  point sizes, up to 144 collision-free names through three user-selectable density profiles, and a
  reusable point-to-halo-to-volume focus representation. The 16 featured star cards resolve to
  their exact HYG J2000 entries instead of maintaining a second set of hand-authored directions.
- A camera-driven stellar loose octree that streams only visible 640/320-parsec regions from 34
  shared static packs, progressively refining calculated 160/40-parsec aggregates without changing
  search or focus precision.
- A cinematic layered 3D Milky Way with a deferred emissive atlas, view-dependent texture
  parallax, three physical depths, dust absorption, restrained glow, a volumetric barred bulge, and
  a galactocentric particle field. The observed Solar neighborhood remains correctly offset from
  the center and is hidden before it can collapse into an artificial galactic clump.
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
- A searchable layer of 720 observed nearby-Universe galaxies, backed by five curated regions and a
  110-tile static Local Volume octree with screen-size refinement, 2/3/5-tile quality budgets,
  target pinning, parsed-data reuse, and one shared GPU point batch for generated catalogue entries;
  focusing an entry temporarily restores its shaped galaxy impostor.
- A seventh cosmic-web scale containing 37,730 calculated Cosmicflows-4 galaxy groups from 11.1 to
  772.7 Mpc, rendered as one GPU point batch with uncertainty-aware styling, quality-bounded labels,
  PGC search, reusable selection highlighting, scientific cards, and URL-addressable focus.
- A continuously blended deep-space backdrop whose restrained navy, indigo haze, and vignette
  evolve with camera distance without a hard visual cut between semantic scales.
- Searchable and clickable names, object details, confidence levels, and shareable URL state.
- Solar and lunar eclipse visualization, including local circumstances for selected French cities.
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

## Quality gates

The project uses strict TypeScript, ESLint, Angular template linting, Stylelint, Prettier, Vitest,
Playwright, and a production build check.

```bash
npm run verify
```

From the repository root, the equivalent command is `make verify`.

The current baseline contains:

- 911 unit and integration tests plus 21 static-data pipeline tests;
- 100% statements, branches, functions, and lines coverage across production code;
- individual 100% coverage gates for declared scientific modules;
- 45 end-to-end Chromium journeys across desktop and mobile viewports.

GitHub Actions runs the same verification on every push and pull request.

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

## Data provenance

- Planetary and lunar calculations use
  [Astronomy Engine](https://github.com/cosinekitty/astronomy), executed locally in the browser.
- Major-moon mean distances and physical properties come from the
  [NASA/JPL planetary satellite tables](https://ssd.jpl.nasa.gov/sats/), while Ceres, Vesta, and
  Halley use explicitly extrapolated two-body elements from the
  [NASA/JPL Small-Body Database](https://ssd.jpl.nasa.gov/tools/sbdb_lookup.html).
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
- The Earth texture uses NASA Visible Earth Blue Marble imagery stored with the application.

See [client/data-sources/README.md](client/data-sources/README.md) and the in-app confidence labels
for detailed provenance and known visual adaptations.

## Roadmap

- Move future larger-catalogue decoding and octree preparation into Web Workers, and add deeper
  hierarchy levels when the source density requires them.
- Derive navigable density, cluster, and filament hierarchy from the discrete Cosmicflows-4 groups.
- Expand the Solar System selection with additional scientifically useful moons and small bodies.
- Implement the physically delayed **Observable view** temporal mode.
- Benchmark startup time, memory, and frame rate across a wider device panel.

## License

The application source code is available under the [MIT License](LICENSE). Bundled datasets and
third-party assets remain subject to their respective licenses and attribution requirements.
