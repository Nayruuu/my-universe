import { EARTH_OBSERVER_LOCATION_RECORDS } from './earth-observer-locations.data';

export interface EarthObserverLocation {
  readonly id: string;
  readonly name: string;
  readonly countryCode?: string;
  readonly latitude: number;
  readonly longitude: number;
  readonly timeZone: string;
  readonly population?: number;
  readonly capital?: boolean;
}

export type EarthObserverLocationIssue =
  'missing-coordinate' | 'invalid-coordinate' | 'latitude-out-of-range' | 'longitude-out-of-range';

export interface EarthObserverLocationOptions {
  readonly name?: string;
  readonly timeZone?: string;
}

export type EarthObserverLocationResult =
  | {
      readonly issue: null;
      readonly location: EarthObserverLocation;
    }
  | {
      readonly issue: EarthObserverLocationIssue;
      readonly location: null;
    };

export function parseEarthObserverCoordinates(
  latitudeInput: string,
  longitudeInput: string,
  options: EarthObserverLocationOptions = {},
): EarthObserverLocationResult {
  const latitudeText = latitudeInput.trim();
  const longitudeText = longitudeInput.trim();

  if (!latitudeText || !longitudeText) {
    return { issue: 'missing-coordinate', location: null };
  }
  const latitude = Number(latitudeText);
  const longitude = Number(longitudeText);

  if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) {
    return { issue: 'invalid-coordinate', location: null };
  }
  if (latitude < -90 || latitude > 90) {
    return { issue: 'latitude-out-of-range', location: null };
  }
  if (longitude < -180 || longitude > 180) {
    return { issue: 'longitude-out-of-range', location: null };
  }

  const normalizedLatitude = normalizeSignedZero(latitude);
  const normalizedLongitude = normalizeSignedZero(longitude);
  const coordinateName = `${normalizedLatitude.toFixed(4)}°, ${normalizedLongitude.toFixed(4)}°`;

  return {
    issue: null,
    location: {
      id: `coordinates-${normalizedLatitude.toFixed(6)}-${normalizedLongitude.toFixed(6)}`,
      name: options.name?.trim() || coordinateName,
      latitude: normalizedLatitude,
      longitude: normalizedLongitude,
      timeZone: options.timeZone?.trim() || 'UTC',
    },
  };
}

export const EARTH_OBSERVER_LOCATIONS: readonly EarthObserverLocation[] =
  EARTH_OBSERVER_LOCATION_RECORDS.map(
    ([id, name, countryCode, latitude, longitude, timeZone, population, capital]) => ({
      id,
      name,
      countryCode,
      latitude,
      longitude,
      timeZone,
      population,
      capital: capital === 1,
    }),
  );

export const DEFAULT_EARTH_OBSERVER_LOCATION = EARTH_OBSERVER_LOCATIONS[0]!;

function normalizeSignedZero(value: number): number {
  return Object.is(value, -0) ? 0 : value;
}
