import {
  Body,
  Equator,
  Horizon,
  Observer,
  ObserverVector,
  Vector,
  VectorObserver,
} from 'astronomy-engine';
import type { Vector as AstronomyVector } from 'astronomy-engine';
import { UniverseTime, Vector3Like } from '../../data/models/universe.models';
import { calculateSolarShadowGeometry, SolarShadowGeometry } from './solar-eclipse-calculator';

const ASTRONOMICAL_UNIT_KM = 149_597_870.7;
const SUN_RADIUS_AU = 696_340 / ASTRONOMICAL_UNIT_KM;
const MOON_RADIUS_AU = 1_737.4 / ASTRONOMICAL_UNIT_KM;
const EVENT_MAP_HALF_SPAN_DAYS = 3 / 24;
const CORRIDOR_STEP_DAYS = 2 / 1_440;
const PARTIAL_FOOTPRINT_STEP_DAYS = 5 / 1_440;
const PARTIAL_BOUNDARY_BEARING_STEP_DEGREES = 15;
const BOUNDARY_SEARCH_ITERATIONS = 18;
const INITIAL_BOUNDARY_DISTANCE_KM = 32;
const MAX_BOUNDARY_DISTANCE_KM = 20_000;
const EARTH_MEAN_RADIUS_KM = 6_371.0088;

export const SOLAR_ECLIPSE_EVENT_MAP_SOURCE =
  'Astronomy Engine geocentric ephemerides · validated against NASA GSFC path tables';

export interface SolarEclipseGeographicPoint {
  latitude: number;
  longitude: number;
  direction: Vector3Like;
}

export interface SolarEclipseCorridorSample {
  time: UniverseTime;
  center: SolarEclipseGeographicPoint;
  northernLimit: SolarEclipseGeographicPoint;
  southernLimit: SolarEclipseGeographicPoint;
  widthKm: number;
}

export interface SolarEclipsePartialFootprint {
  time: UniverseTime;
  center: SolarEclipseGeographicPoint;
  boundary: SolarEclipseGeographicPoint[];
}

export interface SolarEclipseEventMap {
  source: typeof SOLAR_ECLIPSE_EVENT_MAP_SOURCE;
  scientificConfidence: 'calculated';
  corridor: SolarEclipseCorridorSample[];
  partialFootprints: SolarEclipsePartialFootprint[];
}

export interface SolarEclipseProjectedMapPoint {
  x: number;
  y: number;
}

export interface SolarEclipseEventMapRenderData {
  partialPolygons: SolarEclipseProjectedMapPoint[][];
  corridorPositions: number[];
  corridorIndices: number[];
  corridorLimitPositions: number[];
  centralLinePositions: number[];
  minimumCorridorWidthKm: number | null;
  maximumCorridorWidthKm: number | null;
}

export function calculateSolarEclipseEventMap(peak: UniverseTime): SolarEclipseEventMap {
  return {
    source: SOLAR_ECLIPSE_EVENT_MAP_SOURCE,
    scientificConfidence: 'calculated',
    corridor: calculateCentralCorridor(peak),
    partialFootprints: calculatePartialFootprints(peak),
  };
}

export function createSolarEclipseEventMapRenderData(
  eventMap: SolarEclipseEventMap,
): SolarEclipseEventMapRenderData {
  const corridorPositions: number[] = [];
  const corridorIndices: number[] = [];
  const corridorLimitPositions: number[] = [];
  const centralLinePositions: number[] = [];

  for (const sample of eventMap.corridor) {
    pushDirection(corridorPositions, sample.northernLimit);
    pushDirection(corridorPositions, sample.southernLimit);
    pushDirection(centralLinePositions, sample.center);
  }
  for (let index = 0; index < eventMap.corridor.length - 1; index += 1) {
    const northern = index * 2;
    const southern = northern + 1;
    const nextNorthern = northern + 2;
    const nextSouthern = northern + 3;
    const sample = eventMap.corridor[index]!;
    const nextSample = eventMap.corridor[index + 1]!;

    corridorIndices.push(northern, southern, nextNorthern, southern, nextSouthern, nextNorthern);
    pushDirection(corridorLimitPositions, sample.northernLimit);
    pushDirection(corridorLimitPositions, nextSample.northernLimit);
    pushDirection(corridorLimitPositions, sample.southernLimit);
    pushDirection(corridorLimitPositions, nextSample.southernLimit);
  }
  const widths = eventMap.corridor.map(({ widthKm }) => widthKm);

  return {
    partialPolygons: eventMap.partialFootprints.map(({ boundary }) =>
      unwrapProjectedPolygon(boundary),
    ),
    corridorPositions,
    corridorIndices,
    corridorLimitPositions,
    centralLinePositions,
    minimumCorridorWidthKm: widths.length === 0 ? null : Math.min(...widths),
    maximumCorridorWidthKm: widths.length === 0 ? null : Math.max(...widths),
  };
}

