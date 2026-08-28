import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import test from 'node:test';
import {
  aggregateGaiaCsvFiles,
  createStarSpatialAccumulator,
  decodeSpatialCatalog,
  gaiaIcrsToCartesianParsec,
  parseGaiaCsvRecord,
} from './build-star-spatial-index.mjs';

const SELECTION = {
  maximumDistanceParsec: 5_000,
  maximumApparentMagnitude: 12,
  minimumParallaxOverError: 10,
};

test('keeps the exact HYG binary decoder available to the scientific audit', () => {
  const bytes = Buffer.alloc(89);

  bytes.write('UMSC', 0, 'ascii');
  bytes.writeUInt16LE(3, 4);
  bytes.writeUInt16LE(40, 6);
  bytes.writeUInt16LE(48, 8);
  bytes.writeUInt32LE(1, 12);
  bytes.writeDoubleLE(2_451_545, 16);
  bytes.writeUInt32LE(1, 24);
  bytes.writeUInt32LE(88, 28);
  bytes.writeUInt32LE(1, 32);
  bytes.writeFloatLE(1, 40);
  bytes.writeFloatLE(2, 44);
  bytes.writeFloatLE(3, 48);
  bytes.writeFloatLE(4, 52);
  bytes.writeFloatLE(0.5, 56);

  assert.deepEqual(decodeSpatialCatalog(bytes), {
    count: 1,
    referenceEpochJulianDay: 2_451_545,
    stars: [{ x: 1, y: 2, z: 3, magnitude: 4, colorIndex: 0.5 }],
  });
  assert.throws(() => decodeSpatialCatalog(Buffer.alloc(39)), /header is truncated/u);
});

test('converts Gaia ICRS spherical coordinates to parsec Cartesian axes', () => {
  assert.deepEqual(gaiaIcrsToCartesianParsec(0, 0, 100), { x: 10, y: 0, z: 0 });
  assert.ok(Math.abs(gaiaIcrsToCartesianParsec(90, 0, 100).y - 10) < 1e-12);
  assert.ok(Math.abs(gaiaIcrsToCartesianParsec(0, 90, 100).z - 10) < 1e-12);

  assert.throws(() => gaiaIcrsToCartesianParsec(360, 0, 1), /Invalid Gaia ICRS/u);
  assert.throws(() => gaiaIcrsToCartesianParsec(0, -91, 1), /Invalid Gaia ICRS/u);
  assert.throws(() => gaiaIcrsToCartesianParsec(0, 0, 0), /Invalid Gaia ICRS/u);
});

test('matches the official Gaia DR3 Proxima Centauri astrometric record', () => {
  const position = gaiaIcrsToCartesianParsec(
    217.392_321_472_008_83,
    -62.676_075_116_766_66,
    768.066_539_187_357_3,
  );

  // Independently calculated with Astropy SkyCoord(ICRS) from Gaia DR3 source
  // 5853498713190525696, retrieved from the ESA Gaia Archive.
  assert.ok(Math.abs(position.x - -0.474_815_651_243) < 1e-9);
  assert.ok(Math.abs(position.y - -0.362_923_158_167) < 1e-9);
  assert.ok(Math.abs(position.z - -1.156_703_999_577) < 1e-9);
  assert.ok(Math.abs(Math.hypot(position.x, position.y, position.z) - 1.301_970_531_17) < 1e-9);
});

test('parses and bounds a selected Gaia CSV record', () => {
  const star = parseGaiaCsvRecord('1,0,0,100,20,4.5,0.8', 2, SELECTION);

  assert.deepEqual(star, {
    sourceId: '1',
    x: 10,
    y: 0,
    z: 0,
    magnitude: 4.5,
    colorIndex: 0.8,
  });
  assert.throws(
    () => parseGaiaCsvRecord('bad,0,0,100,20,4.5,0.8', 3, SELECTION),
    /Invalid Gaia CSV row 3/u,
  );
  assert.throws(
    () => parseGaiaCsvRecord('1,0,0,0.1,20,4.5,0.8', 4, SELECTION),
    /outside the declared selection/u,
  );
  assert.throws(
    () => parseGaiaCsvRecord('1,0,0,100,9,4.5,0.8', 5, SELECTION),
    /outside the declared selection/u,
  );
  assert.throws(
    () => parseGaiaCsvRecord('1,0,0,100,20,13,0.8', 6, SELECTION),
    /outside the declared selection/u,
  );
});

