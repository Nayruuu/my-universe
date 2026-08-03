import {
  buildCosmicFilamentGraph,
  type CosmicFilamentGraphDiagnostics,
} from './cosmic-filament-graph';

describe('graphe de filaments Cosmicflows-4', () => {
  it('relie uniquement les voisins spatiaux proches sans arête dupliquée', () => {
    const positions = new Float32Array([0, 0, 0, 10, 0, 0, 20, 0, 0, 100, 0, 0]);
    const edges = buildCosmicFilamentGraph(positions, 4, {
      cellSizeMpc: 15,
      maximumLengthMpc: 15,
      maximumNeighbors: 1,
    });

    expect(edges).toHaveLength(2);
    expect(
      edges
        .map(({ fromIndex, toIndex }) => [fromIndex, toIndex])
        .sort(([firstA], [firstB]) => firstA! - firstB!),
    ).toEqual([
      [0, 1],
      [1, 2],
    ]);
    expect(edges.every(({ distanceMpc }) => distanceMpc <= 15)).toBe(true);
    expect(new Set(edges.map(({ fromIndex, toIndex }) => `${fromIndex}:${toIndex}`)).size).toBe(
      edges.length,
    );
  });

  it('reste déterministe et distribue progressivement les arêtes dans le catalogue', () => {
    const positions = new Float32Array([-12, 0, 0, -6, 2, 0, 0, 0, 0, 6, -2, 0, 12, 0, 0, 0, 8, 0]);
    const options = {
      cellSizeMpc: 12,
      maximumLengthMpc: 14,
      maximumNeighbors: 2,
    } as const;
    const first = buildCosmicFilamentGraph(positions, 6, options);
    const second = buildCosmicFilamentGraph(positions, 6, options);

    expect(first).toEqual(second);
    expect(first.length).toBeGreaterThan(4);
    expect(
      first.slice(0, Math.ceil(first.length / 2)).every(({ fromIndex }) => fromIndex < 3),
    ).toBe(false);
    expect(first.every(({ strength }) => strength > 0 && strength <= 1)).toBe(true);
  });

  it('retrouve exactement les plus proches voisins à travers les limites de cellule', () => {
    const positions = new Float32Array([
      -9.5, 1, 0, -4.9, -2, 1, 0.2, 0, 0, 4.8, 3, -1, 10.1, 0, 2, 17.6, -1, 0, 40, 0, 0,
    ]);
    const options = {
      cellSizeMpc: 5,
      maximumLengthMpc: 13,
      maximumNeighbors: 2,
    } as const;
    const edges = buildCosmicFilamentGraph(positions, positions.length / 3, options);

    expect(edgeKeys(edges)).toEqual(bruteForceEdgeKeys(positions, options));
  });

  it('gère un catalogue vide et refuse les entrées incohérentes', () => {
    expect(buildCosmicFilamentGraph(new Float32Array(), 0)).toEqual([]);
    expect(buildCosmicFilamentGraph(new Float32Array([0, 0, 0]), 1)).toEqual([]);
    expect(buildCosmicFilamentGraph(new Float32Array([0, 0, 0, 200, 0, 0]), 2)).toEqual([]);
    expect(() => buildCosmicFilamentGraph(new Float32Array([0, 0, 0]), 2)).toThrow(
      'positions Cosmicflows-4',
    );
    expect(() =>
      buildCosmicFilamentGraph(new Float32Array([0, 0, 0, 1, 0, 0]), 2, {
        cellSizeMpc: 0,
        maximumLengthMpc: 10,
        maximumNeighbors: 1,
      }),
    ).toThrow('paramètres de filaments');
    expect(() =>
      buildCosmicFilamentGraph(new Float32Array([Number.NaN, 0, 0, 1, 0, 0]), 2),
    ).toThrow('position non finie');
  });

  it('borne le travail spatial sur un champ dense de 1 000 groupes', () => {
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
    const diagnostics: CosmicFilamentGraphDiagnostics = {
      visitedCellCount: -1,
      candidateComparisonCount: -1,
    };
    const edges = buildCosmicFilamentGraph(positions, count, undefined, diagnostics);

    expect(edges.length).toBeGreaterThan(count);
    expect(diagnostics.visitedCellCount).toBeLessThan(count * 28);
    expect(diagnostics.candidateComparisonCount).toBeLessThan(count * 200);
  });
});

function edgeKeys(
  edges: readonly { readonly fromIndex: number; readonly toIndex: number }[],
): string[] {
  return edges.map(({ fromIndex, toIndex }) => `${fromIndex}:${toIndex}`).sort();
}

function bruteForceEdgeKeys(
  positions: Float32Array,
  options: {
    readonly maximumLengthMpc: number;
    readonly maximumNeighbors: number;
  },
): string[] {
  const keys = new Set<string>();
  const count = positions.length / 3;

  for (let index = 0; index < count; index += 1) {
    const candidates: Array<{ index: number; distanceSquared: number }> = [];

    for (let candidateIndex = 0; candidateIndex < count; candidateIndex += 1) {
      if (candidateIndex === index) {
        continue;
      }
      const deltaX = positions[candidateIndex * 3]! - positions[index * 3]!;
      const deltaY = positions[candidateIndex * 3 + 1]! - positions[index * 3 + 1]!;
      const deltaZ = positions[candidateIndex * 3 + 2]! - positions[index * 3 + 2]!;
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
