import type {
  DeferredCatalogDatasets,
  LoadedDeferredUniverseCatalogs,
} from './deferred-universe-catalog-load';
import {
  loadDeferredUniverseCatalogsOffThread,
  type DeferredUniverseCatalogWorkerPort,
} from './deferred-universe-catalog-worker-loader';
import type {
  DeferredUniverseCatalogWorkerRequest,
  DeferredUniverseCatalogWorkerResponse,
} from './deferred-universe-catalog-worker-protocol';

describe('loadDeferredUniverseCatalogsOffThread', () => {
  const datasets: DeferredCatalogDatasets = {
    cosmicGroup: undefined,
    cosmicStructure: undefined,
    cosmicWebVolume: undefined,
    exoplanets: undefined,
  };

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('utilise le chargeur principal lorsque les Web Workers sont indisponibles', async () => {
    const catalogs = emptyCatalogs();
    const loadOnMainThread = vi.fn(async () => catalogs);

    vi.stubGlobal('Worker', undefined);

    await expect(
      loadDeferredUniverseCatalogsOffThread(datasets, { loadOnMainThread }),
    ).resolves.toBe(catalogs);
    expect(loadOnMainThread).toHaveBeenCalledWith(datasets);
  });

  it('crée par défaut un Worker module dédié aux catalogues différés', async () => {
    const worker = new WorkerPortFixture();
    const workerCalls: Array<{ readonly url: URL; readonly options: WorkerOptions }> = [];
    const WorkerConstructor = vi.fn(function WorkerConstructor(url: URL, options: WorkerOptions) {
      workerCalls.push({ url, options });

      return worker;
    });

    vi.stubGlobal('Worker', WorkerConstructor);
    const loading = loadDeferredUniverseCatalogsOffThread(datasets);

    expect(WorkerConstructor).toHaveBeenCalledOnce();
    expect(workerCalls[0]!.url).toBeInstanceOf(URL);
    expect(String(workerCalls[0]!.url)).toMatch(/worker-.+\.js\?worker_file&type=module/);
    expect(workerCalls[0]!.options).toEqual({
      type: 'module',
      name: 'universe-map-deferred-catalog-decoder',
    });
    worker.emitLoaded(emptyCatalogs());
    await expect(loading).resolves.toEqual(emptyCatalogs());
  });

  it('envoie les sources puis termine le Worker après le transfert', async () => {
    const worker = new WorkerPortFixture();
    const catalogs = emptyCatalogs();
    const loadOnMainThread = vi.fn(async () => emptyCatalogs());
    const loading = loadDeferredUniverseCatalogsOffThread(datasets, {
      createWorker: () => worker,
      loadOnMainThread,
    });

    expect(worker.postMessage).toHaveBeenCalledWith({
      type: 'load-deferred-universe-catalogs',
      datasets,
    });
    worker.emitLoaded(catalogs);

    await expect(loading).resolves.toBe(catalogs);
    expect(worker.terminate).toHaveBeenCalledOnce();
    expect(worker.onmessage).toBeNull();
    expect(worker.onerror).toBeNull();
    expect(worker.onmessageerror).toBeNull();
    expect(loadOnMainThread).not.toHaveBeenCalled();
  });

  it('propage une erreur sérialisée sans télécharger les catalogues deux fois', async () => {
    const worker = new WorkerPortFixture();
    const loadOnMainThread = vi.fn(async () => emptyCatalogs());
    const loading = loadDeferredUniverseCatalogsOffThread(datasets, {
      createWorker: () => worker,
      loadOnMainThread,
    });

    worker.emitResponse({
      type: 'deferred-universe-catalogs-error',
      message: 'dimensions invalides',
    });

    await expect(loading).rejects.toThrow('dimensions invalides');
    expect(worker.terminate).toHaveBeenCalledOnce();
    expect(loadOnMainThread).not.toHaveBeenCalled();
  });

  it('revient au thread principal si la création du Worker échoue', async () => {
    const catalogs = emptyCatalogs();
    const loadOnMainThread = vi.fn(async () => catalogs);

    await expect(
      loadDeferredUniverseCatalogsOffThread(datasets, {
        createWorker: () => {
          throw new Error('Worker bloqué');
        },
        loadOnMainThread,
      }),
    ).resolves.toBe(catalogs);
    expect(loadOnMainThread).toHaveBeenCalledWith(datasets);
  });

  it('revient au thread principal si le message initial ne peut pas être envoyé', async () => {
    const worker = new WorkerPortFixture();
    const catalogs = emptyCatalogs();
    const loadOnMainThread = vi.fn(async () => catalogs);

    worker.postMessage.mockImplementation(() => {
      throw new Error('échec du clonage');
    });

    await expect(
      loadDeferredUniverseCatalogsOffThread(datasets, {
        createWorker: () => worker,
        loadOnMainThread,
      }),
    ).resolves.toBe(catalogs);
    expect(worker.terminate).toHaveBeenCalledOnce();
    expect(loadOnMainThread).toHaveBeenCalledWith(datasets);
  });

  it.each(['error', 'messageerror'] as const)(
    'revient au thread principal après un événement Worker %s',
    async (eventType) => {
      const worker = new WorkerPortFixture();
      const catalogs = emptyCatalogs();
      const loadOnMainThread = vi.fn(async () => catalogs);
      const loading = loadDeferredUniverseCatalogsOffThread(datasets, {
        createWorker: () => worker,
        loadOnMainThread,
      });

      worker.emitFailure(eventType);

      await expect(loading).resolves.toBe(catalogs);
      expect(worker.terminate).toHaveBeenCalledOnce();
      expect(loadOnMainThread).toHaveBeenCalledWith(datasets);
    },
  );

  it('propage une erreur du repli sur le thread principal', async () => {
    vi.stubGlobal('Worker', undefined);

    await expect(
      loadDeferredUniverseCatalogsOffThread(datasets, {
        loadOnMainThread: async () => {
          throw new Error('réseau indisponible');
        },
      }),
    ).rejects.toThrow('réseau indisponible');
  });

  it('ignore un second événement reçu après la résolution', async () => {
    const worker = new WorkerPortFixture();
    const catalogs = emptyCatalogs();
    const loading = loadDeferredUniverseCatalogsOffThread(datasets, {
      createWorker: () => worker,
    });
    const onMessage = worker.onmessage;

    worker.emitLoaded(catalogs);
    onMessage?.(
      new MessageEvent<DeferredUniverseCatalogWorkerResponse>('message', {
        data: { type: 'deferred-universe-catalogs-error', message: 'trop tard' },
      }),
    );

    await expect(loading).resolves.toBe(catalogs);
    expect(worker.terminate).toHaveBeenCalledOnce();
  });
});

