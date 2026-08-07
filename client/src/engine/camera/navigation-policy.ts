import type { SpaceObject, Vector3Like } from '../../data/models/universe.models';

export const CAMERA_FAR_DISTANCE = 1_000_000;
export const MAX_NAVIGATION_DISTANCE = 600_000;
export const FREE_NAVIGATION_MIN_DISTANCE = 0.75;
// Pointer-routed zoom keeps long approaches practical, then converges to the standard object rate
// over the final three distance octaves. These are interaction calibrations, not measurements.
export const ACTIVE_TARGET_POINTER_ZOOM_MAXIMUM_MULTIPLIER = 3;
export const ACTIVE_TARGET_POINTER_ZOOM_TAPER_DISTANCE_RATIO = 8;
// Pointer zoom and free travel rewrite absolute camera/pivot coordinates. Keeping 32 local ULPs
// between them leaves headroom for the affine transform; four ULPs absorb its final write-back
// error. These are numerical safety margins, not scene-scale data.
export const LOCAL_NAVIGATION_DISTANCE_MARGIN_ULPS = 32;
export const LOCAL_NAVIGATION_DISTANCE_TOLERANCE_ULPS = 4;
// These are interaction-calibration values, not astronomical measurements. The 1,800-unit cruise
// floor represents 120 astronomical units in the Solar System frame. Sustained empty-space input
// ramps smoothly from that base rate to four times the rate, without changing object approaches.
export const MINIMUM_FREE_TRAVEL_DISTANCE_PER_LOG_UNIT = 1_800;
export const MAXIMUM_FREE_TRAVEL_SPEED_MULTIPLIER = 4;
export const FREE_TRAVEL_ACCELERATION_LOGARITHMIC_AMOUNT = 0.5;
const FREE_TRAVEL_CONTEXT_MULTIPLIER = 8;

export function getActiveTargetPointerZoomMultiplier(
  distance: number,
  minimumDistance: number,
  maximumMultiplier = ACTIVE_TARGET_POINTER_ZOOM_MAXIMUM_MULTIPLIER,
): number {
  const safeMaximumMultiplier =
    Number.isFinite(maximumMultiplier) && maximumMultiplier > 1 ? maximumMultiplier : 1;

  if (
    !Number.isFinite(distance) ||
    distance <= 0 ||
    !Number.isFinite(minimumDistance) ||
    minimumDistance <= 0
  ) {
    return safeMaximumMultiplier;
  }
  const distanceRatio = Math.max(1, distance / minimumDistance);
  const logarithmicProgress = Math.min(
    1,
    Math.log(distanceRatio) / Math.log(ACTIVE_TARGET_POINTER_ZOOM_TAPER_DISTANCE_RATIO),
  );
  const smoothProgress = logarithmicProgress ** 2 * (3 - 2 * logarithmicProgress);

  return 1 + (safeMaximumMultiplier - 1) * smoothProgress;
}

export function getFreeTravelDistancePerLogUnit(contextualMinimumDistance: number): number {
  const safeMinimumDistance =
    Number.isFinite(contextualMinimumDistance) && contextualMinimumDistance > 0
      ? contextualMinimumDistance
      : 0;

  return Math.max(
    MINIMUM_FREE_TRAVEL_DISTANCE_PER_LOG_UNIT,
    safeMinimumDistance * FREE_TRAVEL_CONTEXT_MULTIPLIER,
  );
}

export function getFreeTravelDistance(
  contextualMinimumDistance: number,
  currentLogarithmicAmount: number,
  additionalLogarithmicAmount: number,
): number {
  const startAmount = normalizePositiveAmount(currentLogarithmicAmount);
  const additionalAmount = normalizePositiveAmount(additionalLogarithmicAmount);

  if (additionalAmount === 0) {
    return 0;
  }

  return (
    getFreeTravelDistancePerLogUnit(contextualMinimumDistance) *
    (integratedFreeTravelSpeed(startAmount + additionalAmount) -
      integratedFreeTravelSpeed(startAmount))
  );
}

