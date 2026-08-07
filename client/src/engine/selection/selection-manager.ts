import * as THREE from 'three';
import { PICKING_LAYER } from './selection-layers';

export type SelectionCallback = (objectId: string | null, focusRequested: boolean) => void;
export type NavigationIntentCallback = (objectId: string | null) => void;
export type BackgroundObjectReader = (objectId: string) => boolean;
export type LabelObjectReader = (clientX: number, clientY: number) => string | null;
export type LabelHoverCallback = (objectId: string | null) => void;
export interface ZoomPointer {
  x: number;
  y: number;
}
export type SemanticZoomCallback = (
  objectId: string | null,
  deltaY: number,
  pointer: ZoomPointer,
) => void;

export class SelectionManager {
  private static readonly NAVIGATION_LOCK_RADIUS_PX = 28;
  private static readonly HOVER_RAYCAST_INTERVAL_MS = 90;

  private readonly raycaster = new THREE.Raycaster();
  private readonly pointer = new THREE.Vector2();
  private readonly intersections: THREE.Intersection[] = [];
  private readonly activePointers = new Set<number>();
  private pointerStart: { x: number; y: number } | null = null;
  private navigationLock: { objectId: string; x: number; y: number } | null = null;
  private lastWheelDirection: -1 | 1 | null = null;
  private lastHoverRaycastTime = Number.NEGATIVE_INFINITY;

  constructor(
    private readonly canvas: HTMLCanvasElement,
    private readonly camera: THREE.Camera,
    private readonly getPickables: () => readonly THREE.Object3D[],
    private readonly getLabelObjectAt: LabelObjectReader,
    private readonly callback: SelectionCallback,
    private readonly navigationIntentCallback: NavigationIntentCallback,
    private readonly getReferenceDistance: () => number,
    private readonly isBackgroundObject: BackgroundObjectReader,
    private readonly labelHoverCallback: LabelHoverCallback = () => undefined,
    private readonly semanticZoomCallback?: SemanticZoomCallback,
    private readonly isWheelNavigationObject: BackgroundObjectReader = () => true,
  ) {
    this.raycaster.params.Points = { threshold: 3 };
    this.raycaster.params.Line = { threshold: 1 };
    this.raycaster.layers.set(PICKING_LAYER);
    canvas.addEventListener('pointerdown', this.handlePointerDown);
    canvas.addEventListener('pointerup', this.handlePointerUp);
    canvas.addEventListener('pointercancel', this.handlePointerCancel);
    canvas.addEventListener('pointermove', this.handlePointerMove);
    canvas.addEventListener('pointerleave', this.handlePointerLeave);
    canvas.addEventListener('dblclick', this.handleDoubleClick);
    canvas.addEventListener('wheel', this.handleWheel, { capture: true, passive: false });
  }

  public dispose(): void {
    this.canvas.removeEventListener('pointerdown', this.handlePointerDown);
    this.canvas.removeEventListener('pointerup', this.handlePointerUp);
    this.canvas.removeEventListener('pointercancel', this.handlePointerCancel);
    this.canvas.removeEventListener('pointermove', this.handlePointerMove);
    this.canvas.removeEventListener('pointerleave', this.handlePointerLeave);
    this.canvas.removeEventListener('dblclick', this.handleDoubleClick);
    this.canvas.removeEventListener('wheel', this.handleWheel, { capture: true });
    this.labelHoverCallback(null);
    this.canvas.style.cursor = '';
  }

  public clearNavigationLock(): void {
    this.navigationLock = null;
    this.lastWheelDirection = null;
  }

  private readonly handlePointerDown = (event: PointerEvent): void => {
    this.activePointers.add(event.pointerId);
    if (event.button === 2) {
      this.pointerStart = null;
      this.navigationLock = null;
      this.navigationIntentCallback(null);

      return;
    }
    if (this.activePointers.size > 1) {
      this.pointerStart = null;
      this.navigationLock = null;

      return;
    }
    if (isPrimaryActivation(event) && this.activePointers.size === 1) {
      this.pointerStart = { x: event.clientX, y: event.clientY };
    }
  };

