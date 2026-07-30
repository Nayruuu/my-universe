export const MILKY_WAY_ARM_COUNT = 4;
export const MILKY_WAY_ARM_PITCH_DEGREES = 13;
export const MILKY_WAY_ARM_REFERENCE_RADIUS = 1_250;

const ARM_PHASE_RADIANS = Math.PI * 0.11;
const ARM_PITCH_RADIANS = (MILKY_WAY_ARM_PITCH_DEGREES * Math.PI) / 180;

export function calculateGalactocentricSpiralAngle(radius: number, armIndex: number): number {
  const armSeparation = (armIndex * Math.PI * 2) / MILKY_WAY_ARM_COUNT;
  const winding = Math.log(radius / MILKY_WAY_ARM_REFERENCE_RADIUS) / Math.tan(ARM_PITCH_RADIANS);

  return ARM_PHASE_RADIANS + armSeparation + winding;
}
