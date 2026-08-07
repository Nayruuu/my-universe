import * as THREE from 'three';
import type { SolarEclipseAppearance } from '../simulation/earth-eclipse';
import { type UniverseFrameRuntimeBindings, UniverseFrameRuntime } from './universe-frame-runtime';

describe('UniverseFrameRuntime', () => {
  it('orchestre simulation, navigation, contenu, rendu et diagnostic dans cet ordre', () => {
    const harness = createHarness();

    harness.runtime.render(0.016);

    expect(harness.phases).toEqual(['simulation', 'navigation', 'content', 'render', 'diagnostic']);
    expect(harness.simulation.update).toHaveBeenCalledWith(0.016, harness.resources.registry);
    expect(harness.navigation.update).toHaveBeenCalledWith(0.016, expect.any(Object));
    expect(harness.content.update).toHaveBeenCalledWith(0.016, expect.any(Object), 4);
    expect(harness.renderer.render).toHaveBeenCalledWith(0.016, expect.any(Object), 4);
    expect(harness.updateDebugStats).toHaveBeenCalledWith(0.016);
    expect(harness.navigation.update.mock.calls[0]?.[1]).toMatchObject({
      viewportWidth: 960,
      viewportHeight: 540,
      scene: harness.resources.universeScene?.scene,
      spaceRoot: harness.resources.universeScene?.spaceRoot,
    });
  });

  it.each([
    ['renderer', (harness: FrameRuntimeHarness) => (harness.resources.renderer = null)],
    ['camera', (harness: FrameRuntimeHarness) => (harness.resources.camera = null)],
    ['scene', (harness: FrameRuntimeHarness) => (harness.resources.universeScene = null)],
    ['registry', (harness: FrameRuntimeHarness) => (harness.resources.registry = null)],
    ['controller', (harness: FrameRuntimeHarness) => (harness.resources.controller = null)],
    ['lensing', (harness: FrameRuntimeHarness) => (harness.resources.lensingPass = null)],
  ])('ignore une frame privée de %s', (_label, removeResource) => {
    const harness = createHarness();

    removeResource(harness);
    harness.runtime.render(0.5);

    expect(harness.simulation.update).not.toHaveBeenCalled();
    expect(harness.navigation.update).not.toHaveBeenCalled();
    expect(harness.content.update).not.toHaveBeenCalled();
    expect(harness.renderer.render).not.toHaveBeenCalled();
    expect(harness.updateDebugStats).not.toHaveBeenCalled();
  });
});

function createHarness(): FrameRuntimeHarness {
  const phases: string[] = [];
  const resources: MutableFrameResources = {
    renderer: {
      domElement: document.createElement('canvas'),
    } as unknown as THREE.WebGLRenderer,
    camera: new THREE.PerspectiveCamera(),
    universeScene: {
      scene: new THREE.Scene(),
      spaceRoot: new THREE.Group(),
      ensureMilkyWayAtlas: vi.fn(async () => true),
      updateLod: vi.fn(),
    },
    registry: {
      updateBodyRotations: vi.fn(),
      updatePositions: vi.fn(() => eclipseAppearance()),
    },
    controller: {
      controls: { target: new THREE.Vector3() },
      distanceToTarget: 24,
      isTransitioning: false,
      update: vi.fn(),
      shiftTrackedPosition: vi.fn(),
    },
    lensingPass: { render: vi.fn() },
  };
  const simulation = { update: vi.fn(() => phases.push('simulation')) };
  const navigation = {
    update: vi.fn(() => {
      phases.push('navigation');

      return 4;
    }),
  };
  const content = { update: vi.fn(() => phases.push('content')) };
  const renderer = { render: vi.fn(() => phases.push('render')) };
  const updateDebugStats = vi.fn(() => phases.push('diagnostic'));
  const bindings: UniverseFrameRuntimeBindings = {
    getRenderer: () => resources.renderer,
    getCamera: () => resources.camera,
    getUniverseScene: () => resources.universeScene,
    getRegistry: () => resources.registry,
    getController: () => resources.controller,
    getLensingPass: () => resources.lensingPass,
    getViewportSize: () => ({ width: 960, height: 540 }),
    updateDebugStats,
  };

  return {
    runtime: new UniverseFrameRuntime(simulation, navigation, content, renderer, bindings),
    resources,
    simulation,
    navigation,
    content,
    renderer,
    updateDebugStats,
    phases,
  };
}

function eclipseAppearance(): SolarEclipseAppearance {
  return {
    phase: 'none',
    sunPositionInEarthRadii: { x: 100, y: 0, z: 0 },
    moonPositionInEarthRadii: { x: 10, y: 0, z: 0 },
    shadowDirection: { x: -1, y: 0, z: 0 },
    centralLatitude: null,
    centralLongitude: null,
  };
}

interface MutableFrameResources {
  renderer: UniverseFrameRuntimeBindings['getRenderer'] extends () => infer Value ? Value : never;
  camera: UniverseFrameRuntimeBindings['getCamera'] extends () => infer Value ? Value : never;
  universeScene: UniverseFrameRuntimeBindings['getUniverseScene'] extends () => infer Value
    ? Value
    : never;
  registry: UniverseFrameRuntimeBindings['getRegistry'] extends () => infer Value ? Value : never;
  controller: UniverseFrameRuntimeBindings['getController'] extends () => infer Value
    ? Value
    : never;
  lensingPass: UniverseFrameRuntimeBindings['getLensingPass'] extends () => infer Value
    ? Value
    : never;
}

interface FrameRuntimeHarness {
  readonly runtime: UniverseFrameRuntime;
  readonly resources: MutableFrameResources;
  readonly simulation: { readonly update: ReturnType<typeof vi.fn> };
  readonly navigation: { readonly update: ReturnType<typeof vi.fn> };
  readonly content: { readonly update: ReturnType<typeof vi.fn> };
  readonly renderer: { readonly render: ReturnType<typeof vi.fn> };
  readonly updateDebugStats: ReturnType<typeof vi.fn>;
  readonly phases: string[];
}
