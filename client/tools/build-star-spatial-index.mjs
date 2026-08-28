import { createHash } from 'node:crypto';
import { createReadStream } from 'node:fs';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { createInterface } from 'node:readline';
import { dirname, relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { format, resolveConfig } from 'prettier';

export const GAIA_DR3_REFERENCE_EPOCH_JULIAN_DAY = 2_457_388.5;
export const GAIA_TILE_LAYOUT = Object.freeze({
  rootCellSizeParsec: 2_048,
  childCellSizeParsec: 512,
  rootClusterSizeParsec: 512,
  childClusterSizeParsec: 128,
  rootPackSizeParsec: 8_192,
  maximumSamplesPerLeaf: 96,
  brightestSamplesPerLeaf: 32,
});

const DEFAULT_INPUT_DIRECTORY = resolve('data-sources/gaia-dr3');
const DEFAULT_METADATA = resolve('data-sources/gaia-dr3/gaia-dr3-g12-high-confidence.meta.json');
const DEFAULT_OUTPUT = resolve('public/data/stars/gaia-dr3-tiles/index.json');
const DEFAULT_BASE_URL = '/data/stars/gaia-dr3-tiles';
const TILE_VERSION = '4.0.0';
const HYG_CATALOG_HEADER_BYTES = 40;
const HYG_CATALOG_RECORD_BYTES = 48;
const HYG_CATALOG_VERSION = 3;
const EQUATORIAL_CARTESIAN_FRAME = 1;
const EXPECTED_COLUMNS = [
  'source_id',
  'ra',
  'dec',
  'parallax',
  'parallax_over_error',
  'phot_g_mean_mag',
  'bp_rp',
];

if (process.argv[1] && resolve(process.argv[1]) === resolve(fileURLToPath(import.meta.url))) {
  await main();
}

// Kept here because the permanent scientific audit reads the exact HYG binary
// catalogue even though this generator now builds the separate Gaia hierarchy.
export function decodeSpatialCatalog(buffer) {
  if (buffer.byteLength < HYG_CATALOG_HEADER_BYTES) {
    throw invalidHygCatalog('header is truncated');
  }
  if (buffer.toString('ascii', 0, 4) !== 'UMSC') {
    throw invalidHygCatalog('signature is unknown');
  }

  const version = buffer.readUInt16LE(4);
  const headerBytes = buffer.readUInt16LE(6);
  const recordBytes = buffer.readUInt16LE(8);
  const flags = buffer.readUInt16LE(10);
  const count = buffer.readUInt32LE(12);
  const referenceEpochJulianDay = buffer.readDoubleLE(16);
  const coordinateFrame = buffer.readUInt32LE(24);
  const stringTableOffset = buffer.readUInt32LE(28);
  const stringTableBytes = buffer.readUInt32LE(32);
  const reserved = buffer.readUInt32LE(36);
  const recordsEnd = HYG_CATALOG_HEADER_BYTES + count * HYG_CATALOG_RECORD_BYTES;

  if (
    version !== HYG_CATALOG_VERSION ||
    headerBytes !== HYG_CATALOG_HEADER_BYTES ||
    recordBytes !== HYG_CATALOG_RECORD_BYTES ||
    flags !== 0 ||
    reserved !== 0 ||
    coordinateFrame !== EQUATORIAL_CARTESIAN_FRAME
  ) {
    throw invalidHygCatalog('header is incompatible');
  }
  if (
    count === 0 ||
    !Number.isFinite(referenceEpochJulianDay) ||
    stringTableOffset !== recordsEnd ||
    stringTableBytes === 0 ||
    buffer.byteLength !== stringTableOffset + stringTableBytes
  ) {
    throw invalidHygCatalog('dimensions are inconsistent');
  }

  const stars = new Array(count);

  for (let index = 0; index < count; index += 1) {
    const offset = HYG_CATALOG_HEADER_BYTES + index * HYG_CATALOG_RECORD_BYTES;
    const star = {
      x: buffer.readFloatLE(offset),
      y: buffer.readFloatLE(offset + 4),
      z: buffer.readFloatLE(offset + 8),
      magnitude: buffer.readFloatLE(offset + 12),
      colorIndex: buffer.readFloatLE(offset + 16),
    };

    if (Object.values(star).some((value) => !Number.isFinite(value))) {
      throw invalidHygCatalog(`record ${index} is invalid`);
    }
    stars[index] = star;
  }

  return { count, referenceEpochJulianDay, stars };
}

export function gaiaIcrsToCartesianParsec(rightAscensionDegrees, declinationDegrees, parallaxMas) {
  if (
    !Number.isFinite(rightAscensionDegrees) ||
    rightAscensionDegrees < 0 ||
    rightAscensionDegrees >= 360 ||
    !Number.isFinite(declinationDegrees) ||
    declinationDegrees < -90 ||
    declinationDegrees > 90 ||
    !Number.isFinite(parallaxMas) ||
    parallaxMas <= 0
  ) {
    throw new Error('Invalid Gaia ICRS spherical coordinates.');
  }
  const rightAscensionRadians = degreesToRadians(rightAscensionDegrees);
  const declinationRadians = degreesToRadians(declinationDegrees);
  const distanceParsec = 1_000 / parallaxMas;
  const declinationRadius = distanceParsec * Math.cos(declinationRadians);

  return {
    x: declinationRadius * Math.cos(rightAscensionRadians),
    y: declinationRadius * Math.sin(rightAscensionRadians),
    z: distanceParsec * Math.sin(declinationRadians),
  };
}

export function parseGaiaCsvRecord(line, rowNumber, selection) {
  const values = parseCsvLine(line);

  if (values.length !== EXPECTED_COLUMNS.length || !/^\d+$/u.test(values[0])) {
    throw invalidGaiaRow(rowNumber);
  }
  const rightAscensionDegrees = parseFinite(values[1]);
  const declinationDegrees = parseFinite(values[2]);
  const parallaxMas = parseFinite(values[3]);
  const parallaxOverError = parseFinite(values[4]);
  const magnitude = parseFinite(values[5]);
  const colorIndex = parseFinite(values[6]);
  const minimumParallaxMas = 1_000 / selection.maximumDistanceParsec;

  if (
    parallaxMas < minimumParallaxMas ||
    parallaxOverError < selection.minimumParallaxOverError ||
    magnitude > selection.maximumApparentMagnitude
  ) {
    throw new Error(`Gaia row ${rowNumber} falls outside the declared selection.`);
  }
  const position = gaiaIcrsToCartesianParsec(
    rightAscensionDegrees,
    declinationDegrees,
    parallaxMas,
  );

  return { sourceId: values[0], ...position, magnitude, colorIndex };
}

export function createStarSpatialAccumulator(layout = GAIA_TILE_LAYOUT) {
  validateLayout(layout);
  const roots = new Map();
  let sourceStarCount = 0;

  return {
    add(star) {
      validateStar(star);
      addStarToHierarchy(roots, star, layout);
      sourceStarCount += 1;
    },
    build(options) {
      if (sourceStarCount === 0) {
        throw new Error('Cannot build an empty Gaia stellar hierarchy.');
      }

      return buildHierarchy(roots, sourceStarCount, layout, options);
    },
    get sourceStarCount() {
      return sourceStarCount;
    },
  };
}

export async function aggregateGaiaCsvFiles(inputs, metadata, layout = GAIA_TILE_LAYOUT) {
  const accumulator = createStarSpatialAccumulator(layout);
  const parts = [];
  let previousSourceId = null;

  for (const input of inputs) {
    const result = await aggregateGaiaCsvPart(input.path, metadata.selection, accumulator);

    validatePartResult(result, input);
    if (
      previousSourceId !== null &&
      compareSourceIds(result.firstSourceId, previousSourceId) <= 0
    ) {
      throw new Error(`Gaia source partitions overlap before ${result.firstSourceId}.`);
    }
    previousSourceId = result.lastSourceId;
    parts.push(result);
  }
  validateSourceCount(accumulator.sourceStarCount, metadata);

  return {
    parts,
    hierarchy: accumulator.build(metadata),
  };
}

async function main() {
  const paths = parseArguments(process.argv.slice(2));
  const metadata = parseMetadata(
    JSON.parse(await readFile(paths.metadata, 'utf8')),
    paths.metadata,
  );
  const inputs = metadata.parts.map((part) => ({
    ...part,
    path: resolve(paths.inputDirectory, part.file),
  }));
  const { hierarchy } = await aggregateGaiaCsvFiles(inputs, {
    ...metadata,
    baseUrl: paths.baseUrl,
  });

  await writeHierarchy(paths.output, paths.baseUrl, hierarchy);
  const rootCount = hierarchy.index.rootIds.length;
  const childCount = hierarchy.index.nodes.length - rootCount;

  console.log(
    `Gaia stellar hierarchy generated: ${hierarchy.index.sourceStarCount.toLocaleString('en-US')} stars, ${rootCount} roots, ${childCount} children, ${hierarchy.packs.length} packs (${relative(process.cwd(), paths.output)}).`,
  );
}

async function aggregateGaiaCsvPart(input, selection, accumulator) {
  const hash = createHash('sha256');
  const stream = createReadStream(input);

  stream.on('data', (chunk) => hash.update(chunk));
  const lines = createInterface({ input: stream, crlfDelay: Infinity });
  let rowNumber = 0;
  let sourceStarCount = 0;
  let firstSourceId = null;
  let lastSourceId = null;

  for await (const line of lines) {
    rowNumber += 1;
    if (rowNumber === 1) {
      assertGaiaHeader(line);
      continue;
    }
    if (line.length === 0) {
      continue;
    }
    const star = parseGaiaCsvRecord(line, rowNumber, selection);

    if (lastSourceId !== null && compareSourceIds(star.sourceId, lastSourceId) <= 0) {
      throw new Error(`Gaia source IDs are not strictly ordered at row ${rowNumber}.`);
    }
    firstSourceId ??= star.sourceId;
    lastSourceId = star.sourceId;
    sourceStarCount += 1;
    accumulator.add(star);
  }
  if (firstSourceId === null || lastSourceId === null) {
    throw new Error(`Gaia source partition is empty: ${input}.`);
  }

  return {
    firstSourceId,
    lastSourceId,
    sourceStarCount,
    inputSha256: hash.digest('hex'),
  };
}

function addStarToHierarchy(roots, star, layout) {
  const rootCoordinates = coordinatesFor(star, layout.rootCellSizeParsec);
  const rootKey = coordinateKey(rootCoordinates);
  const root = roots.get(rootKey) ?? {
    coordinates: rootCoordinates,
    count: 0,
    clusters: new Map(),
    children: new Map(),
  };
  const childCoordinates = coordinatesFor(star, layout.childCellSizeParsec);
  const childKey = coordinateKey(childCoordinates);
  const child = root.children.get(childKey) ?? {
    coordinates: childCoordinates,
    count: 0,
    samples: createLeafSampleAccumulator(),
  };

  root.count += 1;
  child.count += 1;
  addToCluster(root.clusters, coordinatesFor(star, layout.rootClusterSizeParsec), star);
  addToLeafSamples(child.samples, star, layout);
  root.children.set(childKey, child);
  roots.set(rootKey, root);
}

function createLeafSampleAccumulator() {
  return {
    overflow: false,
    all: [],
    brightest: [],
    uniform: [],
  };
}

function addToLeafSamples(samples, star, layout) {
  const sample = {
    sourceId: star.sourceId,
    x: star.x,
    y: star.y,
    z: star.z,
    magnitude: star.magnitude,
    colorIndex: star.colorIndex,
    uniformRank: stableSourceRank(star.sourceId),
  };

  if (!samples.overflow) {
    samples.all.push(sample);
    if (samples.all.length <= layout.maximumSamplesPerLeaf) {
      return;
    }
    samples.overflow = true;
    for (const candidate of samples.all) {
      addSampleCandidate(samples, candidate, layout);
    }
    samples.all = [];

    return;
  }
  addSampleCandidate(samples, sample, layout);
}

function addSampleCandidate(samples, sample, layout) {
  addBoundedSample(
    samples.brightest,
    sample,
    layout.brightestSamplesPerLeaf,
    compareSamplesByBrightness,
  );
  addBoundedSample(
    samples.uniform,
    sample,
    layout.maximumSamplesPerLeaf,
    compareSamplesByUniformRank,
  );
}

function addBoundedSample(samples, sample, limit, compare) {
  if (samples.length === limit && compare(sample, samples.at(-1)) >= 0) {
    return;
  }
  let minimum = 0;
  let maximum = samples.length;

  while (minimum < maximum) {
    const middle = Math.floor((minimum + maximum) / 2);

    if (compare(samples[middle], sample) <= 0) {
      minimum = middle + 1;
    } else {
      maximum = middle;
    }
  }
  samples.splice(minimum, 0, sample);
  if (samples.length > limit) {
    samples.pop();
  }
}

function compareSamplesByBrightness(left, right) {
  return left.magnitude - right.magnitude || compareSourceIds(left.sourceId, right.sourceId);
}

function compareSamplesByUniformRank(left, right) {
  return left.uniformRank - right.uniformRank || compareSourceIds(left.sourceId, right.sourceId);
}

function stableSourceRank(sourceId) {
  let hash = 2_166_136_261;

  for (let index = 0; index < sourceId.length; index += 1) {
    hash ^= sourceId.charCodeAt(index);
    hash = Math.imul(hash, 16_777_619);
  }

  return hash >>> 0;
}

function addToCluster(clusters, coordinates, star) {
  const key = coordinateKey(coordinates);
  const cluster = clusters.get(key) ?? {
    coordinates,
    count: 0,
    positionX: 0,
    positionY: 0,
    positionZ: 0,
    flux: 0,
    colorFlux: 0,
  };
  const flux = 10 ** (-0.4 * star.magnitude);

  cluster.count += 1;
  cluster.positionX += star.x;
  cluster.positionY += star.y;
  cluster.positionZ += star.z;
  cluster.flux += flux;
  cluster.colorFlux += star.colorIndex * flux;
  clusters.set(key, cluster);
}

function buildHierarchy(rootsByKey, sourceStarCount, layout, options) {
  const roots = [...rootsByKey.values()].sort(byCoordinates);
  const nodes = [];
  const rootIds = [];
  const packsByUrl = new Map();

  for (const root of roots) {
    const rootId = `r-${coordinateId(root.coordinates)}`;
    const children = [...root.children.values()].sort(byCoordinates);
    const childIds = children.map((child) => `c-${coordinateId(child.coordinates)}`);
    const rootUrl = rootPackUrl(root.coordinates, layout, options.baseUrl);
    const childUrl = `${options.baseUrl}/lod3/${rootId}.json`;
    const rootTile = createAggregateTile(
      rootId,
      undefined,
      4,
      root,
      layout.rootClusterSizeParsec,
      options,
    );

    rootIds.push(rootId);
    nodes.push(
      createNode(rootTile, root.coordinates, layout.rootCellSizeParsec, childIds, rootUrl),
    );
    addTileToPack(packsByUrl, rootUrl, rootTile, options);

    for (const child of children) {
      const childId = `c-${coordinateId(child.coordinates)}`;
      const tile = createSampleTile(
        childId,
        rootId,
        child,
        layout.childClusterSizeParsec,
        layout,
        options,
      );

      nodes.push(createNode(tile, child.coordinates, layout.childCellSizeParsec, [], childUrl));
      addTileToPack(packsByUrl, childUrl, tile, options);
    }
  }

  return createHierarchyResult(sourceStarCount, rootIds, nodes, packsByUrl, layout, options);
}

function createHierarchyResult(sourceStarCount, rootIds, nodes, packsByUrl, layout, options) {
  return {
    index: {
      version: TILE_VERSION,
      sourceCatalog: options.sourceCatalog,
      sourceStarCount,
      referenceEpochJulianDay: GAIA_DR3_REFERENCE_EPOCH_JULIAN_DAY,
      referenceFrame: 'icrs',
      distanceUnit: 'parsec',
      magnitudeBand: 'gaia-g',
      colorIndexSystem: 'gaia-bp-rp',
      source: options.source,
      selection: options.selection,
      sampling: {
        method: 'brightest-plus-deterministic-uniform',
        maximumSamplesPerLeaf: layout.maximumSamplesPerLeaf,
        brightestSamplesPerLeaf: layout.brightestSamplesPerLeaf,
      },
      scientificConfidence: 'calculated',
      representation: 'hierarchical-aggregation-with-deterministic-samples',
      rootIds,
      nodes,
    },
    packs: [...packsByUrl.entries()]
      .map(([url, pack]) => ({
        url,
        pack: {
          ...pack,
          tiles: [...pack.tiles].sort((left, right) => left.id.localeCompare(right.id)),
        },
      }))
      .sort((left, right) => left.url.localeCompare(right.url)),
  };
}

function createAggregateTile(id, parentId, lodLevel, group, cellSizeParsec, options) {
  const clusters = [...group.clusters.values()].map(finalizeCluster).sort(byCluster);

  return {
    id,
    ...(parentId ? { parentId } : {}),
    version: TILE_VERSION,
    sourceCatalog: options.sourceCatalog,
    sourceStarCount: group.count,
    referenceEpochJulianDay: GAIA_DR3_REFERENCE_EPOCH_JULIAN_DAY,
    magnitudeBand: 'gaia-g',
    colorIndexSystem: 'gaia-bp-rp',
    lodLevel,
    cellSizeParsec,
    representation: 'aggregate-cell',
    clusterCount: clusters.length,
    cellCoordinates: clusters.flatMap((cluster) => cluster.coordinates),
    positionsParsec: clusters.flatMap((cluster) => cluster.position),
    starCounts: clusters.map((cluster) => cluster.count),
    apparentMagnitudes: clusters.map((cluster) => cluster.magnitude),
    colorIndices: clusters.map((cluster) => cluster.colorIndex),
  };
}

function createSampleTile(id, parentId, group, cellSizeParsec, layout, options) {
  const samples = finalizeLeafSamples(group.samples, layout);
  const weights = representativeWeights(group.count, samples.length);

  return {
    id,
    parentId,
    version: TILE_VERSION,
    sourceCatalog: options.sourceCatalog,
    sourceStarCount: group.count,
    referenceEpochJulianDay: GAIA_DR3_REFERENCE_EPOCH_JULIAN_DAY,
    magnitudeBand: 'gaia-g',
    colorIndexSystem: 'gaia-bp-rp',
    lodLevel: 3,
    cellSizeParsec,
    representation: 'sampled-source',
    clusterCount: samples.length,
    cellCoordinates: samples.flatMap((sample) => coordinatesFor(sample, cellSizeParsec)),
    positionsParsec: samples.flatMap((sample) => [sample.x, sample.y, sample.z]),
    starCounts: weights,
    apparentMagnitudes: samples.map((sample) => sample.magnitude),
    colorIndices: samples.map((sample) => sample.colorIndex),
  };
}

function finalizeLeafSamples(samples, layout) {
  if (!samples.overflow) {
    return [...samples.all].sort(compareSamplesByBrightness);
  }
  const selected = [...samples.brightest];
  const selectedIds = new Set(selected.map((sample) => sample.sourceId));

  for (const sample of samples.uniform) {
    if (!selectedIds.has(sample.sourceId)) {
      selected.push(sample);
      selectedIds.add(sample.sourceId);
    }
    if (selected.length === layout.maximumSamplesPerLeaf) {
      break;
    }
  }

  return selected.sort(compareSamplesByBrightness);
}

function representativeWeights(sourceStarCount, sampleCount) {
  const minimumWeight = Math.floor(sourceStarCount / sampleCount);
  const remainder = sourceStarCount % sampleCount;

  return Array.from(
    { length: sampleCount },
    (_, index) => minimumWeight + (index < remainder ? 1 : 0),
  );
}

function finalizeCluster(cluster) {
  return {
    coordinates: cluster.coordinates,
    position: [
      cluster.positionX / cluster.count,
      cluster.positionY / cluster.count,
      cluster.positionZ / cluster.count,
    ],
    count: cluster.count,
    magnitude: -2.5 * Math.log10(cluster.flux),
    colorIndex: cluster.colorFlux / cluster.flux,
  };
}

function createNode(tile, coordinates, boundsSizeParsec, childIds, url) {
  return {
    id: tile.id,
    ...(tile.parentId ? { parentId: tile.parentId } : {}),
    childIds,
    lodLevel: tile.lodLevel,
    boundsParsec: {
      min: coordinates.map((coordinate) => coordinate * boundsSizeParsec),
      max: coordinates.map((coordinate) => (coordinate + 1) * boundsSizeParsec),
    },
    sourceStarCount: tile.sourceStarCount,
    clusterCount: tile.clusterCount,
    cellSizeParsec: tile.cellSizeParsec,
    representation: tile.representation,
    url,
  };
}

function addTileToPack(packsByUrl, url, tile, options) {
  const pack = packsByUrl.get(url) ?? {
    version: TILE_VERSION,
    sourceCatalog: options.sourceCatalog,
    referenceEpochJulianDay: GAIA_DR3_REFERENCE_EPOCH_JULIAN_DAY,
    magnitudeBand: 'gaia-g',
    colorIndexSystem: 'gaia-bp-rp',
    tiles: [],
  };

  pack.tiles.push(tile);
  packsByUrl.set(url, pack);
}

function rootPackUrl(coordinates, layout, baseUrl) {
  const packCoordinates = coordinates.map((coordinate) =>
    Math.floor((coordinate * layout.rootCellSizeParsec) / layout.rootPackSizeParsec),
  );

  return `${baseUrl}/lod4/pack-${coordinateId(packCoordinates)}.json`;
}

function coordinatesFor(star, sizeParsec) {
  return [
    Math.floor(star.x / sizeParsec),
    Math.floor(star.y / sizeParsec),
    Math.floor(star.z / sizeParsec),
  ];
}

function coordinateKey(coordinates) {
  return coordinates.join(',');
}

function coordinateId(coordinates) {
  return coordinates
    .map((coordinate) => `${coordinate < 0 ? 'n' : 'p'}${Math.abs(coordinate)}`)
    .join('-');
}

function byCoordinates(left, right) {
  return compareCoordinates(left.coordinates, right.coordinates);
}

function byCluster(left, right) {
  return (
    left.magnitude - right.magnitude || compareCoordinates(left.coordinates, right.coordinates)
  );
}

function compareCoordinates(left, right) {
  for (let index = 0; index < 3; index += 1) {
    const difference = left[index] - right[index];

    if (difference !== 0) {
      return difference;
    }
  }

  return 0;
}

function compareSourceIds(left, right) {
  return left.length - right.length || left.localeCompare(right);
}

function assertGaiaHeader(line) {
  const columns = parseCsvLine(line).map((column) => column.trim().toLowerCase());

  if (
    columns.length !== EXPECTED_COLUMNS.length ||
    columns.some((value, index) => value !== EXPECTED_COLUMNS[index])
  ) {
    throw new Error(`Invalid Gaia CSV header: expected ${EXPECTED_COLUMNS.join(',')}.`);
  }
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

function parseFinite(value) {
  const parsed = Number.parseFloat(value);

  if (!Number.isFinite(parsed)) {
    throw new Error('not finite');
  }

  return parsed;
}

function parseMetadata(value, source) {
  if (
    !isRecord(value) ||
    typeof value.sourceCatalog !== 'string' ||
    !isRecord(value.source) ||
    typeof value.source.name !== 'string' ||
    typeof value.source.url !== 'string' ||
    (value.source.doi !== null && typeof value.source.doi !== 'string') ||
    typeof value.source.credit !== 'string' ||
    typeof value.source.retrievedAt !== 'string' ||
    typeof value.source.query !== 'string' ||
    !isSelection(value.selection) ||
    !Number.isInteger(value.expectedSourceStarCount) ||
    value.expectedSourceStarCount <= 0 ||
    !Array.isArray(value.parts) ||
    value.parts.length === 0 ||
    value.parts.some((part) => !isSourcePart(part))
  ) {
    throw new Error(`Invalid Gaia source metadata: ${source}.`);
  }

  return value;
}

function isSourcePart(value) {
  return (
    isRecord(value) &&
    typeof value.file === 'string' &&
    value.file.length > 0 &&
    Number.isInteger(value.sourceStarCount) &&
    value.sourceStarCount > 0 &&
    typeof value.firstSourceId === 'string' &&
    /^\d+$/u.test(value.firstSourceId) &&
    typeof value.lastSourceId === 'string' &&
    /^\d+$/u.test(value.lastSourceId) &&
    typeof value.inputSha256 === 'string' &&
    /^[a-f\d]{64}$/u.test(value.inputSha256) &&
    typeof value.query === 'string' &&
    value.query.length > 0
  );
}

function isSelection(value) {
  return (
    isRecord(value) &&
    Number.isFinite(value.maximumDistanceParsec) &&
    value.maximumDistanceParsec > 0 &&
    Number.isFinite(value.maximumApparentMagnitude) &&
    Number.isFinite(value.minimumParallaxOverError) &&
    value.minimumParallaxOverError > 0
  );
}

function validateSourceCount(sourceStarCount, metadata) {
  if (sourceStarCount !== metadata.expectedSourceStarCount) {
    throw new Error(
      `Gaia source count mismatch: expected ${metadata.expectedSourceStarCount}, received ${sourceStarCount}.`,
    );
  }
}

function validatePartResult(result, expected) {
  if (result.sourceStarCount !== expected.sourceStarCount) {
    throw new Error(
      `Gaia source part count mismatch: expected ${expected.sourceStarCount}, received ${result.sourceStarCount}.`,
    );
  }
  if (result.inputSha256 !== expected.inputSha256) {
    throw new Error(`Gaia source part SHA-256 mismatch: ${result.inputSha256}.`);
  }
  if (
    result.firstSourceId !== expected.firstSourceId ||
    result.lastSourceId !== expected.lastSourceId
  ) {
    throw new Error(
      `Gaia source part boundaries mismatch: ${result.firstSourceId}–${result.lastSourceId}.`,
    );
  }
}

function validateLayout(layout) {
  const spatialValues = [
    layout.rootCellSizeParsec,
    layout.childCellSizeParsec,
    layout.rootClusterSizeParsec,
    layout.childClusterSizeParsec,
    layout.rootPackSizeParsec,
  ];

  if (
    spatialValues.some((value) => !Number.isFinite(value) || value <= 0) ||
    layout.rootCellSizeParsec % layout.childCellSizeParsec !== 0 ||
    layout.rootCellSizeParsec % layout.rootClusterSizeParsec !== 0 ||
    layout.childCellSizeParsec % layout.childClusterSizeParsec !== 0 ||
    layout.rootPackSizeParsec % layout.rootCellSizeParsec !== 0 ||
    !Number.isInteger(layout.maximumSamplesPerLeaf) ||
    layout.maximumSamplesPerLeaf <= 0 ||
    !Number.isInteger(layout.brightestSamplesPerLeaf) ||
    layout.brightestSamplesPerLeaf <= 0 ||
    layout.brightestSamplesPerLeaf > layout.maximumSamplesPerLeaf
  ) {
    throw new Error('Invalid Gaia stellar tile layout.');
  }
}

function validateStar(star) {
  if (
    !isRecord(star) ||
    typeof star.sourceId !== 'string' ||
    !/^\d+$/u.test(star.sourceId) ||
    [star.x, star.y, star.z, star.magnitude, star.colorIndex].some(
      (value) => !Number.isFinite(value),
    )
  ) {
    throw new Error('Invalid Gaia star for spatial aggregation.');
  }
}

function parseArguments(argumentsList) {
  const options = {
    inputDirectory: DEFAULT_INPUT_DIRECTORY,
    metadata: DEFAULT_METADATA,
    output: DEFAULT_OUTPUT,
    baseUrl: DEFAULT_BASE_URL,
  };

  for (let index = 0; index < argumentsList.length; index += 2) {
    const argument = argumentsList[index];
    const value = argumentsList[index + 1];

    if (!value) {
      throw new Error(`Missing value for ${argument}.`);
    }
    if (argument === '--input-directory') {
      options.inputDirectory = resolve(value);
    } else if (argument === '--metadata' || argument === '--output') {
      options[argument.slice(2)] = resolve(value);
    } else if (argument === '--base-url') {
      options.baseUrl = value.replace(/\/$/u, '');
    } else {
      throw new Error(`Unknown argument: ${argument}.`);
    }
  }

  return options;
}

async function writeHierarchy(output, baseUrl, hierarchy) {
  const outputDirectory = dirname(output);

  await mkdir(outputDirectory, { recursive: true });
  for (const { url, pack } of hierarchy.packs) {
    const prefix = `${baseUrl}/`;

    if (!url.startsWith(prefix)) {
      throw new Error(`Generated Gaia pack URL escapes its base path: ${url}.`);
    }
    const path = resolve(outputDirectory, url.slice(prefix.length));

    await mkdir(dirname(path), { recursive: true });
    await writeJson(path, pack);
  }
  await writeJson(output, hierarchy.index);
}

async function writeJson(path, value) {
  const configuration = (await resolveConfig(path)) ?? {};
  const contents = await format(JSON.stringify(value), { ...configuration, filepath: path });

  await writeFile(path, contents);
}

function invalidGaiaRow(rowNumber) {
  return new Error(`Invalid Gaia CSV row ${rowNumber}.`);
}

function invalidHygCatalog(reason) {
  return new Error(`Invalid stellar catalog for spatial indexing: ${reason}.`);
}

function degreesToRadians(value) {
  return (value * Math.PI) / 180;
}

function isRecord(value) {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}
