import { SpaceObject } from '../../data/models/universe.models';
import { AssetLoader } from './asset-loader';
import {
  COSMIC_GROUP_CATALOG_HEADER_BYTES,
  COSMIC_GROUP_CATALOG_MAGIC,
  COSMIC_GROUP_CATALOG_RECORD_BYTES,
  COSMIC_GROUP_CATALOG_VERSION,
} from './cosmic-group-catalog';
import {
  COSMIC_STRUCTURE_CATALOG_HEADER_BYTES,
  COSMIC_STRUCTURE_CATALOG_MAGIC,
  COSMIC_STRUCTURE_CATALOG_RECORD_BYTES,
  COSMIC_STRUCTURE_CATALOG_VERSION,
} from './cosmic-structure-catalog';
import {
  COSMIC_WEB_VOLUME_HEADER_BYTES,
  COSMIC_WEB_VOLUME_MAGIC,
  COSMIC_WEB_VOLUME_VERSION,
} from './cosmic-web-volume';
import {
  EXOPLANET_CATALOG_HEADER_BYTES,
  EXOPLANET_CATALOG_HOST_RECORD_BYTES,
  EXOPLANET_CATALOG_MAGIC,
  EXOPLANET_CATALOG_PLANET_RECORD_BYTES,
  EXOPLANET_CATALOG_VERSION,
} from './exoplanet-catalog';
import {
  STAR_CATALOG_HEADER_BYTES,
  STAR_CATALOG_MAGIC,
  STAR_CATALOG_RECORD_BYTES,
  STAR_CATALOG_VERSION,
} from './star-catalog';

