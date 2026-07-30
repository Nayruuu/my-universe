import { DistanceUnit, ReferenceFrame, Vector3Like } from '../../data/models/universe.models';
import { convertDistance } from './unit-conversion';

const SOLAR_SCENE_UNITS_PER_AU = 15;
const STELLAR_LINEAR_UNITS_PER_LIGHT_YEAR = 250;
const GALACTIC_LINEAR_UNITS_PER_KILOPARSEC = 90;
const LOCAL_GROUP_SCENE_UNITS_PER_KILOPARSEC = 10;

export class CoordinateSystem {
  public toSceneDistance(value: number, unit: DistanceUnit, frame: ReferenceFrame): number {
    switch (frame) {
      case 'solar-system':
        return convertDistance(value, unit, 'astronomical-unit') * SOLAR_SCENE_UNITS_PER_AU;
      case 'stellar':
        return convertDistance(value, unit, 'light-year') * STELLAR_LINEAR_UNITS_PER_LIGHT_YEAR;
      case 'galactic':
        return convertDistance(value, unit, 'kiloparsec') * GALACTIC_LINEAR_UNITS_PER_KILOPARSEC;
      case 'local-group':
        return convertDistance(value, unit, 'kiloparsec') * LOCAL_GROUP_SCENE_UNITS_PER_KILOPARSEC;
    }
  }

  public toRenderPosition(
    position: readonly [number, number, number],
    unit: DistanceUnit,
    frame: ReferenceFrame,
  ): Vector3Like {
    const [x, y, z] = position;
    const length = Math.hypot(x, y, z);

    if (length === 0) {
      return { x: 0, y: 0, z: 0 };
    }

    if (frame === 'solar-system' || frame === 'local-group') {
      const scale = this.toSceneDistance(1, unit, frame);

      return { x: x * scale, y: y * scale, z: z * scale };
    }

    const scientificDistance =
      frame === 'stellar'
        ? convertDistance(length, unit, 'light-year')
        : convertDistance(length, unit, 'kiloparsec');
    const compressedRadius =
      frame === 'stellar'
        ? 420 + Math.log1p(scientificDistance) * 250
        : 1_600 + Math.log1p(scientificDistance) * 460;
    const normalizedScale = compressedRadius / length;

    return {
      x: x * normalizedScale,
      y: y * normalizedScale,
      z: z * normalizedScale,
    };
  }

  public getLinearMotionScale(unit: DistanceUnit, frame: ReferenceFrame): number {
    switch (frame) {
      case 'solar-system':
        return this.toSceneDistance(1, unit, frame);
      case 'stellar':
        return convertDistance(1, unit, 'light-year') * STELLAR_LINEAR_UNITS_PER_LIGHT_YEAR;
      case 'galactic':
        return convertDistance(1, unit, 'kiloparsec') * GALACTIC_LINEAR_UNITS_PER_KILOPARSEC;
      case 'local-group':
        return convertDistance(1, unit, 'kiloparsec') * LOCAL_GROUP_SCENE_UNITS_PER_KILOPARSEC;
    }
  }

  public sceneUnitsToAstronomicalUnits(value: number): number {
    return value / SOLAR_SCENE_UNITS_PER_AU;
  }
}
