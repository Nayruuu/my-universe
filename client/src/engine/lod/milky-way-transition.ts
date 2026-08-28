import { MILKY_WAY_NAVIGATION_DISTANCE } from '../camera/navigation-scales';

export const MILKY_WAY_TRANSITION_START = MILKY_WAY_NAVIGATION_DISTANCE;
export const MILKY_WAY_TRANSITION_END = 17_000;

export interface MilkyWayTransitionState {
  detailOpacity: number;
  auraOpacity: number;
  impostorOpacity: number;
  detailScale: number;
}

export function calculateMilkyWayTransition(cameraDistance: number): MilkyWayTransitionState {
  const progress = smoothstep(MILKY_WAY_TRANSITION_START, MILKY_WAY_TRANSITION_END, cameraDistance);
  const impostorOpacity = smoothstep(0.26, 0.82, progress);
  const detailScale = 0.16 + 0.84 * (1 - smoothstep(0.08, 0.96, progress));

  return {
    detailOpacity: 1 - smoothstep(0.18, 0.78, progress),
    auraOpacity: 1 - smoothstep(0.48, 1, progress),
    impostorOpacity,
    detailScale,
  };
}

function smoothstep(minimum: number, maximum: number, value: number): number {
  const progress = Math.max(0, Math.min(1, (value - minimum) / (maximum - minimum)));

  return progress * progress * (3 - 2 * progress);
}
