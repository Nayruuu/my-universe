import assert from 'node:assert/strict';
import test from 'node:test';
import { parseStartupMilestones, summarizeStartupSamples } from './startup-benchmark.mjs';

test('parseStartupMilestones reads the four debug timings', () => {
  assert.deepEqual(parseStartupMilestones('120.00 ms / 450,50 ms / 900 ms / 1.25e+3 ms'), {
    engineModuleMs: 120,
    dataReadyMs: 450.5,
    sceneReadyMs: 900,
    firstUsableMapMs: 1_250,
  });
  assert.throws(() => parseStartupMilestones('120 ms / —'), /four startup milestones/u);
});

test('summarizeStartupSamples reports medians and the configured budget', () => {
  const samples = [
    sample(100, 300, 600, 900),
    sample(120, 340, 620, 1_000),
    sample(110, 320, 610, 950),
  ];

  assert.deepEqual(summarizeStartupSamples(samples, 960), {
    profile: 'desktop',
    quality: 'high',
    runs: 3,
    medians: {
      engineModuleMs: 110,
      dataReadyMs: 320,
      sceneReadyMs: 610,
      firstUsableMapMs: 950,
    },
    worstFirstUsableMapMs: 1_000,
    withinBudget: true,
  });
  assert.equal(summarizeStartupSamples(samples, 900).withinBudget, false);
  assert.throws(() => summarizeStartupSamples([]), /requires at least one sample/u);
  assert.throws(
    () => summarizeStartupSamples([...samples, { ...samples[0], quality: 'low' }]),
    /same profile and quality/u,
  );
});

function sample(engineModuleMs, dataReadyMs, sceneReadyMs, firstUsableMapMs) {
  return {
    profile: 'desktop',
    quality: 'high',
    engineModuleMs,
    dataReadyMs,
    sceneReadyMs,
    firstUsableMapMs,
  };
}