function calculateCentralCorridor(peak: UniverseTime): SolarEclipseCorridorSample[] {
  const samples: SolarEclipseCorridorSample[] = [];

  for (const time of eventSampleTimes(peak, CORRIDOR_STEP_DAYS)) {
    const geometry = calculateSolarShadowGeometry(time);

    if (!geometry.surfacePoint || !isCentralPhase(geometry.phase)) {
      continue;
    } else {
      const center = geographicPointFromVector(geometry.surfacePoint, geometry.moonPosition.t);
      const sunAzimuth = calculateSunAzimuth(geometry, center);
      const firstLimit = findLocalPhaseBoundary(geometry, center, sunAzimuth, 'central');
      const secondLimit = findLocalPhaseBoundary(geometry, center, sunAzimuth + 180, 'central');
      const northernLimit = firstLimit.latitude >= secondLimit.latitude ? firstLimit : secondLimit;
      const southernLimit = firstLimit.latitude < secondLimit.latitude ? firstLimit : secondLimit;

      samples.push({
        time,
        center,
        northernLimit,
        southernLimit,
        widthKm:
          greatCircleDistanceKm(center, firstLimit) + greatCircleDistanceKm(center, secondLimit),
      });
    }
  }

  return samples;
}

function calculatePartialFootprints(peak: UniverseTime): SolarEclipsePartialFootprint[] {
  const footprints: SolarEclipsePartialFootprint[] = [];

  for (const time of eventSampleTimes(peak, PARTIAL_FOOTPRINT_STEP_DAYS)) {
    const geometry = calculateSolarShadowGeometry(time);

    if (geometry.phase === 'none') {
      continue;
    } else {
      const centerVector = geometry.surfacePoint ?? geometry.closestAxisPoint;
      const center = geographicPointFromVector(centerVector, geometry.moonPosition.t);

      if (!isLocalPhaseVisible(geometry, center, 'partial')) {
        continue;
      }
      const boundary: SolarEclipseGeographicPoint[] = [];

      for (let bearing = 0; bearing < 360; bearing += PARTIAL_BOUNDARY_BEARING_STEP_DEGREES) {
        boundary.push(findLocalPhaseBoundary(geometry, center, bearing, 'partial'));
      }
      footprints.push({ time, center, boundary });
    }
  }

  return footprints;
}

function eventSampleTimes(peak: UniverseTime, stepDays: number): UniverseTime[] {
  const start = peak.julianDay - EVENT_MAP_HALF_SPAN_DAYS;
  const end = peak.julianDay + EVENT_MAP_HALF_SPAN_DAYS;
  const firstSample = Math.ceil(start / stepDays) * stepDays;
  const samples: UniverseTime[] = [];

  for (let julianDay = firstSample; julianDay <= end; julianDay += stepDays) {
    samples.push({ julianDay });
  }

  return samples;
}

function calculateSunAzimuth(
  geometry: SolarShadowGeometry,
  point: SolarEclipseGeographicPoint,
): number {
  const observer = new Observer(point.latitude, point.longitude, 0);
  const equatorial = Equator(Body.Sun, geometry.sunPosition.t, observer, true, true);

  return Horizon(geometry.sunPosition.t, observer, equatorial.ra, equatorial.dec, 'normal').azimuth;
}

function findLocalPhaseBoundary(
  geometry: SolarShadowGeometry,
  center: SolarEclipseGeographicPoint,
  bearing: number,
  phase: 'central' | 'partial',
): SolarEclipseGeographicPoint {
  let visibleDistance = 0;
  let hiddenDistance = INITIAL_BOUNDARY_DISTANCE_KM;

  while (
    hiddenDistance < MAX_BOUNDARY_DISTANCE_KM &&
    isLocalPhaseVisible(geometry, destinationPoint(center, bearing, hiddenDistance), phase)
  ) {
    visibleDistance = hiddenDistance;
    hiddenDistance *= 2;
  }
  hiddenDistance = Math.min(hiddenDistance, MAX_BOUNDARY_DISTANCE_KM);

  for (let iteration = 0; iteration < BOUNDARY_SEARCH_ITERATIONS; iteration += 1) {
    const middleDistance = (visibleDistance + hiddenDistance) / 2;

    if (isLocalPhaseVisible(geometry, destinationPoint(center, bearing, middleDistance), phase)) {
      visibleDistance = middleDistance;
    } else {
      hiddenDistance = middleDistance;
    }
  }

  return destinationPoint(center, bearing, (visibleDistance + hiddenDistance) / 2);
}

function isLocalPhaseVisible(
  geometry: SolarShadowGeometry,
  point: Pick<SolarEclipseGeographicPoint, 'latitude' | 'longitude'>,
  phase: 'central' | 'partial',
): boolean {
  const observerVector = ObserverVector(
    geometry.moonPosition.t,
    new Observer(point.latitude, point.longitude, 0),
    false,
  );
  const toSun = subtracted(geometry.sunPosition, observerVector);
  const toMoon = subtracted(geometry.moonPosition, observerVector);
  const sunDistance = vectorLength(toSun);
  const moonDistance = vectorLength(toMoon);
  const surfaceDirection = normalized(observerVector);

  if (dot(surfaceDirection, normalized(toSun)) <= 0) {
    return false;
  } else {
    const separation = Math.acos(clamp(dot(normalized(toSun), normalized(toMoon)), -1, 1));
    const sunAngularRadius = Math.asin(Math.min(1, SUN_RADIUS_AU / sunDistance));
    const moonAngularRadius = Math.asin(Math.min(1, MOON_RADIUS_AU / moonDistance));

    return phase === 'central'
      ? separation <= Math.abs(moonAngularRadius - sunAngularRadius)
      : separation <= moonAngularRadius + sunAngularRadius;
  }
}

