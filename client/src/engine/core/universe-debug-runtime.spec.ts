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

    expect(harness.emitStats).not.toHaveBeenCalled();
  });

  it('crée le moniteur à la demande et publie la résolution adaptative', () => {
    const resources = debugResources();
    const harness = createHarness(resources);

    harness.runtime.update(0.5);
    harness.runtime.update(0.5);

    expect(harness.emitStats).toHaveBeenCalledWith(
      expect.objectContaining({
        fps: 2,
        cameraDistance: 24,
        targetId: 'earth',
        pixelRatio: 1.5,
        adaptiveRendering: adaptiveRendering(),
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
    getAdaptiveRendering: () => adaptiveRendering(),
    getStreamingStats: () => null,
    getZoomDiagnostics: () => null,
    getZoomAnchor: () => null,
    getTempelPerformance: () => ({
      status: 'idle',
      execution: null,
      fetchMs: null,
      decodeMs: null,
      workerRoundTripMs: null,
      geometryPreparationMs: null,
      sceneInstallationMs: null,
      preloadHit: null,
      preloadLeadMs: null,
      firstVisibleFrameMs: null,
      activationToFirstVisibleMs: null,
      timeToFirstVisibleMs: null,
    }),
    getStartupPerformance: () => ({
      status: 'usable',
      engineModuleMs: 100,
      dataReadyMs: 240,
      sceneReadyMs: 420,
      firstUsableMapMs: 510,
      budgetStatus: 'within-budget',
      exceededBudgets: [],
    }),
    emitStats,
  };

  return {
    runtime: new UniverseDebugRuntime({ visibleObjectCount: 4, batchedGalaxyCount: 7 }, bindings),
    resources,
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
    },
    getGaiaPresentationStats: () => ({
      sampledSources: 250,
      projectedSampledSources: 180,
      aggregateCells: 52,
      projectedAggregateCells: 31,
    }),
  };
}

interface DebugRuntimeHarness {
  readonly runtime: UniverseDebugRuntime;
  readonly resources: { current: UniverseDebugRuntimeResources | null };
  readonly emitStats: ReturnType<typeof vi.fn>;
}

function adaptiveRendering() {
  return {
    status: 'stable',
    p95FrameMs: 16,
    longFrameRatio: 0,
    targetPixelRatio: 1.5,
    currentPixelRatio: 1.5,
  } as const;
}
