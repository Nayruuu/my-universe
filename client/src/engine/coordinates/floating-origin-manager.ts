import * as THREE from 'three';

export class FloatingOriginManager {
  public readonly accumulatedOrigin = new THREE.Vector3();

  constructor(private readonly threshold = 1_600) {}

  public update(
    spaceRoot: THREE.Group,
    camera: THREE.Camera,
    controlsTarget: THREE.Vector3,
    transitionInProgress: boolean,
  ): boolean {
    if (transitionInProgress || controlsTarget.length() < this.threshold) {
      return false;
    }

    const shift = controlsTarget.clone();

    spaceRoot.position.sub(shift);
    camera.position.sub(shift);
    controlsTarget.sub(shift);
    this.accumulatedOrigin.add(shift);

    return true;
  }
}
