import {
  COSMIC_GROUP_CATALOG_EDGE_BYTES,
  COSMIC_GROUP_CATALOG_HEADER_BYTES,
  COSMIC_GROUP_CATALOG_MAGIC,
  COSMIC_GROUP_CATALOG_RECORD_BYTES,
  COSMIC_GROUP_CATALOG_VERSION,
  parseCosmicGroupCatalog,
} from './cosmic-group-catalog';

interface TestGroup {
  readonly pgcId: number;
  readonly positionMpc: readonly [number, number, number];
  readonly distanceMpc: number;
  readonly distanceModulusError: number;
  readonly velocityCmbKmPerSecond: number;
  readonly distanceModulus: number;
}

const TEST_GROUPS: readonly TestGroup[] = [
  {
    pgcId: 35,
    positionMpc: [12.1, 0, 0],
    distanceMpc: 12.1,
    distanceModulusError: 0.1,
    velocityCmbKmPerSecond: 28,
    distanceModulus: 30.413,
  },
  {
    pgcId: 12,
    positionMpc: [98.993, -11.08, 0.062],
    distanceMpc: 99.611,
    distanceModulusError: 0.41,
    velocityCmbKmPerSecond: 6_179,
    distanceModulus: 34.995,
  },
];
const TEST_FILAMENT_PAIRS = new Uint32Array([0, 1]);

