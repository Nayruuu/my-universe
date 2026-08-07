import {
  EXOPLANET_CATALOG_HEADER_BYTES,
  EXOPLANET_CATALOG_HOST_RECORD_BYTES,
  EXOPLANET_CATALOG_MAGIC,
  EXOPLANET_CATALOG_PLANET_RECORD_BYTES,
  EXOPLANET_CATALOG_VERSION,
  parseExoplanetCatalogHeader,
} from './exoplanet-catalog-format';

describe('parseExoplanetCatalogHeader', () => {
  it('decodes a self-consistent binary layout', () => {
    const buffer = createHeaderBuffer();
    const header = parseExoplanetCatalogHeader(buffer);

    expect(header.hostCount).toBe(1);
    expect(header.planetCount).toBe(1);
    expect(header.planetRecordsOffset).toBe(
      EXOPLANET_CATALOG_HEADER_BYTES + EXOPLANET_CATALOG_HOST_RECORD_BYTES,
    );
    expect(header.stringTableOffset).toBe(
      header.planetRecordsOffset + EXOPLANET_CATALOG_PLANET_RECORD_BYTES,
    );
    expect(header.stringTableBytes).toBe(1);
    expect(header.view.buffer).toBe(buffer);
  });

  it('rejects an inconsistent container before record decoding', () => {
    const buffer = createHeaderBuffer();

    new DataView(buffer).setUint32(20, 42, true);

    expect(() => parseExoplanetCatalogHeader(buffer)).toThrow(/enregistrements mal positionnés/u);
  });
});

function createHeaderBuffer(): ArrayBuffer {
  const planetRecordsOffset = EXOPLANET_CATALOG_HEADER_BYTES + EXOPLANET_CATALOG_HOST_RECORD_BYTES;
  const stringTableOffset = planetRecordsOffset + EXOPLANET_CATALOG_PLANET_RECORD_BYTES;
  const buffer = new ArrayBuffer(stringTableOffset + 1);
  const view = new DataView(buffer);

  for (let index = 0; index < EXOPLANET_CATALOG_MAGIC.length; index += 1) {
    view.setUint8(index, EXOPLANET_CATALOG_MAGIC.charCodeAt(index));
  }
  view.setUint16(4, EXOPLANET_CATALOG_VERSION, true);
  view.setUint16(6, EXOPLANET_CATALOG_HEADER_BYTES, true);
  view.setUint16(8, EXOPLANET_CATALOG_HOST_RECORD_BYTES, true);
  view.setUint16(10, EXOPLANET_CATALOG_PLANET_RECORD_BYTES, true);
  view.setUint32(12, 1, true);
  view.setUint32(16, 1, true);
  view.setUint32(20, planetRecordsOffset, true);
  view.setUint32(24, stringTableOffset, true);
  view.setUint32(28, 1, true);

  return buffer;
}
