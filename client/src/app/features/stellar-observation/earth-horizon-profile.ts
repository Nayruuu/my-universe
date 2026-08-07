import type { EarthObserverLocation } from '../../../engine/simulation/earth-observer-location';
import { earthCityLightDensity } from './earth-city-lighting';
import {
  earthHorizonCityscape,
  type EarthHorizonCityscapeKind,
  type EarthHorizonLightDensity,
} from './earth-horizon-cityscapes';
import { PARIS_EIFFEL_VISUAL_SCALE } from './earth-paris-landmarks';

export type EarthHorizonLandmarkKind =
  | 'eiffel-tower'
  | 'statue-of-liberty'
  | 'mount-fuji'
  | 'elizabeth-tower'
  | 'sydney-opera-house'
  | 'giza-pyramids'
  | 'christ-the-redeemer'
  | 'n-seoul-tower';

export interface EarthHorizonViewport {
  readonly width: number;
  readonly height: number;
}

export interface EarthHorizonPerspective {
  readonly centerAzimuthDegrees: number;
  readonly verticalFieldOfViewDegrees: number;
  readonly viewport: EarthHorizonViewport;
}

export interface EarthIllustrativeLandscapePresentation {
  readonly opacity: number;
  readonly state: 'full' | 'fading' | 'hidden';
}

export interface EarthHorizonLandmark {
  readonly kind: EarthHorizonLandmarkKind;
  readonly name: string;
  readonly bearingDegrees: number;
  readonly scale: number;
}

export interface ProjectedEarthHorizonLandmark {
  readonly kind: EarthHorizonLandmarkKind;
  readonly name: string;
  readonly scale: number;
  readonly xPercent: number;
}

export interface EarthHorizonProfile {
  readonly location: EarthObserverLocation;
  readonly farRidgeClipPath: string;
  readonly nearRidgeClipPath: string;
  readonly landscapeKind: 'cityscape' | 'plain';
  readonly cityscapeKind: EarthHorizonCityscapeKind;
  readonly accentHueDegrees: number;
  readonly lightHueDegrees: number;
  readonly lightDensity: EarthHorizonLightDensity;
  readonly landmark: EarthHorizonLandmark | null;
}

interface LandmarkDefinition {
  readonly kind: EarthHorizonLandmarkKind;
  readonly name: string;
  readonly latitude: number;
  readonly longitude: number;
  readonly scale: number;
}

// Coordinates are used only to orient an illustrative silhouette. Reference locations come from
// official heritage, government, and tourism records documented in the project history.
const LANDMARKS: Readonly<Record<string, LandmarkDefinition>> = {
  paris: {
    kind: 'eiffel-tower',
    name: 'Tour Eiffel',
    latitude: 48.85837,
    longitude: 2.294481,
    scale: PARIS_EIFFEL_VISUAL_SCALE,
  },
  'geonames-5128581': {
    kind: 'statue-of-liberty',
    name: 'Statue of Liberty',
    latitude: 40.689211,
    longitude: -74.044643,
    scale: 0.82,
  },
  'geonames-1850147': {
    kind: 'mount-fuji',
    name: 'Mount Fuji',
    latitude: 35.360833,
    longitude: 138.7275,
    scale: 1.5,
  },
  'geonames-2643743': {
    kind: 'elizabeth-tower',
    name: 'Elizabeth Tower',
    latitude: 51.5007,
    longitude: -0.12457,
    scale: 0.94,
  },
  'geonames-2147714': {
    kind: 'sydney-opera-house',
    name: 'Sydney Opera House',
    latitude: -33.8566674153,
    longitude: 151.215221336,
    scale: 1.18,
  },
  'geonames-360630': {
    kind: 'giza-pyramids',
    name: 'Giza pyramid fields',
    latitude: 29.97604,
    longitude: 31.13041,
    scale: 1.28,
  },
  'geonames-3451190': {
    kind: 'christ-the-redeemer',
    name: 'Cristo Redentor',
    latitude: -22.95192,
    longitude: -43.21046,
    scale: 0.9,
  },
  'geonames-1835848': {
    kind: 'n-seoul-tower',
    name: 'N Seoul Tower',
    latitude: 37.5512,
    longitude: 126.9882,
    scale: 1,
  },
};

const ILLUSTRATIVE_LANDSCAPE_HIDDEN_FIELD_OF_VIEW_DEGREES = 18;
const ILLUSTRATIVE_LANDSCAPE_FULL_FIELD_OF_VIEW_DEGREES = 42;

// Buildings and procedural ridges are artistic orientation aids, not a geometric obstruction
// model. Keep them at normal naked-eye fields, then remove them before telescope-scale zooms.
export function earthIllustrativeLandscapePresentation(
  verticalFieldOfViewDegrees: number,
): EarthIllustrativeLandscapePresentation {
  const fieldOfViewDegrees = Number.isFinite(verticalFieldOfViewDegrees)
    ? verticalFieldOfViewDegrees
    : ILLUSTRATIVE_LANDSCAPE_FULL_FIELD_OF_VIEW_DEGREES;
  const opacity = Math.min(
    1,
    Math.max(
      0,
      (fieldOfViewDegrees - ILLUSTRATIVE_LANDSCAPE_HIDDEN_FIELD_OF_VIEW_DEGREES) /
        (ILLUSTRATIVE_LANDSCAPE_FULL_FIELD_OF_VIEW_DEGREES -
          ILLUSTRATIVE_LANDSCAPE_HIDDEN_FIELD_OF_VIEW_DEGREES),
    ),
  );

  return {
    opacity,
    state: opacity === 0 ? 'hidden' : opacity === 1 ? 'full' : 'fading',
  };
}

