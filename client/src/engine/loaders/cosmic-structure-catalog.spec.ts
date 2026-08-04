import {
  COSMIC_STRUCTURE_CATALOG_HEADER_BYTES,
  COSMIC_STRUCTURE_CATALOG_MAGIC,
  COSMIC_STRUCTURE_CATALOG_RECORD_BYTES,
  COSMIC_STRUCTURE_CATALOG_VERSION,
  CosmicStructureCatalogMetadata,
  parseCosmicStructureCatalog,
  parseCosmicStructureCatalogMetadata,
} from './cosmic-structure-catalog';

interface TestStructure {
  readonly identifier: string;
  readonly sourceIndex: number;
  readonly typeCode: number;
  readonly positionMpc: readonly [number, number, number];
  readonly radiusMpc: number;
  readonly confidence: number;
  readonly densityContrast: number;
  readonly boundaryDistanceMpc: number;
  readonly galaxyCount: number;
  readonly catalogNumericId: number;
  readonly flags: number;
}

const TEST_STRUCTURES: readonly TestStructure[] = [
  {
    identifier: '239+027+0091',
    sourceIndex: 0,
    typeCode: 1,
    positionMpc: [-176.1, 163.7, -287.8],
    radiusMpc: 35.9,
    confidence: 0.98,
    densityContrast: Number.NaN,
    boundaryDistanceMpc: Number.NaN,
    galaxyCount: 1_038,
    catalogNumericId: 1,
    flags: 0,
  },
  {
    identifier: 'CMASS-North-60',
    sourceIndex: 1,
    typeCode: 4,
    positionMpc: [-785.1, 1_438.4, 1_686.4],
    radiusMpc: 46.14,
    confidence: 1,
    densityContrast: -0.717,
    boundaryDistanceMpc: 75.006,
    galaxyCount: 35,
    catalogNumericId: 60,
    flags: 0,
  },
];

const TEST_METADATA: CosmicStructureCatalogMetadata = {
  version: '1.0.0',
  recordCount: 2,
  referenceEpochJulianDay: 2_451_545,
  referenceFrame: 'equatorial-j2000',
  distanceUnit: 'megaparsec',
  scientificConfidence: 'calculated',
  sources: [
    {
      id: 'sdss-main50',
      name: 'SDSS superclusters',
      citation: 'Liivamägi et al. (2012)',
      sourceUrl: 'https://example.test/superclusters',
      structureType: 'supercluster',
      method: 'Luminosity density field',
      objectNamePrefix: 'Superamas SDSS',
      scientificConfidence: 'calculated',
      recordCount: 1,
    },
    {
      id: 'boss-voids',
      name: 'BOSS voids',
      citation: 'Mao et al. (2017)',
      sourceUrl: 'https://example.test/voids',
      structureType: 'void',
      method: 'ZOBOV',
      objectNamePrefix: 'Vide BOSS',
      scientificConfidence: 'calculated',
      recordCount: 1,
    },
  ],
};

describe('parseCosmicStructureCatalogMetadata', () => {
  it('valide les sources, méthodes, types et cardinalités documentés', () => {
    expect(parseCosmicStructureCatalogMetadata(TEST_METADATA, 'test')).toEqual(TEST_METADATA);
    const metadataWithChecksum = {
      ...TEST_METADATA,
      sources: TEST_METADATA.sources.map((entry) => ({
        ...entry,
        sourceSha256: 'documented-checksum',
      })),
    };

    expect(parseCosmicStructureCatalogMetadata(metadataWithChecksum, 'test')).toEqual(
      metadataWithChecksum,
    );
  });

  it('rejette une racine, une source ou une somme de cardinalités invalide', () => {
    expect(() => parseCosmicStructureCatalogMetadata(null, 'test')).toThrow(/métadonnées/i);
    expect(() =>
      parseCosmicStructureCatalogMetadata({ ...TEST_METADATA, version: 1 }, 'test'),
    ).toThrow(/métadonnées/i);
    expect(() =>
      parseCosmicStructureCatalogMetadata(
        { ...TEST_METADATA, sources: [{ ...TEST_METADATA.sources[0], method: '' }] },
        'test',
      ),
    ).toThrow(/source.*index 0/i);
    expect(() =>
      parseCosmicStructureCatalogMetadata(
        {
          ...TEST_METADATA,
          sources: [{ ...TEST_METADATA.sources[0], sourceSha256: '' }, TEST_METADATA.sources[1]],
        },
        'test',
      ),
    ).toThrow(/source.*index 0/i);
    expect(() =>
      parseCosmicStructureCatalogMetadata(
        { ...TEST_METADATA, sources: [TEST_METADATA.sources[0], TEST_METADATA.sources[0]] },
        'test',
      ),
    ).toThrow(/dupliquée/);
    expect(() =>
      parseCosmicStructureCatalogMetadata(
        {
          ...TEST_METADATA,
          sources: [{ ...TEST_METADATA.sources[0], recordCount: 2 }, TEST_METADATA.sources[1]],
        },
        'test',
      ),
    ).toThrow(/cardinalité/i);
  });
});

