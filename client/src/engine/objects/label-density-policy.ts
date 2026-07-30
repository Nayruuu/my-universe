import type { LabelDensity } from '../../data/models/universe.models';

const LABEL_DENSITY_MULTIPLIERS = {
  minimal: 0.5,
  balanced: 1,
  dense: 1.5,
} as const satisfies Record<LabelDensity, number>;

export function scaleLabelLimit(limit: number, density: LabelDensity): number {
  return Math.round(limit * LABEL_DENSITY_MULTIPLIERS[density]);
}
