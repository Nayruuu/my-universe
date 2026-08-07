import type { TempelFilamentSpineCatalog } from './tempel-filament-spine-catalog';
import {
  prepareTempelFilamentSpineRenderData,
  tempelFilamentSpineRenderDataTransferables,
} from './tempel-filament-spine-render-data';

describe('prepareTempelFilamentSpineRenderData', () => {
  it('prépare des tuiles typées, triées et directement exploitables par le GPU', () => {
    const catalog = catalogFixture();
    const renderData = prepareTempelFilamentSpineRenderData(catalog, 200);

    expect(renderData.sceneUnitsPerMpc).toBe(200);
    expect(renderData.segmentCount).toBe(catalog.segmentCount);
    expect(renderData.tiles).toHaveLength(3);
    expect(renderData.tiles.map(({ tileIndex }) => tileIndex)).toEqual([0, 6, 7]);
    expect(renderData.tiles.reduce((total, { segmentCount }) => total + segmentCount, 0)).toBe(
      catalog.segmentCount,
    );
    expect(
      renderData.tiles.every(
        (tile) =>
          tile.positions instanceof Float32Array &&
          tile.alphas instanceof Float32Array &&
          tile.revealThresholds instanceof Float32Array &&
          tile.vertexFilamentIndices instanceof Uint16Array &&
          tile.positions.length === tile.segmentCount * 6 &&
          tile.alphas.length === tile.segmentCount * 2 &&
          tile.revealThresholds.length === tile.segmentCount &&
          tile.vertexFilamentIndices.length === tile.segmentCount * 2,
      ),
    ).toBe(true);

    const positiveTile = renderData.tiles.find(({ tileIndex }) => tileIndex === 7)!;

    expect(Array.from(positiveTile.positions)).toEqual([
      2_000, 2_000, 2_000, 2_200, 2_200, 2_200, 2_200, 2_200, 2_200, 2_400, 2_400, 2_400,
    ]);
    expect(Array.from(positiveTile.vertexFilamentIndices)).toEqual([0, 0, 0, 0]);
    expect(positiveTile.revealThresholds[0]).toBe(0);
    expect(positiveTile.revealThresholds[1]).toBe(0);
    expect(positiveTile.bounds.minimum).toEqual([2_000, 2_000, 2_000]);
    expect(positiveTile.bounds.maximum).toEqual([2_400, 2_400, 2_400]);
    expect(positiveTile.bounds.radius).toBeGreaterThan(0);
  });

  it('ordonne les segments d’une tuile selon leur seuil puis leur filament', () => {
    const catalog = catalogFixture();

    catalog.positionsMpc.set([-20, -20, -20, -21, -21, -21], 9);
    const renderData = prepareTempelFilamentSpineRenderData(catalog, 1);
    const negativeTile = renderData.tiles.find(({ tileIndex }) => tileIndex === 0)!;

    expect(negativeTile.segmentCount).toBe(2);
    expect(negativeTile.revealThresholds[0]).toBeLessThanOrEqual(negativeTile.revealThresholds[1]!);
    expect(Array.from(negativeTile.vertexFilamentIndices)).toEqual([2, 2, 1, 1]);
  });

  it('conserve l’ordre des filaments lorsque leurs seuils sont identiques', () => {
    const catalog = catalogFixture();

    catalog.filamentIds.set([1, 1, 1]);
    catalog.positionsMpc.set([-20, -20, -20, -21, -21, -21], 9);
    const renderData = prepareTempelFilamentSpineRenderData(catalog, 1);
    const negativeTile = renderData.tiles.find(({ tileIndex }) => tileIndex === 0)!;

    expect(Array.from(negativeTile.revealThresholds)).toEqual([0, 0]);
    expect(Array.from(negativeTile.vertexFilamentIndices)).toEqual([1, 1, 2, 2]);
  });

  it.each([0, -1, Number.NaN, Number.POSITIVE_INFINITY])(
    'refuse une échelle de rendu invalide (%s)',
    (scale) => {
      expect(() => prepareTempelFilamentSpineRenderData(catalogFixture(), scale)).toThrow(
        'échelle de rendu invalide',
      );
    },
  );

  it('transfère les quatre buffers de chaque tuile dans un ordre stable', () => {
    const renderData = prepareTempelFilamentSpineRenderData(catalogFixture(), 200);

    expect(tempelFilamentSpineRenderDataTransferables(renderData)).toEqual(
      renderData.tiles.flatMap((tile) => [
        tile.positions.buffer,
        tile.alphas.buffer,
        tile.revealThresholds.buffer,
        tile.vertexFilamentIndices.buffer,
      ]),
    );
  });
});

function catalogFixture(): TempelFilamentSpineCatalog {
  return {
    filamentCount: 3,
    pointCount: 7,
    segmentCount: 4,
    referenceEpochJulianDay: 2_451_545,
    minimumDistanceMpc: Math.sqrt(300),
    maximumDistanceMpc: Math.sqrt(1_764),
    filamentIds: new Uint16Array([1, 2, 3]),
    pointOffsets: new Uint32Array([0, 3, 5, 7]),
    positionsMpc: new Float32Array([
      10, 10, 10, 11, 11, 11, 12, 12, 12, -20, 20, 20, -21, 21, 21, -30, -30, -30, -31, -31, -31,
    ]),
    visitMap: new Uint8Array([32, 64, 96, 128, 160, 192, 224]),
    density: new Uint8Array([48, 80, 112, 144, 176, 208, 240]),
    orientationStrength: new Uint8Array([64, 96, 128, 160, 192, 224, 255]),
  };
}
