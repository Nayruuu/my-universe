import * as THREE from 'three';
import type { SpaceObject, UniverseTime } from '../../data/models/universe.models';
import {
  calculateBodyOrientation,
  getRotationalBody,
  type RotationalBody,
} from '../simulation/body-orientation';

export interface RotatingObjectEntry {
  readonly definition: SpaceObject;
  readonly rotatingBody: THREE.Object3D | null;
}

export class BodyRotationController {
  private readonly orientationMatrix = new THREE.Matrix4();
  private readonly xAxis = new THREE.Vector3();
  private readonly yAxis = new THREE.Vector3();
  private readonly zAxis = new THREE.Vector3();

  public update(
    entries: Iterable<RotatingObjectEntry>,
    time: UniverseTime,
    earthTime: UniverseTime | null = time,
  ): void {
    for (const entry of entries) {
      if (entry.definition.id === 'earth') {
        if (earthTime) {
          this.updateEntry(entry, earthTime);
        }
      } else {
        this.updateEntry(entry, time);
      }
    }
  }

  public updateEntry(entry: RotatingObjectEntry, time: UniverseTime): void {
    if (!entry.rotatingBody || !entry.definition.rotation) {
      return;
    }
    const body = getRotationalBody(entry.definition.id);

    if (!body) {
      return;
    }
    this.calculateQuaternion(time, body, entry.rotatingBody.quaternion);
  }

  private calculateQuaternion(
    time: UniverseTime,
    body: RotationalBody,
    target: THREE.Quaternion,
  ): void {
    const orientation = calculateBodyOrientation(time, body);

    this.xAxis.set(orientation.xAxis.x, orientation.xAxis.y, orientation.xAxis.z);
    this.yAxis.set(orientation.yAxis.x, orientation.yAxis.y, orientation.yAxis.z);
    this.zAxis.set(orientation.zAxis.x, orientation.zAxis.y, orientation.zAxis.z);
    this.orientationMatrix.makeBasis(this.xAxis, this.yAxis, this.zAxis);
    target.setFromRotationMatrix(this.orientationMatrix).normalize();
  }
}
