import { NAVIGATION_SCALES } from './navigation-scales';

export interface SemanticZoomStep {
  handled: boolean;
  distance: number;
}

const WHEEL_DELTA_PER_SCALE = 480;
const SCALE_DISTANCES = NAVIGATION_SCALES.map((scale) => scale.distance);
const OUTER_DISTANCE = SCALE_DISTANCES.at(-1)!;

export class SemanticZoomJourney {
  private distances: readonly number[] | null = null;
  private progress = 0;

  public get active(): boolean {
    return this.distances !== null;
  }

  public step(currentDistance: number, deltaY: number): SemanticZoomStep {
    if (!Number.isFinite(deltaY) || deltaY === 0) {
      return { handled: false, distance: currentDistance };
    }
    if (!this.distances) {
      if (deltaY < 0) {
        return { handled: false, distance: currentDistance };
      }
      this.start(currentDistance);
      if (!this.distances) {
        return { handled: false, distance: currentDistance };
      }
    }

    const distances = this.distances!;
    const maximumProgress = distances.length - 1;

    if (this.progress === maximumProgress && deltaY > 0) {
      this.reset();

      return { handled: false, distance: currentDistance };
    }

    this.progress = Math.max(
      0,
      Math.min(maximumProgress, this.progress + deltaY / WHEEL_DELTA_PER_SCALE),
    );
    const distance = interpolateLogarithmically(distances, this.progress);

    if (this.progress === 0 && deltaY < 0) {
      this.reset();
    }

    return { handled: true, distance };
  }

  public reset(): void {
    this.distances = null;
    this.progress = 0;
  }

  private start(currentDistance: number): void {
    const anchor = Number.isFinite(currentDistance)
      ? Math.max(Number.EPSILON, Math.min(currentDistance, OUTER_DISTANCE))
      : SCALE_DISTANCES[0]!;
    const tolerance = Math.max(1e-9, Math.abs(anchor) * 1e-9);
    const outerScales = SCALE_DISTANCES.filter((distance) => distance > anchor + tolerance);

    this.distances = outerScales.length > 0 ? [anchor, ...outerScales] : null;
    this.progress = 0;
  }
}

function interpolateLogarithmically(distances: readonly number[], progress: number): number {
  const lowerIndex = Math.floor(progress);
  const upperIndex = Math.min(lowerIndex + 1, distances.length - 1);
  const blend = progress - lowerIndex;
  const lowerDistance = distances[lowerIndex]!;
  const upperDistance = distances[upperIndex]!;

  if (blend === 0) {
    return lowerDistance;
  }

  return Math.exp(
    Math.log(lowerDistance) + (Math.log(upperDistance) - Math.log(lowerDistance)) * blend,
  );
}
