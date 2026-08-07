import assert from 'node:assert/strict';
import test from 'node:test';
import {
  createResourceTimelineRows,
  hasStableRendererPlateau,
  parseRendererResourceSnapshot,
  summarizeResourceStability,
} from './resource-stability-benchmark.mjs';

test('hasStableRendererPlateau waits for consecutive stable renderer samples', () => {
  const changing = [
    sample(0, 20, 6, 10, null),
    sample(0, 22, 6, 12, null),
    sample(0, 22, 6, 12, null),
  ];
  const stable = [...changing, sample(0, 22, 6, 11, null)];

  assert.equal(hasStableRendererPlateau(changing), false);
  assert.equal(hasStableRendererPlateau(stable), true);
  assert.equal(hasStableRendererPlateau(stable.slice(-2)), false);
});

test('parseRendererResourceSnapshot validates renderer counters', () => {
  assert.deepEqual(
    parseRendererResourceSnapshot({
      cycle: 2,
      geometries: '24',
      textures: '8',
      drawCalls: '14',
      usedJsHeapBytes: 12_345,
    }),
    {
      cycle: 2,
      geometries: 24,
      textures: 8,
      drawCalls: 14,
      usedJsHeapBytes: 12_345,
    },
  );
  assert.throws(
    () =>
      parseRendererResourceSnapshot({
        cycle: 0,
        geometries: '24.5',
        textures: '8',
        drawCalls: '14',
        usedJsHeapBytes: null,
      }),
    /non-negative integer/u,
  );
});

test('summarizeResourceStability compares measured cycles with the warmed plateau', () => {
  const summary = summarizeResourceStability([
    sample(0, 24, 8, 14, 20_000_000),
    sample(1, 24, 8, 14, 21_000_000),
    sample(2, 25, 8, 15, 22_000_000),
  ]);

  assert.deepEqual(summary, {
    cycles: 2,
    baseline: sample(0, 24, 8, 14, 20_000_000),
    final: sample(2, 25, 8, 15, 22_000_000),
    peak: {
      geometries: 25,
      textures: 8,
      drawCalls: 15,
      usedJsHeapBytes: 22_000_000,
    },
    drift: {
      geometries: 1,
      textures: 0,
      drawCalls: 1,
      usedJsHeapBytes: 2_000_000,
    },
    stable: true,
  });
});

test('summarizeResourceStability reports renderer growth and invalid series', () => {
  const leaking = summarizeResourceStability([
    sample(0, 20, 6, 10, null),
    sample(1, 23, 8, 14, null),
  ]);

  assert.equal(leaking.stable, false);
  assert.deepEqual(leaking.drift, {
    geometries: 3,
    textures: 2,
    drawCalls: 4,
    usedJsHeapBytes: null,
  });
  assert.throws(() => summarizeResourceStability([]), /warmed baseline/u);
  assert.throws(() => summarizeResourceStability([sample(1, 20, 6, 10, null)]), /cycle zero/u);
});

test('createResourceTimelineRows exposes the plateau cycle by cycle', () => {
  assert.deepEqual(
    createResourceTimelineRows([
      sample(0, 20, 6, 10, 20 * 1024 * 1024),
      sample(1, 22, 6, 11, 23.5 * 1024 * 1024),
      sample(2, 22, 6, 10, null),
    ]),
    [
      {
        cycle: 0,
        geometries: 20,
        textures: 6,
        drawCalls: 10,
        heapMiB: '20.00',
        heapDriftMiB: '0.00',
      },
      {
        cycle: 1,
        geometries: 22,
        textures: 6,
        drawCalls: 11,
        heapMiB: '23.50',
        heapDriftMiB: '3.50',
      },
      {
        cycle: 2,
        geometries: 22,
        textures: 6,
        drawCalls: 10,
        heapMiB: 'n/a',
        heapDriftMiB: 'n/a',
      },
    ],
  );
});

function sample(cycle, geometries, textures, drawCalls, usedJsHeapBytes) {
  return { cycle, geometries, textures, drawCalls, usedJsHeapBytes };
}
