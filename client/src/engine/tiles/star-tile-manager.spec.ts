import * as THREE from 'three';
import { type StarTileIndexNode, type StarTileSource } from '../../data/models/universe.models';
import { CoordinateSystem } from '../coordinates/coordinate-system';
import { type StarCatalog } from '../loaders/star-catalog';
import { StarCatalogRegistry } from '../objects/star-catalog-registry';
import { StarTileManager } from './star-tile-manager';
import { type StarTileView } from './star-tile-selection';

describe('StarTileManager', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('conserve le même aperçu agrégé de la Voie lactée au Groupe local', async () => {
    const fetcher = installFetcher();
    const manager = new StarTileManager(source(), registry(), fetcher);

    const localGroup = await manager.synchronize(view(4, 1));

    expect(localGroup.changed).toBe(true);
    expect(localGroup.tiles.map((tile) => tile.id)).toEqual(['root-a', 'root-b']);
    expect(fetcher).toHaveBeenCalledTimes(2);

    const milkyWay = await manager.synchronize(view(3, 1));

    expect(milkyWay.changed).toBe(false);
    expect(milkyWay.tiles.map((tile) => tile.id)).toEqual(['root-a', 'root-b']);
    expect(fetcher).toHaveBeenCalledTimes(2);
    expect(manager.activeTileCount).toBe(2);
    expect(manager.activeClusterCount).toBe(3);
    expect(manager.cachedPackCount).toBe(1);
    expect(manager.cachedTileCount).toBe(2);
    expect(manager.cachedClusterCount).toBe(3);
  });

  it('borne à quatre les téléchargements et décodages de paquets concurrents', async () => {
    const release = deferred<void>();
    let activePackLoads = 0;
    let maximumPackLoads = 0;
    const fetcher = vi.fn(async (url: string) => {
      if (url.endsWith('index.json')) {
        return successfulResponse(parallelIndex());
      }
      activePackLoads += 1;
      maximumPackLoads = Math.max(maximumPackLoads, activePackLoads);
      await release.promise;
      activePackLoads -= 1;
      const id = url.slice(url.lastIndexOf('/') + 1, -'.json'.length);

      return successfulResponse(pack([rawTile(id, undefined, 4, 1, 1, 512)]));
    });
    const manager = new StarTileManager(source(), registry(), fetcher);
    const synchronization = manager.synchronize(view(2, 1));

    await vi.waitFor(() => expect(activePackLoads).toBe(4));
    expect(fetcher).toHaveBeenCalledTimes(5);
    release.resolve();
    await expect(synchronization).resolves.toMatchObject({ changed: true });
    expect(maximumPackLoads).toBe(4);
    expect(activePackLoads).toBe(0);
    expect(fetcher).toHaveBeenCalledTimes(7);
    expect(manager.activeTileCount).toBe(6);
  });

  it('raffine les racines visibles, conserve le rendu précédent pendant le chargement et réutilise le cache', async () => {
    const childRequest = deferred<Response>();
    const fetcher = installFetcher({ childResponse: childRequest.promise });
    const manager = new StarTileManager(source(), registry(), fetcher);

    const overview = await manager.synchronize(view(2, 1));
    const pending = manager.synchronize(view(2));

    expect(manager.activeTileCount).toBe(2);
    expect(overview.tiles.map((tile) => tile.id)).toEqual(['root-a', 'root-b']);
    childRequest.resolve(successfulResponse(childPack()));

    const detailed = await pending;

    expect(detailed.tiles.map((tile) => tile.id)).toEqual(['a-0', 'a-1', 'b-0']);
    expect(manager.activeTileCount).toBe(3);
    expect(manager.activeClusterCount).toBe(4);
    expect(manager.cachedPackCount).toBe(3);

    await expect(manager.synchronize(view(2, 1))).resolves.toMatchObject({ changed: true });
    await expect(manager.synchronize(view(2, 1))).resolves.toMatchObject({ changed: false });
    expect(fetcher).toHaveBeenCalledTimes(4);
  });

  it('partage les requêtes concurrentes et conserve l’état actif si un paquet échoue', async () => {
    const childRequest = deferred<Response>();
    const fetcher = installFetcher({ childResponse: childRequest.promise });
    const manager = new StarTileManager(source(), registry(), fetcher);

    await manager.synchronize(view(2, 1));
    const first = manager.synchronize(view(2));
    const second = manager.synchronize(view(2));

    childRequest.reject(new Error('offline'));
    await expect(first).rejects.toThrow('offline');
    await expect(second).rejects.toThrow('offline');
    expect(manager.activeTileCount).toBe(2);
    expect(fetcher).toHaveBeenCalledTimes(4);
  });

  it('évince les paquets inactifs les moins récents sans retirer les tuiles actives', async () => {
    const manager = new StarTileManager(source(), registry(), installFetcher(), 1);

    await manager.synchronize(view(2, 1));
    await manager.synchronize(view(2));

    expect(manager.activeTileCount).toBe(3);
    expect(manager.cachedPackCount).toBe(2);
    expect(manager.cachedTileCount).toBe(3);
    expect(manager.cachedClusterCount).toBe(4);
  });

  it('conserve les racines au Groupe local puis les vide dans l’Univers proche', async () => {
    const manager = new StarTileManager(source(), registry(), installFetcher());

    await manager.synchronize(view(3, 1));
    await expect(manager.synchronize(view(4, 1))).resolves.toMatchObject({ changed: false });
    expect(manager.activeTileCount).toBe(2);
    await expect(manager.synchronize(view(5))).resolves.toEqual({ changed: true, tiles: [] });
    await expect(manager.synchronize(view(5))).resolves.toEqual({ changed: false, tiles: [] });
    expect(manager.activeTileCount).toBe(0);
  });

  it('signale séparément un index, un paquet et une tuile sélectionnée indisponibles', async () => {
    const indexFailure = new StarTileManager(
      source(),
      registry(),
      vi.fn(async () => failedResponse(503)),
    );

    await expect(indexFailure.synchronize(view(2, 1))).rejects.toThrow(
      'Impossible de charger l’index stellaire gaia-star-tiles (503)',
    );

    const packFailure = new StarTileManager(
      source(),
      registry(),
      vi.fn(async (url: string) =>
        url.endsWith('index.json') ? successfulResponse(index()) : failedResponse(404),
      ),
    );

    await expect(packFailure.synchronize(view(2, 1))).rejects.toThrow(
      'Impossible de charger le paquet de tuiles stellaires (404)',
    );

    const missingTile = new StarTileManager(
      source(),
      registry(),
      vi.fn(async (url: string) =>
        url.endsWith('index.json')
          ? successfulResponse(index())
          : successfulResponse({ ...rootPack(), tiles: [rootTile('root-a')] }),
      ),
    );

    await expect(missingTile.synchronize(view(2, 1))).rejects.toThrow(
      'Tuile stellaire sélectionnée absente : root-b',
    );
  });

  it('utilise fetch par défaut et refuse les associations de catalogue invalides', async () => {
    const fetcher = installFetcher();

    vi.stubGlobal('fetch', fetcher);
    await expect(
      new StarTileManager(source(), registry()).synchronize(view(2, 1)),
    ).resolves.toMatchObject({ changed: true });

    const wrongIndex = new StarTileManager(
      source(),
      registry(),
      vi.fn(async () => successfulResponse({ ...index(), sourceCatalog: 'other' })),
    );

    await expect(wrongIndex.synchronize(view(2, 1))).rejects.toThrow(
      'Index stellaire associé au mauvais catalogue : other.',
    );

    const unknownTile = new StarTileManager(
      source(),
      registry(),
      vi.fn(async (url: string) =>
        url.endsWith('index.json')
          ? successfulResponse(index())
          : successfulResponse({
              ...rootPack(),
              tiles: [{ ...rootTile('root-a'), id: 'unknown' }],
            }),
      ),
    );

    await expect(unknownTile.synchronize(view(2, 1))).rejects.toThrow(
      'Tuile stellaire absente de l’index : unknown',
    );

    const wrongPack = new StarTileManager(
      source(),
      registry(),
      vi.fn(async (url: string) =>
        url.endsWith('index.json')
          ? successfulResponse(index())
          : successfulResponse({ ...rootPack(), tiles: [childTile('a-0', 'root-a', 2, 2)] }),
      ),
    );

    await expect(wrongPack.synchronize(view(2, 1))).rejects.toThrow(
      'Tuile stellaire chargée depuis le mauvais paquet : a-0',
    );
  });

  it('signale un nœud sélectionné absent et tolère un paquet actif non encore mis en cache', async () => {
    const manager = new StarTileManager(source(), registry(), installFetcher());
    const access = manager as unknown as {
      activeNodeIds: readonly string[];
      loadIndex(): Promise<{ nodesById: Map<string, StarTileIndexNode> }>;
      touchActivePacks(nodes: ReadonlyMap<string, StarTileIndexNode>): void;
    };
    const loadedIndex = await access.loadIndex();
    const missingNode = loadedIndex.nodesById.get('root-b')!;

    loadedIndex.nodesById.delete('root-b');
    await expect(manager.synchronize(view(2, 1))).rejects.toThrow(
      'Nœud stellaire sélectionné absent de l’index : root-b',
    );

    access.activeNodeIds = ['root-b'];
    access.touchActivePacks(new Map([['root-b', missingNode]]));
    expect(manager.cachedPackCount).toBe(0);
  });
});