describe('AssetLoader', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('charge ensemble les objets JSON et le catalogue stellaire binaire', async () => {
    const fetchMock = installFetch({
      '/data/manifest.json': successfulResponse({
        version: '1.0.0',
        datasets: [
          { id: 'objects', url: '/data/objects.json', type: 'json' },
          {
            id: 'stars',
            url: '/data/stars.bin',
            type: 'binary',
            format: 'star-catalog-v2',
          },
        ],
      }),
      '/data/objects.json': successfulResponse(dataset([spaceObject('sun')])),
      '/data/stars.bin': successfulBinaryResponse(starCatalogBuffer()),
    });

    const assets = await new AssetLoader().loadAssets();

    expect(assets.objects.map((object) => object.id)).toEqual(['sun']);
    expect(assets.starCatalog?.count).toBe(1);
    expect(assets.starCatalog?.catalogIds[0]).toBe(3_229);
    expect(assets.warnings).toEqual([]);
    expect(fetchMock).toHaveBeenCalledTimes(3);
    expect(fetchMock).toHaveBeenCalledWith('/data/stars.bin');
  });

  it('diffère les catalogues lointains sans retarder les données de la première vue', async () => {
    const fetchMock = installFetch({
      '/data/manifest.json': successfulResponse({
        version: '1.0.0',
        datasets: [
          { id: 'objects', url: '/data/objects.json', type: 'json' },
          {
            id: 'stars',
            url: '/data/stars.bin',
            type: 'binary',
            format: 'star-catalog-v2',
          },
          {
            id: 'nasa-exoplanets',
            url: '/data/exoplanets.bin',
            metadataUrl: '/data/exoplanets.json',
            type: 'exoplanet-catalog',
            format: 'exoplanet-catalog-v1',
          },
          {
            id: 'cosmic-groups',
            url: '/data/cosmic-groups.bin',
            type: 'cosmic-group-catalog',
            format: 'cosmicflows4-group-catalog-v2',
          },
          {
            id: 'cosmic-structures',
            url: '/data/cosmic-structures.bin',
            metadataUrl: '/data/cosmic-structures.json',
            type: 'cosmic-structure-catalog',
            format: 'cosmic-structure-catalog-v1',
          },
          {
            id: 'cosmic-web',
            url: '/data/cosmic-web.bin',
            type: 'cosmic-web-volume',
            format: 'cosmic-web-volume-v1',
          },
        ],
      }),
      '/data/objects.json': successfulResponse(dataset([spaceObject('sun')])),
      '/data/stars.bin': successfulBinaryResponse(starCatalogBuffer()),
      '/data/exoplanets.json': successfulResponse(exoplanetMetadata()),
      '/data/exoplanets.bin': successfulBinaryResponse(exoplanetCatalogBuffer()),
      '/data/cosmic-groups.bin': successfulBinaryResponse(cosmicGroupCatalogBuffer()),
      '/data/cosmic-structures.json': successfulResponse(cosmicStructureMetadata()),
      '/data/cosmic-structures.bin': successfulBinaryResponse(cosmicStructureCatalogBuffer()),
      '/data/cosmic-web.bin': successfulBinaryResponse(cosmicWebVolumeBuffer()),
    });

    const assets = await new AssetLoader().loadInitialAssets();

    expect(assets.objects.map(({ id }) => id)).toEqual(['sun']);
    expect(assets.starCatalog?.count).toBe(1);
    expect(assets.exoplanetCatalog).toBeNull();
    expect(assets.cosmicGroupCatalog).toBeNull();
    expect(assets.cosmicStructureCatalog).toBeNull();
    expect(assets.cosmicWebVolume).toBeNull();
    expect(fetchMock).not.toHaveBeenCalledWith('/data/exoplanets.bin');
    expect(fetchMock).not.toHaveBeenCalledWith('/data/cosmic-groups.bin');
    expect(fetchMock).not.toHaveBeenCalledWith('/data/cosmic-structures.bin');
    expect(fetchMock).not.toHaveBeenCalledWith('/data/cosmic-web.bin');

    const firstLoad = assets.loadDeferredCatalogs!();
    const concurrentLoad = assets.loadDeferredCatalogs!();

    expect(concurrentLoad).toBe(firstLoad);
    const deferred = await firstLoad;

    expect(deferred.exoplanetCatalog?.planetCount).toBe(1);
    expect(deferred.cosmicGroupCatalog?.count).toBe(1);
    expect(deferred.cosmicStructureCatalog?.count).toBe(1);
    expect(deferred.cosmicWebVolume?.resolution).toBe(4);
    expect(deferred.warnings).toEqual([]);
    expect(fetchMock.mock.calls.filter(([url]) => url === '/data/exoplanets.bin')).toHaveLength(1);
  });

  it('n’ajoute aucun chargement différé quand le manifest ne contient aucun catalogue lourd', async () => {
    installFetch({
      '/data/manifest.json': successfulResponse({ version: '1.0.0', datasets: [] }),
    });

    const assets = await new AssetLoader().loadInitialAssets();

    expect(assets.loadDeferredCatalogs).toBeNull();
  });

  it('charge le catalogue compact de groupes Cosmicflows-4', async () => {
    const fetchMock = installFetch({
      '/data/manifest.json': successfulResponse({
        version: '1.0.0',
        datasets: [
          {
            id: 'cosmicflows4-groups',
            url: '/data/cosmic-groups.bin',
            type: 'cosmic-group-catalog',
            format: 'cosmicflows4-group-catalog-v2',
          },
        ],
      }),
      '/data/cosmic-groups.bin': successfulBinaryResponse(cosmicGroupCatalogBuffer()),
    });

    const assets = await new AssetLoader().loadAssets();

    expect(assets.cosmicGroupCatalog?.count).toBe(1);
    expect(assets.cosmicGroupCatalog?.pgcIds[0]).toBe(42);
    expect(assets.cosmicGroupCatalog?.filamentPairs).toEqual(new Uint32Array());
    expect(assets.warnings).toEqual([]);
    expect(fetchMock).toHaveBeenCalledWith('/data/cosmic-groups.bin');
  });

  it('charge le catalogue NASA compact et ses métadonnées de provenance', async () => {
    const fetchMock = installFetch({
      '/data/manifest.json': successfulResponse({
        version: '1.0.0',
        datasets: [
          {
            id: 'nasa-exoplanets',
            url: '/data/exoplanets.bin',
            metadataUrl: '/data/exoplanets.json',
            type: 'exoplanet-catalog',
            format: 'exoplanet-catalog-v1',
          },
        ],
      }),
      '/data/exoplanets.json': successfulResponse(exoplanetMetadata()),
      '/data/exoplanets.bin': successfulBinaryResponse(exoplanetCatalogBuffer()),
    });

    const assets = await new AssetLoader().loadAssets();

    expect(assets.exoplanetCatalog?.hostCount).toBe(1);
    expect(assets.exoplanetCatalog?.planetCount).toBe(1);
    expect(assets.exoplanetCatalog?.hostNames).toEqual(['Test Host']);
    expect(assets.exoplanetCatalog?.planetNames).toEqual(['Test Host b']);
    expect(assets.warnings).toEqual([]);
    expect(fetchMock).toHaveBeenCalledWith('/data/exoplanets.json');
    expect(fetchMock).toHaveBeenCalledWith('/data/exoplanets.bin');
  });

  it('conserve les autres données si le catalogue NASA est indisponible', async () => {
    installFetch({
      '/data/manifest.json': successfulResponse({
        version: '1.0.0',
        datasets: [
          {
            id: 'nasa-exoplanets',
            url: '/data/exoplanets.bin',
            metadataUrl: '/data/exoplanets.json',
            type: 'exoplanet-catalog',
            format: 'exoplanet-catalog-v1',
          },
        ],
      }),
      '/data/exoplanets.json': failedResponse(503),
    });

    const assets = await new AssetLoader().loadAssets();

    expect(assets.exoplanetCatalog).toBeNull();
    expect(assets.warnings).toEqual([
      'Catalogue d’exoplanètes indisponible : Impossible de charger les métadonnées nasa-exoplanets (503).',
    ]);
  });

  it('signale séparément un binaire NASA indisponible ou illisible', async () => {
    const manifest = {
      version: '1.0.0',
      datasets: [
        {
          id: 'nasa-exoplanets',
          url: '/data/exoplanets.bin',
          metadataUrl: '/data/exoplanets.json',
          type: 'exoplanet-catalog',
          format: 'exoplanet-catalog-v1',
        },
      ],
    };

    installFetch({
      '/data/manifest.json': successfulResponse(manifest),
      '/data/exoplanets.json': successfulResponse(exoplanetMetadata()),
      '/data/exoplanets.bin': failedResponse(502),
    });
    const unavailable = await new AssetLoader().loadAssets();

    expect(unavailable.exoplanetCatalog).toBeNull();
    expect(unavailable.warnings[0]).toContain('Impossible de charger nasa-exoplanets (502)');

    installFetch({
      '/data/manifest.json': successfulResponse(manifest),
      '/data/exoplanets.json': successfulResponse(exoplanetMetadata()),
      '/data/exoplanets.bin': {
        ok: true,
        status: 200,
        arrayBuffer: async () => Promise.reject('échec brut'),
      } as Response,
    });
    const unreadable = await new AssetLoader().loadAssets();

    expect(unreadable.exoplanetCatalog).toBeNull();
    expect(unreadable.warnings).toEqual(['Catalogue d’exoplanètes indisponible : erreur inconnue']);
  });

  it('conserve les autres données si le catalogue cosmique est indisponible', async () => {
    installFetch({
      '/data/manifest.json': successfulResponse({
        version: '1.0.0',
        datasets: [
          {
            id: 'cosmicflows4-groups',
            url: '/data/cosmic-groups.bin',
            type: 'cosmic-group-catalog',
            format: 'cosmicflows4-group-catalog-v2',
          },
        ],
      }),
      '/data/cosmic-groups.bin': failedResponse(503),
    });

    const assets = await new AssetLoader().loadAssets();

    expect(assets.cosmicGroupCatalog).toBeNull();
    expect(assets.warnings).toEqual([
      'Catalogue de groupes cosmiques indisponible : Impossible de charger cosmicflows4-groups (503).',
    ]);
  });

  it('normalise une erreur cosmique non standard sans interrompre le démarrage', async () => {
    installFetch({
      '/data/manifest.json': successfulResponse({
        version: '1.0.0',
        datasets: [
          {
            id: 'cosmicflows4-groups',
            url: '/data/cosmic-groups.bin',
            type: 'cosmic-group-catalog',
            format: 'cosmicflows4-group-catalog-v2',
          },
        ],
      }),
      '/data/cosmic-groups.bin': {
        ok: true,
        status: 200,
        arrayBuffer: async () => Promise.reject('échec brut'),
      } as Response,
    });

    const assets = await new AssetLoader().loadAssets();

    expect(assets.cosmicGroupCatalog).toBeNull();
    expect(assets.warnings).toEqual([
      'Catalogue de groupes cosmiques indisponible : erreur inconnue',
    ]);
  });

  it('charge le volume statique simulé du réseau cosmique', async () => {
    const fetchMock = installFetch({
      '/data/manifest.json': successfulResponse({
        version: '1.0.0',
        datasets: [
          {
            id: 'cosmic-web-density',
            url: '/data/cosmic-web-density.bin',
            type: 'cosmic-web-volume',
            format: 'cosmic-web-volume-v1',
          },
        ],
      }),
      '/data/cosmic-web-density.bin': successfulBinaryResponse(cosmicWebVolumeBuffer()),
    });

    const assets = await new AssetLoader().loadAssets();

    expect(assets.cosmicWebVolume).toMatchObject({
      resolution: 4,
      halfExtentMpc: 800,
      sourceGroupCount: 3,
      sourceEdgeCount: 2,
    });
    expect(assets.cosmicWebVolume?.density).toHaveLength(64);
    expect(assets.warnings).toEqual([]);
    expect(fetchMock).toHaveBeenCalledWith('/data/cosmic-web-density.bin');
  });

  it('conserve les autres données si le volume cosmique est indisponible', async () => {
    installFetch({
      '/data/manifest.json': successfulResponse({
        version: '1.0.0',
        datasets: [
          {
            id: 'cosmic-web-density',
            url: '/data/cosmic-web-density.bin',
            type: 'cosmic-web-volume',
            format: 'cosmic-web-volume-v1',
          },
        ],
      }),
      '/data/cosmic-web-density.bin': failedResponse(503),
    });

    const assets = await new AssetLoader().loadAssets();

    expect(assets.cosmicWebVolume).toBeNull();
    expect(assets.warnings).toEqual([
      'Volume du réseau cosmique indisponible : Impossible de charger cosmic-web-density (503).',
    ]);
  });

  it('normalise une erreur volumique non standard sans interrompre le démarrage', async () => {
    installFetch({
      '/data/manifest.json': successfulResponse({
        version: '1.0.0',
        datasets: [
          {
            id: 'cosmic-web-density',
            url: '/data/cosmic-web-density.bin',
            type: 'cosmic-web-volume',
            format: 'cosmic-web-volume-v1',
          },
        ],
      }),
      '/data/cosmic-web-density.bin': {
        ok: true,
        status: 200,
        arrayBuffer: async () => Promise.reject('échec brut'),
      } as Response,
    });

    const assets = await new AssetLoader().loadAssets();

    expect(assets.cosmicWebVolume).toBeNull();
    expect(assets.warnings).toEqual(['Volume du réseau cosmique indisponible : erreur inconnue']);
  });

  it('charge le catalogue binaire et les provenances des structures cosmiques', async () => {
    const fetchMock = installFetch({
      '/data/manifest.json': successfulResponse({
        version: '1.0.0',
        datasets: [
          {
            id: 'cosmic-structures',
            url: '/data/structures.bin',
            metadataUrl: '/data/structures.json',
            type: 'cosmic-structure-catalog',
            format: 'cosmic-structure-catalog-v1',
          },
        ],
      }),
      '/data/structures.json': successfulResponse(cosmicStructureMetadata()),
      '/data/structures.bin': successfulBinaryResponse(cosmicStructureCatalogBuffer()),
    });

    const assets = await new AssetLoader().loadAssets();

    expect(assets.cosmicStructureCatalog?.count).toBe(1);
    expect(assets.cosmicStructureCatalog?.identifiers).toEqual(['239+027+0091']);
    expect(assets.cosmicStructureCatalog?.metadata.sources[0]?.citation).toBe(
      'Liivamägi et al. (2012)',
    );
    expect(assets.warnings).toEqual([]);
    expect(fetchMock).toHaveBeenCalledWith('/data/structures.json');
    expect(fetchMock).toHaveBeenCalledWith('/data/structures.bin');
  });

  it('conserve les autres données si les structures cosmiques sont indisponibles', async () => {
    installFetch({
      '/data/manifest.json': successfulResponse({
        version: '1.0.0',
        datasets: [
          {
            id: 'cosmic-structures',
            url: '/data/structures.bin',
            metadataUrl: '/data/structures.json',
            type: 'cosmic-structure-catalog',
            format: 'cosmic-structure-catalog-v1',
          },
        ],
      }),
      '/data/structures.json': failedResponse(503),
    });

    const assets = await new AssetLoader().loadAssets();

    expect(assets.cosmicStructureCatalog).toBeNull();
    expect(assets.warnings).toEqual([
      'Catalogue de structures cosmiques indisponible : Impossible de charger les métadonnées cosmic-structures (503).',
    ]);
  });

  it('signale séparément un binaire de structures indisponible', async () => {
    installFetch({
      '/data/manifest.json': successfulResponse({
        version: '1.0.0',
        datasets: [
          {
            id: 'cosmic-structures',
            url: '/data/structures.bin',
            metadataUrl: '/data/structures.json',
            type: 'cosmic-structure-catalog',
            format: 'cosmic-structure-catalog-v1',
          },
        ],
      }),
      '/data/structures.json': successfulResponse(cosmicStructureMetadata()),
      '/data/structures.bin': failedResponse(502),
    });

    const assets = await new AssetLoader().loadAssets();

    expect(assets.cosmicStructureCatalog).toBeNull();
    expect(assets.warnings).toEqual([
      'Catalogue de structures cosmiques indisponible : Impossible de charger cosmic-structures (502).',
    ]);
  });

  it('normalise une erreur de structure non standard sans interrompre le démarrage', async () => {
    installFetch({
      '/data/manifest.json': successfulResponse({
        version: '1.0.0',
        datasets: [
          {
            id: 'cosmic-structures',
            url: '/data/structures.bin',
            metadataUrl: '/data/structures.json',
            type: 'cosmic-structure-catalog',
            format: 'cosmic-structure-catalog-v1',
          },
        ],
      }),
      '/data/structures.json': successfulResponse(cosmicStructureMetadata()),
      '/data/structures.bin': {
        ok: true,
        status: 200,
        arrayBuffer: async () => Promise.reject('échec brut'),
      } as Response,
    });

    const assets = await new AssetLoader().loadAssets();

    expect(assets.cosmicStructureCatalog).toBeNull();
    expect(assets.warnings).toEqual([
      'Catalogue de structures cosmiques indisponible : erreur inconnue',
    ]);
  });

  it('charge et recoupe les tracés de constellations avec les identifiants HYG', async () => {
    const fetchMock = installFetch({
      '/data/manifest.json': successfulResponse({
        version: '1.0.0',
        datasets: [
          {
            id: 'stars',
            url: '/data/stars.bin',
            type: 'binary',
            format: 'star-catalog-v2',
          },
          {
            id: 'constellations',
            url: '/data/stars/constellations.json',
            type: 'constellation-lines',
            format: 'constellation-lines-v1',
          },
        ],
      }),
      '/data/stars.bin': successfulBinaryResponse(starCatalogBuffer([3_229, 6_960])),
      '/data/stars/constellations.json': successfulResponse(constellationCatalog([[3_229, 6_960]])),
    });

    const assets = await new AssetLoader().loadAssets();

    expect(assets.constellationCatalog?.figures[0]?.segments).toEqual([[3_229, 6_960]]);
    expect(fetchMock).toHaveBeenCalledTimes(3);
  });

  it('rejette une constellation qui référence une étoile absente', async () => {
    installFetch({
      '/data/manifest.json': successfulResponse({
        version: '1.0.0',
        datasets: [
          {
            id: 'stars',
            url: '/data/stars.bin',
            type: 'binary',
            format: 'star-catalog-v2',
          },
          {
            id: 'constellations',
            url: '/data/stars/constellations.json',
            type: 'constellation-lines',
            format: 'constellation-lines-v1',
          },
        ],
      }),
      '/data/stars.bin': successfulBinaryResponse(starCatalogBuffer()),
      '/data/stars/constellations.json': successfulResponse(
        constellationCatalog([[3_229, 99_999]]),
      ),
    });

    await expect(new AssetLoader().loadAssets()).rejects.toThrow(
      'Étoile HYG 99999 absente du catalogue pour la constellation orion.',
    );
  });

  it('produit une erreur explicite lorsque le catalogue de constellations est indisponible', async () => {
    installFetch({
      '/data/manifest.json': successfulResponse({
        version: '1.0.0',
        datasets: [
          {
            id: 'constellations',
            url: '/data/stars/constellations.json',
            type: 'constellation-lines',
            format: 'constellation-lines-v1',
          },
        ],
      }),
      '/data/stars/constellations.json': failedResponse(503),
    });

    await expect(new AssetLoader().loadAssets()).rejects.toThrow(
      'Impossible de charger constellations (503).',
    );
  });

  it('conserve les objets nommés lorsque le catalogue dense est indisponible', async () => {
    installFetch({
      '/data/manifest.json': successfulResponse({
        version: '1.0.0',
        datasets: [
          { id: 'objects', url: '/data/objects.json', type: 'json' },
          {
            id: 'stars',
            url: '/data/stars.bin',
            type: 'binary',
            format: 'star-catalog-v2',
          },
        ],
      }),
      '/data/objects.json': successfulResponse(dataset([spaceObject('sun')])),
      '/data/stars.bin': failedResponse(503),
    });

    const assets = await new AssetLoader().loadAssets();

    expect(assets.objects.map((object) => object.id)).toEqual(['sun']);
    expect(assets.starCatalog).toBeNull();
    expect(assets.warnings[0]).toContain('Impossible de charger stars (503)');
  });

  it('charge uniquement l’index spatial au démarrage et laisse les tuiles différées', async () => {
    const fetchMock = installFetch({
      '/data/manifest.json': successfulResponse({
        version: '1.0.0',
        datasets: [
          { id: 'objects', url: '/data/objects.json', type: 'json' },
          {
            id: 'nearby-universe',
            url: '/data/tiles/index.json',
            type: 'space-tile-index',
            format: 'space-tiles-v1',
          },
        ],
      }),
      '/data/objects.json': successfulResponse(dataset([spaceObject('sun')])),
      '/data/tiles/index.json': successfulResponse(spaceTileIndex()),
    });

    const assets = await new AssetLoader().loadAssets();

    expect(assets.spaceTileIndex?.tiles[0]?.id).toBe('tile-a');
    expect(assets.spaceTileIndex?.searchEntries[0]?.id).toBe('galaxy-a');
    expect(fetchMock).toHaveBeenCalledTimes(3);
    expect(fetchMock).not.toHaveBeenCalledWith('/data/tiles/tile-a.json');
  });

  it('expose la source des cellules stellaires sans télécharger leur index au démarrage', async () => {
    const fetchMock = installFetch({
      '/data/manifest.json': successfulResponse({
        version: '1.0.0',
        datasets: [
          {
            id: 'hyg-star-tiles',
            url: '/data/stars/tiles/index.json',
            type: 'star-tile-index',
            format: 'star-tiles-v2',
            starCatalogId: 'hyg-v41-bright-stars',
          },
        ],
      }),
    });

    const assets = await new AssetLoader().loadAssets();

    expect(assets.starTileSource).toEqual({
      id: 'hyg-star-tiles',
      url: '/data/stars/tiles/index.json',
      starCatalogId: 'hyg-v41-bright-stars',
    });
    expect(fetchMock).toHaveBeenCalledOnce();
    expect(fetchMock).not.toHaveBeenCalledWith('/data/stars/tiles/index.json');
  });

  it('expose les épines Tempel sans télécharger leur binaire au démarrage', async () => {
    const fetchMock = installFetch({
      '/data/manifest.json': successfulResponse({
        version: '1.0.0',
        datasets: [
          {
            id: 'tempel-filament-spines',
            url: '/data/structures/tempel-filament-spines.bin',
            type: 'tempel-filament-spine-catalog',
            format: 'tempel-filament-spines-v1',
          },
        ],
      }),
    });

    const assets = await new AssetLoader().loadAssets();

    expect(assets.tempelFilamentSpineSource).toEqual({
      id: 'tempel-filament-spines',
      url: '/data/structures/tempel-filament-spines.bin',
    });
    expect(fetchMock).toHaveBeenCalledOnce();
    expect(fetchMock).not.toHaveBeenCalledWith('/data/structures/tempel-filament-spines.bin');
  });

  it('produit une erreur explicite lorsque l’index spatial est indisponible', async () => {
    installFetch({
      '/data/manifest.json': successfulResponse({
        version: '1.0.0',
        datasets: [
          {
            id: 'nearby-universe',
            url: '/data/tiles/index.json',
            type: 'space-tile-index',
            format: 'space-tiles-v1',
          },
        ],
      }),
      '/data/tiles/index.json': failedResponse(503),
    });

    await expect(new AssetLoader().loadAssets()).rejects.toThrow(
      'Impossible de charger nearby-universe (503).',
    );
  });

  it('rejette un identifiant présent à la fois dans la base et dans une tuile', async () => {
    installFetch({
      '/data/manifest.json': successfulResponse({
        version: '1.0.0',
        datasets: [
          { id: 'objects', url: '/data/objects.json', type: 'json' },
          {
            id: 'nearby-universe',
            url: '/data/tiles/index.json',
            type: 'space-tile-index',
            format: 'space-tiles-v1',
          },
        ],
      }),
      '/data/objects.json': successfulResponse(dataset([spaceObject('galaxy-a')])),
      '/data/tiles/index.json': successfulResponse(spaceTileIndex()),
    });

    await expect(new AssetLoader().loadAssets()).rejects.toThrow(
      'Identifiant tuilé déjà chargé au démarrage : galaxy-a.',
    );
  });

  it('normalise aussi une erreur binaire non standard sans interrompre le démarrage', async () => {
    installFetch({
      '/data/manifest.json': successfulResponse({
        version: '1.0.0',
        datasets: [
          { id: 'objects', url: '/data/objects.json', type: 'json' },
          {
            id: 'stars',
            url: '/data/stars.bin',
            type: 'binary',
            format: 'star-catalog-v2',
          },
        ],
      }),
      '/data/objects.json': successfulResponse(dataset([spaceObject('sun')])),
      '/data/stars.bin': {
        ok: true,
        status: 200,
        arrayBuffer: async () => Promise.reject('échec brut'),
      } as Response,
    });

    const assets = await new AssetLoader().loadAssets();

    expect(assets.starCatalog).toBeNull();
    expect(assets.warnings).toEqual(['Catalogue stellaire dense indisponible : erreur inconnue']);
  });

  it('produit une erreur explicite lorsque le manifest est indisponible', async () => {
    installFetch({
      '/broken.json': failedResponse(503),
    });

    await expect(new AssetLoader().loadAssets('/broken.json')).rejects.toThrow(
      'Impossible de charger le manifest (503).',
    );
  });

  it('produit une erreur explicite lorsqu’un jeu de données est indisponible', async () => {
    installFetch({
      '/data/manifest.json': successfulResponse({
        version: '1.0.0',
        datasets: [{ id: 'missing', url: '/data/missing.json', type: 'json' }],
      }),
      '/data/missing.json': failedResponse(404),
    });

    await expect(new AssetLoader().loadAssets()).rejects.toThrow(
      'Impossible de charger missing (404).',
    );
  });

  it('rejette les identifiants dupliqués entre plusieurs jeux', async () => {
    installFetch({
      '/data/manifest.json': successfulResponse({
        version: '1.0.0',
        datasets: [
          { id: 'first', url: '/data/first.json', type: 'json' },
          { id: 'second', url: '/data/second.json', type: 'json' },
        ],
      }),
      '/data/first.json': successfulResponse(dataset([spaceObject('sun')])),
      '/data/second.json': successfulResponse(dataset([spaceObject('sun')])),
    });

    await expect(new AssetLoader().loadAssets()).rejects.toThrow(
      'Identifiant astronomique dupliqué : sun.',
    );
  });

  it('rejette une référence vers un parent absent', async () => {
    installFetch({
      '/data/manifest.json': successfulResponse({
        version: '1.0.0',
        datasets: [{ id: 'objects', url: '/data/objects.json', type: 'json' }],
      }),
      '/data/objects.json': successfulResponse(
        dataset([{ ...spaceObject('earth'), parentId: 'missing-sun' }]),
      ),
    });

    await expect(new AssetLoader().loadAssets()).rejects.toThrow(
      'Parent missing-sun introuvable pour earth.',
    );
  });
});

