import { type TempelFilamentSpineCatalog } from './tempel-filament-spine-catalog';
import { prepareTempelFilamentSpineRenderData } from './tempel-filament-spine-render-data';
import {
  loadTempelFilamentSpineCatalogOffThread,
  type TempelFilamentSpineWorkerPort,
} from './tempel-filament-spine-worker-loader';
import {
  type TempelFilamentSpineWorkerRequest,
  type TempelFilamentSpineWorkerResponse,
} from './tempel-filament-spine-worker-protocol';

describe('loadTempelFilamentSpineCatalogOffThread', () => {
  const source = { id: 'tempel-spines', url: '/spines.bin' } as const;

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('utilise le chargeur principal lorsque les Web Workers sont indisponibles', async () => {
    const catalog = catalogFixture();
    const loadOnMainThread = vi.fn(async () => loadResult(catalog));
    const onTelemetry = vi.fn();

    vi.stubGlobal('Worker', undefined);

    const loaded = await loadTempelFilamentSpineCatalogOffThread(source, {
      loadOnMainThread,
      onTelemetry,
    });

    expect(loaded).toMatchObject(catalog);
    expect(loaded.renderData).toMatchObject({ sceneUnitsPerMpc: 200, segmentCount: 1 });
    expect(loadOnMainThread).toHaveBeenCalledWith(source);
    expect(onTelemetry).toHaveBeenCalledWith({
      execution: 'main-thread-fallback',
      fetchMs: 12,
      decodeMs: 4,
      workerRoundTripMs: null,
    });
  });

  it('crée par défaut un Worker module dédié au catalogue Tempel', async () => {
    const worker = new WorkerPortFixture();
    const workerCalls: Array<{ readonly url: URL; readonly options: WorkerOptions }> = [];
    const WorkerConstructor = vi.fn(function WorkerConstructor(url: URL, options: WorkerOptions) {
      workerCalls.push({ url, options });

      return worker;
    });

    vi.stubGlobal('Worker', WorkerConstructor);
    const loading = loadTempelFilamentSpineCatalogOffThread(source);

    expect(WorkerConstructor).toHaveBeenCalledOnce();
    expect(workerCalls[0]!.url).toBeInstanceOf(URL);
    expect(String(workerCalls[0]!.url)).toMatch(/worker-.+\.js\?worker_file&type=module/);
    expect(workerCalls[0]!.options).toEqual({
      type: 'module',
      name: 'universe-map-tempel-decoder',
    });
    worker.emitLoaded(catalogFixture());
    await expect(loading).resolves.toMatchObject({
      filamentCount: 1,
      renderData: { sceneUnitsPerMpc: 200, segmentCount: 1 },
    });
  });

  it('envoie uniquement la source puis termine le Worker après le transfert', async () => {
    const catalog = catalogFixture();
    const worker = new WorkerPortFixture();
    const loadOnMainThread = vi.fn(async () => loadResult(catalogFixture()));
    const onTelemetry = vi.fn();
    const loading = loadTempelFilamentSpineCatalogOffThread(source, {
      createWorker: () => worker,
      loadOnMainThread,
      onTelemetry,
      now: clock(20, 93),
    });

    expect(worker.postMessage).toHaveBeenCalledWith({
      type: 'load-tempel-filament-spines',
      source,
    });
    worker.emitLoaded(catalog);

    const loaded = await loading;

    expect(loaded).toMatchObject(catalog);
    expect(loaded.renderData).toBeDefined();
    expect(worker.terminate).toHaveBeenCalledOnce();
    expect(worker.onmessage).toBeNull();
    expect(worker.onerror).toBeNull();
    expect(worker.onmessageerror).toBeNull();
    expect(loadOnMainThread).not.toHaveBeenCalled();
    expect(onTelemetry).toHaveBeenCalledWith({
      execution: 'worker',
      fetchMs: 12,
      decodeMs: 4,
      workerRoundTripMs: 73,
    });
  });

  it('propage une erreur de données sérialisée sans télécharger deux fois le catalogue', async () => {
    const worker = new WorkerPortFixture();
    const loadOnMainThread = vi.fn(async () => loadResult(catalogFixture()));
    const loading = loadTempelFilamentSpineCatalogOffThread(source, {
      createWorker: () => worker,
      loadOnMainThread,
    });

    worker.emitResponse({
      type: 'tempel-filament-spines-error',
      message: 'dimensions invalides',
    });

    await expect(loading).rejects.toThrow('dimensions invalides');
    expect(worker.terminate).toHaveBeenCalledOnce();
    expect(loadOnMainThread).not.toHaveBeenCalled();
  });

  it('revient au thread principal si la création du Worker échoue', async () => {
    const catalog = catalogFixture();
    const loadOnMainThread = vi.fn(async () => loadResult(catalog));

    const loaded = await loadTempelFilamentSpineCatalogOffThread(source, {
      createWorker: () => {
        throw new Error('Worker bloqué');
      },
      loadOnMainThread,
    });

    expect(loaded).toMatchObject(catalog);
    expect(loaded.renderData).toBeDefined();
    expect(loadOnMainThread).toHaveBeenCalledWith(source);
  });

  it('revient au thread principal si le message initial ne peut pas être envoyé', async () => {
    const worker = new WorkerPortFixture();
    const catalog = catalogFixture();
    const loadOnMainThread = vi.fn(async () => loadResult(catalog));

    worker.postMessage.mockImplementation(() => {
      throw new Error('échec du clonage');
    });

    const loaded = await loadTempelFilamentSpineCatalogOffThread(source, {
      createWorker: () => worker,
      loadOnMainThread,
    });

    expect(loaded).toMatchObject(catalog);
    expect(loaded.renderData).toBeDefined();
    expect(worker.terminate).toHaveBeenCalledOnce();
    expect(loadOnMainThread).toHaveBeenCalledWith(source);
  });

  it.each(['error', 'messageerror'] as const)(
    'revient au thread principal après un événement Worker %s',
    async (eventType) => {
      const worker = new WorkerPortFixture();
      const catalog = catalogFixture();
      const loadOnMainThread = vi.fn(async () => loadResult(catalog));
      const loading = loadTempelFilamentSpineCatalogOffThread(source, {
        createWorker: () => worker,
        loadOnMainThread,
      });

      worker.emitFailure(eventType);

      const loaded = await loading;

      expect(loaded).toMatchObject(catalog);
      expect(loaded.renderData).toBeDefined();
      expect(worker.terminate).toHaveBeenCalledOnce();
      expect(loadOnMainThread).toHaveBeenCalledWith(source);
    },
  );

  it('ignore un second événement reçu après la résolution', async () => {
    const worker = new WorkerPortFixture();
    const catalog = catalogFixture();
    const loading = loadTempelFilamentSpineCatalogOffThread(source, {
      createWorker: () => worker,
    });
    const onMessage = worker.onmessage;

    worker.emitLoaded(catalog);
    onMessage?.(
      new MessageEvent<TempelFilamentSpineWorkerResponse>('message', {
        data: { type: 'tempel-filament-spines-error', message: 'trop tard' },
      }),
    );

    const loaded = await loading;

    expect(loaded).toMatchObject(catalog);
    expect(loaded.renderData).toBeDefined();
    expect(worker.terminate).toHaveBeenCalledOnce();
  });
});

