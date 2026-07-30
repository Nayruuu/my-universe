import {
  Body,
  GeoMoon,
  GeoVector,
  InverseRotation,
  Observer,
  ObserverVector,
  RotateVector,
  Rotation_EQJ_ECL,
  Rotation_EQJ_EQD,
  Vector,
  VectorObserver,
} from 'astronomy-engine';
import type { Vector as AstronomyVector } from 'astronomy-engine';
import { UniverseTime, Vector3Like } from '../../data/models/universe.models';
import { SolarEclipseAppearance, SolarEclipsePhase } from './earth-eclipse';
import { JULIAN_DAY_J2000 } from './time-utils';

const EQUATORIAL_TO_ECLIPTIC = Rotation_EQJ_ECL();
const ASTRONOMICAL_UNIT_KM = 149_597_870.7;
const SUN_RADIUS_AU = 696_340 / ASTRONOMICAL_UNIT_KM;
const EARTH_EQUATORIAL_RADIUS_AU = 6_378.137 / ASTRONOMICAL_UNIT_KM;
const EARTH_POLAR_RADIUS_AU = 6_356.752_314_245 / ASTRONOMICAL_UNIT_KM;
const MOON_RADIUS_AU = 1_737.4 / ASTRONOMICAL_UNIT_KM;
const PATH_HALF_SPAN_DAYS = 2.5 / 24;
const EMPTY_VECTOR: Vector3Like = { x: 0, y: 0, z: 0 };

export interface SolarShadowGeometry {
  phase: SolarEclipsePhase;
  sunPosition: AstronomyVector;
  moonPosition: AstronomyVector;
  surfacePoint: Vector3Like | null;
  closestAxisPoint: Vector3Like;
}

export function calculateSolarEclipseAppearance(time: UniverseTime): SolarEclipseAppearance {
  const geometry = calculateSolarShadowGeometry(time);

  return createSolarEclipseAppearanceFromGeometry(geometry);
}

export function createSolarEclipseAppearanceFromGeometry(
  geometry: SolarShadowGeometry,
): SolarEclipseAppearance {
  const shadowPoint = geometry.surfacePoint ?? geometry.closestAxisPoint;
  const observer = geometry.surfacePoint
    ? VectorObserver(
        new Vector(
          geometry.surfacePoint.x,
          geometry.surfacePoint.y,
          geometry.surfacePoint.z,
          geometry.moonPosition.t,
        ),
        false,
      )
    : null;

  return {
    phase: geometry.phase,
    sunPositionInEarthRadii: scaled(
      toEclipticSceneVector(geometry.sunPosition),
      1 / EARTH_EQUATORIAL_RADIUS_AU,
    ),
    moonPositionInEarthRadii: scaled(
      toEclipticSceneVector(geometry.moonPosition),
      1 / EARTH_EQUATORIAL_RADIUS_AU,
    ),
    shadowDirection: normalized(
      toEclipticSceneVector(
        new Vector(shadowPoint.x, shadowPoint.y, shadowPoint.z, geometry.moonPosition.t),
      ),
    ),
    centralLatitude: observer?.latitude ?? null,
    centralLongitude: observer?.longitude ?? null,
  };
}

export function calculateSolarObserverDiscRatio(
  time: UniverseTime,
  latitude: number,
  longitude: number,
): number {
  const astronomyTime = time.julianDay - JULIAN_DAY_J2000;
  const observerVector = ObserverVector(astronomyTime, new Observer(latitude, longitude, 0), false);
  const sunDistance = vectorLength(
    subtracted(GeoVector(Body.Sun, astronomyTime, true), observerVector),
  );
  const moonDistance = vectorLength(subtracted(GeoMoon(astronomyTime), observerVector));

  return calculateSolarApparentDiscRatio(sunDistance, moonDistance);
}

