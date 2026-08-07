import zoomModelConfig from './zoom-model.config.json';

// Interactive scale evolves in logarithmic space: log(w₂ / w₁) = κΔ. For the cosmic
// map the field of view is fixed, so the visible world height w and the target distance d differ
// only by a constant factor. The JSON file deliberately isolates calibrated UX parameters from the
// structural equations below.
export const LOG_DISTANCE_PER_WHEEL_PIXEL = zoomModelConfig.logScalePerNormalizedWheelUnit;
export const MAXIMUM_ZOOM_OCTAVES_PER_SECOND = zoomModelConfig.maximumZoomOctavesPerSecond;
export const MAXIMUM_ZOOM_OCTAVES_PER_IMPULSE = zoomModelConfig.maximumZoomOctavesPerImpulse;

const LINEAR_RESPONSE_FRACTION = 1 / 4;

export function zoomScaleFromWheelDelta(deltaY: number): number {
  return Math.exp(logarithmicScaleChangeFromWheelDelta(deltaY));
}

export function equivalentWheelDeltaForOctaves(octaves: number): number {
  return (octaves * Math.LN2) / LOG_DISTANCE_PER_WHEEL_PIXEL;
}

export function logarithmicScaleChangeFromWheelDelta(deltaY: number): number {
  return Number.isFinite(deltaY) ? deltaY * LOG_DISTANCE_PER_WHEEL_PIXEL : 0;
}

export function wheelDeltaForLogarithmicScaleChange(logarithmicAmount: number): number {
  return Number.isFinite(logarithmicAmount) ? logarithmicAmount / LOG_DISTANCE_PER_WHEEL_PIXEL : 0;
}

export function calculatePerspectiveVisibleHeight(
  distance: number,
  verticalFieldOfViewDegrees: number,
): number {
  if (
    !Number.isFinite(distance) ||
    distance <= 0 ||
    !Number.isFinite(verticalFieldOfViewDegrees) ||
    verticalFieldOfViewDegrees <= 0 ||
    verticalFieldOfViewDegrees >= 180
  ) {
    return 0;
  }
  const halfFieldOfViewRadians = (verticalFieldOfViewDegrees * Math.PI) / 360;

  return 2 * distance * Math.tan(halfFieldOfViewRadians);
}

export function calculatePerspectiveDistance(
  visibleHeight: number,
  verticalFieldOfViewDegrees: number,
): number {
  if (
    !Number.isFinite(visibleHeight) ||
    visibleHeight <= 0 ||
    !Number.isFinite(verticalFieldOfViewDegrees) ||
    verticalFieldOfViewDegrees <= 0 ||
    verticalFieldOfViewDegrees >= 180
  ) {
    return 0;
  }
  const halfFieldOfViewRadians = (verticalFieldOfViewDegrees * Math.PI) / 360;

  return visibleHeight / (2 * Math.tan(halfFieldOfViewRadians));
}

export interface NavigationZoomCoordinateState {
  readonly coordinate: number;
  readonly distance: number;
  readonly minimumTraversalLogarithmicAmount: number;
  readonly atMaximum: boolean;
}

export function calculateNavigationZoomCoordinate(
  distance: number,
  minimumDistance: number,
  minimumTraversalLogarithmicAmount = 0,
): number {
  const safeMinimumDistance = normalizePositiveDistance(minimumDistance);
  const safeDistance = Math.max(normalizePositiveDistance(distance), safeMinimumDistance);
  const safeTraversal =
    Number.isFinite(minimumTraversalLogarithmicAmount) && minimumTraversalLogarithmicAmount > 0
      ? minimumTraversalLogarithmicAmount
      : 0;

  return Math.log(safeDistance / safeMinimumDistance) - safeTraversal;
}

export function resolveNavigationZoomCoordinate(
  coordinate: number,
  minimumDistance: number,
  maximumDistance: number,
): NavigationZoomCoordinateState {
  const safeMinimumDistance = normalizePositiveDistance(minimumDistance);
  const safeMaximumDistance = Math.max(
    normalizePositiveDistance(maximumDistance),
    safeMinimumDistance,
  );
  const maximumCoordinate = Math.log(safeMaximumDistance / safeMinimumDistance);
  const finiteCoordinate = Number.isFinite(coordinate) ? coordinate : 0;
  const boundedCoordinate = Math.min(finiteCoordinate, maximumCoordinate);

  return {
    coordinate: boundedCoordinate,
    distance:
      boundedCoordinate <= 0
        ? safeMinimumDistance
        : safeMinimumDistance * Math.exp(boundedCoordinate),
    minimumTraversalLogarithmicAmount: Math.max(0, -boundedCoordinate),
    atMaximum: boundedCoordinate >= maximumCoordinate,
  };
}

export function advanceNavigationZoomCoordinate(
  coordinate: number,
  deltaY: number,
  minimumDistance: number,
  maximumDistance: number,
): NavigationZoomCoordinateState {
  return resolveNavigationZoomCoordinate(
    coordinate + logarithmicScaleChangeFromWheelDelta(deltaY),
    minimumDistance,
    maximumDistance,
  );
}

export function softLimitWheelDelta(deltaY: number, maximumMagnitude: number): number {
  const magnitude = Math.abs(deltaY);
  const linearMagnitude = maximumMagnitude * LINEAR_RESPONSE_FRACTION;

  if (magnitude <= linearMagnitude) {
    return deltaY;
  }
  // This continuation has the same value and first derivative as the linear response,
  // then approaches the capacity asymptotically instead of introducing a hard-clamp jerk.
  const curvedMagnitude = maximumMagnitude - linearMagnitude;
  const limitedMagnitude =
    linearMagnitude + curvedMagnitude * Math.tanh((magnitude - linearMagnitude) / curvedMagnitude);

  return Math.sign(deltaY) * limitedMagnitude;
}

function normalizePositiveDistance(distance: number): number {
  return Number.isFinite(distance) && distance > 0 ? distance : Number.EPSILON;
}
