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

    expect(julianDayToDate(biarritzMaximum.peak.julianDay).toISOString()).toBe(
      '2026-08-12T18:26:50.728Z',
    );
    expect(biarritzMaximum.obscuration).toBeCloseTo(0.9941, 4);
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
  });
});

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
