import {
  addAnomaly,
  fromParsecs,
  isPositiveFinite,
  LIGHT_YEARS_PER_PARSEC,
  PARSECS_PER_KILOPARSEC,
  PARSECS_PER_MEGAPARSEC,
  readJson,
  relativeDifference,
  toParsecs,
} from './shared.mjs';

const CURATED_PATHS = [
  'solar-system/system.json',
  'solar-system/extended.json',
  'stars/nearby-stars.json',
  'exoplanets/featured-systems.json',
  'black-holes/catalog.json',
  'supernovas/catalog.json',
  'galaxies/local-group.json',
];

export async function auditCuratedCatalogs(dataRoot, anomalies) {
  const objects = (
    await Promise.all(CURATED_PATHS.map(async (path) => (await readJson(dataRoot, path)).objects))
  ).flat();
  const objectsById = new Map(objects.map((object) => [object.id, object]));
  const report = {
    objects: objects.length,
    staticPositions: 0,
    documentedDistances: 0,
    orbitalDefinitions: 0,
    visuallyScaledOrbits: 0,
  };

  for (const object of objects) {
    auditObject(object, objectsById, report, anomalies);
  }
  auditGalacticOrigin(objectsById, anomalies);

  return { objects, report };
}

function auditObject(object, objectsById, report, anomalies) {
  const provider = object.positionProvider;

  if (provider.type === 'static') {
    report.staticPositions += 1;
    auditStaticPosition(object, objectsById, report, anomalies);
  }
  if (isOrbitalProvider(provider)) {
    report.orbitalDefinitions += 1;
    if (provider.distanceScale !== undefined && provider.distanceScale !== 1) {
      report.visuallyScaledOrbits += 1;
    }
  }
  if (provider.type === 'keplerian') {
    auditKeplerianOrbit(object, provider, anomalies);
  } else if (provider.type === 'ephemeris') {
    if (!isPositiveFinite(provider.orbitalPeriodDays)) {
      addAnomaly(anomalies, 'curated', object.id, 'invalid ephemeris orbital period');
    }
  } else if (provider.type === 'illustrative-orbit') {
    if (
      !isPositiveFinite(provider.semiMajorAxis) ||
      !isPositiveFinite(provider.orbitalPeriodDays)
    ) {
      addAnomaly(anomalies, 'curated', object.id, 'invalid illustrative orbit');
    }
  }
}

function auditStaticPosition(object, objectsById, report, anomalies) {
  const provider = object.positionProvider;

  if (!provider.position.every(Number.isFinite)) {
    addAnomaly(anomalies, 'curated', object.id, 'non-finite static position');
    return;
  }
  const expected = documentedDistance(object);

  if (expected === null) {
    return;
  }
  report.documentedDistances += 1;
  const measured = Math.hypot(...resolvePosition(object, provider.unit, objectsById, new Set()));
  const error = relativeDifference(measured, expected.value);

  if (error > expected.tolerance) {
    addAnomaly(
      anomalies,
      'curated',
      object.id,
      `distance mismatch: ${measured} ${provider.unit} vs ${expected.value}`,
    );
  }
}

function auditKeplerianOrbit(object, provider, anomalies) {
  if (
    !isPositiveFinite(provider.semiMajorAxis) ||
    !isPositiveFinite(provider.orbitalPeriodDays) ||
    !Number.isFinite(provider.eccentricity) ||
    provider.eccentricity < 0 ||
    provider.eccentricity >= 1
  ) {
    addAnomaly(anomalies, 'curated', object.id, 'invalid Keplerian orbital definition');
  }
  const expectedAxis = metadataSemiMajorAxis(object, provider.unit);

  if (expectedAxis !== null && relativeDifference(provider.semiMajorAxis, expectedAxis) > 0.001) {
    addAnomaly(anomalies, 'curated', object.id, 'semi-major axis differs from metadata');
  }
}

