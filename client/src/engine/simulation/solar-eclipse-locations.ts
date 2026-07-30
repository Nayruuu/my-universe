export interface SolarEclipseObserverLocation {
  readonly id: string;
  readonly name: string;
  readonly latitude: number;
  readonly longitude: number;
  readonly timeZone: string;
}

export const SOLAR_ECLIPSE_OBSERVER_LOCATIONS: readonly SolarEclipseObserverLocation[] = [
  {
    id: 'paris',
    name: 'Paris',
    latitude: 48.8566,
    longitude: 2.3522,
    timeZone: 'Europe/Paris',
  },
  {
    id: 'lyon',
    name: 'Lyon',
    latitude: 45.764,
    longitude: 4.8357,
    timeZone: 'Europe/Paris',
  },
  {
    id: 'clermont-ferrand',
    name: 'Clermont-Ferrand',
    latitude: 45.7772,
    longitude: 3.087,
    timeZone: 'Europe/Paris',
  },
  {
    id: 'grenoble',
    name: 'Grenoble',
    latitude: 45.1885,
    longitude: 5.7245,
    timeZone: 'Europe/Paris',
  },
  {
    id: 'biarritz',
    name: 'Biarritz',
    latitude: 43.4832,
    longitude: -1.5586,
    timeZone: 'Europe/Paris',
  },
  {
    id: 'bordeaux',
    name: 'Bordeaux',
    latitude: 44.8378,
    longitude: -0.5792,
    timeZone: 'Europe/Paris',
  },
  {
    id: 'toulouse',
    name: 'Toulouse',
    latitude: 43.6047,
    longitude: 1.4442,
    timeZone: 'Europe/Paris',
  },
  {
    id: 'marseille',
    name: 'Marseille',
    latitude: 43.2965,
    longitude: 5.3698,
    timeZone: 'Europe/Paris',
  },
  {
    id: 'nantes',
    name: 'Nantes',
    latitude: 47.2184,
    longitude: -1.5536,
    timeZone: 'Europe/Paris',
  },
  {
    id: 'strasbourg',
    name: 'Strasbourg',
    latitude: 48.5734,
    longitude: 7.7521,
    timeZone: 'Europe/Paris',
  },
];
