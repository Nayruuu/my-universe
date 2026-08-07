import assert from 'node:assert/strict';
import test from 'node:test';
import {
  parseObserverDeviceScaleFactor,
  summarizeObserverBenchmarkSamples,
} from './observer-frame-stability-benchmark.mjs';

test('parseObserverDeviceScaleFactor defaults to Retina and accepts positive finite values', () => {
  assert.equal(parseObserverDeviceScaleFactor(undefined), 2);
  assert.equal(parseObserverDeviceScaleFactor('1.5'), 1.5);
  assert.equal(parseObserverDeviceScaleFactor('3'), 3);
  assert.throws(() => parseObserverDeviceScaleFactor('0'), /positive finite number/u);
  assert.throws(() => parseObserverDeviceScaleFactor('-1'), /positive finite number/u);
  assert.throws(() => parseObserverDeviceScaleFactor('retina'), /positive finite number/u);
});

test('summarizeObserverBenchmarkSamples aggregates repeated matching journeys', () => {
  const summary = summarizeObserverBenchmarkSamples([
    sample({ p95Ms: 9, p99Ms: 16, maximumMs: 70, longFrameRatio: 0.01 }),
    sample({ p95Ms: 10, p99Ms: 17, maximumMs: 80, longFrameRatio: 0.02 }),
    sample({ p95Ms: 8, p99Ms: 15, maximumMs: 60, longFrameRatio: 0 }),
  ]);

  assert.deepEqual(summary, {
    profile: 'desktop-retina',
    quality: 'high',
    requestedDeviceScaleFactor: 2,
    cpuThrottleRate: 1,
    runs: 3,
    medianMetrics: {
      p95Ms: 9,
      p99Ms: 16,
      maximumMs: 70,
      longFrameRatio: 0.01,
      finalCanvasPixelRatio: 2,
    },
    worstMaximumMs: 80,
    worstLongFrameRatio: 0.02,
    resolvedRuns: 3,
    allStable: true,
    allPlanetsResolved: true,
  });
});

test('summarizeObserverBenchmarkSamples exposes unresolved or unstable runs', () => {
  const summary = summarizeObserverBenchmarkSamples([
    sample({ stable: false }),
    sample({ planetResolved: false }),
  ]);

  assert.equal(summary.allStable, false);
  assert.equal(summary.allPlanetsResolved, false);
  assert.equal(summary.resolvedRuns, 1);
});

test('summarizeObserverBenchmarkSamples rejects empty and mixed configurations', () => {
  assert.throws(() => summarizeObserverBenchmarkSamples([]), /at least one sample/u);
  assert.throws(
    () =>
      summarizeObserverBenchmarkSamples([
        sample(),
        sample({ profile: 'desktop', requestedDeviceScaleFactor: 1 }),
      ]),
    /same profile, quality, DPR, and CPU throttle/u,
  );
});

function sample(overrides = {}) {
  return {
    profile: 'desktop-retina',
    quality: 'high',
    requestedDeviceScaleFactor: 2,
    cpuThrottleRate: 1,
    p95Ms: 9,
    p99Ms: 16,
    maximumMs: 70,
    longFrameRatio: 0.01,
    finalCanvasPixelRatio: 2,
    stable: true,
    planetResolved: true,
    ...overrides,
  };
}
