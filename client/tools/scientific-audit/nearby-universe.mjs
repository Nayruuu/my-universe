import {
  addAnomaly,
  equatorialCartesian,
  isPositiveFinite,
  readJson,
  relativeDifference,
} from './shared.mjs';

const EXPECTED_GALAXY_COUNT = 720;
const DISTANCE_TOLERANCE = 0.000_25;
const POSITION_TOLERANCE_MPC = 0.002;

export async function auditNearbyUniverse(dataRoot, anomalies) {
  const index = await readJson(dataRoot, 'tiles/nearby-universe/index.json');
  const tiles = await Promise.all(
    index.tiles.map(async (tile) => ({
      definition: tile,
      objects: (await readJson(dataRoot, stripDataPrefix(tile.url))).objects,
    })),
  );
  const objects = tiles.flatMap((tile) => tile.objects);
  const indexedIds = new Set(index.tiles.flatMap((tile) => tile.objectIds));
  const payloadIds = new Set(objects.map((object) => object.id));
  let maximumRelativeDistanceError = 0;
  let maximumCoordinateDeviationMpc = 0;

  auditCardinality(indexedIds, payloadIds, objects, anomalies);
  for (const tile of tiles) {
    auditTile(tile, anomalies);
    for (const object of tile.objects) {
      const measurements = auditGalaxy(object, anomalies);

      maximumRelativeDistanceError = Math.max(
        maximumRelativeDistanceError,
        measurements.relativeDistanceError,
      );
      maximumCoordinateDeviationMpc = Math.max(
        maximumCoordinateDeviationMpc,
        measurements.coordinateDeviationMpc,
      );
    }
  }

  return {
    tiles: tiles.length,
    objects: objects.length,
    maximumRelativeDistanceError,
    maximumCoordinateDeviationMpc,
  };
}

function auditCardinality(indexedIds, payloadIds, objects, anomalies) {
  if (
    indexedIds.size !== EXPECTED_GALAXY_COUNT ||
    payloadIds.size !== EXPECTED_GALAXY_COUNT ||
    objects.length !== EXPECTED_GALAXY_COUNT
  ) {
    addAnomaly(
      anomalies,
      'nearby-universe',
      'index',
      `cardinality mismatch: index=${indexedIds.size}, objects=${payloadIds.size}, rows=${objects.length}`,
    );
  }
  for (const id of indexedIds) {
    if (!payloadIds.has(id)) {
      addAnomaly(anomalies, 'nearby-universe', id, 'indexed object is absent from tile payloads');
    }
  }
}

function auditTile(tile, anomalies) {
  const declaredIds = new Set(tile.definition.objectIds);
  const payloadIds = new Set(tile.objects.map((object) => object.id));

  if (declaredIds.size !== payloadIds.size || [...declaredIds].some((id) => !payloadIds.has(id))) {
    addAnomaly(
      anomalies,
      'nearby-universe',
      tile.definition.id,
      'tile payload differs from its index declaration',
    );
  }
}

function auditGalaxy(object, anomalies) {
  const provider = object.positionProvider;
  const distanceMpc = object.metadata?.distanceMpc;
  const rightAscension = object.metadata?.rightAscensionDegrees;
  const declination = object.metadata?.declinationDegrees;

  if (
    provider.type !== 'static' ||
    provider.unit !== 'megaparsec' ||
    !isPositiveFinite(distanceMpc) ||
    !Number.isFinite(rightAscension) ||
    !Number.isFinite(declination)
  ) {
    addAnomaly(
      anomalies,
      'nearby-universe',
      object.id,
      'incomplete scientific coordinate contract',
    );
    return { relativeDistanceError: 1, coordinateDeviationMpc: Number.POSITIVE_INFINITY };
  }
  const measuredDistance = Math.hypot(...provider.position);
  const relativeDistanceError = relativeDifference(measuredDistance, distanceMpc);
  const expected = equatorialCartesian(distanceMpc, rightAscension, declination);
  const coordinateDeviationMpc = Math.hypot(
    provider.position[0] - expected[0],
    provider.position[1] - expected[1],
    provider.position[2] - expected[2],
  );

  if (relativeDistanceError > DISTANCE_TOLERANCE) {
    addAnomaly(anomalies, 'nearby-universe', object.id, 'distance differs from metadata');
  }
  if (coordinateDeviationMpc > POSITION_TOLERANCE_MPC) {
    addAnomaly(anomalies, 'nearby-universe', object.id, 'J2000 coordinate deviation');
  }

  return { relativeDistanceError, coordinateDeviationMpc };
}

function stripDataPrefix(url) {
  return url.replace(/^\/data\//u, '').split('?')[0];
}
