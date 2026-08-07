import {
  EXOPLANET_CATALOG_HEADER_BYTES,
  EXOPLANET_CATALOG_HOST_RECORD_BYTES,
  invalidExoplanetCatalog,
} from './exoplanet-catalog-format';
import type { ExoplanetStringDecoder } from './exoplanet-catalog-string-table';
import { isOptionalFinite, isOptionalPositive } from './exoplanet-record-validation';

const STRING_SEPARATOR = '\u001f';

export interface DecodedExoplanetHosts {
  readonly hostNames: string[];
  readonly hostAliases: (readonly string[])[];
  readonly hostSpectralTypes: (string | null)[];
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
}

export function decodeExoplanetHosts(
  view: DataView,
  hostCount: number,
  strings: ExoplanetStringDecoder,
): DecodedExoplanetHosts {
  const output = createHostArrays(hostCount);
  const seenNames = new Set<string>();

  for (let index = 0; index < hostCount; index += 1) {
    decodeHost(view, index, output, strings, seenNames);
  }

  return output;
}

function createHostArrays(hostCount: number): DecodedExoplanetHosts {
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

function decodeHost(
  view: DataView,
  index: number,
  output: DecodedExoplanetHosts,
  strings: ExoplanetStringDecoder,
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
    throw invalidExoplanetCatalog(`hôte invalide à l’index ${index}`);
  }
  if (seenNames.has(name)) {
    throw invalidExoplanetCatalog(`hôte dupliqué (${name})`);
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
