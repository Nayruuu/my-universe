import { CosmicStructureType, ScientificConfidence } from '../../data/models/universe.models';

export interface CosmicStructureCatalogSource {
  readonly id: string;
  readonly name: string;
  readonly citation: string;
  readonly sourceUrl: string;
  readonly structureType: CosmicStructureType;
  readonly method: string;
  readonly objectNamePrefix: string;
  readonly scientificConfidence: ScientificConfidence;
  readonly recordCount: number;
  readonly sourceSha256?: string;
}

export interface CosmicStructureCatalogMetadata {
  readonly version: string;
  readonly recordCount: number;
  readonly referenceEpochJulianDay: number;
  readonly referenceFrame: 'equatorial-j2000';
  readonly distanceUnit: 'megaparsec';
  readonly scientificConfidence: 'calculated';
  readonly sources: readonly CosmicStructureCatalogSource[];
}

export interface CosmicStructureCatalog {
  readonly count: number;
  readonly referenceEpochJulianDay: number;
  readonly minimumDistanceMpc: number;
  readonly maximumDistanceMpc: number;
  readonly positionsMpc: Float32Array;
  readonly distancesMpc: Float32Array;
  readonly radiiMpc: Float32Array;
  readonly confidences: Float32Array;
  readonly densityContrasts: Float32Array;
  readonly boundaryDistancesMpc: Float32Array;
  readonly galaxyCounts: Uint32Array;
  readonly sourceIndices: Uint16Array;
  readonly catalogNumericIds: Uint16Array;
  readonly flags: Uint8Array;
  readonly identifiers: readonly string[];
  readonly structureTypes: readonly CosmicStructureType[];
  readonly metadata: CosmicStructureCatalogMetadata;
}

export const COSMIC_STRUCTURE_CATALOG_MAGIC = 'UMCS';
export const COSMIC_STRUCTURE_CATALOG_VERSION = 1;
export const COSMIC_STRUCTURE_CATALOG_HEADER_BYTES = 48;
export const COSMIC_STRUCTURE_CATALOG_RECORD_BYTES = 48;

const EQUATORIAL_CARTESIAN_FRAME = 1;
const MAXIMUM_RECORD_COUNT = 1_000_000;
const STRUCTURE_TYPES: readonly CosmicStructureType[] = [
  'cluster',
  'supercluster',
  'wall',
  'filament',
  'void',
  'basin',
  'attractor',
  'repeller',
];
const SOURCE_CONFIDENCE_LEVELS: readonly ScientificConfidence[] = [
  'observed',
  'calculated',
  'simulated',
];

export function parseCosmicStructureCatalogMetadata(
  value: unknown,
  source: string,
): CosmicStructureCatalogMetadata {
  if (
    !isRecord(value) ||
    typeof value['version'] !== 'string' ||
    !positiveInteger(value['recordCount']) ||
    !finiteNumber(value['referenceEpochJulianDay']) ||
    value['referenceFrame'] !== 'equatorial-j2000' ||
    value['distanceUnit'] !== 'megaparsec' ||
    value['scientificConfidence'] !== 'calculated' ||
    !Array.isArray(value['sources']) ||
    value['sources'].length === 0
  ) {
    throw new Error(`Métadonnées de structures cosmiques invalides : ${source}.`);
  }
  const sources = value['sources'].map((entry, index) => parseSource(entry, source, index));
  const sourceIds = new Set<string>();

  for (const entry of sources) {
    if (sourceIds.has(entry.id)) {
      throw new Error(`Source cosmologique dupliquée dans ${source} : ${entry.id}.`);
    }
    sourceIds.add(entry.id);
  }
  const sourceRecordCount = sources.reduce((total, entry) => total + entry.recordCount, 0);

  if (sourceRecordCount !== value['recordCount']) {
    throw new Error(`Cardinalité des sources cosmiques incohérente dans ${source}.`);
  }

  return value as unknown as CosmicStructureCatalogMetadata;
}

