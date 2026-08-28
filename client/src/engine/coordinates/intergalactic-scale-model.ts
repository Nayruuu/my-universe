import { CoordinateSystem } from './coordinate-system';

export const LOCAL_GROUP_SCALE_DISTANCE = 17_000;
export const NEARBY_UNIVERSE_SCALE_DISTANCE = 120_000;
export const COSMIC_WEB_SCALE_DISTANCE = 420_000;

export type IntergalacticReferenceFrameBlend =
  | 'local-group'
  | 'local-group-to-nearby-universe'
  | 'nearby-universe'
  | 'nearby-universe-to-cosmic-web'
  | 'cosmic-web';

export interface IntergalacticScale {
  readonly sceneUnitsPerMegaparsec: number;
  readonly localGroupScale: number;
  readonly nearbyUniverseScale: number;
  readonly cosmicWebScale: number;
  readonly referenceFrameBlend: IntergalacticReferenceFrameBlend;
}

const coordinateSystem = new CoordinateSystem();

export const LOCAL_GROUP_NATIVE_SCENE_UNITS_PER_MEGAPARSEC = coordinateSystem.toSceneDistance(
  1,
  'megaparsec',
  'local-group',
);
export const NEARBY_UNIVERSE_NATIVE_SCENE_UNITS_PER_MEGAPARSEC = coordinateSystem.toSceneDistance(
  1,
  'megaparsec',
  'nearby-universe',
);
export const COSMIC_WEB_NATIVE_SCENE_UNITS_PER_MEGAPARSEC = coordinateSystem.toSceneDistance(
  1,
  'megaparsec',
  'cosmic-web',
);

/**
 * Resolves one shared linear metric for every intergalactic catalogue.
 *
 * The native frame scales remain authoring units. Their scene roots compensate those differences,
 * so positions and physical diameters keep the same ratios while the semantic camera scale changes.
 */
export function calculateIntergalacticScale(cameraDistance: number): IntergalacticScale {
  const distance = normalizeDistance(cameraDistance);
  let sceneUnitsPerMegaparsec: number;
  let referenceFrameBlend: IntergalacticReferenceFrameBlend;

  if (distance <= LOCAL_GROUP_SCALE_DISTANCE) {
    sceneUnitsPerMegaparsec = LOCAL_GROUP_NATIVE_SCENE_UNITS_PER_MEGAPARSEC;
    referenceFrameBlend = 'local-group';
  } else if (distance < NEARBY_UNIVERSE_SCALE_DISTANCE) {
    const progress = logarithmicSmoothstep(
      LOCAL_GROUP_SCALE_DISTANCE,
      NEARBY_UNIVERSE_SCALE_DISTANCE,
      distance,
    );

    sceneUnitsPerMegaparsec = interpolateLogarithmically(
      LOCAL_GROUP_NATIVE_SCENE_UNITS_PER_MEGAPARSEC,
      NEARBY_UNIVERSE_NATIVE_SCENE_UNITS_PER_MEGAPARSEC,
      progress,
    );
    referenceFrameBlend = 'local-group-to-nearby-universe';
  } else if (distance <= NEARBY_UNIVERSE_SCALE_DISTANCE) {
    sceneUnitsPerMegaparsec = NEARBY_UNIVERSE_NATIVE_SCENE_UNITS_PER_MEGAPARSEC;
    referenceFrameBlend = 'nearby-universe';
  } else if (distance < COSMIC_WEB_SCALE_DISTANCE) {
    const progress = logarithmicSmoothstep(
      NEARBY_UNIVERSE_SCALE_DISTANCE,
      COSMIC_WEB_SCALE_DISTANCE,
      distance,
    );

    sceneUnitsPerMegaparsec = interpolateLogarithmically(
      NEARBY_UNIVERSE_NATIVE_SCENE_UNITS_PER_MEGAPARSEC,
      COSMIC_WEB_NATIVE_SCENE_UNITS_PER_MEGAPARSEC,
      progress,
    );
    referenceFrameBlend = 'nearby-universe-to-cosmic-web';
  } else {
    sceneUnitsPerMegaparsec = COSMIC_WEB_NATIVE_SCENE_UNITS_PER_MEGAPARSEC;
    referenceFrameBlend = 'cosmic-web';
  }

  return {
    sceneUnitsPerMegaparsec,
    localGroupScale: sceneUnitsPerMegaparsec / LOCAL_GROUP_NATIVE_SCENE_UNITS_PER_MEGAPARSEC,
    nearbyUniverseScale:
      sceneUnitsPerMegaparsec / NEARBY_UNIVERSE_NATIVE_SCENE_UNITS_PER_MEGAPARSEC,
    cosmicWebScale: sceneUnitsPerMegaparsec / COSMIC_WEB_NATIVE_SCENE_UNITS_PER_MEGAPARSEC,
    referenceFrameBlend,
  };
}

function normalizeDistance(cameraDistance: number): number {
  return Number.isFinite(cameraDistance) ? Math.max(0, cameraDistance) : LOCAL_GROUP_SCALE_DISTANCE;
}

function logarithmicSmoothstep(minimum: number, maximum: number, value: number): number {
  const progress = Math.max(
    0,
    Math.min(1, Math.log(value / minimum) / Math.log(maximum / minimum)),
  );

  return progress * progress * (3 - 2 * progress);
}

function interpolateLogarithmically(start: number, end: number, progress: number): number {
  return Math.exp(Math.log(start) + (Math.log(end) - Math.log(start)) * progress);
}
