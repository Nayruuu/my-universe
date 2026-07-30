import { Observer, SearchLocalSolarEclipse } from 'astronomy-engine';
import { EarthEclipseEvent, mapAstronomyEclipseKind } from './earth-eclipse';
import { SolarEclipseObserverLocation } from './solar-eclipse-locations';
import { JULIAN_DAY_J2000 } from './time-utils';

const SEARCH_MARGIN_DAYS = 5;
const EVENT_MATCH_TOLERANCE_DAYS = 2;
const MINUTES_PER_DAY = 1_440;

export function calculateLocalSolarEclipse(
  globalEvent: EarthEclipseEvent,
  location: SolarEclipseObserverLocation,
): EarthEclipseEvent {
  if (globalEvent.family !== 'solar') {
    throw new Error('Le maximum local ne peut être calculé que pour une éclipse solaire.');
  }
  const searchStart = globalEvent.peak.julianDay - JULIAN_DAY_J2000 - SEARCH_MARGIN_DAYS;
  const localEclipse = SearchLocalSolarEclipse(
    searchStart,
    new Observer(location.latitude, location.longitude, 0),
  );
  const peakJulianDay = JULIAN_DAY_J2000 + localEclipse.peak.time.ut;

  if (Math.abs(peakJulianDay - globalEvent.peak.julianDay) > EVENT_MATCH_TOLERANCE_DAYS) {
    throw new Error(`Cette éclipse n’est pas visible depuis ${location.name}.`);
  }

  return {
    id: `solar-local-${location.id}-${Math.round(localEclipse.peak.time.ut * 86_400)}`,
    family: 'solar',
    kind: mapAstronomyEclipseKind(localEclipse.kind),
    scope: 'local',
    peak: { julianDay: peakJulianDay },
    obscuration: localEclipse.obscuration,
    durationMinutes:
      (localEclipse.partial_end.time.ut - localEclipse.partial_begin.time.ut) * MINUTES_PER_DAY,
    latitude: location.latitude,
    longitude: location.longitude,
    observerName: location.name,
    observerTimeZone: location.timeZone,
    sunAltitudeDegrees: localEclipse.peak.altitude,
  };
}
