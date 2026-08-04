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
- separate global and local eclipse maxima for selected French cities, with UTC and local time;
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
subject to the global names toggle.

When zooming inward, the object under the pointer progressively becomes the navigation target,
including during an active semantic return journey. Changing that target preserves the journey's
distance progression and rebuilds its parent route. Visible labels have enlarged hit areas and focus
their object directly. Unlabelled points from the dense HYG batch do not capture wheel navigation
implicitly; they remain available through an explicit label, click, or search action.

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

### Galactocentric Milky Way layer

The Sun is stored in the Galactic frame at `R0 = 8.178 kpc` on scene +X. HYG J2000 equatorial
vectors are rotated into the Galactic basis before their compressed stellar positions are attached
to that Solar origin. Floating-origin shifts therefore never change the physical Sun-to-center
relationship.

The close Milky Way layer combines two explicitly illustrative representations centered at the
origin. A deterministic `BufferGeometry` mixes a diffuse disc, a barred bulge, and four noisy
logarithmic arm families with a rounded 13-degree pitch. A deferred 1024-pixel emission atlas adds
continuous stellar light and dust lanes across three slightly rotated planes at different Galactic
heights. A shaded ellipsoid supplies the central bulge's thickness, so an orbiting camera observes
parallax instead of a single flat card. Low, medium, and high quality expose one, two, or three disc
planes respectively; the bulge remains the fourth and final high-quality mesh.

Each disc shader also derives the projected camera direction in its local tangent frame and samples
the atlas at three shallow depth offsets. The resulting view-dependent parallax is graded toward
cool blue-white arms and a warm core, while local luminance differences carve absorptive dust lanes.
A soft analytical glow is limited before ACES tone mapping, and the brightest core values are
compressed locally to preserve texture detail. Quality profiles continuously scale parallax, dust,
glow, color grading, texture anisotropy, and visible depth count; they never allocate an additional
post-processing pass or mesh.

The arm count follows the maser-parallax reconstruction of Reid et al. (2019), but the generated
atlas, phase, width, bar orientation, colors, vertical thickness, and particle density remain visual
adaptations. No arm geometry is parented to or generated from the Sun. The atlas loads only when the
camera reaches stellar or galactic scales; a failed request leaves the procedural particle field as
a usable fallback.

The exact HYG batch and its spatial aggregates remain searchable and focusable but are not drawn in
the galactic view. Their labels and constellation overlays are hidden there as well. This prevents
the catalogue's finite heliocentric selection volume from appearing as a physical spherical
overdensity. The layered detail and its distant impostor still cross-fade from camera distance.

### Black-hole layer

The eagerly loaded `public/data/black-holes/catalog.json` dataset contains Sagittarius A*, the
active X-ray binary Cygnus X-1, and the dormant binary Gaia BH1. Each record preserves an ICRS J2000
direction, heliocentric distance, galactocentric Cartesian position, mass, Schwarzschild radius,
source links, activity classification, and an explicit rendering adaptation. Search aliases, labels,
details, focus, semantic navigation, and URL restoration use the same object definition.

Runtime validation accepts black holes as a distinct object family, restricts activity to
`dormant`, `quiescent`, or `active`, and checks the optional accretion-disc inclination. Static tests
independently rotate the preserved equatorial coordinates into the Galactic basis and reconstruct
the stored position after applying the Solar offset. Sagittarius A* remains at the Galactic origin;
the other two objects are positioned from their catalogue direction and distance rather than placed
for visual convenience.

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
remains spatially legible while navigating from the Local Group into the Local Volume. This layer
starts with a restrained continuous fade outside the Milky Way, reaches full opacity before the
nearby-Universe entry distance, and disappears before the outer Cosmicflows view. It adds no
procedural objects: streamed tiles progressively overlay the same observed positions with richer
labels, picking metadata, and focused galaxy silhouettes.

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
sample. Distance uncertainty modulates point size and opacity. A white-core additive halo keeps the
active catalogue sample readable over the density field, while an explicitly illustrative
logarithmic depth gradient maps nearby groups to warm gold and remote groups to cool violet. Low,
medium, and high quality expose progressively ranked label pools before the normal screen-space
collision pass. Search accepts
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
symbols in the overview. Hollow blue rings identify void detections, violet halos identify
superclusters, cyan marks identify filament-envelope centers, and compact pale points identify
Planck clusters. The default synthesis enables clusters and superclusters while leaving the much
denser filament-center and void overlays opt-in; a four-component shader mask and CPU picking mask
switch those semantic layers without reallocating geometry. One selection point is reused for every
catalogue target, every retained record remains searchable and focusable, object definitions are
materialized lazily, and labels share a reduced collision- and quality-aware budget. The in-app map
panel states both that catalogue detections can overlap and that missing survey coverage is not a
measured cosmic void.

