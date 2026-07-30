import {
  STAR_CATALOG_HEADER_BYTES,
  STAR_CATALOG_MAGIC,
  STAR_CATALOG_RECORD_BYTES,
  STAR_CATALOG_VERSION,
  parseStarCatalog,
} from './star-catalog';

interface TestStar {
  readonly id: number;
  readonly position: readonly [number, number, number];
  readonly magnitude: number;
  readonly colorIndex: number;
  readonly name: string;
  readonly aliases: readonly string[];
  readonly spectralType: string;
}

const TEST_STARS: readonly TestStar[] = [
  {
    id: 3_229,
    position: [-1.612, 2.628, -2.551],
    magnitude: -1.44,
    colorIndex: 0.009,
    name: 'Sirius',
    aliases: ['HIP 32349', 'α CMa'],
    spectralType: 'A0m',
  },
  {
    id: 69_558,
    position: [-0.472, -0.361, 0.033],
    magnitude: -0.62,
    colorIndex: 0.164,
    name: 'Canopus',
    aliases: ['HIP 30438'],
    spectralType: 'A9II',
  },
];

describe('parseStarCatalog', () => {
  it('décode le format UMSC little-endian sans perdre les unités scientifiques', () => {
    const catalog = parseStarCatalog(createCatalogBuffer(TEST_STARS));

    expect(catalog.count).toBe(2);
    expect(catalog.referenceEpochJulianDay).toBe(2_451_545);
    expect(catalog.catalogIds).toEqual(new Uint32Array([3_229, 69_558]));
    expect(catalog.positionsParsec[0]).toBeCloseTo(-1.612, 5);
    expect(catalog.positionsParsec[4]).toBeCloseTo(-0.361, 5);
    expect(catalog.apparentMagnitudes[0]).toBeCloseTo(-1.44, 5);
    expect(catalog.colorIndicesBv[1]).toBeCloseTo(0.164, 5);
    expect(catalog.names).toEqual(['Sirius', 'Canopus']);
    expect(catalog.aliases[0]).toEqual(['HIP 32349', 'α CMa']);
    expect(catalog.spectralTypes).toEqual(['A0m', 'A9II']);
  });

  it('rejette une signature ou une version inconnue', () => {
    const invalidMagic = createCatalogBuffer(TEST_STARS);
    const invalidVersion = createCatalogBuffer(TEST_STARS);

    new DataView(invalidMagic).setUint8(0, 'X'.charCodeAt(0));
    new DataView(invalidVersion).setUint16(4, 99, true);

    expect(() => parseStarCatalog(invalidMagic)).toThrow(/signature inconnue/);
    expect(() => parseStarCatalog(invalidVersion)).toThrow(/version non prise en charge/);
  });

  it('rejette un fichier tronqué ou prolongé', () => {
    const valid = createCatalogBuffer(TEST_STARS);

    expect(() => parseStarCatalog(valid.slice(0, valid.byteLength - 1))).toThrow(
      /taille inattendue/,
    );
    expect(() => parseStarCatalog(new ArrayBuffer(8))).toThrow(/en-tête tronqué/);
  });

  it('rejette les coordonnées non finies et les identifiants dupliqués', () => {
    const invalidCoordinate = createCatalogBuffer(TEST_STARS);
    const duplicateIdentifier = createCatalogBuffer(TEST_STARS);

    new DataView(invalidCoordinate).setFloat32(
      STAR_CATALOG_HEADER_BYTES,
      Number.POSITIVE_INFINITY,
      true,
    );
    new DataView(duplicateIdentifier).setUint32(
      STAR_CATALOG_HEADER_BYTES + STAR_CATALOG_RECORD_BYTES + 20,
      TEST_STARS[0]!.id,
      true,
    );

    expect(() => parseStarCatalog(invalidCoordinate)).toThrow(/enregistrement invalide/);
    expect(() => parseStarCatalog(duplicateIdentifier)).toThrow(/identifiant HYG dupliqué/);
  });

  it('exige un tri croissant par magnitude pour que les LOD gardent les plus brillantes', () => {
    const buffer = createCatalogBuffer([...TEST_STARS].reverse());

    expect(() => parseStarCatalog(buffer)).toThrow(/tri par magnitude invalide/);
  });

  it('rejette un offset hors de la table de chaînes', () => {
    const buffer = createCatalogBuffer(TEST_STARS);

    new DataView(buffer).setUint32(STAR_CATALOG_HEADER_BYTES + 24, 999_999, true);

    expect(() => parseStarCatalog(buffer)).toThrow(/offset de chaîne invalide/);
  });

  it('rejette les nombres d’étoiles et l’époque hors limites', () => {
    const empty = createCatalogBuffer(TEST_STARS);
    const excessive = createCatalogBuffer(TEST_STARS);
    const invalidEpoch = createCatalogBuffer(TEST_STARS);

    new DataView(empty).setUint32(12, 0, true);
    new DataView(excessive).setUint32(12, 1_000_001, true);
    new DataView(invalidEpoch).setFloat64(16, Number.NaN, true);

    expect(() => parseStarCatalog(empty)).toThrow(/nombre d’étoiles hors limites/);
    expect(() => parseStarCatalog(excessive)).toThrow(/nombre d’étoiles hors limites/);
    expect(() => parseStarCatalog(invalidEpoch)).toThrow(/époque de référence invalide/);
  });

  it('rejette une table de chaînes déplacée ou vide', () => {
    const displaced = createCatalogBuffer(TEST_STARS);
    const emptyStrings = createCatalogBuffer(TEST_STARS);
    const displacedView = new DataView(displaced);
    const emptyView = new DataView(emptyStrings);

    displacedView.setUint32(28, displacedView.getUint32(28, true) + 1, true);
    emptyView.setUint32(32, 0, true);

    expect(() => parseStarCatalog(displaced)).toThrow(/table de chaînes mal positionnée/);
    expect(() => parseStarCatalog(emptyStrings)).toThrow(/table de chaînes mal positionnée/);
  });

  it('rejette toutes les variantes d’en-tête incompatibles', () => {
    const invalidHeaderSize = createCatalogBuffer(TEST_STARS);
    const invalidRecordSize = createCatalogBuffer(TEST_STARS);
    const invalidFlags = createCatalogBuffer(TEST_STARS);
    const invalidReserved = createCatalogBuffer(TEST_STARS);
    const invalidFrame = createCatalogBuffer(TEST_STARS);

    new DataView(invalidHeaderSize).setUint16(6, 42, true);
    new DataView(invalidRecordSize).setUint16(8, 42, true);
    new DataView(invalidFlags).setUint16(10, 1, true);
    new DataView(invalidReserved).setUint32(36, 1, true);
    new DataView(invalidFrame).setUint32(24, 99, true);

    expect(() => parseStarCatalog(invalidHeaderSize)).toThrow(/dimensions d’enregistrement/);
    expect(() => parseStarCatalog(invalidRecordSize)).toThrow(/dimensions d’enregistrement/);
    expect(() => parseStarCatalog(invalidFlags)).toThrow(/options binaires/);
    expect(() => parseStarCatalog(invalidReserved)).toThrow(/options binaires/);
    expect(() => parseStarCatalog(invalidFrame)).toThrow(/référentiel inconnu/);
  });

  it.each([
    ['coordonnée y', 4, Number.POSITIVE_INFINITY],
    ['coordonnée z', 8, Number.POSITIVE_INFINITY],
    ['magnitude', 12, Number.NaN],
    ['indice de couleur', 16, Number.NaN],
  ])('rejette un enregistrement dont la %s est invalide', (_label, offset, value) => {
    const buffer = createCatalogBuffer(TEST_STARS);

    new DataView(buffer).setFloat32(STAR_CATALOG_HEADER_BYTES + offset, value, true);

    expect(() => parseStarCatalog(buffer)).toThrow(/enregistrement invalide/);
  });

  it('rejette une position nulle, un identifiant nul et un nom vide', () => {
    const zeroPosition = createCatalogBuffer(TEST_STARS);
    const zeroId = createCatalogBuffer(TEST_STARS);
    const emptyName = createCatalogBuffer(TEST_STARS);
    const zeroView = new DataView(zeroPosition);
    const idView = new DataView(zeroId);
    const nameView = new DataView(emptyName);

    zeroView.setFloat32(STAR_CATALOG_HEADER_BYTES, 0, true);
    zeroView.setFloat32(STAR_CATALOG_HEADER_BYTES + 4, 0, true);
    zeroView.setFloat32(STAR_CATALOG_HEADER_BYTES + 8, 0, true);
    idView.setUint32(STAR_CATALOG_HEADER_BYTES + 20, 0, true);
    nameView.setUint32(STAR_CATALOG_HEADER_BYTES + 24, 0, true);

    expect(() => parseStarCatalog(zeroPosition)).toThrow(/enregistrement invalide/);
    expect(() => parseStarCatalog(zeroId)).toThrow(/enregistrement invalide/);
    expect(() => parseStarCatalog(emptyName)).toThrow(/enregistrement invalide/);
  });

  it('accepte les alias et types spectraux absents en réutilisant le cache de chaînes', () => {
    const catalog = parseStarCatalog(
      createCatalogBuffer([
        {
          ...TEST_STARS[0]!,
          aliases: [],
          spectralType: '',
        },
      ]),
    );

    expect(catalog.aliases).toEqual([[]]);
    expect(catalog.spectralTypes).toEqual([null]);
  });

  it('rejette une chaîne non terminée ou un texte UTF-8 invalide', () => {
    const unterminated = createCatalogBuffer(TEST_STARS);
    const invalidUtf8 = createCatalogBuffer(TEST_STARS);
    const unterminatedView = new DataView(unterminated);
    const invalidView = new DataView(invalidUtf8);
    const stringTableOffset = unterminatedView.getUint32(28, true);
    const lastRelativeOffset = unterminatedView.getUint32(32, true) - 1;
    const lastOffset = stringTableOffset + lastRelativeOffset;
    const stringOffset = invalidView.getUint32(28, true) + 1;

    unterminatedView.setUint32(STAR_CATALOG_HEADER_BYTES + 24, lastRelativeOffset, true);
    unterminatedView.setUint8(lastOffset, 'A'.charCodeAt(0));
    invalidView.setUint8(stringOffset, 0xff);

    expect(() => parseStarCatalog(unterminated)).toThrow(/chaîne non terminée/);
    expect(() => parseStarCatalog(invalidUtf8)).toThrow(/chaîne UTF-8 invalide/);
  });
});