export function calculateSolarApparentDiscRatio(sunDistance: number, moonDistance: number): number {
  const sunAngularRadius = Math.asin(Math.min(1, SUN_RADIUS_AU / sunDistance));
  const moonAngularRadius = Math.asin(Math.min(1, MOON_RADIUS_AU / moonDistance));

  return sunAngularRadius === 0 ? 1 : moonAngularRadius / sunAngularRadius;
}

export function calculateSolarEclipsePath(
  peak: UniverseTime,
  displayTime: UniverseTime = peak,
  sampleCount = 121,
): Vector3Like[] {
  const points: Vector3Like[] = [];
  const samples = Math.max(3, sampleCount);
  const displayAstronomyTime = displayTime.julianDay - JULIAN_DAY_J2000;

  for (let index = 0; index < samples; index += 1) {
    const progress = index / (samples - 1);
    const sampleTime = {
      julianDay: peak.julianDay + (progress * 2 - 1) * PATH_HALF_SPAN_DAYS,
    };
    const geometry = calculateSolarShadowGeometry(sampleTime);

    if (!geometry.surfacePoint) {
      continue;
    }
    const geographicPoint = VectorObserver(
      new Vector(
        geometry.surfacePoint.x,
        geometry.surfacePoint.y,
        geometry.surfacePoint.z,
        geometry.moonPosition.t,
      ),
      false,
    );
    const pointAtDisplayTime = ObserverVector(
      displayAstronomyTime,
      new Observer(geographicPoint.latitude, geographicPoint.longitude, 0),
      false,
    );

    points.push(normalized(toEclipticSceneVector(pointAtDisplayTime)));
  }

  return points;
}

function calculateSolarShadowGeometry(time: UniverseTime): SolarShadowGeometry {
  const astronomyTime = time.julianDay - JULIAN_DAY_J2000;
  const sunPosition = GeoVector(Body.Sun, astronomyTime, true);
  const moonPosition = GeoMoon(astronomyTime);

  return calculateSolarShadowGeometryFromVectors(sunPosition, moonPosition);
}

export function calculateSolarShadowGeometryFromVectors(
  sunPosition: AstronomyVector,
  moonPosition: AstronomyVector,
): SolarShadowGeometry {
  const sunToMoon = subtracted(moonPosition, sunPosition);
  const sunMoonDistance = vectorLength(sunToMoon);

  if (sunMoonDistance === 0) {
    return {
      phase: 'none',
      sunPosition,
      moonPosition,
      surfacePoint: null,
      closestAxisPoint: EMPTY_VECTOR,
    };
  }
  const shadowAxis = scaled(sunToMoon, 1 / sunMoonDistance);
  const distanceAlongAxis = -dot(moonPosition, shadowAxis);
  const closestAxisPoint = added(moonPosition, scaled(shadowAxis, distanceAlongAxis));

  if (distanceAlongAxis <= 0) {
    return {
      phase: 'none',
      sunPosition,
      moonPosition,
      surfacePoint: null,
      closestAxisPoint,
    };
  }
  const axisDistance = vectorLength(closestAxisPoint);
  const umbraRadius =
    MOON_RADIUS_AU - (distanceAlongAxis * (SUN_RADIUS_AU - MOON_RADIUS_AU)) / sunMoonDistance;
  const penumbraRadius =
    MOON_RADIUS_AU + (distanceAlongAxis * (SUN_RADIUS_AU + MOON_RADIUS_AU)) / sunMoonDistance;
  const phase = classifySolarEclipse(axisDistance, umbraRadius, penumbraRadius);

  return {
    phase,
    sunPosition,
    moonPosition,
    surfacePoint: intersectShadowAxisWithEarth(moonPosition, shadowAxis),
    closestAxisPoint,
  };
}

function classifySolarEclipse(
  axisDistance: number,
  umbraRadius: number,
  penumbraRadius: number,
): SolarEclipsePhase {
  if (axisDistance >= EARTH_EQUATORIAL_RADIUS_AU + penumbraRadius) {
    return 'none';
  }
  if (axisDistance <= EARTH_EQUATORIAL_RADIUS_AU + Math.abs(umbraRadius)) {
    return umbraRadius >= 0 ? 'total' : 'annular';
  }

  return 'partial';
}

