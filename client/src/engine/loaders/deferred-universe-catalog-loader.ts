import type { DatasetManifestEntry } from '../../data/models/universe.models';
import type { LoadedDeferredUniverseCatalogs } from './deferred-universe-catalog-load';
import { loadDeferredUniverseCatalogsOffThread } from './deferred-universe-catalog-worker-loader';

export type { LoadedDeferredUniverseCatalogs } from './deferred-universe-catalog-load';

export type DeferredUniverseCatalogLoader = () => Promise<LoadedDeferredUniverseCatalogs>;

export const EMPTY_DEFERRED_UNIVERSE_CATALOGS: LoadedDeferredUniverseCatalogs = {
  cosmicGroupCatalog: null,
  cosmicStructureCatalog: null,
  cosmicWebVolume: null,
  exoplanetCatalog: null,
  warnings: [],
};

export function createDeferredUniverseCatalogLoader(
  datasets: readonly DatasetManifestEntry[],
): DeferredUniverseCatalogLoader | null {
  const cosmicGroup = findDataset(datasets, 'cosmic-group-catalog');
  const cosmicStructure = findDataset(datasets, 'cosmic-structure-catalog');
  const cosmicWebVolume = findDataset(datasets, 'cosmic-web-volume');
  const exoplanets = findDataset(datasets, 'exoplanet-catalog');

  if (!cosmicGroup && !cosmicStructure && !cosmicWebVolume && !exoplanets) {
    return null;
  }
  let loading: Promise<LoadedDeferredUniverseCatalogs> | null = null;

  return () => {
    loading ??= loadDeferredUniverseCatalogsOffThread({
      cosmicGroup,
      cosmicStructure,
      cosmicWebVolume,
      exoplanets,
    });

    return loading;
  };
}

function findDataset<Type extends DatasetManifestEntry['type']>(
  datasets: readonly DatasetManifestEntry[],
  type: Type,
): Extract<DatasetManifestEntry, { type: Type }> | undefined {
  return datasets.find(
    (dataset): dataset is Extract<DatasetManifestEntry, { type: Type }> => dataset.type === type,
  );
}