function dataset(objects: readonly SpaceObject[]): unknown {
  return { version: '1.0.0', objects };
}

function spaceObject(id: string): SpaceObject {
  return {
    id,
    name: id,
    type: 'star',
    referenceFrame: 'solar-system',
    scientificConfidence: 'observed',
    visual: {
      visualRadius: 1,
      scaleMode: 'adaptive',
    },
    positionProvider: {
      type: 'static',
      position: [0, 0, 0],
      unit: 'astronomical-unit',
    },
  };
}

function spaceTileIndex(): unknown {
  return {
    version: '1.0.0',
    tiles: [
      {
        id: 'tile-a',
        level: 0,
        referenceFrame: 'nearby-universe',
        url: '/data/tiles/tile-a.json',
        bounds: {
          min: [-2, -2, -2],
          max: [2, 2, 2],
          unit: 'megaparsec',
        },
        objectIds: ['galaxy-a'],
      },
    ],
    searchEntries: [
      {
        id: 'galaxy-a',
        name: 'Galaxie A',
        aliases: [],
        type: 'galaxy',
        parentName: 'Univers proche',
      },
    ],
  };
}

function constellationCatalog(segments: readonly (readonly [number, number])[]): unknown {
  return {
    version: '1.0.0',
    source: {
      name: 'Stellarium Modern sky culture',
      url: 'https://github.com/Stellarium/stellarium/tree/master/skycultures/modern',
      license: 'CC BY-SA 4.0',
    },
    referenceFrame: 'equatorial-j2000',
    scientificConfidence: 'illustrative',
    starCatalog: 'HYG v4.1',
    figures: [
      {
        id: 'orion',
        name: 'Orion',
        abbreviation: 'Ori',
        segments,
      },
    ],
  };
}

