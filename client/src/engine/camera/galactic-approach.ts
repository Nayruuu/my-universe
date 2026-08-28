import { MILKY_WAY_NAVIGATION_DISTANCE, getNavigationScale } from './navigation-scales';

export type GalacticApproachSample =
  | {
      readonly active: true;
      /** Illustrative camera pivot moving from the Galactic centre to the selected stellar system. */
      readonly pivotProgress: number;
      /** Absolute vertical component of the unit view direction during the choreography. */
      readonly viewElevation: number;
    }
  | {
      readonly active: false;
      readonly pivotProgress: number;
      readonly viewElevation: null;
    };

export const GALACTIC_APPROACH_OUTER_DISTANCE = getNavigationScale('local-group').distance;
/**
 * Keep the Galactic centre nearly fixed while the disc grows into an environment. Moving the
 * pivot toward the Sun across the whole Local Group approach made the camera veer sideways just
 * as the Milky Way filled the viewport.
 */
export const GALACTIC_APPROACH_PIVOT_START_DISTANCE = MILKY_WAY_NAVIGATION_DISTANCE * (4 / 3);
export const GALACTIC_APPROACH_PIVOT_END_DISTANCE =
  getNavigationScale('stellar-neighborhood').distance;
export const GALACTIC_APPROACH_VIEW_END_DISTANCE = getNavigationScale('solar-system').distance;
export const GALACTIC_APPROACH_ZOOM_RATE_MULTIPLIER = 1;

const EXTERNAL_VIEW_ELEVATION = 0.18;
const GALACTIC_OVERVIEW_VIEW_ELEVATION = 0.45;
const DISC_ENTRY_VIEW_ELEVATION = 0.08;
const GALACTIC_APPROACH_BOUNDARY_EPSILON = 1e-6;

/**
 * Camera-only choreography for a continuous Milky Way dive. Distances and object positions remain
 * untouched. Like a real fly-through, the disc first opens as it fills the viewport, then the
 * camera dives toward the Galactic plane while the pivot converges on the physical Solar location.
 * Coordinating this pose change with the same logarithmic zoom avoids manufacturing fluidity by
 * slowing the wheel. The movement is deliberately illustrative and reversible.
 */
export function sampleGalacticApproach(cameraDistance: number): GalacticApproachSample {
  const distance = normalizeDistance(cameraDistance);
  const active =
    Number.isFinite(cameraDistance) &&
    cameraDistance >= GALACTIC_APPROACH_VIEW_END_DISTANCE - GALACTIC_APPROACH_BOUNDARY_EPSILON &&
    cameraDistance <= GALACTIC_APPROACH_OUTER_DISTANCE + GALACTIC_APPROACH_BOUNDARY_EPSILON;
  const pivotProgress = smootherstep(
    logarithmicProgress(
      GALACTIC_APPROACH_PIVOT_START_DISTANCE,
      GALACTIC_APPROACH_PIVOT_END_DISTANCE,
      distance,
    ),
  );

  if (!active) {
    return { active, pivotProgress, viewElevation: null };
  }

  if (distance >= MILKY_WAY_NAVIGATION_DISTANCE) {
    return {
      active,
      pivotProgress,
      viewElevation: interpolate(
        EXTERNAL_VIEW_ELEVATION,
        GALACTIC_OVERVIEW_VIEW_ELEVATION,
        smootherstep(
          logarithmicProgress(
            GALACTIC_APPROACH_PIVOT_START_DISTANCE,
            MILKY_WAY_NAVIGATION_DISTANCE,
            distance,
          ),
        ),
      ),
    };
  }

  return {
    active,
    pivotProgress,
    viewElevation: interpolate(
      GALACTIC_OVERVIEW_VIEW_ELEVATION,
      DISC_ENTRY_VIEW_ELEVATION,
      smootherstep(
        logarithmicProgress(
          MILKY_WAY_NAVIGATION_DISTANCE,
          GALACTIC_APPROACH_VIEW_END_DISTANCE,
          distance,
        ),
      ),
    ),
  };
}

function normalizeDistance(cameraDistance: number): number {
  if (!Number.isFinite(cameraDistance)) {
    return cameraDistance === Number.POSITIVE_INFINITY
      ? Number.MAX_VALUE
      : GALACTIC_APPROACH_VIEW_END_DISTANCE;
  }

  return Math.max(0, cameraDistance);
}

function logarithmicProgress(
  outerDistance: number,
  innerDistance: number,
  distance: number,
): number {
  const clampedDistance = Math.max(innerDistance, Math.min(outerDistance, distance));

  return (
    (Math.log(outerDistance) - Math.log(clampedDistance)) /
    (Math.log(outerDistance) - Math.log(innerDistance))
  );
}

function smootherstep(progress: number): number {
  const value = Math.max(0, Math.min(1, progress));

  return value * value * value * (value * (value * 6 - 15) + 10);
}

function interpolate(start: number, end: number, progress: number): number {
  return start + (end - start) * progress;
}