The Tempel source contains 275,599 published spine points, but this first pass stores the center and
length of each of its 15,421 filament envelopes. It therefore does not render those center symbols as
continuous physical tubes. Detailed spine geometry requires a separately tiled line layer so it can
remain faithful without adding hundreds of thousands of startup vertices.

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
remain rendering adaptations.

The separate procedural backdrop is marked as decorative. It remains restrained in planetary and
Solar System views, falls to low opacity through the stellar neighborhood, and is fully hidden from
the Milky Way scale onward so intergalactic space is not presented as a field of nearby stars.

Behind every scientific layer, a separate full-screen `CosmicBackground` shader provides the dark
visual foundation. It interpolates a restrained navy-to-indigo palette in logarithmic camera-distance
space, then time-damps the palette, two chromatic haze layers, analytical dust rifts, vignette, and
matching fog color. This keeps the background continuous during semantic scale changes instead of
swapping a black clear color at an LOD boundary. The shader is one opaque two-triangle draw, has
quality-dependent fine detail, and is explicitly tagged `illustrative`; its wisps and rifts are
atmosphere, not catalogued astronomical structures.

The manifest also declares a stellar spatial source without fetching it during startup. Its static
index describes 26 root nodes bounded by 640-parsec cubes and 85 child nodes bounded by 320-parsec
cubes. Root tiles render 160-parsec aggregates; child tiles render 40-parsec aggregates. Eight
1,280-parsec overview packs and 26 parent-scoped detail packs keep request counts bounded.

At most four times per second, the engine snapshots the camera frustum, viewport, floating-origin
offset, semantic LOD, and graphics quality. Visible roots are selected by their projected bounds.
LOD 3 refines the largest two, four, or eight roots on low, medium, or high quality; the other roots
remain represented by their parents. A 24-pack LRU cache retains recently visited inactive data,
while active packs are never evicted. A failed request leaves the previous active field untouched.

Active tiles of the same resolution are brightness-sorted and merged into one `THREE.Points` batch,
so spatial streaming does not allocate one Three.js object or draw call per tile. Parent and child
snapshots cross-fade. Rapid camera snapshots are pruned to one active batch and one retiring batch,
preventing transitional draw calls from accumulating during long camera journeys. Low, medium, and
high quality render 45%, 72%, or 100% of the merged clusters.

The preparation script computes arithmetic position centroids, summed-flux apparent magnitudes, and
flux-weighted B−V indices while verifying that all 10,000 source entries remain represented. The
derived cells carry `calculated` confidence and `illustrative-aggregation` visual semantics; they do
not alter exact search results, labels, selection, or focused-star coordinates.

Catalogue point sizes increase smoothly toward closer LODs while preserving magnitude ordering.
Selecting or targeting one HYG entry repositions a single reusable detail group: it begins as a
screen-space halo in the stellar neighborhood and cross-fades into one bounded emissive sphere at
close range. Its visual and navigation radii share one constant, so the camera only reaches its
minimum after the star has become meaningfully large on screen. The other 9,999 entries remain in
the original batch. This active volume is illustrative and does not claim a physical stellar radius.

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
the engine never creates 88 Three.js line objects. Its opacity fades by LOD and reaches zero beyond
the galactic transition. The user can disable it independently, and the choice persists in the
shareable URL.

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
- `LinearProperMotionProvider`;
- `ProceduralPositionProvider`.

