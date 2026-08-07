import * as THREE from 'three';
import type { ZoomDebugStats } from '../../data/models/universe.models';
import { SemanticZoomJourney } from './semantic-zoom';

export type CameraZoomDiagnostics = Omit<ZoomDebugStats, 'anchorType' | 'anchorObjectId'>;

export interface CameraZoomControls {
  readonly target: THREE.Vector3;
  minDistance: number;
  maxDistance: number;
  update(): void;
}

export class CameraZoomController {
  private readonly anchor = new THREE.Vector3();
  private readonly rayDirection = new THREE.Vector3();
  private readonly cameraDirection = new THREE.Vector3();
  private readonly targetOffset = new THREE.Vector3();
  private readonly semanticJourney = new SemanticZoomJourney();
  private lastDiagnostics: CameraZoomDiagnostics | null = null;
  private anchorActive = false;

  constructor(
    private readonly camera: THREE.PerspectiveCamera,
    private readonly controls: CameraZoomControls,
    private readonly onSettled: (distance: number) => void,
  ) {}

  public get active(): boolean {
    return this.anchorActive;
  }

  public get semanticActive(): boolean {
    return this.semanticJourney.active;
  }

  public get diagnostics(): CameraZoomDiagnostics | null {
    return this.lastDiagnostics;
  }

  public get distanceToTarget(): number {
    return this.camera.position.distanceTo(this.controls.target);
  }

  public reset(): void {
    this.semanticJourney.reset();
    this.anchorActive = false;
  }

  public resetJourney(): void {
    this.semanticJourney.reset();
  }

  public cancelAnchor(): void {
    this.anchorActive = false;
  }

  public adoptAnchor(position: THREE.Vector3): void {
    this.anchor.copy(position);
    this.anchorActive = true;
  }

  public adoptPointer(x: number, y: number): void {
    this.camera.updateMatrixWorld();
    this.rayDirection.set(x, y, 0.5).unproject(this.camera).sub(this.camera.position).normalize();
    this.camera.getWorldDirection(this.cameraDirection);
    const targetDepth = this.cameraDirection.dot(
      this.targetOffset.copy(this.controls.target).sub(this.camera.position),
    );
    const rayDepth = Math.max(this.rayDirection.dot(this.cameraDirection), Number.EPSILON);

    this.anchor
      .copy(this.camera.position)
      .addScaledVector(this.rayDirection, targetDepth / rayDepth);
    this.anchorActive = true;
  }

  public retargetAnchor(position: THREE.Vector3): boolean {
    if (!this.anchorActive) {
      return false;
    }
    this.anchor.copy(position);

    return true;
  }

  public update(deltaSeconds: number, blockedByTransition: boolean): void {
    if (!this.anchorActive || blockedByTransition) {
      return;
    }
    const remainingDistance = this.controls.target.distanceTo(this.anchor);
    const blend = 1 - Math.exp(-7 * deltaSeconds);

    this.controls.target.lerp(this.anchor, blend);
    if (remainingDistance < Math.max(0.015, this.distanceToTarget * 0.000_15)) {
      this.controls.target.copy(this.anchor);
      this.anchorActive = false;
      this.onSettled(this.distanceToTarget);
    }
  }

  public zoomBy(factor: number): void {
    this.setDistance(this.distanceToTarget * factor);
  }

  public zoomSemantically(deltaY: number): void {
    const step = this.semanticJourney.step(this.distanceToTarget, deltaY);

    if (step.handled) {
      this.applyDistance(deltaY, step.distance);

      return;
    }
    if (!Number.isFinite(deltaY) || deltaY === 0) {
      this.anchorActive = false;
      this.recordIgnored(deltaY);

      return;
    }
    this.applyDistance(deltaY, this.distanceToTarget * Math.exp(deltaY * 0.0015));
  }

  private setDistance(distance: number): void {
    const currentDistance = Math.max(this.distanceToTarget, Number.EPSILON);
    const targetDistance = THREE.MathUtils.clamp(
      distance,
      this.controls.minDistance,
      this.controls.maxDistance,
    );

    if (this.anchorActive) {
      const factor = targetDistance / currentDistance;

      this.camera.position.sub(this.anchor).multiplyScalar(factor).add(this.anchor);
      this.controls.target.sub(this.anchor).multiplyScalar(factor).add(this.anchor);
      this.anchorActive = false;
    } else {
      this.targetOffset
        .copy(this.camera.position)
        .sub(this.controls.target)
        .setLength(targetDistance);
      this.camera.position.copy(this.controls.target).add(this.targetOffset);
    }
    this.controls.update();
    this.onSettled(this.distanceToTarget);
  }

  private applyDistance(deltaY: number, requestedDistance: number): void {
    const beforeDistance = this.distanceToTarget;
    const minimumDistance = this.controls.minDistance;
    const maximumDistance = this.controls.maxDistance;

    this.setDistance(requestedDistance);
    const appliedDistance = this.distanceToTarget;
    const tolerance = Math.max(Number.EPSILON, beforeDistance * 1e-12);
    const status =
      requestedDistance < minimumDistance
        ? 'minimum'
        : requestedDistance > maximumDistance
          ? 'maximum'
          : Math.abs(appliedDistance - beforeDistance) <= tolerance
            ? 'unchanged'
            : 'applied';

    this.lastDiagnostics = {
      deltaY,
      beforeDistance,
      requestedDistance,
      appliedDistance,
      minimumDistance,
      maximumDistance,
      status,
    };
  }

  private recordIgnored(deltaY: number): void {
    const distance = this.distanceToTarget;

    this.lastDiagnostics = {
      deltaY,
      beforeDistance: distance,
      requestedDistance: distance,
      appliedDistance: distance,
      minimumDistance: this.controls.minDistance,
      maximumDistance: this.controls.maxDistance,
      status: 'ignored',
    };
  }
}
