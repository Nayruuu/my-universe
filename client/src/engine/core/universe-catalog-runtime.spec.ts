import { type SpaceObject } from '../../data/models/universe.models';
import { CoordinateSystem } from '../coordinates/coordinate-system';
import { type LoadedUniverseAssets } from '../loaders/asset-loader';
import { type CosmicGroupCatalog } from '../loaders/cosmic-group-catalog';
import {
  type CosmicStructureCatalog,
  type CosmicStructureCatalogMetadata,
} from '../loaders/cosmic-structure-catalog';
import { type CosmicWebVolume } from '../loaders/cosmic-web-volume';
import { type ExoplanetCatalog } from '../loaders/exoplanet-catalog';
import { type StarCatalog } from '../loaders/star-catalog';
import { CosmicGroupCatalogRegistry } from '../objects/cosmic-group-catalog-registry';
import { CosmicStructureCatalogRegistry } from '../objects/cosmic-structure-catalog-registry';
import { ExoplanetCatalogRegistry } from '../objects/exoplanet-catalog-registry';
import { StarCatalogRegistry } from '../objects/star-catalog-registry';
import { SpaceTileManager } from '../tiles/space-tile-manager';
import { StarTileManager } from '../tiles/star-tile-manager';
import {
  createUniverseCatalogRuntime,
  UniverseCatalogRuntime,
  type UniverseCatalogScene,
} from './universe-catalog-runtime';