  private readonly handlePointerUp = (event: PointerEvent): void => {
    this.activePointers.delete(event.pointerId);
    if (!this.pointerStart || !isPrimaryActivation(event)) {
      this.pointerStart = null;

      return;
    }
    const distance = Math.hypot(
      event.clientX - this.pointerStart.x,
      event.clientY - this.pointerStart.y,
    );

    this.pointerStart = null;
    if (distance <= 6) {
      this.pick(event, false);
    }
  };

  private readonly handlePointerCancel = (event: PointerEvent): void => {
    this.activePointers.delete(event.pointerId);
    this.pointerStart = null;
  };

  private readonly handlePointerMove = (event: PointerEvent): void => {
    if (this.activePointers.size > 0) {
      return;
    }
    const labelObjectId = this.getLabelObjectAt(event.clientX, event.clientY);

    if (labelObjectId) {
      this.labelHoverCallback(labelObjectId);
      this.canvas.style.cursor = 'pointer';

      return;
    }
    if (event.timeStamp - this.lastHoverRaycastTime < SelectionManager.HOVER_RAYCAST_INTERVAL_MS) {
      return;
    }
    this.lastHoverRaycastTime = event.timeStamp;
    const raycastObjectId = this.findRaycastObjectAt(event);

    this.labelHoverCallback(raycastObjectId);
    this.canvas.style.cursor = raycastObjectId ? 'pointer' : '';
  };

  private readonly handlePointerLeave = (): void => {
    this.labelHoverCallback(null);
    this.canvas.style.cursor = '';
  };

  private readonly handleDoubleClick = (event: MouseEvent): void => {
    this.pick(event, true);
  };

  private readonly handleWheel = (event: WheelEvent): void => {
    if (this.semanticZoomCallback) {
      event.preventDefault();
      event.stopImmediatePropagation();
    } else if (event.deltaY >= 0) {
      return;
    }

    const direction = event.deltaY === 0 ? null : event.deltaY < 0 ? -1 : 1;

    if (
      direction !== null &&
      this.lastWheelDirection !== null &&
      direction !== this.lastWheelDirection
    ) {
      this.navigationLock = null;
    }
    this.lastWheelDirection = direction ?? this.lastWheelDirection;
    const objectId = this.resolveWheelAnchor(event);

    if (this.semanticZoomCallback) {
      this.semanticZoomCallback(objectId, event.deltaY, this.getZoomPointer(event));

      return;
    }
    this.navigationIntentCallback(objectId);
  };

  private getZoomPointer(event: { clientX: number; clientY: number }): ZoomPointer {
    const bounds = this.canvas.getBoundingClientRect();

    return {
      x: ((event.clientX - bounds.left) / bounds.width) * 2 - 1,
      y: -((event.clientY - bounds.top) / bounds.height) * 2 + 1,
    };
  }

  private resolveWheelAnchor(event: WheelEvent): string | null {
    if (
      this.navigationLock &&
      Math.hypot(event.clientX - this.navigationLock.x, event.clientY - this.navigationLock.y) <=
        SelectionManager.NAVIGATION_LOCK_RADIUS_PX
    ) {
      return this.navigationLock.objectId;
    }

    const objectId = this.findWheelObjectAt(event);

    if (objectId) {
      this.navigationLock = {
        objectId,
        x: event.clientX,
        y: event.clientY,
      };
    } else {
      this.navigationLock = null;
    }

    return objectId;
  }

  private findWheelObjectAt(event: { clientX: number; clientY: number }): string | null {
    const labelObjectId = this.getLabelObjectAt(event.clientX, event.clientY);

    return (
      labelObjectId ??
      this.findRaycastObjectAt(event, (objectId) => this.isWheelNavigationObject(objectId))
    );
  }

