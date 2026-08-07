export const EXOPLANET_CATALOG_MAGIC = 'UMEX';
export const EXOPLANET_CATALOG_VERSION = 1;
export const EXOPLANET_CATALOG_HEADER_BYTES = 32;
export const EXOPLANET_CATALOG_HOST_RECORD_BYTES = 64;
export const EXOPLANET_CATALOG_PLANET_RECORD_BYTES = 72;

const STRING_SEPARATOR = '\u001f';
const MAXIMUM_HOST_COUNT = 1_000_000;
const MAXIMUM_PLANET_COUNT = 10_000_000;

export interface ExoplanetCatalogMetadata {
  readonly version: string;
  readonly format: 'exoplanet-catalog-v1';
  readonly source: {
    readonly name: string;
    readonly url: string;
    readonly tapUrl: string;
    readonly table: 'PSCompPars';
    readonly query: string;
    readonly snapshotDate: string;
    readonly sha256: string;
  };
  readonly counts: {
    readonly hosts: number;
    readonly planets: number;
    readonly positionedHosts: number;
    readonly positionedPlanets: number;
  };
  readonly missingDistanceFallbackParsec: number;
}

export interface ExoplanetCatalog {
  readonly hostCount: number;
  readonly planetCount: number;
  readonly hostNames: readonly string[];
  readonly hostAliases: readonly (readonly string[])[];
  readonly hostSpectralTypes: readonly (string | null)[];
  readonly hostFirstPlanetIndices: Uint32Array;
  readonly hostPlanetCounts: Uint16Array;
  readonly hostStarCounts: Uint8Array;
  readonly hostCircumbinaryFlags: Uint8Array;
  readonly hostRightAscensionDegrees: Float64Array;
  readonly hostDeclinationDegrees: Float64Array;
  readonly hostDistancesParsec: Float64Array;
  readonly hostTemperaturesKelvin: Float32Array;
  readonly hostRadiiSolar: Float32Array;
  readonly hostMassesSolar: Float32Array;
  readonly hostApparentMagnitudes: Float32Array;
  readonly planetNames: readonly string[];
  readonly planetLetters: readonly string[];
  readonly planetDiscoveryMethods: readonly string[];
  readonly planetDiscoveryFacilities: readonly string[];
  readonly planetMassProvenances: readonly string[];
  readonly planetHostIndices: Uint32Array;
  readonly planetOrbitalPeriodsDays: Float64Array;
  readonly planetSemiMajorAxesAu: Float64Array;
  readonly planetRadiiEarth: Float32Array;
  readonly planetMassesEarth: Float32Array;
  readonly planetEquilibriumTemperaturesKelvin: Float32Array;
  readonly planetEccentricities: Float32Array;
  readonly planetInclinationsDegrees: Float32Array;
  readonly planetInsolationsEarth: Float32Array;
  readonly planetDiscoveryYears: Uint16Array;
  readonly planetControversialFlags: Uint8Array;
  readonly metadata: ExoplanetCatalogMetadata;
}

export function parseExoplanetCatalogMetadata(
  value: unknown,
  source: string,
): ExoplanetCatalogMetadata {
  if (!isRecord(value)) {
    throw invalidMetadata(source);
  }
  const provenance = value['source'];
  const counts = value['counts'];
  const fallback = value['missingDistanceFallbackParsec'];
  const validCounts =
    isRecord(counts) &&
    isPositiveInteger(counts['hosts']) &&
    isPositiveInteger(counts['planets']) &&
    isNonNegativeInteger(counts['positionedHosts']) &&
    isNonNegativeInteger(counts['positionedPlanets']) &&
    counts['positionedHosts'] <= counts['hosts'] &&
    counts['positionedPlanets'] <= counts['planets'];
  const validSource =
    isRecord(provenance) &&
    isNonEmptyString(provenance['name']) &&
    isNonEmptyString(provenance['url']) &&
    isNonEmptyString(provenance['tapUrl']) &&
    provenance['table'] === 'PSCompPars' &&
    isNonEmptyString(provenance['query']) &&
    typeof provenance['snapshotDate'] === 'string' &&
    /^\d{4}-\d{2}-\d{2}$/u.test(provenance['snapshotDate']) &&
    typeof provenance['sha256'] === 'string' &&
    /^[a-f0-9]{64}$/u.test(provenance['sha256']);

  if (
    !isNonEmptyString(value['version']) ||
    value['format'] !== 'exoplanet-catalog-v1' ||
    !validSource ||
    !validCounts ||
    typeof fallback !== 'number' ||
    !Number.isFinite(fallback) ||
    fallback <= 0
  ) {
    throw invalidMetadata(source);
  }

  return value as unknown as ExoplanetCatalogMetadata;
}

