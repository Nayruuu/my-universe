import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import test from 'node:test';
import {
  TEMPEL_FILAMENT_SPINE_HEADER_BYTES,
  TEMPEL_FILAMENT_SPINE_INDEX_BYTES,
  TEMPEL_FILAMENT_SPINE_POINT_BYTES,
  TEMPEL_FILAMENT_SPINE_VERSION,
  buildTempelFilamentSpines,
  encodeTempelFilamentSpines,
  parseTempelFilamentPointLine,
} from './import-tempel-filament-spines.mjs';

const SOURCE_ROW =
  '    1      1  50 24.79233 -111.6694  270.9492 -155.9358  331.9631  -0.54672  0.43963 -0.71261 0.43438 0.09503 0.85503';

test('decodes every documented Tempel spine-point field', () => {
  assert.deepEqual(parseTempelFilamentPointLine(SOURCE_ROW, 1), {
    filamentId: 1,
    pointId: 1,
    filamentPointCount: 50,
    filamentLengthMpcPerH: 24.79233,
    positionMpcPerH: [-111.6694, 270.9492, -155.9358],
    distanceMpcPerH: 331.9631,
    direction: [-0.54672, 0.43963, -0.71261],
    visitMap: 0.43438,
    density: 0.09503,
    orientationStrength: 0.85503,
  });
});

test('groups complete filaments, converts Mpc/h, and preserves point order', () => {
  const catalog = buildTempelFilamentSpines([
    pointRow({ filamentId: 1, pointId: 1, pointCount: 2, x: 7, y: 14, z: 21 }),
    pointRow({ filamentId: 1, pointId: 2, pointCount: 2, x: 14, y: 21, z: 28 }),
    pointRow({ filamentId: 2, pointId: 3, pointCount: 2, x: -7, y: -14, z: 7 }),
    pointRow({ filamentId: 2, pointId: 4, pointCount: 2, x: -14, y: -21, z: 14 }),
  ]);

  assert.equal(catalog.filamentCount, 2);
  assert.equal(catalog.pointCount, 4);
  assert.equal(catalog.segmentCount, 2);
  assert.deepEqual(
    catalog.filaments.map(({ filamentId, points }) => [filamentId, points.length]),
    [
      [1, 2],
      [2, 2],
    ],
  );
  assert.deepEqual(
    catalog.filaments[0].points[0].positionMpc.map((value) => Math.round(value)),
    [10, 30, 20],
  );
  assert.deepEqual(
    catalog.filaments[0].points[1].positionMpc.map((value) => Math.round(value)),
    [20, 40, 30],
  );
});

test('encodes a deterministic self-describing spine catalogue', () => {
  const catalog = buildTempelFilamentSpines([
    pointRow({ filamentId: 1, pointId: 1, pointCount: 2, visitMap: 0, density: 0.5 }),
    pointRow({
      filamentId: 1,
      pointId: 2,
      pointCount: 2,
      orientationStrength: 1,
    }),
  ]);
  const encoded = encodeTempelFilamentSpines(catalog);
  const view = new DataView(encoded.buffer, encoded.byteOffset, encoded.byteLength);

  assert.equal(encoded.subarray(0, 4).toString('ascii'), 'UMFS');
  assert.equal(view.getUint16(4, true), TEMPEL_FILAMENT_SPINE_VERSION);
  assert.equal(view.getUint16(6, true), TEMPEL_FILAMENT_SPINE_HEADER_BYTES);
  assert.equal(view.getUint16(8, true), TEMPEL_FILAMENT_SPINE_POINT_BYTES);
  assert.equal(view.getUint16(10, true), TEMPEL_FILAMENT_SPINE_INDEX_BYTES);
  assert.equal(view.getUint32(12, true), 1);
  assert.equal(view.getUint32(16, true), 2);
  assert.equal(view.getUint32(20, true), 1);
  assert.equal(
    encoded.byteLength,
    TEMPEL_FILAMENT_SPINE_HEADER_BYTES +
      TEMPEL_FILAMENT_SPINE_INDEX_BYTES +
      2 * TEMPEL_FILAMENT_SPINE_POINT_BYTES,
  );
  assert.equal(view.getUint8(TEMPEL_FILAMENT_SPINE_HEADER_BYTES + 8 + 12), 0);
  assert.equal(view.getUint8(TEMPEL_FILAMENT_SPINE_HEADER_BYTES + 8 + 13), 128);
  assert.equal(view.getUint8(TEMPEL_FILAMENT_SPINE_HEADER_BYTES + 8 + 16 + 14), 255);
  assert.deepEqual(encoded, encodeTempelFilamentSpines(catalog));
});