  private pick(event: MouseEvent | PointerEvent, focusRequested: boolean): void {
    const labelObjectId = this.getLabelObjectAt(event.clientX, event.clientY);
    const objectId = labelObjectId ?? this.findRaycastObjectAt(event);
    const shouldFocus = focusRequested || labelObjectId !== null;

    this.callback(objectId, shouldFocus);
    if (objectId && shouldFocus) {
      this.navigationLock = {
        objectId,
        x: event.clientX,
        y: event.clientY,
      };
    }
  }

  private findObjectAt(event: { clientX: number; clientY: number }): string | null {
    return this.getLabelObjectAt(event.clientX, event.clientY) ?? this.findRaycastObjectAt(event);
  }

  private findRaycastObjectAt(
    event: { clientX: number; clientY: number },
    acceptsObject: BackgroundObjectReader = () => true,
  ): string | null {
    const bounds = this.canvas.getBoundingClientRect();

    this.pointer.x = ((event.clientX - bounds.left) / bounds.width) * 2 - 1;
    this.pointer.y = -((event.clientY - bounds.top) / bounds.height) * 2 + 1;
    this.raycaster.setFromCamera(this.pointer, this.camera);
    this.updateRaycastThresholds(bounds.height);

    this.intersections.length = 0;
    this.raycaster.intersectObjects(
      this.getPickables() as THREE.Object3D[],
      true,
      this.intersections,
    );
    let backgroundObjectId: string | null = null;
    let backgroundPriority = Number.NEGATIVE_INFINITY;

    for (const intersection of this.intersections) {
      const objectId = resolveObjectId(intersection);

      if (!objectId || !acceptsObject(objectId)) {
        continue;
      }
      if (!this.isBackgroundObject(objectId)) {
        return objectId;
      }
      const pickingPriority = resolvePickingPriority(intersection);

      if (pickingPriority > backgroundPriority) {
        backgroundObjectId = objectId;
        backgroundPriority = pickingPriority;
      }
    }

    return backgroundObjectId;
  }

  private updateRaycastThresholds(viewportHeight: number): void {
    if (!(this.camera instanceof THREE.PerspectiveCamera) || viewportHeight <= 0) {
      return;
    }
    const distance = Math.max(this.getReferenceDistance(), 0.1);
    const halfFieldOfView = THREE.MathUtils.degToRad(this.camera.fov / 2);
    const worldUnitsPerPixel = (2 * distance * Math.tan(halfFieldOfView)) / viewportHeight;

    this.raycaster.params.Points = {
      threshold: Math.max(0.5, worldUnitsPerPixel * 7),
    };
    this.raycaster.params.Line = {
      threshold: Math.max(0.2, worldUnitsPerPixel * 5),
    };
  }
}

function resolvePickingPriority(intersection: THREE.Intersection): number {
  const priority = intersection.object.userData['pickingPriority'];

  return typeof priority === 'number' ? priority : 0;
}

export function resolveObjectId(intersection: THREE.Intersection): string | null {
  const directId = intersection.object.userData['objectId'];

  if (typeof directId === 'string') {
    return directId;
  }

  const index = intersection.index;
  const objectIds = intersection.object.userData['objectIds'];
  const objectIndices = intersection.object.userData['objectIndices'];
  const visibleIndices = intersection.object.userData['visibleIndices'];

  if (
    typeof index !== 'number' ||
    !Array.isArray(objectIds) ||
    !(visibleIndices instanceof Uint8Array) ||
    visibleIndices[index] !== 1
  ) {
    return null;
  }
  const objectIndex =
    objectIndices instanceof Uint16Array || objectIndices instanceof Uint32Array
      ? objectIndices[index]
      : index;
  const batchedId: unknown = typeof objectIndex === 'number' ? objectIds[objectIndex] : undefined;

  return typeof batchedId === 'string' ? batchedId : null;
}

function isPrimaryActivation(event: PointerEvent): boolean {
  if (event.pointerType === 'touch' || event.pointerType === 'pen') {
    return event.isPrimary;
  }

  return event.button === 0;
}
