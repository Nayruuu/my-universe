import {
  parseSolarEclipseObserverCoordinates,
  SOLAR_ECLIPSE_OBSERVER_LOCATIONS,
} from './solar-eclipse-locations';

describe('lieux d’observation des éclipses solaires', () => {
  it('conserve un catalogue prédéfini unique dans les limites terrestres', () => {
    const identifiers = new Set(SOLAR_ECLIPSE_OBSERVER_LOCATIONS.map(({ id }) => id));

    expect(identifiers.size).toBe(SOLAR_ECLIPSE_OBSERVER_LOCATIONS.length);
    expect(SOLAR_ECLIPSE_OBSERVER_LOCATIONS).toContainEqual(
      expect.objectContaining({ id: 'paris', timeZone: 'Europe/Paris' }),
    );
    for (const location of SOLAR_ECLIPSE_OBSERVER_LOCATIONS) {
      expect(location.latitude).toBeGreaterThanOrEqual(-90);
      expect(location.latitude).toBeLessThanOrEqual(90);
      expect(location.longitude).toBeGreaterThanOrEqual(-180);
      expect(location.longitude).toBeLessThanOrEqual(180);
    }
  });

  it('refuse les coordonnées absentes, non numériques ou hors du globe', () => {
    expect(parseSolarEclipseObserverCoordinates('', '').issue).toBe('missing-coordinate');
    expect(parseSolarEclipseObserverCoordinates('nord', '2').issue).toBe('invalid-coordinate');
    expect(parseSolarEclipseObserverCoordinates('91', '2').issue).toBe('latitude-out-of-range');
    expect(parseSolarEclipseObserverCoordinates('48', '-181').issue).toBe('longitude-out-of-range');
  });

  it('construit un lieu arbitraire déterministe en conservant les limites inclusives', () => {
    const parsed = parseSolarEclipseObserverCoordinates(' 48.8566 ', ' 2.3522 ', {
      name: 'Coordonnées personnalisées',
      timeZone: 'UTC',
    });
    const northPole = parseSolarEclipseObserverCoordinates('90', '180');
    const southPole = parseSolarEclipseObserverCoordinates('-90', '-180');

    expect(parsed).toEqual({
      issue: null,
      location: {
        id: 'coordinates-48.856600-2.352200',
        name: 'Coordonnées personnalisées',
        latitude: 48.8566,
        longitude: 2.3522,
        timeZone: 'UTC',
      },
    });
    expect(northPole.location).toEqual(
      expect.objectContaining({ latitude: 90, longitude: 180, timeZone: 'UTC' }),
    );
    expect(southPole.location).toEqual(
      expect.objectContaining({ latitude: -90, longitude: -180, timeZone: 'UTC' }),
    );
  });

  it('normalise les zéros signés et utilise les libellés par défaut', () => {
    expect(parseSolarEclipseObserverCoordinates('-0', '-0')).toEqual({
      issue: null,
      location: {
        id: 'coordinates-0.000000-0.000000',
        name: '0.0000°, 0.0000°',
        latitude: 0,
        longitude: 0,
        timeZone: 'UTC',
      },
    });
  });
});
