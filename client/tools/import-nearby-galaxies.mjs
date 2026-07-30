import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { dirname, relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { format, resolveConfig } from 'prettier';

const DEFAULT_INPUT = resolve('data-sources/updated-nearby-galaxies-table1.dat');
const DEFAULT_INDEX = resolve('public/data/tiles/nearby-universe/index.json');
const DEFAULT_OUTPUT_DIRECTORY = resolve('public/data/tiles/nearby-universe');
const DEFAULT_BASE_URL = '/data/tiles/nearby-universe/catalog';
const DATASET_VERSION = '2.0.0';
const MINIMUM_DISTANCE_MPC = 1.5;
const MAXIMUM_DISTANCE_MPC = 11;
const ROOT_EXTENT_MPC = 11;
const MAXIMUM_TILE_LEVEL = 6;
const MAXIMUM_LEAF_OBJECTS = 24;
const OVERVIEW_OBJECTS_PER_TILE = 4;
const GENERATED_TILE_PREFIX = 'catalog-';
const GENERATED_LABEL_RANK_OFFSET = 100;
const SOURCE_NAME = 'Karachentsev et al. 2013, AJ 145:101 · VizieR J/AJ/145/101';
const SOURCE_URL = 'https://cdsarc.cds.unistra.fr/viz-bin/cat/J/AJ/145/101';
const LEGACY_CATALOG_NAMES = [
  'NGC 55',
  'NGC 247',
  'NGC 253',
  'NGC 300',
  'NGC 2403',
  'NGC 3031',
  'NGC 3034',
  'NGC 3077',
  'NGC 4244',
  'NGC 4258',
  'NGC 4449',
  'NGC 4736',
  'NGC 4945',
  'NGC 5102',
  'NGC 5128',
  'NGC 5236',
  'NGC 5457',
  'MESSIER081',
  'MESSIER082',
  'MESSIER101',
];

if (process.argv[1] && resolve(process.argv[1]) === resolve(fileURLToPath(import.meta.url))) {
  await main();
}

export function parseNearbyGalaxyLine(line, lineNumber) {
  if (line.trim().length === 0) {
    return null;
  }
  if (line.length < 119) {
    throw invalidCatalog(`line ${lineNumber} is truncated`);
  }

  const catalogName = line.slice(0, 18).trim();
  const rightAscensionHours = requiredNumber(line.slice(19, 21));
  const rightAscensionMinutes = requiredNumber(line.slice(22, 24));
  const rightAscensionSeconds = requiredNumber(line.slice(25, 29));
  const declinationSign = line.slice(30, 31);
  const declinationDegrees = requiredNumber(line.slice(31, 33));
  const declinationMinutes = requiredNumber(line.slice(34, 36));
  const declinationSeconds = requiredNumber(line.slice(37, 39));

  if (
    catalogName.length === 0 ||
    [
      rightAscensionHours,
      rightAscensionMinutes,
      rightAscensionSeconds,
      declinationDegrees,
      declinationMinutes,
      declinationSeconds,
    ].some((value) => value === null) ||
    (declinationSign !== '+' && declinationSign !== '-')
  ) {
    throw invalidCatalog(`line ${lineNumber} has invalid equatorial coordinates`);
  }

  const rightAscension =
    15 * (rightAscensionHours + rightAscensionMinutes / 60 + rightAscensionSeconds / 3_600);
  const absoluteDeclination =
    declinationDegrees + declinationMinutes / 60 + declinationSeconds / 3_600;

  return {
    catalogName,
    rightAscensionDegrees: rightAscension,
    declinationDegrees: (declinationSign === '-' ? -1 : 1) * absoluteDeclination,
    angularDiameterArcmin: optionalNumber(line.slice(40, 46)),
    axisRatio: optionalNumber(line.slice(47, 51)),
    apparentMagnitudeB: optionalNumber(line.slice(65, 70)),
    morphologicalType: optionalNumber(line.slice(98, 100)),
    dwarfMorphology: line.slice(101, 106).trim(),
    distanceMpc: optionalNumber(line.slice(114, 119)),
    distanceMethod: line.slice(120, 124).trim(),
  };
}

export function parseNearbyGalaxyCatalog(source) {
  const records = [];
  const identifiers = new Set();

  for (const [index, line] of source.split(/\r?\n/u).entries()) {
    const record = parseNearbyGalaxyLine(line, index + 1);

    if (!record) {
      continue;
    }
    const identifier = normalizeCatalogIdentifier(record.catalogName);

    if (identifiers.has(identifier)) {
      throw invalidCatalog(`duplicate catalog identifier ${record.catalogName}`);
    }
    identifiers.add(identifier);
    records.push(record);
  }

  return records;
}

export function normalizeCatalogIdentifier(value) {
  const compact = value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/gu, '')
    .toUpperCase()
    .replace(/[^A-Z0-9]/gu, '');
  const zeroPadded = /^(NGC|UGC|IC|PGC)0+(\d+)$/u.exec(compact);

  return zeroPadded ? `${zeroPadded[1]}${Number(zeroPadded[2])}` : compact;
}

