import { type EngineDebugStats } from '../../data/models/universe.models';
import {
  type UniverseDebugContext,
  type UniverseDebugMonitorBindings,
  UniverseDebugMonitor,
} from './universe-debug-monitor';

describe('UniverseDebugMonitor', () => {
  it('attend une seconde puis publie un instantané complet avec les valeurs de repli', () => {
    const harness = createHarness();

    harness.monitor.update(0.25);
    expect(harness.emitStats).not.toHaveBeenCalled();

    harness.monitor.update(0.75);

    expect(harness.emitStats).toHaveBeenCalledWith({
      fps: 2,
      drawCalls: 3,
      triangles: 120,
      geometries: 4,
      textures: 2,
      visibleObjects: 11,
      catalogStars: 10_000,
      exoplanetHosts: 4_747,
      exoplanets: 6_333,
      cosmicGroups: 37_730,
      cosmicFilaments: 42_000,
      cosmicStructures: 9_985,
      tempelFilamentSpines: 15_421,
      tempelSpineSegments: 260_178,
      visibleTempelSpineSegments: 18_000,
      tempelSpineTiles: 8,
      batchedGalaxies: 7,
      loadedTiles: 0,
      indexedGalaxyTiles: 0,
      cachedGalaxyTiles: 0,
      activeStarTiles: 0,
      cachedStarPacks: 0,
      cachedStarTiles: 0,
      activeStarClusters: 0,
      cachedStarClusters: 0,
      visibleStarClusters: 302,
      cameraPosition: { x: 9, y: 8, z: 7 },
      cameraTarget: { x: 0, y: 0, z: 0 },
      cameraDistance: 0,
      floatingOrigin: { x: 100, y: 200, z: 300 },
      targetId: 'earth',
      navigationOriginId: 'earth',
      navigationReferenceFrame: 'solar-system',
      lodLevel: 1,
      julianDay: 2_460_000,
      quality: 'medium',
      pixelRatio: 1,
      adaptiveRendering: adaptiveRendering(),
      zoom: null,
      startupPerformance: startupPerformance(),
      tempelPerformance: tempelPerformance(),
    } satisfies EngineDebugStats);
  });

  it('publie la résolution adaptative et fusionne le diagnostic de zoom', () => {
    const harness = createHarness({
      cameraTarget: { x: 1, y: 2, z: 3 },
      cameraDistance: 24,
      navigationContext: {
        targetId: 'mars',
        referenceFrame: 'stellar',
        lodLevel: 2,
      },
      quality: 'high',
      pixelRatio: 2,
      streamingStats: {
        loadedTiles: 6,
        indexedGalaxyTiles: 12,
        cachedGalaxyTiles: 4,
        activeStarTiles: 8,
        cachedStarPacks: 5,
        cachedStarTiles: 19,
        activeStarClusters: 302,
        cachedStarClusters: 2_610,
      },
      zoomDiagnostics: {
        deltaY: -480,
        beforeDistance: 17_000,
        requestedDistance: 9_600,
        appliedDistance: 9_600,
        minimumDistance: 1.5,
        maximumDistance: 18_000,
        status: 'applied',
      },
      zoomAnchor: {
        anchorType: 'object',
        anchorObjectId: 'mars',
      },
    });

    harness.monitor.update(1);

    expect(harness.emitStats).toHaveBeenCalledWith(
      expect.objectContaining({
        fps: 1,
        loadedTiles: 6,
        indexedGalaxyTiles: 12,
        cachedGalaxyTiles: 4,
        activeStarTiles: 8,
        cachedStarPacks: 5,
        cachedStarTiles: 19,
        activeStarClusters: 302,
        cachedStarClusters: 2_610,
        cameraTarget: { x: 1, y: 2, z: 3 },
        cameraDistance: 24,
        navigationOriginId: 'mars',
        navigationReferenceFrame: 'stellar',
        quality: 'high',
        pixelRatio: 2,
        adaptiveRendering: adaptiveRendering(),
        zoom: {
          anchorType: 'object',
          anchorObjectId: 'mars',
          deltaY: -480,
          beforeDistance: 17_000,
          requestedDistance: 9_600,
          appliedDistance: 9_600,
          minimumDistance: 1.5,
          maximumDistance: 18_000,
          status: 'applied',
        },
      }),
    );
  });
});

function createHarness(overrides: Partial<UniverseDebugContext> = {}): DebugMonitorHarness {
  const context: UniverseDebugContext = {
    cameraTarget: null,
    cameraDistance: 0,
    floatingOrigin: { x: 100, y: 200, z: 300 },
    targetId: 'earth',
    navigationContext: {
      targetId: null,
      referenceFrame: 'solar-system',
      lodLevel: 1,
    },
    lodLevel: 1,
    julianDay: 2_460_000,
    quality: 'medium',
    pixelRatio: 1,
    adaptiveRendering: adaptiveRendering(),
    streamingStats: null,
    zoomDiagnostics: null,
    zoomAnchor: null,
    tempelPerformance: tempelPerformance(),
    startupPerformance: startupPerformance(),
    ...overrides,
  };
  const emitStats = vi.fn();
  const bindings: UniverseDebugMonitorBindings = {
    getContext: () => context,
    emitStats,
  };
  const monitor = new UniverseDebugMonitor(
    {
      info: {
        render: { calls: 3, triangles: 120 },
        memory: { geometries: 4, textures: 2 },
      },
    },
    { position: { x: 9, y: 8, z: 7 } },
    {
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
    {
      visibleObjectCount: 11,
      batchedGalaxyCount: 7,
    },
    bindings,
  );

  return {
    monitor,
    emitStats,
  };
}

function tempelPerformance() {
  return {
    status: 'visible',
    execution: 'worker',
    fetchMs: 24,
    decodeMs: 7,
    workerRoundTripMs: 38,
    geometryPreparationMs: 46,
    sceneInstallationMs: 2,
    preloadHit: true,
    preloadLeadMs: 18,
    firstVisibleFrameMs: 12,
    activationToFirstVisibleMs: 60,
    timeToFirstVisibleMs: 104,
  } as const;
}

function startupPerformance() {
  return {
    status: 'usable',
    engineModuleMs: 100,
    dataReadyMs: 240,
    sceneReadyMs: 420,
    firstUsableMapMs: 510,
    budgetStatus: 'within-budget',
    exceededBudgets: [],
  } as const;
}

interface DebugMonitorHarness {
  readonly monitor: UniverseDebugMonitor;
  readonly emitStats: ReturnType<typeof vi.fn>;
}

function adaptiveRendering() {
  return {
    status: 'stable',
    p95FrameMs: 16,
    longFrameRatio: 0,
    targetPixelRatio: 1,
    currentPixelRatio: 1,
  } as const;
}
