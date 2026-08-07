import * as THREE from 'three';
import {
  ConstellationCatalog,
  SpaceObject,
  SpaceTileIndex,
  UniverseEngineEvent,
} from '../../data/models/universe.models';
import { type CameraZoomDiagnostics } from '../camera/camera-controller';
import { NAVIGATION_SCALES } from '../camera/navigation-scales';
import { FloatingOriginManager } from '../coordinates/floating-origin-manager';
import { LodManager } from '../lod/lod-manager';
import { PerformanceManager } from '../performance/performance-manager';
import {
  COSMIC_GROUP_CATALOG_HEADER_BYTES,
  COSMIC_GROUP_CATALOG_MAGIC,
  COSMIC_GROUP_CATALOG_RECORD_BYTES,
  COSMIC_GROUP_CATALOG_VERSION,
} from '../loaders/cosmic-group-catalog';
import {
  COSMIC_STRUCTURE_CATALOG_HEADER_BYTES,
  COSMIC_STRUCTURE_CATALOG_MAGIC,
  COSMIC_STRUCTURE_CATALOG_RECORD_BYTES,
  COSMIC_STRUCTURE_CATALOG_VERSION,
} from '../loaders/cosmic-structure-catalog';
import {
  COSMIC_WEB_VOLUME_HEADER_BYTES,
  COSMIC_WEB_VOLUME_MAGIC,
  COSMIC_WEB_VOLUME_VERSION,
} from '../loaders/cosmic-web-volume';
import {
  STAR_CATALOG_HEADER_BYTES,
  STAR_CATALOG_MAGIC,
  STAR_CATALOG_RECORD_BYTES,
  STAR_CATALOG_VERSION,
} from '../loaders/star-catalog';
import {
  EXOPLANET_CATALOG_HEADER_BYTES,
  EXOPLANET_CATALOG_HOST_RECORD_BYTES,
  EXOPLANET_CATALOG_MAGIC,
  EXOPLANET_CATALOG_PLANET_RECORD_BYTES,
  EXOPLANET_CATALOG_VERSION,
} from '../loaders/exoplanet-catalog';
import { createNasaCatalogObjectId } from '../objects/exoplanet-catalog-registry';
import { CosmicGroupCatalogRegistry } from '../objects/cosmic-group-catalog-registry';
import {
  TEMPEL_FILAMENT_SPINE_HEADER_BYTES,
  TEMPEL_FILAMENT_SPINE_INDEX_BYTES,
  TEMPEL_FILAMENT_SPINE_MAGIC,
  TEMPEL_FILAMENT_SPINE_POINT_BYTES,
  TEMPEL_FILAMENT_SPINE_VERSION,
} from '../loaders/tempel-filament-spine-catalog';
import { EarthEclipseEvent, SolarEclipseAppearance } from '../simulation/earth-eclipse';
import { calculateEarthObserverDirection } from '../simulation/body-orientation';
import { calculateSolarEclipseAppearance } from '../simulation/solar-eclipse-calculator';
import { TimeController } from '../simulation/time-controller';
import { dateToJulianDay } from '../simulation/time-utils';
import { type BlackHoleLensingEffect } from '../rendering/black-hole-lensing-pass';
import { getPhotographicProfile } from '../rendering/photographic-profile';
import {
  SolarEclipsePresentationController,
  type SolarEclipsePresentationRegistry,
} from './solar-eclipse-presentation';
import { SolarEclipseStatePublisher } from './solar-eclipse-state-publisher';
import { SpaceStreamingCoordinator } from './space-streaming-coordinator';
import { UniverseDebugRuntime } from './universe-debug-runtime';
import { UniverseAdaptiveRenderingRuntime } from './universe-adaptive-rendering-runtime';
import { UniverseEngine, type WebGlRendererConstructor } from './universe-engine';
import { UniverseInitializationBootstrap } from './universe-initialization-bootstrap';
import { UniverseStreamingRuntime } from './universe-streaming-runtime';

const rendererHarness = vi.hoisted(() => {
  class FakeWebGLRenderer {
    public readonly domElement = document.createElement('canvas');
    public readonly setPixelRatio = vi.fn();
    public readonly setSize = vi.fn();
    public readonly render = vi.fn();
    public readonly dispose = vi.fn();
    public readonly renderLists = { dispose: vi.fn() };
    public readonly info = {
      render: { calls: 3, triangles: 120 },
      memory: { geometries: 4, textures: 2 },
    };
    public outputColorSpace = '';
    public toneMapping = 0;
    public toneMappingExposure = 0;

    constructor(public readonly options: Record<string, unknown>) {
      rendererHarness.instances.push(this);
    }
  }

  return {
    FakeWebGLRenderer,
    instances: [] as FakeWebGLRenderer[],
  };
});

