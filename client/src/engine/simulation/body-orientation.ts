import {
  Body,
  MakeTime,
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
import {
  calculateIauRotationAngles,
  isIauRotationBody,
  type IauRotationBody,
} from './iau-rotation-model';

type AstronomyEngineRotationalBody = Exclude<EphemerisBody, JovianMoon> | 'sun';
export type RotationalBody = AstronomyEngineRotationalBody | IauRotationBody;

export interface BodyOrientation {
  xAxis: Vector3Like;
  yAxis: Vector3Like;
  zAxis: Vector3Like;
}

const EQUATORIAL_TO_ECLIPTIC = Rotation_EQJ_ECL();
const ASTRONOMY_ENGINE_ROTATIONAL_BODIES: Readonly<Record<AstronomyEngineRotationalBody, Body>> = {
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
  if (isIauRotationBody(objectId)) {
    return objectId;
  }

  return Object.hasOwn(ASTRONOMY_ENGINE_ROTATIONAL_BODIES, objectId)
    ? (objectId as AstronomyEngineRotationalBody)
    : null;
}

export function calculateBodyOrientation(
  time: UniverseTime,
  body: RotationalBody,
): BodyOrientation {
  if (body === 'earth') {
    return calculateEarthTextureOrientation(time);
  }
  if (isIauRotationBody(body)) {
    const astronomyTime = MakeTime(time.julianDay - JULIAN_DAY_J2000);
    const angles = calculateIauRotationAngles(body, astronomyTime.tt);
    const north = vectorFromEquatorialCoordinates(
      angles.rightAscensionDegrees,
      angles.declinationDegrees,
      astronomyTime,
    );

    return calculateOrientationFromAngles(
      angles.rightAscensionDegrees,
      angles.declinationDegrees,
      angles.primeMeridianDegrees,
      north,
    );
  }
  const daysSinceJ2000 = time.julianDay - JULIAN_DAY_J2000;
  const axis = RotationAxis(ASTRONOMY_ENGINE_ROTATIONAL_BODIES[body], daysSinceJ2000);

  return calculateOrientationFromAngles(axis.ra * 15, axis.dec, axis.spin, axis.north);
}

function calculateOrientationFromAngles(
  rightAscensionDegrees: number,
  declinationDegrees: number,
  primeMeridianDegrees: number,
  north: Vector,
): BodyOrientation {
  const rightAscension = rightAscensionDegrees * (Math.PI / 180);
  const declination = declinationDegrees * (Math.PI / 180);
  const primeMeridian = normalizeDegrees(primeMeridianDegrees) * (Math.PI / 180);
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
    north.t,
  );
  const bodyYAxis = new Vector(
    -cosThird * sinPrimeMeridian - sinThird * cosSecond * cosPrimeMeridian,
    -sinThird * sinPrimeMeridian + cosThird * cosSecond * cosPrimeMeridian,
    sinSecond * cosPrimeMeridian,
    north.t,
  );

  // IAU uses body +Z for the north pole. The renderer uses local +Y for the
  // pole and local +Z toward geographic west so the basis stays right-handed.
  return {
    xAxis: toEclipticSceneDirection(bodyXAxis),
    yAxis: toEclipticSceneDirection(north),
    zAxis: toEclipticSceneDirection(bodyYAxis, -1),
  };
}

function vectorFromEquatorialCoordinates(
  rightAscensionDegrees: number,
  declinationDegrees: number,
  time: ReturnType<typeof MakeTime>,
): Vector {
  const rightAscension = rightAscensionDegrees * (Math.PI / 180);
  const declination = declinationDegrees * (Math.PI / 180);
  const cosDeclination = Math.cos(declination);

  return new Vector(
    cosDeclination * Math.cos(rightAscension),
    cosDeclination * Math.sin(rightAscension),
    Math.sin(declination),
    time,
  );
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
    zAxis: calculateEarthObserverDirection(time, 0, -90),
  };
}

function toEclipticSceneDirection(vector: Vector, direction = 1): Vector3Like {
  const ecliptic = RotateVector(EQUATORIAL_TO_ECLIPTIC, vector);
  const length = Math.hypot(ecliptic.x, ecliptic.y, ecliptic.z);

  return {
    x: (ecliptic.x / length) * direction,
    y: (ecliptic.z / length) * direction,
    z: (-ecliptic.y / length) * direction,
  };
}

function normalizeDegrees(value: number): number {
  return ((value % 360) + 360) % 360;
}
