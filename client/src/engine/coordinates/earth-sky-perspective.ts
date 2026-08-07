export interface EarthSkyPerspective {
  readonly centerAltitudeDegrees: number;
  readonly centerAzimuthDegrees: number;
  readonly verticalFieldOfViewDegrees: number;
  readonly width: number;
  readonly height: number;
}

export interface EarthSkyScreenPoint {
  readonly x: number;
  readonly y: number;
  readonly depth: number;
}

export type EarthSkyProjector = (
  altitudeDegrees: number,
  azimuthDegrees: number,
) => EarthSkyScreenPoint | null;

/**
 * Projects local horizontal coordinates with a pinhole/gnomonic camera. Azimuth follows the
 * astronomical convention used by Astronomy Engine: north is 0 degrees and east is 90 degrees.
 */
export function createEarthSkyProjector(perspective: EarthSkyPerspective): EarthSkyProjector {
  assertPerspective(perspective);
  const centerAltitude = degreesToRadians(perspective.centerAltitudeDegrees);
  const centerAzimuth = degreesToRadians(perspective.centerAzimuthDegrees);
  const forward = horizontalUnitVector(centerAltitude, centerAzimuth);
  const right = {
    x: Math.cos(centerAzimuth),
    y: 0,
    z: -Math.sin(centerAzimuth),
  };
  const up = cross(forward, right);
  const verticalTangent = Math.tan(degreesToRadians(perspective.verticalFieldOfViewDegrees) / 2);
  const horizontalTangent = verticalTangent * (perspective.width / perspective.height);

  return (altitudeDegrees, azimuthDegrees) => {
    assertHorizontalCoordinates(altitudeDegrees, azimuthDegrees);
    const direction = horizontalUnitVector(
      degreesToRadians(altitudeDegrees),
      degreesToRadians(azimuthDegrees),
    );
    const depth = dot(direction, forward);

    if (depth <= 0) {
      return null;
    }
    const normalizedX = dot(direction, right) / (depth * horizontalTangent);
    const normalizedY = dot(direction, up) / (depth * verticalTangent);

    if (Math.abs(normalizedX) > 1 || Math.abs(normalizedY) > 1) {
      return null;
    }

    return {
      x: ((normalizedX + 1) * perspective.width) / 2,
      y: ((1 - normalizedY) * perspective.height) / 2,
      depth,
    };
  };
}

interface UnitVector {
  readonly x: number;
  readonly y: number;
  readonly z: number;
}

function horizontalUnitVector(altitudeRadians: number, azimuthRadians: number): UnitVector {
  const horizontalProjection = Math.cos(altitudeRadians);

  return {
    x: horizontalProjection * Math.sin(azimuthRadians),
    y: Math.sin(altitudeRadians),
    z: horizontalProjection * Math.cos(azimuthRadians),
  };
}

function cross(left: UnitVector, right: UnitVector): UnitVector {
  return {
    x: left.y * right.z - left.z * right.y,
    y: left.z * right.x - left.x * right.z,
    z: left.x * right.y - left.y * right.x,
  };
}

function dot(left: UnitVector, right: UnitVector): number {
  return left.x * right.x + left.y * right.y + left.z * right.z;
}

function assertPerspective(perspective: EarthSkyPerspective): void {
  assertHorizontalCoordinates(perspective.centerAltitudeDegrees, perspective.centerAzimuthDegrees);
  if (
    !Number.isFinite(perspective.verticalFieldOfViewDegrees) ||
    perspective.verticalFieldOfViewDegrees <= 0 ||
    perspective.verticalFieldOfViewDegrees >= 180
  ) {
    throw new RangeError('Champ de vision vertical invalide.');
  }
  if (!Number.isFinite(perspective.width) || perspective.width <= 0) {
    throw new RangeError('Largeur de projection invalide.');
  }
  if (!Number.isFinite(perspective.height) || perspective.height <= 0) {
    throw new RangeError('Hauteur de projection invalide.');
  }
}

function assertHorizontalCoordinates(altitudeDegrees: number, azimuthDegrees: number): void {
  if (!Number.isFinite(altitudeDegrees) || altitudeDegrees < -90 || altitudeDegrees > 90) {
    throw new RangeError('Altitude horizontale invalide.');
  }
  if (!Number.isFinite(azimuthDegrees) || azimuthDegrees < 0 || azimuthDegrees >= 360) {
    throw new RangeError('Azimut horizontal invalide.');
  }
}

function degreesToRadians(value: number): number {
  return (value * Math.PI) / 180;
}