describe('UniverseEngine', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.unstubAllGlobals();
    rendererHarness.instances.length = 0;
    installCanvasContext();
    vi.stubGlobal(
      'matchMedia',
      vi.fn(() => ({
        matches: false,
        media: '',
        onchange: null,
        addListener: vi.fn(),
        removeListener: vi.fn(),
        addEventListener: vi.fn(),
        removeEventListener: vi.fn(),
        dispatchEvent: vi.fn(),
      })),
    );
  });

  afterEach(() => {
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
  });

  it('initialise la scène statique, publie ses états et ignore une seconde initialisation', async () => {
    installAssets([]);
    const container = sizedContainer(960, 540);
    const engine = createTestEngine();
    const events: UniverseEngineEvent[] = [];
    const unsubscribe = engine.subscribe((event) => events.push(event));

    engine.setLabelNameResolver((objectId, fallback) =>
      objectId === 'earth' ? 'Earth' : fallback,
    );

    await engine.initialize(container, {
      quality: 'low',
      showLabels: false,
      showConstellations: false,
    });
    await engine.initialize(container);

    const renderer = rendererHarness.instances[0]!;

    expect(renderer.options).toMatchObject({
      antialias: false,
      alpha: false,
      logarithmicDepthBuffer: true,
    });
    expect(renderer.domElement.className).toBe('universe-canvas');
    expect(renderer.outputColorSpace).toBe(THREE.SRGBColorSpace);
    expect(renderer.toneMapping).toBe(THREE.ACESFilmicToneMapping);
    expect(renderer.toneMappingExposure).toBe(getPhotographicProfile(0, 'low').exposure);
    expect(renderer.setPixelRatio).toHaveBeenCalled();
    expect(renderer.setSize).toHaveBeenCalledWith(960, 540, false);
    expect(container.contains(renderer.domElement)).toBe(true);
    expect(engine.allObjects).toEqual([]);
    expect(events).toContainEqual({ type: 'loading-state', loading: true });
    expect(events).toContainEqual({
      type: 'data-ready',
      objects: [],
      catalogEntries: [],
    });
    expect(events.at(-1)).toEqual({ type: 'loading-state', loading: false });
    expect(rendererHarness.instances).toHaveLength(1);

    const access = engine as unknown as EngineAccess;
    const setNameResolver = vi.spyOn(access.labelManager!, 'setNameResolver');

    engine.setLabelNameResolver((objectId, fallback) => (objectId === 'earth' ? 'Erde' : fallback));
    expect(setNameResolver).toHaveBeenCalledOnce();
    const initialViewDirection = access
      .cameraController!.controls.target.clone()
      .sub(access.camera!.position)
      .normalize();
    const initialGalacticLatitude = THREE.MathUtils.radToDeg(Math.asin(initialViewDirection.y));

    expect(Math.abs(initialGalacticLatitude)).toBeLessThan(15);
    expect(initialViewDirection.x).toBeLessThan(-0.7);

    unsubscribe();
    engine.dispose();
    expect(renderer.dispose).toHaveBeenCalledOnce();
    expect(container.contains(renderer.domElement)).toBe(false);
  });

  it('planifie les catalogues complémentaires après la première image utilisable', () => {
    const runtime = createRuntime();
    const internals = runtime.access as unknown as {
      deferredCatalogCoordinator: { schedule(): void };
    };
    const schedule = vi.spyOn(internals.deferredCatalogCoordinator, 'schedule');

    runtime.access.renderFrame(0.016);

    expect(schedule).toHaveBeenCalledOnce();
    runtime.engine.dispose();
  });

  it('branche le chargement complémentaire différé sur les événements du moteur', async () => {
    const runtime = createRuntime();
    const events: UniverseEngineEvent[] = [];
    let scheduledCallback: (() => void) | null = null;

    runtime.catalog.hasDeferredCatalogs = true;
    runtime.catalog.installDeferredCatalogs.mockResolvedValueOnce(['catalogue partiel']);
    runtime.access.streamingRuntime.reset();
    runtime.engine.subscribe((event) => events.push(event));
    vi.spyOn(window, 'setTimeout').mockImplementation((handler: TimerHandler) => {
      scheduledCallback = typeof handler === 'function' ? (handler as () => void) : null;

      return 41;
    });

    runtime.access.renderFrame(0.016);
    expect(window.setTimeout).toHaveBeenCalledWith(expect.any(Function), 400);

    expect(scheduledCallback).not.toBeNull();
    scheduledCallback!();
    await vi.waitFor(() => expect(runtime.catalog.installDeferredCatalogs).toHaveBeenCalledOnce());
    await vi.waitFor(() =>
      expect(events).toContainEqual({
        type: 'performance-warning',
        message: 'catalogue partiel',
      }),
    );

    expect(runtime.labels.setObjects).toHaveBeenCalledOnce();
    expect(events.some((event) => event.type === 'data-ready')).toBe(false);
    runtime.engine.dispose();
  });

  it('annule un chargement complémentaire planifié lors de la destruction', () => {
    const runtime = createRuntime();
    const clearTimeout = vi.spyOn(window, 'clearTimeout').mockImplementation(() => undefined);

    runtime.catalog.hasDeferredCatalogs = true;
    vi.spyOn(window, 'setTimeout').mockReturnValue(73);

    runtime.access.renderFrame(0.016);
    runtime.engine.dispose();

    expect(clearTimeout).toHaveBeenCalledWith(73);
    expect(runtime.catalog.installDeferredCatalogs).not.toHaveBeenCalled();
  });

  it('partage une initialisation encore en cours entre les appelants', async () => {
    installAssets([]);
    const engine = createTestEngine();
    const access = engine as unknown as EngineAccess;
    const createRuntime = access.initializationBootstrap.create.bind(
      access.initializationBootstrap,
    );
    let releaseInitialization!: () => void;
    const initializationGate = new Promise<void>((resolve) => {
      releaseInitialization = resolve;
    });

    vi.spyOn(access.initializationBootstrap, 'create').mockImplementation(async (options) => {
      await initializationGate;

      return createRuntime(options);
    });
    const firstInitialization = engine.initialize(sizedContainer(960, 540));
    const concurrentInitialization = engine.initialize(sizedContainer(320, 180));

    expect(concurrentInitialization).toBe(firstInitialization);
    expect(rendererHarness.instances).toHaveLength(0);

    releaseInitialization();
    await concurrentInitialization;

    expect(rendererHarness.instances).toHaveLength(1);
    engine.dispose();
  });

  it('annule et libère une initialisation terminée après la destruction du moteur', async () => {
    installAssets([]);
    const engine = createTestEngine();
    const access = engine as unknown as EngineAccess;
    const createRuntime = access.initializationBootstrap.create.bind(
      access.initializationBootstrap,
    );
    let releaseInitialization!: () => void;
    const initializationGate = new Promise<void>((resolve) => {
      releaseInitialization = resolve;
    });

    vi.spyOn(access.initializationBootstrap, 'create').mockImplementation(async (options) => {
      await initializationGate;

      return createRuntime(options);
    });
    const staleInitialization = engine.initialize(sizedContainer(960, 540));

    engine.dispose();
    releaseInitialization();

    await expect(staleInitialization).rejects.toThrow('Initialisation de UniverseEngine annulée');
    const staleRenderer = rendererHarness.instances[0]!;

    expect(staleRenderer.dispose).toHaveBeenCalledOnce();
    expect(staleRenderer.domElement.isConnected).toBe(false);
    expect(engine.allObjects).toEqual([]);

    await engine.initialize(sizedContainer(640, 360));
    expect(rendererHarness.instances).toHaveLength(2);
    engine.dispose();
  });

  it('choisit la qualité recommandée et transmet les avertissements de données', async () => {
    vi.spyOn(navigator, 'hardwareConcurrency', 'get').mockReturnValue(8);
    vi.spyOn(window, 'devicePixelRatio', 'get').mockReturnValue(1);
    installAssets([], {
      binaryStatus: 503,
    });
    const engine = createTestEngine();
    const events: UniverseEngineEvent[] = [];

    engine.subscribe((event) => events.push(event));
    await engine.initialize(sizedContainer(640, 360));

    expect(engine.recommendedQuality).toBe('medium');
    expect(rendererHarness.instances[0]?.options['antialias']).toBe(false);
    expect(events.some((event) => event.type === 'performance-warning')).toBe(true);

    engine.dispose();
  });

  it('relaie un avertissement émis pendant l’initialisation du streaming', async () => {
    installAssets([]);
    const engine = createTestEngine();
    const access = engine as unknown as EngineAccess;
    const createRuntime = access.initializationBootstrap.create.bind(
      access.initializationBootstrap,
    );
    const events: UniverseEngineEvent[] = [];

    vi.spyOn(access.initializationBootstrap, 'create').mockImplementation(async (options) => {
      options.onWarning('Avertissement de streaming');

      return createRuntime(options);
    });
    engine.subscribe((event) => events.push(event));

    await engine.initialize(sizedContainer(640, 360));

    expect(events).toContainEqual({
      type: 'performance-warning',
      message: 'Avertissement de streaming',
    });
    engine.dispose();
  });

  it('indexe, charge et décharge les galaxies tuilées sans appel métier', async () => {
    installNearbyUniverseAssets();
    const engine = createTestEngine();
    const access = engine as unknown as EngineAccess;
    const events: UniverseEngineEvent[] = [];

    expect(engine.getStellarObservationCatalog(100)).toEqual([]);
    expect(engine.getStellarObservationConstellations()).toEqual([]);
    engine.subscribe((event) => events.push(event));
    await engine.initialize(sizedContainer(960, 540), { quality: 'low' });
    const setLabelObjects = vi.spyOn(access.labelManager!, 'setObjects');
    const baseRegistry = access.objectRuntime.primaryRegistry;

    expect(engine.allObjects.map((object) => object.id)).toEqual(['nearby-universe']);
    expect(engine.hasObject('galaxy-a')).toBe(true);
    expect(
      access.universeScene?.spaceRoot.getObjectByName('observed-nearby-galaxy-overview'),
    ).toBeInstanceOf(THREE.Points);
    expect(events.find((event) => event.type === 'data-ready')).toMatchObject({
      catalogEntries: [
        expect.objectContaining({ id: 'galaxy-a' }),
        expect.objectContaining({ id: 'galaxy-b' }),
      ],
    });

    await engine.setTarget('galaxy-a');
    expect(engine.allObjects.map((object) => object.id)).toEqual(['nearby-universe', 'galaxy-a']);
    expect(access.streamingRuntime.coordinator?.stats.loadedTiles).toBe(1);
    expect(setLabelObjects).toHaveBeenCalled();
    expect(events.filter((event) => event.type === 'data-ready')).toHaveLength(1);
    expect(access.objectRuntime.primaryRegistry).toBe(baseRegistry);
    expect(
      (
        access.objectRuntime.streamedRegistry as unknown as {
          has(objectId: string): boolean;
        } | null
      )?.has('galaxy-a'),
    ).toBe(true);

    await access.streamingRuntime.coordinator?.ensureObject('galaxy-b');
    expect(access.streamingRuntime.coordinator?.stats.loadedTiles).toBe(2);
    expect(engine.allObjects.map((object) => object.id)).toEqual([
      'nearby-universe',
      'galaxy-a',
      'galaxy-b',
    ]);
    expect(events.filter((event) => event.type === 'data-ready')).toHaveLength(1);
    expect(access.objectRuntime.primaryRegistry).toBe(baseRegistry);
    expect(
      (
        access.objectRuntime.streamedRegistry as unknown as {
          has(objectId: string): boolean;
        } | null
      )?.has('galaxy-b'),
    ).toBe(true);

    access.targetId = 'nearby-universe';
    access.selectedId = null;
    access.streamingRuntime.coordinator?.update(
      {
        camera: access.camera!,
        viewportHeight: 540,
        lodLevel: 4,
        quality: 'low',
        worldOffset: access.universeScene!.spaceRoot.position,
        transitioning: false,
        targetId: access.targetId,
        selectedId: access.selectedId,
      },
      0,
    );
    await vi.waitFor(() => expect(access.streamingRuntime.coordinator?.stats.loadedTiles).toBe(0));
    expect(engine.allObjects.map((object) => object.id)).toEqual(['nearby-universe']);
    expect(events.filter((event) => event.type === 'data-ready')).toHaveLength(1);
    expect(access.objectRuntime.primaryRegistry).toBe(baseRegistry);
    expect(access.objectRuntime.streamedRegistry).toBeNull();
    engine.dispose();
  });

  it('ignore une tuile terminée après la destruction logique du moteur', async () => {
    installNearbyUniverseAssets();
    const engine = createTestEngine();
    const access = engine as unknown as EngineAccess;
    const events: UniverseEngineEvent[] = [];

    engine.subscribe((event) => events.push(event));
    await engine.initialize(sizedContainer(960, 540), { quality: 'low' });
    let resolveLoad!: (loaded: boolean) => void;
    const pendingLoad = new Promise<boolean>((resolve) => {
      resolveLoad = resolve;
    });

    vi.spyOn(access.streamingRuntime.coordinator!, 'ensureObject').mockReturnValue(pendingLoad);
    const targeting = engine.setTarget('galaxy-a');

    access.objectRuntime.replacePrimary(null);
    access.initialized = false;
    resolveLoad(true);

    await expect(targeting).rejects.toThrow('Position indisponible pour galaxy-a');
    expect(engine.allObjects.map((object) => object.id)).toEqual(['nearby-universe']);
    expect(events.at(-1)).toEqual({ type: 'loading-state', loading: false });
    engine.dispose();
  });

  it('branche le catalogue dense et tous les adaptateurs entre contrôles et moteur', async () => {
    const sun: SpaceObject = {
      ...object('sun', 'Soleil', 'star', 'milky-way'),
      referenceFrame: 'galactic',
      positionProvider: {
        type: 'static',
        position: [8.178, 0, 0],
        unit: 'kiloparsec',
      },
    };

    installAssets([object('milky-way', 'Voie lactée', 'galaxy'), sun], {
      binaryBuffer: starCatalogBuffer(),
      starTileSource: true,
    });
    const engine = createTestEngine();
    const access = engine as unknown as EngineAccess;
    const events: UniverseEngineEvent[] = [];

    engine.subscribe((event) => events.push(event));
    await engine.initialize(sizedContainer(960, 540), { quality: 'low' });
    expect(engine.getStellarObservationCatalog(100)).toEqual([
      expect.objectContaining({ id: 'hyg-3229' }),
    ]);
    expect(access.streamingRuntime.coordinator).not.toBeNull();
    const stellarRoot = access.universeScene?.spaceRoot.getObjectByName(
      'solar-neighborhood-reference',
    );
    const sunPosition = access.universeScene?.spaceRoot.getObjectByName('sun')?.position;

    expect(stellarRoot?.position.x).toBeGreaterThan(2_000);
    expect(stellarRoot?.position.toArray()).toEqual(sunPosition?.toArray());

    const setStarClusterTiles = vi.spyOn(access.universeScene!, 'setStarClusterTiles');
    const fetchMock = vi.mocked(fetch);

    access.camera!.position.copy(stellarRoot!.position).add(new THREE.Vector3(0, 0, 500));
    access.camera!.lookAt(stellarRoot!.position);
    access.camera!.updateMatrixWorld();
    access.streamingRuntime.coordinator!.update(
      {
        camera: access.camera!,
        viewportHeight: 540,
        lodLevel: 4,
        quality: 'high',
        worldOffset: access.universeScene!.spaceRoot.position,
        transitioning: false,
        targetId: null,
        selectedId: null,
      },
      0,
    );
    expect(setStarClusterTiles).not.toHaveBeenCalled();
    expect(fetchMock.mock.calls.some(([url]) => String(url).startsWith('/data/stars/tiles/'))).toBe(
      false,
    );
    expect(access.streamingRuntime.coordinator?.stats).toMatchObject({
      activeStarTiles: 0,
      cachedStarPacks: 0,
      cachedStarTiles: 0,
      activeStarClusters: 0,
      cachedStarClusters: 0,
    });

    const selection = access.selectionManager as unknown as {
      getPickables(): readonly THREE.Object3D[];
      getLabelObjectAt(clientX: number, clientY: number): string | null;
      callback(objectId: string | null, focusRequested: boolean): void;
      navigationIntentCallback(objectId: string | null): void;
      getReferenceDistance(): number;
      isBackgroundObject(objectId: string): boolean;
      isWheelNavigationObject(objectId: string): boolean;
      labelHoverCallback(objectId: string | null): void;
      semanticZoomCallback(
        objectId: string | null,
        deltaY: number,
        pointer: { x: number; y: number },
      ): void;
    };
    const controller = access.cameraController as unknown as {
      onCameraSettled(distance: number, source: 'interaction'): void;
      distanceToTarget: number;
    };
    const loop = access.renderLoop as unknown as {
      callback(deltaSeconds: number, elapsedSeconds: number): void;
    };
    const initializedServices = {
      registry: access.objectRuntime.primaryRegistry,
      scene: access.universeScene,
      labels: access.labelManager,
      controller: access.cameraController,
      catalogRuntime: access.catalogRuntime,
    };
    const handlePick = vi.spyOn(access, 'handlePick').mockImplementation(() => undefined);
    const handleNavigation = vi
      .spyOn(access, 'handleNavigationIntent')
      .mockImplementation(() => undefined);
    const handleSemanticZoom = vi
      .spyOn(access, 'handleSemanticZoomIntent')
      .mockImplementation(() => undefined);
    const renderFrame = vi.spyOn(access, 'renderFrame').mockImplementation(() => undefined);
    const labelManager = access.labelManager as unknown as {
      hitTest(clientX: number, clientY: number): string | null;
      isObjectVisible(objectId: string): boolean;
      setHoveredObject(objectId: string | null): void;
    };
    const hover = vi.spyOn(labelManager, 'setHoveredObject');

    expect(selection.getPickables().length).toBeGreaterThan(0);
    expect(selection.getLabelObjectAt(10, 20)).toBeNull();
    expect(labelManager.isObjectVisible('hyg-3229')).toBe(true);
    expect(typeof labelManager.isObjectVisible('milky-way')).toBe('boolean');
    selection.callback('hyg-3229', true);
    selection.navigationIntentCallback('hyg-3229');
    expect(selection.getReferenceDistance()).toBeGreaterThan(0);
    expect(selection.isBackgroundObject('hyg-3229')).toBe(true);
    expect(selection.isBackgroundObject('milky-way')).toBe(true);
    expect(selection.isBackgroundObject('unknown')).toBe(false);
    expect(selection.isWheelNavigationObject('milky-way')).toBe(true);
    expect(selection.isWheelNavigationObject('hyg-3229')).toBe(false);
    selection.labelHoverCallback('hyg-3229');
    selection.semanticZoomCallback('hyg-3229', -120, { x: 0.25, y: -0.5 });
    controller.onCameraSettled(42, 'interaction');
    loop.callback(0.02, 0.02);

    expect(handlePick).toHaveBeenCalledWith('hyg-3229', true);
    expect(handleNavigation).toHaveBeenCalledWith('hyg-3229');
    expect(handleSemanticZoom).toHaveBeenCalledWith('hyg-3229', -120, {
      x: 0.25,
      y: -0.5,
    });
    expect(hover).toHaveBeenCalledWith('hyg-3229');
    expect(renderFrame).toHaveBeenCalledWith(0.02);
    expect(events).toContainEqual({ type: 'camera-changed', zoom: 42 });
    expect(events.find((event) => event.type === 'data-ready')).toMatchObject({
      catalogEntries: [expect.objectContaining({ id: 'hyg-3229', name: 'Sirius' })],
    });

    access.objectRuntime.replacePrimary(null);
    access.universeScene = null;
    access.labelManager = null;
    access.cameraController = null;
    access.catalogRuntime = null;
    expect(selection.getPickables()).toEqual([]);
    expect(selection.getLabelObjectAt(10, 20)).toBeNull();
    expect(selection.getReferenceDistance()).toBe(1);
    expect(selection.isBackgroundObject('unknown')).toBe(false);
    expect(selection.isWheelNavigationObject('milky-way')).toBe(false);
    selection.labelHoverCallback(null);

    access.objectRuntime.replacePrimary(initializedServices.registry);
    access.universeScene = initializedServices.scene;
    access.labelManager = initializedServices.labels;
    access.cameraController = initializedServices.controller;
    access.catalogRuntime = initializedServices.catalogRuntime;
    engine.dispose();
  });

  it('ignore la source agrégée inactive sans requête ni avertissement', async () => {
    installAssets([], {
      binaryBuffer: starCatalogBuffer(),
      starTileSource: true,
    });
    const engine = createTestEngine();
    const access = engine as unknown as EngineAccess;
    const events: UniverseEngineEvent[] = [];

    engine.subscribe((event) => events.push(event));
    await engine.initialize(sizedContainer(960, 540), { quality: 'low' });
    access.streamingRuntime.coordinator!.update(
      {
        camera: access.camera!,
        viewportHeight: 540,
        lodLevel: 4,
        quality: 'low',
        worldOffset: access.universeScene!.spaceRoot.position,
        transitioning: false,
        targetId: null,
        selectedId: null,
      },
      0,
    );

    expect(
      vi.mocked(fetch).mock.calls.some(([url]) => String(url).startsWith('/data/stars/tiles/')),
    ).toBe(false);
    expect(events.filter((event) => event.type === 'performance-warning')).toEqual([]);
    expect(access.streamingRuntime.coordinator?.stats).toMatchObject({
      activeStarTiles: 0,
      cachedStarPacks: 0,
      cachedStarTiles: 0,
      activeStarClusters: 0,
      cachedStarClusters: 0,
    });
    engine.dispose();
  });

  it('branche Cosmicflows-4 à la recherche, la sélection et la navigation cosmique', async () => {
    const cosmicWeb = {
      ...object('cosmic-web', 'Réseau cosmique', 'universe'),
      referenceFrame: 'cosmic-web' as const,
    };

    installAssets([cosmicWeb], { cosmicGroupBuffer: cosmicGroupCatalogBuffer(42) });
    const engine = createTestEngine();
    const access = engine as unknown as EngineAccess;
    const events: UniverseEngineEvent[] = [];

    engine.subscribe((event) => events.push(event));
    await engine.initialize(sizedContainer(960, 540), { quality: 'low' });

    expect(engine.hasObject('cf4-pgc-42')).toBe(false);
    await expect(engine.ensureObjectAvailable('cf4-pgc-42')).resolves.toBe(true);
    expect(engine.hasObject('cf4-pgc-42')).toBe(true);
    expect(events.filter((event) => event.type === 'data-ready').at(-1)).toMatchObject({
      catalogEntries: [
        expect.objectContaining({
          id: 'cf4-pgc-42',
          name: 'Groupe PGC 42',
          parentName: 'Réseau cosmique',
        }),
      ],
    });
    expect(
      access.universeScene?.spaceRoot.getObjectByName('calculated-cosmicflows4-groups'),
    ).toBeInstanceOf(THREE.Points);

    engine.selectObject('cf4-pgc-42');
    expect(events).toContainEqual({
      type: 'object-selected',
      objectId: 'cf4-pgc-42',
      object: expect.objectContaining({
        type: 'galaxy-cluster',
        scientificConfidence: 'calculated',
      }),
    });

    await engine.setTarget('cf4-pgc-42');
    expect(events).toContainEqual({ type: 'target-changed', objectId: 'cf4-pgc-42' });
    (access.cameraController as unknown as { update(deltaSeconds: number): void }).update(10);
    expect(access.cameraController?.distanceToTarget).toBeGreaterThan(200_000);
    engine.dispose();
  });

  it('branche le catalogue NASA, puis matérialise un seul système exoplanétaire à la demande', async () => {
    installAssets([], {
      exoplanetBuffer: exoplanetCatalogBuffer(),
      exoplanetMetadata: exoplanetCatalogMetadata(),
    });
    const engine = createTestEngine();
    const access = engine as unknown as EngineAccess;
    const events: UniverseEngineEvent[] = [];
    const hostId = createNasaCatalogObjectId('host', 'Test Host');
    const planetId = createNasaCatalogObjectId('planet', 'Test Host b');

    engine.subscribe((event) => events.push(event));
    await engine.initialize(sizedContainer(960, 540), { quality: 'low' });

    expect(engine.hasObject(hostId)).toBe(false);
    await expect(engine.ensureObjectAvailable(planetId)).resolves.toBe(true);
    expect(engine.hasObject(hostId)).toBe(true);
    expect(engine.hasObject(planetId)).toBe(true);
    expect(access.objectRuntime.exoplanetSystemRegistry).toBeNull();
    expect(events.filter((event) => event.type === 'data-ready').at(-1)).toMatchObject({
      catalogEntries: [
        expect.objectContaining({ id: hostId, name: 'Test Host' }),
        expect.objectContaining({
          id: planetId,
          name: 'Test Host b',
          metadata: expect.objectContaining({ discoveryMethod: 'Transit' }),
        }),
      ],
    });
    expect(
      access.universeScene?.spaceRoot.getObjectByName('observed-nasa-exoplanet-hosts'),
    ).toBeInstanceOf(THREE.Points);

    engine.setTime({ julianDay: 2_451_545 });
    await engine.setTarget(planetId);
    expect(access.objectRuntime.exoplanetSystemRegistry?.has(hostId)).toBe(true);
    expect(access.objectRuntime.exoplanetSystemRegistry?.has(planetId)).toBe(true);
    expect(access.streamingRuntime.activeExoplanetSystemObjects).toHaveLength(2);
    expect(engine.allObjects.map(({ id }) => id)).toEqual([hostId, planetId]);
    expect(events).toContainEqual({
      type: 'object-selected',
      objectId: planetId,
      object: expect.objectContaining({ type: 'exoplanet', parentId: hostId }),
    });
    expect(() => engine.viewOrbit(planetId)).not.toThrow();
    const positionBefore = access.objectRuntime.exoplanetSystemRegistry
      ?.getWorldPosition(planetId)
      ?.clone();

    engine.setTime({ julianDay: 2_451_550 });
    const positionAfter = access.objectRuntime.exoplanetSystemRegistry?.getWorldPosition(planetId);

    expect(positionBefore?.distanceTo(positionAfter!)).toBeGreaterThan(0.1);

    await engine.setTarget(hostId);
    access.rebuildObjectRegistry();
    expect(access.objectRuntime.exoplanetSystemRegistry?.has(hostId)).toBe(true);
    access.objectRuntime.setNavigationTarget('missing');
    access.objectRuntime.select('missing');

    const container = access.container;
    const canvas = access.renderer!.domElement;

    Object.defineProperties(canvas, {
      clientWidth: { configurable: true, value: 960 },
      clientHeight: { configurable: true, value: 540 },
    });
    access.container = null;
    expect(() => access.renderFrame(0.016)).not.toThrow();
    access.container = container;
    engine.dispose();
  });

  it('conserve la sélection détaillée lorsqu’une exoplanète locale est aussi liée au catalogue NASA', async () => {
    const host = {
      ...object('test-host', 'Test Host', 'star'),
      referenceFrame: 'stellar' as const,
      scientificConfidence: 'observed' as const,
      metadata: {
        sourceTable: 'PSCompPars',
        exoplanetHost: true,
      },
      positionProvider: {
        type: 'static' as const,
        position: [10, 0, 0] as const,
        unit: 'parsec' as const,
      },
    } satisfies SpaceObject;
    const planet = {
      ...object('test-host-b', 'Test Host b', 'exoplanet', host.id),
      referenceFrame: 'stellar' as const,
      scientificConfidence: 'observed' as const,
      metadata: { sourceTable: 'PSCompPars' },
      positionProvider: {
        type: 'illustrative-orbit' as const,
        semiMajorAxis: 0.2,
        orbitalPeriodDays: 20,
        epochJulianDay: 2_451_545,
        visualPhaseAtEpochDegrees: 0,
        visualInclinationDegrees: 0,
        unit: 'astronomical-unit' as const,
      },
    } satisfies SpaceObject;

    installAssets([host, planet], {
      exoplanetBuffer: exoplanetCatalogBuffer(),
      exoplanetMetadata: exoplanetCatalogMetadata(),
    });
    const engine = createTestEngine();
    const access = engine as unknown as EngineAccess;

    await engine.initialize(sizedContainer(960, 540), { quality: 'high' });
    expect(access.objectRuntime.exoplanetSystemRegistry).toBeNull();
    await engine.ensureObjectAvailable(createNasaCatalogObjectId('host', 'Test Host'));

    const baseRegistry = access.objectRuntime.primaryRegistry as unknown as {
      selectedId: string | null;
      updateLod(
        camera: THREE.PerspectiveCamera,
        viewportHeight: number,
        lodLevel: number,
        deltaSeconds: number,
      ): void;
      registryRoot: THREE.Group;
    };

    baseRegistry.updateLod(access.camera!, 540, 0, 0);
    engine.viewOrbit(planet.id);

    expect(baseRegistry.selectedId).toBe(planet.id);
    expect(
      baseRegistry.registryRoot.getObjectByName(`${planet.id}-orbit`)?.userData['active'],
    ).toBe(true);
    const catalogBatch = access.universeScene?.spaceRoot.getObjectByName(
      'observed-nasa-exoplanet-hosts',
    ) as THREE.Points | undefined;

    expect(catalogBatch).toBeInstanceOf(THREE.Points);
    expect(catalogBatch?.userData['catalogCount']).toBe(1);
    expect(catalogBatch?.userData['renderedHostCount']).toBe(0);
    engine.dispose();
  });

  it('installe le volume simulé du réseau cosmique depuis les données statiques', async () => {
    installAssets([], { cosmicWebVolumeBuffer: cosmicWebVolumeBuffer() });
    const engine = createTestEngine();
    const access = engine as unknown as EngineAccess;

    await engine.initialize(sizedContainer(960, 540), { quality: 'high' });
    await engine.ensureObjectAvailable('catalogue-cosmique');
    const volumeMesh = access.universeScene?.spaceRoot.getObjectByName(
      'simulated-cosmic-web-volume',
    ) as THREE.Mesh<THREE.BoxGeometry, THREE.ShaderMaterial> | undefined;

    expect(volumeMesh).toBeInstanceOf(THREE.Mesh);
    expect(volumeMesh?.userData).toMatchObject({
      scientificConfidence: 'simulated',
      volumeResolution: 4,
      quality: 'high',
    });
    engine.dispose();
  });

  it('attend les catalogues visuels lorsqu’une grande échelle statique est ciblée', async () => {
    installAssets([object('local-group', 'Groupe local', 'region')], {
      cosmicGroupBuffer: cosmicGroupCatalogBuffer(42),
    });
    const engine = createTestEngine();
    const access = engine as unknown as EngineAccess;

    await engine.initialize(sizedContainer(960, 540), { quality: 'high' });
    expect(access.catalogRuntime?.cosmicGroupCatalogRegistry).toBeNull();

    await expect(engine.ensureObjectAvailable('local-group')).resolves.toBe(true);

    expect(access.catalogRuntime?.cosmicGroupCatalogRegistry).toBeInstanceOf(
      CosmicGroupCatalogRegistry,
    );
    engine.dispose();
  });

  it('branche les structures documentées à la recherche, la sélection et la navigation', async () => {
    const cosmicWeb = {
      ...object('cosmic-web', 'Réseau cosmique', 'universe'),
      referenceFrame: 'cosmic-web' as const,
    };

    installAssets([cosmicWeb], {
      cosmicStructureBuffer: cosmicStructureCatalogBuffer(),
      cosmicStructureMetadata: testCosmicStructureMetadata(),
    });
    const engine = createTestEngine();
    const access = engine as unknown as EngineAccess;
    const events: UniverseEngineEvent[] = [];

    engine.subscribe((event) => events.push(event));
    await engine.initialize(sizedContainer(960, 540), { quality: 'low' });

    const structureId = 'lss-sdss-main50-239-027-0091';

    expect(engine.hasObject(structureId)).toBe(false);
    await expect(engine.ensureObjectAvailable(structureId)).resolves.toBe(true);
    expect(engine.hasObject(structureId)).toBe(true);
    expect(events.filter((event) => event.type === 'data-ready').at(-1)).toMatchObject({
      catalogEntries: [
        expect.objectContaining({
          id: structureId,
          name: 'Superamas SDSS 239+027+0091',
          parentName: 'Réseau cosmique · SDSS superclusters',
        }),
      ],
    });
    expect(
      access.universeScene?.spaceRoot.getObjectByName('calculated-cosmic-structure-symbols'),
    ).toBeInstanceOf(THREE.Points);

    engine.selectObject(structureId);
    expect(events).toContainEqual({
      type: 'object-selected',
      objectId: structureId,
      object: expect.objectContaining({
        type: 'supercluster',
        scientificConfidence: 'calculated',
      }),
    });

    await engine.setTarget(structureId);
    expect(events).toContainEqual({ type: 'target-changed', objectId: structureId });
    (access.cameraController as unknown as { update(deltaSeconds: number): void }).update(10);
    expect(access.cameraController?.distanceToTarget).toBeGreaterThan(1_000);
    engine.dispose();
  });

  it('charge les épines Tempel à la demande puis conserve une seule requête', async () => {
    const cosmicWeb = {
      ...object('cosmic-web', 'Réseau cosmique', 'universe'),
      referenceFrame: 'cosmic-web' as const,
    };

    installAssets([cosmicWeb], {
      cosmicStructureBuffer: tempelCosmicStructureCatalogBuffer(),
      cosmicStructureMetadata: testTempelCosmicStructureMetadata(),
      tempelSpineBuffer: tempelSpineCatalogBuffer(),
    });
    const fetchMock = vi.mocked(fetch);
    const engine = createTestEngine();
    const access = engine as unknown as EngineAccess;
    const events: UniverseEngineEvent[] = [];

    engine.subscribe((event) => events.push(event));
    await engine.initialize(sizedContainer(960, 540), { quality: 'high' });
    await engine.ensureObjectAvailable('lss-sdss-dr8-tempel-filaments-f1');
    events.length = 0;
    expect(fetchMock).not.toHaveBeenCalledWith('/data/tempel-spines.bin');
    expect(access.universeScene?.tempelFilamentSpineCount).toBe(0);

    engine.setCosmicMapLayers({
      volume: true,
      groups: true,
      links: true,
      clusters: true,
      superclusters: true,
      filaments: true,
      voids: false,
    });
    await Promise.resolve();
    expect(fetchMock).not.toHaveBeenCalledWith('/data/tempel-spines.bin');
    expect(access.universeScene?.tempelFilamentSpineCount).toBe(0);

    access.camera?.position.set(120_000, 0, 0);
    access.cameraController?.controls.target.set(0, 0, 0);
    access.renderFrame(0.05);
    await vi.waitFor(() => {
      expect(
        fetchMock.mock.calls.filter(([url]) => url === '/data/tempel-spines.bin'),
      ).toHaveLength(1);
    });
    expect(access.universeScene?.tempelFilamentSpineCount).toBe(0);

    access.camera?.position.set(420_000, 0, 0);
    access.cameraController?.controls.target.set(0, 0, 0);
    access.renderFrame(0.05);
    await vi.waitFor(() => {
      expect(access.universeScene?.tempelFilamentSpineCount).toBe(1);
    });
    expect(access.universeScene?.tempelFilamentSpinePointCount).toBe(2);
    expect(access.universeScene?.tempelFilamentSpineSegmentCount).toBe(1);
    expect(fetchMock.mock.calls.filter(([url]) => url === '/data/tempel-spines.bin')).toHaveLength(
      1,
    );

    engine.setCosmicMapLayers({
      volume: true,
      groups: true,
      links: true,
      clusters: true,
      superclusters: true,
      filaments: true,
      voids: false,
    });
    await access.ensureTempelFilamentSpines();
    expect(fetchMock.mock.calls.filter(([url]) => url === '/data/tempel-spines.bin')).toHaveLength(
      1,
    );
    expect(events.filter((event) => event.type === 'loading-state')).toEqual([]);

    engine.selectObject('lss-sdss-dr8-tempel-filaments-f1');
    expect(
      access.universeScene?.spaceRoot.getObjectByName('selected-tempel-filament-spine')?.userData[
        'objectId'
      ],
    ).toBe('lss-sdss-dr8-tempel-filaments-f1');
    await engine.setTarget('lss-sdss-dr8-tempel-filaments-f1');
    engine.dispose();
  });

  it('signale une épine Tempel indisponible une seule fois sans casser la carte', async () => {
    installAssets([], {
      cosmicStructureBuffer: tempelCosmicStructureCatalogBuffer(),
      cosmicStructureMetadata: testTempelCosmicStructureMetadata(),
      tempelSpineStatus: 503,
    });
    const engine = createTestEngine();
    const access = engine as unknown as EngineAccess;
    const events: UniverseEngineEvent[] = [];

    engine.subscribe((event) => events.push(event));
    await engine.initialize(sizedContainer(960, 540));
    await engine.ensureObjectAvailable('lss-sdss-dr8-tempel-filaments-f1');
    engine.setCosmicMapLayers({
      volume: true,
      groups: true,
      links: true,
      clusters: true,
      superclusters: true,
      filaments: true,
      voids: false,
    });
    access.camera?.position.set(420_000, 0, 0);
    access.cameraController?.controls.target.set(0, 0, 0);
    access.renderFrame(0.05);
    await access.ensureTempelFilamentSpines();
    engine.setCosmicMapLayers({
      volume: true,
      groups: true,
      links: true,
      clusters: true,
      superclusters: true,
      filaments: true,
      voids: false,
    });
    await access.ensureTempelFilamentSpines();

    expect(
      events.filter(
        (event) => event.type === 'performance-warning' && event.message.includes('Épines Tempel'),
      ),
    ).toEqual([
      {
        type: 'performance-warning',
        message:
          'Épines Tempel indisponibles : Impossible de charger tempel-filament-spines (503).',
      },
    ]);
    engine.dispose();
  });

  it('ignore un catalogue Tempel qui termine après la destruction du moteur', async () => {
    const runtime = createRuntime();
    const pendingBuffer = deferredValue<ArrayBuffer>();
    const fetchMock = vi.fn(async () => ({
      ok: true,
      status: 200,
      arrayBuffer: () => pendingBuffer.promise,
    }));

    vi.stubGlobal('fetch', fetchMock);
    runtime.catalog.tempelFilamentSpineSource = {
      id: 'tempel-spines',
      url: '/tempel-spines.bin',
    };
    runtime.catalog.cosmicStructureCatalogRegistry = { has: () => true };
    const loading = runtime.access.ensureTempelFilamentSpines();

    await vi.waitFor(() => expect(fetchMock).toHaveBeenCalledOnce());
    runtime.engine.dispose();
    pendingBuffer.resolve(tempelSpineCatalogBuffer());
    await loading;

    expect(runtime.scene.setTempelFilamentSpineCatalog).not.toHaveBeenCalled();
  });

  it('ignore le chargement Tempel tant que sa source statique est absente', async () => {
    const fetchMock = vi.fn();

    vi.stubGlobal('fetch', fetchMock);
    const runtime = createRuntime();

    runtime.catalog.tempelFilamentSpineSource = null;
    await runtime.access.ensureTempelFilamentSpines();

    expect(fetchMock).not.toHaveBeenCalled();
    expect(runtime.scene.setTempelFilamentSpineCatalog).not.toHaveBeenCalled();
  });

  it('nettoie une scène détruite pendant l’installation différée des épines', async () => {
    const runtime = createRuntime();
    const installation = deferredValue<void>();

    vi.stubGlobal(
      'fetch',
      vi.fn(async () => successfulBinaryResponse(tempelSpineCatalogBuffer())),
    );
    runtime.catalog.tempelFilamentSpineSource = {
      id: 'tempel-spines',
      url: '/tempel-spines.bin',
    };
    runtime.catalog.cosmicStructureCatalogRegistry = { has: () => true };
    runtime.scene.setTempelFilamentSpineCatalog.mockImplementation(() => installation.promise);
    const loading = runtime.access.ensureTempelFilamentSpines();

    await vi.waitFor(() =>
      expect(runtime.scene.setTempelFilamentSpineCatalog).toHaveBeenCalledOnce(),
    );
    runtime.access.initialized = false;
    runtime.access.universeScene = null;
    installation.resolve();
    await loading;

    expect(runtime.scene.dispose).toHaveBeenCalledOnce();
    runtime.engine.dispose();
  });

  it('normalise une erreur Tempel non standard', async () => {
    const first = createRuntime();
    const firstEvents: UniverseEngineEvent[] = [];

    vi.stubGlobal(
      'fetch',
      vi.fn(async () => ({
        ok: true,
        status: 200,
        arrayBuffer: async () => Promise.reject('échec brut'),
      })),
    );
    first.catalog.tempelFilamentSpineSource = { id: 'tempel-spines', url: '/spines.bin' };
    first.catalog.cosmicStructureCatalogRegistry = { has: () => true };
    first.engine.subscribe((event) => firstEvents.push(event));
    await first.access.ensureTempelFilamentSpines();
    expect(firstEvents).toContainEqual({
      type: 'performance-warning',
      message: 'Épines Tempel indisponibles : erreur inconnue',
    });
    first.engine.dispose();
  });

  it('branche le catalogue illustratif des constellations sur le batch stellaire', async () => {
    installAssets([object('milky-way', 'Voie lactée', 'galaxy')], {
      binaryBuffer: starCatalogBuffer([3_229, 6_960]),
      constellationCatalog: testConstellationCatalog(),
    });
    const engine = createTestEngine();
    const access = engine as unknown as EngineAccess;
    const events: UniverseEngineEvent[] = [];

    engine.subscribe((event) => events.push(event));
    await engine.initialize(sizedContainer(960, 540), {
      quality: 'low',
      showConstellations: true,
    });

    const lines = access.universeScene?.spaceRoot.getObjectByName(
      'illustrative-constellation-lines',
    );

    expect(lines).toBeInstanceOf(THREE.LineSegments);
    expect(lines?.userData['segmentCount']).toBe(1);
    expect(engine.getStellarObservationConstellations()).toEqual([
      expect.objectContaining({
        id: 'constellation-orion',
        segments: [
          {
            from: expect.objectContaining({ id: 'hyg-3229' }),
            to: expect.objectContaining({ id: 'hyg-6960' }),
          },
        ],
      }),
    ]);
    const labelManager = access.labelManager as unknown as {
      isObjectVisible(objectId: string): boolean;
    };
    const selection = access.selectionManager as unknown as {
      isBackgroundObject(objectId: string): boolean;
    };

    expect(labelManager.isObjectVisible('constellation-orion')).toBe(true);
    expect(selection.isBackgroundObject('constellation-orion')).toBe(true);
    engine.setDisplayOptions({
      showOrbits: true,
      showConstellations: false,
      showLabels: true,
      quality: 'low',
      labelDensity: 'balanced',
      temporalMode: 'state',
    });
    expect(labelManager.isObjectVisible('constellation-orion')).toBe(false);
    expect(engine.hasObject('constellation-orion')).toBe(true);
    expect(engine.allObjects).toContainEqual(
      expect.objectContaining({
        id: 'constellation-orion',
        type: 'region',
        scientificConfidence: 'illustrative',
      }),
    );
    expect(events.find((event) => event.type === 'data-ready')).toMatchObject({
      objects: [expect.anything(), expect.objectContaining({ id: 'constellation-orion' })],
    });

    await engine.setTarget('constellation-orion');
    expect(events).toContainEqual({
      type: 'target-changed',
      objectId: 'constellation-orion',
    });
    expect(
      access.universeScene?.spaceRoot.getObjectByName('highlighted-constellation-lines')?.userData[
        'objectId'
      ],
    ).toBe('constellation-orion');
    engine.dispose();
  });

  it.each([
    [() => Promise.resolve(failedResponse(503)), 'Impossible de charger le manifest (503).'],
    [() => Promise.reject('échec brut'), 'Erreur inconnue du moteur 3D.'],
  ])('publie puis relaie une erreur d’initialisation', async (manifestResponse, expected) => {
    const fetchMock = vi.fn(manifestResponse);

    vi.stubGlobal('fetch', fetchMock);
    const engine = createTestEngine();
    const events: UniverseEngineEvent[] = [];

    engine.subscribe((event) => events.push(event));

    await expect(engine.initialize(sizedContainer(320, 180))).rejects.toBeDefined();
    expect(events).toContainEqual({ type: 'error', message: expected });
    expect(events.at(-1)).toEqual({ type: 'loading-state', loading: false });
  });

  it('expose ses valeurs temporelles, sa qualité recommandée et ses collections initiales', () => {
    const engine = new UniverseEngine();

    expect(Number.isFinite(engine.currentTime.julianDay)).toBe(true);
    expect(engine.isPlaying).toBe(false);
    expect(engine.timeSpeed).toBe(1);
    expect(engine.cameraDistance).toBe(0);
    expect(engine.cameraTransitioning).toBe(false);
    expect(engine.adaptiveRenderingStats).toMatchObject({
      status: 'warming',
      targetPixelRatio: 1,
      currentPixelRatio: 1,
    });
    expect(engine.allObjects).toEqual([]);
    expect(engine.hasObject('earth')).toBe(false);
    expect(engine.getObjectAdornmentDiagnostics('earth')).toBeNull();
    expect(engine.getObjectVisualDiagnostics('earth')).toBeNull();
    expect(['low', 'medium', 'high']).toContain(engine.recommendedQuality);
  });

  it('expose les ornements actifs par un diagnostic public stable', () => {
    const runtime = createRuntime();

    expect(runtime.engine.getObjectAdornmentDiagnostics('earth')).toEqual(
      objectAdornmentDiagnostics(),
    );
    expect(runtime.engine.getObjectVisualDiagnostics('earth')).toEqual(objectVisualDiagnostics());
    runtime.engine.dispose();
  });

  it('protège le démarrage puis délègue start, stop et resize', () => {
    const uninitialized = createTestEngine();

    expect(() => uninitialized.start()).toThrow('doit être initialisé');
    uninitialized.stop();
    uninitialized.resize(100, 100);

    const runtime = createRuntime();

    runtime.engine.start();
    runtime.engine.stop();
    runtime.engine.resize(0, 100);
    runtime.engine.resize(100, 0);
    runtime.engine.resize(800, 400);

    expect(runtime.loop.start).toHaveBeenCalledOnce();
    expect(runtime.loop.stop).toHaveBeenCalledOnce();
    expect(runtime.camera.aspect).toBe(2);
    expect(runtime.renderer.setSize).toHaveBeenCalledWith(800, 400, false);
    expect(runtime.labels.resize).toHaveBeenCalledWith(800, 400);
  });

  it('libère aussi bien une instance vide qu’une instance complètement équipée', () => {
    const empty = createTestEngine();

    empty.dispose();

    const runtime = createRuntime();
    const listener = vi.fn();

    runtime.engine.subscribe(listener);
    runtime.engine.dispose();

    expect(runtime.loop.stop).toHaveBeenCalledOnce();
    expect(runtime.selection.dispose).toHaveBeenCalledOnce();
    expect(runtime.controller.dispose).toHaveBeenCalledOnce();
    expect(runtime.labels.dispose).toHaveBeenCalledOnce();
    expect(runtime.registry.dispose).toHaveBeenCalledOnce();
    expect(runtime.scene.dispose).toHaveBeenCalledOnce();
    expect(runtime.renderer.renderLists.dispose).toHaveBeenCalledOnce();
    expect(runtime.renderer.dispose).toHaveBeenCalledOnce();
    expect(runtime.engine.allObjects).toEqual([]);
    expect(runtime.engine.cameraDistance).toBe(0);
  });

  it('met à jour le temps, les rotations et la cible suivie', () => {
    const runtime = createRuntime();
    const events: UniverseEngineEvent[] = [];
    const time = { julianDay: 2_451_545 };

    runtime.access.targetId = 'earth';
    runtime.engine.subscribe((event) => events.push(event));
    runtime.engine.setTime(time);
    runtime.engine.setPlaying(true);
    runtime.engine.setTimeSpeed(30);

    expect(runtime.registry.updatePositions).toHaveBeenCalledWith(time);
    expect(runtime.registry.updateBodyRotations).toHaveBeenCalledWith(time);
    expect(runtime.controller.follow).toHaveBeenCalled();
    expect(events).toContainEqual({ type: 'time-changed', time });
    expect(runtime.engine.isPlaying).toBe(true);
    expect(runtime.engine.timeSpeed).toBe(30);

    runtime.registry.updatePositions.mockReturnValueOnce(undefined);
    runtime.engine.setTime({ julianDay: time.julianDay + 1 });
  });

  it('centre un objet de registre avec un zoom explicite', async () => {
    const runtime = createRuntime();
    const events: UniverseEngineEvent[] = [];

    runtime.engine.subscribe((event) => events.push(event));
    await runtime.engine.setTarget('earth', 12);

    expect(runtime.selection.clearNavigationLock).toHaveBeenCalledOnce();
    expect(runtime.registry.setNavigationTarget).toHaveBeenCalledWith('earth');
    expect(runtime.registry.select).toHaveBeenCalledWith('earth');
    expect(runtime.controller.focusOn).toHaveBeenCalledWith(
      expect.any(THREE.Vector3),
      runtime.definitions.get('earth'),
      12,
    );
    expect(events).toContainEqual({ type: 'target-changed', objectId: 'earth' });

    runtime.engine.completeTargetTransition();
    expect(runtime.controller.completeFocusTransition).toHaveBeenCalledOnce();
  });

  it('prépare une observation terrestre en gardant la cible devant la caméra', async () => {
    const runtime = createRuntime();

    await runtime.engine.prepareEarthObservation('sun');

    expect(runtime.controller.observeFrom).toHaveBeenCalledWith(
      expect.any(THREE.Vector3),
      expect.any(THREE.Vector3),
      undefined,
    );

    const pitchLimits = {
      minimumPitchOffsetDegrees: -8,
      maximumPitchOffsetDegrees: 80,
    };

    const observerFraming = {
      initialPitchOffsetDegrees: 18,
      pitchLimits,
    };

    await runtime.engine.prepareEarthObservation('sun', observerFraming);
    expect(runtime.controller.observeFrom).toHaveBeenLastCalledWith(
      expect.any(THREE.Vector3),
      expect.any(THREE.Vector3),
      observerFraming,
    );
    expect(runtime.registry.select).toHaveBeenCalledWith('sun');
  });

  it('cadre suffisamment près un corps en rotation', async () => {
    const runtime = createRuntime();
    const earth = runtime.definitions.get('earth')!;

    earth.rotation = rotationDefinition('earth', 23.934);
    await runtime.engine.viewRotation('earth');

    expect(runtime.controller.focusOn).toHaveBeenCalledWith(
      expect.any(THREE.Vector3),
      earth,
      expect.any(Number),
    );
    expect(runtime.controller.focusOn.mock.calls.at(-1)?.[2]).toBeLessThan(10);
    expect(runtime.registry.select).toHaveBeenCalledWith('earth');
  });

  it('refuse la vue de rotation pour un objet sans période axiale', async () => {
    const runtime = createRuntime();

    await expect(runtime.engine.viewRotation('earth')).rejects.toThrow('Rotation indisponible');
    await expect(runtime.engine.viewRotation('unknown')).rejects.toThrow('Rotation indisponible');
  });

  it('centre un objet de catalogue avec sa distance dédiée', async () => {
    const runtime = createRuntime();
    const catalogObject = object('hyg-1', 'Sirius', 'star');
    const catalogPosition = new THREE.Vector3(30, 2, -4);

    runtime.catalog.has.mockImplementation((id: string) => id === 'hyg-1');
    runtime.catalog.isCatalogStar.mockImplementation((id: string) => id === 'hyg-1');
    runtime.catalog.getDefinition.mockImplementation((id: string) =>
      id === 'hyg-1' ? catalogObject : undefined,
    );
    runtime.scene.getCatalogWorldPosition.mockImplementation((id: string, target: THREE.Vector3) =>
      id === 'hyg-1' ? target.copy(catalogPosition) : null,
    );

    await runtime.engine.setTarget('hyg-1');

    expect(runtime.registry.setNavigationTarget).toHaveBeenCalledWith(null);
    expect(runtime.scene.selectCatalogObject).toHaveBeenCalledWith('hyg-1');
    expect(runtime.labels.setTransientObject).toHaveBeenCalledWith(catalogObject);
    expect(runtime.controller.focusOnFromDirection).toHaveBeenCalledWith(
      expect.any(THREE.Vector3),
      catalogObject,
      expect.any(THREE.Vector3),
      800,
    );
  });

  it('cadre une constellation depuis son centre visuel sans créer d’objet Three.js dédié', async () => {
    const runtime = createRuntime();
    const constellation = object('constellation-orion', 'Orion', 'region', 'milky-way');
    const position = new THREE.Vector3(320, 80, -40);

    runtime.scene.hasConstellation.mockImplementation(
      (objectId: string) => objectId === constellation.id,
    );
    runtime.scene.getConstellationDefinition.mockImplementation((objectId: string) =>
      objectId === constellation.id ? constellation : undefined,
    );
    runtime.scene.getConstellationWorldPosition.mockImplementation(
      (objectId: string, target: THREE.Vector3) =>
        objectId === constellation.id ? target.copy(position) : null,
    );
    runtime.scene.getConstellationFocusRadius.mockImplementation((objectId: string) =>
      objectId === constellation.id ? 60 : null,
    );

    await runtime.engine.setTarget(constellation.id);

    expect(runtime.registry.setNavigationTarget).toHaveBeenCalledWith(null);
    expect(runtime.registry.select).toHaveBeenCalledWith(null);
    expect(runtime.scene.selectConstellation).toHaveBeenCalledWith(constellation.id);
    expect(runtime.controller.focusOn).not.toHaveBeenCalled();
    expect(runtime.controller.focusOnFromDirection).toHaveBeenCalledWith(
      position,
      constellation,
      expect.any(THREE.Vector3),
      expect.any(Number),
    );
  });

  it('rejette une cible sans services, sans objet ou sans position', async () => {
    const empty = createTestEngine();

    empty.completeTargetTransition();
    await expect(empty.setTarget('earth')).rejects.toThrow('introuvable');

    const missingController = createRuntime();

    missingController.access.cameraController = null;
    await expect(missingController.engine.setTarget('earth')).rejects.toThrow('introuvable');

    const unknown = createRuntime();

    unknown.registry.has.mockReturnValue(false);
    unknown.catalog.has.mockReturnValue(false);
    await expect(unknown.engine.setTarget('unknown')).rejects.toThrow('introuvable');

    const noPosition = createRuntime();

    noPosition.registry.getWorldPosition.mockReturnValue(null);
    noPosition.scene.getCatalogWorldPosition.mockReturnValue(null);
    await expect(noPosition.engine.setTarget('earth')).rejects.toThrow('Position indisponible');

    const noDefinition = createRuntime();

    noDefinition.registry.getDefinition.mockReturnValue(undefined);
    noDefinition.catalog.getDefinition.mockReturnValue(undefined);
    await expect(noDefinition.engine.setTarget('earth')).rejects.toThrow('Position indisponible');
  });

  it('cadre une orbite complète autour de son parent', () => {
    const runtime = createRuntime();
    const events: UniverseEngineEvent[] = [];

    runtime.engine.subscribe((event) => events.push(event));
    runtime.engine.viewOrbit('earth');

    expect(runtime.registry.setNavigationTarget).toHaveBeenCalledWith('sun');
    expect(runtime.registry.select).toHaveBeenCalledWith('earth');
    expect(runtime.controller.focusOnFromDirection).toHaveBeenCalledWith(
      expect.any(THREE.Vector3),
      runtime.definitions.get('sun'),
      expect.any(THREE.Vector3),
      expect.any(Number),
    );
    expect(events).toContainEqual({ type: 'target-changed', objectId: 'sun' });
  });

  it.each([
    ['registre', (runtime: Runtime) => runtime.access.objectRuntime.replacePrimary(null)],
    ['contrôleur', (runtime: Runtime) => (runtime.access.cameraController = null)],
    ['caméra', (runtime: Runtime) => (runtime.access.camera = null)],
    ['objet', (runtime: Runtime) => runtime.registry.getDefinition.mockReturnValue(undefined)],
    [
      'parent déclaré',
      (runtime: Runtime) =>
        runtime.registry.getDefinition.mockImplementation((id: string) =>
          id === 'earth' ? object('earth', 'Terre', 'planet') : runtime.definitions.get(id),
        ),
    ],
    [
      'parent résolu',
      (runtime: Runtime) =>
        runtime.registry.getDefinition.mockImplementation((id: string) =>
          id === 'sun' ? undefined : runtime.definitions.get(id),
        ),
    ],
    [
      'position du parent',
      (runtime: Runtime) =>
        runtime.registry.getWorldPosition.mockImplementation((id: string) =>
          id === 'sun' ? null : runtime.positions.get(id),
        ),
    ],
    [
      'rayon numérique',
      (runtime: Runtime) => runtime.registry.getOrbitRadius.mockReturnValue(null),
    ],
    ['rayon positif', (runtime: Runtime) => runtime.registry.getOrbitRadius.mockReturnValue(0)],
  ])('refuse une orbite sans %s', (_label, mutate) => {
    const runtime = createRuntime();

    mutate(runtime);

    expect(() => runtime.engine.viewOrbit('earth')).toThrow('Orbite indisponible');
  });

  it('cadre une échelle et efface la sélection', () => {
    const runtime = createRuntime();
    const scale = NAVIGATION_SCALES[1]!;

    runtime.engine.viewScale(scale);

    expect(runtime.registry.setNavigationTarget).toHaveBeenCalledWith('sun');
    expect(runtime.registry.select).toHaveBeenCalledWith(null);
    expect(runtime.controller.focusOnFromDirection).toHaveBeenCalledWith(
      expect.any(THREE.Vector3),
      runtime.definitions.get('sun'),
      expect.any(THREE.Vector3),
      scale.distance,
    );
  });

  it.each([
    ['registre', (runtime: Runtime) => runtime.access.objectRuntime.replacePrimary(null)],
    ['contrôleur', (runtime: Runtime) => (runtime.access.cameraController = null)],
    ['cible', (runtime: Runtime) => runtime.registry.getDefinition.mockReturnValue(undefined)],
    ['position', (runtime: Runtime) => runtime.registry.getWorldPosition.mockReturnValue(null)],
  ])('refuse une échelle sans %s', (_label, mutate) => {
    const runtime = createRuntime();

    mutate(runtime);

    expect(() => runtime.engine.viewScale(NAVIGATION_SCALES[1]!)).toThrow('Cadrage indisponible');
  });

  it('cadre une éclipse solaire totale vers la progression de sa trajectoire', () => {
    const runtime = createRuntime();
    const events: UniverseEngineEvent[] = [];
    const event = solarEvent();
    const appearance = calculateSolarEclipseAppearance(event.peak);
    const framing = calculateEarthObserverDirection(
      event.peak,
      appearance.centralLatitude! * 0.86,
      appearance.centralLongitude! + 10,
    );

    runtime.engine.subscribe((event) => events.push(event));
    runtime.engine.viewSolarEclipse(event);

    expect(runtime.registry.setSolarObserverActive).toHaveBeenCalledWith(false);
    expect(runtime.registry.setNavigationTarget).toHaveBeenCalledWith('earth');
    expect(runtime.registry.clearSolarEclipsePath).toHaveBeenCalled();
    expect(
      runtime.controller.focusOnFromDirection.mock.calls
        .at(-1)?.[2]
        .distanceTo(new THREE.Vector3(framing.x, framing.y, framing.z)),
    ).toBeLessThan(1e-12);
    expect(runtime.controller.focusOnFromDirection.mock.calls.at(-1)?.[3]).toBeCloseTo(9.6);
    expect(events).toContainEqual({ type: 'target-changed', objectId: 'earth' });
  });

  it.each([
    [
      'registre',
      (runtime: Runtime) => runtime.access.objectRuntime.replacePrimary(null),
      solarEvent(),
    ],
    ['contrôleur', (runtime: Runtime) => (runtime.access.cameraController = null), solarEvent()],
    [
      'position terrestre',
      (runtime: Runtime) =>
        runtime.registry.getWorldPosition.mockImplementation((id: string) =>
          id === 'earth' ? null : runtime.positions.get(id),
        ),
      solarEvent(),
    ],
    [
      'définition terrestre',
      (runtime: Runtime) =>
        runtime.registry.getDefinition.mockImplementation((id: string) =>
          id === 'earth' ? undefined : runtime.definitions.get(id),
        ),
      solarEvent(),
    ],
    [
      'alignement',
      () => undefined,
      solarEvent({
        peak: {
          julianDay: dateToJulianDay(new Date('2026-07-28T12:00:00.000Z')),
        },
      }),
    ],
  ])('refuse une vue solaire sans %s', (_label, mutate, event) => {
    const runtime = createRuntime();

    mutate(runtime);

    expect(() => runtime.engine.viewSolarEclipse(event)).toThrow('indisponible');
  });

  it('place la caméra sur le géoïde pour observer une éclipse', () => {
    const runtime = createRuntime();

    runtime.engine.observeSolarEclipse(solarEvent());

    expect(runtime.registry.setSolarObserverActive).toHaveBeenCalledWith(true, expect.any(Number));
    expect(runtime.registry.setNavigationTarget).toHaveBeenCalledWith('sun');
    expect(runtime.labels.clear).toHaveBeenCalledOnce();
    expect(runtime.controller.observeFrom).toHaveBeenCalledWith(
      expect.any(THREE.Vector3),
      expect.any(THREE.Vector3),
    );
  });

  it('utilise le point central calculé lorsque l’événement ne fournit pas de coordonnées', () => {
    const runtime = createRuntime();

    runtime.engine.observeSolarEclipse(
      solarEvent({
        latitude: null,
        longitude: null,
      }),
    );

    expect(runtime.controller.observeFrom).toHaveBeenCalledOnce();
  });

  it.each([
    [
      'registre',
      (runtime: Runtime) => runtime.access.objectRuntime.replacePrimary(null),
      solarEvent(),
    ],
    ['contrôleur', (runtime: Runtime) => (runtime.access.cameraController = null), solarEvent()],
    ['Terre', (runtime: Runtime) => runtime.positions.delete('earth'), solarEvent()],
    ['Lune', (runtime: Runtime) => runtime.positions.delete('moon'), solarEvent()],
    ['Soleil', (runtime: Runtime) => runtime.positions.delete('sun'), solarEvent()],
    ['définition lunaire', (runtime: Runtime) => runtime.definitions.delete('moon'), solarEvent()],
    ['définition solaire', (runtime: Runtime) => runtime.definitions.delete('sun'), solarEvent()],
    [
      'coordonnées',
      () => undefined,
      solarEvent({
        latitude: null,
        longitude: null,
        peak: {
          julianDay: dateToJulianDay(new Date('2026-07-28T12:00:00.000Z')),
        },
      }),
    ],
  ])('refuse un observateur sans %s', (_label, mutate, event) => {
    const runtime = createRuntime();

    mutate(runtime);

    expect(() => runtime.engine.observeSolarEclipse(event)).toThrow(
      'point d’observation terrestre',
    );
  });

  it('active et retire la trajectoire solaire ainsi que la présentation complète', () => {
    const runtime = createRuntime();
    const event = solarEvent();

    runtime.engine.setSolarEclipsePathVisible(event, true);
    expect(runtime.registry.showSolarEclipsePath).toHaveBeenCalledWith(event.peak, event.kind);
    runtime.engine.setSolarEclipsePathVisible(event, false);
    expect(runtime.registry.clearSolarEclipsePath).toHaveBeenCalled();

    runtime.engine.clearSolarEclipsePresentation();
    expect(runtime.registry.setSolarObserverActive).toHaveBeenCalledWith(false);
    expect(runtime.access.solarEclipsePresentation.activeEvent).toBeNull();

    runtime.access.objectRuntime.replacePrimary(null);
    runtime.engine.setSolarEclipsePathVisible(event, true);
    runtime.engine.setSolarEclipsePathVisible(event, false);
    runtime.engine.clearSolarEclipsePresentation();
  });

  it('sélectionne les objets locaux, du catalogue et ignore un identifiant inconnu', () => {
    const runtime = createRuntime();
    const events: UniverseEngineEvent[] = [];
    const catalogObject = object('hyg-1', 'Sirius', 'star');

    runtime.engine.subscribe((event) => events.push(event));
    runtime.engine.selectObject('unknown');
    expect(events).toEqual([]);

    runtime.engine.selectObject('earth');
    expect(runtime.registry.select).toHaveBeenLastCalledWith('earth');
    expect(runtime.scene.selectCatalogObject).toHaveBeenLastCalledWith(null);
    expect(runtime.labels.setDetailsPanelVisible).toHaveBeenLastCalledWith(true);

    runtime.catalog.has.mockImplementation((id: string) => id === 'hyg-1');
    runtime.catalog.getDefinition.mockImplementation((id: string) =>
      id === 'hyg-1' ? catalogObject : undefined,
    );
    runtime.engine.selectObject('hyg-1');
    expect(runtime.registry.select).toHaveBeenLastCalledWith(null);
    expect(runtime.scene.selectCatalogObject).toHaveBeenLastCalledWith('hyg-1');
    expect(runtime.labels.setTransientObject).toHaveBeenLastCalledWith(catalogObject);

    runtime.engine.selectObject(null);
    expect(runtime.labels.setDetailsPanelVisible).toHaveBeenLastCalledWith(false);
    expect(events.at(-1)).toMatchObject({
      type: 'object-selected',
      objectId: null,
      object: null,
    });
  });

  it('route cible, sélection et position vers le registre spatial chargé', () => {
    const runtime = createRuntime();
    const galaxy = object('galaxy-a', 'Galaxie A', 'galaxy', 'nearby-universe');
    const galaxyPosition = new THREE.Vector3(420, 12, -38);
    const spaceTileRegistry: FakeRegistry = {
      ...runtime.registry,
      has: vi.fn((objectId: string) => objectId === galaxy.id),
      getDefinition: vi.fn((objectId: string) => (objectId === galaxy.id ? galaxy : undefined)),
      getWorldPosition: vi.fn((objectId: string, target = new THREE.Vector3()) =>
        objectId === galaxy.id ? target.copy(galaxyPosition) : null,
      ),
      setNavigationTarget: vi.fn(),
      select: vi.fn(),
      updateLod: vi.fn(),
      dispose: vi.fn(),
    };

    runtime.access.objectRuntime.replaceStreamed(spaceTileRegistry);

    expect(runtime.access.objectRuntime.getRegistry(galaxy.id)).toBe(spaceTileRegistry);
    expect(runtime.access.objectRuntime.getRegistry('unknown')).toBeNull();
    expect(runtime.access.getWorldPosition(galaxy.id)).toEqual(galaxyPosition);

    runtime.access.objectRuntime.setNavigationTarget(galaxy.id);
    runtime.access.objectRuntime.select(galaxy.id);
    expect(runtime.registry.setNavigationTarget).toHaveBeenLastCalledWith(null);
    expect(spaceTileRegistry.setNavigationTarget).toHaveBeenLastCalledWith(galaxy.id);
    expect(runtime.registry.select).toHaveBeenLastCalledWith(null);
    expect(spaceTileRegistry.select).toHaveBeenLastCalledWith(galaxy.id);

    runtime.access.objectRuntime.setNavigationTarget(null);
    runtime.access.objectRuntime.select(null);
    expect(spaceTileRegistry.setNavigationTarget).toHaveBeenLastCalledWith(null);
    expect(spaceTileRegistry.select).toHaveBeenLastCalledWith(null);
  });

  it('centre la sélection seulement lorsqu’elle existe', async () => {
    const runtime = createRuntime();

    runtime.engine.focusSelected();
    expect(runtime.controller.focusOn).not.toHaveBeenCalled();

    runtime.engine.selectObject('earth');
    runtime.engine.focusSelected();
    await Promise.resolve();

    expect(runtime.controller.focusOn).toHaveBeenCalled();
  });

  it('applique les options visuelles sans reconstruire lorsque la qualité reste identique', () => {
    const runtime = createRuntime();
    const rebuild = vi
      .spyOn(runtime.access, 'rebuildObjectRegistry')
      .mockImplementation(() => undefined);
    const options = {
      showOrbits: false,
      showConstellations: false,
      showLabels: false,
      quality: 'medium' as const,
      labelDensity: 'dense' as const,
      temporalMode: 'observable' as const,
    };

    runtime.engine.setDisplayOptions(options);

    expect(runtime.scene.setQuality).toHaveBeenCalledWith('medium');
    expect(runtime.scene.setConstellationsEnabled).toHaveBeenCalledWith(false);
    expect(runtime.labels.setEnabled).toHaveBeenCalledWith(false);
    expect(runtime.labels.setDensity).toHaveBeenCalledWith('dense');
    expect(runtime.labels.setObjects).toHaveBeenCalled();
    expect(runtime.catalog.getLabelObjects).toHaveBeenCalledWith(expect.any(Array), 3_300, 8, 72);
    expect(runtime.registry.setDisplayOptions).toHaveBeenCalledWith(options);
    expect(rebuild).not.toHaveBeenCalled();
    expect(runtime.labels.setQuality).not.toHaveBeenCalled();
    expect(runtime.controller.releaseTarget).not.toHaveBeenCalled();

    runtime.engine.setDisplayOptions({ ...options, temporalMode: 'state' });
    expect(runtime.controller.releaseTarget).toHaveBeenCalledOnce();
  });

  it('conserve les objets locaux lorsque la façade de catalogue est absente', () => {
    const runtime = createRuntime();
    const events: UniverseEngineEvent[] = [];

    runtime.engine.subscribe((event) => events.push(event));
    runtime.access.catalogRuntime = null;

    expect(runtime.access.getLabelObjects().map(({ id }) => id)).toEqual([
      'sun',
      'earth',
      'moon',
      'mars',
    ]);

    runtime.access.emitDataReady({
      searchEntries: [],
    } as unknown as SpaceStreamingCoordinator);

    expect(events.at(-1)).toMatchObject({
      type: 'data-ready',
      catalogEntries: [],
    });
  });

  it('transmet la sélection des couches du réseau cosmique à la scène', () => {
    const runtime = createRuntime();
    const ensureSpines = vi
      .spyOn(runtime.access, 'ensureTempelFilamentSpines')
      .mockResolvedValue(undefined);
    const lodLevel = vi.spyOn(runtimeInternals(runtime).lodManager, 'level', 'get');
    const layers = {
      volume: true,
      groups: true,
      links: false,
      clusters: true,
      superclusters: false,
      filaments: true,
      voids: true,
    } as const;

    lodLevel.mockReturnValue(5);
    runtime.engine.setCosmicMapLayers(layers);
    expect(runtime.scene.setCosmicMapLayers).toHaveBeenCalledWith(layers);
    expect(ensureSpines).not.toHaveBeenCalled();

    lodLevel.mockReturnValue(6);
    runtime.engine.setCosmicMapLayers(layers);
    expect(ensureSpines).toHaveBeenCalledOnce();

    runtime.engine.setCosmicMapLayers({ ...layers, filaments: false });
    expect(runtime.scene.setCosmicMapLayers).toHaveBeenLastCalledWith({
      ...layers,
      filaments: false,
    });

    runtime.access.universeScene = null;
    runtime.engine.setCosmicMapLayers({ ...layers, filaments: false });
    expect(runtime.scene.setCosmicMapLayers).toHaveBeenCalledTimes(3);
  });

  it('reconfigure le rendu et reconstruit le registre lors d’un changement de qualité', () => {
    const runtime = createRuntime();
    const rebuild = vi
      .spyOn(runtime.access, 'rebuildObjectRegistry')
      .mockImplementation(() => undefined);

    runtime.engine.setDisplayOptions({
      showOrbits: true,
      showConstellations: true,
      showLabels: true,
      quality: 'high',
      labelDensity: 'balanced',
      temporalMode: 'state',
    });

    expect(rebuild).toHaveBeenCalledOnce();
    expect(runtime.labels.setQuality).toHaveBeenCalledWith('high');
    expect(runtime.labels.setObjects).toHaveBeenCalled();
    expect(runtime.renderer.setPixelRatio).toHaveBeenCalled();
    expect(runtime.renderer.setSize).toHaveBeenCalledWith(800, 450, false);

    const noServices = createRuntime();

    noServices.access.objectRuntime.replacePrimary(null);
    noServices.access.universeScene = null;
    noServices.access.renderer = null;
    noServices.engine.setDisplayOptions({
      showOrbits: false,
      showConstellations: false,
      showLabels: false,
      quality: 'low',
      labelDensity: 'minimal',
      temporalMode: 'state',
    });

    const noContainer = createRuntime();

    noContainer.access.container = null;
    vi.spyOn(noContainer.access, 'rebuildObjectRegistry').mockImplementation(() => undefined);
    noContainer.engine.setDisplayOptions({
      showOrbits: true,
      showConstellations: true,
      showLabels: true,
      quality: 'high',
      labelDensity: 'dense',
      temporalMode: 'state',
    });
    expect(noContainer.renderer.setPixelRatio).toHaveBeenCalled();
    expect(noContainer.renderer.setSize).not.toHaveBeenCalled();
  });

  it('délègue le zoom lorsque la caméra est disponible', () => {
    const runtime = createRuntime();

    runtime.engine.zoomBy(0.8);
    expect(runtime.controller.zoomBy).toHaveBeenCalledWith(0.8);

    runtime.access.cameraController = null;
    runtime.engine.zoomBy(1.2);
  });

  it('change de référentiel avec un bouton uniquement lorsqu’il franchit un niveau', () => {
    const runtime = createRuntime();

    installNavigationHierarchy(runtime);
    runtime.access.handleNavigationIntent('earth');
    runtime.controller.zoomBy.mockImplementation(() => {
      runtime.controller.distanceToTarget = 520;
    });

    runtime.engine.zoomBy(1.38);

    expect(runtime.access.targetId).toBe('sun');
    expect(runtime.controller.transitionReferenceFrame).toHaveBeenCalledWith(
      runtime.positions.get('sun'),
      runtime.definitions.get('sun'),
    );
  });

  it.each([
    ['renderer', (runtime: Runtime) => (runtime.access.renderer = null)],
    ['caméra', (runtime: Runtime) => (runtime.access.camera = null)],
    ['scène', (runtime: Runtime) => (runtime.access.universeScene = null)],
    ['registre', (runtime: Runtime) => runtime.access.objectRuntime.replacePrimary(null)],
    ['contrôleur', (runtime: Runtime) => (runtime.access.cameraController = null)],
    ['passe de lentille', (runtime: Runtime) => (runtime.access.blackHoleLensingPass = null)],
  ])('ignore une frame incomplète sans %s', (_label, mutate) => {
    const runtime = createRuntime();

    mutate(runtime);
    runtime.access.renderFrame(0.5);

    expect(runtime.renderer.render).not.toHaveBeenCalled();
  });

  it('orchestre chaque frame dans l’ordre simulation, navigation, contenu, rendu et diagnostic', () => {
    const runtime = createRuntime();
    const internals = runtimeInternals(runtime);
    const phases: string[] = [];
    const simulation = vi
      .spyOn(internals.frameSimulation, 'update')
      .mockImplementation(() => phases.push('simulation'));
    const navigation = vi.spyOn(internals.frameNavigation, 'update').mockImplementation(() => {
      phases.push('navigation');

      return 3;
    });
    const content = vi
      .spyOn(internals.frameContent, 'update')
      .mockImplementation(() => phases.push('content'));
    const render = vi
      .spyOn(internals.frameRenderer, 'render')
      .mockImplementation(() => phases.push('render'));

    vi.spyOn(internals.debugRuntime, 'update').mockImplementation(() => {
      phases.push('diagnostic');
    });

    runtime.access.renderFrame(0.016);

    expect(phases).toEqual(['simulation', 'navigation', 'content', 'render', 'diagnostic']);
    expect(simulation).toHaveBeenCalledWith(0.016, runtime.registry);
    expect(navigation).toHaveBeenCalledWith(0.016, expect.any(Object));
    expect(content).toHaveBeenCalledWith(0.016, expect.any(Object), 3);
    expect(render).toHaveBeenCalledWith(0.016, expect.any(Object), 3);
  });

  it('rend une frame avancée, publie le LOD, le temps et les statistiques', () => {
    const runtime = createRuntime();
    const events: UniverseEngineEvent[] = [];
    const internals = runtimeInternals(runtime);
    const currentTime = { julianDay: 2_460_000 };

    vi.spyOn(internals.timeController, 'update').mockReturnValue(true);
    vi.spyOn(internals.timeController, 'currentTime', 'get').mockReturnValue(currentTime);
    vi.spyOn(internals.lodManager, 'selectLevel').mockReturnValue(2);
    vi.spyOn(internals.lodManager, 'level', 'get').mockReturnValue(2);
    const originUpdate = vi.spyOn(internals.floatingOriginManager, 'update');

    runtime.access.targetId = 'earth';
    runtime.access.selectedId = 'mars';
    runtimeInternals(runtime).debugRuntime.update(0.75);
    runtime.renderer.toneMappingExposure = 1;
    runtime.labels.render.mockImplementation(
      (
        _camera: THREE.Camera,
        getPosition: (objectId: string, target: THREE.Vector3) => THREE.Vector3 | null,
      ) => {
        expect(getPosition('earth', new THREE.Vector3())).toEqual(runtime.positions.get('earth'));
      },
    );
    runtime.engine.subscribe((event) => events.push(event));

    runtime.access.renderFrame(0.25);

    expect(runtime.registry.updateBodyRotations).toHaveBeenCalledWith(currentTime);
    expect(runtime.registry.updatePositions).toHaveBeenCalledWith(currentTime);
    expect(runtime.controller.follow).toHaveBeenCalled();
    expect(runtime.controller.update).toHaveBeenCalledWith(0.25, currentTime);
    expect(originUpdate).toHaveBeenCalled();
    expect(runtime.registry.updateLod).toHaveBeenCalledWith(runtime.camera, 450, 2, 0.25, false);
    expect(runtime.scene.ensureMilkyWayAtlas).toHaveBeenCalledOnce();
    expect(runtime.scene.updateLod).toHaveBeenCalledWith(
      2,
      0.25,
      24,
      runtime.camera.position,
      false,
    );
    expect(runtime.renderer.toneMappingExposure).toBeGreaterThan(1);
    expect(runtime.renderer.toneMappingExposure).toBeLessThan(
      getPhotographicProfile(2, 'medium').exposure,
    );
    expect(runtime.renderer.render).toHaveBeenCalledWith(runtime.scene.scene, runtime.camera);
    expect(runtime.labels.render).toHaveBeenCalledWith(
      runtime.camera,
      expect.any(Function),
      2,
      'mars',
    );
    expect(events).toContainEqual({ type: 'lod-changed', level: 2 });
    expect(events).toContainEqual({ type: 'time-changed', time: currentTime });
    expect(events.some((event) => event.type === 'debug-stats')).toBe(true);
  });

  it('considère la caméra stable avant la création du contrôleur', () => {
    const runtime = createRuntime();
    const internals = runtimeInternals(runtime);
    const frameBindings = (
      internals.frameRenderer as unknown as {
        bindings: { isCameraTransitioning(): boolean };
      }
    ).bindings;

    runtime.access.cameraController = null;
    expect(frameBindings.isCameraTransitioning()).toBe(false);

    runtime.access.cameraController = runtime.controller;
    runtime.controller.isTransitioning = true;
    expect(frameBindings.isCameraTransitioning()).toBe(true);
  });

  it('identifie les seuls objets célestes conservés dans la vue depuis la Terre', () => {
    const runtime = createRuntime();
    const internals = runtimeInternals(runtime);
    const frameBindings = (
      internals.frameRenderer as unknown as {
        bindings: {
          isObserverModeActive(): boolean;
          isObserverSkyObject(objectId: string): boolean;
        };
      }
    ).bindings;

    runtime.access.cameraController = null;
    expect(frameBindings.isObserverModeActive()).toBe(false);
    runtime.access.cameraController = runtime.controller;
    runtime.controller.observerPresentationActive = true;
    expect(frameBindings.isObserverModeActive()).toBe(true);

    runtime.catalog.isCatalogStar.mockImplementation((objectId: string) => objectId === 'sirius');
    runtime.catalog.isExoplanetHost.mockImplementation(
      (objectId: string) => objectId === 'proxima-centauri',
    );
    runtime.scene.hasConstellation.mockImplementation(
      (objectId: string) => objectId === 'constellation-orion',
    );

    expect(frameBindings.isObserverSkyObject('sirius')).toBe(true);
    expect(frameBindings.isObserverSkyObject('proxima-centauri')).toBe(true);
    expect(frameBindings.isObserverSkyObject('constellation-orion')).toBe(true);
    expect(frameBindings.isObserverSkyObject('sun')).toBe(false);
  });

  it('précharge les épines Tempel en entrant dans le LOD du réseau cosmique', () => {
    const runtime = createRuntime();
    const ensureSpines = vi
      .spyOn(runtime.access, 'ensureTempelFilamentSpines')
      .mockResolvedValue(undefined);

    runtime.controller.distanceToTarget = 420_000;
    runtime.access.renderFrame(0.05);

    expect(ensureSpines).toHaveBeenCalledOnce();
  });

  it('active la distorsion écran lorsque la cible ou la sélection est un trou noir visible', () => {
    const runtime = createRuntime();
    const hole = {
      ...object('test-black-hole', 'Trou noir', 'black-hole', 'milky-way'),
      referenceFrame: 'galactic' as const,
      visual: {
        visualRadius: 2,
        scaleMode: 'adaptive' as const,
        blackHoleActivity: 'active' as const,
      },
    };

    runtime.definitions.set(hole.id, hole);
    runtime.positions.set(hole.id, new THREE.Vector3(0, 0, -20));
    runtime.camera.lookAt(0, 0, -1);
    runtime.camera.updateProjectionMatrix();
    runtime.camera.updateMatrixWorld(true);
    runtime.access.targetId = hole.id;
    runtime.access.selectedId = null;

    runtime.access.renderFrame(0.1);
    let effect = runtime.lensing.render.mock.calls.at(-1)?.[3] as BlackHoleLensingEffect | null;

    expect(effect).toMatchObject({
      objectId: hole.id,
      scientificConfidence: 'illustrative',
    });
    expect(effect?.strength).toBeGreaterThan(0);
    expect(runtime.lensing.render.mock.calls.at(-1)?.[4]).toBe(
      runtime.registry.getLensingForeground.mock.results.at(-1)?.value,
    );

    runtime.access.targetId = null;
    runtime.access.selectedId = hole.id;
    runtime.access.renderFrame(0.1);
    effect = runtime.lensing.render.mock.calls.at(-1)?.[3] as BlackHoleLensingEffect | null;
    expect(effect?.objectId).toBe(hole.id);
  });

  it('met à jour le LOD du registre spatial lorsque le conteneur est détaché', () => {
    const runtime = createRuntime();
    const spaceTileRegistry: FakeRegistry = {
      ...runtime.registry,
      updateLod: vi.fn(),
    };

    runtime.access.objectRuntime.replaceStreamed(spaceTileRegistry);
    runtime.access.container = null;
    runtime.access.renderFrame(0.05);

    expect(spaceTileRegistry.updateLod).toHaveBeenCalledWith(runtime.camera, 450, 0, 0.05, false);
    expect(runtime.scene.ensureMilkyWayAtlas).toHaveBeenCalledOnce();
  });

  it('applique la résolution adaptative au renderer et à la scène', () => {
    const runtime = createRuntime();
    const events: UniverseEngineEvent[] = [];
    const performanceManager = Reflect.get(
      runtime.engine,
      'performanceManager',
    ) as PerformanceManager;

    vi.spyOn(performanceManager, 'observeFrame').mockReturnValue(1.25);
    runtime.engine.subscribe((event) => events.push(event));

    runtimeInternals(runtime).adaptiveRenderingRuntime.update(1);

    expect(runtime.renderer.setPixelRatio).toHaveBeenCalledWith(1.25);
    expect(runtime.scene.setPixelRatio).toHaveBeenCalledWith(1.25);
    expect(runtime.renderer.setSize).toHaveBeenCalledWith(800, 450, false);
    runtimeInternals(runtime).debugRuntime.update(1);
    expect(events).toContainEqual(
      expect.objectContaining({
        type: 'debug-stats',
        stats: expect.objectContaining({ fps: 1, pixelRatio: 1.25 }),
      }),
    );

    runtime.access.container = null;
    runtime.renderer.setSize.mockClear();
    runtimeInternals(runtime).adaptiveRenderingRuntime.update(1);
    expect(runtime.renderer.setPixelRatio).toHaveBeenLastCalledWith(1.25);
    expect(runtime.renderer.setSize).not.toHaveBeenCalled();

    runtime.access.universeScene = null;
    runtime.renderer.setPixelRatio.mockClear();
    runtimeInternals(runtime).adaptiveRenderingRuntime.update(1);
    expect(runtime.renderer.setPixelRatio).not.toHaveBeenCalled();

    const observeFrame = vi.spyOn(performanceManager, 'observeFrame').mockReturnValue(null);

    runtime.access.cameraController = null;
    runtimeInternals(runtime).adaptiveRenderingRuntime.update(0.015);
    expect(observeFrame).toHaveBeenLastCalledWith('medium', 0.015, false);

    vi.spyOn(document, 'visibilityState', 'get').mockReturnValue('hidden');
    runtimeInternals(runtime).adaptiveRenderingRuntime.update(0.016);
    expect(observeFrame).toHaveBeenLastCalledWith('medium', 0.016, true);
  });

  it('gère les frames fixes, le temps exact et la vue sans labels', () => {
    const runtime = createRuntime();
    const internals = runtimeInternals(runtime);
    const currentTime = { julianDay: 2_460_100 };
    const updateTime = vi
      .spyOn(internals.timeController, 'update')
      .mockReturnValueOnce(false)
      .mockReturnValueOnce(false)
      .mockReturnValueOnce(true)
      .mockReturnValueOnce(false);

    vi.spyOn(internals.timeController, 'currentTime', 'get').mockReturnValue(currentTime);
    vi.spyOn(internals.lodManager, 'selectLevel').mockReturnValue(1);
    runtime.access.container = null;
    runtime.access.targetId = 'earth';
    runtime.access.selectedId = null;
    runtime.access.solarEclipsePresentation.showOrbitalView(solarEvent(), runtime.registry);

    runtime.access.renderFrame(0.01);
    runtime.access.renderFrame(0.01);
    runtime.access.renderFrame(0.01);
    runtime.access.solarEclipsePresentation.clear(null);
    runtime.access.renderFrame(0.01);

    expect(updateTime).toHaveBeenCalledTimes(4);
    expect(runtime.registry.updateBodyRotations).toHaveBeenCalledOnce();
    expect(runtime.registry.updateBodyRotations).toHaveBeenCalledWith(currentTime);
    expect(runtime.registry.updatePositions).not.toHaveBeenCalled();
    expect(runtime.labels.clear).toHaveBeenCalledTimes(3);
    expect(runtime.labels.render).toHaveBeenLastCalledWith(
      runtime.camera,
      expect.any(Function),
      1,
      'earth',
    );
    expect(runtime.registry.updateLod).toHaveBeenCalledWith(runtime.camera, 450, 1, 0.01, false);
  });

  it.each([
    ['renderer', (runtime: Runtime) => (runtime.access.renderer = null)],
    ['caméra', (runtime: Runtime) => (runtime.access.camera = null)],
    ['registre', (runtime: Runtime) => runtime.access.objectRuntime.replacePrimary(null)],
    ['scène', (runtime: Runtime) => (runtime.access.universeScene = null)],
  ])('ignore les statistiques sans %s', (_label, mutate) => {
    const runtime = createRuntime();

    mutate(runtime);
    runtimeInternals(runtime).debugRuntime.update(2);
  });

  it('attend une seconde avant de publier les statistiques et accepte une caméra sans contrôleur', () => {
    const runtime = createRuntime();
    const events: UniverseEngineEvent[] = [];

    runtime.access.streamingRuntime.reset();
    runtimeInternals(runtime).debugRuntime.update(1);
    runtimeInternals(runtime).debugRuntime.reset();

    const streamingCoordinator = new SpaceStreamingCoordinator(
      null,
      {
        activeTileCount: 8,
        cachedPackCount: 5,
        cachedTileCount: 19,
        activeClusterCount: 302,
        cachedClusterCount: 2_610,
        synchronize: vi.fn(async () => ({ changed: false, tiles: [] })),
      },
      {
        isActive: () => true,
        onSpaceTilesChanged: vi.fn(),
        onStarTilesChanged: vi.fn(),
        onWarning: vi.fn(),
      },
    );

    runtime.access.streamingRuntime.install(
      runtime.access.streamingRuntime.baseObjects,
      streamingCoordinator,
    );
    runtime.scene.visibleStarClusterCount = 302;
    runtime.engine.subscribe((event) => events.push(event));
    runtimeInternals(runtime).debugRuntime.update(0.25);
    expect(events.some((event) => event.type === 'debug-stats')).toBe(false);

    runtime.access.cameraController = null;
    runtimeInternals(runtime).debugRuntime.update(1);

    const debugEvent = events.find((event) => event.type === 'debug-stats');

    expect(debugEvent).toMatchObject({
      type: 'debug-stats',
      stats: {
        cameraDistance: 0,
        cameraTarget: { x: 0, y: 0, z: 0 },
        drawCalls: 3,
        triangles: 120,
        geometries: 4,
        textures: 2,
        batchedGalaxies: 7,
        cosmicGroups: 37_730,
        cosmicFilaments: 42_000,
        cosmicStructures: 9_985,
        tempelFilamentSpines: 15_421,
        tempelSpineSegments: 260_178,
        visibleTempelSpineSegments: 18_000,
        tempelSpineTiles: 8,
        activeStarTiles: 8,
        cachedStarPacks: 5,
        cachedStarTiles: 19,
        activeStarClusters: 302,
        cachedStarClusters: 2_610,
        visibleStarClusters: 302,
      },
    });
  });

  it('publie le dernier diagnostic de zoom et son objet d’ancrage', () => {
    const runtime = createRuntime();
    const events: UniverseEngineEvent[] = [];

    runtime.controller.lastZoomDiagnostics = {
      deltaY: -480,
      beforeDistance: 17_000,
      requestedDistance: 9_600,
      appliedDistance: 9_600,
      minimumDistance: 1.5,
      maximumDistance: 18_000,
      status: 'applied',
    };
    runtime.engine.subscribe((event) => events.push(event));
    runtime.access.handleSemanticZoomIntent('mars', -480);
    runtimeInternals(runtime).debugRuntime.update(1);

    const debugEvent = events.find((event) => event.type === 'debug-stats');

    expect(debugEvent).toMatchObject({
      type: 'debug-stats',
      stats: {
        navigationOriginId: 'mars',
        navigationReferenceFrame: 'solar-system',
        zoom: {
          anchorType: 'object',
          anchorObjectId: 'mars',
          status: 'applied',
          beforeDistance: 17_000,
          appliedDistance: 9_600,
        },
      },
    });
  });

  it('suit uniquement une cible résolue avec les services nécessaires', () => {
    const runtime = createRuntime();

    runtime.access.followCurrentTarget();
    runtime.access.targetId = 'unknown';
    runtime.access.followCurrentTarget();
    runtime.access.targetId = 'earth';
    runtime.access.followCurrentTarget();
    expect(runtime.controller.follow).toHaveBeenCalledOnce();

    runtime.access.objectRuntime.replacePrimary(null);
    runtime.access.followCurrentTarget();
    runtime.access.objectRuntime.replacePrimary(runtime.registry);
    runtime.access.cameraController = null;
    runtime.access.followCurrentTarget();
  });

  it('traite un clic simple, un clic de focus et une désélection', async () => {
    const runtime = createRuntime();

    runtime.access.handlePick('earth', false);
    expect(runtime.registry.select).toHaveBeenCalledWith('earth');

    runtime.access.handlePick(null, true);
    expect(runtime.registry.select).toHaveBeenCalledWith(null);

    runtime.access.handlePick('earth', true);
    await Promise.resolve();
    expect(runtime.controller.focusOn).toHaveBeenCalled();
  });

  it('sélectionne une étoile sans quitter le point de vue terrestre', async () => {
    const runtime = createRuntime();
    const sirius = object('sirius', 'Sirius', 'star', 'milky-way');
    const setTarget = vi.spyOn(runtime.engine, 'setTarget');

    runtime.catalog.has.mockImplementation((objectId: string) => objectId === sirius.id);
    runtime.catalog.isCatalogStar.mockImplementation((objectId: string) => objectId === sirius.id);
    runtime.catalog.getDefinition.mockImplementation((objectId: string) =>
      objectId === sirius.id ? sirius : undefined,
    );
    runtime.controller.observerPresentationActive = true;

    runtime.access.handlePick(sirius.id, true);
    await Promise.resolve();

    expect(runtime.scene.selectCatalogObject).toHaveBeenCalledWith(sirius.id);
    expect(runtime.access.selectedId).toBe(sirius.id);
    expect(setTarget).not.toHaveBeenCalled();
    expect(runtime.controller.focusOn).not.toHaveBeenCalled();
  });

  it('adopte ou libère la cible suggérée par la navigation', () => {
    const runtime = createRuntime();
    const events: UniverseEngineEvent[] = [];
    const catalogObject = object('hyg-1', 'Sirius', 'star');

    runtime.engine.subscribe((event) => events.push(event));
    runtime.access.handleNavigationIntent('earth');
    expect(runtime.registry.setNavigationTarget).toHaveBeenCalledWith('earth');
    expect(runtime.controller.adoptZoomTarget).toHaveBeenCalled();
    expect(events).toContainEqual({ type: 'target-changed', objectId: 'earth' });

    events.length = 0;
    runtime.access.handleNavigationIntent('earth');
    expect(events).toEqual([]);

    runtime.catalog.has.mockImplementation((id: string) => id === 'hyg-1');
    runtime.catalog.getDefinition.mockImplementation((id: string) =>
      id === 'hyg-1' ? catalogObject : undefined,
    );
    runtime.scene.getCatalogWorldPosition.mockImplementation((id: string, target: THREE.Vector3) =>
      id === 'hyg-1' ? target.set(4, 2, 1) : null,
    );
    runtime.access.handleNavigationIntent('hyg-1');
    expect(runtime.registry.setNavigationTarget).toHaveBeenLastCalledWith(null);

    runtime.access.handleNavigationIntent(null);
    expect(runtime.controller.releaseTarget).toHaveBeenCalled();
    expect(runtime.registry.setNavigationTarget).toHaveBeenLastCalledWith(null);
    expect(events.at(-1)).toEqual({ type: 'target-changed', objectId: null });
  });

  it('attire le zoom avant vers le curseur et stabilise le zoom arrière', () => {
    const runtime = createRuntime();

    runtime.access.targetId = 'earth';
    runtime.controller.semanticZoomActive = false;
    runtime.controller.controls.target.set(3, -1, 2);
    runtime.access.handleSemanticZoomIntent('mars', 480);

    expect(runtime.controller.zoomSemantically).toHaveBeenLastCalledWith(480);
    expect(runtime.access.targetId).toBe('earth');
    expect(runtime.controller.adoptZoomTarget).not.toHaveBeenCalled();
    expect(runtime.controller.adoptZoomAnchor).toHaveBeenCalledWith(
      runtime.controller.controls.target,
    );

    runtime.controller.semanticZoomActive = true;
    runtime.registry.has.mockReturnValue(false);
    runtime.access.handleSemanticZoomIntent('mars', -480);
    expect(runtime.access.targetId).toBe('mars');
    expect(runtime.registry.setNavigationTarget).toHaveBeenLastCalledWith(null);
    expect(runtime.controller.adoptZoomTarget).not.toHaveBeenCalled();
    expect(runtime.controller.trackTarget).toHaveBeenCalledWith(
      runtime.positions.get('mars'),
      runtime.definitions.get('mars'),
    );
    expect(runtime.controller.adoptZoomAnchor).toHaveBeenLastCalledWith(
      runtime.positions.get('mars'),
    );

    runtime.controller.semanticZoomActive = false;
    runtime.access.handleSemanticZoomIntent('mars', -120);
    expect(runtime.access.targetId).toBe('mars');
    expect(runtime.controller.adoptZoomTarget).not.toHaveBeenCalled();

    runtime.access.handleSemanticZoomIntent(null, -120);
    expect(runtime.access.targetId).toBe('mars');
    expect(runtime.controller.adoptZoomPointer).toHaveBeenLastCalledWith(0, 0);
    expect(runtime.controller.releaseTarget).not.toHaveBeenCalled();

    const pointerCallCount = runtime.controller.adoptZoomPointer.mock.calls.length;

    runtime.controller.controls.target.set(7, -2, 4);
    runtime.access.handleSemanticZoomIntent(null, 480);
    expect(runtime.controller.adoptZoomPointer).toHaveBeenCalledTimes(pointerCallCount);
    expect(runtime.controller.adoptZoomAnchor).toHaveBeenLastCalledWith(
      runtime.controller.controls.target,
    );

    runtime.access.cameraController = null;
    runtime.access.handleSemanticZoomIntent('earth', 480);
  });

  it('ignore une ancre transitoire pendant un changement de référentiel', () => {
    const runtime = createRuntime();

    runtime.access.targetId = 'earth';
    runtime.controller.isTransitioning = true;
    runtime.access.handleSemanticZoomIntent('mars', -480, { x: 0.4, y: -0.2 });

    expect(runtime.access.targetId).toBe('earth');
    expect(runtime.controller.trackTarget).not.toHaveBeenCalled();
    expect(runtime.controller.adoptZoomPointer).toHaveBeenCalledWith(0.4, -0.2);
    expect(runtime.controller.zoomSemantically).toHaveBeenCalledWith(-480);
  });

  it('change de référentiel avec les échelles pendant un aller-retour à la molette', () => {
    const runtime = createRuntime();
    const distances = [
      520, 1_400, 9_600, 17_000, 120_000, 420_000, 120_000, 17_000, 9_600, 1_400, 520, 4.8,
    ];

    installNavigationHierarchy(runtime);
    runtime.access.targetId = 'earth';
    runtime.controller.zoomSemantically.mockImplementation(() => {
      runtime.controller.distanceToTarget = distances.shift()!;
    });

    for (const [deltaY, targetId] of [
      [480, 'sun'],
      [480, 'sun'],
      [480, 'milky-way'],
      [480, 'local-group'],
      [480, 'nearby-universe'],
      [480, 'cosmic-web'],
      [-480, 'nearby-universe'],
      [-480, 'local-group'],
      [-480, 'milky-way'],
      [-480, 'sun'],
      [-480, 'sun'],
      [-480, 'earth'],
    ] as const) {
      runtime.access.handleSemanticZoomIntent(null, deltaY);
      expect(runtime.access.targetId).toBe(targetId);
    }

    expect(runtime.controller.transitionReferenceFrame).toHaveBeenCalledTimes(10);
    expect(runtime.controller.transitionReferenceFrame).toHaveBeenLastCalledWith(
      runtime.positions.get('earth'),
      runtime.definitions.get('earth'),
    );
    expect(runtime.registry.setNavigationTarget).toHaveBeenLastCalledWith('earth');
  });

  it('retrouve une planète arbitraire après un aller-retour sémantique complet', () => {
    const runtime = createRuntime();
    const distances = [
      520, 1_400, 9_600, 17_000, 120_000, 420_000, 120_000, 17_000, 9_600, 1_400, 520, 4.8,
    ];

    installNavigationHierarchy(runtime);
    runtime.access.handleNavigationIntent('mars');
    runtime.controller.zoomSemantically.mockImplementation(() => {
      runtime.controller.distanceToTarget = distances.shift()!;
    });

    for (const [deltaY, targetId] of [
      [480, 'sun'],
      [480, 'sun'],
      [480, 'milky-way'],
      [480, 'local-group'],
      [480, 'nearby-universe'],
      [480, 'cosmic-web'],
      [-480, 'nearby-universe'],
      [-480, 'local-group'],
      [-480, 'milky-way'],
      [-480, 'sun'],
      [-480, 'sun'],
      [-480, 'mars'],
    ] as const) {
      runtime.access.handleSemanticZoomIntent(null, deltaY);
      expect(runtime.access.targetId).toBe(targetId);
    }
  });

  it('synchronise le contexte après un pincement géré nativement par OrbitControls', () => {
    const runtime = createRuntime();
    const events: UniverseEngineEvent[] = [];

    installNavigationHierarchy(runtime);
    runtime.engine.subscribe((event) => events.push(event));
    runtime.access.handleNavigationIntent('earth');
    runtime.controller.distanceToTarget = 540;

    runtime.access.handleCameraSettled(540, 'pinch');

    expect(events).toContainEqual({ type: 'camera-changed', zoom: 540 });
    expect(events).toContainEqual({ type: 'target-changed', objectId: 'sun' });
    expect(runtime.access.targetId).toBe('sun');
    expect(runtime.controller.transitionReferenceFrame).toHaveBeenCalledWith(
      runtime.positions.get('sun'),
      runtime.definitions.get('sun'),
    );

    runtime.access.cameraController = null;
    runtime.access.handleCameraSettled(600, 'interaction');
    expect(events).toContainEqual({ type: 'camera-changed', zoom: 600 });
  });

  it('conserve la cible choisie pendant et à la fin de son travelling', () => {
    const runtime = createRuntime();

    installNavigationHierarchy(runtime);
    runtime.access.handleNavigationIntent('earth');
    runtime.controller.isTransitioning = true;

    runtime.access.handleCameraSettled(9_600, 'interaction');
    expect(runtime.access.targetId).toBe('earth');

    runtime.controller.isTransitioning = false;
    runtime.access.handleCameraSettled(9_600, 'interaction');
    expect(runtime.access.targetId).toBe('earth');

    runtime.access.handleCameraSettled(9_600, 'transition');

    expect(runtime.access.targetId).toBe('earth');
    expect(runtime.controller.transitionReferenceFrame).not.toHaveBeenCalled();
  });

  it('utilise une origine de catalogue sans l’inscrire comme objet Three.js individuel', () => {
    const runtime = createRuntime();
    const catalogStar = object('hyg-1', 'Étoile HYG', 'star', 'milky-way');

    installNavigationHierarchy(runtime);
    runtime.catalog.has.mockImplementation((objectId: string) => objectId === 'hyg-1');
    runtime.catalog.getDefinition.mockImplementation((objectId: string) =>
      objectId === 'hyg-1' ? catalogStar : undefined,
    );
    runtime.scene.getCatalogWorldPosition.mockImplementation(
      (objectId: string, target: THREE.Vector3) =>
        objectId === 'hyg-1' ? target.set(12, 4, -3) : null,
    );
    runtime.access.handleNavigationIntent('hyg-1');
    runtime.access.targetId = 'milky-way';

    runtime.access.synchronizeNavigationContextTarget(runtime.controller, 2);

    expect(runtime.access.targetId).toBe('hyg-1');
    expect(runtime.registry.setNavigationTarget).toHaveBeenLastCalledWith(null);
    expect(runtime.controller.transitionReferenceFrame).toHaveBeenCalledWith(
      new THREE.Vector3(12, 4, -3),
      catalogStar,
    );
  });

  it('répercute un recentrage d’origine sur la position suivie par la caméra', () => {
    const runtime = createRuntime();
    const internals = runtimeInternals(runtime);
    const originShift = new THREE.Vector3(2_000, 3, -4);

    runtime.controller.controls.target.copy(originShift);
    vi.spyOn(internals.floatingOriginManager, 'update').mockReturnValue(true);

    runtime.access.renderFrame(0.01);

    expect(runtime.controller.shiftTrackedPosition).toHaveBeenCalledWith(originShift);
  });

  it('conserve le référentiel courant si la cible d’échelle est indisponible', () => {
    const runtime = createRuntime();

    installNavigationHierarchy(runtime);
    runtime.access.handleNavigationIntent('sun');
    runtime.positions.delete('milky-way');
    runtime.access.synchronizeNavigationContextTarget(runtime.controller, 3);

    expect(runtime.access.targetId).toBe('sun');
    expect(runtime.controller.transitionReferenceFrame).not.toHaveBeenCalled();

    runtime.positions.set('milky-way', new THREE.Vector3());
    runtime.definitions.delete('milky-way');
    runtime.access.synchronizeNavigationContextTarget(runtime.controller, 3);
    expect(runtime.access.targetId).toBe('sun');
  });

  it.each([
    ['registre', (runtime: Runtime) => runtime.access.objectRuntime.replacePrimary(null)],
    ['contrôleur', (runtime: Runtime) => (runtime.access.cameraController = null)],
    ['position', (runtime: Runtime) => runtime.positions.delete('earth')],
    ['définition', (runtime: Runtime) => runtime.definitions.delete('earth')],
  ])('ignore une intention de navigation sans %s', (_label, mutate) => {
    const runtime = createRuntime();

    mutate(runtime);
    runtime.access.handleNavigationIntent('earth');

    expect(runtime.controller.adoptZoomTarget).not.toHaveBeenCalled();
  });

  it('libère une cible absente sans événement et tolère les services déjà détruits', () => {
    const runtime = createRuntime();
    const events: UniverseEngineEvent[] = [];

    runtime.engine.subscribe((event) => events.push(event));
    runtime.access.releaseNavigationTarget();
    expect(events).toEqual([]);

    runtime.access.cameraController = null;
    runtime.access.objectRuntime.replacePrimary(null);
    runtime.access.targetId = 'earth';
    runtime.access.releaseNavigationTarget();
    expect(events).toContainEqual({ type: 'target-changed', objectId: null });
  });

  it('n’émet un nouvel état d’éclipse que lorsque sa phase change ou est forcée', () => {
    const runtime = createRuntime();
    const events: UniverseEngineEvent[] = [];

    runtime.engine.subscribe((event) => events.push(event));
    runtime.access.solarEclipseStatePublisher.publish(appearance('partial'), true);
    runtime.access.solarEclipseStatePublisher.publish(appearance('partial'), false);
    runtime.access.solarEclipseStatePublisher.publish(appearance('total'), false);

    expect(events.filter((event) => event.type === 'solar-eclipse-state')).toHaveLength(2);
  });

  it('résout hasObject via le catalogue lorsque le registre local ne connaît pas l’objet', () => {
    const runtime = createRuntime();

    runtime.registry.has.mockReturnValue(false);
    runtime.catalog.has.mockImplementation((id: string) => id === 'hyg-1');

    expect(runtime.engine.hasObject('hyg-1')).toBe(true);
    runtime.access.objectRuntime.replacePrimary(null);
    expect(runtime.engine.hasObject('unknown')).toBe(false);
  });

  it('reconstruit le registre en conservant cible, sélection et présentation d’éclipse', () => {
    const earlyReturn = createRuntime();

    earlyReturn.access.universeScene = null;
    earlyReturn.access.rebuildObjectRegistry();
    expect(earlyReturn.registry.dispose).not.toHaveBeenCalled();

    earlyReturn.access.streamingRuntime.applyLoadedSpaceTiles([
      earlyReturn.catalog.baseObjects[0]!,
    ]);
    expect(earlyReturn.access.objectRuntime.streamedRegistry).toBeNull();

    const runtime = createRuntime();
    const event = solarEvent();

    runtime.catalog.has.mockImplementation((id: string) => id === 'hyg-1');
    runtime.access.targetId = 'earth';
    runtime.access.selectedId = 'hyg-1';
    runtime.access.solarEclipsePresentation.setPathVisible(event, true, null);
    runtime.access.rebuildObjectRegistry();

    expect(runtime.registry.dispose).toHaveBeenCalledOnce();
    expect(runtime.scene.selectCatalogObject).toHaveBeenLastCalledWith('hyg-1');
    expect(runtime.access.objectRuntime.primaryRegistry).not.toBe(runtime.registry);

    runtime.scene.hasConstellation.mockImplementation(
      (objectId: string) => objectId === 'constellation-orion',
    );
    runtime.access.targetId = null;
    runtime.access.selectedId = 'constellation-orion';
    runtime.access.solarEclipsePresentation.clear(null);
    runtime.access.rebuildObjectRegistry();
    expect(runtime.scene.selectConstellation).toHaveBeenLastCalledWith('constellation-orion');

    runtime.access.targetId = 'unknown';
    runtime.access.selectedId = 'earth';
    runtime.access.solarEclipsePresentation.showObserverView(event, 1.08, runtime.registry);
    runtime.access.solarEclipsePresentation.setPathVisible(event, true, null);
    runtime.access.rebuildObjectRegistry();
    expect(runtime.scene.selectCatalogObject).toHaveBeenLastCalledWith(null);

    runtime.access.targetId = null;
    runtime.access.selectedId = null;
    runtime.access.solarEclipsePresentation.showOrbitalView(event, runtime.registry);
    runtime.access.rebuildObjectRegistry();

    runtime.access.solarEclipsePresentation.clear(null);
    runtime.access.rebuildObjectRegistry();

    runtime.engine.dispose();
  });
});

