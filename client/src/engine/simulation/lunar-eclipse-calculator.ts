import { Body, GeoMoon, HelioVector, RotateVector, Rotation_EQJ_ECL } from 'astronomy-engine';
import type { Vector } from 'astronomy-engine';
import { UniverseTime, Vector3Like } from '../../data/models/universe.models';
import { LunarEclipseAppearance, LunarEclipsePhase } from './earth-eclipse';
import { JULIAN_DAY_J2000 } from './time-utils';

const EQUATORIAL_TO_ECLIPTIC = Rotation_EQJ_ECL();
const SUN_RADIUS_AU = 696_340 / 149_597_870.7;
const EARTH_EQUATORIAL_RADIUS_AU = 6_378.137 / 149_597_870.7;
const MOON_RADIUS_AU = 1_737.4 / 149_597_870.7;
const EMPTY_VECTOR: Vector3Like = { x: 0, y: 0, z: 0 };

export function calculateLunarEclipseAppearance(time: UniverseTime): LunarEclipseAppearance {
  const astronomyTime = time.julianDay - JULIAN_DAY_J2000;
  const earthPosition = toEclipticSceneVector(HelioVector(Body.Earth, astronomyTime));
  const moonPosition = toEclipticSceneVector(GeoMoon(astronomyTime));

  return calculateLunarEclipseAppearanceFromVectors(earthPosition, moonPosition);
}

export function calculateLunarEclipseAppearanceFromVectors(
  earthPosition: Vector3Like,
  moonPosition: Vector3Like,
): LunarEclipseAppearance {
  const sunDistance = vectorLength(earthPosition);
  const shadowAxis = normalized(earthPosition);
  const distanceAlongShadowAxis = dot(moonPosition, shadowAxis);

  if (distanceAlongShadowAxis <= 0 || sunDistance === 0) {
    return noLunarEclipseAppearance();
  }

  const shadowAxisPoint = scaled(shadowAxis, distanceAlongShadowAxis);
  const shadowOffset = subtracted(moonPosition, shadowAxisPoint);
  const umbraRadius =
    EARTH_EQUATORIAL_RADIUS_AU -
    (distanceAlongShadowAxis * (SUN_RADIUS_AU - EARTH_EQUATORIAL_RADIUS_AU)) / sunDistance;
  const penumbraRadius =
    EARTH_EQUATORIAL_RADIUS_AU +
    (distanceAlongShadowAxis * (SUN_RADIUS_AU + EARTH_EQUATORIAL_RADIUS_AU)) / sunDistance;
  const shadowOffsetInMoonRadii = scaled(shadowOffset, 1 / MOON_RADIUS_AU);
  const umbraRadiusInMoonRadii = Math.max(0, umbraRadius / MOON_RADIUS_AU);
  const penumbraRadiusInMoonRadii = penumbraRadius / MOON_RADIUS_AU;
  const centerDistanceInMoonRadii = vectorLength(shadowOffsetInMoonRadii);
  const phase = classifyLunarEclipse(
    centerDistanceInMoonRadii,
    umbraRadiusInMoonRadii,
    penumbraRadiusInMoonRadii,
  );

  return {
    phase,
    shadowAxis,
    shadowOffsetInMoonRadii,
    umbraRadiusInMoonRadii,
    penumbraRadiusInMoonRadii,
  };
}

function classifyLunarEclipse(
  centerDistance: number,
  umbraRadius: number,
  penumbraRadius: number,
): LunarEclipsePhase {
  if (centerDistance >= penumbraRadius + 1) {
    return 'none';
  }
  if (centerDistance + 1 <= umbraRadius) {
    return 'total';
  }
  if (centerDistance < umbraRadius + 1) {
    return 'partial';
  }

  return 'penumbral';
}

function toEclipticSceneVector(equatorial: Vector): Vector3Like {
  const ecliptic = RotateVector(EQUATORIAL_TO_ECLIPTIC, equatorial);

  return {
    x: ecliptic.x,
    y: ecliptic.z,
    z: ecliptic.y,
  };
}

function noLunarEclipseAppearance(): LunarEclipseAppearance {
  return {
    phase: 'none',
    shadowAxis: EMPTY_VECTOR,
    shadowOffsetInMoonRadii: EMPTY_VECTOR,
    umbraRadiusInMoonRadii: 0,
    penumbraRadiusInMoonRadii: 0,
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

function subtracted(first: Vector3Like, second: Vector3Like): Vector3Like {
  return {
    x: first.x - second.x,
    y: first.y - second.y,
    z: first.z - second.z,
  };
}
