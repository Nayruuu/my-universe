# Universe Map Technical Reference

This document describes the implemented prototype in greater detail than the main README. It records
the current architecture, scientific boundaries, rendering choices, verification strategy, and
known limitations.

## Product direction

Universe Map aims to become a **continuous map of the Universe inspired by Google Maps**, rather than
a collection of disconnected planetarium scenes. The scale selector is a shortcut; the primary
navigation model is continuous zoom:

- the camera always preserves an explicit target or spatial context;
- reference frames and visual representations evolve with scale;
- label density adapts to available screen space and avoids overlaps;
- static spatial tiles will eventually load around the current view;
- search and direct selection reach any indexed object through a continuous, shareable transition.

The current engine implements the first representation changes, target handling, and five orders of
magnitude. Mouse-wheel navigation now moves continuously across those scales and can return exactly
to its initial framing without losing the target. Generalizing this journey to all reference frames,
touch input, and spatial tiles remains a product priority.

## Implemented astronomical scope

- the Sun, all eight planets, and the Moon;
- locally calculated analytical ephemerides for the Sun, Moon, and planets;
- a NASA Blue Marble Earth surface;
- orbital paths, axial rotation, atmospheres, and Saturn's rings;
- a highlighted selected orbit in the dedicated orbital view;
- an axial guide, equatorial rotation ring, moving halo, and rotation-period information;
- named nearby or notable stars plus 10,000 observed stars from HYG Database v4.1;
- an illustrative Milky Way generated with `BufferGeometry`;
- the Local Group with Andromeda, M32, M110, M33, the Magellanic Clouds, and several dwarf galaxies;
- procedural spiral, elliptical, and irregular galaxy silhouettes;
- desktop and touch orbital navigation, panning, zoom, and five direct scale shortcuts;
- selection, label-based focus, double-click focus, and local search;
- editable UTC date and time, play/pause, and eight simulation speeds;
- exact Earth rotation up to one simulated hour per real second, with visual stabilization above that
  speed;
- astronomical events integrated into the timeline and a catalogue of upcoming Earth eclipses;
- separate global and local eclipse maxima for selected French cities, with UTC and local time;
- Earth umbra and penumbra rendered on the Moon during lunar eclipses;
- lunar umbra and penumbra rendered on Earth during solar eclipses;
- cyan penumbra, coral totality, and gold annularity overlays;
- an optional central eclipse path, orbital framing, and ground views;
- low, medium, and high graphics profiles;
- optional labels and orbits;
- shareable URL state;
- scientific confidence information;
- renderer diagnostics through `?debug=true`.

Radii, inter-scale distances, and brightness are adapted when physical scale would make the map
unreadable. Calculated, extrapolated, procedural, and illustrative content is explicitly identified
in the interface.

## Navigation behavior

| Action                     | Desktop                                      | Touch                    |
| -------------------------- | -------------------------------------------- | ------------------------ |
| Orbit around a target      | Left-click and drag                          | One-finger drag          |
| Pan                        | Right-click and drag                         | Two-finger drag          |
| Zoom                       | Mouse wheel, semantic across scales          | Pinch                    |
| Select                     | Click an object                              | Tap                      |
| Focus                      | Click a name, double-click an object, or `F` | Tap a name or double-tap |
| Open orbital view          | Object-details action                        | Object-details action    |
| Play or pause time         | `Space`                                      | Timeline action          |
| Change simulation speed    | `+` / `-`                                    | Timeline selector        |
| Close the information card | `Escape`                                     | Close action             |

Search ignores case and accents and supports aliases such as `Earth`, `Gaia`, and `Milky Way`.

Zooming out with the mouse wheel starts a logarithmic semantic journey through planetary, Solar
System, stellar, galactic, and Local Group views. The current target remains the anchor for the full
round trip. An explicit focus action ends the current journey and establishes a new anchor.

When zooming inward outside an active semantic journey, the object under the pointer progressively
becomes the navigation target. Visible labels have enlarged hit areas and focus their object
directly. Zooming inward over empty space releases the target and disables orbit and pan gestures
until another object is focused. A contextual distance floor prevents the camera from losing all
spatial context.

## Architecture

