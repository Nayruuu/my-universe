import assert from 'node:assert/strict';
import test from 'node:test';
import {
  buildStarClusterTile,
  buildStarSpatialHierarchy,
  decodeSpatialCatalog,
} from './build-star-spatial-index.mjs';

test('aggregates stars by deterministic three-dimensional cells', () => {
  const tile = buildStarClusterTile(
    catalog([
      { x: 1, y: 2, z: 3, magnitude: 1, colorIndex: 0.2 },
      { x: 3, y: 4, z: 5, magnitude: 2, colorIndex: 0.8 },
      { x: 25, y: 2, z: 3, magnitude: 4, colorIndex: 1.1 },
    ]),
    {
      id: 'fixture-tile',
      sourceCatalog: 'fixture',
      lodLevel: 3,
      cellSizeParsec: 20,
    },
  );

  assert.equal(tile.id, 'fixture-tile');
  assert.equal(tile.clusterCount, 2);
  assert.deepEqual(tile.cellCoordinates, [0, 0, 0, 1, 0, 0]);
  assert.deepEqual(tile.positionsParsec, [2, 3, 4, 25, 2, 3]);
  assert.deepEqual(tile.starCounts, [2, 1]);
  assert.ok(Math.abs(tile.apparentMagnitudes[0] - 0.636_148_842_226_766) < 1e-12);
  assert.equal(tile.apparentMagnitudes[1], 4);
  assert.ok(Math.abs(tile.colorIndicesBv[0] - 0.370_848_349_370_480_9) < 1e-12);
  assert.equal(tile.colorIndicesBv[1], 1.1);
});

test('builds deterministic root and child cells while packing nearby requests', () => {
  const hierarchy = buildStarSpatialHierarchy(
    catalog([
      { x: -1, y: 0, z: 0, magnitude: 1, colorIndex: 0.4 },
      { x: 1, y: 0, z: 0, magnitude: 2, colorIndex: 0.5 },
      { x: 350, y: 0, z: 0, magnitude: 3, colorIndex: 0.6 },
      { x: 700, y: 0, z: 0, magnitude: 4, colorIndex: 0.7 },
    ]),
    { sourceCatalog: 'fixture', baseUrl: '/tiles' },
  );

  assert.equal(hierarchy.index.version, '2.0.0');
  assert.equal(hierarchy.index.sourceStarCount, 4);
  assert.deepEqual(hierarchy.index.rootIds, ['r-n1-p0-p0', 'r-p0-p0-p0', 'r-p1-p0-p0']);
  assert.equal(hierarchy.index.nodes.length, 7);
  assert.equal(
    hierarchy.index.nodes
      .filter((node) => node.parentId === undefined)
      .reduce((total, node) => total + node.sourceStarCount, 0),
    4,
  );

  const positiveRoots = hierarchy.index.nodes.filter(
    (node) => node.id === 'r-p0-p0-p0' || node.id === 'r-p1-p0-p0',
  );

  assert.equal(positiveRoots[0]?.url, positiveRoots[1]?.url);
  assert.equal(positiveRoots[0]?.url, '/tiles/lod4/pack-p0-p0-p0.json');
  assert.deepEqual(positiveRoots[0]?.boundsParsec, {
    min: [0, 0, 0],
    max: [640, 640, 640],
  });
  assert.deepEqual(positiveRoots[0]?.childIds, ['c-p0-p0-p0', 'c-p1-p0-p0']);

  const rootPack = hierarchy.packs.find((entry) => entry.url === '/tiles/lod4/pack-p0-p0-p0.json');
  const childPack = hierarchy.packs.find((entry) => entry.url === '/tiles/lod3/r-p0-p0-p0.json');

  assert.deepEqual(
    rootPack?.pack.tiles.map((tile) => tile.id),
    ['r-p0-p0-p0', 'r-p1-p0-p0'],
  );
  assert.deepEqual(
    childPack?.pack.tiles.map((tile) => tile.id),
    ['c-p0-p0-p0', 'c-p1-p0-p0'],
  );
  assert.equal(
    childPack?.pack.tiles.reduce((total, tile) => total + tile.sourceStarCount, 0),
    2,
  );
});

