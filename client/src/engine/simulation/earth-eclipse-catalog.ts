import {
  EclipseKind,
  NextGlobalSolarEclipse,
  NextLunarEclipse,
  SearchGlobalSolarEclipse,
  SearchLunarEclipse,
} from 'astronomy-engine';
import { UniverseTime } from '../../data/models/universe.models';
import { EarthEclipseEvent, EarthEclipseFamily, mapAstronomyEclipseKind } from './earth-eclipse';
import { JULIAN_DAY_J2000 } from './time-utils';

export type EarthEclipsePageDirection = 'past' | 'future';

export function findEarthEclipsePage(
  startTime: UniverseTime,
  count: number,
  direction: EarthEclipsePageDirection,
): EarthEclipseEvent[] {
  if (count <= 0) {
    return [];
  }
  if (direction === 'future') {
    return findUpcomingEarthEclipses(startTime, count);
  }

  // Every calendar year contains at least four solar/lunar eclipses. Searching one year per
  // requested event leaves a wide deterministic margin while keeping the browser calculation small.
  const searchStart = {
    julianDay: startTime.julianDay - Math.max(366, count * 366),
  };

  return findUpcomingEarthEclipses(searchStart, count * 5)
    .filter((event) => event.peak.julianDay < startTime.julianDay)
    .slice(-count);
}

export function findUpcomingEarthEclipses(
  startTime: UniverseTime,
  count: number,
): EarthEclipseEvent[] {
  if (count <= 0) {
    return [];
  }

  const astronomyStartTime = startTime.julianDay - JULIAN_DAY_J2000;
  const events: EarthEclipseEvent[] = [];
  let lunarEclipse = SearchLunarEclipse(astronomyStartTime);
  let solarEclipse = SearchGlobalSolarEclipse(astronomyStartTime);

  for (let index = 0; index < count; index += 1) {
    events.push({
      id: eclipseId('lunar', lunarEclipse.peak.ut),
      family: 'lunar',
      kind: mapAstronomyEclipseKind(lunarEclipse.kind),
      scope: 'global',
      peak: astronomyTimeToUniverseTime(lunarEclipse.peak.ut),
      obscuration: lunarEclipse.obscuration,
      durationMinutes: lunarPhaseDuration(lunarEclipse),
      latitude: null,
      longitude: null,
      observerName: null,
      observerTimeZone: null,
      sunAltitudeDegrees: null,
      localContacts: null,
    });
    events.push({
      id: eclipseId('solar', solarEclipse.peak.ut),
      family: 'solar',
      kind: mapAstronomyEclipseKind(solarEclipse.kind),
      scope: 'global',
      peak: astronomyTimeToUniverseTime(solarEclipse.peak.ut),
      obscuration: solarEclipse.obscuration ?? null,
      durationMinutes: null,
      latitude: solarEclipse.latitude ?? null,
      longitude: solarEclipse.longitude ?? null,
      observerName: null,
      observerTimeZone: null,
      sunAltitudeDegrees: null,
      localContacts: null,
    });
    lunarEclipse = NextLunarEclipse(lunarEclipse.peak);
    solarEclipse = NextGlobalSolarEclipse(solarEclipse.peak);
  }

  return events
    .sort((first, second) => first.peak.julianDay - second.peak.julianDay)
    .slice(0, count);
}

function lunarPhaseDuration(eclipse: {
  kind: EclipseKind;
  sd_penum: number;
  sd_partial: number;
  sd_total: number;
}): number {
  switch (eclipse.kind) {
    case EclipseKind.Total:
      return eclipse.sd_total * 2;
    case EclipseKind.Partial:
      return eclipse.sd_partial * 2;
    default:
      return eclipse.sd_penum * 2;
  }
}

function astronomyTimeToUniverseTime(daysSinceJ2000: number): UniverseTime {
  return { julianDay: JULIAN_DAY_J2000 + daysSinceJ2000 };
}

function eclipseId(family: EarthEclipseFamily, daysSinceJ2000: number): string {
  return `${family}-${Math.round(daysSinceJ2000 * 86_400)}`;
}