describe('parseCosmicGroupCatalog', () => {
  it('décode le format UMCG little-endian et conserve les mesures Cosmicflows-4', () => {
    const catalog = parseCosmicGroupCatalog(createCatalogBuffer(TEST_GROUPS));

    expect(catalog.count).toBe(2);
    expect(catalog.referenceEpochJulianDay).toBe(2_451_545);
    expect(catalog.pgcIds).toEqual(new Uint32Array([35, 12]));
    expect(catalog.positionsMpc[0]).toBeCloseTo(12.1, 5);
    expect(catalog.positionsMpc[4]).toBeCloseTo(-11.08, 4);
    expect(catalog.distancesMpc[1]).toBeCloseTo(99.611, 4);
    expect(catalog.distanceModulusErrors[0]).toBeCloseTo(0.1, 5);
    expect(catalog.velocitiesCmbKmPerSecond).toEqual(new Int32Array([28, 6_179]));
    expect(catalog.distanceModuli[1]).toBeCloseTo(34.995, 4);
    expect(catalog.filamentPairs).toEqual(TEST_FILAMENT_PAIRS);
    expect(catalog.minimumDistanceMpc).toBeCloseTo(12.1, 5);
    expect(catalog.maximumDistanceMpc).toBeCloseTo(99.611, 4);
  });

  it('rejette une signature, une version ou un référentiel inconnus', () => {
    const invalidMagic = createCatalogBuffer(TEST_GROUPS);
    const invalidVersion = createCatalogBuffer(TEST_GROUPS);
    const invalidFrame = createCatalogBuffer(TEST_GROUPS);

    new DataView(invalidMagic).setUint8(0, 'X'.charCodeAt(0));
    new DataView(invalidVersion).setUint16(4, 99, true);
    new DataView(invalidFrame).setUint32(24, 99, true);

    expect(() => parseCosmicGroupCatalog(invalidMagic)).toThrow(/signature inconnue/);
    expect(() => parseCosmicGroupCatalog(invalidVersion)).toThrow(/version non prise en charge/);
    expect(() => parseCosmicGroupCatalog(invalidFrame)).toThrow(/référentiel inconnu/);
  });

  it('rejette un fichier tronqué, prolongé ou une cardinalité de groupes hors limites', () => {
    const valid = createCatalogBuffer(TEST_GROUPS);
    const empty = createCatalogBuffer(TEST_GROUPS);
    const excessive = createCatalogBuffer(TEST_GROUPS);
    const extended = new Uint8Array(valid.byteLength + 1);

    extended.set(new Uint8Array(valid));

    new DataView(empty).setUint32(12, 0, true);
    new DataView(excessive).setUint32(12, 100_001, true);

    expect(() => parseCosmicGroupCatalog(new ArrayBuffer(8))).toThrow(/en-tête tronqué/);
    expect(() => parseCosmicGroupCatalog(valid.slice(0, -1))).toThrow(/taille inattendue/);
    expect(() => parseCosmicGroupCatalog(extended.buffer)).toThrow(/taille inattendue/);
    expect(() => parseCosmicGroupCatalog(empty)).toThrow(/nombre de groupes hors limites/);
    expect(() => parseCosmicGroupCatalog(excessive)).toThrow(/nombre de groupes hors limites/);
  });

  it('rejette toutes les dimensions et options d’en-tête incompatibles', () => {
    const invalidHeader = createCatalogBuffer(TEST_GROUPS);
    const invalidRecord = createCatalogBuffer(TEST_GROUPS);
    const invalidFlags = createCatalogBuffer(TEST_GROUPS);

    new DataView(invalidHeader).setUint16(6, 42, true);
    new DataView(invalidRecord).setUint16(8, 42, true);
    new DataView(invalidFlags).setUint16(10, 1, true);

    expect(() => parseCosmicGroupCatalog(invalidHeader)).toThrow(/dimensions d’enregistrement/);
    expect(() => parseCosmicGroupCatalog(invalidRecord)).toThrow(/dimensions d’enregistrement/);
    expect(() => parseCosmicGroupCatalog(invalidFlags)).toThrow(/options binaires/);
  });

  it('rejette une cardinalité ou des paires de filaments incompatibles', () => {
    const excessive = createCatalogBuffer(TEST_GROUPS);
    const reversed = createCatalogBuffer(TEST_GROUPS, new Uint32Array([1, 0]));
    const selfEdge = createCatalogBuffer(TEST_GROUPS, new Uint32Array([0, 0]));
    const outOfRange = createCatalogBuffer(TEST_GROUPS, new Uint32Array([0, 2]));
    const duplicate = createCatalogBuffer(TEST_GROUPS, new Uint32Array([0, 1, 0, 1]));

    new DataView(excessive).setUint32(36, TEST_GROUPS.length * 2 + 1, true);

    expect(() => parseCosmicGroupCatalog(excessive)).toThrow(/nombre de filaments hors limites/);
    expect(() => parseCosmicGroupCatalog(reversed)).toThrow(/paire de filament invalide/);
    expect(() => parseCosmicGroupCatalog(selfEdge)).toThrow(/paire de filament invalide/);
    expect(() => parseCosmicGroupCatalog(outOfRange)).toThrow(/paire de filament invalide/);
    expect(() => parseCosmicGroupCatalog(duplicate)).toThrow(/paire de filament dupliquée/);
  });

  it('rejette une époque ou des limites scientifiques incohérentes', () => {
    const invalidEpoch = createCatalogBuffer(TEST_GROUPS);
    const invalidMinimum = createCatalogBuffer(TEST_GROUPS);
    const invalidMaximum = createCatalogBuffer(TEST_GROUPS);

    new DataView(invalidEpoch).setFloat64(16, Number.NaN, true);
    new DataView(invalidMinimum).setFloat32(28, 0, true);
    new DataView(invalidMaximum).setFloat32(32, 10, true);

    expect(() => parseCosmicGroupCatalog(invalidEpoch)).toThrow(/époque de référence invalide/);
    expect(() => parseCosmicGroupCatalog(invalidMinimum)).toThrow(/limites de distance invalides/);
    expect(() => parseCosmicGroupCatalog(invalidMaximum)).toThrow(/limites de distance invalides/);
  });

  it.each([
    ['coordonnée x', 0, Number.POSITIVE_INFINITY],
    ['coordonnée y', 4, Number.NaN],
    ['coordonnée z', 8, Number.NEGATIVE_INFINITY],
    ['distance', 12, Number.NaN],
    ['incertitude', 16, -1],
    ['module de distance', 28, Number.NaN],
  ])('rejette un enregistrement dont la %s est invalide', (_label, offset, value) => {
    const buffer = createCatalogBuffer(TEST_GROUPS);

    new DataView(buffer).setFloat32(COSMIC_GROUP_CATALOG_HEADER_BYTES + offset, value, true);

    expect(() => parseCosmicGroupCatalog(buffer)).toThrow(/enregistrement invalide/);
  });

  it('rejette un identifiant nul, dupliqué ou un tri de distance décroissant', () => {
    const zeroId = createCatalogBuffer(TEST_GROUPS);
    const duplicateId = createCatalogBuffer(TEST_GROUPS);
    const decreasing = createCatalogBuffer([...TEST_GROUPS].reverse());

    new DataView(zeroId).setUint32(COSMIC_GROUP_CATALOG_HEADER_BYTES + 24, 0, true);
    new DataView(duplicateId).setUint32(
      COSMIC_GROUP_CATALOG_HEADER_BYTES + COSMIC_GROUP_CATALOG_RECORD_BYTES + 24,
      TEST_GROUPS[0]!.pgcId,
      true,
    );

    expect(() => parseCosmicGroupCatalog(zeroId)).toThrow(/enregistrement invalide/);
    expect(() => parseCosmicGroupCatalog(duplicateId)).toThrow(/identifiant PGC dupliqué/);
    expect(() => parseCosmicGroupCatalog(decreasing)).toThrow(/tri par distance invalide/);
  });

  it('rejette une norme cartésienne ou des bornes d’en-tête incompatibles', () => {
    const invalidNorm = createCatalogBuffer(TEST_GROUPS);
    const invalidBounds = createCatalogBuffer(TEST_GROUPS);

    new DataView(invalidNorm).setFloat32(COSMIC_GROUP_CATALOG_HEADER_BYTES, 30, true);
    new DataView(invalidBounds).setFloat32(28, 13, true);

    expect(() => parseCosmicGroupCatalog(invalidNorm)).toThrow(/distance cartésienne incohérente/);
    expect(() => parseCosmicGroupCatalog(invalidBounds)).toThrow(
      /bornes du catalogue incohérentes/,
    );
  });
});

