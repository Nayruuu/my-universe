import {
  equivalentWheelDeltaForOctaves,
  MAXIMUM_ZOOM_OCTAVES_PER_IMPULSE,
  MAXIMUM_ZOOM_OCTAVES_PER_SECOND,
  softLimitWheelDelta,
} from './zoom-physics';

const PIXELS_PER_LINE = 16;
const FALLBACK_PAGE_HEIGHT = 800;
const MAXIMUM_IMPULSE = equivalentWheelDeltaForOctaves(MAXIMUM_ZOOM_OCTAVES_PER_IMPULSE);
const MAXIMUM_DELTA_PER_SECOND = equivalentWheelDeltaForOctaves(MAXIMUM_ZOOM_OCTAVES_PER_SECOND);
const MINIMUM_SAMPLE_INTERVAL_MS = 1_000 / 120;
const GESTURE_IDLE_MS = 180;

export interface WheelZoomInputMetadata {
  readonly rawDeltaY: number;
  readonly deltaMode: number;
  readonly continuesWheelAnchor?: boolean;
  readonly continuesWheelGesture?: boolean;
}

export class WheelZoomNormalizer {
  private lastDirection: -1 | 1 | null = null;
  private lastTimestamp = Number.NEGATIVE_INFINITY;
  private lastInputContinuesGesture = false;

  public get continuesGesture(): boolean {
    return this.lastInputContinuesGesture;
  }

  public normalize(
    rawDeltaY: number,
    deltaMode: number,
    timestamp: number,
    viewportHeight: number,
  ): number {
    this.lastInputContinuesGesture = false;
    if (!Number.isFinite(rawDeltaY) || rawDeltaY === 0) {
      return 0;
    }
    const pixelDelta = rawDeltaY * resolveDeltaModeScale(deltaMode, viewportHeight);
    const direction = pixelDelta < 0 ? -1 : 1;
    const elapsed = timestamp - this.lastTimestamp;
    const continuesGesture =
      direction === this.lastDirection &&
      Number.isFinite(elapsed) &&
      elapsed >= 0 &&
      elapsed <= GESTURE_IDLE_MS;
    const maximumDelta = continuesGesture
      ? Math.min(
          MAXIMUM_IMPULSE,
          Math.max(elapsed, MINIMUM_SAMPLE_INTERVAL_MS) * (MAXIMUM_DELTA_PER_SECOND / 1_000),
        )
      : MAXIMUM_IMPULSE;

    this.lastDirection = direction;
    this.lastTimestamp = timestamp;
    this.lastInputContinuesGesture = continuesGesture;

    return softLimitWheelDelta(pixelDelta, maximumDelta);
  }

  public reset(): void {
    this.lastDirection = null;
    this.lastTimestamp = Number.NEGATIVE_INFINITY;
    this.lastInputContinuesGesture = false;
  }
}

function resolveDeltaModeScale(deltaMode: number, viewportHeight: number): number {
  if (deltaMode === 1) {
    return PIXELS_PER_LINE;
  }
  if (deltaMode === 2) {
    return Number.isFinite(viewportHeight) && viewportHeight > 0
      ? viewportHeight
      : FALLBACK_PAGE_HEIGHT;
  }

  return 1;
}
