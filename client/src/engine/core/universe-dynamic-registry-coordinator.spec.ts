import {
  type DisplayOptions,
  type SpaceObject,
  type UniverseTime,
} from '../../data/models/universe.models';
import { type ObjectRegistry } from '../objects/object-registry';
import {
  type DynamicRegistryObjectRuntime,
  type UniverseDynamicRegistryBindings,
  UniverseDynamicRegistryCoordinator,
} from './universe-dynamic-registry-coordinator';

describe('UniverseDynamicRegistryCoordinator', () => {
  it('reconstruit le système exoplanétaire avec rotations, cible et options courantes', () => {
    const harness = createHarness({ targetId: 'host', selectedId: null });
    const objects = [object('host'), object('host-b')];

    harness.registry.has.mockImplementation((objectId: string) => objectId === 'host');
    harness.coordinator.rebuildExoplanetSystem(objects);

    expect(harness.replaceExoplanetSystem.mock.calls).toEqual([[null], [harness.registry]]);
    expect(harness.createRegistry).toHaveBeenCalledWith(objects);
    expect(harness.registry.updatePositions).toHaveBeenCalledWith(harness.time);
    expect(harness.registry.updateBodyRotations).toHaveBeenCalledWith(harness.time);
    expect(harness.registry.setDisplayOptions).toHaveBeenCalledWith(harness.options);
    expect(harness.registry.setNavigationTarget).toHaveBeenCalledWith('host');
    expect(harness.registry.select).toHaveBeenCalledWith(null);
  });

  it('reconstruit les objets streamés sans rotation et restaure seulement la sélection connue', () => {
    const harness = createHarness({ targetId: 'missing', selectedId: 'galaxy-a' });
    const objects = [object('galaxy-a')];

    harness.registry.has.mockImplementation((objectId: string) => objectId === 'galaxy-a');
    harness.coordinator.rebuildStreamedObjects(objects);

    expect(harness.replaceStreamed.mock.calls).toEqual([[null], [harness.registry]]);
    expect(harness.registry.updatePositions).toHaveBeenCalledWith(harness.time);
    expect(harness.registry.updateBodyRotations).not.toHaveBeenCalled();
    expect(harness.registry.setNavigationTarget).toHaveBeenCalledWith(null);
    expect(harness.registry.select).toHaveBeenCalledWith('galaxy-a');
  });

  it('conserve les registres vides lorsque les objets ou la scène sont indisponibles', () => {
    const emptyHarness = createHarness();

    emptyHarness.coordinator.rebuildExoplanetSystem([]);
    expect(emptyHarness.createRegistry).not.toHaveBeenCalled();
    expect(emptyHarness.replaceExoplanetSystem).toHaveBeenCalledOnce();
    expect(emptyHarness.replaceExoplanetSystem).toHaveBeenCalledWith(null);

    const unavailableHarness = createHarness({ registryAvailable: false });

    unavailableHarness.coordinator.rebuildStreamedObjects([object('galaxy-a')]);
    expect(unavailableHarness.createRegistry).toHaveBeenCalledOnce();
    expect(unavailableHarness.replaceStreamed).toHaveBeenCalledOnce();
    expect(unavailableHarness.replaceStreamed).toHaveBeenCalledWith(null);
  });
});

interface HarnessOptions {
  readonly targetId: string | null;
  readonly selectedId: string | null;
  readonly registryAvailable: boolean;
}

function createHarness(overrides: Partial<HarnessOptions> = {}) {
  const state: HarnessOptions = {
    targetId: null,
    selectedId: null,
    registryAvailable: true,
    ...overrides,
  };
  const time: UniverseTime = { julianDay: 2_460_000 };
  const options: DisplayOptions = {
    showOrbits: true,
    showConstellations: true,
    showLabels: true,
    quality: 'high',
    labelDensity: 'dense',
    temporalMode: 'state',
  };
  const registry = {
    has: vi.fn<(objectId: string) => boolean>(() => false),
    updatePositions: vi.fn(),
    updateBodyRotations: vi.fn(),
    setDisplayOptions: vi.fn(),
    setNavigationTarget: vi.fn(),
    select: vi.fn(),
  };
  const typedRegistry = registry as unknown as ObjectRegistry;
  const replaceExoplanetSystem = vi.fn<DynamicRegistryObjectRuntime['replaceExoplanetSystem']>();
  const replaceStreamed = vi.fn<DynamicRegistryObjectRuntime['replaceStreamed']>();
  const objectRuntime: DynamicRegistryObjectRuntime = {
    replaceExoplanetSystem,
    replaceStreamed,
  };
  const createRegistry = vi.fn<(objects: readonly SpaceObject[]) => ObjectRegistry | null>(() =>
    state.registryAvailable ? typedRegistry : null,
  );
  const bindings: UniverseDynamicRegistryBindings = {
    createRegistry,
    getCurrentTime: () => time,
    getDisplayOptions: () => options,
    getTargetId: () => state.targetId,
    getSelectedId: () => state.selectedId,
  };

  return {
    coordinator: new UniverseDynamicRegistryCoordinator(objectRuntime, bindings),
    registry,
    replaceExoplanetSystem,
    replaceStreamed,
    createRegistry,
    time,
    options,
  };
}

function object(id: string): SpaceObject {
  return {
    id,
    name: id,
    type: id.includes('galaxy') ? 'galaxy' : id === 'host' ? 'star' : 'exoplanet',
    referenceFrame: id.includes('galaxy') ? 'nearby-universe' : 'stellar',
    scientificConfidence: 'observed',
    visual: {
      visualRadius: 1,
      scaleMode: 'adaptive',
    },
    positionProvider: {
      type: 'static',
      position: [0, 0, 0],
      unit: 'parsec',
    },
  };
}
