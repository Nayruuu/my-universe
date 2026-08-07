import { TempelFilamentPerformanceTrace } from './tempel-filament-performance-trace';

describe('TempelFilamentPerformanceTrace', () => {
  it('mesure le chargement, l’installation et la première frame réellement visible', () => {
    const now = clock(100, 160, 180, 200, 216, 232);
    const trace = new TempelFilamentPerformanceTrace(now);

    expect(trace.snapshot).toEqual({
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

    trace.begin();
    trace.recordLoad({
      execution: 'worker',
      fetchMs: 42,
      decodeMs: 13,
      workerRoundTripMs: 61,
    });
    trace.activate();
    trace.recordInstallation({
      geometryPreparationMs: 34,
      sceneInstallationMs: 2,
    });

    const hiddenFrameStartedAt = trace.beginFrame();

    expect(hiddenFrameStartedAt).toBe(200);
    trace.completeFrame(hiddenFrameStartedAt, false);
    expect(trace.snapshot.status).toBe('installed');

    const visibleFrameStartedAt = trace.beginFrame();

    expect(visibleFrameStartedAt).toBe(216);
    trace.completeFrame(visibleFrameStartedAt, true);
    expect(trace.snapshot).toEqual({
      status: 'visible',
      execution: 'worker',
      fetchMs: 42,
      decodeMs: 13,
      workerRoundTripMs: 61,
      geometryPreparationMs: 34,
      sceneInstallationMs: 2,
      preloadHit: true,
      preloadLeadMs: 20,
      firstVisibleFrameMs: 16,
      activationToFirstVisibleMs: 52,
      timeToFirstVisibleMs: 132,
    });
    expect(trace.beginFrame()).toBeNull();
  });

  it('gère le repli principal, les erreurs et un nouveau cycle de vie', () => {
    const trace = new TempelFilamentPerformanceTrace(clock(10, 20, 50, 60));

    trace.begin();
    trace.activate();
    trace.recordLoad({
      execution: 'main-thread-fallback',
      fetchMs: 8,
      decodeMs: 3,
      workerRoundTripMs: null,
    });
    trace.activate();
    trace.fail();
    trace.fail();
    trace.recordLoad({
      execution: 'worker',
      fetchMs: 99,
      decodeMs: 99,
      workerRoundTripMs: 99,
    });
    trace.recordInstallation({ geometryPreparationMs: 99, sceneInstallationMs: 99 });
    trace.completeFrame(null, true);

    expect(trace.snapshot).toMatchObject({
      status: 'failed',
      execution: 'main-thread-fallback',
      fetchMs: 8,
      decodeMs: 3,
      workerRoundTripMs: null,
      preloadHit: false,
      preloadLeadMs: 0,
      activationToFirstVisibleMs: null,
      timeToFirstVisibleMs: null,
    });

    const noRequest = new TempelFilamentPerformanceTrace(clock(60));

    noRequest.recordInstallation({ geometryPreparationMs: 1, sceneInstallationMs: 1 });
    noRequest.fail();
    noRequest.begin();

    expect(noRequest.beginFrame()).toBeNull();

    const notActivated = new TempelFilamentPerformanceTrace(clock(70, 80, 90, 100));

    notActivated.begin();
    notActivated.recordLoad({
      execution: 'worker',
      fetchMs: 4,
      decodeMs: 2,
      workerRoundTripMs: 8,
    });
    notActivated.recordInstallation({ geometryPreparationMs: 5, sceneInstallationMs: 1 });
    notActivated.completeFrame(notActivated.beginFrame(), true);

    expect(notActivated.snapshot).toMatchObject({
      status: 'visible',
      activationToFirstVisibleMs: null,
      timeToFirstVisibleMs: 30,
    });

    trace.begin();
    expect(trace.snapshot).toMatchObject({ status: 'loading', execution: null, fetchMs: null });

    trace.reset();
    expect(trace.snapshot.status).toBe('idle');
  });

  it('emploie performance.now comme horloge monotone par défaut', () => {
    const now = vi.spyOn(performance, 'now').mockReturnValue(123);
    const trace = new TempelFilamentPerformanceTrace();

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
      throw new Error('Horloge de test épuisée.');
    }

    return value;
  };
}
