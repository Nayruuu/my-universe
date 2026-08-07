import * as THREE from 'three';
import { type DisplayOptions, type SpaceObject } from '../../data/models/universe.models';
import { type ObjectRegistry } from '../objects/object-registry';
import { UniverseObjectRuntime } from './universe-object-runtime';

describe('UniverseObjectRuntime', () => {
  it('reste neutre sans registre actif', () => {
    const runtime = new UniverseObjectRuntime();
    const options = displayOptions();
    const camera = new THREE.PerspectiveCamera();

    expect(runtime.primaryRegistry).toBeNull();
    expect(runtime.streamedRegistry).toBeNull();
    expect(runtime.exoplanetSystemRegistry).toBeNull();
    expect(runtime.has('earth')).toBe(false);
    expect(runtime.getRegistry('earth')).toBeNull();
    expect(runtime.getDefinition('earth')).toBeUndefined();
    expect(runtime.getWorldPosition('earth')).toBeNull();
    expect(runtime.getVisualDiagnostics('earth')).toBeNull();
    expect(runtime.getPickables()).toEqual([]);
    expect(runtime.visibleObjectCount).toBe(0);
    expect(runtime.batchedGalaxyCount).toBe(0);

    runtime.setNavigationTarget('earth');
    runtime.select('earth');
    runtime.setDisplayOptions(options);
    runtime.setEarthObserverCelestialPresentations([]);
    runtime.updateLod(camera, 720, 4, 0.016, true);
    runtime.dispose();
  });

  it('remplace chaque registre en libérant uniquement son ancienne instance', () => {
    const runtime = new UniverseObjectRuntime();
    const firstPrimary = fakeRegistry('earth');
    const nextPrimary = fakeRegistry('mars');
    const streamed = fakeRegistry('andromeda');
    const exoplanets = fakeRegistry('kepler-22-b');

    runtime.replacePrimary(firstPrimary.registry);
    runtime.replacePrimary(firstPrimary.registry);
    runtime.replacePrimary(nextPrimary.registry);
    runtime.replaceStreamed(streamed.registry);
    runtime.replaceExoplanetSystem(exoplanets.registry);

    expect(firstPrimary.dispose).toHaveBeenCalledOnce();
    expect(runtime.primaryRegistry).toBe(nextPrimary.registry);
    expect(runtime.streamedRegistry).toBe(streamed.registry);
    expect(runtime.exoplanetSystemRegistry).toBe(exoplanets.registry);

    runtime.replaceStreamed(null);
    expect(streamed.dispose).toHaveBeenCalledOnce();
    expect(runtime.streamedRegistry).toBeNull();
  });

  it('résout les objets selon la priorité principal, streamé puis exoplanétaire', () => {
    const runtime = new UniverseObjectRuntime();
    const primary = fakeRegistry('shared', 'primary');
    const streamed = fakeRegistry('shared', 'streamed');
    const exoplanets = fakeRegistry('kepler-22-b', 'exoplanet');
    const target = new THREE.Vector3();

    runtime.replacePrimary(primary.registry);
    runtime.replaceStreamed(streamed.registry);
    runtime.replaceExoplanetSystem(exoplanets.registry);

    expect(runtime.has('shared')).toBe(true);
    expect(runtime.has('kepler-22-b')).toBe(true);
    expect(runtime.has('missing')).toBe(false);
    expect(runtime.getRegistry('shared')).toBe(primary.registry);
    expect(runtime.getRegistry('kepler-22-b')).toBe(exoplanets.registry);
    expect(runtime.getDefinition('shared')?.name).toBe('primary');
    expect(runtime.getDefinition('kepler-22-b')?.name).toBe('exoplanet');
    expect(runtime.getDefinition('missing')).toBeUndefined();
    expect(runtime.getWorldPosition('shared', target)).toBe(target);
    expect(target.toArray()).toEqual([1, 2, 3]);
    expect(runtime.getWorldPosition('missing')).toBeNull();
    expect(runtime.getVisualDiagnostics('shared')).toEqual({ objectId: 'shared' });
  });

  it('diffuse la sélection, les options et le LOD à tous les registres', () => {
    const runtime = new UniverseObjectRuntime();
    const primary = fakeRegistry('earth');
    const streamed = fakeRegistry('andromeda');
    const exoplanets = fakeRegistry('kepler-22-b');
    const options = displayOptions();
    const camera = new THREE.PerspectiveCamera();

    runtime.replacePrimary(primary.registry);
    runtime.replaceStreamed(streamed.registry);
    runtime.replaceExoplanetSystem(exoplanets.registry);
    runtime.setNavigationTarget('andromeda');
    runtime.select('kepler-22-b');
    runtime.setDisplayOptions(options);
    const celestialPresentations = [
      {
        objectId: 'moon',
        direction: { x: 0, y: 1, z: 0 },
        diameterPixels: 36,
      },
    ];

    runtime.setEarthObserverCelestialPresentations(celestialPresentations);
    runtime.updateLod(camera, 720, 4, 0.016, true);

    expect(primary.setNavigationTarget).toHaveBeenCalledWith(null);
    expect(streamed.setNavigationTarget).toHaveBeenCalledWith('andromeda');
    expect(exoplanets.setNavigationTarget).toHaveBeenCalledWith(null);
    expect(primary.select).toHaveBeenCalledWith(null);
    expect(streamed.select).toHaveBeenCalledWith(null);
    expect(exoplanets.select).toHaveBeenCalledWith('kepler-22-b');
    expect(primary.setEarthObserverCelestialPresentations).toHaveBeenLastCalledWith(
      celestialPresentations,
    );
    expect(streamed.setEarthObserverCelestialPresentations).not.toHaveBeenCalled();
    expect(exoplanets.setEarthObserverCelestialPresentations).not.toHaveBeenCalled();
    for (const registry of [primary, streamed, exoplanets]) {
      expect(registry.setDisplayOptions).toHaveBeenCalledWith(options);
      expect(registry.updateLod).toHaveBeenCalledWith(camera, 720, 4, 0.016, true);
    }
    expect(runtime.getPickables()).toHaveLength(3);
    expect(runtime.visibleObjectCount).toBe(6);
    expect(runtime.batchedGalaxyCount).toBe(3);
  });

  it('libère et oublie tous les registres', () => {
    const runtime = new UniverseObjectRuntime();
    const primary = fakeRegistry('earth');
    const streamed = fakeRegistry('andromeda');
    const exoplanets = fakeRegistry('kepler-22-b');

    runtime.replacePrimary(primary.registry);
    runtime.replaceStreamed(streamed.registry);
    runtime.replaceExoplanetSystem(exoplanets.registry);
    runtime.dispose();

    expect(primary.dispose).toHaveBeenCalledOnce();
    expect(streamed.dispose).toHaveBeenCalledOnce();
    expect(exoplanets.dispose).toHaveBeenCalledOnce();
    expect(runtime.primaryRegistry).toBeNull();
    expect(runtime.streamedRegistry).toBeNull();
    expect(runtime.exoplanetSystemRegistry).toBeNull();
  });
});

