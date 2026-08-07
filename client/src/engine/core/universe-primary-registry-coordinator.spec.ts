import { type DisplayOptions, type UniverseTime } from '../../data/models/universe.models';
import { type ObjectRegistry } from '../objects/object-registry';
import { type SolarEclipseAppearance } from '../simulation/earth-eclipse';
import {
  type PrimaryRegistryObjectRuntime,
  type UniversePrimaryRegistryBindings,
  UniversePrimaryRegistryCoordinator,
} from './universe-primary-registry-coordinator';

describe('UniversePrimaryRegistryCoordinator', () => {
  it('reconstruit et configure le registre principal avant de restaurer la navigation', () => {
    const harness = createHarness({ targetId: 'earth', selectedId: 'earth' });

    harness.registry.has.mockImplementation((objectId: string) => objectId === 'earth');
    harness.coordinator.rebuild();

    expect(harness.replacePrimary.mock.calls).toEqual([[null], [harness.typedRegistry]]);
    expect(harness.replaceStreamed).toHaveBeenCalledOnce();
    expect(harness.replaceStreamed).toHaveBeenCalledWith(null);
    expect(harness.registry.updatePositions).toHaveBeenCalledWith(harness.time);
    expect(harness.registry.updateBodyRotations).toHaveBeenCalledWith(harness.time);
    expect(harness.bindings.resetRotationPlayback).toHaveBeenCalledWith(harness.time);
    expect(harness.bindings.emitSolarEclipseState).toHaveBeenCalledWith(harness.appearance);
    expect(harness.registry.setDisplayOptions).toHaveBeenCalledWith(harness.options);
    expect(harness.registry.setNavigationTarget).toHaveBeenCalledWith('earth');
    expect(harness.registry.select).toHaveBeenCalledWith('earth');
    expect(harness.bindings.selectCatalogObject).toHaveBeenCalledWith(null);
    expect(harness.bindings.selectConstellation).toHaveBeenCalledWith(null);
    expect(harness.bindings.restoreSolarEclipsePresentation).toHaveBeenCalledWith(
      harness.typedRegistry,
    );
    expect(harness.bindings.rebuildDynamicRegistries).toHaveBeenCalledOnce();
    expect(harness.bindings.followCurrentTarget).toHaveBeenCalledOnce();
  });

  it('restaure une sélection du catalogue lorsque le registre principal ne la connaît pas', () => {
    const harness = createHarness({ targetId: 'missing', selectedId: 'hyg-1' });

    harness.isCatalogObject.mockImplementation((objectId) => objectId === 'hyg-1');
    harness.coordinator.rebuild();

    expect(harness.registry.setNavigationTarget).toHaveBeenCalledWith(null);
    expect(harness.registry.select).toHaveBeenCalledWith(null);
    expect(harness.bindings.selectCatalogObject).toHaveBeenCalledWith('hyg-1');
    expect(harness.bindings.selectConstellation).toHaveBeenCalledWith(null);
  });

  it('restaure une constellation sans la confondre avec un objet du catalogue', () => {
    const harness = createHarness({ targetId: null, selectedId: 'constellation-orion' });

    harness.hasConstellation.mockImplementation((objectId) => objectId === 'constellation-orion');
    harness.coordinator.rebuild();

    expect(harness.registry.setNavigationTarget).toHaveBeenCalledWith(null);
    expect(harness.registry.select).toHaveBeenCalledWith(null);
    expect(harness.bindings.selectCatalogObject).toHaveBeenCalledWith(null);
    expect(harness.bindings.selectConstellation).toHaveBeenCalledWith('constellation-orion');
  });

  it('accepte une absence de sélection et ignore une scène indisponible', () => {
    const available = createHarness();

    available.coordinator.rebuild();
    expect(available.registry.select).toHaveBeenCalledWith(null);

    const unavailable = createHarness({ registryAvailable: false });

    unavailable.coordinator.rebuild();
    expect(unavailable.replacePrimary).not.toHaveBeenCalled();
    expect(unavailable.replaceStreamed).not.toHaveBeenCalled();
    expect(unavailable.registry.updatePositions).not.toHaveBeenCalled();
  });
});

interface HarnessState {
  readonly targetId: string | null;
  readonly selectedId: string | null;
  readonly registryAvailable: boolean;
}

function createHarness(overrides: Partial<HarnessState> = {}) {
  const state: HarnessState = {
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
  const appearance: SolarEclipseAppearance = {
    phase: 'partial',
    sunPositionInEarthRadii: { x: 1, y: 0, z: 0 },
    moonPositionInEarthRadii: { x: 0, y: 1, z: 0 },
    shadowDirection: { x: 0, y: 0, z: 1 },
    centralLatitude: 64,
    centralLongitude: -18,
  };
  const registry = {
    has: vi.fn<(objectId: string) => boolean>(() => false),
    updatePositions: vi.fn(() => appearance),
    updateBodyRotations: vi.fn(),
    setDisplayOptions: vi.fn(),
    setNavigationTarget: vi.fn(),
    select: vi.fn(),
  };
  const typedRegistry = registry as unknown as ObjectRegistry;
  const replacePrimary = vi.fn<PrimaryRegistryObjectRuntime['replacePrimary']>();
  const replaceStreamed = vi.fn<PrimaryRegistryObjectRuntime['replaceStreamed']>();
  const isCatalogObject = vi.fn<(objectId: string) => boolean>(() => false);
  const hasConstellation = vi.fn<(objectId: string) => boolean>(() => false);
  const objectRuntime: PrimaryRegistryObjectRuntime = {
    replacePrimary,
    replaceStreamed,
  };
  const bindings: UniversePrimaryRegistryBindings = {
    createRegistry: vi.fn(() => (state.registryAvailable ? typedRegistry : null)),
    getCurrentTime: () => time,
    getDisplayOptions: () => options,
    getTargetId: () => state.targetId,
    getSelectedId: () => state.selectedId,
    isCatalogObject,
    hasConstellation,
    selectCatalogObject: vi.fn(),
    selectConstellation: vi.fn(),
    resetRotationPlayback: vi.fn(),
    emitSolarEclipseState: vi.fn(),
    restoreSolarEclipsePresentation: vi.fn(),
    rebuildDynamicRegistries: vi.fn(),
    followCurrentTarget: vi.fn(),
  };

  return {
    coordinator: new UniversePrimaryRegistryCoordinator(objectRuntime, bindings),
    bindings,
    registry,
    typedRegistry,
    replacePrimary,
    replaceStreamed,
    isCatalogObject,
    hasConstellation,
    time,
    options,
    appearance,
  };
}