function intersectShadowAxisWithEarth(
  moonPosition: AstronomyVector,
  shadowAxis: Vector3Like,
): Vector3Like | null {
  const equatorOfDateRotation = Rotation_EQJ_EQD(moonPosition.t);
  const equatorOfDateMoon = RotateVector(equatorOfDateRotation, moonPosition);
  const equatorOfDateAxis = RotateVector(
    equatorOfDateRotation,
    new Vector(shadowAxis.x, shadowAxis.y, shadowAxis.z, moonPosition.t),
  );
  const equatorialRadiusSquared = EARTH_EQUATORIAL_RADIUS_AU * EARTH_EQUATORIAL_RADIUS_AU;
  const polarRadiusSquared = EARTH_POLAR_RADIUS_AU * EARTH_POLAR_RADIUS_AU;
  const quadraticA =
    (equatorOfDateAxis.x * equatorOfDateAxis.x + equatorOfDateAxis.y * equatorOfDateAxis.y) /
      equatorialRadiusSquared +
    (equatorOfDateAxis.z * equatorOfDateAxis.z) / polarRadiusSquared;
  const quadraticB =
    2 *
    ((equatorOfDateMoon.x * equatorOfDateAxis.x + equatorOfDateMoon.y * equatorOfDateAxis.y) /
      equatorialRadiusSquared +
      (equatorOfDateMoon.z * equatorOfDateAxis.z) / polarRadiusSquared);
  const discriminant =
    quadraticB * quadraticB -
    4 *
      quadraticA *
      ((equatorOfDateMoon.x * equatorOfDateMoon.x + equatorOfDateMoon.y * equatorOfDateMoon.y) /
        equatorialRadiusSquared +
        (equatorOfDateMoon.z * equatorOfDateMoon.z) / polarRadiusSquared -
        1);

  if (discriminant < 0) {
    return null;
  }
  const distance = (-quadraticB - Math.sqrt(discriminant)) / (2 * quadraticA);

  const surfacePoint = new Vector(
    equatorOfDateMoon.x + equatorOfDateAxis.x * distance,
    equatorOfDateMoon.y + equatorOfDateAxis.y * distance,
    equatorOfDateMoon.z + equatorOfDateAxis.z * distance,
    moonPosition.t,
  );

  return RotateVector(InverseRotation(equatorOfDateRotation), surfacePoint);
}

function toEclipticSceneVector(equatorial: AstronomyVector): Vector3Like {
  const ecliptic = RotateVector(EQUATORIAL_TO_ECLIPTIC, equatorial);

  return {
    x: ecliptic.x,
    y: ecliptic.z,
    z: ecliptic.y,
  };
}

function vectorLength(vector: Vector3Like): number {
  return Math.hypot(vector.x, vector.y, vector.z);
}

function normalized(vector: Vector3Like): Vector3Like {
  const length = vectorLength(vector);

  return length === 0 ? EMPTY_VECTOR : scaled(vector, 1 / length);
}

function dot(first: Vector3Like, second: Vector3Like): number {
  return first.x * second.x + first.y * second.y + first.z * second.z;
}

function scaled(vector: Vector3Like, scale: number): Vector3Like {
  return {
    x: vector.x * scale,
    y: vector.y * scale,
    z: vector.z * scale,
  };
}

function added(first: Vector3Like, second: Vector3Like): Vector3Like {
  return {
    x: first.x + second.x,
    y: first.y + second.y,
    z: first.z + second.z,
  };
}

function subtracted(first: Vector3Like, second: Vector3Like): Vector3Like {
  return {
    x: first.x - second.x,
    y: first.y - second.y,
    z: first.z - second.z,
  };
}