class WorkerPortFixture implements DeferredUniverseCatalogWorkerPort {
  public onmessage: ((event: MessageEvent<DeferredUniverseCatalogWorkerResponse>) => void) | null =
    null;
  public onerror: ((event: ErrorEvent) => void) | null = null;
  public onmessageerror: ((event: MessageEvent<unknown>) => void) | null = null;
  public readonly postMessage = vi.fn<(message: DeferredUniverseCatalogWorkerRequest) => void>();
  public readonly terminate = vi.fn<() => void>();

  public emitLoaded(catalogs: LoadedDeferredUniverseCatalogs): void {
    this.emitResponse({ type: 'deferred-universe-catalogs-loaded', catalogs });
  }

  public emitResponse(response: DeferredUniverseCatalogWorkerResponse): void {
    this.onmessage?.(new MessageEvent('message', { data: response }));
  }

  public emitFailure(type: 'error' | 'messageerror'): void {
    if (type === 'error') {
      this.onerror?.(new ErrorEvent('error'));

      return;
    }
    this.onmessageerror?.(new MessageEvent('messageerror'));
  }
}

function emptyCatalogs(): LoadedDeferredUniverseCatalogs {
  return {
    cosmicGroupCatalog: null,
    cosmicStructureCatalog: null,
    cosmicWebVolume: null,
    exoplanetCatalog: null,
    warnings: [],
  };
}
