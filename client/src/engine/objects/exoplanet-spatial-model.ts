import type { CoordinateSystem } from '../coordinates/coordinate-system';
import { equatorialJ2000ToGalacticScene } from '../coordinates/galactic-reference-frame';
import type { ExoplanetCatalog } from '../loaders/exoplanet-catalog';
import { isPositiveFiniteCatalogValue } from './exoplanet-catalog-values';

const SYSTEM_MAXIMUM_ORBIT_RADIUS = 18;
const MINIMUM_ORBIT_DISTANCE_SCALE = 200;
const MAXIMUM_ORBIT_DISTANCE_SCALE = 50_000;

export interface ResolvedExoplanetOrbit {
  readonly semiMajorAxisAu: number;
  readonly orbitalPeriodDays: number;
  readonly semiMajorAxisSource: string;
  readonly orbitalPeriodSource: string;
}

export interface GalacticPosition {
  readonly x: number;
  readonly y: number;
  readonly z: number;
}

export interface ExoplanetSpatialModel {
  readonly renderPositions: Float32Array;
  getGalacticPosition(index: number): GalacticPosition;
  getResolvedOrbit(index: number): ResolvedExoplanetOrbit;
  getOrbitDistanceScale(hostIndex: number): number;
}

export function createExoplanetSpatialModel(
  catalog: ExoplanetCatalog,
  coordinateSystem: CoordinateSystem,
): ExoplanetSpatialModel {
  const galacticPositions = createGalacticPositions(catalog);
  const renderPositions = createRenderPositions(catalog, coordinateSystem, galacticPositions);
  const resolvedOrbits = createResolvedOrbits(catalog);
  const orbitDistanceScales = createOrbitDistanceScales(catalog, coordinateSystem, resolvedOrbits);

  return {
    renderPositions,
    getGalacticPosition: (index) => readPosition(galacticPositions, index),
    getResolvedOrbit: (index) => resolvedOrbits[index]!,
    getOrbitDistanceScale: (hostIndex) => orbitDistanceScales[hostIndex]!,
  };
}

function createGalacticPositions(catalog: ExoplanetCatalog): Float64Array {
  const positions = new Float64Array(catalog.hostCount * 3);

  for (let index = 0; index < catalog.hostCount; index += 1) {
    const rightAscension = degreesToRadians(catalog.hostRightAscensionDegrees[index]!);
    const declination = degreesToRadians(catalog.hostDeclinationDegrees[index]!);
    const publishedDistance = catalog.hostDistancesParsec[index]!;
    const distance = Number.isFinite(publishedDistance)
      ? publishedDistance
      : catalog.metadata.missingDistanceFallbackParsec;
    const galactic = equatorialJ2000ToGalacticScene({
      x: distance * Math.cos(declination) * Math.cos(rightAscension),
      y: distance * Math.cos(declination) * Math.sin(rightAscension),
      z: distance * Math.sin(declination),
    });

    writePosition(positions, index, galactic);
  }

  return positions;
}

function createRenderPositions(
  catalog: ExoplanetCatalog,
  coordinateSystem: CoordinateSystem,
  galacticPositions: Float64Array,
): Float32Array {
  const positions = new Float32Array(catalog.hostCount * 3);

  for (let index = 0; index < catalog.hostCount; index += 1) {
    const galactic = readPosition(galacticPositions, index);
    const position = coordinateSystem.toRenderPosition(
      [galactic.x, galactic.y, galactic.z],
      'parsec',
      'stellar',
    );

    writePosition(positions, index, position);
  }

  return positions;
}

function createResolvedOrbits(catalog: ExoplanetCatalog): readonly ResolvedExoplanetOrbit[] {
  return Array.from({ length: catalog.planetCount }, (_, planetIndex) =>
    resolveOrbit(catalog, planetIndex),
  );
}

