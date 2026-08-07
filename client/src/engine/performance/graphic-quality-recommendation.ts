import type { GraphicQuality } from '../../data/models/universe.models';

export function recommendGraphicQuality(): GraphicQuality {
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
