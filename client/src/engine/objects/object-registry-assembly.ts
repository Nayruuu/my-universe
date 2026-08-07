import type { SpaceObject } from '../../data/models/universe.models';

export interface ObjectRegistryAssemblyPlan {
  readonly renderableObjects: readonly SpaceObject[];
  readonly farObjects: readonly SpaceObject[];
  readonly farIndexById: ReadonlyMap<string, number>;
  readonly renderParentById: ReadonlyMap<string, string | null>;
  readonly batchedGalaxyTotal: number;
}

export function createObjectRegistryAssemblyPlan(
  objects: readonly SpaceObject[],
): ObjectRegistryAssemblyPlan {
  const renderableObjects = objects.filter(isIndividuallyRenderable);
  const farObjects = renderableObjects.filter(usesFarPointBatch);
  const farIndexById = new Map(farObjects.map((object, index) => [object.id, index] as const));
  const renderableIds = new Set(renderableObjects.map((object) => object.id));
  const sunAvailable = renderableIds.has('sun');
  const renderParentById = new Map<string, string | null>();

  for (const object of renderableObjects) {
    const semanticParent =
      object.parentId && renderableIds.has(object.parentId) ? object.parentId : null;
    const renderParent =
      object.referenceFrame === 'stellar' && object.parentId === 'milky-way' && sunAvailable
        ? 'sun'
        : semanticParent;

    renderParentById.set(object.id, renderParent);
  }

  return {
    renderableObjects,
    farObjects,
    farIndexById,
    renderParentById,
    batchedGalaxyTotal: farObjects.filter((object) => object.type === 'galaxy').length,
  };
}

function isIndividuallyRenderable(object: SpaceObject): boolean {
  return (
    object.positionProvider.type !== 'catalog' &&
    object.metadata?.['catalogPointRepresentation'] !== true
  );
}

function usesFarPointBatch(object: SpaceObject): boolean {
  return (
    object.type !== 'region' &&
    object.type !== 'black-hole' &&
    (object.type !== 'galaxy' || object.metadata?.['nearbyUniversePointBatch'] === true)
  );
}
