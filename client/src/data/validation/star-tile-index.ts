import {
  type StarClusterTile,
  type StarClusterTilePack,
  type StarColorIndexSystem,
  type StarMagnitudeBand,
  type StarTileBounds,
  type StarTileCatalogSelection,
  type StarTileCatalogSource,
  type StarTileIndex,
  type StarTileIndexNode,
  type StarTilePointRepresentation,
  type StarTileSampling,
} from '../models/universe.models';

export function parseStarTileIndex(value: unknown, source: string): StarTileIndex {
  if (
    !isRecord(value) ||
    value['version'] !== '4.0.0' ||
    typeof value['sourceCatalog'] !== 'string' ||
    !isPositiveInteger(value['sourceStarCount']) ||
    !isFiniteNumber(value['referenceEpochJulianDay']) ||
    (value['referenceFrame'] !== 'equatorial-j2000' && value['referenceFrame'] !== 'icrs') ||
    value['distanceUnit'] !== 'parsec' ||
    !isMagnitudeBand(value['magnitudeBand']) ||
    !isColorIndexSystem(value['colorIndexSystem']) ||
    !isCatalogSource(value['source']) ||
    !isCatalogSelection(value['selection']) ||
    !isSampling(value['sampling']) ||
    value['scientificConfidence'] !== 'calculated' ||
    value['representation'] !== 'hierarchical-aggregation-with-deterministic-samples' ||
    !isStringArray(value['rootIds']) ||
    value['rootIds'].length === 0 ||
    !Array.isArray(value['nodes']) ||
    value['nodes'].length === 0
  ) {
    throw new Error(`Index spatial stellaire invalide : ${source}.`);
  }
  const nodes = value['nodes'].map((node, index) => parseNode(node, source, index));
  const nodesById = new Map<string, StarTileIndexNode>();

  for (const node of nodes) {
    if (nodesById.has(node.id)) {
      throw new Error(`Nœud spatial stellaire dupliqué : ${node.id}.`);
    }
    nodesById.set(node.id, node);
  }
  validateHierarchy(value['rootIds'], nodesById, value['sourceStarCount'], source);

  return {
    version: value['version'],
    sourceCatalog: value['sourceCatalog'],
    sourceStarCount: value['sourceStarCount'],
    referenceEpochJulianDay: value['referenceEpochJulianDay'],
    referenceFrame: value['referenceFrame'],
    distanceUnit: value['distanceUnit'],
    magnitudeBand: value['magnitudeBand'],
    colorIndexSystem: value['colorIndexSystem'],
    source: value['source'],
    selection: value['selection'],
    sampling: value['sampling'],
    scientificConfidence: value['scientificConfidence'],
    representation: value['representation'],
    rootIds: value['rootIds'],
    nodes,
  };
}

export function parseStarClusterTilePack(value: unknown, source: string): StarClusterTilePack {
  if (
    !isRecord(value) ||
    value['version'] !== '4.0.0' ||
    typeof value['sourceCatalog'] !== 'string' ||
    !isFiniteNumber(value['referenceEpochJulianDay']) ||
    !isMagnitudeBand(value['magnitudeBand']) ||
    !isColorIndexSystem(value['colorIndexSystem']) ||
    !Array.isArray(value['tiles']) ||
    value['tiles'].length === 0
  ) {
    throw new Error(`Paquet de tuiles stellaires invalide : ${source}.`);
  }
  const tiles = value['tiles'].map((tile, index) =>
    parseStarClusterTile(tile, `${source}#${index}`),
  );
  const tileIds = new Set<string>();

  for (const tile of tiles) {
    if (tileIds.has(tile.id)) {
      throw new Error(`Tuile stellaire dupliquée dans ${source} : ${tile.id}.`);
    }
    tileIds.add(tile.id);
    if (
      tile.version !== value['version'] ||
      tile.sourceCatalog !== value['sourceCatalog'] ||
      tile.referenceEpochJulianDay !== value['referenceEpochJulianDay'] ||
      tile.magnitudeBand !== value['magnitudeBand'] ||
      tile.colorIndexSystem !== value['colorIndexSystem']
    ) {
      throw new Error(`Métadonnées de tuile stellaire incohérentes dans ${source}.`);
    }
  }

  return {
    version: value['version'],
    sourceCatalog: value['sourceCatalog'],
    referenceEpochJulianDay: value['referenceEpochJulianDay'],
    magnitudeBand: value['magnitudeBand'],
    colorIndexSystem: value['colorIndexSystem'],
    tiles,
  };
}