function installFetch(responses: Record<string, Response>): ReturnType<typeof vi.fn> {
  const fetchMock = vi.fn(async (input: RequestInfo | URL): Promise<Response> => {
    const key =
      typeof input === 'string' ? input : input instanceof URL ? input.toString() : input.url;

    return responses[key] ?? failedResponse(404);
  });

  vi.stubGlobal('fetch', fetchMock);

  return fetchMock;
}

function successfulResponse(body: unknown): Response {
  return {
    ok: true,
    status: 200,
    json: async () => body,
  } as Response;
}

function successfulBinaryResponse(buffer: ArrayBuffer): Response {
  return {
    ok: true,
    status: 200,
    arrayBuffer: async () => buffer,
  } as Response;
}

function failedResponse(status: number): Response {
  return {
    ok: false,
    status,
    json: async () => null,
    arrayBuffer: async () => new ArrayBuffer(0),
  } as Response;
}

function starCatalogBuffer(catalogIds: readonly number[] = [3_229]): ArrayBuffer {
  const encoder = new TextEncoder();
  const name = encoder.encode('Étoile');
  const aliases = encoder.encode('HIP 1');
  const spectralType = encoder.encode('A0m');
  const stringTableOffset =
    STAR_CATALOG_HEADER_BYTES + catalogIds.length * STAR_CATALOG_RECORD_BYTES;
  const stringTableBytes = 1 + name.length + 1 + aliases.length + 1 + spectralType.length + 1;
  const buffer = new ArrayBuffer(stringTableOffset + stringTableBytes);
  const view = new DataView(buffer);
  const strings = new Uint8Array(buffer, stringTableOffset);
  const nameOffset = 1;
  const aliasesOffset = nameOffset + name.length + 1;
  const spectralTypeOffset = aliasesOffset + aliases.length + 1;

  for (let index = 0; index < STAR_CATALOG_MAGIC.length; index += 1) {
    view.setUint8(index, STAR_CATALOG_MAGIC.charCodeAt(index));
  }
  view.setUint16(4, STAR_CATALOG_VERSION, true);
  view.setUint16(6, STAR_CATALOG_HEADER_BYTES, true);
  view.setUint16(8, STAR_CATALOG_RECORD_BYTES, true);
  view.setUint32(12, catalogIds.length, true);
  view.setFloat64(16, 2_451_545, true);
  view.setUint32(24, 1, true);
  view.setUint32(28, stringTableOffset, true);
  view.setUint32(32, stringTableBytes, true);
  for (let index = 0; index < catalogIds.length; index += 1) {
    const offset = STAR_CATALOG_HEADER_BYTES + index * STAR_CATALOG_RECORD_BYTES;

    view.setFloat32(offset, -1.612 - index, true);
    view.setFloat32(offset + 4, 2.628, true);
    view.setFloat32(offset + 8, -2.551, true);
    view.setFloat32(offset + 12, -1.44 + index, true);
    view.setFloat32(offset + 16, 0.009, true);
    view.setUint32(offset + 20, catalogIds[index]!, true);
    view.setUint32(offset + 24, nameOffset, true);
    view.setUint32(offset + 28, aliasesOffset, true);
    view.setUint32(offset + 32, spectralTypeOffset, true);
  }
  strings.set(name, nameOffset);
  strings.set(aliases, aliasesOffset);
  strings.set(spectralType, spectralTypeOffset);

  return buffer;
}

