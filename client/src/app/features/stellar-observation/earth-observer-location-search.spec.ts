import type { EarthObserverLocation } from '../../../engine/simulation/earth-observer-location';
import {
  earthObserverLocationLabel,
  suggestEarthObserverLocations,
} from './earth-observer-location-search';

const LOCATIONS: readonly EarthObserverLocation[] = [
  location('paris', 'Paris', 'FR', 2_138_551, true),
  location('new-york', 'New York City', 'US', 8_804_190, false),
  location('washington', 'Washington', 'US', 689_545, true),
  location('sao-paulo', 'São Paulo', 'BR', 12_400_232, false),
];

describe('recherche locale des lieux d’observation', () => {
  it('recherche sans casse ni accent par ville, pays ou code ISO', () => {
    expect(suggestEarthObserverLocations(LOCATIONS, 'sao', 'fr-FR', 10)).toEqual([LOCATIONS[3]]);
    expect(suggestEarthObserverLocations(LOCATIONS, 'etats unis', 'fr-FR', 10)).toEqual([
      LOCATIONS[1],
      LOCATIONS[2],
    ]);
    expect(suggestEarthObserverLocations(LOCATIONS, 'FR', 'fr-FR', 10)).toEqual([LOCATIONS[0]]);
  });

  it('présente en premier les grandes villes et respecte la limite', () => {
    expect(suggestEarthObserverLocations(LOCATIONS, '', 'en-US', 2)).toEqual([
      LOCATIONS[3],
      LOCATIONS[1],
    ]);
    expect(suggestEarthObserverLocations(LOCATIONS, '', 'en-US', 0)).toEqual([]);
  });

  it('localise le pays et accepte les coordonnées personnalisées', () => {
    expect(earthObserverLocationLabel(LOCATIONS[0]!, 'en-US')).toEqual({
      primary: 'Paris',
      secondary: 'France',
    });
    expect(
      earthObserverLocationLabel(
        {
          id: 'custom',
          name: 'Private observatory',
          latitude: 1,
          longitude: 2,
          timeZone: 'UTC',
        },
        'en-US',
      ),
    ).toEqual({ primary: 'Private observatory', secondary: '' });
  });
});

function location(
  id: string,
  name: string,
  countryCode: string,
  population: number,
  capital: boolean,
): EarthObserverLocation {
  return {
    id,
    name,
    countryCode,
    latitude: 0,
    longitude: 0,
    timeZone: 'UTC',
    population,
    capital,
  };
}
