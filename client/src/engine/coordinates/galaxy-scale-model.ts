import type { SpaceObject } from '../../data/models/universe.models';
import { MILKY_WAY_TRANSITION_START } from '../lod/milky-way-transition';
import { CoordinateSystem } from './coordinate-system';
import {
  calculateIntergalacticScale,
  type IntergalacticReferenceFrameBlend,
  NEARBY_UNIVERSE_SCALE_DISTANCE,
} from './intergalactic-scale-model';

/**
 * Canonical luminous-disc diameter used by the application.
 * Source: Reid et al. 2019, ApJ 885:131; mirrored by the local Milky Way dataset.
 */
export const MILKY_WAY_DIAMETER_LIGHT_YEARS = 100_000;

/** Authoring width of the procedural shader domain before reference-frame conversion. */
export const MILKY_WAY_PROCEDURAL_AUTHORING_DIAMETER = 11_400;

/** Authoring thickness used to keep the local stellar sample inside the documented Galactic disc. */
export const MILKY_WAY_STELLAR_CONTAINMENT_AUTHORING_THICKNESS = 1_100;

/**
 * Illustrative luminous envelope used by the ray-marched volume. It includes the faint thick-disc
 * haze around the narrower stellar-containment slab, so an approach through the Galactic plane
 * reads as a volume rather than a flat particle ribbon.
 */
export const MILKY_WAY_PROCEDURAL_AUTHORING_THICKNESS = 4_200;

export interface MilkyWaySceneScale {
  readonly modelScale: number;
  /** Illustrative luminous-envelope diameter actually rendered in scene units. */
  readonly worldDiameter: number;
  /** Canonical documented diameter in the current Galactic reference-frame metric. */
  readonly physicalWorldDiameter: number;
  readonly visualScaleFactor: number;
  readonly visualSceneUnitsPerKiloparsec: number;
  readonly referenceFrameSceneUnitsPerKiloparsec: number;
  readonly referenceFrameBlend: MilkyWayReferenceFrameBlend;
}

export interface MilkyWayReferenceFrameScale {
  readonly worldDiameter: number;
  readonly sceneUnitsPerKiloparsec: number;
  readonly referenceFrameBlend: MilkyWayReferenceFrameBlend;
}

type MilkyWayReferenceFrameBlend =
  'galactic' | 'intergalactic-to-galactic' | IntergalacticReferenceFrameBlend;

export type GalaxyDiameterTreatment =
  | 'documented-physical-diameter'
  | 'documented-half-light-diameter'
  | 'illustrative-visual-radius-fallback';

export interface GalaxyRenderScale {
  readonly renderDiameter: number;
  readonly physicalSceneDiameter: number | null;
  readonly diameterTreatment: GalaxyDiameterTreatment;
}

/**
 * The canonical Milky Way metric begins converting while the camera is still in the nearby
 * Universe. It preserves the documented diameter and Galactic coordinates independently from the
 * illustrative close-view envelope used by the procedural renderer.
 */
export const MILKY_WAY_REFERENCE_FRAME_TRANSITION_END = NEARBY_UNIVERSE_SCALE_DISTANCE;

/**
 * Illustrative close-view enlargement of the procedural luminous envelope. The measured diameter,
 * Galactic coordinates, picking proxy, and map scale keep the canonical reference-frame metric.
 */
export const MILKY_WAY_IMMERSIVE_VISUAL_SCALE = 4;

const coordinateSystem = new CoordinateSystem();
const MILKY_WAY_DIAMETER_KILOPARSECS =
  coordinateSystem.toSceneDistance(MILKY_WAY_DIAMETER_LIGHT_YEARS, 'light-year', 'local-group') /
  coordinateSystem.toSceneDistance(1, 'kiloparsec', 'local-group');
const GALACTIC_SCENE_UNITS_PER_KILOPARSEC = coordinateSystem.toSceneDistance(
  1,
  'kiloparsec',
  'galactic',
);
const MILKY_WAY_VISUAL_SCENE_UNITS_PER_KILOPARSEC =
  GALACTIC_SCENE_UNITS_PER_KILOPARSEC * MILKY_WAY_IMMERSIVE_VISUAL_SCALE;