export function parseStarClusterTile(value: unknown, source: string): StarClusterTile {
  if (
    !isRecord(value) ||
    typeof value['id'] !== 'string' ||
    value['id'].length === 0 ||
    (value['parentId'] !== undefined &&
      (typeof value['parentId'] !== 'string' || value['parentId'].length === 0)) ||
    value['version'] !== '4.0.0' ||
    typeof value['sourceCatalog'] !== 'string' ||
    !isPositiveInteger(value['sourceStarCount']) ||
    !isFiniteNumber(value['referenceEpochJulianDay']) ||
    !isMagnitudeBand(value['magnitudeBand']) ||
    !isColorIndexSystem(value['colorIndexSystem']) ||
    !isNonNegativeInteger(value['lodLevel']) ||
    !isPositiveFiniteNumber(value['cellSizeParsec']) ||
    !isPointRepresentation(value['representation']) ||
    !isIntegerArray(value['cellCoordinates']) ||
    !isFiniteNumberArray(value['positionsParsec']) ||
    !isPositiveIntegerArray(value['starCounts']) ||
    !isFiniteNumberArray(value['apparentMagnitudes']) ||
    !isFiniteNumberArray(value['colorIndices'])
  ) {
    throw invalidTile(source);
  }
  const clusterCount = value['starCounts'].length;
  const vectorLength = clusterCount * 3;

  if (
    clusterCount === 0 ||
    value['cellCoordinates'].length !== vectorLength ||
    value['positionsParsec'].length !== vectorLength ||
    value['apparentMagnitudes'].length !== clusterCount ||
    value['colorIndices'].length !== clusterCount
  ) {
    throw invalidTile(source);
  }
  const countedStars = value['starCounts'].reduce((total, count) => total + count, 0);

  if (countedStars !== value['sourceStarCount']) {
    throw new Error(`Tuile de cellules stellaires au comptage stellaire incohérent : ${source}.`);
  }

  return {
    id: value['id'],
    parentId: value['parentId'],
    version: value['version'],
    sourceCatalog: value['sourceCatalog'],
    sourceStarCount: value['sourceStarCount'],
    referenceEpochJulianDay: value['referenceEpochJulianDay'],
    magnitudeBand: value['magnitudeBand'],
    colorIndexSystem: value['colorIndexSystem'],
    lodLevel: value['lodLevel'],
    cellSizeParsec: value['cellSizeParsec'],
    representation: value['representation'],
    clusterCount,
    cellCoordinates: Int32Array.from(value['cellCoordinates']),
    positionsParsec: Float32Array.from(value['positionsParsec']),
    starCounts: Uint32Array.from(value['starCounts']),
    apparentMagnitudes: Float32Array.from(value['apparentMagnitudes']),
    colorIndices: Float32Array.from(value['colorIndices']),
  };
}

export function assertStarClusterTileMatchesIndex(
  tile: StarClusterTile,
  index: StarTileIndex,
  node: StarTileIndexNode,
): void {
  if (tile.sourceCatalog !== index.sourceCatalog) {
    throw new Error('Tuile stellaire associée au mauvais catalogue source.');
  }
  if (tile.version !== index.version) {
    throw new Error('Tuile stellaire associée à la mauvaise version d’index.');
  }
  if (tile.sourceStarCount !== node.sourceStarCount) {
    throw new Error('Tuile stellaire associée au mauvais nombre d’étoiles.');
  }
  if (tile.referenceEpochJulianDay !== index.referenceEpochJulianDay) {
    throw new Error('Tuile stellaire associée à la mauvaise époque de référence.');
  }
  if (
    tile.magnitudeBand !== index.magnitudeBand ||
    tile.colorIndexSystem !== index.colorIndexSystem
  ) {
    throw new Error('Tuile stellaire associée au mauvais système photométrique.');
  }
  if (tile.id !== node.id || tile.parentId !== node.parentId) {
    throw new Error('Tuile stellaire associée au mauvais nœud spatial.');
  }
  if (tile.lodLevel !== node.lodLevel) {
    throw new Error('Tuile stellaire associée au mauvais niveau de détail.');
  }
  if (tile.cellSizeParsec !== node.cellSizeParsec) {
    throw new Error('Tuile stellaire associée à la mauvaise taille de cellule.');
  }
  if (tile.representation !== node.representation) {
    throw new Error('Tuile stellaire associée à la mauvaise représentation.');
  }
  if (tile.clusterCount !== node.clusterCount) {
    throw new Error('Tuile stellaire associée au mauvais nombre de cellules.');
  }
}