function auditGalacticOrigin(objectsById, anomalies) {
  const sun = objectsById.get('sun');
  const galacticCenter = objectsById.get('sagittarius-a-star');

  if (!isStaticKiloparsecPosition(sun) || !isStaticKiloparsecPosition(galacticCenter)) {
    addAnomaly(anomalies, 'reference-frames', 'milky-way', 'missing Galactic origin landmarks');
    return;
  }
  const separation = Math.hypot(
    sun.positionProvider.position[0] - galacticCenter.positionProvider.position[0],
    sun.positionProvider.position[1] - galacticCenter.positionProvider.position[1],
    sun.positionProvider.position[2] - galacticCenter.positionProvider.position[2],
  );
  const documentedDistance = galacticCenter.metadata?.distanceKpc;

  if (
    !isPositiveFinite(documentedDistance) ||
    relativeDifference(separation, documentedDistance) > 0.000_01
  ) {
    addAnomaly(anomalies, 'reference-frames', 'sagittarius-a-star', 'invalid Sun-centre distance');
  }
}

function documentedDistance(object) {
  if (object.id === 'sagittarius-a-star' || object.positionProvider.type !== 'static') {
    return null;
  }
  const metadata = object.metadata ?? {};
  const unit = object.positionProvider.unit;

  if (isPositiveFinite(metadata.distanceMpc)) {
    return expectedDistance(metadata.distanceMpc * PARSECS_PER_MEGAPARSEC, unit, 0.000_3);
  }
  if (isPositiveFinite(metadata.distanceKpc)) {
    return expectedDistance(metadata.distanceKpc * PARSECS_PER_KILOPARSEC, unit, 0.001);
  }
  if (isPositiveFinite(metadata.distancePc)) {
    return expectedDistance(metadata.distancePc, unit, 0.000_01);
  }
  if (isPositiveFinite(metadata.distanceLy)) {
    return expectedDistance(
      metadata.distanceLy / LIGHT_YEARS_PER_PARSEC,
      unit,
      object.id === 'sn-1987a' ? 0.02 : 0.001,
    );
  }
  if (isPositiveFinite(metadata.galactocentricDistanceKpc)) {
    return expectedDistance(
      metadata.galactocentricDistanceKpc * PARSECS_PER_KILOPARSEC,
      unit,
      0.000_01,
    );
  }

  return null;
}

function expectedDistance(parsecs, unit, tolerance) {
  return { value: fromParsecs(parsecs, unit), tolerance };
}

function isOrbitalProvider(provider) {
  return ['keplerian', 'ephemeris', 'illustrative-orbit'].includes(provider.type);
}

function isStaticKiloparsecPosition(object) {
  return (
    object?.positionProvider.type === 'static' && object.positionProvider.unit === 'kiloparsec'
  );
}

function metadataSemiMajorAxis(object, unit) {
  if (unit === 'astronomical-unit' && isPositiveFinite(object.metadata?.semiMajorAxisAu)) {
    return object.metadata.semiMajorAxisAu;
  }
  if (unit === 'kilometer' && isPositiveFinite(object.metadata?.semiMajorAxisKm)) {
    return object.metadata.semiMajorAxisKm;
  }

  return null;
}

function resolvePosition(object, targetUnit, objectsById, ancestors) {
  if (ancestors.has(object.id)) {
    throw new Error(`Cyclic object hierarchy at ${object.id}.`);
  }
  const provider = object.positionProvider;

  if (provider.type !== 'static') {
    return [0, 0, 0];
  }
  const nextAncestors = new Set(ancestors).add(object.id);
  const local = provider.position.map((value) =>
    fromParsecs(toParsecs(value, provider.unit), targetUnit),
  );
  const parent = object.parentId ? objectsById.get(object.parentId) : undefined;

  if (!parent || parent.referenceFrame !== object.referenceFrame) {
    return local;
  }
  const parentPosition = resolvePosition(parent, targetUnit, objectsById, nextAncestors);

  return local.map((value, index) => value + parentPosition[index]);
}
