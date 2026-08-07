import { EARTH_OBSERVER_LOCATIONS, parseEarthObserverCoordinates } from './earth-observer-location';
import {
  parseSolarEclipseObserverCoordinates,
  SOLAR_ECLIPSE_OBSERVER_LOCATIONS,
} from './solar-eclipse-locations';

describe('lieux d’observation terrestres partagés', () => {
  it('alimente les éclipses et les observations stellaires avec le même catalogue', () => {
    expect(SOLAR_ECLIPSE_OBSERVER_LOCATIONS).toBe(EARTH_OBSERVER_LOCATIONS);
    expect(EARTH_OBSERVER_LOCATIONS).toContainEqual(
      expect.objectContaining({ id: 'paris', countryCode: 'FR', capital: true }),
    );
  });

  it('couvre chaque pays ou territoire habité et renforce les grands territoires', () => {
    const countryCodes = new Set(
      EARTH_OBSERVER_LOCATIONS.flatMap(({ countryCode }) =>
        countryCode === undefined ? [] : [countryCode],
      ),
    );
    const countFor = (countryCode: string): number =>
      EARTH_OBSERVER_LOCATIONS.filter((location) => location.countryCode === countryCode).length;

    expect(countryCodes.size).toBeGreaterThanOrEqual(246);
    expect(countFor('US')).toBeGreaterThanOrEqual(6);
    expect(countFor('CN')).toBeGreaterThanOrEqual(6);
    expect(countFor('IN')).toBeGreaterThanOrEqual(6);
    expect(countFor('AU')).toBeGreaterThanOrEqual(6);
    expect(countFor('BR')).toBeGreaterThanOrEqual(6);
    expect(EARTH_OBSERVER_LOCATIONS.length).toBeLessThanOrEqual(500);
  });

  it('conserve des villes de référence sur tous les continents avec des données valides', () => {
    const names = new Set(EARTH_OBSERVER_LOCATIONS.map(({ name }) => name));
    const identifiers = new Set<string>();

    for (const name of ['Paris', 'New York City', 'São Paulo', 'Nairobi', 'Tokyo', 'Sydney']) {
      expect(names.has(name)).toBe(true);
    }
    for (const location of EARTH_OBSERVER_LOCATIONS) {
      expect(identifiers.has(location.id)).toBe(false);
      identifiers.add(location.id);
      expect(location.latitude).toBeGreaterThanOrEqual(-90);
      expect(location.latitude).toBeLessThanOrEqual(90);
      expect(location.longitude).toBeGreaterThanOrEqual(-180);
      expect(location.longitude).toBeLessThanOrEqual(180);
      expect(() => new Intl.DateTimeFormat('en', { timeZone: location.timeZone })).not.toThrow();
    }
  });

  it('conserve le contrat historique du parseur solaire comme alias du parseur générique', () => {
    expect(parseSolarEclipseObserverCoordinates).toBe(parseEarthObserverCoordinates);
    expect(parseEarthObserverCoordinates('48.8566', '2.3522', { name: 'Paris' })).toEqual({
      issue: null,
      location: {
        id: 'coordinates-48.856600-2.352200',
        name: 'Paris',
        latitude: 48.8566,
        longitude: 2.3522,
        timeZone: 'UTC',
      },
    });
  });
});
