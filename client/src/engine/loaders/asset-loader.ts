import { SpaceObject } from '../../data/models/universe.models';
import { parseManifest, parseUniverseDataset } from '../../data/validation/dataset-validator';
import { parseStarCatalog, StarCatalog } from './star-catalog';

export interface LoadedUniverseAssets {
  readonly objects: SpaceObject[];
  readonly starCatalog: StarCatalog | null;
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
    const [loadedDatasets, catalogResult] = await Promise.all([
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
    ]);
    const objects = loadedDatasets.flatMap((dataset) => dataset.objects);

    assertUniqueIds(objects);
    assertValidParents(objects);

    return {
      objects,
      starCatalog: catalogResult.catalog,
      warnings: catalogResult.warnings,
    };
  }
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
