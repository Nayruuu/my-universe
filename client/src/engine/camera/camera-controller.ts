import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { SpaceObject } from '../../data/models/universe.models';
import {
  FREE_NAVIGATION_MIN_DISTANCE,
  getFocusDistance,
  getFreeNavigationMinimumDistance,
  getMinimumNavigationDistance,
  MAX_NAVIGATION_DISTANCE,
} from './navigation-policy';
import { SemanticZoomJourney } from './semantic-zoom';

interface FocusTransition {
  startCamera: THREE.Vector3;
  endCamera: THREE.Vector3;
  startTarget: THREE.Vector3;
  endTarget: THREE.Vector3;
  startDirection: THREE.Vector3;
  endDirection: THREE.Vector3;
  startDistance: number;
  endDistance: number;
  logarithmicDistance: boolean;
  elapsed: number;
  duration: number;
}

export class CameraController {
  public readonly controls: OrbitControls;
  private transition: FocusTransition | null = null;
  private readonly zoomAnchor = new THREE.Vector3();
  private readonly transitionDirection = new THREE.Vector3();
  private readonly semanticZoomJourney = new SemanticZoomJourney();
  private zoomAnchorActive = false;

  constructor(
    public readonly camera: THREE.PerspectiveCamera,
    canvas: HTMLCanvasElement,
    private readonly onCameraSettled: (distance: number) => void,
  ) {
    this.controls = new OrbitControls(camera, canvas);
    this.controls.enableDamping = true;
    this.controls.dampingFactor = 0.065;
    this.controls.enablePan = true;
    this.controls.screenSpacePanning = true;
    this.controls.zoomToCursor = true;
    this.controls.minDistance = FREE_NAVIGATION_MIN_DISTANCE;
    this.controls.maxDistance = MAX_NAVIGATION_DISTANCE;
    this.controls.rotateSpeed = 0.48;
    this.controls.zoomSpeed = 0.82;
    this.controls.panSpeed = 0.75;
    this.controls.target.set(0, 0, 0);
    this.setTargetInteractionActive(false);
    this.controls.addEventListener('start', this.cancelTransition);
    this.controls.addEventListener('end', this.handleInteractionEnd);
    this.controls.update();
  }

  public get isTransitioning(): boolean {
    return this.transition !== null || this.zoomAnchorActive;
  }

  public get distanceToTarget(): number {
    return this.camera.position.distanceTo(this.controls.target);
  }

  public get hasActiveTarget(): boolean {
    return this.controls.enableRotate && this.controls.enablePan;
  }

  public get semanticZoomActive(): boolean {
    return this.semanticZoomJourney.active;
  }

  public focusOn(position: THREE.Vector3, object: SpaceObject, distanceOverride?: number): void {
    let currentDirection = this.camera.position.clone().sub(this.controls.target);

    if (currentDirection.lengthSq() < 0.0001) {
      currentDirection.set(1, 0.55, 1);
    }
    currentDirection.normalize();

    if (
      (object.type === 'planet' || object.type === 'dwarf-planet' || object.type === 'moon') &&
      position.lengthSq() > 4
    ) {
      const radialDirection = position.clone().normalize();

      if (Math.abs(currentDirection.dot(radialDirection)) > 0.64) {
        currentDirection = new THREE.Vector3(
          -radialDirection.z,
          0.52,
          radialDirection.x,
        ).normalize();
      }
    }

    const distance =
      distanceOverride && Number.isFinite(distanceOverride)
        ? THREE.MathUtils.clamp(
            distanceOverride,
            getMinimumNavigationDistance(object),
            this.controls.maxDistance,
          )
        : getFocusDistance(object);

    this.startTargetTransition(position, currentDirection, distance, object);
  }

