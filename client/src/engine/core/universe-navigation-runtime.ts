import * as THREE from 'three';
import { type SpaceObject, type ZoomDebugStats } from '../../data/models/universe.models';
import { type NavigationContext, NavigationContextJourney } from '../camera/navigation-context';
import {
  GALACTIC_APPROACH_ZOOM_RATE_MULTIPLIER,
  sampleGalacticApproach,
} from '../camera/galactic-approach';
import {
  ACTIVE_TARGET_POINTER_ZOOM_MAXIMUM_MULTIPLIER,
  getActiveTargetPointerZoomMultiplier,
} from '../camera/navigation-policy';

export interface NavigationPointer {
  readonly x: number;
  readonly y: number;
}

export interface NavigationCameraController {
  readonly controls: { readonly target: THREE.Vector3; readonly minDistance: number };
  readonly distanceToTarget: number;
  readonly atMinimumNavigationDistance: boolean;
  readonly targetApproachReachedPrecisionLimit: boolean;
  readonly inwardZoomActive: boolean;
  readonly isTransitioning: boolean;
  readonly minimumTraversalActive: boolean;
  readonly observerPresentationActive: boolean;
  readonly semanticZoomActive: boolean;
  cancelInwardZoom(): void;
  adoptZoomAnchor(position: THREE.Vector3): void;
  adoptZoomPointer(x: number, y: number): void;
  adoptZoomTarget(position: THREE.Vector3, object: SpaceObject): void;
  trackTarget(position: THREE.Vector3, object: SpaceObject): void;
  zoomSemantically(
    deltaY: number,
    logarithmicRateMultiplier?: number,
    allowMinimumTraversal?: boolean,
  ): void;
  zoomBy(factor: number): void;
  adoptReferenceFrame(position: THREE.Vector3, object: SpaceObject): void;
  transitionReferenceFrame(position: THREE.Vector3, object: SpaceObject): void;
  releaseTarget(preserveTraversalDistance?: boolean): void;
  follow(
    position: THREE.Vector3,
    viewElevation?: number,
    viewElevationMode?: 'damped' | 'distance',
  ): void;
}

export interface UniverseNavigationBindings {
  hasPrimaryRegistry(): boolean;
  getDefinition(objectId: string): SpaceObject | undefined;
  getWorldPosition(objectId: string, target?: THREE.Vector3): THREE.Vector3 | null;
  setNavigationTarget(objectId: string | null): void;
  selectLodLevel(cameraDistance: number): number;
  emitTargetChanged(objectId: string | null): void;
}

export interface UniverseNavigationRuntimeOptions {
  readonly activeTargetPointerZoomMaximumMultiplier?: number;
}

type ZoomAnchor = Pick<ZoomDebugStats, 'anchorType' | 'anchorObjectId'>;

interface WheelTarget {
  readonly objectId: string;
  readonly position: THREE.Vector3;
  readonly object: SpaceObject;
}

export type NavigationZoomDecision =
  | 'ignored'
  | 'zoom-pointer'
  | 'zoom-current-target'
  | 'zoom-object'
  | 'adopt-wheel-target'
  | 'release-target'
  | 'bypass-wheel-target'
  | 'continue-free-journey';

export class UniverseNavigationRuntime {
  private readonly journey: NavigationContextJourney;
  private readonly activeTargetPointerZoomMaximumMultiplier: number;
  private currentTargetId: string | null = null;
  private releasedTraversalTargetId: string | null = null;
  private zoomAnchor: ZoomAnchor | null = null;
  private readonly galacticApproachPosition = new THREE.Vector3();
  private readonly galacticPosition = new THREE.Vector3();
  private readonly stellarPosition = new THREE.Vector3();
  private readonly followedTargetPosition = new THREE.Vector3();
  private minimumTraversalArmedForWheelGesture = false;

  constructor(
    private readonly bindings: UniverseNavigationBindings,
    options: UniverseNavigationRuntimeOptions = {},
  ) {
    this.activeTargetPointerZoomMaximumMultiplier =
      options.activeTargetPointerZoomMaximumMultiplier ??
      ACTIVE_TARGET_POINTER_ZOOM_MAXIMUM_MULTIPLIER;
    this.journey = new NavigationContextJourney((objectId) =>
      this.bindings.getDefinition(objectId),
    );
  }

