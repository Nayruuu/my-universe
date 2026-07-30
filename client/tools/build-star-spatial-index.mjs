import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { dirname, relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { format, resolveConfig } from 'prettier';

const DEFAULT_INPUT = resolve('public/data/stars/hyg-v41.bin');
const DEFAULT_OUTPUT = resolve('public/data/stars/tiles/index.json');
const DEFAULT_BASE_URL = '/data/stars/tiles';
const DEFAULT_SOURCE_CATALOG = 'hyg-v41-bright-stars';
const CATALOG_HEADER_BYTES = 40;
const CATALOG_RECORD_BYTES = 36;
const CATALOG_VERSION = 2;
const EQUATORIAL_CARTESIAN_FRAME = 1;
const TILE_VERSION = '2.0.0';
const ROOT_CELL_SIZE_PARSEC = 640;
const CHILD_CELL_SIZE_PARSEC = 320;
const ROOT_CLUSTER_SIZE_PARSEC = 160;
const CHILD_CLUSTER_SIZE_PARSEC = 40;
const ROOT_PACK_SIZE_PARSEC = 1_280;

if (process.argv[1] && resolve(process.argv[1]) === resolve(fileURLToPath(import.meta.url))) {
  await main();
}

export function decodeSpatialCatalog(buffer) {
  if (buffer.byteLength < CATALOG_HEADER_BYTES) {
    throw invalidCatalog('header is truncated');
  }
  if (buffer.toString('ascii', 0, 4) !== 'UMSC') {
    throw invalidCatalog('signature is unknown');
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
  const recordsEnd = CATALOG_HEADER_BYTES + count * CATALOG_RECORD_BYTES;

  if (
    version !== CATALOG_VERSION ||
    headerBytes !== CATALOG_HEADER_BYTES ||
    recordBytes !== CATALOG_RECORD_BYTES ||
    flags !== 0 ||
    reserved !== 0 ||
    coordinateFrame !== EQUATORIAL_CARTESIAN_FRAME
  ) {
    throw invalidCatalog('header is incompatible');
  }
  if (
    count === 0 ||
    !Number.isFinite(referenceEpochJulianDay) ||
    stringTableOffset !== recordsEnd ||
    stringTableBytes === 0 ||
    buffer.byteLength !== stringTableOffset + stringTableBytes
  ) {
    throw invalidCatalog('dimensions are inconsistent');
  }

  const stars = new Array(count);

  for (let index = 0; index < count; index += 1) {
    const offset = CATALOG_HEADER_BYTES + index * CATALOG_RECORD_BYTES;
    const star = {
      x: buffer.readFloatLE(offset),
      y: buffer.readFloatLE(offset + 4),
      z: buffer.readFloatLE(offset + 8),
      magnitude: buffer.readFloatLE(offset + 12),
      colorIndex: buffer.readFloatLE(offset + 16),
    };

    if (Object.values(star).some((value) => !Number.isFinite(value))) {
      throw invalidCatalog(`record ${index} is invalid`);
    }
    stars[index] = star;
  }

  return { count, referenceEpochJulianDay, stars };
}

export function buildStarClusterTile(catalog, definition) {
  const cells = groupStars(catalog.stars, definition.cellSizeParsec);
  const clusters = [...cells.values()]
    .map((cell) => aggregateCell(cell))
    .sort(
      (left, right) =>
        left.magnitude - right.magnitude || compareCoordinates(left.coordinates, right.coordinates),
    );

  return {
    id: definition.id,
    ...(definition.parentId ? { parentId: definition.parentId } : {}),
    version: TILE_VERSION,
    sourceCatalog: definition.sourceCatalog,
    sourceStarCount: catalog.count,
    referenceEpochJulianDay: catalog.referenceEpochJulianDay,
    lodLevel: definition.lodLevel,
    cellSizeParsec: definition.cellSizeParsec,
    clusterCount: clusters.length,
    cellCoordinates: clusters.flatMap((cluster) => cluster.coordinates),
    positionsParsec: clusters.flatMap((cluster) => cluster.position),
    starCounts: clusters.map((cluster) => cluster.count),
    apparentMagnitudes: clusters.map((cluster) => cluster.magnitude),
    colorIndicesBv: clusters.map((cluster) => cluster.colorIndex),
  };
}

export function buildStarSpatialHierarchy(catalog, options) {
  const rootGroups = sortedCells(groupStars(catalog.stars, ROOT_CELL_SIZE_PARSEC));
  const nodes = [];
  const rootIds = [];
  const packsByUrl = new Map();

  for (const rootGroup of rootGroups) {
    const rootId = `r-${coordinateId(rootGroup.coordinates)}`;
    const childGroups = sortedCells(groupStars(rootGroup.stars, CHILD_CELL_SIZE_PARSEC));
    const childIds = childGroups.map((cell) => `c-${coordinateId(cell.coordinates)}`);
    const rootPackCoordinates = rootGroup.coordinates.map((coordinate) =>
      Math.floor((coordinate * ROOT_CELL_SIZE_PARSEC) / ROOT_PACK_SIZE_PARSEC),
    );
    const rootUrl = `${options.baseUrl}/lod4/pack-${coordinateId(rootPackCoordinates)}.json`;
    const childUrl = `${options.baseUrl}/lod3/${rootId}.json`;
    const rootTile = buildStarClusterTile(localCatalog(catalog, rootGroup.stars), {
      id: rootId,
      sourceCatalog: options.sourceCatalog,
      lodLevel: 4,
      cellSizeParsec: ROOT_CLUSTER_SIZE_PARSEC,
    });

    rootIds.push(rootId);
    nodes.push(
      nodeDefinition(rootTile, rootGroup.coordinates, ROOT_CELL_SIZE_PARSEC, childIds, rootUrl),
    );
    addTileToPack(packsByUrl, rootUrl, rootTile, catalog, options.sourceCatalog);

    for (const childGroup of childGroups) {
      const childId = `c-${coordinateId(childGroup.coordinates)}`;
      const childTile = buildStarClusterTile(localCatalog(catalog, childGroup.stars), {
        id: childId,
        parentId: rootId,
        sourceCatalog: options.sourceCatalog,
        lodLevel: 3,
        cellSizeParsec: CHILD_CLUSTER_SIZE_PARSEC,
      });

      nodes.push(
        nodeDefinition(childTile, childGroup.coordinates, CHILD_CELL_SIZE_PARSEC, [], childUrl),
      );
      addTileToPack(packsByUrl, childUrl, childTile, catalog, options.sourceCatalog);
    }
  }

  return {
    index: {
      version: TILE_VERSION,
      sourceCatalog: options.sourceCatalog,
      sourceStarCount: catalog.count,
      referenceEpochJulianDay: catalog.referenceEpochJulianDay,
      referenceFrame: 'equatorial-j2000',
      distanceUnit: 'parsec',
      scientificConfidence: 'calculated',
      representation: 'illustrative-aggregation',
      rootIds,
      nodes,
    },
    packs: [...packsByUrl.entries()]
      .map(([url, pack]) => ({ url, pack: { ...pack, tiles: [...pack.tiles].sort(byTileId) } }))
      .sort((left, right) => left.url.localeCompare(right.url)),
  };
}

async function main() {
  const options = parseArguments(process.argv.slice(2));
  const catalog = decodeSpatialCatalog(await readFile(options.input));
  const hierarchy = buildStarSpatialHierarchy(catalog, options);
  const outputDirectory = dirname(options.output);

  await mkdir(outputDirectory, { recursive: true });
  await Promise.all(
    hierarchy.packs.map(async ({ url, pack }) => {
      const relativePath = url.slice(`${options.baseUrl}/`.length);
      const path = resolve(outputDirectory, relativePath);

      await mkdir(dirname(path), { recursive: true });
      await writeJson(path, pack);
    }),
  );
  await writeJson(options.output, hierarchy.index);

  const rootCount = hierarchy.index.rootIds.length;
  const childCount = hierarchy.index.nodes.length - rootCount;

  console.log(
    `Stellar octree generated: ${catalog.count.toLocaleString('en-US')} stars, ${rootCount} roots, ${childCount} children, ${hierarchy.packs.length} packs (${relative(process.cwd(), options.output)}).`,
  );
}

function groupStars(stars, cellSizeParsec) {
  const cells = new Map();

  for (const star of stars) {
    const coordinates = [
      Math.floor(star.x / cellSizeParsec),
      Math.floor(star.y / cellSizeParsec),
      Math.floor(star.z / cellSizeParsec),
    ];
    const key = coordinates.join(',');
    const cell = cells.get(key) ?? { coordinates, stars: [] };

    cell.stars.push(star);
    cells.set(key, cell);
  }

  return cells;
}

function aggregateCell(cell) {
  let positionX = 0;
  let positionY = 0;
  let positionZ = 0;
  let flux = 0;
  let colorFlux = 0;

  for (const star of cell.stars) {
    const starFlux = 10 ** (-0.4 * star.magnitude);

    positionX += star.x;
    positionY += star.y;
    positionZ += star.z;
    flux += starFlux;
    colorFlux += star.colorIndex * starFlux;
  }

  return {
    coordinates: cell.coordinates,
    position: [
      positionX / cell.stars.length,
      positionY / cell.stars.length,
      positionZ / cell.stars.length,
    ],
    count: cell.stars.length,
    magnitude: -2.5 * Math.log10(flux),
    colorIndex: colorFlux / flux,
  };
}

function nodeDefinition(tile, coordinates, boundsSizeParsec, childIds, url) {
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
    url,
  };
}

function addTileToPack(packsByUrl, url, tile, catalog, sourceCatalog) {
  const pack = packsByUrl.get(url) ?? {
    version: TILE_VERSION,
    sourceCatalog,
    referenceEpochJulianDay: catalog.referenceEpochJulianDay,
    tiles: [],
  };

  pack.tiles.push(tile);
  packsByUrl.set(url, pack);
}

function localCatalog(catalog, stars) {
  return {
    count: stars.length,
    referenceEpochJulianDay: catalog.referenceEpochJulianDay,
    stars,
  };
}

function sortedCells(cells) {
  return [...cells.values()].sort((left, right) =>
    compareCoordinates(left.coordinates, right.coordinates),
  );
}

function coordinateId(coordinates) {
  return coordinates
    .map((coordinate) => `${coordinate < 0 ? 'n' : 'p'}${Math.abs(coordinate)}`)
    .join('-');
}

function byTileId(left, right) {
  return left.id.localeCompare(right.id);
}

function parseArguments(argumentsList) {
  const options = {
    input: DEFAULT_INPUT,
    output: DEFAULT_OUTPUT,
    baseUrl: DEFAULT_BASE_URL,
    sourceCatalog: DEFAULT_SOURCE_CATALOG,
  };

  for (let index = 0; index < argumentsList.length; index += 1) {
    const argument = argumentsList[index];
    const value = argumentsList[index + 1];

    if (!value) {
      throw new Error(`Missing value for ${argument}.`);
    }
    if (argument === '--input') {
      options.input = resolve(value);
    } else if (argument === '--output') {
      options.output = resolve(value);
    } else if (argument === '--base-url') {
      options.baseUrl = value.replace(/\/$/u, '');
    } else if (argument === '--source-catalog') {
      options.sourceCatalog = value;
    } else {
      throw new Error(`Unknown argument: ${argument}.`);
    }
    index += 1;
  }

  return options;
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

function invalidCatalog(reason) {
  return new Error(`Invalid stellar catalog for spatial indexing: ${reason}.`);
}

async function writeJson(path, value) {
  const configuration = (await resolveConfig(path)) ?? {};
  const contents = await format(JSON.stringify(value), {
    ...configuration,
    filepath: path,
  });

  await writeFile(path, contents);
}
