import type {
  EngineDebugStats,
  GraphicQuality,
  Vector3Like,
  ZoomDebugStats,
} from '../../data/models/universe.models';
import type { CameraZoomDiagnostics } from '../camera/camera-controller';
import type { NavigationContext } from '../camera/navigation-context';
import {
  type UniverseDebugCameraMetrics,
  type UniverseDebugObjectMetrics,
  type UniverseDebugPerformanceManager,
  type UniverseDebugRendererMetrics,
  type UniverseDebugSceneMetrics,
  UniverseDebugMonitor,
} from './universe-debug-monitor';
import type { SpaceStreamingStats } from './space-streaming-coordinator';

export interface UniverseDebugRuntimeResources {
  readonly renderer: UniverseDebugRendererMetrics & {
    setPixelRatio(pixelRatio: number): void;
  };
  readonly camera: UniverseDebugCameraMetrics;
  readonly universeScene: UniverseDebugSceneMetrics & {
    setPixelRatio(pixelRatio: number): void;
  };
}

export interface UniverseDebugRuntimeBindings {
  getResources(): UniverseDebugRuntimeResources | null;
  getCameraTarget(): Vector3Like | null;
  getCameraDistance(): number;
  getFloatingOrigin(): Vector3Like;
  getTargetId(): string | null;
  getNavigationContext(): NavigationContext;
  getLodLevel(): number;
  getJulianDay(): number;
  getQuality(): GraphicQuality;
  getPixelRatio(): number;
  getStreamingStats(): SpaceStreamingStats | null;
  getZoomDiagnostics(): CameraZoomDiagnostics | null;
  getZoomAnchor(): Pick<ZoomDebugStats, 'anchorType' | 'anchorObjectId'> | null;
  setPixelRatio(pixelRatio: number): void;
  resize(): void;
  emitStats(stats: EngineDebugStats): void;
}

export class UniverseDebugRuntime {
  private monitor: UniverseDebugMonitor | null = null;

  constructor(
    private readonly objectRuntime: UniverseDebugObjectMetrics,
    private readonly performanceManager: UniverseDebugPerformanceManager,
    private readonly bindings: UniverseDebugRuntimeBindings,
  ) {}

  public update(deltaSeconds: number): void {
    const resources = this.bindings.getResources();

    if (!resources) {
      return;
    }
    this.monitor ??= this.createMonitor(resources);
    this.monitor.update(deltaSeconds);
  }

  public reset(): void {
    this.monitor = null;
  }

  private createMonitor(resources: UniverseDebugRuntimeResources): UniverseDebugMonitor {
    return new UniverseDebugMonitor(
      resources.renderer,
      resources.camera,
      resources.universeScene,
      this.objectRuntime,
      this.performanceManager,
      {
        getContext: () => ({
          cameraTarget: this.bindings.getCameraTarget(),
          cameraDistance: this.bindings.getCameraDistance(),
          floatingOrigin: this.bindings.getFloatingOrigin(),
          targetId: this.bindings.getTargetId(),
          navigationContext: this.bindings.getNavigationContext(),
          lodLevel: this.bindings.getLodLevel(),
          julianDay: this.bindings.getJulianDay(),
          quality: this.bindings.getQuality(),
          pixelRatio: this.bindings.getPixelRatio(),
          streamingStats: this.bindings.getStreamingStats(),
          zoomDiagnostics: this.bindings.getZoomDiagnostics(),
          zoomAnchor: this.bindings.getZoomAnchor(),
        }),
        applyPixelRatio: (pixelRatio) => {
          this.bindings.setPixelRatio(pixelRatio);
          resources.renderer.setPixelRatio(pixelRatio);
          resources.universeScene.setPixelRatio(pixelRatio);
          this.bindings.resize();
        },
        emitStats: (stats) => this.bindings.emitStats(stats),
      },
    );
  }
}