  public get targetId(): string | null {
    return this.currentTargetId;
  }

  public get lastZoomAnchor(): ZoomAnchor | null {
    return this.zoomAnchor;
  }

  public restoreTarget(objectId: string | null): void {
    this.currentTargetId = objectId;
    this.releasedTraversalTargetId = null;
  }

  public adoptTarget(objectId: string): void {
    this.setTarget(objectId);
  }

  public reset(): void {
    this.currentTargetId = null;
    this.releasedTraversalTargetId = null;
    this.zoomAnchor = null;
    this.minimumTraversalArmedForWheelGesture = false;
    this.journey.clear();
  }

  public resolveContext(lodLevel: number): NavigationContext {
    return this.journey.resolve(lodLevel);
  }

  public zoomBy(controller: NavigationCameraController | null, factor: number): void {
    if (!controller) {
      return;
    }
    const previousLodLevel = this.bindings.selectLodLevel(controller.distanceToTarget);

    controller.zoomBy(factor);
    const nextLodLevel = this.bindings.selectLodLevel(controller.distanceToTarget);

    if (nextLodLevel !== previousLodLevel) {
      this.synchronizeContext(controller, nextLodLevel);
    }
  }

  public handleSemanticZoomIntent(
    controller: NavigationCameraController | null,
    objectId: string | null,
    deltaY: number,
    pointer: NavigationPointer = { x: 0, y: 0 },
    startsWheelAnchor = true,
    startsWheelGesture?: boolean,
  ): NavigationZoomDecision {
    if (!controller) {
      return 'ignored';
    }
    if (deltaY !== 0 && startsWheelGesture === true) {
      // Reaching the magnification floor and entering free travel are two distinct navigation
      // intentions. Arm traversal only when a wheel gesture starts at that floor; otherwise the
      // current burst settles there and a resumed gesture can deliberately continue through it.
      this.minimumTraversalArmedForWheelGesture =
        controller.atMinimumNavigationDistance || controller.minimumTraversalActive;
    }
    const minimumTraversalWasActive = controller.minimumTraversalActive;

    if (!minimumTraversalWasActive) {
      this.releasedTraversalTargetId = null;
    }
    const galacticApproach = this.resolveGalacticApproach(controller.distanceToTarget);
    // Once the Milky Way -> stellar journey has started, incidental objects passing below the
    // pointer must not replace its pivot. Otherwise the same wheel gesture produces a different
    // camera path depending on which label or point happens to cross the cursor, and the apparent
    // reference-frame transition reads as a cut. Explicit clicks still select another object via
    // handleNavigationIntent().
    const wheelTarget = galacticApproach
      ? null
      : this.resolveWheelTarget(controller, objectId, deltaY, startsWheelAnchor);
    const startsFreeForwardZoom =
      deltaY < 0 &&
      wheelTarget === null &&
      this.currentTargetId !== null &&
      controller.atMinimumNavigationDistance &&
      !controller.observerPresentationActive &&
      !controller.semanticZoomActive;

    if (startsFreeForwardZoom) {
      this.releaseTarget(controller, !controller.targetApproachReachedPrecisionLimit);
    }
    const previousLodLevel = this.bindings.selectLodLevel(controller.distanceToTarget);
    const reversesFreeZoomJourney =
      wheelTarget === null &&
      deltaY < 0 &&
      controller.semanticZoomActive &&
      this.currentTargetId === null;
    const objectDecision = wheelTarget
      ? this.applyWheelTarget(controller, wheelTarget, startsWheelAnchor)
      : null;

    if (!wheelTarget) {
      if (galacticApproach) {
        controller.adoptZoomAnchor(galacticApproach.position);
        this.zoomAnchor = {
          anchorType: 'target',
          anchorObjectId: this.currentTargetId,
        };
      } else {
        controller.adoptZoomPointer(pointer.x, pointer.y);
        this.zoomAnchor = {
          anchorType: 'pointer',
          anchorObjectId: null,
        };
      }
    }

    const usesAcceleratedActiveTargetPointerZoom =
      wheelTarget === null &&
      (objectId === null || deltaY >= 0) &&
      this.currentTargetId !== null &&
      galacticApproach === null &&
      !controller.observerPresentationActive;

    if (galacticApproach) {
      controller.zoomSemantically(deltaY, GALACTIC_APPROACH_ZOOM_RATE_MULTIPLIER);
    } else if (usesAcceleratedActiveTargetPointerZoom) {
      controller.zoomSemantically(
        deltaY,
        getActiveTargetPointerZoomMultiplier(
          controller.distanceToTarget,
          controller.controls.minDistance,
          this.activeTargetPointerZoomMaximumMultiplier,
        ),
      );
    } else {
      const settlesFreeGestureAtMinimum =
        startsWheelGesture !== undefined &&
        deltaY < 0 &&
        !this.minimumTraversalArmedForWheelGesture &&
        wheelTarget === null &&
        this.currentTargetId === null &&
        !controller.semanticZoomActive &&
        !controller.minimumTraversalActive &&
        !controller.observerPresentationActive;

      if (settlesFreeGestureAtMinimum) {
        controller.zoomSemantically(deltaY, 1, false);
      } else {
        controller.zoomSemantically(deltaY);
      }
    }
    if (
      deltaY > 0 &&
      minimumTraversalWasActive &&
      !controller.minimumTraversalActive &&
      this.releasedTraversalTargetId !== null
    ) {
      this.restoreReleasedTraversalTarget(controller, this.releasedTraversalTargetId);
    }
    const nextLodLevel = this.bindings.selectLodLevel(controller.distanceToTarget);

    if (nextLodLevel !== previousLodLevel) {
      this.synchronizeContext(controller, nextLodLevel, true);
    }

    return startsFreeForwardZoom
      ? 'release-target'
      : objectDecision
        ? objectDecision
        : reversesFreeZoomJourney
          ? 'continue-free-journey'
          : objectId !== null && deltaY < 0
            ? 'bypass-wheel-target'
            : 'zoom-pointer';
  }

