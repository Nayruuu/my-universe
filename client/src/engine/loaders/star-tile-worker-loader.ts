import {
  type StarClusterTilePack,
  type StarTileIndex,
  type StarTileSource,
} from '../../data/models/universe.models';
import {
  loadStarClusterTilePackSource,
  loadStarTileIndexSource,
  type StarTilePackSource,
} from './star-tile-source-loader';
import {
  type StarTileWorkerRequest,
  type StarTileWorkerResponse,
} from './star-tile-worker-protocol';

export interface StarTileWorkerPort {
  onmessage: ((event: MessageEvent<StarTileWorkerResponse>) => void) | null;
  onerror: ((event: ErrorEvent) => void) | null;
  onmessageerror: ((event: MessageEvent<unknown>) => void) | null;
  postMessage(message: StarTileWorkerRequest): void;
  terminate(): void;
}

export interface StarTileWorkerLoaderOptions {
  readonly createWorker?: () => StarTileWorkerPort;
  readonly loadIndexOnMainThread?: typeof loadStarTileIndexSource;
  readonly loadPackOnMainThread?: typeof loadStarClusterTilePackSource;
}

export function loadStarTileIndexOffThread(
  source: StarTileSource,
  options: StarTileWorkerLoaderOptions = {},
): Promise<StarTileIndex> {
  const fallback = options.loadIndexOnMainThread ?? loadStarTileIndexSource;

  return loadOffThread<
    Extract<StarTileWorkerResponse, { readonly type: 'star-tile-index-loaded' }>,
    StarTileIndex
  >(
    { type: 'load-star-tile-index', source },
    'star-tile-index-loaded',
    (response) => response.index,
    () => fallback(source),
    options.createWorker,
  );
}

export function loadStarClusterTilePackOffThread(
  source: StarTilePackSource,
  options: StarTileWorkerLoaderOptions = {},
): Promise<StarClusterTilePack> {
  const fallback = options.loadPackOnMainThread ?? loadStarClusterTilePackSource;

  return loadOffThread<
    Extract<StarTileWorkerResponse, { readonly type: 'star-tile-pack-loaded' }>,
    StarClusterTilePack
  >(
    { type: 'load-star-tile-pack', source },
    'star-tile-pack-loaded',
    (response) => response.pack,
    () => fallback(source),
    options.createWorker,
  );
}

type LoadedResponse = Exclude<StarTileWorkerResponse, { readonly type: 'star-tile-error' }>;

function loadOffThread<Response extends LoadedResponse, Result>(
  request: StarTileWorkerRequest,
  expectedType: Response['type'],
  readResult: (response: Response) => Result,
  fallback: () => Promise<Result>,
  workerFactory: (() => StarTileWorkerPort) | undefined,
): Promise<Result> {
  const createWorker = workerFactory ?? defaultWorkerFactory();

  if (!createWorker) {
    return fallback();
  }
  let worker: StarTileWorkerPort;

  try {
    worker = createWorker();
  } catch {
    return fallback();
  }

  return new Promise((resolve, reject) => {
    let settled = false;
    const cleanup = (): void => {
      worker.onmessage = null;
      worker.onerror = null;
      worker.onmessageerror = null;
      worker.terminate();
    };
    const settle = (action: () => void): void => {
      if (settled) {
        return;
      }
      settled = true;
      cleanup();
      action();
    };
    const useFallback = (): void => {
      settle(() => {
        void fallback().then(resolve, reject);
      });
    };

    worker.onmessage = (event) => {
      settle(() => {
        const response = event.data;

        if (response.type === 'star-tile-error') {
          reject(new Error(response.message));

          return;
        }
        if (response.type !== expectedType) {
          reject(new Error('Réponse inattendue du Worker de tuiles stellaires.'));

          return;
        }
        resolve(readResult(response as Response));
      });
    };
    worker.onerror = useFallback;
    worker.onmessageerror = useFallback;

    try {
      worker.postMessage(request);
    } catch {
      useFallback();
    }
  });
}

function defaultWorkerFactory(): (() => StarTileWorkerPort) | null {
  if (typeof Worker === 'undefined') {
    return null;
  }

  return () =>
    new Worker(new URL('./star-tile.worker', import.meta.url), {
      type: 'module',
      name: 'universe-map-star-tile-decoder',
    });
}
