import {
  SearchEntry,
  SpaceObject,
  SpaceTileIndex,
  SpaceTileIndexEntry,
} from '../../data/models/universe.models';
import { assertNearbyUniverseCatalogCoordinates } from '../../data/validation/nearby-universe-catalog';
import { parseUniverseDataset } from '../../data/validation/dataset-validator';
import { CoordinateSystem } from '../coordinates/coordinate-system';
import { convertDistance } from '../coordinates/unit-conversion';
import {
  createSpaceTileRenderNodes,
  selectSpaceTileIds,
  type SpaceTileRenderNode,
  type SpaceTileView,
} from './space-tile-selection';

type SpaceTileFetcher = (url: string) => Promise<Response>;

export class SpaceTileManager {
  private readonly tileById = new Map<string, SpaceTileIndexEntry>();
  private readonly tileIdByObjectId = new Map<string, string>();
  private readonly cachedObjectsByTileId = new Map<string, readonly SpaceObject[]>();
  private readonly loadedTileIds = new Set<string>();
  private readonly renderNodes: readonly SpaceTileRenderNode[];

  constructor(
    private readonly index: SpaceTileIndex,
    private readonly fetcher: SpaceTileFetcher = (url) => fetch(url),
    coordinateSystem: CoordinateSystem = new CoordinateSystem(),
  ) {
    for (const tile of index.tiles) {
      this.tileById.set(tile.id, tile);
      for (const objectId of tile.objectIds) {
        this.tileIdByObjectId.set(objectId, tile.id);
      }
    }
    this.renderNodes = createSpaceTileRenderNodes(index, (position, unit, frame, target) => {
      const projected = coordinateSystem.toRenderPosition(position, unit, frame);

      return target.set(projected.x, projected.y, projected.z);
    });
  }

  public get searchEntries(): readonly SearchEntry[] {
    return this.index.searchEntries;
  }

  public get loadedObjects(): readonly SpaceObject[] {
    return this.index.tiles.flatMap((tile) =>
      this.loadedTileIds.has(tile.id) ? [...this.cachedObjectsByTileId.get(tile.id)!] : [],
    );
  }

  public get loadedTileCount(): number {
    return this.loadedTileIds.size;
  }

  public get cachedTileCount(): number {
    return this.cachedObjectsByTileId.size;
  }

  public get indexedTileCount(): number {
    return this.index.tiles.length;
  }

  public hasObject(objectId: string): boolean {
    return this.tileIdByObjectId.has(objectId);
  }

  public async ensureObject(objectId: string): Promise<boolean> {
    const tileId = this.tileIdByObjectId.get(objectId);

    if (!tileId) {
      return false;
    }
    await this.loadTile(tileId);

    return true;
  }

  public async synchronize(
    view: SpaceTileView,
    retainedObjectIds: readonly string[] = [],
  ): Promise<boolean> {
    const retainedTileIds = retainedObjectIds
      .map((objectId) => this.tileIdByObjectId.get(objectId))
      .filter((tileId): tileId is string => tileId !== undefined);
    const desiredTileIds = new Set(selectSpaceTileIds(this.renderNodes, view, retainedTileIds));
    let changed = false;

    for (const tile of this.index.tiles) {
      if (desiredTileIds.has(tile.id) && !this.loadedTileIds.has(tile.id)) {
        await this.loadTile(tile.id);
        changed = true;
      }
    }
    for (const tileId of [...this.loadedTileIds]) {
      if (!desiredTileIds.has(tileId)) {
        this.loadedTileIds.delete(tileId);
        changed = true;
      }
    }

    return changed;
  }

  private async loadTile(tileId: string): Promise<void> {
    if (this.loadedTileIds.has(tileId)) {
      return;
    }
    const tile = this.tileById.get(tileId);

    if (!tile) {
      throw new Error(`Tuile spatiale inconnue : ${tileId}.`);
    }
    let objects = this.cachedObjectsByTileId.get(tileId);

    if (!objects) {
      const response = await this.fetcher(tile.url);

      if (!response.ok) {
        throw new Error(`Impossible de charger la tuile ${tile.id} (${response.status}).`);
      }
      objects = parseUniverseDataset(await response.json(), tile.id).objects;
      validateTileObjects(tile, objects);
      this.cachedObjectsByTileId.set(tileId, objects);
    }
    this.loadedTileIds.add(tileId);
  }
}

function validateTileObjects(tile: SpaceTileIndexEntry, objects: readonly SpaceObject[]): void {
  const expectedIds = new Set(tile.objectIds);
  const actualIds = new Set(objects.map((object) => object.id));

  if (
    actualIds.size !== expectedIds.size ||
    [...actualIds].some((objectId) => !expectedIds.has(objectId))
  ) {
    throw new Error(`Objets inattendus dans la tuile ${tile.id}.`);
  }

  for (const object of objects) {
    if (object.referenceFrame !== tile.referenceFrame) {
      throw new Error(`Référentiel incohérent pour ${object.id}.`);
    }
    const provider = object.positionProvider;

    if (provider.type !== 'static') {
      throw new Error(`Position statique requise pour ${object.id}.`);
    }
    const position = provider.position.map((coordinate) =>
      convertDistance(coordinate, provider.unit, tile.bounds.unit),
    );

    if (
      position.some(
        (coordinate, index) =>
          coordinate < tile.bounds.min[index]! || coordinate > tile.bounds.max[index]!,
      )
    ) {
      throw new Error(`Objet ${object.id} hors des limites de la tuile ${tile.id}.`);
    }
  }

  assertNearbyUniverseCatalogCoordinates(objects);
}
