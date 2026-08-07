import { SpaceObject } from '../../data/models/universe.models';
import { CoordinateSystem } from '../coordinates/coordinate-system';
import { ExoplanetCatalog } from '../loaders/exoplanet-catalog';
import { ExoplanetObjectFactory } from './exoplanet-object-factory';
import {
  EXOPLANET_MISSING_DISTANCE_FALLBACK_CONFIDENCE,
  ExoplanetCatalogRegistry,
  createNasaCatalogObjectId,
} from './exoplanet-catalog-registry';

describe('ExoplanetCatalogRegistry', () => {
  it.each([0, 2, 511, 512, 513, 1025])(
    'prépare %i systèmes par lots avec les mêmes données et une recherche déjà prête',
    async (count) => {
      const data = largeCatalog(count);
      const coordinates = new CoordinateSystem();
      const featured = [
        featuredObject('linked-host', 'Étoile 0', 'star'),
        featuredObject('linked-planet', 'Étoile 0 b', 'exoplanet'),
      ];
      const expected = new ExoplanetCatalogRegistry(data, coordinates, featured);
      const host = vi.spyOn(ExoplanetObjectFactory.prototype, 'createHostDefinition');
      const planet = vi.spyOn(ExoplanetObjectFactory.prototype, 'createPlanetDefinition');
      const pause = vi.fn(async () => undefined);
      const registry = await ExoplanetCatalogRegistry.create(data, coordinates, featured, pause);

      expect(pause.mock.calls.length).toBeGreaterThanOrEqual(Math.floor(count / 512) * 8);
      expect(host).not.toHaveBeenCalled();
      expect(planet).not.toHaveBeenCalled();
      expect(registry.activeObjectCount).toBe(0);
      expect(registry.hostObjectIds).toEqual(expected.hostObjectIds);
      expect(registry.planetObjectIds).toEqual(expected.planetObjectIds);
      expect(registry.renderPositions).toEqual(expected.renderPositions);
      expect(registry.getRenderableHostIndices()).toEqual(expected.getRenderableHostIndices());
      expect(registry.getLabelObjects(count)).toEqual(expected.getLabelObjects(count));
      const entries = registry.getSearchEntries();

      expect(entries).toEqual(expected.getSearchEntries());
      expect(registry.getSearchEntries()).toBe(entries);
      expect(entries.map(({ id }) => id)).toEqual([
        ...registry.hostObjectIds.slice(1),
        ...registry.planetObjectIds.slice(1),
      ]);
      for (let index = 0; index < count; index += 1) {
        const hostId = registry.getHostObjectId(index);
        const planetId = registry.getPlanetObjectId(index);

        expect(registry.getHostIndex(hostId)).toBe(index);
        expect(registry.getHostIndex(planetId)).toBe(index);
        expect(registry.getDefinition(hostId)).toEqual(expected.getDefinition(hostId));
        expect(registry.getDefinition(planetId)).toEqual(expected.getDefinition(planetId));
      }
      host.mockRestore();
      planet.mockRestore();
    },
  );

  it('utilise aussi l’ordonnanceur navigateur par défaut', async () => {
    const registry = await ExoplanetCatalogRegistry.create(catalog(), new CoordinateSystem());

    expect(registry.getSearchEntries()).toEqual(createRegistry().getSearchEntries());
  });

  it('interrompt chaque étape sans exposer un registre partiel', async () => {
    const data = largeCatalog(513);
    let totalPauses = 0;

    await ExoplanetCatalogRegistry.create(data, new CoordinateSystem(), [], async () => {
      totalPauses += 1;
    });
    expect(totalPauses).toBeGreaterThan(10);
    for (let cancelAt = 1; cancelAt <= totalPauses; cancelAt += 1) {
      let pauses = 0;
      const error = new Error('annulé');
      const published = vi.fn();
      const pending = ExoplanetCatalogRegistry.create(
        data,
        new CoordinateSystem(),
        [],
        async () => {
          pauses += 1;
          if (pauses === cancelAt) {
            throw error;
          }
        },
      ).then(published);

      await expect(pending).rejects.toBe(error);
      expect(pauses).toBe(cancelAt);
      expect(published).not.toHaveBeenCalled();
    }
  });

  it('prépare les grands ensembles d’alias sans changer la priorité du dernier objet', async () => {
    const first = {
      ...featuredObject('first', 'Nearby Host', 'star'),
      aliases: Array.from({ length: 513 }, (_, index) => `Alias ${index}`),
    };
    const last = featuredObject('last', 'Alias 512', 'star');
    const objects = [
      ...Array.from({ length: 512 }, (_, index) =>
        featuredObject(`unrelated-${index}`, `Unrelated ${index}`, 'exoplanet'),
      ),
      first,
      last,
    ];
    const data = catalogWith({ hostNames: ['Nearby Host', 'Alias 512'] });
    const pause = vi.fn(async () => undefined);
    const registry = await ExoplanetCatalogRegistry.create(
      data,
      new CoordinateSystem(),
      objects,
      pause,
    );

    expect(pause.mock.calls.length).toBeGreaterThanOrEqual(3);
    expect(registry.hostObjectIds).toEqual(['first', 'last']);
    expect(registry.getSearchEntries()).toEqual(
      new ExoplanetCatalogRegistry(data, new CoordinateSystem(), objects).getSearchEntries(),
    );
  });

  it('rejette aussi les collisions entre hôtes et planètes liés et après un lot', async () => {
    const objects = [
      featuredObject('same', 'Nearby Host', 'star'),
      featuredObject('same', 'Nearby Host b', 'exoplanet'),
    ];

    await expect(
      ExoplanetCatalogRegistry.create(catalog(), new CoordinateSystem(), objects),
    ).rejects.toThrow('identifiants de carte dupliqués');
    const data = largeCatalog(513);
    const names = [...data.planetNames];

    names[512] = names[0]!;
    await expect(
      ExoplanetCatalogRegistry.create(
        { ...data, planetNames: names },
        new CoordinateSystem(),
        [],
        async () => undefined,
      ),
    ).rejects.toThrow('identifiants de carte dupliqués');
  });

  it('creates stable unique identifiers and links curated definitions by NASA name', () => {
    expect(createNasaCatalogObjectId('host', 'Kepler-452')).toMatch(
      /^nea-host-kepler-452-[a-z0-9]+$/u,
    );
    expect(createNasaCatalogObjectId('planet', 'Kepler-452 b')).not.toBe(
      createNasaCatalogObjectId('host', 'Kepler-452 b'),
    );

    const registry = createRegistry([featuredObject('nearby-host', 'Nearby Host', 'star')]);

    expect(registry.getHostObjectId(0)).toBe('nearby-host');
    expect(registry.getHostObjectId(1)).toMatch(/^nea-host-distant-host-/u);
    expect(new Set([...registry.hostObjectIds, ...registry.planetObjectIds]).size).toBe(5);
  });

  it('rotates ICRS coordinates independently into the Galactic scene convention', () => {
    const registry = createRegistry();
    const position = registry.getLocalPosition(registry.getHostObjectId(0))!;
    const direction = position.normalize();
    const expected = {
      x: 0.054_875_560_4,
      y: -0.867_666_149,
      z: 0.494_109_427_9,
    };

    expect(direction.x).toBeCloseTo(expected.x, 6);
    expect(direction.y).toBeCloseTo(expected.y, 6);
    expect(direction.z).toBeCloseTo(expected.z, 6);
  });

  it('uses an explicit illustrative depth only when NASA publishes no distance', () => {
    const registry = createRegistry();
    const hostId = registry.getHostObjectId(1);
    const host = registry.getDefinition(hostId)!;
    const planet = registry.getDefinition(registry.getPlanetObjectId(2))!;

    expect(host.metadata?.['mapDistanceUnavailable']).toBe(true);
    expect(host.metadata?.['mapDistanceConfidence']).toBe(
      EXOPLANET_MISSING_DISTANCE_FALLBACK_CONFIDENCE,
    );
    expect(host.metadata?.['mapDistanceFallbackPc']).toBe(1_000);
    expect(planet.metadata?.['mapDistanceUnavailable']).toBe(true);
    expect(registry.getLocalPosition(hostId)?.length()).toBeGreaterThan(1_000);
  });

  it('builds a complete local system without instantiating the whole catalogue', () => {
    const registry = createRegistry();
    const planetId = registry.getPlanetObjectId(1);
    const objects = registry.createSystemObjects(planetId);
    const host = objects[0]!;
    const planets = objects.slice(1);

    expect(objects).toHaveLength(3);
    expect(host.id).toBe(registry.getHostObjectId(0));
    expect(planets.map(({ parentId }) => parentId)).toEqual([host.id, host.id]);
    expect(
      planets.every(({ positionProvider }) => positionProvider.type === 'illustrative-orbit'),
    ).toBe(true);
    expect(planets[0]?.metadata?.['semiMajorAxisSource']).toBe('NASA Exoplanet Archive');
    expect(planets[0]?.metadata?.['orbitalPeriodSource']).toBe('NASA Exoplanet Archive');
    expect(planets[0]?.scientificConfidence).toBe('observed');
    expect(registry.activeObjectCount).toBe(0);
  });

  it('derives only missing orbit dimensions and labels the fallback provenance', () => {
    const registry = createRegistry();
    const sparsePlanet = registry.getDefinition(registry.getPlanetObjectId(2))!;

    expect(sparsePlanet.positionProvider.type).toBe('illustrative-orbit');
    if (sparsePlanet.positionProvider.type !== 'illustrative-orbit') {
      throw new Error('Expected an illustrative orbit.');
    }
    expect(sparsePlanet.positionProvider.semiMajorAxis).toBeGreaterThan(0);
    expect(sparsePlanet.positionProvider.orbitalPeriodDays).toBeGreaterThan(0);
    expect(sparsePlanet.metadata?.['semiMajorAxisSource']).toBe('Illustrative map spacing');
    expect(sparsePlanet.metadata?.['orbitalPeriodSource']).toBe('Illustrative map timing');
  });

  it('exposes searchable planets, hosts, filter metadata, and ranked collision-safe labels', () => {
    const registry = createRegistry([
      featuredObject('nearby-host', 'Nearby Host', 'star'),
      featuredObject('nearby-host-b', 'Nearby Host b', 'exoplanet'),
    ]);
    const entries = registry.getSearchEntries();
    const planetEntry = entries.find(({ name }) => name === 'Nearby Host c');
    const labels = registry.getLabelObjects(1);

    expect(entries).toHaveLength(3);
    expect(planetEntry).toMatchObject({
      type: 'exoplanet',
      parentName: 'Nearby Host',
      metadata: {
        distanceParsec: 10,
        radiusEarth: 2.4,
        discoveryMethod: 'Radial Velocity',
        temperateCandidate: true,
      },
    });
    expect(labels).toHaveLength(1);
    expect(labels[0]?.name).toBe('Distant Host');
    expect(labels[0]?.metadata?.['exoplanetHost']).toBe(true);
  });

  it('maps planets to their host position and rejects unknown identifiers', () => {
    const registry = createRegistry();
    const planetId = registry.getPlanetObjectId(0);
    const hostId = registry.getHostObjectId(0);

    expect(registry.has(planetId)).toBe(true);
    expect(registry.isHost(hostId)).toBe(true);
    expect(registry.isHost(planetId)).toBe(false);
    expect(registry.getHostIdForObject(planetId)).toBe(hostId);
    expect(registry.getLocalPosition(planetId)).toEqual(registry.getLocalPosition(hostId));
    expect(registry.getDefinition('missing')).toBeUndefined();
    expect(registry.createSystemObjects('missing')).toEqual([]);
    expect(registry.getHostIdForObject('missing')).toBeNull();
  });

  it('resolves host indices, cached definitions, render ranks, and invalid indices', () => {
    const registry = createRegistry();
    const hostId = registry.getHostObjectId(0);
    const planetId = registry.getPlanetObjectId(1);
    const definition = registry.getDefinition(hostId);

    expect(registry.getHostIndex(hostId)).toBe(0);
    expect(registry.getHostIndex(planetId)).toBe(0);
    expect(registry.getHostIndex('missing')).toBeNull();
    expect(registry.getRenderableHostIndices()).toHaveLength(2);
    expect(registry.getDefinition(hostId)).toBe(definition);
    expect(() => registry.getHostObjectId(99)).toThrow(/hors limites/u);
    expect(() => registry.getPlanetObjectId(99)).toThrow(/hors limites/u);
  });

  it('calculates either missing orbital dimension with Kepler’s third law', () => {
    const missingAxis = catalogWith({
      planetSemiMajorAxesAu: new Float64Array([Number.NaN, 0.2, Number.NaN]),
    });
    const missingPeriod = catalogWith({
      planetOrbitalPeriodsDays: new Float64Array([Number.NaN, 20, Number.NaN]),
    });
    const axisPlanet = new ExoplanetCatalogRegistry(
      missingAxis,
      new CoordinateSystem(),
    ).getDefinition(createNasaCatalogObjectId('planet', 'Nearby Host b'))!;
    const periodPlanet = new ExoplanetCatalogRegistry(
      missingPeriod,
      new CoordinateSystem(),
    ).getDefinition(createNasaCatalogObjectId('planet', 'Nearby Host b'))!;

    expect(axisPlanet.metadata?.['semiMajorAxisSource']).toBe('Calculated from Kepler’s third law');
    expect(axisPlanet.metadata?.['orbitalPeriodSource']).toBe('NASA Exoplanet Archive');
    expect(periodPlanet.metadata?.['semiMajorAxisSource']).toBe('NASA Exoplanet Archive');
    expect(periodPlanet.metadata?.['orbitalPeriodSource']).toBe(
      'Calculated from Kepler’s third law',
    );
  });

  it('covers the adaptive stellar and planetary visual palette', () => {
    const stellarPalettes = [
      { temperatures: [12_000, 8_000], colors: ['#9bbcff', '#cad8ff'] },
      { temperatures: [6_500, 5_200], colors: ['#fff4e8', '#ffe6bd'] },
      { temperatures: [4_000, 3_000], colors: ['#ffba82', '#ff7955'] },
    ] as const;

    for (const palette of stellarPalettes) {
      const registry = new ExoplanetCatalogRegistry(
        catalogWith({ hostTemperaturesKelvin: new Float32Array(palette.temperatures) }),
        new CoordinateSystem(),
      );

      expect(registry.getDefinition(registry.getHostObjectId(0))?.visual?.color).toBe(
        palette.colors[0],
      );
      expect(registry.getDefinition(registry.getHostObjectId(1))?.visual?.color).toBe(
        palette.colors[1],
      );
    }

    const registry = new ExoplanetCatalogRegistry(
      catalogWith({
        planetRadiiEarth: new Float32Array([1, 7, 3]),
        planetEquilibriumTemperaturesKelvin: new Float32Array([800, 400, 400]),
        planetDiscoveryYears: new Uint16Array([0, 2021, 2022]),
      }),
      new CoordinateSystem(),
    );

    expect(registry.getDefinition(registry.getPlanetObjectId(0))?.visual?.color).toBe('#c97955');
    expect(registry.getDefinition(registry.getPlanetObjectId(1))?.visual?.color).toBe('#d5b178');
    expect(registry.getDefinition(registry.getPlanetObjectId(2))?.visual?.color).toBe('#70a9bd');
    expect(
      registry.getDefinition(registry.getPlanetObjectId(0))?.metadata?.['discoveryYear'],
    ).toBeUndefined();
  });

  it('uses every host ranking tiebreaker deterministically', () => {
    const byMagnitude = new ExoplanetCatalogRegistry(
      catalogWith({
        hostDistancesParsec: new Float64Array([10, 10]),
        hostApparentMagnitudes: new Float32Array([9, 8]),
      }),
      new CoordinateSystem(),
    );
    const byName = new ExoplanetCatalogRegistry(
      catalogWith({
        hostNames: ['Zulu', 'Alpha'],
        hostDistancesParsec: new Float64Array([10, 10]),
        hostApparentMagnitudes: new Float32Array([8, 8]),
      }),
      new CoordinateSystem(),
    );

    expect(byMagnitude.getLabelObjects().map(({ name }) => name)).toEqual([
      'Distant Host',
      'Nearby Host',
    ]);
    expect(byName.getLabelObjects().map(({ name }) => name)).toEqual(['Alpha', 'Zulu']);
  });

  it('normalizes aliases and protects the generated identifier namespace', () => {
    const aliasedHost = featuredObject('curated-host', '  Nearby   Host ', 'star');
    const linkedByAlias = {
      ...featuredObject('curated-planet', 'Catalog favorite', 'exoplanet'),
      aliases: [' Nearby   Host b '],
    } satisfies SpaceObject;
    const exoplanetHost = {
      ...featuredObject('host-by-marker', 'Distant Host', 'star'),
      metadata: { exoplanetHost: true },
    } satisfies SpaceObject;
    const unrelated = {
      ...featuredObject('unrelated', 'Not catalogued', 'star'),
      metadata: {},
    } satisfies SpaceObject;
    const registry = createRegistry([aliasedHost, linkedByAlias, exoplanetHost, unrelated]);

    expect(registry.getHostObjectId(0)).toBe('curated-host');
    expect(registry.getPlanetObjectId(0)).toBe('curated-planet');
    expect(registry.getHostObjectId(1)).toBe('host-by-marker');
    expect(createNasaCatalogObjectId('host', ' --- ')).toMatch(/^nea-host-object-/u);

    expect(
      () =>
        new ExoplanetCatalogRegistry(
          catalogWith({ hostNames: ['Duplicate', 'Duplicate'] }),
          new CoordinateSystem(),
        ),
    ).toThrow(/identifiants de carte dupliqués/u);
  });
});

