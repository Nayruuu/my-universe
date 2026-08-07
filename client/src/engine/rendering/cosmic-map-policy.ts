import { CosmicStructureType, GraphicQuality } from '../../data/models/universe.models';

export type CosmicMapLayer =
  'volume' | 'groups' | 'links' | 'clusters' | 'superclusters' | 'filaments' | 'voids';

export interface CosmicMapLayers {
  readonly volume: boolean;
  readonly groups: boolean;
  readonly links: boolean;
  readonly clusters: boolean;
  readonly superclusters: boolean;
  readonly filaments: boolean;
  readonly voids: boolean;
}

export const DEFAULT_COSMIC_MAP_LAYERS: CosmicMapLayers = Object.freeze({
  volume: true,
  groups: true,
  links: true,
  clusters: true,
  superclusters: true,
  filaments: true,
  voids: true,
});

export const ALL_COSMIC_MAP_LAYERS: CosmicMapLayers = Object.freeze({
  volume: true,
  groups: true,
  links: true,
  clusters: true,
  superclusters: true,
  filaments: true,
  voids: true,
});

const FAR_OVERVIEW_DISTANCE = 900_000;
const REFERENCE_OVERVIEW_DISTANCE = 420_000;
const FULL_DETAIL_DISTANCE = 170_000;
const FAR_DETAIL = 0.018;
const REFERENCE_DETAIL = 0.075;
const QUALITY_DETAIL_FACTORS = {
  low: 0.55,
  medium: 0.78,
  high: 1,
} as const satisfies Record<GraphicQuality, number>;
const FILAMENT_SPINE_REVEAL_RANGE = 0.64;

export function getCosmicMapDetail(cameraDistance: number, quality: GraphicQuality): number {
  const distance = Math.max(0, cameraDistance);
  const unscaledDetail =
    distance >= REFERENCE_OVERVIEW_DISTANCE
      ? interpolateSmoothly(
          FAR_DETAIL,
          REFERENCE_DETAIL,
          normalizedProgress(FAR_OVERVIEW_DISTANCE, REFERENCE_OVERVIEW_DISTANCE, distance),
        )
      : interpolateSmoothly(
          REFERENCE_DETAIL,
          1,
          normalizedProgress(REFERENCE_OVERVIEW_DISTANCE, FULL_DETAIL_DISTANCE, distance),
        );

  return Math.min(1, unscaledDetail * QUALITY_DETAIL_FACTORS[quality]);
}

export function getCosmicGroupDetail(cameraDistance: number, quality: GraphicQuality): number {
  return Math.min(1, getCosmicMapDetail(cameraDistance, quality) * 3.4);
}

export function stableMapPriority(identifier: string): number {
  let hash = 2_166_136_261;

  for (let index = 0; index < identifier.length; index += 1) {
    hash ^= identifier.charCodeAt(index);
    hash = Math.imul(hash, 16_777_619);
  }

  return (hash >>> 0) / 4_294_967_296;
}

export function getCosmicGroupRevealThreshold(identifier: string): number {
  return Math.min(1, stableMapPriority(identifier) / 0.72);
}

export function getCosmicFilamentSpineRevealThreshold(identifier: string): number {
  return stableMapPriority(identifier) * FILAMENT_SPINE_REVEAL_RANGE;
}

export function getCosmicStructureRevealThreshold(
  identifier: string,
  structureType: CosmicStructureType,
  sourceId: string,
): number {
  const priority = stableMapPriority(identifier);

  if (structureType === 'supercluster') {
    return superclusterThreshold(priority, sourceId);
  }
  if (structureType === 'cluster') {
    return priority * 0.72;
  }
  if (structureType === 'filament') {
    return 0.04 + priority * 0.96;
  }
  if (structureType === 'void') {
    return priority * 0.18;
  }

  return priority;
}

export function getCosmicStructureLayer(structureType: CosmicStructureType): CosmicMapLayer {
  if (structureType === 'cluster') {
    return 'clusters';
  }
  if (structureType === 'filament') {
    return 'filaments';
  }
  if (structureType === 'void') {
    return 'voids';
  }

  return 'superclusters';
}

export function isCosmicMapLayerEnabled(
  structureType: CosmicStructureType,
  layers: CosmicMapLayers,
): boolean {
  return layers[getCosmicStructureLayer(structureType)];
}

function superclusterThreshold(priority: number, sourceId: string): number {
  if (sourceId === 'sdss-dr7-main50') {
    return priority * 0.35;
  }
  if (sourceId === 'sdss-dr7-main-adaptive') {
    return 0.35 + priority * 0.2;
  }
  if (sourceId === 'sdss-dr7-lrg44') {
    return 0.55 + priority * 0.23;
  }
  if (sourceId === 'sdss-dr7-lrg-adaptive') {
    return 0.78 + priority * 0.22;
  }

  return priority;
}

function normalizedProgress(start: number, end: number, value: number): number {
  return Math.min(1, Math.max(0, (start - value) / (start - end)));
}

function interpolateSmoothly(start: number, end: number, progress: number): number {
  const eased = progress * progress * (3 - 2 * progress);

  return start + (end - start) * eased;
}
