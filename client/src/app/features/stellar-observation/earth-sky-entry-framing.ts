import type { SpaceObject, UniverseTime } from '../../../data/models/universe.models';
import type { EarthObserverFraming } from '../../../engine/camera/earth-observer-camera-control';
import {
  EARTH_OBSERVER_FIELD_OF_VIEW_DEGREES,
  EARTH_OBSERVER_MAXIMUM_FIELD_OF_VIEW_DEGREES,
} from '../../../engine/camera/earth-observer-view.constants';
import type { EarthObservationLocation } from '../../../engine/simulation/stellar-observation';
import { calculateEarthObserverReferenceFrame } from '../../../engine/simulation/stellar-observation';
import { calculateEarthSkyDirection } from '../../../engine/simulation/solar-system-sky';
import { calculateEarthSkyTargetObservation } from './earth-sky-catalog';

const MINIMUM_ENTRY_ALTITUDE_DEGREES = 18;
const TARGET_EDGE_CLEARANCE_DEGREES = 6;

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
  preservedHorizonPercentage?: number,
): EarthSkyEntryFraming {
  const observation = calculateEarthSkyTargetObservation(target, time, location);
  const referenceFrame = calculateEarthObserverReferenceFrame(time, location);

  if (!observation || !referenceFrame) {
    return DEFAULT_EARTH_SKY_ENTRY_FRAMING;
  }
  const targetAltitudeDegrees = observation.geometricAltitudeDegrees;
  const targetAltitudeAboveHorizonDegrees = Math.max(0, targetAltitudeDegrees);
  const verticalFieldOfViewDegrees = Math.min(
    EARTH_OBSERVER_MAXIMUM_FIELD_OF_VIEW_DEGREES,
    Math.max(
      EARTH_OBSERVER_FIELD_OF_VIEW_DEGREES,
      targetAltitudeAboveHorizonDegrees + TARGET_EDGE_CLEARANCE_DEGREES * 2,
    ),
  );
  const safeHalfFieldOfViewDegrees = verticalFieldOfViewDegrees / 2 - TARGET_EDGE_CLEARANCE_DEGREES;
  const minimumSafeCenterAltitudeDegrees =
    targetAltitudeAboveHorizonDegrees - safeHalfFieldOfViewDegrees;
  const maximumSafeCenterAltitudeDegrees = safeHalfFieldOfViewDegrees;
  const pitchLimits = {
    minimumPitchOffsetDegrees: EARTH_SKY_MINIMUM_ALTITUDE_DEGREES - targetAltitudeDegrees,
    maximumPitchOffsetDegrees: EARTH_SKY_MAXIMUM_ALTITUDE_DEGREES - targetAltitudeDegrees,
  };
  const preferredCenterAltitudeDegrees =
    preservedHorizonPercentage === undefined
      ? Math.max(
          MINIMUM_ENTRY_ALTITUDE_DEGREES,
          Math.min(targetAltitudeAboveHorizonDegrees, maximumSafeCenterAltitudeDegrees),
        )
      : ((Math.min(100, Math.max(0, preservedHorizonPercentage)) - 50) / 100) *
        verticalFieldOfViewDegrees;
  const safeCenterAltitudeDegrees = Math.min(
    maximumSafeCenterAltitudeDegrees,
    Math.max(minimumSafeCenterAltitudeDegrees, preferredCenterAltitudeDegrees),
  );
  const initialPitchOffsetDegrees = Math.min(
    pitchLimits.maximumPitchOffsetDegrees,
    Math.max(
      pitchLimits.minimumPitchOffsetDegrees,
      safeCenterAltitudeDegrees - targetAltitudeDegrees,
    ),
  );

  return {
    initialCenterAltitudeDegrees: targetAltitudeDegrees + initialPitchOffsetDegrees,
    initialPitchOffsetDegrees,
    pitchLimits,
    verticalFieldOfViewDegrees,
    targetDirection: calculateEarthSkyDirection(
      observation.altitudeDegrees,
      observation.azimuthDegrees,
      referenceFrame,
    ),
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
  fieldOfViewDegrees?: number,
): EarthSkyEntryFraming {
  const resolvedFieldOfViewDegrees =
    fieldOfViewDegrees ??
    framing.verticalFieldOfViewDegrees ??
    EARTH_OBSERVER_FIELD_OF_VIEW_DEGREES;
  const visibleHorizonPercentage = Math.min(120, Math.max(0, horizonPercentage));
  const centerAltitudeDegrees =
    ((visibleHorizonPercentage - 50) / 100) * resolvedFieldOfViewDegrees;
  const initialPitchOffsetDegrees = Math.min(
    framing.pitchLimits.maximumPitchOffsetDegrees,
    Math.max(
      framing.pitchLimits.minimumPitchOffsetDegrees,
      centerAltitudeDegrees - targetAltitudeDegrees,
    ),
  );

  return {
    ...framing,
    initialCenterAltitudeDegrees: targetAltitudeDegrees + initialPitchOffsetDegrees,
    initialPitchOffsetDegrees,
  };
}