function parseNode(value: unknown, source: string, index: number): StarTileIndexNode {
  if (
    !isRecord(value) ||
    typeof value['id'] !== 'string' ||
    value['id'].length === 0 ||
    (value['parentId'] !== undefined &&
      (typeof value['parentId'] !== 'string' || value['parentId'].length === 0)) ||
    !isNonNegativeInteger(value['lodLevel']) ||
    !isStringArray(value['childIds']) ||
    new Set(value['childIds']).size !== value['childIds'].length ||
    !isBounds(value['boundsParsec']) ||
    !isPositiveInteger(value['sourceStarCount']) ||
    !isPositiveInteger(value['clusterCount']) ||
    !isPositiveFiniteNumber(value['cellSizeParsec']) ||
    !isPointRepresentation(value['representation']) ||
    typeof value['url'] !== 'string' ||
    value['url'].length === 0
  ) {
    throw new Error(`Nœud spatial stellaire invalide dans ${source}, index ${index}.`);
  }

  return {
    id: value['id'],
    parentId: value['parentId'],
    lodLevel: value['lodLevel'],
    childIds: value['childIds'],
    boundsParsec: value['boundsParsec'],
    sourceStarCount: value['sourceStarCount'],
    clusterCount: value['clusterCount'],
    cellSizeParsec: value['cellSizeParsec'],
    representation: value['representation'],
    url: value['url'],
  };
}

function validateHierarchy(
  rootIds: readonly string[],
  nodesById: ReadonlyMap<string, StarTileIndexNode>,
  sourceStarCount: number,
  source: string,
): void {
  if (new Set(rootIds).size !== rootIds.length) {
    throw new Error(`Racine spatiale stellaire dupliquée dans ${source}.`);
  }
  let rootStarCount = 0;

  for (const rootId of rootIds) {
    const root = nodesById.get(rootId);

    if (
      !root ||
      root.parentId !== undefined ||
      root.lodLevel !== 4 ||
      root.representation !== 'aggregate-cell'
    ) {
      throw new Error(`Racine spatiale stellaire invalide : ${rootId}.`);
    }
    rootStarCount += root.sourceStarCount;
  }
  if (rootStarCount !== sourceStarCount) {
    throw new Error(`Comptage des racines stellaires incohérent dans ${source}.`);
  }

  for (const node of nodesById.values()) {
    if (node.parentId === undefined && !rootIds.includes(node.id)) {
      throw new Error(`Nœud spatial orphelin : ${node.id}.`);
    }
    if (node.parentId !== undefined) {
      const parent = nodesById.get(node.parentId);

      if (
        !parent ||
        parent.parentId !== undefined ||
        !parent.childIds.includes(node.id) ||
        node.lodLevel !== 3 ||
        node.representation !== 'sampled-source' ||
        node.childIds.length > 0
      ) {
        throw new Error(`Relation spatiale stellaire invalide : ${node.parentId} → ${node.id}.`);
      }
    }
  }

  for (const node of nodesById.values()) {
    let childStarCount = 0;

    for (const childId of node.childIds) {
      const child = nodesById.get(childId);

      if (
        !child ||
        child.parentId !== node.id ||
        child.lodLevel !== 3 ||
        !containsBounds(node.boundsParsec, child.boundsParsec)
      ) {
        throw new Error(`Relation spatiale stellaire invalide : ${node.id} → ${childId}.`);
      }
      childStarCount += child.sourceStarCount;
    }
    if (node.childIds.length > 0 && childStarCount !== node.sourceStarCount) {
      throw new Error(`Comptage des enfants stellaires incohérent pour ${node.id}.`);
    }
  }
}