```text
.
├── client/
│   ├── src/
│   │   ├── app/
│   │   │   ├── core/         # engine facade, search, settings, and URL state
│   │   │   └── features/     # view, details, timeline, search, controls, and debug
│   │   ├── engine/
│   │   │   ├── core/         # UniverseEngine and RenderLoop
│   │   │   ├── camera/       # controls, transitions, and semantic zoom
│   │   │   ├── coordinates/  # units, reference frames, and floating origin
│   │   │   ├── loaders/      # manifest and static datasets
│   │   │   ├── lod/          # current level of detail
│   │   │   ├── materials/    # Three.js representations
│   │   │   ├── objects/      # hierarchy, registries, and labels
│   │   │   ├── performance/  # automatic quality policy
│   │   │   ├── rendering/    # scene and particle fields
│   │   │   ├── selection/    # raycasting and pointer intent
│   │   │   └── simulation/   # time and position providers
│   │   └── data/             # strict contracts and runtime validation
│   ├── public/data/          # static astronomical datasets
│   ├── e2e/                  # Playwright journeys
│   └── tools/                # data preparation and coverage gates
├── docs/                     # project-level technical documentation
├── .agents/                  # reusable tool-independent roles
└── .github/                  # repository workflows
```

The root/client split follows the same convention as the Portfolio repository: project governance
and documentation stay at the root, while the Angular application is self-contained in `client/`.
`client/src/engine` does not depend on Angular components. Angular subscribes to typed engine events
through `UniverseEngineFacade`. The Three.js loop runs outside Angular change detection, and orbital
calculations update less frequently than rendering.

## Hierarchical coordinates

Objects are transformed relative to their parent:

```text
Local Group
├── Milky Way
│   ├── Magellanic Clouds
│   └── Sun
│       ├── Earth
│       │   └── Moon
│       └── other planets
└── Andromeda
    ├── M32 and M110
    └── Triangulum Galaxy
```

Scientific units remain present in the source data. `CoordinateSystem` applies a distinct rendering
scale for Solar System, stellar, galactic, and Local Group frames. Stellar distances are compressed
to keep the prototype navigable, while intergalactic positions use a linear kiloparsec transform.
`FloatingOriginManager` recenters the scene whenever a distant target would exceed the renderer's
precision threshold.

## HYG stellar catalogue

