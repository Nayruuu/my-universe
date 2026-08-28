import type {
  GraphicQuality,
  LabelDensity,
  SpaceObjectType,
} from '../../data/models/universe.models';
import type { LabelCandidate } from './label-candidate-collector';
import {
  getMaximumLabelCount,
  isCosmicCatalogLabel,
  isScaleLandmarkAtLevel,
  isSolarSystemLabelAtLevel,
  isSolarSystemPrimaryLabel,
  type LabelObject,
} from './label-visibility-policy';

export interface LabelRenderFlags {
  readonly drawAnchor: boolean;
  readonly solarSystemLabel: boolean;
  readonly solarSystemPrimaryLabel: boolean;
  readonly scaleLandmark: boolean;
}

const ANCHORED_LABEL_TYPES = new Set<SpaceObjectType>([
  'star',
  'black-hole',
  'supernova',
  'supernova-remnant',
]);
const LABEL_PLACEMENT_OVERSCAN = 8;
const GALACTIC_CONTEXT_LABEL_FADE_INNER_DISTANCE = 5_000;
const GALACTIC_CONTEXT_LABEL_FADE_OUTER_DISTANCE = 7_000;

export function getMaximumOrdinaryLabelCount(
  quality: GraphicQuality,
  lodLevel: number,
  density: LabelDensity,
  candidates: readonly LabelCandidate[],
): number {
  const maximumLabels = getMaximumLabelCount(quality, lodLevel, density);
  const hasScaleLandmark = candidates.some(({ object }) =>
    isScaleLandmarkAtLevel(object, lodLevel),
  );

  return maximumLabels - Number(hasScaleLandmark);
}

export function getMaximumOrdinaryLabelPlacementAttempts(maximumLabels: number): number {
  return maximumLabels * LABEL_PLACEMENT_OVERSCAN;
}

export function isLabelWithinOrdinaryBudget(
  candidate: LabelCandidate,
  scaleLandmark: boolean,
  renderedOrdinaryLabels: number,
  maximumOrdinaryLabels: number,
): boolean {
  return renderedOrdinaryLabels < maximumOrdinaryLabels || candidate.selected || scaleLandmark;
}

export function getLabelRenderFlags(object: LabelObject, lodLevel: number): LabelRenderFlags {
  const solarSystemPrimaryLabel = isSolarSystemPrimaryLabel(object, lodLevel);

  return {
    drawAnchor:
      solarSystemPrimaryLabel ||
      (object.id !== 'sun' &&
        (ANCHORED_LABEL_TYPES.has(object.type) || isCosmicCatalogLabel(object))),
    solarSystemLabel: isSolarSystemLabelAtLevel(object, lodLevel),
    solarSystemPrimaryLabel,
    scaleLandmark: isScaleLandmarkAtLevel(object, lodLevel),
  };
}

/**
 * Removes Local Group map annotations before the Milky Way becomes an environment. The curve is
 * presentational only: active labels remain available and astronomical visibility is unchanged.
 */
export function calculateGalacticContextLabelOpacity(cameraDistance: number): number {
  if (Number.isNaN(cameraDistance) || cameraDistance === Number.POSITIVE_INFINITY) {
    return 1;
  }
  if (cameraDistance === Number.NEGATIVE_INFINITY) {
    return 0;
  }
  const progress = Math.max(
    0,
    Math.min(
      1,
      (cameraDistance - GALACTIC_CONTEXT_LABEL_FADE_INNER_DISTANCE) /
        (GALACTIC_CONTEXT_LABEL_FADE_OUTER_DISTANCE - GALACTIC_CONTEXT_LABEL_FADE_INNER_DISTANCE),
    ),
  );

  return progress * progress * (3 - 2 * progress);
}
