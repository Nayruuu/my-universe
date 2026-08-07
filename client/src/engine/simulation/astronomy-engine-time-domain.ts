import type { UniverseTime } from '../../data/models/universe.models';
import { JULIAN_DAY_J2000 } from './time-utils';

// Astronomy Engine 2.1.19 integrates Pluto very slowly outside its documented
// 0000..4000 table. The exact table bounds are ±730,000 TT days around J2000.
export const ASTRONOMY_ENGINE_TIME_DOMAIN_SOURCE =
  'https://github.com/cosinekitty/astronomy/blob/v2.1.19/source/js/astronomy.ts';
export const ASTRONOMY_ENGINE_MIN_JULIAN_DAY = JULIAN_DAY_J2000 - 730_000;
export const ASTRONOMY_ENGINE_MAX_JULIAN_DAY = JULIAN_DAY_J2000 + 730_000;

export function isAstronomyEngineTimeSupported(time: UniverseTime): boolean {
  return (
    time.julianDay >= ASTRONOMY_ENGINE_MIN_JULIAN_DAY &&
    time.julianDay <= ASTRONOMY_ENGINE_MAX_JULIAN_DAY
  );
}

export function clampAstronomyEngineTime(time: UniverseTime): UniverseTime {
  return {
    julianDay: Math.max(
      ASTRONOMY_ENGINE_MIN_JULIAN_DAY,
      Math.min(ASTRONOMY_ENGINE_MAX_JULIAN_DAY, time.julianDay),
    ),
  };
}

export function astronomyEngineDaysSinceJ2000(time: UniverseTime): number {
  return clampAstronomyEngineTime(time).julianDay - JULIAN_DAY_J2000;
}
