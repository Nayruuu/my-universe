import type { LoadedDeferredUniverseCatalogs } from './deferred-universe-catalog-load';
import { handleDeferredUniverseCatalogWorkerRequest } from './deferred-universe-catalog-worker-handler';
import type { DeferredUniverseCatalogWorkerRequest } from './deferred-universe-catalog-worker-protocol';

describe('handleDeferredUniverseCatalogWorkerRequest', () => {
  const request: DeferredUniverseCatalogWorkerRequest = {
    type: 'load-deferred-universe-catalogs',
    datasets: {
      cosmicGroup: undefined,
      cosmicStructure: undefined,
      cosmicWebVolume: undefined,
      exoplanets: undefined,
    },
  };

  it('renvoie les catalogues décodés avec un discriminant sérialisable', async () => {
    const catalogs = emptyCatalogs();
    const loadCatalogs = vi.fn(async () => catalogs);

    await expect(
      handleDeferredUniverseCatalogWorkerRequest(request, loadCatalogs),
    ).resolves.toEqual({
      type: 'deferred-universe-catalogs-loaded',
      catalogs,
    });
    expect(loadCatalogs).toHaveBeenCalledWith(request.datasets);
  });

  it('sérialise le message d’une erreur de chargement', async () => {
    const loadCatalogs = vi.fn(async () => {
      throw new Error('catalogue invalide');
    });

    await expect(
      handleDeferredUniverseCatalogWorkerRequest(request, loadCatalogs),
    ).resolves.toEqual({
      type: 'deferred-universe-catalogs-error',
      message: 'catalogue invalide',
    });
  });

  it('normalise une erreur inconnue avant de traverser la frontière du Worker', async () => {
    const loadCatalogs = vi.fn(async () => {
      throw 'échec sans Error';
    });

    await expect(
      handleDeferredUniverseCatalogWorkerRequest(request, loadCatalogs),
    ).resolves.toEqual({
      type: 'deferred-universe-catalogs-error',
      message: 'erreur inconnue',
    });
  });
});

function emptyCatalogs(): LoadedDeferredUniverseCatalogs {
  return {
    cosmicGroupCatalog: null,
    cosmicStructureCatalog: null,
    cosmicWebVolume: null,
    exoplanetCatalog: null,
    warnings: [],
  };
}