export function parseExoplanetCatalog(
  buffer: ArrayBuffer,
  metadata: ExoplanetCatalogMetadata,
): ExoplanetCatalog {
  metadata = parseExoplanetCatalogMetadata(metadata, 'binaire');
  if (buffer.byteLength < EXOPLANET_CATALOG_HEADER_BYTES) {
    throw invalidCatalog('en-tête tronqué');
  }
  const view = new DataView(buffer);

  assertMagic(view);
  assertHeader(view);
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
    throw invalidCatalog(`nombre d’hôtes hors limites (${hostCount})`);
  }
  if (planetCount === 0 || planetCount > MAXIMUM_PLANET_COUNT) {
    throw invalidCatalog(`nombre de planètes hors limites (${planetCount})`);
  }
  if (planetRecordsOffset !== expectedPlanetOffset) {
    throw invalidCatalog('enregistrements mal positionnés');
  }
  if (stringTableOffset !== expectedStringOffset || stringTableBytes === 0) {
    throw invalidCatalog('table de chaînes mal positionnée');
  }
  if (buffer.byteLength !== stringTableOffset + stringTableBytes) {
    throw invalidCatalog(
      `taille inattendue (${buffer.byteLength} octets au lieu de ${stringTableOffset + stringTableBytes})`,
    );
  }
  if (metadata.counts.hosts !== hostCount || metadata.counts.planets !== planetCount) {
    throw invalidCatalog('comptage incohérent avec les métadonnées');
  }

  return decodeCatalog(
    view,
    hostCount,
    planetCount,
    planetRecordsOffset,
    stringTableOffset,
    stringTableBytes,
    metadata,
  );
}

function decodeCatalog(
  view: DataView,
  hostCount: number,
  planetCount: number,
  planetRecordsOffset: number,
  stringTableOffset: number,
  stringTableBytes: number,
  metadata: ExoplanetCatalogMetadata,
): ExoplanetCatalog {
  const strings = createStringDecoder(view, stringTableOffset, stringTableBytes);
  const hosts = createHostArrays(hostCount);
  const planets = createPlanetArrays(planetCount);
  const seenHosts = new Set<string>();
  const seenPlanets = new Set<string>();

  for (let index = 0; index < hostCount; index += 1) {
    decodeHost(view, index, hosts, strings, seenHosts);
  }
  for (let index = 0; index < planetCount; index += 1) {
    decodePlanet(view, index, planetRecordsOffset, hostCount, planets, strings, seenPlanets);
  }
  assertHostPlanetRanges(hosts, planets, hostCount, planetCount);

  return {
    hostCount,
    planetCount,
    ...hosts,
    ...planets,
    metadata,
  };
}

function createHostArrays(hostCount: number) {
  return {
    hostNames: new Array<string>(hostCount),
    hostAliases: new Array<readonly string[]>(hostCount),
    hostSpectralTypes: new Array<string | null>(hostCount),
    hostFirstPlanetIndices: new Uint32Array(hostCount),
    hostPlanetCounts: new Uint16Array(hostCount),
    hostStarCounts: new Uint8Array(hostCount),
    hostCircumbinaryFlags: new Uint8Array(hostCount),
    hostRightAscensionDegrees: new Float64Array(hostCount),
    hostDeclinationDegrees: new Float64Array(hostCount),
    hostDistancesParsec: new Float64Array(hostCount),
    hostTemperaturesKelvin: new Float32Array(hostCount),
    hostRadiiSolar: new Float32Array(hostCount),
    hostMassesSolar: new Float32Array(hostCount),
    hostApparentMagnitudes: new Float32Array(hostCount),
  };
}

