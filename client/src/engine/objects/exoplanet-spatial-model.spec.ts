import { CoordinateSystem } from '../coordinates/coordinate-system';
import { equatorialJ2000ToGalacticScene } from '../coordinates/galactic-reference-frame';
import type { ExoplanetCatalog } from '../loaders/exoplanet-catalog';
import { createExoplanetSpatialModel } from './exoplanet-spatial-model';

describe('createExoplanetSpatialModel', () => {
  it('maps published and fallback host distances into the Galactic reference frame', () => {
    const model = createExoplanetSpatialModel(catalog(), new CoordinateSystem());
    const expectedNearby = equatorialJ2000ToGalacticScene({ x: 10, y: 0, z: 0 });
    const expectedFallback = equatorialJ2000ToGalacticScene({
      x: -353.55339059327366,
      y: 612.3724356957946,
      z: 707.1067811865474,
    });

    expectPositionToBeCloseTo(model.getGalacticPosition(0), expectedNearby);
    expectPositionToBeCloseTo(model.getGalacticPosition(1), expectedFallback);
    expect(model.renderPositions).toHaveLength(6);
    expect([...model.renderPositions].every(Number.isFinite)).toBe(true);
  });

  it('resolves catalogued, Keplerian, and illustrative orbital data with provenance', () => {
    const model = createExoplanetSpatialModel(catalog(), new CoordinateSystem());

    expect(model.getResolvedOrbit(0)).toEqual({
      semiMajorAxisAu: 0.1,
      orbitalPeriodDays: 10,
      semiMajorAxisSource: 'NASA Exoplanet Archive',
      orbitalPeriodSource: 'NASA Exoplanet Archive',
    });
    expect(model.getResolvedOrbit(1)).toMatchObject({
      semiMajorAxisAu: Math.cbrt((20 / 365.25) ** 2),
      orbitalPeriodDays: 20,
      semiMajorAxisSource: 'Calculated from Kepler’s third law',
      orbitalPeriodSource: 'NASA Exoplanet Archive',
    });
    expect(model.getResolvedOrbit(2)).toMatchObject({
      semiMajorAxisAu: 0.2,
      orbitalPeriodDays: 365.25 * Math.sqrt(0.2 ** 3),
      semiMajorAxisSource: 'NASA Exoplanet Archive',
      orbitalPeriodSource: 'Calculated from Kepler’s third law',
    });
    expect(model.getResolvedOrbit(3)).toEqual({
      semiMajorAxisAu: 0.08,
      orbitalPeriodDays: 18,
      semiMajorAxisSource: 'Illustrative map spacing',
      orbitalPeriodSource: 'Illustrative map timing',
    });
    expect(model.getOrbitDistanceScale(0)).toBeGreaterThan(200);
    expect(model.getOrbitDistanceScale(0)).toBeLessThan(50_000);
    expect(model.getOrbitDistanceScale(1)).toBe(50_000);
  });
});

function expectPositionToBeCloseTo(
  actual: { readonly x: number; readonly y: number; readonly z: number },
  expected: { readonly x: number; readonly y: number; readonly z: number },
): void {
  expect(actual.x).toBeCloseTo(expected.x, 12);
  expect(actual.y).toBeCloseTo(expected.y, 12);
  expect(actual.z).toBeCloseTo(expected.z, 12);
}

function catalog(): ExoplanetCatalog {
  return {
    hostCount: 2,
    planetCount: 4,
    hostNames: ['Nearby Host', 'Distant Host'],
    hostAliases: [[], []],
    hostSpectralTypes: [null, null],
    hostFirstPlanetIndices: new Uint32Array([0, 3]),
    hostPlanetCounts: new Uint16Array([3, 1]),
    hostStarCounts: new Uint8Array([1, 1]),
    hostCircumbinaryFlags: new Uint8Array([0, 0]),
    hostRightAscensionDegrees: new Float64Array([0, 120]),
    hostDeclinationDegrees: new Float64Array([0, 45]),
    hostDistancesParsec: new Float64Array([10, Number.NaN]),
    hostTemperaturesKelvin: new Float32Array([5_700, Number.NaN]),
    hostRadiiSolar: new Float32Array([1, Number.NaN]),
    hostMassesSolar: new Float32Array([1, Number.NaN]),
    hostApparentMagnitudes: new Float32Array([8, Number.NaN]),
    planetNames: ['Nearby Host b', 'Nearby Host c', 'Nearby Host d', 'Distant Host b'],
    planetLetters: ['b', 'c', 'd', 'b'],
    planetDiscoveryMethods: ['Transit', 'Transit', 'Transit', 'Imaging'],
    planetDiscoveryFacilities: ['Kepler', 'Kepler', 'Kepler', 'Test'],
    planetMassProvenances: ['Mass', 'Mass', 'Mass', 'Mass'],
    planetHostIndices: new Uint32Array([0, 0, 0, 1]),
    planetOrbitalPeriodsDays: new Float64Array([10, 20, Number.NaN, Number.NaN]),
    planetSemiMajorAxesAu: new Float64Array([0.1, Number.NaN, 0.2, Number.NaN]),
    planetRadiiEarth: new Float32Array([1, 1, 1, 1]),
    planetMassesEarth: new Float32Array([1, 1, 1, 1]),
    planetEquilibriumTemperaturesKelvin: new Float32Array([300, 300, 300, 300]),
    planetEccentricities: new Float32Array([0, 0, 0, 0]),
    planetInclinationsDegrees: new Float32Array([90, 90, 90, 90]),
    planetInsolationsEarth: new Float32Array([1, 1, 1, 1]),
    planetDiscoveryYears: new Uint16Array([2020, 2021, 2022, 2023]),
    planetControversialFlags: new Uint8Array([0, 0, 0, 0]),
    metadata: {
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
      counts: { hosts: 2, planets: 4, positionedHosts: 1, positionedPlanets: 3 },
      missingDistanceFallbackParsec: 1_000,
    },
  };
}
