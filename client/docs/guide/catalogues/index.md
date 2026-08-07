---
title: Catalogues and sources
description: Review the principal astronomical catalogues, static datasets, provenance, and data preparation used by Universe Map.
---

# Catalogues and sources

All runtime data is hosted with the application. Import scripts clean source snapshots, normalise
identifiers and units, validate references, create binary catalogues or spatial tiles, and update the
versioned manifest before deployment.

## Current coverage

| Layer                  |                                                         Runtime coverage | Scientific treatment                                                                          |
| ---------------------- | -----------------------------------------------------------------------: | --------------------------------------------------------------------------------------------- |
| Solar System           | 41 objects: Sun, planets, 21 moons, dwarf planets, asteroids, and comets | Local ephemerides and documented JPL orbital providers                                        |
| Confirmed exoplanets   |                                         6,333 planets around 4,747 hosts | NASA composite catalogue facts; illustrative close-up systems                                 |
| Stellar catalogue      |                                                10,000 selected HYG stars | Observed catalogue coordinates with proper-motion support                                     |
| Constellations         |                                          88 modern figures, 644 segments | Cultural line conventions mapped to HYG identifiers                                           |
| Historical supernovas  |                                                    6 events and remnants | Documented positions and dates; illustrative visual evolution                                 |
| Local Group            |                                                              31 galaxies | Catalogue positions with adapted morphology and size                                          |
| Nearby Universe        |                                                             720 galaxies | Static local-volume octree and catalogue-backed overview                                      |
| Cosmicflows-4          |                                                     37,730 galaxy groups | Calculated three-dimensional positions from published catalogue fields                        |
| Large-scale structures |                                           26,520 positionable detections | Separate cluster, supercluster, wall, basin, attractor, repeller, void, and filament products |
| Tempel filaments       |                                         15,421 spines and 275,599 points | Published spine geometry preserved in a compact binary layer                                  |

The Tempel binary is fetched and validated in a dedicated Web Worker at cosmic-web scale. Its six
decoded typed-array buffers are transferred back without copying; browsers without Worker support
use the same validated loader on the main thread.

The 20 named flow landmarks are not merged into the Tempel network: two walls retain their published
representative extents, 15 probabilistic basins use the published Table 2 centres and probabilities,
and attractor/repeller symbols mark reconstructed velocity-field extrema. Basin radii are equivalent
display radii derived from published volumes, not observed spherical boundaries.

## Principal sources

- [Astronomy Engine](https://github.com/cosinekitty/astronomy) for local planetary and lunar
  calculations;
- [NASA/JPL satellite mean elements](https://ssd.jpl.nasa.gov/sats/elem/) and
  [physical parameters](https://ssd.jpl.nasa.gov/sats/phys_par/) for major moons;
- [NASA/JPL Small-Body Database](https://ssd.jpl.nasa.gov/tools/sbdb_lookup.html) for bundled dwarf
  planets, asteroids, and comets;
- [NASA/JPL Solar System Simulator maps](https://space.jpl.nasa.gov/tmaps/) and
  [USGS Astrogeology](https://astrogeology.usgs.gov/) for locally hosted spacecraft surface mosaics;
- [NASA VTAD planetary models](https://science.nasa.gov/3d-resources/) for representative Saturn,
  Uranus, and Neptune atmosphere atlases;
- [NASA/JPL-Caltech's Phobos](https://science.nasa.gov/resource/phobos-mars-moon-3d-model/) and
  [Deimos](https://science.nasa.gov/resource/deimos-mars-moon-3d-model/) models,
  [NASA VTAD's Ceres](https://science.nasa.gov/resource/ceres-3d-model/) and
  [Vesta](https://science.nasa.gov/resource/vesta-3d-model/) models,
  [NASA's Bennu 3D model](https://science.nasa.gov/resource/bennu-3d-model/), and
  [ESA's 67P OSIRIS shape catalogue](https://sci.esa.int/science-e/www/object/index.cfm?fobjectid=54289)
  for deferred observed shapes;
- [DAMIT model 4395 for Pallas](https://damit.cuni.cz/projects/damit/asteroid_models/view/4395)
  and [DAMIT model 4392 for Hygiea](https://damit.cuni.cz/projects/damit/asteroid_models/view/4392)
  for quality-4 calculated shape reconstructions based on VLT/SPHERE observations;
- NASA/PDS shape products for Ceres and Vesta, spacecraft measurements for Halley's nucleus, and the
  Ortiz et al. 2017 stellar-occultation model for Haumea's triaxial body and ring;
- [NASA Exoplanet Archive](https://exoplanetarchive.ipac.caltech.edu/) `PSCompPars` for confirmed
  exoplanets and hosts;
- [HYG Database v4.1](https://github.com/astronexus/HYG-Database) for the compact stellar field;
- [Stellarium modern sky culture](https://github.com/Stellarium/stellarium/tree/master/skycultures/modern)
  for constellation figures;
- [McConnachie 2012](https://ui.adsabs.harvard.edu/abs/2012AJ....144....4M/abstract) for Local Group
  galaxies;
- the [Updated Nearby Galaxy Catalog](https://ui.adsabs.harvard.edu/abs/2013AJ....145..101K/abstract)
  for local-volume galaxies;
- [Cosmicflows-4 groups](https://cdsarc.cds.unistra.fr/viz-bin/cat/J/ApJ/944/94) for the outer
  group layer;
- SDSS DR7 superclusters, BOSS DR12 voids, Planck PSZ2 clusters, and
  [Tempel SDSS DR8 filaments](https://cdsarc.cds.unistra.fr/viz-bin/cat/J/MNRAS/438/3465) for
  large-scale structures;
- NASA Visible Earth and other source-specific planetary imagery documented with each bundled
  texture.

Observed surface mosaics are used only where an appropriate global product is available. Filled
gaps, processed color, and incomplete coverage remain part of the published cartography and are
identified in the object card. Titan uses a Cassini ISS near-infrared mosaic; Saturn, Uranus, and
Neptune use representative NASA model atlases explicitly marked `illustrative`. Phobos, Deimos,
Ceres, Vesta, and Bennu have observed textured shapes; 67P has an observed shape with an
illustrative neutral surface. Pallas and Hygiea use calculated shape reconstructions with
illustrative untextured surfaces. Their polygonal assets are deferred until close LOD, with
lightweight fallbacks during loading or failure. Haumea and Halley's nucleus preserve sourced axis
ratios with triaxial silhouettes, while their adaptive volume remains stable across LODs. Other
unresolved bodies keep explicitly procedural materials instead of receiving a misleading
photographic skin.

The repository records detailed licences and transformations beside the static datasets and texture
assets. Bundled third-party material remains subject to its original licence even though the
application source is MIT licensed.

## Static manifest

`/data/manifest.json` is the browser entry point. Every dataset declares an identifier, URL, type,
and format where applicable. The loader validates JSON structures and binary headers before exposing
data to the engine. A failed optional catalogue produces a development warning without corrupting
unrelated layers.

## Rebuilding data

The repository includes deterministic Node.js import commands for stars, exoplanets, nearby galaxies,
constellations, Cosmicflows groups, cosmic volume, and published structures. Source snapshots are not
part of the browser runtime.

```bash
cd client
npm run data:stars
npm run data:exoplanets
npm run data:nearby-galaxies
npm run data:cosmic-web
npm run data:cosmic-structures
npm run test:data
```

Not every import should be run on each application build. Prepared versioned artefacts are committed
and validated; import commands are used when intentionally refreshing a source snapshot.

Next: [Performance and limits](/performance-and-limits/).