function createPlanetArrays(planetCount: number) {
  return {
    planetNames: new Array<string>(planetCount),
    planetLetters: new Array<string>(planetCount),
    planetDiscoveryMethods: new Array<string>(planetCount),
    planetDiscoveryFacilities: new Array<string>(planetCount),
    planetMassProvenances: new Array<string>(planetCount),
    planetHostIndices: new Uint32Array(planetCount),
    planetOrbitalPeriodsDays: new Float64Array(planetCount),
    planetSemiMajorAxesAu: new Float64Array(planetCount),
    planetRadiiEarth: new Float32Array(planetCount),
    planetMassesEarth: new Float32Array(planetCount),
    planetEquilibriumTemperaturesKelvin: new Float32Array(planetCount),
    planetEccentricities: new Float32Array(planetCount),
    planetInclinationsDegrees: new Float32Array(planetCount),
    planetInsolationsEarth: new Float32Array(planetCount),
    planetDiscoveryYears: new Uint16Array(planetCount),
    planetControversialFlags: new Uint8Array(planetCount),
  };
}

type HostArrays = ReturnType<typeof createHostArrays>;
type PlanetArrays = ReturnType<typeof createPlanetArrays>;
type StringDecoder = ReturnType<typeof createStringDecoder>;

function decodeHost(
  view: DataView,
  index: number,
  output: HostArrays,
  strings: StringDecoder,
  seenNames: Set<string>,
): void {
  const offset = EXOPLANET_CATALOG_HEADER_BYTES + index * EXOPLANET_CATALOG_HOST_RECORD_BYTES;
  const name = strings.decode(view.getUint32(offset, true), index);
  const aliases = strings.decode(view.getUint32(offset + 4, true), index);
  const spectralType = strings.decode(view.getUint32(offset + 8, true), index);
  const firstPlanetIndex = view.getUint32(offset + 12, true);
  const planetCount = view.getUint16(offset + 16, true);
  const starCount = view.getUint8(offset + 18);
  const flags = view.getUint8(offset + 19);
  const rightAscension = view.getFloat64(offset + 20, true);
  const declination = view.getFloat64(offset + 28, true);
  const distance = view.getFloat64(offset + 36, true);
  const temperature = view.getFloat32(offset + 44, true);
  const radius = view.getFloat32(offset + 48, true);
  const mass = view.getFloat32(offset + 52, true);
  const magnitude = view.getFloat32(offset + 56, true);
  const reserved = view.getUint32(offset + 60, true);

  if (
    !name ||
    !Number.isFinite(rightAscension) ||
    rightAscension < 0 ||
    rightAscension >= 360 ||
    !Number.isFinite(declination) ||
    declination < -90 ||
    declination > 90 ||
    !isOptionalPositive(distance) ||
    !isOptionalPositive(temperature) ||
    !isOptionalPositive(radius) ||
    !isOptionalPositive(mass) ||
    !isOptionalFinite(magnitude) ||
    planetCount === 0 ||
    starCount === 0 ||
    (flags & ~1) !== 0 ||
    reserved !== 0
  ) {
    throw invalidCatalog(`hôte invalide à l’index ${index}`);
  }
  if (seenNames.has(name)) {
    throw invalidCatalog(`hôte dupliqué (${name})`);
  }

  output.hostNames[index] = name;
  output.hostAliases[index] = aliases ? aliases.split(STRING_SEPARATOR) : [];
  output.hostSpectralTypes[index] = spectralType || null;
  output.hostFirstPlanetIndices[index] = firstPlanetIndex;
  output.hostPlanetCounts[index] = planetCount;
  output.hostStarCounts[index] = starCount;
  output.hostCircumbinaryFlags[index] = flags & 1;
  output.hostRightAscensionDegrees[index] = rightAscension;
  output.hostDeclinationDegrees[index] = declination;
  output.hostDistancesParsec[index] = distance;
  output.hostTemperaturesKelvin[index] = temperature;
  output.hostRadiiSolar[index] = radius;
  output.hostMassesSolar[index] = mass;
  output.hostApparentMagnitudes[index] = magnitude;
  seenNames.add(name);
}

