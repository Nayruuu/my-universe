import type {
  DisplayOptions,
  GraphicQuality,
  NavigationState,
  UniverseEngineEvent,
  UniverseTime,
} from '../../../data/models/universe.models';
import type { CosmicMapLayers } from '../../../engine/rendering/cosmic-map-policy';
import {
  type UniverseEngineFacadeLifecycleBindings,
  type UniverseEngineFacadeLifecycleEngine,
  UniverseEngineFacadeLifecycle,
} from './universe-engine-facade-lifecycle';

describe('UniverseEngineFacadeLifecycle', () => {
  it('mutualise l’initialisation et applique les valeurs par défaut', async () => {
    const harness = createHarness();
    const container = document.createElement('div');
    const first = harness.lifecycle.initialize(container);
    const second = harness.lifecycle.initialize(container);

    expect(second).toBe(first);
    await first;

    expect(harness.engine.subscribe).toHaveBeenCalledOnce();
    expect(harness.engine.initialize).toHaveBeenCalledWith(container, {
      showOrbits: true,
      showConstellations: true,
      showLabels: true,
      quality: 'high',
      labelDensity: 'balanced',
      temporalMode: 'state',
    });
    expect(harness.setDisplayOptions).toHaveBeenCalledWith(
      expect.objectContaining({ quality: 'high' }),
    );
    expect(harness.setCurrentTime).toHaveBeenCalledWith(harness.engine.currentTime);
    expect(harness.engine.setCosmicMapLayers).toHaveBeenCalledWith(harness.cosmicMapLayers);
    expect(harness.engine.setTimeSpeed).toHaveBeenCalledWith(4);
    expect(harness.engine.setTarget).toHaveBeenCalledWith('earth', undefined);
    expect(harness.engine.completeTargetTransition).toHaveBeenCalledOnce();
    expect(harness.presentCurrentSolarEclipse).toHaveBeenCalledOnce();
    expect(harness.engine.start).toHaveBeenCalledOnce();
    expect(harness.setReady).toHaveBeenCalledWith(true);
    expect(harness.scheduleNavigationWrite).toHaveBeenCalledOnce();

    const event: UniverseEngineEvent = { type: 'target-changed', objectId: 'earth' };

    harness.engine.emit(event);
    expect(harness.handleEngineEvent).toHaveBeenCalledWith(event);
  });

  it('restaure la date, les options et une sélection explicite avec repli sur la Terre', async () => {
    const harness = createHarness({
      navigation: {
        targetId: 'missing',
        selectedId: null,
        julianDay: 2_461_265,
        zoom: 12,
        mode: 'observable',
        quality: 'low',
        labelDensity: 'dense',
        showOrbits: false,
        showConstellations: false,
        showLabels: false,
      },
    });

    harness.engine.hasObject.mockReturnValue(false);
    await harness.lifecycle.initialize(document.createElement('div'));

    expect(harness.setDisplayOptions).toHaveBeenCalledWith({
      showOrbits: false,
      showConstellations: false,
      showLabels: false,
      quality: 'low',
      labelDensity: 'dense',
      temporalMode: 'observable',
    });
    expect(harness.engine.setTime).toHaveBeenCalledWith({ julianDay: 2_461_265 });
    expect(harness.engine.setTarget).toHaveBeenCalledWith('earth', 12);
    expect(harness.engine.selectObject).toHaveBeenCalledWith(null);
    expect(harness.presentCurrentSolarEclipse).toHaveBeenCalledOnce();
  });

  it('restaure une sélection distincte sans remplacer une sélection identique', async () => {
    const distinct = createHarness({
      navigation: { targetId: 'mars', selectedId: 'venus' },
    });

    await distinct.lifecycle.initialize(document.createElement('div'));
    expect(distinct.engine.selectObject).toHaveBeenCalledWith('venus');
    expect(distinct.presentCurrentSolarEclipse).not.toHaveBeenCalled();

    const identical = createHarness({
      navigation: { targetId: 'mars', selectedId: 'mars' },
    });

    await identical.lifecycle.initialize(document.createElement('div'));
    expect(identical.engine.selectObject).not.toHaveBeenCalled();
    expect(identical.presentCurrentSolarEclipse).not.toHaveBeenCalled();
  });

  it('traduit un échec courant, libère son abonnement et conserve une promesse stable', async () => {
    const harness = createHarness();
    const failure = new Error('WebGL indisponible');

    harness.engine.initialize.mockRejectedValue(failure);
    const initialization = harness.lifecycle.initialize(document.createElement('div'));

    await initialization;

    expect(harness.describeInitializationError).toHaveBeenCalledWith(failure);
    expect(harness.setError).toHaveBeenCalledWith('Initialisation impossible');
    expect(harness.setLoading).toHaveBeenCalledWith(false);
    expect(harness.engine.unsubscribe).toHaveBeenCalledOnce();
    expect(harness.lifecycle.initialize(document.createElement('div'))).toBe(initialization);
  });

  it('peut être détruit avant toute initialisation puis réinitialisé', async () => {
    const harness = createHarness();

    harness.lifecycle.dispose();
    expect(harness.engine.unsubscribe).not.toHaveBeenCalled();
    expect(harness.engine.dispose).toHaveBeenCalledOnce();
    expect(harness.setReady).toHaveBeenCalledWith(false);

    await harness.lifecycle.initialize(document.createElement('div'));
    harness.lifecycle.dispose();

    expect(harness.engine.unsubscribe).toHaveBeenCalledOnce();
    expect(harness.engine.dispose).toHaveBeenCalledTimes(2);

    await harness.lifecycle.initialize(document.createElement('div'));
    expect(harness.engine.initialize).toHaveBeenCalledTimes(2);
  });

  it('ignore une initialisation qui se termine après sa destruction', async () => {
    const harness = createHarness();
    const initializationGate = deferred<void>();

    harness.engine.initialize.mockReturnValueOnce(initializationGate.promise);
    const staleInitialization = harness.lifecycle.initialize(document.createElement('div'));

    harness.lifecycle.dispose();
    initializationGate.resolve();
    await staleInitialization;

    expect(harness.engine.setCosmicMapLayers).not.toHaveBeenCalled();
    expect(harness.engine.start).not.toHaveBeenCalled();
    expect(harness.setReady).toHaveBeenLastCalledWith(false);
    expect(harness.setError).not.toHaveBeenCalled();

    await harness.lifecycle.initialize(document.createElement('div'));
    expect(harness.engine.start).toHaveBeenCalledOnce();
    expect(harness.setReady).toHaveBeenLastCalledWith(true);
  });

  it('ignore aussi une cible résolue après la destruction', async () => {
    const harness = createHarness();
    const targetGate = deferred<void>();

    harness.engine.setTarget.mockReturnValueOnce(targetGate.promise);
    const staleInitialization = harness.lifecycle.initialize(document.createElement('div'));

    await vi.waitFor(() => expect(harness.engine.setTarget).toHaveBeenCalledOnce());
    harness.lifecycle.dispose();
    targetGate.resolve();
    await staleInitialization;

    expect(harness.engine.completeTargetTransition).not.toHaveBeenCalled();
    expect(harness.engine.start).not.toHaveBeenCalled();
    expect(harness.setError).not.toHaveBeenCalled();
  });
});

