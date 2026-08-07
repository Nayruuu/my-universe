import { CoordinateSystem } from '../coordinates/coordinate-system';
import type { ExoplanetCatalog } from '../loaders/exoplanet-catalog';
import {
  EXOPLANET_MISSING_DISTANCE_FALLBACK_CONFIDENCE,
  ExoplanetObjectFactory,
} from './exoplanet-object-factory';

describe('ExoplanetObjectFactory', () => {
  it('builds Galactic host positions and scientifically qualified object definitions', () => {
    const factory = createFactory();
    const nearbyHost = factory.createHostDefinition(0);
    const distantHost = factory.createHostDefinition(1);
    const nearbyPlanet = factory.createPlanetDefinition(0);

    expect(factory.renderPositions).toHaveLength(6);
    expect(nearbyHost).toMatchObject({
      id: 'host-nearby',
      type: 'star',
      parentId: 'milky-way',
      referenceFrame: 'stellar',
    });
    expect(nearbyHost.positionProvider).toMatchObject({ type: 'static', unit: 'parsec' });
    expect(distantHost.metadata?.['mapDistanceUnavailable']).toBe(true);
    expect(distantHost.metadata?.['mapDistanceConfidence']).toBe(
      EXOPLANET_MISSING_DISTANCE_FALLBACK_CONFIDENCE,
    );
    expect(nearbyPlanet).toMatchObject({
      id: 'planet-nearby-b',
      type: 'exoplanet',
      parentId: 'host-nearby',
    });
    expect(nearbyPlanet.positionProvider).toMatchObject({
      type: 'illustrative-orbit',
      semiMajorAxis: 0.1,
      orbitalPeriodDays: 10,
    });
    expect(nearbyPlanet.metadata?.['distancePc']).toBe(10);
  });

  it('resolves incomplete orbital data while retaining explicit provenance', () => {
    const factory = createFactory();
    const derivedAxis = factory.createPlanetDefinition(1);
    const derivedPeriod = factory.createPlanetDefinition(2);
    const illustrativeOrbit = factory.createPlanetDefinition(3);

    expect(derivedAxis.metadata?.['semiMajorAxisSource']).toBe(
      'Calculated from Kepler’s third law',
    );
    expect(derivedAxis.metadata?.['orbitalPeriodSource']).toBe('NASA Exoplanet Archive');
    expect(derivedPeriod.metadata?.['semiMajorAxisSource']).toBe('NASA Exoplanet Archive');
    expect(derivedPeriod.metadata?.['orbitalPeriodSource']).toBe(
      'Calculated from Kepler’s third law',
    );
    expect(illustrativeOrbit.metadata?.['semiMajorAxisSource']).toBe('Illustrative map spacing');
    expect(illustrativeOrbit.metadata?.['orbitalPeriodSource']).toBe('Illustrative map timing');
  });
});

function createFactory(): ExoplanetObjectFactory {
  return new ExoplanetObjectFactory(
    catalog(),
    new CoordinateSystem(),
    ['host-nearby', 'host-distant'],
    ['planet-nearby-b', 'planet-nearby-c', 'planet-nearby-d', 'planet-distant-b'],
  );
}

function catalog(): ExoplanetCatalog {
  return {
    hostCount: 2,
    planetCount: 4,
    hostNames: ['Nearby Host', 'Distant Host'],
    hostAliases: [['HD 1'], []],
    hostSpectralTypes: ['G2 V', null],
    hostFirstPlanetIndices: new Uint32Array([0, 3]),
    hostPlanetCounts: new Uint16Array([3, 1]),
    hostStarCounts: new Uint8Array([1, 2]),
    hostCircumbinaryFlags: new Uint8Array([0, 1]),
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
    planetRadiiEarth: new Float32Array([1.1, 2.4, 3, Number.NaN]),
    planetMassesEarth: new Float32Array([1.3, 6.2, 8, Number.NaN]),
    planetEquilibriumTemperaturesKelvin: new Float32Array([500, 280, 400, Number.NaN]),
    planetEccentricities: new Float32Array([0.02, 0.1, 0.2, Number.NaN]),
    planetInclinationsDegrees: new Float32Array([89, 88, 87, Number.NaN]),
    planetInsolationsEarth: new Float32Array([3, 1.1, 0.8, Number.NaN]),
    planetDiscoveryYears: new Uint16Array([2020, 2021, 2022, 2023]),
    planetControversialFlags: new Uint8Array([0, 0, 0, 1]),
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