function decodePlanet(
  view: DataView,
  index: number,
  recordsOffset: number,
  hostCount: number,
  output: PlanetArrays,
  strings: StringDecoder,
  seenNames: Set<string>,
): void {
  const offset = recordsOffset + index * EXOPLANET_CATALOG_PLANET_RECORD_BYTES;
  const name = strings.decode(view.getUint32(offset, true), index);
  const letter = strings.decode(view.getUint32(offset + 4, true), index);
  const method = strings.decode(view.getUint32(offset + 8, true), index);
  const facility = strings.decode(view.getUint32(offset + 12, true), index);
  const massProvenance = strings.decode(view.getUint32(offset + 16, true), index);
  const hostIndex = view.getUint32(offset + 20, true);
  const period = view.getFloat64(offset + 24, true);
  const semiMajorAxis = view.getFloat64(offset + 32, true);
  const radius = view.getFloat32(offset + 40, true);
  const mass = view.getFloat32(offset + 44, true);
  const temperature = view.getFloat32(offset + 48, true);
  const eccentricity = view.getFloat32(offset + 52, true);
  const inclination = view.getFloat32(offset + 56, true);
  const insolation = view.getFloat32(offset + 60, true);
  const discoveryYear = view.getUint16(offset + 64, true);
  const flags = view.getUint16(offset + 66, true);
  const reserved = view.getUint32(offset + 68, true);

  if (
    !name ||
    !letter ||
    !method ||
    hostIndex >= hostCount ||
    !isOptionalPositive(period) ||
    !isOptionalPositive(semiMajorAxis) ||
    !isOptionalPositive(radius) ||
    !isOptionalPositive(mass) ||
    !isOptionalPositive(temperature) ||
    !isOptionalRange(eccentricity, 0, 1) ||
    !isOptionalRange(inclination, -360, 360) ||
    !isOptionalRange(insolation, 0, Number.POSITIVE_INFINITY) ||
    (flags & ~1) !== 0 ||
    reserved !== 0
  ) {
    const reason = hostIndex >= hostCount ? 'hôte inconnu' : 'planète invalide';

    throw invalidCatalog(`${reason} à l’index ${index}`);
  }
  if (seenNames.has(name)) {
    throw invalidCatalog(`planète dupliquée (${name})`);
  }

  output.planetNames[index] = name;
  output.planetLetters[index] = letter;
  output.planetDiscoveryMethods[index] = method;
  output.planetDiscoveryFacilities[index] = facility;
  output.planetMassProvenances[index] = massProvenance;
  output.planetHostIndices[index] = hostIndex;
  output.planetOrbitalPeriodsDays[index] = period;
  output.planetSemiMajorAxesAu[index] = semiMajorAxis;
  output.planetRadiiEarth[index] = radius;
  output.planetMassesEarth[index] = mass;
  output.planetEquilibriumTemperaturesKelvin[index] = temperature;
  output.planetEccentricities[index] = eccentricity;
  output.planetInclinationsDegrees[index] = inclination;
  output.planetInsolationsEarth[index] = insolation;
  output.planetDiscoveryYears[index] = discoveryYear;
  output.planetControversialFlags[index] = flags & 1;
  seenNames.add(name);
}

