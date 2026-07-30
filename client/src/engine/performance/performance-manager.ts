import { GraphicQuality } from '../../data/models/universe.models';

const QUALITY_PARTICLE_COUNTS: Readonly<Record<GraphicQuality, number>> = {
  low: 2_000,
  medium: 5_000,
  high: 10_000,
};
const SLOW_FRAME_RATE = 45;
const SEVERELY_SLOW_FRAME_RATE = 30;
const RECOVERY_FRAME_RATE = 57;
const SLOW_SAMPLE_COUNT = 2;
const RECOVERY_SAMPLE_COUNT = 8;
const PIXEL_RATIO_STEP = 0.25;
const SEVERE_PIXEL_RATIO_STEP = 0.5;

export class PerformanceManager {
  private adaptiveQuality: GraphicQuality | null = null;
  private currentAdaptivePixelRatio = 1;
  private slowSampleCount = 0;
  private recoverySampleCount = 0;

  public recommendQuality(): GraphicQuality {
    const narrowScreen = window.matchMedia('(max-width: 720px)').matches;
    const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    const logicalProcessors = navigator.hardwareConcurrency ?? 4;

    if (narrowScreen || reducedMotion || logicalProcessors <= 4) {
      return 'low';
    }
    if (logicalProcessors >= 10 && window.devicePixelRatio <= 2) {
      return 'high';
    }

    return 'medium';
  }

  public getPixelRatio(quality: GraphicQuality): number {
    const cap = quality === 'low' ? 1 : quality === 'medium' ? 1.5 : 2;

    return Math.min(window.devicePixelRatio, cap);
  }

  public getParticleCount(quality: GraphicQuality): number {
    return QUALITY_PARTICLE_COUNTS[quality];
  }

  public get adaptivePixelRatio(): number {
    return this.currentAdaptivePixelRatio;
  }

  public resetAdaptivePixelRatio(quality: GraphicQuality): number {
    this.adaptiveQuality = quality;
    this.currentAdaptivePixelRatio = this.getPixelRatio(quality);
    this.resetSampleCounters();

    return this.currentAdaptivePixelRatio;
  }

  public observeFrameRate(quality: GraphicQuality, framesPerSecond: number): number | null {
    if (quality !== this.adaptiveQuality) {
      this.resetAdaptivePixelRatio(quality);

      return null;
    }
    const targetPixelRatio = this.getPixelRatio(quality);
    const minimumPixelRatio = Math.min(1, targetPixelRatio);

    if (framesPerSecond < SLOW_FRAME_RATE && this.currentAdaptivePixelRatio > minimumPixelRatio) {
      this.slowSampleCount += 1;
      this.recoverySampleCount = 0;
      if (this.slowSampleCount < SLOW_SAMPLE_COUNT) {
        return null;
      }
      const step =
        framesPerSecond < SEVERELY_SLOW_FRAME_RATE ? SEVERE_PIXEL_RATIO_STEP : PIXEL_RATIO_STEP;

      this.currentAdaptivePixelRatio = Math.max(
        minimumPixelRatio,
        this.currentAdaptivePixelRatio - step,
      );
      this.slowSampleCount = 0;

      return this.currentAdaptivePixelRatio;
    }
    if (
      framesPerSecond >= RECOVERY_FRAME_RATE &&
      this.currentAdaptivePixelRatio < targetPixelRatio
    ) {
      this.recoverySampleCount += 1;
      this.slowSampleCount = 0;
      if (this.recoverySampleCount < RECOVERY_SAMPLE_COUNT) {
        return null;
      }
      this.currentAdaptivePixelRatio = Math.min(
        targetPixelRatio,
        this.currentAdaptivePixelRatio + PIXEL_RATIO_STEP,
      );
      this.recoverySampleCount = 0;

      return this.currentAdaptivePixelRatio;
    }
    this.resetSampleCounters();

    return null;
  }

  private resetSampleCounters(): void {
    this.slowSampleCount = 0;
    this.recoverySampleCount = 0;
  }
}