interface AssetOptions {
  readonly binaryStatus?: number;
  readonly binaryBuffer?: ArrayBuffer;
  readonly constellationCatalog?: ConstellationCatalog;
  readonly spaceTileIndex?: SpaceTileIndex;
  readonly starTileSource?: boolean;
  readonly tileBodies?: Readonly<Record<string, unknown>>;
  readonly cosmicGroupBuffer?: ArrayBuffer;
  readonly cosmicGroupStatus?: number;
  readonly cosmicStructureBuffer?: ArrayBuffer;
  readonly cosmicStructureMetadata?: unknown;
  readonly cosmicWebVolumeBuffer?: ArrayBuffer;
  readonly tempelSpineBuffer?: ArrayBuffer;
  readonly tempelSpineStatus?: number;
  readonly exoplanetBuffer?: ArrayBuffer;
  readonly exoplanetMetadata?: unknown;
}

function installAssets(objects: readonly SpaceObject[], options: AssetOptions = {}): void {
  const datasets: object[] = [
    {
      id: 'objects',
      url: '/data/objects.json',
      type: 'json',
    },
  ];
  const responses: Record<string, Response> = {
    '/data/manifest.json': jsonResponse({
      version: '1.0.0',
      datasets,
    }),
    '/data/objects.json': jsonResponse({
      version: '1.0.0',
      objects,
    }),
  };

  if (options.binaryStatus !== undefined || options.binaryBuffer !== undefined) {
    datasets.push({
      id: 'stars',
      url: '/data/stars.bin',
      type: 'binary',
      format: 'star-catalog-v2',
    });
    responses['/data/stars.bin'] =
      options.binaryBuffer !== undefined
        ? successfulBinaryResponse(options.binaryBuffer)
        : failedResponse(options.binaryStatus!);
  }
  if (options.cosmicGroupStatus !== undefined || options.cosmicGroupBuffer !== undefined) {
    datasets.push({
      id: 'cosmicflows4-groups',
      url: '/data/cosmic-groups.bin',
      type: 'cosmic-group-catalog',
      format: 'cosmicflows4-group-catalog-v2',
    });
    responses['/data/cosmic-groups.bin'] =
      options.cosmicGroupBuffer !== undefined
        ? successfulBinaryResponse(options.cosmicGroupBuffer)
        : failedResponse(options.cosmicGroupStatus!);
  }
  if (options.cosmicStructureBuffer !== undefined && options.cosmicStructureMetadata) {
    datasets.push({
      id: 'cosmic-structures',
      url: '/data/cosmic-structures.bin',
      metadataUrl: '/data/cosmic-structures.json',
      type: 'cosmic-structure-catalog',
      format: 'cosmic-structure-catalog-v1',
    });
    responses['/data/cosmic-structures.json'] = jsonResponse(options.cosmicStructureMetadata);
    responses['/data/cosmic-structures.bin'] = successfulBinaryResponse(
      options.cosmicStructureBuffer,
    );
  }
  if (options.cosmicWebVolumeBuffer) {
    datasets.push({
      id: 'cosmic-web-density',
      url: '/data/cosmic-web-density.bin',
      type: 'cosmic-web-volume',
      format: 'cosmic-web-volume-v1',
    });
    responses['/data/cosmic-web-density.bin'] = successfulBinaryResponse(
      options.cosmicWebVolumeBuffer,
    );
  }
  if (options.tempelSpineBuffer !== undefined || options.tempelSpineStatus !== undefined) {
    datasets.push({
      id: 'tempel-filament-spines',
      url: '/data/tempel-spines.bin',
      type: 'tempel-filament-spine-catalog',
      format: 'tempel-filament-spines-v1',
    });
    responses['/data/tempel-spines.bin'] =
      options.tempelSpineBuffer !== undefined
        ? successfulBinaryResponse(options.tempelSpineBuffer)
        : failedResponse(options.tempelSpineStatus!);
  }
  if (options.exoplanetBuffer !== undefined && options.exoplanetMetadata) {
    datasets.push({
      id: 'nasa-confirmed-exoplanets',
      url: '/data/exoplanets.bin',
      metadataUrl: '/data/exoplanets.meta.json',
      type: 'exoplanet-catalog',
      format: 'exoplanet-catalog-v1',
    });
    responses['/data/exoplanets.meta.json'] = jsonResponse(options.exoplanetMetadata);
    responses['/data/exoplanets.bin'] = successfulBinaryResponse(options.exoplanetBuffer);
  }
  if (options.constellationCatalog) {
    datasets.push({
      id: 'constellations',
      url: '/data/stars/constellations.json',
      type: 'constellation-lines',
      format: 'constellation-lines-v1',
    });
    responses['/data/stars/constellations.json'] = jsonResponse(options.constellationCatalog);
  }
  if (options.starTileSource) {
    datasets.push({
      id: 'hyg-star-tiles',
      url: '/data/stars/tiles/index.json',
      type: 'star-tile-index',
      format: 'star-tiles-v2',
      starCatalogId: 'stars',
    });
  }
  if (options.spaceTileIndex) {
    datasets.push({
      id: 'nearby-universe',
      url: '/data/tiles/index.json',
      type: 'space-tile-index',
      format: 'space-tiles-v1',
    });
    responses['/data/tiles/index.json'] = jsonResponse(options.spaceTileIndex);
    for (const [url, body] of Object.entries(options.tileBodies ?? {})) {
      responses[url] = jsonResponse(body);
    }
  }

  vi.stubGlobal(
    'fetch',
    vi.fn(async (input: RequestInfo | URL): Promise<Response> => {
      const key =
        typeof input === 'string' ? input : input instanceof URL ? input.toString() : input.url;

      return responses[key] ?? failedResponse(404);
    }),
  );
}

