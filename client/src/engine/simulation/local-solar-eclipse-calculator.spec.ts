import { findUpcomingEarthEclipses } from './earth-eclipse-catalog';
import { calculateLocalSolarEclipse } from './local-solar-eclipse-calculator';
import { SOLAR_ECLIPSE_OBSERVER_LOCATIONS } from './solar-eclipse-locations';
import { dateToJulianDay, julianDayToDate } from './time-utils';

describe('maximum local d’une éclipse solaire', () => {
  const events = findUpcomingEarthEclipses(
    { julianDay: dateToJulianDay(new Date('2026-07-28T00:00:00.000Z')) },
    4,
  );
  const augustSolarEclipse = events.find(
    (event) => event.family === 'solar' && event.kind === 'total',
  );
  const paris = location('paris');
  const biarritz = location('biarritz');

  it('retrouve les horaires et occultations publiés pour Paris et Biarritz', () => {
    const parisMaximum = calculateLocalSolarEclipse(augustSolarEclipse!, paris);
    const biarritzMaximum = calculateLocalSolarEclipse(augustSolarEclipse!, biarritz);

    expect(julianDayToDate(parisMaximum.peak.julianDay).toISOString()).toBe(
      '2026-08-12T18:17:11.916Z',
    );
    expect(parisMaximum.obscuration).toBeCloseTo(0.9203, 4);
    expect(parisMaximum.sunAltitudeDegrees).toBeCloseTo(7.72, 2);
    expect(parisMaximum.scope).toBe('local');
    expect(parisMaximum.observerName).toBe('Paris');
    expect(parisMaximum.localContacts).not.toBeNull();

    // NASA/GSFC publishes 17:22, 18:17 and 19:08 UTC for C1, maximum and the
    // sunset-limited end in Paris. Astronomy Engine resolves the geometric contacts to seconds.
    expectWithinSeconds(
      parisMaximum.localContacts!.partialBegin.time.julianDay,
      '2026-08-12T17:22:00.000Z',
      15,
    );
    expectWithinSeconds(
      parisMaximum.localContacts!.maximum.time.julianDay,
      '2026-08-12T18:17:00.000Z',
      15,
    );
    expectWithinSeconds(
      parisMaximum.localContacts!.partialEnd.time.julianDay,
      '2026-08-12T19:08:00.000Z',
      90,
    );
    expect(parisMaximum.localContacts!.partialBegin.aboveHorizon).toBe(true);
    expect(parisMaximum.localContacts!.centralBegin).toBeNull();
    expect(parisMaximum.localContacts!.centralEnd).toBeNull();

    expect(julianDayToDate(biarritzMaximum.peak.julianDay).toISOString()).toBe(
      '2026-08-12T18:26:50.728Z',
    );
    expect(biarritzMaximum.obscuration).toBeCloseTo(0.9941, 4);
    expect(biarritzMaximum.localContacts!.partialEnd.aboveHorizon).toBe(false);
  });

  it('refuse une éclipse lunaire ou une éclipse solaire invisible depuis la ville', () => {
    const lunarEclipse = events.find((event) => event.family === 'lunar');
    const invisibleSolarEclipse = events.find(
      (event) => event.family === 'solar' && event.kind === 'annular',
    );

    expect(() => calculateLocalSolarEclipse(lunarEclipse!, paris)).toThrow('ne peut être calculé');
    expect(() => calculateLocalSolarEclipse(invisibleSolarEclipse!, paris)).toThrow(
      'n’est pas visible depuis Paris',
    );
  });

  it('préserve la totalité et l’annularité depuis leurs lignes centrales', () => {
    const annularEclipse = events.find(
      (event) => event.family === 'solar' && event.kind === 'annular',
    );
    const totalMaximum = calculateLocalSolarEclipse(
      augustSolarEclipse!,
      centralLocation(augustSolarEclipse!),
    );
    const annularMaximum = calculateLocalSolarEclipse(
      annularEclipse!,
      centralLocation(annularEclipse!),
    );

    expect(totalMaximum.kind).toBe('total');
    expect(annularMaximum.kind).toBe('annular');
    expect(totalMaximum.localContacts!.centralBegin).not.toBeNull();
    expect(totalMaximum.localContacts!.centralEnd).not.toBeNull();
    expect(annularMaximum.localContacts!.centralBegin).not.toBeNull();
    expect(annularMaximum.localContacts!.centralEnd).not.toBeNull();
    expect(totalMaximum.localContacts!.partialBegin.time.julianDay).toBeLessThan(
      totalMaximum.localContacts!.centralBegin!.time.julianDay,
    );
    expect(totalMaximum.localContacts!.centralBegin!.time.julianDay).toBeLessThan(
      totalMaximum.localContacts!.maximum.time.julianDay,
    );
    expect(totalMaximum.localContacts!.maximum.time.julianDay).toBeLessThan(
      totalMaximum.localContacts!.centralEnd!.time.julianDay,
    );
    expect(totalMaximum.localContacts!.centralEnd!.time.julianDay).toBeLessThan(
      totalMaximum.localContacts!.partialEnd.time.julianDay,
    );
  });
});

function expectWithinSeconds(
  actualJulianDay: number,
  expectedIsoDate: string,
  toleranceSeconds: number,
): void {
  const differenceMilliseconds = Math.abs(
    julianDayToDate(actualJulianDay).getTime() - new Date(expectedIsoDate).getTime(),
  );

  expect(differenceMilliseconds).toBeLessThanOrEqual(toleranceSeconds * 1_000);
}

function location(id: string) {
  const result = SOLAR_ECLIPSE_OBSERVER_LOCATIONS.find((candidate) => candidate.id === id);

  if (!result) {
    throw new Error(`Lieu de test introuvable : ${id}`);
  }

  return result;
}

function centralLocation(event: { id: string; latitude: number | null; longitude: number | null }) {
  if (event.latitude === null || event.longitude === null) {
    throw new Error(`Maximum central absent pour ${event.id}.`);
  }

  return {
    id: `${event.id}-center`,
    name: 'Maximum central',
    latitude: event.latitude,
    longitude: event.longitude,
    timeZone: 'UTC',
  };
}
