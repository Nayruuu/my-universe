import * as THREE from 'three';

export interface CameraTransitionControls {
  readonly target: THREE.Vector3;
  update(): void;
}

export interface CameraTransitionOptions {
  readonly duration: number;
  readonly logarithmicDistance: boolean;
  readonly completeBeforeInteraction?: boolean;
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
  readonly logarithmicDistance: boolean;
  readonly completeBeforeInteraction: boolean;
  elapsed: number;
  readonly duration: number;
}

export class CameraTransitionController {
  private transition: CameraTransitionState | null = null;
  private readonly interpolatedDirection = new THREE.Vector3();

  constructor(
    private readonly camera: THREE.PerspectiveCamera,
    private readonly controls: CameraTransitionControls,
    private readonly onCompleted: () => void,
  ) {}

  public get active(): boolean {
    return this.transition !== null;
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
      logarithmicDistance: options.logarithmicDistance,
      completeBeforeInteraction: options.completeBeforeInteraction ?? false,
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
    if (transition.logarithmicDistance) {
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

  private finish(transition: CameraTransitionState): void {
    this.camera.position.copy(transition.endCamera);
    this.controls.target.copy(transition.endTarget);
    this.transition = null;
    this.controls.update();
  }
}

function easeInOutCubic(value: number): number {
  return value < 0.5 ? 4 * value ** 3 : 1 - (-2 * value + 2) ** 3 / 2;
}