function installNearbyUniverseAssets(): void {
  installAssets([nearbyUniverseRoot()], {
    spaceTileIndex: testSpaceTileIndex(),
    tileBodies: {
      '/data/tiles/a.json': {
        version: '1.0.0',
        objects: [nearbyGalaxy('galaxy-a', [0, 0, 0])],
      },
      '/data/tiles/b.json': {
        version: '1.0.0',
        objects: [nearbyGalaxy('galaxy-b', [10, 0, 0])],
      },
    },
  });
}

function createTestEngine(): UniverseEngine {
  return new UniverseEngine(
    rendererHarness.FakeWebGLRenderer as unknown as WebGlRendererConstructor,
  );
}

function sizedContainer(width: number, height: number): HTMLDivElement {
  const container = document.createElement('div');

  Object.defineProperties(container, {
    clientWidth: { configurable: true, value: width },
    clientHeight: { configurable: true, value: height },
  });

  return container;
}

function installCanvasContext(): void {
  const gradient = {
    addColorStop: vi.fn(),
  };
  const context = {
    createRadialGradient: vi.fn(() => gradient),
    fillRect: vi.fn(),
    save: vi.fn(),
    translate: vi.fn(),
    scale: vi.fn(),
    restore: vi.fn(),
    beginPath: vi.fn(),
    arc: vi.fn(),
    fill: vi.fn(),
    clearRect: vi.fn(),
    setTransform: vi.fn(),
    measureText: vi.fn(() => ({ width: 80 })),
    roundRect: vi.fn(),
    moveTo: vi.fn(),
    lineTo: vi.fn(),
    fillText: vi.fn(),
    setLineDash: vi.fn(),
    stroke: vi.fn(),
    createImageData: vi.fn((width: number, height: number) => ({
      data: new Uint8ClampedArray(width * height * 4),
      width,
      height,
    })),
    putImageData: vi.fn(),
  };

  vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue(
    context as unknown as CanvasRenderingContext2D,
  );
}

