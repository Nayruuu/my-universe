import {
  type ConstellationCatalog,
  type SpaceObject,
  type SpaceTileIndex,
  type StarTileSource,
  type TempelFilamentSpineSource,
} from '../../data/models/universe.models';
import { assertConstellationCatalogReferences } from '../../data/validation/constellation-catalog';
import { parseManifest, parseUniverseDataset } from '../../data/validation/dataset-validator';
import { assertLocalGroupCatalogCoordinates } from '../../data/validation/local-group-catalog';
import {
  assertTileIdsAreDeferred,
  assertUniqueAssetIds,
  assertValidAssetParents,
} from './asset-assembly-validation';
import {
  loadConstellationCatalog,
  loadOptionalStarCatalog,
  loadSpaceTileIndex,
} from './asset-catalog-loaders';
import type { CosmicGroupCatalog } from './cosmic-group-catalog';
import type { CosmicStructureCatalog } from './cosmic-structure-catalog';
import type { CosmicWebVolume } from './cosmic-web-volume';
import {
  createDeferredUniverseCatalogLoader,
  EMPTY_DEFERRED_UNIVERSE_CATALOGS,
  type DeferredUniverseCatalogLoader,
} from './deferred-universe-catalog-loader';
import type { ExoplanetCatalog } from './exoplanet-catalog';
import type { StarCatalog } from './star-catalog';

export interface LoadedUniverseAssets {
  readonly objects: SpaceObject[];
  readonly starCatalog: StarCatalog | null;
  readonly cosmicGroupCatalog: CosmicGroupCatalog | null;
  readonly cosmicStructureCatalog: CosmicStructureCatalog | null;
  readonly cosmicWebVolume: CosmicWebVolume | null;
  readonly exoplanetCatalog: ExoplanetCatalog | null;
  readonly constellationCatalog: ConstellationCatalog | null;
  readonly spaceTileIndex: SpaceTileIndex | null;
  readonly starTileSource: StarTileSource | null;
  readonly tempelFilamentSpineSource: TempelFilamentSpineSource | null;
  readonly loadDeferredCatalogs?: DeferredUniverseCatalogLoader | null;
  readonly warnings: readonly string[];
}

export class AssetLoader {
  public async loadAssets(manifestUrl = '/data/manifest.json'): Promise<LoadedUniverseAssets> {
    return this.load(manifestUrl, false);
  }

  public async loadInitialAssets(
    manifestUrl = '/data/manifest.json',
  ): Promise<LoadedUniverseAssets> {
    return this.load(manifestUrl, true);
  }

  private async load(
    manifestUrl: string,
    deferDistantCatalogs: boolean,
  ): Promise<LoadedUniverseAssets> {
    const manifestResponse = await fetch(manifestUrl);

    if (!manifestResponse.ok) {
      throw new Error(`Impossible de charger le manifest (${manifestResponse.status}).`);
    }

    const manifest = parseManifest(await manifestResponse.json());
    const jsonDatasets = manifest.datasets.filter((dataset) => dataset.type === 'json');
    const binaryDataset = manifest.datasets.find((dataset) => dataset.type === 'binary');
    const tileIndexDataset = manifest.datasets.find(
      (dataset) => dataset.type === 'space-tile-index',
    );
    const constellationDataset = manifest.datasets.find(
      (dataset) => dataset.type === 'constellation-lines',
    );
    const starTileDataset = manifest.datasets.find((dataset) => dataset.type === 'star-tile-index');
    const tempelFilamentSpineDataset = manifest.datasets.find(
      (dataset) => dataset.type === 'tempel-filament-spine-catalog',
    );
    const deferredCatalogLoader = createDeferredUniverseCatalogLoader(manifest.datasets);
    const [loadedDatasets, catalogResult, distantCatalogs, spaceTileIndex, constellationCatalog] =
      await Promise.all([
        Promise.all(
          jsonDatasets.map(async (dataset) => {
            const response = await fetch(dataset.url);

            if (!response.ok) {
              throw new Error(`Impossible de charger ${dataset.id} (${response.status}).`);
            }

            return parseUniverseDataset(await response.json(), dataset.id);
          }),
        ),
        binaryDataset
          ? loadOptionalStarCatalog(binaryDataset.id, binaryDataset.url)
          : Promise.resolve({ value: null, warnings: [] }),
        !deferDistantCatalogs && deferredCatalogLoader
          ? deferredCatalogLoader()
          : Promise.resolve(EMPTY_DEFERRED_UNIVERSE_CATALOGS),
        tileIndexDataset
          ? loadSpaceTileIndex(tileIndexDataset.id, tileIndexDataset.url)
          : Promise.resolve(null),
        constellationDataset
          ? loadConstellationCatalog(constellationDataset.id, constellationDataset.url)
          : Promise.resolve(null),
      ]);
    const objects = loadedDatasets.flatMap((dataset) => dataset.objects);

    assertUniqueAssetIds(objects);
    assertValidAssetParents(objects);
    assertLocalGroupCatalogCoordinates(objects);
    assertTileIdsAreDeferred(objects, spaceTileIndex);
    if (constellationCatalog && catalogResult.value) {
      assertConstellationCatalogReferences(constellationCatalog, catalogResult.value.catalogIds);
    }

    return {
      objects,
      starCatalog: catalogResult.value,
      cosmicGroupCatalog: distantCatalogs.cosmicGroupCatalog,
      cosmicStructureCatalog: distantCatalogs.cosmicStructureCatalog,
      cosmicWebVolume: distantCatalogs.cosmicWebVolume,
      exoplanetCatalog: distantCatalogs.exoplanetCatalog,
      constellationCatalog,
      spaceTileIndex,
      starTileSource: starTileDataset
        ? {
            id: starTileDataset.id,
            url: starTileDataset.url,
            starCatalogId: starTileDataset.starCatalogId,
          }
        : null,
      tempelFilamentSpineSource: tempelFilamentSpineDataset
        ? {
            id: tempelFilamentSpineDataset.id,
            url: tempelFilamentSpineDataset.url,
          }
        : null,
      loadDeferredCatalogs: deferDistantCatalogs ? deferredCatalogLoader : null,
      warnings: [...catalogResult.warnings, ...distantCatalogs.warnings],
    };
  }
}
