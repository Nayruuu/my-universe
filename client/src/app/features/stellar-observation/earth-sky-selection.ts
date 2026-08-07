import type { EarthSkySprite } from './earth-sky-scene';

interface PointerPress {
  readonly startX: number;
  readonly startY: number;
  moved: boolean;
}

export interface EarthSkyPointerPoint {
  readonly x: number;
  readonly y: number;
}

const MAXIMUM_TAP_MOVEMENT_PIXELS = 7;

export class EarthSkyPointerSelection {
  private readonly presses = new Map<number, PointerPress>();

  public begin(pointerId: number, x: number, y: number): void {
    const multiPointerGesture = this.presses.size > 0;

    if (multiPointerGesture) {
      for (const press of this.presses.values()) {
        press.moved = true;
      }
    }
    this.presses.set(pointerId, { startX: x, startY: y, moved: multiPointerGesture });
  }

  public move(pointerId: number, x: number, y: number): void {
    const press = this.presses.get(pointerId);

    if (press && Math.hypot(x - press.startX, y - press.startY) > MAXIMUM_TAP_MOVEMENT_PIXELS) {
      press.moved = true;
    }
  }

  public end(pointerId: number, x: number, y: number): EarthSkyPointerPoint | null {
    this.move(pointerId, x, y);
    const press = this.presses.get(pointerId);

    this.presses.delete(pointerId);

    return press && !press.moved ? { x, y } : null;
  }

  public cancel(pointerId: number): void {
    this.presses.delete(pointerId);
  }
}

export function findEarthSkyStarAt(
  stars: readonly EarthSkySprite[],
  x: number,
  y: number,
  minimumHitRadius: number,
): EarthSkySprite | null {
  if (
    !Number.isFinite(x) ||
    !Number.isFinite(y) ||
    !Number.isFinite(minimumHitRadius) ||
    minimumHitRadius <= 0
  ) {
    return null;
  }
  let closest: EarthSkySprite | null = null;
  let closestScore = Number.POSITIVE_INFINITY;

  for (const star of stars) {
    const hitRadius = Math.max(minimumHitRadius, star.radius * 2.75);
    const distance = Math.hypot(x - star.x, y - star.y);

    if (distance > hitRadius) {
      continue;
    }
    const score = distance / hitRadius;

    if (score < closestScore || (score === closestScore && star.radius > (closest?.radius ?? 0))) {
      closest = star;
      closestScore = score;
    }
  }

  return closest;
}
