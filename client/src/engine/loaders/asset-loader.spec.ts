import { SpaceObject } from '../../data/models/universe.models';
import { AssetLoader } from './asset-loader';
import {
  COSMIC_GROUP_CATALOG_HEADER_BYTES,
  COSMIC_GROUP_CATALOG_MAGIC,
  COSMIC_GROUP_CATALOG_RECORD_BYTES,
  COSMIC_GROUP_CATALOG_VERSION,
} from './cosmic-group-catalog';
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

  it('charge le catalogue compact de groupes Cosmicflows-4', async () => {
    const fetchMock = installFetch({
      '/data/manifest.json': successfulResponse({
        version: '1.0.0',
        datasets: [
          {
            id: 'cosmicflows4-groups',
            url: '/data/cosmic-groups.bin',
            type: 'cosmic-group-catalog',
            format: 'cosmicflows4-group-catalog-v1',
          },
        ],
      }),
      '/data/cosmic-groups.bin': successfulBinaryResponse(cosmicGroupCatalogBuffer()),
    });

    const assets = await new AssetLoader().loadAssets();

    expect(assets.cosmicGroupCatalog?.count).toBe(1);
    expect(assets.cosmicGroupCatalog?.pgcIds[0]).toBe(42);
    expect(assets.warnings).toEqual([]);
    expect(fetchMock).toHaveBeenCalledWith('/data/cosmic-groups.bin');
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
            format: 'cosmicflows4-group-catalog-v1',
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
            format: 'cosmicflows4-group-catalog-v1',
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