function exoplanetMetadata() {
  return {
    version: '1.0.0',
    format: 'exoplanet-catalog-v1',
    source: {
      name: 'NASA Exoplanet Archive',
      url: 'https://exoplanetarchive.ipac.caltech.edu/',
      tapUrl: 'https://exoplanetarchive.ipac.caltech.edu/TAP/sync',
      table: 'PSCompPars',
      query: 'select ... from pscomppars',
      snapshotDate: '2026-08-05',
      sha256: 'a'.repeat(64),
    },
    counts: {
      hosts: 1,
      planets: 1,
      positionedHosts: 1,
      positionedPlanets: 1,
    },
    missingDistanceFallbackParsec: 1_000,
  };
}

function exoplanetCatalogBuffer(): ArrayBuffer {
  const encoder = new TextEncoder();
  const values = ['Test Host', 'HD 1', 'G2 V', 'Test Host b', 'b', 'Transit', 'Kepler', 'Mass'];
  const bytes = [0];
  const offsets = new Map<string, number>();

  for (const value of values) {
    offsets.set(value, bytes.length);
    bytes.push(...encoder.encode(value), 0);
  }
  const planetOffset = EXOPLANET_CATALOG_HEADER_BYTES + EXOPLANET_CATALOG_HOST_RECORD_BYTES;
  const stringOffset = planetOffset + EXOPLANET_CATALOG_PLANET_RECORD_BYTES;
  const buffer = new ArrayBuffer(stringOffset + bytes.length);
  const view = new DataView(buffer);

  for (let index = 0; index < EXOPLANET_CATALOG_MAGIC.length; index += 1) {
    view.setUint8(index, EXOPLANET_CATALOG_MAGIC.charCodeAt(index));
  }
  view.setUint16(4, EXOPLANET_CATALOG_VERSION, true);
  view.setUint16(6, EXOPLANET_CATALOG_HEADER_BYTES, true);
  view.setUint16(8, EXOPLANET_CATALOG_HOST_RECORD_BYTES, true);
  view.setUint16(10, EXOPLANET_CATALOG_PLANET_RECORD_BYTES, true);
  view.setUint32(12, 1, true);
  view.setUint32(16, 1, true);
  view.setUint32(20, planetOffset, true);
  view.setUint32(24, stringOffset, true);
  view.setUint32(28, bytes.length, true);
  view.setUint32(EXOPLANET_CATALOG_HEADER_BYTES, offsets.get('Test Host')!, true);
  view.setUint32(EXOPLANET_CATALOG_HEADER_BYTES + 4, offsets.get('HD 1')!, true);
  view.setUint32(EXOPLANET_CATALOG_HEADER_BYTES + 8, offsets.get('G2 V')!, true);
  view.setUint32(EXOPLANET_CATALOG_HEADER_BYTES + 12, 0, true);
  view.setUint16(EXOPLANET_CATALOG_HEADER_BYTES + 16, 1, true);
  view.setUint8(EXOPLANET_CATALOG_HEADER_BYTES + 18, 1);
  view.setFloat64(EXOPLANET_CATALOG_HEADER_BYTES + 20, 120, true);
  view.setFloat64(EXOPLANET_CATALOG_HEADER_BYTES + 28, 30, true);
  view.setFloat64(EXOPLANET_CATALOG_HEADER_BYTES + 36, 50, true);
  view.setFloat32(EXOPLANET_CATALOG_HEADER_BYTES + 44, 5_500, true);
  view.setFloat32(EXOPLANET_CATALOG_HEADER_BYTES + 48, 1, true);
  view.setFloat32(EXOPLANET_CATALOG_HEADER_BYTES + 52, 1, true);
  view.setFloat32(EXOPLANET_CATALOG_HEADER_BYTES + 56, 10, true);
  view.setUint32(planetOffset, offsets.get('Test Host b')!, true);
  view.setUint32(planetOffset + 4, offsets.get('b')!, true);
  view.setUint32(planetOffset + 8, offsets.get('Transit')!, true);
  view.setUint32(planetOffset + 12, offsets.get('Kepler')!, true);
  view.setUint32(planetOffset + 16, offsets.get('Mass')!, true);
  view.setUint32(planetOffset + 20, 0, true);
  view.setFloat64(planetOffset + 24, 10, true);
  view.setFloat64(planetOffset + 32, 0.1, true);
  view.setFloat32(planetOffset + 40, 1.2, true);
  view.setFloat32(planetOffset + 44, 2.3, true);
  view.setFloat32(planetOffset + 48, 280, true);
  view.setFloat32(planetOffset + 52, 0.02, true);
  view.setFloat32(planetOffset + 56, 89, true);
  view.setFloat32(planetOffset + 60, 1.1, true);
  view.setUint16(planetOffset + 64, 2020, true);
  new Uint8Array(buffer, stringOffset).set(bytes);

  return buffer;
}