function resolveOrbit(catalog: ExoplanetCatalog, planetIndex: number): ResolvedExoplanetOrbit {
  const hostIndex = catalog.planetHostIndices[planetIndex]!;
  const systemIndex = planetIndex - catalog.hostFirstPlanetIndices[hostIndex]!;
  const hostMass = catalog.hostMassesSolar[hostIndex]!;
  let semiMajorAxisAu = catalog.planetSemiMajorAxesAu[planetIndex]!;
  let orbitalPeriodDays = catalog.planetOrbitalPeriodsDays[planetIndex]!;
  let semiMajorAxisSource = 'NASA Exoplanet Archive';
  let orbitalPeriodSource = 'NASA Exoplanet Archive';

  if (!isPositiveFiniteCatalogValue(semiMajorAxisAu)) {
    if (isPositiveFiniteCatalogValue(orbitalPeriodDays) && isPositiveFiniteCatalogValue(hostMass)) {
      semiMajorAxisAu = Math.cbrt(hostMass * (orbitalPeriodDays / 365.25) ** 2);
      semiMajorAxisSource = 'Calculated from Kepler’s third law';
    } else {
      semiMajorAxisAu = 0.08 * (systemIndex + 1) ** 1.45;
      semiMajorAxisSource = 'Illustrative map spacing';
    }
  }
  if (!isPositiveFiniteCatalogValue(orbitalPeriodDays)) {
    if (
      isPositiveFiniteCatalogValue(hostMass) &&
      semiMajorAxisSource !== 'Illustrative map spacing'
    ) {
      orbitalPeriodDays = 365.25 * Math.sqrt(semiMajorAxisAu ** 3 / hostMass);
      orbitalPeriodSource = 'Calculated from Kepler’s third law';
    } else {
      orbitalPeriodDays = 18 * (systemIndex + 1) ** 1.65;
      orbitalPeriodSource = 'Illustrative map timing';
    }
  }

  return {
    semiMajorAxisAu,
    orbitalPeriodDays,
    semiMajorAxisSource,
    orbitalPeriodSource,
  };
}

function createOrbitDistanceScales(
  catalog: ExoplanetCatalog,
  coordinateSystem: CoordinateSystem,
  resolvedOrbits: readonly ResolvedExoplanetOrbit[],
): Float64Array {
  const scales = new Float64Array(catalog.hostCount);
  const oneAuSceneUnits = coordinateSystem.toSceneDistance(1, 'astronomical-unit', 'stellar');

  for (let hostIndex = 0; hostIndex < catalog.hostCount; hostIndex += 1) {
    const firstPlanetIndex = catalog.hostFirstPlanetIndices[hostIndex]!;
    const planetCount = catalog.hostPlanetCounts[hostIndex]!;
    let maximumAxis = 0;

    for (let offset = 0; offset < planetCount; offset += 1) {
      maximumAxis = Math.max(
        maximumAxis,
        resolvedOrbits[firstPlanetIndex + offset]!.semiMajorAxisAu,
      );
    }
    scales[hostIndex] = clamp(
      SYSTEM_MAXIMUM_ORBIT_RADIUS / Math.max(maximumAxis * oneAuSceneUnits, Number.EPSILON),
      MINIMUM_ORBIT_DISTANCE_SCALE,
      MAXIMUM_ORBIT_DISTANCE_SCALE,
    );
  }

  return scales;
}

function readPosition(positions: Float64Array, index: number): GalacticPosition;
function readPosition(positions: Float32Array, index: number): GalacticPosition;
function readPosition(positions: Float32Array | Float64Array, index: number): GalacticPosition {
  const offset = index * 3;

  return {
    x: positions[offset]!,
    y: positions[offset + 1]!,
    z: positions[offset + 2]!,
  };
}

function writePosition(
  positions: Float32Array | Float64Array,
  index: number,
  position: GalacticPosition,
): void {
  const offset = index * 3;

  positions[offset] = position.x;
  positions[offset + 1] = position.y;
  positions[offset + 2] = position.z;
}

function degreesToRadians(value: number): number {
  return (value * Math.PI) / 180;
}

function clamp(value: number, minimum: number, maximum: number): number {
  return Math.min(maximum, Math.max(minimum, value));
}
