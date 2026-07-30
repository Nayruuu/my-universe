import { createReadStream } from 'node:fs';
import { mkdir, writeFile } from 'node:fs/promises';
import { basename, dirname, resolve } from 'node:path';
import { createInterface } from 'node:readline';

const DEFAULT_INPUT = resolve('data-sources/hygdata_v41.csv');
const DEFAULT_OUTPUT = resolve('public/data/stars/hyg-v41.bin');
const DEFAULT_LIMIT = 10_000;
const HEADER_SIZE = 40;
const RECORD_SIZE = 36;
const FORMAT_VERSION = 2;
const REFERENCE_EPOCH_JULIAN_DAY = 2_451_545;
const EQUATORIAL_CARTESIAN_FRAME = 1;
const UNKNOWN_DISTANCE_PARSECS = 100_000;
const DEFAULT_COLOR_INDEX = 0.65;
const STRING_SEPARATOR = '\u001f';
const SOURCE_URL =
  'https://github.com/astronexus/HYG-Database/blob/main/hyg/CURRENT/hygdata_v41.csv';
const GREEK_SYMBOLS = new Map([
  ['Alp', 'α'],
  ['Bet', 'β'],
  ['Gam', 'γ'],
  ['Del', 'δ'],
  ['Eps', 'ε'],
  ['Zet', 'ζ'],
  ['Eta', 'η'],
  ['The', 'θ'],
  ['Iot', 'ι'],
  ['Kap', 'κ'],
  ['Lam', 'λ'],
  ['Mu', 'μ'],
  ['Nu', 'ν'],
  ['Xi', 'ξ'],
  ['Omi', 'ο'],
  ['Pi', 'π'],
  ['Rho', 'ρ'],
  ['Sig', 'σ'],
  ['Tau', 'τ'],
  ['Ups', 'υ'],
  ['Phi', 'φ'],
  ['Chi', 'χ'],
  ['Psi', 'ψ'],
  ['Ome', 'ω'],
]);

const options = parseArguments(process.argv.slice(2));
const stars = await readBrightestStars(options.input, options.limit);

await mkdir(dirname(options.output), { recursive: true });
await writeFile(options.output, encodeCatalog(stars));
await writeFile(
  metadataPath(options.output),
  `${JSON.stringify(createMetadata(options, stars), null, 2)}\n`,
);

console.log(
  `Catalogue HYG généré : ${stars.length.toLocaleString('fr-FR')} étoiles dans ${options.output}`,
);

function parseArguments(argumentsList) {
  const options = {
    input: DEFAULT_INPUT,
    output: DEFAULT_OUTPUT,
    limit: DEFAULT_LIMIT,
  };

  for (let index = 0; index < argumentsList.length; index += 1) {
    const argument = argumentsList[index];
    const value = argumentsList[index + 1];

    if (argument === '--input' && value) {
      options.input = resolve(value);
      index += 1;
    } else if (argument === '--output' && value) {
      options.output = resolve(value);
      index += 1;
    } else if (argument === '--limit' && value) {
      options.limit = Number.parseInt(value, 10);
      index += 1;
    } else {
      throw new Error(`Argument inconnu ou incomplet : ${argument}.`);
    }
  }

  if (!Number.isInteger(options.limit) || options.limit <= 0) {
    throw new Error('La limite doit être un entier strictement positif.');
  }

  return options;
}

async function readBrightestStars(input, limit) {
  const lines = createInterface({
    input: createReadStream(input, { encoding: 'utf8' }),
    crlfDelay: Number.POSITIVE_INFINITY,
  });
  const stars = [];
  let columns = null;

  for await (const line of lines) {
    const values = parseCsvLine(line);

    if (!columns) {
      columns = indexColumns(values);
      continue;
    }

    const star = parseStar(values, columns);

    if (star) {
      stars.push(star);
    }
  }

  stars.sort((left, right) => left.magnitude - right.magnitude || left.id - right.id);

  return stars.slice(0, limit);
}

function indexColumns(header) {
  const requiredNames = [
    'id',
    'hip',
    'hd',
    'hr',
    'gl',
    'bf',
    'proper',
    'dist',
    'mag',
    'spect',
    'ci',
    'x',
    'y',
    'z',
    'bayer',
    'flam',
    'con',
    'base',
  ];
  const columns = Object.fromEntries(
    requiredNames.map((name) => {
      const index = header.indexOf(name);

      if (index < 0) {
        throw new Error(`Colonne HYG manquante : ${name}.`);
      }

      return [name, index];
    }),
  );

  return columns;
}

