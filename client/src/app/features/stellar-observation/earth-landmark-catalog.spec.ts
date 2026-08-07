import {
  EarthLandmarkCatalogError,
  loadEarthLandmarkCatalog,
  parseEarthLandmarkManifest,
  parseEarthLandmarkPack,
  type EarthLandmarkCatalogFetcher,
} from './earth-landmark-catalog';

describe('Earth landmark catalog', () => {
  afterEach(() => vi.unstubAllGlobals());

  it('indexes 461 locations without loading a regional pack', async () => {
    const locations = Array.from(
      { length: 461 },
      (_, index) => [`city-${index}`, index < 230 ? 'europe' : 'asia'] as const,
    );
    const fetcher = installFetcher({
      '/data/earth-landmarks/manifest.json': successfulResponse(
        manifest({ locations, locationCount: 461 }),
      ),
    });

    const catalog = await loadEarthLandmarkCatalog(undefined, fetcher);

    expect(catalog.indexedLocationCount).toBe(461);
    expect(catalog.cachedPackCount).toBe(0);
    expect(catalog.hasLocation('city-0')).toBe(true);
    expect(catalog.hasLocation('unknown')).toBe(false);
    expect(catalog.getCachedLandmarks('city-0')).toBeUndefined();
    expect(catalog.getCachedLandmarks('unknown')).toBeUndefined();
    expect(fetcher).toHaveBeenCalledOnce();
  });

  it('loads only the requested region and exposes validated landmarks by location id', async () => {
    const fetcher = installFetcher({
      '/catalog.json': successfulResponse(manifest()),
      '/data/earth-landmarks/europe.json': successfulResponse(europePack()),
    });
    const catalog = await loadEarthLandmarkCatalog('/catalog.json', fetcher);

    const landmarks = await catalog.load('paris');

    expect(landmarks).toHaveLength(4);
    expect(landmarks[0]).toEqual(
      expect.objectContaining({
        category: 'tower',
        distanceMeters: 4_200,
        heightConfidence: 'documented',
        heightMeters: 330,
        id: 'eiffel-tower',
        latitude: 48.85826,
        longitude: 2.2945,
        name: 'Eiffel Tower',
        scientificConfidence: 'observed',
        selectionMethod: 'wikimedia-geosearch',
        silhouettePath: expect.stringMatching(/^M/u),
        sourceAspectRatio: 0.55,
        sourceTitle: 'Eiffel Tower official website',
        sourceUrl: 'https://www.toureiffel.paris/en/the-monument/key-figures',
        sourceViewBox: '0 0 110 200',
        visualConfidence: 'illustrative',
        wikidataId: 'Q243',
        wikipediaUrl: 'https://en.wikipedia.org/wiki/Eiffel_Tower',
      }),
    );
    expect(catalog.cachedPackCount).toBe(1);
    expect(catalog.getCachedLandmarks('paris')).toHaveLength(4);
    await expect(catalog.load('unknown')).resolves.toEqual([]);
    expect(fetcher).toHaveBeenCalledTimes(2);
  });

  it('preserves the browser receiver when the default fetcher is retained for lazy packs', async () => {
    const receiverAwareFetch = vi.fn(function (
      this: typeof globalThis,
      url: string,
    ): Promise<Response> {
      if (this !== globalThis) {
        return Promise.reject(new TypeError('Illegal invocation'));
      }

      return Promise.resolve(
        url.endsWith('manifest.json')
          ? successfulResponse(manifest())
          : successfulResponse(europePack()),
      );
    });

    vi.stubGlobal('fetch', receiverAwareFetch);
    const catalog = await loadEarthLandmarkCatalog();

    await expect(catalog.load('paris')).resolves.toHaveLength(4);
    expect(receiverAwareFetch).toHaveBeenCalledTimes(2);
  });

  it('deduplicates concurrent region requests and can explicitly preload or clear a region', async () => {
    let resolvePack!: (response: Response) => void;
    const pendingPack = new Promise<Response>((resolve) => {
      resolvePack = resolve;
    });
    const fetcher = vi.fn(async (url: string): Promise<Response> => {
      if (url === '/catalog.json') {
        return successfulResponse(manifest());
      }

      return pendingPack;
    });
    const catalog = await loadEarthLandmarkCatalog('/catalog.json', fetcher);
    const paris = catalog.load('paris');
    const london = catalog.load('london');

    expect(fetcher).toHaveBeenCalledTimes(2);
    resolvePack(successfulResponse(europePack()));
    const [parisLandmarks, londonLandmarks] = await Promise.all([paris, london]);

    expect(parisLandmarks).toHaveLength(4);
    expect(parisLandmarks[0]).toEqual(expect.objectContaining({ id: 'eiffel-tower' }));
    expect(londonLandmarks).toHaveLength(4);
    await expect(catalog.preloadRegion('europe')).resolves.toBeUndefined();
    expect(fetcher).toHaveBeenCalledTimes(2);

    catalog.clearCache();
    expect(catalog.cachedPackCount).toBe(0);
    expect(catalog.getCachedLandmarks('paris')).toBeUndefined();
  });

  it('ignores a stale regional response after clearing the cache', async () => {
    const pendingPacks: Array<(response: Response) => void> = [];
    const fetcher = vi.fn((url: string): Promise<Response> => {
      if (url === '/catalog.json') {
        return Promise.resolve(successfulResponse(manifest()));
      }

      return new Promise<Response>((resolve) => pendingPacks.push(resolve));
    });
    const catalog = await loadEarthLandmarkCatalog('/catalog.json', fetcher);
    const staleParis = catalog.load('paris');

    catalog.clearCache();
    const currentParis = catalog.load('paris');

    pendingPacks[0]!(successfulResponse(europePack()));
    await expect(staleParis).resolves.toHaveLength(4);
    expect(catalog.cachedPackCount).toBe(0);

    const currentLondon = catalog.load('london');

    expect(fetcher).toHaveBeenCalledTimes(3);
    pendingPacks[1]!(successfulResponse(europePack()));
    await expect(Promise.all([currentParis, currentLondon])).resolves.toEqual([
      expect.any(Array),
      expect.any(Array),
    ]);
    expect(catalog.cachedPackCount).toBe(1);
  });

  it('does not let a stale regional failure cancel the current request', async () => {
    let rejectStalePack!: (cause: unknown) => void;
    let resolveCurrentPack!: (response: Response) => void;
    let packRequestCount = 0;
    const fetcher = vi.fn((url: string): Promise<Response> => {
      if (url === '/catalog.json') {
        return Promise.resolve(successfulResponse(manifest()));
      }
      packRequestCount += 1;

      return packRequestCount === 1
        ? new Promise<Response>((_, reject) => {
            rejectStalePack = reject;
          })
        : new Promise<Response>((resolve) => {
            resolveCurrentPack = resolve;
          });
    });
    const catalog = await loadEarthLandmarkCatalog('/catalog.json', fetcher);
    const staleParis = catalog.load('paris');

    catalog.clearCache();
    const currentParis = catalog.load('paris');

    rejectStalePack(new TypeError('Stale network failure'));
    await expect(staleParis).rejects.toMatchObject({ code: 'pack-unavailable' });

    const currentLondon = catalog.load('london');

    expect(fetcher).toHaveBeenCalledTimes(3);
    resolveCurrentPack(successfulResponse(europePack()));
    await expect(Promise.all([currentParis, currentLondon])).resolves.toEqual([
      expect.any(Array),
      expect.any(Array),
    ]);
    expect(catalog.cachedPackCount).toBe(1);
  });

  it('does not cache a failed regional load so a later request can retry', async () => {
    const fetcher = installFetcher({
      '/catalog.json': successfulResponse(manifest()),
      '/data/earth-landmarks/europe.json': [failedResponse(503), successfulResponse(europePack())],
    });
    const catalog = await loadEarthLandmarkCatalog('/catalog.json', fetcher);

    await expect(catalog.load('paris')).rejects.toMatchObject({
      code: 'pack-unavailable',
      regionId: 'europe',
      status: 503,
      url: '/data/earth-landmarks/europe.json',
    });
    expect(catalog.cachedPackCount).toBe(0);
    await expect(catalog.load('paris')).resolves.toHaveLength(4);
    expect(fetcher).toHaveBeenCalledTimes(3);
  });

  it('reports unavailable and malformed manifests with actionable context', async () => {
    const unavailableFetcher = installFetcher({ '/missing.json': failedResponse(404) });

    await expect(loadEarthLandmarkCatalog('/missing.json', unavailableFetcher)).rejects.toEqual(
      expect.objectContaining({
        code: 'manifest-unavailable',
        status: 404,
        url: '/missing.json',
      }),
    );
    await expect(
      loadEarthLandmarkCatalog(
        '/broken.json',
        installFetcher({ '/broken.json': invalidJsonResponse() }),
      ),
    ).rejects.toEqual(expect.objectContaining({ code: 'manifest-invalid', url: '/broken.json' }));
  });

  it('turns rejected network requests into retryable catalog errors', async () => {
    const networkError = new TypeError('Network unavailable');
    const rejectedFetcher = vi.fn(async (): Promise<Response> => Promise.reject(networkError));

    await expect(loadEarthLandmarkCatalog('/catalog.json', rejectedFetcher)).rejects.toMatchObject({
      code: 'manifest-unavailable',
      contextCause: networkError,
    });

    const packFetcher = vi
      .fn<EarthLandmarkCatalogFetcher>()
      .mockResolvedValueOnce(successfulResponse(manifest()))
      .mockRejectedValueOnce(networkError);
    const catalog = await loadEarthLandmarkCatalog('/catalog.json', packFetcher);

    await expect(catalog.load('paris')).rejects.toMatchObject({
      code: 'pack-unavailable',
      contextCause: networkError,
      regionId: 'europe',
    });
    expect(catalog.cachedPackCount).toBe(0);
  });

  it('reports an unknown region and a malformed regional JSON response', async () => {
    const catalog = await loadEarthLandmarkCatalog(
      '/catalog.json',
      installFetcher({ '/catalog.json': successfulResponse(manifest()) }),
    );

    await expect(catalog.preloadRegion('oceania')).rejects.toMatchObject({
      code: 'unknown-region',
      regionId: 'oceania',
    });

    const brokenCatalog = await loadEarthLandmarkCatalog(
      '/catalog.json',
      installFetcher({
        '/catalog.json': successfulResponse(manifest()),
        '/data/earth-landmarks/europe.json': invalidJsonResponse(),
      }),
    );

    await expect(brokenCatalog.load('paris')).rejects.toMatchObject({
      code: 'pack-invalid',
      regionId: 'europe',
    });
  });

  it.each([
    [null, 'manifest must be an object'],
    [[], 'manifest must be an object'],
    [{}, 'manifest.version'],
    [{ ...manifest(), locationCount: 3 }, 'locationCount'],
    [{ ...manifest(), locationCount: -1 }, 'non-negative integer'],
    [{ ...manifest(), packs: null }, 'manifest.packs'],
    [{ ...manifest(), packs: [['europe']] }, 'manifest pack must be a tuple'],
    [{ ...manifest(), packs: [['Europe', '/europe.json']] }, 'pack id'],
    [{ ...manifest(), packs: [['europe', 42]] }, 'same-origin'],
    [{ ...manifest(), packs: [['europe', 'https://example.test/europe.json']] }, 'same-origin'],
    [
      {
        ...manifest(),
        packs: [
          ['europe', '/first.json'],
          ['europe', '/second.json'],
        ],
      },
      'duplicate',
    ],
    [{ ...manifest(), locations: [['paris', 'missing']] }, 'unknown pack'],
    [{ ...manifest(), locations: null }, 'manifest.locations'],
    [{ ...manifest(), locations: [['paris']] }, 'manifest location must be a tuple'],
    [{ ...manifest(), locations: [['Paris', 'europe']] }, 'location id'],
    [
      {
        ...manifest(),
        locations: [
          ['paris', 'europe'],
          ['paris', 'europe'],
        ],
      },
      'duplicate',
    ],
  ])('rejects an invalid manifest: %s', (value, expectedMessage) => {
    expect(() => parseEarthLandmarkManifest(value)).toThrow(expectedMessage);
  });

  it.each([
    [null, 'pack must be an object'],
    [[], 'pack must be an object'],
    [{}, 'pack.version'],
    [{ ...europePack(), regionId: 'asia' }, 'must be europe'],
    [{ ...europePack(), locations: [] }, 'missing location paris'],
    [{ ...europePack(), locations: null }, 'pack.locations'],
    [
      {
        ...europePack(),
        locations: [
          ['Paris', []],
          ['london', []],
        ],
      },
      'pack location id',
    ],
    [
      {
        ...europePack(),
        locations: [
          ['paris', null],
          ['london', []],
        ],
      },
      'landmarks for paris',
    ],
    [{ ...europePack(), locations: [['paris']] }, 'location record must be a tuple'],
    [
      { ...europePack(), locations: [...europePack().locations, ['rome', []]] },
      'unexpected location rome',
    ],
    [
      {
        ...europePack(),
        locations: [
          ['paris', cityLandmarkRecords('paris')],
          ['paris', cityLandmarkRecords('paris')],
        ],
      },
      'duplicate location paris',
    ],
  ])('rejects an invalid pack envelope: %s', (value, expectedMessage) => {
    expect(() => parseEarthLandmarkPack(value, 'europe', ['paris', 'london'])).toThrow(
      expectedMessage,
    );
  });

  it.each([0, 3, 5])('requires exactly four landmarks per indexed city; received %i', (count) => {
    const parisLandmarks = cityLandmarkRecords('paris');
    const invalidLandmarks =
      count === 5
        ? [...parisLandmarks, landmarkRecord({ id: 'paris:q104', wikidataId: 'Q104' })]
        : parisLandmarks.slice(0, count);
    const value = {
      ...europePack(),
      locations: [
        ['paris', invalidLandmarks],
        ['london', cityLandmarkRecords('london')],
      ],
    };

    expect(() => parseEarthLandmarkPack(value, 'europe', ['paris', 'london'])).toThrow(
      `paris must contain exactly 4 landmarks; received ${count}`,
    );
  });

  it.each([
    [[], 'landmark must be a tuple'],
    [landmarkRecord({ id: '' }), 'landmark id'],
    [landmarkRecord({ name: '' }), 'landmark name'],
    [landmarkRecord({ wikidataId: 'eiffel' }), 'Wikidata'],
    [landmarkRecord({ category: 'planet' }), 'category'],
    [landmarkRecord({ latitude: 91 }), 'latitude'],
    [landmarkRecord({ longitude: -181 }), 'longitude'],
    [landmarkRecord({ distanceMeters: -1 }), 'distance'],
    [landmarkRecord({ heightMeters: 0 }), 'height'],
    [landmarkRecord({ heightMeters: null }), 'inconsistent'],
    [landmarkRecord({ heightConfidence: 'estimated' }), 'height confidence'],
    [landmarkRecord({ confidence: 'procedural' }), 'scientific confidence'],
    [landmarkRecord({ visualConfidence: 'observed' }), 'visual confidence'],
    [landmarkRecord({ selectionMethod: 'manual' }), 'selection method'],
    [landmarkRecord({ sourceTitle: '' }), 'source title'],
    [landmarkRecord({ sourceUrl: 'http://example.test' }), 'HTTPS source'],
    [landmarkRecord({ wikipediaUrl: 'http://example.test' }), 'Wikipedia URL'],
  ])('rejects an invalid landmark tuple: %s', (record, expectedMessage) => {
    const value = {
      ...europePack(),
      locations: [
        ['paris', [record, ...cityLandmarkRecords('paris').slice(1)]],
        ['london', cityLandmarkRecords('london')],
      ],
    };

    expect(() => parseEarthLandmarkPack(value, 'europe', ['paris', 'london'])).toThrow(
      expectedMessage,
    );
  });

  it('rejects duplicate landmark ids inside a city and preserves error metadata', () => {
    const record = landmarkRecord();
    const value = {
      ...europePack(),
      locations: [
        ['paris', [record, record, ...cityLandmarkRecords('paris').slice(2)]],
        ['london', cityLandmarkRecords('london')],
      ],
    };

    expect(() => parseEarthLandmarkPack(value, 'europe', ['paris', 'london'])).toThrow(
      'duplicate landmark eiffel-tower',
    );
    const error = new EarthLandmarkCatalogError('pack-invalid', 'Invalid pack.', {
      regionId: 'europe',
      url: '/europe.json',
    });

    expect(error.name).toBe('EarthLandmarkCatalogError');
    expect(error.status).toBeUndefined();
    expect(error.regionId).toBe('europe');
  });

  it('accepts an explicitly illustrative GeoNames fallback without a documented height', () => {
    const record = landmarkRecord({
      id: 'paris:fallback-1',
      wikidataId: null,
      category: 'illustrative-cityscape-anchor',
      heightMeters: null,
      heightConfidence: 'illustrative',
      confidence: 'illustrative',
      selectionMethod: 'geonames-illustrative-fallback',
      wikipediaUrl: null,
    });
    const value = {
      ...europePack(),
      locations: [
        ['paris', [record, ...cityLandmarkRecords('paris').slice(1)]],
        ['london', cityLandmarkRecords('london')],
      ],
    };

    const parsed = parseEarthLandmarkPack(value, 'europe', ['paris', 'london']).get('paris')!;

    expect(parsed).toHaveLength(4);
    expect(parsed[0]).toEqual(
      expect.objectContaining({
        id: 'paris:fallback-1',
        heightMeters: null,
        scientificConfidence: 'illustrative',
        wikidataId: null,
      }),
    );
  });

  it.each([
    ['architecture', 1.6],
    ['palace', 1.6],
    ['tower', 0.55],
    ['monument', 0.8],
    ['religious', 0.8],
    ['museum', 1.6],
    ['bridge', 2.5],
    ['fortification', 1.6],
    ['civic', 1.6],
    ['venue', 1.8],
    ['transport', 1.6],
    ['public-space', 1.2],
    ['illustrative-cityscape-anchor', 1.2],
  ] as const)('generates a meaningful %s silhouette ratio', (category, expectedRatio) => {
    const records = cityLandmarkRecords('paris').map((record) => {
      const values = [...record];

      values[3] = category;

      return values;
    });
    const value = {
      ...europePack(),
      locations: [
        ['paris', records],
        ['london', cityLandmarkRecords('london')],
      ],
    };
    const landmarks = parseEarthLandmarkPack(value, 'europe', ['paris', 'london']).get('paris')!;

    expect(landmarks.every(({ sourceAspectRatio }) => sourceAspectRatio === expectedRatio)).toBe(
      true,
    );
  });
});

