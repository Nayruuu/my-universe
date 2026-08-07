import * as THREE from 'three';

export interface CameraTargetControls {
  readonly target: THREE.Vector3;
}

export interface CameraTransitionRetargeter {
  retarget(position: THREE.Vector3): boolean;
}

export interface CameraZoomAnchorRetargeter {
  retargetAnchor(position: THREE.Vector3): boolean;
}

export class CameraTargetTracker {
  private readonly followedPosition = new THREE.Vector3();
  private readonly followDelta = new THREE.Vector3();
  private preserveOffset = false;

  constructor(
    private readonly camera: THREE.PerspectiveCamera,
    private readonly controls: CameraTargetControls,
    private readonly transition: CameraTransitionRetargeter,
    private readonly zoom: CameraZoomAnchorRetargeter,
  ) {}

  public follow(position: THREE.Vector3): void {
    if (this.transition.retarget(position) || this.zoom.retargetAnchor(position)) {
      this.followedPosition.copy(position);

      return;
    }

    this.followDelta
      .copy(position)
      .sub(this.preserveOffset ? this.followedPosition : this.controls.target);
    this.followedPosition.copy(position);
    if (this.followDelta.lengthSq() === 0) {
      return;
    }
    this.controls.target.add(this.followDelta);
    this.camera.position.add(this.followDelta);
  }

  public track(position: THREE.Vector3): void {
    this.followedPosition.copy(position);
    this.preserveOffset = true;
  }

  public reset(position: THREE.Vector3): void {
    this.followedPosition.copy(position);
    this.preserveOffset = false;
  }

  public shift(originShift: THREE.Vector3): void {
    this.followedPosition.sub(originShift);
  }

  public rebase(position: THREE.Vector3): void {
    const offset = this.camera.position.clone().sub(this.controls.target);

    this.reset(position);
    this.controls.target.copy(position);
    this.camera.position.copy(position).add(offset);
  }

  public release(): void {
    this.preserveOffset = false;
  }
}
