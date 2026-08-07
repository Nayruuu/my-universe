import type { UniverseTime } from '../../../data/models/universe.models';
import type { EarthObserverLocation } from '../../../engine/simulation/earth-observer-location';
import type { SolarSystemSkyObservation } from '../../../engine/simulation/solar-system-sky';
import {
  createStellarObservationCalculator,
  type StellarObservation,
  type StellarObservationCatalogEntry,
} from '../../../engine/simulation/stellar-observation';
import { isEarthTerrainObstructed } from './earth-terrain-horizon-catalog';
import type { EarthTerrainHorizonProfile } from './earth-terrain-horizon-catalog.types';

export const EARTH_OBSERVATION_PLANNER_CATALOG_SIZE = 48;
export const EARTH_OBSERVATION_PLANNER_STAR_LIMIT = 8;

interface EarthObservationPlannerBaseItem {
  readonly id: string;
  readonly fallbackName: string;
  readonly color: string;
  readonly observation: StellarObservation;
  readonly assistedVisibility: boolean;
}

export interface EarthObservationPlannerSolarSystemItem extends EarthObservationPlannerBaseItem {
  readonly kind: 'solar-system';
  readonly apparentMagnitude: null;
}

export interface EarthObservationPlannerStarItem extends EarthObservationPlannerBaseItem {
  readonly kind: 'star';
  readonly apparentMagnitude: number;
}

export type EarthObservationPlannerItem =
  EarthObservationPlannerSolarSystemItem | EarthObservationPlannerStarItem;

export interface EarthObservationPlan {
  readonly solarSystem: readonly EarthObservationPlannerSolarSystemItem[];
  readonly stars: readonly EarthObservationPlannerStarItem[];
  readonly totalCount: number;
  readonly terrainApplied: boolean;
}

export interface EarthObservationPlannerInput {
  readonly time: UniverseTime;
  readonly location: EarthObserverLocation;
  readonly solarSystem: readonly SolarSystemSkyObservation[];
  readonly stars: readonly StellarObservationCatalogEntry[];
  readonly terrainHorizon: EarthTerrainHorizonProfile | null;
  readonly maximumStarCount?: number;
}

export function createEarthObservationPlan({
  time,
  location,
  solarSystem,
  stars,
  terrainHorizon,
  maximumStarCount = EARTH_OBSERVATION_PLANNER_STAR_LIMIT,
}: EarthObservationPlannerInput): EarthObservationPlan {
  const calculateObservation = createStellarObservationCalculator(time, location);
  const visibleSolarSystem = solarSystem
    .filter(({ observation }) => isObservable(observation, terrainHorizon))
    .map(
      ({ id, fallbackName, color, observation, assistedVisibility }) =>
        ({
          id,
          fallbackName,
          color,
          kind: 'solar-system',
          observation,
          apparentMagnitude: null,
          assistedVisibility,
        }) satisfies EarthObservationPlannerSolarSystemItem,
    )
    .sort(compareAltitudeDescending);
  const visibleStars = calculateObservation
    ? stars
        .map(
          ({ id, name, color, apparentMagnitude, coordinates }) =>
            ({
              id,
              fallbackName: name,
              color,
              kind: 'star',
              observation: calculateObservation(coordinates),
              apparentMagnitude,
              assistedVisibility: false,
            }) satisfies EarthObservationPlannerStarItem,
        )
        .filter(({ observation }) => isObservable(observation, terrainHorizon))
        .sort(compareStars)
        .slice(0, normalizeMaximumStarCount(maximumStarCount))
    : [];

  return {
    solarSystem: visibleSolarSystem,
    stars: visibleStars,
    totalCount: visibleSolarSystem.length + visibleStars.length,
    terrainApplied: terrainHorizon !== null,
  };
}

function isObservable(
  observation: StellarObservation,
  terrainHorizon: EarthTerrainHorizonProfile | null,
): boolean {
  return (
    observation.isAboveHorizon &&
    (!terrainHorizon ||
      !isEarthTerrainObstructed(
        terrainHorizon,
        observation.geometricAltitudeDegrees,
        observation.azimuthDegrees,
      ))
  );
}

function compareAltitudeDescending(
  left: EarthObservationPlannerBaseItem,
  right: EarthObservationPlannerBaseItem,
): number {
  return right.observation.altitudeDegrees - left.observation.altitudeDegrees;
}

function compareStars(
  left: EarthObservationPlannerStarItem,
  right: EarthObservationPlannerStarItem,
): number {
  return left.apparentMagnitude - right.apparentMagnitude || compareAltitudeDescending(left, right);
}

function normalizeMaximumStarCount(value: number): number {
  return Number.isFinite(value) ? Math.max(0, Math.floor(value)) : 0;
}