describe('UniverseCatalogRuntime', () => {
  it('conserve les objets statiques et expose des sources neutres sans catalogues optionnels', async () => {
    const object = staticObject('earth', 'Terre');
    const assets = emptyAssets([object]);
    const scene = sceneHarness();
    const runtime = await createUniverseCatalogRuntime(assets, new CoordinateSystem(), scene.scene);

    expect(runtime.baseObjects).toEqual([object]);
    expect(runtime.baseObjects).not.toBe(assets.objects);
    expect(runtime.starCatalogRegistry).toBeNull();
    expect(runtime.exoplanetCatalogRegistry).toBeNull();
    expect(runtime.cosmicGroupCatalogRegistry).toBeNull();
    expect(runtime.cosmicStructureCatalogRegistry).toBeNull();
    expect(runtime.spaceTileManager).toBeNull();
    expect(runtime.starTileManager).toBeNull();
    expect(runtime.tempelFilamentSpineSource).toBeNull();
    expect(runtime.constellationCatalog).toBeNull();
    expect(runtime.has('missing')).toBe(false);
    expect(runtime.isCatalogStar('missing')).toBe(false);
    expect(runtime.isExoplanetHost('missing')).toBe(false);
    expect(runtime.supportsWheelNavigation('missing')).toBe(false);
    expect(runtime.getDefinition('missing')).toBeUndefined();
    expect(runtime.getSearchEntries()).toEqual([]);
    expect(runtime.getLabelObjects([], 10, 10, 10)).toEqual([]);
    await expect(runtime.installDeferredCatalogs()).resolves.toEqual([]);
    expect(scene.calls()).toEqual([]);
  });

  it('construit et relie toutes les sources statiques à la scène', async () => {
    const linkedStar = catalogStar();
    const assets: LoadedUniverseAssets = {
      ...emptyAssets([linkedStar]),
      starCatalog: starCatalog(),
      exoplanetCatalog: exoplanetCatalog(),
      cosmicGroupCatalog: cosmicGroupCatalog(),
      cosmicStructureCatalog: cosmicStructureCatalog(),
      cosmicWebVolume: cosmicWebVolume(),
      constellationCatalog: {
        version: '1.0.0',
        source: { name: 'Test', url: 'https://example.test', license: 'Test' },
        referenceFrame: 'equatorial-j2000',
        scientificConfidence: 'illustrative',
        starCatalog: 'hyg-v41-bright-stars',
        figures: [],
      },
      spaceTileIndex: {
        version: '1.0.0',
        tiles: [],
        searchEntries: [],
        overviewEntries: [],
      },
      starTileSource: {
        id: 'stellar-tiles',
        url: '/data/stars/index.json',
        starCatalogId: 'hyg-v41-bright-stars',
      },
      tempelFilamentSpineSource: {
        id: 'tempel-spines',
        url: '/data/structures/tempel.bin',
      },
    };
    const scene = sceneHarness();
    const coordinateSystem = new CoordinateSystem();
    const runtime = await createUniverseCatalogRuntime(assets, coordinateSystem, scene.scene);

    expect(runtime.baseObjects[0]?.positionProvider.type).toBe('static');
    expect(runtime.starCatalogRegistry).toBeInstanceOf(StarCatalogRegistry);
    expect(runtime.starCatalogRegistry?.has('sirius')).toBe(true);
    expect(runtime.exoplanetCatalogRegistry).toBeInstanceOf(ExoplanetCatalogRegistry);
    expect(runtime.cosmicGroupCatalogRegistry).toBeInstanceOf(CosmicGroupCatalogRegistry);
    expect(runtime.cosmicStructureCatalogRegistry).toBeInstanceOf(CosmicStructureCatalogRegistry);
    expect(runtime.spaceTileManager).toBeInstanceOf(SpaceTileManager);
    expect(runtime.starTileManager).toBeInstanceOf(StarTileManager);
    expect(runtime.tempelFilamentSpineSource).toBe(assets.tempelFilamentSpineSource);
    expect(runtime.constellationCatalog).toBe(assets.constellationCatalog);
    expect(scene.setNearbyGalaxyOverview).toHaveBeenCalledWith(
      assets.spaceTileIndex,
      coordinateSystem,
    );
    expect(scene.setStarCatalog).toHaveBeenCalledWith(runtime.starCatalogRegistry);
    expect(scene.setConstellationCatalog).toHaveBeenCalledWith(
      assets.constellationCatalog,
      runtime.starCatalogRegistry,
    );
    expect(scene.setExoplanetCatalog).toHaveBeenCalledWith(runtime.exoplanetCatalogRegistry);
    expect(scene.setCosmicGroupCatalog).toHaveBeenCalledWith(runtime.cosmicGroupCatalogRegistry);
    expect(scene.setCosmicStructureCatalog).toHaveBeenCalledWith(
      runtime.cosmicStructureCatalogRegistry,
    );
    expect(scene.setCosmicWebVolume).toHaveBeenCalledWith(assets.cosmicWebVolume, coordinateSystem);

    const exoplanetHostId = runtime.exoplanetCatalogRegistry!.getHostObjectId(0);
    const exoplanetId = runtime.exoplanetCatalogRegistry!.getPlanetObjectId(0);
    const cosmicGroupId = 'cf4-pgc-35';
    const cosmicStructureId = 'lss-test-superclusters-sc-1';

    expect(runtime.has('sirius')).toBe(true);
    expect(runtime.has(exoplanetHostId)).toBe(true);
    expect(runtime.has(cosmicGroupId)).toBe(true);
    expect(runtime.has(cosmicStructureId)).toBe(true);
    expect(runtime.has('missing')).toBe(false);
    expect(runtime.isCatalogStar('sirius')).toBe(true);
    expect(runtime.isCatalogStar(exoplanetHostId)).toBe(false);
    expect(runtime.isExoplanetHost(exoplanetHostId)).toBe(true);
    expect(runtime.isExoplanetHost(exoplanetId)).toBe(false);
    expect(runtime.supportsWheelNavigation('sirius')).toBe(false);
    expect(runtime.supportsWheelNavigation(exoplanetId)).toBe(true);
    expect(runtime.supportsWheelNavigation(cosmicGroupId)).toBe(true);
    expect(runtime.supportsWheelNavigation(cosmicStructureId)).toBe(true);
    expect(runtime.getDefinition('sirius')?.name).toBe('Sirius');
    expect(runtime.getDefinition(exoplanetHostId)?.name).toBe('Kepler-22');
    expect(runtime.getDefinition(cosmicGroupId)?.name).toBe('Groupe PGC 35');
    expect(runtime.getDefinition(cosmicStructureId)?.name).toBe('Superamas SC-1');
    expect(runtime.getDefinition('missing')).toBeUndefined();
    expect(runtime.getSearchEntries().map(({ id }) => id)).toEqual([
      exoplanetHostId,
      exoplanetId,
      cosmicGroupId,
      cosmicStructureId,
    ]);
    expect(runtime.getLabelObjects([], 1, 1, 1).map(({ id }) => id)).toEqual([
      exoplanetHostId,
      cosmicGroupId,
      cosmicStructureId,
    ]);
  });

  it('accepte un catalogue stellaire sans tuiles ni constellations', async () => {
    const assets: LoadedUniverseAssets = {
      ...emptyAssets([]),
      starCatalog: starCatalog(),
    };
    const scene = sceneHarness();
    const runtime = await createUniverseCatalogRuntime(assets, new CoordinateSystem(), scene.scene);

    expect(runtime.starCatalogRegistry).toBeInstanceOf(StarCatalogRegistry);
    expect(runtime.starTileManager).toBeNull();
    expect(scene.setStarCatalog).toHaveBeenCalledOnce();
    expect(scene.setConstellationCatalog).not.toHaveBeenCalled();
  });

  it('installe en parallèle les couches indépendantes du catalogue', async () => {
    const assets: LoadedUniverseAssets = {
      ...emptyAssets([]),
      starCatalog: starCatalog(),
      exoplanetCatalog: exoplanetCatalog(),
      cosmicGroupCatalog: cosmicGroupCatalog(),
      cosmicStructureCatalog: cosmicStructureCatalog(),
      cosmicWebVolume: cosmicWebVolume(),
      spaceTileIndex: {
        version: '1.0.0',
        tiles: [],
        searchEntries: [],
        overviewEntries: [],
      },
    };
    const scene = sceneHarness();
    const gates = [
      scene.setNearbyGalaxyOverview,
      scene.setStarCatalog,
      scene.setExoplanetCatalog,
      scene.setCosmicGroupCatalog,
      scene.setCosmicStructureCatalog,
      scene.setCosmicWebVolume,
    ].map((operation) => {
      const gate = deferred<void>();

      operation.mockReturnValueOnce(gate.promise);

      return gate;
    });
    let resolved = false;
    const creation = createUniverseCatalogRuntime(assets, new CoordinateSystem(), scene.scene).then(
      (runtime) => {
        resolved = true;

        return runtime;
      },
    );

    await vi.waitFor(() => {
      expect(scene.setNearbyGalaxyOverview).toHaveBeenCalledOnce();
      expect(scene.setStarCatalog).toHaveBeenCalledOnce();
      expect(scene.setExoplanetCatalog).toHaveBeenCalledOnce();
      expect(scene.setCosmicGroupCatalog).toHaveBeenCalledOnce();
      expect(scene.setCosmicStructureCatalog).toHaveBeenCalledOnce();
      expect(scene.setCosmicWebVolume).toHaveBeenCalledOnce();
    });
    expect(resolved).toBe(false);

    for (const gate of gates) {
      gate.resolve();
    }

    await expect(creation).resolves.toBeInstanceOf(UniverseCatalogRuntime);
  });

  it('installe une seule fois les catalogues différés et les expose ensuite', async () => {
    const deferredCatalogs = {
      exoplanetCatalog: exoplanetCatalog(),
      cosmicGroupCatalog: cosmicGroupCatalog(),
      cosmicStructureCatalog: cosmicStructureCatalog(),
      cosmicWebVolume: cosmicWebVolume(),
      warnings: ['catalogue différé incomplet'],
    };
    const loadDeferredCatalogs = vi.fn(async () => deferredCatalogs);
    const assets: LoadedUniverseAssets = {
      ...emptyAssets([]),
      loadDeferredCatalogs,
    };
    const scene = sceneHarness();
    const runtime = await createUniverseCatalogRuntime(assets, new CoordinateSystem(), scene.scene);

    expect(runtime.hasDeferredCatalogs).toBe(true);
    expect(runtime.exoplanetCatalogRegistry).toBeNull();

    const firstInstallation = runtime.installDeferredCatalogs();
    const concurrentInstallation = runtime.installDeferredCatalogs();

    expect(concurrentInstallation).toBe(firstInstallation);
    await expect(firstInstallation).resolves.toEqual(['catalogue différé incomplet']);
    expect(loadDeferredCatalogs).toHaveBeenCalledOnce();
    expect(runtime.hasDeferredCatalogs).toBe(false);
    expect(runtime.exoplanetCatalogRegistry).toBeInstanceOf(ExoplanetCatalogRegistry);
    expect(runtime.cosmicGroupCatalogRegistry).toBeInstanceOf(CosmicGroupCatalogRegistry);
    expect(runtime.cosmicStructureCatalogRegistry).toBeInstanceOf(CosmicStructureCatalogRegistry);
    expect(scene.setExoplanetCatalog).toHaveBeenCalledOnce();
    expect(scene.setCosmicGroupCatalog).toHaveBeenCalledOnce();
    expect(scene.setCosmicStructureCatalog).toHaveBeenCalledOnce();
    expect(scene.setCosmicWebVolume).toHaveBeenCalledOnce();
    await expect(runtime.installDeferredCatalogs()).resolves.toEqual([
      'catalogue différé incomplet',
    ]);
    expect(loadDeferredCatalogs).toHaveBeenCalledOnce();
  });

  it('sépare les couches différées en plusieurs tâches pour préserver les images', async () => {
    const yieldControl = vi.fn(async () => undefined);
    const scene = sceneHarness();
    const runtime = new UniverseCatalogRuntime({
      baseObjects: [],
      starCatalogRegistry: null,
      exoplanetCatalogRegistry: null,
      cosmicGroupCatalogRegistry: null,
      cosmicStructureCatalogRegistry: null,
      spaceTileManager: null,
      starTileManager: null,
      tempelFilamentSpineSource: null,
      loadDeferredCatalogs: async () => ({
        exoplanetCatalog: exoplanetCatalog(),
        cosmicGroupCatalog: cosmicGroupCatalog(),
        cosmicStructureCatalog: cosmicStructureCatalog(),
        cosmicWebVolume: cosmicWebVolume(),
        warnings: [],
      }),
      coordinateSystem: new CoordinateSystem(),
      scene: scene.scene,
      yieldControl,
    });

    await runtime.installDeferredCatalogs();

    expect(yieldControl).toHaveBeenCalledTimes(4);
    expect(scene.setExoplanetCatalog).toHaveBeenCalledOnce();
    expect(scene.setCosmicGroupCatalog).toHaveBeenCalledOnce();
    expect(scene.setCosmicStructureCatalog).toHaveBeenCalledOnce();
    expect(scene.setCosmicWebVolume).toHaveBeenCalledOnce();
  });

  it('ne planifie pas de tâche pour une couche différée absente', async () => {
    const yieldControl = vi.fn(async () => undefined);
    const scene = sceneHarness();
    const runtime = new UniverseCatalogRuntime({
      baseObjects: [],
      starCatalogRegistry: null,
      exoplanetCatalogRegistry: null,
      cosmicGroupCatalogRegistry: null,
      cosmicStructureCatalogRegistry: null,
      spaceTileManager: null,
      starTileManager: null,
      tempelFilamentSpineSource: null,
      loadDeferredCatalogs: async () => ({
        exoplanetCatalog: exoplanetCatalog(),
        cosmicGroupCatalog: null,
        cosmicStructureCatalog: null,
        cosmicWebVolume: null,
        warnings: [],
      }),
      coordinateSystem: new CoordinateSystem(),
      scene: scene.scene,
      yieldControl,
    });

    await runtime.installDeferredCatalogs();

    expect(yieldControl).toHaveBeenCalledOnce();
    expect(scene.setExoplanetCatalog).toHaveBeenCalledOnce();
    expect(scene.setCosmicGroupCatalog).not.toHaveBeenCalled();
    expect(scene.setCosmicStructureCatalog).not.toHaveBeenCalled();
    expect(scene.setCosmicWebVolume).not.toHaveBeenCalled();
  });

  it('refuse une installation différée sur un runtime sans dépendances de scène', async () => {
    const runtime = new UniverseCatalogRuntime({
      baseObjects: [],
      starCatalogRegistry: null,
      exoplanetCatalogRegistry: null,
      cosmicGroupCatalogRegistry: null,
      cosmicStructureCatalogRegistry: null,
      spaceTileManager: null,
      starTileManager: null,
      tempelFilamentSpineSource: null,
      loadDeferredCatalogs: async () => ({
        exoplanetCatalog: null,
        cosmicGroupCatalog: null,
        cosmicStructureCatalog: null,
        cosmicWebVolume: null,
        warnings: [],
      }),
    });

    await expect(runtime.installDeferredCatalogs()).rejects.toThrow(
      'Installation différée indisponible',
    );
  });
});

