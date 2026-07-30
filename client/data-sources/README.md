# Local data sources

Large source files are neither bundled at runtime nor versioned. Compact assets produced by scripts
in `tools/` are served from `public/data/`.

## HYG v4.1 stellar catalogue

Source: [HYG Database v4.1](https://github.com/astronexus/HYG-Database), licensed under
[CC BY-SA 4.0](https://creativecommons.org/licenses/by-sa/4.0/).

The catalogue uses epoch and equinox J2000. Cartesian coordinates `x`, `y`, and `z` are expressed in
parsecs in the equatorial frame described by HYG: +X toward the vernal point, +Y toward right
ascension 6 h, and +Z toward the north celestial pole.

To reproduce the asset:

```bash
curl -fL \
  https://raw.githubusercontent.com/astronexus/HYG-Database/main/hyg/CURRENT/hygdata_v41.csv \
  -o data-sources/hygdata_v41.csv
npm run data:stars
```

The importer rejects the Sun, invalid coordinates, and the 100,000-parsec sentinel distance, then
keeps the 10,000 brightest valid stars by apparent magnitude. The binary file preserves scientific
coordinates in parsecs and a compact UTF-8 table of names, alternate designations, and spectral
types. Visual distance compression remains a separate rendering responsibility.