  public handleNavigationIntent(
    controller: NavigationCameraController | null,
    objectId: string | null,
  ): void {
    if (!objectId) {
      this.releaseTarget(controller);

      return;
    }
    const position = this.bindings.getWorldPosition(objectId);
    const object = this.bindings.getDefinition(objectId);

    if (!this.bindings.hasPrimaryRegistry() || !controller || !position || !object) {
      return;
    }
    const targetChanged = this.currentTargetId !== objectId;

    this.adoptTarget(objectId);
    controller.adoptZoomTarget(position, object);
    if (targetChanged) {
      this.bindings.emitTargetChanged(objectId);
    }
  }

  public releaseTarget(
    controller: NavigationCameraController | null,
    preserveTraversalDistance = false,
  ): void {
    this.releasedTraversalTargetId = preserveTraversalDistance ? this.currentTargetId : null;
    if (preserveTraversalDistance) {
      controller?.releaseTarget(true);
    } else {
      controller?.releaseTarget();
    }
    this.bindings.setNavigationTarget(null);
    if (this.currentTargetId === null) {
      return;
    }
    this.currentTargetId = null;
    this.journey.clear();
    this.bindings.emitTargetChanged(null);
  }

  public synchronizeContext(
    controller: NavigationCameraController,
    lodLevel: number,
    preservePivot = false,
  ): void {
    let context = this.journey.resolve(lodLevel);

    if (!context.targetId && this.currentTargetId) {
      this.journey.adoptTarget(this.currentTargetId);
      context = this.journey.resolve(lodLevel);
    }
    if (!context.targetId || context.targetId === this.currentTargetId) {
      return;
    }
    const object = this.bindings.getDefinition(context.targetId);
    const position = this.bindings.getWorldPosition(context.targetId);

    if (!object || !position) {
      return;
    }
    this.currentTargetId = context.targetId;
    this.bindings.setNavigationTarget(context.targetId);
    if (preservePivot) {
      const approach = this.resolveGalacticApproach(controller.distanceToTarget);

      controller.adoptReferenceFrame(approach?.position ?? position, object);
    } else {
      controller.transitionReferenceFrame(position, object);
    }
    this.bindings.emitTargetChanged(context.targetId);
  }

  public follow(controller: NavigationCameraController | null): void {
    if (!this.currentTargetId || !this.bindings.hasPrimaryRegistry() || !controller) {
      return;
    }
    if (this.followGalacticApproach(controller)) {
      return;
    }
    const position = this.bindings.getWorldPosition(
      this.currentTargetId,
      this.followedTargetPosition,
    );

    if (position) {
      controller.follow(position);
    }
  }

