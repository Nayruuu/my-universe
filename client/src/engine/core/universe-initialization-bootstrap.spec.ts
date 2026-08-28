import type { DisplayOptions, SpaceObject } from '../../data/models/universe.models';
import type { LoadedUniverseAssets } from '../loaders/asset-loader';
import type { UniverseRenderingRuntime } from './universe-rendering-bootstrap';
import { CoordinateSystem } from '../coordinates/coordinate-system';
import { PerformanceManager } from '../performance/performance-manager';
import type { UniverseSceneRuntime } from './universe-scene-bootstrap';
import type {
  SpaceStreamingCallbacks,
  SpaceStreamingCoordinator,
} from './space-streaming-coordinator';
import {
  type UniverseInitializationRuntimeDependencies,
  UniverseInitializationBootstrap,
} from './universe-initialization-bootstrap';

describe('UniverseInitializationBootstrap', () => {
  it('assemble les ressources et relie les deux flux de tuiles', async () => {
    const harness = createHarness(true);

    const runtime = await harness.bootstrap.create(options(harness));

    expect(harness.loadAssets).toHaveBeenCalledOnce();
    expect(harness.renderingFactory.create).toHaveBeenCalledWith(
      harness.container,
      harness.displayOptions.quality,
    );
    expect(harness.createSceneRuntime).toHaveBeenCalledWith({
      assets: harness.assets,
      displayOptions: harness.displayOptions,
      pixelRatio: 1.25,
      initialTime: harness.initialTime,
    });
    expect(harness.sceneRuntime.scene.prewarmInitialRendering).toHaveBeenCalledWith(
      harness.rendering.renderer,
      harness.rendering.camera,
    );
    expect(harness.sceneRuntime.scene.prewarmMilkyWayAssets).toHaveBeenCalledWith(
      harness.rendering.renderer,
    );
    expect(harness.createStreamingCoordinator).toHaveBeenCalledWith(
      harness.sceneRuntime.catalogRuntime.spaceTileManager,
      harness.sceneRuntime.catalogRuntime.starTileManager,
      expect.any(Object),
      { streamStarTiles: true },
    );
    expect(runtime.rendering).toBe(harness.rendering);
    expect(runtime.sceneRuntime).toBe(harness.sceneRuntime);
    expect(runtime.streamingCoordinator).toBe(harness.streamingCoordinator);
    expect(runtime.warnings).toEqual(['catalog warning']);

    const callbacks = harness.streamingCallbacks();
    const loadedObjects = [spaceObject('galaxy-a')];
    const starTiles = [{ id: 'tile-a' }];

    callbacks.onSpaceTilesChanged(loadedObjects);
    callbacks.onWarning('stream warning');
    await callbacks.onStarTilesChanged(starTiles as never);

    expect(callbacks.isActive()).toBe(true);
    expect(harness.onSpaceTilesChanged).toHaveBeenCalledWith(loadedObjects);
    expect(harness.onWarning).toHaveBeenCalledWith('stream warning');
    expect(harness.sceneRuntime.scene.setStarClusterTiles).toHaveBeenCalledWith(
      starTiles,
      harness.sceneRuntime.catalogRuntime.starCatalogRegistry,
    );
  });

  it('ignore les tuiles stellaires sans registre dense', async () => {
    const harness = createHarness(false);

    await harness.bootstrap.create(options(harness));
    await harness.streamingCallbacks().onStarTilesChanged([]);

    expect(harness.sceneRuntime.scene.setStarClusterTiles).not.toHaveBeenCalled();
  });

  it('lance les données et les dépendances runtime ensemble avant de créer le renderer', async () => {
    const harness = createHarness(true);
    const assetsGate = deferred<LoadedUniverseAssets>();
    const dependenciesGate = deferred<UniverseInitializationRuntimeDependencies>();

    harness.loadDependencies.mockReturnValue({
      assets: assetsGate.promise,
      runtimeDependencies: dependenciesGate.promise,
    });
    const creation = harness.bootstrap.create(options(harness));

    expect(harness.loadDependencies).toHaveBeenCalledOnce();
    expect(harness.renderingFactory.create).not.toHaveBeenCalled();

    assetsGate.resolve(harness.assets);
    await Promise.resolve();
    expect(harness.renderingFactory.create).not.toHaveBeenCalled();

    dependenciesGate.resolve({
      createSceneRuntime:
        harness.createSceneRuntime as UniverseInitializationRuntimeDependencies['createSceneRuntime'],
      createStreamingCoordinator:
        harness.createStreamingCoordinator as UniverseInitializationRuntimeDependencies['createStreamingCoordinator'],
    });
    await creation;

    expect(harness.renderingFactory.create).toHaveBeenCalledOnce();
  });

  it('termine le préchauffage GPU initial avant d’autoriser le streaming et les interactions', async () => {
    const harness = createHarness(true);
    const prewarmGate = deferred<boolean>();

    harness.sceneRuntime.scene.prewarmInitialRendering.mockReturnValue(prewarmGate.promise);
    const creation = harness.bootstrap.create(options(harness));

    await vi.waitFor(() => {
      expect(harness.sceneRuntime.scene.prewarmInitialRendering).toHaveBeenCalledWith(
        harness.rendering.renderer,
        harness.rendering.camera,
      );
    });
    expect(harness.createStreamingCoordinator).not.toHaveBeenCalled();

    prewarmGate.resolve(true);
    await creation;

    expect(harness.createStreamingCoordinator).toHaveBeenCalledOnce();
    expect(harness.sceneRuntime.scene.prewarmMilkyWayAssets).toHaveBeenCalledWith(
      harness.rendering.renderer,
    );
  });

  it('préchauffe les textures galactiques en arrière-plan sans retarder les interactions', async () => {
    const harness = createHarness(true);
    const prewarmGate = deferred<boolean>();

    harness.sceneRuntime.scene.prewarmMilkyWayAssets.mockReturnValue(prewarmGate.promise);

    await expect(harness.bootstrap.create(options(harness))).resolves.toMatchObject({
      sceneRuntime: harness.sceneRuntime,
    });
    expect(harness.sceneRuntime.scene.prewarmMilkyWayAssets).toHaveBeenCalledWith(
      harness.rendering.renderer,
    );

    prewarmGate.resolve(true);
  });

  it('ignore un échec inattendu du préchauffage galactique différé', async () => {
    const harness = createHarness(true);

    harness.sceneRuntime.scene.prewarmMilkyWayAssets.mockRejectedValue(
      new Error('préchauffage indisponible'),
    );

    await expect(harness.bootstrap.create(options(harness))).resolves.toMatchObject({
      sceneRuntime: harness.sceneRuntime,
    });
    await Promise.resolve();
  });

  it('ignore le préchauffage avec un renderer sans primitives GPU compatibles', async () => {
    const harness = createHarness(true);

    Reflect.deleteProperty(harness.rendering.renderer, 'initTexture');
    Reflect.deleteProperty(harness.rendering.renderer, 'compileAsync');

    await harness.bootstrap.create(options(harness));

    expect(harness.sceneRuntime.scene.prewarmInitialRendering).not.toHaveBeenCalled();
    expect(harness.sceneRuntime.scene.prewarmMilkyWayAssets).not.toHaveBeenCalled();
    expect(harness.createStreamingCoordinator).toHaveBeenCalledOnce();
  });

  it('ne crée aucun renderer lorsque les dépendances ou données échouent', async () => {
    const dependencyFailure = createHarness(true);
    const assetFailure = createHarness(true);

    dependencyFailure.loadDependencies.mockReturnValue({
      assets: Promise.resolve(dependencyFailure.assets),
      runtimeDependencies: Promise.reject(new Error('dependency failure')),
    });
    assetFailure.loadAssets.mockRejectedValue(new Error('asset failure'));

    await expect(dependencyFailure.bootstrap.create(options(dependencyFailure))).rejects.toThrow(
      'dependency failure',
    );
    await expect(assetFailure.bootstrap.create(options(assetFailure))).rejects.toThrow(
      'asset failure',
    );
    expect(dependencyFailure.renderingFactory.create).not.toHaveBeenCalled();
    expect(assetFailure.renderingFactory.create).not.toHaveBeenCalled();
  });

  it('libère le rendu si la scène échoue', async () => {
    const harness = createHarness(true);

    harness.createSceneRuntime.mockRejectedValue(new Error('scene failure'));

    await expect(harness.bootstrap.create(options(harness))).rejects.toThrow('scene failure');
    expectRenderingDisposed(harness);
    expect(harness.sceneRuntime.scene.dispose).not.toHaveBeenCalled();
  });

  it('libère scène, registre et rendu si le streaming échoue', async () => {
    const harness = createHarness(true);

    harness.createStreamingCoordinator.mockImplementation(() => {
      throw new Error('streaming failure');
    });

    await expect(harness.bootstrap.create(options(harness))).rejects.toThrow('streaming failure');
    expect(harness.sceneRuntime.registry.dispose).toHaveBeenCalledOnce();
    expect(harness.sceneRuntime.scene.dispose).toHaveBeenCalledOnce();
    expectRenderingDisposed(harness);
  });

  it('libère un runtime complet devenu obsolète', async () => {
    const harness = createHarness(true);
    const runtime = await harness.bootstrap.create(options(harness));

    harness.bootstrap.dispose(runtime);

    expect(harness.streamingCoordinator.dispose).toHaveBeenCalledOnce();
    expect(harness.sceneRuntime.registry.dispose).toHaveBeenCalledOnce();
    expect(harness.sceneRuntime.scene.dispose).toHaveBeenCalledOnce();
    expectRenderingDisposed(harness);
  });
});

