import assert from 'node:assert/strict';
import test from 'node:test';
import {
  classifyFrameDuration,
  parseDebugTimingText,
  summarizeTempelBenchmarkSamples,
} from './tempel-transition-benchmark.mjs';

test('parses localized debug timing groups without depending on surrounding labels', () => {
  assert.deepEqual(parseDebugTimingText(' 3.40 ms / 0.10 ms ', 2), [3.4, 0.1]);
  assert.deepEqual(parseDebugTimingText('17,60 ms / 25,90 ms / 834,10 ms', 3), [17.6, 25.9, 834.1]);
  assert.deepEqual(
    parseDebugTimingText('15.20 ms / 27.70 ms / 1.03e+3 ms', 3),
    [15.2, 27.7, 1_030],
  );
  assert.throws(() => parseDebugTimingText('3.4 ms / —', 2), /Expected 2 timing values/u);
});

test('classifies first-frame duration against explicit 60 and 30 FPS budgets', () => {
  assert.equal(classifyFrameDuration(16.6), '60-fps');
  assert.equal(classifyFrameDuration(16.7), '30-fps');
  assert.equal(classifyFrameDuration(33.3), '30-fps');
  assert.equal(classifyFrameDuration(33.4), 'slow');
});

test('summarizes repeated samples with stable medians and worst-frame diagnostics', () => {
  const summary = summarizeTempelBenchmarkSamples([
    sample({
      geometryPreparationMs: 4,
      firstVisibleFrameMs: 20,
      activationToFirstVisibleMs: 30,
      timeToFirstVisibleMs: 810,
    }),
    sample({
      geometryPreparationMs: 2,
      firstVisibleFrameMs: 16,
      activationToFirstVisibleMs: 24,
      timeToFirstVisibleMs: 790,
    }),
    sample({
      geometryPreparationMs: 3,
      firstVisibleFrameMs: 18,
      activationToFirstVisibleMs: 27,
      timeToFirstVisibleMs: 800,
    }),
  ]);

  assert.deepEqual(summary, {
    profile: 'desktop',
    quality: 'high',
    runs: 3,
    preloadHits: 3,
    medians: {
      geometryPreparationMs: 3,
      sceneInstallationMs: 0.1,
      firstVisibleFrameMs: 18,
      activationToFirstVisibleMs: 27,
      timeToFirstVisibleMs: 800,
      preloadLeadMs: 600,
      drawCalls: 47,
      geometries: 17,
    },
    worstFirstVisibleFrameMs: 20,
    frameBudget: '30-fps',
  });
  assert.throws(() => summarizeTempelBenchmarkSamples([]), /at least one sample/u);
  assert.throws(
    () => summarizeTempelBenchmarkSamples([sample(), sample({ profile: 'mobile' })]),
    /same profile and quality/u,
  );
});

function sample(overrides = {}) {
  return {
    profile: 'desktop',
    quality: 'high',
    geometryPreparationMs: 3,
    sceneInstallationMs: 0.1,
    firstVisibleFrameMs: 18,
    activationToFirstVisibleMs: 27,
    timeToFirstVisibleMs: 800,
    preloadHit: true,
    preloadLeadMs: 600,
    drawCalls: 47,
    geometries: 17,
    ...overrides,
  };
}