function parseStar(values, columns) {
  const id = Number.parseInt(values[columns.id], 10);
  const properName = values[columns.proper];
  const distance = Number.parseFloat(values[columns.dist]);
  const magnitude = Number.parseFloat(values[columns.mag]);
  const x = Number.parseFloat(values[columns.x]);
  const y = Number.parseFloat(values[columns.y]);
  const z = Number.parseFloat(values[columns.z]);

  if (
    !Number.isInteger(id) ||
    id <= 0 ||
    properName === 'Sol' ||
    !Number.isFinite(distance) ||
    distance <= 0 ||
    distance >= UNKNOWN_DISTANCE_PARSECS ||
    !Number.isFinite(magnitude) ||
    !Number.isFinite(x) ||
    !Number.isFinite(y) ||
    !Number.isFinite(z)
  ) {
    return null;
  }

  const parsedColorIndex = Number.parseFloat(values[columns.ci]);

  return {
    id,
    x,
    y,
    z,
    magnitude,
    colorIndex: Number.isFinite(parsedColorIndex) ? parsedColorIndex : DEFAULT_COLOR_INDEX,
    name: createDisplayName(values, columns, id),
    aliases: createAliases(values, columns, id),
    spectralType: values[columns.spect].trim(),
  };
}

function createDisplayName(values, columns, id) {
  const properName = values[columns.proper].trim();
  const constellation = values[columns.con].trim();
  const bayerName = formatBayerName(values[columns.bayer], constellation);
  const flamsteedName = formatFlamsteedName(values[columns.flam], constellation);
  const baseName = values[columns.base].trim();
  const glieseName = values[columns.gl].trim();
  const hipIdentifier = formatCatalogIdentifier('HIP', values[columns.hip]);
  const hdIdentifier = formatCatalogIdentifier('HD', values[columns.hd]);

  return (
    properName ||
    bayerName ||
    flamsteedName ||
    baseName ||
    glieseName ||
    hipIdentifier ||
    hdIdentifier ||
    `HYG ${id}`
  );
}

function createAliases(values, columns, id) {
  const constellation = values[columns.con].trim();
  const aliases = [
    values[columns.proper].trim(),
    formatBayerName(values[columns.bayer], constellation),
    formatFlamsteedName(values[columns.flam], constellation),
    values[columns.base].trim(),
    values[columns.gl].trim(),
    values[columns.bf].trim(),
    formatCatalogIdentifier('HIP', values[columns.hip]),
    formatCatalogIdentifier('HD', values[columns.hd]),
    formatCatalogIdentifier('HR', values[columns.hr]),
    `HYG ${id}`,
  ];
  const displayName = createDisplayName(values, columns, id);

  return [...new Set(aliases.filter((alias) => alias && alias !== displayName))];
}

function formatBayerName(value, constellation) {
  const bayer = value.trim();

  if (!bayer || !constellation) {
    return '';
  }
  const match = /^([A-Za-z]{3})(.*)$/u.exec(bayer);
  const symbol = match ? GREEK_SYMBOLS.get(match[1]) : undefined;

  return `${symbol ?? bayer}${symbol ? (match?.[2] ?? '') : ''} ${constellation}`;
}

function formatFlamsteedName(value, constellation) {
  const flamsteed = value.trim();

  return flamsteed && constellation ? `${flamsteed} ${constellation}` : '';
}

function formatCatalogIdentifier(prefix, value) {
  const identifier = value.trim();

  return identifier ? `${prefix} ${identifier}` : '';
}

function parseCsvLine(line) {
  const values = [];
  let value = '';
  let quoted = false;

  for (let index = 0; index < line.length; index += 1) {
    const character = line[index];

    if (character === '"') {
      if (quoted && line[index + 1] === '"') {
        value += '"';
        index += 1;
      } else {
        quoted = !quoted;
      }
    } else if (character === ',' && !quoted) {
      values.push(value);
      value = '';
    } else {
      value += character;
    }
  }

  values.push(value);

  return values;
}