function geographicPointFromVector(
  vector: Vector3Like,
  time: AstronomyVector['t'],
): SolarEclipseGeographicPoint {
  const observer = VectorObserver(new Vector(vector.x, vector.y, vector.z, time), false);

  return geographicPoint(observer.latitude, observer.longitude);
}

function geographicPoint(latitude: number, longitude: number): SolarEclipseGeographicPoint {
  const latitudeRadians = latitude * (Math.PI / 180);
  const longitudeRadians = longitude * (Math.PI / 180);
  const cosLatitude = Math.cos(latitudeRadians);

  return {
    latitude,
    longitude,
    direction: {
      x: cosLatitude * Math.cos(longitudeRadians),
      y: Math.sin(latitudeRadians),
      z: -cosLatitude * Math.sin(longitudeRadians),
    },
  };
}

function destinationPoint(
  origin: Pick<SolarEclipseGeographicPoint, 'latitude' | 'longitude'>,
  bearing: number,
  distanceKm: number,
): SolarEclipseGeographicPoint {
  const angularDistance = distanceKm / EARTH_MEAN_RADIUS_KM;
  const bearingRadians = bearing * (Math.PI / 180);
  const originLatitude = origin.latitude * (Math.PI / 180);
  const originLongitude = origin.longitude * (Math.PI / 180);
  const destinationLatitude = Math.asin(
    Math.sin(originLatitude) * Math.cos(angularDistance) +
      Math.cos(originLatitude) * Math.sin(angularDistance) * Math.cos(bearingRadians),
  );
  const destinationLongitude =
    originLongitude +
    Math.atan2(
      Math.sin(bearingRadians) * Math.sin(angularDistance) * Math.cos(originLatitude),
      Math.cos(angularDistance) - Math.sin(originLatitude) * Math.sin(destinationLatitude),
    );

  return geographicPoint(
    destinationLatitude * (180 / Math.PI),
    normalizeLongitude(destinationLongitude * (180 / Math.PI)),
  );
}

function greatCircleDistanceKm(
  first: Pick<SolarEclipseGeographicPoint, 'latitude' | 'longitude'>,
  second: Pick<SolarEclipseGeographicPoint, 'latitude' | 'longitude'>,
): number {
  const firstLatitude = first.latitude * (Math.PI / 180);
  const secondLatitude = second.latitude * (Math.PI / 180);
  const latitudeDelta = secondLatitude - firstLatitude;
  const longitudeDelta = (second.longitude - first.longitude) * (Math.PI / 180);
  const haversine =
    Math.sin(latitudeDelta / 2) ** 2 +
    Math.cos(firstLatitude) * Math.cos(secondLatitude) * Math.sin(longitudeDelta / 2) ** 2;

  return EARTH_MEAN_RADIUS_KM * 2 * Math.asin(Math.sqrt(haversine));
}

function isCentralPhase(phase: SolarShadowGeometry['phase']): phase is 'annular' | 'total' {
  return phase === 'annular' || phase === 'total';
}

function unwrapProjectedPolygon(
  boundary: readonly SolarEclipseGeographicPoint[],
): SolarEclipseProjectedMapPoint[] {
  const points: SolarEclipseProjectedMapPoint[] = [];
  let previousX: number | null = null;

  for (const point of boundary) {
    let x = (point.longitude + 180) / 360;

    if (previousX !== null) {
      while (x - previousX > 0.5) {
        x -= 1;
      }
      while (x - previousX < -0.5) {
        x += 1;
      }
    }
    points.push({ x, y: (90 - point.latitude) / 180 });
    previousX = x;
  }

  return points;
}

function pushDirection(positions: number[], point: SolarEclipseGeographicPoint): void {
  positions.push(point.direction.x, point.direction.y, point.direction.z);
}

function normalizeLongitude(longitude: number): number {
  return ((longitude + 540) % 360) - 180;
}

function clamp(value: number, minimum: number, maximum: number): number {
  return Math.min(maximum, Math.max(minimum, value));
}

function vectorLength(vector: Vector3Like): number {
  return Math.hypot(vector.x, vector.y, vector.z);
}

function normalized(vector: Vector3Like): Vector3Like {
  const length = vectorLength(vector);

  return { x: vector.x / length, y: vector.y / length, z: vector.z / length };
}

function dot(first: Vector3Like, second: Vector3Like): number {
  return first.x * second.x + first.y * second.y + first.z * second.z;
}

function subtracted(first: Vector3Like, second: Vector3Like): Vector3Like {
  return {
    x: first.x - second.x,
    y: first.y - second.y,
    z: first.z - second.z,
  };
}
