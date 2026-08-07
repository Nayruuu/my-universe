import { SpaceObject } from '../../data/models/universe.models';

const NEAR_REPRESENTATION_START_PX = 5;
const NEAR_REPRESENTATION_COMPLETE_PX = 14;

export function calculateApparentRadiusPixels(
  radius: number,
  distance: number,
  viewportHeight: number,
  verticalFovDegrees: number,
): number {
  if (radius <= 0 || distance <= 0 || viewportHeight <= 0 || verticalFovDegrees <= 0) {
    return 0;
  }
  const halfFieldOfView = (verticalFovDegrees * Math.PI) / 360;

  return (radius * viewportHeight) / (2 * distance * Math.tan(halfFieldOfView));
}

export function calculateNearRepresentationBlend(apparentRadiusPixels: number): number {
  const progress = clamp01(
    (apparentRadiusPixels - NEAR_REPRESENTATION_START_PX) /
      (NEAR_REPRESENTATION_COMPLETE_PX - NEAR_REPRESENTATION_START_PX),
  );

  return progress * progress * (3 - 2 * progress);
}

export function calculateWorldDiameterForPixels(
  pixelDiameter: number,
  distance: number,
  viewportHeight: number,
  verticalFovDegrees: number,
): number {
  if (pixelDiameter <= 0 || distance <= 0 || viewportHeight <= 0) {
    return 0;
  }
  const halfFieldOfView = (verticalFovDegrees * Math.PI) / 360;
  const visibleHeight = 2 * distance * Math.tan(halfFieldOfView);

  return visibleHeight * (pixelDiameter / viewportHeight);
}

export function getMinimumVisualDiameterPixels(
  object: Pick<SpaceObject, 'type'>,
  lodLevel: number,
  qualityMinimumPixelDiameter: number,
): number {
  const scale =
    object.type === 'galaxy' && lodLevel === 4
      ? 4
      : object.type === 'galaxy' && lodLevel === 5
        ? 2.2
        : lodLevel >= 5
          ? 1.6
          : 1;

  return qualityMinimumPixelDiameter * scale;
}

export function shouldDisplayObjectAtLevel(
  object: SpaceObject,
  lodLevel: number,
  selected: boolean,
): boolean {
  if (selected) {
    return true;
  }
  if (object.type === 'galaxy') {
    return object.id === 'milky-way'
      ? lodLevel >= 3 && lodLevel <= 5
      : lodLevel >= 4 && lodLevel <= 5;
  }
  if (object.type === 'star') {
    return object.id === 'sun' || (lodLevel >= 1 && lodLevel <= 2);
  }
  if (object.type === 'black-hole') {
    return object.referenceFrame === 'galactic' ? lodLevel === 3 : lodLevel >= 1 && lodLevel <= 2;
  }
  if (object.type === 'supernova' || object.type === 'supernova-remnant') {
    return object.referenceFrame === 'stellar' && lodLevel >= 1 && lodLevel <= 2;
  }
  if (
    object.type === 'planet' ||
    object.type === 'exoplanet' ||
    object.type === 'dwarf-planet' ||
    object.type === 'moon' ||
    object.type === 'asteroid' ||
    object.type === 'comet'
  ) {
    return lodLevel <= 1;
  }

  return true;
}

export function dampValue(
  current: number,
  target: number,
  response: number,
  deltaSeconds: number,
): number {
  if (deltaSeconds <= 0) {
    return current;
  }

  return current + (target - current) * (1 - Math.exp(-response * deltaSeconds));
}

function clamp01(value: number): number {
  return Math.max(0, Math.min(1, value));
}