function source(): StarTileSource {
  return {
    id: 'gaia-star-tiles',
    url: '/data/stars/gaia-dr3-tiles/index.json',
    sourceCatalogId: 'gaia-dr3-bright-high-confidence',
  };
}

function registry(): StarCatalogRegistry {
  return new StarCatalogRegistry(catalog(), new CoordinateSystem());
}

function catalog(): StarCatalog {
  return {
    count: 4,
    referenceEpochJulianDay: 2_451_545,
    positionsParsec: new Float32Array(12),
    velocitiesParsecPerYear: new Float32Array(12),
    apparentMagnitudes: new Float32Array(4),
    colorIndicesBv: new Float32Array(4),
    catalogIds: new Uint32Array([1, 2, 3, 4]),
    names: ['A', 'B', 'C', 'D'],
    aliases: [[], [], [], []],
    spectralTypes: [null, null, null, null],
  };
}

function installFetcher(
  options: { childResponse?: Promise<Response> } = {},
): ReturnType<typeof vi.fn<(url: string) => Promise<Response>>> {
  return vi.fn(async (url: string) => {
    if (url.endsWith('index.json')) {
      return successfulResponse(index());
    }
    if (url.includes('/lod4/')) {
      return successfulResponse(rootPack());
    }
    if (options.childResponse && url.endsWith('root-a.json')) {
      return options.childResponse;
    }

    return successfulResponse(url.endsWith('root-a.json') ? childPack() : childPackB());
  });
}