function assertHostPlanetRanges(
  hosts: HostArrays,
  planets: PlanetArrays,
  hostCount: number,
  planetCount: number,
): void {
  let expectedStart = 0;

  for (let hostIndex = 0; hostIndex < hostCount; hostIndex += 1) {
    const start = hosts.hostFirstPlanetIndices[hostIndex]!;
    const count = hosts.hostPlanetCounts[hostIndex]!;
    const end = start + count;

    if (start !== expectedStart || end > planetCount) {
      throw invalidCatalog(`plage planétaire invalide pour l’hôte ${hostIndex}`);
    }
    for (let planetIndex = start; planetIndex < end; planetIndex += 1) {
      if (planets.planetHostIndices[planetIndex] !== hostIndex) {
        throw invalidCatalog(`plage planétaire invalide pour l’hôte ${hostIndex}`);
      }
    }
    expectedStart = end;
  }
  if (expectedStart !== planetCount) {
    throw invalidCatalog('plage planétaire incomplète');
  }
}

function createStringDecoder(view: DataView, offset: number, length: number) {
  const bytes = new Uint8Array(view.buffer, offset, length);
  const decoder = new TextDecoder('utf-8', { fatal: true });
  const cache = new Map<number, string>();

  return {
    decode(relativeOffset: number, recordIndex: number): string {
      const cached = cache.get(relativeOffset);

      if (cached !== undefined) {
        return cached;
      }
      if (relativeOffset >= bytes.length) {
        throw invalidCatalog(`offset de chaîne invalide à l’index ${recordIndex}`);
      }
      let end = relativeOffset;

      while (end < bytes.length && bytes[end] !== 0) {
        end += 1;
      }
      if (end >= bytes.length) {
        throw invalidCatalog(`chaîne non terminée à l’index ${recordIndex}`);
      }
      try {
        const value = decoder.decode(bytes.subarray(relativeOffset, end));

        cache.set(relativeOffset, value);

        return value;
      } catch {
        throw invalidCatalog(`chaîne UTF-8 invalide à l’index ${recordIndex}`);
      }
    },
  };
}

function assertMagic(view: DataView): void {
  for (let index = 0; index < EXOPLANET_CATALOG_MAGIC.length; index += 1) {
    if (view.getUint8(index) !== EXOPLANET_CATALOG_MAGIC.charCodeAt(index)) {
      throw invalidCatalog('signature inconnue');
    }
  }
}

function assertHeader(view: DataView): void {
  if (view.getUint16(4, true) !== EXOPLANET_CATALOG_VERSION) {
    throw invalidCatalog(`version non prise en charge (${view.getUint16(4, true)})`);
  }
  if (
    view.getUint16(6, true) !== EXOPLANET_CATALOG_HEADER_BYTES ||
    view.getUint16(8, true) !== EXOPLANET_CATALOG_HOST_RECORD_BYTES ||
    view.getUint16(10, true) !== EXOPLANET_CATALOG_PLANET_RECORD_BYTES
  ) {
    throw invalidCatalog('dimensions incompatibles');
  }
}

function isOptionalFinite(value: number): boolean {
  return Number.isNaN(value) || Number.isFinite(value);
}

function isOptionalPositive(value: number): boolean {
  return Number.isNaN(value) || (Number.isFinite(value) && value > 0);
}

function isOptionalRange(value: number, minimum: number, maximum: number): boolean {
  return Number.isNaN(value) || (Number.isFinite(value) && value >= minimum && value <= maximum);
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function isNonEmptyString(value: unknown): value is string {
  return typeof value === 'string' && value.trim().length > 0;
}

function isPositiveInteger(value: unknown): value is number {
  return typeof value === 'number' && Number.isInteger(value) && value > 0;
}

function isNonNegativeInteger(value: unknown): value is number {
  return typeof value === 'number' && Number.isInteger(value) && value >= 0;
}

function invalidCatalog(reason: string): Error {
  return new Error(`Catalogue d’exoplanètes binaire invalide : ${reason}.`);
}

function invalidMetadata(source: string): Error {
  return new Error(`Métadonnées du catalogue d’exoplanètes invalides (${source}).`);
}
