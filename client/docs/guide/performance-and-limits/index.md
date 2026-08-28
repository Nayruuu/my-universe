---
title: Performance and limits
description: Understand Universe Map graphics profiles, streaming, GPU batching, browser requirements, debug metrics, and known limitations.
---

# Performance and limits

Universe Map targets 60 frames per second on a modern desktop and 30 frames per second on mobile. A
stable frame time is more important than displaying every available point at once.

## How rendering stays bounded

- stars, exoplanet hosts, galaxy groups, and large structures use GPU point or line batches;
- no individual Three.js object is created for each large-catalogue record;
- camera-driven spatial indexes load only relevant star and galaxy tiles;
- textures and detailed object materials are loaded near their useful level of detail;
- orbital calculations update at a lower frequency and interpolate between states;
- labels have scale-, quality-, and collision-aware budgets;
- volumetric effects use quality-specific ray-marching and pixel budgets;
- the render loop runs outside Angular change detection.

## Graphics profiles

| Profile | Intended use                          | Typical reductions                                                      |
| ------- | ------------------------------------- | ----------------------------------------------------------------------- |
| Low     | Phones, older laptops, battery saving | Fewer points, smaller textures, shorter ray marching, lower tile budget |
| Medium  | Integrated GPUs and general use       | Balanced density and post-processing                                    |
| High    | Recent desktop hardware               | Richer catalogues, larger textures, denser volumes, more visual detail  |

The profile never changes the source coordinates returned by a catalogue or calculation.

## Physical baseline status

A repeated measurement on 27 August 2026 used a high-end MacBook Pro with Apple M5 Max, macOS 26.6,
Chrome 151, the real Metal renderer, desktop/high quality, and device pixel ratio 1. Across three
runs, the median first usable map arrived in 259.3 ms and Tempel's median first visible frame took
7.1 ms. Three cold scale journeys stayed at 9.1–9.2 ms p95, 16.7 ms p99, 66.6–75 ms maximum, and
0.24–0.36% long frames. After three warmups, three resource cycles stayed at 100 geometries,
18 textures, and 44 draw calls, while collected heap decreased by 0.77 MiB.

A separate observable-planetarium profile requested browser DPR 2 at 1440 × 900 CSS pixels. The
high-quality renderer applied its documented DPR 1.5 cap and remained stable there across all three
runs. Each run sampled 1,452–1,455 frames at 9.1 ms p95, 9.3 ms p99, 9.4–9.5 ms maximum, and zero
long frames; Jupiter reached its resolved representation in all three runs.

A clean same-host simulated campaign recorded on 28 August 2026 from revision `27db0e1` passed all
ten reports. At medium quality and CPU 4×, the median first usable map was 1.26 s, Tempel's median
first visible frame was 24.2 ms, three cold scale journeys held at 9.3 ms p95 with a 66.5 ms worst
frame, and observable runs held at 9.2 ms median p95 with a 24.9 ms worst frame and Jupiter resolved
3/3. At low quality and CPU 6×, the corresponding values were 1.85 s, 33.1 ms, 16.6–16.7 ms p95 with
an 83.4 ms worst scale frame, and 9.4 ms observable p95 with a 41.7 ms worst frame and Jupiter
resolved 3/3. Both resource protocols kept geometry, texture, and draw-call counts unchanged over
three cycles. The GPU remained the M5 Max, so these results measure regression headroom rather than
representative medium- or low-end hardware.

All five performance benchmarks—startup, Tempel, resources, scale frames, and the observable
planetarium—can write the same versioned JSON evidence report with
`UNIVERSE_BENCHMARK_REPORT_PATH`. It records the Git revision and dirty state, host characteristics,
browser and WebGL renderer, configuration, samples, and summary. Setting
`UNIVERSE_BENCHMARK_REQUIRE_PHYSICAL=1` rejects CPU throttling, software rendering, and a missing
declared `UNIVERSE_BENCHMARK_DEVICE_CLASS` before writing the report, so a simulated result cannot
silently enter the physical device matrix.

`npm run benchmark:campaign` runs the five protocols sequentially on one representative physical
machine. It requires a clean Git checkout plus a declared class and label, disables CPU throttling,
enforces strict budgets and at least three repetitions, and defaults quality to the device class. It
writes five reports outside the repository and a `universe-map/performance-campaign@1` manifest that
binds them with SHA-256 digests. The command packages comparable evidence; it does not turn one
machine into another class.

`npm run benchmark:campaign:simulated` is a separate same-host stress campaign for environments
without representative hardware. It applies Chrome CPU throttling to all five protocols, then runs
medium quality at 4× with observer DPR 1.25 and low quality at 6× with observer DPR 1. The ten
benchmarks remain sequential and produce a clean-checkout
`universe-map/simulated-performance-campaign@1` manifest with SHA-256 digests and explicit
limitations. The source GPU, graphics memory, driver, memory bandwidth, and thermal behavior are not
emulated; medium and low are regression proxies, never physical-device evidence. A failed budget no
longer stops the next protocols: the complete manifest marks every protocol, profile, and campaign
with `withinBudget`, then strict mode returns a failure. Use `UNIVERSE_BENCHMARK_STRICT=0` only when a
known-regressing baseline must still be collected successfully.

The repeated physical baseline still documents the high-end class only. Medium- and low-end physical
measurements are an optional future cross-check rather than a blocker when the hardware is
unavailable.

## Debug panel

Append `?debug=true` to the URL to display runtime information such as frames per second, draw calls,
triangles, geometries, textures, visible objects, current reference frame, camera distance, target,
Julian Day, and graphics quality. When the cosmic-web scale loads the published Tempel catalogue,
the panel also separates network fetch, Worker decoding and round-trip, main-thread geometry
preparation, scene installation, the first visible render submission, and total time to visibility.
Tempel data starts preloading in the nearby-universe view without adding geometry to the scene. The
panel reports whether the cosmic-web activation reused that preload, how much lead time it gained,
and the remaining activation-to-visible latency.

Example:

```text
https://super-universe.app/?debug=true
```

## Browser requirements

- JavaScript enabled;
- WebGL 2 support;
- enough GPU memory for the selected quality profile;
- pointer events for mouse, pen, or touch navigation.

If the renderer reports a performance warning, lower quality before reducing browser zoom. Browser
zoom changes interface pixels; the graphics profile changes the actual rendering budget.

## Known limitations

- the catalogue is extensive but not an exhaustive map of every known star or galaxy;
- object radii and some scale transitions are visually adapted;
- Received light corrects supported Solar System bodies—including Galilean moons, simplified
  satellites, dwarf planets, asteroids, and comets—and HYG stars for finite light-travel time;
  documented exoplanet systems share a delay derived from their published host distance, while their
  local planetary phases remain illustrative and systems without a distance stay simultaneous;
- nearby galaxies use geometric catalogue light time; Cosmicflows-4 luminosity distances and
  large-structure comoving distances use an inferred flat-ΛCDM redshift and lookback time;
- cosmological positions, shapes, and catalogue measurements remain static and are not evolved back
  to the displayed emission epoch;
- cosmological structure layers combine separate surveys with different footprints and selection
  functions;
- absence of a catalogue detection does not imply a physical cosmic void;
- detailed planetary surface navigation and live weather are outside the current scope;
- the black-hole effect is qualitative and does not trace general-relativistic null geodesics.

## Troubleshooting

If navigation becomes slow, switch to Low quality, close other GPU-heavy tabs, and return to a known
target. If a static dataset fails, reload once and inspect the browser network panel for the specific
file rather than assuming the entire map is unavailable.

Next: [Developer guide](/developers/).
