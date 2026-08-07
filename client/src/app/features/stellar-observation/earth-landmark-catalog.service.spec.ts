import { TestBed } from '@angular/core/testing';
import { vi } from 'vitest';
import {
  EarthLandmarkCatalogError,
  type EarthLandmarkCatalog,
  loadEarthLandmarkCatalog,
} from './earth-landmark-catalog';
import {
  createEarthLandmarkCatalogErrorReporter,
  EARTH_LANDMARK_CATALOG_ERROR_REPORTER,
  EARTH_LANDMARK_CATALOG_LOADER,
  EarthLandmarkCatalogService,
} from './earth-landmark-catalog.service';

describe('EarthLandmarkCatalogService', () => {
  afterEach(() => TestBed.resetTestingModule());

  it('fournit le loader du catalogue statique par défaut', () => {
    TestBed.configureTestingModule({});

    expect(TestBed.inject(EARTH_LANDMARK_CATALOG_LOADER)).toBe(loadEarthLandmarkCatalog);
  });

  it('partage le manifest entre les lieux et délègue le chargement régional', async () => {
    const catalog = { load: vi.fn().mockResolvedValue([]) } as unknown as EarthLandmarkCatalog;
    const loader = vi.fn().mockResolvedValue(catalog);

    TestBed.configureTestingModule({
      providers: [
        EarthLandmarkCatalogService,
        { provide: EARTH_LANDMARK_CATALOG_LOADER, useValue: loader },
      ],
    });
    const service = TestBed.inject(EarthLandmarkCatalogService);

    await Promise.all([service.load('paris'), service.load('tokyo')]);

    expect(loader).toHaveBeenCalledOnce();
    expect(catalog.load).toHaveBeenNthCalledWith(1, 'paris');
    expect(catalog.load).toHaveBeenNthCalledWith(2, 'tokyo');
  });

  it('réessaie le manifest après une erreur de chargement', async () => {
    const catalog = { load: vi.fn().mockResolvedValue([]) } as unknown as EarthLandmarkCatalog;
    const loader = vi
      .fn()
      .mockRejectedValueOnce(new Error('offline'))
      .mockResolvedValueOnce(catalog);

    TestBed.configureTestingModule({
      providers: [
        EarthLandmarkCatalogService,
        { provide: EARTH_LANDMARK_CATALOG_LOADER, useValue: loader },
      ],
    });
    const service = TestBed.inject(EarthLandmarkCatalogService);

    await expect(service.load('paris')).rejects.toThrow('offline');
    await expect(service.load('paris')).resolves.toEqual([]);
    expect(loader).toHaveBeenCalledTimes(2);
  });

  it('signale une erreur catalogue injectable, la relance puis permet une nouvelle tentative', async () => {
    const error = new EarthLandmarkCatalogError(
      'manifest-unavailable',
      'Unable to load the Earth landmark manifest (503).',
      { status: 503, url: '/data/earth-landmarks/manifest.json' },
    );
    const catalog = { load: vi.fn().mockResolvedValue([]) } as unknown as EarthLandmarkCatalog;
    const loader = vi.fn().mockRejectedValueOnce(error).mockResolvedValueOnce(catalog);
    const reporter = vi.fn();

    TestBed.configureTestingModule({
      providers: [
        EarthLandmarkCatalogService,
        { provide: EARTH_LANDMARK_CATALOG_LOADER, useValue: loader },
        { provide: EARTH_LANDMARK_CATALOG_ERROR_REPORTER, useValue: reporter },
      ],
    });
    const service = TestBed.inject(EarthLandmarkCatalogService);

    await expect(service.load('paris')).rejects.toBe(error);
    expect(reporter).toHaveBeenCalledOnce();
    expect(reporter).toHaveBeenCalledWith(error);
    await expect(service.load('paris')).resolves.toEqual([]);
    expect(loader).toHaveBeenCalledTimes(2);
  });

  it('propose un reporter de développement actionnable et désactivable', () => {
    const logger = { warn: vi.fn() };
    const error = new EarthLandmarkCatalogError(
      'pack-unavailable',
      'Unable to load Earth landmark pack europe (503).',
      { regionId: 'europe', status: 503, url: '/data/earth-landmarks/europe.json' },
    );

    createEarthLandmarkCatalogErrorReporter(true, logger)(error);
    expect(logger.warn).toHaveBeenCalledWith(
      '[Universe Map] Earth landmark catalog warning',
      expect.objectContaining({
        code: 'pack-unavailable',
        regionId: 'europe',
        status: 503,
        url: '/data/earth-landmarks/europe.json',
      }),
    );

    logger.warn.mockClear();
    createEarthLandmarkCatalogErrorReporter(false, logger)(error);
    expect(logger.warn).not.toHaveBeenCalled();
  });
});
