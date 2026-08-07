import {
  EXOPLANET_CATALOG_HEADER_BYTES,
  EXOPLANET_CATALOG_HOST_RECORD_BYTES,
  EXOPLANET_CATALOG_MAGIC,
  EXOPLANET_CATALOG_PLANET_RECORD_BYTES,
  EXOPLANET_CATALOG_VERSION,
  ExoplanetCatalogMetadata,
  parseExoplanetCatalog,
  parseExoplanetCatalogMetadata,
} from './exoplanet-catalog';

const METADATA: ExoplanetCatalogMetadata = {
  version: '1.0.0',
  format: 'exoplanet-catalog-v1',
  source: {
    name: 'NASA Exoplanet Archive',
    url: 'https://exoplanetarchive.ipac.caltech.edu/',
    tapUrl: 'https://exoplanetarchive.ipac.caltech.edu/TAP/sync',
    table: 'PSCompPars',
    query: 'select ... from pscomppars',
    snapshotDate: '2026-08-05',
    sha256: 'a'.repeat(64),
  },
  counts: {
    hosts: 2,
    planets: 3,
    positionedHosts: 1,
    positionedPlanets: 2,
  },
  missingDistanceFallbackParsec: 1_000,
};

describe('parseExoplanetCatalog', () => {
  it('decodes all scientific fields and explicit missing values', () => {
    const catalog = parseExoplanetCatalog(createCatalogBuffer(), METADATA);

    expect(catalog.hostCount).toBe(2);
    expect(catalog.planetCount).toBe(3);
    expect(catalog.hostNames).toEqual(['Nearby Host', 'Distant Host']);
    expect(catalog.hostAliases[0]).toEqual(['HD 1', 'HIP 2']);
    expect(catalog.hostSpectralTypes).toEqual(['G2 V', null]);
    expect(catalog.hostRightAscensionDegrees).toEqual(new Float64Array([10, 120]));
    expect(catalog.hostDeclinationDegrees).toEqual(new Float64Array([-20, 45]));
    expect(catalog.hostDistancesParsec[0]).toBeCloseTo(12.4);
    expect(catalog.hostDistancesParsec[1]).toBeNaN();
    expect(catalog.hostFirstPlanetIndices).toEqual(new Uint32Array([0, 2]));
    expect(catalog.hostPlanetCounts).toEqual(new Uint16Array([2, 1]));
    expect(catalog.hostStarCounts).toEqual(new Uint8Array([1, 2]));
    expect(catalog.hostCircumbinaryFlags).toEqual(new Uint8Array([0, 1]));
    expect(catalog.planetNames).toEqual(['Nearby Host b', 'Nearby Host c', 'Distant Host b']);
    expect(catalog.planetHostIndices).toEqual(new Uint32Array([0, 0, 1]));
    expect(catalog.planetOrbitalPeriodsDays[1]).toBeCloseTo(20);
    expect(catalog.planetSemiMajorAxesAu[2]).toBeNaN();
    expect(catalog.planetDiscoveryYears).toEqual(new Uint16Array([2020, 2021, 2022]));
    expect(catalog.planetControversialFlags).toEqual(new Uint8Array([0, 0, 1]));
    expect(catalog.metadata).toEqual(METADATA);
  });

  it('rejects truncated, extended, unknown, and incompatible files', () => {
    const valid = createCatalogBuffer();
    const badMagic = valid.slice(0);
    const badVersion = valid.slice(0);
    const badDimensions = valid.slice(0);

    new DataView(badMagic).setUint8(0, 'X'.charCodeAt(0));
    new DataView(badVersion).setUint16(4, 99, true);
    new DataView(badDimensions).setUint16(8, 99, true);

    expect(() => parseExoplanetCatalog(valid.slice(0, 12), METADATA)).toThrow(/en-tête tronqué/);
    expect(() => parseExoplanetCatalog(valid.slice(0, -1), METADATA)).toThrow(/taille inattendue/);
    const extended = new Uint8Array(valid.byteLength + 1);

    extended.set(new Uint8Array(valid));
    expect(() => parseExoplanetCatalog(extended.buffer, METADATA)).toThrow(/taille inattendue/);
    expect(() => parseExoplanetCatalog(badMagic, METADATA)).toThrow(/signature inconnue/);
    expect(() => parseExoplanetCatalog(badVersion, METADATA)).toThrow(
      /version non prise en charge/,
    );
    expect(() => parseExoplanetCatalog(badDimensions, METADATA)).toThrow(
      /dimensions incompatibles/,
    );
  });

  it('rejects invalid counts, offsets, records, and host ranges', () => {
    const emptyHosts = createCatalogBuffer();
    const emptyPlanets = createCatalogBuffer();
    const badPlanetOffset = createCatalogBuffer();
    const badStringOffset = createCatalogBuffer();
    const invalidHost = createCatalogBuffer();
    const invalidPlanet = createCatalogBuffer();
    const invalidHostIndex = createCatalogBuffer();
    const invalidRange = createCatalogBuffer();

    new DataView(emptyHosts).setUint32(12, 0, true);
    new DataView(emptyPlanets).setUint32(16, 0, true);
    new DataView(badPlanetOffset).setUint32(20, 42, true);
    new DataView(badStringOffset).setUint32(24, 42, true);
    new DataView(invalidHost).setFloat64(EXOPLANET_CATALOG_HEADER_BYTES + 20, 999, true);
    new DataView(invalidPlanet).setFloat64(planetOffset() + 24, Number.POSITIVE_INFINITY, true);
    new DataView(invalidHostIndex).setUint32(planetOffset() + 20, 12, true);
    new DataView(invalidRange).setUint32(EXOPLANET_CATALOG_HEADER_BYTES + 12, 1, true);

    expect(() => parseExoplanetCatalog(emptyHosts, METADATA)).toThrow(/nombre d’hôtes/);
    expect(() => parseExoplanetCatalog(emptyPlanets, METADATA)).toThrow(/nombre de planètes/);
    expect(() => parseExoplanetCatalog(badPlanetOffset, METADATA)).toThrow(
      /enregistrements mal positionnés/,
    );
    expect(() => parseExoplanetCatalog(badStringOffset, METADATA)).toThrow(
      /table de chaînes mal positionnée/,
    );
    expect(() => parseExoplanetCatalog(invalidHost, METADATA)).toThrow(/hôte invalide/);
    expect(() => parseExoplanetCatalog(invalidPlanet, METADATA)).toThrow(/planète invalide/);
    expect(() => parseExoplanetCatalog(invalidHostIndex, METADATA)).toThrow(/hôte inconnu/);
    expect(() => parseExoplanetCatalog(invalidRange, METADATA)).toThrow(/plage planétaire/);
  });

  it('rejects a planet assigned outside its host range and an incomplete final range', () => {
    const wrongHostInsideRange = createCatalogBuffer();
    const incompleteRange = createCatalogBuffer();
    const secondHostOffset = EXOPLANET_CATALOG_HEADER_BYTES + EXOPLANET_CATALOG_HOST_RECORD_BYTES;

    new DataView(wrongHostInsideRange).setUint32(planetOffset() + 20, 1, true);

    new DataView(incompleteRange).setUint16(EXOPLANET_CATALOG_HEADER_BYTES + 16, 1, true);
    new DataView(incompleteRange).setUint32(secondHostOffset + 12, 1, true);
    new DataView(incompleteRange).setUint16(secondHostOffset + 16, 1, true);
    new DataView(incompleteRange).setUint32(
      planetOffset() + EXOPLANET_CATALOG_PLANET_RECORD_BYTES + 20,
      1,
      true,
    );

    expect(() => parseExoplanetCatalog(wrongHostInsideRange, METADATA)).toThrow(
      /plage planétaire invalide/u,
    );
    expect(() => parseExoplanetCatalog(incompleteRange, METADATA)).toThrow(
      /plage planétaire incomplète/u,
    );
  });

  it('rejects invalid strings, duplicates, metadata, and count mismatches', () => {
    const invalidStringOffset = createCatalogBuffer();
    const unterminatedString = createCatalogBuffer();
    const invalidUtf8 = createCatalogBuffer();
    const duplicateHost = createCatalogBuffer();
    const duplicatePlanet = createCatalogBuffer();
    const stringOffset = new DataView(invalidUtf8).getUint32(24, true);

    new DataView(invalidStringOffset).setUint32(EXOPLANET_CATALOG_HEADER_BYTES, 999_999, true);
    new DataView(unterminatedString).setUint32(
      EXOPLANET_CATALOG_HEADER_BYTES,
      new DataView(unterminatedString).getUint32(28, true) - 1,
      true,
    );
    new Uint8Array(unterminatedString)[unterminatedString.byteLength - 1] = 65;
    new Uint8Array(invalidUtf8)[stringOffset + 1] = 0xff;
    new DataView(duplicateHost).setUint32(
      EXOPLANET_CATALOG_HEADER_BYTES + EXOPLANET_CATALOG_HOST_RECORD_BYTES,
      new DataView(duplicateHost).getUint32(EXOPLANET_CATALOG_HEADER_BYTES, true),
      true,
    );
    new DataView(duplicatePlanet).setUint32(
      planetOffset() + EXOPLANET_CATALOG_PLANET_RECORD_BYTES,
      new DataView(duplicatePlanet).getUint32(planetOffset(), true),
      true,
    );

    expect(() => parseExoplanetCatalog(invalidStringOffset, METADATA)).toThrow(
      /offset de chaîne invalide/,
    );
    expect(() => parseExoplanetCatalog(unterminatedString, METADATA)).toThrow(
      /chaîne non terminée/,
    );
    expect(() => parseExoplanetCatalog(invalidUtf8, METADATA)).toThrow(/chaîne UTF-8 invalide/);
    expect(() => parseExoplanetCatalog(duplicateHost, METADATA)).toThrow(/hôte dupliqué/);
    expect(() => parseExoplanetCatalog(duplicatePlanet, METADATA)).toThrow(/planète dupliquée/);
    expect(() =>
      parseExoplanetCatalog(createCatalogBuffer(), {
        ...METADATA,
        format: 'bad',
      } as unknown as ExoplanetCatalogMetadata),
    ).toThrow(/Métadonnées du catalogue d’exoplanètes invalides/);
    expect(() =>
      parseExoplanetCatalog(createCatalogBuffer(), {
        ...METADATA,
        counts: { ...METADATA.counts, planets: 4 },
      }),
    ).toThrow(/comptage incohérent/);
  });
});

