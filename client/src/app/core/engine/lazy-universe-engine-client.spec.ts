import type {
  DisplayOptions,
  GraphicQuality,
  UniverseEngineEvent,
} from '../../../data/models/universe.models';
import type { NavigationScaleDefinition } from '../../../engine/camera/navigation-scales';
import type { ActiveObjectAdornmentDiagnostics } from '../../../engine/objects/active-object-adornment-controller';
import type { LabelNameResolver } from '../../../engine/objects/label-canvas-painter';
import type { ObjectVisualDiagnostics } from '../../../engine/objects/object-visual-diagnostics';
import type { CosmicMapLayers } from '../../../engine/rendering/cosmic-map-policy';
import type { EarthEclipseEvent } from '../../../engine/simulation/earth-eclipse';
import { UniverseStartupPerformanceTrace } from '../../../engine/performance/universe-startup-performance-trace';
import { LazyUniverseEngineClient, type UniverseEngineClient } from './lazy-universe-engine-client';

describe('LazyUniverseEngineClient', () => {
  beforeEach(() => {
    vi.stubGlobal(
      'matchMedia',
      vi.fn(() => ({ matches: false })),
    );
  });

  afterEach(() => vi.unstubAllGlobals());

  it('ne charge Three.js qu’à l’initialisation puis délègue toute l’API de façade', async () => {
    const fake = createFakeEngine();
    const loader = vi.fn(async () => fake.engine);
    const engine = new LazyUniverseEngineClient(loader, () => 'medium');
    const listener = vi.fn();
    const unsubscribe = engine.subscribe(listener);
    const resolver: LabelNameResolver = (_objectId, fallback) => fallback;

    engine.setLabelNameResolver(resolver);
    engine.setTime({ julianDay: 1 });

    expect(loader).not.toHaveBeenCalled();
    expect(engine.cameraDistance).toBe(0);
    expect(engine.cameraTransitioning).toBe(false);
    expect(engine.adaptiveRenderingStats).toEqual({
      status: 'warming',
      p95FrameMs: null,
      longFrameRatio: null,
      targetPixelRatio: 1,
      currentPixelRatio: 1,
    });
    expect(Number.isFinite(engine.currentTime.julianDay)).toBe(true);
    expect(engine.recommendedQuality).toBe('medium');
    expect(engine.hasObject('earth')).toBe(false);
    expect(engine.getStellarObservationCatalog(100)).toEqual([]);
    expect(engine.getStellarObservationConstellations()).toEqual([]);
    expect(engine.getObjectAdornmentDiagnostics('earth')).toBeNull();
    expect(engine.getObjectVisualDiagnostics('earth')).toBeNull();
    expect(() => engine.setTarget('earth')).toThrow('pas encore initialisé');
    expect(() => engine.prepareEarthObservation('sirius')).toThrow('pas encore initialisé');
    expect(() => engine.ensureObjectAvailable('earth')).toThrow('pas encore initialisé');

    const container = document.createElement('div');
    const options = displayOptions();

    await engine.initialize(container, options);

    expect(loader).toHaveBeenCalledOnce();
    expect(fake.engine.setLabelNameResolver).toHaveBeenCalledWith(resolver);
    expect(fake.engine.initialize).toHaveBeenCalledWith(container, options);
    fake.emit({ type: 'loading-state', loading: true });
    expect(listener).toHaveBeenCalledWith({ type: 'loading-state', loading: true });
    unsubscribe();
    fake.emit({ type: 'loading-state', loading: false });
    expect(listener).toHaveBeenCalledOnce();

    const time = { julianDay: 2_461_200 };
    const scale = { id: 'planetary' } as NavigationScaleDefinition;
    const eclipse = { id: 'solar-eclipse' } as EarthEclipseEvent;
    const layers = { filaments: true } as CosmicMapLayers;
    const pitchLimits = {
      minimumPitchOffsetDegrees: -8,
      maximumPitchOffsetDegrees: 80,
    };
    const observerFraming = {
      initialPitchOffsetDegrees: 24,
      pitchLimits,
    };

    engine.start();
    engine.resize(1280, 720);
    engine.setTime(time);
    engine.setPlaying(true);
    engine.setTimeSpeed(2);
    await engine.ensureObjectAvailable('earth');
    await engine.setTarget('earth', 12);
    await engine.prepareEarthObservation('sirius', observerFraming, null);
    engine.completeTargetTransition();
    await engine.viewRotation('earth');
    engine.viewOrbit('earth');
    engine.viewScale(scale);
    engine.viewSolarEclipse(eclipse);
    engine.observeSolarEclipse(eclipse);
    engine.setSolarEclipsePathVisible(eclipse, true);
    engine.clearSolarEclipsePresentation();
    engine.selectObject('earth');
    engine.setDisplayOptions(options);
    engine.setLabelNameResolver(resolver);
    engine.setCosmicMapLayers(layers);
    engine.zoomBy(0.72);

    expect(fake.engine.start).toHaveBeenCalledOnce();
    expect(fake.engine.resize).toHaveBeenCalledWith(1280, 720);
    expect(fake.engine.setTime).toHaveBeenCalledWith(time);
    expect(fake.engine.setPlaying).toHaveBeenCalledWith(true);
    expect(fake.engine.setTimeSpeed).toHaveBeenCalledWith(2);
    expect(fake.engine.ensureObjectAvailable).toHaveBeenCalledWith('earth');
    expect(fake.engine.setTarget).toHaveBeenCalledWith('earth', 12);
    expect(fake.engine.prepareEarthObservation).toHaveBeenCalledWith(
      'sirius',
      observerFraming,
      null,
    );
    expect(fake.engine.completeTargetTransition).toHaveBeenCalledOnce();
    expect(fake.engine.viewRotation).toHaveBeenCalledWith('earth');
    expect(fake.engine.viewOrbit).toHaveBeenCalledWith('earth');
    expect(fake.engine.viewScale).toHaveBeenCalledWith(scale);
    expect(fake.engine.viewSolarEclipse).toHaveBeenCalledWith(eclipse);
    expect(fake.engine.observeSolarEclipse).toHaveBeenCalledWith(eclipse);
    expect(fake.engine.setSolarEclipsePathVisible).toHaveBeenCalledWith(eclipse, true);
    expect(fake.engine.clearSolarEclipsePresentation).toHaveBeenCalledOnce();
    expect(fake.engine.selectObject).toHaveBeenCalledWith('earth');
    expect(fake.engine.setDisplayOptions).toHaveBeenCalledWith(options);
    expect(fake.engine.setLabelNameResolver).toHaveBeenLastCalledWith(resolver);
    expect(fake.engine.setCosmicMapLayers).toHaveBeenCalledWith(layers);
    expect(fake.engine.zoomBy).toHaveBeenCalledWith(0.72);
    expect(engine.currentTime).toEqual(fake.engine.currentTime);
    expect(engine.cameraDistance).toBe(42);
    expect(engine.cameraTransitioning).toBe(false);
    expect(engine.adaptiveRenderingStats).toBe(fake.engine.adaptiveRenderingStats);
    expect(engine.recommendedQuality).toBe('high');
    expect(engine.hasObject('earth')).toBe(true);
    expect(engine.getStellarObservationCatalog(100)).toEqual([
      expect.objectContaining({ id: 'sirius' }),
    ]);
    expect(fake.engine.getStellarObservationCatalog).toHaveBeenCalledWith(100);
    expect(engine.getStellarObservationConstellations()).toEqual([
      expect.objectContaining({ id: 'constellation-canis-major' }),
    ]);
    expect(fake.engine.getStellarObservationConstellations).toHaveBeenCalledOnce();
    expect(engine.getObjectAdornmentDiagnostics('earth')).toBe(fake.adornmentDiagnostics);
    expect(engine.getObjectVisualDiagnostics('earth')).toBe(fake.visualDiagnostics);

    await engine.initialize(container, options);
    expect(loader).toHaveBeenCalledOnce();
    expect(fake.engine.initialize).toHaveBeenCalledTimes(2);

    engine.dispose();
    expect(fake.unsubscribeRelay).toHaveBeenCalledOnce();
    expect(fake.engine.dispose).toHaveBeenCalledOnce();
  });

  it('annule proprement un chargement terminé après la destruction de la façade', async () => {
    const fake = createFakeEngine();
    let resolveEngine!: (engine: UniverseEngineClient) => void;
    const loader = vi.fn(
      () =>
        new Promise<UniverseEngineClient>((resolve) => {
          resolveEngine = resolve;
        }),
    );
    const engine = new LazyUniverseEngineClient(loader);
    const initialization = engine.initialize(document.createElement('div'), displayOptions());

    engine.dispose();
    resolveEngine(fake.engine);

    await expect(initialization).rejects.toThrow('annulé');
    expect(fake.engine.initialize).not.toHaveBeenCalled();
    expect(fake.engine.dispose).toHaveBeenCalledOnce();
  });

  it('partage un chargement concurrent et annule une initialisation détruite pendant le runtime', async () => {
    const fake = createFakeEngine();
    let resolveEngine!: (engine: UniverseEngineClient) => void;
    const initializationResolvers: Array<() => void> = [];
    const loader = vi.fn(
      () =>
        new Promise<UniverseEngineClient>((resolve) => {
          resolveEngine = resolve;
        }),
    );

    fake.engine.initialize = vi.fn(
      () =>
        new Promise<void>((resolve) => {
          initializationResolvers.push(resolve);
        }),
    );
    const engine = new LazyUniverseEngineClient(loader);
    const container = document.createElement('div');
    const first = engine.initialize(container, displayOptions());
    const second = engine.initialize(container, displayOptions());

    resolveEngine(fake.engine);
    await vi.waitFor(() => expect(fake.engine.initialize).toHaveBeenCalledTimes(2));
    engine.dispose();
    for (const resolve of initializationResolvers) {
      resolve();
    }

    await expect(first).rejects.toThrow('annulé');
    await expect(second).rejects.toThrow('annulé');
    expect(loader).toHaveBeenCalledOnce();
  });

  it('emploie le résolveur de noms neutre quand aucun résolveur n’est préparé', async () => {
    const fake = createFakeEngine();
    const engine = new LazyUniverseEngineClient(async () => fake.engine);

    await engine.initialize(document.createElement('div'), displayOptions());
    const resolver = vi.mocked(fake.engine.setLabelNameResolver).mock.calls[0]?.[0];

    expect(resolver?.('earth', 'Earth')).toBe('Earth');
  });

  it('partage la chronologie de démarrage avec le moteur chargé et mesure les erreurs', async () => {
    const fake = createFakeEngine();
    const trace = new UniverseStartupPerformanceTrace(clock(10, 30));
    const loader = vi.fn(async (receivedTrace: UniverseStartupPerformanceTrace) => {
      expect(receivedTrace).toBe(trace);

      return fake.engine;
    });
    const engine = new LazyUniverseEngineClient(loader, () => 'high', trace);

    await engine.initialize(document.createElement('div'), displayOptions());

    expect(trace.snapshot).toMatchObject({ status: 'loading', engineModuleMs: 20 });

    engine.dispose();
    expect(trace.snapshot.status).toBe('idle');

    const failureTrace = new UniverseStartupPerformanceTrace(clock(40));
    const failed = new LazyUniverseEngineClient(
      async () => {
        throw new Error('chunk unavailable');
      },
      () => 'high',
      failureTrace,
    );

    await expect(failed.initialize(document.createElement('div'))).rejects.toThrow(
      'chunk unavailable',
    );
    expect(failureTrace.snapshot.status).toBe('failed');
  });
});

