import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import test from 'node:test';
import {
  buildNearbyGalaxyHierarchy,
  normalizeCatalogIdentifier,
  parseNearbyGalaxyCatalog,
  parseNearbyGalaxyLine,
} from './import-nearby-galaxies.mjs';

const CATALOG_LINE =
  'UGC12894           00 00 22.5 +39 29 44   1.02 0.87 0.47  17.57  16.80  19.91 14.02 *   15.66  34 10 Ir    L  335  8.47 TF';

test('decodes the documented fixed-width fields from the Updated Nearby Galaxy Catalog', () => {
  const galaxy = parseNearbyGalaxyLine(CATALOG_LINE, 1);

  assert.deepEqual(galaxy, {
    catalogName: 'UGC12894',
    rightAscensionDegrees: 0.09375,
    declinationDegrees: 39.495_555_555_555_555,
    angularDiameterArcmin: 1.02,
    axisRatio: 0.87,
    apparentMagnitudeB: 16.8,
    morphologicalType: 10,
    dwarfMorphology: 'Ir',
    distanceMpc: 8.47,
    distanceMethod: 'TF',
  });
});

test('ignores blank rows and rejects truncated or non-coordinate records explicitly', () => {
  assert.equal(parseNearbyGalaxyLine('   ', 2), null);
  assert.throws(() => parseNearbyGalaxyLine('NGC0001', 3), /line 3 is truncated/u);

  const invalidCoordinates = replaceFixedField(CATALOG_LINE, 20, 29, 'xx xx xxxx');

  assert.throws(
    () => parseNearbyGalaxyLine(invalidCoordinates, 4),
    /line 4 has invalid equatorial coordinates/u,
  );
});

test('parses a complete catalog and rejects duplicate source identifiers', () => {
  assert.equal(parseNearbyGalaxyCatalog(`${CATALOG_LINE}\n\n`).length, 1);
  assert.throws(
    () => parseNearbyGalaxyCatalog(`${CATALOG_LINE}\n${CATALOG_LINE}`),
    /duplicate catalog identifier UGC12894/u,
  );
});

test('normalizes zero-padded catalog identifiers for reliable legacy deduplication', () => {
  assert.equal(normalizeCatalogIdentifier('NGC0055'), 'NGC55');
  assert.equal(normalizeCatalogIdentifier('NGC 55'), 'NGC55');
  assert.equal(normalizeCatalogIdentifier('ESO 409-015'), 'ESO409015');
});

test('filters the Local Volume, removes editorial duplicates, and builds a bounded octree', () => {
  const records = [
    record('NGC0055', 2.13, 3.785_417, -39.220_278, 8),
    record('Too close', 1.49, 15, 0, 12),
    record('Too far', 11.01, 30, 0, 12),
    ...Array.from({ length: 70 }, (_, index) =>
      record(
        `Fixture ${String(index + 1).padStart(2, '0')}`,
        6 + (index % 5) * 0.1,
        40 + index,
        -20 + (index % 30),
        11 + index * 0.05,
      ),
    ),
  ];
  const hierarchy = buildNearbyGalaxyHierarchy(records, {
    baseUrl: '/data/nearby',
    excludedCatalogNames: ['NGC 55'],
  });
  const objects = hierarchy.datasets.flatMap(({ dataset }) => dataset.objects);
  const tileById = new Map(hierarchy.tiles.map((tile) => [tile.id, tile]));

  assert.equal(objects.length, 70);
  assert.equal(hierarchy.searchEntries.length, 70);
  assert.equal(hierarchy.overviewEntries.length, 70);
  assert.deepEqual(
    new Set(hierarchy.overviewEntries.map((entry) => entry.id)),
    new Set(objects.map((object) => object.id)),
  );
  assert.equal(new Set(objects.map((object) => object.id)).size, 70);
  assert.equal(new Set(hierarchy.tiles.flatMap((tile) => tile.objectIds)).size, 70);
  assert.ok(hierarchy.tiles.every((tile) => tile.objectIds.length <= 24));
  assert.ok(hierarchy.tiles.some((tile) => tile.childIds?.length));
  assert.ok(hierarchy.tiles.some((tile) => tile.level > 0));
  assert.ok(
    hierarchy.datasets.every(
      ({ url, tileId, dataset }) =>
        url.startsWith('/data/nearby/catalog-') &&
        dataset.objects.every((object) => tileById.get(tileId)?.objectIds.includes(object.id)),
    ),
  );
  assert.ok(
    hierarchy.tiles.every(
      (tile) =>
        tile.parentId === undefined ||
        tileById.get(tile.parentId)?.childIds?.includes(tile.id) === true,
    ),
  );
  assert.ok(
    objects.every(
      (object) =>
        object.scientificConfidence === 'observed' &&
        object.metadata.sourceUrl === 'https://cdsarc.cds.unistra.fr/viz-bin/cat/J/AJ/145/101',
    ),
  );
});

