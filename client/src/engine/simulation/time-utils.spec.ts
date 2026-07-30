import {
  currentUniverseTime,
  dateToJulianDay,
  formatUniverseClock,
  formatUniverseDate,
  isoDateTimeToUniverseTime,
  JULIAN_DAY_J2000,
  julianDayToDate,
  localTimeZone,
  universeTimeToIsoDate,
  universeTimeToIsoDateTime,
} from './time-utils';

describe('temps julien', () => {
  it('reconnaît l’époque J2000', () => {
    expect(dateToJulianDay(new Date('2000-01-01T12:00:00.000Z'))).toBe(JULIAN_DAY_J2000);
  });

  it('effectue un aller-retour sans perdre la date', () => {
    const source = new Date('2026-07-27T08:30:00.000Z');
    const restored = julianDayToDate(dateToJulianDay(source));

    expect(Math.abs(restored.getTime() - source.getTime())).toBeLessThanOrEqual(1);
  });

  it('formate une date utilisable par le champ HTML', () => {
    expect(universeTimeToIsoDate({ julianDay: JULIAN_DAY_J2000 })).toBe('2000-01-01');
    expect(universeTimeToIsoDateTime({ julianDay: JULIAN_DAY_J2000 })).toBe('2000-01-01T12:00');
  });

  it('interprète le champ date et heure en UTC', () => {
    const time = isoDateTimeToUniverseTime('2026-08-28T04:14');
    const timeWithSeconds = isoDateTimeToUniverseTime('2026-08-28T04:14:30');

    expect(time?.julianDay).toBeCloseTo(dateToJulianDay(new Date('2026-08-28T04:14:00.000Z')), 8);
    expect(timeWithSeconds?.julianDay).toBeCloseTo(
      dateToJulianDay(new Date('2026-08-28T04:14:30.000Z')),
      8,
    );
    expect(isoDateTimeToUniverseTime('date-invalide')).toBeNull();
  });

  it('affiche une heure locale explicite sans modifier le temps interne', () => {
    const time = {
      julianDay: dateToJulianDay(new Date('2026-08-12T17:45:00.000Z')),
    };

    expect(formatUniverseClock(time, 'Europe/Paris')).toContain('19:45');
    expect(formatUniverseClock(time, 'UTC')).toContain('17:45');
    expect(localTimeZone()).not.toBe('');
  });

  it('retourne des valeurs neutres lorsqu’une date dépasse le domaine de Date', () => {
    const invalidTime = { julianDay: Number.NaN };

    expect(universeTimeToIsoDate(invalidTime)).toBe('');
    expect(universeTimeToIsoDateTime(invalidTime)).toBe('');
    expect(formatUniverseClock(invalidTime, 'UTC')).toBe('Heure indisponible');
  });

  it('utilise UTC lorsque le navigateur ne publie aucun fuseau', () => {
    const formatter = new Intl.DateTimeFormat();
    const spy = vi.spyOn(Intl, 'DateTimeFormat').mockReturnValue({
      ...formatter,
      resolvedOptions: () => ({ ...formatter.resolvedOptions(), timeZone: '' }),
    } as Intl.DateTimeFormat);

    expect(localTimeZone()).toBe('UTC');
    spy.mockRestore();
  });

  it('formate le calendrier courant et les époques cosmologiques dans les deux directions', () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-07-29T12:00:00.000Z'));
    const presentJulianDay = dateToJulianDay(new Date());

    expect(currentUniverseTime().julianDay).toBe(presentJulianDay);
    expect(formatUniverseDate({ julianDay: presentJulianDay })).toContain('2026');
    expect(
      formatUniverseDate({
        julianDay: presentJulianDay - 2_000_000 * 365.25,
      }),
    ).toMatch(/^Il y a .* Ma$/);
    expect(
      formatUniverseDate({
        julianDay: presentJulianDay + 2_000_000 * 365.25,
      }),
    ).toMatch(/^Dans .* Ma$/);
    expect(
      formatUniverseDate({
        julianDay: presentJulianDay + 500_000 * 365.25,
      }),
    ).toMatch(/^Dans .* ka$/);
    expect(formatUniverseDate({ julianDay: Number.NaN })).toMatch(/^Dans .* ans$/);
    vi.useRealTimers();
  });
});