function cosmicGroupCatalogBuffer(): ArrayBuffer {
  const buffer = new ArrayBuffer(
    COSMIC_GROUP_CATALOG_HEADER_BYTES + COSMIC_GROUP_CATALOG_RECORD_BYTES,
  );
  const view = new DataView(buffer);

  for (let index = 0; index < COSMIC_GROUP_CATALOG_MAGIC.length; index += 1) {
    view.setUint8(index, COSMIC_GROUP_CATALOG_MAGIC.charCodeAt(index));
  }
  view.setUint16(4, COSMIC_GROUP_CATALOG_VERSION, true);
  view.setUint16(6, COSMIC_GROUP_CATALOG_HEADER_BYTES, true);
  view.setUint16(8, COSMIC_GROUP_CATALOG_RECORD_BYTES, true);
  view.setUint32(12, 1, true);
  view.setFloat64(16, 2_451_545, true);
  view.setUint32(24, 1, true);
  view.setFloat32(28, 12.1, true);
  view.setFloat32(32, 12.1, true);
  view.setFloat32(COSMIC_GROUP_CATALOG_HEADER_BYTES, 12.1, true);
  view.setFloat32(COSMIC_GROUP_CATALOG_HEADER_BYTES + 12, 12.1, true);
  view.setFloat32(COSMIC_GROUP_CATALOG_HEADER_BYTES + 16, 0.1, true);
  view.setInt32(COSMIC_GROUP_CATALOG_HEADER_BYTES + 20, 810, true);
  view.setUint32(COSMIC_GROUP_CATALOG_HEADER_BYTES + 24, 42, true);
  view.setFloat32(COSMIC_GROUP_CATALOG_HEADER_BYTES + 28, 30.413, true);

  return buffer;
}