function containsBounds(parent: StarTileBounds, child: StarTileBounds): boolean {
  return parent.min.every(
    (minimum, axis) => minimum <= child.min[axis]! && parent.max[axis]! >= child.max[axis]!,
  );
}

function isBounds(value: unknown): value is StarTileBounds {
  if (!isRecord(value) || !isVector3(value['min']) || !isVector3(value['max'])) {
    return false;
  }
  const minimum = value['min'];
  const maximum = value['max'];

  return minimum.every((coordinate, axis) => coordinate < maximum[axis]!);
}

function invalidTile(source: string): Error {
  return new Error(`Tuile de cellules stellaires invalide : ${source}.`);
}

function isMagnitudeBand(value: unknown): value is StarMagnitudeBand {
  return value === 'johnson-v' || value === 'gaia-g';
}

function isColorIndexSystem(value: unknown): value is StarColorIndexSystem {
  return value === 'johnson-b-v' || value === 'gaia-bp-rp';
}

function isCatalogSource(value: unknown): value is StarTileCatalogSource {
  return (
    isRecord(value) &&
    isNonEmptyString(value['name']) &&
    isNonEmptyString(value['url']) &&
    (value['doi'] === null || isNonEmptyString(value['doi'])) &&
    isNonEmptyString(value['credit']) &&
    isIsoTimestamp(value['retrievedAt']) &&
    isNonEmptyString(value['query'])
  );
}

function isCatalogSelection(value: unknown): value is StarTileCatalogSelection {
  return (
    isRecord(value) &&
    isPositiveFiniteNumber(value['maximumDistanceParsec']) &&
    isFiniteNumber(value['maximumApparentMagnitude']) &&
    isPositiveFiniteNumber(value['minimumParallaxOverError'])
  );
}

function isSampling(value: unknown): value is StarTileSampling {
  return (
    isRecord(value) &&
    value['method'] === 'brightest-plus-deterministic-uniform' &&
    isPositiveInteger(value['maximumSamplesPerLeaf']) &&
    isPositiveInteger(value['brightestSamplesPerLeaf']) &&
    value['brightestSamplesPerLeaf'] <= value['maximumSamplesPerLeaf']
  );
}

function isPointRepresentation(value: unknown): value is StarTilePointRepresentation {
  return value === 'aggregate-cell' || value === 'sampled-source';
}

function isIsoTimestamp(value: unknown): value is string {
  return isNonEmptyString(value) && Number.isFinite(Date.parse(value));
}

function isNonEmptyString(value: unknown): value is string {
  return typeof value === 'string' && value.length > 0;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function isFiniteNumber(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value);
}

function isPositiveFiniteNumber(value: unknown): value is number {
  return isFiniteNumber(value) && value > 0;
}

function isNonNegativeInteger(value: unknown): value is number {
  return typeof value === 'number' && Number.isInteger(value) && value >= 0;
}

function isPositiveInteger(value: unknown): value is number {
  return typeof value === 'number' && Number.isInteger(value) && value > 0;
}

function isFiniteNumberArray(value: unknown): value is number[] {
  return Array.isArray(value) && value.every(isFiniteNumber);
}

function isIntegerArray(value: unknown): value is number[] {
  return Array.isArray(value) && value.every((entry) => Number.isInteger(entry));
}

function isPositiveIntegerArray(value: unknown): value is number[] {
  return Array.isArray(value) && value.every(isPositiveInteger);
}

function isStringArray(value: unknown): value is string[] {
  return (
    Array.isArray(value) && value.every((entry) => typeof entry === 'string' && entry.length > 0)
  );
}

function isVector3(value: unknown): value is [number, number, number] {
  return Array.isArray(value) && value.length === 3 && value.every(isFiniteNumber);
}
