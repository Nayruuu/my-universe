import type { EngineDebugStats } from '../../data/models/universe.models';
import {
  type UniverseDebugRuntimeBindings,
  type UniverseDebugRuntimeResources,
  UniverseDebugRuntime,
} from './universe-debug-runtime';

describe('UniverseDebugRuntime', () => {
  it('reste inactif tant que les ressources de rendu ne sont pas complètes', () => {
    const harness = createHarness(null);

    harness.runtime.update(2);

    expect(harness.performanceManager.observeFrameRate).not.toHaveBeenCalled();
    expect(harness.emitStats).not.toHaveBeenCalled();
  });

  it('crée le moniteur à la demande et applique la résolution adaptative', () => {
    const resources = debugResources();
    const harness = createHarness(resources);

    harness.runtime.update(0.5);
    harness.runtime.update(0.5);

    expect(harness.performanceManager.observeFrameRate).toHaveBeenCalledWith('high', 2);
    expect(harness.setPixelRatio).toHaveBeenCalledWith(1.25);
    expect(resources.renderer.setPixelRatio).toHaveBeenCalledWith(1.25);
    expect(resources.universeScene.setPixelRatio).toHaveBeenCalledWith(1.25);
    expect(harness.resize).toHaveBeenCalledOnce();
    expect(harness.emitStats).toHaveBeenCalledWith(
      expect.objectContaining({
        fps: 2,
        cameraDistance: 24,
        targetId: 'earth',
        pixelRatio: 1.25,
      }) satisfies Partial<EngineDebugStats>,
    );
  });

  it('oublie le moniteur lors du reset pour une nouvelle scène', () => {
    const firstResources = debugResources();
    const harness = createHarness(firstResources);

    harness.runtime.update(0.5);
    harness.runtime.reset();
    harness.resources.current = debugResources(42);
    harness.runtime.update(1);

    expect(harness.emitStats).toHaveBeenCalledOnce();
    expect(harness.emitStats).toHaveBeenCalledWith(
      expect.objectContaining({ cameraPosition: { x: 42, y: 2, z: 3 } }),
    );
  });
});

function createHarness(
  initialResources: UniverseDebugRuntimeResources | null,
): DebugRuntimeHarness {
  const resources = { current: initialResources };
  const performanceManager = {
    observeFrameRate: vi.fn(() => 1.25),
  };
  const setPixelRatio = vi.fn();
  const resize = vi.fn();
  const emitStats = vi.fn();
  const bindings: UniverseDebugRuntimeBindings = {
    getResources: () => resources.current,
    getCameraTarget: () => ({ x: 4, y: 5, z: 6 }),
    getCameraDistance: () => 24,
    getFloatingOrigin: () => ({ x: 100, y: 200, z: 300 }),
    getTargetId: () => 'earth',
    getNavigationContext: () => ({
      targetId: 'earth',
      referenceFrame: 'solar-system',
      lodLevel: 1,
    }),
    getLodLevel: () => 1,
    getJulianDay: () => 2_460_000,
    getQuality: () => 'high',
    getPixelRatio: () => 1.5,
    getStreamingStats: () => null,
    getZoomDiagnostics: () => null,
    getZoomAnchor: () => null,
    setPixelRatio,
    resize,
    emitStats,
  };

  return {
    runtime: new UniverseDebugRuntime(
      { visibleObjectCount: 4, batchedGalaxyCount: 7 },
      performanceManager,
      bindings,
    ),
    resources,
    performanceManager,
    setPixelRatio,
    resize,
    emitStats,
  };
}

function debugResources(cameraX = 1): UniverseDebugRuntimeResources {
  return {
    renderer: {
      info: {
        render: { calls: 3, triangles: 120 },
        memory: { geometries: 4, textures: 2 },
      },
      setPixelRatio: vi.fn(),
    },
    camera: { position: { x: cameraX, y: 2, z: 3 } },
    universeScene: {
      visibleCatalogStarCount: 10_000,
      visibleExoplanetHostCount: 4_747,
      exoplanetCount: 6_333,
      visibleCosmicGroupCount: 37_730,
      visibleCosmicFilamentCount: 42_000,
      visibleCosmicStructureCount: 9_985,
      tempelFilamentSpineCount: 15_421,
      tempelFilamentSpineSegmentCount: 260_178,
      visibleTempelFilamentSpineSegmentCount: 18_000,
      tempelFilamentSpineTileCount: 8,
      visibleStarClusterCount: 302,
      setPixelRatio: vi.fn(),
    },
  };
}

interface DebugRuntimeHarness {
  readonly runtime: UniverseDebugRuntime;
  readonly resources: { current: UniverseDebugRuntimeResources | null };
  readonly performanceManager: {
    readonly observeFrameRate: ReturnType<typeof vi.fn>;
  };
  readonly setPixelRatio: ReturnType<typeof vi.fn>;
  readonly resize: ReturnType<typeof vi.fn>;
  readonly emitStats: ReturnType<typeof vi.fn>;
}