test('rejects malformed rows and inconsistent filament groups', () => {
  assert.equal(parseTempelFilamentPointLine('   ', 2), null);
  assert.throws(() => parseTempelFilamentPointLine('short', 3), /truncated/);
  assert.throws(
    () => parseTempelFilamentPointLine(replaceField(SOURCE_ROW, 95, 101, '2'), 4),
    /invalid numeric fields/,
  );
  assert.throws(
    () =>
      buildTempelFilamentSpines([
        pointRow({ filamentId: 1, pointId: 1, pointCount: 3 }),
        pointRow({ filamentId: 1, pointId: 2, pointCount: 3 }),
      ]),
    /expected 3 points/,
  );
  assert.throws(
    () =>
      buildTempelFilamentSpines([
        pointRow({ filamentId: 2, pointId: 1, pointCount: 2 }),
        pointRow({ filamentId: 1, pointId: 2, pointCount: 2 }),
      ]),
    /filament order/,
  );
  assert.throws(
    () =>
      buildTempelFilamentSpines([
        pointRow({ filamentId: 1, pointId: 1, pointCount: 2 }),
        pointRow({ filamentId: 1, pointId: 1, pointCount: 2 }),
      ]),
    /point identifier/,
  );
  assert.throws(() => buildTempelFilamentSpines([]), /no points/);
  assert.throws(
    () => encodeTempelFilamentSpines({ filamentCount: 0, pointCount: 0, segmentCount: 0 }),
    /dimensions/,
  );
});

test('ships the complete published Tempel spine catalogue with reproducible provenance', async () => {
  const [binary, metadata] = await Promise.all([
    readFile(resolve('public/data/structures/tempel-filament-spines.bin')),
    readFile(resolve('public/data/structures/tempel-filament-spines.json'), 'utf8').then(
      JSON.parse,
    ),
  ]);
  const view = new DataView(binary.buffer, binary.byteOffset, binary.byteLength);

  assert.equal(view.getUint32(12, true), 15_421);
  assert.equal(view.getUint32(16, true), 275_599);
  assert.equal(view.getUint32(20, true), 260_178);
  assert.equal(binary.byteLength, 4_533_016);
  assert.equal(
    createHash('sha256').update(binary).digest('hex'),
    '423ecbacaf90d9e7515d9ace7b6b6db2b2cc55ad709d69f6f59168dce7339893',
  );
  assert.equal(metadata.filamentCount, 15_421);
  assert.equal(metadata.pointCount, 275_599);
  assert.equal(
    metadata.sourceSha256,
    '65808180bc2fd42bd46af92a484db7cde4a343892701699d8e6cb99b687d9e76',
  );
});

function pointRow({
  filamentId,
  pointId,
  pointCount,
  x = 7,
  y = 14,
  z = 21,
  visitMap = 0.4,
  density = 0.6,
  orientationStrength = 0.8,
}) {
  return [
    integerField(filamentId, 5),
    integerField(pointId, 6),
    integerField(pointCount, 3),
    floatField(0.5 * (pointCount - 1), 8, 5),
    floatField(x, 9, 4),
    floatField(y, 9, 4),
    floatField(z, 9, 4),
    floatField(Math.hypot(x, y, z), 10, 5),
    floatField(1, 8, 5),
    floatField(0, 8, 5),
    floatField(0, 8, 5),
    floatField(visitMap, 7, 5),
    floatField(density, 7, 5),
    floatField(orientationStrength, 7, 5),
  ].join(' ');
}

function integerField(value, width) {
  return String(value).padStart(width);
}

function floatField(value, width, precision) {
  return Number(value).toFixed(precision).padStart(width);
}

function replaceField(line, start, end, replacement) {
  return `${line.slice(0, start - 1)}${replacement.padStart(end - start + 1)}${line.slice(end)}`;
}
