import type { CosmicGroupCatalog } from './cosmic-group-catalog';
import type { CosmicStructureCatalog } from './cosmic-structure-catalog';
import type { CosmicWebVolume } from './cosmic-web-volume';
import type { LoadedDeferredUniverseCatalogs } from './deferred-universe-catalog-load';
import { deferredUniverseCatalogTransferables } from './deferred-universe-catalog-worker-protocol';
import type { ExoplanetCatalog } from './exoplanet-catalog';

describe('deferredUniverseCatalogTransferables', () => {
  it('transfère tous les buffers binaires des catalogues décodés', () => {
    const catalogs = loadedCatalogsFixture();

    expect(deferredUniverseCatalogTransferables(catalogs)).toEqual([
      ...catalogBuffers(catalogs.cosmicGroupCatalog!),
      ...catalogBuffers(catalogs.cosmicStructureCatalog!),
      catalogs.cosmicWebVolume!.density.buffer,
      ...catalogBuffers(catalogs.exoplanetCatalog!),
    ]);
  });

  it('ne transfère rien lorsque tous les catalogues optionnels sont absents', () => {
    expect(
      deferredUniverseCatalogTransferables({
        cosmicGroupCatalog: null,
        cosmicStructureCatalog: null,
        cosmicWebVolume: null,
        exoplanetCatalog: null,
        warnings: ['catalogues indisponibles'],
      }),
    ).toEqual([]);
  });

  it('ignore un SharedArrayBuffer qui ne peut pas figurer dans une liste de transfert', () => {
    const volume = cosmicWebVolumeFixture();

    expect(
      deferredUniverseCatalogTransferables({
        cosmicGroupCatalog: null,
        cosmicStructureCatalog: null,
        cosmicWebVolume: {
          ...volume,
          density: new Uint8Array(new SharedArrayBuffer(volume.density.byteLength)),
        },
        exoplanetCatalog: null,
        warnings: [],
      }),
    ).toEqual([]);
  });
});

function catalogBuffers(catalog: CosmicGroupCatalog): ArrayBufferLike[];
function catalogBuffers(catalog: CosmicStructureCatalog): ArrayBufferLike[];
function catalogBuffers(catalog: ExoplanetCatalog): ArrayBufferLike[];
function catalogBuffers(
  catalog: CosmicGroupCatalog | CosmicStructureCatalog | ExoplanetCatalog,
): ArrayBufferLike[] {
  if ('hostCount' in catalog) {
    return [
      catalog.hostFirstPlanetIndices.buffer,
      catalog.hostPlanetCounts.buffer,
      catalog.hostStarCounts.buffer,
      catalog.hostCircumbinaryFlags.buffer,
      catalog.hostRightAscensionDegrees.buffer,
      catalog.hostDeclinationDegrees.buffer,
      catalog.hostDistancesParsec.buffer,
      catalog.hostTemperaturesKelvin.buffer,
      catalog.hostRadiiSolar.buffer,
      catalog.hostMassesSolar.buffer,
      catalog.hostApparentMagnitudes.buffer,
      catalog.planetHostIndices.buffer,
      catalog.planetOrbitalPeriodsDays.buffer,
      catalog.planetSemiMajorAxesAu.buffer,
      catalog.planetRadiiEarth.buffer,
      catalog.planetMassesEarth.buffer,
      catalog.planetEquilibriumTemperaturesKelvin.buffer,
      catalog.planetEccentricities.buffer,
      catalog.planetInclinationsDegrees.buffer,
      catalog.planetInsolationsEarth.buffer,
      catalog.planetDiscoveryYears.buffer,
      catalog.planetControversialFlags.buffer,
    ];
  }
  if ('radiiMpc' in catalog) {
    return [
      catalog.positionsMpc.buffer,
      catalog.distancesMpc.buffer,
      catalog.radiiMpc.buffer,
      catalog.confidences.buffer,
      catalog.densityContrasts.buffer,
      catalog.boundaryDistancesMpc.buffer,
      catalog.galaxyCounts.buffer,
      catalog.sourceIndices.buffer,
      catalog.catalogNumericIds.buffer,
      catalog.flags.buffer,
    ];
  }

  return [
    catalog.positionsMpc.buffer,
    catalog.distancesMpc.buffer,
    catalog.distanceModulusErrors.buffer,
    catalog.velocitiesCmbKmPerSecond.buffer,
    catalog.pgcIds.buffer,
    catalog.distanceModuli.buffer,
    catalog.filamentPairs.buffer,
  ];
}

function loadedCatalogsFixture(): LoadedDeferredUniverseCatalogs {
  return {
    cosmicGroupCatalog: cosmicGroupFixture(),
    cosmicStructureCatalog: cosmicStructureFixture(),
    cosmicWebVolume: cosmicWebVolumeFixture(),
    exoplanetCatalog: exoplanetFixture(),
    warnings: [],
  };
}

