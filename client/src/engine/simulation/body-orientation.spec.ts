import { Vector3Like } from '../../data/models/universe.models';
import {
  calculateBodyOrientation,
  calculateEarthObserverDirection,
  getRotationalBody,
  type RotationalBody,
} from './body-orientation';
import { JULIAN_DAY_J2000 } from './time-utils';

const J2000 = { julianDay: JULIAN_DAY_J2000 };

describe('orientation axiale IAU', () => {
  it.each([
    ['sun', { x: 0.12235349, y: 0.99200114, z: 0.03103807 }],
    ['mercury', { x: 0.09137782, y: 0.99246738, z: 0.08160015 }],
    ['venus', { x: 0.01869081, y: 0.9997662, z: -0.01087232 }],
    ['earth', { x: -0.00002707, y: 0.91749325, z: -0.39775135 }],
    ['moon', { x: -0.02260866, y: 0.99962453, z: 0.0154808 }],
    ['mars', { x: 0.44615527, y: 0.89323198, z: 0.05551667 }],
    ['jupiter', { x: -0.01459729, y: 0.9992522, z: 0.0358046 }],
    ['saturn', { x: 0.08547883, y: 0.88251982, z: -0.4624415 }],
    ['uranus', { x: -0.21199958, y: 0.134363, z: 0.96798903 }],
    ['neptune', { x: 0.35857651, y: 0.87895926, z: 0.31440977 }],
    ['pluto', { x: -0.67796791, y: -0.3877657, z: -0.62449762 }],
    ['io', { x: -0.01533599, y: 0.99925736, z: 0.03534877 }],
    ['europa', { x: -0.01447669, y: 0.99951186, z: 0.02768525 }],
    ['ganymede', { x: -0.01124432, y: 0.9992543, z: 0.0369378 }],
    ['callisto', { x: -0.01328635, y: 0.9993804, z: 0.03259291 }],
    ['titan', { x: 0.08833705, y: 0.88250493, z: -0.46193247 }],
    ['ceres', { x: 0.14406634, y: 0.98915625, z: -0.02854474 }],
    ['vesta', { x: 0.46625637, y: 0.84548501, z: 0.26030769 }],
  ] satisfies [RotationalBody, Vector3Like][])(
    'place le pôle nord IAU de %s dans le repère écliptique J2000',
    (body, expectedNorth) => {
      const orientation = calculateBodyOrientation(J2000, body);

      expectVector(orientation.yAxis, expectedNorth, 6);
      expect(vectorLength(orientation.xAxis)).toBeCloseTo(1, 10);
      expect(vectorLength(orientation.yAxis)).toBeCloseTo(1, 10);
      expect(vectorLength(orientation.zAxis)).toBeCloseTo(1, 10);
      expect(dot(orientation.xAxis, orientation.yAxis)).toBeCloseTo(0, 10);
      expect(dot(orientation.xAxis, orientation.zAxis)).toBeCloseTo(0, 10);
      expect(dot(orientation.yAxis, orientation.zAxis)).toBeCloseTo(0, 10);
      expectVector(cross(orientation.xAxis, orientation.yAxis), orientation.zAxis, 10);
    },
  );

  it('oriente le méridien origine de Mars selon les éléments IAU 2015', () => {
    const orientation = calculateBodyOrientation(J2000, 'mars');

    expectVector(orientation.xAxis, { x: -0.70424437, y: 0.3121264, z: 0.63766525 }, 6);
    expectVector(orientation.zAxis, { x: -0.55225478, y: 0.32359502, z: -0.76831044 }, 6);
  });

  it('conserve les coordonnées géographiques terrestres utilisées par les éclipses', () => {
    const time = { julianDay: JULIAN_DAY_J2000 + 9_704.5 };
    const orientation = calculateBodyOrientation(time, 'earth');

    expectVector(orientation.xAxis, calculateEarthObserverDirection(time, 0, 0), 10);
    expectVector(orientation.yAxis, calculateEarthObserverDirection(time, 90, 0), 10);
    expectVector(orientation.zAxis, calculateEarthObserverDirection(time, 0, -90), 10);
    expectVector(
      cross(orientation.xAxis, orientation.yAxis),
      calculateEarthObserverDirection(time, 0, -90),
      10,
    );
  });

  it('résout uniquement les corps dont Astronomy Engine connaît la rotation', () => {
    const supported = [
      'sun',
      'mercury',
      'venus',
      'earth',
      'moon',
      'mars',
      'jupiter',
      'saturn',
      'uranus',
      'neptune',
      'pluto',
      'io',
      'europa',
      'ganymede',
      'callisto',
      'titan',
      'ceres',
      'vesta',
    ] satisfies RotationalBody[];

    expect(supported.map((id) => getRotationalBody(id))).toEqual(supported);
    expect(getRotationalBody('asteroid')).toBeNull();
  });
});

function expectVector(actual: Vector3Like, expected: Vector3Like, precision: number): void {
  expect(actual.x).toBeCloseTo(expected.x, precision);
  expect(actual.y).toBeCloseTo(expected.y, precision);
  expect(actual.z).toBeCloseTo(expected.z, precision);
}

function vectorLength(vector: Vector3Like): number {
  return Math.hypot(vector.x, vector.y, vector.z);
}

function dot(first: Vector3Like, second: Vector3Like): number {
  return first.x * second.x + first.y * second.y + first.z * second.z;
}

function cross(first: Vector3Like, second: Vector3Like): Vector3Like {
  return {
    x: first.y * second.z - first.z * second.y,
    y: first.z * second.x - first.x * second.z,
    z: first.x * second.y - first.y * second.x,
  };
}
