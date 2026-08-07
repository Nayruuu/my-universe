import * as THREE from 'three';
import type { UniverseTime, Vector3Like } from '../../data/models/universe.models';

const POLAR_EPSILON_RADIANS = 0.02;
const MINIMUM_ALTITUDE_RADIANS = -Math.PI / 2 + POLAR_EPSILON_RADIANS;
const MAXIMUM_ALTITUDE_RADIANS = Math.PI / 2 - POLAR_EPSILON_RADIANS;

export interface EarthObserverPitchLimits {
  readonly minimumPitchOffsetDegrees: number;
  readonly maximumPitchOffsetDegrees: number;
}

export interface EarthObserverFraming {
  readonly initialPitchOffsetDegrees: number;
  readonly pitchLimits: EarthObserverPitchLimits;
  readonly zenithDirection?: Vector3Like;
  readonly northDirection?: Vector3Like;
  readonly resolveReferenceFrame?: EarthObserverReferenceFrameProvider;
}

export interface EarthObserverReferenceFrame {
  readonly northDirection: Vector3Like;
  readonly zenithDirection: Vector3Like;
}

export type EarthObserverReferenceFrameProvider = (
  time: UniverseTime,
) => EarthObserverReferenceFrame | null;

export const DEFAULT_EARTH_OBSERVER_PITCH_LIMITS: EarthObserverPitchLimits = {
  minimumPitchOffsetDegrees: -180,
  maximumPitchOffsetDegrees: 180,
};

export const DEFAULT_EARTH_OBSERVER_FRAMING: EarthObserverFraming = {
  initialPitchOffsetDegrees: 0,
  pitchLimits: DEFAULT_EARTH_OBSERVER_PITCH_LIMITS,
};

export class EarthObserverOrientation {
  private readonly direction = new THREE.Vector3();
  private readonly horizonDirection = new THREE.Vector3();
  private readonly horizonRight = new THREE.Vector3();
  private readonly zenith = new THREE.Vector3();
  private readonly lookAtMatrix = new THREE.Matrix4();
  private readonly origin = new THREE.Vector3();
  private targetAltitudeRadians = 0;
  private targetAzimuthRadians = 0;
  private pitchOffsetRadians = 0;
  private azimuthOffsetRadians = 0;
  private minimumPitchOffsetRadians = 0;
  private maximumPitchOffsetRadians = 0;

  public configure(
    targetDirection: THREE.Vector3,
    fallbackUp: THREE.Vector3,
    framing: EarthObserverFraming = DEFAULT_EARTH_OBSERVER_FRAMING,
  ): void {
    this.direction.copy(targetDirection).normalize();
    this.resolveZenith(framing.zenithDirection, fallbackUp);
    const verticalProjection = THREE.MathUtils.clamp(this.direction.dot(this.zenith), -1, 1);

    this.targetAltitudeRadians = Math.asin(verticalProjection);
    this.resolveHorizonDirection(framing.northDirection, fallbackUp, verticalProjection);
    this.horizonRight.crossVectors(this.horizonDirection, this.zenith).normalize();
    const projectedTarget = this.direction.clone().projectOnPlane(this.zenith);

    this.targetAzimuthRadians =
      projectedTarget.lengthSq() < Number.EPSILON
        ? 0
        : Math.atan2(
            projectedTarget.dot(this.horizonRight),
            projectedTarget.dot(this.horizonDirection),
          );
    this.minimumPitchOffsetRadians = Math.max(
      THREE.MathUtils.degToRad(framing.pitchLimits.minimumPitchOffsetDegrees),
      MINIMUM_ALTITUDE_RADIANS - this.targetAltitudeRadians,
    );
    this.maximumPitchOffsetRadians = Math.min(
      THREE.MathUtils.degToRad(framing.pitchLimits.maximumPitchOffsetDegrees),
      MAXIMUM_ALTITUDE_RADIANS - this.targetAltitudeRadians,
    );
    this.pitchOffsetRadians = THREE.MathUtils.clamp(
      THREE.MathUtils.degToRad(framing.initialPitchOffsetDegrees),
      this.minimumPitchOffsetRadians,
      this.maximumPitchOffsetRadians,
    );
    this.azimuthOffsetRadians = 0;
    this.updateDirection();
  }

  public updateReferenceFrame(frame: EarthObserverReferenceFrame): boolean {
    if (!isFiniteDirection(frame.zenithDirection) || !isFiniteDirection(frame.northDirection)) {
      return false;
    }
    this.zenith
      .set(frame.zenithDirection.x, frame.zenithDirection.y, frame.zenithDirection.z)
      .normalize();
    this.horizonDirection
      .set(frame.northDirection.x, frame.northDirection.y, frame.northDirection.z)
      .projectOnPlane(this.zenith);
    if (this.horizonDirection.lengthSq() < Number.EPSILON) {
      return false;
    }
    this.horizonDirection.normalize();
    this.horizonRight.crossVectors(this.horizonDirection, this.zenith).normalize();
    this.updateDirection();

    return true;
  }

