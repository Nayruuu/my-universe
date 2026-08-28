import * as THREE from 'three';

export const EARTH_OBSERVER_DEPARTURE_EVENT = 'universe-earth-observer-departure';
export const EARTH_OBSERVER_DEPARTURE_DURATION_SECONDS = 2.4;

export interface EarthObserverDepartureState {
  readonly active: boolean;
  readonly progress: number;
}

interface Departure {
  readonly center: THREE.Vector3;
  readonly normal: THREE.Vector3;
  readonly turn: THREE.Quaternion;
  readonly startOrientation: THREE.Quaternion;
  readonly endOrientation: THREE.Quaternion;
  readonly startRadius: number;
  readonly endRadius: number;
  readonly startFieldOfView: number;
  readonly endFieldOfView: number;
  readonly duration: number;
  elapsed: number;
}

/** Illustrative lift above the existing Earth, not a physical spacecraft trajectory. */
export class EarthObserverDeparture {
  private departure: Departure | null = null;
  private readonly offset = new THREE.Vector3();
  private readonly lookDirection = new THREE.Vector3();
  private readonly rotation = new THREE.Quaternion();

  constructor(
    private readonly camera: THREE.PerspectiveCamera,
    private readonly target: THREE.Vector3,
    private readonly publish: (state: EarthObserverDepartureState) => void,
  ) {}

  public get active(): boolean {
    return this.departure !== null;
  }

  public start(
    center: THREE.Vector3,
    distance: number,
    endFieldOfView: number,
    duration = EARTH_OBSERVER_DEPARTURE_DURATION_SECONDS,
  ): void {
    const normal = this.camera.position.clone().sub(center);
    const startRadius = Math.max(normal.length(), 0.001);

    if (normal.lengthSq() < Number.EPSILON) {
      normal.set(0, 1, 0);
    } else {
      normal.normalize();
    }
    const tangent = this.camera.getWorldDirection(new THREE.Vector3()).projectOnPlane(normal);

    if (tangent.lengthSq() < 0.0001) {
      tangent.set(0, 1, 0).applyQuaternion(this.camera.quaternion).projectOnPlane(normal);
    }
    tangent.normalize();
    // Retreat slightly behind the original gaze, while the radius only increases. The ground
    // falls away before the Earth becomes the new pivot, including at zenith and at the poles.
    const endNormal = normal
      .clone()
      .multiplyScalar(0.866_025_403_784)
      .addScaledVector(tangent, -0.5);
    const endOrientation = new THREE.Quaternion().setFromRotationMatrix(
      new THREE.Matrix4().lookAt(endNormal, new THREE.Vector3(), new THREE.Vector3(0, 1, 0)),
    );

    this.departure = {
      center: center.clone(),
      normal,
      turn: new THREE.Quaternion().setFromUnitVectors(normal, endNormal.normalize()),
      startOrientation: this.camera.quaternion.clone(),
      endOrientation,
      startRadius,
      endRadius: Math.max(startRadius, distance),
      startFieldOfView: this.camera.fov,
      endFieldOfView,
      duration,
      elapsed: 0,
    };
    this.update(0);
  }

  public update(deltaSeconds: number): boolean {
    const departure = this.departure;

    if (!departure) {
      return false;
    }
    departure.elapsed += Math.max(0, deltaSeconds);
    const progress =
      departure.duration > 0 ? Math.min(departure.elapsed / departure.duration, 1) : 1;
    const travel = THREE.MathUtils.smootherstep(progress, 0, 1);
    const turn = THREE.MathUtils.smootherstep(progress, 0.1, 1);
    const radius = Math.exp(
      THREE.MathUtils.lerp(Math.log(departure.startRadius), Math.log(departure.endRadius), travel),
    );

    this.rotation.identity().slerp(departure.turn, travel);
    this.offset.copy(departure.normal).applyQuaternion(this.rotation).multiplyScalar(radius);
    this.camera.position.copy(departure.center).add(this.offset);
    this.camera.quaternion.slerpQuaternions(
      departure.startOrientation,
      departure.endOrientation,
      turn,
    );
    this.camera.fov = THREE.MathUtils.lerp(
      departure.startFieldOfView,
      departure.endFieldOfView,
      travel,
    );
    this.camera.updateProjectionMatrix();
    this.camera.updateMatrixWorld();
    this.camera.getWorldDirection(this.lookDirection);
    this.target.copy(this.camera.position).addScaledVector(this.lookDirection, radius);
    if (progress >= 1) {
      this.target.copy(departure.center);
      this.camera.up.set(0, 1, 0);
      this.departure = null;
    }
    this.publish({ active: this.active, progress });

    return !this.active;
  }

  public retarget(center: THREE.Vector3): void {
    this.departure?.center.copy(center);
  }

  public shiftOrigin(shift: THREE.Vector3): void {
    this.departure?.center.sub(shift);
  }

  public cancel(): void {
    if (!this.departure) {
      return;
    }
    // OrbitControls must inherit the current roll on interruption, not impose map north at once.
    this.camera.up.set(0, 1, 0).applyQuaternion(this.camera.quaternion);
    this.departure = null;
    this.publish({ active: false, progress: 1 });
  }
}