function sceneHarness() {
  const calls: string[] = [];
  const record = (name: string) => {
    calls.push(name);

    return Promise.resolve();
  };
  const setNearbyGalaxyOverview = vi.fn(() => record('nearby-galaxies'));
  const setStarCatalog = vi.fn(() => record('stars'));
  const setConstellationCatalog = vi.fn(() => record('constellations'));
  const setExoplanetCatalog = vi.fn(() => record('exoplanets'));
  const setCosmicGroupCatalog = vi.fn(() => record('cosmic-groups'));
  const setCosmicStructureCatalog = vi.fn(() => record('cosmic-structures'));
  const setCosmicWebVolume = vi.fn(() => record('cosmic-volume'));
  const scene = {
    setNearbyGalaxyOverview,
    setStarCatalog,
    setConstellationCatalog,
    setExoplanetCatalog,
    setCosmicGroupCatalog,
    setCosmicStructureCatalog,
    setCosmicWebVolume,
  } satisfies UniverseCatalogScene;

  return {
    scene,
    calls: () => [...calls],
    setNearbyGalaxyOverview,
    setStarCatalog,
    setConstellationCatalog,
    setExoplanetCatalog,
    setCosmicGroupCatalog,
    setCosmicStructureCatalog,
    setCosmicWebVolume,
  };
}