function integratedFreeTravelSpeed(logarithmicAmount: number): number {
  if (logarithmicAmount <= FREE_TRAVEL_ACCELERATION_LOGARITHMIC_AMOUNT) {
    return (
      logarithmicAmount +
      ((MAXIMUM_FREE_TRAVEL_SPEED_MULTIPLIER - 1) * logarithmicAmount ** 2) /
        (2 * FREE_TRAVEL_ACCELERATION_LOGARITHMIC_AMOUNT)
    );
  }

  const rampDistance =
    (FREE_TRAVEL_ACCELERATION_LOGARITHMIC_AMOUNT * (1 + MAXIMUM_FREE_TRAVEL_SPEED_MULTIPLIER)) / 2;

  return (
    rampDistance +
    (logarithmicAmount - FREE_TRAVEL_ACCELERATION_LOGARITHMIC_AMOUNT) *
      MAXIMUM_FREE_TRAVEL_SPEED_MULTIPLIER
  );
}

function normalizePositiveAmount(amount: number): number {
  return Number.isFinite(amount) && amount > 0 ? amount : 0;
}

export function getLocalNavigationCoordinatePrecision(
  first: Vector3Like,
  second: Vector3Like,
): number {
  const coordinateMagnitude = Math.max(
    1,
    Math.abs(first.x),
    Math.abs(first.y),
    Math.abs(first.z),
    Math.abs(second.x),
    Math.abs(second.y),
    Math.abs(second.z),
  );

  return 2 ** Math.floor(Math.log2(coordinateMagnitude)) * Number.EPSILON;
}

export function getLocalNavigationDistanceTolerance(
  first: Vector3Like,
  second: Vector3Like,
): number {
  return Math.max(
    Number.EPSILON,
    getLocalNavigationCoordinatePrecision(first, second) * LOCAL_NAVIGATION_DISTANCE_TOLERANCE_ULPS,
  );
}

export function isAtMinimumNavigationDistance(
  distance: number,
  minimumDistance: number,
  numericalTolerance = Number.EPSILON,
): boolean {
  const tolerance = Math.max(Number.EPSILON, minimumDistance * 1e-6, numericalTolerance);

  return distance <= minimumDistance + tolerance;
}

export function getOrbitOverviewDistance(orbitRadius: number, verticalFovDegrees = 48): number {
  const safeRadius = Math.max(orbitRadius, FREE_NAVIGATION_MIN_DISTANCE);
  const clampedFov = Math.max(10, Math.min(verticalFovDegrees, 120));
  const halfFovRadians = (clampedFov * Math.PI) / 360;

  return Math.min((safeRadius / Math.tan(halfFovRadians)) * 1.18, MAX_NAVIGATION_DISTANCE);
}

export function getMinimumNavigationDistance(object: SpaceObject): number {
  if (object.type === 'galaxy' || object.type === 'galaxy-cluster') {
    return 1.5;
  }

  const radius = object.visual.visualRadius;

  switch (object.type) {
    case 'star':
      return Math.max(radius * 1.15, 0.55);
    case 'black-hole':
      return Math.max(radius * 1.35, 0.55);
    case 'supernova':
    case 'supernova-remnant':
      return Math.max(radius * 1.2, 0.55);
    case 'planet':
    case 'exoplanet':
    case 'dwarf-planet':
    case 'moon':
      return Math.max(radius * 1.12, 0.18);
    default:
      return Math.max(radius * 1.08, 0.25);
  }
}

export function getFocusDistance(object: SpaceObject): number {
  if (object.id === 'cosmic-web') {
    return 420_000;
  }
  if (object.id === 'nearby-universe') {
    return 120_000;
  }
  if (object.id === 'local-group') {
    return 17_000;
  }

  switch (object.type) {
    case 'galaxy-cluster':
      return 220_000;
    case 'supercluster':
    case 'cosmic-wall':
    case 'cosmic-filament':
    case 'cosmic-void':
    case 'cosmic-basin':
    case 'cosmic-attractor':
    case 'cosmic-repeller':
      return Math.min(MAX_NAVIGATION_DISTANCE, Math.max(object.visual.visualRadius * 2.2, 280_000));
    case 'galaxy':
      return Math.max(object.visual.visualRadius * 1.55, 2_800);
    case 'star':
      return object.id === 'sun'
        ? Math.max(object.visual.visualRadius * 8.5, 24)
        : Math.max(object.visual.visualRadius * 10, 16);
    case 'black-hole':
      return Math.max(object.visual.visualRadius * 12, 22);
    case 'supernova':
    case 'supernova-remnant':
      return Math.max(object.visual.visualRadius * 8, 14);
    case 'planet':
    case 'exoplanet':
    case 'dwarf-planet':
      return Math.max(object.visual.visualRadius * 8, 4.5);
    case 'moon':
      return Math.max(object.visual.visualRadius * 9, 3.2);
    default:
      return Math.max(object.visual.visualRadius * 4, 10);
  }
}