function createHarness(hasStarCatalog: boolean): InitializationHarness {
  const container = document.createElement('div');
  const displayOptions = optionsDisplay();
  const initialTime = { julianDay: 2_451_545 };
  const assets = loadedAssets();
  const rendering = renderingRuntime();
  const sceneRuntime = runtimeScene(hasStarCatalog);
  const streamingCoordinator = { dispose: vi.fn() } as unknown as SpaceStreamingCoordinator;
  let callbacks: SpaceStreamingCallbacks | null = null;
  const loadAssets = vi.fn(async () => assets);
  const createSceneRuntime = vi.fn(async () => sceneRuntime);
  const createStreamingCoordinator = vi.fn(
    (_spaceTiles, _starTiles, activeCallbacks: SpaceStreamingCallbacks) => {
      callbacks = activeCallbacks;

      return streamingCoordinator;
    },
  );
  const dependencies: UniverseInitializationRuntimeDependencies = {
    createSceneRuntime,
    createStreamingCoordinator,
  };
  const loadDependencies = vi.fn(() => ({
    assets: loadAssets(),
    runtimeDependencies: Promise.resolve(dependencies),
  }));
  const renderingFactory = { create: vi.fn(() => rendering) };
  const onSpaceTilesChanged = vi.fn<(objects: readonly SpaceObject[]) => void>();
  const onWarning = vi.fn<(message: string) => void>();

  return {
    bootstrap: new UniverseInitializationBootstrap(
      renderingFactory,
      new PerformanceManager(),
      new CoordinateSystem(),
      loadDependencies,
    ),
    container,
    displayOptions,
    initialTime,
    assets,
    rendering,
    sceneRuntime,
    streamingCoordinator,
    renderingFactory,
    loadDependencies,
    loadAssets,
    createSceneRuntime,
    createStreamingCoordinator,
    streamingCallbacks: () => {
      if (!callbacks) {
        throw new Error('Callbacks de streaming non installés.');
      }

      return callbacks;
    },
    onSpaceTilesChanged,
    onWarning,
  };
}