test('produces deterministic identifiers, coordinates, ranks, and visual classifications', () => {
  const records = [
    record('NGC0024', 9.9, 0, 0, 12, { morphologicalType: 5, axisRatio: 0.4 }),
    record('KKH 001', 3, 90, 0, 15, { morphologicalType: -3, dwarfMorphology: 'Sph' }),
    record('UGC 0002', 4, 180, 30, 13, { morphologicalType: 10, dwarfMorphology: 'Ir' }),
  ];
  const first = buildNearbyGalaxyHierarchy(records, { baseUrl: '/tiles' });
  const second = buildNearbyGalaxyHierarchy([...records].reverse(), { baseUrl: '/tiles' });
  const firstObjects = first.datasets.flatMap(({ dataset }) => dataset.objects);
  const objectById = new Map(firstObjects.map((object) => [object.id, object]));

  assert.deepEqual(first, second);
  assert.deepEqual(objectById.get('lv-ngc0024')?.positionProvider.position, [9.9, 0, 0]);
  assert.equal(objectById.get('lv-ngc0024')?.visual.galaxyShape, 'spiral');
  assert.equal(objectById.get('lv-kkh-001')?.visual.galaxyShape, 'elliptical');
  assert.equal(objectById.get('lv-ugc-0002')?.visual.galaxyShape, 'irregular');
  assert.ok(firstObjects.every((object) => object.metadata.nearbyUniversePointBatch === true));
  assert.deepEqual(
    firstObjects
      .slice()
      .sort(
        (left, right) =>
          left.metadata.nearbyUniverseLabelRank - right.metadata.nearbyUniverseLabelRank,
      )
      .map((object) => object.name),
    ['NGC 24', 'UGC 2', 'KKH 001'],
  );
});

test('ships a complete validated static Local Volume octree', async () => {
  const index = JSON.parse(
    await readFile(resolve('public/data/tiles/nearby-universe/index.json'), 'utf8'),
  );
  const generatedTiles = index.tiles.filter((tile) => tile.id.startsWith('catalog-'));
  const tileById = new Map(index.tiles.map((tile) => [tile.id, tile]));
  const generatedObjectIds = [];

  assert.equal(index.version, '2.0.0');
  assert.equal(index.tiles.length, 115);
  assert.equal(index.searchEntries.length, 720);
  assert.equal(index.overviewEntries.length, 720);
  assert.equal(new Set(index.overviewEntries.map((entry) => entry.id)).size, 720);
  assert.equal(generatedTiles.length, 110);

  for (const tile of generatedTiles) {
    const dataset = JSON.parse(await readFile(resolve(`public${tile.url}`), 'utf8'));

    assert.equal(dataset.version, '2.0.0');
    assert.deepEqual(
      dataset.objects.map((object) => object.id),
      tile.objectIds,
    );
    assert.ok(dataset.objects.length > 0 && dataset.objects.length <= 24);
    if (tile.parentId) {
      assert.ok(tileById.get(tile.parentId)?.childIds?.includes(tile.id));
    }

    for (const object of dataset.objects) {
      const position = object.positionProvider.position;
      const distance = Math.hypot(...position);

      generatedObjectIds.push(object.id);
      assert.equal(object.scientificConfidence, 'observed');
      assert.equal(object.metadata.sourceUrl, SOURCE_URL);
      assert.equal(object.metadata.nearbyUniversePointBatch, true);
      assert.ok(Math.abs(distance - object.metadata.distanceMpc) < 0.002);
      assert.ok(
        position.every(
          (coordinate, axis) =>
            coordinate >= tile.bounds.min[axis] && coordinate <= tile.bounds.max[axis],
        ),
      );
    }
  }

  const generatedSearchIds = index.searchEntries
    .filter((entry) => entry.id.startsWith('lv-'))
    .map((entry) => entry.id);

  assert.equal(generatedObjectIds.length, 698);
  assert.deepEqual(new Set(generatedObjectIds), new Set(generatedSearchIds));
});

function record(
  catalogName,
  distanceMpc,
  rightAscensionDegrees,
  declinationDegrees,
  apparentMagnitudeB,
  overrides = {},
) {
  return {
    catalogName,
    rightAscensionDegrees,
    declinationDegrees,
    angularDiameterArcmin: 2,
    axisRatio: 0.7,
    apparentMagnitudeB,
    morphologicalType: 5,
    dwarfMorphology: '',
    distanceMpc,
    distanceMethod: 'TRGB',
    ...overrides,
  };
}

function replaceFixedField(line, start, end, replacement) {
  return `${line.slice(0, start - 1)}${replacement.padEnd(end - start + 1)}${line.slice(end)}`;
}

const SOURCE_URL = 'https://cdsarc.cds.unistra.fr/viz-bin/cat/J/AJ/145/101';
