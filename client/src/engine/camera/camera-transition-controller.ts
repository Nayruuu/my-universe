import * as THREE from 'three';

export interface CameraTransitionControls {
  readonly target: THREE.Vector3;
  update(): void;
}

export interface CameraTransitionOptions {
  readonly duration: number;
  readonly logarithmicDistance: boolean;
  readonly acquireTarget?: boolean;
  readonly completeBeforeInteraction?: boolean;
  readonly endFieldOfView?: number;
}

interface CameraTransitionState {
  readonly startCamera: THREE.Vector3;
  readonly endCamera: THREE.Vector3;
  readonly startTarget: THREE.Vector3;
  readonly endTarget: THREE.Vector3;
  readonly startDirection: THREE.Vector3;
  readonly endDirection: THREE.Vector3;
  readonly startDistance: number;
  readonly endDistance: number;
  readonly acquisitionDuration: number;
  readonly logarithmicDistance: boolean;
  readonly completeBeforeInteraction: boolean;
  readonly startFieldOfView: number;
  readonly endFieldOfView: number;
  elapsed: number;
  readonly duration: number;
}

export class CameraTransitionController {
  private transition: CameraTransitionState | null = null;
  private readonly interpolatedDirection = new THREE.Vector3();
  private readonly approachDirection = new THREE.Vector3();
  private readonly directionRotation = new THREE.Quaternion();
  private readonly interpolatedRotation = new THREE.Quaternion();

  constructor(
    private readonly camera: THREE.PerspectiveCamera,
    private readonly controls: CameraTransitionControls,
    private readonly onCompleted: () => void,
  ) {}

  public get active(): boolean {
    return this.transition !== null;
  }

  public get easedProgress(): number {
    const transition = this.transition;

    return transition ? easeInOutCubic(Math.min(transition.elapsed / transition.duration, 1)) : 1;
  }

  public start(
    endCamera: THREE.Vector3,
    endTarget: THREE.Vector3,
    options: CameraTransitionOptions,
  ): void {
    const startCamera = this.camera.position.clone();
    const startTarget = this.controls.target.clone();
    const startDirection = startCamera.clone().sub(startTarget);
    const endDirection = endCamera.clone().sub(endTarget);
    const startDistance = Math.max(startDirection.length(), Number.EPSILON);
    const endDistance = Math.max(endDirection.length(), Number.EPSILON);

    startDirection.normalize();
    endDirection.normalize();
    this.transition = {
      startCamera,
      endCamera: endCamera.clone(),
      startTarget,
      endTarget: endTarget.clone(),
      startDirection,
      endDirection,
      startDistance,
      endDistance,
      acquisitionDuration: options.acquireTarget ? Math.min(options.duration * 0.25, 1.2) : 0,
      logarithmicDistance: options.logarithmicDistance,
      completeBeforeInteraction: options.completeBeforeInteraction ?? false,
      startFieldOfView: this.camera.fov,
      endFieldOfView: options.endFieldOfView ?? this.camera.fov,
      elapsed: 0,
      duration: options.duration,
    };
  }

  public update(deltaSeconds: number): void {
    const transition = this.transition;

    if (!transition) {
      return;
    }
    transition.elapsed += deltaSeconds;
    const progress = Math.min(transition.elapsed / transition.duration, 1);
    const eased = easeInOutCubic(progress);

    this.controls.target.lerpVectors(transition.startTarget, transition.endTarget, eased);
    this.camera.fov = THREE.MathUtils.lerp(
      transition.startFieldOfView,
      transition.endFieldOfView,
      eased,
    );
    this.camera.updateProjectionMatrix();
    if (transition.acquisitionDuration > 0) {
      this.updateAcquiredTargetTransition(transition);
    } else if (transition.logarithmicDistance) {
      this.interpolatedDirection
        .lerpVectors(transition.startDirection, transition.endDirection, eased)
        .normalize();
      const distance = Math.exp(
        THREE.MathUtils.lerp(
          Math.log(transition.startDistance),
          Math.log(transition.endDistance),
          eased,
        ),
      );

      this.camera.position
        .copy(this.controls.target)
        .addScaledVector(this.interpolatedDirection, distance);
    } else {
      this.camera.position.lerpVectors(transition.startCamera, transition.endCamera, eased);
    }

    if (progress >= 1) {
      this.complete();
    }
  }

  public retarget(position: THREE.Vector3): boolean {
    if (!this.transition) {
      return false;
    }
    const offset = this.transition.endCamera.clone().sub(this.transition.endTarget);

    this.transition.endTarget.copy(position);
    this.transition.endCamera.copy(position).add(offset);

    return true;
  }

  public complete(): boolean {
    const transition = this.transition;

    if (!transition) {
      return false;
    }
    this.finish(transition);
    this.onCompleted();

    return true;
  }

  public completePendingReferenceFrame(): boolean {
    const transition = this.transition;

    if (!transition?.completeBeforeInteraction) {
      return false;
    }
    this.finish(transition);

    return true;
  }

  public cancel(): void {
    this.transition = null;
  }

  private updateAcquiredTargetTransition(transition: CameraTransitionState): void {
    this.approachDirection.subVectors(transition.startCamera, transition.endTarget);
    const destinationDistance = this.approachDirection.length();

    if (destinationDistance > Number.EPSILON) {
      this.approachDirection.divideScalar(destinationDistance);
    } else {
      this.approachDirection.copy(transition.endDirection);
    }
    if (transition.elapsed < transition.acquisitionDuration) {
      // Acquire the destination without translating the camera. Shrinking an offset pivot before
      // this turn finishes can send the real destination off-screen, then behind the camera.
      const progress = easeInOutCubic(transition.elapsed / transition.acquisitionDuration);
      const distance = THREE.MathUtils.lerp(
        transition.startDistance,
        destinationDistance,
        progress,
      );

      this.interpolateDirection(transition.startDirection, this.approachDirection, progress);
      this.camera.position.copy(transition.startCamera);
      this.controls.target
        .copy(this.camera.position)
        .addScaledVector(this.interpolatedDirection, -distance);

      return;
    }
    const progress = easeInOutCubic(
      Math.min(
        (transition.elapsed - transition.acquisitionDuration) /
          (transition.duration - transition.acquisitionDuration),
        1,
      ),
    );
    const distance = Math.exp(
      THREE.MathUtils.lerp(
        Math.log(Math.max(destinationDistance, Number.EPSILON)),
        Math.log(transition.endDistance),
        progress,
      ),
    );

    this.interpolateDirection(this.approachDirection, transition.endDirection, progress);
    this.controls.target.copy(transition.endTarget);
    this.camera.position
      .copy(transition.endTarget)
      .addScaledVector(this.interpolatedDirection, distance);
  }

  private interpolateDirection(start: THREE.Vector3, end: THREE.Vector3, progress: number): void {
    // A spherical arc keeps a finite radius even when the requested views are opposite.
    this.directionRotation.setFromUnitVectors(start, end);
    this.interpolatedRotation.identity().slerp(this.directionRotation, progress);
    this.interpolatedDirection.copy(start).applyQuaternion(this.interpolatedRotation);
  }

  private finish(transition: CameraTransitionState): void {
    this.camera.position.copy(transition.endCamera);
    this.camera.fov = transition.endFieldOfView;
    this.camera.updateProjectionMatrix();
    this.controls.target.copy(transition.endTarget);
    this.transition = null;
    this.controls.update();
  }
}

function easeInOutCubic(value: number): number {
  return value < 0.5 ? 4 * value ** 3 : 1 - (-2 * value + 2) ** 3 / 2;
}
