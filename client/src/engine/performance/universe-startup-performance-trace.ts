import type {
  UniverseStartupBudgetPhase,
  UniverseStartupPerformanceStats,
} from '../../data/models/universe.models';

export interface UniverseStartupPerformanceBudgets {
  readonly engineModuleMs: number;
  readonly dataReadyMs: number;
  readonly sceneReadyMs: number;
  readonly firstUsableMapMs: number;
}

type MonotonicClock = () => number;
type TimingKey = keyof UniverseStartupPerformanceBudgets;

export const DEFAULT_UNIVERSE_STARTUP_BUDGETS: UniverseStartupPerformanceBudgets = Object.freeze({
  engineModuleMs: 1_500,
  dataReadyMs: 3_500,
  sceneReadyMs: 5_500,
  firstUsableMapMs: 7_000,
});

const PHASE_BY_TIMING: Readonly<Record<TimingKey, UniverseStartupBudgetPhase>> = {
  engineModuleMs: 'engine-module',
  dataReadyMs: 'data-ready',
  sceneReadyMs: 'scene-ready',
  firstUsableMapMs: 'first-usable-map',
};

const IDLE_STATS: UniverseStartupPerformanceStats = Object.freeze({
  status: 'idle',
  engineModuleMs: null,
  dataReadyMs: null,
  sceneReadyMs: null,
  firstUsableMapMs: null,
  budgetStatus: 'pending',
  exceededBudgets: Object.freeze([]),
});

export class UniverseStartupPerformanceTrace {
  private startedAt = 0;
  private stats: UniverseStartupPerformanceStats = IDLE_STATS;

  constructor(
    private readonly now: MonotonicClock = () => performance.now(),
    private readonly budgets: UniverseStartupPerformanceBudgets = DEFAULT_UNIVERSE_STARTUP_BUDGETS,
  ) {}

  public get snapshot(): UniverseStartupPerformanceStats {
    return { ...this.stats, exceededBudgets: [...this.stats.exceededBudgets] };
  }

  public begin(): void {
    this.startedAt = this.now();
    this.stats = { ...IDLE_STATS, status: 'loading', exceededBudgets: [] };
  }

  public markEngineModuleLoaded(): void {
    this.record('engineModuleMs');
  }

  public markDataReady(): void {
    this.record('dataReadyMs');
  }

  public markSceneReady(): void {
    this.record('sceneReadyMs');
  }

  public markMapUsable(): void {
    this.record('firstUsableMapMs', true);
  }

  public fail(): void {
    if (this.stats.status === 'loading') {
      this.stats = { ...this.stats, status: 'failed' };
    }
  }

  public reset(): void {
    this.startedAt = 0;
    this.stats = IDLE_STATS;
  }

  private record(key: TimingKey, usable = false): void {
    if (this.stats.status !== 'loading' || this.stats[key] !== null) {
      return;
    }
    const elapsedMs = Math.max(0, this.now() - this.startedAt);
    const exceededBudgets =
      elapsedMs > this.budgets[key]
        ? [...this.stats.exceededBudgets, PHASE_BY_TIMING[key]]
        : [...this.stats.exceededBudgets];

    this.stats = {
      ...this.stats,
      [key]: elapsedMs,
      status: usable ? 'usable' : 'loading',
      budgetStatus:
        exceededBudgets.length > 0 ? 'over-budget' : usable ? 'within-budget' : 'pending',
      exceededBudgets,
    };
  }
}
