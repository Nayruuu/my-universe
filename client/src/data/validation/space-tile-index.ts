import {
  DistanceUnit,
  NearbyGalaxyOverviewEntry,
  ReferenceFrame,
  SearchEntry,
  SpaceObjectType,
  SpaceTileBounds,
  SpaceTileIndex,
  SpaceTileIndexEntry,
} from '../models/universe.models';

const SPACE_OBJECT_TYPES: readonly SpaceObjectType[] = [
  'universe',
  'galaxy-cluster',
  'galaxy',
  'black-hole',
  'nebula',
  'star',
  'planet',
  'dwarf-planet',
  'moon',
  'asteroid',
  'comet',
  'artificial-object',
  'region',
];

const REFERENCE_FRAMES: readonly ReferenceFrame[] = [
  'solar-system',
  'stellar',
  'galactic',
  'local-group',
  'nearby-universe',
];

const DISTANCE_UNITS: readonly DistanceUnit[] = [
  'meter',
  'kilometer',
  'astronomical-unit',
  'light-year',
  'parsec',
  'kiloparsec',
  'megaparsec',
];

export function parseSpaceTileIndex(value: unknown, source: string): SpaceTileIndex {
  if (
    !isRecord(value) ||
    typeof value['version'] !== 'string' ||
    !Array.isArray(value['tiles']) ||
    !Array.isArray(value['searchEntries']) ||
    (value['overviewEntries'] !== undefined && !Array.isArray(value['overviewEntries']))
  ) {
    throw new Error(`Index de tuiles spatiales invalide : ${source}.`);
  }

  const tileIds = new Set<string>();
  const objectIds = new Set<string>();
  const tiles = value['tiles'].map((tile, index) => {
    const parsed = parseTile(tile, source, index);

    if (tileIds.has(parsed.id)) {
      throw new Error(`Identifiant de tuile dupliqué : ${parsed.id}.`);
    }
    tileIds.add(parsed.id);
    for (const objectId of parsed.objectIds) {
      if (objectIds.has(objectId)) {
        throw new Error(`Objet référencé par plusieurs tuiles : ${objectId}.`);
      }
      objectIds.add(objectId);
    }

    return parsed;
  });
  const searchIds = new Set<string>();
  const searchEntries = value['searchEntries'].map((entry, index) => {
    const parsed = parseSearchEntry(entry, source, index);

    if (searchIds.has(parsed.id)) {
      throw new Error(`Entrée de recherche dupliquée : ${parsed.id}.`);
    }
    if (!objectIds.has(parsed.id)) {
      throw new Error(`Objet de recherche absent des tuiles : ${parsed.id}.`);
    }
    searchIds.add(parsed.id);

    return parsed;
  });

  for (const objectId of objectIds) {
    if (!searchIds.has(objectId)) {
      throw new Error(`Entrée de recherche manquante pour ${objectId}.`);
    }
  }
  const overviewIds = new Set<string>();
  const overviewEntries = (value['overviewEntries'] ?? []).map((entry, index) => {
    const parsed = parseOverviewEntry(entry, source, index);

    if (overviewIds.has(parsed.id)) {
      throw new Error(`Entrée d’aperçu dupliquée : ${parsed.id}.`);
    }
    if (!searchIds.has(parsed.id)) {
      throw new Error(`Objet d’aperçu absent de la recherche : ${parsed.id}.`);
    }
    overviewIds.add(parsed.id);

    return parsed;
  });

  validateHierarchy(tiles, tileIds);

  return {
    version: value['version'],
    tiles,
    searchEntries,
    overviewEntries,
  };
}

function parseOverviewEntry(
  value: unknown,
  source: string,
  index: number,
): NearbyGalaxyOverviewEntry {
  if (
    !isRecord(value) ||
    typeof value['id'] !== 'string' ||
    !isFiniteTuple3(value['position']) ||
    !isEnumValue(value['unit'], DISTANCE_UNITS) ||
    typeof value['color'] !== 'string' ||
    value['color'].length === 0 ||
    typeof value['visualRadius'] !== 'number' ||
    !Number.isFinite(value['visualRadius']) ||
    value['visualRadius'] <= 0
  ) {
    throw new Error(`Entrée d’aperçu spatial invalide dans ${source}, index ${index}.`);
  }

  return {
    id: value['id'],
    position: [...value['position']],
    unit: value['unit'],
    color: value['color'],
    visualRadius: value['visualRadius'],
  };
}