test('builds deterministic Gaia root aggregates and measured child samples', () => {
  const accumulator = createStarSpatialAccumulator({
    rootCellSizeParsec: 100,
    childCellSizeParsec: 50,
    rootClusterSizeParsec: 25,
    childClusterSizeParsec: 10,
    rootPackSizeParsec: 200,
    maximumSamplesPerLeaf: 4,
    brightestSamplesPerLeaf: 2,
  });

  accumulator.add({ sourceId: '1', x: -1, y: 0, z: 0, magnitude: 1, colorIndex: 0.4 });
  accumulator.add({ sourceId: '2', x: 1, y: 0, z: 0, magnitude: 2, colorIndex: 0.5 });
  accumulator.add({ sourceId: '3', x: 65, y: 0, z: 0, magnitude: 3, colorIndex: 0.6 });
  accumulator.add({ sourceId: '4', x: 110, y: 0, z: 0, magnitude: 4, colorIndex: 0.7 });
  const hierarchy = accumulator.build(metadata('/tiles', 4));

  assert.equal(hierarchy.index.version, '4.0.0');
  assert.equal(hierarchy.index.referenceFrame, 'icrs');
  assert.equal(hierarchy.index.magnitudeBand, 'gaia-g');
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

  assert.equal(positiveRoots[0]?.url, '/tiles/lod4/pack-p0-p0-p0.json');
  assert.equal(positiveRoots[0]?.url, positiveRoots[1]?.url);
  assert.deepEqual(positiveRoots[0]?.boundsParsec, {
    min: [0, 0, 0],
    max: [100, 100, 100],
  });
  assert.deepEqual(positiveRoots[0]?.childIds, ['c-p0-p0-p0', 'c-p1-p0-p0']);
  assert.equal(positiveRoots[0]?.representation, 'aggregate-cell');

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
  assert.ok(childPack?.pack.tiles.every((tile) => tile.representation === 'sampled-source'));
});

test('keeps the brightest Gaia sources and a stable uniform leaf sample independent of input order', () => {
  const layout = {
    rootCellSizeParsec: 100,
    childCellSizeParsec: 50,
    rootClusterSizeParsec: 25,
    childClusterSizeParsec: 10,
    rootPackSizeParsec: 200,
    maximumSamplesPerLeaf: 4,
    brightestSamplesPerLeaf: 2,
  };
  const stars = Array.from({ length: 12 }, (_, index) => ({
    sourceId: String(index + 1),
    x: 1 + index,
    y: 2,
    z: 3,
    magnitude: index,
    colorIndex: index / 10,
  }));
  const build = (values) => {
    const accumulator = createStarSpatialAccumulator(layout);

    for (const star of values) {
      accumulator.add(star);
    }

    return accumulator
      .build(metadata('/tiles', values.length))
      .packs.find((entry) => entry.url.includes('/lod3/')).pack.tiles[0];
  };
  const forward = build(stars);
  const reverse = build([...stars].reverse());

  assert.equal(forward.clusterCount, 4);
  assert.equal(forward.representation, 'sampled-source');
  assert.deepEqual(forward.positionsParsec, reverse.positionsParsec);
  assert.deepEqual(forward.apparentMagnitudes, reverse.apparentMagnitudes);
  assert.deepEqual(forward.colorIndices, reverse.colorIndices);
  assert.deepEqual(forward.apparentMagnitudes.slice(0, 2), [0, 1]);
  assert.equal(
    forward.starCounts.reduce((total, count) => total + count, 0),
    12,
  );
});