function clock(...values: number[]): () => number {
  const queue = [...values];

  return () => {
    const value = queue.shift();

    if (value === undefined) {
      throw new Error('Horloge de test épuisée.');
    }

    return value;
  };
}

function displayOptions(): DisplayOptions {
  return {
    showOrbits: true,
    showConstellations: true,
    showLabels: true,
    quality: 'high',
    labelDensity: 'balanced',
    temporalMode: 'state',
  };
}

function createFakeEngine(): FakeEngineHarness {
  const adornmentDiagnostics = {} as ActiveObjectAdornmentDiagnostics;
  const visualDiagnostics = {} as ObjectVisualDiagnostics;
  let relay: ((event: UniverseEngineEvent) => void) | null = null;
  const unsubscribeRelay = vi.fn();
  const engine: UniverseEngineClient = {
    currentTime: { julianDay: 2_461_210 },
    cameraDistance: 42,
    cameraTransitioning: false,
    adaptiveRenderingStats: {
      status: 'stable',
      p95FrameMs: 16,
      longFrameRatio: 0,
      targetPixelRatio: 1.5,
      currentPixelRatio: 1.5,
    },
    recommendedQuality: 'high' satisfies GraphicQuality,
    subscribe: vi.fn((listener) => {
      relay = listener;

      return unsubscribeRelay;
    }),
    initialize: vi.fn(async () => undefined),
    start: vi.fn(),
    resize: vi.fn(),
    dispose: vi.fn(),
    setTime: vi.fn(),
    setPlaying: vi.fn(),
    setTimeSpeed: vi.fn(),
    ensureObjectAvailable: vi.fn(async () => true),
    setTarget: vi.fn(async () => undefined),
    prepareEarthObservation: vi.fn(async () => undefined),
    completeTargetTransition: vi.fn(),
    viewRotation: vi.fn(async () => undefined),
    viewOrbit: vi.fn(),
    viewScale: vi.fn(),
    viewSolarEclipse: vi.fn(),
    observeSolarEclipse: vi.fn(),
    setSolarEclipsePathVisible: vi.fn(),
    clearSolarEclipsePresentation: vi.fn(),
    selectObject: vi.fn(),
    setDisplayOptions: vi.fn(),
    setLabelNameResolver: vi.fn(),
    setCosmicMapLayers: vi.fn(),
    zoomBy: vi.fn(),
    hasObject: vi.fn((objectId) => objectId === 'earth'),
    getObjectAdornmentDiagnostics: vi.fn(() => adornmentDiagnostics),
    getObjectVisualDiagnostics: vi.fn(() => visualDiagnostics),
    getStellarObservationCatalog: vi.fn(() => [
      {
        id: 'sirius',
        name: 'Sirius',
        coordinates: { rightAscensionDegrees: 101.287, declinationDegrees: -16.716 },
        apparentMagnitude: -1.46,
        color: '#b8ccff',
      },
    ]),
    getStellarObservationConstellations: vi.fn(() => [
      {
        id: 'constellation-canis-major',
        name: 'Canis Major',
        abbreviation: 'CMa',
        segments: [],
      },
    ]),
  };

  return {
    engine,
    adornmentDiagnostics,
    visualDiagnostics,
    unsubscribeRelay,
    emit: (event) => relay?.(event),
  };
}

interface FakeEngineHarness {
  engine: UniverseEngineClient;
  adornmentDiagnostics: ActiveObjectAdornmentDiagnostics;
  visualDiagnostics: ObjectVisualDiagnostics;
  unsubscribeRelay: ReturnType<typeof vi.fn>;
  emit(event: UniverseEngineEvent): void;
}
