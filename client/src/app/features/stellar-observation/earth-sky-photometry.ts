export interface EarthSkyStarAppearance {
  readonly radius: number;
  readonly opacity: number;
  readonly haloOpacity: number;
}

const MAXIMUM_RADIUS = 2.7;
const MINIMUM_RADIUS = 0.55;
const MAXIMUM_OPACITY = 0.86;
const MINIMUM_OPACITY = 0.18;
const MAXIMUM_HALO_OPACITY = 0.16;
const HALO_THRESHOLD = 0.72;

export function earthSkyAppearanceForMagnitude(apparentMagnitude: number): EarthSkyStarAppearance {
  const brightness = Number.isFinite(apparentMagnitude)
    ? clamp((7 - apparentMagnitude) / 8.5, 0, 1)
    : 0;
  const perceptualBrightness = Math.pow(brightness, 0.72);
  const haloProgress = clamp((perceptualBrightness - HALO_THRESHOLD) / (1 - HALO_THRESHOLD), 0, 1);

  return {
    radius: round(MINIMUM_RADIUS + perceptualBrightness * (MAXIMUM_RADIUS - MINIMUM_RADIUS)),
    opacity: round(MINIMUM_OPACITY + perceptualBrightness * (MAXIMUM_OPACITY - MINIMUM_OPACITY)),
    haloOpacity: round(haloProgress * MAXIMUM_HALO_OPACITY),
  };
}

function clamp(value: number, minimum: number, maximum: number): number {
  return Math.max(minimum, Math.min(maximum, value));
}

function round(value: number): number {
  return Math.round(value * 10_000) / 10_000;
}
