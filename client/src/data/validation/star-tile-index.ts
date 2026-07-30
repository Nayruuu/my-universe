import {
  type StarClusterTile,
  type StarClusterTilePack,
  type StarTileBounds,
  type StarTileIndex,
  type StarTileIndexNode,
} from '../models/universe.models';
import { type StarCatalog } from '../../engine/loaders/star-catalog';

export function parseStarTileIndex(value: unknown, source: string): StarTileIndex {
  if (
    !isRecord(value) ||
    typeof value['version'] !== 'string' ||
    typeof value['sourceCatalog'] !== 'string' ||
    !isPositiveInteger(value['sourceStarCount']) ||
    !isFiniteNumber(value['referenceEpochJulianDay']) ||
    value['referenceFrame'] !== 'equatorial-j2000' ||
    value['distanceUnit'] !== 'parsec' ||
    value['scientificConfidence'] !== 'calculated' ||
    value['representation'] !== 'illustrative-aggregation' ||
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
    scientificConfidence: value['scientificConfidence'],
    representation: value['representation'],
    rootIds: value['rootIds'],
    nodes,
  };
}

export function parseStarClusterTilePack(value: unknown, source: string): StarClusterTilePack {
  if (
    !isRecord(value) ||
    typeof value['version'] !== 'string' ||
    typeof value['sourceCatalog'] !== 'string' ||
    !isFiniteNumber(value['referenceEpochJulianDay']) ||
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
      tile.referenceEpochJulianDay !== value['referenceEpochJulianDay']
    ) {
      throw new Error(`Métadonnées de tuile stellaire incohérentes dans ${source}.`);
    }
  }

  return {
    version: value['version'],
    sourceCatalog: value['sourceCatalog'],
    referenceEpochJulianDay: value['referenceEpochJulianDay'],
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
    typeof value['version'] !== 'string' ||
    typeof value['sourceCatalog'] !== 'string' ||
    !isPositiveInteger(value['sourceStarCount']) ||
    !isFiniteNumber(value['referenceEpochJulianDay']) ||
    !isNonNegativeInteger(value['lodLevel']) ||
    !isPositiveFiniteNumber(value['cellSizeParsec']) ||
    !isIntegerArray(value['cellCoordinates']) ||
    !isFiniteNumberArray(value['positionsParsec']) ||
    !isPositiveIntegerArray(value['starCounts']) ||
    !isFiniteNumberArray(value['apparentMagnitudes']) ||
    !isFiniteNumberArray(value['colorIndicesBv'])
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
    value['colorIndicesBv'].length !== clusterCount
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
    lodLevel: value['lodLevel'],
    cellSizeParsec: value['cellSizeParsec'],
    clusterCount,
    cellCoordinates: Int32Array.from(value['cellCoordinates']),
    positionsParsec: Float32Array.from(value['positionsParsec']),
    starCounts: Uint32Array.from(value['starCounts']),
    apparentMagnitudes: Float32Array.from(value['apparentMagnitudes']),
    colorIndicesBv: Float32Array.from(value['colorIndicesBv']),
  };
}

export function assertStarClusterTileMatchesCatalog(
  tile: StarClusterTile,
  index: StarTileIndex,
  node: StarTileIndexNode,
  catalog: StarCatalog,
): void {
  if (tile.sourceCatalog !== index.sourceCatalog) {
    throw new Error('Tuile stellaire associée au mauvais catalogue source.');
  }
  if (tile.version !== index.version) {
    throw new Error('Tuile stellaire associée à la mauvaise version d’index.');
  }
  if (index.sourceStarCount !== catalog.count || tile.sourceStarCount !== node.sourceStarCount) {
    throw new Error('Tuile stellaire associée au mauvais nombre d’étoiles.');
  }
  if (
    tile.referenceEpochJulianDay !== index.referenceEpochJulianDay ||
    tile.referenceEpochJulianDay !== catalog.referenceEpochJulianDay
  ) {
    throw new Error('Tuile stellaire associée à la mauvaise époque de référence.');
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

    if (!root || root.parentId !== undefined || root.lodLevel !== 4) {
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
