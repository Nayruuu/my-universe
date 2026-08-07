import {
  addAnomaly,
  dataView,
  isPositiveFinite,
  readBinary,
  readJson,
  relativeDifference,
} from './shared.mjs';

const GROUP_HEADER_BYTES = 40;
const GROUP_RECORD_BYTES = 32;
const STRUCTURE_HEADER_BYTES = 48;
const STRUCTURE_RECORD_BYTES = 48;
const TEMPEL_HEADER_BYTES = 64;
const TEMPEL_INDEX_BYTES = 8;
const TEMPEL_POINT_BYTES = 16;

export async function auditCosmicCatalogs(dataRoot, anomalies) {
  const [cosmicGroups, cosmicStructures, tempelSpines] = await Promise.all([
    auditCosmicGroups(dataRoot, anomalies),
    auditCosmicStructures(dataRoot, anomalies),
    auditTempelSpines(dataRoot, anomalies),
  ]);

  return { cosmicGroups, cosmicStructures, tempelSpines };
}

async function auditCosmicGroups(dataRoot, anomalies) {
  const bytes = await readBinary(dataRoot, 'galaxies/cosmicflows4-groups.bin');
  const view = dataView(bytes);
  const records = view.getUint32(12, true);
  let previousDistance = Number.NEGATIVE_INFINITY;
  let maximumRelativeDistanceError = 0;

  for (let index = 0; index < records; index += 1) {
    const offset = GROUP_HEADER_BYTES + index * GROUP_RECORD_BYTES;
    const distance = view.getFloat32(offset + 12, true);
    const measured = vectorLength(view, offset);
    const error = relativeDifference(measured, distance);

    maximumRelativeDistanceError = Math.max(maximumRelativeDistanceError, error);
    if (!isPositiveFinite(distance) || error > Math.max(0.05 / distance, 0.000_2)) {
      addAnomaly(anomalies, 'cosmic-groups', `record-${index}`, 'Cartesian distance mismatch');
    }
    if (distance < previousDistance) {
      addAnomaly(anomalies, 'cosmic-groups', `record-${index}`, 'distance ordering mismatch');
    }
    previousDistance = distance;
  }

  return {
    records,
    minimumDistanceMpc: view.getFloat32(28, true),
    maximumDistanceMpc: view.getFloat32(32, true),
    maximumRelativeDistanceError,
  };
}

async function auditCosmicStructures(dataRoot, anomalies) {
  const [metadata, bytes] = await Promise.all([
    readJson(dataRoot, 'structures/cosmic-structures.json'),
    readBinary(dataRoot, 'structures/cosmic-structures.bin'),
  ]);
  const view = dataView(bytes);
  const records = view.getUint32(12, true);
  const recordsBySource = new Uint32Array(metadata.sources.length);
  let maximumRelativeDistanceError = 0;

  for (let index = 0; index < records; index += 1) {
    const offset = STRUCTURE_HEADER_BYTES + index * STRUCTURE_RECORD_BYTES;
    const distance = view.getFloat32(offset + 12, true);
    const sourceIndex = view.getUint16(offset + 42, true);
    const error = relativeDifference(vectorLength(view, offset), distance);

    maximumRelativeDistanceError = Math.max(maximumRelativeDistanceError, error);
    if (!isPositiveFinite(distance) || error > 0.001) {
      addAnomaly(anomalies, 'cosmic-structures', `record-${index}`, 'Cartesian distance mismatch');
    }
    if (sourceIndex >= recordsBySource.length) {
      addAnomaly(anomalies, 'cosmic-structures', `record-${index}`, 'invalid source index');
    } else {
      recordsBySource[sourceIndex] += 1;
    }
  }
  if (records !== metadata.recordCount) {
    addAnomaly(anomalies, 'cosmic-structures', 'catalog', 'binary and metadata counts differ');
  }
  metadata.sources.forEach((source, index) => {
    if (recordsBySource[index] !== source.recordCount) {
      addAnomaly(anomalies, 'cosmic-structures', source.id, 'source cardinality mismatch');
    }
  });

  return {
    records,
    minimumDistanceMpc: view.getFloat32(28, true),
    maximumDistanceMpc: view.getFloat32(32, true),
    maximumRelativeDistanceError,
  };
}

async function auditTempelSpines(dataRoot, anomalies) {
  const [metadata, bytes] = await Promise.all([
    readJson(dataRoot, 'structures/tempel-filament-spines.json'),
    readBinary(dataRoot, 'structures/tempel-filament-spines.bin'),
  ]);
  const view = dataView(bytes);
  const filaments = view.getUint32(12, true);
  const points = view.getUint32(16, true);
  const segments = view.getUint32(20, true);
  const minimumDistanceMpc = view.getFloat32(36, true);
  const maximumDistanceMpc = view.getFloat32(40, true);
  const pointsOffset = TEMPEL_HEADER_BYTES + filaments * TEMPEL_INDEX_BYTES;
  let actualMinimum = Number.POSITIVE_INFINITY;
  let actualMaximum = 0;

  for (let index = 0; index < points; index += 1) {
    const distance = vectorLength(view, pointsOffset + index * TEMPEL_POINT_BYTES);

    if (!isPositiveFinite(distance)) {
      addAnomaly(anomalies, 'tempel-spines', `point-${index}`, 'invalid Cartesian distance');
    }
    actualMinimum = Math.min(actualMinimum, distance);
    actualMaximum = Math.max(actualMaximum, distance);
  }
  if (
    filaments !== metadata.filamentCount ||
    points !== metadata.pointCount ||
    segments !== metadata.segmentCount
  ) {
    addAnomaly(anomalies, 'tempel-spines', 'catalog', 'binary and metadata counts differ');
  }
  if (
    relativeDifference(actualMinimum, minimumDistanceMpc) > 0.000_1 ||
    relativeDifference(actualMaximum, maximumDistanceMpc) > 0.000_1
  ) {
    addAnomaly(anomalies, 'tempel-spines', 'catalog', 'distance bounds differ from payload');
  }

  return { filaments, points, segments, minimumDistanceMpc, maximumDistanceMpc };
}

function vectorLength(view, offset) {
  return Math.hypot(
    view.getFloat32(offset, true),
    view.getFloat32(offset + 4, true),
    view.getFloat32(offset + 8, true),
  );
}
