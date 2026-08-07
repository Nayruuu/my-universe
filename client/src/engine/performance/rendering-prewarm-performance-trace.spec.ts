import { describe, expect, it } from 'vitest';
import { RenderingPrewarmPerformanceTrace } from './rendering-prewarm-performance-trace';

describe('RenderingPrewarmPerformanceTrace', () => {
  it('records each preparation window independently', () => {
    let now = 12;
    const trace = new RenderingPrewarmPerformanceTrace(() => now);

    trace.begin('initialScene');
    now = 32;
    trace.complete('initialScene', true);
    trace.begin('tempelScene');
    now = 57;
    trace.complete('tempelScene', false);

    expect(trace.snapshot).toEqual({
      initialScene: { status: 'ready', durationMs: 20 },
      tempelScene: { status: 'failed', durationMs: 25 },
    });
  });

  it('does not manufacture a duration without a started operation and resets cleanly', () => {
    const trace = new RenderingPrewarmPerformanceTrace(() => 20);

    trace.complete('initialScene', true);
    expect(trace.snapshot.initialScene).toEqual({ status: 'idle', durationMs: null });

    trace.begin('tempelScene');
    expect(trace.snapshot.tempelScene).toEqual({ status: 'running', durationMs: null });

    trace.reset();
    expect(trace.snapshot).toEqual({
      initialScene: { status: 'idle', durationMs: null },
      tempelScene: { status: 'idle', durationMs: null },
    });
  });
});
