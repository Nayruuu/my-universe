import * as THREE from 'three';
import type { ZoomDebugStats } from '../../data/models/universe.models';
import { MinimumDistanceTraversal, type MinimumTraversalUndo } from './minimum-distance-traversal';
import {
  getFreeTravelDistance,
  getLocalNavigationDistanceTolerance,
  isAtMinimumNavigationDistance,
} from './navigation-policy';
import { SemanticZoomJourney } from './semantic-zoom';
import { LOG_DISTANCE_PER_WHEEL_PIXEL, zoomScaleFromWheelDelta } from './zoom-physics';

export type CameraZoomDiagnostics = Omit<ZoomDebugStats, 'anchorType' | 'anchorObjectId'>;

export interface CameraZoomControls {
  readonly target: THREE.Vector3;
  minDistance: number;
  maxDistance: number;
  update(): void;
}

export interface CameraZoomOptions {
  readonly allowMinimumTraversal?: boolean;
  readonly logarithmicRateMultiplier?: number;
  readonly traverseMinimum?: boolean;
}

interface InwardZoomSegment {
  readonly anchor: THREE.Vector3;
  readonly logarithmicRateMultiplier: number;
  logarithmicAmount: number;
}

// The wheel normalizer can differ by a fraction of a pixel between two otherwise
// symmetrical bursts because their browser timestamps are sampled independently.
const INWARD_LOGARITHMIC_TOLERANCE = LOG_DISTANCE_PER_WHEEL_PIXEL * 0.25;

export class CameraZoomController {
  private readonly anchor = new THREE.Vector3();
  private readonly rayDirection = new THREE.Vector3();
  private readonly cameraDirection = new THREE.Vector3();
  private readonly targetOffset = new THREE.Vector3();
  private readonly viewOffset = new THREE.Vector3();
  private readonly semanticJourney = new SemanticZoomJourney();
  private readonly minimumTraversal = new MinimumDistanceTraversal();
  private lastDiagnostics: CameraZoomDiagnostics | null = null;
  private anchorActive = false;
  private inwardLogarithmicAmount = 0;
  private readonly inwardZoomSegments: InwardZoomSegment[] = [];

  constructor(
    private readonly camera: THREE.PerspectiveCamera,
    private readonly controls: CameraZoomControls,
    private readonly onSettled: (distance: number) => void,
    private readonly canSynchronizeControlsImmediately: () => boolean = () => true,
  ) {}

  public get active(): boolean {
    return this.anchorActive;
  }

  public get semanticActive(): boolean {
    return this.semanticJourney.active;
  }

  public get inwardZoomActive(): boolean {
    return this.inwardLogarithmicAmount > INWARD_LOGARITHMIC_TOLERANCE;
  }

  public get minimumTraversalActive(): boolean {
    return this.minimumTraversal.active;
  }

  public get diagnostics(): CameraZoomDiagnostics | null {
    return this.lastDiagnostics;
  }

  public get distanceToTarget(): number {
    return this.camera.position.distanceTo(this.controls.target);
  }

  public reset(): void {
    this.semanticJourney.reset();
    this.minimumTraversal.clear();
    this.clearInwardZoom();
    this.anchorActive = false;
  }

  public resetJourney(): void {
    this.semanticJourney.reset();
    this.minimumTraversal.clear();
    this.clearInwardZoom();
  }

  public cancelAnchor(): void {
    this.anchorActive = false;
  }

  public cancelMinimumTraversal(): void {
    this.minimumTraversal.clear();
  }

  public cancelInwardZoom(): void {
    this.clearInwardZoom();
  }

  public adoptAnchor(position: THREE.Vector3): void {
    this.anchor.copy(position);
    this.anchorActive = true;
  }

  public shiftOrigin(originShift: THREE.Vector3): void {
    if (this.anchorActive) {
      this.anchor.sub(originShift);
    }
    for (const segment of this.inwardZoomSegments) {
      segment.anchor.sub(originShift);
    }
    if (this.minimumTraversal.active) {
      // At large absolute coordinates the represented separation can differ from the logical
      // floor by a few local ULPs. Once floating origin restores full local precision, project
      // that same view direction back onto the exact floor instead of carrying the old error.
      this.viewOffset
        .copy(this.camera.position)
        .sub(this.controls.target)
        .setLength(this.controls.minDistance);
      this.camera.position.copy(this.controls.target).add(this.viewOffset);
    }
  }

