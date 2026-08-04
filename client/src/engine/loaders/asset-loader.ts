import {
  ConstellationCatalog,
  SpaceObject,
  SpaceTileIndex,
  StarTileSource,
} from '../../data/models/universe.models';
import {
  assertConstellationCatalogReferences,
  parseConstellationCatalog,
} from '../../data/validation/constellation-catalog';
import { parseManifest, parseUniverseDataset } from '../../data/validation/dataset-validator';
import { assertLocalGroupCatalogCoordinates } from '../../data/validation/local-group-catalog';
import { parseSpaceTileIndex } from '../../data/validation/space-tile-index';
import { parseStarCatalog, StarCatalog } from './star-catalog';
import { CosmicGroupCatalog, parseCosmicGroupCatalog } from './cosmic-group-catalog';
import {
  CosmicStructureCatalog,
  parseCosmicStructureCatalog,
  parseCosmicStructureCatalogMetadata,
} from './cosmic-structure-catalog';
import { CosmicWebVolume, parseCosmicWebVolume } from './cosmic-web-volume';

export interface LoadedUniverseAssets {
  readonly objects: SpaceObject[];
  readonly starCatalog: StarCatalog | null;
  readonly cosmicGroupCatalog: CosmicGroupCatalog | null;
  readonly cosmicStructureCatalog: CosmicStructureCatalog | null;
  readonly cosmicWebVolume: CosmicWebVolume | null;
  readonly constellationCatalog: ConstellationCatalog | null;
  readonly spaceTileIndex: SpaceTileIndex | null;
  readonly starTileSource: StarTileSource | null;
  readonly warnings: readonly string[];
}

export class AssetLoader {
  public async loadAssets(manifestUrl = '/data/manifest.json'): Promise<LoadedUniverseAssets> {
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
    const cosmicGroupDataset = manifest.datasets.find(
      (dataset) => dataset.type === 'cosmic-group-catalog',
    );
    const cosmicStructureDataset = manifest.datasets.find(
      (dataset) => dataset.type === 'cosmic-structure-catalog',
    );
    const cosmicWebVolumeDataset = manifest.datasets.find(
      (dataset) => dataset.type === 'cosmic-web-volume',
    );
    const [
      loadedDatasets,
      catalogResult,
      cosmicGroupResult,
      cosmicStructureResult,
      cosmicWebVolumeResult,
      spaceTileIndex,
      constellationCatalog,
    ] = await Promise.all([
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
        : Promise.resolve({ catalog: null, warnings: [] }),
      cosmicGroupDataset
        ? loadOptionalCosmicGroupCatalog(cosmicGroupDataset.id, cosmicGroupDataset.url)
        : Promise.resolve({ catalog: null, warnings: [] }),
      cosmicStructureDataset
        ? loadOptionalCosmicStructureCatalog(
            cosmicStructureDataset.id,
            cosmicStructureDataset.url,
            cosmicStructureDataset.metadataUrl,
          )
        : Promise.resolve({ catalog: null, warnings: [] }),
      cosmicWebVolumeDataset
        ? loadOptionalCosmicWebVolume(cosmicWebVolumeDataset.id, cosmicWebVolumeDataset.url)
        : Promise.resolve({ volume: null, warnings: [] }),
      tileIndexDataset
        ? loadSpaceTileIndex(tileIndexDataset.id, tileIndexDataset.url)
        : Promise.resolve(null),
      constellationDataset
        ? loadConstellationCatalog(constellationDataset.id, constellationDataset.url)
        : Promise.resolve(null),
    ]);
    const objects = loadedDatasets.flatMap((dataset) => dataset.objects);

    assertUniqueIds(objects);
    assertValidParents(objects);
    assertLocalGroupCatalogCoordinates(objects);
    assertTileIdsAreDeferred(objects, spaceTileIndex);
    if (constellationCatalog && catalogResult.catalog) {
      assertConstellationCatalogReferences(constellationCatalog, catalogResult.catalog.catalogIds);
    }

    return {
      objects,
      starCatalog: catalogResult.catalog,
      cosmicGroupCatalog: cosmicGroupResult.catalog,
      cosmicStructureCatalog: cosmicStructureResult.catalog,
      cosmicWebVolume: cosmicWebVolumeResult.volume,
      constellationCatalog,
      spaceTileIndex,
      starTileSource: starTileDataset
        ? {
            id: starTileDataset.id,
            url: starTileDataset.url,
            starCatalogId: starTileDataset.starCatalogId,
          }
        : null,
      warnings: [
        ...catalogResult.warnings,
        ...cosmicGroupResult.warnings,
        ...cosmicStructureResult.warnings,
        ...cosmicWebVolumeResult.warnings,
      ],
    };
  }
}

