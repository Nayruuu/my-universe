import { createHash } from 'node:crypto';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { promisify } from 'node:util';
import { gunzip } from 'node:zlib';

export const TEMPEL_FILAMENT_SPINE_VERSION = 1;
export const TEMPEL_FILAMENT_SPINE_HEADER_BYTES = 64;
export const TEMPEL_FILAMENT_SPINE_INDEX_BYTES = 8;
export const TEMPEL_FILAMENT_SPINE_POINT_BYTES = 16;

const gunzipAsync = promisify(gunzip);
const HUBBLE_REDUCED_PARAMETER = 0.7;
const REFERENCE_EPOCH_JULIAN_DAY = 2_451_545;
const EQUATORIAL_CARTESIAN_FRAME = 1;
const MEGAPARSEC_UNIT = 1;
const METRIC_FLAGS = 0x7;
const SOURCE_INPUT = resolve('data-sources/sdss-dr8-filaments-table2.dat.gz');
const DEFAULT_OUTPUT = resolve('public/data/structures/tempel-filament-spines.bin');
const DEFAULT_METADATA_OUTPUT = resolve('public/data/structures/tempel-filament-spines.json');

export function parseTempelFilamentPointLine(line, lineNumber) {
  if (!line.trim()) {
    return null;
  }
  if (line.length < 117) {
    throw new Error(`Tempel filament-point row ${lineNumber} is truncated.`);
  }
  const record = {
    filamentId: integerField(line, 1, 5),
    pointId: integerField(line, 7, 12),
    filamentPointCount: integerField(line, 14, 16),
    filamentLengthMpcPerH: numberField(line, 18, 25),
    positionMpcPerH: [
      numberField(line, 27, 35),
      numberField(line, 37, 45),
      numberField(line, 47, 55),
    ],
    distanceMpcPerH: numberField(line, 57, 66),
    direction: [numberField(line, 68, 75), numberField(line, 77, 84), numberField(line, 86, 93)],
    visitMap: numberField(line, 95, 101),
    density: numberField(line, 103, 109),
    orientationStrength: numberField(line, 111, 117),
  };
  const positionNorm = Math.hypot(...record.positionMpcPerH);
  const directionNorm = Math.hypot(...record.direction);

  if (
    !positiveInteger(record.filamentId) ||
    record.filamentId > 65_535 ||
    !positiveInteger(record.pointId) ||
    !positiveInteger(record.filamentPointCount) ||
    record.filamentPointCount < 2 ||
    !positiveFinite(record.filamentLengthMpcPerH) ||
    !record.positionMpcPerH.every(Number.isFinite) ||
    !positiveFinite(record.distanceMpcPerH) ||
    Math.abs(positionNorm - record.distanceMpcPerH) > 0.02 ||
    !record.direction.every(Number.isFinite) ||
    Math.abs(directionNorm - 1) > 0.02 ||
    !unitInterval(record.visitMap) ||
    !unitInterval(record.density) ||
    !unitInterval(record.orientationStrength)
  ) {
    throw new Error(`Tempel filament-point row ${lineNumber} has invalid numeric fields.`);
  }

  return record;
}

export function buildTempelFilamentSpines(lines) {
  const filaments = [];
  const pointIds = new Set();
  let activeFilament = null;

  for (let index = 0; index < lines.length; index += 1) {
    const point = parseTempelFilamentPointLine(lines[index], index + 1);

    if (!point) {
      continue;
    }
    if (pointIds.has(point.pointId)) {
      throw new Error(`Duplicate Tempel point identifier: ${point.pointId}.`);
    }
    pointIds.add(point.pointId);
    if (!activeFilament || activeFilament.filamentId !== point.filamentId) {
      if (activeFilament) {
        if (point.filamentId <= activeFilament.filamentId) {
          throw new Error(`Invalid Tempel filament order at row ${index + 1}.`);
        }
        assertCompleteFilament(activeFilament);
      }
      activeFilament = {
        filamentId: point.filamentId,
        expectedPointCount: point.filamentPointCount,
        lengthMpc: point.filamentLengthMpcPerH / HUBBLE_REDUCED_PARAMETER,
        points: [],
      };
      filaments.push(activeFilament);
    }
    if (
      point.filamentPointCount !== activeFilament.expectedPointCount ||
      Math.abs(point.filamentLengthMpcPerH / HUBBLE_REDUCED_PARAMETER - activeFilament.lengthMpc) >
        0.000_01
    ) {
      throw new Error(`Inconsistent Tempel filament ${point.filamentId} metadata.`);
    }
    activeFilament.points.push({
      pointId: point.pointId,
      // Tempel stores declination on z; Universe Map stores it on y.
      positionMpc: [
        point.positionMpcPerH[0] / HUBBLE_REDUCED_PARAMETER,
        point.positionMpcPerH[2] / HUBBLE_REDUCED_PARAMETER,
        point.positionMpcPerH[1] / HUBBLE_REDUCED_PARAMETER,
      ],
      visitMap: point.visitMap,
      density: point.density,
      orientationStrength: point.orientationStrength,
    });
  }
  if (!activeFilament) {
    throw new Error('Tempel filament spine catalogue contains no points.');
  }
  assertCompleteFilament(activeFilament);
  const pointCount = filaments.reduce((total, filament) => total + filament.points.length, 0);

  return {
    filaments,
    filamentCount: filaments.length,
    pointCount,
    segmentCount: pointCount - filaments.length,
  };
}