  public adoptPointer(x: number, y: number): void {
    this.camera.updateMatrixWorld();
    this.rayDirection.set(x, y, 0.5).unproject(this.camera).sub(this.camera.position).normalize();
    this.camera.getWorldDirection(this.cameraDirection);
    const projectedTargetDepth = this.cameraDirection.dot(
      this.targetOffset.copy(this.controls.target).sub(this.camera.position),
    );
    const referenceDistance = Math.max(this.distanceToTarget, this.controls.minDistance);
    // A free camera can keep a stale orbit pivot beside or behind its view direction.
    const targetDepth =
      Number.isFinite(projectedTargetDepth) && projectedTargetDepth >= referenceDistance * 0.25
        ? projectedTargetDepth
        : referenceDistance;
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

  public zoomBy(factor: number, options?: CameraZoomOptions): void {
    if (Number.isFinite(factor) && factor > 1 && this.minimumTraversal.active) {
      const logarithmicAmount = Math.log(factor);
      const { remainingLogarithmicAmount } = this.unwindMinimumTraversal(logarithmicAmount);
      const logarithmicTolerance = Math.max(Number.EPSILON, logarithmicAmount * 1e-12);

      if (remainingLogarithmicAmount <= logarithmicTolerance) {
        return;
      }
      factor = Math.exp(remainingLogarithmicAmount);
    }
    this.setDistance(
      this.distanceToTarget * factor,
      options?.traverseMinimum === true && options.allowMinimumTraversal !== false,
    );
  }

  public zoomSemantically(deltaY: number, options?: CameraZoomOptions): void {
    if (!Number.isFinite(deltaY) || deltaY === 0) {
      this.anchorActive = false;
      this.recordIgnored(deltaY);

      return;
    }
    const traverseMinimum = options?.traverseMinimum === true;
    const allowMinimumTraversal = traverseMinimum && options?.allowMinimumTraversal !== false;
    const logarithmicRateMultiplier = options?.logarithmicRateMultiplier ?? 1;
    const beforeDistance = this.distanceToTarget;
    const requestedAnchor = this.anchorActive ? this.anchor.clone() : null;
    let remainingDeltaY = deltaY;
    let requestedDistance = beforeDistance;

    if (remainingDeltaY > 0 && this.minimumTraversal.active) {
      const availableLogarithmicAmount =
        remainingDeltaY * LOG_DISTANCE_PER_WHEEL_PIXEL * logarithmicRateMultiplier;
      const logarithmicTolerance = Math.max(Number.EPSILON, availableLogarithmicAmount * 1e-12);
      const undo = this.unwindMinimumTraversal(availableLogarithmicAmount);
      const remainingLogarithmicAmount = undo.remainingLogarithmicAmount;

      requestedDistance = this.distanceToTarget;
      if (remainingLogarithmicAmount <= logarithmicTolerance) {
        this.recordDistanceOutcome(deltaY, beforeDistance, requestedDistance, true);

        return;
      }
      if (requestedAnchor) {
        this.adoptAnchor(requestedAnchor.sub(undo.translation));
      } else {
        this.anchorActive = false;
      }
      remainingDeltaY =
        remainingLogarithmicAmount / (LOG_DISTANCE_PER_WHEEL_PIXEL * logarithmicRateMultiplier);
    }

    if (remainingDeltaY > 0 && this.inwardZoomActive) {
      const availableDeltaY = remainingDeltaY;
      const deltaYTolerance = Math.max(Number.EPSILON, availableDeltaY * 1e-12);

      remainingDeltaY = this.unwindInwardZoom(availableDeltaY);
      requestedDistance = this.distanceToTarget;

      if (remainingDeltaY <= deltaYTolerance) {
        this.recordDistanceOutcome(deltaY, beforeDistance, requestedDistance, false);

        return;
      }
      if (requestedAnchor) {
        this.adoptAnchor(requestedAnchor);
      } else {
        this.anchorActive = false;
      }
    }
    const step = this.semanticJourney.step(requestedDistance, remainingDeltaY);

    if (step.handled) {
      const remainingSemanticDeltaY = step.remainingDeltaY ?? 0;
      const semanticDistance =
        remainingSemanticDeltaY === 0
          ? step.distance
          : step.distance *
            zoomScaleFromWheelDelta(remainingSemanticDeltaY * logarithmicRateMultiplier);

      const inwardAnchor = this.resolveZoomPivot();

      this.applyDistance(deltaY, semanticDistance, allowMinimumTraversal);
      if (
        !traverseMinimum &&
        remainingSemanticDeltaY < 0 &&
        this.distanceToTarget < step.distance
      ) {
        this.recordInwardZoom(
          inwardAnchor,
          Math.log(step.distance / this.distanceToTarget),
          logarithmicRateMultiplier,
        );
      }

      return;
    }
    const inwardAnchor = this.resolveZoomPivot();

    this.applyDistance(
      deltaY,
      requestedDistance * zoomScaleFromWheelDelta(remainingDeltaY * logarithmicRateMultiplier),
      allowMinimumTraversal,
    );
    if (!traverseMinimum && deltaY < 0 && this.distanceToTarget < beforeDistance) {
      this.recordInwardZoom(
        inwardAnchor,
        Math.log(beforeDistance / this.distanceToTarget),
        logarithmicRateMultiplier,
      );
    }
  }

  private resolveZoomPivot(): THREE.Vector3 {
    return (this.anchorActive ? this.anchor : this.controls.target).clone();
  }

  private recordInwardZoom(
    anchor: THREE.Vector3,
    logarithmicAmount: number,
    logarithmicRateMultiplier: number,
  ): void {
    if (logarithmicAmount <= INWARD_LOGARITHMIC_TOLERANCE) {
      return;
    }
    this.inwardZoomSegments.push({ anchor, logarithmicAmount, logarithmicRateMultiplier });
    this.inwardLogarithmicAmount += logarithmicAmount;
  }

  private unwindInwardZoom(availableDeltaY: number): number {
    const deltaYTolerance = Math.max(Number.EPSILON, availableDeltaY * 1e-12);
    let remainingDeltaY = availableDeltaY;
    let consumedLogarithmicAmount = 0;

    while (remainingDeltaY > deltaYTolerance && this.inwardZoomSegments.length > 0) {
      const segment = this.inwardZoomSegments.at(-1)!;
      const segmentDeltaY =
        segment.logarithmicAmount /
        (LOG_DISTANCE_PER_WHEEL_PIXEL * segment.logarithmicRateMultiplier);
      const consumedDeltaY = Math.min(remainingDeltaY, segmentDeltaY);
      const segmentAmount = Math.min(
        segment.logarithmicAmount,
        consumedDeltaY * LOG_DISTANCE_PER_WHEEL_PIXEL * segment.logarithmicRateMultiplier,
      );

      this.adoptAnchor(segment.anchor);
      this.setDistance(this.distanceToTarget * Math.exp(segmentAmount));
      segment.logarithmicAmount -= segmentAmount;
      remainingDeltaY -= consumedDeltaY;
      consumedLogarithmicAmount += segmentAmount;
      if (segmentDeltaY <= consumedDeltaY + deltaYTolerance) {
        this.inwardZoomSegments.pop();
      }
    }
    this.inwardLogarithmicAmount -= consumedLogarithmicAmount;
    if (
      this.inwardLogarithmicAmount <= INWARD_LOGARITHMIC_TOLERANCE ||
      this.inwardZoomSegments.length === 0
    ) {
      this.clearInwardZoom();
    }

    return remainingDeltaY;
  }

  private clearInwardZoom(): void {
    this.inwardLogarithmicAmount = 0;
    this.inwardZoomSegments.length = 0;
  }

  private setDistance(distance: number, traverseMinimum = false): boolean {
    const currentDistance = Math.max(this.distanceToTarget, Number.EPSILON);
    const targetDistance = THREE.MathUtils.clamp(
      distance,
      this.controls.minDistance,
      this.controls.maxDistance,
    );

    if (traverseMinimum && distance > 0 && distance < this.controls.minDistance) {
      const startsAtMinimum = isAtMinimumNavigationDistance(
        currentDistance,
        this.controls.minDistance,
        getLocalNavigationDistanceTolerance(this.camera.position, this.controls.target),
      );

      if (!startsAtMinimum) {
        const factorToMinimum = this.controls.minDistance / currentDistance;

        if (this.anchorActive) {
          this.viewOffset
            .copy(this.controls.target)
            .sub(this.camera.position)
            .multiplyScalar(factorToMinimum);
          this.camera.position.sub(this.anchor).multiplyScalar(factorToMinimum).add(this.anchor);
          this.controls.target.copy(this.camera.position).add(this.viewOffset);
        } else {
          this.targetOffset
            .copy(this.camera.position)
            .sub(this.controls.target)
            .setLength(this.controls.minDistance);
          this.camera.position.copy(this.controls.target).add(this.targetOffset);
        }
      }
      const traversalStartDistance = startsAtMinimum ? currentDistance : this.controls.minDistance;
      const requestedFactor = THREE.MathUtils.clamp(distance / traversalStartDistance, 0, 1);
      const logarithmicAmount = -Math.log(requestedFactor);
      const travelDistance = getFreeTravelDistance(
        this.controls.minDistance,
        this.minimumTraversal.logarithmicAmount,
        logarithmicAmount,
      );

      if (this.anchorActive) {
        this.targetOffset.copy(this.anchor).sub(this.camera.position);
      } else {
        this.camera.getWorldDirection(this.targetOffset);
      }
      // Once magnification reaches its contextual floor, switch to bounded, progressively faster
      // free travel. The policy integrates speed over the accumulated logarithmic input, keeping
      // the result composable and independent of how a browser batches an identical gesture.
      this.targetOffset.setLength(travelDistance);
      this.semanticJourney.reset();
      this.minimumTraversal.record(this.targetOffset, logarithmicAmount);
      this.viewOffset.copy(this.controls.target).sub(this.camera.position);
      this.camera.position.add(this.targetOffset);
      this.controls.target.copy(this.camera.position).add(this.viewOffset);
      this.anchorActive = false;
      this.synchronizeControlsImmediately();
      this.onSettled(this.distanceToTarget);

      return this.targetOffset.lengthSq() > Number.EPSILON;
    }

    if (this.anchorActive) {
      const factor = targetDistance / currentDistance;

      this.viewOffset.copy(this.controls.target).sub(this.camera.position).multiplyScalar(factor);
      this.camera.position.sub(this.anchor).multiplyScalar(factor).add(this.anchor);
      this.controls.target.copy(this.camera.position).add(this.viewOffset);
      this.anchorActive = false;
    } else {
      this.targetOffset
        .copy(this.camera.position)
        .sub(this.controls.target)
        .setLength(targetDistance);
      this.camera.position.copy(this.controls.target).add(this.targetOffset);
    }
    this.synchronizeControlsImmediately();
    this.onSettled(this.distanceToTarget);

    return false;
  }

  private applyDistance(
    deltaY: number,
    requestedDistance: number,
    traverseMinimum: boolean,
    diagnosticDeltaY = deltaY,
  ): void {
    const beforeDistance = this.distanceToTarget;

    const traversedMinimum = this.setDistance(requestedDistance, traverseMinimum);

    this.recordDistanceOutcome(
      diagnosticDeltaY,
      beforeDistance,
      requestedDistance,
      traversedMinimum,
    );
  }

  private recordDistanceOutcome(
    deltaY: number,
    beforeDistance: number,
    requestedDistance: number,
    traversedMinimum: boolean,
  ): void {
    const minimumDistance = this.controls.minDistance;
    const maximumDistance = this.controls.maxDistance;
    const appliedDistance = this.distanceToTarget;
    const tolerance = Math.max(
      getLocalNavigationDistanceTolerance(this.camera.position, this.controls.target),
      beforeDistance * 1e-12,
    );
    const reachedMaximum =
      deltaY > 0 &&
      requestedDistance >= maximumDistance - tolerance &&
      appliedDistance >= maximumDistance - tolerance;
    const status = traversedMinimum
      ? 'applied'
      : requestedDistance < minimumDistance
        ? 'minimum'
        : reachedMaximum
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

  private unwindMinimumTraversal(logarithmicAmount: number): MinimumTraversalUndo {
    const undo = this.minimumTraversal.unwind(logarithmicAmount);
    const consumedLogarithmicAmount = logarithmicAmount - undo.remainingLogarithmicAmount;

    if (consumedLogarithmicAmount <= Number.EPSILON) {
      return undo;
    }
    this.viewOffset.copy(this.controls.target).sub(this.camera.position);
    this.camera.position.sub(undo.translation);
    this.controls.target.copy(this.camera.position).add(this.viewOffset);
    this.anchorActive = false;
    this.synchronizeControlsImmediately();
    this.onSettled(this.distanceToTarget);

    return undo;
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

  private synchronizeControlsImmediately(): void {
    if (this.canSynchronizeControlsImmediately()) {
      this.controls.update();
    }
  }
}
