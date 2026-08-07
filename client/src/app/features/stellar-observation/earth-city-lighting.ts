import type { EarthObserverLocation } from '../../../engine/simulation/earth-observer-location';
import { PARIS_PANORAMA_HEIGHT, PARIS_PANORAMA_WIDTH } from './earth-paris-landmarks';

export type EarthCityLightDensity = 'quiet' | 'balanced' | 'dense';

export interface EarthUrbanLightPool {
  readonly id: string;
  readonly opacity: number;
  readonly radiusX: number;
  readonly radiusY: number;
  readonly x: number;
  readonly y: number;
}

interface EarthUrbanLightProfile {
  readonly count: number;
  readonly maximumOpacity: number;
  readonly maximumRadiusX: number;
  readonly minimumOpacity: number;
  readonly minimumRadiusX: number;
}

const LIGHT_PROFILES: Readonly<Record<EarthCityLightDensity, EarthUrbanLightProfile>> = {
  quiet: {
    count: 10,
    minimumOpacity: 0.17,
    maximumOpacity: 0.24,
    minimumRadiusX: 150,
    maximumRadiusX: 250,
  },
  balanced: {
    count: 15,
    minimumOpacity: 0.2,
    maximumOpacity: 0.28,
    minimumRadiusX: 120,
    maximumRadiusX: 200,
  },
  dense: {
    count: 21,
    minimumOpacity: 0.24,
    maximumOpacity: 0.33,
    minimumRadiusX: 95,
    maximumRadiusX: 170,
  },
};

export function earthCityLightDensity(location: EarthObserverLocation): EarthCityLightDensity {
  const population = location.population ?? 0;

  if (population >= 3_000_000) {
    return 'dense';
  }
  if (population >= 500_000 || location.capital) {
    return 'balanced';
  }

  return 'quiet';
}

export function createEarthUrbanLightPools(
  seed: number,
  density: EarthCityLightDensity,
): readonly EarthUrbanLightPool[] {
  const profile = LIGHT_PROFILES[density];
  const random = createRandom(seed);
  const segmentWidth = PARIS_PANORAMA_WIDTH / profile.count;

  return Array.from({ length: profile.count }, (_, index) => ({
    id: `${density}-${index}`,
    opacity: between(random, profile.minimumOpacity, profile.maximumOpacity),
    radiusX: between(random, profile.minimumRadiusX, profile.maximumRadiusX),
    radiusY: between(random, 34, 60),
    x: Math.min(
      PARIS_PANORAMA_WIDTH,
      Math.max(0, segmentWidth * (index + 0.5) + between(random, -0.22, 0.22) * segmentWidth),
    ),
    y: PARIS_PANORAMA_HEIGHT - between(random, 20, 42),
  }));
}

function between(random: () => number, minimum: number, maximum: number): number {
  return minimum + random() * (maximum - minimum);
}

function createRandom(seed: number): () => number {
  let state = seed >>> 0;

  return () => {
    state += 0x6d2b_79f5;
    let value = state;

    value = Math.imul(value ^ (value >>> 15), value | 1);
    value ^= value + Math.imul(value ^ (value >>> 7), value | 61);

    return ((value ^ (value >>> 14)) >>> 0) / 4_294_967_296;
  };
}