describe('parseCosmicStructureCatalog', () => {
  it('décode toutes les mesures, identifiants et provenances sans objet individuel', () => {
    const catalog = parseCosmicStructureCatalog(createCatalogBuffer(), TEST_METADATA);

    expect(catalog.count).toBe(2);
    expect(catalog.referenceEpochJulianDay).toBe(2_451_545);
    expect(catalog.minimumDistanceMpc).toBeCloseTo(structureDistance(TEST_STRUCTURES[0]!), 4);
    expect(catalog.maximumDistanceMpc).toBeCloseTo(structureDistance(TEST_STRUCTURES[1]!), 3);
    expect(catalog.identifiers).toEqual(['239+027+0091', 'CMASS-North-60']);
    expect(catalog.sourceIndices).toEqual(new Uint16Array([0, 1]));
    expect(catalog.structureTypes).toEqual(['supercluster', 'void']);
    expect(catalog.radiiMpc[0]).toBeCloseTo(35.9, 4);
    expect(catalog.confidences[0]).toBeCloseTo(0.98, 5);
    expect(catalog.densityContrasts[1]).toBeCloseTo(-0.717, 5);
    expect(catalog.boundaryDistancesMpc[1]).toBeCloseTo(75.006, 4);
    expect(catalog.galaxyCounts).toEqual(new Uint32Array([1_038, 35]));
    expect(catalog.catalogNumericIds).toEqual(new Uint16Array([1, 60]));
    expect(catalog.metadata).toBe(TEST_METADATA);
  });

  it('rejette les dimensions, options, cardinalités et référentiels inconnus', () => {
    const short = new ArrayBuffer(8);
    const invalidMagic = createCatalogBuffer();
    const invalidVersion = createCatalogBuffer();
    const invalidHeader = createCatalogBuffer();
    const invalidRecord = createCatalogBuffer();
    const invalidFlags = createCatalogBuffer();
    const invalidFrame = createCatalogBuffer();
    const invalidSourceCount = createCatalogBuffer();
    const invalidCount = createCatalogBuffer();

    new DataView(invalidMagic).setUint8(0, 'X'.charCodeAt(0));
    new DataView(invalidVersion).setUint16(4, 9, true);
    new DataView(invalidHeader).setUint16(6, 12, true);
    new DataView(invalidRecord).setUint16(8, 12, true);
    new DataView(invalidFlags).setUint16(10, 1, true);
    new DataView(invalidFrame).setUint16(18, 9, true);
    new DataView(invalidSourceCount).setUint16(16, 1, true);
    new DataView(invalidCount).setUint32(12, 1_000_001, true);

    expect(() => parseCosmicStructureCatalog(short, TEST_METADATA)).toThrow(/en-tête tronqué/);
    expect(() => parseCosmicStructureCatalog(invalidMagic, TEST_METADATA)).toThrow(/signature/);
    expect(() => parseCosmicStructureCatalog(invalidVersion, TEST_METADATA)).toThrow(/version/);
    expect(() => parseCosmicStructureCatalog(invalidHeader, TEST_METADATA)).toThrow(/dimensions/);
    expect(() => parseCosmicStructureCatalog(invalidRecord, TEST_METADATA)).toThrow(/dimensions/);
    expect(() => parseCosmicStructureCatalog(invalidFlags, TEST_METADATA)).toThrow(/options/);
    expect(() => parseCosmicStructureCatalog(invalidFrame, TEST_METADATA)).toThrow(/référentiel/);
    expect(() => parseCosmicStructureCatalog(invalidSourceCount, TEST_METADATA)).toThrow(/sources/);
    expect(() => parseCosmicStructureCatalog(invalidCount, TEST_METADATA)).toThrow(/structures/);
  });

  it('rejette une époque, des limites, une table de chaînes ou une taille incohérentes', () => {
    const invalidEpoch = createCatalogBuffer();
    const mismatchedEpoch = createCatalogBuffer();
    const invalidMinimum = createCatalogBuffer();
    const invalidMaximum = createCatalogBuffer();
    const invalidStringSize = createCatalogBuffer();
    const extended = new Uint8Array(createCatalogBuffer().byteLength + 1);

    extended.set(new Uint8Array(createCatalogBuffer()));
    new DataView(invalidEpoch).setFloat64(20, Number.NaN, true);
    new DataView(mismatchedEpoch).setFloat64(20, 2_451_546, true);
    new DataView(invalidMinimum).setFloat32(28, 0, true);
    new DataView(invalidMaximum).setFloat32(32, 1, true);
    new DataView(invalidStringSize).setUint32(36, 1_000_000, true);

    expect(() => parseCosmicStructureCatalog(invalidEpoch, TEST_METADATA)).toThrow(/époque/);
    expect(() => parseCosmicStructureCatalog(mismatchedEpoch, TEST_METADATA)).toThrow(/époque/);
    expect(() => parseCosmicStructureCatalog(invalidMinimum, TEST_METADATA)).toThrow(/limites/);
    expect(() => parseCosmicStructureCatalog(invalidMaximum, TEST_METADATA)).toThrow(/limites/);
    expect(() => parseCosmicStructureCatalog(invalidStringSize, TEST_METADATA)).toThrow(/taille/);
    expect(() => parseCosmicStructureCatalog(extended.buffer, TEST_METADATA)).toThrow(/taille/);
  });

  it.each([
    ['position', 0, Number.NaN],
    ['distance', 12, 0],
    ['rayon', 16, -1],
    ['confiance', 20, 2],
    ['contraste', 24, Number.POSITIVE_INFINITY],
    ['bordure', 28, 0],
  ])('rejette une %s scientifique invalide', (_label, relativeOffset, value) => {
    const buffer = createCatalogBuffer();

    new DataView(buffer).setFloat32(
      COSMIC_STRUCTURE_CATALOG_HEADER_BYTES + relativeOffset,
      value,
      true,
    );

    expect(() => parseCosmicStructureCatalog(buffer, TEST_METADATA)).toThrow(/enregistrement/);
  });

  it('rejette les identifiants, sources, types, compteurs et normes incompatibles', () => {
    const emptyIdentifier = createCatalogBuffer();
    const invalidSource = createCatalogBuffer();
    const invalidType = createCatalogBuffer();
    const mismatchedType = createCatalogBuffer();
    const unknownMembers = createCatalogBuffer();
    const emptyCatalogId = createCatalogBuffer();
    const invalidNorm = createCatalogBuffer();
    const invalidBounds = createCatalogBuffer();
    const duplicate = createCatalogBuffer([
      TEST_STRUCTURES[0]!,
      {
        ...TEST_STRUCTURES[1]!,
        sourceIndex: 0,
        typeCode: 1,
        identifier: TEST_STRUCTURES[0]!.identifier,
      },
    ]);
    const blankIdentifier = createCatalogBuffer();
    const mismatchedSourceCardinality = {
      ...TEST_METADATA,
      sources: [
        { ...TEST_METADATA.sources[0]!, recordCount: 2 },
        { ...TEST_METADATA.sources[1]!, recordCount: 0 },
      ],
    } as CosmicStructureCatalogMetadata;
    const second = COSMIC_STRUCTURE_CATALOG_HEADER_BYTES + COSMIC_STRUCTURE_CATALOG_RECORD_BYTES;
    const stringTableOffset =
      COSMIC_STRUCTURE_CATALOG_HEADER_BYTES +
      TEST_STRUCTURES.length * COSMIC_STRUCTURE_CATALOG_RECORD_BYTES;
    const firstIdentifierLength = new TextEncoder().encode(TEST_STRUCTURES[0]!.identifier).length;

    new DataView(emptyIdentifier).setUint16(COSMIC_STRUCTURE_CATALOG_HEADER_BYTES + 40, 0, true);
    new DataView(invalidSource).setUint16(COSMIC_STRUCTURE_CATALOG_HEADER_BYTES + 42, 2, true);
    new DataView(invalidType).setUint8(COSMIC_STRUCTURE_CATALOG_HEADER_BYTES + 44, 9);
    new DataView(mismatchedType).setUint8(COSMIC_STRUCTURE_CATALOG_HEADER_BYTES + 44, 4);
    new DataView(unknownMembers).setUint32(COSMIC_STRUCTURE_CATALOG_HEADER_BYTES + 32, 0, true);
    new DataView(emptyCatalogId).setUint16(COSMIC_STRUCTURE_CATALOG_HEADER_BYTES + 46, 0, true);
    new DataView(invalidNorm).setFloat32(COSMIC_STRUCTURE_CATALOG_HEADER_BYTES, 1, true);
    new DataView(invalidBounds).setFloat32(28, 10, true);
    new DataView(duplicate).setUint32(second + 36, 0, true);
    new DataView(duplicate).setUint16(
      second + 40,
      new TextEncoder().encode(TEST_STRUCTURES[0]!.identifier).length,
      true,
    );
    new Uint8Array(blankIdentifier, stringTableOffset, firstIdentifierLength).fill(32);

    expect(() => parseCosmicStructureCatalog(emptyIdentifier, TEST_METADATA)).toThrow(
      /identifiant/,
    );
    expect(() => parseCosmicStructureCatalog(invalidSource, TEST_METADATA)).toThrow(/source/);
    expect(() => parseCosmicStructureCatalog(invalidType, TEST_METADATA)).toThrow(/type/);
    expect(() => parseCosmicStructureCatalog(mismatchedType, TEST_METADATA)).toThrow(/type/);
    expect(parseCosmicStructureCatalog(unknownMembers, TEST_METADATA).galaxyCounts[0]).toBe(0);
    expect(() => parseCosmicStructureCatalog(emptyCatalogId, TEST_METADATA)).toThrow(
      /enregistrement/,
    );
    expect(() => parseCosmicStructureCatalog(invalidNorm, TEST_METADATA)).toThrow(/cartésienne/);
    expect(() => parseCosmicStructureCatalog(invalidBounds, TEST_METADATA)).toThrow(/bornes/);
    expect(() => parseCosmicStructureCatalog(duplicate, TEST_METADATA)).toThrow(/dupliqué/);
    expect(() => parseCosmicStructureCatalog(blankIdentifier, TEST_METADATA)).toThrow(
      /identifiant/,
    );
    expect(() =>
      parseCosmicStructureCatalog(createCatalogBuffer(), mismatchedSourceCardinality),
    ).toThrow(/cardinalité de source/);
  });
});

