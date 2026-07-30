import { SearchEntry, SpaceObject, SpaceTileIndex } from '../../data/models/universe.models';
import { SpaceTileManager } from './space-tile-manager';
import { type SpaceTileView } from './space-tile-selection';
import * as THREE from 'three';

describe('SpaceTileManager', () => {
  it('expose l’index de recherche avant de charger la géométrie', () => {
    const manager = new SpaceTileManager(index(), vi.fn());

    expect(manager.hasObject('galaxy-a')).toBe(true);
    expect(manager.hasObject('unknown')).toBe(false);
    expect(manager.searchEntries.map((entry) => entry.id)).toEqual(['galaxy-a', 'galaxy-b']);
    expect(manager.loadedObjects).toEqual([]);
    expect(manager.loadedTileCount).toBe(0);
  });

  it('charge uniquement les tuiles demandées par la caméra puis réutilise leur cache', async () => {
    const fetcher = installTileFetcher();
    const manager = new SpaceTileManager(index(), fetcher);

    await expect(manager.synchronize(view({ frustum: cubeFrustum(5_000) }))).resolves.toBe(true);

    expect(manager.loadedObjects.map((object) => object.id)).toEqual(['galaxy-a']);
    expect(manager.loadedTileCount).toBe(1);
    expect(manager.cachedTileCount).toBe(1);
    expect(manager.indexedTileCount).toBe(2);
    expect(fetcher).toHaveBeenCalledOnce();

    await expect(
      manager.synchronize(
        view({
          frustum: cubeFrustum(5_000),
          worldOffset: new THREE.Vector3(-40_000, 0, 0),
        }),
      ),
    ).resolves.toBe(true);

    expect(manager.loadedObjects.map((object) => object.id)).toEqual(['galaxy-b']);
    expect(manager.loadedTileCount).toBe(1);
    expect(manager.cachedTileCount).toBe(2);
    expect(fetcher).toHaveBeenCalledTimes(2);
    await expect(
      manager.synchronize(
        view({
          frustum: cubeFrustum(5_000),
          worldOffset: new THREE.Vector3(-40_000, 0, 0),
        }),
      ),
    ).resolves.toBe(false);
    expect(fetcher).toHaveBeenCalledTimes(2);
  });

  it('décharge les tuiles lointaines mais conserve celle d’une cible active', async () => {
    const fetcher = installTileFetcher();
    const manager = new SpaceTileManager(index(), fetcher);

    await manager.synchronize(view({ quality: 'high', frustum: cubeFrustum(100_000) }));
    await expect(manager.synchronize(view({ lodLevel: 4 }), ['galaxy-b', 'unknown'])).resolves.toBe(
      true,
    );
    expect(manager.loadedObjects.map((object) => object.id)).toEqual(['galaxy-b']);
    expect(manager.loadedTileCount).toBe(1);

    await expect(manager.synchronize(view({ lodLevel: 4 }), [])).resolves.toBe(true);
    expect(manager.loadedObjects).toEqual([]);

    await expect(manager.ensureObject('galaxy-b')).resolves.toBe(true);
    expect(fetcher).toHaveBeenCalledTimes(2);
    await expect(manager.ensureObject('galaxy-b')).resolves.toBe(true);
    await expect(manager.ensureObject('unknown')).resolves.toBe(false);
    expect(fetcher).toHaveBeenCalledTimes(2);
  });

  it('charge le parent et son détail adaptatif lorsque la cellule remplit l’écran', async () => {
    const fetcher = installHierarchicalTileFetcher();
    const manager = new SpaceTileManager(hierarchicalIndex(), fetcher);

    await manager.synchronize(
      view({
        quality: 'low',
        cameraPosition: new THREE.Vector3(0, 0, 1_000),
        frustum: cubeFrustum(100_000),
      }),
    );
    expect(manager.loadedObjects.map((object) => object.id)).toEqual(['galaxy-a', 'galaxy-b']);
    expect(manager.loadedTileCount).toBe(2);

    await manager.synchronize(
      view({
        quality: 'low',
        cameraPosition: new THREE.Vector3(0, 0, 1_000_000),
        frustum: cubeFrustum(2_000_000),
      }),
    );
    expect(manager.loadedObjects.map((object) => object.id)).toEqual(['galaxy-a']);
    expect(manager.loadedTileCount).toBe(1);
    expect(manager.cachedTileCount).toBe(2);
  });

  it('signale une tuile indisponible avec son identifiant', async () => {
    const manager = new SpaceTileManager(
      index(),
      vi.fn(async () => failedResponse(503)),
    );

    await expect(manager.ensureObject('galaxy-a')).rejects.toThrow(
      'Impossible de charger la tuile tile-a (503)',
    );
  });

  it('signale aussi une demande interne pour un identifiant de tuile inconnu', async () => {
    const manager = new SpaceTileManager(index(), installTileFetcher());
    const access = manager as unknown as {
      loadTile(tileId: string): Promise<void>;
    };

    await expect(access.loadTile('missing-tile')).rejects.toThrow(
      'Tuile spatiale inconnue : missing-tile',
    );
  });

  it.each([
    [dataset([galaxy('unexpected', [0, 0, 0])]), 'Objets inattendus dans la tuile tile-a'],
    [
      dataset([galaxy('galaxy-a', [4, 0, 0])]),
      'Objet galaxy-a hors des limites de la tuile tile-a',
    ],
    [
      dataset([{ ...galaxy('galaxy-a', [0, 0, 0]), referenceFrame: 'local-group' }]),
      'Référentiel incohérent pour galaxy-a',
    ],
    [
      dataset([
        {
          ...galaxy('galaxy-a', [0, 0, 0]),
          positionProvider: {
            type: 'procedural',
            generatorId: 'test-galaxy',
            seed: 42,
          },
        },
      ]),
      'Position statique requise pour galaxy-a',
    ],
  ])('rejette un contenu de tuile incohérent', async (body, message) => {
    const manager = new SpaceTileManager(
      index(),
      vi.fn(async () => successfulResponse(body)),
    );

    await expect(manager.ensureObject('galaxy-a')).rejects.toThrow(message);
  });
});

