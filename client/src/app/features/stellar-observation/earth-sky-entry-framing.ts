import type { SpaceObject, UniverseTime } from '../../../data/models/universe.models';
import {
  EARTH_OBSERVER_FIELD_OF_VIEW_DEGREES,
  type EarthObserverFraming,
} from '../../../engine/camera/earth-observer-camera-control';
import type { EarthObservationLocation } from '../../../engine/simulation/stellar-observation';
import {
  calculateEarthObserverReferenceFrame,
  calculateStellarObservation,
} from '../../../engine/simulation/stellar-observation';
import { equatorialCoordinates } from './earth-sky-catalog';

const MINIMUM_ENTRY_ALTITUDE_DEGREES = 18;

export const EARTH_SKY_MINIMUM_ALTITUDE_DEGREES = 6;
export const EARTH_SKY_MAXIMUM_ALTITUDE_DEGREES = 88;

export type EarthSkyEntryFraming = EarthObserverFraming;

const DEFAULT_EARTH_SKY_ENTRY_FRAMING: EarthSkyEntryFraming = {
  initialPitchOffsetDegrees: 0,
  pitchLimits: {
    minimumPitchOffsetDegrees: -88,
    maximumPitchOffsetDegrees: 88,
  },
};

export function earthSkyEntryFraming(
  target: SpaceObject,
  time: UniverseTime,
  location: EarthObservationLocation,
): EarthSkyEntryFraming {
  const coordinates = equatorialCoordinates(target);

  if (!coordinates) {
    return DEFAULT_EARTH_SKY_ENTRY_FRAMING;
  }
  const observation = calculateStellarObservation(time, coordinates, location);
  const referenceFrame = calculateEarthObserverReferenceFrame(time, location);

  if (!observation || !referenceFrame) {
    return DEFAULT_EARTH_SKY_ENTRY_FRAMING;
  }
  const targetAltitudeDegrees = observation.geometricAltitudeDegrees;
  const pitchLimits = {
    minimumPitchOffsetDegrees: EARTH_SKY_MINIMUM_ALTITUDE_DEGREES - targetAltitudeDegrees,
    maximumPitchOffsetDegrees: EARTH_SKY_MAXIMUM_ALTITUDE_DEGREES - targetAltitudeDegrees,
  };

  return {
    initialPitchOffsetDegrees: Math.min(
      pitchLimits.maximumPitchOffsetDegrees,
      Math.max(
        pitchLimits.minimumPitchOffsetDegrees,
        Math.max(0, MINIMUM_ENTRY_ALTITUDE_DEGREES - targetAltitudeDegrees),
      ),
    ),
    pitchLimits,
    northDirection: referenceFrame.northDirection,
    zenithDirection: referenceFrame.zenithDirection,
    resolveReferenceFrame: (currentTime) =>
      calculateEarthObserverReferenceFrame(currentTime, location),
  };
}

export function earthSkyEntryPitchOffset(
  target: SpaceObject,
  time: UniverseTime,
  location: EarthObservationLocation,
): number {
  return earthSkyEntryFraming(target, time, location).initialPitchOffsetDegrees;
}

export function earthSkyFramingForHorizon(
  framing: EarthSkyEntryFraming,
  targetAltitudeDegrees: number,
  horizonPercentage: number,
  fieldOfViewDegrees = EARTH_OBSERVER_FIELD_OF_VIEW_DEGREES,
): EarthSkyEntryFraming {
  const visibleHorizonPercentage = Math.min(120, Math.max(0, horizonPercentage));
  const centerAltitudeDegrees = ((visibleHorizonPercentage - 50) / 100) * fieldOfViewDegrees;

  return {
    ...framing,
    initialPitchOffsetDegrees: Math.min(
      framing.pitchLimits.maximumPitchOffsetDegrees,
      Math.max(
        framing.pitchLimits.minimumPitchOffsetDegrees,
        centerAltitudeDegrees - targetAltitudeDegrees,
      ),
    ),
  };
}
