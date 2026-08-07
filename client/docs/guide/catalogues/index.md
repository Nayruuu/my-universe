---
title: Catalogues and sources
description: Review the principal astronomical catalogues, static datasets, provenance, and data preparation used by Universe Map.
---

# Catalogues and sources

All runtime data is hosted with the application. Import scripts clean source snapshots, normalise
identifiers and units, validate references, create binary catalogues or spatial tiles, and update the
versioned manifest before deployment.

## Current coverage

| Layer                  |                                    Runtime coverage | Scientific treatment                                                   |
| ---------------------- | --------------------------------------------------: | ---------------------------------------------------------------------- |
| Solar System           | Sun, eight planets, selected moons and minor bodies | Local ephemerides and documented orbital providers                     |
| Confirmed exoplanets   |                    6,333 planets around 4,747 hosts | NASA composite catalogue facts; illustrative close-up systems          |
| Stellar catalogue      |                           10,000 selected HYG stars | Observed catalogue coordinates with proper-motion support              |
| Constellations         |                     88 modern figures, 644 segments | Cultural line conventions mapped to HYG identifiers                    |
| Historical supernovas  |                               6 events and remnants | Documented positions and dates; illustrative visual evolution          |
| Local Group            |                                         31 galaxies | Catalogue positions with adapted morphology and size                   |
| Nearby Universe        |                                        720 galaxies | Static local-volume octree and catalogue-backed overview               |
| Cosmicflows-4          |                                37,730 galaxy groups | Calculated three-dimensional positions from published catalogue fields |
| Large-scale structures |                      26,500 positionable detections | Separate cluster, supercluster, void, and filament products            |
| Tempel filaments       |                    15,421 spines and 275,599 points | Published spine geometry preserved in a compact binary layer           |

## Principal sources

- [Astronomy Engine](https://github.com/cosinekitty/astronomy) for local planetary and lunar
  calculations;
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