function emptyAssets(objects: SpaceObject[]): LoadedUniverseAssets {
  return {
    objects,
    starCatalog: null,
    cosmicGroupCatalog: null,
    cosmicStructureCatalog: null,
    cosmicWebVolume: null,
    exoplanetCatalog: null,
    constellationCatalog: null,
    spaceTileIndex: null,
    starTileSource: null,
    tempelFilamentSpineSource: null,
    loadDeferredCatalogs: null,
    warnings: [],
  };
}

function staticObject(id: string, name: string): SpaceObject {
  return {
    id,
    name,
    type: 'planet',
    referenceFrame: 'solar-system',
    scientificConfidence: 'calculated',
    visual: { visualRadius: 1, scaleMode: 'adaptive' },
    positionProvider: { type: 'static', position: [1, 0, 0], unit: 'astronomical-unit' },
  };
}

function deferred<T>(): { readonly promise: Promise<T>; resolve(value: T): void } {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((fulfill) => {
    resolve = fulfill;
  });

  return { promise, resolve };
}

function catalogStar(): SpaceObject {
  return {
    id: 'sirius',
    name: 'Sirius',
    type: 'star',
    parentId: 'milky-way',
    referenceFrame: 'stellar',
    scientificConfidence: 'observed',
    visual: { visualRadius: 1, scaleMode: 'adaptive' },
    positionProvider: {
      type: 'catalog',
      catalogId: 'hyg-v41-bright-stars',
      identifier: 'HIP 32349',
    },
  };
}