  public rotate(azimuthDeltaRadians: number, pitchDeltaRadians: number): void {
    this.azimuthOffsetRadians += azimuthDeltaRadians;
    this.pitchOffsetRadians = THREE.MathUtils.clamp(
      this.pitchOffsetRadians + pitchDeltaRadians,
      this.minimumPitchOffsetRadians,
      this.maximumPitchOffsetRadians,
    );
    this.updateDirection();
  }

  public copyDirection(target: THREE.Vector3): THREE.Vector3 {
    return target.copy(this.direction);
  }

  public copyZenith(target: THREE.Vector3): THREE.Vector3 {
    return target.copy(this.zenith);
  }

  public copyQuaternion(target: THREE.Quaternion): THREE.Quaternion {
    this.lookAtMatrix.lookAt(this.origin, this.direction, this.zenith);

    return target.setFromRotationMatrix(this.lookAtMatrix);
  }

  public get pitchOffsetDegrees(): number {
    return THREE.MathUtils.radToDeg(this.pitchOffsetRadians);
  }

  public get azimuthOffsetDegrees(): number {
    return THREE.MathUtils.radToDeg(this.azimuthOffsetRadians);
  }

  public get centerAltitudeDegrees(): number {
    return THREE.MathUtils.radToDeg(this.targetAltitudeRadians + this.pitchOffsetRadians);
  }

  public get centerAzimuthDegrees(): number {
    return normalizeDegrees(
      THREE.MathUtils.radToDeg(this.targetAzimuthRadians + this.azimuthOffsetRadians),
    );
  }

  private resolveZenith(zenithDirection: Vector3Like | undefined, fallbackUp: THREE.Vector3): void {
    if (zenithDirection && isFiniteDirection(zenithDirection)) {
      this.zenith.set(zenithDirection.x, zenithDirection.y, zenithDirection.z).normalize();

      return;
    }
    this.zenith.copy(fallbackUp).projectOnPlane(this.direction);
    if (this.zenith.lengthSq() < Number.EPSILON) {
      this.zenith
        .set(Math.abs(this.direction.y) < 0.9 ? 0 : 1, Math.abs(this.direction.y) < 0.9 ? 1 : 0, 0)
        .projectOnPlane(this.direction);
    }
    this.zenith.normalize();
  }

  private resolveHorizonDirection(
    northDirection: Vector3Like | undefined,
    fallbackUp: THREE.Vector3,
    verticalProjection: number,
  ): void {
    if (northDirection && isFiniteDirection(northDirection)) {
      this.horizonDirection
        .set(northDirection.x, northDirection.y, northDirection.z)
        .projectOnPlane(this.zenith);
    } else {
      this.horizonDirection.copy(this.direction).addScaledVector(this.zenith, -verticalProjection);
    }
    if (this.horizonDirection.lengthSq() < Number.EPSILON) {
      this.horizonDirection.copy(fallbackUp).projectOnPlane(this.zenith);
      if (this.horizonDirection.lengthSq() < Number.EPSILON) {
        this.horizonDirection
          .set(Math.abs(this.zenith.y) < 0.9 ? 0 : 1, Math.abs(this.zenith.y) < 0.9 ? 1 : 0, 0)
          .projectOnPlane(this.zenith);
      }
    }
    this.horizonDirection.normalize();
  }

  private updateDirection(): void {
    const altitudeRadians = this.targetAltitudeRadians + this.pitchOffsetRadians;
    const azimuthRadians = this.targetAzimuthRadians + this.azimuthOffsetRadians;
    const horizontalScale = Math.cos(altitudeRadians);

    this.direction
      .copy(this.horizonDirection)
      .multiplyScalar(Math.cos(azimuthRadians) * horizontalScale)
      .addScaledVector(this.horizonRight, Math.sin(azimuthRadians) * horizontalScale)
      .addScaledVector(this.zenith, Math.sin(altitudeRadians))
      .normalize();
  }
}

function isFiniteDirection(direction: Vector3Like): boolean {
  return (
    Number.isFinite(direction.x) &&
    Number.isFinite(direction.y) &&
    Number.isFinite(direction.z) &&
    Math.hypot(direction.x, direction.y, direction.z) > Number.EPSILON
  );
}

function normalizeDegrees(value: number): number {
  return ((value % 360) + 360) % 360;
}