test('combines apparent flux and flux-weights Gaia BP-RP in each aggregate cell', () => {
  const accumulator = createStarSpatialAccumulator({
    rootCellSizeParsec: 100,
    childCellSizeParsec: 50,
    rootClusterSizeParsec: 25,
    childClusterSizeParsec: 10,
    rootPackSizeParsec: 200,
    maximumSamplesPerLeaf: 4,
    brightestSamplesPerLeaf: 2,
  });

  accumulator.add({ sourceId: '1', x: 1, y: 2, z: 3, magnitude: 1, colorIndex: 0.2 });
  accumulator.add({ sourceId: '2', x: 3, y: 4, z: 5, magnitude: 2, colorIndex: 0.8 });
  const hierarchy = accumulator.build(metadata('/tiles', 2));
  const tile = hierarchy.packs.find((entry) => entry.url.includes('/lod4/'))?.pack.tiles[0];

  assert.equal(tile.clusterCount, 1);
  assert.deepEqual(tile.positionsParsec, [2, 3, 4]);
  assert.deepEqual(tile.starCounts, [2]);
  assert.ok(Math.abs(tile.apparentMagnitudes[0] - 0.636_148_842_226_766) < 1e-12);
  assert.ok(Math.abs(tile.colorIndices[0] - 0.370_848_349_370_480_9) < 1e-12);
});

test('streams a Gaia CSV and verifies its record count and SHA-256', async () => {
  const directory = join(tmpdir(), `universe-map-gaia-${process.pid}-${Date.now()}`);
  const path = join(directory, 'fixture.csv');
  const csv = [
    'source_id,ra,dec,parallax,parallax_over_error,phot_g_mean_mag,bp_rp',
    '1,0,0,100,20,4.5,0.8',
    '2,90,0,50,30,6,1.1',
    '',
  ].join('\n');
  const inputSha256 = createHash('sha256').update(csv).digest('hex');

  await mkdir(directory, { recursive: true });
  await writeFile(path, csv);
  const sourcePart = {
    path,
    file: 'fixture.csv',
    sourceStarCount: 2,
    firstSourceId: '1',
    lastSourceId: '2',
    inputSha256,
    query: 'fixture',
  };
  const result = await aggregateGaiaCsvFiles([sourcePart], metadata('/tiles', 2, [sourcePart]));

  assert.equal(result.parts[0].inputSha256, inputSha256);
  assert.equal(result.hierarchy.index.sourceStarCount, 2);

  await assert.rejects(
    aggregateGaiaCsvFiles([sourcePart], metadata('/tiles', 3, [sourcePart])),
    /source count mismatch/u,
  );
  await assert.rejects(
    aggregateGaiaCsvFiles(
      [{ ...sourcePart, inputSha256: 'f'.repeat(64) }],
      metadata('/tiles', 2, [sourcePart]),
    ),
    /part SHA-256 mismatch/u,
  );
});

test('rejects invalid layouts, stars, and empty hierarchies', () => {
  assert.throws(
    () =>
      createStarSpatialAccumulator({
        rootCellSizeParsec: 100,
        childCellSizeParsec: 30,
        rootClusterSizeParsec: 25,
        childClusterSizeParsec: 10,
        rootPackSizeParsec: 200,
        maximumSamplesPerLeaf: 4,
        brightestSamplesPerLeaf: 2,
      }),
    /Invalid Gaia stellar tile layout/u,
  );
  const accumulator = createStarSpatialAccumulator();

  assert.throws(() => accumulator.add({ x: Number.NaN }), /Invalid Gaia star/u);
  assert.throws(() => accumulator.build(metadata('/tiles', 1)), /empty Gaia/u);
});

