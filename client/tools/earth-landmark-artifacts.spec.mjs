import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import test from 'node:test';
import { parseEarthObserverLocationSource } from './build-earth-landmark-snapshot.mjs';

const OBSERVER_SOURCE = 'src/engine/simulation/earth-observer-locations.data.ts';
const MANIFEST_PATH = 'public/data/earth-landmarks/manifest.json';
const EVENT_ARTICLE_PATTERN =
  /\b(attack|bombing|crowd crush|incident|massacre|shooting|stampede|crash|explosion|derailment|airstrike|assassination|earthquake|flood|cyclone|hurricane|typhoon|tornado|pandemic|outbreak)\b/iu;
const PHYSICAL_COMMEMORATION_PATTERN = /\b(memorial|monument)\b/iu;

test('indexes four sourced landmark records for every observer city', async () => {
  const locations = parseEarthObserverLocationSource(await readFile(OBSERVER_SOURCE, 'utf8'));
  const manifest = JSON.parse(await readFile(MANIFEST_PATH, 'utf8'));
  const expectedLocationIds = new Set(locations.map(({ id }) => id));

  assert.equal(manifest.version, 1);
  assert.equal(manifest.locationCount, locations.length);
  assert.equal(manifest.locations.length, locations.length);
  assert.deepEqual(
    new Set(manifest.locations.map(([locationId]) => locationId)),
    expectedLocationIds,
  );

  const indexedLocationIds = new Set();
  const landmarkIds = new Set();
  const landmarkNamesByLocation = new Map();
  let documentedHeightCount = 0;
  let fallbackCount = 0;

  for (const [regionId, packUrl] of manifest.packs) {
    const parsedPackUrl = new URL(packUrl, 'https://local.invalid');
    const packSource = await readFile(`public${parsedPackUrl.pathname}`, 'utf8');
    const pack = JSON.parse(packSource);
    const expectedVersion = createHash('sha256').update(packSource).digest('hex').slice(0, 12);

    assert.match(parsedPackUrl.search, /^\?v=[a-f0-9]{12}$/u);
    assert.equal(parsedPackUrl.searchParams.get('v'), expectedVersion);
    assert.equal(packSource, `${JSON.stringify(pack, null, 2)}\n`);
    assert.equal(pack.version, 1);
    assert.equal(pack.regionId, regionId);
    for (const [locationId, landmarks] of pack.locations) {
      assert.ok(expectedLocationIds.has(locationId), `unexpected location ${locationId}`);
      assert.ok(!indexedLocationIds.has(locationId), `duplicate location ${locationId}`);
      assert.equal(landmarks.length, 4, `${locationId} must expose four landmarks`);
      indexedLocationIds.add(locationId);

      for (const tuple of landmarks) {
        const [
          id,
          name,
          ,
          ,
          ,
          ,
          ,
          heightMeters,
          heightConfidence,
          ,
          visualConfidence,
          selectionMethod,
          sourceTitle,
          sourceUrl,
        ] = tuple;

        assert.equal(tuple.length, 15, `${id} must use the compact runtime tuple`);
        assert.ok(!landmarkIds.has(id), `duplicate landmark ${id}`);
        assert.ok(name.length > 0, `${id} must have a name`);
        assert.ok(
          !EVENT_ARTICLE_PATTERN.test(name) || PHYSICAL_COMMEMORATION_PATTERN.test(name),
          `${id} must describe a place, not an event`,
        );
        assert.equal(visualConfidence, 'illustrative');
        assert.ok(sourceTitle.length > 0, `${id} must identify its source`);
        assert.match(sourceUrl, /^https:\/\//u);
        landmarkIds.add(id);
        landmarkNamesByLocation.set(locationId, [
          ...(landmarkNamesByLocation.get(locationId) ?? []),
          name,
        ]);
        documentedHeightCount += heightMeters !== null && heightConfidence === 'documented' ? 1 : 0;
        fallbackCount += selectionMethod === 'geonames-illustrative-fallback' ? 1 : 0;
      }
    }
  }

  assert.deepEqual(indexedLocationIds, expectedLocationIds);
  assert.equal(landmarkIds.size, locations.length * 4);
  assert.ok(documentedHeightCount >= 180, 'catalog must retain broad documented-height coverage');
  assert.ok(fallbackCount <= 150, 'catalog must limit illustrative fallback anchors');
  assert.ok(
    landmarkNamesByLocation.get('geonames-1275339')?.includes('Gateway of India'),
    'Mumbai must retain its defining Gateway of India landmark',
  );
});
