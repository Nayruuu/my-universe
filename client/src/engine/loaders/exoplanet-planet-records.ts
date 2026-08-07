import {
  EXOPLANET_CATALOG_PLANET_RECORD_BYTES,
  invalidExoplanetCatalog,
} from './exoplanet-catalog-format';
import type { ExoplanetStringDecoder } from './exoplanet-catalog-string-table';
import { isOptionalPositive, isOptionalRange } from './exoplanet-record-validation';

export interface DecodedExoplanetPlanets {
  readonly planetNames: string[];
  readonly planetLetters: string[];
  readonly planetDiscoveryMethods: string[];
  readonly planetDiscoveryFacilities: string[];
  readonly planetMassProvenances: string[];
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
}

export function decodeExoplanetPlanets(
  view: DataView,
  planetCount: number,
  recordsOffset: number,
  hostCount: number,
  strings: ExoplanetStringDecoder,
): DecodedExoplanetPlanets {
  const output = createPlanetArrays(planetCount);
  const seenNames = new Set<string>();

  for (let index = 0; index < planetCount; index += 1) {
    decodePlanet(view, index, recordsOffset, hostCount, output, strings, seenNames);
  }

  return output;
}

function createPlanetArrays(planetCount: number): DecodedExoplanetPlanets {
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

function decodePlanet(
  view: DataView,
  index: number,
  recordsOffset: number,
  hostCount: number,
  output: DecodedExoplanetPlanets,
  strings: ExoplanetStringDecoder,
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

    throw invalidExoplanetCatalog(`${reason} à l’index ${index}`);
  }
  if (seenNames.has(name)) {
    throw invalidExoplanetCatalog(`planète dupliquée (${name})`);
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