function index(): object {
  return {
    version: '4.0.0',
    sourceCatalog: 'gaia-dr3-bright-high-confidence',
    sourceStarCount: 4,
    referenceEpochJulianDay: 2_457_388.5,
    referenceFrame: 'icrs',
    distanceUnit: 'parsec',
    magnitudeBand: 'gaia-g',
    colorIndexSystem: 'gaia-bp-rp',
    source: {
      name: 'Gaia Data Release 3 · gaia_source_lite',
      url: 'https://gea.esac.esa.int/archive/',
      doi: '10.5270/esa-qa4lep3',
      credit: 'ESA/Gaia/DPAC',
      retrievedAt: '2026-08-28T00:00:00.000Z',
      query: 'SELECT source_id FROM gaiadr3.gaia_source_lite',
    },
    selection: {
      maximumDistanceParsec: 5_000,
      maximumApparentMagnitude: 12,
      minimumParallaxOverError: 10,
    },
    sampling: {
      method: 'brightest-plus-deterministic-uniform',
      maximumSamplesPerLeaf: 96,
      brightestSamplesPerLeaf: 32,
    },
    scientificConfidence: 'calculated',
    representation: 'hierarchical-aggregation-with-deterministic-samples',
    rootIds: ['root-a', 'root-b'],
    nodes: [
      node(
        'root-a',
        4,
        undefined,
        ['a-0', 'a-1'],
        [-20, -20, -20],
        [20, 20, 20],
        3,
        2,
        160,
        '/lod4/root-pack.json',
      ),
      node(
        'root-b',
        4,
        undefined,
        ['b-0'],
        [20, -20, -20],
        [60, 20, 20],
        1,
        1,
        160,
        '/lod4/root-pack.json',
      ),
      node('a-0', 3, 'root-a', [], [-20, -20, -20], [0, 20, 20], 2, 2, 40, '/lod3/root-a.json'),
      node('a-1', 3, 'root-a', [], [0, -20, -20], [20, 20, 20], 1, 1, 40, '/lod3/root-a.json'),
      node('b-0', 3, 'root-b', [], [20, -20, -20], [60, 20, 20], 1, 1, 40, '/lod3/root-b.json'),
    ],
  };
}

function parallelIndex(): object {
  const roots = Array.from({ length: 6 }, (_, index) => `root-${index}`);

  return {
    ...index(),
    sourceStarCount: roots.length,
    rootIds: roots,
    nodes: roots.map((id, index) =>
      node(
        id,
        4,
        undefined,
        [],
        [index * 10, -5, -5],
        [index * 10 + 10, 5, 5],
        1,
        1,
        512,
        `/lod4/${id}.json`,
      ),
    ),
  };
}

