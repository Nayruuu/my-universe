import { SpaceObject, Vector3Like } from '../models/universe.models';

interface EquatorialCatalogCoordinates {
  distanceMpc: number;
  rightAscensionDegrees: number;
  declinationDegrees: number;
}

const DEFAULT_POSITION_TOLERANCE_MPC = 0.002;

export function equatorialCoordinatesToCartesian(
  distanceMpc: number,
  rightAscensionDegrees: number,
  declinationDegrees: number,
): Vector3Like {
  const rightAscension = (rightAscensionDegrees * Math.PI) / 180;
  const declination = (declinationDegrees * Math.PI) / 180;
  const projectedDistance = distanceMpc * Math.cos(declination);

  return {
    x: projectedDistance * Math.cos(rightAscension),
    y: distanceMpc * Math.sin(declination),
    z: projectedDistance * Math.sin(rightAscension),
  };
}

export function distanceModulusToMegaparsecs(distanceModulus: number): number {
  return 10 ** ((distanceModulus - 25) / 5);
}

export function assertNearbyUniverseCatalogCoordinates(
  objects: readonly SpaceObject[],
  toleranceMpc = DEFAULT_POSITION_TOLERANCE_MPC,
): void {
  for (const object of objects) {
    const catalogCoordinates = readCatalogCoordinates(object);

    if (!catalogCoordinates) {
      continue;
    }
    const provider = object.positionProvider;

    if (provider.type !== 'static' || provider.unit !== 'megaparsec') {
      throw new Error(`Position équatoriale statique en mégaparsecs requise pour ${object.id}.`);
    }
    const expected = equatorialCoordinatesToCartesian(
      catalogCoordinates.distanceMpc,
      catalogCoordinates.rightAscensionDegrees,
      catalogCoordinates.declinationDegrees,
    );
    const deviation = Math.hypot(
      provider.position[0] - expected.x,
      provider.position[1] - expected.y,
      provider.position[2] - expected.z,
    );

    if (deviation > toleranceMpc) {
      throw new Error(
        `Coordonnées équatoriales incohérentes pour ${object.id} : écart de ${deviation.toFixed(4)} Mpc.`,
      );
    }
  }
}

function readCatalogCoordinates(object: SpaceObject): EquatorialCatalogCoordinates | null {
  const distanceMpc = object.metadata?.['distanceMpc'];
  const rightAscensionDegrees = object.metadata?.['rightAscensionDegrees'];
  const declinationDegrees = object.metadata?.['declinationDegrees'];

  if (
    object.type !== 'galaxy' ||
    object.referenceFrame !== 'nearby-universe' ||
    typeof distanceMpc !== 'number' ||
    typeof rightAscensionDegrees !== 'number' ||
    typeof declinationDegrees !== 'number'
  ) {
    return null;
  }

  return {
    distanceMpc,
    rightAscensionDegrees,
    declinationDegrees,
  };
}
