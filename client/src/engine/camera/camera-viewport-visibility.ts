import * as THREE from 'three';

export class CameraViewportVisibility {
  private readonly cameraSpacePosition = new THREE.Vector3();
  private readonly projectedPosition = new THREE.Vector3();

  public contains(
    worldPosition: THREE.Vector3,
    camera: THREE.PerspectiveCamera,
    overscanNdc = 0,
  ): boolean {
    camera.updateWorldMatrix(true, false);
    this.cameraSpacePosition.copy(worldPosition).applyMatrix4(camera.matrixWorldInverse);
    this.projectedPosition.copy(worldPosition).project(camera);

    const boundary = 1 + overscanNdc;

    return (
      this.cameraSpacePosition.z < 0 &&
      Number.isFinite(this.projectedPosition.x) &&
      Number.isFinite(this.projectedPosition.y) &&
      Number.isFinite(this.projectedPosition.z) &&
      Math.abs(this.projectedPosition.x) <= boundary &&
      Math.abs(this.projectedPosition.y) <= boundary &&
      this.projectedPosition.z >= -1 &&
      this.projectedPosition.z <= 1
    );
  }
}
