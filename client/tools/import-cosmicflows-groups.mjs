import { createHash } from 'node:crypto';
import { createReadStream } from 'node:fs';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { createGunzip } from 'node:zlib';
import { dirname, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { createInterface } from 'node:readline';

export const COSMIC_GROUP_CATALOG_VERSION = 1;
export const COSMIC_GROUP_CATALOG_HEADER_BYTES = 40;
export const COSMIC_GROUP_CATALOG_RECORD_BYTES = 32;

const DEFAULT_INPUT = resolve('data-sources/cosmicflows4-table4.dat.gz');
const DEFAULT_OUTPUT = resolve('public/data/galaxies/cosmicflows4-groups.bin');
const REFERENCE_EPOCH_JULIAN_DAY = 2_451_545;
const EQUATORIAL_CARTESIAN_FRAME = 1;
const LOCAL_VOLUME_LIMIT_MPC = 11;
const SOURCE_NAME = 'Cosmicflows-4 galaxy group distances';
const SOURCE_URL = 'https://cdsarc.cds.unistra.fr/viz-bin/cat/J/ApJ/944/94';

export function parseCosmicflowsGroupLine(line, lineNumber) {
  if (!line.trim()) {
    return null;
  }
  if (line.length < 100) {
    throw new Error(`Cosmicflows-4 row ${lineNumber} is truncated.`);
  }
  const record = {
    pgcId: parseIntegerField(line, 1, 7),
    distanceModulus: parseNumberField(line, 9, 14),
    distanceModulusError: parseNumberField(line, 16, 20),
    distanceMpc: parseNumberField(line, 22, 26),
    velocityCmbKmPerSecond: parseIntegerField(line, 40, 44),
    rightAscensionDegrees: parseNumberField(line, 84, 91),
    declinationDegrees: parseNumberField(line, 93, 100),
  };

  if (
    !Number.isInteger(record.pgcId) ||
    record.pgcId <= 0 ||
    !Number.isFinite(record.distanceModulus) ||
    !Number.isFinite(record.distanceModulusError) ||
    record.distanceModulusError < 0 ||
    !Number.isFinite(record.distanceMpc) ||
    record.distanceMpc <= 0 ||
    !Number.isInteger(record.velocityCmbKmPerSecond) ||
    !Number.isFinite(record.rightAscensionDegrees) ||
    record.rightAscensionDegrees < 0 ||
    record.rightAscensionDegrees >= 360 ||
    !Number.isFinite(record.declinationDegrees) ||
    record.declinationDegrees < -90 ||
    record.declinationDegrees > 90
  ) {
    throw new Error(`Cosmicflows-4 row ${lineNumber} has invalid numeric fields.`);
  }

  return record;
}

export function buildCosmicflowsCatalog(lines) {
  const records = [];
  const seenPgcIds = new Set();
  let lineNumber = 0;

  for (const line of lines) {
    lineNumber += 1;
    const parsed = parseCosmicflowsGroupLine(line, lineNumber);

    if (!parsed || parsed.distanceMpc <= LOCAL_VOLUME_LIMIT_MPC) {
      continue;
    }
    if (seenPgcIds.has(parsed.pgcId)) {
      throw new Error(`Duplicate Cosmicflows-4 PGC identifier: ${parsed.pgcId}.`);
    }
    seenPgcIds.add(parsed.pgcId);
    records.push({ ...parsed, ...equatorialToCartesian(parsed) });
  }
  records.sort(
    (left, right) =>
      left.distanceMpc - right.distanceMpc ||
      left.distanceModulusError - right.distanceModulusError ||
      left.pgcId - right.pgcId,
  );

  return records;
}

export function encodeCosmicflowsCatalog(records) {
  if (records.length === 0) {
    throw new Error('Cosmicflows-4 catalogue contains no records beyond the Local Volume.');
  }
  const buffer = Buffer.allocUnsafe(
    COSMIC_GROUP_CATALOG_HEADER_BYTES + records.length * COSMIC_GROUP_CATALOG_RECORD_BYTES,
  );
  const minimumDistanceMpc = records[0].distanceMpc;
  const maximumDistanceMpc = records.at(-1).distanceMpc;

  buffer.write('UMCG', 0, 'ascii');
  buffer.writeUInt16LE(COSMIC_GROUP_CATALOG_VERSION, 4);
  buffer.writeUInt16LE(COSMIC_GROUP_CATALOG_HEADER_BYTES, 6);
  buffer.writeUInt16LE(COSMIC_GROUP_CATALOG_RECORD_BYTES, 8);
  buffer.writeUInt16LE(0, 10);
  buffer.writeUInt32LE(records.length, 12);
  buffer.writeDoubleLE(REFERENCE_EPOCH_JULIAN_DAY, 16);
  buffer.writeUInt32LE(EQUATORIAL_CARTESIAN_FRAME, 24);
  buffer.writeFloatLE(minimumDistanceMpc, 28);
  buffer.writeFloatLE(maximumDistanceMpc, 32);
  buffer.writeUInt32LE(0, 36);

  for (let index = 0; index < records.length; index += 1) {
    const record = records[index];
    const offset = COSMIC_GROUP_CATALOG_HEADER_BYTES + index * COSMIC_GROUP_CATALOG_RECORD_BYTES;

    buffer.writeFloatLE(record.x, offset);
    buffer.writeFloatLE(record.y, offset + 4);
    buffer.writeFloatLE(record.z, offset + 8);
    buffer.writeFloatLE(record.distanceMpc, offset + 12);
    buffer.writeFloatLE(record.distanceModulusError, offset + 16);
    buffer.writeInt32LE(record.velocityCmbKmPerSecond, offset + 20);
    buffer.writeUInt32LE(record.pgcId, offset + 24);
    buffer.writeFloatLE(record.distanceModulus, offset + 28);
  }

  return buffer;
}

async function main() {
  const options = parseArguments(process.argv.slice(2));
  const lines = await readCompressedLines(options.input);
  const records = buildCosmicflowsCatalog(lines);
  const binary = encodeCosmicflowsCatalog(records);
  const sourceBuffer = await readFile(options.input);
  const metadata = {
    version: '1.0.0',
    source: SOURCE_NAME,
    sourceUrl: SOURCE_URL,
    sourceSha256: createHash('sha256').update(sourceBuffer).digest('hex'),
    sourceRecordCount: lines.filter((line) => line.trim()).length,
    catalogRecordCount: records.length,
    excludedLocalVolumeRecords: lines.filter((line, index) => {
      const record = parseCosmicflowsGroupLine(line, index + 1);

      return record !== null && record.distanceMpc <= LOCAL_VOLUME_LIMIT_MPC;
    }).length,
    minimumDistanceMpc: records[0].distanceMpc,
    maximumDistanceMpc: records.at(-1).distanceMpc,
    referenceEpochJulianDay: REFERENCE_EPOCH_JULIAN_DAY,
    referenceFrame: 'equatorial-j2000',
    scientificConfidence: 'calculated',
    representation: 'gpu-point-catalog',
  };

  await mkdir(dirname(options.output), { recursive: true });
  await writeFile(options.output, binary);
  await writeFile(metadataPath(options.output), `${JSON.stringify(metadata, null, 2)}\n`);
  console.log(
    `Cosmicflows-4 catalogue generated: ${records.length.toLocaleString('en-US')} groups beyond ${LOCAL_VOLUME_LIMIT_MPC} Mpc (${options.output}).`,
  );
}

function parseArguments(argumentList) {
  const options = { input: DEFAULT_INPUT, output: DEFAULT_OUTPUT };

  for (let index = 0; index < argumentList.length; index += 1) {
    const argument = argumentList[index];
    const value = argumentList[index + 1];

    if (argument === '--input' && value) {
      options.input = resolve(value);
      index += 1;
    } else if (argument === '--output' && value) {
      options.output = resolve(value);
      index += 1;
    } else {
      throw new Error(`Unknown or incomplete argument: ${argument}.`);
    }
  }

  return options;
}

async function readCompressedLines(path) {
  const lines = [];
  const input = createReadStream(path).pipe(createGunzip());
  const reader = createInterface({ input, crlfDelay: Number.POSITIVE_INFINITY });

  for await (const line of reader) {
    lines.push(line);
  }

  return lines;
}

function equatorialToCartesian(record) {
  const rightAscension = (record.rightAscensionDegrees * Math.PI) / 180;
  const declination = (record.declinationDegrees * Math.PI) / 180;
  const projectedDistance = record.distanceMpc * Math.cos(declination);

  return {
    x: projectedDistance * Math.cos(rightAscension),
    y: record.distanceMpc * Math.sin(declination),
    z: projectedDistance * Math.sin(rightAscension),
  };
}

function parseNumberField(line, start, end) {
  return Number.parseFloat(line.slice(start - 1, end).trim());
}

function parseIntegerField(line, start, end) {
  return Number.parseInt(line.slice(start - 1, end).trim(), 10);
}

function metadataPath(output) {
  return output.replace(/\.bin$/u, '.json');
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  await main();
}
