import type { GraphicQuality } from '../../data/models/universe.models';

export interface StarCatalogOpticalProfile {
  readonly diffractionStrength: number;
  readonly airyStrength: number;
  readonly granulationStrength: number;
  readonly surfaceDetail: number;
}

const OPTICAL_PROFILE_BY_QUALITY = {
  low: {
    diffractionStrength: 0,
    airyStrength: 0,
    granulationStrength: 0.08,
    surfaceDetail: 0.38,
  },
  medium: {
    diffractionStrength: 0.32,
    airyStrength: 0.14,
    granulationStrength: 0.18,
    surfaceDetail: 0.72,
  },
  high: {
    diffractionStrength: 0.5,
    airyStrength: 0.26,
    granulationStrength: 0.28,
    surfaceDetail: 1,
  },
} as const satisfies Readonly<Record<GraphicQuality, StarCatalogOpticalProfile>>;

export function getStarCatalogOpticalProfile(quality: GraphicQuality): StarCatalogOpticalProfile {
  return OPTICAL_PROFILE_BY_QUALITY[quality];
}
