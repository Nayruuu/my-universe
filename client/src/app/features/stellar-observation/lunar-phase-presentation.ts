import type { LunarSkyIllumination } from '../../../engine/simulation/solar-system-sky';

export type LunarPhaseShape = 'none' | 'crescent' | 'gibbous';

export interface LunarPhasePresentation {
  readonly shape: LunarPhaseShape;
  readonly terminatorScale: number;
  readonly waxing: 'true' | 'false';
}

const NOT_LUNAR: LunarPhasePresentation = {
  shape: 'none',
  terminatorScale: 0,
  waxing: 'false',
};

export function lunarPhasePresentation(
  illumination: LunarSkyIllumination | null,
): LunarPhasePresentation {
  if (!illumination) {
    return NOT_LUNAR;
  }
  const illuminatedFraction = Math.max(0, Math.min(1, illumination.illuminatedFraction));

  return {
    shape: illuminatedFraction < 0.5 ? 'crescent' : 'gibbous',
    terminatorScale: Math.abs(2 * illuminatedFraction - 1),
    waxing: illumination.waxing ? 'true' : 'false',
  };
}
