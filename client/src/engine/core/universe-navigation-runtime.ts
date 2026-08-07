import * as THREE from 'three';
import { type SpaceObject, type ZoomDebugStats } from '../../data/models/universe.models';
import { type NavigationContext, NavigationContextJourney } from '../camera/navigation-context';

export interface NavigationPointer {
  readonly x: number;
  readonly y: number;
}

export interface NavigationCameraController {
  readonly controls: { readonly target: THREE.Vector3 };
  readonly distanceToTarget: number;
  readonly isTransitioning: boolean;
  adoptZoomAnchor(position: THREE.Vector3): void;
  adoptZoomPointer(x: number, y: number): void;
  adoptZoomTarget(position: THREE.Vector3, object: SpaceObject): void;
  trackTarget(position: THREE.Vector3, object: SpaceObject): void;
  zoomSemantically(deltaY: number): void;
  zoomBy(factor: number): void;
  transitionReferenceFrame(position: THREE.Vector3, object: SpaceObject): void;
  releaseTarget(): void;
  follow(position: THREE.Vector3): void;
}

export interface UniverseNavigationBindings {
  hasPrimaryRegistry(): boolean;
  getDefinition(objectId: string): SpaceObject | undefined;
  getWorldPosition(objectId: string, target?: THREE.Vector3): THREE.Vector3 | null;
  setNavigationTarget(objectId: string | null): void;
  selectLodLevel(cameraDistance: number): number;
  emitTargetChanged(objectId: string | null): void;
}

type ZoomAnchor = Pick<ZoomDebugStats, 'anchorType' | 'anchorObjectId'>;

export class UniverseNavigationRuntime {
  private readonly journey: NavigationContextJourney;
  private currentTargetId: string | null = null;
  private zoomAnchor: ZoomAnchor | null = null;

  constructor(private readonly bindings: UniverseNavigationBindings) {
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
  }

  public adoptTarget(objectId: string): void {
    this.currentTargetId = objectId;
    this.journey.adoptTarget(objectId);
    this.bindings.setNavigationTarget(objectId);
  }

  public reset(): void {
    this.currentTargetId = null;
    this.zoomAnchor = null;
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
  ): void {
    if (!controller) {
      return;
    }
    const previousLodLevel = this.bindings.selectLodLevel(controller.distanceToTarget);
    const zoomObjectId =
      deltaY < 0 && controller.isTransitioning && objectId !== this.currentTargetId
        ? null
        : objectId;
    const anchorPosition = zoomObjectId ? this.bindings.getWorldPosition(zoomObjectId) : null;
    const anchorObject = zoomObjectId ? this.bindings.getDefinition(zoomObjectId) : undefined;

    if (!(deltaY < 0)) {
      controller.adoptZoomAnchor(controller.controls.target);
      this.zoomAnchor = {
        anchorType: 'target',
        anchorObjectId: null,
      };
    } else if (anchorPosition) {
      controller.adoptZoomAnchor(anchorPosition);
      this.zoomAnchor = {
        anchorType: 'object',
        anchorObjectId: zoomObjectId,
      };
    } else {
      controller.adoptZoomPointer(pointer.x, pointer.y);
      this.zoomAnchor = {
        anchorType: 'pointer',
        anchorObjectId: null,
      };
    }
    if (zoomObjectId && anchorPosition && anchorObject && deltaY < 0) {
      this.adoptSemanticZoomTarget(zoomObjectId, anchorPosition, anchorObject, controller);
    }
    controller.zoomSemantically(deltaY);
    const nextLodLevel = this.bindings.selectLodLevel(controller.distanceToTarget);

    if (nextLodLevel !== previousLodLevel) {
      this.synchronizeContext(controller, nextLodLevel);
    }
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

  public releaseTarget(controller: NavigationCameraController | null): void {
    controller?.releaseTarget();
    this.bindings.setNavigationTarget(null);
    if (this.currentTargetId === null) {
      return;
    }
    this.currentTargetId = null;
    this.journey.clear();
    this.bindings.emitTargetChanged(null);
  }

  public synchronizeContext(controller: NavigationCameraController, lodLevel: number): void {
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
    controller.transitionReferenceFrame(position, object);
    this.bindings.emitTargetChanged(context.targetId);
  }

  public follow(controller: NavigationCameraController | null): void {
    if (!this.currentTargetId || !this.bindings.hasPrimaryRegistry() || !controller) {
      return;
    }
    const position = this.bindings.getWorldPosition(this.currentTargetId);

    if (position) {
      controller.follow(position);
    }
  }

  private adoptSemanticZoomTarget(
    objectId: string,
    position: THREE.Vector3,
    object: SpaceObject,
    controller: NavigationCameraController,
  ): void {
    if (!this.bindings.hasPrimaryRegistry() || this.currentTargetId === objectId) {
      return;
    }
    this.adoptTarget(objectId);
    controller.trackTarget(position, object);
    this.bindings.emitTargetChanged(objectId);
  }
}
