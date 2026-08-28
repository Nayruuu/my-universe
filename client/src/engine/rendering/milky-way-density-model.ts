export const MILKY_WAY_ARM_COUNT = 4;
export const MILKY_WAY_ARM_PITCH_DEGREES = 13;
export const MILKY_WAY_ARM_REFERENCE_RADIUS = 1_250;
export const MILKY_WAY_ADAPTED_VISUAL_PITCH_DEGREES = 22;
export const MILKY_WAY_ADAPTED_VISUAL_RADIUS = 5_700;
/**
 * Illustrative anchor of the local Orion-spur presentation. The value mirrors the Sun's
 * galactocentric authoring radius (8.178 kpc in the galactic frame) so the same three-dimensional
 * branch that is visible from outside can surround the camera at the end of the dive.
 */
export const MILKY_WAY_LOCAL_SPUR_REFERENCE_RADIUS = 3_040.73;
export const MILKY_WAY_LOCAL_SPUR_PITCH_DEGREES = 18;

const ARM_PHASE_RADIANS = Math.PI * 0.11;
const ARM_PITCH_RADIANS = (MILKY_WAY_ARM_PITCH_DEGREES * Math.PI) / 180;
const ADAPTED_VISUAL_ARM_PHASE_RADIANS = 0.44;
const ADAPTED_VISUAL_PITCH_RADIANS = (MILKY_WAY_ADAPTED_VISUAL_PITCH_DEGREES * Math.PI) / 180;
const ADAPTED_VISUAL_REFERENCE_RADIUS = MILKY_WAY_ADAPTED_VISUAL_RADIUS * 0.22;
const ILLUSTRATIVE_ARM_PHASE_OFFSETS = [0, 0.17, -0.11, 0.29] as const;
const ILLUSTRATIVE_ARM_PITCH_OFFSETS_DEGREES = [0, -2.5, 1.5, -1] as const;
const LOCAL_SPUR_PITCH_RADIANS = (MILKY_WAY_LOCAL_SPUR_PITCH_DEGREES * Math.PI) / 180;

export function calculateGalactocentricSpiralAngle(radius: number, armIndex: number): number {
  const armSeparation = (armIndex * Math.PI * 2) / MILKY_WAY_ARM_COUNT;
  const winding = Math.log(radius / MILKY_WAY_ARM_REFERENCE_RADIUS) / Math.tan(ARM_PITCH_RADIANS);

  return ARM_PHASE_RADIANS + armSeparation + winding;
}

export function calculateAdaptedMilkyWayVisualAngle(radius: number, armIndex: number): number {
  const armSeparation = (armIndex * Math.PI * 2) / MILKY_WAY_ARM_COUNT;
  const winding =
    Math.log(
      Math.max(radius, MILKY_WAY_ADAPTED_VISUAL_RADIUS * 0.08) / ADAPTED_VISUAL_REFERENCE_RADIUS,
    ) / Math.tan(ADAPTED_VISUAL_PITCH_RADIANS);

  return ADAPTED_VISUAL_ARM_PHASE_RADIANS + armSeparation + winding;
}

/**
 * Breaks the perfect rotational symmetry of the readable four-arm guide. This is deliberately
 * illustrative: the canonical logarithmic model above remains untouched, while the rendered
 * density avoids looking like four copies of one geometric curve.
 */
export function calculateIllustrativeMilkyWayArmAngle(radius: number, armIndex: number): number {
  const normalizedArmIndex =
    ((Math.trunc(armIndex) % MILKY_WAY_ARM_COUNT) + MILKY_WAY_ARM_COUNT) % MILKY_WAY_ARM_COUNT;
  const armSeparation = (normalizedArmIndex * Math.PI * 2) / MILKY_WAY_ARM_COUNT;
  const pitchDegrees =
    MILKY_WAY_ADAPTED_VISUAL_PITCH_DEGREES +
    ILLUSTRATIVE_ARM_PITCH_OFFSETS_DEGREES[normalizedArmIndex]!;
  const pitchRadians = (pitchDegrees * Math.PI) / 180;
  const winding =
    Math.log(
      Math.max(radius, MILKY_WAY_ADAPTED_VISUAL_RADIUS * 0.08) / ADAPTED_VISUAL_REFERENCE_RADIUS,
    ) / Math.tan(pitchRadians);

  return (
    ADAPTED_VISUAL_ARM_PHASE_RADIANS +
    armSeparation +
    ILLUSTRATIVE_ARM_PHASE_OFFSETS[normalizedArmIndex]! +
    winding
  );
}

/**
 * Short visual branch anchored on the Solar position. This is an explicitly illustrative bridge,
 * not a claim that the Orion Spur follows one exact logarithmic curve.
 */
export function calculateAdaptedMilkyWayLocalSpurAngle(radius: number): number {
  return (
    Math.log(
      Math.max(radius, MILKY_WAY_LOCAL_SPUR_REFERENCE_RADIUS * 0.58) /
        MILKY_WAY_LOCAL_SPUR_REFERENCE_RADIUS,
    ) / Math.tan(LOCAL_SPUR_PITCH_RADIANS)
  );
}
