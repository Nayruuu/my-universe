import { type TempelFilamentSpineCatalog } from './tempel-filament-spine-catalog';
import { handleTempelFilamentSpineWorkerRequest } from './tempel-filament-spine-worker-handler';
import { type TempelFilamentSpineWorkerRequest } from './tempel-filament-spine-worker-protocol';

describe('handleTempelFilamentSpineWorkerRequest', () => {
  const request: TempelFilamentSpineWorkerRequest = {
    type: 'load-tempel-filament-spines',
    source: { id: 'tempel-spines', url: '/spines.bin' },
  };

  it('renvoie le catalogue décodé avec un discriminant sérialisable', async () => {
    const catalog = catalogFixture();
    const loadCatalog = vi.fn(async () => ({
      catalog,
      metrics: { fetchMs: 24, decodeMs: 7 },
    }));

    const response = await handleTempelFilamentSpineWorkerRequest(request, loadCatalog);

    expect(response).toMatchObject({
      type: 'tempel-filament-spines-loaded',
      catalog,
      metrics: { fetchMs: 24, decodeMs: 7 },
    });
    expect(
      response.type === 'tempel-filament-spines-loaded' && response.catalog.renderData,
    ).toEqual(
      expect.objectContaining({
        sceneUnitsPerMpc: 200,
        segmentCount: 1,
        tiles: [expect.objectContaining({ tileIndex: 7, segmentCount: 1 })],
      }),
    );
    expect(loadCatalog).toHaveBeenCalledWith(request.source);
  });

  it('sérialise une erreur de chargement sans perdre son message', async () => {
    const loadCatalog = vi.fn(async () => {
      throw new Error('catalogue invalide');
    });

    await expect(handleTempelFilamentSpineWorkerRequest(request, loadCatalog)).resolves.toEqual({
      type: 'tempel-filament-spines-error',
      message: 'catalogue invalide',
    });
  });

  it('normalise une erreur inconnue avant de traverser la frontière du Worker', async () => {
    const loadCatalog = vi.fn(async () => {
      throw 'échec sans Error';
    });

    await expect(handleTempelFilamentSpineWorkerRequest(request, loadCatalog)).resolves.toEqual({
      type: 'tempel-filament-spines-error',
      message: 'erreur inconnue',
    });
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
