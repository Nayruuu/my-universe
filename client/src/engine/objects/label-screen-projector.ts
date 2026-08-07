import * as THREE from 'three';
import { LABEL_VIEWPORT_MARGIN_PX } from './label-screen-layout';

export interface LabelScreenProjection {
  readonly x: number;
  readonly y: number;
}

export interface LabelScreenProjectionViewport {
  readonly viewportWidth: number;
  readonly viewportHeight: number;
  readonly safeTop: number;
  readonly safeBottom: number;
}

export interface LabelViewportLayout {
  readonly safeTop: number;
  readonly safeBottom: number;
  readonly landmarkSafeLeft: number;
  readonly landmarkSafeRight: number;
}

const DESKTOP_DETAILS_SAFE_LEFT_PX = 390;
const DESKTOP_CONTROLS_SAFE_RIGHT_PX = 72;

export class LabelScreenProjector {
  private readonly projectedPosition = new THREE.Vector3();
  private readonly cameraSpacePosition = new THREE.Vector3();
  private readonly projection = { x: 0, y: 0 };

  public project(
    worldPosition: THREE.Vector3,
    camera: THREE.Camera,
    viewport: LabelScreenProjectionViewport,
    scaleLandmark: boolean,
  ): LabelScreenProjection | null {
    this.projectedPosition.copy(worldPosition).project(camera);
    const behindCamera =
      this.cameraSpacePosition.copy(worldPosition).applyMatrix4(camera.matrixWorldInverse).z >= 0;

    if (scaleLandmark && behindCamera) {
      this.projectedPosition.x *= -1;
      this.projectedPosition.y *= -1;
      if (
        Math.abs(this.projectedPosition.x) < 0.001 &&
        Math.abs(this.projectedPosition.y) < 0.001
      ) {
        this.projectedPosition.y = 1;
      }
    }
    if (!scaleLandmark && (this.projectedPosition.z < -1 || this.projectedPosition.z > 1)) {
      return null;
    }

    const x = (this.projectedPosition.x * 0.5 + 0.5) * viewport.viewportWidth;
    const y = (-this.projectedPosition.y * 0.5 + 0.5) * viewport.viewportHeight - 18;

    if (
      !scaleLandmark &&
      (x < -40 ||
        x > viewport.viewportWidth + 40 ||
        y < viewport.safeTop ||
        y > viewport.viewportHeight - viewport.safeBottom)
    ) {
      return null;
    }

    this.projection.x = x;
    this.projection.y = y;

    return this.projection;
  }
}

export function getLabelViewportLayout(
  viewportWidth: number,
  detailsPanelVisible: boolean,
): LabelViewportLayout {
  const mobile = viewportWidth <= 720;

  return {
    safeTop: mobile ? 112 : 76,
    safeBottom: mobile ? 124 : 88,
    landmarkSafeLeft:
      !mobile && detailsPanelVisible ? DESKTOP_DETAILS_SAFE_LEFT_PX : LABEL_VIEWPORT_MARGIN_PX,
    landmarkSafeRight: mobile ? LABEL_VIEWPORT_MARGIN_PX : DESKTOP_CONTROLS_SAFE_RIGHT_PX,
  };
}
