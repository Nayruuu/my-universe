# Local data sources

Large source files are neither bundled at runtime nor versioned. Compact assets produced by scripts
in `tools/` are served from `public/data/`.

## Solar System bodies

Planetary, terrestrial-lunar, Plutonian, and Galilean-moon positions are calculated locally with
[Astronomy Engine](https://github.com/cosinekitty/astronomy). The four Galilean vectors are
jovicentric and expressed by the dependency in the J2000 equatorial frame before Universe Map
rotates them into its J2000 ecliptic scene frame.

Mean distances, periods, radii, and masses for Io, Europa, Ganymede, Callisto, and Titan are based
on the official [NASA/JPL planetary satellite tables](https://ssd.jpl.nasa.gov/sats/elem/) and
[physical-parameter tables](https://ssd.jpl.nasa.gov/sats/phys_par/). Satellite distances are
visually multiplied by 40 after the scientific position calculation so the moons remain separable
from their parent planet. This adaptation is stored explicitly as `distanceScale` and
`visualDistanceExaggerated`.

Titan uses JPL SAT441 mean J2000 elements only to describe a simplified Keplerian path. JPL warns
that satellite mean elements are not accurate ephemerides, so Titan is marked `extrapolated`, and
the current view simplifies the orientation of its local Laplace plane.

Ceres, Vesta, and Halley's Comet use osculating J2000 elements from the
[NASA/JPL Small-Body Database](https://ssd.jpl.nasa.gov/tools/sbdb_lookup.html). Their browser
providers intentionally implement a two-body approximation: planetary perturbations and Halley's
non-gravitational acceleration terms are omitted. These objects are therefore marked
`extrapolated`, while their source epoch and orbit-solution identifier remain in static metadata.
Pluto uses Astronomy Engine's local heliocentric ephemeris and is marked `calculated`.

### Body-fixed rotation

The Sun, eight planets, Moon, and Pluto use Astronomy Engine's date-dependent `RotationAxis`
implementation. It follows the IAU WGCCRE 2015 elements except for the Moon, whose fuller periodic
series is explicitly based on the 2009 WGCCRE Mean Earth/Polar Axis model. Earth uses the library's
precession- and nutation-aware geographic observer basis so longitude, ground viewpoints, and
eclipse overlays share one frame.

Io, Europa, Ganymede, Callisto, Titan, Ceres, and Vesta use coefficients transcribed from the
[NASA/JPL NAIF `pck00011.tpc` planetary constants kernel](https://naif.jpl.nasa.gov/pub/naif/generic_kernels/pck/pck00011.tpc),
which implements the 2015 WGCCRE report. Their pole right ascension, pole declination, prime
meridian, and applicable periodic terms are evaluated in-browser. Independent unit fixtures compare
every added model at J2000 TDB and 10,000 days after J2000. Each static object stores its sidereal
period, direction, body-fixed frame, orientation model, confidence, and source outside the visual
definition.

At playback rates above one simulated hour per real second, Earth alone uses a capped visual time
to avoid temporal aliasing. Pausing or setting a date applies the exact selected-date orientation
immediately. Observed rocky-body maps are sampled in the matching east-positive longitude direction.
Jupiter's Hubble map remains an acquisition-epoch atmospheric snapshot; its cloud features are not
claimed to reconstruct differential rotation at arbitrary dates.

## Confirmed exoplanet catalogue

`public/data/exoplanets/nasa-pscomppars.bin` and its JSON sidecar are a static 2026-08-05 snapshot
of the [NASA Exoplanet Archive](https://exoplanetarchive.ipac.caltech.edu/) composite planetary
systems table, `PSCompPars`, retrieved through the Archive's
[TAP service](https://exoplanetarchive.ipac.caltech.edu/docs/TAP/usingTAP.html). The snapshot
contains 6,333 confirmed planets around 4,747 host systems. Regenerate an intentionally newer
snapshot with:

```bash
npm run data:exoplanets
```

The sidecar preserves the exact TAP query, retrieval date, raw-response SHA-256, format version,
record counts, and missing-distance policy. The checked 1,096,458-byte `UMEX` v1 binary contains a
32-byte header, one fixed 64-byte record per host, one fixed 72-byte record per planet, and a shared
null-terminated UTF-8 string table. The runtime rejects incompatible dimensions, offsets, strings,
duplicate names, nonphysical values, invalid host ranges, and metadata/count mismatches before
exposing the catalogue.

All 6,333 planets and 4,747 hosts are locally searchable. A discovery panel filters planets by
published distance, radius class, discovery method, and an explicitly indicative temperature/radius
criterion. Host ICRS J2000 directions are independently rotated into Universe Map's heliocentric
Galactic frame. NASA publishes a distance for 4,720 hosts and 6,306 planets. For the remaining 27
systems, the observed sky direction is retained but a clearly labelled 1,000 pc illustrative radial
depth is used solely to place the target on the 3D map; no missing distance is presented as measured.

The renderer keeps the full layer compact: one typed-array `THREE.Points` batch draws unlinked host
systems, low/medium/high quality expose stable 45%/72%/100% prefixes, and one reusable marker handles
selection. No permanent Three.js object is allocated per catalogue row. Selecting a host or planet
materializes only that host and its planets in a temporary object registry, so orbit framing,
timeline updates, labels, cards, and URL sharing work without keeping thousands of detailed systems
active. Selecting another catalogue system replaces and disposes the previous detailed registry;
engine disposal releases the remaining resources.

Published period and semi-major axis values remain catalogue facts. If exactly one is absent and a
stellar mass is available, the missing value is calculated with Kepler's third law and labelled
`calculated`. If the required inputs are absent, bounded spacing or timing is explicitly labelled
illustrative. Phase, local display-plane inclination, orbit scale, planet surface, lighting, and
color are always visual adaptations rather than reconstructed exoplanet ephemerides.

### Featured exoplanet systems

`public/data/exoplanets/featured-systems.json` is a compact 2026-08-05 snapshot of the
[NASA Exoplanet Archive](https://exoplanetarchive.ipac.caltech.edu/) composite planetary systems
table, `PSCompPars`, retrieved through the Archive's
[TAP service](https://exoplanetarchive.ipac.caltech.edu/docs/TAP/usingTAP.html). It contains four
host stars and ten confirmed planets: Kepler-186 f, Kepler-22 b, Kepler-452 b, and TRAPPIST-1 b
through h. The browser loads this static file from the same origin as the application; it does not
query NASA at runtime.

Host right ascension, declination, and distance are preserved in metadata in ICRS J2000. The stored
Cartesian vectors independently rotate those catalogue coordinates into the same heliocentric
Galactic convention as the HYG layer: Galactic north on scene +Y, longitude 90 degrees on +Z, and
the Galactic center toward -X. Static-data tests reconstruct every vector from the preserved source
coordinates with the IAU J2000 rotation matrix.

Confirmation status, discovery metadata, orbital period, semi-major axis, radius, mass, equilibrium
temperature, inclination, and eccentricity are catalogue facts where available. The `massProvenance`
field distinguishes an Archive mass value from a mass inferred by a mass-radius relationship.

The Archive does not provide a complete visual ephemeris or an observed surface for these planets.
`illustrative-orbit` therefore uses the catalogue period and semi-major axis while declaring its
phase, local display-plane orientation, and distance multiplier as visual adaptations. Planet
colors, textures, sizes, host lighting, and shadow fill are also illustrative. The object card
exposes this distinction instead of presenting the animation as an observed position at the chosen
date.

## Historical supernovas and remnants

`public/data/supernovas/catalog.json` is a deliberately compact editorial catalogue of six
well-documented events and remnants: SN 1006, the Crab Nebula/SN 1054, Tycho's Supernova/SN 1572,
Kepler's Supernova/SN 1604, Cassiopeia A, and SN 1987A. It is not a completeness claim. The static
records preserve J2000 right ascension and declination, published or rounded distance estimates,
event type and date where documented, alternate names, host context, and a direct source URL.

Positions and distances are based on the following mission pages:

- [NASA and Chandra — SN 1006](https://chandra.harvard.edu/photo/2005/sn1006/);
- [NASA and Chandra — Crab Nebula](https://www.chandra.harvard.edu/photo/2017/crab/);
- [NASA and Chandra — Tycho's Supernova](https://chandra.harvard.edu/photo/2005/tycho/);
- [NASA and Chandra — Kepler's Supernova](https://www.chandra.harvard.edu/photo/2026/kepler/);
- [NASA and Chandra — Cassiopeia A](https://chandra.harvard.edu/photo/2002/0237/);
- [NASA and Chandra — SN 1987A](https://www.chandra.harvard.edu/photo/2017/sn1987a/).

Five Galactic records store heliocentric J2000 Galactic Cartesian positions in parsecs. SN 1987A
is associated with the Large Magellanic Cloud and inherits that object's Local Group frame instead
of pretending that its parsec-scale vector belongs to the Solar neighborhood. Static-data tests
reconstruct each Galactic vector from the preserved equatorial source coordinates.

The historical date is not a physical explosion timestamp at the source: it identifies the first
recorded or observed light at Earth. The optional `visualPeakJulianDay` lets the information card
replay that epoch. `supernova-appearance.ts` then produces an educational transition through
pre-event, rising, peak, fading, and remnant phases. The near representation uses a displaced broken
envelope, a smaller braided-filament layer, and sparse inner emission knots. Low quality keeps the
first two layers; medium and high add the knots. Rise and decay duration, shell formation,
expansion, composite color, brightness, morphology, and apparent size are all marked
`illustrative`; they are not an observed light curve, hydrodynamic simulation, or reconstructed
multiwavelength image. Cassiopeia A has no replay action because its exact first-light epoch is not
securely documented in this compact dataset.

## Illustrative Milky Way density field

The close galactic representation is not an observed external image of the Milky Way. It is a
deterministic procedural density field centered on the Galactic center and rendered in one point
batch. Its four logarithmic arm families and additional short segments are motivated by the roughly
200 maser parallaxes compiled by
[Reid et al. (2019)](https://doi.org/10.3847/1538-4357/ab4a11), while the global 13-degree pitch is
the rounded mean reported across published Milky Way models by
[Vallée (2015)](https://doi.org/10.1093/mnras/stv862).

Universe Map combines those arm families with an axisymmetric diffuse disc and a central barred
bulge. Arm width, phase, bar orientation, colors, particle density, and vertical thickness are
visual choices rather than catalogue measurements. The structure is therefore marked
`illustrative`, remains anchored to the Galactic center, and never uses the Sun as a spiral origin.
The exact and aggregated HYG layers are strongly attenuated at this scale so their heliocentric
selection volume does not look like a real spherical overdensity inside the Galaxy.

## Black-hole catalogue

`public/data/black-holes/catalog.json` contains three deliberately curated objects rather than a
claim of Galactic completeness:

- Sagittarius A* uses the Galactic origin, the 8.178 kpc Solar distance retained elsewhere in the
  application, and the approximately four-million-solar-mass result published by the
  [Event Horizon Telescope Collaboration (2022)](https://eventhorizontelescope.org/blog/astronomers-reveal-first-image-black-hole-heart-our-galaxy).
  Its J2000 direction is cross-referenced against
  [SIMBAD](https://simbad.u-strasbg.fr/simbad/sim-id?Ident=Sagittarius+A%2A).
- Cygnus X-1 uses the 2.22 kpc distance and 21.2-solar-mass dynamical estimate from
  [Miller-Jones et al. (2021)](https://arxiv.org/abs/2102.09091), with its J2000 direction
  cross-referenced against
  [SIMBAD](https://simbad.cds.unistra.fr/simbad/sim-basic?Ident=Cygnus+X-1).
- Gaia BH1 uses the updated 9.27-solar-mass orbit and approximately 478 pc distance from
  [Nagarajan et al. (2024)](https://arxiv.org/abs/2312.05313), with identification metadata linked
  to [ESA Gaia](https://www.esa.int/ESA_Multimedia/Images/2024/04/Gaia_black_holes).

The static-data tests independently rotate each preserved ICRS J2000 direction into the Galactic
basis, add the Solar galactocentric offset, and compare the result with the stored kiloparsec
position. Schwarzschild radii are derived from the catalogue masses before being stored as physical
facts.

Black-hole horizons cannot be resolved at map scale. Visual radii are therefore heavily enlarged.
The black silhouette, warm photon-ring cue, background-distortion pass, accretion discs, and
active-source jets are all tagged `illustrative`; the renderer performs no general-relativistic ray
tracing. The focused object's foreground visual is hidden while the renderer captures a bounded
square of the background. An achromatic qualitative thin-lens relation,
`beta = theta - thetaE² / theta`, is applied to that sky image before the opaque horizon, ring, disc,
and optional jets are composited back in front. The sign change around the visual Einstein radius
creates an inverted secondary image, while bounded tangential samples preserve bright stellar
arcs. At close range, the already-adaptive foreground visual is capped at a 16% viewport-height
radius so it cannot cover the bounded lens region as the camera approaches. This display-only scale
does not alter the catalogue radius or position. The transparent lens overlay is sized in logical
screen space rather than source-texture pixels, so DPR 1 and DPR 2 displays preserve the same
apparent radii. Its source remains a bounded 768- or 1024-pixel framebuffer capture.

The pass samples only the live framebuffer region rendered behind the focused black hole. It never
injects a fixed photographic or procedural sky texture. Sagittarius A* explicitly declares a
deterministic, illustrative nuclear star cluster built as one 3D GPU point batch. Because that batch
is attached to the catalogue object in world space, it has depth and parallax, participates in the
normal LOD fade, and disappears with the object instead of persisting as a screen-space image. The
foreground horizon and emission subtree alone is withheld from the capture. The complete captured
color is remapped between smooth inner and outer masks, allowing diffuse sky and bright objects to
deform together without producing a hard circular overlay. The `cosmic-web` catalogue root is a
navigation reference with no opaque geometry, so it cannot occlude Sagittarius A* at the shared
origin. The pass and nuclear cluster are disabled in low quality. `dormant`, `quiescent`, and
`active` describe the visual activity profile and never replace the catalogue confidence level.

## HYG v4.1 stellar catalogue

Source: [HYG Database v4.1](https://github.com/astronexus/HYG-Database), licensed under
[CC BY-SA 4.0](https://creativecommons.org/licenses/by-sa/4.0/).

The catalogue uses epoch and equinox J2000. Cartesian coordinates `x`, `y`, and `z` are expressed in
parsecs in the equatorial frame described by HYG: +X toward the vernal point, +Y toward right
ascension 6 h, and +Z toward the north celestial pole.

At runtime, those source vectors are rotated into the IAU Galactic frame using Murray's FK5 J2000
realization. The scene keeps the north Galactic pole on +Y, Galactic longitude 90° on +Z, and the
Galactic center toward −X from the Sun. The Solar neighborhood is then attached to the Sun at
`R0 = 8.178 kpc`, measured geometrically from the S2 orbit by the
[GRAVITY Collaboration (2019)](https://doi.org/10.1051/0004-6361/201935656). The approximately
20 pc vertical Solar offset is omitted in this first galactocentric visualization and is identified
as such in the static object metadata.

To reproduce the asset:

```bash
curl -fL \
  https://raw.githubusercontent.com/astronexus/HYG-Database/main/hyg/CURRENT/hygdata_v41.csv \
  -o data-sources/hygdata_v41.csv
npm run data:stars
```

The importer rejects the Sun, invalid coordinates, and the 100,000-parsec sentinel distance. It
then builds a fixed 10,000-entry, apparent-magnitude-ranked selection while guaranteeing inclusion
of every HYG identifier referenced by `nearby-stars.json`; a required faint entry replaces one of
the least-prioritized ordinary entries instead of increasing the catalogue size. This keeps
Proxima Centauri, Barnard's Star, and Wolf 359 available even though a pure brightness cut would
exclude them. The binary file preserves scientific coordinates in parsecs and a compact UTF-8
table of names, alternate designations, and spectral types. Visual distance compression remains a
separate rendering responsibility. The same command also rebuilds the static spatial index in
`public/data/stars/tiles/`.

`nearby-stars.json` contains the stable public IDs, localized descriptions, and physical metadata
for 16 featured stars, but no independent position vectors. Each object links to an HYG catalogue
identifier. At load time, the engine resolves that link to the same observed J2000 vector used by
the batched point, search index, label, picking, focus, and shareable URL. A featured star therefore
does not create a duplicate Three.js object or a conflicting hand-authored direction. Positions
remain fixed at the catalogue reference epoch until a proper-motion source is integrated.

The spatial preparation step builds a deterministic two-depth loose octree. Its 26 root nodes cover
640-parsec cubes and render 160-parsec aggregates; 85 child nodes cover 320-parsec cubes and render
40-parsec aggregates. Root data is grouped into eight 1,280-parsec request packs, while each root's
children share one detailed pack, for 34 static pack files in total. If every region is expanded,
the detailed representation contains 2,308 calculated clusters and the overview contains 302.

Cluster positions are arithmetic centroids, magnitudes combine source flux, and B−V values are
flux-weighted. Parent, child, pack, and global counts preserve all 10,000 source stars exactly.
These values are marked `calculated`, while their point size and aggregate rendering are explicitly
`illustrative-aggregation`. They never replace the observed catalogue used by search, labels, or
object focus.

To rebuild only those derived files:

```bash
npm run data:star-tiles
```

## Modern constellation figures

Source:
[Stellarium Modern sky culture](https://github.com/Stellarium/stellarium/tree/master/skycultures/modern),
created by the Stellarium team and licensed under
[CC BY-SA 4.0](https://creativecommons.org/licenses/by-sa/4.0/).

The International Astronomical Union defines constellations by their celestial boundaries and does
not prescribe one official stick-figure representation. The bundled line layer is therefore marked
`illustrative`: it represents the modern Stellarium convention as viewed from the Solar System, not
physical relationships between stars.

To reproduce the compact asset after generating `hyg-v41.bin`:

```bash
curl -fL \
  https://raw.githubusercontent.com/Stellarium/stellarium/master/skycultures/modern/index.json \
  -o data-sources/stellarium-modern.source.json
npm run data:constellations
```

The importer maps consecutive Hipparcos identifiers from each Stellarium polyline to the bundled
HYG identifiers. A segment is emitted only when both endpoints are among the 10,000 locally bundled
stars; missing endpoints are never bridged. The current output retains all 88 figures as 644
segments. Runtime validation rejects malformed figures, duplicate segments, and references absent
from the loaded HYG catalogue. Runtime navigation derives an illustrative centroid and extent from
those mapped positions, ranks names by the brightest connected star, and keeps selection
highlighting in one reusable line buffer.

## Local Group galaxy catalogue

Primary source:
[VizieR J/AJ/144/4](https://vizier.cfa.harvard.edu/viz-bin/VizieR-3?-source=J%2FAJ%2F144%2F4),
the catalogue published with
[McConnachie 2012, AJ 144:4](https://doi.org/10.1088/0004-6256/144/1/4). The maintained upstream
database is also available through the
[Canadian Astronomy Data Centre](https://www2.cadc-ccda.hia-iha.nrc-cnrc.gc.ca/en/community/nearby/).

`public/data/galaxies/local-group.json` contains an editorial selection of 31 catalogue-backed
galaxies around the Milky Way. It preserves heliocentric distance, galactic longitude and latitude,
morphological type, absolute magnitude, and half-light radius when available. The application
converts catalogue coordinates in kiloparsecs with:

```text
x = D cos(b) cos(l)
y = D sin(b)
z = D cos(b) sin(l)
```

Satellites are stored relative to the Milky Way or Andromeda host node. The static-data loader
resolves those parent transforms and verifies the resulting catalogue position within 0.75 kpc.
Map-label ranks, visual radii, luminosity, and silhouettes are rendering adaptations rather than
additional scientific measurements.

## Nearby-Universe galaxy tiles

Primary sources:

- [Updated Nearby Galaxy Catalog, VizieR J/AJ/145/101](https://cdsarc.cds.unistra.fr/viz-bin/cat/J/AJ/145/101),
  published by Karachentsev, Makarov, and Kaisina (2013);
- [ACS Virgo Cluster Survey distance catalogue](https://arxiv.org/abs/astro-ph/0702510),
  published by Mei et al. (2007), for the selected Virgo galaxies.

The complete 869-row fixed-width source table is filtered to catalogue distances from 1.5 to 11
megaparsecs. Seventeen objects already present in the curated Sculptor, M81, Centaurus A, and Canes
Venatici tiles are removed by normalized source identifier, including the Messier identifiers used
for M81, M82, and M101. The generated layer therefore contributes 698 unique catalogue objects;
the five original editorial tiles, including five ACS Virgo members, bring the searchable total to
720 observed galaxies.

`public/data/tiles/nearby-universe/index.json` is a `space-tiles-v2` index containing 115 entries.
Five are the original editorial regions and 110 form a deterministic octree: 8 roots, 33 level-1
nodes, 44 level-2 nodes, 19 level-3 nodes, and 6 level-4 nodes. An internal node retains four bright
overview galaxies while its remaining objects move into children; a leaf contains at most 24
objects. Search metadata for all 720 objects remains available at startup, while render records are
loaded only for the camera-selected or explicitly targeted tiles. The same index also stores one
minimal `overviewEntries` record per galaxy (identifier, observed position, unit, adaptive color,
and visual radius), allowing all 720 real positions to be rendered in one GPU batch without loading
the complete tile objects.

To reproduce the generated octree:

```bash
curl -fL \
  https://cdsarc.cds.unistra.fr/ftp/J/AJ/145/101/table1.dat \
  -o data-sources/updated-nearby-galaxies-table1.dat
npm run data:nearby-galaxies
```

The source snapshot used for the checked-in assets has SHA-256
`0d98691e4b04189e0359be7e55e8e9fa6c6d75fe085d833aad4ef5d1e101ce17`. The raw table is ignored by
Git; the generated static JSON files are versioned and require no runtime service.

The catalogues provide J2000 right ascension `α`, declination `δ`, and distance `D` in megaparsecs.
Static preparation converts them into the engine's equatorial Cartesian basis:

```text
x = D cos(δ) cos(α)
y = D sin(δ)
z = D cos(δ) sin(α)
```

The runtime validator recomputes those coordinates from the preserved source metadata and rejects a
tile when its object identifiers, parent/child links, hierarchy level, reference frame, bounds, or
catalogue position are inconsistent. Morphologies, magnitudes, angular diameters, distance methods,
and distances are observed catalogue fields; visual radii, colors, orientations, label ranks, and
octree subdivisions are educational rendering choices.

## Cosmicflows-4 galaxy groups

Primary source: [Cosmicflows-4, CDS J/ApJ/944/94](https://cdsarc.cds.unistra.fr/viz-bin/cat/J/ApJ/944/94),
published by [Tully et al. (2023)](https://doi.org/10.3847/1538-4357/ac94d8). The catalogue combines
multiple distance indicators and groups 55,877 galaxies before estimating group distances and the
local velocity field. The bundled source is the catalogue's 38,053-row fixed-width group table.

To reproduce the browser asset:

```bash
curl -fL \
  https://cdsarc.cds.unistra.fr/ftp/J/ApJ/944/94/table4.dat.gz \
  -o data-sources/cosmicflows4-table4.dat.gz
npm run data:cosmic-web
```

The checked source snapshot has SHA-256
`be91d4fae6fa01552ab3bc85db695411fca3249eeae08b566a712e6ea790bd99`. The raw compressed table is
ignored by Git. The generated `public/data/galaxies/cosmicflows4-groups.bin` and its JSON metadata
remain versioned static assets.

The importer excludes 323 records at or inside 11 Mpc because the more detailed nearby-Universe
layer owns that volume. It sorts the remaining 37,730 groups by distance and then uncertainty,
covering 11.1 to 772.7 Mpc. Each 32-byte little-endian record preserves the PGC identifier, distance
modulus, modulus uncertainty, CMB-frame radial velocity, and J2000 Cartesian coordinates. Right
ascension `α`, declination `δ`, and catalogue distance `D` are converted with:

```text
x = D cos(δ) cos(α)
y = D sin(δ)
z = D cos(δ) sin(α)
```

The browser parser validates the signature, v2 format, record dimensions, coordinate norm, unique
PGC identifiers, finite measurements, distance ordering, filament index bounds, pair ordering,
pair uniqueness, and exact byte length. Distances are marked `calculated`, matching the catalogue
methodology. Point radii, opacity, color, label ranks, and the selected halo are adaptive visual
encodings. The runtime point shader uses one additive white-core halo per entry and maps logarithmic
relative depth from warm nearby groups to cool violet remote groups; the legend identifies this as
an illustrative depth encoding rather than an observed physical color. Label candidates use a
progressive distance-stratified order so each quality tier covers the full catalogue depth instead
of clustering around the Local Volume.

The importer also derives a deterministic nearest-neighbor scaffold before the application build. A
20 Mpc spatial hash connects each group to at most its two closest groups within 52 Mpc, deduplicates
the resulting 49,939 edges, and appends their 8-byte index pairs after the group records. Their order
is distributed so lower quality settings retain structure throughout the volume. The browser only
decodes those pairs and creates the GPU attributes; no spatial graph is rebuilt on the main thread.
Distance uncertainty attenuates each edge, while low, medium, and high quality draw 28%, 62%, or
100% of the graph in one `THREE.LineSegments` batch. The graph is marked `illustrative`: its lines
are not measured group dimensions, detected physical links, or a continuous reconstruction of
clusters, walls, voids, and cosmic filaments.

### Simulated cosmic-density volume

`npm run data:cosmic-web` also runs `npm run data:cosmic-volume` and derives
`public/data/structures/cosmic-web-density.bin` from the versioned Cosmicflows-4 binary. The build
tool splats uncertainty-weighted group positions, spatially samples 10,987 of the illustrative
proximity links, and compensates for the catalogue's radial selection bias in a 128³ Cartesian grid
spanning ±800 Mpc. A deterministic 6³ cellular field fills unmeasured gaps with explicitly simulated
continuity; one separable smoothing pass, restored anchors, and logarithmic encoding preserve both
filaments and nodes. The generated asset is approximately 2 MiB and its JSON sidecar records the
source hash, dimensions, epoch, inputs, reconstruction settings, and scientific warning.

The `UMCV` v1 format uses a 64-byte little-endian header followed by a single-channel density field.
The browser validates its signature, version, dimensions, coordinate frame, epoch, source counts,
flags, and exact byte length before creating a `THREE.Data3DTexture`. One back-face box shader then
ray-marches the field with at most 16, 26, or 40 samples according to graphics quality and advances
more quickly through samples below the density threshold. No voxel becomes a Three.js object and no
density reconstruction runs in the browser.

This layer is marked `simulated`. Its cellular continuity is an Illustris-inspired visual device,
not an import of the Illustris simulation, not a physical filament catalogue, and not a directly
observed dark-matter or baryonic-matter density field. The measured/calculated point catalogues and
documented structure symbols remain separate selectable layers, and the continuous envelope can be
disabled from the cosmic-map panel.

## Documented large-scale structures

`public/data/structures/cosmic-structures.bin` is a provenance-preserving union of selected public
catalogues, not a deduplicated claim that each row is a distinct physical object. The current static
asset retains 26,500 positionable detections from seven source tables:

- all 8,757 detections in the four
  [Liivamäki, Tempel & Saar SDSS DR7 supercluster tables](https://cdsarc.cds.unistra.fr/viz-bin/cat/J/A+A/539/A80);
- all 1,228 robust voids in the published
  [BOSS DR12 quality-cut table](https://cdsarc.cds.unistra.fr/viz-bin/cat/J/ApJ/835/161), rather
  than treating all 10,643 pre-cut watershed candidates as robust structures;
- all 15,421 filament envelopes in the
  [Tempel et al. SDSS DR8 Bisous catalogue](https://cdsarc.cds.unistra.fr/viz-bin/cat/J/MNRAS/438/3465);
- the 1,094 detections from
  [Planck PSZ2](https://cdsarc.cds.unistra.fr/viz-bin/cat/J/A+A/594/A27) that have a published
  external redshift and can therefore be placed in three dimensions. The 559 PSZ2 detections
  without a redshift remain outside the 3D asset instead of receiving an invented distance.

The four supercluster definitions deliberately remain separate because fixed and adaptive density
thresholds, Main and LRG samples, and survey masks can detect overlapping structures. An empty part
of a survey footprint is not interpreted as a void, and an area outside a footprint is explicitly
treated as missing coverage.

To rebuild the static asset, download the documented CDS tables using the local names consumed by
the importer, then run:

```bash
npm run data:cosmic-structures
```

The generated metadata sidecar records the SHA-256 of every compressed source snapshot, source URL,
citation, detection method, retained record count, reference frame, and display cosmology. Raw
tables are ignored by Git; the generated binary and metadata remain versioned.

The `UMCS` v1 file uses a 48-byte header, fixed 48-byte little-endian records, and one UTF-8
identifier table. It preserves Cartesian J2000 position, comoving distance, catalogue scale,
quality/confidence, optional density and boundary measurements, member count when available, source
index, structure kind, flags, and catalogue identifier. The browser validates exact dimensions,
source cardinalities, type/source agreement, finite ranges, Cartesian norms, UTF-8 identifiers,
identifier uniqueness within each source, and catalogue distance bounds before exposing typed
arrays.

BOSS and Planck redshifts use a documented flat ΛCDM display conversion with `H0 = 70 km/s/Mpc`,
`Ωm = 0.3`, and `ΩΛ = 0.7`; source values in Mpc/h are converted with `h = 0.7`. This choice is
stored in the sidecar and is not presented as a precision cosmological fit. Tempel filament symbols
use the center of each published Cartesian envelope and its catalogued spine length. These point
symbols remain useful as progressively disclosed map landmarks; a separate line asset renders the
published spine geometry described below.

At runtime, all 26,500 records share one typed-array `THREE.Points` batch and one reusable selection
marker. A stable, source-aware reveal order lets the draw range grow with zoom and graphics quality;
this changes only presentation, not search availability. Search entries and object cards preserve
source identity, and definitions are created only when requested. Type-aware symbols distinguish
clusters, superclusters, filament centers, and voids. The default synthesis displays clusters,
superclusters, and progressively sampled Tempel filaments so users can identify them directly on the
map; voids remain an opt-in layer. Void symbols use soft, dark underdensity centers with diffuse cool
boundaries rather than hard rings. The label pool stays bounded by quality and collision policy.

### Tempel filament spines

The `UMFS` v1 source layer comes from table 2 of the
[Tempel et al. SDSS DR8 Bisous catalogue](https://cdsarc.cds.unistra.fr/viz-bin/ReadMe/J/MNRAS/438/3465?format=html&tex=true).
It retains all 15,421 filaments, 275,599 published spine points, and the 260,178 consecutive
point-to-point segments implied by those source rows. Reproduce the versioned browser asset with:

```bash
curl -fL \
  https://cdsarc.cds.unistra.fr/ftp/J/MNRAS/438/3465/table2.dat.gz \
  -o data-sources/sdss-dr8-filaments-table2.dat.gz
npm run data:cosmic-structures
```

The checked compressed snapshot has SHA-256
`65808180bc2fd42bd46af92a484db7cde4a343892701699d8e6cb99b687d9e76` and is ignored by Git. The
generated `public/data/structures/tempel-filament-spines.bin` is 4,533,016 bytes; its versioned JSON
sidecar preserves the source URL and hash, J2000 frame, J2000 epoch, Mpc/h source unit, `h = 0.7`
conversion, approximately 0.5 Mpc/h point spacing, catalogue dimensions, and metric names.

The 64-byte binary header is followed by one 8-byte index entry per filament and one 16-byte record
per point. Index entries preserve the numeric filament ID, point count, and contiguous point offset.
Point records preserve three `float32` Cartesian coordinates in megaparsecs and quantized visit-map,
weighted-density, and orientation-strength values. The importer maps the catalogue axes
`[x, y, z]` to Universe Map's `[x, z, y]` basis so declination remains vertical, but does not smooth,
interpolate, or replace any source point.

The manifest marks the binary for deferred loading: planetary, stellar, galactic, Local Group, and
nearby-Universe startup does not fetch it. Entering the cosmic-web LOD, enabling the filament layer,
or selecting a Tempel object triggers one request and one validated decode. Runtime checks reject
wrong dimensions, frames, units, offsets, ordering, point coverage, nonphysical coordinates,
dishonest distance bounds, and malformed metrics. Consecutive segments are grouped by midpoint into
at most eight spatial octants; the current SDSS footprint produces four non-empty GPU tiles. Stable
quality and distance thresholds reveal subsets without changing search results. Whole-spine hover
and selection use reusable line objects. Color and opacity incorporate the three published metrics.
The exact one-pixel axes receive a separate, softly additive screen-space halo whose density and
width are quality-bounded; that halo is tagged `illustrative`, capped independently from scientific
axis detail, and never presented as a physical filament diameter or an observed continuous
matter-density field.
