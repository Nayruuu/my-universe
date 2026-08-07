import type { GraphicQuality } from '../../data/models/universe.models';

export interface AdaptiveFrameProfile {
  readonly healthyFrameMs: number;
  readonly slowFrameMs: number;
  readonly severeFrameMs: number;
}

const FRAME_PROFILES: Readonly<Record<GraphicQuality, AdaptiveFrameProfile>> = {
  low: { healthyFrameMs: 35, slowFrameMs: 38, severeFrameMs: 50 },
  medium: { healthyFrameMs: 20, slowFrameMs: 27, severeFrameMs: 42 },
  high: { healthyFrameMs: 18.5, slowFrameMs: 22, severeFrameMs: 34 },
};

export function getAdaptiveFrameProfile(quality: GraphicQuality): AdaptiveFrameProfile {
  return FRAME_PROFILES[quality];
}
