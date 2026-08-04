import assert from 'node:assert/strict';
import test from 'node:test';
import {
  buildCosmicFilamentIndex,
  DEFAULT_COSMIC_FILAMENT_OPTIONS,
} from './build-cosmic-filament-index.mjs';

test('connects only nearby spatial neighbors without duplicate edges', () => {
  const positions = new Float32Array([0, 0, 0, 10, 0, 0, 20, 0, 0, 100, 0, 0]);
  const pairs = buildCosmicFilamentIndex(positions, 4, {
    cellSizeMpc: 15,
    maximumLengthMpc: 15,
    maximumNeighbors: 1,
  });

  assert.deepEqual(sortedPairKeys(pairs), ['0:1', '1:2']);
  assert.equal(new Set(pairKeys(pairs)).size, pairs.length / 2);
});

test('is deterministic and progressively distributes edges through the catalogue', () => {
  const positions = new Float32Array([-12, 0, 0, -6, 2, 0, 0, 0, 0, 6, -2, 0, 12, 0, 0, 0, 8, 0]);
  const options = {
    cellSizeMpc: 12,
    maximumLengthMpc: 14,
    maximumNeighbors: 2,
  };
  const first = buildCosmicFilamentIndex(positions, 6, options);
  const second = buildCosmicFilamentIndex(positions, 6, options);

  assert.deepEqual(first, second);
  assert.ok(first.length / 2 > 4);
  assert.equal(
    pairs(first)
      .slice(0, Math.ceil(first.length / 4))
      .every(([fromIndex]) => fromIndex < 3),
    false,
  );
});

test('finds the exact nearest neighbors across spatial-cell boundaries', () => {
  const positions = new Float32Array([
    -9.5, 1, 0, -4.9, -2, 1, 0.2, 0, 0, 4.8, 3, -1, 10.1, 0, 2, 17.6, -1, 0, 40, 0, 0,
  ]);
  const options = {
    cellSizeMpc: 5,
    maximumLengthMpc: 13,
    maximumNeighbors: 2,
  };
  const result = buildCosmicFilamentIndex(positions, positions.length / 3, options);

  assert.deepEqual(sortedPairKeys(result), bruteForcePairKeys(positions, options));
});

test('handles empty catalogues and rejects inconsistent inputs', () => {
  assert.deepEqual(buildCosmicFilamentIndex(new Float32Array(), 0), new Uint32Array());
  assert.deepEqual(buildCosmicFilamentIndex(new Float32Array([0, 0, 0]), 1), new Uint32Array());
  assert.deepEqual(
    buildCosmicFilamentIndex(new Float32Array([0, 0, 0, 200, 0, 0]), 2),
    new Uint32Array(),
  );
  assert.throws(
    () => buildCosmicFilamentIndex(new Float32Array([0, 0, 0]), 2),
    /Cosmicflows-4 positions/,
  );
  assert.throws(
    () =>
      buildCosmicFilamentIndex(new Float32Array([0, 0, 0, 1, 0, 0]), 2, {
        cellSizeMpc: 0,
        maximumLengthMpc: 10,
        maximumNeighbors: 1,
      }),
    /filament parameters/,
  );
  assert.throws(
    () => buildCosmicFilamentIndex(new Float32Array([Number.NaN, 0, 0, 1, 0, 0]), 2),
    /non-finite position/,
  );
});

test('bounds spatial work on a dense field of 1,000 groups', () => {
  const sideLength = 10;
  const count = sideLength ** 3;
  const positions = new Float32Array(count * 3);
  let offset = 0;

  for (let x = 0; x < sideLength; x += 1) {
    for (let y = 0; y < sideLength; y += 1) {
      for (let z = 0; z < sideLength; z += 1) {
        positions[offset] = x * 10;
        positions[offset + 1] = y * 10;
        positions[offset + 2] = z * 10;
        offset += 3;
      }
    }
  }
  const diagnostics = { visitedCellCount: -1, candidateComparisonCount: -1 };
  const result = buildCosmicFilamentIndex(
    positions,
    count,
    DEFAULT_COSMIC_FILAMENT_OPTIONS,
    diagnostics,
  );

  assert.ok(result.length / 2 > count);
  assert.ok(diagnostics.visitedCellCount < count * 28);
  assert.ok(diagnostics.candidateComparisonCount < count * 200);
});

function pairKeys(index) {
  return pairs(index).map(([fromIndex, toIndex]) => `${fromIndex}:${toIndex}`);
}

function sortedPairKeys(index) {
  return pairKeys(index).sort();
}

function pairs(index) {
  const result = [];

  for (let offset = 0; offset < index.length; offset += 2) {
    result.push([index[offset], index[offset + 1]]);
  }

  return result;
}

function bruteForcePairKeys(positions, options) {
  const keys = new Set();
  const count = positions.length / 3;

  for (let index = 0; index < count; index += 1) {
    const candidates = [];

    for (let candidateIndex = 0; candidateIndex < count; candidateIndex += 1) {
      if (candidateIndex === index) {
        continue;
      }
      const deltaX = positions[candidateIndex * 3] - positions[index * 3];
      const deltaY = positions[candidateIndex * 3 + 1] - positions[index * 3 + 1];
      const deltaZ = positions[candidateIndex * 3 + 2] - positions[index * 3 + 2];
      const distanceSquared = deltaX ** 2 + deltaY ** 2 + deltaZ ** 2;

      if (distanceSquared > 0 && distanceSquared <= options.maximumLengthMpc ** 2) {
        candidates.push({ index: candidateIndex, distanceSquared });
      }
    }
    candidates.sort(
      (first, second) =>
        first.distanceSquared - second.distanceSquared || first.index - second.index,
    );
    for (const candidate of candidates.slice(0, options.maximumNeighbors)) {
      keys.add(`${Math.min(index, candidate.index)}:${Math.max(index, candidate.index)}`);
    }
  }

  return [...keys].sort();
}
