import type {
  BlackHoleActivity,
  ReferenceFrame,
  RotationOrientationModel,
  ScientificConfidence,
  SpaceObject,
  SpaceObjectType,
} from '../models/universe.models';
import { parsePositionProvider } from './position-provider-validator';
import {
  isEnumValue,
  isFiniteNumber,
  isPositiveFiniteNumber,
  isRecord,
} from './validation-primitives';

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
  'supernova',
  'supernova-remnant',
  'star',
  'planet',
  'exoplanet',
  'dwarf-planet',
  'moon',
  'asteroid',
  'comet',
  'artificial-object',
  'region',
];

const BLACK_HOLE_ACTIVITIES: readonly BlackHoleActivity[] = ['dormant', 'quiescent', 'active'];

const ROTATION_ORIENTATION_MODELS: readonly RotationOrientationModel[] = [
  'earth-geographic',
  'iau-wgccre-2009',
  'iau-wgccre-2015',
  'damit-iau-2020',
];

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

export function parseSpaceObject(value: unknown, source: string, index: number): SpaceObject {
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
  if (value['rotation'] !== undefined && !isValidRotationDefinition(value['rotation'])) {
    throw new Error(`Rotation invalide pour ${value['id']}.`);
  }
  if (value['cometActivity'] !== undefined && !isValidCometActivity(value['cometActivity'])) {
    throw new Error(`Activité cométaire invalide pour ${value['id']}.`);
  }
  const physical = value['physical'];

  if (
    isRecord(physical) &&
    physical['shape'] !== undefined &&
    !isValidTriaxialBodyShape(physical['shape'])
  ) {
    throw new Error(`Forme physique invalide pour ${value['id']}.`);
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

  return {
    ...(value as unknown as SpaceObject),
    positionProvider: provider,
  };
}

function isValidRotationDefinition(value: unknown): boolean {
  return (
    isRecord(value) &&
    isPositiveFiniteNumber(value['siderealPeriodHours']) &&
    isEnumValue(value['direction'], ['prograde', 'retrograde']) &&
    typeof value['bodyFixedFrame'] === 'string' &&
    value['bodyFixedFrame'].trim().length > 0 &&
    isEnumValue(value['orientationModel'], ROTATION_ORIENTATION_MODELS) &&
    isEnumValue(value['scientificConfidence'], CONFIDENCE_LEVELS) &&
    typeof value['source'] === 'string' &&
    value['source'].trim().length > 0
  );
}

function isValidCometActivity(value: unknown): boolean {
  if (!isRecord(value)) {
    return false;
  }
  const activationDistanceAu = value['activationDistanceAu'];
  const saturatedDistanceAu = value['saturatedDistanceAu'];

  return (
    isPositiveFiniteNumber(activationDistanceAu) &&
    isFiniteNumber(saturatedDistanceAu) &&
    saturatedDistanceAu >= 0 &&
    saturatedDistanceAu < activationDistanceAu &&
    isEnumValue(value['scientificConfidence'], CONFIDENCE_LEVELS) &&
    typeof value['source'] === 'string' &&
    value['source'].trim().length > 0
  );
}

function isValidTriaxialBodyShape(value: unknown): boolean {
  if (!isRecord(value) || value['type'] !== 'triaxial-ellipsoid') {
    return false;
  }
  const dimensions = value['dimensionsKm'];

  return (
    Array.isArray(dimensions) &&
    dimensions.length === 3 &&
    dimensions.every(isPositiveFiniteNumber) &&
    isEnumValue(value['scientificConfidence'], CONFIDENCE_LEVELS) &&
    typeof value['source'] === 'string' &&
    value['source'].trim().length > 0
  );
}
