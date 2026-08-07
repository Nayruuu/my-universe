import assert from 'node:assert/strict';
import test from 'node:test';
import {
  DEFAULT_FRAME_STABILITY_BUDGETS,
  parseAdaptiveRenderingStats,
  parseBenchmarkToggle,
  parseCpuThrottleRate,
  parseFrameDurations,
  summarizeFramePhases,
  summarizeFrameStability,
} from './frame-stability-benchmark.mjs';

test('parseCpuThrottleRate accepts explicit slowdown factors and rejects invalid values', () => {
  assert.equal(parseCpuThrottleRate(undefined), 1);
  assert.equal(parseCpuThrottleRate('4'), 4);
  assert.equal(parseCpuThrottleRate('1.5'), 1.5);
  assert.throws(() => parseCpuThrottleRate('0.5'), /at least one/u);
  assert.throws(() => parseCpuThrottleRate('slow'), /finite number/u);
});

test('parseBenchmarkToggle accepts zero and one without inventing another state', () => {
  assert.equal(parseBenchmarkToggle(undefined, 'labels'), true);
  assert.equal(parseBenchmarkToggle('1', 'labels'), true);
  assert.equal(parseBenchmarkToggle('0', 'labels'), false);
  assert.throws(() => parseBenchmarkToggle('yes', 'labels'), /labels.*zero or one/u);
});

test('parseAdaptiveRenderingStats validates the browser diagnostic contract', () => {
  assert.deepEqual(
    parseAdaptiveRenderingStats({
      status: 'stable',
      p95FrameMs: '16.6',
      longFrameRatio: 0.01,
      targetPixelRatio: 1.5,
      currentPixelRatio: '1.375',
    }),
    {
      status: 'stable',
      p95FrameMs: 16.6,
      longFrameRatio: 0.01,
      targetPixelRatio: 1.5,
      currentPixelRatio: 1.375,
    },
  );
  assert.deepEqual(
    parseAdaptiveRenderingStats({
      status: 'warming',
      p95FrameMs: null,
      longFrameRatio: null,
      targetPixelRatio: 1,
      currentPixelRatio: 1,
    }).p95FrameMs,
    null,
  );
  assert.throws(() => parseAdaptiveRenderingStats(null), /valid status/u);
  assert.throws(
    () =>
      parseAdaptiveRenderingStats({
        status: 'unknown',
        p95FrameMs: 16,
        longFrameRatio: 0,
        targetPixelRatio: 1,
        currentPixelRatio: 1,
      }),
    /valid status/u,
  );
  assert.throws(
    () =>
      parseAdaptiveRenderingStats({
        status: 'stable',
        p95FrameMs: -1,
        longFrameRatio: 0,
        targetPixelRatio: 1,
        currentPixelRatio: 1,
      }),
    /p95 frame duration/u,
  );
  assert.throws(
    () =>
      parseAdaptiveRenderingStats({
        status: 'stable',
        p95FrameMs: 16,
        longFrameRatio: 1.1,
        targetPixelRatio: 1,
        currentPixelRatio: 1,
      }),
    /cannot exceed one/u,
  );
  assert.throws(
    () =>
      parseAdaptiveRenderingStats({
        status: 'stable',
        p95FrameMs: 16,
        longFrameRatio: Number.NaN,
        targetPixelRatio: 1,
        currentPixelRatio: 1,
      }),
    /long-frame ratio/u,
  );
  assert.throws(
    () =>
      parseAdaptiveRenderingStats({
        status: 'stable',
        p95FrameMs: 16,
        longFrameRatio: 0,
        targetPixelRatio: 0,
        currentPixelRatio: 1,
      }),
    /target pixel ratio/u,
  );
  assert.throws(
    () =>
      parseAdaptiveRenderingStats({
        status: 'stable',
        p95FrameMs: 16,
        longFrameRatio: 0,
        targetPixelRatio: 1,
        currentPixelRatio: Number.POSITIVE_INFINITY,
      }),
    /current pixel ratio/u,
  );
});

test('parseFrameDurations keeps finite positive animation-frame intervals', () => {
  assert.deepEqual(parseFrameDurations([16.7, '17.2', 33.4]), [16.7, 17.2, 33.4]);
  assert.throws(() => parseFrameDurations([]), /at least one frame/u);
  assert.throws(() => parseFrameDurations([16.7, 0]), /positive finite/u);
  assert.throws(() => parseFrameDurations([16.7, Number.NaN]), /positive finite/u);
});

test('summarizeFrameStability calculates deterministic percentiles and long-frame ratios', () => {
  const summary = summarizeFrameStability([10, 16, 17, 18, 20, 25, 30, 34, 50, 80], {
    p95Ms: 80,
    p99Ms: 80,
    maximumMs: 100,
    longFrameRatio: 0.3,
  });

  assert.deepEqual(summary, {
    frames: 10,
    meanMs: 30,
    p50Ms: 20,
    p95Ms: 80,
    p99Ms: 80,
    maximumMs: 80,
    longFrames: 3,
    longFrameRatio: 0.3,
    stable: true,
  });
});

test('summarizeFrameStability rejects a regression against any explicit budget', () => {
  const durations = [16, 17, 18, 34, 70];

  assert.equal(summarizeFrameStability(durations).stable, false);
  assert.equal(
    summarizeFrameStability(durations, {
      ...DEFAULT_FRAME_STABILITY_BUDGETS,
      p95Ms: 100,
      p99Ms: 100,
      maximumMs: 100,
      longFrameRatio: 1,
    }).stable,
    true,
  );
});

test('summarizeFramePhases isolates the transition responsible for a long frame', () => {
  const phases = summarizeFramePhases([
    { phase: 'milky-way', durationMs: 16 },
    { phase: 'milky-way', durationMs: 18 },
    { phase: 'cosmic-web', durationMs: 17 },
    { phase: 'cosmic-web', durationMs: 120 },
  ]);

  assert.deepEqual(
    phases.map(({ phase, frames, maximumMs, longFrames }) => ({
      phase,
      frames,
      maximumMs,
      longFrames,
    })),
    [
      { phase: 'milky-way', frames: 2, maximumMs: 18, longFrames: 0 },
      { phase: 'cosmic-web', frames: 2, maximumMs: 120, longFrames: 1 },
    ],
  );
  assert.throws(() => summarizeFramePhases([{ phase: '', durationMs: 16 }]), /non-empty phase/u);
});
