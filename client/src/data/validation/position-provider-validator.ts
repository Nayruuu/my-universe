import type {
  DistanceUnit,
  EphemerisBody,
  EphemerisOrigin,
  PositionProviderDefinition,
} from '../models/universe.models';
import {
  isEccentricity,
  isEnumValue,
  isFiniteNumber,
  isPositiveFiniteNumber,
  isRecord,
  isTuple3,
} from './validation-primitives';

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

export function parsePositionProvider(
  value: unknown,
  objectId: string,
): PositionProviderDefinition {
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
        (value['distanceScale'] === undefined || isPositiveFiniteNumber(value['distanceScale'])) &&
        isValidReferencePlanePole(value['referencePlanePole'])
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
    case 'illustrative-orbit':
      if (
        isPositiveFiniteNumber(value['semiMajorAxis']) &&
        isPositiveFiniteNumber(value['orbitalPeriodDays']) &&
        isFiniteNumber(value['epochJulianDay']) &&
        isFiniteNumber(value['visualPhaseAtEpochDegrees']) &&
        isFiniteNumber(value['visualInclinationDegrees']) &&
        isEnumValue(value['unit'], DISTANCE_UNITS) &&
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

function isValidReferencePlanePole(value: unknown): boolean {
  if (value === undefined) {
    return true;
  }

  return (
    isRecord(value) &&
    isFiniteNumber(value['rightAscensionDegrees']) &&
    value['rightAscensionDegrees'] >= 0 &&
    value['rightAscensionDegrees'] < 360 &&
    isFiniteNumber(value['declinationDegrees']) &&
    value['declinationDegrees'] >= -90 &&
    value['declinationDegrees'] <= 90
  );
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
