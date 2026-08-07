# Physical high-quality campaign — 14 September 2026

This note records the outcome of the clean physical campaign captured at
`2026-09-14T13:07:06.110Z`. The raw evidence is intentionally generated outside the repository by
`npm run benchmark:campaign`; its report manifest identifies the measured source, host, renderer,
configuration, and SHA-256 digests for all five reports.

| Property             | Value                                                                                         |
| -------------------- | --------------------------------------------------------------------------------------------- |
| Source               | `5ef4fe39d660dd564255c01032852301a82f1c0c` (clean)                                            |
| Device class / label | physical `high` / Apple M5 Max                                                                |
| Browser renderer     | Chrome 153 / ANGLE Metal Renderer: Apple M5 Max                                               |
| Quality / runs       | `high` / 3 (3 resource cycles)                                                                |
| Protocols            | startup, Tempel transition, resource stability, scale-frame stability, observable planetarium |

All five protocols passed. The median first usable map was 505.6 ms (524.6 ms worst). The Tempel
first visible frame was 0.7 ms median and 0.8 ms worst after 3/3 preloads; resource counts remained
84 geometries, 16 textures, and 40 draw calls; cold scale journeys remained within their global
budget; and all three Retina planetarium runs resolved Jupiter with a 16.8 ms worst frame and no
long frames.

The real Tempel batch is prepared and compiled before its ordinary reveal LOD while completely
invisible, then reused at activation. This removes the measured first-use GPU stall without changing
camera position, orientation, target, velocity, visual reveal range, catalogue coordinates, or
scientific data. The result is evidence for the measured high-end host only; it does not emulate or
make a performance claim for medium or low hardware.
