import * as THREE from 'three';
import {
  type SearchEntry,
  type SpaceObject,
  type StarClusterTile,
} from '../../data/models/universe.models';
import type { SpaceTileView } from '../tiles/space-tile-selection';
import type { StarTileView } from '../tiles/star-tile-selection';
import {
  SpaceStreamingCoordinator,
  type SpaceStreamingCallbacks,
  type SpaceStreamingFrame,
  type SpaceTileStream,
  type StarTileStream,
} from './space-streaming-coordinator';

describe('SpaceStreamingCoordinator', () => {
  it('expose des valeurs neutres sans sources et ignore les mises à jour après destruction', async () => {
    const callbacks = callbackHarness();
    const coordinator = new SpaceStreamingCoordinator(null, null, callbacks.callbacks);

    expect(coordinator.searchEntries).toEqual([]);
    expect(coordinator.loadedSpaceObjects).toEqual([]);
    expect(coordinator.hasObject('galaxy-a')).toBe(false);
    await expect(coordinator.ensureObject('galaxy-a')).resolves.toBe(false);
    expect(coordinator.stats).toEqual({
      loadedTiles: 0,
      indexedGalaxyTiles: 0,
      cachedGalaxyTiles: 0,
      activeStarTiles: 0,
      cachedStarPacks: 0,
      cachedStarTiles: 0,
      activeStarClusters: 0,
      cachedStarClusters: 0,
    });

    coordinator.update(streamingFrame(), 1);
    coordinator.dispose();
    coordinator.update(streamingFrame(), 1);

    expect(callbacks.onSpaceTilesChanged).not.toHaveBeenCalled();
    expect(callbacks.onStarTilesChanged).not.toHaveBeenCalled();
  });

  it('expose les catalogues, objets et statistiques des deux sources', () => {
    const space = spaceTileStream();
    const stars = starTileStream();
    const coordinator = new SpaceStreamingCoordinator(
      space.stream,
      stars.stream,
      callbackHarness().callbacks,
    );

    expect(coordinator.searchEntries).toEqual(space.searchEntries);
    expect(coordinator.loadedSpaceObjects).toEqual(space.loadedObjects);
    expect(coordinator.hasObject('galaxy-a')).toBe(true);
    expect(coordinator.hasObject('unknown')).toBe(false);
    expect(coordinator.stats).toEqual({
      loadedTiles: 2,
      indexedGalaxyTiles: 8,
      cachedGalaxyTiles: 3,
      activeStarTiles: 4,
      cachedStarPacks: 5,
      cachedStarTiles: 6,
      activeStarClusters: 7,
      cachedStarClusters: 9,
    });
  });

  it('invalide les vues afin de resynchroniser immédiatement les deux sources', async () => {
    const space = spaceTileStream();
    const stars = starTileStream();
    const coordinator = new SpaceStreamingCoordinator(
      space.stream,
      stars.stream,
      callbackHarness().callbacks,
    );
    const frame = streamingFrame();

    coordinator.update(frame, 0);
    await vi.waitFor(() => expect(space.synchronize).toHaveBeenCalledOnce());
    await vi.waitFor(() => expect(stars.synchronize).toHaveBeenCalledOnce());

    coordinator.update(frame, 0);
    expect(space.synchronize).toHaveBeenCalledOnce();
    expect(stars.synchronize).toHaveBeenCalledOnce();

    coordinator.invalidateViews();
    coordinator.update(frame, 0);
    await vi.waitFor(() => expect(space.synchronize).toHaveBeenCalledTimes(2));
    await vi.waitFor(() => expect(stars.synchronize).toHaveBeenCalledTimes(2));
  });

  it('charge un objet indexé et n’applique que les résultats encore actifs', async () => {
    const callbacks = callbackHarness();
    const space = spaceTileStream();
    const coordinator = new SpaceStreamingCoordinator(space.stream, null, callbacks.callbacks);

    await expect(coordinator.ensureObject('unknown')).resolves.toBe(false);
    expect(space.ensureObject).not.toHaveBeenCalled();

    await expect(coordinator.ensureObject('galaxy-a')).resolves.toBe(true);
    expect(callbacks.onSpaceTilesChanged).toHaveBeenCalledWith(space.loadedObjects);

    space.ensureObject.mockResolvedValueOnce(false);
    await expect(coordinator.ensureObject('galaxy-a')).resolves.toBe(false);
    expect(callbacks.onSpaceTilesChanged).toHaveBeenCalledOnce();

    callbacks.setActive(false);
    await expect(coordinator.ensureObject('galaxy-a')).resolves.toBe(true);
    expect(callbacks.onSpaceTilesChanged).toHaveBeenCalledOnce();
  });

  it('ignore un chargement d’objet terminé après sa destruction', async () => {
    const callbacks = callbackHarness();
    const pending = deferred<boolean>();
    const space = spaceTileStream({ ensureObject: vi.fn(() => pending.promise) });
    const coordinator = new SpaceStreamingCoordinator(space.stream, null, callbacks.callbacks);
    const loading = coordinator.ensureObject('galaxy-a');

    coordinator.dispose();
    pending.resolve(true);

    await expect(loading).resolves.toBe(true);
    expect(callbacks.onSpaceTilesChanged).not.toHaveBeenCalled();
  });

  it('cadence le streaming spatial, retient les cibles et recapture la caméra', async () => {
    const callbacks = callbackHarness();
    const space = spaceTileStream({
      hasObject: vi.fn((objectId: string) => ['galaxy-a', 'galaxy-b'].includes(objectId)),
      synchronize: vi.fn(async () => true),
    });
    const coordinator = new SpaceStreamingCoordinator(space.stream, null, callbacks.callbacks);
    const camera = streamingCamera();
    const initialFrame = streamingFrame({
      camera,
      quality: 'low',
      targetId: 'galaxy-b',
      selectedId: 'galaxy-a',
    });

    coordinator.update({ ...initialFrame, transitioning: true }, 1);
    expect(space.synchronize).not.toHaveBeenCalled();

    coordinator.update(initialFrame, 0);
    await vi.waitFor(() => expect(space.synchronize).toHaveBeenCalledOnce());
    expect(space.synchronize).toHaveBeenLastCalledWith(
      expect.objectContaining({
        lodLevel: 5,
        quality: 'low',
        viewportHeight: 600,
        cameraPosition: expect.objectContaining({ x: 10, y: 20, z: 30 }),
      }),
      ['galaxy-a', 'galaxy-b'],
    );
    expect(callbacks.onSpaceTilesChanged).toHaveBeenCalledWith(space.loadedObjects);

    coordinator.update(initialFrame, 0.1);
    expect(space.synchronize).toHaveBeenCalledOnce();

    camera.position.set(90, 80, 70);
    coordinator.update({ ...initialFrame, viewportHeight: 0 }, 0.15);
    await vi.waitFor(() => expect(space.synchronize).toHaveBeenCalledTimes(2));
    const periodicView = space.synchronize.mock.calls[1]![0];

    expect(periodicView.cameraPosition.toArray()).toEqual([90, 80, 70]);
    expect(periodicView.viewportHeight).toBe(1);

    coordinator.update({ ...initialFrame, quality: 'high' }, 0);
    await vi.waitFor(() => expect(space.synchronize).toHaveBeenCalledTimes(3));
  });

  it('vide les requêtes spatiales en attente et signale chaque échec', async () => {
    const callbacks = callbackHarness();
    const first = deferred<boolean>();
    const space = spaceTileStream({
      synchronize: vi
        .fn<(view: SpaceTileView, retainedIds: readonly string[]) => Promise<boolean>>()
        .mockReturnValueOnce(first.promise)
        .mockRejectedValueOnce(new Error('tuile cassée'))
        .mockRejectedValueOnce('rupture'),
    });
    const coordinator = new SpaceStreamingCoordinator(space.stream, null, callbacks.callbacks);

    coordinator.update(streamingFrame({ lodLevel: 5 }), 0);
    coordinator.update(streamingFrame({ lodLevel: 4 }), 0);
    first.resolve(true);
    await vi.waitFor(() => expect(space.synchronize).toHaveBeenCalledTimes(2));
    coordinator.update(streamingFrame({ lodLevel: 5 }), 0);
    await vi.waitFor(() => expect(space.synchronize).toHaveBeenCalledTimes(3));

    expect(callbacks.onSpaceTilesChanged).toHaveBeenCalledOnce();
    expect(callbacks.onWarning).toHaveBeenNthCalledWith(
      1,
      'Chargement spatial partiel : tuile cassée',
    );
    expect(callbacks.onWarning).toHaveBeenNthCalledWith(
      2,
      'Chargement spatial partiel : erreur inconnue',
    );
  });

  it('cadence les tuiles stellaires et applique les changements de LOD', async () => {
    const callbacks = callbackHarness();
    const tile = starClusterTile(3);
    const stars = starTileStream({
      synchronize: vi
        .fn<
          (view: StarTileView) => Promise<{ changed: boolean; tiles: readonly StarClusterTile[] }>
        >()
        .mockResolvedValueOnce({ changed: true, tiles: [tile] })
        .mockResolvedValueOnce({ changed: false, tiles: [tile] })
        .mockResolvedValueOnce({ changed: true, tiles: [] }),
    });
    const coordinator = new SpaceStreamingCoordinator(null, stars.stream, callbacks.callbacks);
    const frame = streamingFrame({ lodLevel: 3 });

    coordinator.update(frame, 0);
    await vi.waitFor(() => expect(callbacks.onStarTilesChanged).toHaveBeenCalledWith([tile]));

    coordinator.update(frame, 0.1);
    expect(stars.synchronize).toHaveBeenCalledOnce();
    coordinator.update(frame, 0.15);
    await vi.waitFor(() => expect(stars.synchronize).toHaveBeenCalledTimes(2));
    expect(callbacks.onStarTilesChanged).toHaveBeenCalledOnce();

    coordinator.update({ ...frame, lodLevel: 2 }, 0);
    await vi.waitFor(() => expect(callbacks.onStarTilesChanged).toHaveBeenLastCalledWith([]));
  });

  it('abandonne un résultat stellaire obsolète au profit de la vue la plus récente', async () => {
    const callbacks = callbackHarness();
    const first = deferred<{ changed: boolean; tiles: readonly StarClusterTile[] }>();
    const detailed = starClusterTile(3);
    const overview = starClusterTile(4);
    const stars = starTileStream({
      synchronize: vi
        .fn<
          (view: StarTileView) => Promise<{ changed: boolean; tiles: readonly StarClusterTile[] }>
        >()
        .mockReturnValueOnce(first.promise)
        .mockResolvedValueOnce({ changed: true, tiles: [overview] }),
    });
    const coordinator = new SpaceStreamingCoordinator(null, stars.stream, callbacks.callbacks);

    coordinator.update(streamingFrame({ lodLevel: 3 }), 0);
    coordinator.update(streamingFrame({ lodLevel: 4 }), 0);
    first.resolve({ changed: true, tiles: [detailed] });

    await vi.waitFor(() => expect(stars.synchronize).toHaveBeenCalledTimes(2));
    await vi.waitFor(() => expect(callbacks.onStarTilesChanged).toHaveBeenCalledWith([overview]));
    expect(callbacks.onStarTilesChanged).not.toHaveBeenCalledWith([detailed]);
  });

  it('déduplique les erreurs stellaires jusqu’à une synchronisation réussie', async () => {
    const callbacks = callbackHarness();
    const stars = starTileStream({
      synchronize: vi
        .fn<
          (view: StarTileView) => Promise<{ changed: boolean; tiles: readonly StarClusterTile[] }>
        >()
        .mockRejectedValueOnce(new Error('cellules cassées'))
        .mockRejectedValueOnce(new Error('cellules cassées'))
        .mockRejectedValueOnce('rupture')
        .mockResolvedValueOnce({ changed: false, tiles: [] })
        .mockRejectedValueOnce(new Error('cellules cassées')),
    });
    const coordinator = new SpaceStreamingCoordinator(null, stars.stream, callbacks.callbacks);

    for (const [index, lodLevel] of [3, 4, 3, 4, 3].entries()) {
      coordinator.update(streamingFrame({ lodLevel }), 0);
      await vi.waitFor(() => expect(stars.synchronize).toHaveBeenCalledTimes(index + 1));
    }

    expect(callbacks.onWarning).toHaveBeenNthCalledWith(
      1,
      'Streaming stellaire indisponible : cellules cassées',
    );
    expect(callbacks.onWarning).toHaveBeenNthCalledWith(
      2,
      'Streaming stellaire indisponible : erreur inconnue',
    );
    expect(callbacks.onWarning).toHaveBeenNthCalledWith(
      3,
      'Streaming stellaire indisponible : cellules cassées',
    );
  });

  it('n’applique pas un résultat stellaire terminé après désactivation', async () => {
    const callbacks = callbackHarness();
    const pending = deferred<{ changed: boolean; tiles: readonly StarClusterTile[] }>();
    const stars = starTileStream({ synchronize: vi.fn(() => pending.promise) });
    const coordinator = new SpaceStreamingCoordinator(null, stars.stream, callbacks.callbacks);

    coordinator.update(streamingFrame({ lodLevel: 3 }), 0);
    callbacks.setActive(false);
    pending.resolve({ changed: true, tiles: [starClusterTile(3)] });

    await vi.waitFor(() => expect(stars.synchronize).toHaveBeenCalledOnce());
    await Promise.resolve();
    expect(callbacks.onStarTilesChanged).not.toHaveBeenCalled();
  });
});

