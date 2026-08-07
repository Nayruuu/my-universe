import type { SpaceObject, SpaceTileIndex } from '../../data/models/universe.models';

export function assertUniqueAssetIds(objects: readonly SpaceObject[]): void {
  const ids = new Set<string>();

  for (const object of objects) {
    if (ids.has(object.id)) {
      throw new Error(`Identifiant astronomique dupliqué : ${object.id}.`);
    }
    ids.add(object.id);
  }
}

export function assertValidAssetParents(objects: readonly SpaceObject[]): void {
  const ids = new Set(objects.map((object) => object.id));

  for (const object of objects) {
    if (object.parentId && !ids.has(object.parentId)) {
      throw new Error(`Parent ${object.parentId} introuvable pour ${object.id}.`);
    }
  }
}

export function assertTileIdsAreDeferred(
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
