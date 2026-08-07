import { UniverseStartupPerformanceTrace } from './universe-startup-performance-trace';

describe('UniverseStartupPerformanceTrace', () => {
  it('mesure les jalons cumulatifs jusqu\u2019\u00e0 la premi\u00e8re carte utilisable', () => {
    const trace = new UniverseStartupPerformanceTrace(clock(100, 140, 260, 420, 680));

    expect(trace.snapshot).toEqual({
      status: 'idle',
      engineModuleMs: null,
      dataReadyMs: null,
      sceneReadyMs: null,
      firstUsableMapMs: null,
      budgetStatus: 'pending',
      exceededBudgets: [],
    });

    trace.begin();
    trace.markEngineModuleLoaded();
    trace.markDataReady();
    trace.markSceneReady();
    trace.markMapUsable();

    expect(trace.snapshot).toEqual({
      status: 'usable',
      engineModuleMs: 40,
      dataReadyMs: 160,
      sceneReadyMs: 320,
      firstUsableMapMs: 580,
      budgetStatus: 'within-budget',
      exceededBudgets: [],
    });
  });

  it('signale chaque budget d\u00e9pass\u00e9 sans enregistrer deux fois un jalon', () => {
    const trace = new UniverseStartupPerformanceTrace(clock(0, 30, 70, 120, 180), {
      engineModuleMs: 20,
      dataReadyMs: 60,
      sceneReadyMs: 100,
      firstUsableMapMs: 150,
    });

    trace.begin();
    trace.markEngineModuleLoaded();
    trace.markEngineModuleLoaded();
    trace.markDataReady();
    trace.markSceneReady();
    trace.markMapUsable();

    expect(trace.snapshot).toMatchObject({
      status: 'usable',
      engineModuleMs: 30,
      dataReadyMs: 70,
      sceneReadyMs: 120,
      firstUsableMapMs: 180,
      budgetStatus: 'over-budget',
      exceededBudgets: ['engine-module', 'data-ready', 'scene-ready', 'first-usable-map'],
    });
  });

  it('g\u00e8re un \u00e9chec, un red\u00e9marrage et les appels hors cycle', () => {
    const trace = new UniverseStartupPerformanceTrace(clock(10, 20, 30, 40));

    trace.markEngineModuleLoaded();
    trace.fail();
    trace.markMapUsable();
    expect(trace.snapshot.status).toBe('idle');

    trace.begin();
    trace.fail();
    trace.markDataReady();
    expect(trace.snapshot.status).toBe('failed');

    trace.begin();
    trace.markMapUsable();
    expect(trace.snapshot).toMatchObject({ status: 'usable', firstUsableMapMs: 10 });

    trace.reset();
    expect(trace.snapshot.status).toBe('idle');
  });

  it('emploie performance.now comme horloge monotone par d\u00e9faut', () => {
    const now = vi.spyOn(performance, 'now').mockReturnValue(123);
    const trace = new UniverseStartupPerformanceTrace();

    trace.begin();

    expect(trace.snapshot.status).toBe('loading');
    expect(now).toHaveBeenCalledOnce();
    now.mockRestore();
  });
});

function clock(...values: number[]): () => number {
  const queue = [...values];

  return () => {
    const value = queue.shift();

    if (value === undefined) {
      throw new Error('Horloge de test \u00e9puis\u00e9e.');
    }

    return value;
  };
}