function encodeCatalog(stars) {
  const strings = createStringTable(stars);
  const stringTableOffset = HEADER_SIZE + stars.length * RECORD_SIZE;
  const buffer = Buffer.allocUnsafe(stringTableOffset + strings.buffer.length);

  buffer.write('UMSC', 0, 'ascii');
  buffer.writeUInt16LE(FORMAT_VERSION, 4);
  buffer.writeUInt16LE(HEADER_SIZE, 6);
  buffer.writeUInt16LE(RECORD_SIZE, 8);
  buffer.writeUInt16LE(0, 10);
  buffer.writeUInt32LE(stars.length, 12);
  buffer.writeDoubleLE(REFERENCE_EPOCH_JULIAN_DAY, 16);
  buffer.writeUInt32LE(EQUATORIAL_CARTESIAN_FRAME, 24);
  buffer.writeUInt32LE(stringTableOffset, 28);
  buffer.writeUInt32LE(strings.buffer.length, 32);
  buffer.writeUInt32LE(0, 36);

  for (let index = 0; index < stars.length; index += 1) {
    const star = stars[index];
    const offset = HEADER_SIZE + index * RECORD_SIZE;

    buffer.writeFloatLE(star.x, offset);
    buffer.writeFloatLE(star.y, offset + 4);
    buffer.writeFloatLE(star.z, offset + 8);
    buffer.writeFloatLE(star.magnitude, offset + 12);
    buffer.writeFloatLE(star.colorIndex, offset + 16);
    buffer.writeUInt32LE(star.id, offset + 20);
    buffer.writeUInt32LE(strings.records[index].nameOffset, offset + 24);
    buffer.writeUInt32LE(strings.records[index].aliasesOffset, offset + 28);
    buffer.writeUInt32LE(strings.records[index].spectralTypeOffset, offset + 32);
  }
  strings.buffer.copy(buffer, stringTableOffset);

  return buffer;
}

function createStringTable(stars) {
  const chunks = [Buffer.from([0])];
  const offsets = new Map([['', 0]]);
  const records = [];
  let byteLength = 1;

  const intern = (value) => {
    const existing = offsets.get(value);

    if (existing !== undefined) {
      return existing;
    }
    const encoded = Buffer.from(value, 'utf8');
    const offset = byteLength;

    chunks.push(encoded, Buffer.from([0]));
    offsets.set(value, offset);
    byteLength += encoded.length + 1;

    return offset;
  };

  for (const star of stars) {
    records.push({
      nameOffset: intern(star.name),
      aliasesOffset: intern(star.aliases.join(STRING_SEPARATOR)),
      spectralTypeOffset: intern(star.spectralType),
    });
  }

  return {
    buffer: Buffer.concat(chunks, byteLength),
    records,
  };
}

function metadataPath(output) {
  return output.replace(/\.bin$/u, '.meta.json');
}

function createMetadata(options, stars) {
  const dimmestMagnitude = stars.at(-1)?.magnitude ?? null;

  return {
    id: 'hyg-v41-bright-stars',
    source: {
      name: 'HYG Database v4.1',
      url: SOURCE_URL,
      license: 'CC BY-SA 4.0',
    },
    input: basename(options.input),
    format: {
      magic: 'UMSC',
      version: FORMAT_VERSION,
      byteOrder: 'little-endian',
      headerBytes: HEADER_SIZE,
      recordBytes: RECORD_SIZE,
      fields: [
        'xParsec:float32',
        'yParsec:float32',
        'zParsec:float32',
        'apparentMagnitude:float32',
        'colorIndexBv:float32',
        'hygId:uint32',
        'nameOffset:uint32',
        'aliasesOffset:uint32',
        'spectralTypeOffset:uint32',
      ],
      stringEncoding: 'UTF-8 null-terminated',
      aliasSeparator: 'U+001F',
    },
    referenceEpochJulianDay: REFERENCE_EPOCH_JULIAN_DAY,
    referenceFrame: 'J2000 equatorial Cartesian',
    distanceUnit: 'parsec',
    scientificConfidence: 'observed',
    selection: {
      method: 'brightest-valid-apparent-magnitude',
      requestedCount: options.limit,
      emittedCount: stars.length,
      dimmestMagnitude,
      excludesUnknownDistanceAtParsecs: UNKNOWN_DISTANCE_PARSECS,
    },
  };
}