function manifest(
  overrides: {
    readonly locations?: readonly (readonly [string, string])[];
    readonly locationCount?: number;
  } = {},
): {
  readonly version: number;
  readonly locationCount: number;
  readonly packs: readonly (readonly [string, string])[];
  readonly locations: readonly (readonly [string, string])[];
} {
  const locations = overrides.locations ?? [
    ['paris', 'europe'],
    ['london', 'europe'],
  ];

  return {
    version: 1,
    locationCount: overrides.locationCount ?? locations.length,
    packs: [
      ['europe', '/data/earth-landmarks/europe.json'],
      ['asia', '/data/earth-landmarks/asia.json'],
    ],
    locations,
  };
}

function europePack(): {
  readonly version: number;
  readonly regionId: string;
  readonly locations: readonly unknown[];
} {
  return {
    version: 1,
    regionId: 'europe',
    locations: [
      ['paris', cityLandmarkRecords('paris')],
      ['london', cityLandmarkRecords('london')],
    ],
  };
}

function cityLandmarkRecords(cityId: string): readonly (readonly unknown[])[] {
  return [
    landmarkRecord({
      id: cityId === 'paris' ? 'eiffel-tower' : `${cityId}:q100`,
      wikidataId: cityId === 'paris' ? 'Q243' : 'Q100',
    }),
    landmarkRecord({ id: `${cityId}:q101`, wikidataId: 'Q101' }),
    landmarkRecord({ id: `${cityId}:q102`, wikidataId: 'Q102' }),
    landmarkRecord({ id: `${cityId}:q103`, wikidataId: 'Q103' }),
  ];
}

