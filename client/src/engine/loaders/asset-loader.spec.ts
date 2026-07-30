import { SpaceObject } from '../../data/models/universe.models';
import { AssetLoader } from './asset-loader';
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

function starCatalogBuffer(): ArrayBuffer {
  const encoder = new TextEncoder();
  const name = encoder.encode('Sirius');
  const aliases = encoder.encode('HIP 32349\u001fα CMa');
  const spectralType = encoder.encode('A0m');
  const stringTableOffset = STAR_CATALOG_HEADER_BYTES + STAR_CATALOG_RECORD_BYTES;
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
  view.setUint32(12, 1, true);
  view.setFloat64(16, 2_451_545, true);
  view.setUint32(24, 1, true);
  view.setUint32(28, stringTableOffset, true);
  view.setUint32(32, stringTableBytes, true);
  view.setFloat32(STAR_CATALOG_HEADER_BYTES, -1.612, true);
  view.setFloat32(STAR_CATALOG_HEADER_BYTES + 4, 2.628, true);
  view.setFloat32(STAR_CATALOG_HEADER_BYTES + 8, -2.551, true);
  view.setFloat32(STAR_CATALOG_HEADER_BYTES + 12, -1.44, true);
  view.setFloat32(STAR_CATALOG_HEADER_BYTES + 16, 0.009, true);
  view.setUint32(STAR_CATALOG_HEADER_BYTES + 20, 3_229, true);
  view.setUint32(STAR_CATALOG_HEADER_BYTES + 24, nameOffset, true);
  view.setUint32(STAR_CATALOG_HEADER_BYTES + 28, aliasesOffset, true);
  view.setUint32(STAR_CATALOG_HEADER_BYTES + 32, spectralTypeOffset, true);
  strings.set(name, nameOffset);
  strings.set(aliases, aliasesOffset);
  strings.set(spectralType, spectralTypeOffset);

  return buffer;
}
