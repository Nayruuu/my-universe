import {
  parseEarthObserverCoordinates,
  type EarthObserverLocation,
} from '../../../engine/simulation/earth-observer-location';

export type EarthObserverGeolocationIssue =
  'unsupported' | 'permission-denied' | 'position-unavailable' | 'timeout' | 'invalid-position';

export type EarthObserverGeolocationResult =
  | {
      readonly issue: null;
      readonly location: EarthObserverLocation;
    }
  | {
      readonly issue: EarthObserverGeolocationIssue;
      readonly location: null;
    };

const GEOLOCATION_OPTIONS: PositionOptions = {
  enableHighAccuracy: false,
  maximumAge: 300_000,
  timeout: 10_000,
};

const COORDINATE_DECIMAL_PLACES = 3;

export async function locateEarthObserver(
  geolocation: Geolocation | undefined,
  name: string,
  timeZone: string,
): Promise<EarthObserverGeolocationResult> {
  if (!geolocation) {
    return { issue: 'unsupported', location: null };
  }

  let position: GeolocationPosition;

  try {
    position = await currentPosition(geolocation);
  } catch (error: unknown) {
    return { issue: geolocationIssue(error), location: null };
  }

  const parsed = parseEarthObserverCoordinates(
    position.coords.latitude.toFixed(COORDINATE_DECIMAL_PLACES),
    position.coords.longitude.toFixed(COORDINATE_DECIMAL_PLACES),
    { name, timeZone },
  );

  return parsed.location
    ? { issue: null, location: parsed.location }
    : { issue: 'invalid-position', location: null };
}

function currentPosition(geolocation: Geolocation): Promise<GeolocationPosition> {
  return new Promise((resolve, reject) => {
    geolocation.getCurrentPosition(resolve, reject, GEOLOCATION_OPTIONS);
  });
}

function geolocationIssue(error: unknown): EarthObserverGeolocationIssue {
  if (!isGeolocationPositionError(error)) {
    return 'position-unavailable';
  }
  if (error.code === 1) {
    return 'permission-denied';
  }
  if (error.code === 3) {
    return 'timeout';
  }

  return 'position-unavailable';
}

function isGeolocationPositionError(error: unknown): error is GeolocationPositionError {
  return (
    typeof error === 'object' && error !== null && 'code' in error && typeof error.code === 'number'
  );
}