export function buildNearbyGalaxyHierarchy(records, options) {
  const baseUrl = options.baseUrl.replace(/\/$/u, '');
  const excludedIdentifiers = new Set(
    (options.excludedCatalogNames ?? []).map(normalizeCatalogIdentifier),
  );
  const selectedRecords = records
    .filter(
      (record) =>
        record.distanceMpc !== null &&
        record.distanceMpc >= MINIMUM_DISTANCE_MPC &&
        record.distanceMpc <= MAXIMUM_DISTANCE_MPC &&
        !excludedIdentifiers.has(normalizeCatalogIdentifier(record.catalogName)),
    )
    .sort(compareCatalogRecords);
  const identifiers = new Set();
  const entries = selectedRecords.map((record, index) => {
    const object = createGalaxyObject(record, GENERATED_LABEL_RANK_OFFSET + index);

    if (identifiers.has(object.id)) {
      throw new Error(`Generated nearby-galaxy identifier is duplicated: ${object.id}.`);
    }
    identifiers.add(object.id);

    return {
      record,
      object,
      searchEntry: createSearchEntry(object, record),
      position: object.positionProvider.position,
    };
  });
  const globalBounds = {
    min: [-ROOT_EXTENT_MPC, -ROOT_EXTENT_MPC, -ROOT_EXTENT_MPC],
    max: [ROOT_EXTENT_MPC, ROOT_EXTENT_MPC, ROOT_EXTENT_MPC],
  };
  const tiles = [];

  for (const group of groupByOctant(entries, globalBounds)) {
    tiles.push(
      ...buildTileBranch(group.entries, group.bounds, 0, `r-${group.key}`, undefined, baseUrl),
    );
  }

  const objectById = new Map(entries.map(({ object }) => [object.id, object]));
  const datasets = tiles.map((tile) => ({
    tileId: tile.id,
    url: tile.url,
    dataset: {
      version: DATASET_VERSION,
      objects: tile.objectIds.map((objectId) => objectById.get(objectId)),
    },
  }));

  return {
    tiles,
    searchEntries: entries.map(({ searchEntry }) => searchEntry),
    datasets,
  };
}

async function main() {
  const options = parseArguments(process.argv.slice(2));
  const records = parseNearbyGalaxyCatalog(await readFile(options.input, 'utf8'));
  const currentIndex = JSON.parse(await readFile(options.index, 'utf8'));
  const legacyTiles = currentIndex.tiles.filter(
    (tile) => !tile.id.startsWith(GENERATED_TILE_PREFIX),
  );
  const legacyObjectIds = new Set(legacyTiles.flatMap((tile) => tile.objectIds));
  const legacySearchEntries = currentIndex.searchEntries.filter((entry) =>
    legacyObjectIds.has(entry.id),
  );
  const hierarchy = buildNearbyGalaxyHierarchy(records, {
    baseUrl: options.baseUrl,
    excludedCatalogNames: LEGACY_CATALOG_NAMES,
  });
  const index = {
    version: DATASET_VERSION,
    tiles: [...legacyTiles, ...hierarchy.tiles],
    searchEntries: [...legacySearchEntries, ...hierarchy.searchEntries],
  };

  await Promise.all(
    hierarchy.datasets.map(async ({ tileId, dataset }) => {
      const output = resolve(options.outputDirectory, 'catalog', `${tileId}.json`);

      await mkdir(dirname(output), { recursive: true });
      await writeJson(output, dataset);
    }),
  );
  await writeJson(options.index, index);

  console.log(
    `Nearby-galaxy octree generated: ${hierarchy.searchEntries.length.toLocaleString('en-US')} catalog galaxies, ${hierarchy.tiles.length} adaptive tiles, ${legacySearchEntries.length} editorial galaxies preserved (${relative(process.cwd(), options.index)}).`,
  );
}