function callbackHarness() {
  const state = { active: true };
  const onSpaceTilesChanged = vi.fn<(objects: readonly SpaceObject[]) => void>();
  const onStarTilesChanged = vi.fn<(tiles: readonly StarClusterTile[]) => Promise<void>>(
    async () => undefined,
  );
  const onWarning = vi.fn<(message: string) => void>();
  const callbacks: SpaceStreamingCallbacks = {
    isActive: () => state.active,
    onSpaceTilesChanged,
    onStarTilesChanged,
    onWarning,
  };

  return {
    callbacks,
    onSpaceTilesChanged,
    onStarTilesChanged,
    onWarning,
    setActive: (active: boolean) => {
      state.active = active;
    },
  };
}

interface SpaceTileStreamHarness {
  readonly stream: SpaceTileStream;
  readonly searchEntries: readonly SearchEntry[];
  readonly loadedObjects: readonly SpaceObject[];
  readonly hasObject: ReturnType<typeof vi.fn>;
  readonly ensureObject: ReturnType<typeof vi.fn>;
  readonly synchronize: ReturnType<typeof vi.fn>;
}

function spaceTileStream(overrides: Partial<SpaceTileStream> = {}): SpaceTileStreamHarness {
  const searchEntries: readonly SearchEntry[] = [
    { id: 'galaxy-a', name: 'Galaxy A', aliases: [], type: 'galaxy' },
  ];
  const loadedObjects = [spaceObject('galaxy-a')];
  const hasObject = vi.fn((objectId: string) => objectId === 'galaxy-a');
  const ensureObject = vi.fn(async () => true);
  const synchronize = vi.fn(async () => false);
  const stream: SpaceTileStream = {
    searchEntries,
    loadedObjects,
    loadedTileCount: 2,
    indexedTileCount: 8,
    cachedTileCount: 3,
    hasObject,
    ensureObject,
    synchronize,
    ...overrides,
  };

  return {
    stream,
    searchEntries,
    loadedObjects,
    hasObject: stream.hasObject as ReturnType<typeof vi.fn>,
    ensureObject: stream.ensureObject as ReturnType<typeof vi.fn>,
    synchronize: stream.synchronize as ReturnType<typeof vi.fn>,
  };
}

