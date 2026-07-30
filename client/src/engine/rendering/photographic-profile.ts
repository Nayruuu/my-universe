import { type GraphicQuality } from '../../data/models/universe.models';

export interface PhotographicRenderingProfile {
  readonly exposure: number;
  readonly starRadiance: number;
  readonly galaxyRadiance: number;
}

const SCALE_PROFILES: readonly PhotographicRenderingProfile[] = [
  { exposure: 1, starRadiance: 0.86, galaxyRadiance: 0.72 },
  { exposure: 1.04, starRadiance: 0.98, galaxyRadiance: 0.78 },
  { exposure: 1.13, starRadiance: 1.18, galaxyRadiance: 0.86 },
  { exposure: 1.09, starRadiance: 1.1, galaxyRadiance: 1.12 },
  { exposure: 1.12, starRadiance: 0.94, galaxyRadiance: 1.24 },
  { exposure: 1.17, starRadiance: 0.88, galaxyRadiance: 1.28 },
  { exposure: 1.21, starRadiance: 0.92, galaxyRadiance: 1.16 },
];

const QUALITY_EXPOSURE: Readonly<Record<GraphicQuality, number>> = {
  low: 0.96,
  medium: 1,
  high: 1.04,
};

const QUALITY_RADIANCE: Readonly<Record<GraphicQuality, number>> = {
  low: 0.84,
  medium: 1,
  high: 1.12,
};

export function getPhotographicProfile(
  lodLevel: number,
  quality: GraphicQuality,
): PhotographicRenderingProfile {
  const index = Math.max(0, Math.min(SCALE_PROFILES.length - 1, Math.trunc(lodLevel)));
  const base = SCALE_PROFILES[index]!;

  return {
    exposure: base.exposure * QUALITY_EXPOSURE[quality],
    starRadiance: base.starRadiance * QUALITY_RADIANCE[quality],
    galaxyRadiance: base.galaxyRadiance * QUALITY_RADIANCE[quality],
  };
}

export function dampPhotographicExposure(
  current: number,
  target: number,
  deltaSeconds: number,
): number {
  if (deltaSeconds <= 0) {
    return current;
  }

  return current + (target - current) * (1 - Math.exp(-2.6 * deltaSeconds));
}