function starCatalog(): StarCatalog {
  return {
    count: 1,
    referenceEpochJulianDay: 2_451_545,
    positionsParsec: new Float32Array([-0.494_323, 2.476_731, -0.758_485]),
    apparentMagnitudes: new Float32Array([-1.44]),
    colorIndicesBv: new Float32Array([0.009]),
    catalogIds: new Uint32Array([32_263]),
    names: ['Sirius'],
    aliases: [['HIP 32349', 'HD 48915']],
    spectralTypes: ['A0m'],
  };
}

function cosmicGroupCatalog(): CosmicGroupCatalog {
  return {
    count: 1,
    referenceEpochJulianDay: 2_451_545,
    minimumDistanceMpc: 12.1,
    maximumDistanceMpc: 12.1,
    positionsMpc: new Float32Array([12.1, 0, 0]),
    distancesMpc: new Float32Array([12.1]),
    distanceModulusErrors: new Float32Array([0.1]),
    velocitiesCmbKmPerSecond: new Int32Array([28]),
    pgcIds: new Uint32Array([35]),
    distanceModuli: new Float32Array([30.413]),
    filamentPairs: new Uint32Array(),
  };
}

function cosmicStructureCatalog(): CosmicStructureCatalog {
  return {
    count: 1,
    referenceEpochJulianDay: 2_451_545,
    minimumDistanceMpc: 100,
    maximumDistanceMpc: 100,
    positionsMpc: new Float32Array([100, 0, 0]),
    distancesMpc: new Float32Array([100]),
    radiiMpc: new Float32Array([25]),
    confidences: new Float32Array([0.98]),
    densityContrasts: new Float32Array([Number.NaN]),
    boundaryDistancesMpc: new Float32Array([Number.NaN]),
    galaxyCounts: new Uint32Array([100]),
    sourceIndices: new Uint16Array([0]),
    catalogNumericIds: new Uint16Array([1]),
    flags: new Uint8Array([0]),
    identifiers: ['SC-1'],
    structureTypes: ['supercluster'],
    metadata: cosmicStructureMetadata(),
  };
}