export function parseCosmicStructureCatalog(
  buffer: ArrayBuffer,
  metadata: CosmicStructureCatalogMetadata,
): CosmicStructureCatalog {
  if (buffer.byteLength < COSMIC_STRUCTURE_CATALOG_HEADER_BYTES) {
    throw invalidCatalog('en-tête tronqué');
  }
  const view = new DataView(buffer);

  assertMagic(view);
  assertHeader(view);
  const count = view.getUint32(12, true);
  const sourceCount = view.getUint16(16, true);
  const referenceEpochJulianDay = view.getFloat64(20, true);
  const minimumDistanceMpc = view.getFloat32(28, true);
  const maximumDistanceMpc = view.getFloat32(32, true);
  const stringTableBytes = view.getUint32(36, true);

  if (count === 0 || count > MAXIMUM_RECORD_COUNT || count !== metadata.recordCount) {
    throw invalidCatalog(`nombre de structures hors limites (${count})`);
  }
  if (sourceCount !== metadata.sources.length) {
    throw invalidCatalog(`nombre de sources incompatible (${sourceCount})`);
  }
  if (
    !Number.isFinite(referenceEpochJulianDay) ||
    Math.abs(referenceEpochJulianDay - metadata.referenceEpochJulianDay) > 0.000_001
  ) {
    throw invalidCatalog('époque de référence invalide');
  }
  if (
    !positiveFinite(minimumDistanceMpc) ||
    !positiveFinite(maximumDistanceMpc) ||
    maximumDistanceMpc < minimumDistanceMpc
  ) {
    throw invalidCatalog('limites de distance invalides');
  }
  const expectedBytes =
    COSMIC_STRUCTURE_CATALOG_HEADER_BYTES +
    count * COSMIC_STRUCTURE_CATALOG_RECORD_BYTES +
    stringTableBytes;

  if (buffer.byteLength !== expectedBytes) {
    throw invalidCatalog(
      `taille inattendue (${buffer.byteLength} octets au lieu de ${expectedBytes})`,
    );
  }

  return decodeCatalog(
    view,
    count,
    referenceEpochJulianDay,
    minimumDistanceMpc,
    maximumDistanceMpc,
    stringTableBytes,
    metadata,
  );
}