describe('parseExoplanetCatalogMetadata', () => {
  it('validates provenance and the missing-distance policy', () => {
    expect(parseExoplanetCatalogMetadata(METADATA, 'fixture')).toEqual(METADATA);
  });

  it.each([
    null,
    {},
    { ...METADATA, source: { ...METADATA.source, sha256: 'bad' } },
    { ...METADATA, counts: { ...METADATA.counts, hosts: 0 } },
    { ...METADATA, missingDistanceFallbackParsec: 0 },
  ])('rejects invalid metadata %#', (metadata) => {
    expect(() => parseExoplanetCatalogMetadata(metadata, 'fixture')).toThrow(
      /Métadonnées du catalogue d’exoplanètes invalides/,
    );
  });
});

function planetOffset(): number {
  return EXOPLANET_CATALOG_HEADER_BYTES + 2 * EXOPLANET_CATALOG_HOST_RECORD_BYTES;
}

function createCatalogBuffer(): ArrayBuffer {
  const hosts: readonly TestHost[] = [
    {
      name: 'Nearby Host',
      aliases: ['HD 1', 'HIP 2'],
      spectralType: 'G2 V',
      firstPlanetIndex: 0,
      planetCount: 2,
      starCount: 1,
      circumbinary: false,
      rightAscensionDegrees: 10,
      declinationDegrees: -20,
      distanceParsec: 12.4,
      temperatureKelvin: 5_700,
      radiusSolar: 1,
      massSolar: 1,
      apparentMagnitude: 8,
    },
    {
      name: 'Distant Host',
      aliases: [],
      spectralType: '',
      firstPlanetIndex: 2,
      planetCount: 1,
      starCount: 2,
      circumbinary: true,
      rightAscensionDegrees: 120,
      declinationDegrees: 45,
      distanceParsec: Number.NaN,
      temperatureKelvin: Number.NaN,
      radiusSolar: Number.NaN,
      massSolar: Number.NaN,
      apparentMagnitude: Number.NaN,
    },
  ];
  const planets: readonly TestPlanet[] = [
    planet('Nearby Host b', 0, 10, 0.1, 2020),
    planet('Nearby Host c', 0, 20, 0.2, 2021),
    { ...planet('Distant Host b', 1, Number.NaN, Number.NaN, 2022), controversial: true },
  ];
  const strings = createStringTable(hosts, planets);
  const planetsOffset = planetOffset();
  const stringTableOffset = planetsOffset + planets.length * EXOPLANET_CATALOG_PLANET_RECORD_BYTES;
  const buffer = new ArrayBuffer(stringTableOffset + strings.bytes.length);
  const view = new DataView(buffer);

  writeMagic(view);
  view.setUint16(4, EXOPLANET_CATALOG_VERSION, true);
  view.setUint16(6, EXOPLANET_CATALOG_HEADER_BYTES, true);
  view.setUint16(8, EXOPLANET_CATALOG_HOST_RECORD_BYTES, true);
  view.setUint16(10, EXOPLANET_CATALOG_PLANET_RECORD_BYTES, true);
  view.setUint32(12, hosts.length, true);
  view.setUint32(16, planets.length, true);
  view.setUint32(20, planetsOffset, true);
  view.setUint32(24, stringTableOffset, true);
  view.setUint32(28, strings.bytes.length, true);

  hosts.forEach((host, index) => writeHost(view, index, host, strings.hosts[index]!));
  planets.forEach((value, index) => writePlanet(view, index, value, strings.planets[index]!));
  new Uint8Array(buffer, stringTableOffset).set(strings.bytes);

  return buffer;
}

