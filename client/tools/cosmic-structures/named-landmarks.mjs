import {
  equatorialToCartesian,
  galacticToEquatorialSkyPosition,
} from './astronomical-coordinates.mjs';

const NAMED_LANDMARK_FLAG = 128;
const SUPPORTED_STRUCTURE_TYPES = new Set(['wall', 'basin', 'attractor', 'repeller']);
const SUPPORTED_SCIENTIFIC_CONFIDENCE = new Set([
  'observed',
  'calculated',
  'extrapolated',
  'simulated',
]);

export function parseNamedCosmicLandmarks(document) {
  assertDocument(document);
  const sources = [];
  const records = [];

  for (const inputSource of document.sources) {
    const sourceIndex = sources.length;
    const sourceRecords = parseSourceRecords(inputSource, sourceIndex, document.cosmology);

    sources.push(createSourceMetadata(inputSource));
    records.push(...sourceRecords);
  }

  return { records, sources };
}

function parseSourceRecords(source, sourceIndex, cosmology) {
  const seenIdentifiers = new Set();

  return source.records.map((record) => {
    assertRecord(record, source.id);
    if (seenIdentifiers.has(record.identifier)) {
      throw new Error(
        `Duplicate named cosmic landmark identifier in ${source.id}: ${record.identifier}.`,
      );
    }
    seenIdentifiers.add(record.identifier);

    return createRecord(record, source.structureType, sourceIndex, cosmology);
  });
}

function createSourceMetadata(source) {
  return {
    id: source.id,
    layout: 'named-landmark',
    name: source.name,
    citation: source.citation,
    sourceUrl: source.sourceUrl,
    structureType: source.structureType,
    method: source.method,
    objectNamePrefix: source.objectNamePrefix,
    scientificConfidence: source.scientificConfidence,
    confidenceMeaning: source.confidenceMeaning,
    extentMeaning: source.extentMeaning,
    mapPriority: source.mapPriority,
    recordNames: Object.fromEntries(
      source.records.map(({ identifier, name }) => [identifier, name]),
    ),
    recordAliases: Object.fromEntries(
      source.records
        .filter(({ aliases }) => aliases?.length)
        .map(({ identifier, aliases }) => [identifier, [...aliases]]),
    ),
    recordCount: source.records.length,
  };
}

function createRecord(record, structureType, sourceIndex, cosmology) {
  const coordinates = skyPosition(record);
  const distanceMpc = distance(record, cosmology.hubbleConstantKmPerSecondPerMpc);

  return {
    identifier: record.identifier,
    catalogNumericId: record.catalogNumericId,
    sourceIndex,
    structureType,
    positionMpc: equatorialToCartesian(
      coordinates.rightAscensionDegrees,
      coordinates.declinationDegrees,
      distanceMpc,
    ),
    distanceMpc,
    radiusMpc: radius(record, cosmology.reducedHubbleParameter),
    confidence: record.confidence,
    densityContrast: Number.NaN,
    boundaryDistanceMpc: Number.NaN,
    galaxyCount: record.galaxyCount ?? 0,
    flags: NAMED_LANDMARK_FLAG,
  };
}

function skyPosition(record) {
  if (Number.isFinite(record.rightAscensionDegrees)) {
    return {
      rightAscensionDegrees: record.rightAscensionDegrees,
      declinationDegrees: record.declinationDegrees,
    };
  }

  return galacticToEquatorialSkyPosition(
    record.galacticLongitudeDegrees,
    record.galacticLatitudeDegrees,
  );
}

function distance(record, hubbleConstant) {
  return record.distanceMpc ?? record.recessionVelocityKmPerSecond / hubbleConstant;
}

function radius(record, reducedHubbleParameter) {
  if (Number.isFinite(record.diameterMpc)) {
    return record.diameterMpc / 2;
  }
  if (Number.isFinite(record.radiusMpc)) {
    return record.radiusMpc;
  }
  if (Number.isFinite(record.volumeMillionCubicMpcPerH3)) {
    return (
      Math.cbrt((3 * record.volumeMillionCubicMpcPerH3 * 1e6) / (4 * Math.PI)) /
      reducedHubbleParameter
    );
  }

  return 0;
}

