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
- indexed static spatial tiles load and unload with the current view;
- search and direct selection reach any indexed object through a continuous, shareable transition.

The current engine implements seven semantic levels, hierarchical target memory, a camera-driven
stellar loose octree, a galaxy-tile streaming layer, and a GPU-batched Cosmicflows-4 group map.
Mouse-wheel and touch navigation move continuously across those levels. A target can travel through
its own parents and return to the same planet, catalogue star, galaxy, or galaxy group instead of
being forced back onto the terrestrial route.

## Implemented astronomical scope

- the Sun, all eight planets, the Moon, the four Galilean moons, and Titan;
- Pluto and Ceres as dwarf planets, Vesta as a notable asteroid, and Halley's Comet;
- locally calculated analytical ephemerides for the Sun, Moon, planets, Pluto, and Galilean moons;
- explicitly extrapolated two-body paths for Titan, Ceres, Vesta, and Halley;
- a NASA Blue Marble Earth surface;
- orbital paths, date-dependent IAU axial orientations, atmospheres, and Saturn's rings;
- a highlighted selected orbit in the dedicated orbital view;
- an axial guide, equatorial rotation ring, moving halo, and rotation-period information;
- named nearby or notable stars plus 10,000 observed stars from HYG Database v4.1;
- six searchable historical supernovas and remnants with documented J2000 positions, direct source
  links, date-aware illustrative appearance, and event replay where the first-light epoch is known;
- 6,333 NASA Exoplanet Archive confirmed planets around 4,747 hosts, with a local discovery panel,
  one batched host layer, lazy focused systems, and an explicit separation between catalogue facts,
  calculated missing orbit dimensions, and illustrative rendering;
- Sagittarius A*, Cygnus X-1, and Gaia BH1 as searchable black holes with activity-aware visual
  profiles and catalogue-backed physical facts;
- all 88 modern constellation figures as an optional 644-segment illustrative layer;
- an illustrative Milky Way generated with `BufferGeometry`;
- 31 catalogue-backed Local Group galaxies around the procedural Milky Way, organized into Milky
  Way satellites, Andromeda satellites, and isolated members;
- 720 observed galaxies beyond the Local Group, indexed across five curated regions and 110
  adaptive Local Volume octree tiles;
- 37,730 calculated Cosmicflows-4 galaxy groups between 11.1 and 772.7 Mpc in one GPU batch;
- procedural spiral, elliptical, and irregular galaxy silhouettes;
- desktop and touch orbital navigation, panning, zoom, and seven direct scale shortcuts;
- selection, label-based focus, double-click focus, and local search;
- editable UTC date and time, play/pause, and eight simulation speeds;
- exact Earth rotation up to one simulated hour per real second, with visual stabilization above that
  speed;
- astronomical events integrated into the timeline and a catalogue of upcoming Earth eclipses;
- separate global and local eclipse circumstances for predefined French locations or arbitrary
  observer coordinates, with C1–C4 contacts, UTC or local time, and horizon status;
- Earth umbra and penumbra rendered on the Moon during lunar eclipses;
- lunar umbra and penumbra rendered on Earth during solar eclipses;
- cyan penumbra, coral totality, and gold annularity overlays;
- an optional central eclipse path, orbital framing, and ground views;
- low, medium, and high graphics profiles;
- optional labels, orbits, and constellation figures;
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
System, stellar, galactic, Local Group, nearby-Universe, and cosmic-web views. Outward zoom remains centered on
the current camera pivot so an off-axis cursor cannot amplify lateral drift across several orders of
magnitude. `NavigationContextJourney` derives and remembers a route from the selected object's
parent hierarchy: for example Mars → Sun → Milky Way → Local Group → nearby Universe → cosmic web,
or a HYG star → Milky Way → Local Group → nearby Universe → cosmic web. The canonical scale entry points retain the familiar
Earth route. Every automatic frame change interpolates the physical OrbitControls pivot for 320 ms
while preserving camera distance and direction. A subsequent input first completes that reframe,
avoiding logical and physical target divergence during rapid wheel sequences. Camera settlement
events distinguish focus transitions, mouse interactions, semantic wheel steps, and native pinches:
a click cannot be misread as a parent-frame change, and a route advances only when a real zoom
crosses an LOD boundary. At the outermost semantic scale, the journey releases the wheel to
continuous camera zoom instead of consuming an input without movement. An explicit focus action
ends the current distance journey and establishes a new hierarchical route.

The label layer maintains one semantic landmark throughout that journey. LOD 0–2 reserve the Sun;
LOD 3–6 reserve the Milky Way. This is a label-only navigation policy: the underlying 3D objects
continue to follow their normal visual LOD and receive no foreground priority. If the landmark
leaves the camera frustum or sits behind the camera, its clickable name is projected onto a safe
viewport position, without an arrow or a second decorative marker. Ordinary labels are laid out
first; the landmark then uses an unoccupied slot instead of covering or suppressing them. It remains
subject to the global names toggle. On desktop, an open object card contributes a left safe inset so
the projected Sun cannot remain technically rendered underneath Angular UI.

At Solar System overview LOD, planets, dwarf planets, and major moons enter the same collision pass
before stellar labels. Their larger bordered cartouches use a shared warm Solar System accent, expose
an anchor point, and search a bounded three-ring neighborhood when the initial rectangle is occupied.
The same accent remains on a focused local body through LOD 2, while exoplanets retain their distinct
catalogue color. The fallback remains bounded and allocation-free per label frame; an object is
omitted if no safe slot exists rather than covering unrelated map information.

When zooming inward, the object under the pointer progressively becomes the navigation target,
including during an active semantic return journey. Changing that target preserves the journey's
distance progression and rebuilds its parent route. Visible labels have enlarged hit areas and focus
their object directly. Unlabelled points from the dense HYG batch do not capture wheel navigation
implicitly; they remain available through an explicit label, click, or search action.

Pointer-anchored targets retain the offset between the selected object and the OrbitControls pivot.
The camera follows only the object's subsequent displacement, so a time update cannot recenter a
static galaxy or a moving planet after the zoom has already preserved its screen point. When the
floating origin shifts, the tracked position is rebased by the same vector before the next temporal
update.

Zooming inward over empty space projects the pointer ray onto the current navigation plane and moves
toward that free point, while preserving the logical target and its route. The OrbitControls native
pinch uses the gesture centroid in the same way; when the gesture settles, the engine applies any
LOD-driven parent-frame change. A second touch cancels click selection but no longer releases the
active navigation target. When no object has been focused, orbit and pan remain disabled until a
target is chosen, while wheel and pinch zoom continue to work. A contextual distance floor prevents
the camera from losing all spatial context.

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
│   │   │   ├── simulation/   # time and position providers
│   │   │   └── tiles/        # static index and tile streaming policy
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
Cosmic web
├── Cosmicflows-4 galaxy groups
└── Nearby Universe
    ├── Local Group
    │   ├── Milky Way
    │   │   ├── Magellanic Clouds
    │   │   ├── Sagittarius A*, Cygnus X-1, and Gaia BH1
    │   │   └── Sun
    │   │       ├── Earth
    │   │       │   └── Moon
    │   │       └── other planets
    │   └── Andromeda
    │       ├── M32 and M110
    │       └── Triangulum Galaxy
    └── external galaxy tiles
