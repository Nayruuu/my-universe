export interface CosmicGroupCatalog {
  readonly count: number;
  readonly referenceEpochJulianDay: number;
  readonly minimumDistanceMpc: number;
  readonly maximumDistanceMpc: number;
  readonly positionsMpc: Float32Array;
  readonly distancesMpc: Float32Array;
  readonly distanceModulusErrors: Float32Array;
  readonly velocitiesCmbKmPerSecond: Int32Array;
  readonly pgcIds: Uint32Array;
  readonly distanceModuli: Float32Array;
}

export const COSMIC_GROUP_CATALOG_MAGIC = 'UMCG';
export const COSMIC_GROUP_CATALOG_VERSION = 1;
export const COSMIC_GROUP_CATALOG_HEADER_BYTES = 40;
export const COSMIC_GROUP_CATALOG_RECORD_BYTES = 32;

const EQUATORIAL_CARTESIAN_FRAME = 1;
const MAXIMUM_RECORD_COUNT = 100_000;
const LOCAL_VOLUME_LIMIT_MPC = 11;

export function parseCosmicGroupCatalog(buffer: ArrayBuffer): CosmicGroupCatalog {
  if (buffer.byteLength < COSMIC_GROUP_CATALOG_HEADER_BYTES) {
    throw invalidCatalog('en-tête tronqué');
  }
  const view = new DataView(buffer);

  assertMagic(view);
  assertHeader(view);
  const count = view.getUint32(12, true);
  const referenceEpochJulianDay = view.getFloat64(16, true);
  const minimumDistanceMpc = view.getFloat32(28, true);
  const maximumDistanceMpc = view.getFloat32(32, true);
  const expectedBytes =
    COSMIC_GROUP_CATALOG_HEADER_BYTES + count * COSMIC_GROUP_CATALOG_RECORD_BYTES;

  if (count === 0 || count > MAXIMUM_RECORD_COUNT) {
    throw invalidCatalog(`nombre de groupes hors limites (${count})`);
  }
  if (!Number.isFinite(referenceEpochJulianDay)) {
    throw invalidCatalog('époque de référence invalide');
  }
  if (
    !Number.isFinite(minimumDistanceMpc) ||
    !Number.isFinite(maximumDistanceMpc) ||
    minimumDistanceMpc <= LOCAL_VOLUME_LIMIT_MPC ||
    maximumDistanceMpc < minimumDistanceMpc
  ) {
    throw invalidCatalog('limites de distance invalides');
  }
  if (buffer.byteLength !== expectedBytes) {
    throw invalidCatalog(
      `taille inattendue (${buffer.byteLength} octets au lieu de ${expectedBytes})`,
    );
  }

  return decodeRecords(
    view,
    count,
    referenceEpochJulianDay,
    minimumDistanceMpc,
    maximumDistanceMpc,
  );
}

function assertMagic(view: DataView): void {
  for (let index = 0; index < COSMIC_GROUP_CATALOG_MAGIC.length; index += 1) {
    if (view.getUint8(index) !== COSMIC_GROUP_CATALOG_MAGIC.charCodeAt(index)) {
      throw invalidCatalog('signature inconnue');
    }
  }
}

function assertHeader(view: DataView): void {
  const version = view.getUint16(4, true);
  const headerBytes = view.getUint16(6, true);
  const recordBytes = view.getUint16(8, true);
  const flags = view.getUint16(10, true);
  const coordinateFrame = view.getUint32(24, true);
  const reserved = view.getUint32(36, true);

  if (version !== COSMIC_GROUP_CATALOG_VERSION) {
    throw invalidCatalog(`version non prise en charge (${version})`);
  }
  if (
    headerBytes !== COSMIC_GROUP_CATALOG_HEADER_BYTES ||
    recordBytes !== COSMIC_GROUP_CATALOG_RECORD_BYTES
  ) {
    throw invalidCatalog('dimensions d’enregistrement incompatibles');
  }
  if (flags !== 0 || reserved !== 0) {
    throw invalidCatalog('options binaires non prises en charge');
  }
  if (coordinateFrame !== EQUATORIAL_CARTESIAN_FRAME) {
    throw invalidCatalog(`référentiel inconnu (${coordinateFrame})`);
  }
}