  public focusOnFromDirection(
    position: THREE.Vector3,
    object: SpaceObject,
    direction: THREE.Vector3,
    distanceOverride?: number,
  ): void {
    const normalizedDirection =
      direction.lengthSq() > 0.0001
        ? direction.clone().normalize()
        : this.camera.position.clone().sub(this.controls.target).normalize();
    const distance =
      distanceOverride && Number.isFinite(distanceOverride)
        ? THREE.MathUtils.clamp(
            distanceOverride,
            getMinimumNavigationDistance(object),
            this.controls.maxDistance,
          )
        : getFocusDistance(object);

    this.startTargetTransition(position, normalizedDirection, distance, object);
  }

  public observeFrom(position: THREE.Vector3, target: THREE.Vector3): void {
    this.semanticZoomJourney.reset();
    this.zoomAnchorActive = false;
    const travelDistance =
      this.camera.position.distanceTo(position) + this.controls.target.distanceTo(target);

    this.controls.minDistance = FREE_NAVIGATION_MIN_DISTANCE;
    this.setTargetInteractionActive(true);
    this.transition = this.createTransition(
      position,
      target,
      THREE.MathUtils.clamp(0.85 + Math.log10(1 + travelDistance) * 0.22, 0.85, 2.2),
      false,
    );
  }

  public follow(position: THREE.Vector3): void {
    if (this.transition) {
      const offset = this.transition.endCamera.clone().sub(this.transition.endTarget);

      this.transition.endTarget.copy(position);
      this.transition.endCamera.copy(position).add(offset);

      return;
    }

    if (this.zoomAnchorActive) {
      this.zoomAnchor.copy(position);

      return;
    }

    const delta = position.clone().sub(this.controls.target);

    if (delta.lengthSq() === 0) {
      return;
    }
    this.controls.target.add(delta);
    this.camera.position.add(delta);
  }

  public update(deltaSeconds: number): void {
    if (this.transition) {
      this.transition.elapsed += deltaSeconds;
      const progress = Math.min(this.transition.elapsed / this.transition.duration, 1);
      const eased = easeInOutCubic(progress);

      this.controls.target.lerpVectors(
        this.transition.startTarget,
        this.transition.endTarget,
        eased,
      );
      if (this.transition.logarithmicDistance) {
        this.transitionDirection
          .lerpVectors(this.transition.startDirection, this.transition.endDirection, eased)
          .normalize();
        const distance = Math.exp(
          THREE.MathUtils.lerp(
            Math.log(this.transition.startDistance),
            Math.log(this.transition.endDistance),
            eased,
          ),
        );

        this.camera.position
          .copy(this.controls.target)
          .addScaledVector(this.transitionDirection, distance);
      } else {
        this.camera.position.lerpVectors(
          this.transition.startCamera,
          this.transition.endCamera,
          eased,
        );
      }

      if (progress >= 1) {
        this.transition = null;
        this.onCameraSettled(this.distanceToTarget);
      }
    }

    if (this.zoomAnchorActive && !this.transition) {
      const remainingDistance = this.controls.target.distanceTo(this.zoomAnchor);
      const blend = 1 - Math.exp(-7 * deltaSeconds);

      this.controls.target.lerp(this.zoomAnchor, blend);
      if (remainingDistance < Math.max(0.015, this.distanceToTarget * 0.000_15)) {
        this.controls.target.copy(this.zoomAnchor);
        this.zoomAnchorActive = false;
        this.onCameraSettled(this.distanceToTarget);
      }
    }

    this.controls.panSpeed = THREE.MathUtils.clamp(this.distanceToTarget / 80, 0.25, 5);
    this.controls.update();
  }

  public zoomBy(factor: number): void {
    this.cancelFocus();
    const offset = this.camera.position.clone().sub(this.controls.target);
    const targetDistance = THREE.MathUtils.clamp(
      offset.length() * factor,
      this.controls.minDistance,
      this.controls.maxDistance,
    );

    offset.setLength(targetDistance);
    this.camera.position.copy(this.controls.target).add(offset);
    this.controls.update();
    this.onCameraSettled(this.distanceToTarget);
  }

