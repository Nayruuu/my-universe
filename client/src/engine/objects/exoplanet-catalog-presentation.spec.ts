import type { ExoplanetCatalog } from '../loaders/exoplanet-catalog';
import { createExoplanetCatalogPresentation } from './exoplanet-catalog-presentation';

describe('createExoplanetCatalogPresentation', () => {
  it('builds and caches searchable unlinked objects with filter metadata', () => {
    const presentation = createExoplanetCatalogPresentation(
      catalog(),
      ['nearby-host', 'distant-host'],
      ['nearby-b', 'nearby-c', 'distant-b'],
      new Set(['nearby-host', 'nearby-b']),
    );
    const entries = presentation.getSearchEntries();

    expect(entries).toHaveLength(3);
    expect(presentation.getSearchEntries()).toBe(entries);
    expect(entries.find(({ id }) => id === 'nearby-c')).toMatchObject({
      name: 'Nearby Host c',
      parentName: 'Nearby Host',
      metadata: {
        distanceParsec: 10,
        radiusEarth: 2.4,
        discoveryMethod: 'Radial Velocity',
        discoveryYear: 2021,
        temperateCandidate: true,
        controversial: false,
      },
    });
    expect(entries.find(({ id }) => id === 'distant-host')?.metadata).toEqual({
      exoplanetHost: true,
      planetCount: 1,
    });
  });

  it('ranks label candidates deterministically and applies a safe result limit', () => {
    const presentation = createExoplanetCatalogPresentation(
      catalog(),
      ['nearby-host', 'distant-host'],
      ['nearby-b', 'nearby-c', 'distant-b'],
      new Set(),
    );

    expect(presentation.renderableHostIndices).toEqual([0, 1]);
    expect(presentation.getLabelObjects(-1)).toEqual([]);
    expect(presentation.getLabelObjects(1.9)).toEqual([
      expect.objectContaining({
        id: 'nearby-host',
        name: 'Nearby Host',
        metadata: expect.objectContaining({ exoplanetHostRank: 0, distanceParsec: 10 }),
      }),
    ]);
    expect(presentation.getLabelObjects(99)).toHaveLength(2);
  });
});

function catalog(): ExoplanetCatalog {
  return {
    hostCount: 2,
    planetCount: 3,
    hostNames: ['Nearby Host', 'Distant Host'],
    hostAliases: [['HD 1'], []],
    hostSpectralTypes: ['G2 V', null],
    hostFirstPlanetIndices: new Uint32Array([0, 2]),
    hostPlanetCounts: new Uint16Array([2, 1]),
    hostStarCounts: new Uint8Array([1, 1]),
    hostCircumbinaryFlags: new Uint8Array([0, 0]),
    hostRightAscensionDegrees: new Float64Array([0, 120]),
    hostDeclinationDegrees: new Float64Array([0, 45]),
    hostDistancesParsec: new Float64Array([10, Number.NaN]),
    hostTemperaturesKelvin: new Float32Array([5_700, Number.NaN]),
    hostRadiiSolar: new Float32Array([1, Number.NaN]),
    hostMassesSolar: new Float32Array([1, Number.NaN]),
    hostApparentMagnitudes: new Float32Array([8, Number.NaN]),
    planetNames: ['Nearby Host b', 'Nearby Host c', 'Distant Host b'],
    planetLetters: ['b', 'c', 'b'],
    planetDiscoveryMethods: ['Transit', 'Radial Velocity', 'Imaging'],
    planetDiscoveryFacilities: ['Kepler', 'HARPS', 'Test'],
    planetMassProvenances: ['Mass', 'M-R relationship', 'Mass'],
    planetHostIndices: new Uint32Array([0, 0, 1]),
    planetOrbitalPeriodsDays: new Float64Array([10, 20, Number.NaN]),
    planetSemiMajorAxesAu: new Float64Array([0.1, 0.2, Number.NaN]),
    planetRadiiEarth: new Float32Array([1.1, 2.4, Number.NaN]),
    planetMassesEarth: new Float32Array([1.3, 6.2, Number.NaN]),
    planetEquilibriumTemperaturesKelvin: new Float32Array([500, 280, Number.NaN]),
    planetEccentricities: new Float32Array([0.02, 0.1, Number.NaN]),
    planetInclinationsDegrees: new Float32Array([89, 88, Number.NaN]),
    planetInsolationsEarth: new Float32Array([3, 1.1, Number.NaN]),
    planetDiscoveryYears: new Uint16Array([2020, 2021, 2022]),
    planetControversialFlags: new Uint8Array([0, 0, 1]),
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
      counts: { hosts: 2, planets: 3, positionedHosts: 1, positionedPlanets: 2 },
      missingDistanceFallbackParsec: 1_000,
    },
  };
}
