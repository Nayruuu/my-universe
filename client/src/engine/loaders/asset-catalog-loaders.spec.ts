import { loadOptionalBinaryAsset } from './asset-catalog-loaders';

describe('loadOptionalBinaryAsset', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('parses an available binary resource without warnings', async () => {
    const buffer = new Uint8Array([42]).buffer;

    vi.stubGlobal(
      'fetch',
      vi.fn(async () => ({
        ok: true,
        status: 200,
        arrayBuffer: async () => buffer,
      })),
    );

    await expect(
      loadOptionalBinaryAsset({
        datasetId: 'fixture',
        url: '/fixture.bin',
        warningLabel: 'Ressource de test indisponible',
        parse: (value) => new Uint8Array(value)[0]!,
      }),
    ).resolves.toEqual({ value: 42, warnings: [] });
  });

  it('preserves HTTP failures and normalizes non-standard rejections', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => ({ ok: false, status: 503 })),
    );

    await expect(
      loadOptionalBinaryAsset({
        datasetId: 'fixture',
        url: '/fixture.bin',
        warningLabel: 'Ressource de test indisponible',
        parse: () => 42,
      }),
    ).resolves.toEqual({
      value: null,
      warnings: ['Ressource de test indisponible : Impossible de charger fixture (503).'],
    });

    vi.stubGlobal(
      'fetch',
      vi.fn(async () => Promise.reject('échec brut')),
    );

    await expect(
      loadOptionalBinaryAsset({
        datasetId: 'fixture',
        url: '/fixture.bin',
        warningLabel: 'Ressource de test indisponible',
        parse: () => 42,
      }),
    ).resolves.toEqual({
      value: null,
      warnings: ['Ressource de test indisponible : erreur inconnue'],
    });
  });
});