function options(harness: InitializationHarness) {
  return {
    container: harness.container,
    displayOptions: harness.displayOptions,
    initialTime: harness.initialTime,
    isActive: () => true,
    onSpaceTilesChanged: (objects: readonly SpaceObject[]) => harness.onSpaceTilesChanged(objects),
    onWarning: (message: string) => harness.onWarning(message),
  };
}

function expectRenderingDisposed(harness: InitializationHarness): void {
  expect(harness.rendering.lensingPass.dispose).toHaveBeenCalledOnce();
  expect(harness.rendering.renderer.renderLists.dispose).toHaveBeenCalledOnce();
  expect(harness.rendering.renderer.dispose).toHaveBeenCalledOnce();
  expect(harness.rendering.renderer.domElement.remove).toHaveBeenCalledOnce();
}

function renderingRuntime(): UniverseRenderingRuntime & {
  readonly renderer: UniverseRenderingRuntime['renderer'] & {
    readonly renderLists: { readonly dispose: ReturnType<typeof vi.fn> };
    readonly dispose: ReturnType<typeof vi.fn>;
    readonly domElement: { readonly remove: ReturnType<typeof vi.fn> };
  };
  readonly lensingPass: UniverseRenderingRuntime['lensingPass'] & {
    readonly dispose: ReturnType<typeof vi.fn>;
  };
} {
  return {
    renderer: {
      renderLists: { dispose: vi.fn() },
      dispose: vi.fn(),
      domElement: { remove: vi.fn() },
      initTexture: vi.fn(),
      compileAsync: vi.fn(),
    },
    camera: {},
    lensingPass: { dispose: vi.fn() },
    pixelRatio: 1.25,
  } as unknown as ReturnType<typeof renderingRuntime>;
}

