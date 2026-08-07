import { UniverseTime } from '../../data/models/universe.models';

export type SupernovaPhase = 'pre-event' | 'rising' | 'peak' | 'fading' | 'remnant';

export interface SupernovaTemporalProfile {
  readonly peakJulianDay: number | null;
  readonly riseDays: number;
  readonly decayDays: number;
  readonly shellFormationDays: number;
  readonly referenceJulianDay: number;
}

export interface SupernovaAppearance {
  readonly phase: SupernovaPhase;
  readonly flashIntensity: number;
  readonly shellOpacity: number;
  readonly shellScale: number;
}

const MAXIMUM_EXTRAPOLATED_SHELL_SCALE = 1.6;

/**
 * Produces a deliberately simple visual light curve. Event dates are catalogued data; the
 * luminosity interpolation and shell growth are illustrative and are never used as ephemerides.
 */
export function calculateSupernovaAppearance(
  time: UniverseTime,
  profile: SupernovaTemporalProfile,
): SupernovaAppearance {
  if (profile.peakJulianDay === null) {
    return remnantOnlyAppearance();
  }

  const riseDays = Math.max(0, profile.riseDays);
  const decayDays = Math.max(0, profile.decayDays);
  const shellFormationDays = Math.max(0, profile.shellFormationDays);
  const daysSincePeak = time.julianDay - profile.peakJulianDay;

  if (daysSincePeak < -riseDays) {
    return {
      phase: 'pre-event',
      flashIntensity: 0,
      shellOpacity: 0,
      shellScale: 0,
    };
  }
  if (daysSincePeak < 0) {
    const riseProgress = clamp01(1 + daysSincePeak / riseDays);

    return {
      phase: 'rising',
      flashIntensity: smoothStep(riseProgress),
      shellOpacity: 0,
      shellScale: 0,
    };
  }
  if (daysSincePeak === 0) {
    return {
      phase: 'peak',
      flashIntensity: 1,
      shellOpacity: 0,
      shellScale: 0,
    };
  }

  const referenceAgeDays = Math.max(1, profile.referenceJulianDay - profile.peakJulianDay);
  const shellScale = Math.min(
    MAXIMUM_EXTRAPOLATED_SHELL_SCALE,
    Math.sqrt(Math.max(0, daysSincePeak) / referenceAgeDays),
  );
  const shellFadeDays = Math.max(30, shellFormationDays * 0.75);
  const shellOpacity =
    shellFormationDays === 0
      ? 1
      : smoothStep(clamp01((daysSincePeak - shellFormationDays) / shellFadeDays));
  const fading = daysSincePeak < decayDays;

  return {
    phase: fading ? 'fading' : 'remnant',
    flashIntensity: fading ? Math.exp((-4 * daysSincePeak) / Math.max(1, decayDays)) : 0,
    shellOpacity,
    shellScale,
  };
}

function remnantOnlyAppearance(): SupernovaAppearance {
  return {
    phase: 'remnant',
    flashIntensity: 0,
    shellOpacity: 1,
    shellScale: 1,
  };
}

function smoothStep(value: number): number {
  return value * value * (3 - 2 * value);
}

function clamp01(value: number): number {
  return Math.max(0, Math.min(1, value));
}
