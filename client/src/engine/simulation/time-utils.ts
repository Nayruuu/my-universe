import { UniverseTime } from '../../data/models/universe.models';

export const JULIAN_DAY_UNIX_EPOCH = 2_440_587.5;
export const JULIAN_DAY_J2000 = 2_451_545;
export const MILLISECONDS_PER_DAY = 86_400_000;

const TIME_LOCALE_LABELS = {
  fr: {
    unavailable: 'Heure indisponible',
    years: 'ans',
    past: 'Il y a {value} {unit}',
    future: 'Dans {value} {unit}',
  },
  en: {
    unavailable: 'Time unavailable',
    years: 'years',
    past: '{value} {unit} ago',
    future: 'In {value} {unit}',
  },
  es: {
    unavailable: 'Hora no disponible',
    years: 'años',
    past: 'Hace {value} {unit}',
    future: 'Dentro de {value} {unit}',
  },
  de: {
    unavailable: 'Zeit nicht verfügbar',
    years: 'Jahre',
    past: 'Vor {value} {unit}',
    future: 'In {value} {unit}',
  },
  it: {
    unavailable: 'Ora non disponibile',
    years: 'anni',
    past: '{value} {unit} fa',
    future: 'Tra {value} {unit}',
  },
  ko: {
    unavailable: '시간을 표시할 수 없음',
    years: '년',
    past: '{value}{unit} 전',
    future: '{value}{unit} 후',
  },
  ja: {
    unavailable: '時刻を表示できません',
    years: '年',
    past: '{value}{unit}前',
    future: '{value}{unit}後',
  },
  zh: {
    unavailable: '时间不可用',
    years: '年',
    past: '{value}{unit}前',
    future: '{value}{unit}后',
  },
} as const;

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
    return timeLocaleLabels(locale).unavailable;
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
    const labels = timeLocaleLabels(locale);
    const unit = magnitude >= 1_000_000 ? 'Ma' : magnitude >= 1_000 ? 'ka' : labels.years;
    const divisor = magnitude >= 1_000_000 ? 1_000_000 : magnitude >= 1_000 ? 1_000 : 1;
    const formatted = new Intl.NumberFormat(locale, { maximumFractionDigits: 2 }).format(
      magnitude / divisor,
    );

    const template = yearsFromPresent < 0 ? labels.past : labels.future;

    return template.replace('{value}', formatted).replace('{unit}', unit);
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

function timeLocaleLabels(
  locale: string,
): (typeof TIME_LOCALE_LABELS)[keyof typeof TIME_LOCALE_LABELS] {
  const language = locale.slice(0, 2) as keyof typeof TIME_LOCALE_LABELS;

  return TIME_LOCALE_LABELS[language] ?? TIME_LOCALE_LABELS.en;
}
