import {
  loadDeferredUniverseCatalogs,
  type DeferredCatalogDatasets,
  type LoadedDeferredUniverseCatalogs,
} from './deferred-universe-catalog-load';
import type {
  DeferredUniverseCatalogWorkerRequest,
  DeferredUniverseCatalogWorkerResponse,
} from './deferred-universe-catalog-worker-protocol';

export interface DeferredUniverseCatalogWorkerPort {
  onmessage: ((event: MessageEvent<DeferredUniverseCatalogWorkerResponse>) => void) | null;
  onerror: ((event: ErrorEvent) => void) | null;
  onmessageerror: ((event: MessageEvent<unknown>) => void) | null;
  postMessage(message: DeferredUniverseCatalogWorkerRequest): void;
  terminate(): void;
}

export interface DeferredUniverseCatalogWorkerLoaderOptions {
  readonly createWorker?: () => DeferredUniverseCatalogWorkerPort;
  readonly loadOnMainThread?: (
    datasets: DeferredCatalogDatasets,
  ) => Promise<LoadedDeferredUniverseCatalogs>;
}

export function loadDeferredUniverseCatalogsOffThread(
  datasets: DeferredCatalogDatasets,
  options: DeferredUniverseCatalogWorkerLoaderOptions = {},
): Promise<LoadedDeferredUniverseCatalogs> {
  const loadOnMainThread = options.loadOnMainThread ?? loadDeferredUniverseCatalogs;
  const createWorker = options.createWorker ?? defaultWorkerFactory();
  const loadFallback = (): Promise<LoadedDeferredUniverseCatalogs> => loadOnMainThread(datasets);

  if (!createWorker) {
    return loadFallback();
  }
  let worker: DeferredUniverseCatalogWorkerPort;

  try {
    worker = createWorker();
  } catch {
    return loadFallback();
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
    const fallback = (): void => {
      settle(() => {
        void loadFallback().then(resolve, reject);
      });
    };

    worker.onmessage = (event) => {
      settle(() => {
        const response = event.data;

        if (response.type === 'deferred-universe-catalogs-loaded') {
          resolve(response.catalogs);
        } else {
          reject(new Error(response.message));
        }
      });
    };
    worker.onerror = fallback;
    worker.onmessageerror = fallback;

    try {
      worker.postMessage({ type: 'load-deferred-universe-catalogs', datasets });
    } catch {
      fallback();
    }
  });
}

function defaultWorkerFactory(): (() => DeferredUniverseCatalogWorkerPort) | null {
  if (typeof Worker === 'undefined') {
    return null;
  }

  return () =>
    new Worker(new URL('./deferred-universe-catalog.worker', import.meta.url), {
      type: 'module',
      name: 'universe-map-deferred-catalog-decoder',
    });
}