function cosmicWebVolumeBuffer(): ArrayBuffer {
  const resolution = 4;
  const voxelCount = resolution ** 3;
  const buffer = new ArrayBuffer(COSMIC_WEB_VOLUME_HEADER_BYTES + voxelCount);
  const view = new DataView(buffer);

  for (let index = 0; index < COSMIC_WEB_VOLUME_MAGIC.length; index += 1) {
    view.setUint8(index, COSMIC_WEB_VOLUME_MAGIC.charCodeAt(index));
  }
  view.setUint16(4, COSMIC_WEB_VOLUME_VERSION, true);
  view.setUint16(6, COSMIC_WEB_VOLUME_HEADER_BYTES, true);
  view.setUint16(8, resolution, true);
  view.setUint16(10, 1, true);
  view.setUint32(12, voxelCount, true);
  view.setFloat32(16, 800, true);
  view.setUint32(20, 1, true);
  view.setFloat64(24, 2_451_545, true);
  view.setUint32(32, 3, true);
  view.setUint32(36, 2, true);

  return buffer;
}

function cosmicStructureMetadata() {
  return {
    version: '1.0.0',
    recordCount: 1,
    referenceEpochJulianDay: 2_451_545,
    referenceFrame: 'equatorial-j2000',
    distanceUnit: 'megaparsec',
    scientificConfidence: 'calculated',
    sources: [
      {
        id: 'sdss-main50',
        name: 'SDSS superclusters',
        citation: 'Liivamägi et al. (2012)',
        sourceUrl: 'https://example.test/superclusters',
        structureType: 'supercluster',
        method: 'Luminosity density field',
        objectNamePrefix: 'Superamas SDSS',
        scientificConfidence: 'calculated',
        recordCount: 1,
      },
    ],
  };
}

