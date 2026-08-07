import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { SpaceObject } from '../../data/models/universe.models';
import {
  FREE_NAVIGATION_MIN_DISTANCE,
  getFocusDistance,
  getMinimumNavigationDistance,
  MAX_NAVIGATION_DISTANCE,
} from './navigation-policy';
import { CameraTargetTracker } from './camera-target-tracker';
import { CameraTransitionController } from './camera-transition-controller';
import { CameraZoomController, type CameraZoomDiagnostics } from './camera-zoom-controller';

export type { CameraZoomDiagnostics } from './camera-zoom-controller';
export type CameraSettledSource = 'interaction' | 'pinch' | 'transition' | 'zoom';

const PLANETARY_SAFE_FRAMING_ELEVATION = 0.2;

export class CameraController {
  public readonly controls: OrbitControls;
  private readonly transitionController: CameraTransitionController;
  private readonly zoomController: CameraZoomController;
  private readonly targetTracker: CameraTargetTracker;
  private pinchInteractionActive = false;

  constructor(
    public readonly camera: THREE.PerspectiveCamera,
    private readonly canvas: HTMLCanvasElement,
    private readonly onCameraSettled: (distance: number, source: CameraSettledSource) => void,
  ) {
    this.controls = new OrbitControls(camera, this.canvas);
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
    this.transitionController = new CameraTransitionController(camera, this.controls, () =>
      this.onCameraSettled(this.distanceToTarget, 'transition'),
    );
    this.zoomController = new CameraZoomController(camera, this.controls, (distance) =>
      this.onCameraSettled(distance, 'zoom'),
    );
    this.targetTracker = new CameraTargetTracker(
      camera,
      this.controls,
      this.transitionController,
      this.zoomController,
    );
    this.setTargetInteractionActive(false);
    this.controls.addEventListener('start', this.cancelTransition);
    this.controls.addEventListener('end', this.handleInteractionEnd);
    this.canvas.addEventListener('touchstart', this.handleTouchStart, { passive: true });
    this.controls.update();
  }

  public get isTransitioning(): boolean {
    return this.transitionController.active || this.zoomController.active;
  }

  public get distanceToTarget(): number {
    return this.camera.position.distanceTo(this.controls.target);
  }

  public get hasActiveTarget(): boolean {
    return this.controls.enableRotate && this.controls.enablePan;
  }

  public get semanticZoomActive(): boolean {
    return this.zoomController.semanticActive;
  }