function createHarness(options: { navigation?: Partial<NavigationState> } = {}) {
  const engine = new FakeLifecycleEngine();
  const cosmicMapLayers: CosmicMapLayers = {
    volume: true,
    groups: true,
    links: true,
    clusters: true,
    superclusters: true,
    filaments: true,
    voids: true,
  };
  const setDisplayOptions = vi.fn<(options: DisplayOptions) => void>();
  const setCurrentTime = vi.fn<(time: UniverseTime) => void>();
  const handleEngineEvent = vi.fn<(event: UniverseEngineEvent) => void>();
  const presentCurrentSolarEclipse = vi.fn();
  const setReady = vi.fn<(ready: boolean) => void>();
  const setLoading = vi.fn<(loading: boolean) => void>();
  const setError = vi.fn<(message: string) => void>();
  const scheduleNavigationWrite = vi.fn();
  const describeInitializationError = vi.fn(() => 'Initialisation impossible');
  const bindings: UniverseEngineFacadeLifecycleBindings = {
    readNavigation: () => options.navigation ?? {},
    setDisplayOptions,
    getCosmicMapLayers: () => cosmicMapLayers,
    getSpeed: () => 4,
    setCurrentTime,
    handleEngineEvent,
    presentCurrentSolarEclipse,
    setReady,
    setLoading,
    setError,
    scheduleNavigationWrite,
    describeInitializationError,
  };

  return {
    lifecycle: new UniverseEngineFacadeLifecycle(engine, bindings),
    engine,
    cosmicMapLayers,
    setDisplayOptions,
    setCurrentTime,
    handleEngineEvent,
    presentCurrentSolarEclipse,
    setReady,
    setLoading,
    setError,
    scheduleNavigationWrite,
    describeInitializationError,
  };
}

class FakeLifecycleEngine implements UniverseEngineFacadeLifecycleEngine {
  public readonly initialize = vi.fn<
    (container: HTMLElement, options: DisplayOptions) => Promise<void>
  >(async () => undefined);
  public readonly subscribe = vi.fn((listener: (event: UniverseEngineEvent) => void) => {
    this.listener = listener;

    return this.unsubscribe;
  });
  public readonly unsubscribe = vi.fn();
  public readonly setCosmicMapLayers = vi.fn();
  public readonly setTime = vi.fn();
  public readonly setTimeSpeed = vi.fn();
  public readonly hasObject = vi.fn(() => true);
  public readonly setTarget = vi.fn<(objectId: string, zoom?: number) => Promise<void>>(
    async () => undefined,
  );
  public readonly completeTargetTransition = vi.fn();
  public readonly selectObject = vi.fn();
  public readonly start = vi.fn();
  public readonly dispose = vi.fn();
  public readonly recommendedQuality: GraphicQuality = 'high';
  public readonly currentTime: UniverseTime = { julianDay: 2_461_250 };
  private listener: ((event: UniverseEngineEvent) => void) | null = null;

  public emit(event: UniverseEngineEvent): void {
    this.listener?.(event);
  }
}

function deferred<T>() {
  let resolve!: (value: T | PromiseLike<T>) => void;
  let reject!: (reason?: unknown) => void;
  const promise = new Promise<T>((resolvePromise, rejectPromise) => {
    resolve = resolvePromise;
    reject = rejectPromise;
  });

  return { promise, resolve, reject };
}
