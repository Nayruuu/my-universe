import { DistanceUnit, ReferenceFrame, Vector3Like } from '../../data/models/universe.models';
import { convertDistance } from './unit-conversion';

const SOLAR_SCENE_UNITS_PER_AU = 15;
const STELLAR_LINEAR_UNITS_PER_LIGHT_YEAR = 250;
const GALACTIC_LINEAR_UNITS_PER_KILOPARSEC = 90;
const LOCAL_GROUP_SCENE_UNITS_PER_KILOPARSEC = 10;
const NEARBY_UNIVERSE_SCENE_UNITS_PER_MEGAPARSEC = 4_000;
const COSMIC_WEB_SCENE_UNITS_PER_MEGAPARSEC = 200;

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
      case 'nearby-universe':
        return (
          convertDistance(value, unit, 'megaparsec') * NEARBY_UNIVERSE_SCENE_UNITS_PER_MEGAPARSEC
        );
      case 'cosmic-web':
        return convertDistance(value, unit, 'megaparsec') * COSMIC_WEB_SCENE_UNITS_PER_MEGAPARSEC;
    }
  }

  public toRenderPosition(
    position: readonly [number, number, number],
    unit: DistanceUnit,
    frame: ReferenceFrame,
  ): Vector3Like {
    const [x, y, z] = position;
    const scale = this.getRenderPositionScale(x, y, z, unit, frame);

    if (scale === 0) {
      return { x: 0, y: 0, z: 0 };
    }

    return {
      x: x * scale,
      y: y * scale,
      z: z * scale,
    };
  }

  public writeRenderPosition(
    x: number,
    y: number,
    z: number,
    unit: DistanceUnit,
    frame: ReferenceFrame,
    target: Float32Array,
    offset: number,
  ): void {
    const scale = this.getRenderPositionScale(x, y, z, unit, frame);

    target[offset] = x * scale;
    target[offset + 1] = y * scale;
    target[offset + 2] = z * scale;
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
      case 'nearby-universe':
        return convertDistance(1, unit, 'megaparsec') * NEARBY_UNIVERSE_SCENE_UNITS_PER_MEGAPARSEC;
      case 'cosmic-web':
        return convertDistance(1, unit, 'megaparsec') * COSMIC_WEB_SCENE_UNITS_PER_MEGAPARSEC;
    }
  }

  public sceneUnitsToAstronomicalUnits(value: number): number {
    return value / SOLAR_SCENE_UNITS_PER_AU;
  }

  private getRenderPositionScale(
    x: number,
    y: number,
    z: number,
    unit: DistanceUnit,
    frame: ReferenceFrame,
  ): number {
    const length = Math.hypot(x, y, z);

    if (length === 0) {
      return 0;
    }
    if (
      frame === 'solar-system' ||
      frame === 'local-group' ||
      frame === 'nearby-universe' ||
      frame === 'cosmic-web'
    ) {
      return this.toSceneDistance(1, unit, frame);
    }

    const scientificDistance =
      frame === 'stellar'
        ? convertDistance(length, unit, 'light-year')
        : convertDistance(length, unit, 'kiloparsec');
    const compressedRadius =
      frame === 'stellar'
        ? 420 + Math.log1p(scientificDistance) * 250
        : 1_600 + Math.log1p(scientificDistance) * 460;

    return compressedRadius / length;
  }
}
