import {
  HorizonFromVector,
  MakeTime,
  Observer,
  RotateVector,
  Rotation_EQJ_HOR,
  Rotation_HOR_EQJ,
  Vector,
} from 'astronomy-engine';
import type { UniverseTime, Vector3Like } from '../../data/models/universe.models';
import { equatorialJ2000ToGalacticScene } from '../coordinates/galactic-reference-frame';
import {
  astronomyEngineDaysSinceJ2000,
  isAstronomyEngineTimeSupported,
} from './astronomy-engine-time-domain';

export interface EquatorialSkyCoordinates {
  readonly rightAscensionDegrees: number;
  readonly declinationDegrees: number;
}

export interface StellarObservationCatalogEntry {
  readonly id: string;
  readonly name: string;
  readonly coordinates: EquatorialSkyCoordinates;
  readonly apparentMagnitude: number;
  readonly color: string;
}

export interface StellarObservationConstellationSegment {
  readonly from: StellarObservationCatalogEntry;
  readonly to: StellarObservationCatalogEntry;
}

export interface StellarObservationConstellation {
  readonly id: string;
  readonly name: string;
  readonly abbreviation: string;
  readonly segments: readonly StellarObservationConstellationSegment[];
}

export interface EarthObservationLocation {
  readonly latitude: number;
  readonly longitude: number;
  readonly heightMeters?: number;
}

export interface EarthObserverReferenceFrame {
  readonly northDirection: Vector3Like;
  readonly zenithDirection: Vector3Like;
}

export type CompassDirection =
  'north' | 'northeast' | 'east' | 'southeast' | 'south' | 'southwest' | 'west' | 'northwest';

export interface StellarObservation {
  readonly altitudeDegrees: number;
  readonly geometricAltitudeDegrees: number;
  readonly atmosphericRefractionDegrees: number;
  readonly azimuthDegrees: number;
  readonly compassDirection: CompassDirection;
  readonly isAboveHorizon: boolean;
}

export type StellarObservationCalculator = (
  coordinates: EquatorialSkyCoordinates,
) => StellarObservation;

const COMPASS_DIRECTIONS: readonly CompassDirection[] = [
  'north',
  'northeast',
  'east',
  'southeast',
  'south',
  'southwest',
  'west',
  'northwest',
];

export function equatorialCoordinatesFromCartesian(
  position: Vector3Like,
): EquatorialSkyCoordinates {
  const distance = Math.hypot(position.x, position.y, position.z);

  if (!Number.isFinite(distance) || distance === 0) {
    throw new Error('Vecteur équatorial J2000 invalide.');
  }
  const rightAscensionRadians = Math.atan2(position.y, position.x);

  return {
    rightAscensionDegrees: normalizeDegrees((rightAscensionRadians * 180) / Math.PI),
    declinationDegrees: (Math.asin(position.z / distance) * 180) / Math.PI,
  };
}

export function calculateStellarObservation(
  time: UniverseTime,
  coordinates: EquatorialSkyCoordinates,
  location: EarthObservationLocation,
): StellarObservation | null {
  assertCoordinates(coordinates);
  const calculate = createStellarObservationCalculator(time, location);

  return calculate?.(coordinates) ?? null;
}

export function createStellarObservationCalculator(
  time: UniverseTime,
  location: EarthObservationLocation,
): StellarObservationCalculator | null {
  assertLocation(location);

  if (!isAstronomyEngineTimeSupported(time)) {
    return null;
  }
  const astronomyTime = MakeTime(astronomyEngineDaysSinceJ2000(time));
  const horizontalRotation = Rotation_EQJ_HOR(
    astronomyTime,
    new Observer(location.latitude, location.longitude, location.heightMeters ?? 0),
  );

  return (coordinates) => {
    assertCoordinates(coordinates);
    const equatorialVector = createEquatorialUnitVector(coordinates, astronomyTime);
    const horizontalVector = RotateVector(horizontalRotation, equatorialVector);
    const geometric = HorizonFromVector(horizontalVector, '');
    const apparent = HorizonFromVector(horizontalVector, 'normal');

    return {
      altitudeDegrees: apparent.lat,
      geometricAltitudeDegrees: geometric.lat,
      atmosphericRefractionDegrees: apparent.lat - geometric.lat,
      azimuthDegrees: apparent.lon,
      compassDirection: compassDirection(apparent.lon),
      isAboveHorizon: apparent.lat >= 0,
    };
  };
}