function parseTile(value: unknown, source: string, index: number): SpaceTileIndexEntry {
  if (
    !isRecord(value) ||
    typeof value['id'] !== 'string' ||
    !Number.isInteger(value['level']) ||
    (value['level'] as number) < 0 ||
    !isEnumValue(value['referenceFrame'], REFERENCE_FRAMES) ||
    typeof value['url'] !== 'string' ||
    (value['parentId'] !== undefined &&
      (typeof value['parentId'] !== 'string' || value['parentId'].length === 0)) ||
    (value['childIds'] !== undefined &&
      (!isStringArray(value['childIds']) ||
        new Set(value['childIds']).size !== value['childIds'].length)) ||
    !Array.isArray(value['objectIds']) ||
    value['objectIds'].length === 0 ||
    !value['objectIds'].every((objectId) => typeof objectId === 'string')
  ) {
    throw new Error(`Tuile spatiale invalide dans ${source}, index ${index}.`);
  }

  return {
    id: value['id'],
    level: value['level'] as number,
    ...(value['parentId'] !== undefined ? { parentId: value['parentId'] } : {}),
    ...(value['childIds'] !== undefined ? { childIds: [...value['childIds']] } : {}),
    referenceFrame: value['referenceFrame'],
    url: value['url'],
    bounds: parseBounds(value['bounds'], value['id']),
    objectIds: [...value['objectIds']],
  };
}

function validateHierarchy(
  tiles: readonly SpaceTileIndexEntry[],
  tileIds: ReadonlySet<string>,
): void {
  const tileById = new Map(tiles.map((tile) => [tile.id, tile] as const));

  for (const tile of tiles) {
    if (tile.parentId === undefined) {
      if (tile.level !== 0) {
        throw new Error(`Niveau hiérarchique invalide pour la racine ${tile.id}.`);
      }
    } else {
      const parent = tileById.get(tile.parentId);

      if (!parent || !parent.childIds?.includes(tile.id)) {
        throw new Error(`Relation hiérarchique invalide : ${tile.parentId} → ${tile.id}.`);
      }
      if (tile.level !== parent.level + 1) {
        throw new Error(`Niveau hiérarchique invalide : ${parent.id} → ${tile.id}.`);
      }
      if (
        tile.referenceFrame !== parent.referenceFrame ||
        tile.bounds.unit !== parent.bounds.unit
      ) {
        throw new Error(`Référentiel hiérarchique invalide : ${parent.id} → ${tile.id}.`);
      }
      if (!containsBounds(parent.bounds, tile.bounds)) {
        throw new Error(`Bornes hiérarchiques invalides : ${parent.id} → ${tile.id}.`);
      }
    }

    for (const childId of tile.childIds ?? []) {
      const child = tileById.get(childId);

      if (!tileIds.has(childId) || child?.parentId !== tile.id) {
        throw new Error(`Relation hiérarchique invalide : ${tile.id} → ${childId}.`);
      }
    }
  }
}

function containsBounds(parent: SpaceTileBounds, child: SpaceTileBounds): boolean {
  return parent.min.every(
    (minimum, axis) => minimum <= child.min[axis]! && parent.max[axis]! >= child.max[axis]!,
  );
}

function parseBounds(value: unknown, tileId: string): SpaceTileBounds {
  if (
    !isRecord(value) ||
    !isFiniteTuple3(value['min']) ||
    !isFiniteTuple3(value['max']) ||
    !isEnumValue(value['unit'], DISTANCE_UNITS)
  ) {
    throw new Error(`Limites invalides pour la tuile ${tileId}.`);
  }
  const minimum = value['min'];
  const maximum = value['max'];

  if (minimum.some((coordinate, index) => coordinate > maximum[index]!)) {
    throw new Error(`Limites invalides pour la tuile ${tileId}.`);
  }

  return {
    min: [...minimum],
    max: [...maximum],
    unit: value['unit'],
  };
}

function parseSearchEntry(value: unknown, source: string, index: number): SearchEntry {
  if (
    !isRecord(value) ||
    typeof value['id'] !== 'string' ||
    typeof value['name'] !== 'string' ||
    !Array.isArray(value['aliases']) ||
    !value['aliases'].every((alias) => typeof alias === 'string') ||
    !isEnumValue(value['type'], SPACE_OBJECT_TYPES) ||
    (value['parentName'] !== undefined && typeof value['parentName'] !== 'string') ||
    (value['keywords'] !== undefined &&
      (!Array.isArray(value['keywords']) ||
        !value['keywords'].every((keyword) => typeof keyword === 'string')))
  ) {
    throw new Error(`Entrée de recherche spatiale invalide dans ${source}, index ${index}.`);
  }

  return {
    id: value['id'],
    name: value['name'],
    aliases: [...value['aliases']],
    type: value['type'],
    ...(value['parentName'] !== undefined ? { parentName: value['parentName'] } : {}),
    ...(value['keywords'] !== undefined ? { keywords: [...value['keywords']] } : {}),
  };
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function isFiniteTuple3(value: unknown): value is [number, number, number] {
  return (
    Array.isArray(value) &&
    value.length === 3 &&
    value.every((coordinate) => typeof coordinate === 'number' && Number.isFinite(coordinate))
  );
}

function isStringArray(value: unknown): value is string[] {
  return (
    Array.isArray(value) && value.every((entry) => typeof entry === 'string' && entry.length > 0)
  );
}

function isEnumValue<T extends string>(value: unknown, allowed: readonly T[]): value is T {
  return typeof value === 'string' && allowed.some((candidate) => candidate === value);
}
