import type { AdaptiveRenderingStats, GraphicQuality } from '../../data/models/universe.models';
import { AdaptivePixelRatioController } from './adaptive-pixel-ratio-controller';
import { getAdaptiveFrameProfile } from './adaptive-rendering-profile';
import { recommendGraphicQuality } from './graphic-quality-recommendation';

const QUALITY_PARTICLE_COUNTS: Readonly<Record<GraphicQuality, number>> = {
  low: 2_000,
  medium: 5_000,
  high: 10_000,
};

export class PerformanceManager {
  private readonly adaptivePixelRatioController = new AdaptivePixelRatioController();
  private adaptiveQuality: GraphicQuality | null = null;

  public recommendQuality(): GraphicQuality {
    return recommendGraphicQuality();
  }

  public getPixelRatio(quality: GraphicQuality): number {
    const cap = quality === 'low' ? 1 : quality === 'medium' ? 1.25 : 1.5;

    return Math.min(window.devicePixelRatio, cap);
  }

  public getParticleCount(quality: GraphicQuality): number {
    return QUALITY_PARTICLE_COUNTS[quality];
  }

  public get adaptivePixelRatio(): number {
    return this.adaptivePixelRatioController.currentPixelRatio;
  }

  public get adaptiveRenderingStats(): AdaptiveRenderingStats {
    return this.adaptivePixelRatioController.snapshot;
  }

  public resetAdaptivePixelRatio(quality: GraphicQuality): number {
    this.adaptiveQuality = quality;

    return this.adaptivePixelRatioController.reset(this.getPixelRatio(quality));
  }

  public observeFrame(
    quality: GraphicQuality,
    deltaSeconds: number,
    paused: boolean,
  ): number | null {
    if (quality !== this.adaptiveQuality) {
      this.resetAdaptivePixelRatio(quality);

      return null;
    }

    return this.adaptivePixelRatioController.observe(
      deltaSeconds,
      getAdaptiveFrameProfile(quality),
      paused,
    );
  }
}
