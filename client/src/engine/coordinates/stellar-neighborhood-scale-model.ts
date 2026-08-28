import {
  calculateGalacticFrameScale,
  calculateMilkyWayReferenceFrameScale,
  MILKY_WAY_PROCEDURAL_AUTHORING_DIAMETER,
  MILKY_WAY_REFERENCE_FRAME_TRANSITION_END,
  MILKY_WAY_STELLAR_CONTAINMENT_AUTHORING_THICKNESS,
} from './galaxy-scale-model';
import { CoordinateSystem } from './coordinate-system';
import { calculateMilkyWayTransition } from '../lod/milky-way-transition';

export interface StellarNeighborhoodSceneScale {
  readonly radialScale: number;
  readonly verticalScale: number;
  readonly originScale: number;
  readonly reveal: number;
  readonly physicalRadialScale: number;
  readonly maximumContainedRadialScale: number;
  readonly maximumContainedVerticalScale: number;
}

export const STELLAR_NEIGHBORHOOD_EXPANSION_START = 2_400;
export const STELLAR_NEIGHBORHOOD_EXPANSION_END = 3_600;
export const STELLAR_NEIGHBORHOOD_REVEAL_START = 520;
export const STELLAR_NEIGHBORHOOD_REVEAL_END = 2_200;
export const GALACTIC_STELLAR_NEIGHBORHOOD_SCALE = 0.085;
export const LOCAL_GROUP_STELLAR_NEIGHBORHOOD_SCALE = 0.12;
export const STELLAR_NEIGHBORHOOD_PHYSICAL_RADIUS_KILOPARSECS = 5;
export const STELLAR_NEIGHBORHOOD_CONTAINMENT_MARGIN = 0.92;

const stellarCoordinateSystem = new CoordinateSystem();

export const STELLAR_NEIGHBORHOOD_AUTHORING_RADIUS = stellarCoordinateSystem.toRenderPosition(
  [STELLAR_NEIGHBORHOOD_PHYSICAL_RADIUS_KILOPARSECS, 0, 0],
  'kiloparsec',
  'stellar',
).x;

/**
 * Continuous visual reveal of the heliocentric catalogue after its scene transform has reached the
 * stable local scale. It is illustrative: physical positions remain documented, while separating
 * the hidden reference-frame expansion from the reveal prevents stars from sliding during zoom.
 */
export function calculateStellarNeighborhoodReveal(cameraDistance: number): number {
  const normalizedDistance = normalizeStellarTransitionDistance(cameraDistance);
  const collapseProgress = smoothstep(
    Math.log(STELLAR_NEIGHBORHOOD_REVEAL_START),
    Math.log(STELLAR_NEIGHBORHOOD_REVEAL_END),
    Math.log(Math.max(STELLAR_NEIGHBORHOOD_REVEAL_START, normalizedDistance)),
  );

  return 1 - collapseProgress;
}

/**
 * Interpolates an illustrative rendering value through the local, stellar-overview, and galactic
 * endpoints without coupling it to the categorical LOD switch that occurs midway through the
 * distance transition.
 */
export function interpolateStellarNeighborhoodLodValue(
  localValue: number,
  stellarOverviewValue: number,
  galacticValue: number,
  reveal: number,
): number {
  const progress = (1 - Math.max(0, Math.min(1, reveal))) * 2;

  return progress <= 1
    ? lerp(localValue, stellarOverviewValue, progress)
    : lerp(stellarOverviewValue, galacticValue, progress - 1);
}

