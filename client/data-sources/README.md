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
loaded only for the camera-selected or explicitly targeted tiles.

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

The browser parser validates the signature, version, record dimensions, coordinate norm, unique PGC
identifiers, finite measurements, and distance ordering. Distances are marked `calculated`, matching
the catalogue methodology. Point radii, opacity, color, label ranks, and the selected halo are
adaptive visual encodings. Label candidates use a progressive distance-stratified order so each
quality tier covers the full catalogue depth instead of clustering around the Local Volume. These
encodings are not measured group dimensions or a continuous reconstruction of cosmic filaments.