function cosmicStructureCatalogBuffer(): ArrayBuffer {
  const identifier = new TextEncoder().encode('239+027+0091');
  const buffer = new ArrayBuffer(
    COSMIC_STRUCTURE_CATALOG_HEADER_BYTES +
      COSMIC_STRUCTURE_CATALOG_RECORD_BYTES +
      identifier.length,
  );
  const view = new DataView(buffer);
  const distanceMpc = Math.hypot(-176.1, 163.7, -287.8);

  for (let index = 0; index < COSMIC_STRUCTURE_CATALOG_MAGIC.length; index += 1) {
    view.setUint8(index, COSMIC_STRUCTURE_CATALOG_MAGIC.charCodeAt(index));
  }
  view.setUint16(4, COSMIC_STRUCTURE_CATALOG_VERSION, true);
  view.setUint16(6, COSMIC_STRUCTURE_CATALOG_HEADER_BYTES, true);
  view.setUint16(8, COSMIC_STRUCTURE_CATALOG_RECORD_BYTES, true);
  view.setUint16(10, 0, true);
  view.setUint32(12, 1, true);
  view.setUint16(16, 1, true);
  view.setUint16(18, 1, true);
  view.setFloat64(20, 2_451_545, true);
  view.setFloat32(28, distanceMpc, true);
  view.setFloat32(32, distanceMpc, true);
  view.setUint32(36, identifier.length, true);
  view.setUint32(40, 0xff, true);
  view.setUint32(44, 0, true);
  view.setFloat32(COSMIC_STRUCTURE_CATALOG_HEADER_BYTES, -176.1, true);
  view.setFloat32(COSMIC_STRUCTURE_CATALOG_HEADER_BYTES + 4, 163.7, true);
  view.setFloat32(COSMIC_STRUCTURE_CATALOG_HEADER_BYTES + 8, -287.8, true);
  view.setFloat32(COSMIC_STRUCTURE_CATALOG_HEADER_BYTES + 12, distanceMpc, true);
  view.setFloat32(COSMIC_STRUCTURE_CATALOG_HEADER_BYTES + 16, 35.9, true);
  view.setFloat32(COSMIC_STRUCTURE_CATALOG_HEADER_BYTES + 20, 0.98, true);
  view.setFloat32(COSMIC_STRUCTURE_CATALOG_HEADER_BYTES + 24, Number.NaN, true);
  view.setFloat32(COSMIC_STRUCTURE_CATALOG_HEADER_BYTES + 28, Number.NaN, true);
  view.setUint32(COSMIC_STRUCTURE_CATALOG_HEADER_BYTES + 32, 1_038, true);
  view.setUint32(COSMIC_STRUCTURE_CATALOG_HEADER_BYTES + 36, 0, true);
  view.setUint16(COSMIC_STRUCTURE_CATALOG_HEADER_BYTES + 40, identifier.length, true);
  view.setUint16(COSMIC_STRUCTURE_CATALOG_HEADER_BYTES + 42, 0, true);
  view.setUint8(COSMIC_STRUCTURE_CATALOG_HEADER_BYTES + 44, 1);
  view.setUint8(COSMIC_STRUCTURE_CATALOG_HEADER_BYTES + 45, 0);
  view.setUint16(COSMIC_STRUCTURE_CATALOG_HEADER_BYTES + 46, 1, true);
  new Uint8Array(
    buffer,
    COSMIC_STRUCTURE_CATALOG_HEADER_BYTES + COSMIC_STRUCTURE_CATALOG_RECORD_BYTES,
  ).set(identifier);

  return buffer;
}
