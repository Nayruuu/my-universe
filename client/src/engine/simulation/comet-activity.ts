import type { CometActivityDefinition } from '../../data/models/universe.models';

export interface CometActivityAppearance {
  readonly intensity: number;
  readonly comaScale: number;
  readonly tailScale: number;
}

export function calculateCometActivity(
  heliocentricDistanceAu: number,
  definition: CometActivityDefinition,
): CometActivityAppearance {
  assertValidDistance(heliocentricDistanceAu);
  assertValidDefinition(definition);

  const linearIntensity = clamp01(
    (definition.activationDistanceAu - heliocentricDistanceAu) /
      (definition.activationDistanceAu - definition.saturatedDistanceAu),
  );
  const intensity = smoothStep(linearIntensity);

  return {
    intensity,
    comaScale: Math.sqrt(intensity),
    tailScale: intensity,
  };
}

function assertValidDistance(distanceAu: number): void {
  if (!Number.isFinite(distanceAu) || distanceAu < 0) {
    throw new Error('Distance héliocentrique invalide.');
  }
}

function assertValidDefinition(definition: CometActivityDefinition): void {
  if (
    !Number.isFinite(definition.activationDistanceAu) ||
    definition.activationDistanceAu <= 0 ||
    !Number.isFinite(definition.saturatedDistanceAu) ||
    definition.saturatedDistanceAu < 0 ||
    definition.saturatedDistanceAu >= definition.activationDistanceAu
  ) {
    throw new Error('Profil d’activité cométaire invalide.');
  }
}

function clamp01(value: number): number {
  return Math.min(1, Math.max(0, value));
}

function smoothStep(value: number): number {
  return value * value * (3 - 2 * value);
}