export function calculateStellarNeighborhoodSceneScale(
  cameraDistance: number,
  stellarOriginDistance: number,
): StellarNeighborhoodSceneScale {
  const normalizedDistance = normalizeStellarTransitionDistance(cameraDistance);
  const milkyWayReferenceFrame = calculateMilkyWayReferenceFrameScale(normalizedDistance);
  const reveal = calculateStellarNeighborhoodReveal(normalizedDistance);
  const expansion = calculateStellarNeighborhoodExpansion(normalizedDistance);
  const readableScale = calculateReadableStellarNeighborhoodScale(normalizedDistance, expansion);
  const originScale = calculateGalacticFrameScale(normalizedDistance);
  const normalizedOriginDistance = Number.isFinite(stellarOriginDistance)
    ? Math.max(0, stellarOriginDistance)
    : 0;
  const scaledOriginDistance = normalizedOriginDistance * originScale;
  const physicalRadialScale =
    (STELLAR_NEIGHBORHOOD_PHYSICAL_RADIUS_KILOPARSECS *
      milkyWayReferenceFrame.sceneUnitsPerKiloparsec) /
    STELLAR_NEIGHBORHOOD_AUTHORING_RADIUS;
  const availableRadialDistance = Math.max(
    0,
    milkyWayReferenceFrame.worldDiameter / 2 - scaledOriginDistance,
  );
  const maximumContainedRadialScale =
    (availableRadialDistance * STELLAR_NEIGHBORHOOD_CONTAINMENT_MARGIN) /
    STELLAR_NEIGHBORHOOD_AUTHORING_RADIUS;
  const maximumContainedVerticalScale =
    ((milkyWayReferenceFrame.worldDiameter * MILKY_WAY_STELLAR_CONTAINMENT_AUTHORING_THICKNESS) /
      MILKY_WAY_PROCEDURAL_AUTHORING_DIAMETER /
      2 /
      STELLAR_NEIGHBORHOOD_AUTHORING_RADIUS) *
    STELLAR_NEIGHBORHOOD_CONTAINMENT_MARGIN;
  const containmentProgress = 1 - expansion;
  const containedRadialScale = Math.min(
    readableScale,
    physicalRadialScale,
    maximumContainedRadialScale,
  );
  const radialScale = lerp(readableScale, containedRadialScale, containmentProgress);
  const containedVerticalScale = Math.min(radialScale, maximumContainedVerticalScale);
  const verticalScale = lerp(radialScale, containedVerticalScale, containmentProgress);

  return {
    radialScale,
    verticalScale,
    originScale,
    reveal,
    physicalRadialScale,
    maximumContainedRadialScale,
    maximumContainedVerticalScale,
  };
}

function calculateStellarNeighborhoodExpansion(cameraDistance: number): number {
  const collapseProgress = smoothstep(
    Math.log(STELLAR_NEIGHBORHOOD_EXPANSION_START),
    Math.log(STELLAR_NEIGHBORHOOD_EXPANSION_END),
    Math.log(Math.max(STELLAR_NEIGHBORHOOD_EXPANSION_START, cameraDistance)),
  );

  return 1 - collapseProgress;
}

function calculateReadableStellarNeighborhoodScale(
  cameraDistance: number,
  expansion: number,
): number {
  const galacticScale = lerp(GALACTIC_STELLAR_NEIGHBORHOOD_SCALE, 1, expansion);
  const impostorOpacity = calculateMilkyWayTransition(cameraDistance).impostorOpacity;

  return lerp(galacticScale, LOCAL_GROUP_STELLAR_NEIGHBORHOOD_SCALE, impostorOpacity);
}

function normalizeStellarTransitionDistance(cameraDistance: number): number {
  if (Number.isFinite(cameraDistance)) {
    return Math.max(0, cameraDistance);
  }

  return cameraDistance === Number.POSITIVE_INFINITY ? MILKY_WAY_REFERENCE_FRAME_TRANSITION_END : 0;
}

function lerp(start: number, end: number, progress: number): number {
  return start + (end - start) * progress;
}

function smoothstep(minimum: number, maximum: number, value: number): number {
  const progress = Math.max(0, Math.min(1, (value - minimum) / (maximum - minimum)));

  return progress * progress * (3 - 2 * progress);
}
