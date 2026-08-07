import type { RenderingPrewarmPerformanceStats } from '../../data/models/universe.models';

type MonotonicClock = () => number;
type RenderingPrewarmOperation = keyof RenderingPrewarmPerformanceStats;

const IDLE_OPERATION = Object.freeze({ status: 'idle' as const, durationMs: null });

const IDLE_STATS: RenderingPrewarmPerformanceStats = Object.freeze({
  initialScene: IDLE_OPERATION,
  tempelScene: IDLE_OPERATION,
});

/**
 * Records the wall-clock duration of renderer prewarming operations.
 *
 * These timings delimit shader/program and texture preparation requested from Three.js. They do
 * not claim to be GPU execution timings: WebGL does not expose those reliably without changing the
 * render path or adding blocking queries.
 */
export class RenderingPrewarmPerformanceTrace {
  private stats: RenderingPrewarmPerformanceStats = IDLE_STATS;
  private readonly startedAt = new Map<RenderingPrewarmOperation, number>();

  constructor(private readonly now: MonotonicClock = () => performance.now()) {}

  public get snapshot(): RenderingPrewarmPerformanceStats {
    return {
      initialScene: { ...this.stats.initialScene },
      tempelScene: { ...this.stats.tempelScene },
    };
  }

  public begin(operation: RenderingPrewarmOperation): void {
    this.startedAt.set(operation, this.now());
    this.update(operation, { status: 'running', durationMs: null });
  }

  public complete(operation: RenderingPrewarmOperation, succeeded: boolean): void {
    const startedAt = this.startedAt.get(operation);

    if (startedAt === undefined) {
      return;
    }
    this.startedAt.delete(operation);
    this.update(operation, {
      status: succeeded ? 'ready' : 'failed',
      durationMs: Math.max(0, this.now() - startedAt),
    });
  }

  public reset(): void {
    this.startedAt.clear();
    this.stats = IDLE_STATS;
  }

  private update(
    operation: RenderingPrewarmOperation,
    value: RenderingPrewarmPerformanceStats[RenderingPrewarmOperation],
  ): void {
    this.stats = { ...this.stats, [operation]: value };
  }
}
