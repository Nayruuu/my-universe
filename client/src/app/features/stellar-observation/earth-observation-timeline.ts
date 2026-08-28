import type { UniverseTime } from '../../../data/models/universe.models';
import type { StellarObservation } from '../../../engine/simulation/stellar-observation';
import { earthTerrainObstructionDegrees } from './earth-terrain-horizon-catalog';
import type { EarthTerrainHorizonProfile } from './earth-terrain-horizon-catalog.types';

export const EARTH_OBSERVATION_TIMELINE_HOURS = 24;
export const EARTH_OBSERVATION_TIMELINE_SAMPLE_MINUTES = 30;
export const EARTH_OBSERVATION_TIMELINE_CHART_WIDTH = 320;
export const EARTH_OBSERVATION_TIMELINE_CHART_HEIGHT = 112;

export type EarthObservationTwilight = 'daylight' | 'civil' | 'nautical' | 'astronomical' | 'night';

export interface EarthObservationTimelineTarget {
  readonly id: string;
  readonly fallbackName: string;
  readonly color: string;
}

export interface EarthObservationTimelineSample {
  readonly target: StellarObservation;
  readonly sun: StellarObservation;
  readonly moon: StellarObservation;
  readonly moonIlluminatedFraction: number;
}

export interface EarthObservationTimelinePoint {
  readonly time: UniverseTime;
  readonly targetObservation: StellarObservation;
  readonly targetAltitudeDegrees: number;
  readonly terrainAltitudeDegrees: number;
  readonly clearanceDegrees: number;
  readonly sunAltitudeDegrees: number;
  readonly twilight: EarthObservationTwilight;
  readonly moonAltitudeDegrees: number;
  readonly moonSeparationDegrees: number;
  readonly moonInterference: number;
  readonly quality: number;
  readonly visible: boolean;
  readonly chartX: number;
  readonly chartY: number;
  readonly terrainChartY: number;
}

export interface EarthObservationTimeline {
  readonly target: EarthObservationTimelineTarget;
  readonly startTime: UniverseTime;
  readonly endTime: UniverseTime;
  readonly sampleMinutes: number;
  readonly points: readonly EarthObservationTimelinePoint[];
  readonly targetPolyline: string;
  readonly terrainPolyline: string;
  readonly riseTime: UniverseTime | null;
  readonly culminationTime: UniverseTime;
  readonly culminationAltitudeDegrees: number;
  readonly setTime: UniverseTime | null;
  readonly bestPoint: EarthObservationTimelinePoint | null;
  readonly bestWindowStart: UniverseTime | null;
  readonly bestWindowEnd: UniverseTime | null;
  readonly terrainApplied: boolean;
  readonly scoreConfidence: 'illustrative';
}

export interface EarthObservationTimelineInput {
  readonly startTime: UniverseTime;
  readonly target: EarthObservationTimelineTarget;
  readonly terrainHorizon: EarthTerrainHorizonProfile | null;
  readonly sample: (time: UniverseTime) => EarthObservationTimelineSample | null;
  readonly sampleMinutes?: number;
}

/** Returns the latest local solar noon, a stable anchor for one evening-to-evening window. */
export function earthObservationTimelineStartJulianDay(
  time: UniverseTime,
  longitudeDegrees: number,
): number | null {
  if (!Number.isFinite(longitudeDegrees) || longitudeDegrees < -180 || longitudeDegrees > 180) {
    throw new RangeError('Earth observation timeline longitude must be between −180° and 180°.');
  }
  if (!Number.isFinite(time.julianDay)) {
    return null;
  }
  const localSolarCorrectionDays = longitudeDegrees / 360;

  return Math.floor(time.julianDay + localSolarCorrectionDays) - localSolarCorrectionDays;
}

