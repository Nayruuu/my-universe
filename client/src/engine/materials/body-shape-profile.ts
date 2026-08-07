import type { TriaxialBodyShapeDefinition } from '../../data/models/universe.models';

export type TriaxialBodyScale = readonly [x: number, y: number, z: number];

export function calculateTriaxialBodyScale(
  shape: TriaxialBodyShapeDefinition | undefined,
): TriaxialBodyScale {
  if (!shape) {
    return [1, 1, 1];
  }

  const [equatorialX, equatorialY, polar] = shape.dimensionsKm;
  const geometricMean = Math.cbrt(equatorialX * equatorialY * polar);

  // Three.js uses local +Y as the spin pole; catalog dimensions use A × B × polar C.
  return [equatorialX / geometricMean, polar / geometricMean, equatorialY / geometricMean];
}