function buildTileBranch(entries, bounds, level, path, parentId, baseUrl) {
  const id = `${GENERATED_TILE_PREFIX}${path}`;
  const leaf = entries.length <= MAXIMUM_LEAF_OBJECTS || level >= MAXIMUM_TILE_LEVEL;
  const localEntries = leaf ? entries : entries.slice(0, OVERVIEW_OBJECTS_PER_TILE);
  const remainingEntries = leaf ? [] : entries.slice(OVERVIEW_OBJECTS_PER_TILE);
  const childGroups = remainingEntries.length > 0 ? groupByOctant(remainingEntries, bounds) : [];
  const childIds = childGroups.map((group) => `${GENERATED_TILE_PREFIX}${path}-${group.key}`);
  const tile = {
    id,
    level,
    ...(parentId ? { parentId } : {}),
    ...(childIds.length > 0 ? { childIds } : {}),
    referenceFrame: 'nearby-universe',
    url: `${baseUrl}/${id}.json`,
    bounds: {
      min: bounds.min,
      max: bounds.max,
      unit: 'megaparsec',
    },
    objectIds: localEntries.map(({ object }) => object.id),
  };
  const descendants = childGroups.flatMap((group) =>
    buildTileBranch(group.entries, group.bounds, level + 1, `${path}-${group.key}`, id, baseUrl),
  );

  return [tile, ...descendants];
}

function groupByOctant(entries, bounds) {
  const midpoint = bounds.min.map((minimum, axis) => (minimum + bounds.max[axis]) / 2);
  const groups = new Map();

  for (const entry of entries) {
    const bits = entry.position.map((coordinate, axis) => Number(coordinate >= midpoint[axis]));
    const key = bits.join('');
    const group = groups.get(key) ?? {
      key,
      bounds: octantBounds(bounds, midpoint, bits),
      entries: [],
    };

    group.entries.push(entry);
    groups.set(key, group);
  }

  return [...groups.values()].sort((left, right) => left.key.localeCompare(right.key));
}

function octantBounds(bounds, midpoint, bits) {
  return {
    min: bits.map((bit, axis) => (bit === 0 ? bounds.min[axis] : midpoint[axis])),
    max: bits.map((bit, axis) => (bit === 0 ? midpoint[axis] : bounds.max[axis])),
  };
}

function createGalaxyObject(record, labelRank) {
  const position = equatorialToCartesian(
    record.distanceMpc,
    record.rightAscensionDegrees,
    record.declinationDegrees,
  );
  const shape = galaxyShape(record);
  const displayName = catalogDisplayName(record.catalogName);
  const angularDiameterRadians =
    record.angularDiameterArcmin === null
      ? null
      : (record.angularDiameterArcmin * Math.PI) / (180 * 60);
  const diameterLy =
    angularDiameterRadians === null
      ? null
      : angularDiameterRadians * record.distanceMpc * 3_261_563.777;
  const metadata = {
    source: SOURCE_NAME,
    sourceUrl: SOURCE_URL,
    distanceMpc: record.distanceMpc,
    distanceLy: Math.round(record.distanceMpc * 3_261_563.777),
    rightAscensionDegrees: round(record.rightAscensionDegrees, 8),
    declinationDegrees: round(record.declinationDegrees, 8),
    ...(record.angularDiameterArcmin !== null
      ? { angularDiameterArcmin: record.angularDiameterArcmin }
      : {}),
    ...(diameterLy !== null ? { diameterLy: Math.round(diameterLy) } : {}),
    ...(record.apparentMagnitudeB !== null
      ? { apparentMagnitudeB: record.apparentMagnitudeB }
      : {}),
    ...(record.morphologicalType !== null ? { morphologicalType: record.morphologicalType } : {}),
    ...(record.dwarfMorphology.length > 0 ? { morphology: record.dwarfMorphology } : {}),
    ...(record.distanceMethod.length > 0 ? { distanceMethod: record.distanceMethod } : {}),
    nearbyUniverseLabelRank: labelRank,
    nearbyUniversePointBatch: true,
    keywords: [record.catalogName, displayName, record.dwarfMorphology, 'Local Volume']
      .filter(Boolean)
      .join(' '),
  };

  return {
    id: `lv-${slugify(record.catalogName)}`,
    name: displayName,
    aliases: displayName === record.catalogName ? [] : [record.catalogName],
    type: 'galaxy',
    parentId: 'nearby-universe',
    referenceFrame: 'nearby-universe',
    scientificConfidence: 'observed',
    description:
      'Galaxie du Volume local issue du catalogue astronomique de Karachentsev et al. Sa position 3D combine ses coordonnées équatoriales J2000 et sa distance cataloguée.',
    referenceEpoch: 2_451_545,
    visual: {
      color: galaxyColor(shape),
      secondaryColor: '#c7b28d',
      visualRadius: visualRadius(record),
      scaleMode: 'adaptive',
      galaxyShape: shape,
      galaxyAxisRatio: clamp(record.axisRatio ?? 0.72, 0.12, 1),
      galaxyRotationDegrees: deterministicRotation(record.catalogName),
    },
    positionProvider: {
      type: 'static',
      position,
      unit: 'megaparsec',
    },
    metadata,
  };
}