class WorkerPortFixture implements TempelFilamentSpineWorkerPort {
  public onmessage: ((event: MessageEvent<TempelFilamentSpineWorkerResponse>) => void) | null =
    null;
  public onerror: ((event: ErrorEvent) => void) | null = null;
  public onmessageerror: ((event: MessageEvent<unknown>) => void) | null = null;
  public readonly postMessage = vi.fn<(message: TempelFilamentSpineWorkerRequest) => void>();
  public readonly terminate = vi.fn<() => void>();

  public emitLoaded(catalog: TempelFilamentSpineCatalog): void {
    this.emitResponse({
      type: 'tempel-filament-spines-loaded',
      catalog: {
        ...catalog,
        renderData: prepareTempelFilamentSpineRenderData(catalog, 200),
      },
      metrics: { fetchMs: 12, decodeMs: 4 },
    });
  }

  public emitResponse(response: TempelFilamentSpineWorkerResponse): void {
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

function loadResult(catalog: TempelFilamentSpineCatalog) {
  return {
    catalog,
    metrics: { fetchMs: 12, decodeMs: 4 },
  };
}

function clock(...values: number[]): () => number {
  return () => values.shift()!;
}

function catalogFixture(): TempelFilamentSpineCatalog {
  return {
    filamentCount: 1,
    pointCount: 2,
    segmentCount: 1,
    referenceEpochJulianDay: 2_451_545,
    minimumDistanceMpc: 10,
    maximumDistanceMpc: 11,
    filamentIds: new Uint16Array([1]),
    pointOffsets: new Uint32Array([0, 2]),
    positionsMpc: new Float32Array([10, 0, 0, 11, 0, 0]),
    visitMap: new Uint8Array([64, 96]),
    density: new Uint8Array([80, 112]),
    orientationStrength: new Uint8Array([200, 210]),
  };
}