```

Scientific units remain present in the source data. `CoordinateSystem` applies a distinct rendering
scale for Solar System, stellar, galactic, Local Group, nearby-Universe, and cosmic-web frames. Stellar
distances are compressed to keep the prototype navigable, while intergalactic positions use linear
kiloparsec or megaparsec transforms. `FloatingOriginManager` recenters the scene whenever a distant
target would exceed the renderer's precision threshold.

At Solar System overview LOD, existing orbit materials switch to the shared warm semantic accent and
62% opacity without allocating geometry or adding draw calls, while the active orbit uses a brighter
92% treatment.

### Galactocentric Milky Way layer

The Sun is stored in the Galactic frame at `R0 = 8.178 kpc` on scene +X. HYG J2000 equatorial
vectors are rotated into the Galactic basis before their compressed stellar positions are attached
to that Solar origin. Floating-origin shifts therefore never change the physical Sun-to-center
relationship.

The close Milky Way layer combines two explicitly illustrative representations centered at the
origin. A deterministic `BufferGeometry` mixes a diffuse disc, a barred bulge, and four noisy
logarithmic arm families with a rounded 13-degree pitch. A deferred 1254-pixel emission atlas adds
continuous stellar light and dust lanes across three slightly rotated planes at different Galactic
heights. Its revised morphology uses two dominant open arms and two shorter fragmented families;
the shader applies bounded domain warping and offset dust rifts to prevent a ring-like reading. A
shaded ellipsoid supplies the central bulge's thickness, so an orbiting camera observes parallax
instead of a single flat card. Low, medium, and high quality expose one, two, or three disc planes
respectively; the bulge remains the fourth and final high-quality mesh.

Each disc shader also derives the projected camera direction in its local tangent frame and samples
the atlas at three shallow depth offsets. The resulting view-dependent parallax is graded toward
cool blue-white arms and a warm core, while local luminance differences carve absorptive dust lanes.
A soft analytical glow is limited before ACES tone mapping, and the brightest core values are
compressed locally to preserve texture detail. Quality profiles continuously scale parallax, dust,
glow, color grading, texture anisotropy, and visible depth count; they never allocate an additional
post-processing pass or mesh.

The arm count follows the maser-parallax reconstruction of Reid et al. (2019), but the generated
atlas, phase, width, bar orientation, colors, vertical thickness, and particle density remain visual
adaptations. No arm geometry is parented to or generated from the Sun. The atlas loads from
planetary through galactic scales. Once ready, it fully replaces the procedural particle field; a
failed request leaves that deterministic point model as a usable fallback without duplicating it
over the photographic layer.

The exact HYG batch and its spatial aggregates remain searchable and focusable but are not drawn in
the galactic view. Their labels and constellation overlays are hidden there as well. This prevents
the catalogue's finite heliocentric selection volume from appearing as a physical spherical
overdensity. The layered detail and its distant impostor still cross-fade from camera distance.

### Black-hole layer

The eagerly loaded `public/data/black-holes/catalog.json` dataset contains Sagittarius A*, the
active X-ray binary Cygnus X-1, and the dormant binary Gaia BH1. Each record preserves an ICRS J2000
direction, heliocentric distance, derived Galactic coordinates, mass, Schwarzschild radius, source
links, activity classification, and an explicit rendering adaptation. Search aliases, labels,
details, focus, semantic navigation, and URL restoration use the same object definition.

Runtime validation accepts black holes as a distinct object family, restricts activity to
`dormant`, `quiescent`, or `active`, and checks the optional accretion-disc inclination. Static tests
independently rotate the preserved equatorial coordinates into the Galactic basis. Sagittarius A*
remains at the Galactic origin. Cygnus X-1 and Gaia BH1 retain their derived galactocentric
components as metadata, but their rendered positions use heliocentric Galactic vectors parented to
the Sun, matching the stellar catalogue contract. Their unselected visuals stop before the Milky
Way overview; conversely, Sagittarius A* appears only in the Galactic overview. This prevents
nonlinear compression around two different origins from making a stellar black hole look closer
than a Solar System planet.

The close representation is deliberately bounded and quality-aware. Every object receives a black
event-horizon silhouette, a thin reusable photon-ring cue, and an unresolved far impostor. A
focused black hole in medium or high quality also activates a background-first screen-space
composition. Only the target's foreground subtree is hidden for the initial scene render, so the
copied framebuffer retains actual sky content and any object-owned lensing environment. The
qualitative thin-lens mapping uses `beta = theta - thetaE² / theta`: the sign change at the distinct
visual Einstein radius produces an inverted image, and bounded tangential samples retain bright
stellar arcs instead of reducing them to a blur. The mapped square is drawn over the direct
background, then the black-hole foreground is isolated on reserved layer 2 and rendered once in
front.
The scene background is temporarily disabled during that foreground-only draw so Three.js cannot
clear the lensed sky; visibility, camera layers, background, clear state, and renderer statistics
settings are restored even when a draw fails.

The source copy is capped at 768 physical pixels in medium quality and 1024 pixels in high quality;
the rest of the scene keeps the direct rendering path and its original sharpness. Within the lens,
the shader replaces the complete destination color with the thin-lens center sample and two bounded
tangential samples. Diffuse sky, dust, stars, and filaments therefore deform together rather than
leaving the original low-frequency background untouched. Smooth inner and outer alpha masks return
to the direct scene without a circular or square seam. Logical screen-space radii let the displayed
lens grow independently of framebuffer DPR without replacing untouched pixels outside that mask.
This specifically prevents Retina DPR 2 from shrinking the distortion underneath the foreground
silhouette.

Strength and bounds fade smoothly. When the uncapped foreground would exceed a 16%
viewport-height radius, its foreground composition receives the inverse screen-space scale for that
draw only. The original transform is restored immediately afterward, preserving picking, catalogue
dimensions, and camera navigation while keeping at least a 3:1 influence-to-core ratio. The close
Milky Way overview is intentionally inactive around Sagittarius A*. Sagittarius A* instead declares
a deterministic 3D nuclear star cluster: 3,072 points in medium quality or 6,144 in high quality,
stored in one `BufferGeometry` and rendered by one `Points` draw. This explicitly illustrative
cluster is a sibling of the withheld foreground, so it remains in the live framebuffer capture and
produces dense arcs without any fixed screen-space image. It follows the object's normal LOD fade
and world transform, giving it parallax and ensuring it disappears when navigation leaves the
Galactic nucleus. Other black holes receive no invented environment. The `cosmic-web` universe
definition remains searchable and focusable but uses no generic body geometry; otherwise its opaque
sphere would overlap Sagittarius A* at their shared origin. Low quality bypasses the pass and the
cluster completely. Quiescent and active sources add stylized accretion emission; only an active
source adds low-opacity jets, and low quality omits those jets. Black holes never enter the generic
luminous-point batch and disappear outside their intended stellar-to-galactic LOD range unless
focused.

This renderer is not a physical image generator. It performs no curved-space ray tracing, Doppler
beaming, gravitational redshift, time-delay calculation, or inference of an unmeasured viewing
geometry. Horizons, rings, discs, jets, and lensing cues are strongly enlarged and tagged
`illustrative`; cards keep the measured or calculated confidence of the underlying catalogue facts
separate from those visual choices.

### Local Group map layer

The Local Group dataset contains 31 catalogue-backed neighbors in addition to the Milky Way
representation stored with the Solar System hierarchy. Galactic longitude `l`, latitude `b`, and
heliocentric distance `D` are converted to the renderer's Local Group basis:

```text
x = D cos(b) cos(l)
y = D sin(b)
z = D cos(b) sin(l)
```

Satellites are stored relative to their host galaxy while retaining their catalogue coordinates in
metadata. During static-data loading, the engine resolves the complete hierarchy and checks each
reconstructed Cartesian position against the catalogue value within 0.75 kpc, matching the dataset's
three-decimal precision.

The global Local Group LOD exposes the complete map. Galaxy names use editorial ranks capped at 12,
24, or 40 entries for low, medium, or high quality before ordinary collision filtering. In a closer
galactic view, focusing a host or one of its satellites keeps that subgroup visible and suppresses
unrelated galaxy impostors. Contextual satellite impostors follow the same quality-aware rank budget,
avoiding unnamed GPU work on constrained devices. Every mapped member remains searchable,
clickable, URL-addressable, and available in the details card.

Each curated galaxy uses a two-stage visual LOD. The distant representation remains one shared
256/384/512-pixel procedural impostor, but it now fades out as soon as the projected radius can
support resolved structure. A fixed-orientation near group then renders one procedural disk and one
`THREE.Points` stellar volume. Its spiral, elliptical, or irregular profile combines a bounded
luminous core, dust attenuation, seeded clumps, and an approximate inclination derived from the
catalogued apparent axis ratio. Low, medium, and high quality allocate 360, 900, or 2,200 particles
without creating individual stellar scene objects. The disk also fades while the camera enters its
adapted radius, preventing the former full-screen translucent rectangle. This is a navigation and
appearance model rather than a resolved observation: object positions and catalogue metadata retain
their source confidence, while morphology, orientation, particle placement, and scale remain
illustrative.

### Nearby-Universe tile layer

The sixth LOD introduces the first real static streaming boundary. The root manifest loads only the
`space-tiles-v2` index at `public/data/tiles/nearby-universe/index.json` during startup. That index
contains bounds, hierarchy links, object identifiers, compact search entries, and a minimal
position/color/radius overview; complete renderable object records remain in deferred tile files.
It exposes 720 unique observed galaxies: 22 in the five curated
Sculptor, M81, Centaurus A, Canes Venatici, and Virgo regions, plus 698 generated from the Updated
Nearby Galaxy Catalog between 1.5 and 11 megaparsecs.

The generated catalogue uses 110 deterministic octree nodes beneath eight root octants. Each
internal node retains four brightness-ranked overview objects and distributes the remaining records
among its children; leaves contain at most 24 galaxies. The current hierarchy reaches level 4 only
where source density requires it. This additive layout preserves broad landmarks while revealing
fainter galaxies as the camera approaches a region, without duplicating an object between tiles.

The compact overview entries are rendered as one GPU point batch, so every catalogue position
remains spatially legible while navigating from the Local Group into the Local Volume. Stable hashes
derive varied screen-space inclination, axis ratio, profile, and stellar-color seeds for elliptical
and spiral impostors. Catalogue radius still controls the dominant size term; the generated shape,
orientation, brightness, and dust cue are explicitly illustrative. Pixels outside each elliptical
silhouette are discarded before the more detailed fragment work. This layer starts with a restrained
continuous fade at 6,200 scene units, is effectively fully visible by the 17,000-unit Local Group
landmark, and disappears before the outer Cosmicflows view. It adds no procedural positions:
streamed tiles progressively overlay the same observed coordinates with richer labels, picking
metadata, and focused galaxy silhouettes.

Between 5,800 and 55,000 scene units, a separate non-interactive point batch provides line-of-sight
depth from Cosmicflows-4 without invoking the richer galaxy-group shader. Its deterministic quality
budgets expose approximately 3,800, 9,100, or 16,600 calculated positions in low, medium, or high
quality. Their catalogue directions are preserved while radial depth is compressed into a
24,000–56,000 scene-unit shell for this LOD, preventing sources from slipping behind the camera
during the Milky Way–Local Group transition. The tiny circular marks represent unresolved group
light; their depth, brightness, and color are explicitly adapted or illustrative. This layer uses
one draw call, creates no selectable objects, and is disabled together with the cosmic-groups map
layer.

The scale-aware fullscreen foundation now remains close to neutral black across all seven scales.
Low-strength blue, violet, and cyan haze still provides depth, but luminous catalogue batches,
galaxies, stars, and cosmic structures supply the dominant color and brightness instead of the
background itself.

The calculated Cosmicflows-4 point layer now enters this view as a deliberately subdued background
once the camera leaves the Local Group. Its continuous fade starts at 30,000 scene units and reaches
roughly 0.15 opacity at the 120,000-unit Nearby Universe landmark. At that distance, a graphics-
quality cap exposes a stable subset as unresolved, inclined group-light impostors; the full map
returns to compact point symbols toward LOD 6. This fills the documented interval beyond 11 Mpc
without confusing those calculated groups with the brighter 720 observed Local Volume galaxies;
illustrative proximity links remain hidden until the cosmic-web transition.

At LOD 5, the engine projects each tile's scientific bounds into the render frame, applies the
floating-origin offset, rejects bounds outside the camera frustum, and ranks the remaining tiles by
projected screen size. Selection is refreshed at most four times per second. Low, medium, and high
quality keep at most 2, 3, or 5 view tiles active respectively. A root whose projected diameter
crosses the quality threshold opens a single dominant parent-to-child path first, then uses any
remaining budget for visible siblings and roots. Searching for an indexed but unloaded galaxy first
loads its containing tile and then performs the normal focus transition; a selected or
navigation-target tile remains pinned even when it is outside the current field or the engine
returns below LOD 5. Parsed objects stay in an in-memory cache, so revisiting a tile does not issue
another static HTTP request. Generated catalogue galaxies from all active tiles share the existing
GPU point batch, including per-vertex color, size, opacity, and indexed picking. The engine keeps
their shaped sprites dormant in overview mode and activates only the selected or navigation-target
sprite, preserving detailed focus without one draw call per visible catalogue galaxy. Curated
galaxies retain their dedicated impostors. Debug mode exposes active, indexed, cached, and currently
batched galaxy counts.

The Updated Nearby Galaxy Catalog stores J2000 right ascension `α`, declination `δ`, and distance
`D`. The preparation data is converted into an equatorial Cartesian frame:

```text
x = D cos(δ) cos(α)
y = D sin(δ)
z = D cos(δ) sin(α)
```

Runtime validation recomputes each position from its preserved catalogue metadata and also checks
tile identifiers, reference frames, and megaparsec bounds. The selected Virgo members use
surface-brightness-fluctuation distances from the ACS Virgo Cluster Survey.

### Cosmicflows-4 group layer

LOD 6 extends the map beyond the Local Volume with the fixed-width group table from
[Cosmicflows-4, CDS J/ApJ/944/94](https://cdsarc.cds.unistra.fr/viz-bin/cat/J/ApJ/944/94), published
by [Tully et al. (2023)](https://doi.org/10.3847/1538-4357/ac94d8). Static preparation excludes the
323 records at or inside 11 Mpc already owned by the detailed nearby-Universe layer. The resulting
37,730 groups span 11.1 to 772.7 Mpc.

The approximately 1.53 MiB `cosmicflows4-groups.bin` v2 file uses one 40-byte header, fixed 32-byte
little-endian group records, and an appended array of 8-byte filament index pairs. Typed arrays
preserve J2000 Cartesian coordinates in megaparsecs, catalogue distance, distance-modulus
uncertainty, CMB-frame velocity, PGC identifier, distance modulus, and the precomputed graph. Both
the import script and browser parser verify record dimensions, unique identifiers, finite
measurements, distance ordering, the Cartesian norm, filament bounds, ordering, uniqueness, and
the exact file length. Scientific coordinate conversion uses the same equatorial basis as the
nearby-Universe catalogue.

Every group shares one `THREE.Points` draw call. A deterministic identifier hash defines a stable,
spatially distributed reveal order; the geometry draw range exposes only the active prefix according
to camera distance and graphics quality. The complete typed catalogue remains resident and
searchable, and a focused result uses one reusable marker even when it is outside the current map
sample. Distance uncertainty modulates point size and opacity. In the Nearby Universe transition,
the same vertices become quality-capped unresolved group-light impostors with varied axis ratios,
orientations, cores, and secondary lobes. These appearances are illustrative because Cosmicflows-4
provides group positions and distances rather than member morphology. They blend back into compact
white-core point halos before the full cosmic-web map. An explicitly illustrative logarithmic depth
gradient maps nearby groups to warm gold and remote groups to cool violet. Low, medium, and high
quality expose progressively ranked label pools before the normal screen-space collision pass.
Search accepts
`PGC N`, creates object definitions only on demand, and details expose distance, uncertainty,
CMB-frame velocity, source, and `calculated` confidence.

During static data preparation, a deterministic 20 Mpc spatial hash derives a first large-scale
structure scaffold. Each group connects to at most its two nearest neighbors within 52 Mpc;
duplicate pairs and zero-length edges are rejected. The fixed catalogue produces 49,939 edges,
stored as index pairs after the scientific records. The browser only expands these pairs into
duplicated line endpoints with per-vertex alpha and detail-threshold attributes for a single
`THREE.LineSegments` draw call; it never rebuilds the spatial graph. A deterministic hash orders
edges across the volume, allowing low, medium, and high quality to expose at most 28%, 62%, or 100%
without revealing only one contiguous catalogue region. A second confidence threshold combines that
quality budget with the camera-distance detail value, so the far overview shows only the strongest
scaffold and progressively restores secondary links toward the nearby-Universe boundary. Distance
uncertainty and neighbor distance attenuate the line alpha. The normally blended line batch fades
independently from the calculated points, and the map panel can hide it without changing the group
layer.

The graph carries `illustrative` confidence. It is a visual interpretation of proximity in the
catalogue coordinate field, not an observed link, a density estimator, or a reconstructed continuous
cluster, wall, void, or filament field.

### Simulated cosmic-density volume

The static pipeline turns the Cosmicflows point field and its illustrative proximity scaffold into a
128³ single-channel density texture over ±800 Mpc. Group contributions are weighted by distance
modulus uncertainty and compensated for radial catalogue selection; 10,987 of 49,939 links are
sampled across the full edge list. A deterministic 6³ cellular field supplies explicitly simulated
continuity outside measured coverage, while one separable smoothing pass and logarithmic encoding
preserve faint filaments and dense nodes. The resulting `cosmic-web-density.bin` is approximately
2 MiB and uses the validated `UMCV` v1 format: a 64-byte header followed by one unsigned byte per
voxel.

At runtime the loader uploads the field once as a `THREE.Data3DTexture`. One back-face box mesh
ray-marches at most 16, 26, or 40 samples for low, medium, or high quality. Empty samples advance by
2.8×, 2.1×, or 1.6× respectively, while distance damping fades the layer in only across the
nearby-Universe-to-cosmic-web transition. A density-driven cyan/violet body, amber dense cores,
bounded procedural detail, edge fading, early alpha termination, and normal blending create the
volumetric appearance without allocating objects per voxel. The map panel controls this volume
independently from groups, links, and documented structures.

The renderer, metadata, and interface mark the field `simulated`. It is visually inspired by modern
cosmological simulations, but it does not bundle Illustris output and must not be interpreted as an
observed or simulation-derived physical matter-density cube. Catalogue points remain calculated;
proximity links remain illustrative; their volume envelope and cellular gap filling are simulated.

### Documented structure catalogues

A separate `UMCS` v1 asset preserves 26,500 positionable detections from seven public source tables:
8,757 SDSS DR7 supercluster detections, 1,228 robust BOSS DR12 voids, 15,421 SDSS DR8 Bisous
filament envelopes, and 1,094 Planck PSZ2 clusters with an external redshift. The importer retains
overlapping survey methods as separate records and excludes the 559 PSZ2 entries without a redshift
instead of assigning a synthetic distance. Its JSON sidecar stores source-level citations, URLs,
methods, record counts, SHA-256 hashes, and the flat ΛCDM conversion used for display coordinates.

The approximately 1.4 MiB binary uses a 48-byte header, fixed 48-byte records, and one UTF-8 string
table. Typed arrays retain Cartesian position, catalogue distance and scale, confidence, optional
void density/boundary values, optional member count, source index, structure kind, flags, and source
identifier. Runtime parsing validates the exact byte length, source and type agreement, source
cardinalities, scientific ranges, Cartesian norms, identifiers, and global distance bounds before
scene integration.

All records share one normally blended `THREE.Points` batch. A deterministic per-source reveal order
and a camera-distance draw range progressively disclose the map instead of compositing all 26,500
symbols in the overview. Softly filled, deterministically warped blue volumes identify void
detections without implying a measured spherical boundary; violet halos identify superclusters,
cyan marks identify filament-envelope centers, and compact pale points identify Planck clusters.
Void size is derived from the published effective radius and boundary distance before a bounded
screen-space adaptation. The default synthesis enables clusters, superclusters, Tempel filaments,
and an earlier progressive sample of all 1,228 robust BOSS voids. A four-component shader mask and
CPU picking mask switch those semantic layers without reallocating geometry or adding a draw call.
Cosmic structures use a minimum focus distance that keeps their documented batch in the cosmic-web
semantic scale. The exact filament binary and rendering chunk preload at the nearby-universe LOD,
but no Tempel Three.js object exists before the cosmic-web LOD or an explicit filament target needs
it. One selection point is reused for every catalogue target, every retained record remains
searchable and focusable, object definitions are materialized lazily, and labels share a reduced
collision- and quality-aware budget. The in-app map panel states both that catalogue detections can
overlap and that missing survey coverage is not a measured cosmic void.

The Tempel center symbols are complemented by a separate `UMFS` v1 line asset containing all 15,421
indexed filaments, 275,599 published spine points, and 260,178 consecutive segments from table 2 of
Tempel et al. (2014). The 4,533,016-byte binary is referenced by the manifest and speculatively
fetched one scale early in the nearby-universe view, or immediately when the cosmic-web LOD, its
filament layer, or a filament target requires it. A 64-byte header records the reference frame,
unit, epoch, dimensions, point-distance bounds, and available metrics. Each 8-byte index entry stores
the source filament ID, point count, and contiguous point offset; each 16-byte point stores three
`float32` J2000 Cartesian coordinates plus quantized visit-map, weighted-density, and
orientation-strength values.

The lazy source request, complete header/index/point decode, midpoint-octant partitioning, reveal
ordering, render-array construction, and tile-bound calculation run in one dedicated module Web
Worker. Only the source descriptor crosses into the Worker; the source and prepared render typed
arrays are transferred back to the engine, not copied through structured cloning. The Worker is
terminated after success, a catalogue error, or a runtime failure. Worker construction, message
transport, and runtime failures fall back to the same validated loader on the main thread, while
deterministic catalogue errors are returned directly and never trigger a duplicate download. The
thin Worker entry has its own `WebWorker` TypeScript target because Angular's application builder
does not type check worker code; its pure request handler and browser-side lifecycle remain under
complete unit coverage, and Playwright proves that the production path starts one Worker and issues
one request.

This background operation deliberately does not publish the engine's blocking startup-loading
state: the full-screen initialization overlay therefore cannot intercept wheel or pointer input
while the catalogue downloads, decodes, or its GPU tiles are constructed. The lazy rendering module
loads in parallel with the speculative Worker request, but it constructs no scene object before
activation. A speculative module failure is retried at activation; only a blocking failure publishes
one nonfatal performance warning and leaves every other cosmic layer navigable. Three.js object
creation and the first GPU upload necessarily remain browser-renderer work and are measured as a
separate profiling target rather than being presented as Worker work.

The importer converts Mpc/h with `h = 0.7`, maps the catalogue's declination axis into Universe
Map's vertical axis, and preserves every consecutive source point without curve smoothing. Runtime
validation checks exact dimensions, sorted contiguous indices, finite physical coordinates, honest
bounds, metric declarations, and complete point coverage before scene installation. Consecutive
segments are assigned by midpoint octant to at most eight GPU tiles; the SDSS footprint currently
occupies four. Every non-empty tile keeps one exact `THREE.LineSegments` axis sharing one shader
material. A second instanced screen-space pass adds a softly additive halo without changing those
coordinates. Its 2.4/3.1/3.8-pixel quality profiles and independently capped reveal detail prevent
the full 260,178-segment catalogue from becoming wide-line geometry near the LOD boundary. Stable
axis reveal thresholds still vary only presentation detail with zoom and graphics quality. Picking
uses only the exact axes and their per-vertex object IDs, while reusable fine and screen-space hover
and selection lines reproduce the complete published spine. Axis brightness is influenced by the
three published metrics; the halo is tagged `illustrative`, and its width is not a physical filament
diameter.

## HYG stellar catalogue

The dense observed field comes from
[HYG Database v4.1](https://github.com/astronexus/HYG-Database), licensed under
[CC BY-SA 4.0](https://creativecommons.org/licenses/by-sa/4.0/). It contains a fixed set of 10,000
valid entries other than the Sun, ranked by apparent magnitude and augmented with every identifier
required by the 16 featured star cards, at epoch and equinox J2000. Required faint entries replace
the lowest-priority ordinary entries, so the draw and memory budgets remain unchanged.

Coordinates remain stored in parsecs in a little-endian binary file of approximately 782 KiB. A
compact string table preserves display names, alternate designations, and spectral types. The
browser parser validates the signature, version, dimensions, frame, values, UTF-8 strings, and
magnitude order before exposing typed arrays to rendering.

All dense stars share one `THREE.Points` and one `BufferGeometry`. The 10,000 entries remain
available to search and focus at every scale and graphics quality. Their exact compressed points,
aggregate cells, constellation lines, and stellar labels are all hidden from the Milky Way scale
onward to avoid collapsing the local catalogue into an artificial bright sphere. Coordinates and
magnitudes are observed data; distance compression, screen size, and the visual B−V conversion
remain rendering adaptations. Each point uses its magnitude to derive a perceptual GPU footprint
and opacity. Per-vertex profile, cell-scale, contrast, corona, spot, and deterministic-seed
attributes let the same fragment shader reveal a procedural photosphere whenever a point becomes
large enough on screen. It combines that surface with a Moffat-like point-spread profile, a
temperature-colored envelope, a near-white emissive core, a restrained Airy ring, and diffraction
gated to genuinely bright entries. Low quality reduces surface detail and disables the last two
optical terms; medium and high progressively restore them without adding draw calls or per-star
scene objects. Spectral and luminosity classes, with B−V as a fallback, choose one of eight bounded
visual families: blue-white, white dwarf, yellow dwarf, orange dwarf, red dwarf, red giant, red
supergiant, and brown dwarf. These control apparent size, cell scale, granulation contrast, faculae,
dark cells, and corona. The reusable selected-star detail uses the same family and seed in a larger
screen-space impostor, then cross-fades into a limb-darkened 3D surface at close range. The surface
patterns, enhanced family tint, and apparent sizes remain explicitly illustrative and do not claim
to reconstruct resolved stellar observations.

The separate procedural backdrop is marked as decorative. It remains a single GPU point batch and
combines isotropic unresolved light with a denser population around the galactic plane. Its
3,000/7,000/14,000-point quality budgets only change the geometry draw range. Per-point temperature,
prominence, size, and alpha provide depth without creating individual Three.js objects. It is fully
hidden from the Milky Way scale onward so intergalactic space is not presented as a field of nearby
stars.

Solar System and stellar-neighborhood views also share a three-draw-call cinematic environment
anchored to the heliocentric reference frame. A back-facing sphere samples one 8192×1024 WebP band
derived from the central 60 degrees of ESO/S. Brunier's observed 6000×3000 full-sky panorama. The
shader presents it across 32 degrees of latitude, which keeps the panorama distant while retaining
enough off-plane context for the Solar System overview. Linear mipmap-free sampling avoids excess
upload memory, and a feathered angular window hides the crop boundary without a second texture. The
Galactic Center is fixed to local scene direction `[-1, 0, 0]`; it never follows the camera. A
−32-degree pitch and −6.5-degree roll create the default diagonal map composition. These two angles
are explicitly tagged `illustrative`, rather than being described as an astrometric sky orientation.
The sphere is visible at planetary distance, then
cross-fades with the external galaxy between 2,800 and 7,200 adapted zoom units. A second
heliocentric locality fade runs from 2,400 to 7,200 adapted units measured between the camera and
the Solar-neighborhood origin. It therefore removes the Earth-observed panorama when the camera
focuses a remote galaxy at close range instead of letting that local sky follow the target. A flat ecliptic shader
approximates zodiacal dust scattering, and a procedurally generated sprite supplies the
distance-aware solar corona. Source pixels are observed photographic input, while the crop, grade,
opacity, scale, and composition remain tagged `illustrative`. Their
opacity, apparent corona diameter, shader detail, and radiance use continuous, time-damped distance
profiles and all reach zero before the galactic overview. The complete constellation network is kept
subdued while its hover or selection highlight remains prominent.

Behind every scientific layer, a separate full-screen `CosmicBackground` shader provides the dark
visual foundation. It interpolates a restrained navy-to-indigo palette in logarithmic camera-distance
space, then time-damps the palette, two chromatic haze layers, analytical dust rifts, vignette, and
matching fog color. This keeps the background continuous during semantic scale changes instead of
swapping a black clear color at an LOD boundary. The shader is one opaque two-triangle draw, has
quality-dependent fine detail, and is explicitly tagged `illustrative`; its wisps and rifts are
atmosphere, not catalogued astronomical structures.

The manifest also declares a prepared stellar spatial source. Its static index describes 26 root
nodes bounded by 640-parsec cubes and 85 child nodes bounded by 320-parsec cubes; the generated
dataset contains 160/40-parsec calculated aggregates in 34 request packs. The source descriptor and
selection/cache implementation are retained as groundwork for a future catalogue denser than HYG.

The current product configuration intentionally disables synchronization of that source. Both LOD
representations had become fully transparent after the external Milky Way atlas replaced the old
artificial stellar sphere, so requesting and parsing their packs only produced invisible CPU and GPU
work. No `/data/stars/tiles/` request, aggregate geometry, or cross-fade batch is now created during
navigation. The exact 10,000-entry HYG batch, labels, constellations, search coordinates, and the
volumetric Milky Way remain unchanged.

The preparation script computes arithmetic position centroids, summed-flux apparent magnitudes, and
flux-weighted B−V indices while verifying that all 10,000 source entries remain represented. The
derived cells carry `calculated` confidence and `illustrative-aggregation` visual semantics; they do
not alter exact search results, labels, selection, or focused-star coordinates.

Catalogue point sizes increase smoothly toward closer LODs while preserving magnitude ordering.
Selecting or targeting one HYG entry repositions a single reusable detail group: it begins as a
screen-space spectral photosphere in the stellar neighborhood and cross-fades into one bounded 3D
surface at close range. Spectral class, with B−V fallback, changes its procedural cell scale,
contrast, faculae, color, and corona. The other 9,999 entries remain in the original batch. The
screen-space diameter, surface pattern, corona, and active volume are illustrative and do not claim
a resolved observation or physical stellar radius.

Entries are searchable by name or HYG, HIP, HD, HR, Gliese, Bayer, and Flamsteed designations. A
visible point can be selected directly, and its label can focus the camera and open a shareable
scientific card.

The named objects in `nearby-stars.json` use a `catalog` position provider rather than a second
static vector. During initialization, `StarCatalogRegistry` resolves each provider against the
decoded HYG names and aliases, substitutes the public object ID into that catalogue point, and
derives its Galactic J2000 position. `ObjectRegistry` omits the resolved object from ordinary
Three.js meshes because the shared `THREE.Points` batch already owns its representation. Search,
labels, ray picking, focus, detail cards, and URL restoration consequently address one canonical
position and cannot drift into an editorial duplicate.

The HYG label pool is allocated independently from the Three.js point batch and adapts from 500 to
4,500 lightweight entries. Candidate depth and on-screen limits combine graphics quality, scale,
and the user-selected `minimal`, `balanced`, or `dense` label profile. At the densest stellar LOD,
the three quality baselines of 28, 56, and 96 labels become 14–42, 28–84, and 48–144
non-overlapping labels respectively. `balanced` is the default and preserves the original limits.
Editorial objects and the current selection receive priority before duplicate and overlap
filtering. Nearby celestial bodies also act as screen-space occluders: background labels disappear
inside their apparent silhouettes, while the selected label and each body's own label remain
visible.

From `client/`, the asset is reproducible from the upstream CSV:

```bash
npm run data:stars
```

Detailed provenance and import instructions are stored in
`client/public/data/stars/hyg-v41.meta.json` and `client/data-sources/README.md`. A binary-catalogue
error does not prevent startup: the engine reports a degraded state and preserves the other named
objects and procedural background. Catalogue-linked featured stars and constellations remain
unavailable because their scientific positions deliberately share that binary source.

### Constellation line layer

`public/data/stars/constellations-modern.json` derives from
[Stellarium's Modern sky culture](https://github.com/Stellarium/stellarium/tree/master/skycultures/modern)
under CC BY-SA 4.0. Its Hipparcos endpoints are mapped during static preparation to the identifiers
in the bundled HYG v4.1 binary catalogue. A segment is retained only when both stars exist locally;
all 88 figures currently map to 644 validated segments.

The complete base layer uses one `THREE.LineSegments` and one `BufferGeometry`, not one object per
link. One additional reusable `LineSegments` buffer highlights only the hovered or selected figure;
the engine never creates 88 Three.js line objects. The base network remains subdued, hover uses a
measured cyan highlight, and selection raises the same buffer to a near-opaque cyan-white additive
core. Its opacity fades by LOD and reaches zero beyond the galactic transition. The user can disable
it independently, and the choice persists in the shareable URL.

Each figure also exposes a lightweight illustrative navigation definition. Its visual centroid and
radius come from the connected HYG positions, while label priority follows the brightest connected
star. Ranked names pass through the same screen-space collision system as stars and planets. Hover
over a name or line updates the reusable highlight buffer. A line click selects the figure and
opens its card, while clicking its name additionally frames the complete figure. The card identifies
the convention, source, abbreviation, connected-star count, and segment count. Segment identifiers
live in one indexed metadata table, preserving the two-object rendering architecture.

These figures are assigned `illustrative` confidence. The
[IAU definition](https://www.iau.org/IAU/Iau/Science/What-we-do/The-Constellations.aspx) formalizes
constellations as bounded regions of the sky but does not prescribe a universal stick figure. The
lines are therefore an Earth/Solar-System perspective convention, not official boundaries and not
evidence that their stars are physically related. Actual HYG positions remain unchanged, so the
figures reveal their three-dimensional depth when the camera leaves the Solar-System viewpoint.

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
- `IllustrativeOrbitProvider`;
- `LinearProperMotionProvider`;
- `ProceduralPositionProvider`.

### Historical supernova appearance

`public/data/supernovas/catalog.json` contains six curated historical supernovas or remnants rather
than an exhaustive transient survey. Five use heliocentric Galactic Cartesian positions derived
from documented J2000 equatorial coordinates and distances. SN 1987A is parented to the Large
Magellanic Cloud in the Local Group frame. Search, labels, selection, URL focus, object cards, and
LOD navigation use the same canonical records.

The pure function in `engine/simulation/supernova-appearance.ts` maps the current Julian day and a
static visual profile to `pre-event`, `rising`, `peak`, `fading`, or `remnant`. It never changes the
scientific position. A dated card exposes **View event**, which updates the ordinary shareable
timeline before focusing the object; an undated remnant such as Cassiopeia A has no invented replay
date.

`engine/materials/supernova-visual.ts` consumes that state with a far temporal impostor, a peak
flash, and a procedural near remnant. The remnant reuses shared sphere geometry across a displaced,
partly broken outer envelope, a rotated braided-filament shell, and sparse inner emission knots.
Low quality suppresses the third layer; medium and high keep all three. The documented sky position,
distance, classification, host, and historical first-light epoch retain their source confidence.
The visual light curve, shell formation and expansion, composite colors, brightness, morphology,
and adapted scale are explicitly illustrative, not an observed time series, multiwavelength image,
or physical hydrodynamic simulation.

The complete exoplanet layer is loaded from the local `UMEX` v1 binary
`public/data/exoplanets/nasa-pscomppars.bin` and its validated provenance sidecar. The 2026-08-05
NASA Exoplanet Archive `PSCompPars` snapshot contains 6,333 confirmed planets grouped under 4,747
host systems. Host ICRS J2000 directions are rotated into the heliocentric Galactic scene basis.
The 4,720 hosts with a published distance use it directly. The other 27 retain their measured sky
direction and use a disclosed 1,000 pc illustrative map depth; this fallback never enters the object
card as an observed distance.

`ExoplanetCatalogRegistry` stores names, associations, positions, and scientific fields in compact
arrays and creates definitions on demand. Search entries cover the complete catalogue. A discovery
view adds distance, radius-class, discovery-method, and indicative temperate-candidate filters
without a backend. `ExoplanetHostBatch` draws unlinked host systems in one GPU point batch, uses
stable 45%/72%/100% quality prefixes, and reuses one selected-system marker. It allocates no
per-record Three.js objects. Its bulk cyan host signature is suppressed at planetary scale, becomes
subtle in the Solar System, and reaches its strongest bounded value in the stellar neighborhood;
the reusable selected marker remains explicit at every scale. Both this batch and HYG fade before
an observer reaches their finite heliocentric catalogue boundary, so a partial source catalogue
cannot appear as a physical spherical shell. Focusing a catalogue record constructs only its host
and planets in a temporary `ObjectRegistry`; selecting another system replaces and disposes that
detailed registry. The four richer systems in `featured-systems.json` link to the same NASA names
and are excluded from the generic point/search duplicates.

`IllustrativeOrbitProvider` animates a circular local display orbit from the catalogue period and
semi-major axis where both are published. If exactly one dimension is missing and host mass permits
it, the registry calculates the missing value with Kepler's third law and records that provenance.
Otherwise it supplies bounded illustrative spacing or timing. Phase at the reference epoch, local
inclination, distance scale, lighting, color, and surface are always declared visual parameters;
they are not claimed as a reconstructed exoplanet ephemeris. The same provider supplies a selectable
orbit line, so the information panel can frame an individual planet or its complete local system
without adding an exoplanet-specific rendering dependency to Angular.

The Solar System provider uses
[Astronomy Engine](https://github.com/cosinekitty/astronomy), an MIT dependency executed locally in
the browser. Its compact VSOP87 and lunar models are validated by the upstream project against NOVAS
and JPL Horizons. Universe Map performs no network request to calculate a position.

Astronomy Engine also supplies EQJ jovicentric vectors for Io, Europa, Ganymede, and Callisto.
Universe Map rotates those vectors into its ecliptic scene and applies a separately declared visual
distance factor. Sixteen other major moons use NASA/JPL mean J2000 elements. The generic Keplerian
provider constructs an orthonormal basis from each published equatorial or local Laplace-plane pole,
rotates it from EQJ into the scene's J2000 ecliptic frame, and only then applies the display distance
factor. The bundled dwarf planets, asteroids, and comets use JPL SBDB osculating elements. These
paths are intentionally marked `extrapolated`: the provider omits perturbations and
non-gravitational comet acceleration.

Earth's visual rotation remains astronomically exact up to `1 hour / second`. At higher speeds, the
animation is capped at one rotation every 24 real seconds to preserve readability. Date and orbital
positions continue at the selected simulation speed. Pausing after a capped interval applies the
exact selected-date orientation in the same render update; direct date navigation is also exact.

The Sun, all eight planets, and Pluto use date-dependent poles and prime meridians derived from
[IAU Working Group rotational elements (2015)](https://astropedia.astrogeology.usgs.gov/download/Docs/WGCCRE/WGCCRE2015reprint.pdf)
through Astronomy Engine. Its lunar implementation deliberately retains the more complete periodic
terms from the 2009 WGCCRE model. Io, Europa, Ganymede, Callisto, Titan, Ceres, and Vesta use the
published coefficients and periodic terms from
[JPL NAIF `pck00011.tpc`](https://naif.jpl.nasa.gov/pub/naif/generic_kernels/pck/pck00011.tpc).
Independent fixtures evaluate every added model at J2000 TDB and 10,000 days later. The body-fixed
basis follows the
[JPL/NAIF reference-frame convention](https://naif.jpl.nasa.gov/pub/naif/toolkit_docs/FORTRAN/req/frames.html)
before conversion into the renderer's ecliptic frame. Earth keeps an observer-derived geographic
basis so its texture, eclipse coordinates, and ground viewpoints remain aligned. Retrograde
rotation is preserved for Venus, Uranus, and Pluto; Saturn's rings and the active rotation guide
inherit their body's equatorial plane instead of using decorative inclinations. Rotation period,
direction, body-fixed frame, orientation model, confidence, and source are stored separately from
visual styling and exposed in the object details.

## Eclipse model

The timeline detects a solar eclipse at the displayed date. The camera can frame its central point.
The default surface shader represents the lunar shadow at that single instant; it is not the
geographical extent of the complete event. The optional trajectory switches on a separate
body-fixed map containing the union of sampled partial-eclipse footprints, the physically bounded
totality or annularity corridor, its northern and southern limits, and its central line.

The local catalogue calculates upcoming Earth events in the browser and distinguishes the global
maximum from circumstances at a predefined French location or arbitrary validated latitude and
longitude. Custom coordinates remain local to the browser and use UTC because the static application
does not call a geocoder or time-zone service. The presentation exposes C1, optional C2, maximum,
optional C3, and C4, with each contact's local solar altitude reduced to an explicit above- or
below-horizon state. C2 and C3 remain absent for a partial eclipse at the observer location.

This prototype catalogues eclipses from Earth's reference frame. Occultations in other planetary
systems are not yet indexed. Shadow calculations use physical radii and distances before projecting
onto visually adapted spheres. The solar-shadow axis intersects an oblate Earth geoid in the
equatorial frame of date.

Orbital overlays use explicit colors and a documented minimum visual size because the physical
umbra would be almost invisible at globe scale. The whole-event partial envelope is rasterized once
when requested, while corridor limits are sampled every two minutes and remain attached to Earth's
body-fixed longitude frame. Ground views recalculate the apparent Moon-to-Sun ratio so an annular
eclipse is not rendered as total.

The 12 August 2026 maximum is checked against
[NASA GSFC Besselian elements](https://eclipse.gsfc.nasa.gov/SEbeselm/SEbeselm2001/SE2026Aug12Tbeselm.html).
An independent 18:00 UTC fixture checks the center, northern limit, southern limit, and 307 km width
against the [NASA GSFC central-path table](https://eclipse.gsfc.nasa.gov/SEpath/SEpath2001/SE2026Aug12Tpath.html).
Independent Paris fixtures also check C1, maximum, and C4 against the
[NASA GSFC local-circumstances table](https://eclipse.gsfc.nasa.gov/SEcirc/SEcircEU/ParisFRA1%2B21.html).
Contact labels follow the local-circumstances definitions documented by
[IMCCE](https://promenade.imcce.fr/fr/pages3/387.html).

## Rendering and performance

- ACES filmic tone mapping uses one profile per semantic scale; exposure changes are time-damped so
  crossing an LOD cannot flash the scene, while low/medium/high quality adjusts luminous radiance;
- one opaque two-triangle background shader continuously follows logarithmic camera distance, with
  damped palette, haze, vignette, and fog values instead of discrete LOD background swaps;
- one Three.js object per named body, never per dense-catalogue star;
- star fields and the Milky Way use `BufferGeometry`;
- observed HYG stars share one photographic point-spread shader with temperature-colored envelopes,
  near-white cores, a restrained Airy term, and brightness-gated diffraction, requiring no extra
  object or draw call;
- six curated supernova records reuse shared geometry for up to three near-remnant layers only while
  their documented layer is active; time updates adjust uniforms and visibility without recreating
  geometry, and low quality omits the innermost emission layer;
- Milky Way particles retain a bounded screen-space size even when the camera enters the disc;
- one galactocentric point batch combines the diffuse disc, central bar, and four illustrative
  logarithmic arm families without creating Solar-centered geometry;
- one deferred 1254-pixel emission atlas spans up to three offset galactic planes plus one shaded
  ellipsoidal bulge, producing bounded parallax with two to four meshes according to quality;
- camera distance drives the detail, scale, and galaxy-impostor weights across the complete Milky
  Way-to-Local Group interval, while time damping removes visible opacity or scale jumps;
- all 10,000 observed HYG stars persist in one GPU batch while remaining available to search and
  focus, but exact points, constellation lines, and labels stop before galactic scale;
- the dormant stellar aggregate source is not synchronized by the production runtime, preventing
  invisible pack requests, parsing, sorting, and GPU point-batch allocation;
- all 644 constellation links share one optional, LOD-faded base batch plus one reusable highlight
  batch;
- one reusable GPU marker, adaptive halo, and close-range volume materialize the active HYG entry;
- particle density, geometry, textures, and the initial pixel ratio adapt during initialization;
  renderer ratios are capped at 1×, 1.25×, and 1.5× for low, medium, and high quality;
- a render-loop-native controller subsequently samples bounded 120-frame windows without recurring
  array allocation. It classifies p95 duration and the share of severe frames against quality-aware
  profiles, waits for two slow windows before a 0.125× reduction, reacts immediately to a severe
  window with a 0.25× reduction, and requires six healthy windows before a 0.125× recovery. The
  adaptive floor is 0.8× unless the selected profile's native target is already lower;
- camera transitions and hidden tabs reset the sampling window and suspend decisions, preventing
  loading or background throttling from degrading the user's chosen visual profile. Pixel density
  changes update the renderer and every screen-space shader together, while geometry density and
  effects remain stable;
- the lazy engine module shares one monotonic startup trace with the framework-independent engine;
  critical static-data loading begins in parallel with the remaining runtime-module imports. The
  initial phase contains named objects, the HYG stars, constellations, and nearby-galaxy indexes;
  NASA exoplanets, Cosmicflows groups, documented cosmic structures, and the cosmic density volume
  begin only after the first usable frame. A shared deferred-catalogue coordinator still waits for
  that phase immediately when a deep-link target or distinct shared selection needs it, then
  refreshes search and labels once without rebuilding the base scene. Each complementary GPU layer
  yields to the browser before installation, while large local-search indexes are normalized in
  bounded batches and published atomically; catalogue arrival therefore cannot expose partial
  results or monopolize one animation frame. The debug panel reports cumulative module, data, scene,
  and first-rendered-map milestones against explicit budgets;
- targeted visual reconstruction and resource disposal when quality changes;
- three shared quality-aware procedural textures for compact galaxy impostors at 256, 384, or 512
  pixels, followed only for resolved curated galaxies by one procedural disk and one bounded
  360/900/2,200-point volume whose parent visibility removes both draw calls outside the near LOD;
- Earth uses one shared sphere with a NASA Blue Marble surface, an optional Black Marble emissive
  map, an optional independent observed-cloud mesh, and a Fresnel atmosphere shader. Medium and high
  enable the photographic layers at 1024×512 and 2048×1024; low retains only the surface and
  atmosphere. The cloud image is a static composite and is never presented as live weather;
- Jupiter uses the Hubble 2015 global map in medium and high quality. Its unobserved source margins
  are cropped before resampling, so the polar extension remains illustrative. Because cloud systems
  differentially rotate and the map is tied to its acquisition epoch, its feature-to-prime-meridian
  alignment is not presented as a dated atmospheric reconstruction;
- the Moon uses a 2025 LRO WAC color mosaic and a LOLA bump map. The observed elevation field is
  deliberately amplified in the shader for readability and is labelled accordingly. Both maps are
  centered on the prime meridian and share the renderer's east-positive body-fixed sampling;
- Mars uses the controlled Viking MDIM 2.1 global mosaic. Its terrain comes from observations while
  the source product's artistic colorization remains explicitly illustrative. Its documented
  positive-east `−180°…180°` longitudes are converted to the renderer's body-fixed sampling;
- Venus uses a stitched Magellan radar map with simulated color. The details panel identifies it as
  a surface-revealing radar representation rather than a visible-light view through the clouds;
- 23 further rocky or icy bodies use locally hosted NASA/JPL or USGS spacecraft mosaics in medium
  and high quality. Their materials expose observed confidence and mission provenance, while the
  cards disclose processed color, filled gaps, or incomplete source coverage;
- Bennu promotes its fallback sphere to NASA VTAD's textured OSIRIS-REx shape only when the detailed
  LOD is visible. Comet 67P follows the same deferred path with ESA's OSIRIS polygonal shape and an
  explicitly illustrative neutral material. Dynamic GLTF/OBJ loader chunks and their assets are
  therefore absent from critical startup, and late or failed requests preserve the fallback;
- Phobos, Deimos, Ceres, Vesta, Haumea, and Halley's Comet reuse the shared sphere geometry with
  sourced triaxial axis ratios. Geometric-mean normalization preserves each adaptive visual volume,
  the local Y axis remains the spin pole, and rings stay on an unwarped equatorial child;
- Saturn and the other giant-planet fills remain procedural and illustrative. Procedural canvas
  colors are converted from Three.js linear working space to sRGB before texture upload;
- shared spheres, rings, and selection volumes per quality level;
- one reusable equatorial guide for the active object's rotation;
- orbital line geometries allocated only within Solar System LODs or for an explicitly requested
  orbit, then disposed after leaving those scales;
- screen-space LOD with impostor/detail fades and hysteresis;
- overlapping Milky Way detail and impostor layers during the galactic transition, with pure,
  unit-tested weights that prevent a blank frame independently of information-card selection;
- static galaxy tiles selected from camera frustum, projected size, and graphics-quality budget at
  the nearby-Universe LOD, with direct-demand target pinning and cached parsed records;
- all 720 Local Volume catalogue positions retained in one lightweight GPU overview batch between
  the Local Group and Cosmicflows layers, with continuous distance fades and no per-galaxy object;
- heavy galaxy-tile synchronization deferred until camera transitions settle, with streamed
  galaxies isolated in a lightweight registry so Solar System visuals and textures remain intact;
- the local search index built once from static catalogue metadata rather than rebuilt whenever a
  visible galaxy tile enters or leaves the view;
- generated Local Volume galaxies and other distant objects batched with per-vertex color, size,
  opacity, and indexed picking, with a focused galaxy promoted to its shaped impostor;
- all 37,730 Cosmicflows-4 groups stored in typed arrays and progressively exposed through one GPU
  point batch, with a stable reveal order, one reusable selected-group marker, and no per-group
  Three.js allocation;
- all 49,939 derived Cosmicflows-4 proximity edges rendered by one GPU line batch, with
  quality-controlled draw ranges, a build-time spatial index, no runtime graph construction, and no
  per-edge Three.js allocation;
- all 26,500 documented large-scale-structure detections retained in typed arrays and progressively
  exposed by one type-aware GPU point batch, with semantic layer masks, lazy cards, and one reusable
  selection marker;
- all 260,178 Tempel source segments retained in typed arrays and partitioned across four non-empty
  spatial GPU line tiles, with lazy off-main-thread fetching and render-array preparation,
  transferable buffers, quality-aware draw ranges, incremental picking-mask updates, and reusable
  whole-spine hover and selection geometry;
- `npm run benchmark:tempel` opens fresh desktop and emulated-mobile browser contexts for low,
  medium, and high quality, then records median Three.js preparation, scene insertion, first visible
  frame, activation-to-visible, preload lead, total transition time, draw calls, and geometries. An
  optional strict mode fails only when a median first frame exceeds the explicit 30 FPS budget. The
  initial three-run local matrix kept preparation below 5 ms, insertion at or below 0.1 ms, and all
  median first frames below 27 ms, so eager shader compilation was deliberately not added;
- `npm run benchmark:startup` opens the same fresh context matrix on the Earth route, records the
  four cold-start milestones, reports medians and the worst first-usable-map sample, and optionally
  enforces the configurable `UNIVERSE_STARTUP_BUDGET_MS` median budget in strict mode. The initial
  local desktop/high smoke baseline measured 198 ms for the engine module, 384 ms for static data,
  1.16 s for the scene, and 1.66 s for the first usable rendered map. After splitting critical and
  complementary catalogues and batching the search index, a three-run local medium-quality sample
  measured a 541 ms median first usable map on desktop and 525 ms on emulated mobile;
- `npm run benchmark:resources` warms a complete Earth → Milky Way → nearby universe → cosmic web
  → Earth journey, waits for every camera transition and the final WebGL resource plateau, then
  repeats it. It checks geometry, texture, draw-call and garbage-collected JavaScript heap drift
  against bounded budgets. The initial two-cycle desktop/high baseline remained at 90 geometries,
  18 textures and 35 draw calls, with a 0.10 MiB heap drift;
- Milky Way atlas and 8K local panorama textures are uploaded before the map becomes interactive,
  then all scene materials are compiled asynchronously. Loading failure keeps the procedural
  fallback instead of preventing startup;
- `npm run benchmark:frames` records every animation-frame interval over an Earth → Milky Way →
  nearby universe → cosmic web → Earth journey, reports p95, p99, maximum and long-frame ratio, and
  isolates regressions by transition phase. It begins only once the map controls are interactive,
  waits for a complete final adaptive window, and reports the resulting status and current/target
  pixel ratio. It warms by default and accepts `UNIVERSE_FRAME_COLD=1` for the first journey. Before
  batching search and complementary-layer installation, deferred catalogue arrival produced a
  450 ms main-thread pause. Three desktop/medium cold runs now measure p95 at 9.3 ms, p99 at or below
  17.7 ms and maximum frames from 99.1 to 100 ms; one emulated-mobile/low cold run measured p95 at
  9.2 ms and a 100 ms maximum. The earlier three-run desktop/high baseline measured p95 at 9.1 ms,
  p99 at or below 16.7 ms and maximum
  frames from 58.3 to 91.8 ms; two mobile/low cold runs stayed at p95 at or below 9.1 ms and maximum
  frames from 50 to 58.8 ms. After adaptive integration, a cold desktop/high smoke journey sampled
  852 frames at 9.1 ms p95, 16.6 ms p99, 50 ms maximum and 0.23% long frames, remaining stable at
  its native browser pixel ratio;
- one 128³ cosmic-density texture rendered by one ray-marched mesh, with bounded quality steps and no
  per-voxel CPU or Three.js allocation;
- raycast volumes placed on a non-rendered selection layer;
- labels drawn in one 2D canvas at 30 Hz from a brightness-ranked pool, with quality-aware caps,
  priority, duplicate, overlap, and planetary-silhouette occlusion filtering, plus a restrained
  type-aware text palette and one shared interactive highlight color;
- procedural texture generation without one object allocation per pixel;
- orbital calculations capped at 12 Hz;
- logarithmic camera interpolation with damping between orders of magnitude;
- pointer-directed mouse and pinch zoom prioritizing named objects and ignoring implicit hits on
  unlabelled dense catalogue points;
- reversible per-object navigation routes with smoothly interpolated changes between Solar System,
  stellar, galactic, Local Group, nearby-Universe, and cosmic-web frames;
- minimum camera distances based on object families rather than illustrative radii;
- orbit and pan enabled only while a target is active;
- geometries, materials, textures, listeners, and controls released by `dispose()`;
- renderer metrics available through `?debug=true`;
- debug metrics expose the active navigation frame and origin, the physical camera target, adaptive
  rendering status, p95 frame duration, long-frame ratio, current and target pixel ratios, active
  stellar tiles, cached packs and tiles, active/cached aggregate cells, currently visible cells,
  calculated Cosmicflows-4 groups, documented structure detections, and the visible derived-edge
  budget;
- target diagnostics report whether the body and its near representation are visible, their LOD
  blends, effective material opacity, transparency, depth-test and depth-write state, and the
  requested texture source, loading state, and decoded dimensions;
- last-wheel diagnostics reporting its anchor, requested and applied distances, active bounds, and
  whether the movement was applied, clamped, ignored, or unchanged.

## Static data

The client data entry point is `client/public/data/manifest.json`. Each JSON dataset is validated at
load time. Duplicate identifiers and invalid parent references are rejected with actionable errors.
The compact black-hole catalogue is loaded with the other named objects and validates its activity
profile and visual inclination before scene creation.
The nearby-Universe dataset entry is a tile index: its search metadata loads at startup, while
individual galaxy files remain deferred until their LOD or target requires them. The stellar
aggregate manifest entry is lighter still: only its source descriptor is retained at startup; its
index and spatial packs are not fetched by the current product configuration. Constellation figures
are also cross-validated against the loaded HYG identifier array before scene creation. The compact
Cosmicflows-4, documented-structure, NASA-exoplanet, and density-volume binaries are fetched
together after the first usable map, or immediately when URL restoration requires one of their
targets. The catalogues decode into typed arrays and remain searchable/renderable without creating
64,230 generic object instances or running the nearest-neighbor search on the main thread; the
volume uploads as one GPU texture and is not part of search. Azure revalidates the manifest on every
visit, while stable data payloads and textures use bounded browser/CDN freshness windows to make
repeat visits cheaper.

To add an object:

1. add it to a dataset referenced by the manifest;
2. provide a unit, reference frame, and position provider;
3. declare `scientificConfidence`;
4. add only the visual properties required by its representation;
5. run the tests and production build.

The catalogue remains intentionally compact and educational. Featured star descriptions and
physical facts are editorial, but their directions and distances are resolved from the same HYG
J2000 entries as the dense point catalogue. The positions are static at their reference epoch;
proper motion is not yet propagated through time.

Local Group positions derive from the galactic coordinates and heliocentric distances in
[VizieR J/AJ/144/4](https://vizier.cfa.harvard.edu/viz-bin/VizieR-3?-source=J%2FAJ%2F144%2F4),
published with [McConnachie 2012, AJ 144:4](https://doi.org/10.1088/0004-6256/144/1/4). The selected
catalogue fields and converted Cartesian coordinates are stored in
`client/public/data/galaxies/local-group.json` and revalidated at load time. Major galaxy
morphologies and orientations also use
[SIMBAD/CDS](https://simbad.u-strasbg.fr/simbad/sim-id?Ident=M31). Positions and distances are
`observed`; radii, luminosities, silhouettes, and map label ranks remain adaptive to keep dwarf
galaxies selectable.

The external-galaxy octree derives from the
[Updated Nearby Galaxy Catalog](https://cdsarc.cds.unistra.fr/viz-bin/cat/J/AJ/145/101) by
Karachentsev, Makarov, and Kaisina (2013). M49, M87, M60, M86, and M84 use distances from the
[ACS Virgo Cluster Survey](https://arxiv.org/abs/astro-ph/0702510) by Mei et al. (2007). The
catalogue RA, declination, distance, morphology, and magnitude fields remain in each tile's metadata
and are validated against its Cartesian position.

Earth uses the
[NASA Visible Earth Blue Marble](https://science.nasa.gov/earth/earth-observatory/the-blue-marble-true-color-global-imagery-at-1km-resolution/)
mosaic. The cloud-free variant keeps continents and calculated eclipse shadows readable.

## Shareable URL state

Example:

```text
/?target=earth&selected=moon&time=2026-07-27T10:00:00.000Z&zoom=4.20&mode=state&quality=medium&density=balanced&orbits=1&constellations=1&labels=1
```

Updates use debounced `history.replaceState` calls with a one-second maximum delay, so URL state
continues to follow a running timeline without changing every frame. Existing debug query state is
preserved.

## Tests and automation

Vitest covers:

- scientific unit and reference-frame conversion;
- HYG-to-Galactic J2000 anchors for Sirius, Vega, Polaris, and Proxima Centauri against CDS
  coordinates, plus guaranteed inclusion of all featured identifiers in the packaged binary;
- `Date` to Julian day conversion;
- Keplerian orbits and local ephemerides;
- Earth eclipse catalogues and classification;
- local maxima, occultation, and solar altitude for Paris and Biarritz on 12 August 2026;
- Sun–Earth–Moon alignment, geoid intersection, and shadow phases for 2026 and 2027 eclipses;
- IAU poles, prime-meridian orientation, retrograde rotation, and equatorial ring inheritance;
- solar corridors, central points, and total/annular apparent ratios;
- lunar and solar shadow-material uniforms and activation;
- linear proper motion;
- time, render loop, Earth rotation stabilization with exact pause restoration, and floating origin;
- camera transitions, reversible semantic zoom, focus interruption, and navigation limits;
- exact target-to-pivot alignment after automatic reference changes and floating-origin shifts;
- off-axis star-to-cosmic-web zoom without accumulated lateral drift;
- mouse orbit retention after zooming over empty space;
- wheel-anchor filtering between unlabelled HYG points and navigable scene objects;
- full Earth orbital framing and Neptune's orbit at intermediate LOD;
- prograde Earth and retrograde Venus rotation guides;
- mouse, label, and touch selection;
- manifest loading, HTTP errors, duplicate identifiers, and invalid parents;
- constellation schema, HYG-reference integrity, label ranking, target bounds, reusable
  highlighting, LOD fading, toggle state, and resource disposal;
- graphics-quality recommendation;
- local search and aliases;
- black-hole schema validation, activity profiles, catalogue coordinate reconstruction,
  Schwarzschild-radius facts, LOD policy, visual composition, screen-space projection, bounded
  framebuffer capture, effect damping, renderer-state restoration, and resource ownership;
- URL serialization, deserialization, and continuous synchronization;
- LOD selection, hysteresis, and apparent size;
- Local Group coordinate conversion and validation, host-relative positions, contextual subgroup
  visibility, label ranks, and galaxy silhouettes;
- J2000 equatorial conversion in megaparsecs, fixed-width source parsing, duplicate rejection,
  720-entry static-index completeness, octree hierarchy and bounds validation, camera-frustum
  refinement, quality budgets, target pinning, cache reuse, unloading, and failures;
- Cosmicflows-4 fixed-width parsing, build-time filament generation, v2 binary encoding, PGC and
  edge uniqueness, coordinate norms, uncertainty-aware rendering, lazy definitions, label bounds,
  resource disposal, and the seventh navigation scale;
- SDSS supercluster, BOSS void, Tempel filament, and Planck PSZ2 fixed-width parsing; explicit
  Mpc/h and redshift conversion; UMCS metadata and binary validation; source cardinality and
  identifier preservation; type-aware rendering; lazy search/details; label bounds; and disposal;
- Tempel table-2 point parsing, Mpc/h coordinate conversion, contiguous spine indexing, `UMFS`
  binary round trips and malformed-input rejection, exact runtime bounds validation, spatial tile
  assignment, progressive segment disclosure, picking, whole-spine highlighting, lazy lifecycle,
  and disposal;

Playwright covers critical Chromium journeys:

- label-based selection and focus;
- minimal, balanced, and dense label budgets with shareable URL persistence;
- Earth → cosmic web → Earth wheel navigation without target or framing drift;
- continued movement at the outer semantic boundary and off-center galaxy anchoring;
- empty-space zoom target retention and orbital gestures;
- protection against accidental wheel capture by an unlabelled HYG point;
- direct scale selection on desktop and mobile;
- HYG point selection, labels, search, canonical featured-star identity, faint Wolf 359 inclusion,
  and shareable scientific cards;
- global Local Group density, collision-free galaxy names, contextual Andromeda satellites, search,
  details, and URL restoration;
- quality-aware galaxy-tile budgets, lower-LOD unloading, indexed M81 search before geometry
  loading, and URL restoration of that pinned lazy target;
- one-batch Cosmicflows-4 rendering, seven-scale desktop/mobile navigation, PGC search, calculated
  scientific cards, selection highlighting, and shareable URL restoration;
- one-scale-ahead Tempel binary and render-chunk preloading, exact published dimensions, Worker-side
  render-array preparation, spatial tile activation, progressive segment disclosure, incremental
  picking masks, F1 search, and whole-spine selection;
- Sagittarius A*, Gaia BH1, and Cygnus X-1 search, activity-dependent silhouettes, accretion and jet
  presence, exclusion from luminous-point batching, and shareable URL restoration;
- dense HYG labels around a close planet without label-to-label or label-to-body overlap;
- HYG point-size LOD and focused point-to-halo-to-volume transitions;
- the absence of stellar-aggregate network requests and allocations across exact, galactic, and
  Local Group navigation, while preserving the exact HYG and Milky Way layers;
- one-batch constellation rendering, collision-free names, hover highlighting, click-to-frame
  navigation, illustrative cards, URL persistence, UI toggling, and outer-LOD hiding;
- search, date, quality, and URL restoration after reload;
- eclipse browser navigation, automatic detection, path, and ground views;
- local maximum selection with UTC and French local time;
- local Earth texture loading, smooth rotation, and Saturn ring readability;
- high-speed Earth rotation capping and immediate exact restoration on pause;
- renderer budgets in the galactic view;
- mobile layout, tap, and two-finger pinch.

A deterministic visual suite additionally checks the production Earth framing, Sun, Solar System,
solar eclipse, Milky Way, Sagittarius A*, and cosmic-web views on Chromium, Firefox, and WebKit. It
reads pixels from an explicitly rendered WebGL frame and records conservative luminance, contrast,
and chromatic signatures instead of comparing platform-sensitive golden screenshots. The Earth
scenario also temporarily isolates the planet body to prove that the decoded 2048×1024 Blue Marble
surface materially contributes to the framebuffer; typed engine diagnostics independently assert
its LOD, opacity, depth state, and texture source.

Install the test browser once:

```bash
npx playwright install chromium firefox webkit
```

Run only the cross-engine visual matrix with `npm run test:e2e:visual`.

From `client/`, `npm run test:coverage` enforces 100% statements, branches, functions, and lines
across production code. Every scientific module declared in `client/tools/check-coverage.mjs` also
retains an individual gate. Coverage prevents untested regressions; scientific validity is verified
separately through reference values, invariants, bounds, and degenerate cases.

From `client/`, `npm run verify` runs strict application and E2E type checks, Prettier, ESLint,
Stylelint, coverage, the production build, and Playwright. GitHub Actions runs the faster
`npm run verify:ci` deployment gate on each push and pull request. The complete Playwright suite is
kept in the independent **Browser journeys** workflow, scheduled nightly and available on demand;
coverage and browser diagnostics are uploaded by their respective workflows.

Angular's persistent cache is disabled in `client/angular.json` to avoid a native LMDB crash
observed with Node 24 on macOS. This does not affect generated application output.

## Known scientific limitations

- analytical ephemerides are appropriate for visualization, not spacecraft navigation;
- orbital paths are drawn around a reference epoch and become illustrative far from 2026;
- Earth–Moon distance is visually amplified;
- planetary and stellar sizes are exaggerated;
- Blue Marble is a real but fixed composite with no live weather;
- lunar relief is visually amplified and the LRO color mosaic is aesthetically processed;
- the Mars mosaic is controlled observational data with illustrative colorization;
- the Venus surface is radar-derived with simulated color, not its visible cloud-top appearance;
- additional spacecraft mosaics can include publisher-filled gaps, processed color, and uneven
  source coverage; they are observation-based cartographic products, not untouched photographs;
- Bennu's shape and texture are observed; 67P's shape is observed but its neutral surface material
  and lack of jets are illustrative;
- the six lightweight triaxial silhouettes preserve published axis ratios, not local topography;
  shape confidence and provenance are separate from orbit confidence and adaptive visual scale;
- axial rotation is visually slowed above `1 hour / second` and snapped to the exact selected-date
  orientation on pause;
- custom eclipse coordinates use UTC and a manually entered point; the static application does not
  infer a place name, elevation, terrain horizon, atmospheric refraction, or civil time zone;
- eclipses and occultations outside Earth's frame are not catalogued;
- HYG stellar positions are fixed at epoch J2000 and do not yet apply proper motion or parallax over
  the selected application date;
- the exoplanet layer is a complete static `PSCompPars` snapshot for 2026-08-05, not a live mirror;
  it must be regenerated to reflect later NASA additions or revisions, and 27 hosts without a
  published distance use a clearly identified 1,000 pc illustrative map depth;
- exoplanet periods and semi-major axes are catalogue-backed, but displayed orbital phases,
  orientation, separation, illumination, and procedural surfaces are illustrative; the map does not
  reconstruct transit epochs, true anomalies, weather, or observed planetary surfaces;
- the Milky Way is a hybrid illustrative reconstruction combining a generated emission atlas with
  procedural geometry; it is not an external observation of our Galaxy;
- black-hole silhouettes, lensing cues, accretion emission, and jets are illustrative and strongly
  enlarged; the local framebuffer distortion is an artistic radial approximation, and the
  prototype does not perform relativistic ray tracing;
- galaxy positions are static at their reference epoch, with strongly adapted visual dimensions;
- the nearby-Universe layer is dense only within the 1.5–11 Mpc Local Volume selection; Virgo remains
  a five-object editorial extension;
- the Cosmicflows-4 layer contains calculated group distances rather than every galaxy; its point
  halos and nearest-neighbor scaffold do not reconstruct continuous clusters, walls, voids, or
  filaments, and the connecting lines are explicitly illustrative;
- large-scale-structure catalogues cover particular survey footprints and algorithms, not the whole
  observable Universe; overlapping detections are intentionally not merged, absent coverage is not
  a void, and Tempel spine lines reproduce sampled catalogue paths rather than physical filament
  widths or a continuous matter-density field;
- 16 bundled moons and the bundled small bodies use simplified two-body paths rather than full
  numerical ephemerides; their documented reference planes are preserved, but satellite separation
  is visually exaggerated after position calculation;
- Observable view exists in the contract and interface but still previews simultaneous state mode;
- the prototype does not implement relativity, full gravitational simulation, or ground exploration.

## Next engineering steps

1. run the repeatable Tempel cold-transition benchmark on representative physical low-, medium-,
   and high-end devices, adding idle shader compilation only if a median first frame exceeds the
   30 FPS budget;
2. revisit the dormant stellar hierarchy only when a denser source catalogue requires it, with a
   visible representation and Worker-backed preparation validated before activation;
3. extend the Tempel provenance contract to documented wall, basin, attractor, and repeller
   products without merging incompatible definitions;
4. extend sourced triaxial silhouettes and deferred polygonal models to additional irregular bodies
   only when authoritative shape products justify the asset and decode cost;
5. implement the physically delayed Observable view;
6. run the repeatable startup, memory, and frame-rate benchmarks across a broader physical-device
   panel.
