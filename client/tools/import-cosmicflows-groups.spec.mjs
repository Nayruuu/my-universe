import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import test from 'node:test';
import {
  COSMIC_GROUP_CATALOG_HEADER_BYTES,
  COSMIC_GROUP_CATALOG_RECORD_BYTES,
  COSMIC_GROUP_CATALOG_VERSION,
  buildCosmicflowsCatalog,
  encodeCosmicflowsCatalog,
  parseCosmicflowsGroupLine,
} from './import-cosmicflows-groups.mjs';

const FIRST_SOURCE_ROW =
  '     12 34.995 0.410  99.8  6532  6669  6179  6280  -1174  -468  -468  62.9  1.799   0.0360  -6.3739  90.1922 -65.9300 286.4249  11.3510   1848  -6271   1312';

test('decodes the documented Cosmicflows-4 fixed-width fields', () => {
  assert.deepEqual(parseCosmicflowsGroupLine(FIRST_SOURCE_ROW, 1), {
    pgcId: 12,
    distanceModulus: 34.995,
    distanceModulusError: 0.41,
    distanceMpc: 99.8,
    velocityCmbKmPerSecond: 6179,
    rightAscensionDegrees: 0.036,
    declinationDegrees: -6.3739,
  });
});

test('ignores blank rows and rejects malformed scientific records', () => {
  assert.equal(parseCosmicflowsGroupLine('   ', 2), null);
  assert.throws(
    () => parseCosmicflowsGroupLine('short row', 3),
    /Cosmicflows-4 row 3 is truncated/,
  );
  assert.throws(
    () => parseCosmicflowsGroupLine(replaceFixedField(FIRST_SOURCE_ROW, 22, 26, 'nope'), 4),
    /Cosmicflows-4 row 4 has invalid numeric fields/,
  );
});

test('filters the Local Volume, rejects duplicate PGC identifiers, and sorts by distance', () => {
  const nearby = replaceFixedField(FIRST_SOURCE_ROW, 22, 26, ' 10.9');
  const farther = replaceFixedField(
    replaceFixedField(FIRST_SOURCE_ROW, 1, 7, '     14'),
    22,
    26,
    '165.6',
  );
  const catalog = buildCosmicflowsCatalog([farther, nearby, FIRST_SOURCE_ROW]);

  assert.deepEqual(
    catalog.map((record) => record.pgcId),
    [12, 14],
  );
  assert.ok(Math.abs(Math.hypot(catalog[0].x, catalog[0].y, catalog[0].z) - 99.8) < 1e-10);
  assert.throws(
    () => buildCosmicflowsCatalog([FIRST_SOURCE_ROW, FIRST_SOURCE_ROW]),
    /Duplicate Cosmicflows-4 PGC identifier: 12/,
  );
});

test('encodes a deterministic, self-describing binary catalogue', () => {
  const records = buildCosmicflowsCatalog([FIRST_SOURCE_ROW]);
  const buffer = encodeCosmicflowsCatalog(records);

  assert.equal(
    buffer.byteLength,
    COSMIC_GROUP_CATALOG_HEADER_BYTES + COSMIC_GROUP_CATALOG_RECORD_BYTES,
  );
  assert.equal(buffer.toString('ascii', 0, 4), 'UMCG');
  assert.equal(buffer.readUInt16LE(4), COSMIC_GROUP_CATALOG_VERSION);
  assert.equal(buffer.readUInt16LE(6), COSMIC_GROUP_CATALOG_HEADER_BYTES);
  assert.equal(buffer.readUInt16LE(8), COSMIC_GROUP_CATALOG_RECORD_BYTES);
  assert.equal(buffer.readUInt32LE(12), 1);
  assert.equal(buffer.readDoubleLE(16), 2_451_545);
  assert.equal(buffer.readUInt32LE(COSMIC_GROUP_CATALOG_HEADER_BYTES + 24), 12);
});

test('ships the complete reproducible Cosmicflows-4 layer beyond 11 Mpc', async () => {
  const binary = await readFile(resolve('public/data/galaxies/cosmicflows4-groups.bin'));
  const metadata = JSON.parse(
    await readFile(resolve('public/data/galaxies/cosmicflows4-groups.json'), 'utf8'),
  );

  assert.equal(binary.toString('ascii', 0, 4), 'UMCG');
  assert.equal(binary.readUInt32LE(12), 37_730);
  assert.equal(metadata.sourceRecordCount, 38_053);
  assert.equal(metadata.catalogRecordCount, 37_730);
  assert.equal(metadata.minimumDistanceMpc, 11.1);
  assert.equal(metadata.maximumDistanceMpc, 772.7);
  assert.equal(metadata.scientificConfidence, 'calculated');
});

function replaceFixedField(line, start, end, replacement) {
  return `${line.slice(0, start - 1)}${replacement.padStart(end - start + 1)}${line.slice(end)}`;
}
