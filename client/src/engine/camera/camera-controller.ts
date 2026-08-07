import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { SpaceObject, type UniverseTime } from '../../data/models/universe.models';
import {
  FREE_NAVIGATION_MIN_DISTANCE,
  getFocusDistance,
  getMinimumNavigationDistance,
  MAX_NAVIGATION_DISTANCE,
} from './navigation-policy';
import { CameraTargetTracker } from './camera-target-tracker';
import { CameraTransitionController } from './camera-transition-controller';
import { CameraZoomController, type CameraZoomDiagnostics } from './camera-zoom-controller';
import {
  DEFAULT_EARTH_OBSERVER_FRAMING,
  EARTH_OBSERVER_FIELD_OF_VIEW_DEGREES,
  EARTH_OBSERVER_JOURNEY_DURATION_SECONDS,
  EarthObserverCameraControl,
  type EarthObserverFraming,
} from './earth-observer-camera-control';
import { EarthObserverOrientation } from './earth-observer-orientation';

export type { CameraZoomDiagnostics } from './camera-zoom-controller';
export type CameraSettledSource = 'interaction' | 'pinch' | 'transition' | 'zoom';

const PLANETARY_SAFE_FRAMING_ELEVATION = 0.2;

export class CameraController {
  public readonly controls: OrbitControls;
  private readonly transitionController: CameraTransitionController;
  private readonly zoomController: CameraZoomController;
  private readonly targetTracker: CameraTargetTracker;
  private readonly observerControl: EarthObserverCameraControl;
  private readonly preservedViewDirection = new THREE.Vector3();
  private readonly observerTransitionDirection = new THREE.Vector3();
  private readonly observerTransitionFallbackUp = new THREE.Vector3();
  private readonly observerTransitionOrientation = new EarthObserverOrientation();
  private readonly observerTransitionStartQuaternion = new THREE.Quaternion();
  private readonly observerTransitionEndQuaternion = new THREE.Quaternion();
  private pinchInteractionActive = false;
  private observerTransitionPending = false;
  private observerFraming = DEFAULT_EARTH_OBSERVER_FRAMING;

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
    this.observerControl = new EarthObserverCameraControl(camera, this.canvas);
    this.transitionController = new CameraTransitionController(camera, this.controls, () =>
      this.handleTransitionCompleted(),
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
    return this.observerControl.active || (this.controls.enableRotate && this.controls.enablePan);
  }

  public get observerModeActive(): boolean {
    return this.observerControl.active;
  }

  public get observerPresentationActive(): boolean {
    return this.observerTransitionPending || this.observerControl.active;
  }

  public get semanticZoomActive(): boolean {
    return this.zoomController.semanticActive;
  }

  public get lastZoomDiagnostics(): CameraZoomDiagnostics | null {
    return this.zoomController.diagnostics;
  }