export function createEarthHorizonProfile(location: EarthObserverLocation): EarthHorizonProfile {
  const seed = hashText(`${location.id}:${location.latitude}:${location.longitude}`);
  const definition = LANDMARKS[location.id];
  const cityscape = earthHorizonCityscape(location.id);
  const plainLandscape = location.id.startsWith('coordinates-');

  return {
    location,
    farRidgeClipPath:
      cityscape?.farRidgeClipPath ??
      (plainLandscape
        ? createPlainClipPath(seed ^ 0x51f2_a84d, 72, 4)
        : createSkylineClipPath(seed ^ 0x51f2_a84d, 61, 16)),
    nearRidgeClipPath:
      cityscape?.nearRidgeClipPath ??
      (plainLandscape
        ? createPlainClipPath(seed ^ 0x9e37_79b9, 68, 7)
        : createSkylineClipPath(seed ^ 0x9e37_79b9, 69, 24)),
    landscapeKind: plainLandscape ? 'plain' : 'cityscape',
    cityscapeKind: cityscape?.kind ?? 'procedural',
    accentHueDegrees: cityscape?.atmosphereHueDegrees ?? 188 + (seed % 34),
    lightHueDegrees: cityscape?.lightHueDegrees ?? 38 + (seed % 18),
    lightDensity: plainLandscape
      ? 'quiet'
      : (cityscape?.lightDensity ?? earthCityLightDensity(location)),
    landmark: definition
      ? {
          kind: definition.kind,
          name: definition.name,
          bearingDegrees: initialBearingDegrees(location, definition),
          scale: definition.scale,
        }
      : null,
  };
}

function createPlainClipPath(seed: number, baseline: number, variation: number): string {
  const random = seededRandom(seed);
  const points = ['0% 100%', `0% ${formatPercentage(baseline)}`];
  const segmentCount = 10;

  for (let segment = 1; segment <= segmentCount; segment += 1) {
    const x = (segment / segmentCount) * 100;
    const y = baseline + (random() - 0.5) * variation;

    points.push(`${formatPercentage(x)} ${formatPercentage(y)}`);
  }
  points.push('100% 100%');

  return `polygon(${points.join(', ')})`;
}

export function projectEarthHorizonLandmark(
  landmark: EarthHorizonLandmark,
  perspective: EarthHorizonPerspective,
): ProjectedEarthHorizonLandmark | null {
  const width = Math.max(1, perspective.viewport.width);
  const height = Math.max(1, perspective.viewport.height);
  const verticalFieldOfViewDegrees = Number.isFinite(perspective.verticalFieldOfViewDegrees)
    ? Math.min(160, Math.max(10, perspective.verticalFieldOfViewDegrees))
    : 82;
  const verticalTangent = Math.tan(degreesToRadians(verticalFieldOfViewDegrees) / 2);
  const horizontalTangent = verticalTangent * (width / height);
  const relativeAzimuthRadians = degreesToRadians(
    signedAngularDifferenceDegrees(landmark.bearingDegrees, perspective.centerAzimuthDegrees),
  );
  const normalizedX = Math.tan(relativeAzimuthRadians) / horizontalTangent;

  if (Math.cos(relativeAzimuthRadians) <= 0 || Math.abs(normalizedX) > 1.12) {
    return null;
  }

  return {
    kind: landmark.kind,
    name: landmark.name,
    scale: landmark.scale,
    xPercent: 50 + normalizedX * 50,
  };
}

function createSkylineClipPath(seed: number, baseline: number, variation: number): string {
  const random = seededRandom(seed);
  const points = ['0% 100%', `0% ${baseline}%`];
  let x = 0;

  while (x < 100) {
    const width = 4 + random() * 7;
    const nextX = Math.min(100, x + width);
    const roof = baseline - random() * variation;

    points.push(`${formatPercentage(x)} ${formatPercentage(roof)}`);
    points.push(`${formatPercentage(nextX)} ${formatPercentage(roof)}`);
    x = nextX;
  }
  points.push('100% 100%');

  return `polygon(${points.join(', ')})`;
}

function initialBearingDegrees(
  origin: Pick<EarthObserverLocation, 'latitude' | 'longitude'>,
  destination: Pick<LandmarkDefinition, 'latitude' | 'longitude'>,
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

function signedAngularDifferenceDegrees(target: number, center: number): number {
  return ((target - center + 540) % 360) - 180;
}

function hashText(value: string): number {
  let hash = 2_166_136_261;

  for (let index = 0; index < value.length; index += 1) {
    hash = Math.imul(hash ^ value.charCodeAt(index), 16_777_619);
  }

  return hash >>> 0;
}

function seededRandom(seed: number): () => number {
  let state = seed >>> 0;

  return () => {
    state = (Math.imul(state, 1_664_525) + 1_013_904_223) >>> 0;

    return state / 4_294_967_296;
  };
}

function formatPercentage(value: number): string {
  return `${value.toFixed(2)}%`;
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