export function createEarthObservationTimeline({
  startTime,
  target,
  terrainHorizon,
  sample,
  sampleMinutes = EARTH_OBSERVATION_TIMELINE_SAMPLE_MINUTES,
}: EarthObservationTimelineInput): EarthObservationTimeline | null {
  assertSampleMinutes(sampleMinutes);
  if (!Number.isFinite(startTime.julianDay)) {
    return null;
  }
  const intervalCount = (EARTH_OBSERVATION_TIMELINE_HOURS * 60) / sampleMinutes;
  const intervalDays = sampleMinutes / (24 * 60);
  const points: EarthObservationTimelinePoint[] = [];

  for (let index = 0; index <= intervalCount; index += 1) {
    const time = { julianDay: startTime.julianDay + index * intervalDays };
    const sampled = sample(time);

    if (!sampled) {
      return null;
    }
    const terrainAltitudeDegrees = terrainHorizon
      ? earthTerrainObstructionDegrees(terrainHorizon, sampled.target.azimuthDegrees)
      : 0;
    const clearanceDegrees = terrainHorizon
      ? sampled.target.geometricAltitudeDegrees - terrainAltitudeDegrees
      : sampled.target.altitudeDegrees;
    const visible = clearanceDegrees > 0;
    const twilight = earthObservationTwilight(sampled.sun.geometricAltitudeDegrees);
    const moonSeparationDegrees = horizontalAngularSeparationDegrees(sampled.target, sampled.moon);
    const moonInterference = calculateMoonInterference(
      target.id,
      sampled.moon,
      sampled.moonIlluminatedFraction,
      moonSeparationDegrees,
    );
    const quality = calculateIndicativeQuality(
      visible,
      clearanceDegrees,
      sampled.sun.geometricAltitudeDegrees,
      moonInterference,
    );

    points.push({
      time,
      targetObservation: sampled.target,
      targetAltitudeDegrees: sampled.target.altitudeDegrees,
      terrainAltitudeDegrees,
      clearanceDegrees,
      sunAltitudeDegrees: sampled.sun.geometricAltitudeDegrees,
      twilight,
      moonAltitudeDegrees: sampled.moon.altitudeDegrees,
      moonSeparationDegrees,
      moonInterference,
      quality,
      visible,
      chartX: (index / intervalCount) * EARTH_OBSERVATION_TIMELINE_CHART_WIDTH,
      chartY: altitudeChartY(sampled.target.altitudeDegrees),
      terrainChartY: altitudeChartY(terrainAltitudeDegrees),
    });
  }

  const culminationIndex = indexOfMaximum(
    points,
    ({ targetAltitudeDegrees }) => targetAltitudeDegrees,
  );
  const bestIndex = indexOfMaximum(points, ({ quality }) => quality);
  const bestPoint = points[bestIndex]!.quality >= 0.02 ? points[bestIndex]! : null;
  const bestWindow = bestPoint
    ? calculateBestWindow(points, bestIndex, intervalDays, bestPoint.quality)
    : null;
  const { riseTime, setTime } = calculateRiseAndSet(points, culminationIndex);

  return {
    target,
    startTime,
    endTime: { julianDay: startTime.julianDay + 1 },
    sampleMinutes,
    points,
    targetPolyline: chartPolyline(points, ({ chartX, chartY }) => [chartX, chartY]),
    terrainPolyline: chartPolyline(points, ({ chartX, terrainChartY }) => [chartX, terrainChartY]),
    riseTime,
    culminationTime: points[culminationIndex]!.time,
    culminationAltitudeDegrees: points[culminationIndex]!.targetAltitudeDegrees,
    setTime,
    bestPoint,
    bestWindowStart: bestWindow?.start ?? null,
    bestWindowEnd: bestWindow?.end ?? null,
    terrainApplied: terrainHorizon !== null,
    scoreConfidence: 'illustrative',
  };
}

export function earthObservationTwilight(
  sunGeometricAltitudeDegrees: number,
): EarthObservationTwilight {
  // USNO definitions use the Sun centre at 6°, 12°, and 18° below the geometric horizon.
  // https://aa.usno.navy.mil/faq/RST_defs
  if (sunGeometricAltitudeDegrees >= 0) {
    return 'daylight';
  }
  if (sunGeometricAltitudeDegrees >= -6) {
    return 'civil';
  }
  if (sunGeometricAltitudeDegrees >= -12) {
    return 'nautical';
  }

  return sunGeometricAltitudeDegrees >= -18 ? 'astronomical' : 'night';
}

export function horizontalAngularSeparationDegrees(
  first: Pick<StellarObservation, 'altitudeDegrees' | 'azimuthDegrees'>,
  second: Pick<StellarObservation, 'altitudeDegrees' | 'azimuthDegrees'>,
): number {
  const firstAltitude = degreesToRadians(first.altitudeDegrees);
  const secondAltitude = degreesToRadians(second.altitudeDegrees);
  const azimuthDifference = degreesToRadians(first.azimuthDegrees - second.azimuthDegrees);
  const cosine =
    Math.sin(firstAltitude) * Math.sin(secondAltitude) +
    Math.cos(firstAltitude) * Math.cos(secondAltitude) * Math.cos(azimuthDifference);

  return radiansToDegrees(Math.acos(clamp(cosine, -1, 1)));
}

function calculateMoonInterference(
  targetId: string,
  moon: StellarObservation,
  illuminatedFraction: number,
  separationDegrees: number,
): number {
  if (targetId === 'moon' || !moon.isAboveHorizon) {
    return 0;
  }
  const brightness = clamp(illuminatedFraction, 0, 1);
  const altitudeFactor =
    0.25 + 0.75 * Math.sin(degreesToRadians(Math.max(0, moon.altitudeDegrees)));
  const proximityFactor = Math.pow(clamp((120 - separationDegrees) / 120, 0, 1), 1.5);

  return clamp(brightness * altitudeFactor * proximityFactor, 0, 1);
}

