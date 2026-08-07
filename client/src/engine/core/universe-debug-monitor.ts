import {
  type EngineDebugStats,
  type GraphicQuality,
  type Vector3Like,
  type ZoomDebugStats,
} from '../../data/models/universe.models';
import { type CameraZoomDiagnostics } from '../camera/camera-controller';
import { type NavigationContext } from '../camera/navigation-context';
import { type SpaceStreamingStats } from './space-streaming-coordinator';

export interface UniverseDebugRendererMetrics {
  readonly info: {
    readonly render: { readonly calls: number; readonly triangles: number };
    readonly memory: { readonly geometries: number; readonly textures: number };
  };
}

export interface UniverseDebugCameraMetrics {
  readonly position: Vector3Like;
}

export interface UniverseDebugSceneMetrics {
  readonly visibleCatalogStarCount: number;
  readonly visibleExoplanetHostCount: number;
  readonly exoplanetCount: number;
  readonly visibleCosmicGroupCount: number;
  readonly visibleCosmicFilamentCount: number;
  readonly visibleCosmicStructureCount: number;
  readonly tempelFilamentSpineCount: number;
  readonly tempelFilamentSpineSegmentCount: number;
  readonly visibleTempelFilamentSpineSegmentCount: number;
  readonly tempelFilamentSpineTileCount: number;
  readonly visibleStarClusterCount: number;
}

export interface UniverseDebugObjectMetrics {
  readonly visibleObjectCount: number;
  readonly batchedGalaxyCount: number;
}

export interface UniverseDebugPerformanceManager {
  observeFrameRate(quality: GraphicQuality, fps: number): number | null;
}

export interface UniverseDebugContext {
  readonly cameraTarget: Vector3Like | null;
  readonly cameraDistance: number;
  readonly floatingOrigin: Vector3Like;
  readonly targetId: string | null;
  readonly navigationContext: NavigationContext;
  readonly lodLevel: number;
  readonly julianDay: number;
  readonly quality: GraphicQuality;
  readonly pixelRatio: number;
  readonly streamingStats: SpaceStreamingStats | null;
  readonly zoomDiagnostics: CameraZoomDiagnostics | null;
  readonly zoomAnchor: Pick<ZoomDebugStats, 'anchorType' | 'anchorObjectId'> | null;
}

export interface UniverseDebugMonitorBindings {
  getContext(): UniverseDebugContext;
  applyPixelRatio(pixelRatio: number): void;
  emitStats(stats: EngineDebugStats): void;
}

export class UniverseDebugMonitor {
  private statsAccumulator = 0;
  private statsFrames = 0;

  constructor(
    private readonly renderer: UniverseDebugRendererMetrics,
    private readonly camera: UniverseDebugCameraMetrics,
    private readonly universeScene: UniverseDebugSceneMetrics,
    private readonly objectRuntime: UniverseDebugObjectMetrics,
    private readonly performanceManager: UniverseDebugPerformanceManager,
    private readonly bindings: UniverseDebugMonitorBindings,
  ) {}

  public update(deltaSeconds: number): void {
    this.statsAccumulator += deltaSeconds;
    this.statsFrames += 1;
    if (this.statsAccumulator < 1) {
      return;
    }

    const fps = Math.round(this.statsFrames / this.statsAccumulator);
    const context = this.bindings.getContext();
    const adjustedPixelRatio = this.performanceManager.observeFrameRate(context.quality, fps);
    const pixelRatio = adjustedPixelRatio ?? context.pixelRatio;

    if (adjustedPixelRatio !== null) {
      this.bindings.applyPixelRatio(adjustedPixelRatio);
    }
    this.bindings.emitStats(this.createStats(fps, pixelRatio, context));
    this.statsAccumulator = 0;
    this.statsFrames = 0;
  }

  private createStats(
    fps: number,
    pixelRatio: number,
    context: UniverseDebugContext,
  ): EngineDebugStats {
    const streamingStats = context.streamingStats;

    return {
      fps,
      drawCalls: this.renderer.info.render.calls,
      triangles: this.renderer.info.render.triangles,
      geometries: this.renderer.info.memory.geometries,
      textures: this.renderer.info.memory.textures,
      visibleObjects: this.objectRuntime.visibleObjectCount,
      catalogStars: this.universeScene.visibleCatalogStarCount,
      exoplanetHosts: this.universeScene.visibleExoplanetHostCount,
      exoplanets: this.universeScene.exoplanetCount,
      cosmicGroups: this.universeScene.visibleCosmicGroupCount,
      cosmicFilaments: this.universeScene.visibleCosmicFilamentCount,
      cosmicStructures: this.universeScene.visibleCosmicStructureCount,
      tempelFilamentSpines: this.universeScene.tempelFilamentSpineCount,
      tempelSpineSegments: this.universeScene.tempelFilamentSpineSegmentCount,
      visibleTempelSpineSegments: this.universeScene.visibleTempelFilamentSpineSegmentCount,
      tempelSpineTiles: this.universeScene.tempelFilamentSpineTileCount,
      batchedGalaxies: this.objectRuntime.batchedGalaxyCount,
      loadedTiles: streamingStats?.loadedTiles ?? 0,
      indexedGalaxyTiles: streamingStats?.indexedGalaxyTiles ?? 0,
      cachedGalaxyTiles: streamingStats?.cachedGalaxyTiles ?? 0,
      activeStarTiles: streamingStats?.activeStarTiles ?? 0,
      cachedStarPacks: streamingStats?.cachedStarPacks ?? 0,
      cachedStarTiles: streamingStats?.cachedStarTiles ?? 0,
      activeStarClusters: streamingStats?.activeStarClusters ?? 0,
      cachedStarClusters: streamingStats?.cachedStarClusters ?? 0,
      visibleStarClusters: this.universeScene.visibleStarClusterCount,
      cameraPosition: vectorToLike(this.camera.position),
      cameraTarget: context.cameraTarget
        ? vectorToLike(context.cameraTarget)
        : { x: 0, y: 0, z: 0 },
      cameraDistance: context.cameraDistance,
      floatingOrigin: vectorToLike(context.floatingOrigin),
      targetId: context.targetId,
      navigationOriginId: context.navigationContext.targetId ?? context.targetId,
      navigationReferenceFrame: context.navigationContext.referenceFrame,
      lodLevel: context.lodLevel,
      julianDay: context.julianDay,
      quality: context.quality,
      pixelRatio,
      zoom:
        context.zoomDiagnostics && context.zoomAnchor
          ? { ...context.zoomDiagnostics, ...context.zoomAnchor }
          : null,
    };
  }
}

function vectorToLike(vector: Vector3Like): Vector3Like {
  return { x: vector.x, y: vector.y, z: vector.z };
}