  public get lastZoomDiagnostics(): CameraZoomDiagnostics | null {
    return this.zoomController.diagnostics;
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
          PLANETARY_SAFE_FRAMING_ELEVATION,
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

  public completeFocusTransition(): void {
    this.transitionController.complete();
  }

  public observeFrom(position: THREE.Vector3, target: THREE.Vector3): void {
    this.zoomController.reset();
    this.targetTracker.reset(target);
    const travelDistance =
      this.camera.position.distanceTo(position) + this.controls.target.distanceTo(target);

    this.controls.minDistance = FREE_NAVIGATION_MIN_DISTANCE;
    this.setTargetInteractionActive(true);
    this.transitionController.start(position, target, {
      duration: THREE.MathUtils.clamp(0.85 + Math.log10(1 + travelDistance) * 0.22, 0.85, 2.2),
      logarithmicDistance: false,
    });
  }

  public follow(position: THREE.Vector3): void {
    this.targetTracker.follow(position);
  }

  public update(deltaSeconds: number): void {
    this.transitionController.update(deltaSeconds);
    this.zoomController.update(deltaSeconds, this.transitionController.active);

    this.controls.panSpeed = THREE.MathUtils.clamp(this.distanceToTarget / 80, 0.25, 5);
    this.controls.update();
  }

  public zoomBy(factor: number): void {
    this.cancelFocus();
    this.zoomController.zoomBy(factor);
  }

  public zoomSemantically(deltaY: number): void {
    this.completeReferenceFrameTransition();
    this.transitionController.cancel();
    this.zoomController.zoomSemantically(deltaY);
  }

  public adoptZoomAnchor(position: THREE.Vector3): void {
    this.completeReferenceFrameTransition();
    this.zoomController.adoptAnchor(position);
  }

  public adoptZoomPointer(x: number, y: number): void {
    this.completeReferenceFrameTransition();
    this.zoomController.adoptPointer(x, y);
  }

  public setNavigationConstraints(object: SpaceObject): void {
    this.controls.minDistance = getMinimumNavigationDistance(object);
    this.setTargetInteractionActive(true);
  }

  public trackTarget(position: THREE.Vector3, object: SpaceObject): void {
    this.setNavigationConstraints(object);
    this.targetTracker.track(position);
  }

  public shiftTrackedPosition(originShift: THREE.Vector3): void {
    this.targetTracker.shift(originShift);
  }

  public rebaseTarget(position: THREE.Vector3, object: SpaceObject): void {
    this.transitionController.cancel();
    this.zoomController.cancelAnchor();
    this.setNavigationConstraints(object);
    this.targetTracker.rebase(position);
    this.controls.update();
  }

  public transitionReferenceFrame(position: THREE.Vector3, object: SpaceObject): void {
    const offset = this.camera.position.clone().sub(this.controls.target);

    if (offset.lengthSq() < 0.0001) {
      offset.set(1, 0.55, 1);
    }
    const distance = THREE.MathUtils.clamp(
      offset.length(),
      getMinimumNavigationDistance(object),
      this.controls.maxDistance,
    );

    offset.setLength(distance);
    this.zoomController.cancelAnchor();
    this.targetTracker.reset(position);
    this.setNavigationConstraints(object);
    this.transitionController.start(position.clone().add(offset), position, {
      duration: 0.32,
      logarithmicDistance: false,
      completeBeforeInteraction: true,
    });
  }

  public adoptZoomTarget(position: THREE.Vector3, object: SpaceObject): void {
    this.zoomController.resetJourney();
    this.transitionController.cancel();
    this.trackTarget(position, object);
    this.adoptZoomAnchor(position);
  }

  public cancelFocus(): void {
    this.completeReferenceFrameTransition();
    this.zoomController.reset();
    this.transitionController.cancel();
  }

  public releaseTarget(): void {
    this.cancelFocus();
    this.targetTracker.release();
    this.controls.minDistance = FREE_NAVIGATION_MIN_DISTANCE;
    this.setTargetInteractionActive(false);
  }

  public dispose(): void {
    this.controls.removeEventListener('start', this.cancelTransition);
    this.controls.removeEventListener('end', this.handleInteractionEnd);
    this.canvas.removeEventListener('touchstart', this.handleTouchStart);
    this.controls.dispose();
  }

  private startTargetTransition(
    position: THREE.Vector3,
    direction: THREE.Vector3,
    distance: number,
    object: SpaceObject,
  ): void {
    this.zoomController.reset();
    this.targetTracker.reset(position);
    this.setTargetInteractionActive(true);
    const endCamera = position.clone().add(direction.multiplyScalar(distance));
    const travelDistance = this.controls.target.distanceTo(position);

    this.controls.minDistance = getMinimumNavigationDistance(object);
    this.transitionController.start(endCamera, position, {
      duration: THREE.MathUtils.clamp(0.85 + Math.log10(1 + travelDistance) * 0.22, 0.85, 2.2),
      logarithmicDistance: true,
    });
  }

  private readonly cancelTransition = (): void => {
    this.completeReferenceFrameTransition();
    this.transitionController.cancel();
    this.zoomController.cancelAnchor();
  };

  private readonly handleInteractionEnd = (): void => {
    const source = this.pinchInteractionActive ? 'pinch' : 'interaction';

    this.pinchInteractionActive = false;
    this.onCameraSettled(this.distanceToTarget, source);
  };

  private readonly handleTouchStart = (event: TouchEvent): void => {
    if (event.touches.length >= 2) {
      this.pinchInteractionActive = true;
    }
  };

  private completeReferenceFrameTransition(): void {
    this.transitionController.completePendingReferenceFrame();
  }

  private setTargetInteractionActive(active: boolean): void {
    this.controls.enableRotate = active;
    this.controls.enablePan = active;
  }
}