function decodeCatalog(
  view: DataView,
  count: number,
  referenceEpochJulianDay: number,
  minimumDistanceMpc: number,
  maximumDistanceMpc: number,
  stringTableBytes: number,
  metadata: CosmicStructureCatalogMetadata,
): CosmicStructureCatalog {
  const positionsMpc = new Float32Array(count * 3);
  const distancesMpc = new Float32Array(count);
  const radiiMpc = new Float32Array(count);
  const confidences = new Float32Array(count);
  const densityContrasts = new Float32Array(count);
  const boundaryDistancesMpc = new Float32Array(count);
  const galaxyCounts = new Uint32Array(count);
  const sourceIndices = new Uint16Array(count);
  const catalogNumericIds = new Uint16Array(count);
  const flags = new Uint8Array(count);
  const identifiers: string[] = [];
  const structureTypes: CosmicStructureType[] = [];
  const seenIdentifiers = new Set<string>();
  const recordsBySource = new Uint32Array(metadata.sources.length);
  const stringTableOffset =
    COSMIC_STRUCTURE_CATALOG_HEADER_BYTES + count * COSMIC_STRUCTURE_CATALOG_RECORD_BYTES;
  const decoder = new TextDecoder('utf-8', { fatal: true });
  let actualMinimumDistance = Number.POSITIVE_INFINITY;
  let actualMaximumDistance = 0;

  for (let index = 0; index < count; index += 1) {
    const recordOffset =
      COSMIC_STRUCTURE_CATALOG_HEADER_BYTES + index * COSMIC_STRUCTURE_CATALOG_RECORD_BYTES;
    const positionOffset = index * 3;
    const x = view.getFloat32(recordOffset, true);
    const y = view.getFloat32(recordOffset + 4, true);
    const z = view.getFloat32(recordOffset + 8, true);
    const distanceMpc = view.getFloat32(recordOffset + 12, true);
    const radiusMpc = view.getFloat32(recordOffset + 16, true);
    const confidence = view.getFloat32(recordOffset + 20, true);
    const densityContrast = view.getFloat32(recordOffset + 24, true);
    const boundaryDistanceMpc = view.getFloat32(recordOffset + 28, true);
    const galaxyCount = view.getUint32(recordOffset + 32, true);
    const identifierOffset = view.getUint32(recordOffset + 36, true);
    const identifierLength = view.getUint16(recordOffset + 40, true);
    const sourceIndex = view.getUint16(recordOffset + 42, true);
    const typeCode = view.getUint8(recordOffset + 44);
    const recordFlags = view.getUint8(recordOffset + 45);
    const catalogNumericId = view.getUint16(recordOffset + 46, true);
    const structureType = STRUCTURE_TYPES[typeCode];

    if (
      ![x, y, z].every(Number.isFinite) ||
      !positiveFinite(distanceMpc) ||
      !nonNegativeFinite(radiusMpc) ||
      !unitInterval(confidence) ||
      (!Number.isNaN(densityContrast) && !Number.isFinite(densityContrast)) ||
      (!Number.isNaN(boundaryDistanceMpc) && !positiveFinite(boundaryDistanceMpc)) ||
      catalogNumericId === 0
    ) {
      throw invalidCatalog(`enregistrement invalide à l’index ${index}`);
    }
    if (sourceIndex >= metadata.sources.length) {
      throw invalidCatalog(`source invalide à l’index ${index}`);
    }
    if (!structureType || structureType !== metadata.sources[sourceIndex]!.structureType) {
      throw invalidCatalog(`type de structure invalide à l’index ${index}`);
    }
    if (identifierLength === 0 || identifierOffset + identifierLength > stringTableBytes) {
      throw invalidCatalog(`identifiant invalide à l’index ${index}`);
    }
    const identifier = decoder.decode(
      new Uint8Array(view.buffer, stringTableOffset + identifierOffset, identifierLength),
    );
    const identifierKey = `${sourceIndex}:${identifier}`;

    if (!identifier.trim()) {
      throw invalidCatalog(`identifiant invalide à l’index ${index}`);
    }
    if (seenIdentifiers.has(identifierKey)) {
      throw invalidCatalog(`identifiant dupliqué à l’index ${index}`);
    }
    seenIdentifiers.add(identifierKey);
    const cartesianDistance = Math.hypot(x, y, z);

    if (!approximatelyEqual(cartesianDistance, distanceMpc, 0.001)) {
      throw invalidCatalog(`distance cartésienne incohérente à l’index ${index}`);
    }
    positionsMpc.set([x, y, z], positionOffset);
    distancesMpc[index] = distanceMpc;
    radiiMpc[index] = radiusMpc;
    confidences[index] = confidence;
    densityContrasts[index] = densityContrast;
    boundaryDistancesMpc[index] = boundaryDistanceMpc;
    galaxyCounts[index] = galaxyCount;
    sourceIndices[index] = sourceIndex;
    catalogNumericIds[index] = catalogNumericId;
    flags[index] = recordFlags;
    identifiers.push(identifier);
    structureTypes.push(structureType);
    recordsBySource[sourceIndex] += 1;
    actualMinimumDistance = Math.min(actualMinimumDistance, distanceMpc);
    actualMaximumDistance = Math.max(actualMaximumDistance, distanceMpc);
  }
  if (
    !approximatelyEqual(actualMinimumDistance, minimumDistanceMpc, 0.000_1) ||
    !approximatelyEqual(actualMaximumDistance, maximumDistanceMpc, 0.000_1)
  ) {
    throw invalidCatalog('bornes du catalogue incohérentes');
  }
  for (let sourceIndex = 0; sourceIndex < recordsBySource.length; sourceIndex += 1) {
    if (recordsBySource[sourceIndex] !== metadata.sources[sourceIndex]!.recordCount) {
      throw invalidCatalog(`cardinalité de source incohérente à l’index ${sourceIndex}`);
    }
  }

  return {
    count,
    referenceEpochJulianDay,
    minimumDistanceMpc,
    maximumDistanceMpc,
    positionsMpc,
    distancesMpc,
    radiiMpc,
    confidences,
    densityContrasts,
    boundaryDistancesMpc,
    galaxyCounts,
    sourceIndices,
    catalogNumericIds,
    flags,
    identifiers,
    structureTypes,
    metadata,
  };
}

