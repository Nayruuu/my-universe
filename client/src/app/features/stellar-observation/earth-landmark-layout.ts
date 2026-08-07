import type { EarthObserverLocation } from '../../../engine/simulation/earth-observer-location';
import type { EarthLandmarkDefinition } from './earth-landmark-catalog';
import type { EarthLandmarkSilhouetteFamily } from './earth-landmark-silhouette';
import { earthLandmarkSilhouetteProfile } from './earth-landmark-silhouette-profile';
import { PARIS_PANORAMA_HEIGHT, PARIS_PANORAMA_WIDTH } from './earth-paris-landmarks';

export const EARTH_LANDMARK_MAX_RENDERED_HEIGHT_PIXELS = 112;
const MIN_RENDERED_HEIGHT_PIXELS = 36;
const DEFAULT_VERTICAL_FIELD_OF_VIEW_DEGREES = 82;
const DEFAULT_VIEWPORT_HEIGHT = 900;
const MIN_VISUAL_DISTANCE_METERS = 500;

const ILLUSTRATIVE_HEIGHT_BY_FAMILY: Readonly<Record<EarthLandmarkSilhouetteFamily, number>> = {
  skyscraper: 220,
  tower: 140,
  bridge: 80,
  monument: 55,
  religious: 70,
  palace: 45,
  stadium: 50,
  'historic-building': 50,
  'mountain-natural': 120,
  'generic-landmark': 42,
  cathedral: 90,
  mosque: 80,
  pagoda: 55,
  'triumphal-arch': 50,
  obelisk: 80,
  statue: 50,
  'suspension-bridge': 80,
  'arch-bridge': 45,
};

export interface EarthLandmarkLayout extends EarthLandmarkDefinition {
  readonly bearingDegrees: number;
  readonly centerX: number;
  readonly effectiveHeightMeters: number;
  readonly height: number;
  readonly visualDistanceMeters: number;
  readonly width: number;
  readonly x: number;
  readonly y: number;
}

export interface EarthLandmarkProjectionViewport {
  readonly verticalFieldOfViewDegrees: number;
  readonly viewportHeight: number;
}

export function projectEarthLandmarkLayouts(
  observer: Pick<EarthObserverLocation, 'latitude' | 'longitude'>,
  landmarks: readonly EarthLandmarkDefinition[],
  panoramaUnitsPerRenderedPixel: number,
  viewport: EarthLandmarkProjectionViewport = {
    verticalFieldOfViewDegrees: DEFAULT_VERTICAL_FIELD_OF_VIEW_DEGREES,
    viewportHeight: DEFAULT_VIEWPORT_HEIGHT,
  },
): readonly EarthLandmarkLayout[] {
  if (landmarks.length === 0) {
    return [];
  }
  const unitsPerPixel = validUnitsPerPixel(panoramaUnitsPerRenderedPixel);
  const effectiveHeights = landmarks.map(effectiveLandmarkHeightMeters);
  const verticalFieldOfViewRadians = degreesToRadians(
    validVerticalFieldOfView(viewport.verticalFieldOfViewDegrees),
  );
  const viewportHeight = validViewportHeight(viewport.viewportHeight);

  return landmarks.map((landmark, index) => {
    const effectiveHeightMeters = effectiveHeights[index]!;
    const visualDistanceMeters = Math.max(MIN_VISUAL_DISTANCE_METERS, landmark.distanceMeters);
    const angularHeightRadians = Math.atan2(effectiveHeightMeters, visualDistanceMeters);
    const renderedHeightPixels = Math.min(
      EARTH_LANDMARK_MAX_RENDERED_HEIGHT_PIXELS,
      Math.max(
        MIN_RENDERED_HEIGHT_PIXELS,
        (angularHeightRadians / verticalFieldOfViewRadians) * viewportHeight,
      ),
    );
    const height = renderedHeightPixels * unitsPerPixel;
    const width = height * landmark.sourceAspectRatio;
    const bearingDegrees = earthLandmarkBearingDegrees(observer, landmark);
    const centerX = (bearingDegrees / 360) * PARIS_PANORAMA_WIDTH;

    return {
      ...landmark,
      bearingDegrees,
      centerX,
      effectiveHeightMeters,
      height,
      visualDistanceMeters,
      width,
      x: centerX - width / 2,
      y: PARIS_PANORAMA_HEIGHT - height,
    };
  });
}

export function earthLandmarkBearingDegrees(
  origin: Pick<EarthObserverLocation, 'latitude' | 'longitude'>,
  destination: Pick<EarthLandmarkDefinition, 'latitude' | 'longitude'>,
): number {
  const originLatitude = degreesToRadians(origin.latitude);
  const destinationLatitude = degreesToRadians(destination.latitude);
  const longitudeDelta = degreesToRadians(destination.longitude - origin.longitude);
  const y = Math.sin(longitudeDelta) * Math.cos(destinationLatitude);
  const x =
    Math.cos(originLatitude) * Math.sin(destinationLatitude) -
    Math.sin(originLatitude) * Math.cos(destinationLatitude) * Math.cos(longitudeDelta);

  return normalizeDegrees(radiansToDegrees(Math.atan2(y, x)));
}

function effectiveLandmarkHeightMeters(landmark: EarthLandmarkDefinition): number {
  const family = earthLandmarkSilhouetteProfile(landmark.category, landmark.name).family;

  return landmark.heightMeters ?? ILLUSTRATIVE_HEIGHT_BY_FAMILY[family];
}

function validUnitsPerPixel(value: number): number {
  return Number.isFinite(value) && value > 0 ? value : 1;
}

function validVerticalFieldOfView(value: number): number {
  return Number.isFinite(value) && value > 0 && value < 180
    ? value
    : DEFAULT_VERTICAL_FIELD_OF_VIEW_DEGREES;
}

function validViewportHeight(value: number): number {
  return Number.isFinite(value) && value > 0 ? value : DEFAULT_VIEWPORT_HEIGHT;
}

function normalizeDegrees(value: number): number {
  return ((value % 360) + 360) % 360;
}

function degreesToRadians(value: number): number {
  return (value * Math.PI) / 180;
}

function radiansToDegrees(value: number): number {
  return (value * 180) / Math.PI;
}
