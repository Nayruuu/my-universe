import { DistanceUnit, ReferenceFrame } from '../../data/models/universe.models';
import { CoordinateSystem } from '../coordinates/coordinate-system';
import { calculateMilkyWayReferenceFrameScale } from '../coordinates/galaxy-scale-model';
import { calculateIntergalacticScale } from '../coordinates/intergalactic-scale-model';
import {
  calculateStellarNeighborhoodReveal,
  calculateStellarNeighborhoodSceneScale,
} from '../coordinates/stellar-neighborhood-scale-model';

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

interface MapScaleMetric {
  readonly unit: DistanceUnit;
  readonly sceneUnitsPerScientificUnit: number;
}

const VERTICAL_FIELD_OF_VIEW_DEGREES = 48;
const MAXIMUM_BAR_WIDTH_PX = 92;
const MINIMUM_BAR_WIDTH_PX = 42;
const GALACTIC_TRANSITION_SCALE_START = 700;
const GALACTIC_TRANSITION_SCALE_END = 17_000;
const LIGHT_YEARS_PER_KILOPARSEC = 3_261.563_777;
// GRAVITY Collaboration 2019, A&A 625:L10. This is the same local dataset value used to place
// the Sun and only feeds the already documented adaptive presentation metric.
const SUN_GALACTOCENTRIC_DISTANCE_KILOPARSECS = 8.178;
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
  const metric = resolveMapScaleMetric(
    cameraDistance,
    normalizedLevel,
    level,
    availableSceneDistance,
  );
  const availableScientificDistance = availableSceneDistance / metric.sceneUnitsPerScientificUnit;
  const value = floorNiceScaleValue(availableScientificDistance);
  const pixelWidth = Math.max(
    MINIMUM_BAR_WIDTH_PX,
    MAXIMUM_BAR_WIDTH_PX * (value / availableScientificDistance),
  );

  return {
    value,
    unit: metric.unit,
    pixelWidth,
    adapted: true,
  };
}

function resolveMapScaleMetric(
  cameraDistance: number,
  normalizedLevel: number,
  level: MapScaleLevel,
  availableSceneDistance: number,
): MapScaleMetric {
  if (
    normalizedLevel >= 2 &&
    normalizedLevel <= 4 &&
    cameraDistance >= GALACTIC_TRANSITION_SCALE_START &&
    cameraDistance <= GALACTIC_TRANSITION_SCALE_END
  ) {
    return calculateGalacticTransitionMapMetric(cameraDistance, availableSceneDistance);
  }
  const intergalacticScale = calculateIntergalacticScale(cameraDistance);

  return {
    unit: level.unit,
    sceneUnitsPerScientificUnit:
      normalizedLevel >= 4
        ? intergalacticScale.sceneUnitsPerMegaparsec / (level.unit === 'kiloparsec' ? 1_000 : 1)
        : coordinateSystem.toSceneDistance(1, level.unit, level.frame),
  };
}

/**
 * One presentation metric for the whole Milky-Way-to-local journey. The resolved galaxy defines
 * the far end; as the heliocentric catalogue becomes readable, the metric converges
 * logarithmically to its expanded stellar scale. This mirrors the simultaneous visual crossfade
 * and prevents an LOD badge change from pretending that thousands of light-years vanished in one
 * frame. Values remain explicitly adapted because the local catalogue uses radial compression.
 */
function calculateGalacticTransitionMapMetric(
  cameraDistance: number,
  availableSceneDistance: number,
): MapScaleMetric {
  const milkyWayScale = calculateMilkyWayReferenceFrameScale(cameraDistance);
  const galacticSceneUnitsPerLightYear =
    milkyWayScale.sceneUnitsPerKiloparsec / LIGHT_YEARS_PER_KILOPARSEC;
  const sunGalactocentricSceneDistance = coordinateSystem.toSceneDistance(
    SUN_GALACTOCENTRIC_DISTANCE_KILOPARSECS,
    'kiloparsec',
    'galactic',
  );
  const stellarScale = calculateStellarNeighborhoodSceneScale(
    cameraDistance,
    sunGalactocentricSceneDistance,
  );
  const stellarSceneUnitsPerLightYear =
    coordinateSystem.toSceneDistance(1, 'light-year', 'stellar') * stellarScale.radialScale;
  const reveal = calculateStellarNeighborhoodReveal(cameraDistance);
  const sceneUnitsPerLightYear = interpolateLogarithmically(
    galacticSceneUnitsPerLightYear,
    stellarSceneUnitsPerLightYear,
    reveal,
  );
  const availableLightYears = availableSceneDistance / sceneUnitsPerLightYear;
  const useKiloparsecs = availableLightYears >= LIGHT_YEARS_PER_KILOPARSEC;

  return useKiloparsecs
    ? {
        unit: 'kiloparsec',
        sceneUnitsPerScientificUnit: sceneUnitsPerLightYear * LIGHT_YEARS_PER_KILOPARSEC,
      }
    : { unit: 'light-year', sceneUnitsPerScientificUnit: sceneUnitsPerLightYear };
}

function interpolateLogarithmically(start: number, end: number, progress: number): number {
  return Math.exp(Math.log(start) + (Math.log(end) - Math.log(start)) * progress);
}

function floorNiceScaleValue(value: number): number {
  const exponent = Math.floor(Math.log10(value));
  const magnitude = 10 ** exponent;
  const normalized = value / magnitude;
  const niceNormalized = normalized >= 5 ? 5 : normalized >= 2 ? 2 : 1;

  return niceNormalized * magnitude;
}
