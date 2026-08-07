export interface StarCatalog {
  readonly count: number;
  readonly referenceEpochJulianDay: number;
  readonly positionsParsec: Float32Array;
  readonly velocitiesParsecPerYear: Float32Array;
  readonly apparentMagnitudes: Float32Array;
  readonly colorIndicesBv: Float32Array;
  readonly catalogIds: Uint32Array;
  readonly names: readonly string[];
  readonly aliases: readonly (readonly string[])[];
  readonly spectralTypes: readonly (string | null)[];
}

export const STAR_CATALOG_MAGIC = 'UMSC';
export const STAR_CATALOG_VERSION = 3;
export const STAR_CATALOG_HEADER_BYTES = 40;
export const STAR_CATALOG_RECORD_BYTES = 48;

const EQUATORIAL_CARTESIAN_FRAME = 1;
const MAXIMUM_RECORD_COUNT = 1_000_000;
const STRING_SEPARATOR = '\u001f';

export function parseStarCatalog(buffer: ArrayBuffer): StarCatalog {
  if (buffer.byteLength < STAR_CATALOG_HEADER_BYTES) {
    throw invalidCatalog('en-tête tronqué');
  }

  const view = new DataView(buffer);

  assertMagic(view);
  assertHeader(view);

  const count = view.getUint32(12, true);
  const referenceEpochJulianDay = view.getFloat64(16, true);
  const stringTableOffset = view.getUint32(28, true);
  const stringTableBytes = view.getUint32(32, true);
  const recordsEnd = STAR_CATALOG_HEADER_BYTES + count * STAR_CATALOG_RECORD_BYTES;
  const expectedBytes = stringTableOffset + stringTableBytes;

  if (count === 0 || count > MAXIMUM_RECORD_COUNT) {
    throw invalidCatalog(`nombre d’étoiles hors limites (${count})`);
  }
  if (!Number.isFinite(referenceEpochJulianDay)) {
    throw invalidCatalog('époque de référence invalide');
  }
  if (stringTableOffset !== recordsEnd || stringTableBytes === 0) {
    throw invalidCatalog('table de chaînes mal positionnée');
  }
  if (buffer.byteLength !== expectedBytes) {
    throw invalidCatalog(
      `taille inattendue (${buffer.byteLength} octets au lieu de ${expectedBytes})`,
    );
  }

  return decodeRecords(view, count, referenceEpochJulianDay, stringTableOffset, stringTableBytes);
}

