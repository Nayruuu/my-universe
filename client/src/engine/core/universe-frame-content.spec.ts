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
        referenceFrameScale: 2.5,
        stellarNeighborhoodReveal: 1,
      },
      0.25,
    );
    expect(harness.ensureMilkyWayAtlas).toHaveBeenCalledOnce();
    expect(harness.preloadTempelFilamentSpines).not.toHaveBeenCalled();
    expect(harness.ensureTempelFilamentSpines).not.toHaveBeenCalled();
    expect(harness.updateObjectLod).toHaveBeenCalledWith(harness.camera, 720, 2, 0.25, true);
    expect(harness.updateSceneLod).toHaveBeenCalledWith(
      2,
      0.25,
      24,
      harness.camera.position,
      true,
      'earth',
    );
  });

  it('précharge les filaments dans l’Univers proche sans les installer dans la scène', () => {
    const harness = createHarness({ streamingAvailable: false });

    harness.content.update(0.1, harness.services, 5);

    expect(harness.updateStreaming).not.toHaveBeenCalled();
    expect(harness.ensureMilkyWayAtlas).not.toHaveBeenCalled();
    expect(harness.preloadTempelFilamentSpines).toHaveBeenCalledOnce();
    expect(harness.ensureTempelFilamentSpines).not.toHaveBeenCalled();
    expect(harness.updateObjectLod).toHaveBeenCalledWith(harness.camera, 720, 5, 0.1, true);
    expect(harness.updateSceneLod).toHaveBeenCalledWith(
      5,
      0.1,
      24,
      harness.camera.position,
      true,
      'earth',
    );
  });

  it('installe les filaments au niveau du Réseau cosmique', () => {
    const harness = createHarness({ streamingAvailable: false });

    harness.content.update(0.1, harness.services, 6);

    expect(harness.preloadTempelFilamentSpines).not.toHaveBeenCalled();
    expect(harness.ensureTempelFilamentSpines).toHaveBeenCalledOnce();
    expect(harness.updateObjectLod).toHaveBeenCalledWith(harness.camera, 720, 6, 0.1, true);
    expect(harness.updateSceneLod).toHaveBeenCalledWith(
      6,
      0.1,
      24,
      harness.camera.position,
      true,
      'earth',
    );
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
    expect(harness.updateSceneLod).toHaveBeenCalledWith(
      2,
      0.25,
      24,
      harness.camera.position,
      true,
      'earth',
    );
  });

  it('garde les objets cartographiques masqués pendant un changement de ville', () => {
    const harness = createHarness({
      observerModeActive: false,
      observerPresentationActive: true,
      observerSkyContentActive: true,
    });

    harness.content.update(0.25, harness.services, 2);

    expect(harness.updateObjectLod).toHaveBeenCalledWith(harness.camera, 720, 2, 0.25, true);
    expect(harness.updateSceneLod).toHaveBeenCalledWith(
      2,
      0.25,
      24,
      harness.camera.position,
      true,
      'earth',
    );
  });

  it('recale la caméra ciblée après avoir mis à jour toutes les racines intergalactiques', () => {
    const harness = createHarness({ objectScaleChanged: true });

    harness.content.update(0.25, harness.services, 4);

    expect(harness.updateObjectReferenceFrameScale).toHaveBeenCalledWith(24);
    expect(harness.updateSceneReferenceFrameScale).toHaveBeenCalledWith(24);
    expect(harness.followCurrentTarget).toHaveBeenCalledOnce();
  });

  it('reste compatible avec une scène sans conversion dynamique de référentiel', () => {
    const harness = createHarness({ referenceFrameScaleAvailable: false });

    harness.content.update(0.25, harness.services, 2);

    expect(harness.updateObjectReferenceFrameScale).not.toHaveBeenCalled();
    expect(harness.updateSceneReferenceFrameScale).not.toHaveBeenCalled();
    expect(harness.followCurrentTarget).not.toHaveBeenCalled();
  });
});

interface HarnessOptions {
  readonly streamingAvailable: boolean;
  readonly observerModeActive: boolean;
  readonly observerPresentationActive: boolean;
  readonly observerSkyContentActive?: boolean;
  readonly objectScaleChanged: boolean;
  readonly sceneScaleChanged: boolean;
  readonly referenceFrameScaleAvailable: boolean;
}

function createHarness(overrides: Partial<HarnessOptions> = {}) {
  const options: HarnessOptions = {
    streamingAvailable: true,
    observerModeActive: true,
    observerPresentationActive: true,
    objectScaleChanged: false,
    sceneScaleChanged: false,
    referenceFrameScaleAvailable: true,
    ...overrides,
  };
  const camera = new THREE.PerspectiveCamera(48, 16 / 9, 0.1, 100_000);
  const updateStreaming = vi.fn<FrameContentStreamingCoordinator['update']>();
  const streamingCoordinator: FrameContentStreamingCoordinator = {
    update: updateStreaming,
  };
  const updateObjectLod = vi.fn<FrameContentObjectRuntime['updateLod']>();
  const updateObjectReferenceFrameScale = vi.fn<
    NonNullable<FrameContentObjectRuntime['updateReferenceFrameScale']>
  >(() => options.objectScaleChanged);
  const objectRuntime: FrameContentObjectRuntime = {
    ...(options.referenceFrameScaleAvailable
      ? { updateReferenceFrameScale: updateObjectReferenceFrameScale }
      : {}),
    updateLod: updateObjectLod,
  };
  const ensureMilkyWayAtlas = vi.fn<FrameContentScene['ensureMilkyWayAtlas']>(async () => true);
  const updateSceneLod = vi.fn<FrameContentScene['updateLod']>();
  const updateSceneReferenceFrameScale = vi.fn<
    NonNullable<FrameContentScene['updateReferenceFrameScale']>
  >(() => options.sceneScaleChanged);
  const scene: FrameContentScene = {
    spaceRoot: new THREE.Group(),
    ensureMilkyWayAtlas,
    ...(options.referenceFrameScaleAvailable
      ? { updateReferenceFrameScale: updateSceneReferenceFrameScale }
      : {}),
    updateLod: updateSceneLod,
  };
  const ensureTempelFilamentSpines = vi.fn<() => Promise<void>>(async () => undefined);
  const preloadTempelFilamentSpines = vi.fn<() => Promise<void>>(async () => undefined);
  const followCurrentTarget = vi.fn();
  const bindings: UniverseFrameContentBindings = {
    getStreamingCoordinator: () => (options.streamingAvailable ? streamingCoordinator : null),
    getQuality: () => 'high',
    getTargetId: () => 'earth',
    getSelectedId: () => 'moon',
    followCurrentTarget,
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
      ...(options.observerSkyContentActive === undefined
        ? {}
        : { observerSkyContentActive: options.observerSkyContentActive }),
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
    updateObjectReferenceFrameScale,
    ensureMilkyWayAtlas,
    updateSceneLod,
    updateSceneReferenceFrameScale,
    followCurrentTarget,
    preloadTempelFilamentSpines,
    ensureTempelFilamentSpines,
  };
}