function cosmicStructureMetadata(): CosmicStructureCatalogMetadata {
  return {
    version: '1.0.0',
    recordCount: 1,
    referenceEpochJulianDay: 2_451_545,
    referenceFrame: 'equatorial-j2000',
    distanceUnit: 'megaparsec',
    scientificConfidence: 'calculated',
    sources: [
      {
        id: 'test-superclusters',
        name: 'Test superclusters',
        citation: 'Test et al. (2026)',
        sourceUrl: 'https://example.test/superclusters',
        structureType: 'supercluster',
        method: 'Luminosity density field',
        objectNamePrefix: 'Superamas',
        scientificConfidence: 'calculated',
        recordCount: 1,
      },
    ],
  };
}

function cosmicWebVolume(): CosmicWebVolume {
  return {
    resolution: 4,
    halfExtentMpc: 100,
    referenceEpochJulianDay: 2_451_545,
    sourceGroupCount: 1,
    sourceEdgeCount: 0,
    density: new Uint8Array(64),
  };
}

function exoplanetCatalog(): ExoplanetCatalog {
  return {
    hostCount: 1,
    planetCount: 1,
    hostNames: ['Kepler-22'],
    hostAliases: [[]],
    hostSpectralTypes: ['G5 V'],
    hostFirstPlanetIndices: new Uint32Array([0]),
    hostPlanetCounts: new Uint16Array([1]),
    hostStarCounts: new Uint8Array([1]),
    hostCircumbinaryFlags: new Uint8Array([0]),
    hostRightAscensionDegrees: new Float64Array([285.6]),
    hostDeclinationDegrees: new Float64Array([47.9]),
    hostDistancesParsec: new Float64Array([195]),
    hostTemperaturesKelvin: new Float32Array([5_518]),
    hostRadiiSolar: new Float32Array([0.979]),
    hostMassesSolar: new Float32Array([0.97]),
    hostApparentMagnitudes: new Float32Array([11.7]),
    planetNames: ['Kepler-22 b'],
    planetLetters: ['b'],
    planetDiscoveryMethods: ['Transit'],
    planetDiscoveryFacilities: ['Kepler'],
    planetMassProvenances: ['M-R relationship'],
    planetHostIndices: new Uint32Array([0]),
    planetOrbitalPeriodsDays: new Float64Array([289.9]),
    planetSemiMajorAxesAu: new Float64Array([0.849]),
    planetRadiiEarth: new Float32Array([2.1]),
    planetMassesEarth: new Float32Array([Number.NaN]),
    planetEquilibriumTemperaturesKelvin: new Float32Array([262]),
    planetEccentricities: new Float32Array([Number.NaN]),
    planetInclinationsDegrees: new Float32Array([89.8]),
    planetInsolationsEarth: new Float32Array([1.11]),
    planetDiscoveryYears: new Uint16Array([2011]),
    planetControversialFlags: new Uint8Array([0]),
    metadata: {
      version: '1.0.0',
      format: 'exoplanet-catalog-v1',
      source: {
        name: 'NASA Exoplanet Archive',
        url: 'https://exoplanetarchive.ipac.caltech.edu/',
        tapUrl: 'https://exoplanetarchive.ipac.caltech.edu/TAP/sync',
        table: 'PSCompPars',
        query: 'select test from pscomppars',
        snapshotDate: '2026-08-05',
        sha256: 'a'.repeat(64),
      },
      counts: { hosts: 1, planets: 1, positionedHosts: 1, positionedPlanets: 1 },
      missingDistanceFallbackParsec: 1_000,
    },
  };
}
