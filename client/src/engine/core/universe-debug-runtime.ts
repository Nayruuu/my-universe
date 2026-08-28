import type {
  EngineDebugStats,
  GaiaPresentationStats,
  GraphicQuality,
  TempelFilamentPerformanceStats,
  UniverseStartupPerformanceStats,
  Vector3Like,
  ZoomDebugStats,
} from '../../data/models/universe.models';
import type { CameraZoomDiagnostics } from '../camera/camera-controller';
import type { NavigationContext } from '../camera/navigation-context';
import {
  type UniverseDebugCameraMetrics,
  type UniverseDebugObjectMetrics,
  type UniverseDebugRendererMetrics,
  type UniverseDebugSceneMetrics,
  UniverseDebugMonitor,
} from './universe-debug-monitor';
import type { SpaceStreamingStats } from './space-streaming-coordinator';

export interface UniverseDebugRuntimeResources {
  readonly renderer: UniverseDebugRendererMetrics;
  readonly camera: UniverseDebugCameraMetrics;
  readonly universeScene: UniverseDebugSceneMetrics;
  getGaiaPresentationStats(): GaiaPresentationStats;
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
  getAdaptiveRendering(): EngineDebugStats['adaptiveRendering'];
  getStreamingStats(): SpaceStreamingStats | null;
  getZoomDiagnostics(): CameraZoomDiagnostics | null;
  getZoomAnchor(): Pick<ZoomDebugStats, 'anchorType' | 'anchorObjectId'> | null;
  getTempelPerformance(): TempelFilamentPerformanceStats;
  getStartupPerformance(): UniverseStartupPerformanceStats;
  emitStats(stats: EngineDebugStats): void;
}

export class UniverseDebugRuntime {
  private monitor: UniverseDebugMonitor | null = null;

  constructor(
    private readonly objectRuntime: UniverseDebugObjectMetrics,
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
          adaptiveRendering: this.bindings.getAdaptiveRendering(),
          streamingStats: this.bindings.getStreamingStats(),
          zoomDiagnostics: this.bindings.getZoomDiagnostics(),
          zoomAnchor: this.bindings.getZoomAnchor(),
          tempelPerformance: this.bindings.getTempelPerformance(),
          startupPerformance: this.bindings.getStartupPerformance(),
          gaiaPresentation: resources.getGaiaPresentationStats(),
        }),
        emitStats: (stats) => this.bindings.emitStats(stats),
      },
    );
  }
}