function landmarkRecord(
  overrides: {
    readonly id?: string;
    readonly name?: string;
    readonly wikidataId?: string | null;
    readonly category?: string;
    readonly latitude?: number;
    readonly longitude?: number;
    readonly distanceMeters?: number;
    readonly heightMeters?: number | null;
    readonly heightConfidence?: string;
    readonly confidence?: string;
    readonly visualConfidence?: string;
    readonly selectionMethod?: string;
    readonly sourceTitle?: string;
    readonly sourceUrl?: string;
    readonly wikipediaUrl?: string | null;
  } = {},
): readonly unknown[] {
  return [
    overrides.id ?? 'eiffel-tower',
    overrides.name ?? 'Eiffel Tower',
    overrides.wikidataId === undefined ? 'Q243' : overrides.wikidataId,
    overrides.category ?? 'tower',
    overrides.latitude ?? 48.85826,
    overrides.longitude ?? 2.2945,
    overrides.distanceMeters ?? 4_200,
    overrides.heightMeters === undefined ? 330 : overrides.heightMeters,
    overrides.heightConfidence ?? 'documented',
    overrides.confidence ?? 'observed',
    overrides.visualConfidence ?? 'illustrative',
    overrides.selectionMethod ?? 'wikimedia-geosearch',
    overrides.sourceTitle ?? 'Eiffel Tower official website',
    overrides.sourceUrl ?? 'https://www.toureiffel.paris/en/the-monument/key-figures',
    overrides.wikipediaUrl === undefined
      ? 'https://en.wikipedia.org/wiki/Eiffel_Tower'
      : overrides.wikipediaUrl,
  ];
}

function installFetcher(
  responses: Readonly<Record<string, Response | readonly Response[]>>,
): ReturnType<typeof vi.fn<EarthLandmarkCatalogFetcher>> {
  const cursors = new Map<string, number>();

  return vi.fn(async (url: string): Promise<Response> => {
    const response = responses[url];

    if (!response) {
      return failedResponse(404);
    }
    if (!isResponseArray(response)) {
      return response;
    }
    const cursor = cursors.get(url) ?? 0;

    cursors.set(url, cursor + 1);

    return response[Math.min(cursor, response.length - 1)]!;
  });
}

function successfulResponse(body: unknown): Response {
  return {
    ok: true,
    status: 200,
    json: async () => body,
  } as Response;
}

function failedResponse(status: number): Response {
  return {
    ok: false,
    status,
    json: async () => null,
  } as Response;
}

function invalidJsonResponse(): Response {
  return {
    ok: true,
    status: 200,
    json: async () => Promise.reject(new SyntaxError('Unexpected token')),
  } as unknown as Response;
}

function isResponseArray(value: Response | readonly Response[]): value is readonly Response[] {
  return Array.isArray(value);
}
