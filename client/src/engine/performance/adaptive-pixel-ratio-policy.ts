import type { AdaptiveRenderingStats } from '../../data/models/universe.models';
import type { FrameWindowSummary } from './frame-window-sampler';
import type { AdaptiveFrameProfile } from './adaptive-rendering-profile';

const MINIMUM_PIXEL_RATIO = 0.8;
const NORMAL_REDUCTION_STEP = 0.125;
const SEVERE_REDUCTION_STEP = 0.25;
const RECOVERY_STEP = 0.125;
const SLOW_WINDOWS_BEFORE_REDUCTION = 2;
const HEALTHY_WINDOWS_BEFORE_RECOVERY = 6;
const SLOW_LONG_FRAME_RATIO = 0.08;
const SEVERE_LONG_FRAME_RATIO = 0.25;
const HEALTHY_LONG_FRAME_RATIO = 0.02;

export interface AdaptivePixelRatioPolicyState {
  slowWindowCount: number;
  healthyWindowCount: number;
  targetRatio: number;
  currentRatio: number;
  snapshot: AdaptiveRenderingStats;
}

export function createAdaptivePixelRatioPolicyState(): AdaptivePixelRatioPolicyState {
  return {
    slowWindowCount: 0,
    healthyWindowCount: 0,
    targetRatio: 1,
    currentRatio: 1,
    snapshot: createSnapshot('warming', null, null, 1, 1),
  };
}

export function resetAdaptivePixelRatioPolicy(
  state: AdaptivePixelRatioPolicyState,
  targetPixelRatio: number,
): void {
  state.targetRatio = targetPixelRatio;
  state.currentRatio = targetPixelRatio;
  resetCounters(state);
  updateSnapshot(state, 'warming', null, null);
}

export function pauseAdaptivePixelRatioPolicy(state: AdaptivePixelRatioPolicyState): void {
  resetCounters(state);
  updateSnapshot(state, 'paused', state.snapshot.p95FrameMs, state.snapshot.longFrameRatio);
}

export function warmAdaptivePixelRatioPolicy(state: AdaptivePixelRatioPolicyState): void {
  updateSnapshot(
    state,
    state.currentRatio < state.targetRatio ? 'degraded' : 'warming',
    state.snapshot.p95FrameMs,
    state.snapshot.longFrameRatio,
  );
}

export function evaluateAdaptivePixelRatioWindow(
  state: AdaptivePixelRatioPolicyState,
  profile: AdaptiveFrameProfile,
  summary: FrameWindowSummary,
): number | null {
  if (isSevereWindow(profile, summary)) {
    resetCounters(state);

    return reducePixelRatio(state, SEVERE_REDUCTION_STEP, summary);
  }
  if (isSlowWindow(profile, summary)) {
    return observeSlowWindow(state, summary);
  }
  if (isHealthyWindow(state, profile, summary)) {
    return observeHealthyWindow(state, summary);
  }
  resetCounters(state);
  updateSnapshot(state, currentStatus(state), summary.p95FrameMs, summary.longFrameRatio);

  return null;
}

function observeSlowWindow(
  state: AdaptivePixelRatioPolicyState,
  summary: FrameWindowSummary,
): number | null {
  state.slowWindowCount += 1;
  state.healthyWindowCount = 0;
  if (state.slowWindowCount >= SLOW_WINDOWS_BEFORE_REDUCTION) {
    state.slowWindowCount = 0;

    return reducePixelRatio(state, NORMAL_REDUCTION_STEP, summary);
  }
  updateSnapshot(state, currentStatus(state), summary.p95FrameMs, summary.longFrameRatio);

  return null;
}

function observeHealthyWindow(
  state: AdaptivePixelRatioPolicyState,
  summary: FrameWindowSummary,
): number | null {
  state.healthyWindowCount += 1;
  state.slowWindowCount = 0;
  if (state.healthyWindowCount < HEALTHY_WINDOWS_BEFORE_RECOVERY) {
    updateSnapshot(state, 'recovering', summary.p95FrameMs, summary.longFrameRatio);

    return null;
  }
  state.healthyWindowCount = 0;
  state.currentRatio = roundPixelRatio(
    Math.min(state.targetRatio, state.currentRatio + RECOVERY_STEP),
  );
  updateSnapshot(
    state,
    currentStatus(state, 'recovering'),
    summary.p95FrameMs,
    summary.longFrameRatio,
  );

  return state.currentRatio;
}

function reducePixelRatio(
  state: AdaptivePixelRatioPolicyState,
  step: number,
  summary: FrameWindowSummary,
): number | null {
  const minimumRatio = Math.min(MINIMUM_PIXEL_RATIO, state.targetRatio);
  const nextRatio = roundPixelRatio(Math.max(minimumRatio, state.currentRatio - step));

  if (nextRatio === state.currentRatio) {
    updateSnapshot(state, currentStatus(state), summary.p95FrameMs, summary.longFrameRatio);

    return null;
  }
  state.currentRatio = nextRatio;
  updateSnapshot(state, 'degraded', summary.p95FrameMs, summary.longFrameRatio);

  return state.currentRatio;
}

function isSevereWindow(profile: AdaptiveFrameProfile, summary: FrameWindowSummary): boolean {
  return (
    summary.p95FrameMs >= profile.severeFrameMs || summary.longFrameRatio >= SEVERE_LONG_FRAME_RATIO
  );
}

function isSlowWindow(profile: AdaptiveFrameProfile, summary: FrameWindowSummary): boolean {
  return (
    summary.p95FrameMs >= profile.slowFrameMs || summary.longFrameRatio >= SLOW_LONG_FRAME_RATIO
  );
}

function isHealthyWindow(
  state: AdaptivePixelRatioPolicyState,
  profile: AdaptiveFrameProfile,
  summary: FrameWindowSummary,
): boolean {
  return (
    summary.p95FrameMs <= profile.healthyFrameMs &&
    summary.longFrameRatio <= HEALTHY_LONG_FRAME_RATIO &&
    state.currentRatio < state.targetRatio
  );
}

function currentStatus(
  state: AdaptivePixelRatioPolicyState,
  recovering: 'recovering' | null = null,
): AdaptiveRenderingStats['status'] {
  return state.currentRatio < state.targetRatio ? (recovering ?? 'degraded') : 'stable';
}

function resetCounters(state: AdaptivePixelRatioPolicyState): void {
  state.slowWindowCount = 0;
  state.healthyWindowCount = 0;
}

function updateSnapshot(
  state: AdaptivePixelRatioPolicyState,
  status: AdaptiveRenderingStats['status'],
  p95FrameMs: number | null,
  longFrameRatio: number | null,
): void {
  state.snapshot = createSnapshot(
    status,
    p95FrameMs,
    longFrameRatio,
    state.targetRatio,
    state.currentRatio,
  );
}

function createSnapshot(
  status: AdaptiveRenderingStats['status'],
  p95FrameMs: number | null,
  longFrameRatio: number | null,
  targetPixelRatio: number,
  currentPixelRatio: number,
): AdaptiveRenderingStats {
  return { status, p95FrameMs, longFrameRatio, targetPixelRatio, currentPixelRatio };
}

function roundPixelRatio(value: number): number {
  return Math.round(value * 1_000) / 1_000;
}