interface StarTileStreamHarness {
  readonly stream: StarTileStream;
  readonly synchronize: ReturnType<typeof vi.fn>;
}

function starTileStream(overrides: Partial<StarTileStream> = {}): StarTileStreamHarness {
  const synchronize = vi.fn(async () => ({ changed: false, tiles: [] }));
  const stream: StarTileStream = {
    activeTileCount: 4,
    cachedPackCount: 5,
    cachedTileCount: 6,
    activeClusterCount: 7,
    cachedClusterCount: 9,
    synchronize,
    ...overrides,
  };

  return {
    stream,
    synchronize: stream.synchronize as ReturnType<typeof vi.fn>,
  };
}

function streamingFrame(overrides: Partial<SpaceStreamingFrame> = {}): SpaceStreamingFrame {
  return {
    camera: streamingCamera(),
    viewportHeight: 600,
    lodLevel: 5,
    quality: 'medium',
    worldOffset: new THREE.Vector3(1, 2, 3),
    transitioning: false,
    targetId: null,
    selectedId: null,
    ...overrides,
  };
}

function streamingCamera(): THREE.PerspectiveCamera {
  const camera = new THREE.PerspectiveCamera(48, 16 / 9, 0.1, 100_000);

  camera.position.set(10, 20, 30);
  camera.lookAt(0, 0, 0);
  camera.updateProjectionMatrix();
  camera.updateMatrixWorld();

  return camera;
}