interface TestHost {
  name: string;
  aliases: readonly string[];
  spectralType: string;
  firstPlanetIndex: number;
  planetCount: number;
  starCount: number;
  circumbinary: boolean;
  rightAscensionDegrees: number;
  declinationDegrees: number;
  distanceParsec: number;
  temperatureKelvin: number;
  radiusSolar: number;
  massSolar: number;
  apparentMagnitude: number;
}

interface TestPlanet {
  name: string;
  letter: string;
  method: string;
  facility: string;
  massProvenance: string;
  hostIndex: number;
  orbitalPeriodDays: number;
  semiMajorAxisAu: number;
  radiusEarth: number;
  massEarth: number;
  equilibriumTemperatureKelvin: number;
  eccentricity: number;
  inclinationDegrees: number;
  insolationEarth: number;
  discoveryYear: number;
  controversial: boolean;
}

function planet(
  name: string,
  hostIndex: number,
  orbitalPeriodDays: number,
  semiMajorAxisAu: number,
  discoveryYear: number,
): TestPlanet {
  return {
    name,
    letter: name.at(-1)!,
    method: 'Transit',
    facility: 'Test Observatory',
    massProvenance: 'Mass',
    hostIndex,
    orbitalPeriodDays,
    semiMajorAxisAu,
    radiusEarth: 1.2,
    massEarth: 2.3,
    equilibriumTemperatureKelvin: 280,
    eccentricity: 0.02,
    inclinationDegrees: 89,
    insolationEarth: 1.1,
    discoveryYear,
    controversial: false,
  };
}

