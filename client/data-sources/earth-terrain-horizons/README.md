# Earth terrain horizon snapshot

The planetarium terrain masks are calculated from the global **NOAA/NCEI ETOPO 2022 v1 surface
elevation model at 60 arc-second resolution**. The source product and user guide identify WGS 84
geographic coordinates, the EGM2008 vertical datum, and the downsampling of the 60 arc-second product
from the 15 arc-second source grid.

- product: <https://www.ncei.noaa.gov/products/etopo-global-relief-model>
- data DOI: <https://doi.org/10.25921/fd45-gt74>
- input file: `ETOPO_2022_v1_60s_N90W180_surface.tif`
- input file URL:
  <https://www.ngdc.noaa.gov/mgg/global/relief/ETOPO2022/data/60s/60s_surface_elev_gtif/ETOPO_2022_v1_60s_N90W180_surface.tif>
- ETOPO 2022 user guide:
  <https://www.ngdc.noaa.gov/mgg/global/relief/ETOPO2022/docs/1.2%20ETOPO%202022%20User%20Guide.pdf>

The 466 MB source GeoTIFF is neither committed nor shipped. `tools/build-earth-terrain-horizon-snapshot.mjs`
samples it offline and emits:

- a small validated manifest under `public/data/earth-terrain-horizons/`;
- one little-endian `Int16` binary containing obstruction angles in centidegrees, grouped by
  distance band.

Each of the 461 catalogue observer locations receives one 360° profile sampled every 1° in azimuth.
For every azimuth, the generator samples the relief every 1,852 m out to 300 km and bilinearly
interpolates the ETOPO cells. It retains the largest geometric elevation angle independently in three
contiguous distance bands: near (0–30 km), middle (30–100 km), and far (100–300 km). The exact
obstruction envelope used to hide celestial objects is the maximum of those three measured layers.
The line of sight uses the IUGG mean Earth radius of 6,371,008.8 m and a nominal two-metre eye height:

```text
x = (R + h_terrain) sin(d / R)
y = (R + h_terrain) cos(d / R) - (R + h_observer)
angle = atan2(y, x)
```

Atmospheric refraction is deliberately excluded from the terrain calculation. The result is therefore
**calculated from a measured global relief model**, not a surveyed site panorama. At 60 arc-seconds it
can represent regional hills and mountains, but not buildings, vegetation, local embankments, or
micro-relief. City-centre coordinates are catalogue anchors rather than surveyed telescope positions.
The planetarium draws the far layer first, then the middle and near layers, so their ETOPO-derived
silhouettes preserve a visible sense of depth. Their colour, haze, and lighting are explicitly
stylistic; only the angular contours and occlusion are calculated. The hand-composed skyline, lights,
buildings, and fallback terrain remain explicitly illustrative. Custom browser coordinates keep the
illustrative plain because the static application does not ship the global source raster or call an
elevation API.

The browser reconstructs the circular 1° profiles with a periodic monotone cubic Hermite
interpolation shared by rendering and occultation. It passes through every stored sample and remains
between adjacent values, preventing enlarged straight facets without inventing higher summits. This
interpolation does not restore the micro-relief absent from the 60 arc-second source.

To reproduce the checked-in compact files, download the input GeoTIFF outside the repository and run:

```bash
npm run data:earth-terrain-horizons -- --input /absolute/path/to/ETOPO_2022_v1_60s_N90W180_surface.tif
```
