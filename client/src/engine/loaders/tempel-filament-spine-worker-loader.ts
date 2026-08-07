import {
  type TempelFilamentLoadExecution,
  type TempelFilamentSpineSource,
} from '../../data/models/universe.models';
import {
  loadTempelFilamentSpineCatalogWithMetrics,
  type TempelFilamentSpineCatalog,
  type TempelFilamentSpineCatalogLoadResult,
} from './tempel-filament-spine-catalog';
import { prepareTempelFilamentSpineRenderData } from './tempel-filament-spine-render-data';
import {
  TEMPEL_FILAMENT_SCENE_UNITS_PER_MPC,
  type TempelFilamentSpineWorkerRequest,
  type TempelFilamentSpineWorkerResponse,
} from './tempel-filament-spine-worker-protocol';

export interface TempelFilamentSpineWorkerPort {
  onmessage: ((event: MessageEvent<TempelFilamentSpineWorkerResponse>) => void) | null;
  onerror: ((event: ErrorEvent) => void) | null;
  onmessageerror: ((event: MessageEvent<unknown>) => void) | null;
  postMessage(message: TempelFilamentSpineWorkerRequest): void;
  terminate(): void;
}

export interface TempelFilamentSpineWorkerLoaderOptions {
  readonly createWorker?: () => TempelFilamentSpineWorkerPort;
  readonly loadOnMainThread?: (
    source: TempelFilamentSpineSource,
  ) => Promise<TempelFilamentSpineCatalogLoadResult>;
  readonly onTelemetry?: (telemetry: TempelFilamentSpineLoadTelemetry) => void;
  readonly now?: () => number;
}

export interface TempelFilamentSpineLoadTelemetry {
  readonly execution: TempelFilamentLoadExecution;
  readonly fetchMs: number;
  readonly decodeMs: number;
  readonly workerRoundTripMs: number | null;
}

export function loadTempelFilamentSpineCatalogOffThread(
  source: TempelFilamentSpineSource,
  options: TempelFilamentSpineWorkerLoaderOptions = {},
): Promise<TempelFilamentSpineCatalog> {
  const loadOnMainThread = options.loadOnMainThread ?? loadTempelFilamentSpineCatalogWithMetrics;
  const createWorker = options.createWorker ?? defaultWorkerFactory();
  const now = options.now ?? (() => performance.now());

  const loadFallback = async (): Promise<TempelFilamentSpineCatalog> => {
    const result = await loadOnMainThread(source);
    const catalog = {
      ...result.catalog,
      renderData: prepareTempelFilamentSpineRenderData(
        result.catalog,
        TEMPEL_FILAMENT_SCENE_UNITS_PER_MPC,
      ),
    };

    options.onTelemetry?.({
      execution: 'main-thread-fallback',
      ...result.metrics,
      workerRoundTripMs: null,
    });

    return catalog;
  };

  if (!createWorker) {
    return loadFallback();
  }
  let worker: TempelFilamentSpineWorkerPort;

  try {
    worker = createWorker();
  } catch {
    return loadFallback();
  }
  const workerStartedAt = now();

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

        if (response.type === 'tempel-filament-spines-loaded') {
          options.onTelemetry?.({
            execution: 'worker',
            ...response.metrics,
            workerRoundTripMs: now() - workerStartedAt,
          });
          resolve(response.catalog);
        } else {
          reject(new Error(response.message));
        }
      });
    };
    worker.onerror = fallback;
    worker.onmessageerror = fallback;

    try {
      worker.postMessage({ type: 'load-tempel-filament-spines', source });
    } catch {
      fallback();
    }
  });
}

function defaultWorkerFactory(): (() => TempelFilamentSpineWorkerPort) | null {
  if (typeof Worker === 'undefined') {
    return null;
  }

  return () =>
    new Worker(new URL('./tempel-filament-spine.worker', import.meta.url), {
      type: 'module',
      name: 'universe-map-tempel-decoder',
    });
}