const REFERENCE_FRAME_BOUNDARY_EPSILON = 0.001;

export function getGalaxyPhysicalSceneDiameter(object: SpaceObject): number | null {
  return resolveDocumentedGalaxyDiameter(object)?.sceneDiameter ?? null;
}

export function getGalaxyRenderDiameter(object: SpaceObject): number {
  return getGalaxyRenderScale(object).renderDiameter;
}

export function getGalaxyRenderScale(object: SpaceObject): GalaxyRenderScale {
  const documented = resolveDocumentedGalaxyDiameter(object);

  if (documented) {
    return {
      renderDiameter: documented.sceneDiameter,
      physicalSceneDiameter: documented.sceneDiameter,
      diameterTreatment: documented.treatment,
    };
  }

  return {
    renderDiameter: object.visual.visualRadius * 2,
    physicalSceneDiameter: null,
    diameterTreatment: 'illustrative-visual-radius-fallback',
  };
}

export function calculateMilkyWaySceneScale(cameraDistance: number): MilkyWaySceneScale {
  const visualMetric = calculateMilkyWayMetric(
    cameraDistance,
    MILKY_WAY_VISUAL_SCENE_UNITS_PER_KILOPARSEC,
    logarithmicVisualApproachProgress,
  );
  const referenceFrame = calculateMilkyWayReferenceFrameScale(cameraDistance);
  const worldDiameter = MILKY_WAY_DIAMETER_KILOPARSECS * visualMetric.sceneUnitsPerKiloparsec;

  return {
    modelScale: worldDiameter / MILKY_WAY_PROCEDURAL_AUTHORING_DIAMETER,
    worldDiameter,
    physicalWorldDiameter: referenceFrame.worldDiameter,
    visualScaleFactor: worldDiameter / referenceFrame.worldDiameter,
    visualSceneUnitsPerKiloparsec: visualMetric.sceneUnitsPerKiloparsec,
    referenceFrameSceneUnitsPerKiloparsec: referenceFrame.sceneUnitsPerKiloparsec,
    referenceFrameBlend: referenceFrame.referenceFrameBlend,
  };
}

export function calculateMilkyWayReferenceFrameScale(
  cameraDistance: number,
): MilkyWayReferenceFrameScale {
  const metric = calculateMilkyWayMetric(
    cameraDistance,
    GALACTIC_SCENE_UNITS_PER_KILOPARSEC,
    logarithmicReferenceFrameProgress,
  );

  return {
    worldDiameter: MILKY_WAY_DIAMETER_KILOPARSECS * metric.sceneUnitsPerKiloparsec,
    sceneUnitsPerKiloparsec: metric.sceneUnitsPerKiloparsec,
    referenceFrameBlend: metric.referenceFrameBlend,
  };
}

export function calculateGalacticFrameScale(cameraDistance: number): number {
  return (
    calculateMilkyWayReferenceFrameScale(cameraDistance).sceneUnitsPerKiloparsec /
    GALACTIC_SCENE_UNITS_PER_KILOPARSEC
  );
}