function decodeRecords(
  view: DataView,
  count: number,
  referenceEpochJulianDay: number,
  minimumDistanceMpc: number,
  maximumDistanceMpc: number,
): CosmicGroupCatalog {
  const positionsMpc = new Float32Array(count * 3);
  const distancesMpc = new Float32Array(count);
  const distanceModulusErrors = new Float32Array(count);
  const velocitiesCmbKmPerSecond = new Int32Array(count);
  const pgcIds = new Uint32Array(count);
  const distanceModuli = new Float32Array(count);
  const seenIds = new Set<number>();
  let previousDistance = Number.NEGATIVE_INFINITY;

  for (let index = 0; index < count; index += 1) {
    const inputOffset =
      COSMIC_GROUP_CATALOG_HEADER_BYTES + index * COSMIC_GROUP_CATALOG_RECORD_BYTES;
    const outputOffset = index * 3;
    const x = view.getFloat32(inputOffset, true);
    const y = view.getFloat32(inputOffset + 4, true);
    const z = view.getFloat32(inputOffset + 8, true);
    const distanceMpc = view.getFloat32(inputOffset + 12, true);
    const distanceModulusError = view.getFloat32(inputOffset + 16, true);
    const velocityCmbKmPerSecond = view.getInt32(inputOffset + 20, true);
    const pgcId = view.getUint32(inputOffset + 24, true);
    const distanceModulus = view.getFloat32(inputOffset + 28, true);

    if (
      !Number.isFinite(x) ||
      !Number.isFinite(y) ||
      !Number.isFinite(z) ||
      !Number.isFinite(distanceMpc) ||
      distanceMpc <= LOCAL_VOLUME_LIMIT_MPC ||
      !Number.isFinite(distanceModulusError) ||
      distanceModulusError < 0 ||
      pgcId === 0 ||
      !Number.isFinite(distanceModulus)
    ) {
      throw invalidCatalog(`enregistrement invalide à l’index ${index}`);
    }
    const cartesianDistance = Math.hypot(x, y, z);
    const distanceTolerance = Math.max(0.05, distanceMpc * 0.000_2);

    if (Math.abs(cartesianDistance - distanceMpc) > distanceTolerance) {
      throw invalidCatalog(`distance cartésienne incohérente à l’index ${index}`);
    }
    if (distanceMpc < previousDistance) {
      throw invalidCatalog(`tri par distance invalide à l’index ${index}`);
    }
    if (seenIds.has(pgcId)) {
      throw invalidCatalog(`identifiant PGC dupliqué (${pgcId})`);
    }

    positionsMpc[outputOffset] = x;
    positionsMpc[outputOffset + 1] = y;
    positionsMpc[outputOffset + 2] = z;
    distancesMpc[index] = distanceMpc;
    distanceModulusErrors[index] = distanceModulusError;
    velocitiesCmbKmPerSecond[index] = velocityCmbKmPerSecond;
    pgcIds[index] = pgcId;
    distanceModuli[index] = distanceModulus;
    previousDistance = distanceMpc;
    seenIds.add(pgcId);
  }
  const lastIndex = count - 1;

  if (
    Math.abs(distancesMpc[0]! - minimumDistanceMpc) > 0.001 ||
    Math.abs(distancesMpc[lastIndex]! - maximumDistanceMpc) > 0.001
  ) {
    throw invalidCatalog('bornes du catalogue incohérentes');
  }

  return {
    count,
    referenceEpochJulianDay,
    minimumDistanceMpc,
    maximumDistanceMpc,
    positionsMpc,
    distancesMpc,
    distanceModulusErrors,
    velocitiesCmbKmPerSecond,
    pgcIds,
    distanceModuli,
  };
}

function invalidCatalog(reason: string): Error {
  return new Error(`Catalogue Cosmicflows-4 binaire invalide : ${reason}.`);
}