function index(): SpaceTileIndex {
  return {
    version: '1.0.0',
    tiles: [
      {
        id: 'tile-a',
        level: 0,
        referenceFrame: 'nearby-universe',
        url: '/tiles/a.json',
        bounds: {
          min: [-2, -2, -2],
          max: [2, 2, 2],
          unit: 'megaparsec',
        },
        objectIds: ['galaxy-a'],
      },
      {
        id: 'tile-b',
        level: 0,
        referenceFrame: 'nearby-universe',
        url: '/tiles/b.json',
        bounds: {
          min: [8, -2, -2],
          max: [12, 2, 2],
          unit: 'megaparsec',
        },
        objectIds: ['galaxy-b'],
      },
    ],
    searchEntries: [searchEntry('galaxy-a', 'Galaxie A'), searchEntry('galaxy-b', 'Galaxie B')],
  };
}

function installTileFetcher(): ReturnType<typeof vi.fn<(url: string) => Promise<Response>>> {
  return vi.fn(async (url: string) => {
    const objects =
      url === '/tiles/a.json' ? [galaxy('galaxy-a', [0, 0, 0])] : [galaxy('galaxy-b', [10, 0, 0])];

    return successfulResponse(dataset(objects));
  });
}

function installHierarchicalTileFetcher(): ReturnType<
  typeof vi.fn<(url: string) => Promise<Response>>
> {
  return vi.fn(async (url: string) => {
    const objects =
      url === '/tiles/root.json'
        ? [galaxy('galaxy-a', [0, 0, 0])]
        : [galaxy('galaxy-b', [0.5, 0, 0])];

    return successfulResponse(dataset(objects));
  });
}

function hierarchicalIndex(): SpaceTileIndex {
  return {
    version: '2.0.0',
    tiles: [
      {
        id: 'tile-root',
        level: 0,
        childIds: ['tile-child'],
        referenceFrame: 'nearby-universe',
        url: '/tiles/root.json',
        bounds: {
          min: [-2, -2, -2],
          max: [2, 2, 2],
          unit: 'megaparsec',
        },
        objectIds: ['galaxy-a'],
      },
      {
        id: 'tile-child',
        level: 1,
        parentId: 'tile-root',
        referenceFrame: 'nearby-universe',
        url: '/tiles/child.json',
        bounds: {
          min: [0, -1, -1],
          max: [1, 1, 1],
          unit: 'megaparsec',
        },
        objectIds: ['galaxy-b'],
      },
    ],
    searchEntries: [searchEntry('galaxy-a', 'Galaxie A'), searchEntry('galaxy-b', 'Galaxie B')],
  };
}

function dataset(objects: readonly SpaceObject[]): unknown {
  return { version: '1.0.0', objects };
}

function galaxy(id: string, position: [number, number, number]): SpaceObject {
  return {
    id,
    name: id,
    aliases: [],
    type: 'galaxy',
    parentId: 'nearby-universe',
    referenceFrame: 'nearby-universe',
    scientificConfidence: 'observed',
    visual: {
      visualRadius: 40,
      scaleMode: 'adaptive',
      galaxyShape: 'spiral',
    },
    positionProvider: {
      type: 'static',
      position,
      unit: 'megaparsec',
    },
  };
}

function searchEntry(id: string, name: string): SearchEntry {
  return {
    id,
    name,
    aliases: [],
    type: 'galaxy',
    parentName: 'Univers proche',
  };
}

function successfulResponse(body: unknown): Response {
  return {
    ok: true,
    status: 200,
    json: async () => body,
  } as Response;
}

function failedResponse(status: number): Response {
  return {
    ok: false,
    status,
    json: async () => null,
  } as Response;
}

function view(overrides: Partial<SpaceTileView> = {}): SpaceTileView {
  return {
    lodLevel: 5,
    quality: 'medium',
    viewportHeight: 1_000,
    projectionScaleY: 1,
    cameraPosition: new THREE.Vector3(0, 0, 100_000),
    worldOffset: new THREE.Vector3(),
    frustum: cubeFrustum(100_000),
    ...overrides,
  };
}

function cubeFrustum(halfSize: number): THREE.Frustum {
  return new THREE.Frustum(
    new THREE.Plane(new THREE.Vector3(1, 0, 0), halfSize),
    new THREE.Plane(new THREE.Vector3(-1, 0, 0), halfSize),
    new THREE.Plane(new THREE.Vector3(0, 1, 0), halfSize),
    new THREE.Plane(new THREE.Vector3(0, -1, 0), halfSize),
    new THREE.Plane(new THREE.Vector3(0, 0, 1), halfSize),
    new THREE.Plane(new THREE.Vector3(0, 0, -1), halfSize),
  );
}
