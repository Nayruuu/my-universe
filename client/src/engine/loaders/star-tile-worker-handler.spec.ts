import { handleStarTileWorkerRequest } from './star-tile-worker-handler';

describe('traitement Worker des tuiles stellaires', () => {
  const source = {
    id: 'gaia-tiles',
    url: '/index.json',
    sourceCatalogId: 'gaia',
  } as const;
  const packSource = { id: 'pack', url: '/pack.json' } as const;

  it('route séparément les index et les paquets', async () => {
    const index = { sourceCatalog: 'gaia' };
    const pack = { tiles: [] };
    const loadIndex = vi.fn(async () => index);
    const loadPack = vi.fn(async () => pack);

    await expect(
      handleStarTileWorkerRequest({ type: 'load-star-tile-index', source }, loadIndex as never),
    ).resolves.toEqual({ type: 'star-tile-index-loaded', index });
    await expect(
      handleStarTileWorkerRequest(
        { type: 'load-star-tile-pack', source: packSource },
        loadIndex as never,
        loadPack as never,
      ),
    ).resolves.toEqual({ type: 'star-tile-pack-loaded', pack });
    expect(loadIndex).toHaveBeenCalledWith(source);
    expect(loadPack).toHaveBeenCalledWith(packSource);
  });

  it('sérialise une Error et une erreur inconnue', async () => {
    await expect(
      handleStarTileWorkerRequest(
        { type: 'load-star-tile-index', source },
        vi.fn(async () => {
          throw new Error('index invalide');
        }),
      ),
    ).resolves.toEqual({ type: 'star-tile-error', message: 'index invalide' });
    await expect(
      handleStarTileWorkerRequest(
        { type: 'load-star-tile-pack', source: packSource },
        undefined,
        vi.fn(async () => {
          throw 'hors ligne';
        }),
      ),
    ).resolves.toEqual({ type: 'star-tile-error', message: 'erreur inconnue' });
  });
});
