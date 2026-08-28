# Gaia DR3 bright high-confidence stellar hierarchy

Universe Map uses a static snapshot of the ESA Gaia Data Release 3
[`gaiadr3.gaia_source_lite`](https://gea.esac.esa.int/archive/documentation/GDR3/Gaia_archive/chap_datamodel/sec_dm_main_source_catalogue/ssec_dm_gaia_source.html)
table to build the calculated stellar background shown in the stellar-neighborhood overview.
Credit: **ESA/Gaia/DPAC**. Gaia DR3 is described by
[Gaia Collaboration et al. (2023)](https://doi.org/10.1051/0004-6361/202243940) and has the release
DOI [`10.5270/esa-qa4lep3`](https://doi.org/10.5270/esa-qa4lep3).

This dataset does not replace HYG. HYG keeps the 10,000 exact named/searchable points, proper-motion
propagation, labels, constellations, selection, and focus. Gaia rows become distant anonymous
spatial aggregates and bounded anonymous samples of real catalogue sources used only as a dense
background.

## Source selection

The source query is:

```sql
SELECT source_id, ra, dec, parallax, parallax_over_error,
       phot_g_mean_mag, bp_rp
FROM gaiadr3.gaia_source_lite
WHERE parallax >= 0.2
  AND parallax_over_error >= 10
  AND phot_g_mean_mag <= 12
  AND bp_rp IS NOT NULL
ORDER BY source_id
```

The Gaia archive response was downloaded on 28 August 2026 in three monotonically ordered
`source_id` partitions because one synchronous result exceeded the archive response limit. The
versioned metadata file records the exact continuation query, first and last source identifier,
row count, and SHA-256 hash of each local CSV partition. The three ignored CSV files contain
2,923,790 source rows in total and are intentionally not committed; the generated runtime hierarchy
is committed.

Gaia DR3 positions use the ICRS reference epoch J2016.0 (`JD 2457388.5`). `ra` and `dec` are converted
to a unit ICRS vector, and positive parallax in milliarcseconds gives the input distance
`1000 / parallax` parsecs. Flux is proportional to `10^(-0.4 G)`.

## Scientific limits

The snapshot is intentionally incomplete:

- `G <= 12` omits fainter sources;
- `parallax_over_error >= 10` and positive `parallax >= 0.2 mas` favour nearby sources with precise
  astrometric solutions and introduce a selection bias;
- inverse parallax is used only after that high-signal-to-noise cut and is still not a Bayesian
  distance estimate;
- requiring BP−RP omits sources without both colour measurements;
- the 0.2 mas threshold imposes a nominal 5 kpc boundary;
- aggregates and sampled sources remain at J2016.0 and do not propagate source-level proper motion
  through the selected application date;
- each 512 pc leaf retains at most 96 sources, so the measured samples are not a complete or
  statistically unbiased rendering of the filtered query.

The hierarchy therefore describes a quality-filtered distribution of local catalogue light, not a
volume-complete census. A retained sample is a real Gaia source at J2016.0, but it is not a precise
position at an arbitrary selected date.

## Aggregation, sampling, and runtime contract

The generator streams the CSV partitions and computes two calculated representations:

- 512 pc aggregate cells in 2,048 pc root tiles;
- up to 96 measured Gaia sources in every 512 pc child tile: the 32 brightest sources plus up to 64
  sources selected by a stable `source_id` hash for deterministic spatial coverage.

Cell positions are arithmetic ICRS centroids. Cell G magnitudes combine source flux, while BP−RP is
weighted by G flux. Refined samples retain each selected source's catalogue position, G magnitude,
and BP−RP value. Their integer density weights sum back to the child tile's complete source count;
those weights do not turn a sample into an aggregate position. Cell coordinates and photometry have
`calculated` confidence; sample coordinates and photometry are measured catalogue values; point
size, opacity, colour mapping, and every density weight are rendering adaptations. The hierarchy
contains 127 roots, 3,837 child tiles, 133,526 measured samples, and 135 request packs. Runtime
parsing happens in module Workers where available, and typed-array buffers are transferred to the
main thread without copying. One `THREE.Points` batch is used per active representation, never one
Three.js object per source.

To verify and rebuild the committed output from the local source partitions:

```bash
cd client
npm run data:star-tiles
```

The command rejects a missing row, changed partition hash, ordering error, metadata mismatch,
non-finite source value, or hierarchy count mismatch. Its independent Proxima Centauri fixture checks
the ICRS Cartesian conversion against an Astropy reference value.
