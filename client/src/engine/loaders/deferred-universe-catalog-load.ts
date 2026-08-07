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

export interface DeferredCatalogDatasets {
  readonly cosmicGroup: Extract<DatasetManifestEntry, { type: 'cosmic-group-catalog' }> | undefined;
  readonly cosmicStructure:
    Extract<DatasetManifestEntry, { type: 'cosmic-structure-catalog' }> | undefined;
  readonly cosmicWebVolume:
    Extract<DatasetManifestEntry, { type: 'cosmic-web-volume' }> | undefined;
  readonly exoplanets: Extract<DatasetManifestEntry, { type: 'exoplanet-catalog' }> | undefined;
}

export async function loadDeferredUniverseCatalogs(
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
