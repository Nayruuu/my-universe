import { SpaceObject } from '../../data/models/universe.models';

export const CAMERA_FAR_DISTANCE = 40_000;
export const MAX_NAVIGATION_DISTANCE = 18_000;
export const FREE_NAVIGATION_MIN_DISTANCE = 0.75;

const FREE_NAVIGATION_DISTANCE_RATIO = 0.5;

export function getFreeNavigationMinimumDistance(currentDistance: number): number {
  const safeDistance = Number.isFinite(currentDistance) ? Math.max(currentDistance, 0) : 0;

  return Math.max(FREE_NAVIGATION_MIN_DISTANCE, safeDistance * FREE_NAVIGATION_DISTANCE_RATIO);
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
    case 'planet':
    case 'dwarf-planet':
    case 'moon':
      return Math.max(radius * 1.12, 0.18);
    default:
      return Math.max(radius * 1.08, 0.25);
  }
}

export function getFocusDistance(object: SpaceObject): number {
  if (object.id === 'local-group') {
    return 17_000;
  }

  switch (object.type) {
    case 'galaxy':
      return Math.max(object.visual.visualRadius * 1.55, 2_800);
    case 'star':
      return object.id === 'sun'
        ? Math.max(object.visual.visualRadius * 8.5, 24)
        : Math.max(object.visual.visualRadius * 10, 16);
    case 'planet':
    case 'dwarf-planet':
      return Math.max(object.visual.visualRadius * 8, 4.5);
    case 'moon':
      return Math.max(object.visual.visualRadius * 9, 3.2);
    default:
      return Math.max(object.visual.visualRadius * 4, 10);
  }
}
