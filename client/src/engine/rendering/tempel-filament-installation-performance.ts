import type { TempelFilamentSceneInstallationMetrics } from '../../data/models/universe.models';

type MonotonicClock = () => number;

export interface MeasuredTempelFilamentInstallation<T> {
  readonly value: T;
  readonly metrics: TempelFilamentSceneInstallationMetrics;
}

export function measureTempelFilamentInstallation<T>(
  prepare: () => T,
  install: (value: T) => void,
  now: MonotonicClock = () => performance.now(),
): MeasuredTempelFilamentInstallation<T> {
  const preparationStartedAt = now();
  const value = prepare();
  const installationStartedAt = now();

  install(value);

  return {
    value,
    metrics: {
      geometryPreparationMs: installationStartedAt - preparationStartedAt,
      sceneInstallationMs: now() - installationStartedAt,
    },
  };
}