function createSearchEntry(object, record) {
  return {
    id: object.id,
    name: object.name,
    aliases: object.aliases,
    type: 'galaxy',
    parentName: 'Univers proche',
    keywords: [
      'galaxie',
      'galaxy',
      'Volume local',
      record.catalogName,
      ...(record.dwarfMorphology ? [record.dwarfMorphology] : []),
    ],
  };
}

function equatorialToCartesian(distanceMpc, rightAscensionDegrees, declinationDegrees) {
  const rightAscension = (rightAscensionDegrees * Math.PI) / 180;
  const declination = (declinationDegrees * Math.PI) / 180;
  const projectedDistance = distanceMpc * Math.cos(declination);

  return [
    cleanCoordinate(projectedDistance * Math.cos(rightAscension)),
    cleanCoordinate(distanceMpc * Math.sin(declination)),
    cleanCoordinate(projectedDistance * Math.sin(rightAscension)),
  ];
}

function compareCatalogRecords(left, right) {
  return (
    comparableMagnitude(left) - comparableMagnitude(right) ||
    (right.angularDiameterArcmin ?? 0) - (left.angularDiameterArcmin ?? 0) ||
    left.catalogName.localeCompare(right.catalogName, 'en')
  );
}

function comparableMagnitude(record) {
  return record.apparentMagnitudeB ?? Number.POSITIVE_INFINITY;
}

function galaxyShape(record) {
  if (/sph|ell/iu.test(record.dwarfMorphology) || (record.morphologicalType ?? 5) <= 0) {
    return 'elliptical';
  }
  if (/ir/iu.test(record.dwarfMorphology) || (record.morphologicalType ?? 5) >= 9) {
    return 'irregular';
  }

  return 'spiral';
}

function galaxyColor(shape) {
  switch (shape) {
    case 'spiral':
      return '#a8bed5';
    case 'elliptical':
      return '#d0bea1';
    case 'irregular':
      return '#9eb8c8';
  }
}

function visualRadius(record) {
  const brightness = 20 - (record.apparentMagnitudeB ?? 19);
  const diameter = Math.log2(1 + (record.angularDiameterArcmin ?? 0));

  return round(clamp(15 + brightness * 1.45 + diameter * 2.2, 14, 52), 2);
}

function catalogDisplayName(catalogName) {
  const normalized = normalizeCatalogIdentifier(catalogName);
  const numberedCatalog = /^(NGC|UGC|IC)(\d+)$/u.exec(normalized);

  return numberedCatalog ? `${numberedCatalog[1]} ${Number(numberedCatalog[2])}` : catalogName;
}

function slugify(value) {
  return value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/gu, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/gu, '-')
    .replace(/^-|-$/gu, '');
}

function deterministicRotation(value) {
  let hash = 2_166_136_261;

  for (const character of value) {
    hash ^= character.codePointAt(0);
    hash = Math.imul(hash, 16_777_619);
  }

  return (hash >>> 0) % 180;
}

function requiredNumber(value) {
  const parsed = Number(value.trim());

  return value.trim().length > 0 && Number.isFinite(parsed) ? parsed : null;
}

function optionalNumber(value) {
  const normalized = value.trim().replace(/^[<>]/u, '');
  const parsed = Number(normalized);

  return normalized.length > 0 && Number.isFinite(parsed) ? parsed : null;
}

function cleanCoordinate(value) {
  const rounded = round(value, 6);

  return Object.is(rounded, -0) ? 0 : rounded;
}

function round(value, precision) {
  const scale = 10 ** precision;

  return Math.round(value * scale) / scale;
}

function clamp(value, minimum, maximum) {
  return Math.min(maximum, Math.max(minimum, value));
}

function invalidCatalog(reason) {
  return new Error(`Updated Nearby Galaxy Catalog is invalid: ${reason}.`);
}

function parseArguments(args) {
  const options = {
    input: DEFAULT_INPUT,
    index: DEFAULT_INDEX,
    outputDirectory: DEFAULT_OUTPUT_DIRECTORY,
    baseUrl: DEFAULT_BASE_URL,
  };

  for (let index = 0; index < args.length; index += 2) {
    const flag = args[index];
    const value = args[index + 1];

    if (!value) {
      throw new Error(`Missing value for ${flag}.`);
    }
    switch (flag) {
      case '--input':
        options.input = resolve(value);
        break;
      case '--index':
        options.index = resolve(value);
        break;
      case '--output-directory':
        options.outputDirectory = resolve(value);
        break;
      case '--base-url':
        options.baseUrl = value;
        break;
      default:
        throw new Error(`Unknown option: ${flag}.`);
    }
  }

  return options;
}

async function writeJson(path, value) {
  const prettierConfig = (await resolveConfig(path)) ?? {};
  const contents = await format(`${JSON.stringify(value)}\n`, {
    ...prettierConfig,
    filepath: path,
  });

  await writeFile(path, contents);
}
