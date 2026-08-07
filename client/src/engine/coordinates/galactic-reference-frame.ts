import { type Vector3Like } from '../../data/models/universe.models';

// Murray's FK5 J2000 realization of the IAU Galactic coordinate system.
const EQUATORIAL_TO_GALACTIC = [
  [-0.054_875_560_4, -0.873_437_090_2, -0.483_835_015_5],
  [0.494_109_427_9, -0.444_829_63, 0.746_982_244_5],
  [-0.867_666_149, -0.198_076_373_4, 0.455_983_776_2],
] as const;

export function equatorialJ2000ToGalacticScene(position: Vector3Like): Vector3Like {
  const galacticCenterAxis = dot(EQUATORIAL_TO_GALACTIC[0], position.x, position.y, position.z);
  const galacticLongitudeAxis = dot(EQUATORIAL_TO_GALACTIC[1], position.x, position.y, position.z);
  const northGalacticAxis = dot(EQUATORIAL_TO_GALACTIC[2], position.x, position.y, position.z);

  // Galactic +X points from the Sun toward the center. Scene +X points from the center to the Sun.
  return {
    x: cleanSignedZero(-galacticCenterAxis),
    y: cleanSignedZero(northGalacticAxis),
    z: cleanSignedZero(galacticLongitudeAxis),
  };
}

export function writeEquatorialJ2000ToGalacticScene(
  x: number,
  y: number,
  z: number,
  target: Float32Array,
  offset: number,
): void {
  target[offset] = cleanSignedZero(-dot(EQUATORIAL_TO_GALACTIC[0], x, y, z));
  target[offset + 1] = cleanSignedZero(dot(EQUATORIAL_TO_GALACTIC[2], x, y, z));
  target[offset + 2] = cleanSignedZero(dot(EQUATORIAL_TO_GALACTIC[1], x, y, z));
}

function dot(row: readonly [number, number, number], x: number, y: number, z: number): number {
  return row[0] * x + row[1] * y + row[2] * z;
}

function cleanSignedZero(value: number): number {
  return value + 0;
}
