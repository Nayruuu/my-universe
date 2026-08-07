import { EARTH_OBSERVER_LOCATIONS } from '../../../engine/simulation/earth-observer-location';
import {
  EARTH_CATALOG_DECORATIVE_SKYLINE_MAX_HEIGHT_UNITS,
  createEarthCatalogCityscape,
} from './earth-catalog-cityscape';
import { EARTH_LANDMARK_MAX_RENDERED_HEIGHT_PIXELS } from './earth-landmark-layout';

describe('catalog cityscape art direction', () => {
  it('produces a deterministic, complete panorama for every catalog city', () => {
    const signatures = new Set<string>();

    for (const location of EARTH_OBSERVER_LOCATIONS) {
      const panorama = createEarthCatalogCityscape(location);
      const repeated = createEarthCatalogCityscape(location);

      expect(repeated).toEqual(panorama);
      expect(panorama.locationId).toBe(location.id);
      expect(panorama.farSilhouettePath.length).toBeGreaterThan(1_500);
      expect(panorama.nearSilhouettePath.length).toBeGreaterThan(2_500);
      expect(panorama.windowLights).toHaveLength(expectedWindowCount(panorama.lightDensity));
      expect(panorama.lightPools.length).toBeGreaterThanOrEqual(10);
      expect(
        panorama.windowLights.every(({ x, y }) => Number.isFinite(x) && Number.isFinite(y)),
      ).toBe(true);
      expect(populatedHorizontalBands(panorama.windowLights.map(({ x }) => x))).toBe(8);
      expect(panorama.farSilhouettePath).not.toMatch(/NaN|Infinity/u);
      expect(panorama.nearSilhouettePath).not.toMatch(/NaN|Infinity/u);
      signatures.add(`${panorama.farSilhouettePath}|${panorama.nearSilhouettePath}`);
    }

    expect(signatures.size).toBe(EARTH_OBSERVER_LOCATIONS.length);
  });

  it('uses geography and urban scale to give cities a coherent visual identity', () => {
    const denseCapital = createEarthCatalogCityscape({
      id: 'dense-capital',
      name: 'Dense Capital',
      countryCode: 'JP',
      latitude: 35.68,
      longitude: 139.76,
      population: 14_000_000,
      capital: true,
      timeZone: 'Asia/Tokyo',
    });
    const desertCity = createEarthCatalogCityscape({
      id: 'desert-city',
      name: 'Desert City',
      countryCode: 'DZ',
      latitude: 27.2,
      longitude: 2.5,
      population: 120_000,
      timeZone: 'Africa/Algiers',
    });

    expect(denseCapital.architecture).toBe('high-rise');
    expect(denseCapital.lightDensity).toBe('dense');
    expect(desertCity.architecture).toBe('desert');
    expect(desertCity.terrain).toBe('dunes');
    expect(desertCity.lightDensity).toBe('quiet');
  });

  it('keeps custom coordinates attractive when optional city metadata is unavailable', () => {
    const panorama = createEarthCatalogCityscape({
      id: 'coordinates-48.000000-2.000000',
      name: '48.0000°, 2.0000°',
      latitude: 48,
      longitude: 2,
      timeZone: 'UTC',
    });

    expect(['historic', 'metropolitan']).toContain(panorama.architecture);
    expect(panorama.lightDensity).toBe('quiet');
    expect(panorama.windowLights.length).toBeGreaterThanOrEqual(96);
  });

  it('keeps the decorative background below the landmark prominence budget', () => {
    const referencePanoramaUnitsPerPixel = 1.43;

    expect(
      EARTH_CATALOG_DECORATIVE_SKYLINE_MAX_HEIGHT_UNITS / referencePanoramaUnitsPerPixel,
    ).toBeLessThan(EARTH_LANDMARK_MAX_RENDERED_HEIGHT_PIXELS);
  });
});

function populatedHorizontalBands(horizontalPositions: readonly number[]): number {
  return new Set(horizontalPositions.map((x) => Math.min(7, Math.floor((x / 7_200) * 8)))).size;
}

function expectedWindowCount(density: 'balanced' | 'dense' | 'quiet'): number {
  return density === 'dense' ? 360 : density === 'balanced' ? 260 : 180;
}