test('uses floor-based cells for negative coordinates and preserves local counts', () => {
  const tile = buildStarClusterTile(
    catalog([
      { x: -0.01, y: 0, z: 0, magnitude: 1, colorIndex: 0.4 },
      { x: 0.01, y: 0, z: 0, magnitude: 1, colorIndex: 0.4 },
    ]),
    {
      id: 'signed',
      sourceCatalog: 'fixture',
      lodLevel: 4,
      cellSizeParsec: 10,
    },
  );

  assert.equal(tile.clusterCount, 2);
  assert.deepEqual(tile.cellCoordinates, [-1, 0, 0, 0, 0, 0]);
  assert.equal(
    tile.starCounts.reduce((total, count) => total + count, 0),
    2,
  );
});

test('decodes the spatial fields from a valid Universe Map stellar catalog', () => {
  const buffer = createCatalogBuffer([
    { x: 1, y: 2, z: 3, magnitude: 4, colorIndex: 0.5 },
    { x: -5, y: 6, z: -7, magnitude: 2, colorIndex: 1.2 },
  ]);

  assert.deepEqual(decodeSpatialCatalog(buffer), {
    count: 2,
    referenceEpochJulianDay: 2_451_545,
    stars: [
      { x: 1, y: 2, z: 3, magnitude: 4, colorIndex: 0.5 },
      {
        x: -5,
        y: 6,
        z: -7,
        magnitude: 2,
        colorIndex: 1.200_000_047_683_715_8,
      },
    ],
  });
});

test('rejects truncated, unknown, incompatible, inconsistent, and non-finite catalogs', () => {
  assert.throws(() => decodeSpatialCatalog(Buffer.alloc(10)), /header is truncated/u);

  const unknown = createCatalogBuffer([{ x: 1, y: 2, z: 3, magnitude: 4, colorIndex: 0.5 }]);

  unknown.write('NOPE', 0, 'ascii');
  assert.throws(() => decodeSpatialCatalog(unknown), /signature is unknown/u);

  const incompatible = createCatalogBuffer([{ x: 1, y: 2, z: 3, magnitude: 4, colorIndex: 0.5 }]);

  incompatible.writeUInt16LE(99, 4);
  assert.throws(() => decodeSpatialCatalog(incompatible), /header is incompatible/u);

  const inconsistent = createCatalogBuffer([{ x: 1, y: 2, z: 3, magnitude: 4, colorIndex: 0.5 }]);

  inconsistent.writeUInt32LE(0, 12);
  assert.throws(() => decodeSpatialCatalog(inconsistent), /dimensions are inconsistent/u);

  const invalidRecord = createCatalogBuffer([{ x: 1, y: 2, z: 3, magnitude: 4, colorIndex: 0.5 }]);

  invalidRecord.writeFloatLE(Number.NaN, 40);
  assert.throws(() => decodeSpatialCatalog(invalidRecord), /record 0 is invalid/u);
});

function catalog(stars) {
  return { count: stars.length, referenceEpochJulianDay: 2_451_545, stars };
}

function createCatalogBuffer(stars) {
  const headerBytes = 40;
  const recordBytes = 36;
  const stringTableBytes = 1;
  const stringTableOffset = headerBytes + stars.length * recordBytes;
  const buffer = Buffer.alloc(stringTableOffset + stringTableBytes);

  buffer.write('UMSC', 0, 'ascii');
  buffer.writeUInt16LE(2, 4);
  buffer.writeUInt16LE(headerBytes, 6);
  buffer.writeUInt16LE(recordBytes, 8);
  buffer.writeUInt32LE(stars.length, 12);
  buffer.writeDoubleLE(2_451_545, 16);
  buffer.writeUInt32LE(1, 24);
  buffer.writeUInt32LE(stringTableOffset, 28);
  buffer.writeUInt32LE(stringTableBytes, 32);

  for (let index = 0; index < stars.length; index += 1) {
    const star = stars[index];
    const offset = headerBytes + index * recordBytes;

    buffer.writeFloatLE(star.x, offset);
    buffer.writeFloatLE(star.y, offset + 4);
    buffer.writeFloatLE(star.z, offset + 8);
    buffer.writeFloatLE(star.magnitude, offset + 12);
    buffer.writeFloatLE(star.colorIndex, offset + 16);
  }

  return buffer;
}