function jsonResponse(body: unknown): Response {
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
    arrayBuffer: async () => new ArrayBuffer(0),
  } as Response;
}

function successfulBinaryResponse(buffer: ArrayBuffer): Response {
  return {
    ok: true,
    status: 200,
    arrayBuffer: async () => buffer,
  } as Response;
}

interface EngineAccess {
  initialized: boolean;
  initializationBootstrap: UniverseInitializationBootstrap;
  renderer: FakeRenderer | null;
  camera: THREE.PerspectiveCamera | null;
  universeScene: FakeUniverseScene | null;
  cameraController: FakeCameraController | null;
  objectRuntime: FakeObjectRuntime;
  streamingRuntime: UniverseStreamingRuntime;
  labelManager: FakeLabelManager | null;
  catalogRuntime: FakeCatalogRuntime | null;
  selectionManager: FakeSelectionManager | null;
  renderLoop: FakeRenderLoop | null;
  blackHoleLensingPass: FakeBlackHoleLensingPass | null;
  container: HTMLElement | null;
  targetId: string | null;
  selectedId: string | null;
  solarEclipsePresentation: SolarEclipsePresentationController;
  solarEclipseStatePublisher: SolarEclipseStatePublisher;
  renderFrame(deltaSeconds: number): void;
  followCurrentTarget(): void;
  handlePick(objectId: string | null, focusRequested: boolean): void;
  handleNavigationIntent(objectId: string | null): void;
  handleSemanticZoomIntent(
    objectId: string | null,
    deltaY: number,
    pointer?: { x: number; y: number },
  ): void;
  handleCameraSettled(
    distance: number,
    source: 'interaction' | 'pinch' | 'transition' | 'zoom',
  ): void;
  synchronizeNavigationContextTarget(controller: FakeCameraController, lodLevel: number): void;
  releaseNavigationTarget(): void;
  rebuildObjectRegistry(): void;
  getDefinition(objectId: string): SpaceObject | undefined;
  getWorldPosition(objectId: string, target?: THREE.Vector3): THREE.Vector3 | null;
  getLabelObjects(): readonly { readonly id: string }[];
  emitDataReady(streamingCoordinator: SpaceStreamingCoordinator): void;
  ensureTempelFilamentSpines(): Promise<void>;
}