  public zoomSemantically(deltaY: number): void {
    this.transition = null;
    this.zoomAnchorActive = false;
    const step = this.semanticZoomJourney.step(this.distanceToTarget, deltaY);

    if (step.handled) {
      this.setDistance(step.distance);

      return;
    }
    if (!Number.isFinite(deltaY) || deltaY === 0) {
      return;
    }
    this.setDistance(this.distanceToTarget * Math.exp(deltaY * 0.0015));
  }

  public adoptZoomTarget(position: THREE.Vector3, object: SpaceObject): void {
    this.semanticZoomJourney.reset();
    this.transition = null;
    this.controls.minDistance = getMinimumNavigationDistance(object);
    this.setTargetInteractionActive(true);
    this.zoomAnchor.copy(position);
    this.zoomAnchorActive = true;
  }

  public cancelFocus(): void {
    this.semanticZoomJourney.reset();
    this.transition = null;
    this.zoomAnchorActive = false;
  }

  public releaseTarget(): void {
    this.cancelFocus();
    this.controls.minDistance = getFreeNavigationMinimumDistance(this.distanceToTarget);
    this.setTargetInteractionActive(false);
  }

  public dispose(): void {
    this.controls.removeEventListener('start', this.cancelTransition);
    this.controls.removeEventListener('end', this.handleInteractionEnd);
    this.controls.dispose();
  }

  private startTargetTransition(
    position: THREE.Vector3,
    direction: THREE.Vector3,
    distance: number,
    object: SpaceObject,
  ): void {
    this.semanticZoomJourney.reset();
    this.zoomAnchorActive = false;
    this.setTargetInteractionActive(true);
    const endCamera = position.clone().add(direction.multiplyScalar(distance));
    const travelDistance = this.controls.target.distanceTo(position);

    this.controls.minDistance = getMinimumNavigationDistance(object);
    this.transition = this.createTransition(
      endCamera,
      position,
      THREE.MathUtils.clamp(0.85 + Math.log10(1 + travelDistance) * 0.22, 0.85, 2.2),
      true,
    );
  }

  private createTransition(
    endCamera: THREE.Vector3,
    endTarget: THREE.Vector3,
    duration: number,
    logarithmicDistance: boolean,
  ): FocusTransition {
    const startCamera = this.camera.position.clone();
    const startTarget = this.controls.target.clone();
    const startDirection = startCamera.clone().sub(startTarget);
    const endDirection = endCamera.clone().sub(endTarget);
    const startDistance = Math.max(startDirection.length(), Number.EPSILON);
    const endDistance = Math.max(endDirection.length(), Number.EPSILON);

    startDirection.normalize();
    endDirection.normalize();

    return {
      startCamera,
      endCamera: endCamera.clone(),
      startTarget,
      endTarget: endTarget.clone(),
      startDirection,
      endDirection,
      startDistance,
      endDistance,
      logarithmicDistance,
      elapsed: 0,
      duration,
    };
  }

  private readonly cancelTransition = (): void => {
    this.transition = null;
    this.zoomAnchorActive = false;
  };

  private readonly handleInteractionEnd = (): void => {
    this.onCameraSettled(this.distanceToTarget);
  };

  private setDistance(distance: number): void {
    const offset = this.camera.position.clone().sub(this.controls.target);
    const targetDistance = THREE.MathUtils.clamp(
      distance,
      this.controls.minDistance,
      this.controls.maxDistance,
    );

    offset.setLength(targetDistance);
    this.camera.position.copy(this.controls.target).add(offset);
    this.controls.update();
    this.onCameraSettled(this.distanceToTarget);
  }

  private setTargetInteractionActive(active: boolean): void {
    this.controls.enableRotate = active;
    this.controls.enablePan = active;
  }
}

function easeInOutCubic(value: number): number {
  return value < 0.5 ? 4 * value ** 3 : 1 - (-2 * value + 2) ** 3 / 2;
}