export function encodeTempelFilamentSpines(catalog) {
  if (
    !Array.isArray(catalog.filaments) ||
    catalog.filamentCount <= 0 ||
    catalog.filamentCount !== catalog.filaments.length ||
    catalog.pointCount <= catalog.filamentCount ||
    catalog.segmentCount !== catalog.pointCount - catalog.filamentCount
  ) {
    throw new Error('Tempel filament spine catalogue dimensions are invalid.');
  }
  const byteLength =
    TEMPEL_FILAMENT_SPINE_HEADER_BYTES +
    catalog.filamentCount * TEMPEL_FILAMENT_SPINE_INDEX_BYTES +
    catalog.pointCount * TEMPEL_FILAMENT_SPINE_POINT_BYTES;
  const buffer = Buffer.alloc(byteLength);
  let minimumDistanceMpc = Number.POSITIVE_INFINITY;
  let maximumDistanceMpc = 0;

  for (const filament of catalog.filaments) {
    for (const point of filament.points) {
      const distanceMpc = Math.hypot(...point.positionMpc);

      minimumDistanceMpc = Math.min(minimumDistanceMpc, distanceMpc);
      maximumDistanceMpc = Math.max(maximumDistanceMpc, distanceMpc);
    }
  }

  buffer.write('UMFS', 0, 'ascii');
  buffer.writeUInt16LE(TEMPEL_FILAMENT_SPINE_VERSION, 4);
  buffer.writeUInt16LE(TEMPEL_FILAMENT_SPINE_HEADER_BYTES, 6);
  buffer.writeUInt16LE(TEMPEL_FILAMENT_SPINE_POINT_BYTES, 8);
  buffer.writeUInt16LE(TEMPEL_FILAMENT_SPINE_INDEX_BYTES, 10);
  buffer.writeUInt32LE(catalog.filamentCount, 12);
  buffer.writeUInt32LE(catalog.pointCount, 16);
  buffer.writeUInt32LE(catalog.segmentCount, 20);
  buffer.writeUInt16LE(EQUATORIAL_CARTESIAN_FRAME, 24);
  buffer.writeUInt16LE(MEGAPARSEC_UNIT, 26);
  buffer.writeDoubleLE(REFERENCE_EPOCH_JULIAN_DAY, 28);
  buffer.writeFloatLE(minimumDistanceMpc, 36);
  buffer.writeFloatLE(maximumDistanceMpc, 40);
  buffer.writeUInt32LE(METRIC_FLAGS, 44);

  const indexOffset = TEMPEL_FILAMENT_SPINE_HEADER_BYTES;
  const pointsOffset = indexOffset + catalog.filamentCount * TEMPEL_FILAMENT_SPINE_INDEX_BYTES;
  let pointOffset = 0;

  for (let filamentIndex = 0; filamentIndex < catalog.filaments.length; filamentIndex += 1) {
    const filament = catalog.filaments[filamentIndex];
    const entryOffset = indexOffset + filamentIndex * TEMPEL_FILAMENT_SPINE_INDEX_BYTES;

    assertEncodableFilament(filament, pointOffset);
    buffer.writeUInt16LE(filament.filamentId, entryOffset);
    buffer.writeUInt16LE(filament.points.length, entryOffset + 2);
    buffer.writeUInt32LE(pointOffset, entryOffset + 4);
    for (const point of filament.points) {
      const recordOffset = pointsOffset + pointOffset * TEMPEL_FILAMENT_SPINE_POINT_BYTES;

      buffer.writeFloatLE(point.positionMpc[0], recordOffset);
      buffer.writeFloatLE(point.positionMpc[1], recordOffset + 4);
      buffer.writeFloatLE(point.positionMpc[2], recordOffset + 8);
      buffer.writeUInt8(encodeMetric(point.visitMap), recordOffset + 12);
      buffer.writeUInt8(encodeMetric(point.density), recordOffset + 13);
      buffer.writeUInt8(encodeMetric(point.orientationStrength), recordOffset + 14);
      pointOffset += 1;
    }
  }

  return buffer;
}

