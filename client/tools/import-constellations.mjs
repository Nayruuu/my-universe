import { readFile, writeFile } from 'node:fs/promises';
import { basename, resolve } from 'node:path';

const DEFAULT_INPUT = resolve('data-sources/stellarium-modern.source.json');
const DEFAULT_STAR_CATALOG = resolve('public/data/stars/hyg-v41.bin');
const DEFAULT_OUTPUT = resolve('public/data/stars/constellations-modern.json');
const STAR_CATALOG_HEADER_BYTES = 40;
const STAR_CATALOG_RECORD_BYTES = 36;
const SOURCE_NAME = 'Stellarium Modern sky culture';
const SOURCE_URL = 'https://github.com/Stellarium/stellarium/tree/master/skycultures/modern';
const SOURCE_LICENSE = 'CC BY-SA 4.0';

const options = parseArguments(process.argv.slice(2));
const [sourceBuffer, starCatalogBuffer] = await Promise.all([
  readFile(options.input),
  readFile(options.starCatalog),
]);
const source = JSON.parse(sourceBuffer.toString('utf8'));
const hygIdByHipId = decodeHipToHygMap(starCatalogBuffer);
const output = createCatalog(source, hygIdByHipId, options);

await writeFile(options.output, `${JSON.stringify(output, null, 2)}\n`);

const segmentCount = output.figures.reduce((total, figure) => total + figure.segments.length, 0);

console.log(
  `Constellations générées : ${output.figures.length} figures et ${segmentCount} segments dans ${options.output}`,
);

function parseArguments(argumentsList) {
  const options = {
    input: DEFAULT_INPUT,
    starCatalog: DEFAULT_STAR_CATALOG,
    output: DEFAULT_OUTPUT,
  };

  for (let index = 0; index < argumentsList.length; index += 1) {
    const argument = argumentsList[index];
    const value = argumentsList[index + 1];

    if (argument === '--input' && value) {
      options.input = resolve(value);
      index += 1;
    } else if (argument === '--star-catalog' && value) {
      options.starCatalog = resolve(value);
      index += 1;
    } else if (argument === '--output' && value) {
      options.output = resolve(value);
      index += 1;
    } else {
      throw new Error(`Argument inconnu ou incomplet : ${argument}.`);
    }
  }

  return options;
}

function decodeHipToHygMap(buffer) {
  assertStarCatalogHeader(buffer);
  const count = buffer.readUInt32LE(12);
  const stringTableOffset = buffer.readUInt32LE(28);
  const stringTableBytes = buffer.readUInt32LE(32);
  const stringTable = buffer.subarray(stringTableOffset, stringTableOffset + stringTableBytes);
  const hygIdByHipId = new Map();

  for (let index = 0; index < count; index += 1) {
    const recordOffset = STAR_CATALOG_HEADER_BYTES + index * STAR_CATALOG_RECORD_BYTES;
    const hygId = buffer.readUInt32LE(recordOffset + 20);
    const aliasesOffset = buffer.readUInt32LE(recordOffset + 28);
    const aliases = decodeNullTerminatedString(stringTable, aliasesOffset).split('\u001f');

    for (const alias of aliases) {
      const match = /^HIP (\d+)$/u.exec(alias);

      if (match) {
        hygIdByHipId.set(Number.parseInt(match[1], 10), hygId);
      }
    }
  }

  return hygIdByHipId;
}

function assertStarCatalogHeader(buffer) {
  if (
    buffer.length < STAR_CATALOG_HEADER_BYTES ||
    buffer.toString('ascii', 0, 4) !== 'UMSC' ||
    buffer.readUInt16LE(6) !== STAR_CATALOG_HEADER_BYTES ||
    buffer.readUInt16LE(8) !== STAR_CATALOG_RECORD_BYTES
  ) {
    throw new Error('Catalogue HYG binaire incompatible.');
  }
}

function decodeNullTerminatedString(table, offset) {
  const end = table.indexOf(0, offset);

  if (end < 0) {
    throw new Error(`Chaîne HYG non terminée à l’offset ${offset}.`);
  }

  return table.toString('utf8', offset, end);
}

function createCatalog(source, hygIdByHipId, options) {
  if (!source || !Array.isArray(source.constellations)) {
    throw new Error('Source Stellarium invalide : constellations absentes.');
  }
  const seenSegments = new Set();
  const figures = source.constellations
    .map((constellation) => createFigure(constellation, hygIdByHipId, seenSegments))
    .filter((figure) => figure.segments.length > 0);

  return {
    version: '1.0.0',
    source: {
      name: SOURCE_NAME,
      url: SOURCE_URL,
      license: SOURCE_LICENSE,
    },
    referenceFrame: 'equatorial-j2000',
    scientificConfidence: 'illustrative',
    starCatalog: 'HYG v4.1',
    figures,
    preparation: {
      input: basename(options.input),
      sourceFigureCount: source.constellations.length,
      mappedFigureCount: figures.length,
      method: 'Consecutive Stellarium HIP pairs mapped to bundled HYG identifiers',
    },
  };
}

function createFigure(constellation, hygIdByHipId, seenSegments) {
  const abbreviation = constellation.id.split(' ').at(-1);
  const name = constellation.common_name?.native ?? abbreviation;
  const segments = [];

  if (
    typeof abbreviation !== 'string' ||
    abbreviation.length !== 3 ||
    typeof name !== 'string' ||
    !Array.isArray(constellation.lines)
  ) {
    throw new Error(`Constellation Stellarium invalide : ${String(constellation.id)}.`);
  }

  for (const polyline of constellation.lines) {
    if (!Array.isArray(polyline)) {
      throw new Error(`Polyligne Stellarium invalide pour ${abbreviation}.`);
    }
    for (let index = 1; index < polyline.length; index += 1) {
      const fromId = mapHipId(polyline[index - 1], hygIdByHipId);
      const toId = mapHipId(polyline[index], hygIdByHipId);

      if (fromId === null || toId === null || fromId === toId) {
        continue;
      }
      const segmentId = [fromId, toId].sort((left, right) => left - right).join('–');

      if (!seenSegments.has(segmentId)) {
        seenSegments.add(segmentId);
        segments.push([fromId, toId]);
      }
    }
  }

  return {
    id: slugify(name),
    name,
    abbreviation,
    segments,
  };
}

function mapHipId(value, hygIdByHipId) {
  return typeof value === 'number' && Number.isInteger(value)
    ? (hygIdByHipId.get(value) ?? null)
    : null;
}

function slugify(value) {
  return value
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/gu, '-')
    .replace(/^-|-$/gu, '');
}
