import {
  loadDeferredUniverseCatalogs,
  type LoadedDeferredUniverseCatalogs,
} from './deferred-universe-catalog-load';
import type {
  DeferredUniverseCatalogWorkerRequest,
  DeferredUniverseCatalogWorkerResponse,
} from './deferred-universe-catalog-worker-protocol';

export type DeferredUniverseCatalogMainThreadLoader = (
  datasets: DeferredUniverseCatalogWorkerRequest['datasets'],
) => Promise<LoadedDeferredUniverseCatalogs>;

export async function handleDeferredUniverseCatalogWorkerRequest(
  request: DeferredUniverseCatalogWorkerRequest,
  loadCatalogs: DeferredUniverseCatalogMainThreadLoader = loadDeferredUniverseCatalogs,
): Promise<DeferredUniverseCatalogWorkerResponse> {
  try {
    return {
      type: 'deferred-universe-catalogs-loaded',
      catalogs: await loadCatalogs(request.datasets),
    };
  } catch (error) {
    return {
      type: 'deferred-universe-catalogs-error',
      message: error instanceof Error ? error.message : 'erreur inconnue',
    };
  }
}
