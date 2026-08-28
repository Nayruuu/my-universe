import type { SpaceObject, UniverseTime } from '../../../data/models/universe.models';
import {
  calculateSolarSystemSky,
  isSolarSystemSkyBodyId,
} from '../../../engine/simulation/solar-system-sky';
import {
  calculateSolarSystemSatelliteSkyObservation,
  isSolarSystemSatelliteSkyTarget,
} from '../../../engine/simulation/solar-system-satellite-sky';
import type {
  EarthObservationLocation,
  EquatorialSkyCoordinates,
  StellarObservation,
  StellarObservationCatalogEntry,
} from '../../../engine/simulation/stellar-observation';
import { calculateStellarObservation } from '../../../engine/simulation/stellar-observation';

const DEFAULT_STAR_COLOR = '#dce9ff';

export type EarthSkyCatalogStar = StellarObservationCatalogEntry;

export function createEarthSkyCatalog(
  objects: readonly SpaceObject[],
  maximumStarCount: number,
): readonly EarthSkyCatalogStar[] {
  if (!Number.isInteger(maximumStarCount) || maximumStarCount <= 0) {
    throw new RangeError('Le nombre maximal d’étoiles doit être un entier positif.');
  }

  return objects
    .flatMap((object): readonly EarthSkyCatalogStar[] => {
      const entry = createEarthSkyTarget(object);

      if (
        entry === null ||
        typeof object.metadata?.['apparentMagnitude'] !== 'number' ||
        !Number.isFinite(object.metadata['apparentMagnitude'])
      ) {
        return [];
      }

      return [entry];
    })
    .sort((left, right) => left.apparentMagnitude - right.apparentMagnitude)
    .slice(0, maximumStarCount);
}

export function createEarthSkyTarget(object: SpaceObject): EarthSkyCatalogStar | null {
  const coordinates = equatorialCoordinates(object);

  if (object.type !== 'star' || coordinates === null) {
    return null;
  }
  const apparentMagnitude = object.metadata?.['apparentMagnitude'];

  return {
    id: object.id,
    name: object.name,
    coordinates,
    apparentMagnitude:
      typeof apparentMagnitude === 'number' && Number.isFinite(apparentMagnitude)
        ? apparentMagnitude
        : 6,
    color: object.visual?.color ?? DEFAULT_STAR_COLOR,
  };
}

export function equatorialCoordinates(object: SpaceObject): EquatorialSkyCoordinates | null {
  const rightAscensionDegrees = object.metadata?.['rightAscensionDegrees'];
  const declinationDegrees = object.metadata?.['declinationDegrees'];
  const coordinateEpoch = object.metadata?.['skyCoordinateEpoch'];

  return coordinateEpoch === 'J2000' &&
    typeof rightAscensionDegrees === 'number' &&
    typeof declinationDegrees === 'number'
    ? { rightAscensionDegrees, declinationDegrees }
    : null;
}

export function isEarthSkyTarget(object: SpaceObject): boolean {
  return (
    createEarthSkyTarget(object) !== null ||
    isSolarSystemSkyBodyId(object.id) ||
    isSolarSystemSatelliteSkyTarget(object)
  );
}

export function calculateEarthSkyTargetObservation(
  object: SpaceObject,
  time: UniverseTime,
  location: EarthObservationLocation,
): StellarObservation | null {
  const stellarTarget = createEarthSkyTarget(object);

  if (stellarTarget) {
    return calculateStellarObservation(time, stellarTarget.coordinates, location);
  }
  if (isSolarSystemSkyBodyId(object.id)) {
    return (
      calculateSolarSystemSky(time, location).find(({ id }) => id === object.id)?.observation ??
      null
    );
  }

  return calculateSolarSystemSatelliteSkyObservation(time, location, object)?.observation ?? null;
}