function spaceObject(id: string): SpaceObject {
  return {
    id,
    name: id,
    type: 'galaxy',
    scientificConfidence: 'observed',
    referenceFrame: 'nearby-universe',
    visual: {
      visualRadius: 1,
      scaleMode: 'adaptive',
    },
    positionProvider: {
      type: 'static',
      position: [0, 0, 0],
      unit: 'megaparsec',
    },
  };
}

function starClusterTile(lodLevel: number): StarClusterTile {
  return {
    id: `tile-${lodLevel}`,
    parentId: lodLevel === 3 ? 'root' : undefined,
    version: '2.0.0',
    sourceCatalog: 'stars',
    sourceStarCount: 2,
    referenceEpochJulianDay: 2_451_545,
    lodLevel,
    cellSizeParsec: lodLevel === 3 ? 40 : 160,
    clusterCount: 1,
    cellCoordinates: Int32Array.from([0, 0, 0]),
    positionsParsec: Float32Array.from([1, 2, 3]),
    starCounts: Uint32Array.from([2]),
    apparentMagnitudes: Float32Array.from([-1]),
    colorIndicesBv: Float32Array.from([0.4]),
  };
}

function deferred<T>(): {
  readonly promise: Promise<T>;
  readonly resolve: (value: T) => void;
} {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((resolvePromise) => {
    resolve = resolvePromise;
  });

  return { promise, resolve };
}