function runtimeScene(hasStarCatalog: boolean): UniverseSceneRuntime & {
  readonly scene: UniverseSceneRuntime['scene'] & {
    readonly prewarmInitialRendering: ReturnType<typeof vi.fn>;
    readonly prewarmMilkyWayAssets: ReturnType<typeof vi.fn>;
    readonly setStarClusterTiles: ReturnType<typeof vi.fn>;
    readonly dispose: ReturnType<typeof vi.fn>;
  };
  readonly registry: UniverseSceneRuntime['registry'] & {
    readonly dispose: ReturnType<typeof vi.fn>;
  };
} {
  return {
    scene: {
      prewarmInitialRendering: vi.fn(async () => true),
      prewarmMilkyWayAssets: vi.fn(async () => true),
      setStarClusterTiles: vi.fn(async () => undefined),
      dispose: vi.fn(),
    },
    catalogRuntime: {
      spaceTileManager: { id: 'space-tiles' },
      starTileManager: { id: 'star-tiles' },
      starCatalogRegistry: hasStarCatalog ? { id: 'stars' } : null,
    },
    baseObjects: [],
    objects: [],
    registry: { dispose: vi.fn() },
    solarEclipseAppearance: { phase: 'none' },
  } as unknown as ReturnType<typeof runtimeScene>;
}

function loadedAssets(): LoadedUniverseAssets {
  return {
    objects: [],
    starCatalog: null,
    cosmicGroupCatalog: null,
    cosmicStructureCatalog: null,
    cosmicWebVolume: null,
    exoplanetCatalog: null,
    constellationCatalog: null,
    spaceTileIndex: null,
    starTileSource: null,
    tempelFilamentSpineSource: null,
    warnings: ['catalog warning'],
  };
}

function optionsDisplay(): DisplayOptions {
  return {
    showOrbits: true,
    showConstellations: true,
    showLabels: true,
    quality: 'high',
    labelDensity: 'balanced',
    temporalMode: 'state',
  };
}

function spaceObject(id: string): SpaceObject {
  return {
    id,
    name: id,
    type: 'galaxy',
    referenceFrame: 'galactic',
    scientificConfidence: 'observed',
    visual: { visualRadius: 1, scaleMode: 'adaptive' },
    positionProvider: { type: 'static', position: [0, 0, 0], unit: 'parsec' },
  };
}

interface InitializationHarness {
  readonly bootstrap: UniverseInitializationBootstrap;
  readonly container: HTMLElement;
  readonly displayOptions: DisplayOptions;
  readonly initialTime: { readonly julianDay: number };
  readonly assets: LoadedUniverseAssets;
  readonly rendering: ReturnType<typeof renderingRuntime>;
  readonly sceneRuntime: ReturnType<typeof runtimeScene>;
  readonly streamingCoordinator: SpaceStreamingCoordinator;
  readonly renderingFactory: { readonly create: ReturnType<typeof vi.fn> };
  readonly loadDependencies: ReturnType<typeof vi.fn>;
  readonly loadAssets: ReturnType<typeof vi.fn>;
  readonly createSceneRuntime: ReturnType<typeof vi.fn>;
  readonly createStreamingCoordinator: ReturnType<typeof vi.fn>;
  readonly streamingCallbacks: () => SpaceStreamingCallbacks;
  readonly onSpaceTilesChanged: ReturnType<typeof vi.fn<(objects: readonly SpaceObject[]) => void>>;
  readonly onWarning: ReturnType<typeof vi.fn<(message: string) => void>>;
}

function deferred<T>() {
  let resolve!: (value: T | PromiseLike<T>) => void;
  const promise = new Promise<T>((resolvePromise) => {
    resolve = resolvePromise;
  });

  return { promise, resolve };
}