  /** Refreshes the distance-driven guide every render frame without retargeting ordinary views. */
  public updateCameraGuide(controller: NavigationCameraController | null): void {
    if (controller) {
      this.followGalacticApproach(controller);
    }
  }

  private followGalacticApproach(controller: NavigationCameraController): boolean {
    const approach = this.resolveGalacticApproach(controller.distanceToTarget);

    // Reaching the Milky Way through search or a direct focus must end on a stable Galactic
    // centre. The centre-to-Sun choreography begins with the next inward zoom gesture; running
    // it immediately after the focus transition caused an unsolicited sideways drift and pitch
    // correction on arrival.
    if (!approach || (!controller.semanticZoomActive && !controller.inwardZoomActive)) {
      return false;
    }
    controller.follow(approach.position, approach.viewElevation, 'distance');

    return true;
  }

  private resolveGalacticApproach(
    cameraDistance: number,
  ): { readonly position: THREE.Vector3; readonly viewElevation: number } | null {
    const galaxyTargetId = this.journey.resolve(3).targetId;
    const stellarTargetId = this.journey.resolve(2).targetId;

    if (galaxyTargetId !== 'milky-way' || !stellarTargetId) {
      return null;
    }
    const sample = sampleGalacticApproach(cameraDistance);

    if (!sample.active) {
      return null;
    }
    const galaxyPosition = this.bindings.getWorldPosition(galaxyTargetId, this.galacticPosition);
    const stellarPosition = this.bindings.getWorldPosition(stellarTargetId, this.stellarPosition);

    if (!galaxyPosition || !stellarPosition) {
      return null;
    }

    return {
      position: this.galacticApproachPosition.lerpVectors(
        galaxyPosition,
        stellarPosition,
        sample.pivotProgress,
      ),
      viewElevation: sample.viewElevation,
    };
  }

  private setTarget(objectId: string): void {
    this.currentTargetId = objectId;
    this.releasedTraversalTargetId = null;
    this.journey.adoptTarget(objectId);
    this.bindings.setNavigationTarget(objectId);
  }

  private resolveWheelTarget(
    controller: NavigationCameraController,
    objectId: string | null,
    deltaY: number,
    startsWheelAnchor: boolean,
  ): WheelTarget | null {
    if (
      deltaY >= 0 ||
      objectId === null ||
      controller.observerPresentationActive ||
      (controller.isTransitioning && startsWheelAnchor && objectId !== this.currentTargetId) ||
      !this.bindings.hasPrimaryRegistry()
    ) {
      return null;
    }
    const position = this.bindings.getWorldPosition(objectId);
    const object = this.bindings.getDefinition(objectId);

    return position && object ? { objectId, position, object } : null;
  }

  private applyWheelTarget(
    controller: NavigationCameraController,
    wheelTarget: WheelTarget,
    startsWheelAnchor: boolean,
  ): NavigationZoomDecision {
    const adoptsTarget = startsWheelAnchor && this.currentTargetId !== wheelTarget.objectId;

    // Hand the tracked object to the controller before adopting its zoom anchor. A Galactic
    // approach can still be converging on the Sun for a few frames after its distance interval;
    // the new target must cancel that guide before the anchor is resolved, otherwise the first
    // stellar frame combines the old Solar pivot with the new star tracking baseline.
    if (adoptsTarget) {
      this.setTarget(wheelTarget.objectId);
      controller.trackTarget(wheelTarget.position, wheelTarget.object);
      this.bindings.emitTargetChanged(wheelTarget.objectId);
    }
    controller.adoptZoomAnchor(wheelTarget.position);
    this.zoomAnchor = {
      anchorType: 'object',
      anchorObjectId: wheelTarget.objectId,
    };
    if (adoptsTarget) {
      return 'adopt-wheel-target';
    }

    return this.currentTargetId === wheelTarget.objectId ? 'zoom-current-target' : 'zoom-object';
  }

  private restoreReleasedTraversalTarget(
    controller: NavigationCameraController,
    objectId: string,
  ): void {
    const object = this.bindings.getDefinition(objectId);
    const position = this.bindings.getWorldPosition(objectId);

    this.releasedTraversalTargetId = null;
    if (!object || !position) {
      return;
    }
    this.setTarget(objectId);
    controller.adoptReferenceFrame(position, object);
    this.bindings.emitTargetChanged(objectId);
  }
}