function calculateIndicativeQuality(
  visible: boolean,
  clearanceDegrees: number,
  sunAltitudeDegrees: number,
  moonInterference: number,
): number {
  if (!visible) {
    return 0;
  }
  const darkness = clamp(-sunAltitudeDegrees / 18, 0, 1);
  const altitude = Math.sin(degreesToRadians(clamp(clearanceDegrees, 0, 90)));

  return clamp(darkness * altitude * (1 - 0.7 * moonInterference), 0, 1);
}

function calculateRiseAndSet(
  points: readonly EarthObservationTimelinePoint[],
  culminationIndex: number,
): { readonly riseTime: UniverseTime | null; readonly setTime: UniverseTime | null } {
  let riseTime: UniverseTime | null = null;
  let setTime: UniverseTime | null = null;

  for (let index = 1; index <= culminationIndex; index += 1) {
    const previous = points[index - 1]!;
    const current = points[index]!;

    if (previous.clearanceDegrees <= 0 && current.clearanceDegrees > 0) {
      riseTime = interpolateHorizonCrossing(previous, current);
    }
  }
  for (let index = culminationIndex + 1; index < points.length; index += 1) {
    const previous = points[index - 1]!;
    const current = points[index]!;

    if (previous.clearanceDegrees > 0 && current.clearanceDegrees <= 0) {
      setTime = interpolateHorizonCrossing(previous, current);
      break;
    }
  }

  return { riseTime, setTime };
}

function interpolateHorizonCrossing(
  first: EarthObservationTimelinePoint,
  second: EarthObservationTimelinePoint,
): UniverseTime {
  const delta = second.clearanceDegrees - first.clearanceDegrees;
  const mix = clamp(-first.clearanceDegrees / delta, 0, 1);

  return {
    julianDay: first.time.julianDay + (second.time.julianDay - first.time.julianDay) * mix,
  };
}

function calculateBestWindow(
  points: readonly EarthObservationTimelinePoint[],
  bestIndex: number,
  intervalDays: number,
  bestQuality: number,
): { readonly start: UniverseTime; readonly end: UniverseTime } {
  const threshold = Math.max(0.05, bestQuality * 0.65);
  let startIndex = bestIndex;
  let endIndex = bestIndex;

  while (startIndex > 0 && points[startIndex - 1]!.quality >= threshold) {
    startIndex -= 1;
  }
  while (endIndex < points.length - 1 && points[endIndex + 1]!.quality >= threshold) {
    endIndex += 1;
  }

  return {
    start: {
      julianDay: Math.max(
        points[0]!.time.julianDay,
        points[startIndex]!.time.julianDay - intervalDays / 2,
      ),
    },
    end: {
      julianDay: Math.min(
        points.at(-1)!.time.julianDay,
        points[endIndex]!.time.julianDay + intervalDays / 2,
      ),
    },
  };
}

function chartPolyline<T>(
  points: readonly T[],
  coordinates: (point: T) => readonly [number, number],
): string {
  return points
    .map((point) =>
      coordinates(point)
        .map((value) => value.toFixed(2))
        .join(','),
    )
    .join(' ');
}

function altitudeChartY(altitudeDegrees: number): number {
  const minimumAltitude = -20;
  const maximumAltitude = 90;
  const normalized =
    (clamp(altitudeDegrees, minimumAltitude, maximumAltitude) - minimumAltitude) /
    (maximumAltitude - minimumAltitude);

  return (1 - normalized) * EARTH_OBSERVATION_TIMELINE_CHART_HEIGHT;
}

function indexOfMaximum<T>(values: readonly T[], score: (value: T) => number): number {
  let maximumIndex = 0;

  for (let index = 1; index < values.length; index += 1) {
    if (score(values[index]!) > score(values[maximumIndex]!)) {
      maximumIndex = index;
    }
  }

  return maximumIndex;
}

function assertSampleMinutes(sampleMinutes: number): void {
  const totalMinutes = EARTH_OBSERVATION_TIMELINE_HOURS * 60;

  if (
    !Number.isInteger(sampleMinutes) ||
    sampleMinutes < 5 ||
    sampleMinutes > 120 ||
    totalMinutes % sampleMinutes !== 0
  ) {
    throw new RangeError('Earth observation timeline sample interval must divide 24 hours.');
  }
}

function degreesToRadians(value: number): number {
  return (value * Math.PI) / 180;
}

function radiansToDegrees(value: number): number {
  return (value * 180) / Math.PI;
}

function clamp(value: number, minimum: number, maximum: number): number {
  return Math.min(maximum, Math.max(minimum, value));
}
