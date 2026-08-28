import { type StarClusterTilePack, type StarTileIndex } from '../../data/models/universe.models';
import {
  loadStarClusterTilePackOffThread,
  loadStarTileIndexOffThread,
  type StarTileWorkerPort,
} from './star-tile-worker-loader';
import {
  type StarTileWorkerRequest,
  type StarTileWorkerResponse,
} from './star-tile-worker-protocol';

describe('chargement Worker des tuiles stellaires', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('se replie sur le thread principal lorsque les Workers sont indisponibles', async () => {
    const loadIndex = vi.fn(async () => indexFixture());
    const loadPack = vi.fn(async () => packFixture());

    vi.stubGlobal('Worker', undefined);
    await expect(
      loadStarTileIndexOffThread(indexSource(), { loadIndexOnMainThread: loadIndex }),
    ).resolves.toBe(await loadIndex.mock.results[0]?.value);
    await expect(
      loadStarClusterTilePackOffThread(packSource(), { loadPackOnMainThread: loadPack }),
    ).resolves.toBe(await loadPack.mock.results[0]?.value);
  });

  it('crée par défaut un Worker module nommé et reçoit un index', async () => {
    const worker = new WorkerPortFixture();
    const calls: Array<{ readonly url: URL; readonly options: WorkerOptions }> = [];
    const WorkerConstructor = vi.fn(function WorkerConstructor(url: URL, options: WorkerOptions) {
      calls.push({ url, options });

      return worker;
    });

    vi.stubGlobal('Worker', WorkerConstructor);
    const loading = loadStarTileIndexOffThread(indexSource());

    expect(WorkerConstructor).toHaveBeenCalledOnce();
    expect(String(calls[0]!.url)).toMatch(
      /(?:star-tile\.worker(?:\.[a-z]+)?|worker-[a-z\d]+\.js)(?:\?.*)?$/iu,
    );
    expect(calls[0]!.options).toEqual({
      type: 'module',
      name: 'universe-map-star-tile-decoder',
    });
    worker.emit({ type: 'star-tile-index-loaded', index: indexFixture() });
    await expect(loading).resolves.toMatchObject({ sourceCatalog: 'gaia' });
  });

  it('transmet une source de paquet, résout le résultat puis nettoie le Worker', async () => {
    const worker = new WorkerPortFixture();
    const loading = loadStarClusterTilePackOffThread(packSource(), {
      createWorker: () => worker,
    });

    expect(worker.postMessage).toHaveBeenCalledWith({
      type: 'load-star-tile-pack',
      source: packSource(),
    });
    worker.emit({ type: 'star-tile-pack-loaded', pack: packFixture() });

    await expect(loading).resolves.toMatchObject({ tiles: [{ id: 'root' }] });
    expect(worker.terminate).toHaveBeenCalledOnce();
    expect(worker.onmessage).toBeNull();
    expect(worker.onerror).toBeNull();
    expect(worker.onmessageerror).toBeNull();
  });

  it('propage une erreur de données et refuse une réponse de mauvais type', async () => {
    const errorWorker = new WorkerPortFixture();
    const failed = loadStarTileIndexOffThread(indexSource(), {
      createWorker: () => errorWorker,
    });

    errorWorker.emit({ type: 'star-tile-error', message: 'métadonnées invalides' });
    await expect(failed).rejects.toThrow('métadonnées invalides');

    const wrongWorker = new WorkerPortFixture();
    const wrong = loadStarTileIndexOffThread(indexSource(), {
      createWorker: () => wrongWorker,
    });

    wrongWorker.emit({ type: 'star-tile-pack-loaded', pack: packFixture() });
    await expect(wrong).rejects.toThrow('Réponse inattendue du Worker');
  });

  it('se replie si la création ou le premier message échoue', async () => {
    const loadIndex = vi.fn(async () => indexFixture());

    await expect(
      loadStarTileIndexOffThread(indexSource(), {
        createWorker: () => {
          throw new Error('Worker bloqué');
        },
        loadIndexOnMainThread: loadIndex,
      }),
    ).resolves.toMatchObject({ sourceCatalog: 'gaia' });

    const worker = new WorkerPortFixture();

    worker.postMessage.mockImplementation(() => {
      throw new Error('clone impossible');
    });
    await expect(
      loadStarTileIndexOffThread(indexSource(), {
        createWorker: () => worker,
        loadIndexOnMainThread: loadIndex,
      }),
    ).resolves.toMatchObject({ sourceCatalog: 'gaia' });
    expect(worker.terminate).toHaveBeenCalledOnce();
    expect(loadIndex).toHaveBeenCalledTimes(2);
  });

  it.each(['error', 'messageerror'] as const)(
    'se replie après un événement Worker %s',
    async (eventType) => {
      const worker = new WorkerPortFixture();
      const loadPack = vi.fn(async () => packFixture());
      const loading = loadStarClusterTilePackOffThread(packSource(), {
        createWorker: () => worker,
        loadPackOnMainThread: loadPack,
      });

      worker.fail(eventType);

      await expect(loading).resolves.toMatchObject({ tiles: [{ id: 'root' }] });
      expect(loadPack).toHaveBeenCalledOnce();
      expect(worker.terminate).toHaveBeenCalledOnce();
    },
  );

  it('propage l’échec du repli et ignore un second événement tardif', async () => {
    const fallbackWorker = new WorkerPortFixture();
    const failed = loadStarTileIndexOffThread(indexSource(), {
      createWorker: () => fallbackWorker,
      loadIndexOnMainThread: vi.fn(async () => {
        throw new Error('repli indisponible');
      }),
    });

    fallbackWorker.fail('error');
    await expect(failed).rejects.toThrow('repli indisponible');

    const worker = new WorkerPortFixture();
    const loading = loadStarTileIndexOffThread(indexSource(), {
      createWorker: () => worker,
    });
    const onMessage = worker.onmessage;

    worker.emit({ type: 'star-tile-index-loaded', index: indexFixture() });
    onMessage?.(
      new MessageEvent('message', {
        data: { type: 'star-tile-error', message: 'trop tard' },
      }),
    );
    await expect(loading).resolves.toMatchObject({ sourceCatalog: 'gaia' });
    expect(worker.terminate).toHaveBeenCalledOnce();
  });
});

