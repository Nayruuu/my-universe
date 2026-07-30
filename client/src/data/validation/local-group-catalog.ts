import { SpaceObject, Vector3Like } from '../models/universe.models';

interface GalacticCatalogCoordinates {
  distanceKpc: number;
  longitudeDegrees: number;
  latitudeDegrees: number;
}

const DEFAULT_POSITION_TOLERANCE_KPC = 0.75;

export function galacticCoordinatesToCartesian(
  distanceKpc: number,
  longitudeDegrees: number,
  latitudeDegrees: number,
): Vector3Like {
  const longitude = (longitudeDegrees * Math.PI) / 180;
  const latitude = (latitudeDegrees * Math.PI) / 180;
  const projectedDistance = distanceKpc * Math.cos(latitude);

  return {
    x: projectedDistance * Math.cos(longitude),
    y: distanceKpc * Math.sin(latitude),
    z: projectedDistance * Math.sin(longitude),
  };
}

export function assertLocalGroupCatalogCoordinates(
  objects: readonly SpaceObject[],
  toleranceKpc = DEFAULT_POSITION_TOLERANCE_KPC,
): void {
  const objectsById = new Map(objects.map((object) => [object.id, object]));
  const resolvedPositions = new Map<string, Vector3Like>();

  for (const object of objects) {
    const catalogCoordinates = readCatalogCoordinates(object);

    if (!catalogCoordinates) {
      continue;
    }
    const actual = resolvePosition(object, objectsById, resolvedPositions);
    const expected = galacticCoordinatesToCartesian(
      catalogCoordinates.distanceKpc,
      catalogCoordinates.longitudeDegrees,
      catalogCoordinates.latitudeDegrees,
    );
    const deviation = Math.hypot(
      actual.x - expected.x,
      actual.y - expected.y,
      actual.z - expected.z,
    );

    if (deviation > toleranceKpc) {
      throw new Error(
        `Coordonnées galactiques incohérentes pour ${object.id} : écart de ${deviation.toFixed(3)} kpc.`,
      );
    }
  }
}

function readCatalogCoordinates(object: SpaceObject): GalacticCatalogCoordinates | null {
  const distanceKpc = object.metadata?.['distanceKpc'];
  const longitudeDegrees = object.metadata?.['galacticLongitudeDegrees'];
  const latitudeDegrees = object.metadata?.['galacticLatitudeDegrees'];

  if (
    object.type !== 'galaxy' ||
    object.referenceFrame !== 'local-group' ||
    typeof distanceKpc !== 'number' ||
    typeof longitudeDegrees !== 'number' ||
    typeof latitudeDegrees !== 'number'
  ) {
    return null;
  }

  return {
    distanceKpc,
    longitudeDegrees,
    latitudeDegrees,
  };
}

function resolvePosition(
  object: SpaceObject,
  objectsById: ReadonlyMap<string, SpaceObject>,
  resolvedPositions: Map<string, Vector3Like>,
): Vector3Like {
  const cached = resolvedPositions.get(object.id);

  if (cached) {
    return cached;
  }
  const provider = object.positionProvider;

  if (provider.type !== 'static' || provider.unit !== 'kiloparsec') {
    throw new Error(`Position galactique statique en kiloparsecs requise pour ${object.id}.`);
  }
  const parent = object.parentId ? objectsById.get(object.parentId) : undefined;
  const parentPosition =
    parent?.referenceFrame === 'local-group'
      ? resolvePosition(parent, objectsById, resolvedPositions)
      : { x: 0, y: 0, z: 0 };
  const position = {
    x: parentPosition.x + provider.position[0],
    y: parentPosition.y + provider.position[1],
    z: parentPosition.z + provider.position[2],
  };

  resolvedPositions.set(object.id, position);

  return position;
}
