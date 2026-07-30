import {
  Body,
  Observer,
  ObserverVector,
  RotateVector,
  RotationAxis,
  Rotation_EQJ_ECL,
  Vector,
} from 'astronomy-engine';
import type {
  EphemerisBody,
  JovianMoon,
  UniverseTime,
  Vector3Like,
} from '../../data/models/universe.models';
import { JULIAN_DAY_J2000 } from './time-utils';

export type RotationalBody = Exclude<EphemerisBody, JovianMoon> | 'sun';

export interface BodyOrientation {
  xAxis: Vector3Like;
  yAxis: Vector3Like;
  zAxis: Vector3Like;
}

const EQUATORIAL_TO_ECLIPTIC = Rotation_EQJ_ECL();
const ROTATIONAL_BODIES: Readonly<Record<RotationalBody, Body>> = {
  sun: Body.Sun,
  mercury: Body.Mercury,
  venus: Body.Venus,
  earth: Body.Earth,
  moon: Body.Moon,
  mars: Body.Mars,
  jupiter: Body.Jupiter,
  saturn: Body.Saturn,
  uranus: Body.Uranus,
  neptune: Body.Neptune,
  pluto: Body.Pluto,
};

export function getRotationalBody(objectId: string): RotationalBody | null {
  return Object.hasOwn(ROTATIONAL_BODIES, objectId) ? (objectId as RotationalBody) : null;
}

export function calculateBodyOrientation(
  time: UniverseTime,
  body: RotationalBody,
): BodyOrientation {
  if (body === 'earth') {
    return calculateEarthTextureOrientation(time);
  }
  const daysSinceJ2000 = time.julianDay - JULIAN_DAY_J2000;
  const axis = RotationAxis(ROTATIONAL_BODIES[body], daysSinceJ2000);
  const rightAscension = axis.ra * (Math.PI / 12);
  const declination = axis.dec * (Math.PI / 180);
  const primeMeridian = normalizeDegrees(axis.spin) * (Math.PI / 180);
  const secondEulerAngle = Math.PI / 2 - declination;
  const thirdEulerAngle = Math.PI / 2 + rightAscension;
  const cosPrimeMeridian = Math.cos(primeMeridian);
  const sinPrimeMeridian = Math.sin(primeMeridian);
  const cosSecond = Math.cos(secondEulerAngle);
  const sinSecond = Math.sin(secondEulerAngle);
  const cosThird = Math.cos(thirdEulerAngle);
  const sinThird = Math.sin(thirdEulerAngle);
  const bodyXAxis = new Vector(
    cosThird * cosPrimeMeridian - sinThird * cosSecond * sinPrimeMeridian,
    sinThird * cosPrimeMeridian + cosThird * cosSecond * sinPrimeMeridian,
    sinSecond * sinPrimeMeridian,
    axis.north.t,
  );
  const bodyYAxis = new Vector(
    -cosThird * sinPrimeMeridian - sinThird * cosSecond * cosPrimeMeridian,
    -sinThird * sinPrimeMeridian + cosThird * cosSecond * cosPrimeMeridian,
    sinSecond * cosPrimeMeridian,
    axis.north.t,
  );

  // IAU uses body +Z for the north pole. The renderer uses local +Y for the
  // pole and maps astronomical Y to scene Z, preserving a right-handed basis.
  return {
    xAxis: toEclipticSceneDirection(bodyXAxis),
    yAxis: toEclipticSceneDirection(axis.north),
    zAxis: toEclipticSceneDirection(bodyYAxis),
  };
}

export function calculateEarthObserverDirection(
  time: UniverseTime,
  latitude: number,
  longitude: number,
): Vector3Like {
  const astronomyTime = time.julianDay - JULIAN_DAY_J2000;
  const observerVector = ObserverVector(astronomyTime, new Observer(latitude, longitude, 0), false);

  return toEclipticSceneDirection(observerVector);
}

export function calculateEarthTextureOrientation(time: UniverseTime): BodyOrientation {
  return {
    xAxis: calculateEarthObserverDirection(time, 0, 0),
    yAxis: calculateEarthObserverDirection(time, 90, 0),
    zAxis: calculateEarthObserverDirection(time, 0, 90),
  };
}

function toEclipticSceneDirection(vector: Vector): Vector3Like {
  const ecliptic = RotateVector(EQUATORIAL_TO_ECLIPTIC, vector);
  const length = Math.hypot(ecliptic.x, ecliptic.y, ecliptic.z);

  return {
    x: ecliptic.x / length,
    y: ecliptic.z / length,
    z: ecliptic.y / length,
  };
}

function normalizeDegrees(value: number): number {
  return ((value % 360) + 360) % 360;
}