function createRegistry(featuredObjects: readonly SpaceObject[] = []): ExoplanetCatalogRegistry {
  return new ExoplanetCatalogRegistry(catalog(), new CoordinateSystem(), featuredObjects);
}

function featuredObject(id: string, name: string, type: 'star' | 'exoplanet'): SpaceObject {
  return {
    id,
    name,
    type,
    parentId: type === 'exoplanet' ? 'nearby-host' : 'milky-way',
    referenceFrame: 'stellar',
    scientificConfidence: 'observed',
    visual: { visualRadius: 1, scaleMode: 'adaptive' },
    positionProvider: { type: 'static', position: [1, 0, 0], unit: 'parsec' },
    metadata: { sourceTable: 'PSCompPars', exoplanetHost: type === 'star' },
  };
}

function catalog(): ExoplanetCatalog {
  return {
    hostCount: 2,
    planetCount: 3,
    hostNames: ['Nearby Host', 'Distant Host'],
    hostAliases: [['HD 1'], []],
    hostSpectralTypes: ['G2 V', null],
    hostFirstPlanetIndices: new Uint32Array([0, 2]),
    hostPlanetCounts: new Uint16Array([2, 1]),
    hostStarCounts: new Uint8Array([1, 2]),
    hostCircumbinaryFlags: new Uint8Array([0, 1]),
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

function catalogWith(overrides: Partial<ExoplanetCatalog>): ExoplanetCatalog {
  return { ...catalog(), ...overrides };
}

function largeCatalog(count: number): ExoplanetCatalog {
  const base = catalog();
  const names = Array.from({ length: count }, (_, index) => `Étoile ${index}`);

  return {
    ...base,
    hostCount: count,
    planetCount: count,
    hostNames: names,
    hostAliases: names.map((name) => [name, `  ${name}   NASA`]),
    hostSpectralTypes: names.map(() => 'G2 V'),
    hostFirstPlanetIndices: Uint32Array.from({ length: count }, (_, index) => index),
    hostPlanetCounts: new Uint16Array(count).fill(1),
    hostStarCounts: new Uint8Array(count).fill(1),
    hostCircumbinaryFlags: new Uint8Array(count),
    hostRightAscensionDegrees: Float64Array.from({ length: count }, (_, index) => index % 360),
    hostDeclinationDegrees: Float64Array.from({ length: count }, (_, index) => (index % 180) - 90),
    hostDistancesParsec: Float64Array.from({ length: count }, (_, index) =>
      index % 3 === 0 ? Number.NaN : (index % 7) + 1,
    ),
    hostTemperaturesKelvin: new Float32Array(count).fill(5700),
    hostRadiiSolar: new Float32Array(count).fill(1),
    hostMassesSolar: Float32Array.from({ length: count }, (_, index) =>
      index % 2 === 0 ? 1 : Number.NaN,
    ),
    hostApparentMagnitudes: Float32Array.from({ length: count }, (_, index) =>
      index % 5 === 0 ? Number.NaN : index % 3,
    ),
    planetNames: names.map((name) => `${name} b`),
    planetLetters: names.map(() => 'b'),
    planetDiscoveryMethods: names.map(() => 'Transit'),
    planetDiscoveryFacilities: names.map(() => 'Kepler'),
    planetMassProvenances: names.map(() => 'Mass'),
    planetHostIndices: Uint32Array.from({ length: count }, (_, index) => index),
    planetOrbitalPeriodsDays: Float64Array.from({ length: count }, (_, index) =>
      index % 3 === 0 ? Number.NaN : 10,
    ),
    planetSemiMajorAxesAu: Float64Array.from({ length: count }, (_, index) =>
      index % 3 === 1 ? 0.2 : Number.NaN,
    ),
    planetRadiiEarth: new Float32Array(count).fill(2.4),
    planetMassesEarth: new Float32Array(count).fill(6.2),
    planetEquilibriumTemperaturesKelvin: new Float32Array(count).fill(280),
    planetEccentricities: new Float32Array(count).fill(0.1),
    planetInclinationsDegrees: new Float32Array(count).fill(88),
    planetInsolationsEarth: new Float32Array(count).fill(1.1),
    planetDiscoveryYears: new Uint16Array(count).fill(2021),
    planetControversialFlags: new Uint8Array(count),
    metadata: {
      ...base.metadata,
      counts: {
        hosts: count,
        planets: count,
        positionedHosts: Math.floor((count * 2) / 3),
        positionedPlanets: Math.floor((count * 2) / 3),
      },
    },
  };
}