function createCatalogBuffer(stars: readonly TestStar[]): ArrayBuffer {
  const strings = createStringTable(stars);
  const stringTableOffset = STAR_CATALOG_HEADER_BYTES + stars.length * STAR_CATALOG_RECORD_BYTES;
  const buffer = new ArrayBuffer(stringTableOffset + strings.bytes.length);
  const view = new DataView(buffer);

  for (let index = 0; index < STAR_CATALOG_MAGIC.length; index += 1) {
    view.setUint8(index, STAR_CATALOG_MAGIC.charCodeAt(index));
  }
  view.setUint16(4, STAR_CATALOG_VERSION, true);
  view.setUint16(6, STAR_CATALOG_HEADER_BYTES, true);
  view.setUint16(8, STAR_CATALOG_RECORD_BYTES, true);
  view.setUint16(10, 0, true);
  view.setUint32(12, stars.length, true);
  view.setFloat64(16, 2_451_545, true);
  view.setUint32(24, 1, true);
  view.setUint32(28, stringTableOffset, true);
  view.setUint32(32, strings.bytes.length, true);
  view.setUint32(36, 0, true);

  for (let index = 0; index < stars.length; index += 1) {
    const star = stars[index]!;
    const offset = STAR_CATALOG_HEADER_BYTES + index * STAR_CATALOG_RECORD_BYTES;

    view.setFloat32(offset, star.position[0], true);
    view.setFloat32(offset + 4, star.position[1], true);
    view.setFloat32(offset + 8, star.position[2], true);
    view.setFloat32(offset + 12, star.magnitude, true);
    view.setFloat32(offset + 16, star.colorIndex, true);
    view.setUint32(offset + 20, star.id, true);
    view.setUint32(offset + 24, strings.records[index]!.nameOffset, true);
    view.setUint32(offset + 28, strings.records[index]!.aliasesOffset, true);
    view.setUint32(offset + 32, strings.records[index]!.spectralTypeOffset, true);
  }
  new Uint8Array(buffer, stringTableOffset).set(strings.bytes);

  return buffer;
}

function createStringTable(stars: readonly TestStar[]): {
  bytes: Uint8Array;
  records: {
    nameOffset: number;
    aliasesOffset: number;
    spectralTypeOffset: number;
  }[];
} {
  const encoder = new TextEncoder();
  const bytes = [0];
  const offsets = new Map<string, number>([['', 0]]);
  const records = stars.map((star) => ({
    nameOffset: intern(star.name),
    aliasesOffset: intern(star.aliases.join('\u001f')),
    spectralTypeOffset: intern(star.spectralType),
  }));

  return {
    bytes: Uint8Array.from(bytes),
    records,
  };

  function intern(value: string): number {
    const existing = offsets.get(value);

    if (existing !== undefined) {
      return existing;
    }
    const offset = bytes.length;

    bytes.push(...encoder.encode(value), 0);
    offsets.set(value, offset);

    return offset;
  }
}