function parseSource(value: unknown, source: string, index: number): CosmicStructureCatalogSource {
  if (
    !isRecord(value) ||
    !nonEmptyString(value['id']) ||
    !nonEmptyString(value['name']) ||
    !nonEmptyString(value['citation']) ||
    !nonEmptyString(value['sourceUrl']) ||
    !isStructureType(value['structureType']) ||
    !nonEmptyString(value['method']) ||
    !nonEmptyString(value['objectNamePrefix']) ||
    !SOURCE_CONFIDENCE_LEVELS.includes(value['scientificConfidence'] as ScientificConfidence) ||
    !positiveInteger(value['recordCount']) ||
    (value['sourceSha256'] !== undefined && !nonEmptyString(value['sourceSha256']))
  ) {
    throw new Error(`Source cosmologique invalide dans ${source}, index ${index}.`);
  }

  return value as unknown as CosmicStructureCatalogSource;
}

function assertMagic(view: DataView): void {
  for (let index = 0; index < COSMIC_STRUCTURE_CATALOG_MAGIC.length; index += 1) {
    if (view.getUint8(index) !== COSMIC_STRUCTURE_CATALOG_MAGIC.charCodeAt(index)) {
      throw invalidCatalog('signature inconnue');
    }
  }
}

function assertHeader(view: DataView): void {
  if (view.getUint16(4, true) !== COSMIC_STRUCTURE_CATALOG_VERSION) {
    throw invalidCatalog(`version non prise en charge (${view.getUint16(4, true)})`);
  }
  if (
    view.getUint16(6, true) !== COSMIC_STRUCTURE_CATALOG_HEADER_BYTES ||
    view.getUint16(8, true) !== COSMIC_STRUCTURE_CATALOG_RECORD_BYTES
  ) {
    throw invalidCatalog('dimensions d’enregistrement incompatibles');
  }
  if (view.getUint16(10, true) !== 0) {
    throw invalidCatalog('options binaires inconnues');
  }
  if (view.getUint16(18, true) !== EQUATORIAL_CARTESIAN_FRAME) {
    throw invalidCatalog('référentiel inconnu');
  }
}

function approximatelyEqual(left: number, right: number, relativeTolerance: number): boolean {
  return Math.abs(left - right) <= Math.max(0.02, Math.abs(right) * relativeTolerance);
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function isStructureType(value: unknown): value is CosmicStructureType {
  return STRUCTURE_TYPES.includes(value as CosmicStructureType);
}

function finiteNumber(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value);
}

function positiveFinite(value: number): boolean {
  return Number.isFinite(value) && value > 0;
}

function nonNegativeFinite(value: number): boolean {
  return Number.isFinite(value) && value >= 0;
}

function unitInterval(value: number): boolean {
  return Number.isFinite(value) && value >= 0 && value <= 1;
}

function positiveInteger(value: unknown): value is number {
  return typeof value === 'number' && Number.isInteger(value) && value > 0;
}

function nonEmptyString(value: unknown): value is string {
  return typeof value === 'string' && value.trim().length > 0;
}

function invalidCatalog(reason: string): Error {
  return new Error(`Catalogue de structures cosmiques invalide : ${reason}.`);
}