async function loadOptionalCosmicWebVolume(
  datasetId: string,
  url: string,
): Promise<{ volume: CosmicWebVolume | null; warnings: readonly string[] }> {
  try {
    const response = await fetch(url);

    if (!response.ok) {
      throw new Error(`Impossible de charger ${datasetId} (${response.status}).`);
    }

    return {
      volume: parseCosmicWebVolume(await response.arrayBuffer()),
      warnings: [],
    };
  } catch (error) {
    const reason = error instanceof Error ? error.message : 'erreur inconnue';

    return {
      volume: null,
      warnings: [`Volume du réseau cosmique indisponible : ${reason}`],
    };
  }
}

async function loadOptionalCosmicStructureCatalog(
  datasetId: string,
  url: string,
  metadataUrl: string,
): Promise<{ catalog: CosmicStructureCatalog | null; warnings: readonly string[] }> {
  try {
    const metadataResponse = await fetch(metadataUrl);

    if (!metadataResponse.ok) {
      throw new Error(
        `Impossible de charger les métadonnées ${datasetId} (${metadataResponse.status}).`,
      );
    }
    const metadata = parseCosmicStructureCatalogMetadata(await metadataResponse.json(), datasetId);
    const response = await fetch(url);

    if (!response.ok) {
      throw new Error(`Impossible de charger ${datasetId} (${response.status}).`);
    }

    return {
      catalog: parseCosmicStructureCatalog(await response.arrayBuffer(), metadata),
      warnings: [],
    };
  } catch (error) {
    const reason = error instanceof Error ? error.message : 'erreur inconnue';

    return {
      catalog: null,
      warnings: [`Catalogue de structures cosmiques indisponible : ${reason}`],
    };
  }
}

async function loadOptionalCosmicGroupCatalog(
  datasetId: string,
  url: string,
): Promise<{ catalog: CosmicGroupCatalog | null; warnings: readonly string[] }> {
  try {
    const response = await fetch(url);

    if (!response.ok) {
      throw new Error(`Impossible de charger ${datasetId} (${response.status}).`);
    }

    return {
      catalog: parseCosmicGroupCatalog(await response.arrayBuffer()),
      warnings: [],
    };
  } catch (error) {
    const reason = error instanceof Error ? error.message : 'erreur inconnue';

    return {
      catalog: null,
      warnings: [`Catalogue de groupes cosmiques indisponible : ${reason}`],
    };
  }
}

async function loadConstellationCatalog(
  datasetId: string,
  url: string,
): Promise<ConstellationCatalog> {
  const response = await fetch(url);

  if (!response.ok) {
    throw new Error(`Impossible de charger ${datasetId} (${response.status}).`);
  }

  return parseConstellationCatalog(await response.json(), datasetId);
}

async function loadSpaceTileIndex(datasetId: string, url: string): Promise<SpaceTileIndex> {
  const response = await fetch(url);

  if (!response.ok) {
    throw new Error(`Impossible de charger ${datasetId} (${response.status}).`);
  }

  return parseSpaceTileIndex(await response.json(), datasetId);
}

async function loadOptionalStarCatalog(
  datasetId: string,
  url: string,
): Promise<{ catalog: StarCatalog | null; warnings: readonly string[] }> {
  try {
    const response = await fetch(url);

    if (!response.ok) {
      throw new Error(`Impossible de charger ${datasetId} (${response.status}).`);
    }

    return {
      catalog: parseStarCatalog(await response.arrayBuffer()),
      warnings: [],
    };
  } catch (error) {
    const reason = error instanceof Error ? error.message : 'erreur inconnue';

    return {
      catalog: null,
      warnings: [`Catalogue stellaire dense indisponible : ${reason}`],
    };
  }
}

function assertUniqueIds(objects: readonly SpaceObject[]): void {
  const ids = new Set<string>();

  for (const object of objects) {
    if (ids.has(object.id)) {
      throw new Error(`Identifiant astronomique dupliqué : ${object.id}.`);
    }
    ids.add(object.id);
  }
}

function assertValidParents(objects: readonly SpaceObject[]): void {
  const ids = new Set(objects.map((object) => object.id));

  for (const object of objects) {
    if (object.parentId && !ids.has(object.parentId)) {
      throw new Error(`Parent ${object.parentId} introuvable pour ${object.id}.`);
    }
  }
}

function assertTileIdsAreDeferred(
  objects: readonly SpaceObject[],
  spaceTileIndex: SpaceTileIndex | null,
): void {
  if (!spaceTileIndex) {
    return;
  }
  const loadedIds = new Set(objects.map((object) => object.id));

  for (const tile of spaceTileIndex.tiles) {
    for (const objectId of tile.objectIds) {
      if (loadedIds.has(objectId)) {
        throw new Error(`Identifiant tuilé déjà chargé au démarrage : ${objectId}.`);
      }
    }
  }
}
