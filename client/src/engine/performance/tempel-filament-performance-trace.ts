import type {
  TempelFilamentPerformanceStats,
  TempelFilamentSceneInstallationMetrics,
} from '../../data/models/universe.models';
import type { TempelFilamentSpineLoadTelemetry } from '../loaders/tempel-filament-spine-worker-loader';

type MonotonicClock = () => number;

const IDLE_STATS: TempelFilamentPerformanceStats = Object.freeze({
  status: 'idle',
  execution: null,
  fetchMs: null,
  decodeMs: null,
  workerRoundTripMs: null,
  geometryPreparationMs: null,
  sceneInstallationMs: null,
  preloadHit: null,
  preloadLeadMs: null,
  firstVisibleFrameMs: null,
  activationToFirstVisibleMs: null,
  timeToFirstVisibleMs: null,
});

export class TempelFilamentPerformanceTrace {
  private requestStartedAt = 0;
  private catalogLoadedAt: number | null = null;
  private activatedAt: number | null = null;
  private stats: TempelFilamentPerformanceStats = IDLE_STATS;

  constructor(private readonly now: MonotonicClock = () => performance.now()) {}

  public get snapshot(): TempelFilamentPerformanceStats {
    return { ...this.stats };
  }

  public begin(): void {
    this.requestStartedAt = this.now();
    this.catalogLoadedAt = null;
    this.activatedAt = null;
    this.stats = { ...IDLE_STATS, status: 'loading' };
  }

  public recordLoad(telemetry: TempelFilamentSpineLoadTelemetry): void {
    if (this.stats.status !== 'loading') {
      return;
    }
    this.catalogLoadedAt = this.now();
    this.stats = { ...this.stats, ...telemetry };
  }

  public activate(): void {
    if (this.stats.status !== 'loading' || this.activatedAt !== null) {
      return;
    }
    this.activatedAt = this.now();
    this.stats = {
      ...this.stats,
      preloadHit: this.catalogLoadedAt !== null,
      preloadLeadMs:
        this.catalogLoadedAt === null ? 0 : Math.max(0, this.activatedAt - this.catalogLoadedAt),
    };
  }

  public recordInstallation(metrics: TempelFilamentSceneInstallationMetrics): void {
    if (this.stats.status !== 'loading') {
      return;
    }
    this.stats = { ...this.stats, ...metrics, status: 'installed' };
  }

  public beginFrame(): number | null {
    return this.stats.status === 'installed' ? this.now() : null;
  }

  public completeFrame(frameStartedAt: number | null, tempelSegmentsVisible: boolean): void {
    if (frameStartedAt === null || !tempelSegmentsVisible || this.stats.status !== 'installed') {
      return;
    }
    const renderedAt = this.now();

    this.stats = {
      ...this.stats,
      status: 'visible',
      firstVisibleFrameMs: renderedAt - frameStartedAt,
      activationToFirstVisibleMs: this.activatedAt === null ? null : renderedAt - this.activatedAt,
      timeToFirstVisibleMs: renderedAt - this.requestStartedAt,
    };
  }

  public fail(): void {
    if (this.stats.status === 'loading' || this.stats.status === 'installed') {
      this.stats = { ...this.stats, status: 'failed' };
    }
  }

  public reset(): void {
    this.requestStartedAt = 0;
    this.catalogLoadedAt = null;
    this.activatedAt = null;
    this.stats = IDLE_STATS;
  }
}