function createCatalogBuffer(structures: readonly TestStructure[] = TEST_STRUCTURES): ArrayBuffer {
  const encoder = new TextEncoder();
  const identifiers = structures.map(({ identifier }) => encoder.encode(identifier));
  const stringBytes = identifiers.reduce((sum, identifier) => sum + identifier.length, 0);
  const buffer = new ArrayBuffer(
    COSMIC_STRUCTURE_CATALOG_HEADER_BYTES +
      structures.length * COSMIC_STRUCTURE_CATALOG_RECORD_BYTES +
      stringBytes,
  );
  const view = new DataView(buffer);

  for (let index = 0; index < COSMIC_STRUCTURE_CATALOG_MAGIC.length; index += 1) {
    view.setUint8(index, COSMIC_STRUCTURE_CATALOG_MAGIC.charCodeAt(index));
  }
  view.setUint16(4, COSMIC_STRUCTURE_CATALOG_VERSION, true);
  view.setUint16(6, COSMIC_STRUCTURE_CATALOG_HEADER_BYTES, true);
  view.setUint16(8, COSMIC_STRUCTURE_CATALOG_RECORD_BYTES, true);
  view.setUint16(10, 0, true);
  view.setUint32(12, structures.length, true);
  view.setUint16(16, TEST_METADATA.sources.length, true);
  view.setUint16(18, 1, true);
  view.setFloat64(20, 2_451_545, true);
  view.setFloat32(28, Math.min(...structures.map(structureDistance)), true);
  view.setFloat32(32, Math.max(...structures.map(structureDistance)), true);
  view.setUint32(36, stringBytes, true);
  view.setUint32(40, 0xff, true);
  view.setUint32(44, 0, true);
  const stringOffset =
    COSMIC_STRUCTURE_CATALOG_HEADER_BYTES +
    structures.length * COSMIC_STRUCTURE_CATALOG_RECORD_BYTES;
  let identifierOffset = 0;

  for (let index = 0; index < structures.length; index += 1) {
    const structure = structures[index]!;
    const identifier = identifiers[index]!;
    const offset =
      COSMIC_STRUCTURE_CATALOG_HEADER_BYTES + index * COSMIC_STRUCTURE_CATALOG_RECORD_BYTES;
    const distance = structureDistance(structure);

    view.setFloat32(offset, structure.positionMpc[0], true);
    view.setFloat32(offset + 4, structure.positionMpc[1], true);
    view.setFloat32(offset + 8, structure.positionMpc[2], true);
    view.setFloat32(offset + 12, distance, true);
    view.setFloat32(offset + 16, structure.radiusMpc, true);
    view.setFloat32(offset + 20, structure.confidence, true);
    view.setFloat32(offset + 24, structure.densityContrast, true);
    view.setFloat32(offset + 28, structure.boundaryDistanceMpc, true);
    view.setUint32(offset + 32, structure.galaxyCount, true);
    view.setUint32(offset + 36, identifierOffset, true);
    view.setUint16(offset + 40, identifier.length, true);
    view.setUint16(offset + 42, structure.sourceIndex, true);
    view.setUint8(offset + 44, structure.typeCode);
    view.setUint8(offset + 45, structure.flags);
    view.setUint16(offset + 46, structure.catalogNumericId, true);
    new Uint8Array(buffer, stringOffset + identifierOffset, identifier.length).set(identifier);
    identifierOffset += identifier.length;
  }

  return buffer;
}

function structureDistance(structure: TestStructure): number {
  return Math.hypot(...structure.positionMpc);
}