function cosmicGroupFixture(): CosmicGroupCatalog {
  return {
    count: 1,
    referenceEpochJulianDay: 2_451_545,
    minimumDistanceMpc: 12,
    maximumDistanceMpc: 12,
    positionsMpc: new Float32Array([12, 0, 0]),
    distancesMpc: new Float32Array([12]),
    distanceModulusErrors: new Float32Array([0.1]),
    velocitiesCmbKmPerSecond: new Int32Array([800]),
    pgcIds: new Uint32Array([1]),
    distanceModuli: new Float32Array([30]),
    filamentPairs: new Uint32Array(),
  };
}

function cosmicStructureFixture(): CosmicStructureCatalog {
  return {
    count: 1,
    referenceEpochJulianDay: 2_451_545,
    minimumDistanceMpc: 20,
    maximumDistanceMpc: 20,
    positionsMpc: new Float32Array([20, 0, 0]),
    distancesMpc: new Float32Array([20]),
    radiiMpc: new Float32Array([2]),
    confidences: new Float32Array([0.9]),
    densityContrasts: new Float32Array([1.2]),
    boundaryDistancesMpc: new Float32Array([2]),
    galaxyCounts: new Uint32Array([12]),
    sourceIndices: new Uint16Array([0]),
    catalogNumericIds: new Uint16Array([1]),
    flags: new Uint8Array([0]),
    identifiers: ['fixture-1'],
    structureTypes: ['cluster'],
    metadata: {
      version: '1',
      recordCount: 1,
      referenceEpochJulianDay: 2_451_545,
      referenceFrame: 'equatorial-j2000',
      distanceUnit: 'megaparsec',
      scientificConfidence: 'calculated',
      sources: [
        {
          id: 'fixture',
          name: 'Fixture',
          citation: 'Fixture',
          sourceUrl: 'https://example.test',
          structureType: 'cluster',
          method: 'test',
          objectNamePrefix: 'Fixture',
          scientificConfidence: 'calculated',
          recordCount: 1,
        },
      ],
    },
  };
}

function cosmicWebVolumeFixture(): CosmicWebVolume {
  return {
    resolution: 4,
    halfExtentMpc: 20,
    referenceEpochJulianDay: 2_451_545,
    sourceGroupCount: 1,
    sourceEdgeCount: 0,
    density: new Uint8Array(64),
  };
}

function exoplanetFixture(): ExoplanetCatalog {
  return {
    hostCount: 1,
    planetCount: 1,
    hostNames: ['Fixture'],
    hostAliases: [[]],
    hostSpectralTypes: ['G'],
    hostFirstPlanetIndices: new Uint32Array([0]),
    hostPlanetCounts: new Uint16Array([1]),
    hostStarCounts: new Uint8Array([1]),
    hostCircumbinaryFlags: new Uint8Array([0]),
    hostRightAscensionDegrees: new Float64Array([0]),
    hostDeclinationDegrees: new Float64Array([0]),
    hostDistancesParsec: new Float64Array([10]),
    hostTemperaturesKelvin: new Float32Array([5_800]),
    hostRadiiSolar: new Float32Array([1]),
    hostMassesSolar: new Float32Array([1]),
    hostApparentMagnitudes: new Float32Array([5]),
    planetNames: ['Fixture b'],
    planetLetters: ['b'],
    planetDiscoveryMethods: ['Transit'],
    planetDiscoveryFacilities: ['Fixture'],
    planetMassProvenances: ['Mass'],
    planetHostIndices: new Uint32Array([0]),
    planetOrbitalPeriodsDays: new Float64Array([3]),
    planetSemiMajorAxesAu: new Float64Array([0.05]),
    planetRadiiEarth: new Float32Array([1]),
    planetMassesEarth: new Float32Array([1]),
    planetEquilibriumTemperaturesKelvin: new Float32Array([300]),
    planetEccentricities: new Float32Array([0]),
    planetInclinationsDegrees: new Float32Array([90]),
    planetInsolationsEarth: new Float32Array([1]),
    planetDiscoveryYears: new Uint16Array([2_025]),
    planetControversialFlags: new Uint8Array([0]),
    metadata: {
      version: '1',
      format: 'exoplanet-catalog-v1',
      source: {
        name: 'Fixture',
        url: 'https://example.test',
        tapUrl: 'https://example.test/tap',
        table: 'PSCompPars',
        query: 'select fixture',
        snapshotDate: '2026-01-01',
        sha256: 'fixture',
      },
      counts: { hosts: 1, planets: 1, positionedHosts: 1, positionedPlanets: 1 },
      missingDistanceFallbackParsec: 1_000,
    },
  };
}