function node(
  id: string,
  lodLevel: number,
  parentId: string | undefined,
  childIds: string[],
  min: number[],
  max: number[],
  sourceStarCount: number,
  clusterCount: number,
  cellSizeParsec: number,
  url: string,
): object {
  return {
    id,
    ...(parentId ? { parentId } : {}),
    childIds,
    lodLevel,
    boundsParsec: { min, max },
    sourceStarCount,
    clusterCount,
    cellSizeParsec,
    representation: lodLevel === 4 ? 'aggregate-cell' : 'sampled-source',
    url,
  };
}

function rootPack(): object {
  return pack([rootTile('root-a'), rootTile('root-b')]);
}

function childPack(): object {
  return pack([childTile('a-0', 'root-a', 2, 2), childTile('a-1', 'root-a', 1, 1)]);
}

function childPackB(): object {
  return pack([childTile('b-0', 'root-b', 1, 1)]);
}

function pack(tiles: object[]): object {
  return {
    version: '4.0.0',
    sourceCatalog: 'gaia-dr3-bright-high-confidence',
    referenceEpochJulianDay: 2_457_388.5,
    magnitudeBand: 'gaia-g',
    colorIndexSystem: 'gaia-bp-rp',
    tiles,
  };
}

function rootTile(id: 'root-a' | 'root-b'): object {
  const first = id === 'root-a';

  return rawTile(id, undefined, 4, first ? 3 : 1, first ? 2 : 1, 160);
}

function childTile(id: string, parentId: string, stars: number, clusters: number): object {
  return rawTile(id, parentId, 3, stars, clusters, 40);
}

function rawTile(
  id: string,
  parentId: string | undefined,
  lodLevel: number,
  stars: number,
  clusters: number,
  cellSizeParsec: number,
): object {
  const starCounts = Array.from({ length: clusters }, (_, index) =>
    index === 0 ? stars - clusters + 1 : 1,
  );

  return {
    id,
    ...(parentId ? { parentId } : {}),
    version: '4.0.0',
    sourceCatalog: 'gaia-dr3-bright-high-confidence',
    sourceStarCount: stars,
    referenceEpochJulianDay: 2_457_388.5,
    magnitudeBand: 'gaia-g',
    colorIndexSystem: 'gaia-bp-rp',
    lodLevel,
    cellSizeParsec,
    representation: lodLevel === 4 ? 'aggregate-cell' : 'sampled-source',
    cellCoordinates: Array.from({ length: clusters * 3 }, (_, index) => index),
    positionsParsec: Array.from({ length: clusters * 3 }, (_, index) => index + 1),
    starCounts,
    apparentMagnitudes: Array.from({ length: clusters }, (_, index) => index),
    colorIndices: Array.from({ length: clusters }, (_, index) => index / 2),
  };
}

function view(
  lodLevel: number,
  viewportHeight = 100_000,
  projectionScaleY = viewportHeight === 1 ? 0.000_001 : 1,
): StarTileView {
  return {
    lodLevel,
    quality: 'high',
    viewportHeight,
    projectionScaleY,
    cameraPosition: new THREE.Vector3(0, 0, 100),
    worldOffset: new THREE.Vector3(),
    frustum: cubeFrustum(1_000_000),
  };
}

function cubeFrustum(size: number): THREE.Frustum {
  return new THREE.Frustum(
    new THREE.Plane(new THREE.Vector3(1, 0, 0), size),
    new THREE.Plane(new THREE.Vector3(-1, 0, 0), size),
    new THREE.Plane(new THREE.Vector3(0, 1, 0), size),
    new THREE.Plane(new THREE.Vector3(0, -1, 0), size),
    new THREE.Plane(new THREE.Vector3(0, 0, 1), size),
    new THREE.Plane(new THREE.Vector3(0, 0, -1), size),
  );
}

function successfulResponse(body: unknown): Response {
  return { ok: true, status: 200, json: async () => body } as Response;
}

function failedResponse(status: number): Response {
  return { ok: false, status, json: async () => null } as Response;
}

function deferred<T>(): {
  promise: Promise<T>;
  resolve: (value: T) => void;
  reject: (error: Error) => void;
} {
  let resolve!: (value: T) => void;
  let reject!: (error: Error) => void;
  const promise = new Promise<T>((resolvePromise, rejectPromise) => {
    resolve = resolvePromise;
    reject = rejectPromise;
  });

  return { promise, resolve, reject };
}
