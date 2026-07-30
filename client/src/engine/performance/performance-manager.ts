import { GraphicQuality } from '../../data/models/universe.models';

const QUALITY_PARTICLE_COUNTS: Readonly<Record<GraphicQuality, number>> = {
  low: 2_000,
  medium: 5_000,
  high: 10_000,
};

export class PerformanceManager {
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
}
