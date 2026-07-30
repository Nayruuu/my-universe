import { GraphicQuality, LabelDensity, SpaceObject } from '../../data/models/universe.models';
import { scaleLabelLimit } from './label-density-policy';

const MAXIMUM_GALAXY_LABEL_RANKS = {
  low: 12,
  medium: 24,
  high: 40,
} as const satisfies Record<GraphicQuality, number>;

export function getMaximumGalaxyLabelRank(
  quality: GraphicQuality,
  density: LabelDensity = 'balanced',
): number {
  return scaleLabelLimit(MAXIMUM_GALAXY_LABEL_RANKS[quality], density);
}

export function isGalaxyMapRankVisible(
  object: Pick<SpaceObject, 'metadata'>,
  quality: GraphicQuality,
  density: LabelDensity = 'balanced',
): boolean {
  const mapLabelRank = object.metadata?.['mapLabelRank'];

  return (
    typeof mapLabelRank !== 'number' || mapLabelRank < getMaximumGalaxyLabelRank(quality, density)
  );
}
