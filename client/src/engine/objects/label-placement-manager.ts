import type { LabelCandidate } from './label-candidate-collector';
import {
  fitLandmarkRectangle,
  fitRectangleHorizontally,
  moveLandmarkRectangleToFreeSlot,
  moveRectangleToNearbyFreeSlot,
  rectanglesOverlap,
  type ScreenRectangle,
} from './label-screen-layout';
import type { LabelObject } from './label-visibility-policy';

export interface LabelRectangleMeasurer {
  measureRectangle(
    object: LabelObject,
    centerX: number,
    baselineY: number,
    selected: boolean,
    lodLevel: number,
  ): ScreenRectangle;
}

export interface LabelOcclusionReader {
  isOccluded(
    candidate: LabelCandidate,
    rectangle: ScreenRectangle,
    pointX: number,
    pointY: number,
  ): boolean;
}

export interface LabelPlacementFrame {
  readonly viewportWidth: number;
  readonly viewportHeight: number;
  readonly safeTop: number;
  readonly safeBottom: number;
  readonly landmarkSafeLeft: number;
  readonly landmarkSafeRight: number;
  readonly lodLevel: number;
}

export class LabelPlacementManager {
  private readonly occupied: ScreenRectangle[] = [];

  constructor(
    private readonly measurer: LabelRectangleMeasurer,
    private readonly occlusion: LabelOcclusionReader,
  ) {}

  public get occupiedRectangles(): readonly ScreenRectangle[] {
    return this.occupied;
  }

  public place(
    candidate: LabelCandidate,
    anchorX: number,
    anchorY: number,
    frame: LabelPlacementFrame,
    scaleLandmark: boolean,
    solarSystemPrimaryLabel: boolean,
  ): ScreenRectangle | null {
    const rectangle = this.measurer.measureRectangle(
      candidate.object,
      anchorX,
      anchorY,
      candidate.selected,
      frame.lodLevel,
    );

    if (scaleLandmark) {
      fitLandmarkRectangle(
        rectangle,
        frame.viewportWidth,
        frame.viewportHeight,
        frame.safeTop,
        frame.safeBottom,
        frame.landmarkSafeLeft,
        frame.landmarkSafeRight,
      );
      moveLandmarkRectangleToFreeSlot(rectangle, this.occupied, {
        viewportWidth: frame.viewportWidth,
        viewportHeight: frame.viewportHeight,
        safeTop: frame.safeTop,
        safeBottom: frame.safeBottom,
        safeLeft: frame.landmarkSafeLeft,
        safeRight: frame.landmarkSafeRight,
      });
    } else {
      fitRectangleHorizontally(rectangle, frame.viewportWidth);
    }
    if (!scaleLandmark && this.occlusion.isOccluded(candidate, rectangle, anchorX, anchorY + 18)) {
      return null;
    }
    if (
      !candidate.selected &&
      !scaleLandmark &&
      rectanglesOverlap(rectangle, this.occupied) &&
      (!solarSystemPrimaryLabel ||
        !moveRectangleToNearbyFreeSlot(rectangle, this.occupied, {
          viewportWidth: frame.viewportWidth,
          viewportHeight: frame.viewportHeight,
          safeTop: frame.safeTop,
          safeBottom: frame.safeBottom,
        }))
    ) {
      return null;
    }
    this.occupied.push(rectangle);

    return rectangle;
  }

  public clear(): void {
    this.occupied.length = 0;
  }
}