function writeMagic(view: DataView): void {
  for (let index = 0; index < EXOPLANET_CATALOG_MAGIC.length; index += 1) {
    view.setUint8(index, EXOPLANET_CATALOG_MAGIC.charCodeAt(index));
  }
}

function writeHost(
  view: DataView,
  index: number,
  host: TestHost,
  strings: { name: number; aliases: number; spectralType: number },
): void {
  const offset = EXOPLANET_CATALOG_HEADER_BYTES + index * EXOPLANET_CATALOG_HOST_RECORD_BYTES;

  view.setUint32(offset, strings.name, true);
  view.setUint32(offset + 4, strings.aliases, true);
  view.setUint32(offset + 8, strings.spectralType, true);
  view.setUint32(offset + 12, host.firstPlanetIndex, true);
  view.setUint16(offset + 16, host.planetCount, true);
  view.setUint8(offset + 18, host.starCount);
  view.setUint8(offset + 19, host.circumbinary ? 1 : 0);
  view.setFloat64(offset + 20, host.rightAscensionDegrees, true);
  view.setFloat64(offset + 28, host.declinationDegrees, true);
  view.setFloat64(offset + 36, host.distanceParsec, true);
  view.setFloat32(offset + 44, host.temperatureKelvin, true);
  view.setFloat32(offset + 48, host.radiusSolar, true);
  view.setFloat32(offset + 52, host.massSolar, true);
  view.setFloat32(offset + 56, host.apparentMagnitude, true);
  view.setUint32(offset + 60, 0, true);
}