function createCatalogBuffer(
  groups: readonly TestGroup[],
  filamentPairs: Uint32Array = TEST_FILAMENT_PAIRS,
): ArrayBuffer {
  const buffer = new ArrayBuffer(
    COSMIC_GROUP_CATALOG_HEADER_BYTES +
      groups.length * COSMIC_GROUP_CATALOG_RECORD_BYTES +
      (filamentPairs.length / 2) * COSMIC_GROUP_CATALOG_EDGE_BYTES,
  );
  const view = new DataView(buffer);

  for (let index = 0; index < COSMIC_GROUP_CATALOG_MAGIC.length; index += 1) {
    view.setUint8(index, COSMIC_GROUP_CATALOG_MAGIC.charCodeAt(index));
  }
  view.setUint16(4, COSMIC_GROUP_CATALOG_VERSION, true);
  view.setUint16(6, COSMIC_GROUP_CATALOG_HEADER_BYTES, true);
  view.setUint16(8, COSMIC_GROUP_CATALOG_RECORD_BYTES, true);
  view.setUint16(10, 0, true);
  view.setUint32(12, groups.length, true);
  view.setFloat64(16, 2_451_545, true);
  view.setUint32(24, 1, true);
  view.setFloat32(28, Math.min(...groups.map((group) => group.distanceMpc)), true);
  view.setFloat32(32, Math.max(...groups.map((group) => group.distanceMpc)), true);
  view.setUint32(36, filamentPairs.length / 2, true);

  for (let index = 0; index < groups.length; index += 1) {
    const group = groups[index]!;
    const offset = COSMIC_GROUP_CATALOG_HEADER_BYTES + index * COSMIC_GROUP_CATALOG_RECORD_BYTES;

    view.setFloat32(offset, group.positionMpc[0], true);
    view.setFloat32(offset + 4, group.positionMpc[1], true);
    view.setFloat32(offset + 8, group.positionMpc[2], true);
    view.setFloat32(offset + 12, group.distanceMpc, true);
    view.setFloat32(offset + 16, group.distanceModulusError, true);
    view.setInt32(offset + 20, group.velocityCmbKmPerSecond, true);
    view.setUint32(offset + 24, group.pgcId, true);
    view.setFloat32(offset + 28, group.distanceModulus, true);
  }

  const filamentOffset =
    COSMIC_GROUP_CATALOG_HEADER_BYTES + groups.length * COSMIC_GROUP_CATALOG_RECORD_BYTES;

  for (let index = 0; index < filamentPairs.length; index += 1) {
    view.setUint32(filamentOffset + index * 4, filamentPairs[index]!, true);
  }

  return buffer;
}
