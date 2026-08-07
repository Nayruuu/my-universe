import type { AdaptiveRenderingStats, GraphicQuality } from '../../data/models/universe.models';

export interface UniverseAdaptiveRenderingResources {
  readonly renderer: { setPixelRatio(pixelRatio: number): void };
  readonly universeScene: { setPixelRatio(pixelRatio: number): void };
}

export interface UniverseAdaptiveRenderingManager {
  readonly adaptiveRenderingStats: AdaptiveRenderingStats;
  observeFrame(quality: GraphicQuality, deltaSeconds: number, paused: boolean): number | null;
}

export interface UniverseAdaptiveRenderingBindings {
  getResources(): UniverseAdaptiveRenderingResources | null;
  getQuality(): GraphicQuality;
  isSamplingPaused(): boolean;
  setPixelRatio(pixelRatio: number): void;
  resize(): void;
}

export class UniverseAdaptiveRenderingRuntime {
  constructor(
    private readonly performanceManager: UniverseAdaptiveRenderingManager,
    private readonly bindings: UniverseAdaptiveRenderingBindings,
  ) {}

  public get stats(): AdaptiveRenderingStats {
    return this.performanceManager.adaptiveRenderingStats;
  }

  public update(deltaSeconds: number): void {
    const adjustedPixelRatio = this.performanceManager.observeFrame(
      this.bindings.getQuality(),
      deltaSeconds,
      this.bindings.isSamplingPaused(),
    );

    if (adjustedPixelRatio === null) {
      return;
    }
    const resources = this.bindings.getResources();

    if (!resources) {
      return;
    }
    this.bindings.setPixelRatio(adjustedPixelRatio);
    resources.renderer.setPixelRatio(adjustedPixelRatio);
    resources.universeScene.setPixelRatio(adjustedPixelRatio);
    this.bindings.resize();
  }
}