interface Runtime {
  engine: UniverseEngine;
  access: EngineAccess;
  renderer: FakeRenderer;
  camera: THREE.PerspectiveCamera;
  scene: FakeUniverseScene;
  controller: FakeCameraController;
  registry: FakeRegistry;
  labels: FakeLabelManager;
  catalog: FakeCatalogRuntime;
  selection: FakeSelectionManager;
  loop: FakeRenderLoop;
  lensing: FakeBlackHoleLensingPass;
  definitions: Map<string, SpaceObject>;
  positions: Map<string, THREE.Vector3>;
}

interface RuntimeInternals {
  readonly timeController: TimeController;
  readonly floatingOriginManager: FloatingOriginManager;
  readonly lodManager: LodManager;
  readonly debugRuntime: UniverseDebugRuntime;
  readonly adaptiveRenderingRuntime: UniverseAdaptiveRenderingRuntime;
  readonly frameSimulation: {
    update(deltaSeconds: number, registry: FakeRegistry): void;
  };
  readonly frameNavigation: {
    update(deltaSeconds: number, services: object): number;
  };
  readonly frameContent: {
    update(deltaSeconds: number, services: object, lodLevel: number): void;
  };
  readonly frameRenderer: {
    render(deltaSeconds: number, services: object, lodLevel: number): void;
  };
}

