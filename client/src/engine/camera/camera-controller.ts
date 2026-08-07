import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { SpaceObject, type UniverseTime } from '../../data/models/universe.models';
import {
  FREE_NAVIGATION_MIN_DISTANCE,
  getFocusDistance,
  getLocalNavigationCoordinatePrecision,
  getLocalNavigationDistanceTolerance,
  getMinimumNavigationDistance,
  isAtMinimumNavigationDistance,
  LOCAL_NAVIGATION_DISTANCE_MARGIN_ULPS,
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
  resolveEarthObserverFieldOfView,
  type EarthObserverFraming,
} from './earth-observer-camera-control';
import { EarthObserverOrientation } from './earth-observer-orientation';
import { zoomScaleFromWheelDelta } from './zoom-physics';

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
  private readonly targetApproachPosition = new THREE.Vector3();
  private targetInteractionActive = false;
  private targetApproachMinimumDistance: number | null = null;
  private targetApproachUsesPrecisionFloor = false;
  private targetApproachPrecisionLimited = false;
  private targetApproachPrecisionTolerance = Number.EPSILON;
  private pinchInteractionActive = false;
  private observerTransitionPending = false;
  private observerSkyContentPreserved = false;
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
    this.setFreeNavigationInteractionActive();
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
    return this.observerControl.active || this.targetInteractionActive;
  }

  public get atMinimumNavigationDistance(): boolean {
    return (
      !this.targetApproachActive &&
      isAtMinimumNavigationDistance(
        this.distanceToTarget,
        this.controls.minDistance,
        getLocalNavigationDistanceTolerance(this.camera.position, this.controls.target),
      )
    );
  }

  public get targetApproachReachedPrecisionLimit(): boolean {
    return this.targetApproachPrecisionLimited;
  }

  public get observerModeActive(): boolean {
    return this.observerControl.active;
  }

  public get observerPresentationActive(): boolean {
    return this.observerTransitionPending || this.observerControl.active;
  }

  public get observerSkyContentActive(): boolean {
    return this.observerControl.active || this.observerSkyContentPreserved;
  }

  public get semanticZoomActive(): boolean {
    return this.zoomController.semanticActive;
  }

  public get inwardZoomActive(): boolean {
    return this.zoomController.inwardZoomActive;
  }

  public get minimumTraversalActive(): boolean {
    return this.zoomController.minimumTraversalActive;
  }

  public cancelInwardZoom(): void {
    this.zoomController.cancelInwardZoom();
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
    this.observerSkyContentPreserved = preserveObserverControls;
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
      endFieldOfView: resolveEarthObserverFieldOfView(framing),
    });
  }

  public follow(position: THREE.Vector3): void {
    if (this.observerControl.active) {
      return;
    }
    this.targetTracker.follow(position);
    if (this.targetApproachMinimumDistance !== null) {
      this.targetApproachPosition.copy(position);
      this.updateTargetApproachConstraint(this.targetApproachMinimumDistance);
      this.settleTargetApproachIfReached();
    }
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
    const traverseMinimum = !this.hasActiveTarget;

    if (traverseMinimum && factor < 1) {
      this.zoomController.adoptPointer(0, 0);
    }
    this.zoomController.zoomBy(factor, { traverseMinimum });
  }

  public zoomSemantically(deltaY: number, logarithmicRateMultiplier = 1): void {
    if (this.observerControl.zoomBy(zoomScaleFromWheelDelta(deltaY))) {
      return;
    }
    this.completeReferenceFrameTransition();
    this.transitionController.cancel();
    this.zoomController.zoomSemantically(deltaY, {
      logarithmicRateMultiplier,
      traverseMinimum: !this.hasActiveTarget,
    });
    // Wheel events can arrive before the render loop has called follow() again. Refresh the
    // adaptive approach floor synchronously so a pointer-directed burst cannot reuse a stale
    // constraint and remain pinned above the object's real minimum distance.
    if (this.targetApproachMinimumDistance !== null) {
      this.updateTargetApproachConstraint(this.targetApproachMinimumDistance);
    }
    this.settleTargetApproachIfReached();
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
    this.clearTargetApproach();
    this.controls.minDistance = getMinimumNavigationDistance(object);
    this.setTargetInteractionActive(true);
  }

  public trackTarget(position: THREE.Vector3, object: SpaceObject): void {
    this.deactivateObserverModePreservingView();
    // A new object approach is a new reversible journey. Keeping inward segments from the
    // previous target would make the first reversal retrace the wrong pivot.
    this.zoomController.resetJourney();
    const minimumDistance = getMinimumNavigationDistance(object);

    this.targetApproachPosition.copy(position);
    this.targetApproachMinimumDistance = minimumDistance;
    this.targetApproachPrecisionLimited = false;
    this.setTargetInteractionActive(true);
    this.targetTracker.track(position);
    this.updateTargetApproachConstraint(minimumDistance);
    this.settleTargetApproachIfReached();
  }

  public shiftTrackedPosition(originShift: THREE.Vector3): void {
    this.targetTracker.shift(originShift);
    this.zoomController.shiftOrigin(originShift);
    if (this.targetApproachActive) {
      this.targetApproachPosition.sub(originShift);
    }
    this.observerControl.shiftOrigin(originShift);
  }

  public rebaseTarget(position: THREE.Vector3, object: SpaceObject): void {
    this.deactivateObserverModePreservingView();
    this.transitionController.cancel();
    this.zoomController.cancelAnchor();
    this.zoomController.cancelMinimumTraversal();
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
    this.zoomController.cancelMinimumTraversal();
    this.zoomController.cancelInwardZoom();
    // A reference-frame transition ends on the canonical object, then subsequent pointer zoom is
    // allowed to move the geometric pivot away from it. Track the object's own displacement from
    // that point onward so live time updates preserve, rather than erase, the pointer offset.
    this.targetTracker.track(position);
    this.setNavigationConstraints(object);
    this.transitionController.start(position.clone().add(offset), position, {
      duration: 0.32,
      logarithmicDistance: false,
      completeBeforeInteraction: true,
    });
  }

  public adoptReferenceFrame(position: THREE.Vector3, object: SpaceObject): void {
    this.deactivateObserverModePreservingView();
    this.transitionController.cancel();
    this.clearTargetApproach();
    this.controls.minDistance = getMinimumNavigationDistance(object);
    this.setTargetInteractionActive(true);
    this.targetTracker.track(position);
  }

  public adoptZoomTarget(position: THREE.Vector3, object: SpaceObject): void {
    this.deactivateObserverModePreservingView();
    this.zoomController.resetJourney();
    this.transitionController.cancel();
    this.clearTargetApproach();
    this.controls.minDistance = getMinimumNavigationDistance(object);
    this.setTargetInteractionActive(true);
    this.targetTracker.track(position);
    this.adoptZoomAnchor(position);
  }

  public cancelFocus(): void {
    this.completeReferenceFrameTransition();
    this.zoomController.reset();
    this.transitionController.cancel();
    this.clearTargetApproach();
    this.observerTransitionPending = false;
    this.observerSkyContentPreserved = false;
    this.observerFraming = DEFAULT_EARTH_OBSERVER_FRAMING;
  }

  public releaseTarget(preserveTraversalDistance = false): void {
    this.deactivateObserverModePreservingView();
    this.cancelFocus();
    this.targetTracker.release();
    const releasedDistance = Math.max(this.distanceToTarget, Number.EPSILON);

    this.controls.minDistance = preserveTraversalDistance
      ? releasedDistance
      : Math.min(FREE_NAVIGATION_MIN_DISTANCE, releasedDistance);
    this.setFreeNavigationInteractionActive();
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
    this.clearTargetApproach();
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
    this.zoomController.cancelMinimumTraversal();
    this.clearTargetApproach();
    this.observerTransitionPending = false;
    this.observerSkyContentPreserved = false;
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
    this.observerSkyContentPreserved = false;
    this.observerFraming = DEFAULT_EARTH_OBSERVER_FRAMING;
    if (!this.observerControl.active) {
      this.controls.enabled = true;

      return;
    }
    const targetDistance = Math.max(this.distanceToTarget, FREE_NAVIGATION_MIN_DISTANCE);

    this.camera.getWorldDirection(this.preservedViewDirection);
    this.observerControl.deactivate();
    if (this.camera.fov > EARTH_OBSERVER_FIELD_OF_VIEW_DEGREES) {
      this.camera.fov = EARTH_OBSERVER_FIELD_OF_VIEW_DEGREES;
      this.camera.updateProjectionMatrix();
    }
    this.controls.enabled = true;
    this.controls.target
      .copy(this.camera.position)
      .addScaledVector(this.preservedViewDirection, targetDistance);
    this.controls.update();
  }

  private handleTransitionCompleted(): void {
    if (this.observerTransitionPending) {
      this.observerTransitionPending = false;
      this.observerSkyContentPreserved = false;
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

  private get targetApproachActive(): boolean {
    return this.targetApproachMinimumDistance !== null;
  }

  private updateTargetApproachConstraint(minimumDistance: number): void {
    const distanceToTarget = Math.max(
      this.camera.position.distanceTo(this.targetApproachPosition),
      Number.EPSILON,
    );
    const approachScale = Math.min(1, minimumDistance / distanceToTarget);
    const currentDistance = Math.max(this.distanceToTarget, Number.EPSILON);
    const localCoordinatePrecision = getLocalNavigationCoordinatePrecision(
      this.camera.position,
      this.controls.target,
    );
    const precisionMinimumDistance = Math.min(
      currentDistance,
      localCoordinatePrecision * LOCAL_NAVIGATION_DISTANCE_MARGIN_ULPS,
    );
    const approachMinimumDistance = currentDistance * approachScale;

    this.targetApproachUsesPrecisionFloor = precisionMinimumDistance >= approachMinimumDistance;
    this.targetApproachPrecisionTolerance = getLocalNavigationDistanceTolerance(
      this.camera.position,
      this.controls.target,
    );
    this.controls.minDistance = Math.max(precisionMinimumDistance, approachMinimumDistance);
  }

  private settleTargetApproachIfReached(): void {
    const minimumDistance = this.targetApproachMinimumDistance;

    if (minimumDistance === null) {
      return;
    }
    const distanceToTarget = this.camera.position.distanceTo(this.targetApproachPosition);
    const tolerance = Math.max(Number.EPSILON, minimumDistance * 1e-6);

    if (distanceToTarget > minimumDistance + tolerance) {
      if (
        this.targetApproachUsesPrecisionFloor &&
        this.distanceToTarget <= this.controls.minDistance + this.targetApproachPrecisionTolerance
      ) {
        // The pointer route did not reach the logical object, but camera and orbit pivot cannot be
        // brought closer without losing their direction. End only the adaptive approach so the
        // navigation runtime can release the logical target and continue as reversible free travel.
        this.controls.minDistance = Math.max(this.distanceToTarget, Number.EPSILON);
        this.clearTargetApproach();
        this.targetApproachPrecisionLimited = true;
      }

      return;
    }
    this.preservedViewDirection.copy(this.camera.position).sub(this.targetApproachPosition);
    if (this.preservedViewDirection.lengthSq() <= Number.EPSILON) {
      this.preservedViewDirection.copy(this.camera.position).sub(this.controls.target);
    }
    if (this.preservedViewDirection.lengthSq() <= Number.EPSILON) {
      this.preservedViewDirection.set(0, 0, 1);
    }
    this.preservedViewDirection.setLength(minimumDistance);
    this.camera.position.copy(this.targetApproachPosition).add(this.preservedViewDirection);
    this.controls.target.copy(this.targetApproachPosition);
    this.controls.minDistance = minimumDistance;
    this.targetTracker.reset(this.targetApproachPosition);
    this.zoomController.cancelMinimumTraversal();
    this.clearTargetApproach();
    this.controls.update();
  }

  private clearTargetApproach(): void {
    this.targetApproachMinimumDistance = null;
    this.targetApproachUsesPrecisionFloor = false;
    this.targetApproachPrecisionLimited = false;
    this.targetApproachPrecisionTolerance = Number.EPSILON;
  }

  private setTargetInteractionActive(active: boolean): void {
    this.targetInteractionActive = active;
    this.controls.enableRotate = active;
    this.controls.enablePan = active;
    this.controls.mouseButtons.LEFT = THREE.MOUSE.ROTATE;
    this.controls.mouseButtons.RIGHT = THREE.MOUSE.PAN;
    this.controls.touches.ONE = THREE.TOUCH.ROTATE;
    this.controls.touches.TWO = THREE.TOUCH.DOLLY_PAN;
  }

  private setFreeNavigationInteractionActive(): void {
    this.targetInteractionActive = false;
    this.controls.enableRotate = true;
    this.controls.enablePan = true;
    this.controls.mouseButtons.LEFT = THREE.MOUSE.ROTATE;
    this.controls.mouseButtons.RIGHT = THREE.MOUSE.PAN;
    this.controls.touches.ONE = THREE.TOUCH.ROTATE;
    this.controls.touches.TWO = THREE.TOUCH.DOLLY_PAN;
  }
}