function calculateMilkyWayMetric(
  cameraDistance: number,
  galacticSceneUnitsPerKiloparsec: number,
  approachProgress: (outerDistance: number, innerDistance: number, distance: number) => number,
): Pick<MilkyWayReferenceFrameScale, 'sceneUnitsPerKiloparsec' | 'referenceFrameBlend'> {
  const distance = normalizeDistance(cameraDistance);
  let sceneUnitsPerKiloparsec: number;
  let referenceFrameBlend: MilkyWayReferenceFrameBlend;

  if (distance <= MILKY_WAY_TRANSITION_START + REFERENCE_FRAME_BOUNDARY_EPSILON) {
    sceneUnitsPerKiloparsec = galacticSceneUnitsPerKiloparsec;
    referenceFrameBlend = 'galactic';
  } else if (
    distance <
    MILKY_WAY_REFERENCE_FRAME_TRANSITION_END - REFERENCE_FRAME_BOUNDARY_EPSILON
  ) {
    const exteriorScale = calculateIntergalacticScale(distance).sceneUnitsPerMegaparsec / 1_000;
    const progress = approachProgress(
      MILKY_WAY_REFERENCE_FRAME_TRANSITION_END,
      MILKY_WAY_TRANSITION_START,
      distance,
    );

    sceneUnitsPerKiloparsec = interpolateLogarithmically(
      exteriorScale,
      galacticSceneUnitsPerKiloparsec,
      progress,
    );
    referenceFrameBlend = 'intergalactic-to-galactic';
  } else {
    const intergalacticScale = calculateIntergalacticScale(distance);

    sceneUnitsPerKiloparsec = intergalacticScale.sceneUnitsPerMegaparsec / 1_000;
    referenceFrameBlend = intergalacticScale.referenceFrameBlend;
  }

  return {
    sceneUnitsPerKiloparsec,
    referenceFrameBlend,
  };
}

function normalizeDistance(cameraDistance: number): number {
  if (!Number.isFinite(cameraDistance)) {
    return MILKY_WAY_REFERENCE_FRAME_TRANSITION_END;
  }

  return Math.max(0, cameraDistance);
}

function logarithmicVisualApproachProgress(
  outerDistance: number,
  innerDistance: number,
  distance: number,
): number {
  const linearProgress = logarithmicLinearProgress(outerDistance, innerDistance, distance);

  // Keep the distant silhouette compact, then spend the complete approach resolving the larger
  // illustrative envelope. Reaching the final scale early made the last part of the dive feel like
  // a fast pass through a small model even though camera motion itself was continuous.
  return linearProgress * linearProgress * (3 - 2 * linearProgress);
}

function logarithmicReferenceFrameProgress(
  outerDistance: number,
  innerDistance: number,
  distance: number,
): number {
  const linearProgress = logarithmicLinearProgress(outerDistance, innerDistance, distance);
  const extendedProgress = Math.min(1, linearProgress / 0.72);

  return extendedProgress * extendedProgress * (3 - 2 * extendedProgress);
}

function logarithmicLinearProgress(
  outerDistance: number,
  innerDistance: number,
  distance: number,
): number {
  const clampedDistance = Math.max(innerDistance, Math.min(outerDistance, distance));

  return (
    (Math.log(outerDistance) - Math.log(clampedDistance)) /
    (Math.log(outerDistance) - Math.log(innerDistance))
  );
}

function interpolateLogarithmically(start: number, end: number, progress: number): number {
  return Math.exp(Math.log(start) + (Math.log(end) - Math.log(start)) * progress);
}

function resolveDocumentedGalaxyDiameter(object: SpaceObject): {
  readonly sceneDiameter: number;
  readonly treatment: Exclude<GalaxyDiameterTreatment, 'illustrative-visual-radius-fallback'>;
} | null {
  if (object.type !== 'galaxy') {
    return null;
  }

  const diameterLightYears = positiveMetadataNumber(object, 'diameterLy');

  if (diameterLightYears !== null) {
    return {
      sceneDiameter: coordinateSystem.toSceneDistance(
        diameterLightYears,
        'light-year',
        object.referenceFrame,
      ),
      treatment: 'documented-physical-diameter',
    };
  }

  const halfLightRadiusParsecs = positiveMetadataNumber(object, 'halfLightRadiusPc');

  if (halfLightRadiusParsecs === null) {
    return null;
  }

  return {
    sceneDiameter: coordinateSystem.toSceneDistance(
      halfLightRadiusParsecs * 2,
      'parsec',
      object.referenceFrame,
    ),
    treatment: 'documented-half-light-diameter',
  };
}

function positiveMetadataNumber(
  object: SpaceObject,
  key: 'diameterLy' | 'halfLightRadiusPc',
): number | null {
  const value = object.metadata?.[key];

  return typeof value === 'number' && Number.isFinite(value) && value > 0 ? value : null;
}
