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

## Debug panel

Append `?debug=true` to the URL to display runtime information such as frames per second, draw calls,
triangles, geometries, textures, visible objects, current reference frame, camera distance, target,
Julian Day, and graphics quality.

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
- the Observable temporal mode is not yet a complete light-travel-time simulation;
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
