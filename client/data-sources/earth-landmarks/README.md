# Earth landmark snapshot

This directory contains the reproducible source snapshot used to build the static city-horizon landmark packs. The browser never calls Wikipedia, Wikidata, or GeoNames: it only loads the generated regional files from `public/data/earth-landmarks/`.

## Rebuild

From `client/`:

```sh
node tools/build-earth-landmark-snapshot.mjs \
  --concurrency 8 \
  --generated-at 2026-08-19T00:00:00.000Z
```

To rebuild the regional packs from the checked-in snapshot without network access:

```sh
node tools/build-earth-landmark-snapshot.mjs --repack-existing
```

Run the focused checks with:

```sh
node --test \
  tools/build-earth-landmark-snapshot.spec.mjs \
  tools/earth-landmark-artifacts.spec.mjs
```

## Inputs and selection

- Observer locations come from `src/engine/simulation/earth-observer-locations.data.ts`.
- The builder queries the English Wikipedia geosearch endpoint for up to 500 georeferenced pages within 10 km of each observer location. Saturated locations receive four overlapping peripheral searches. Cities above one million inhabitants are always searched beyond the center; megacities above five million inhabitants receive eight 10 km searches on a 12 km ring, covering landmarks roughly 22 km from an off-center GeoNames point.
- Candidates must represent a currently existing physical place. Articles about events, people, organizations, demolished structures, planned structures, or settlements are excluded.
- Candidates are ranked deterministically by landmark category, article depth, the preceding 60 days of Wikipedia page views, distance, and azimuth diversity. The page-view property is fetched separately for a diverse shortlist and follows Wikimedia continuation tokens, preventing alphabetical or first-page bias. Four landmarks are selected for every location. The page-view value is only a reproducible notability signal, not a scientific property of the landmark.
- Wikidata `P2048` statements provide optional documented heights. Supported source units are converted to metres.
- Wikidata `P576` statements exclude ended or demolished entities before the final selection.
- If a location has fewer than four suitable documented candidates, the remaining positions are explicit GeoNames-based illustrative cityscape anchors. They are never presented as observed landmarks.

All generated silhouettes remain illustrative. A documented name, position, or height does not imply that the rendered outline reproduces the real building.

## Quality gates

The generator fails instead of writing incomplete production data unless all of these conditions hold:

- every observer location is present exactly once;
- every location exposes exactly four uniquely identified landmarks;
- the snapshot and metadata counts agree;
- at least 180 selected landmarks have a documented height when height retrieval is enabled;
- selected names do not describe accidents, attacks, disasters, or other non-place event articles;
- no more than 150 illustrative fallback anchors are required;
- every regional pack URL contains the first 12 hexadecimal characters of the SHA-256 hash of the exact pack bytes.

The committed snapshot currently covers 461 observer locations and 1,844 landmark records. It contains 218 documented heights and 96 explicit illustrative fallback anchors.

## Sources and licenses

- [Wikidata](https://www.wikidata.org/wiki/Wikidata:Licensing): CC0 1.0. Used for stable identifiers, coordinates, heights, and end dates.
- [Wikipedia / Wikimedia projects](https://foundation.wikimedia.org/wiki/Policy:Terms_of_Use): page titles, short descriptions, canonical article URLs, and basic page metadata are queried for selection and attribution. Wikipedia text is available under CC BY-SA unless a page states otherwise.
- [GeoNames](https://www.geonames.org/): CC BY 4.0. Observer-city coordinates and the explicitly labelled fallback anchors derive from the local GeoNames-based observer catalogue.

Each selected record retains its source title and canonical source URL in the snapshot and runtime tuple. Dataset generation is a build-time maintenance task; it is not part of the browser runtime.