interface FakeRegistry {
  readonly registry: ObjectRegistry;
  readonly setNavigationTarget: ReturnType<typeof vi.fn>;
  readonly select: ReturnType<typeof vi.fn>;
  readonly setDisplayOptions: ReturnType<typeof vi.fn>;
  readonly setEarthObserverCelestialPresentations: ReturnType<typeof vi.fn>;
  readonly updateLod: ReturnType<typeof vi.fn>;
  readonly dispose: ReturnType<typeof vi.fn>;
}

function fakeRegistry(objectId: string, name = objectId): FakeRegistry {
  const definition: SpaceObject = {
    id: objectId,
    name,
    type: 'region',
    referenceFrame: 'solar-system',
    scientificConfidence: 'observed',
    visual: { scaleMode: 'adaptive', visualRadius: 1 },
    positionProvider: { type: 'static', position: [1, 2, 3], unit: 'kilometer' },
  };
  const setNavigationTarget = vi.fn();
  const select = vi.fn();
  const setDisplayOptions = vi.fn();
  const setEarthObserverCelestialPresentations = vi.fn();
  const updateLod = vi.fn();
  const dispose = vi.fn();
  const registry = {
    has: vi.fn((id: string) => id === objectId),
    getDefinition: vi.fn((id: string) => (id === objectId ? definition : undefined)),
    getWorldPosition: vi.fn((id: string, target = new THREE.Vector3()) =>
      id === objectId ? target.set(1, 2, 3) : null,
    ),
    getVisualDiagnostics: vi.fn((id: string) => (id === objectId ? { objectId: id } : null)),
    getPickables: vi.fn(() => [new THREE.Object3D()]),
    setNavigationTarget,
    select,
    setDisplayOptions,
    setEarthObserverCelestialPresentations,
    updateLod,
    visibleObjectCount: 2,
    batchedGalaxyCount: 1,
    dispose,
  } as unknown as ObjectRegistry;

  return {
    registry,
    setNavigationTarget,
    select,
    setDisplayOptions,
    setEarthObserverCelestialPresentations,
    updateLod,
    dispose,
  };
}

function displayOptions(): DisplayOptions {
  return {
    showOrbits: true,
    showConstellations: true,
    showLabels: true,
    quality: 'medium',
    labelDensity: 'balanced',
    temporalMode: 'state',
  };
}
