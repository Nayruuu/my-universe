import type { AdaptiveRenderingStats } from '../../data/models/universe.models';
import {
  createAdaptivePixelRatioPolicyState,
  evaluateAdaptivePixelRatioWindow,
  pauseAdaptivePixelRatioPolicy,
  resetAdaptivePixelRatioPolicy,
  warmAdaptivePixelRatioPolicy,
} from './adaptive-pixel-ratio-policy';
import type { AdaptiveFrameProfile } from './adaptive-rendering-profile';
import { FrameWindowSampler } from './frame-window-sampler';

export const ADAPTIVE_FRAME_SAMPLE_COUNT = 120;

export class AdaptivePixelRatioController {
  private readonly frameSampler = new FrameWindowSampler(ADAPTIVE_FRAME_SAMPLE_COUNT);
  private readonly policy = createAdaptivePixelRatioPolicyState();
  private collectingInitialWindow = true;
  private initialStatusPublished = true;

  public get currentPixelRatio(): number {
    return this.policy.currentRatio;
  }

  public get snapshot(): AdaptiveRenderingStats {
    return { ...this.policy.snapshot };
  }

  public reset(targetPixelRatio: number): number {
    this.frameSampler.reset();
    this.collectingInitialWindow = true;
    this.initialStatusPublished = true;
    resetAdaptivePixelRatioPolicy(this.policy, targetPixelRatio);

    return this.policy.currentRatio;
  }

  public observe(
    deltaSeconds: number,
    profile: AdaptiveFrameProfile,
    paused: boolean,
  ): number | null {
    if (paused) {
      this.frameSampler.reset();
      this.collectingInitialWindow = true;
      this.initialStatusPublished = false;
      pauseAdaptivePixelRatioPolicy(this.policy);

      return null;
    }
    if (!Number.isFinite(deltaSeconds) || deltaSeconds <= 0) {
      return null;
    }
    const summary = this.frameSampler.add(deltaSeconds * 1_000, profile.severeFrameMs);

    if (!summary && this.collectingInitialWindow) {
      if (!this.initialStatusPublished) {
        warmAdaptivePixelRatioPolicy(this.policy);
        this.initialStatusPublished = true;
      }

      return null;
    }
    if (!summary) {
      return null;
    }
    this.collectingInitialWindow = false;

    return evaluateAdaptivePixelRatioWindow(this.policy, profile, summary);
  }
}
