import * as THREE from 'three';
import {
  type FrameContentObjectRuntime,
  type FrameContentScene,
  type FrameContentStreamingCoordinator,
  type UniverseFrameContentBindings,
  type UniverseFrameContentServices,
  UniverseFrameContent,
} from './universe-frame-content';

describe('UniverseFrameContent', () => {
  it('synchronise le streaming, précharge la Voie lactée et actualise les LOD proches', () => {
    const harness = createHarness();

    harness.content.update(0.25, harness.services, 2);

    expect(harness.updateStreaming).toHaveBeenCalledWith(
      {
        camera: harness.camera,
        viewportHeight: 720,
        lodLevel: 2,
        quality: 'high',
        worldOffset: harness.scene.spaceRoot.position,
        transitioning: true,
        targetId: 'earth',
        selectedId: 'moon',
      },
      0.25,
    );
    expect(harness.ensureMilkyWayAtlas).toHaveBeenCalledOnce();
    expect(harness.preloadTempelFilamentSpines).not.toHaveBeenCalled();
    expect(harness.ensureTempelFilamentSpines).not.toHaveBeenCalled();
    expect(harness.updateObjectLod).toHaveBeenCalledWith(harness.camera, 720, 2, 0.25, true);
    expect(harness.updateSceneLod).toHaveBeenCalledWith(2, 0.25, 24, harness.camera.position, true);
  });

  it('précharge les filaments dans l’Univers proche sans les installer dans la scène', () => {
    const harness = createHarness({ streamingAvailable: false });

    harness.content.update(0.1, harness.services, 5);

    expect(harness.updateStreaming).not.toHaveBeenCalled();
    expect(harness.ensureMilkyWayAtlas).not.toHaveBeenCalled();
    expect(harness.preloadTempelFilamentSpines).toHaveBeenCalledOnce();
    expect(harness.ensureTempelFilamentSpines).not.toHaveBeenCalled();
    expect(harness.updateObjectLod).toHaveBeenCalledWith(harness.camera, 720, 5, 0.1, true);
    expect(harness.updateSceneLod).toHaveBeenCalledWith(5, 0.1, 24, harness.camera.position, true);
  });

  it('installe les filaments au niveau du Réseau cosmique', () => {
    const harness = createHarness({ streamingAvailable: false });

    harness.content.update(0.1, harness.services, 6);

    expect(harness.preloadTempelFilamentSpines).not.toHaveBeenCalled();
    expect(harness.ensureTempelFilamentSpines).toHaveBeenCalledOnce();
    expect(harness.updateObjectLod).toHaveBeenCalledWith(harness.camera, 720, 6, 0.1, true);
    expect(harness.updateSceneLod).toHaveBeenCalledWith(6, 0.1, 24, harness.camera.position, true);
  });

  it('n’effectue aucun préchargement hors des niveaux cartographiques', () => {
    const harness = createHarness();

    harness.content.update(0, harness.services, -1);

    expect(harness.ensureMilkyWayAtlas).not.toHaveBeenCalled();
    expect(harness.preloadTempelFilamentSpines).not.toHaveBeenCalled();
    expect(harness.ensureTempelFilamentSpines).not.toHaveBeenCalled();
  });

  it('masque seulement l’environnement solaire pendant le recul vers la Terre', () => {
    const harness = createHarness({
      observerModeActive: false,
      observerPresentationActive: true,
    });

    harness.content.update(0.25, harness.services, 2);

    expect(harness.updateObjectLod).toHaveBeenCalledWith(harness.camera, 720, 2, 0.25, false);
    expect(harness.updateSceneLod).toHaveBeenCalledWith(2, 0.25, 24, harness.camera.position, true);
  });
});

interface HarnessOptions {
  readonly streamingAvailable: boolean;
  readonly observerModeActive: boolean;
  readonly observerPresentationActive: boolean;
}

function createHarness(overrides: Partial<HarnessOptions> = {}) {
  const options: HarnessOptions = {
    streamingAvailable: true,
    observerModeActive: true,
    observerPresentationActive: true,
    ...overrides,
  };
  const camera = new THREE.PerspectiveCamera(48, 16 / 9, 0.1, 100_000);
  const updateStreaming = vi.fn<FrameContentStreamingCoordinator['update']>();
  const streamingCoordinator: FrameContentStreamingCoordinator = {
    update: updateStreaming,
  };
  const updateObjectLod = vi.fn<FrameContentObjectRuntime['updateLod']>();
  const objectRuntime: FrameContentObjectRuntime = {
    updateLod: updateObjectLod,
  };
  const ensureMilkyWayAtlas = vi.fn<FrameContentScene['ensureMilkyWayAtlas']>(async () => true);
  const updateSceneLod = vi.fn<FrameContentScene['updateLod']>();
  const scene: FrameContentScene = {
    spaceRoot: new THREE.Group(),
    ensureMilkyWayAtlas,
    updateLod: updateSceneLod,
  };
  const ensureTempelFilamentSpines = vi.fn<() => Promise<void>>(async () => undefined);
  const preloadTempelFilamentSpines = vi.fn<() => Promise<void>>(async () => undefined);
  const bindings: UniverseFrameContentBindings = {
    getStreamingCoordinator: () => (options.streamingAvailable ? streamingCoordinator : null),
    getQuality: () => 'high',
    getTargetId: () => 'earth',
    getSelectedId: () => 'moon',
    preloadTempelFilamentSpines,
    ensureTempelFilamentSpines,
  };
  const services: UniverseFrameContentServices = {
    camera,
    universeScene: scene,
    controller: {
      distanceToTarget: 24,
      isTransitioning: true,
      observerModeActive: options.observerModeActive,
      observerPresentationActive: options.observerPresentationActive,
    },
    viewportHeight: 720,
  };

  return {
    content: new UniverseFrameContent(objectRuntime, bindings),
    services,
    camera,
    scene,
    updateStreaming,
    updateObjectLod,
    ensureMilkyWayAtlas,
    updateSceneLod,
    preloadTempelFilamentSpines,
    ensureTempelFilamentSpines,
  };
}