type FakeRenderer = InstanceType<typeof rendererHarness.FakeWebGLRenderer>;

interface FakeUniverseScene {
  readonly scene: THREE.Scene;
  readonly spaceRoot: THREE.Group;
  readonly setQuality: ReturnType<typeof vi.fn>;
  readonly setPixelRatio: ReturnType<typeof vi.fn>;
  readonly setStarClusterTiles: ReturnType<typeof vi.fn>;
  readonly setConstellationsEnabled: ReturnType<typeof vi.fn>;
  readonly setCosmicMapLayers: ReturnType<typeof vi.fn>;
  readonly setTempelFilamentSpineCatalog: ReturnType<typeof vi.fn>;
  readonly isCatalogObjectVisibleForLabels: ReturnType<typeof vi.fn>;
  readonly hasConstellation: ReturnType<typeof vi.fn>;
  readonly getConstellationDefinition: ReturnType<typeof vi.fn>;
  readonly getConstellationWorldPosition: ReturnType<typeof vi.fn>;
  readonly getConstellationFocusRadius: ReturnType<typeof vi.fn>;
  readonly selectConstellation: ReturnType<typeof vi.fn>;
  readonly hoverConstellation: ReturnType<typeof vi.fn>;
  readonly hoverCatalogObject: ReturnType<typeof vi.fn>;
  readonly selectCatalogObject: ReturnType<typeof vi.fn>;
  readonly getCatalogWorldPosition: ReturnType<typeof vi.fn>;
  readonly getCatalogPickables: ReturnType<typeof vi.fn>;
  readonly ensureMilkyWayAtlas: ReturnType<typeof vi.fn>;
  readonly updateLod: ReturnType<typeof vi.fn>;
  readonly dispose: ReturnType<typeof vi.fn>;
  visibleCatalogStarCount: number;
  visibleExoplanetHostCount: number;
  exoplanetCount: number;
  visibleCosmicGroupCount: number;
  visibleCosmicFilamentCount: number;
  visibleCosmicStructureCount: number;
  tempelFilamentSpineCount: number;
  tempelFilamentSpinePointCount: number;
  tempelFilamentSpineSegmentCount: number;
  tempelFilamentSpineTileCount: number;
  visibleTempelFilamentSpineSegmentCount: number;
  visibleStarClusterCount: number;
  activeStarTileCount: number;
  starClusterRepresentationCount: number;
}

interface FakeCameraController {
  readonly controls: { target: THREE.Vector3 };
  readonly focusOn: ReturnType<typeof vi.fn>;
  readonly focusOnFromDirection: ReturnType<typeof vi.fn>;
  readonly completeFocusTransition: ReturnType<typeof vi.fn>;
  readonly observeFrom: ReturnType<typeof vi.fn>;
  readonly follow: ReturnType<typeof vi.fn>;
  readonly zoomBy: ReturnType<typeof vi.fn>;
  readonly zoomSemantically: ReturnType<typeof vi.fn>;
  readonly update: ReturnType<typeof vi.fn>;
  readonly adoptZoomAnchor: ReturnType<typeof vi.fn>;
  readonly adoptZoomPointer: ReturnType<typeof vi.fn>;
  readonly adoptZoomTarget: ReturnType<typeof vi.fn>;
  readonly trackTarget: ReturnType<typeof vi.fn>;
  readonly shiftTrackedPosition: ReturnType<typeof vi.fn>;
  readonly rebaseTarget: ReturnType<typeof vi.fn>;
  readonly transitionReferenceFrame: ReturnType<typeof vi.fn>;
  readonly setNavigationConstraints: ReturnType<typeof vi.fn>;
  readonly releaseTarget: ReturnType<typeof vi.fn>;
  readonly dispose: ReturnType<typeof vi.fn>;
  distanceToTarget: number;
  isTransitioning: boolean;
  observerPresentationActive: boolean;
  semanticZoomActive: boolean;
  lastZoomDiagnostics: CameraZoomDiagnostics | null;
}

interface FakeRegistry extends SolarEclipsePresentationRegistry {
  readonly has: ReturnType<typeof vi.fn>;
  readonly getDefinition: ReturnType<typeof vi.fn>;
  readonly getWorldPosition: ReturnType<typeof vi.fn>;
  readonly getLensingForeground: ReturnType<typeof vi.fn>;
  readonly getOrbitRadius: ReturnType<typeof vi.fn>;
  readonly getAdornmentDiagnostics: ReturnType<typeof vi.fn>;
  readonly getVisualDiagnostics: ReturnType<typeof vi.fn>;
  readonly setNavigationTarget: ReturnType<typeof vi.fn>;
  readonly select: ReturnType<typeof vi.fn>;
  readonly updatePositions: ReturnType<typeof vi.fn>;
  readonly updateBodyRotations: ReturnType<typeof vi.fn>;
  readonly setDisplayOptions: ReturnType<typeof vi.fn>;
  readonly updateLod: ReturnType<typeof vi.fn>;
  readonly dispose: ReturnType<typeof vi.fn>;
  visibleObjectCount: number;
  batchedGalaxyCount: number;
}

interface FakeObjectRuntime {
  readonly primaryRegistry: FakeRegistry | null;
  readonly streamedRegistry: FakeRegistry | null;
  readonly exoplanetSystemRegistry: {
    has(objectId: string): boolean;
    getWorldPosition(objectId: string, target?: THREE.Vector3): THREE.Vector3 | null;
  } | null;
  replacePrimary(registry: FakeRegistry | null): void;
  replaceStreamed(registry: FakeRegistry | null): void;
  replaceExoplanetSystem(registry: FakeRegistry | null): void;
  getRegistry(objectId: string): FakeRegistry | null;
  setNavigationTarget(objectId: string | null): void;
  select(objectId: string | null): void;
}

interface FakeLabelManager {
  readonly resize: ReturnType<typeof vi.fn>;
  readonly render: ReturnType<typeof vi.fn>;
  readonly clear: ReturnType<typeof vi.fn>;
  readonly setEnabled: ReturnType<typeof vi.fn>;
  readonly setQuality: ReturnType<typeof vi.fn>;
  readonly setDensity: ReturnType<typeof vi.fn>;
  readonly setTransientObject: ReturnType<typeof vi.fn>;
  readonly setDetailsPanelVisible: ReturnType<typeof vi.fn>;
  readonly setTransitioning: ReturnType<typeof vi.fn>;
  readonly setObjects: ReturnType<typeof vi.fn>;
  readonly setNameResolver: ReturnType<typeof vi.fn>;
  readonly dispose: ReturnType<typeof vi.fn>;
}

interface FakeStarCatalogRegistry {
  readonly has: ReturnType<typeof vi.fn>;
  readonly getDefinition: ReturnType<typeof vi.fn>;
  readonly getLabelObjects: ReturnType<typeof vi.fn>;
  readonly getStellarObservationCatalog: ReturnType<typeof vi.fn>;
  readonly getStellarObservationConstellations: ReturnType<typeof vi.fn>;
}

interface FakeCatalogRuntime {
  readonly baseObjects: readonly SpaceObject[];
  readonly starCatalogRegistry: FakeStarCatalogRegistry | null;
  readonly exoplanetCatalogRegistry: null;
  readonly cosmicGroupCatalogRegistry: null;
  cosmicStructureCatalogRegistry: { readonly has: (objectId: string) => boolean } | null;
  readonly spaceTileManager: null;
  readonly starTileManager: null;
  tempelFilamentSpineSource: { readonly id: string; readonly url: string } | null;
  readonly has: ReturnType<typeof vi.fn>;
  readonly isCatalogStar: ReturnType<typeof vi.fn>;
  readonly isExoplanetHost: ReturnType<typeof vi.fn>;
  readonly supportsWheelNavigation: ReturnType<typeof vi.fn>;
  readonly getDefinition: ReturnType<typeof vi.fn>;
  readonly getSearchEntries: ReturnType<typeof vi.fn>;
  readonly getLabelObjects: ReturnType<typeof vi.fn>;
  hasDeferredCatalogs: boolean;
  readonly installDeferredCatalogs: ReturnType<typeof vi.fn>;
}

interface FakeSelectionManager {
  readonly clearNavigationLock: ReturnType<typeof vi.fn>;
  readonly dispose: ReturnType<typeof vi.fn>;
}

interface FakeRenderLoop {
  readonly start: ReturnType<typeof vi.fn>;
  readonly stop: ReturnType<typeof vi.fn>;
}

interface FakeBlackHoleLensingPass {
  readonly setSize: ReturnType<typeof vi.fn>;
  readonly render: ReturnType<typeof vi.fn>;
  readonly dispose: ReturnType<typeof vi.fn>;
}

function objectAdornmentDiagnostics() {
  return {
    selectionMarker: { depthTest: true },
    rotationGuide: {
      visible: true,
      objectId: 'earth',
      direction: 'prograde',
      style: 'moving-highlight',
      parentName: 'earth-body',
      directionScale: 1,
      vertexCount: 82,
      hasVertexColors: true,
    },
  };
}

function objectVisualDiagnostics() {
  return {
    objectId: 'earth',
    bodyPresent: true,
    bodyVisible: true,
    visualVisible: true,
    nearVisible: true,
    nearBlend: 1,
    visibilityBlend: 1,
    opacity: 1,
    transparent: true,
    depthTest: true,
    depthWrite: true,
    surfaceTexture: {
      requested: true,
      loaded: true,
      source: 'textures/earth.jpg',
      width: 2048,
      height: 1024,
    },
  };
}

