import { TestBed } from '@angular/core/testing';
import { EarthTerrainHorizonCatalog } from './earth-terrain-horizon-catalog';
import {
  EARTH_TERRAIN_HORIZON_CATALOG_LOADER,
  EARTH_TERRAIN_HORIZON_ERROR_REPORTER,
  EarthTerrainHorizonCatalogService,
  createDefaultEarthTerrainHorizonCatalogLoader,
  createDefaultEarthTerrainHorizonErrorReporter,
} from './earth-terrain-horizon-catalog.service';

describe('EarthTerrainHorizonCatalogService', () => {
  it('creates browser loaders and development-aware error reporters', () => {
    const warning = vi.spyOn(console, 'warn').mockImplementation(() => undefined);
    const error = new Error('offline');

    expect(createDefaultEarthTerrainHorizonCatalogLoader()).toBeTypeOf('function');
    createDefaultEarthTerrainHorizonErrorReporter(true)(error);
    createDefaultEarthTerrainHorizonErrorReporter(false)(error);
    expect(warning).toHaveBeenCalledWith('[Universe Map] Terrain horizon unavailable', error);
    warning.mockRestore();
  });

  it('caches the catalog and resolves matching locations', async () => {
    const loader = vi.fn(
      async () => new EarthTerrainHorizonCatalog(manifest(), new Int16Array(1_080)),
    );

    TestBed.configureTestingModule({
      providers: [{ provide: EARTH_TERRAIN_HORIZON_CATALOG_LOADER, useValue: loader }],
    });
    const service = TestBed.inject(EarthTerrainHorizonCatalogService);
    const location = {
      id: 'paris',
      name: 'Paris',
      latitude: 48.8566,
      longitude: 2.3522,
      timeZone: 'Europe/Paris',
    };

    expect(await service.load(location)).not.toBeNull();
    expect(await service.load(location)).not.toBeNull();
    expect(loader).toHaveBeenCalledOnce();
  });

  it('skips custom coordinates and reports recoverable load failures', async () => {
    const error = new Error('offline');
    const reporter = vi.fn();
    const loader = vi.fn(async () => Promise.reject(error));

    TestBed.configureTestingModule({
      providers: [
        { provide: EARTH_TERRAIN_HORIZON_CATALOG_LOADER, useValue: loader },
        { provide: EARTH_TERRAIN_HORIZON_ERROR_REPORTER, useValue: reporter },
      ],
    });
    const service = TestBed.inject(EarthTerrainHorizonCatalogService);
    const custom = {
      id: 'coordinates-48.000000-2.000000',
      name: 'Ma position',
      latitude: 48,
      longitude: 2,
      timeZone: 'UTC',
    };

    expect(await service.load(custom)).toBeNull();
    expect(loader).not.toHaveBeenCalled();
    expect(await service.load({ ...custom, id: 'paris' })).toBeNull();
    expect(reporter).toHaveBeenCalledWith(error);
  });
});

function manifest() {
  return {
    schema: 'universe-map/earth-terrain-horizons@2' as const,
    generatedAt: '2026-08-26T00:00:00.000Z',
    dataClassification: 'calculated-from-measured-global-relief-model' as const,
    source: {
      id: 'etopo',
      title: 'ETOPO fixture',
      productUrl: 'https://example.com/product',
      dataUrl: 'fixture.tif',
      doi: 'https://doi.org/10.0/fixture',
      horizontalDatum: 'WGS 84',
      verticalDatum: 'EGM2008',
      resolutionArcSeconds: 60,
    },
    calculation: {
      model: 'spherical-geometric-line-of-sight' as const,
      earthRadiusMeters: 6_371_008.8,
      observerEyeHeightMeters: 2,
      maximumDistanceMeters: 300_000,
      sampleStepMeters: 1_852,
      azimuthStepDegrees: 1,
      distanceBands: [
        { id: 'near' as const, minimumDistanceMeters: 0, maximumDistanceMeters: 30_000 },
        { id: 'mid' as const, minimumDistanceMeters: 30_000, maximumDistanceMeters: 100_000 },
        { id: 'far' as const, minimumDistanceMeters: 100_000, maximumDistanceMeters: 300_000 },
      ],
      atmosphericRefraction: 'excluded' as const,
      terrainInterpolation: 'bilinear' as const,
      locationAnchor: 'catalogued-city-center' as const,
    },
    binary: {
      file: 'etopo-2022-60s.bin',
      byteLength: 2_160,
      sha256: 'a'.repeat(64),
      encoding: 'int16-le-centidegrees-distance-band-major' as const,
    },
    profileCount: 1,
    profiles: [
      {
        locationId: 'paris',
        latitude: 48.8566,
        longitude: 2.3522,
        observerElevationMeters: 37,
        sampleOffset: 0,
        sampleCount: 360,
      },
    ],
  };
}
