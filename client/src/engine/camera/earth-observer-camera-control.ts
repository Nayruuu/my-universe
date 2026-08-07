import * as THREE from 'three';
import type { UniverseTime } from '../../data/models/universe.models';
import {
  DEFAULT_EARTH_OBSERVER_FRAMING,
  EarthObserverOrientation,
  type EarthObserverFraming,
  type EarthObserverReferenceFrameProvider,
} from './earth-observer-orientation';

export {
  DEFAULT_EARTH_OBSERVER_FRAMING,
  DEFAULT_EARTH_OBSERVER_PITCH_LIMITS,
  type EarthObserverFraming,
  type EarthObserverPitchLimits,
  type EarthObserverReferenceFrame,
  type EarthObserverReferenceFrameProvider,
} from './earth-observer-orientation';

const ROTATION_RADIANS_PER_PIXEL = 0.0032;
const MINIMUM_FIELD_OF_VIEW_DEGREES = 24;
const MAXIMUM_FIELD_OF_VIEW_DEGREES = 82;

export const EARTH_OBSERVER_FIELD_OF_VIEW_DEGREES = 82;
export const EARTH_OBSERVER_JOURNEY_DURATION_SECONDS = 2.4;
export const EARTH_OBSERVER_VIEW_EVENT = 'universe-earth-observer-view';

export interface EarthObserverViewState {
  readonly active: boolean;
  readonly pitchOffsetDegrees: number;
  readonly azimuthOffsetDegrees: number;
  readonly verticalFieldOfViewDegrees: number;
  readonly centerAltitudeDegrees?: number;
  readonly centerAzimuthDegrees?: number;
}

export class EarthObserverCameraControl {
  private readonly anchor = new THREE.Vector3();
  private readonly direction = new THREE.Vector3();
  private readonly fallbackUp = new THREE.Vector3();
  private readonly orientation = new EarthObserverOrientation();
  private enabled = false;
  private pointerId: number | null = null;
  private previousPointerX = 0;
  private previousPointerY = 0;
  private referenceFrameProvider: EarthObserverReferenceFrameProvider | null = null;
  private referenceFrameJulianDay = Number.NaN;

  constructor(
    private readonly camera: THREE.PerspectiveCamera,
    private readonly canvas: HTMLCanvasElement,
  ) {
    this.canvas.addEventListener('pointerdown', this.handlePointerDown);
    this.canvas.addEventListener('pointermove', this.handlePointerMove);
    this.canvas.addEventListener('pointerup', this.handlePointerEnd);
    this.canvas.addEventListener('pointercancel', this.handlePointerEnd);
    this.canvas.addEventListener('wheel', this.handleWheel, { capture: true, passive: false });
  }

  public get active(): boolean {
    return this.enabled;
  }

  public activate(
    position: THREE.Vector3,
    target: THREE.Vector3,
    framing: EarthObserverFraming = DEFAULT_EARTH_OBSERVER_FRAMING,
  ): void {
    this.anchor.copy(position);
    this.direction.subVectors(target, position);
    if (this.direction.lengthSq() < Number.EPSILON) {
      this.camera.getWorldDirection(this.direction);
    }
    this.direction.normalize();
    this.fallbackUp.set(0, 1, 0).applyQuaternion(this.camera.quaternion);
    this.orientation.configure(this.direction, this.fallbackUp, framing);
    this.referenceFrameProvider = framing.resolveReferenceFrame ?? null;
    this.referenceFrameJulianDay = Number.NaN;
    this.enabled = true;
    this.applyView();
  }

  public update(time?: UniverseTime): void {
    if (!this.enabled) {
      return;
    }
    if (time && this.referenceFrameProvider && time.julianDay !== this.referenceFrameJulianDay) {
      this.referenceFrameJulianDay = time.julianDay;
      const frame = this.referenceFrameProvider(time);

      if (frame && this.orientation.updateReferenceFrame(frame)) {
        this.applyView();

        return;
      }
    }
    this.camera.position.copy(this.anchor);
  }