function createRuntime(): Runtime {
  const definitions = new Map<string, SpaceObject>([
    ['sun', object('sun', 'Soleil', 'star')],
    ['earth', object('earth', 'Terre', 'planet', 'sun')],
    ['moon', object('moon', 'Lune', 'moon', 'earth')],
    ['mars', object('mars', 'Mars', 'planet', 'sun')],
  ]);
  const positions = new Map<string, THREE.Vector3>([
    ['sun', new THREE.Vector3(100, 0, 0)],
    ['earth', new THREE.Vector3(0, 0, 0)],
    ['moon', new THREE.Vector3(10, 0, 0)],
    ['mars', new THREE.Vector3(20, 0, 0)],
  ]);
  const blackHoleForeground = new THREE.Group();
  const registry: FakeRegistry = {
    has: vi.fn((id: string) => definitions.has(id)),
    getDefinition: vi.fn((id: string) => definitions.get(id)),
    getWorldPosition: vi.fn((id: string, target = new THREE.Vector3()) => {
      const position = positions.get(id);

      return position ? target.copy(position) : null;
    }),
    getLensingForeground: vi.fn((id: string) =>
      definitions.get(id)?.type === 'black-hole' ? blackHoleForeground : null,
    ),
    getOrbitRadius: vi.fn(() => 18),
    getAdornmentDiagnostics: vi.fn(() => objectAdornmentDiagnostics()),
    getVisualDiagnostics: vi.fn(() => objectVisualDiagnostics()),
    setNavigationTarget: vi.fn(),
    select: vi.fn(),
    setSolarObserverActive: vi.fn(),
    clearSolarEclipsePath: vi.fn(),
    showSolarEclipsePath: vi.fn(),
    updatePositions: vi.fn(() => appearance('partial')),
    updateBodyRotations: vi.fn(),
    setDisplayOptions: vi.fn(),
    updateLod: vi.fn(),
    dispose: vi.fn(),
    visibleObjectCount: 4,
    batchedGalaxyCount: 7,
  };
  const controller: FakeCameraController = {
    controls: { target: new THREE.Vector3() },
    focusOn: vi.fn(),
    focusOnFromDirection: vi.fn(),
    completeFocusTransition: vi.fn(),
    observeFrom: vi.fn(),
    follow: vi.fn(),
    zoomBy: vi.fn(),
    zoomSemantically: vi.fn(),
    update: vi.fn(),
    adoptZoomAnchor: vi.fn(),
    adoptZoomPointer: vi.fn(),
    adoptZoomTarget: vi.fn(),
    trackTarget: vi.fn(),
    shiftTrackedPosition: vi.fn(),
    rebaseTarget: vi.fn(),
    transitionReferenceFrame: vi.fn(),
    setNavigationConstraints: vi.fn(),
    releaseTarget: vi.fn(),
    dispose: vi.fn(),
    distanceToTarget: 24,
    isTransitioning: false,
    observerPresentationActive: false,
    semanticZoomActive: false,
    lastZoomDiagnostics: null,
  };
  const scene: FakeUniverseScene = {
    scene: new THREE.Scene(),
    spaceRoot: new THREE.Group(),
    setQuality: vi.fn(),
    setPixelRatio: vi.fn(),
    setStarClusterTiles: vi.fn(async () => undefined),
    setConstellationsEnabled: vi.fn(),
    setCosmicMapLayers: vi.fn(),
    setTempelFilamentSpineCatalog: vi.fn(async () => undefined),
    isCatalogObjectVisibleForLabels: vi.fn(() => null),
    hasConstellation: vi.fn(() => false),
    getConstellationDefinition: vi.fn(() => undefined),
    getConstellationWorldPosition: vi.fn(() => null),
    getConstellationFocusRadius: vi.fn(() => null),
    selectConstellation: vi.fn(),
    hoverConstellation: vi.fn(),
    hoverCatalogObject: vi.fn(),
    selectCatalogObject: vi.fn(),
    getCatalogWorldPosition: vi.fn(() => null),
    getCatalogPickables: vi.fn(() => []),
    ensureMilkyWayAtlas: vi.fn(async () => true),
    updateLod: vi.fn(),
    dispose: vi.fn(),
    visibleCatalogStarCount: 2,
    visibleExoplanetHostCount: 4_747,
    exoplanetCount: 6_333,
    visibleCosmicGroupCount: 37_730,
    visibleCosmicFilamentCount: 42_000,
    visibleCosmicStructureCount: 9_985,
    tempelFilamentSpineCount: 15_421,
    tempelFilamentSpinePointCount: 275_599,
    tempelFilamentSpineSegmentCount: 260_178,
    tempelFilamentSpineTileCount: 8,
    visibleTempelFilamentSpineSegmentCount: 18_000,
    visibleStarClusterCount: 0,
    activeStarTileCount: 0,
    starClusterRepresentationCount: 0,
  };
  const labels: FakeLabelManager = {
    resize: vi.fn(),
    render: vi.fn(),
    clear: vi.fn(),
    setEnabled: vi.fn(),
    setQuality: vi.fn(),
    setDensity: vi.fn(),
    setTransientObject: vi.fn(),
    setDetailsPanelVisible: vi.fn(),
    setTransitioning: vi.fn(),
    setObjects: vi.fn(),
    setNameResolver: vi.fn(),
    dispose: vi.fn(),
  };
  const starCatalogRegistry: FakeStarCatalogRegistry = {
    has: vi.fn(() => false),
    getDefinition: vi.fn(() => undefined),
    getLabelObjects: vi.fn(() => []),
    getStellarObservationCatalog: vi.fn(() => []),
    getStellarObservationConstellations: vi.fn(() => []),
  };
  const catalog: FakeCatalogRuntime = {
    baseObjects: [...definitions.values()],
    starCatalogRegistry,
    exoplanetCatalogRegistry: null,
    cosmicGroupCatalogRegistry: null,
    cosmicStructureCatalogRegistry: null,
    spaceTileManager: null,
    starTileManager: null,
    tempelFilamentSpineSource: null,
    has: vi.fn(() => false),
    isCatalogStar: vi.fn(() => false),
    isExoplanetHost: vi.fn(() => false),
    supportsWheelNavigation: vi.fn(() => false),
    getDefinition: vi.fn(() => undefined),
    getSearchEntries: vi.fn(() => []),
    getLabelObjects: vi.fn(() => []),
    hasDeferredCatalogs: false,
    installDeferredCatalogs: vi.fn(async () => []),
  };
  const selection: FakeSelectionManager = {
    clearNavigationLock: vi.fn(),
    dispose: vi.fn(),
  };
  const loop: FakeRenderLoop = {
    start: vi.fn(),
    stop: vi.fn(),
  };
  const lensing: FakeBlackHoleLensingPass = {
    setSize: vi.fn(),
    render: vi.fn(
      (activeRenderer: FakeRenderer, activeScene: THREE.Scene, activeCamera: THREE.Camera) =>
        activeRenderer.render(activeScene, activeCamera),
    ),
    dispose: vi.fn(),
  };
  const renderer = new rendererHarness.FakeWebGLRenderer({});
  const camera = new THREE.PerspectiveCamera(48, 1, 0.025, 100_000);
  const container = sizedContainer(800, 450);
  const engine = createTestEngine();
  const access = engine as unknown as EngineAccess;

  access.objectRuntime.replacePrimary(registry);

  Object.defineProperty(renderer.domElement, 'clientHeight', {
    configurable: true,
    value: 450,
  });
  Object.assign(access, {
    initialized: true,
    renderer,
    camera,
    universeScene: scene,
    cameraController: controller,
    labelManager: labels,
    catalogRuntime: catalog,
    selectionManager: selection,
    renderLoop: loop,
    blackHoleLensingPass: lensing,
    container,
  });
  access.streamingRuntime.install(
    [...definitions.values()],
    new SpaceStreamingCoordinator(null, null, {
      isActive: () => true,
      onSpaceTilesChanged: vi.fn(),
      onStarTilesChanged: vi.fn(),
      onWarning: vi.fn(),
    }),
  );

  return {
    engine,
    access,
    renderer,
    camera,
    scene,
    controller,
    registry,
    labels,
    catalog,
    selection,
    loop,
    lensing,
    definitions,
    positions,
  };
}

function installNavigationHierarchy(runtime: Runtime): void {
  runtime.definitions.set('sun', object('sun', 'Soleil', 'star', 'milky-way'));
  runtime.definitions.set('milky-way', object('milky-way', 'Voie lactée', 'galaxy', 'local-group'));
  runtime.definitions.set('local-group', {
    ...object('local-group', 'Groupe local', 'region', 'nearby-universe'),
    referenceFrame: 'local-group',
  });
  runtime.definitions.set('nearby-universe', {
    ...object('nearby-universe', 'Univers proche', 'region', 'cosmic-web'),
    referenceFrame: 'nearby-universe',
  });
  runtime.definitions.set('cosmic-web', {
    ...object('cosmic-web', 'Réseau cosmique', 'universe'),
    referenceFrame: 'cosmic-web',
  });
  runtime.positions.set('milky-way', new THREE.Vector3(0, 0, 0));
  runtime.positions.set('local-group', new THREE.Vector3(0, 0, 0));
  runtime.positions.set('nearby-universe', new THREE.Vector3(0, 0, 0));
  runtime.positions.set('cosmic-web', new THREE.Vector3(0, 0, 0));
}

function runtimeInternals(runtime: Runtime): RuntimeInternals {
  return runtime.access as unknown as RuntimeInternals;
}

function object(
  id: string,
  name: string,
  type: SpaceObject['type'],
  parentId?: string,
): SpaceObject {
  return {
    id,
    name,
    type,
    ...(parentId ? { parentId } : {}),
    referenceFrame: 'solar-system',
    scientificConfidence: 'calculated',
    visual: {
      visualRadius: id === 'sun' ? 5 : id === 'earth' ? 2 : 1,
      scaleMode: 'adaptive',
    },
    positionProvider: {
      type: 'static',
      position: [0, 0, 0],
      unit: 'astronomical-unit',
    },
  };
}

function rotationDefinition(
  objectId: string,
  signedPeriodHours: number,
): NonNullable<SpaceObject['rotation']> {
  return {
    siderealPeriodHours: Math.abs(signedPeriodHours),
    direction: signedPeriodHours < 0 ? 'retrograde' : 'prograde',
    bodyFixedFrame: objectId === 'earth' ? 'EARTH_GEOGRAPHIC' : `IAU_${objectId.toUpperCase()}`,
    orientationModel: objectId === 'earth' ? 'earth-geographic' : 'iau-wgccre-2015',
    scientificConfidence: 'calculated',
    source: 'https://naif.jpl.nasa.gov/pub/naif/generic_kernels/pck/pck00011.tpc',
  };
}

function nearbyUniverseRoot(): SpaceObject {
  return {
    id: 'nearby-universe',
    name: 'Univers proche',
    type: 'region',
    referenceFrame: 'nearby-universe',
    scientificConfidence: 'illustrative',
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

function nearbyGalaxy(id: string, position: [number, number, number]): SpaceObject {
  return {
    id,
    name: id,
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

function testSpaceTileIndex(): SpaceTileIndex {
  return {
    version: '1.0.0',
    tiles: [
      {
        id: 'tile-a',
        level: 0,
        referenceFrame: 'nearby-universe',
        url: '/data/tiles/a.json',
        bounds: {
          min: [-1, -1, -1],
          max: [1, 1, 1],
          unit: 'megaparsec',
        },
        objectIds: ['galaxy-a'],
      },
      {
        id: 'tile-b',
        level: 0,
        referenceFrame: 'nearby-universe',
        url: '/data/tiles/b.json',
        bounds: {
          min: [9, -1, -1],
          max: [11, 1, 1],
          unit: 'megaparsec',
        },
        objectIds: ['galaxy-b'],
      },
    ],
    searchEntries: [
      {
        id: 'galaxy-a',
        name: 'Galaxie A',
        aliases: [],
        type: 'galaxy',
      },
      {
        id: 'galaxy-b',
        name: 'Galaxie B',
        aliases: [],
        type: 'galaxy',
      },
    ],
    overviewEntries: [
      {
        id: 'galaxy-a',
        position: [0, 0, 0],
        unit: 'megaparsec',
        color: '#9fc8ef',
        visualRadius: 40,
      },
      {
        id: 'galaxy-b',
        position: [10, 0, 0],
        unit: 'megaparsec',
        color: '#e4bb91',
        visualRadius: 40,
      },
    ],
  };
}

function deferredValue<T>(): {
  promise: Promise<T>;
  resolve: (value: T) => void;
} {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((resolvePromise) => {
    resolve = resolvePromise;
  });

  return { promise, resolve };
}

function testConstellationCatalog(): ConstellationCatalog {
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
        segments: [[3_229, 6_960]],
      },
    ],
  };
}

function appearance(phase: SolarEclipseAppearance['phase']): SolarEclipseAppearance {
  return {
    phase,
    sunPositionInEarthRadii: { x: 10, y: 0, z: 0 },
    moonPositionInEarthRadii: { x: 2, y: 0, z: 0 },
    shadowDirection: { x: 1, y: 0, z: 0 },
    centralLatitude: phase === 'none' ? null : 43,
    centralLongitude: phase === 'none' ? null : -1,
  };
}

function solarEvent(overrides: Partial<EarthEclipseEvent> = {}): EarthEclipseEvent {
  return {
    id: 'solar-total',
    family: 'solar',
    kind: 'total',
    scope: 'global',
    peak: {
      julianDay: dateToJulianDay(new Date('2026-08-12T17:45:53.800Z')),
    },
    obscuration: 1,
    durationMinutes: 4,
    latitude: 65.2,
    longitude: -25.2,
    observerName: null,
    observerTimeZone: null,
    sunAltitudeDegrees: null,
    localContacts: null,
    ...overrides,
  };
}

function starCatalogBuffer(catalogIds: readonly number[] = [3_229]): ArrayBuffer {
  const encoder = new TextEncoder();
  const name = encoder.encode('Sirius');
  const aliases = encoder.encode('HIP 32349\u001fα CMa');
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

function exoplanetCatalogBuffer(): ArrayBuffer {
  const encoder = new TextEncoder();
  const stringBytes: number[] = [0];
  const addString = (value: string): number => {
    const offset = stringBytes.length;

    stringBytes.push(...encoder.encode(value), 0);

    return offset;
  };
  const hostName = addString('Test Host');
  const spectralType = addString('G2 V');
  const planetName = addString('Test Host b');
  const letter = addString('b');
  const method = addString('Transit');
  const facility = addString('Kepler');
  const massProvenance = addString('Mass');
  const planetOffset = EXOPLANET_CATALOG_HEADER_BYTES + EXOPLANET_CATALOG_HOST_RECORD_BYTES;
  const stringsOffset = planetOffset + EXOPLANET_CATALOG_PLANET_RECORD_BYTES;
  const buffer = new ArrayBuffer(stringsOffset + stringBytes.length);
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
  view.setUint32(24, stringsOffset, true);
  view.setUint32(28, stringBytes.length, true);

  const hostOffset = EXOPLANET_CATALOG_HEADER_BYTES;

  view.setUint32(hostOffset, hostName, true);
  view.setUint32(hostOffset + 4, 0, true);
  view.setUint32(hostOffset + 8, spectralType, true);
  view.setUint32(hostOffset + 12, 0, true);
  view.setUint16(hostOffset + 16, 1, true);
  view.setUint8(hostOffset + 18, 1);
  view.setUint8(hostOffset + 19, 0);
  view.setFloat64(hostOffset + 20, 12, true);
  view.setFloat64(hostOffset + 28, 24, true);
  view.setFloat64(hostOffset + 36, 10, true);
  view.setFloat32(hostOffset + 44, 5_700, true);
  view.setFloat32(hostOffset + 48, 1, true);
  view.setFloat32(hostOffset + 52, 1, true);
  view.setFloat32(hostOffset + 56, 8, true);
  view.setUint32(hostOffset + 60, 0, true);

  view.setUint32(planetOffset, planetName, true);
  view.setUint32(planetOffset + 4, letter, true);
  view.setUint32(planetOffset + 8, method, true);
  view.setUint32(planetOffset + 12, facility, true);
  view.setUint32(planetOffset + 16, massProvenance, true);
  view.setUint32(planetOffset + 20, 0, true);
  view.setFloat64(planetOffset + 24, 20, true);
  view.setFloat64(planetOffset + 32, 0.2, true);
  view.setFloat32(planetOffset + 40, 1.2, true);
  view.setFloat32(planetOffset + 44, 1.5, true);
  view.setFloat32(planetOffset + 48, 280, true);
  view.setFloat32(planetOffset + 52, 0.02, true);
  view.setFloat32(planetOffset + 56, 89, true);
  view.setFloat32(planetOffset + 60, 1, true);
  view.setUint16(planetOffset + 64, 2020, true);
  view.setUint16(planetOffset + 66, 0, true);
  view.setUint32(planetOffset + 68, 0, true);
  new Uint8Array(buffer, stringsOffset).set(stringBytes);

  return buffer;
}

function exoplanetCatalogMetadata(): object {
  return {
    version: '1.0.0',
    format: 'exoplanet-catalog-v1',
    source: {
      name: 'NASA Exoplanet Archive',
      url: 'https://exoplanetarchive.ipac.caltech.edu/',
      tapUrl: 'https://exoplanetarchive.ipac.caltech.edu/TAP/sync',
      table: 'PSCompPars',
      query: 'select test row from pscomppars',
      snapshotDate: '2026-08-05',
      sha256: 'a'.repeat(64),
    },
    counts: { hosts: 1, planets: 1, positionedHosts: 1, positionedPlanets: 1 },
    missingDistanceFallbackParsec: 1_000,
  };
}

function cosmicGroupCatalogBuffer(pgcId: number): ArrayBuffer {
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
  view.setUint32(COSMIC_GROUP_CATALOG_HEADER_BYTES + 24, pgcId, true);
  view.setFloat32(COSMIC_GROUP_CATALOG_HEADER_BYTES + 28, 30.413, true);

  return buffer;
}

function testCosmicStructureMetadata() {
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

function testTempelCosmicStructureMetadata() {
  return {
    version: '1.0.0',
    recordCount: 1,
    referenceEpochJulianDay: 2_451_545,
    referenceFrame: 'equatorial-j2000',
    distanceUnit: 'megaparsec',
    scientificConfidence: 'calculated',
    sources: [
      {
        id: 'sdss-dr8-tempel-filaments',
        name: 'SDSS DR8 Bisous cosmic filaments',
        citation: 'Tempel et al. (2014), MNRAS 438, 3465',
        sourceUrl: 'https://example.test/tempel',
        structureType: 'filament',
        method: 'Bisous',
        objectNamePrefix: 'Filament SDSS',
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

function tempelCosmicStructureCatalogBuffer(): ArrayBuffer {
  const identifier = new TextEncoder().encode('F1');
  const buffer = new ArrayBuffer(
    COSMIC_STRUCTURE_CATALOG_HEADER_BYTES +
      COSMIC_STRUCTURE_CATALOG_RECORD_BYTES +
      identifier.length,
  );
  const view = new DataView(buffer);
  const recordOffset = COSMIC_STRUCTURE_CATALOG_HEADER_BYTES;

  for (let index = 0; index < COSMIC_STRUCTURE_CATALOG_MAGIC.length; index += 1) {
    view.setUint8(index, COSMIC_STRUCTURE_CATALOG_MAGIC.charCodeAt(index));
  }
  view.setUint16(4, COSMIC_STRUCTURE_CATALOG_VERSION, true);
  view.setUint16(6, COSMIC_STRUCTURE_CATALOG_HEADER_BYTES, true);
  view.setUint16(8, COSMIC_STRUCTURE_CATALOG_RECORD_BYTES, true);
  view.setUint32(12, 1, true);
  view.setUint16(16, 1, true);
  view.setUint16(18, 1, true);
  view.setFloat64(20, 2_451_545, true);
  view.setFloat32(28, 10.5, true);
  view.setFloat32(32, 10.5, true);
  view.setUint32(36, identifier.length, true);
  view.setUint32(40, 0xff, true);
  view.setFloat32(recordOffset, 10.5, true);
  view.setFloat32(recordOffset + 4, 0, true);
  view.setFloat32(recordOffset + 8, 0, true);
  view.setFloat32(recordOffset + 12, 10.5, true);
  view.setFloat32(recordOffset + 16, 1, true);
  view.setFloat32(recordOffset + 20, 1, true);
  view.setFloat32(recordOffset + 24, Number.NaN, true);
  view.setFloat32(recordOffset + 28, Number.NaN, true);
  view.setUint32(recordOffset + 36, 0, true);
  view.setUint16(recordOffset + 40, identifier.length, true);
  view.setUint16(recordOffset + 42, 0, true);
  view.setUint8(recordOffset + 44, 3);
  view.setUint16(recordOffset + 46, 1, true);
  new Uint8Array(
    buffer,
    COSMIC_STRUCTURE_CATALOG_HEADER_BYTES + COSMIC_STRUCTURE_CATALOG_RECORD_BYTES,
  ).set(identifier);

  return buffer;
}

function tempelSpineCatalogBuffer(): ArrayBuffer {
  const buffer = new ArrayBuffer(
    TEMPEL_FILAMENT_SPINE_HEADER_BYTES +
      TEMPEL_FILAMENT_SPINE_INDEX_BYTES +
      2 * TEMPEL_FILAMENT_SPINE_POINT_BYTES,
  );
  const view = new DataView(buffer);

  for (let index = 0; index < TEMPEL_FILAMENT_SPINE_MAGIC.length; index += 1) {
    view.setUint8(index, TEMPEL_FILAMENT_SPINE_MAGIC.charCodeAt(index));
  }
  view.setUint16(4, TEMPEL_FILAMENT_SPINE_VERSION, true);
  view.setUint16(6, TEMPEL_FILAMENT_SPINE_HEADER_BYTES, true);
  view.setUint16(8, TEMPEL_FILAMENT_SPINE_POINT_BYTES, true);
  view.setUint16(10, TEMPEL_FILAMENT_SPINE_INDEX_BYTES, true);
  view.setUint32(12, 1, true);
  view.setUint32(16, 2, true);
  view.setUint32(20, 1, true);
  view.setUint16(24, 1, true);
  view.setUint16(26, 1, true);
  view.setFloat64(28, 2_451_545, true);
  view.setFloat32(36, 10, true);
  view.setFloat32(40, 11, true);
  view.setUint32(44, 0x7, true);
  view.setUint16(TEMPEL_FILAMENT_SPINE_HEADER_BYTES, 1, true);
  view.setUint16(TEMPEL_FILAMENT_SPINE_HEADER_BYTES + 2, 2, true);
  view.setUint32(TEMPEL_FILAMENT_SPINE_HEADER_BYTES + 4, 0, true);
  const pointsOffset = TEMPEL_FILAMENT_SPINE_HEADER_BYTES + TEMPEL_FILAMENT_SPINE_INDEX_BYTES;

  for (let pointIndex = 0; pointIndex < 2; pointIndex += 1) {
    const offset = pointsOffset + pointIndex * TEMPEL_FILAMENT_SPINE_POINT_BYTES;

    view.setFloat32(offset, 10 + pointIndex, true);
    view.setUint8(offset + 12, 128 + pointIndex * 16);
    view.setUint8(offset + 13, 160 + pointIndex * 16);
    view.setUint8(offset + 14, 192 + pointIndex * 16);
  }

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
