import type { SpaceObject } from '../../data/models/universe.models';
import type { SpaceStreamingCoordinator } from './space-streaming-coordinator';
import {
  type UniverseStreamingRuntimeBindings,
  UniverseStreamingRuntime,
} from './universe-streaming-runtime';

describe('UniverseStreamingRuntime', () => {
  it('installe et réinitialise un état de streaming isolé des tableaux sources', () => {
    const harness = createHarness();
    const baseObjects = [spaceObject('sun')];
    const coordinator = streamingCoordinator([spaceObject('galaxy-a')]);

    harness.runtime.install(baseObjects, coordinator);
    baseObjects.push(spaceObject('earth'));

    expect(harness.runtime.baseObjects.map(({ id }) => id)).toEqual(['sun']);
    expect(harness.runtime.objects.map(({ id }) => id)).toEqual(['sun']);
    expect(harness.runtime.activeExoplanetSystemObjects).toEqual([]);
    expect(harness.runtime.coordinator).toBe(coordinator);
    expect(harness.runtime.hasStreamedObject('galaxy-a')).toBe(true);

    harness.runtime.reset();

    expect(harness.runtime.baseObjects).toEqual([]);
    expect(harness.runtime.objects).toEqual([]);
    expect(harness.runtime.activeExoplanetSystemObjects).toEqual([]);
    expect(harness.runtime.coordinator).toBeNull();
    expect(harness.runtime.hasStreamedObject('galaxy-a')).toBe(false);

    harness.runtime.rebuildDynamicRegistries();
    expect(harness.rebuildStreamedObjects).toHaveBeenLastCalledWith([]);
  });

  it('active un système exoplanétaire et notifie le contenu au bon moment', () => {
    const harness = createHarness();
    const host = spaceObject('host-a', 'star');
    const planet = spaceObject('planet-a', 'exoplanet', host.id);

    harness.catalog.has.mockImplementation((objectId: string) => objectId === planet.id);
    harness.catalog.getHostIdForObject.mockReturnValue(host.id);
    harness.catalog.createSystemObjects.mockReturnValue([host, planet]);

    harness.runtime.ensureActiveExoplanetSystem(planet.id);

    expect(harness.runtime.activeExoplanetSystemObjects).toEqual([host, planet]);
    expect(harness.rebuildExoplanetSystem).toHaveBeenCalledWith([host, planet]);
    expect(harness.refreshLabels).toHaveBeenCalledOnce();
    expect(harness.emitObjectsChanged).not.toHaveBeenCalled();

    harness.initialized.current = true;
    harness.activeHostIds.clear();
    harness.runtime.ensureActiveExoplanetSystem(planet.id);

    expect(harness.emitObjectsChanged).toHaveBeenCalledOnce();
  });

  it('ignore les systèmes absents, primaires, sans hôte ou déjà actifs', () => {
    const harness = createHarness();

    harness.catalog.has.mockReturnValue(false);
    harness.runtime.ensureActiveExoplanetSystem('missing');

    harness.catalog.has.mockReturnValue(true);
    harness.primaryObjectIds.add('primary');
    harness.runtime.ensureActiveExoplanetSystem('primary');

    harness.catalog.getHostIdForObject.mockReturnValue(null);
    harness.runtime.ensureActiveExoplanetSystem('orphan');

    harness.catalog.getHostIdForObject.mockReturnValue('host-a');
    harness.activeHostIds.add('host-a');
    harness.runtime.ensureActiveExoplanetSystem('active');

    harness.catalog.current = null;
    harness.runtime.ensureActiveExoplanetSystem('without-catalog');

    expect(harness.catalog.createSystemObjects).not.toHaveBeenCalled();
    expect(harness.rebuildExoplanetSystem).not.toHaveBeenCalled();
    expect(harness.refreshLabels).not.toHaveBeenCalled();
  });

  it('reconstruit les deux registres dynamiques depuis son état courant', () => {
    const harness = createHarness();
    const loaded = [spaceObject('galaxy-a')];
    const coordinator = streamingCoordinator(loaded);

    harness.runtime.install([spaceObject('sun')], coordinator);
    harness.catalog.has.mockReturnValue(true);
    harness.catalog.getHostIdForObject.mockReturnValue('host-a');
    harness.catalog.createSystemObjects.mockReturnValue([spaceObject('host-a', 'star')]);
    harness.runtime.ensureActiveExoplanetSystem('planet-a');
    harness.rebuildExoplanetSystem.mockClear();

    harness.runtime.rebuildDynamicRegistries();

    expect(harness.rebuildStreamedObjects).toHaveBeenCalledWith(loaded);
    expect(harness.rebuildExoplanetSystem).toHaveBeenCalledWith(
      harness.runtime.activeExoplanetSystemObjects,
    );
  });

  it('charge un objet tuilé avec un état de chargement équilibré', async () => {
    const harness = createHarness();
    const coordinator = streamingCoordinator([], ['galaxy-a']);

    harness.runtime.install([spaceObject('sun')], coordinator);

    await harness.runtime.ensureSpaceTileObject('galaxy-a');

    expect(coordinator.ensureObject).toHaveBeenCalledWith('galaxy-a');
    expect(harness.emitLoading.mock.calls).toEqual([[true], [false]]);
  });

  it('ignore un objet tuilé absent ou déjà chargé', async () => {
    const harness = createHarness();
    const coordinator = streamingCoordinator([], ['galaxy-a']);

    await harness.runtime.ensureSpaceTileObject('without-coordinator');
    harness.runtime.install([spaceObject('sun')], coordinator);
    await harness.runtime.ensureSpaceTileObject('unknown');
    harness.runtime.applyLoadedSpaceTiles([spaceObject('galaxy-a')]);
    await harness.runtime.ensureSpaceTileObject('galaxy-a');

    expect(coordinator.ensureObject).not.toHaveBeenCalled();
    expect(harness.emitLoading).not.toHaveBeenCalled();
  });

  it('retire toujours l’état de chargement après une erreur de tuile', async () => {
    const harness = createHarness();
    const coordinator = streamingCoordinator([], ['galaxy-a']);
    const failure = new Error('network failure');

    coordinator.ensureObject.mockRejectedValue(failure);
    harness.runtime.install([spaceObject('sun')], coordinator);

    await expect(harness.runtime.ensureSpaceTileObject('galaxy-a')).rejects.toBe(failure);
    expect(harness.emitLoading.mock.calls).toEqual([[true], [false]]);
  });

  it('fusionne les tuiles aux objets de base puis actualise registre, labels et événement', () => {
    const harness = createHarness();
    const sun = spaceObject('sun');
    const galaxy = spaceObject('galaxy-a');

    harness.runtime.install([sun], streamingCoordinator([]));
    harness.runtime.applyLoadedSpaceTiles([galaxy]);

    expect(harness.runtime.objects).toEqual([sun, galaxy]);
    expect(harness.rebuildStreamedObjects).toHaveBeenCalledWith([galaxy]);
    expect(harness.refreshLabels).toHaveBeenCalledOnce();
    expect(harness.emitObjectsChanged).toHaveBeenCalledOnce();
  });
});