function assertDocument(document) {
  if (
    !document ||
    document.version !== '1.0.0' ||
    !document.cosmology ||
    !positive(document.cosmology.hubbleConstantKmPerSecondPerMpc) ||
    !positive(document.cosmology.reducedHubbleParameter) ||
    !Array.isArray(document.sources) ||
    document.sources.length === 0
  ) {
    throw new Error('Named cosmic-landmark document is invalid.');
  }
  const sourceIds = new Set();

  for (const source of document.sources) {
    assertSource(source, sourceIds);
    sourceIds.add(source.id);
  }
}

function assertSource(source, sourceIds) {
  if (
    !nonEmpty(source.id) ||
    sourceIds.has(source.id) ||
    !nonEmpty(source.name) ||
    !nonEmpty(source.citation) ||
    !validHttpsUrl(source.sourceUrl) ||
    !SUPPORTED_STRUCTURE_TYPES.has(source.structureType) ||
    !SUPPORTED_SCIENTIFIC_CONFIDENCE.has(source.scientificConfidence) ||
    !nonEmpty(source.method) ||
    !nonEmpty(source.objectNamePrefix) ||
    !nonEmpty(source.confidenceMeaning) ||
    !nonEmpty(source.extentMeaning) ||
    source.mapPriority !== 'landmark' ||
    !Array.isArray(source.records) ||
    source.records.length === 0
  ) {
    throw new Error(`Named cosmic-landmark source is invalid: ${source?.id ?? 'unknown'}.`);
  }
}

function assertRecord(record, sourceId) {
  const positionCount = Number(validEquatorial(record)) + Number(validGalactic(record));
  const distanceCount =
    Number(positive(record.distanceMpc)) + Number(positive(record.recessionVelocityKmPerSecond));
  const extentCount =
    Number(positive(record.diameterMpc)) +
    Number(positive(record.radiusMpc)) +
    Number(positive(record.volumeMillionCubicMpcPerH3));

  if (
    !nonEmpty(record.identifier) ||
    !nonEmpty(record.name) ||
    (record.aliases !== undefined &&
      (!Array.isArray(record.aliases) || !record.aliases.every(nonEmpty))) ||
    !Number.isInteger(record.catalogNumericId) ||
    record.catalogNumericId <= 0 ||
    record.catalogNumericId > 65_535 ||
    positionCount !== 1 ||
    distanceCount !== 1 ||
    extentCount > 1 ||
    !unitInterval(record.confidence) ||
    (record.galaxyCount !== undefined &&
      (!Number.isInteger(record.galaxyCount) || record.galaxyCount < 0))
  ) {
    throw new Error(`Named cosmic landmark is invalid in ${sourceId}: ${record?.identifier}.`);
  }
}

function validEquatorial(record) {
  return (
    Number.isFinite(record.rightAscensionDegrees) &&
    record.rightAscensionDegrees >= 0 &&
    record.rightAscensionDegrees < 360 &&
    Number.isFinite(record.declinationDegrees) &&
    record.declinationDegrees >= -90 &&
    record.declinationDegrees <= 90
  );
}

function validGalactic(record) {
  return (
    Number.isFinite(record.galacticLongitudeDegrees) &&
    record.galacticLongitudeDegrees >= 0 &&
    record.galacticLongitudeDegrees < 360 &&
    Number.isFinite(record.galacticLatitudeDegrees) &&
    record.galacticLatitudeDegrees >= -90 &&
    record.galacticLatitudeDegrees <= 90
  );
}

function nonEmpty(value) {
  return typeof value === 'string' && value.trim().length > 0;
}

function positive(value) {
  return Number.isFinite(value) && value > 0;
}

function unitInterval(value) {
  return Number.isFinite(value) && value >= 0 && value <= 1;
}

function validHttpsUrl(value) {
  if (!nonEmpty(value)) {
    return false;
  }
  try {
    return new URL(value).protocol === 'https:';
  } catch {
    return false;
  }
}
