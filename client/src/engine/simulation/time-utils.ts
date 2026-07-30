import { UniverseTime } from '../../data/models/universe.models';

export const JULIAN_DAY_UNIX_EPOCH = 2_440_587.5;
export const JULIAN_DAY_J2000 = 2_451_545;
export const MILLISECONDS_PER_DAY = 86_400_000;

export function dateToJulianDay(date: Date): number {
  return date.getTime() / MILLISECONDS_PER_DAY + JULIAN_DAY_UNIX_EPOCH;
}

export function julianDayToDate(julianDay: number): Date {
  return new Date((julianDay - JULIAN_DAY_UNIX_EPOCH) * MILLISECONDS_PER_DAY);
}

export function currentUniverseTime(): UniverseTime {
  return { julianDay: dateToJulianDay(new Date()) };
}

export function isoDateTimeToUniverseTime(value: string): UniverseTime | null {
  const normalizedValue = value.includes('T')
    ? `${value}${value.length === 16 ? ':00' : ''}Z`
    : `${value}T12:00:00.000Z`;
  const date = new Date(normalizedValue);

  return Number.isNaN(date.getTime()) ? null : { julianDay: dateToJulianDay(date) };
}

export function universeTimeToIsoDate(time: UniverseTime): string {
  const date = julianDayToDate(time.julianDay);

  return Number.isNaN(date.getTime()) ? '' : date.toISOString().slice(0, 10);
}

export function universeTimeToIsoDateTime(time: UniverseTime): string {
  const date = julianDayToDate(time.julianDay);

  return Number.isNaN(date.getTime()) ? '' : date.toISOString().slice(0, 16);
}

export function formatUniverseClock(
  time: UniverseTime,
  timeZone: string,
  locale = 'fr-FR',
): string {
  const date = julianDayToDate(time.julianDay);

  if (Number.isNaN(date.getTime())) {
    return 'Heure indisponible';
  }

  return new Intl.DateTimeFormat(locale, {
    hour: '2-digit',
    minute: '2-digit',
    hourCycle: 'h23',
    timeZone,
    timeZoneName: 'short',
  }).format(date);
}

export function localTimeZone(): string {
  return Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC';
}

export function formatUniverseDate(time: UniverseTime, locale = 'fr-FR'): string {
  const date = julianDayToDate(time.julianDay);

  if (Number.isNaN(date.getTime())) {
    const yearsFromPresent = (time.julianDay - dateToJulianDay(new Date())) / 365.25;
    const magnitude = Math.abs(yearsFromPresent);
    const unit = magnitude >= 1_000_000 ? 'Ma' : magnitude >= 1_000 ? 'ka' : 'ans';
    const divisor = magnitude >= 1_000_000 ? 1_000_000 : magnitude >= 1_000 ? 1_000 : 1;
    const formatted = new Intl.NumberFormat(locale, { maximumFractionDigits: 2 }).format(
      magnitude / divisor,
    );

    return yearsFromPresent < 0 ? `Il y a ${formatted} ${unit}` : `Dans ${formatted} ${unit}`;
  }

  return new Intl.DateTimeFormat(locale, {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    hourCycle: 'h23',
    timeZone: 'UTC',
  }).format(date);
}
