import { type TempelFilamentSpineCatalog } from './tempel-filament-spine-catalog';
import { prepareTempelFilamentSpineRenderData } from './tempel-filament-spine-render-data';
import { tempelFilamentSpineCatalogTransferables } from './tempel-filament-spine-worker-protocol';

describe('tempelFilamentSpineCatalogTransferables', () => {
  it('transfère une seule fois les buffers décodés et préparés pour le GPU', () => {
    const baseCatalog = catalogFixture();
    const catalog = {
      ...baseCatalog,
      renderData: prepareTempelFilamentSpineRenderData(baseCatalog, 200),
    };
    const tile = catalog.renderData.tiles[0]!;

    expect(tempelFilamentSpineCatalogTransferables(catalog)).toEqual([
      catalog.filamentIds.buffer,
      catalog.pointOffsets.buffer,
      catalog.positionsMpc.buffer,
      catalog.visitMap.buffer,
      catalog.density.buffer,
      catalog.orientationStrength.buffer,
      tile.positions.buffer,
      tile.alphas.buffer,
      tile.revealThresholds.buffer,
      tile.vertexFilamentIndices.buffer,
    ]);
  });

  it('transfère seulement les six buffers sources avant la préparation du rendu', () => {
    const catalog = catalogFixture();

    expect(tempelFilamentSpineCatalogTransferables(catalog)).toEqual([
      catalog.filamentIds.buffer,
      catalog.pointOffsets.buffer,
      catalog.positionsMpc.buffer,
      catalog.visitMap.buffer,
      catalog.density.buffer,
      catalog.orientationStrength.buffer,
    ]);
  });
});

function catalogFixture(): TempelFilamentSpineCatalog {
  return {
    filamentCount: 1,
    pointCount: 2,
    segmentCount: 1,
    referenceEpochJulianDay: 2_451_545,
    minimumDistanceMpc: 10,
    maximumDistanceMpc: 11,
    filamentIds: new Uint16Array([1]),
    pointOffsets: new Uint32Array([0, 2]),
    positionsMpc: new Float32Array([10, 0, 0, 11, 0, 0]),
    visitMap: new Uint8Array([64, 96]),
    density: new Uint8Array([80, 112]),
    orientationStrength: new Uint8Array([200, 210]),
  };
}