The Solar System provider uses
[Astronomy Engine](https://github.com/cosinekitty/astronomy), an MIT dependency executed locally in
the browser. Its compact VSOP87 and lunar models are validated by the upstream project against NOVAS
and JPL Horizons. Universe Map performs no network request to calculate a position.

Astronomy Engine also supplies EQJ jovicentric vectors for Io, Europa, Ganymede, and Callisto.
Universe Map rotates those vectors into its ecliptic scene and applies a separately declared visual
distance factor. Titan uses JPL SAT441 mean elements; Ceres, Vesta, and Halley use JPL SBDB
osculating elements. Those four paths are intentionally marked `extrapolated`: the generic
Keplerian provider omits perturbations and non-gravitational comet acceleration, and Titan's local
Laplace-plane orientation is visually simplified.

Earth's visual rotation remains astronomically exact up to `1 hour / second`. At higher speeds, the
animation is capped at one rotation every 24 real seconds to preserve readability. Date and orbital
positions continue at the selected simulation speed. When paused, orientation converges smoothly to
its exact value; direct date navigation applies the exact orientation immediately.

The Sun, Moon, and all eight planets use date-dependent poles and prime meridians derived from
[IAU Working Group rotational elements (2015)](https://astropedia.astrogeology.usgs.gov/download/Docs/WGCCRE/WGCCRE2015reprint.pdf)
through Astronomy Engine. The body-fixed basis follows the
[JPL/NAIF reference-frame convention](https://naif.jpl.nasa.gov/pub/naif/toolkit_docs/FORTRAN/req/frames.html)
before conversion into the renderer's ecliptic frame. Earth keeps an observer-derived geographic
basis so its texture, eclipse coordinates, and ground viewpoints remain aligned. Retrograde
rotation is preserved for Venus and Uranus; Saturn's rings and the active rotation guide inherit
their body's equatorial plane instead of using decorative inclinations.

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

- ACES filmic tone mapping uses one profile per semantic scale; exposure changes are time-damped so
  crossing an LOD cannot flash the scene, while low/medium/high quality adjusts luminous radiance;
- one opaque two-triangle background shader continuously follows logarithmic camera distance, with
  damped palette, haze, vignette, and fog values instead of discrete LOD background swaps;
- one Three.js object per named body, never per dense-catalogue star;
- star fields and the Milky Way use `BufferGeometry`;
- the brightest observed stars add temperature-colored diffraction in the existing HYG shader and
  therefore do not require another object or draw call;
- Milky Way particles retain a bounded screen-space size even when the camera enters the disc;
- one galactocentric point batch combines the diffuse disc, central bar, and four illustrative
  logarithmic arm families without creating Solar-centered geometry;
- one deferred 1024-pixel emission atlas spans up to three offset galactic planes plus one shaded
  ellipsoidal bulge, producing bounded parallax with two to four meshes according to quality;
- camera distance drives the detail, scale, and galaxy-impostor weights across the complete Milky
  Way-to-Local Group interval, while time damping removes visible opacity or scale jumps;
- all 10,000 observed HYG stars persist in one GPU batch while remaining available to search and
  focus, but exact points, aggregate cells, constellation lines, and labels stop before galactic
  scale;
- camera-driven stellar tiles use frustum and screen-size refinement, shared request packs, a
  bounded LRU cache, and one merged GPU point batch per active resolution;
- all 644 constellation links share one optional, LOD-faded base batch plus one reusable highlight
  batch;
- one reusable GPU marker, adaptive halo, and close-range volume materialize the active HYG entry;
- particle density, geometry, textures, and pixel ratio adapt during initialization; renderer ratios
  are capped at 1×, 1.25×, and 1.5× for low, medium, and high quality, and a severely slow sample
  falls back directly to 1×;
- targeted visual reconstruction and resource disposal when quality changes;
- three shared quality-aware procedural textures for galaxy impostors, combining cool halos, warm
  cores, blurred spiral filaments, and subtractive dust lanes at 256, 384, or 512 pixels;
- Earth uses one shared sphere with a NASA Blue Marble surface, an optional Black Marble emissive
  map, an optional independent observed-cloud mesh, and a Fresnel atmosphere shader. Medium and high
  enable the photographic layers at 1024×512 and 2048×1024; low retains only the surface and
  atmosphere. The cloud image is a static composite and is never presented as live weather;
- Jupiter uses the Hubble 2015 global map in medium and high quality. Its unobserved source margins
  are cropped before resampling, so the polar extension remains illustrative;
- the Moon uses a 2025 LRO WAC color mosaic and a LOLA bump map. The observed elevation field is
  deliberately amplified in the shader for readability and is labelled accordingly;
- Mars uses the controlled Viking MDIM 2.1 global mosaic. Its terrain comes from observations while
  the source product's artistic colorization remains explicitly illustrative;
- Venus uses a stitched Magellan radar map with simulated color. The details panel identifies it as
  a surface-revealing radar representation rather than a visible-light view through the clouds;
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
- debug metrics expose the active navigation frame and origin, the physical camera target, active
  stellar tiles, cached packs and tiles, active/cached aggregate cells, currently visible cells,
  calculated Cosmicflows-4 groups, documented structure detections, and the visible derived-edge
  budget;
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
index and spatial packs remain deferred until LOD 3 or 4. Constellation figures are also
cross-validated against the loaded HYG identifier array before scene creation. The compact
Cosmicflows-4, documented-structure, and density-volume binaries are fetched once at startup. The
catalogues decode into typed arrays and remain searchable/renderable without creating 64,230 generic
object instances or running the nearest-neighbor search on the main thread; the volume uploads as
one GPU texture and is not part of search.

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
- time, render loop, Earth rotation stabilization, and floating origin;
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
  resource disposal, and the seventh navigation scale.
- SDSS supercluster, BOSS void, Tempel filament, and Planck PSZ2 fixed-width parsing; explicit
  Mpc/h and redshift conversion; UMCS metadata and binary validation; source cardinality and
  identifier preservation; type-aware rendering; lazy search/details; label bounds; and disposal;

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
- Sagittarius A*, Gaia BH1, and Cygnus X-1 search, activity-dependent silhouettes, accretion and jet
  presence, exclusion from luminous-point batching, and shareable URL restoration;
- dense HYG labels around a close planet without label-to-label or label-to-body overlap;
- HYG point-size LOD and focused point-to-halo-to-volume transitions;
- camera-frustum stellar-tile selection, quality-aware parent refinement, shared-pack reuse,
  failure-safe retention, cache diagnostics, and exact → aggregate → exact round trips;
- one-batch constellation rendering, collision-free names, hover highlighting, click-to-frame
  navigation, illustrative cards, URL persistence, UI toggling, and outer-LOD hiding;
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
- lunar relief is visually amplified and the LRO color mosaic is aesthetically processed;
- the Mars mosaic is controlled observational data with illustrative colorization;
- the Venus surface is radar-derived with simulated color, not its visible cloud-top appearance;
- axial rotation is visually slowed above `1 hour / second` and resynchronized on pause;
- local eclipse maxima are limited to predefined French cities, without free location input or full
  contact timings;
- eclipses and occultations outside Earth's frame are not catalogued;
- HYG stellar positions are fixed at epoch J2000 and do not yet apply proper motion or parallax over
  the selected application date;
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
  a void, and Tempel filament centers do not yet include their tiled continuous spine geometry;
- Titan and the bundled small bodies use simplified two-body paths rather than full numerical
  ephemerides; satellite separation is visually exaggerated after position calculation;
- Observable view exists in the contract and interface but still previews simultaneous state mode;
- the prototype does not implement relativity, full gravitational simulation, or ground exploration.

## Next engineering steps

1. move future larger-catalogue decoding and hierarchy preparation into Web Workers;
2. add deeper stellar hierarchy levels when a denser source catalogue requires them;
3. tile the published Tempel filament spines and extend the same provenance contract to documented
   wall, basin, attractor, and repeller products without merging incompatible definitions;
4. expand the Solar System selection with additional scientifically useful moons and small bodies;
5. accept arbitrary eclipse locations and expose detailed local contact times;
6. implement the physically delayed Observable view;
7. benchmark startup, memory, and frame rate across a broader device panel.
