import { DistanceUnit, ReferenceFrame } from '../../data/models/universe.models';
import { CoordinateSystem } from '../coordinates/coordinate-system';

export interface MapScaleDefinition {
  readonly value: number;
  readonly unit: DistanceUnit;
  readonly pixelWidth: number;
  readonly adapted: true;
}

interface MapScaleLevel {
  readonly frame: ReferenceFrame;
  readonly unit: DistanceUnit;
}

const VERTICAL_FIELD_OF_VIEW_DEGREES = 48;
const MAXIMUM_BAR_WIDTH_PX = 92;
const MINIMUM_BAR_WIDTH_PX = 42;
const MAP_SCALE_LEVELS: readonly MapScaleLevel[] = [
  { frame: 'solar-system', unit: 'kilometer' },
  { frame: 'solar-system', unit: 'astronomical-unit' },
  { frame: 'stellar', unit: 'light-year' },
  { frame: 'galactic', unit: 'kiloparsec' },
  { frame: 'local-group', unit: 'kiloparsec' },
  { frame: 'nearby-universe', unit: 'megaparsec' },
  { frame: 'cosmic-web', unit: 'megaparsec' },
];
const coordinateSystem = new CoordinateSystem();

export function calculateMapScale(
  cameraDistance: number,
  lodLevel: number,
  viewportHeight: number,
): MapScaleDefinition | null {
  if (
    !Number.isFinite(cameraDistance) ||
    cameraDistance <= 0 ||
    !Number.isFinite(viewportHeight) ||
    viewportHeight <= 0
  ) {
    return null;
  }
  const normalizedLevel = Math.max(0, Math.min(MAP_SCALE_LEVELS.length - 1, lodLevel));
  const level = MAP_SCALE_LEVELS[normalizedLevel]!;
  const halfFovRadians = (VERTICAL_FIELD_OF_VIEW_DEGREES * Math.PI) / 360;
  const visibleSceneHeight = cameraDistance * 2 * Math.tan(halfFovRadians);
  const availableSceneDistance = visibleSceneHeight * (MAXIMUM_BAR_WIDTH_PX / viewportHeight);
  const sceneUnitsPerScientificUnit = coordinateSystem.toSceneDistance(1, level.unit, level.frame);
  const availableScientificDistance = availableSceneDistance / sceneUnitsPerScientificUnit;
  const value = floorNiceScaleValue(availableScientificDistance);
  const pixelWidth = Math.max(
    MINIMUM_BAR_WIDTH_PX,
    MAXIMUM_BAR_WIDTH_PX * (value / availableScientificDistance),
  );

  return {
    value,
    unit: level.unit,
    pixelWidth,
    adapted: true,
  };
}

function floorNiceScaleValue(value: number): number {
  const exponent = Math.floor(Math.log10(value));
  const magnitude = 10 ** exponent;
  const normalized = value / magnitude;
  const niceNormalized = normalized >= 5 ? 5 : normalized >= 2 ? 2 : 1;

  return niceNormalized * magnitude;
}
