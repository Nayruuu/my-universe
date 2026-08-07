import { zoomScaleFromWheelDelta } from '../../../engine/camera/zoom-physics';
import {
  EARTH_OBSERVER_MAXIMUM_FIELD_OF_VIEW_DEGREES,
  EARTH_OBSERVER_MINIMUM_FIELD_OF_VIEW_DEGREES,
} from '../../../engine/camera/earth-observer-view.constants';

export interface EarthSkyViewpoint {
  readonly centerAltitudeDegrees: number;
  readonly centerAzimuthDegrees: number;
  readonly verticalFieldOfViewDegrees: number;
}

interface PointerPosition {
  readonly x: number;
  readonly y: number;
}

const MAXIMUM_ALTITUDE_DEGREES = 85;

export class EarthSkyNavigation {
  private currentViewpoint: EarthSkyViewpoint | null = null;
  private readonly pointers = new Map<number, PointerPosition>();

  public get viewpoint(): EarthSkyViewpoint | null {
    return this.currentViewpoint;
  }

  public initialize(viewpoint: EarthSkyViewpoint): void {
    this.currentViewpoint ??= normalizeViewpoint(viewpoint);
  }

  public recenter(viewpoint: EarthSkyViewpoint): void {
    this.currentViewpoint = normalizeViewpoint(viewpoint);
  }

  public pan(deltaX: number, deltaY: number, width: number, height: number): boolean {
    const viewpoint = this.currentViewpoint;

    if (
      viewpoint === null ||
      !Number.isFinite(deltaX) ||
      !Number.isFinite(deltaY) ||
      !Number.isFinite(width) ||
      !Number.isFinite(height) ||
      width <= 0 ||
      height <= 0 ||
      (deltaX === 0 && deltaY === 0)
    ) {
      return false;
    }
    const degreesPerPixel = viewpoint.verticalFieldOfViewDegrees / height;
    const horizontalScale = Math.max(
      0.25,
      Math.cos((viewpoint.centerAltitudeDegrees * Math.PI) / 180),
    );

    this.currentViewpoint = {
      ...viewpoint,
      centerAltitudeDegrees: clamp(
        viewpoint.centerAltitudeDegrees + deltaY * degreesPerPixel,
        -MAXIMUM_ALTITUDE_DEGREES,
        MAXIMUM_ALTITUDE_DEGREES,
      ),
      centerAzimuthDegrees: normalizeDegrees(
        viewpoint.centerAzimuthDegrees - (deltaX * degreesPerPixel) / horizontalScale,
      ),
    };

    return true;
  }

  public zoomByWheel(deltaY: number): boolean {
    const viewpoint = this.currentViewpoint;

    if (viewpoint === null || !Number.isFinite(deltaY) || deltaY === 0) {
      return false;
    }
    const fieldOfView = clamp(
      viewpoint.verticalFieldOfViewDegrees * zoomScaleFromWheelDelta(deltaY),
      EARTH_OBSERVER_MINIMUM_FIELD_OF_VIEW_DEGREES,
      EARTH_OBSERVER_MAXIMUM_FIELD_OF_VIEW_DEGREES,
    );

    if (fieldOfView === viewpoint.verticalFieldOfViewDegrees) {
      return false;
    }
    this.currentViewpoint = { ...viewpoint, verticalFieldOfViewDegrees: fieldOfView };

    return true;
  }

  public pointerDown(pointerId: number, x: number, y: number): void {
    this.pointers.set(pointerId, { x, y });
  }

  public pointerMove(
    pointerId: number,
    x: number,
    y: number,
    width: number,
    height: number,
  ): boolean {
    const previous = this.pointers.get(pointerId);

    if (!previous) {
      return false;
    }
    const before = [...this.pointers.values()];

    this.pointers.set(pointerId, { x, y });
    if (this.pointers.size === 1) {
      return this.pan(x - previous.x, y - previous.y, width, height);
    }
    const after = [...this.pointers.values()];
    const beforeDistance = distanceBetween(before[0]!, before[1]!);
    const afterDistance = distanceBetween(after[0]!, after[1]!);
    const beforeCenter = midpoint(before[0]!, before[1]!);
    const afterCenter = midpoint(after[0]!, after[1]!);
    const panned = this.pan(
      afterCenter.x - beforeCenter.x,
      afterCenter.y - beforeCenter.y,
      width,
      height,
    );
    const zoomed = this.zoomByPinch(beforeDistance, afterDistance);

    return panned || zoomed;
  }

  public pointerUp(pointerId: number): void {
    this.pointers.delete(pointerId);
  }

  private zoomByPinch(previousDistance: number, currentDistance: number): boolean {
    const viewpoint = this.currentViewpoint;

    if (
      viewpoint === null ||
      previousDistance <= 0 ||
      currentDistance <= 0 ||
      previousDistance === currentDistance
    ) {
      return false;
    }
    const fieldOfView = clamp(
      viewpoint.verticalFieldOfViewDegrees * (previousDistance / currentDistance),
      EARTH_OBSERVER_MINIMUM_FIELD_OF_VIEW_DEGREES,
      EARTH_OBSERVER_MAXIMUM_FIELD_OF_VIEW_DEGREES,
    );

    if (fieldOfView === viewpoint.verticalFieldOfViewDegrees) {
      return false;
    }
    this.currentViewpoint = { ...viewpoint, verticalFieldOfViewDegrees: fieldOfView };

    return true;
  }
}

function normalizeViewpoint(viewpoint: EarthSkyViewpoint): EarthSkyViewpoint {
  return {
    centerAltitudeDegrees: clamp(
      viewpoint.centerAltitudeDegrees,
      -MAXIMUM_ALTITUDE_DEGREES,
      MAXIMUM_ALTITUDE_DEGREES,
    ),
    centerAzimuthDegrees: normalizeDegrees(viewpoint.centerAzimuthDegrees),
    verticalFieldOfViewDegrees: clamp(
      viewpoint.verticalFieldOfViewDegrees,
      EARTH_OBSERVER_MINIMUM_FIELD_OF_VIEW_DEGREES,
      EARTH_OBSERVER_MAXIMUM_FIELD_OF_VIEW_DEGREES,
    ),
  };
}

function distanceBetween(first: PointerPosition, second: PointerPosition): number {
  return Math.hypot(second.x - first.x, second.y - first.y);
}

function midpoint(first: PointerPosition, second: PointerPosition): PointerPosition {
  return { x: (first.x + second.x) / 2, y: (first.y + second.y) / 2 };
}

function normalizeDegrees(value: number): number {
  return ((value % 360) + 360) % 360;
}

function clamp(value: number, minimum: number, maximum: number): number {
  return Math.max(minimum, Math.min(maximum, value));
}
