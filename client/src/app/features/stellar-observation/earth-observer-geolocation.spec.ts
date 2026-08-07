import { locateEarthObserver } from './earth-observer-geolocation';

describe('géolocalisation de l’observateur terrestre', () => {
  it('signale un navigateur sans géolocalisation', async () => {
    await expect(locateEarthObserver(undefined, 'Ma position', 'Europe/Paris')).resolves.toEqual({
      issue: 'unsupported',
      location: null,
    });
  });

  it('arrondit la position avant de créer un observateur restaurable', async () => {
    const geolocation = geolocationResolving(position(48.856_612_3, 2.352_221_9));

    await expect(locateEarthObserver(geolocation, 'Ma position', 'Europe/Paris')).resolves.toEqual({
      issue: null,
      location: {
        id: 'coordinates-48.857000-2.352000',
        name: 'Ma position',
        latitude: 48.857,
        longitude: 2.352,
        timeZone: 'Europe/Paris',
      },
    });
    expect(geolocation.getCurrentPosition).toHaveBeenCalledWith(
      expect.any(Function),
      expect.any(Function),
      {
        enableHighAccuracy: false,
        maximumAge: 300_000,
        timeout: 10_000,
      },
    );
  });

  it.each([
    [1, 'permission-denied'],
    [2, 'position-unavailable'],
    [3, 'timeout'],
    [0, 'position-unavailable'],
  ] as const)('convertit l’erreur navigateur %s en %s', async (code, issue) => {
    const geolocation = geolocationRejecting({ code });

    await expect(locateEarthObserver(geolocation, 'Ma position', 'UTC')).resolves.toEqual({
      issue,
      location: null,
    });
  });

  it('tolère une exception sans contrat de géolocalisation', async () => {
    const geolocation = geolocationRejecting(new Error('position provider failed'));

    await expect(locateEarthObserver(geolocation, 'Ma position', 'UTC')).resolves.toEqual({
      issue: 'position-unavailable',
      location: null,
    });
  });

  it('rejette des coordonnées hors du domaine terrestre', async () => {
    const geolocation = geolocationResolving(position(91, 181));

    await expect(locateEarthObserver(geolocation, 'Ma position', 'UTC')).resolves.toEqual({
      issue: 'invalid-position',
      location: null,
    });
  });
});

function geolocationResolving(positionResult: GeolocationPosition): Geolocation {
  return {
    getCurrentPosition: vi.fn((success: PositionCallback) => success(positionResult)),
    watchPosition: vi.fn(),
    clearWatch: vi.fn(),
  };
}

function geolocationRejecting(error: unknown): Geolocation {
  return {
    getCurrentPosition: vi.fn(
      (_success: PositionCallback, failure?: PositionErrorCallback | null) =>
        failure?.(error as GeolocationPositionError),
    ),
    watchPosition: vi.fn(),
    clearWatch: vi.fn(),
  };
}

function position(latitude: number, longitude: number): GeolocationPosition {
  return {
    coords: {
      accuracy: 25,
      altitude: null,
      altitudeAccuracy: null,
      heading: null,
      latitude,
      longitude,
      speed: null,
      toJSON: () => ({}),
    },
    timestamp: 0,
    toJSON: () => ({}),
  };
}