function writePlanet(
  view: DataView,
  index: number,
  value: TestPlanet,
  strings: { name: number; letter: number; method: number; facility: number; mass: number },
): void {
  const offset = planetOffset() + index * EXOPLANET_CATALOG_PLANET_RECORD_BYTES;

  view.setUint32(offset, strings.name, true);
  view.setUint32(offset + 4, strings.letter, true);
  view.setUint32(offset + 8, strings.method, true);
  view.setUint32(offset + 12, strings.facility, true);
  view.setUint32(offset + 16, strings.mass, true);
  view.setUint32(offset + 20, value.hostIndex, true);
  view.setFloat64(offset + 24, value.orbitalPeriodDays, true);
  view.setFloat64(offset + 32, value.semiMajorAxisAu, true);
  view.setFloat32(offset + 40, value.radiusEarth, true);
  view.setFloat32(offset + 44, value.massEarth, true);
  view.setFloat32(offset + 48, value.equilibriumTemperatureKelvin, true);
  view.setFloat32(offset + 52, value.eccentricity, true);
  view.setFloat32(offset + 56, value.inclinationDegrees, true);
  view.setFloat32(offset + 60, value.insolationEarth, true);
  view.setUint16(offset + 64, value.discoveryYear, true);
  view.setUint16(offset + 66, value.controversial ? 1 : 0, true);
  view.setUint32(offset + 68, 0, true);
}

function createStringTable(hosts: readonly TestHost[], planets: readonly TestPlanet[]) {
  const encoder = new TextEncoder();
  const chunks: number[] = [0];
  const offsets = new Map<string, number>([['', 0]]);
  const add = (value: string): number => {
    const existing = offsets.get(value);

    if (existing !== undefined) {
      return existing;
    }
    const offset = chunks.length;

    chunks.push(...encoder.encode(value), 0);
    offsets.set(value, offset);

    return offset;
  };

  const hostStrings = hosts.map((host) => ({
    name: add(host.name),
    aliases: add(host.aliases.join('\u001f')),
    spectralType: add(host.spectralType),
  }));
  const planetStrings = planets.map((value) => ({
    name: add(value.name),
    letter: add(value.letter),
    method: add(value.method),
    facility: add(value.facility),
    mass: add(value.massProvenance),
  }));

  return { bytes: new Uint8Array(chunks), hosts: hostStrings, planets: planetStrings };
}
