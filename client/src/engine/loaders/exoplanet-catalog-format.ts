export const EXOPLANET_CATALOG_MAGIC = 'UMEX';
export const EXOPLANET_CATALOG_VERSION = 1;
export const EXOPLANET_CATALOG_HEADER_BYTES = 32;
export const EXOPLANET_CATALOG_HOST_RECORD_BYTES = 64;
export const EXOPLANET_CATALOG_PLANET_RECORD_BYTES = 72;

const MAXIMUM_HOST_COUNT = 1_000_000;
const MAXIMUM_PLANET_COUNT = 10_000_000;

export interface ExoplanetCatalogHeader {
  readonly view: DataView;
  readonly hostCount: number;
  readonly planetCount: number;
  readonly planetRecordsOffset: number;
  readonly stringTableOffset: number;
  readonly stringTableBytes: number;
}

export function parseExoplanetCatalogHeader(buffer: ArrayBuffer): ExoplanetCatalogHeader {
  if (buffer.byteLength < EXOPLANET_CATALOG_HEADER_BYTES) {
    throw invalidExoplanetCatalog('en-tête tronqué');
  }
  const view = new DataView(buffer);

  assertMagic(view);
  assertDimensions(view);
  const hostCount = view.getUint32(12, true);
  const planetCount = view.getUint32(16, true);
  const planetRecordsOffset = view.getUint32(20, true);
  const stringTableOffset = view.getUint32(24, true);
  const stringTableBytes = view.getUint32(28, true);
  const expectedPlanetOffset =
    EXOPLANET_CATALOG_HEADER_BYTES + hostCount * EXOPLANET_CATALOG_HOST_RECORD_BYTES;
  const expectedStringOffset =
    expectedPlanetOffset + planetCount * EXOPLANET_CATALOG_PLANET_RECORD_BYTES;

  if (hostCount === 0 || hostCount > MAXIMUM_HOST_COUNT) {
    throw invalidExoplanetCatalog(`nombre d’hôtes hors limites (${hostCount})`);
  }
  if (planetCount === 0 || planetCount > MAXIMUM_PLANET_COUNT) {
    throw invalidExoplanetCatalog(`nombre de planètes hors limites (${planetCount})`);
  }
  if (planetRecordsOffset !== expectedPlanetOffset) {
    throw invalidExoplanetCatalog('enregistrements mal positionnés');
  }
  if (stringTableOffset !== expectedStringOffset || stringTableBytes === 0) {
    throw invalidExoplanetCatalog('table de chaînes mal positionnée');
  }
  if (buffer.byteLength !== stringTableOffset + stringTableBytes) {
    throw invalidExoplanetCatalog(
      `taille inattendue (${buffer.byteLength} octets au lieu de ${stringTableOffset + stringTableBytes})`,
    );
  }

  return {
    view,
    hostCount,
    planetCount,
    planetRecordsOffset,
    stringTableOffset,
    stringTableBytes,
  };
}

export function invalidExoplanetCatalog(reason: string): Error {
  return new Error(`Catalogue d’exoplanètes binaire invalide : ${reason}.`);
}

function assertMagic(view: DataView): void {
  for (let index = 0; index < EXOPLANET_CATALOG_MAGIC.length; index += 1) {
    if (view.getUint8(index) !== EXOPLANET_CATALOG_MAGIC.charCodeAt(index)) {
      throw invalidExoplanetCatalog('signature inconnue');
    }
  }
}

function assertDimensions(view: DataView): void {
  if (view.getUint16(4, true) !== EXOPLANET_CATALOG_VERSION) {
    throw invalidExoplanetCatalog(`version non prise en charge (${view.getUint16(4, true)})`);
  }
  if (
    view.getUint16(6, true) !== EXOPLANET_CATALOG_HEADER_BYTES ||
    view.getUint16(8, true) !== EXOPLANET_CATALOG_HOST_RECORD_BYTES ||
    view.getUint16(10, true) !== EXOPLANET_CATALOG_PLANET_RECORD_BYTES
  ) {
    throw invalidExoplanetCatalog('dimensions incompatibles');
  }
}