async function main() {
  const compressed = await readFile(SOURCE_INPUT);
  const source = await gunzipAsync(compressed);
  const catalog = buildTempelFilamentSpines(source.toString('utf8').split(/\r?\n/));
  const binary = encodeTempelFilamentSpines(catalog);
  const metadata = {
    version: '1.0.0',
    filamentCount: catalog.filamentCount,
    pointCount: catalog.pointCount,
    segmentCount: catalog.segmentCount,
    referenceEpochJulianDay: REFERENCE_EPOCH_JULIAN_DAY,
    referenceFrame: 'equatorial-j2000',
    distanceUnit: 'megaparsec',
    sourceUnit: 'megaparsec-per-h',
    hubbleReducedParameter: HUBBLE_REDUCED_PARAMETER,
    scientificConfidence: 'calculated',
    source: 'Tempel et al. (2014), MNRAS 438, 3465 · table2',
    sourceUrl: 'https://cdsarc.cds.unistra.fr/viz-bin/cat/J/MNRAS/438/3465',
    sourceSha256: createHash('sha256').update(compressed).digest('hex'),
    pointSpacingMpcPerH: 0.5,
    metrics: ['visit-map', 'weighted-density', 'orientation-strength'],
    representation: 'published-filament-spine-points',
  };

  await mkdir(dirname(DEFAULT_OUTPUT), { recursive: true });
  await writeFile(DEFAULT_OUTPUT, binary);
  await writeFile(DEFAULT_METADATA_OUTPUT, `${JSON.stringify(metadata, null, 2)}\n`);
  console.log(
    `Tempel spines generated: ${catalog.filamentCount.toLocaleString('en-US')} filaments, ${catalog.pointCount.toLocaleString('en-US')} points, ${catalog.segmentCount.toLocaleString('en-US')} segments (${DEFAULT_OUTPUT}).`,
  );
}

function assertCompleteFilament(filament) {
  if (filament.points.length !== filament.expectedPointCount) {
    throw new Error(
      `Tempel filament ${filament.filamentId} expected ${filament.expectedPointCount} points but received ${filament.points.length}.`,
    );
  }
}

function assertEncodableFilament(filament, expectedOffset) {
  if (
    !positiveInteger(filament.filamentId) ||
    filament.filamentId > 65_535 ||
    filament.points.length < 2 ||
    !positiveFinite(filament.lengthMpc) ||
    !filament.points.every(
      (point) =>
        positiveInteger(point.pointId) &&
        point.positionMpc.every(Number.isFinite) &&
        positiveFinite(Math.hypot(...point.positionMpc)) &&
        unitInterval(point.visitMap) &&
        unitInterval(point.density) &&
        unitInterval(point.orientationStrength),
    ) ||
    !Number.isInteger(expectedOffset) ||
    expectedOffset < 0
  ) {
    throw new Error(`Tempel filament ${filament.filamentId} cannot be encoded.`);
  }
}

function encodeMetric(value) {
  return Math.round(value * 255);
}

function field(line, start, end) {
  return line.slice(start - 1, end).trim();
}

function numberField(line, start, end) {
  return Number(field(line, start, end));
}

function integerField(line, start, end) {
  return Number.parseInt(field(line, start, end), 10);
}

function positiveInteger(value) {
  return Number.isInteger(value) && value > 0;
}

function positiveFinite(value) {
  return Number.isFinite(value) && value > 0;
}

function unitInterval(value) {
  return Number.isFinite(value) && value >= 0 && value <= 1;
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  await main();
}