  public zoomBy(factor: number): boolean {
    if (!this.enabled || !Number.isFinite(factor) || factor <= 0) {
      return false;
    }
    this.setFieldOfView(this.camera.fov * factor);

    return true;
  }

  public shiftOrigin(originShift: THREE.Vector3): void {
    this.anchor.sub(originShift);
    if (this.enabled) {
      this.camera.position.copy(this.anchor);
    }
  }

  public deactivate(): void {
    if (!this.enabled) {
      return;
    }
    this.enabled = false;
    this.pointerId = null;
    this.referenceFrameProvider = null;
    this.referenceFrameJulianDay = Number.NaN;
    this.publishViewState();
  }

  public dispose(): void {
    this.deactivate();
    this.canvas.removeEventListener('pointerdown', this.handlePointerDown);
    this.canvas.removeEventListener('pointermove', this.handlePointerMove);
    this.canvas.removeEventListener('pointerup', this.handlePointerEnd);
    this.canvas.removeEventListener('pointercancel', this.handlePointerEnd);
    this.canvas.removeEventListener('wheel', this.handleWheel, { capture: true });
  }

  private readonly handlePointerDown = (event: PointerEvent): void => {
    if (!this.enabled || event.button !== 0 || this.pointerId !== null) {
      return;
    }
    this.pointerId = event.pointerId;
    this.previousPointerX = event.clientX;
    this.previousPointerY = event.clientY;
    this.canvas.setPointerCapture?.(event.pointerId);
    event.preventDefault();
  };

  private readonly handlePointerMove = (event: PointerEvent): void => {
    if (!this.enabled || event.pointerId !== this.pointerId) {
      return;
    }
    const deltaX = event.clientX - this.previousPointerX;
    const deltaY = event.clientY - this.previousPointerY;

    this.previousPointerX = event.clientX;
    this.previousPointerY = event.clientY;
    this.orientation.rotate(
      deltaX * ROTATION_RADIANS_PER_PIXEL,
      -deltaY * ROTATION_RADIANS_PER_PIXEL,
    );
    this.applyView();
    event.preventDefault();
  };

  private readonly handlePointerEnd = (event: PointerEvent): void => {
    if (event.pointerId !== this.pointerId) {
      return;
    }
    if (this.canvas.hasPointerCapture?.(event.pointerId)) {
      this.canvas.releasePointerCapture(event.pointerId);
    }
    this.pointerId = null;
  };

  private readonly handleWheel = (event: WheelEvent): void => {
    if (!this.enabled) {
      return;
    }
    this.zoomBy(Math.exp(event.deltaY * 0.0015));
    event.preventDefault();
    event.stopImmediatePropagation();
  };

  private applyView(): void {
    this.camera.position.copy(this.anchor);
    this.orientation.copyDirection(this.direction);
    this.orientation.copyQuaternion(this.camera.quaternion);
    this.camera.updateMatrixWorld();
    this.publishViewState();
  }

  private setFieldOfView(fieldOfView: number): void {
    this.camera.fov = THREE.MathUtils.clamp(
      fieldOfView,
      MINIMUM_FIELD_OF_VIEW_DEGREES,
      MAXIMUM_FIELD_OF_VIEW_DEGREES,
    );
    this.camera.updateProjectionMatrix();
    this.publishViewState();
  }

  private publishViewState(): void {
    const detail: EarthObserverViewState = {
      active: this.enabled,
      pitchOffsetDegrees: this.enabled ? this.orientation.pitchOffsetDegrees : 0,
      azimuthOffsetDegrees: this.enabled ? this.orientation.azimuthOffsetDegrees : 0,
      verticalFieldOfViewDegrees: this.camera.fov,
      centerAltitudeDegrees: this.enabled ? this.orientation.centerAltitudeDegrees : 0,
      centerAzimuthDegrees: this.enabled ? this.orientation.centerAzimuthDegrees : 0,
    };

    this.canvas.dispatchEvent(
      new CustomEvent<EarthObserverViewState>(EARTH_OBSERVER_VIEW_EVENT, {
        bubbles: true,
        detail,
      }),
    );
  }
}