function createHarness(): StreamingRuntimeHarness {
  const catalog = {
    current: {} as StreamingRuntimeHarness['catalog']['current'],
    has: vi.fn(() => false),
    getHostIdForObject: vi.fn((): string | null => null),
    createSystemObjects: vi.fn((): readonly SpaceObject[] => []),
  };

  catalog.current = catalog;
  const primaryObjectIds = new Set<string>();
  const activeHostIds = new Set<string>();
  const initialized = { current: false };
  const rebuildExoplanetSystem = vi.fn();
  const rebuildStreamedObjects = vi.fn();
  const refreshLabels = vi.fn();
  const emitObjectsChanged = vi.fn();
  const emitLoading = vi.fn();
  const bindings: UniverseStreamingRuntimeBindings = {
    getExoplanetCatalog: () => catalog.current,
    hasPrimaryObject: (objectId) => primaryObjectIds.has(objectId),
    hasActiveExoplanetHost: (hostId) => activeHostIds.has(hostId),
    rebuildExoplanetSystem,
    rebuildStreamedObjects,
    refreshLabels,
    isInitialized: () => initialized.current,
    emitObjectsChanged,
    emitLoading,
  };

  return {
    runtime: new UniverseStreamingRuntime(bindings),
    catalog,
    primaryObjectIds,
    activeHostIds,
    initialized,
    rebuildExoplanetSystem,
    rebuildStreamedObjects,
    refreshLabels,
    emitObjectsChanged,
    emitLoading,
  };
}

function streamingCoordinator(
  loadedObjects: readonly SpaceObject[],
  indexedObjectIds: readonly string[] = loadedObjects.map(({ id }) => id),
): SpaceStreamingCoordinator & { readonly ensureObject: ReturnType<typeof vi.fn> } {
  return {
    loadedSpaceObjects: loadedObjects,
    hasObject: vi.fn((objectId: string) => indexedObjectIds.includes(objectId)),
    ensureObject: vi.fn(async () => true),
  } as unknown as SpaceStreamingCoordinator & {
    readonly ensureObject: ReturnType<typeof vi.fn>;
  };
}

function spaceObject(
  id: string,
  type: SpaceObject['type'] = 'galaxy',
  parentId?: string,
): SpaceObject {
  return {
    id,
    name: id,
    type,
    ...(parentId ? { parentId } : {}),
    referenceFrame: 'galactic',
    scientificConfidence: 'observed',
    visual: { visualRadius: 1, scaleMode: 'adaptive' },
    positionProvider: {
      type: 'static',
      position: [0, 0, 0],
      unit: 'parsec',
    },
  };
}

interface StreamingRuntimeHarness {
  readonly runtime: UniverseStreamingRuntime;
  readonly catalog: {
    current: {
      has(objectId: string): boolean;
      getHostIdForObject(objectId: string): string | null;
      createSystemObjects(objectId: string): readonly SpaceObject[];
    } | null;
    readonly has: ReturnType<typeof vi.fn>;
    readonly getHostIdForObject: ReturnType<typeof vi.fn>;
    readonly createSystemObjects: ReturnType<typeof vi.fn>;
  };
  readonly primaryObjectIds: Set<string>;
  readonly activeHostIds: Set<string>;
  readonly initialized: { current: boolean };
  readonly rebuildExoplanetSystem: ReturnType<typeof vi.fn>;
  readonly rebuildStreamedObjects: ReturnType<typeof vi.fn>;
  readonly refreshLabels: ReturnType<typeof vi.fn>;
  readonly emitObjectsChanged: ReturnType<typeof vi.fn>;
  readonly emitLoading: ReturnType<typeof vi.fn>;
}