export function calculateEarthObserverZenithDirection(
  time: UniverseTime,
  location: EarthObservationLocation,
): Vector3Like | null {
  return calculateEarthObserverReferenceFrame(time, location)?.zenithDirection ?? null;
}

export function calculateEarthObserverReferenceFrame(
  time: UniverseTime,
  location: EarthObservationLocation,
): EarthObserverReferenceFrame | null {
  assertLocation(location);
  if (!isAstronomyEngineTimeSupported(time)) {
    return null;
  }
  const astronomyTime = MakeTime(astronomyEngineDaysSinceJ2000(time));
  const horizontalToEquatorial = Rotation_HOR_EQJ(
    astronomyTime,
    new Observer(location.latitude, location.longitude, location.heightMeters ?? 0),
  );
  const equatorialNorth = RotateVector(horizontalToEquatorial, new Vector(1, 0, 0, astronomyTime));
  const equatorialZenith = RotateVector(horizontalToEquatorial, new Vector(0, 0, 1, astronomyTime));

  return {
    northDirection: equatorialJ2000ToGalacticScene(equatorialNorth),
    zenithDirection: equatorialJ2000ToGalacticScene(equatorialZenith),
  };
}

function createEquatorialUnitVector(
  coordinates: EquatorialSkyCoordinates,
  time: ReturnType<typeof MakeTime>,
): Vector {
  const rightAscension = (coordinates.rightAscensionDegrees * Math.PI) / 180;
  const declination = (coordinates.declinationDegrees * Math.PI) / 180;
  const projected = Math.cos(declination);

  return new Vector(
    projected * Math.cos(rightAscension),
    projected * Math.sin(rightAscension),
    Math.sin(declination),
    time,
  );
}

function assertCoordinates(coordinates: EquatorialSkyCoordinates): void {
  if (
    !Number.isFinite(coordinates.rightAscensionDegrees) ||
    coordinates.rightAscensionDegrees < 0 ||
    coordinates.rightAscensionDegrees >= 360
  ) {
    throw new RangeError('Ascension droite invalide : valeur attendue entre 0° et 360°.');
  }
  if (
    !Number.isFinite(coordinates.declinationDegrees) ||
    coordinates.declinationDegrees < -90 ||
    coordinates.declinationDegrees > 90
  ) {
    throw new RangeError('Déclinaison invalide : valeur attendue entre −90° et 90°.');
  }
}

function assertLocation(location: EarthObservationLocation): void {
  if (!Number.isFinite(location.latitude) || location.latitude < -90 || location.latitude > 90) {
    throw new RangeError('Latitude d’observation invalide.');
  }
  if (
    !Number.isFinite(location.longitude) ||
    location.longitude < -180 ||
    location.longitude > 180
  ) {
    throw new RangeError('Longitude d’observation invalide.');
  }
  if (location.heightMeters !== undefined && !Number.isFinite(location.heightMeters)) {
    throw new RangeError('Altitude de l’observateur invalide.');
  }
}

function compassDirection(azimuthDegrees: number): CompassDirection {
  const index = Math.floor((normalizeDegrees(azimuthDegrees) + 22.5) / 45) % 8;

  return COMPASS_DIRECTIONS[index]!;
}

function normalizeDegrees(value: number): number {
  return ((value % 360) + 360) % 360;
}
