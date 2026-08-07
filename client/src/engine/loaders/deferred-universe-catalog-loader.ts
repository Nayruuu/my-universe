import type { DatasetManifestEntry } from '../../data/models/universe.models';
import {
  loadOptionalCosmicGroupCatalog,
  loadOptionalCosmicStructureCatalog,
  loadOptionalCosmicWebVolume,
  loadOptionalExoplanetCatalog,
} from './asset-catalog-loaders';
import type { CosmicGroupCatalog } from './cosmic-group-catalog';
import type { CosmicStructureCatalog } from './cosmic-structure-catalog';
import type { CosmicWebVolume } from './cosmic-web-volume';
import type { ExoplanetCatalog } from './exoplanet-catalog';

export interface LoadedDeferredUniverseCatalogs {
  readonly cosmicGroupCatalog: CosmicGroupCatalog | null;
  readonly cosmicStructureCatalog: CosmicStructureCatalog | null;
  readonly cosmicWebVolume: CosmicWebVolume | null;
  readonly exoplanetCatalog: ExoplanetCatalog | null;
  readonly warnings: readonly string[];
}

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
    loading ??= loadDeferredUniverseCatalogs({
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

interface DeferredCatalogDatasets {
  readonly cosmicGroup: Extract<DatasetManifestEntry, { type: 'cosmic-group-catalog' }> | undefined;
  readonly cosmicStructure:
    Extract<DatasetManifestEntry, { type: 'cosmic-structure-catalog' }> | undefined;
  readonly cosmicWebVolume:
    Extract<DatasetManifestEntry, { type: 'cosmic-web-volume' }> | undefined;
  readonly exoplanets: Extract<DatasetManifestEntry, { type: 'exoplanet-catalog' }> | undefined;
}

async function loadDeferredUniverseCatalogs(
  datasets: DeferredCatalogDatasets,
): Promise<LoadedDeferredUniverseCatalogs> {
  const [cosmicGroup, cosmicStructure, cosmicWebVolume, exoplanets] = await Promise.all([
    datasets.cosmicGroup
      ? loadOptionalCosmicGroupCatalog(datasets.cosmicGroup.id, datasets.cosmicGroup.url)
      : Promise.resolve({ value: null, warnings: [] }),
    datasets.cosmicStructure
      ? loadOptionalCosmicStructureCatalog(
          datasets.cosmicStructure.id,
          datasets.cosmicStructure.url,
          datasets.cosmicStructure.metadataUrl,
        )
      : Promise.resolve({ value: null, warnings: [] }),
    datasets.cosmicWebVolume
      ? loadOptionalCosmicWebVolume(datasets.cosmicWebVolume.id, datasets.cosmicWebVolume.url)
      : Promise.resolve({ value: null, warnings: [] }),
    datasets.exoplanets
      ? loadOptionalExoplanetCatalog(
          datasets.exoplanets.id,
          datasets.exoplanets.url,
          datasets.exoplanets.metadataUrl,
        )
      : Promise.resolve({ value: null, warnings: [] }),
  ]);

  return {
    cosmicGroupCatalog: cosmicGroup.value,
    cosmicStructureCatalog: cosmicStructure.value,
    cosmicWebVolume: cosmicWebVolume.value,
    exoplanetCatalog: exoplanets.value,
    warnings: [
      ...cosmicGroup.warnings,
      ...cosmicStructure.warnings,
      ...cosmicWebVolume.warnings,
      ...exoplanets.warnings,
    ],
  };
}
