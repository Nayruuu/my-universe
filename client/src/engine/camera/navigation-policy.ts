import { SpaceObject } from '../../data/models/universe.models';

export const CAMERA_FAR_DISTANCE = 1_000_000;
export const MAX_NAVIGATION_DISTANCE = 600_000;
export const FREE_NAVIGATION_MIN_DISTANCE = 0.75;

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
