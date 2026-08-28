import { loadStarClusterTilePackSource, loadStarTileIndexSource } from './star-tile-source-loader';

describe('chargement des sources de tuiles stellaires', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('charge et valide un index ainsi qu’un paquet Gaia', async () => {
    const fetcher = vi
      .fn<(url: string) => Promise<Response>>()
      .mockResolvedValueOnce(response(validIndex()))
      .mockResolvedValueOnce(response(validPack()));

    await expect(loadStarTileIndexSource(indexSource(), fetcher)).resolves.toMatchObject({
      sourceCatalog: 'gaia-dr3-bright-high-confidence',
      colorIndexSystem: 'gaia-bp-rp',
    });
    await expect(
      loadStarClusterTilePackSource({ id: 'root-pack', url: '/root.json' }, fetcher),
    ).resolves.toMatchObject({ tiles: [{ id: 'root' }] });
  });

  it('utilise fetch par défaut', async () => {
    const fetcher = vi
      .fn<(url: string) => Promise<Response>>()
      .mockResolvedValueOnce(response(validIndex()))
      .mockResolvedValueOnce(response(validPack()));

    vi.stubGlobal('fetch', fetcher);
    await expect(loadStarTileIndexSource(indexSource())).resolves.toMatchObject({
      sourceStarCount: 1,
    });
    await expect(
      loadStarClusterTilePackSource({ id: 'root-pack', url: '/root.json' }),
    ).resolves.toMatchObject({ tiles: [{ id: 'root' }] });
    expect(fetcher).toHaveBeenNthCalledWith(1, '/index.json');
    expect(fetcher).toHaveBeenNthCalledWith(2, '/root.json');
  });

  it('distingue les erreurs HTTP et une mauvaise association de catalogue', async () => {
    await expect(
      loadStarTileIndexSource(
        indexSource(),
        vi.fn(async () => failedResponse(503)),
      ),
    ).rejects.toThrow('Impossible de charger l’index stellaire gaia-tiles (503)');
    await expect(
      loadStarClusterTilePackSource(
        { id: 'pack', url: '/pack.json' },
        vi.fn(async () => failedResponse(404)),
      ),
    ).rejects.toThrow('Impossible de charger le paquet de tuiles stellaires (404)');
    await expect(
      loadStarTileIndexSource(
        indexSource(),
        vi.fn(async () => response({ ...validIndex(), sourceCatalog: 'other' })),
      ),
    ).rejects.toThrow('Index stellaire associé au mauvais catalogue : other');
  });
});

function indexSource() {
  return {
    id: 'gaia-tiles',
    url: '/index.json',
    sourceCatalogId: 'gaia-dr3-bright-high-confidence',
  } as const;
}

function validIndex(): object {
  return {
    version: '4.0.0',
    sourceCatalog: 'gaia-dr3-bright-high-confidence',
    sourceStarCount: 1,
    referenceEpochJulianDay: 2_457_388.5,
    referenceFrame: 'icrs',
    distanceUnit: 'parsec',
    magnitudeBand: 'gaia-g',
    colorIndexSystem: 'gaia-bp-rp',
    source: {
      name: 'Gaia Data Release 3',
      url: 'https://gea.esac.esa.int/archive/',
      doi: '10.5270/esa-qa4lep3',
      credit: 'ESA/Gaia/DPAC',
      retrievedAt: '2026-08-28T00:00:00.000Z',
      query: 'SELECT source_id FROM gaiadr3.gaia_source_lite',
    },
    selection: {
      maximumDistanceParsec: 5_000,
      maximumApparentMagnitude: 12,
      minimumParallaxOverError: 10,
    },
    sampling: {
      method: 'brightest-plus-deterministic-uniform',
      maximumSamplesPerLeaf: 96,
      brightestSamplesPerLeaf: 32,
    },
    scientificConfidence: 'calculated',
    representation: 'hierarchical-aggregation-with-deterministic-samples',
    rootIds: ['root'],
    nodes: [
      {
        id: 'root',
        childIds: [],
        lodLevel: 4,
        boundsParsec: { min: [0, 0, 0], max: [1, 1, 1] },
        sourceStarCount: 1,
        clusterCount: 1,
        cellSizeParsec: 256,
        representation: 'aggregate-cell',
        url: '/root.json',
      },
    ],
  };
}

function validPack(): object {
  return {
    version: '4.0.0',
    sourceCatalog: 'gaia-dr3-bright-high-confidence',
    referenceEpochJulianDay: 2_457_388.5,
    magnitudeBand: 'gaia-g',
    colorIndexSystem: 'gaia-bp-rp',
    tiles: [
      {
        id: 'root',
        version: '4.0.0',
        sourceCatalog: 'gaia-dr3-bright-high-confidence',
        sourceStarCount: 1,
        referenceEpochJulianDay: 2_457_388.5,
        magnitudeBand: 'gaia-g',
        colorIndexSystem: 'gaia-bp-rp',
        lodLevel: 4,
        cellSizeParsec: 256,
        representation: 'aggregate-cell',
        cellCoordinates: [0, 0, 0],
        positionsParsec: [1, 2, 3],
        starCounts: [1],
        apparentMagnitudes: [2],
        colorIndices: [0.8],
      },
    ],
  };
}

function response(body: unknown): Response {
  return { ok: true, status: 200, json: async () => body } as Response;
}

function failedResponse(status: number): Response {
  return { ok: false, status, json: async () => null } as Response;
}