test('keeps every committed Gaia aggregate and measured sample pack consistent with its index', async () => {
  const index = JSON.parse(
    await readFile(resolve('public/data/stars/gaia-dr3-tiles/index.json'), 'utf8'),
  );
  const sourceMetadata = JSON.parse(
    await readFile(resolve('data-sources/gaia-dr3/gaia-dr3-g12-high-confidence.meta.json'), 'utf8'),
  );
  const nodesByUrl = new Map();

  for (const node of index.nodes) {
    const nodes = nodesByUrl.get(node.url) ?? [];

    nodes.push(node);
    nodesByUrl.set(node.url, nodes);
  }
  const totals = new Map([
    [3, { stars: 0, clusters: 0, tiles: 0 }],
    [4, { stars: 0, clusters: 0, tiles: 0 }],
  ]);

  assert.equal(index.sourceCatalog, sourceMetadata.sourceCatalog);
  assert.equal(index.sourceStarCount, sourceMetadata.expectedSourceStarCount);
  assert.equal(index.referenceEpochJulianDay, 2_457_388.5);
  assert.equal(index.referenceFrame, 'icrs');
  assert.equal(index.magnitudeBand, 'gaia-g');
  assert.equal(index.colorIndexSystem, 'gaia-bp-rp');
  assert.deepEqual(index.source, sourceMetadata.source);
  assert.deepEqual(index.selection, sourceMetadata.selection);
  assert.equal(index.rootIds.length, 127);
  assert.equal(index.nodes.length, 3_964);
  assert.equal(nodesByUrl.size, 135);

  for (const [url, nodes] of nodesByUrl) {
    const pack = JSON.parse(await readFile(resolve(`public${url}`), 'utf8'));
    const expectedIds = nodes.map((node) => node.id).sort();
    const actualIds = pack.tiles.map((tile) => tile.id).sort();

    assert.equal(pack.sourceCatalog, index.sourceCatalog);
    assert.equal(pack.referenceEpochJulianDay, index.referenceEpochJulianDay);
    assert.equal(pack.magnitudeBand, index.magnitudeBand);
    assert.equal(pack.colorIndexSystem, index.colorIndexSystem);
    assert.deepEqual(actualIds, expectedIds);

    for (const tile of pack.tiles) {
      const node = nodes.find((candidate) => candidate.id === tile.id);
      const total = totals.get(tile.lodLevel);

      assert.ok(node);
      assert.ok(total);
      assert.equal(tile.sourceStarCount, node.sourceStarCount);
      assert.equal(tile.clusterCount, node.clusterCount);
      assert.equal(tile.representation, node.representation);
      assert.equal(tile.representation, tile.lodLevel === 4 ? 'aggregate-cell' : 'sampled-source');
      assert.equal(tile.cellCoordinates.length, tile.clusterCount * 3);
      assert.equal(tile.positionsParsec.length, tile.clusterCount * 3);
      assert.equal(tile.starCounts.length, tile.clusterCount);
      assert.equal(tile.apparentMagnitudes.length, tile.clusterCount);
      assert.equal(tile.colorIndices.length, tile.clusterCount);
      assert.equal(
        tile.starCounts.reduce((sum, count) => sum + count, 0),
        tile.sourceStarCount,
      );
      total.stars += tile.sourceStarCount;
      total.clusters += tile.clusterCount;
      total.tiles += 1;
    }
  }

  assert.deepEqual(totals.get(4), { stars: 2_923_790, clusters: 3_837, tiles: 127 });
  assert.deepEqual(totals.get(3), { stars: 2_923_790, clusters: 133_526, tiles: 3_837 });
});

function metadata(baseUrl, expectedSourceStarCount, parts = []) {
  return {
    baseUrl,
    sourceCatalog: 'gaia-dr3-g12-high-confidence',
    source: {
      name: 'Gaia Data Release 3 · gaia_source_lite',
      url: 'https://gea.esac.esa.int/archive/',
      doi: '10.5270/esa-qa4lep3',
      credit: 'ESA/Gaia/DPAC',
      retrievedAt: '2026-08-28T00:00:00.000Z',
      query: 'fixture',
    },
    selection: SELECTION,
    expectedSourceStarCount,
    parts,
  };
}