The dense observed field comes from
[HYG Database v4.1](https://github.com/astronexus/HYG-Database), licensed under
[CC BY-SA 4.0](https://creativecommons.org/licenses/by-sa/4.0/). It contains the 10,000 brightest
valid entries other than the Sun, at epoch and equinox J2000.

Coordinates remain stored in parsecs in a little-endian binary file of approximately 782 KiB. A
compact string table preserves display names, alternate designations, and spectral types. The
browser parser validates the signature, version, dimensions, frame, values, UTF-8 strings, and
magnitude order before exposing typed arrays to rendering.

All dense stars share one `THREE.Points` and one `BufferGeometry`. The 10,000 entries remain available
at every scale and graphics quality. Quality settings only reduce the procedural background, pixel
ratio, and effects. Coordinates and magnitudes are observed data; distance compression, screen size,
and the visual B−V conversion remain rendering adaptations.

Entries are searchable by name or HYG, HIP, HD, HR, Gliese, Bayer, and Flamsteed designations. A
visible point can be selected directly, and its label can focus the camera and open a shareable
scientific card.

Bright HYG labels appear progressively with scale. Their limits are 14, 26, or 40 according to
graphics quality, and 28 in the galactic view. Editorial objects and the current selection receive
priority before duplicate and overlap filtering.

From `client/`, the asset is reproducible from the upstream CSV:

```bash
npm run data:stars
```

Detailed provenance and import instructions are stored in
`client/public/data/stars/hyg-v41.meta.json` and `client/data-sources/README.md`. A binary-catalogue
error does not prevent startup: the engine reports a degraded state and preserves named objects and
the procedural background.

## Time and ephemerides

Internal time uses a Julian day:

```ts
interface UniverseTime {
  julianDay: number;
}
```

Components do not use `Date` as the source of truth. `Date` is only a user-interface boundary for
epochs it can represent safely.

Available providers are:

- `StaticPositionProvider`;
- `KeplerianOrbitProvider`;
- `SolarSystemEphemerisProvider`;
- `LinearProperMotionProvider`;
- `ProceduralPositionProvider`.

The Solar System provider uses
[Astronomy Engine](https://github.com/cosinekitty/astronomy), an MIT dependency executed locally in
the browser. Its compact VSOP87 and lunar models are validated by the upstream project against NOVAS
and JPL Horizons. Universe Map performs no network request to calculate a position.

Earth's visual rotation remains astronomically exact up to `1 hour / second`. At higher speeds, the
animation is capped at one rotation every 24 real seconds to preserve readability. Date and orbital
positions continue at the selected simulation speed. When paused, orientation converges smoothly to
its exact value; direct date navigation applies the exact orientation immediately.

## Eclipse model

The timeline detects a solar eclipse at the displayed date. The camera can frame its central point,
while umbra, penumbra, and the optional geographical path remain visible in orbital navigation.

The local catalogue calculates upcoming Earth events in the browser and distinguishes the global
maximum from the maximum observable in selected French cities. Canonical UTC, browser-local time,
occultation, and local solar altitude are presented together.

This prototype catalogues eclipses from Earth's reference frame. Occultations in other planetary
systems are not yet indexed. Shadow calculations use physical radii and distances before projecting
onto visually adapted spheres. The solar-shadow axis intersects an oblate Earth geoid in the
equatorial frame of date.

Orbital overlays use explicit colors and a documented minimum visual size because the physical
umbra would be almost invisible at globe scale. Ground views recalculate the apparent Moon-to-Sun
ratio so an annular eclipse is not rendered as total.

The central point of the 12 August 2026 eclipse is checked against
[NASA GSFC Besselian elements](https://eclipse.gsfc.nasa.gov/SEbeselm/SEbeselm2001/SE2026Aug12Tbeselm.html).

## Rendering and performance

- one Three.js object per named body, never per dense-catalogue star;
- star fields and the Milky Way use `BufferGeometry`;
- all 10,000 observed HYG stars persist in one GPU batch;
- one reusable GPU marker materializes the selected HYG entry;
- particle density, geometry, textures, and pixel ratio adapt during initialization;
- targeted visual reconstruction and resource disposal when quality changes;
- three shared procedural textures for galaxy impostors;
- a static Earth texture selected by graphics quality, without external runtime requests;
- shared spheres, rings, and selection volumes per quality level;
- one reusable equatorial guide for the active object's rotation;
- screen-space LOD with impostor/detail fades and hysteresis;
- distant objects batched with per-vertex color, size, and opacity;
- raycast volumes placed on a non-rendered selection layer;
- labels drawn in one 2D canvas at 30 Hz with priority, duplicate, and overlap filtering;
- procedural texture generation without one object allocation per pixel;
- orbital calculations capped at 12 Hz;
- logarithmic camera interpolation with damping between orders of magnitude;
- pointer-directed zoom prioritizing named objects over galaxy halos;
- minimum camera distances based on object families rather than illustrative radii;
- orbit and pan enabled only while a target is active;
- geometries, materials, textures, listeners, and controls released by `dispose()`;
- renderer metrics available through `?debug=true`.

## Static data

The client data entry point is `client/public/data/manifest.json`. Each JSON dataset is validated at
load time. Duplicate identifiers and invalid parent references are rejected with actionable errors.

To add an object:

1. add it to a dataset referenced by the manifest;
2. provide a unit, reference frame, and position provider;
3. declare `scientificConfidence`;
4. add only the visual properties required by its representation;
5. run the tests and production build.

The catalogue remains intentionally compact and educational. Directional positions in the small
editorial stellar catalogue are illustrative; displayed distances remain in metadata.

Local Group positions derive from the galactic coordinates and heliocentric distances compiled in
[McConnachie 2012, AJ 144:4](https://www.astro.uvic.ca/~alan/Nearby_Dwarf_Database_files/mcconnachie2012.pdf).
They are converted once to Cartesian coordinates and stored in
`client/public/data/galaxies/local-group.json`. Major galaxy morphologies and orientations also use
[SIMBAD/CDS](https://simbad.u-strasbg.fr/simbad/sim-id?Ident=M31). Positions and distances are
`observed`; radii, luminosities, and silhouettes remain adaptive to keep dwarf galaxies selectable.

Earth uses the
[NASA Visible Earth Blue Marble](https://science.nasa.gov/earth/earth-observatory/the-blue-marble-true-color-global-imagery-at-1km-resolution/)
mosaic. The cloud-free variant keeps continents and calculated eclipse shadows readable.

## Shareable URL state

Example:

```text
/?target=earth&selected=moon&time=2026-07-27T10:00:00.000Z&zoom=4.20&mode=state&quality=medium&orbits=1&labels=1
```

Updates use debounced `history.replaceState` calls with a one-second maximum delay, so URL state
continues to follow a running timeline without changing every frame. Existing debug query state is
preserved.

## Tests and automation

Vitest covers:

- scientific unit and reference-frame conversion;
- `Date` to Julian day conversion;
- Keplerian orbits and local ephemerides;
- Earth eclipse catalogues and classification;
- local maxima, occultation, and solar altitude for Paris and Biarritz on 12 August 2026;
- Sun–Earth–Moon alignment, geoid intersection, and shadow phases for 2026 and 2027 eclipses;
- solar corridors, central points, and total/annular apparent ratios;
- lunar and solar shadow-material uniforms and activation;
- linear proper motion;
- time, render loop, Earth rotation stabilization, and floating origin;
- camera transitions, reversible semantic zoom, focus interruption, and navigation limits;
- full Earth orbital framing and Neptune's orbit at intermediate LOD;
- prograde Earth and retrograde Venus rotation guides;
- mouse, label, and touch selection;
- manifest loading, HTTP errors, duplicate identifiers, and invalid parents;
- graphics-quality recommendation;
- local search and aliases;
- URL serialization, deserialization, and continuous synchronization;
- LOD selection, hysteresis, and apparent size;
- Local Group coordinates, galaxy silhouettes, and the fifth navigation scale.

Playwright covers critical Chromium journeys:

- label-based selection and focus;
- Earth → Local Group → Earth wheel navigation without target or framing drift;
- bounded free zoom and suspended orbit gestures after releasing a target;
- direct scale selection on desktop and mobile;
- HYG point selection, labels, search, and shareable scientific cards;
- search, date, quality, and URL restoration after reload;
- eclipse browser navigation, automatic detection, path, and ground views;
- local maximum selection with UTC and French local time;
- local Earth texture loading, smooth rotation, and Saturn ring readability;
- high-speed Earth rotation capping and pause resynchronization;
- renderer budgets in the galactic view;
- mobile layout, tap, and two-finger pinch.

Install the test browser once:

```bash
npx playwright install chromium
```

From `client/`, `npm run test:coverage` enforces 100% statements, branches, functions, and lines
across production code. Every scientific module declared in `client/tools/check-coverage.mjs` also
retains an individual gate. Coverage prevents untested regressions; scientific validity is verified
separately through reference values, invariants, bounds, and degenerate cases.

From `client/`, `npm run verify` runs strict application and E2E type checks, Prettier, ESLint,
Stylelint, coverage, the production build, and Playwright. GitHub Actions executes the same command
on each push and pull request and uploads coverage or browser diagnostics when applicable.

Angular's persistent cache is disabled in `client/angular.json` to avoid a native LMDB crash
observed with Node 24 on macOS. This does not affect generated application output.

## Known scientific limitations

- analytical ephemerides are appropriate for visualization, not spacecraft navigation;
- orbital paths are drawn around a reference epoch and become illustrative far from 2026;
- Earth–Moon distance is visually amplified;
- planetary and stellar sizes are exaggerated;
- Blue Marble is a real but fixed composite with no live weather;
- axial rotation is visually slowed above `1 hour / second` and resynchronized on pause;
- local eclipse maxima are limited to predefined French cities, without free location input or full
  contact timings;
- eclipses and occultations outside Earth's frame are not catalogued;
- directional positions in the small editorial star catalogue are illustrative;
- the Milky Way is procedural;
- galaxy positions are static at their reference epoch, with strongly adapted visual dimensions;
- Observable view exists in the contract and interface but still previews simultaneous state mode;
- the prototype does not implement relativity, full gravitational simulation, or ground exploration.

## Next engineering steps

1. generalize semantic zoom to touch and every object, with fully automatic reference-frame changes;
2. add static stellar tiles, caching, and worker processing;
3. adapt label density to screen area and visible objects;
4. progressively load nearby galaxies beyond the Local Group;
5. add major moons, dwarf planets, comets, and asteroids;
6. accept arbitrary eclipse locations and expose detailed local contact times;
7. implement the physically delayed Observable view;
8. benchmark startup, memory, and frame rate across a broader device panel.
