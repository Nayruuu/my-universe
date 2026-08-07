export interface ScreenRectangle {
  left: number;
  top: number;
  right: number;
  bottom: number;
}

export interface LabelHitRegion {
  objectId: string;
  rectangle: ScreenRectangle;
}

export interface NearbyLabelSlotOptions {
  readonly viewportWidth: number;
  readonly viewportHeight: number;
  readonly safeTop: number;
  readonly safeBottom: number;
}

export interface LandmarkLabelSlotOptions extends NearbyLabelSlotOptions {
  readonly safeLeft: number;
  readonly safeRight: number;
}

export const LABEL_VIEWPORT_MARGIN_PX = 8;

const LABEL_HIT_PADDING_PX = 6;
const LABEL_COLLISION_PADDING_PX = 4;
const MAXIMUM_NEARBY_SLOT_RING = 3;

export function findLabelHit(
  regions: readonly LabelHitRegion[],
  x: number,
  y: number,
  padding = LABEL_HIT_PADDING_PX,
): string | null {
  for (const region of regions) {
    const rectangle = region.rectangle;

    if (
      x >= rectangle.left - padding &&
      x <= rectangle.right + padding &&
      y >= rectangle.top - padding &&
      y <= rectangle.bottom + padding
    ) {
      return region.objectId;
    }
  }

  return null;
}

export function fitRectangleHorizontally(
  rectangle: ScreenRectangle,
  viewportWidth: number,
  safeLeft = LABEL_VIEWPORT_MARGIN_PX,
  safeRight = LABEL_VIEWPORT_MARGIN_PX,
): void {
  const leftOverflow = safeLeft - rectangle.left;
  const rightOverflow = rectangle.right - (viewportWidth - safeRight);
  const offset = leftOverflow > 0 ? leftOverflow : rightOverflow > 0 ? -rightOverflow : 0;

  rectangle.left += offset;
  rectangle.right += offset;
}

export function fitLandmarkRectangle(
  rectangle: ScreenRectangle,
  viewportWidth: number,
  viewportHeight: number,
  safeTop: number,
  safeBottom: number,
  safeLeft: number,
  safeRight: number,
): void {
  fitRectangleHorizontally(rectangle, viewportWidth, safeLeft, safeRight);
  const maximumBottom = Math.max(safeTop, viewportHeight - safeBottom);
  const offset =
    rectangle.top < safeTop
      ? safeTop - rectangle.top
      : rectangle.bottom > maximumBottom
        ? maximumBottom - rectangle.bottom
        : 0;

  rectangle.top += offset;
  rectangle.bottom += offset;
}

export function circleIntersectsRectangle(
  centerX: number,
  centerY: number,
  radius: number,
  rectangle: ScreenRectangle,
): boolean {
  const closestX = Math.min(Math.max(centerX, rectangle.left), rectangle.right);
  const closestY = Math.min(Math.max(centerY, rectangle.top), rectangle.bottom);

  return Math.hypot(centerX - closestX, centerY - closestY) <= radius;
}

export function rectanglesOverlap(
  rectangle: ScreenRectangle,
  occupiedRectangles: readonly ScreenRectangle[],
  padding = LABEL_COLLISION_PADDING_PX,
): boolean {
  return occupiedRectangles.some(
    (occupied) =>
      rectangle.left < occupied.right + padding &&
      rectangle.right > occupied.left - padding &&
      rectangle.top < occupied.bottom + padding &&
      rectangle.bottom > occupied.top - padding,
  );
}

export function moveRectangleToNearbyFreeSlot(
  rectangle: ScreenRectangle,
  occupiedRectangles: readonly ScreenRectangle[],
  options: NearbyLabelSlotOptions,
): boolean {
  const width = rectangle.right - rectangle.left;
  const height = rectangle.bottom - rectangle.top;
  const originalLeft = rectangle.left;
  const originalTop = rectangle.top;
  const horizontalStep = width + LABEL_VIEWPORT_MARGIN_PX;
  const verticalStep = height + LABEL_VIEWPORT_MARGIN_PX;

  for (let ring = 1; ring <= MAXIMUM_NEARBY_SLOT_RING; ring += 1) {
    for (let row = -ring; row <= ring; row += 1) {
      for (let column = -ring; column <= ring; column += 1) {
        if (Math.max(Math.abs(row), Math.abs(column)) !== ring) {
          continue;
        }
        const left = originalLeft + column * horizontalStep;
        const top = originalTop + row * verticalStep;
        const candidate = {
          left,
          top,
          right: left + width,
          bottom: top + height,
        };

        if (
          candidate.left < LABEL_VIEWPORT_MARGIN_PX ||
          candidate.right > options.viewportWidth - LABEL_VIEWPORT_MARGIN_PX ||
          candidate.top < options.safeTop ||
          candidate.bottom > options.viewportHeight - options.safeBottom ||
          rectanglesOverlap(candidate, occupiedRectangles)
        ) {
          continue;
        }
        Object.assign(rectangle, candidate);

        return true;
      }
    }
  }

  return false;
}

export function moveLandmarkRectangleToFreeSlot(
  rectangle: ScreenRectangle,
  occupiedRectangles: readonly ScreenRectangle[],
  options: LandmarkLabelSlotOptions,
): void {
  if (!rectanglesOverlap(rectangle, occupiedRectangles)) {
    return;
  }
  const width = rectangle.right - rectangle.left;
  const height = rectangle.bottom - rectangle.top;
  const maximumLeft = Math.max(options.safeLeft, options.viewportWidth - options.safeRight - width);
  const maximumTop = Math.max(
    options.safeTop,
    options.viewportHeight - options.safeBottom - height,
  );
  const horizontalStep = width + LABEL_VIEWPORT_MARGIN_PX;
  const verticalStep = height + LABEL_VIEWPORT_MARGIN_PX;

  for (let top = options.safeTop; top <= maximumTop; top += verticalStep) {
    for (let left = options.safeLeft; left <= maximumLeft; left += horizontalStep) {
      const candidate = {
        left,
        top,
        right: left + width,
        bottom: top + height,
      };

      if (!rectanglesOverlap(candidate, occupiedRectangles)) {
        Object.assign(rectangle, candidate);

        return;
      }
    }
  }
}
