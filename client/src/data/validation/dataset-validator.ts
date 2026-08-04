import {
  DatasetManifest,
  DistanceUnit,
  BlackHoleActivity,
  EphemerisBody,
  EphemerisOrigin,
  PositionProviderDefinition,
  ReferenceFrame,
  ScientificConfidence,
  SpaceObject,
  SpaceObjectType,
  UniverseDataset,
} from '../models/universe.models';

const SPACE_OBJECT_TYPES: readonly SpaceObjectType[] = [
  'universe',
  'galaxy-cluster',
  'supercluster',
  'cosmic-wall',
  'cosmic-filament',
  'cosmic-void',
  'cosmic-basin',
  'cosmic-attractor',
  'cosmic-repeller',
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

const BLACK_HOLE_ACTIVITIES: readonly BlackHoleActivity[] = ['dormant', 'quiescent', 'active'];

const REFERENCE_FRAMES: readonly ReferenceFrame[] = [
  'solar-system',
  'stellar',
  'galactic',
  'local-group',
  'nearby-universe',
  'cosmic-web',
];

const CONFIDENCE_LEVELS: readonly ScientificConfidence[] = [
  'observed',
  'calculated',
  'extrapolated',
  'simulated',
  'procedural',
  'illustrative',
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

const EPHEMERIS_BODIES: readonly EphemerisBody[] = [
  'mercury',
  'venus',
  'earth',
  'moon',
  'mars',
  'jupiter',
  'saturn',
  'uranus',
  'neptune',
  'pluto',
  'io',
  'europa',
  'ganymede',
  'callisto',
];

const EPHEMERIS_ORIGINS: readonly EphemerisOrigin[] = ['sun', 'earth', 'jupiter'];

export function parseManifest(value: unknown): DatasetManifest {
  if (
    !isRecord(value) ||
    typeof value['version'] !== 'string' ||
    !Array.isArray(value['datasets'])
  ) {
    throw new Error('Manifest de données invalide.');
  }

  const datasets: DatasetManifest['datasets'] = value['datasets'].map((entry, index) => {
    const datasetType = isRecord(entry) ? entry['type'] : undefined;

    if (
      !isRecord(entry) ||
      typeof entry['id'] !== 'string' ||
      typeof entry['url'] !== 'string' ||
      (datasetType !== 'json' &&
        datasetType !== 'binary' &&
        datasetType !== 'space-tile-index' &&
        datasetType !== 'constellation-lines' &&
        datasetType !== 'star-tile-index' &&
        datasetType !== 'cosmic-group-catalog' &&
        datasetType !== 'cosmic-structure-catalog' &&
        datasetType !== 'cosmic-web-volume')
    ) {
      throw new Error(`Entrée de manifest invalide à l’index ${index}.`);
    }

    if (datasetType === 'binary') {
      if (entry['format'] !== 'star-catalog-v2') {
        throw new Error(`Format binaire invalide à l’index ${index}.`);
      }

      return {
        id: entry['id'],
        url: entry['url'],
        type: 'binary',
        format: entry['format'],
      };
    }

    if (datasetType === 'space-tile-index') {
      if (entry['format'] !== 'space-tiles-v1' && entry['format'] !== 'space-tiles-v2') {
        throw new Error(`Format de tuiles invalide à l’index ${index}.`);
      }

      return {
        id: entry['id'],
        url: entry['url'],
        type: 'space-tile-index',
        format: entry['format'],
      };
    }

    if (datasetType === 'constellation-lines') {
      if (entry['format'] !== 'constellation-lines-v1') {
        throw new Error(`Format de constellations invalide à l’index ${index}.`);
      }

      return {
        id: entry['id'],
        url: entry['url'],
        type: 'constellation-lines',
        format: entry['format'],
      };
    }

    if (datasetType === 'star-tile-index') {
      if (entry['format'] !== 'star-tiles-v2') {
        throw new Error(`Format de tuiles stellaires invalide à l’index ${index}.`);
      }
      if (typeof entry['starCatalogId'] !== 'string') {
        throw new Error(`Catalogue stellaire manquant à l’index ${index}.`);
      }

      return {
        id: entry['id'],
        url: entry['url'],
        type: 'star-tile-index',
        format: entry['format'],
        starCatalogId: entry['starCatalogId'],
      };
    }

    if (datasetType === 'cosmic-group-catalog') {
      if (entry['format'] !== 'cosmicflows4-group-catalog-v2') {
        throw new Error(`Format de groupes cosmiques invalide à l’index ${index}.`);
      }

      return {
        id: entry['id'],
        url: entry['url'],
        type: 'cosmic-group-catalog',
        format: entry['format'],
      };
    }

    if (datasetType === 'cosmic-structure-catalog') {
      if (entry['format'] !== 'cosmic-structure-catalog-v1') {
        throw new Error(`Format de structures cosmiques invalide à l’index ${index}.`);
      }
      if (typeof entry['metadataUrl'] !== 'string') {
        throw new Error(`Métadonnées de structures cosmiques manquantes à l’index ${index}.`);
      }

      return {
        id: entry['id'],
        url: entry['url'],
        metadataUrl: entry['metadataUrl'],
        type: 'cosmic-structure-catalog',
        format: entry['format'],
      };
    }

    if (datasetType === 'cosmic-web-volume') {
      if (entry['format'] !== 'cosmic-web-volume-v1') {
        throw new Error(`Format de volume cosmique invalide à l’index ${index}.`);
      }

      return {
        id: entry['id'],
        url: entry['url'],
        type: 'cosmic-web-volume',
        format: entry['format'],
      };
    }

    return {
      id: entry['id'],
      url: entry['url'],
      type: 'json',
    };
  });

  return { version: value['version'], datasets };
}

export function parseUniverseDataset(value: unknown, source: string): UniverseDataset {
  if (
    !isRecord(value) ||
    typeof value['version'] !== 'string' ||
    !Array.isArray(value['objects'])
  ) {
    throw new Error(`Jeu de données invalide : ${source}.`);
  }

  return {
    version: value['version'],
    objects: value['objects'].map((object, index) => parseSpaceObject(object, source, index)),
  };
}

function parseSpaceObject(value: unknown, source: string, index: number): SpaceObject {
  if (
    !isRecord(value) ||
    typeof value['id'] !== 'string' ||
    typeof value['name'] !== 'string' ||
    !isEnumValue(value['type'], SPACE_OBJECT_TYPES) ||
    !isEnumValue(value['referenceFrame'], REFERENCE_FRAMES) ||
    !isEnumValue(value['scientificConfidence'], CONFIDENCE_LEVELS) ||
    !isRecord(value['visual'])
  ) {
    throw new Error(`Objet invalide dans ${source}, index ${index}.`);
  }

  const visual = value['visual'];

  if (
    typeof visual['visualRadius'] !== 'number' ||
    !isEnumValue(visual['scaleMode'], ['physical', 'exaggerated', 'adaptive'])
  ) {
    throw new Error(`Définition visuelle invalide pour ${value['id']}.`);
  }
  if (
    (visual['galaxyShape'] !== undefined &&
      !isEnumValue(visual['galaxyShape'], ['spiral', 'elliptical', 'irregular'])) ||
    (visual['galaxyAxisRatio'] !== undefined &&
      (!isPositiveFiniteNumber(visual['galaxyAxisRatio']) || visual['galaxyAxisRatio'] > 1)) ||
    (visual['galaxyRotationDegrees'] !== undefined &&
      (typeof visual['galaxyRotationDegrees'] !== 'number' ||
        !Number.isFinite(visual['galaxyRotationDegrees'])))
  ) {
    throw new Error(`Forme galactique invalide pour ${value['id']}.`);
  }
  if (
    (value['type'] === 'black-hole' &&
      !isEnumValue(visual['blackHoleActivity'], BLACK_HOLE_ACTIVITIES)) ||
    (visual['blackHoleActivity'] !== undefined &&
      !isEnumValue(visual['blackHoleActivity'], BLACK_HOLE_ACTIVITIES))
  ) {
    throw new Error(`Activité de trou noir invalide pour ${value['id']}.`);
  }
  if (
    visual['accretionDiskInclinationDegrees'] !== undefined &&
    (!isFiniteNumber(visual['accretionDiskInclinationDegrees']) ||
      visual['accretionDiskInclinationDegrees'] < 0 ||
      visual['accretionDiskInclinationDegrees'] > 90)
  ) {
    throw new Error(`Inclinaison du disque d’accrétion invalide pour ${value['id']}.`);
  }
  if (
    (value['aliases'] !== undefined &&
      (!Array.isArray(value['aliases']) ||
        !value['aliases'].every((alias) => typeof alias === 'string'))) ||
    (value['parentId'] !== undefined && typeof value['parentId'] !== 'string')
  ) {
    throw new Error(`Alias ou parent invalide pour ${value['id']}.`);
  }

  const provider = parsePositionProvider(value['positionProvider'], value['id']);

  // Validation structurale effectuée ci-dessus. Le cast conserve les propriétés
  // optionnelles du fichier tout en empêchant des données non validées d'entrer.
  return {
    ...(value as unknown as SpaceObject),
    positionProvider: provider,
  };
}

function parsePositionProvider(value: unknown, objectId: string): PositionProviderDefinition {
  if (!isRecord(value) || typeof value['type'] !== 'string') {
    throw new Error(`Fournisseur de position manquant pour ${objectId}.`);
  }

  switch (value['type']) {
    case 'static':
      if (!isTuple3(value['position']) || !isEnumValue(value['unit'], DISTANCE_UNITS)) {
        break;
      }

      return value as unknown as PositionProviderDefinition;
    case 'catalog':
      if (
        typeof value['catalogId'] === 'string' &&
        value['catalogId'].trim().length > 0 &&
        typeof value['identifier'] === 'string' &&
        value['identifier'].trim().length > 0
      ) {
        return value as unknown as PositionProviderDefinition;
      }
      break;
    case 'keplerian':
      if (
        typeof value['semiMajorAxis'] === 'number' &&
        typeof value['eccentricity'] === 'number' &&
        typeof value['inclination'] === 'number' &&
        typeof value['longitudeOfAscendingNode'] === 'number' &&
        typeof value['argumentOfPeriapsis'] === 'number' &&
        typeof value['meanAnomalyAtEpoch'] === 'number' &&
        typeof value['epochJulianDay'] === 'number' &&
        isPositiveFiniteNumber(value['semiMajorAxis']) &&
        isEccentricity(value['eccentricity']) &&
        isFiniteNumber(value['inclination']) &&
        isFiniteNumber(value['longitudeOfAscendingNode']) &&
        isFiniteNumber(value['argumentOfPeriapsis']) &&
        isFiniteNumber(value['meanAnomalyAtEpoch']) &&
        isFiniteNumber(value['epochJulianDay']) &&
        isPositiveFiniteNumber(value['orbitalPeriodDays']) &&
        isEnumValue(value['unit'], DISTANCE_UNITS) &&
        (value['distanceScale'] === undefined || isPositiveFiniteNumber(value['distanceScale']))
      ) {
        return value as unknown as PositionProviderDefinition;
      }
      break;
    case 'ephemeris':
      if (
        isEnumValue(value['body'], EPHEMERIS_BODIES) &&
        isEnumValue(value['origin'], EPHEMERIS_ORIGINS) &&
        isValidEphemerisOrigin(value['body'], value['origin']) &&
        isPositiveFiniteNumber(value['orbitalPeriodDays']) &&
        typeof value['orbitEpochJulianDay'] === 'number' &&
        Number.isFinite(value['orbitEpochJulianDay']) &&
        (value['distanceScale'] === undefined || isPositiveFiniteNumber(value['distanceScale']))
      ) {
        return value as unknown as PositionProviderDefinition;
      }
      break;
    case 'linear-motion':
      if (
        isTuple3(value['positionAtEpoch']) &&
        isTuple3(value['velocityPerDay']) &&
        typeof value['epochJulianDay'] === 'number' &&
        isEnumValue(value['unit'], DISTANCE_UNITS)
      ) {
        return value as unknown as PositionProviderDefinition;
      }
      break;
    case 'procedural':
      if (typeof value['generatorId'] === 'string' && typeof value['seed'] === 'number') {
        return value as unknown as PositionProviderDefinition;
      }
      break;
  }

  throw new Error(`Fournisseur de position invalide pour ${objectId}.`);
}

function isTuple3(value: unknown): value is [number, number, number] {
  return (
    Array.isArray(value) &&
    value.length === 3 &&
    value.every((coordinate) => typeof coordinate === 'number')
  );
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function isEnumValue<T extends string>(value: unknown, allowed: readonly T[]): value is T {
  return typeof value === 'string' && allowed.some((candidate) => candidate === value);
}

function isValidEphemerisOrigin(body: EphemerisBody, origin: EphemerisOrigin): boolean {
  if (body === 'moon') {
    return origin === 'earth';
  }
  if (body === 'io' || body === 'europa' || body === 'ganymede' || body === 'callisto') {
    return origin === 'jupiter';
  }

  return origin === 'sun';
}

function isPositiveFiniteNumber(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value) && value > 0;
}

function isFiniteNumber(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value);
}

function isEccentricity(value: unknown): value is number {
  return isFiniteNumber(value) && value >= 0 && value < 1;
}