  public focusOn(position: THREE.Vector3, object: SpaceObject, distanceOverride?: number): void {
    this.deactivateObserverModePreservingView();
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
    this.deactivateObserverModePreservingView();
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

  public observeFrom(
    position: THREE.Vector3,
    target: THREE.Vector3,
    framing: EarthObserverFraming = DEFAULT_EARTH_OBSERVER_FRAMING,
  ): void {
    const preserveObserverControls = this.observerPresentationActive;

    this.deactivateObserverModePreservingView();
    this.zoomController.reset();
    this.targetTracker.reset(target);
    this.controls.minDistance = FREE_NAVIGATION_MIN_DISTANCE;
    this.controls.enabled = !preserveObserverControls;
    this.setTargetInteractionActive(!preserveObserverControls);
    this.observerTransitionPending = true;
    this.observerFraming = framing;
    this.observerTransitionStartQuaternion.copy(this.camera.quaternion);
    this.observerTransitionDirection.subVectors(target, position);
    if (this.observerTransitionDirection.lengthSq() < Number.EPSILON) {
      this.camera.getWorldDirection(this.observerTransitionDirection);
    }
    this.observerTransitionFallbackUp.set(0, 1, 0).applyQuaternion(this.camera.quaternion);
    this.observerTransitionOrientation.configure(
      this.observerTransitionDirection,
      this.observerTransitionFallbackUp,
      framing,
    );
    this.observerTransitionOrientation.copyQuaternion(this.observerTransitionEndQuaternion);
    this.transitionController.start(position, target, {
      duration: EARTH_OBSERVER_JOURNEY_DURATION_SECONDS,
      logarithmicDistance: true,
      endFieldOfView: EARTH_OBSERVER_FIELD_OF_VIEW_DEGREES,
    });
  }

  public follow(position: THREE.Vector3): void {
    if (this.observerControl.active) {
      return;
    }
    this.targetTracker.follow(position);
  }

  public update(deltaSeconds: number, time?: UniverseTime): void {
    this.transitionController.update(deltaSeconds);
    if (this.observerControl.active) {
      this.observerControl.update(time);

      return;
    }
    this.zoomController.update(deltaSeconds, this.transitionController.active);

    this.controls.panSpeed = THREE.MathUtils.clamp(this.distanceToTarget / 80, 0.25, 5);
    this.controls.update();
    if (this.observerTransitionPending) {
      this.camera.quaternion.slerpQuaternions(
        this.observerTransitionStartQuaternion,
        this.observerTransitionEndQuaternion,
        this.transitionController.easedProgress,
      );
      this.camera.updateMatrixWorld();
    }
  }

  public zoomBy(factor: number): void {
    if (this.observerControl.zoomBy(factor)) {
      return;
    }
    this.cancelFocus();
    this.zoomController.zoomBy(factor);
  }

  public zoomSemantically(deltaY: number): void {
    if (this.observerControl.zoomBy(Math.exp(deltaY * 0.0015))) {
      return;
    }
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
    this.deactivateObserverModePreservingView();
    this.controls.minDistance = getMinimumNavigationDistance(object);
    this.setTargetInteractionActive(true);
  }

  public trackTarget(position: THREE.Vector3, object: SpaceObject): void {
    this.deactivateObserverModePreservingView();
    this.controls.minDistance = getMinimumNavigationDistance(object);
    this.setTargetInteractionActive(true);
    this.targetTracker.track(position);
  }

  public shiftTrackedPosition(originShift: THREE.Vector3): void {
    this.targetTracker.shift(originShift);
    this.observerControl.shiftOrigin(originShift);
  }

  public rebaseTarget(position: THREE.Vector3, object: SpaceObject): void {
    this.deactivateObserverModePreservingView();
    this.transitionController.cancel();
    this.zoomController.cancelAnchor();
    this.setNavigationConstraints(object);
    this.targetTracker.rebase(position);
    this.controls.update();
  }

  public transitionReferenceFrame(position: THREE.Vector3, object: SpaceObject): void {
    this.deactivateObserverModePreservingView();
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
    this.deactivateObserverModePreservingView();
    this.zoomController.resetJourney();
    this.transitionController.cancel();
    this.trackTarget(position, object);
    this.adoptZoomAnchor(position);
  }

  public cancelFocus(): void {
    this.completeReferenceFrameTransition();
    this.zoomController.reset();
    this.transitionController.cancel();
    this.observerTransitionPending = false;
    this.observerFraming = DEFAULT_EARTH_OBSERVER_FRAMING;
  }

  public releaseTarget(): void {
    const restoreMapInteraction = this.observerPresentationActive;

    this.deactivateObserverModePreservingView();
    this.cancelFocus();
    this.targetTracker.release();
    this.controls.minDistance = FREE_NAVIGATION_MIN_DISTANCE;
    this.setTargetInteractionActive(restoreMapInteraction);
  }

  public dispose(): void {
    this.controls.removeEventListener('start', this.cancelTransition);
    this.controls.removeEventListener('end', this.handleInteractionEnd);
    this.canvas.removeEventListener('touchstart', this.handleTouchStart);
    this.observerControl.dispose();
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
    this.observerTransitionPending = false;
    this.observerFraming = DEFAULT_EARTH_OBSERVER_FRAMING;
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

  private deactivateObserverModePreservingView(): void {
    this.observerTransitionPending = false;
    this.observerFraming = DEFAULT_EARTH_OBSERVER_FRAMING;
    if (!this.observerControl.active) {
      this.controls.enabled = true;

      return;
    }
    const targetDistance = Math.max(this.distanceToTarget, FREE_NAVIGATION_MIN_DISTANCE);

    this.camera.getWorldDirection(this.preservedViewDirection);
    this.observerControl.deactivate();
    this.controls.enabled = true;
    this.controls.target
      .copy(this.camera.position)
      .addScaledVector(this.preservedViewDirection, targetDistance);
    this.controls.update();
  }

  private handleTransitionCompleted(): void {
    if (this.observerTransitionPending) {
      this.observerTransitionPending = false;
      this.observerControl.activate(
        this.camera.position,
        this.controls.target,
        this.observerFraming,
      );
      this.observerFraming = DEFAULT_EARTH_OBSERVER_FRAMING;
      this.controls.enabled = false;
      this.setTargetInteractionActive(false);
    }
    this.onCameraSettled(this.distanceToTarget, 'transition');
  }

  private setTargetInteractionActive(active: boolean): void {
    this.controls.enableRotate = active;
    this.controls.enablePan = active;
  }
}