function assertMagic(view: DataView): void {
  for (let index = 0; index < STAR_CATALOG_MAGIC.length; index += 1) {
    if (view.getUint8(index) !== STAR_CATALOG_MAGIC.charCodeAt(index)) {
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

  if (version !== STAR_CATALOG_VERSION) {
    throw invalidCatalog(`version non prise en charge (${version})`);
  }
  if (headerBytes !== STAR_CATALOG_HEADER_BYTES || recordBytes !== STAR_CATALOG_RECORD_BYTES) {
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
  stringTableOffset: number,
  stringTableBytes: number,
): StarCatalog {
  const positionsParsec = new Float32Array(count * 3);
  const velocitiesParsecPerYear = new Float32Array(count * 3);
  const apparentMagnitudes = new Float32Array(count);
  const colorIndicesBv = new Float32Array(count);
  const catalogIds = new Uint32Array(count);
  const names = new Array<string>(count);
  const aliases = new Array<readonly string[]>(count);
  const spectralTypes = new Array<string | null>(count);
  const seenIds = new Set<number>();
  const stringTable = new Uint8Array(view.buffer, stringTableOffset, stringTableBytes);
  const decodedStrings = new Map<number, string>();
  const decoder = new TextDecoder('utf-8', { fatal: true });
  let previousMagnitude = Number.NEGATIVE_INFINITY;

  for (let index = 0; index < count; index += 1) {
    const inputOffset = STAR_CATALOG_HEADER_BYTES + index * STAR_CATALOG_RECORD_BYTES;
    const outputOffset = index * 3;
    const x = view.getFloat32(inputOffset, true);
    const y = view.getFloat32(inputOffset + 4, true);
    const z = view.getFloat32(inputOffset + 8, true);
    const magnitude = view.getFloat32(inputOffset + 12, true);
    const colorIndex = view.getFloat32(inputOffset + 16, true);
    const catalogId = view.getUint32(inputOffset + 20, true);
    const nameOffset = view.getUint32(inputOffset + 24, true);
    const aliasesOffset = view.getUint32(inputOffset + 28, true);
    const spectralTypeOffset = view.getUint32(inputOffset + 32, true);
    const vx = view.getFloat32(inputOffset + 36, true);
    const vy = view.getFloat32(inputOffset + 40, true);
    const vz = view.getFloat32(inputOffset + 44, true);
    const name = decodeString(stringTable, nameOffset, decoder, decodedStrings, index);
    const aliasesValue = decodeString(stringTable, aliasesOffset, decoder, decodedStrings, index);
    const spectralType = decodeString(
      stringTable,
      spectralTypeOffset,
      decoder,
      decodedStrings,
      index,
    );

    if (
      !Number.isFinite(x) ||
      !Number.isFinite(y) ||
      !Number.isFinite(z) ||
      Math.hypot(x, y, z) === 0 ||
      !Number.isFinite(magnitude) ||
      !Number.isFinite(colorIndex) ||
      !Number.isFinite(vx) ||
      !Number.isFinite(vy) ||
      !Number.isFinite(vz) ||
      catalogId === 0 ||
      !name
    ) {
      throw invalidCatalog(`enregistrement invalide à l’index ${index}`);
    }
    if (magnitude < previousMagnitude) {
      throw invalidCatalog(`tri par magnitude invalide à l’index ${index}`);
    }
    if (seenIds.has(catalogId)) {
      throw invalidCatalog(`identifiant HYG dupliqué (${catalogId})`);
    }

    positionsParsec[outputOffset] = x;
    positionsParsec[outputOffset + 1] = y;
    positionsParsec[outputOffset + 2] = z;
    velocitiesParsecPerYear[outputOffset] = vx;
    velocitiesParsecPerYear[outputOffset + 1] = vy;
    velocitiesParsecPerYear[outputOffset + 2] = vz;
    apparentMagnitudes[index] = magnitude;
    colorIndicesBv[index] = colorIndex;
    catalogIds[index] = catalogId;
    names[index] = name;
    aliases[index] = aliasesValue ? aliasesValue.split(STRING_SEPARATOR) : [];
    spectralTypes[index] = spectralType || null;
    previousMagnitude = magnitude;
    seenIds.add(catalogId);
  }

  return {
    count,
    referenceEpochJulianDay,
    positionsParsec,
    velocitiesParsecPerYear,
    apparentMagnitudes,
    colorIndicesBv,
    catalogIds,
    names,
    aliases,
    spectralTypes,
  };
}

function decodeString(
  stringTable: Uint8Array,
  offset: number,
  decoder: TextDecoder,
  cache: Map<number, string>,
  recordIndex: number,
): string {
  const cached = cache.get(offset);

  if (cached !== undefined) {
    return cached;
  }
  if (offset >= stringTable.byteLength) {
    throw invalidCatalog(`offset de chaîne invalide à l’index ${recordIndex}`);
  }
  let end = offset;

  while (end < stringTable.byteLength && stringTable[end] !== 0) {
    end += 1;
  }
  if (end >= stringTable.byteLength) {
    throw invalidCatalog(`chaîne non terminée à l’index ${recordIndex}`);
  }

  try {
    const value = decoder.decode(stringTable.subarray(offset, end));

    cache.set(offset, value);

    return value;
  } catch {
    throw invalidCatalog(`chaîne UTF-8 invalide à l’index ${recordIndex}`);
  }
}

function invalidCatalog(reason: string): Error {
  return new Error(`Catalogue stellaire binaire invalide : ${reason}.`);
}