class WorkerPortFixture implements StarTileWorkerPort {
  public onmessage: ((event: MessageEvent<StarTileWorkerResponse>) => void) | null = null;
  public onerror: ((event: ErrorEvent) => void) | null = null;
  public onmessageerror: ((event: MessageEvent<unknown>) => void) | null = null;
  public readonly postMessage = vi.fn<(message: StarTileWorkerRequest) => void>();
  public readonly terminate = vi.fn<() => void>();

  public emit(response: StarTileWorkerResponse): void {
    this.onmessage?.(new MessageEvent('message', { data: response }));
  }

  public fail(type: 'error' | 'messageerror'): void {
    if (type === 'error') {
      this.onerror?.(new ErrorEvent('error'));

      return;
    }
    this.onmessageerror?.(new MessageEvent('messageerror'));
  }
}

function indexSource() {
  return { id: 'gaia', url: '/index.json', sourceCatalogId: 'gaia' } as const;
}

function packSource() {
  return { id: 'root-pack', url: '/root.json' } as const;
}

function indexFixture(): StarTileIndex {
  return {
    version: '4.0.0',
    sourceCatalog: 'gaia',
    sourceStarCount: 1,
    referenceEpochJulianDay: 2_457_388.5,
    referenceFrame: 'icrs',
    distanceUnit: 'parsec',
    magnitudeBand: 'gaia-g',
    colorIndexSystem: 'gaia-bp-rp',
    source: {
      name: 'Gaia Data Release 3 · gaia_source_lite',
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
    nodes: [],
  };
}

function packFixture(): StarClusterTilePack {
  return {
    version: '4.0.0',
    sourceCatalog: 'gaia',
    referenceEpochJulianDay: 2_457_388.5,
    magnitudeBand: 'gaia-g',
    colorIndexSystem: 'gaia-bp-rp',
    tiles: [
      {
        id: 'root',
        version: '4.0.0',
        sourceCatalog: 'gaia',
        sourceStarCount: 1,
        referenceEpochJulianDay: 2_457_388.5,
        magnitudeBand: 'gaia-g',
        colorIndexSystem: 'gaia-bp-rp',
        lodLevel: 4,
        cellSizeParsec: 256,
        representation: 'aggregate-cell',
        clusterCount: 1,
        cellCoordinates: Int32Array.from([0, 0, 0]),
        positionsParsec: Float32Array.from([1, 2, 3]),
        starCounts: Uint32Array.from([1]),
        apparentMagnitudes: Float32Array.from([2]),
        colorIndices: Float32Array.from([0.8]),
      },
    ],
  };
}
