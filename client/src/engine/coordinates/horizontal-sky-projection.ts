export interface HorizontalSkyProjection {
  readonly x: number;
  readonly y: number;
  readonly radialDistance: number;
  readonly isAboveHorizon: boolean;
  readonly clampedToHorizon: boolean;
}

export function projectHorizontalSky(
  altitudeDegrees: number,
  azimuthDegrees: number,
): HorizontalSkyProjection {
  assertHorizontalCoordinates(altitudeDegrees, azimuthDegrees);

  const clampedToHorizon = altitudeDegrees < 0;
  const visibleAltitudeDegrees = Math.max(0, altitudeDegrees);
  const radialDistance = (90 - visibleAltitudeDegrees) / 90;

  if (radialDistance === 0) {
    return {
      x: 0,
      y: 0,
      radialDistance,
      isAboveHorizon: true,
      clampedToHorizon: false,
    };
  }
  const azimuthRadians = (azimuthDegrees * Math.PI) / 180;

  return {
    x: Math.sin(azimuthRadians) * radialDistance,
    y: -Math.cos(azimuthRadians) * radialDistance,
    radialDistance,
    isAboveHorizon: !clampedToHorizon,
    clampedToHorizon,
  };
}

function assertHorizontalCoordinates(altitudeDegrees: number, azimuthDegrees: number): void {
  if (!Number.isFinite(altitudeDegrees) || altitudeDegrees < -90 || altitudeDegrees > 90) {
    throw new RangeError('Altitude horizontale invalide : valeur attendue entre −90° et 90°.');
  }
  if (!Number.isFinite(azimuthDegrees) || azimuthDegrees < 0 || azimuthDegrees >= 360) {
    throw new RangeError('Azimut horizontal invalide : valeur attendue entre 0° et 360°.');
  }
}
