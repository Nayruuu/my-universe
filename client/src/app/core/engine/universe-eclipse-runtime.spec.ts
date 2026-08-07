import type { UniverseTime } from '../../../data/models/universe.models';
import type { EarthEclipseEvent } from '../../../engine/simulation/earth-eclipse';
import type { SolarEclipseObserverLocation } from '../../../engine/simulation/solar-eclipse-locations';
import {
  type UniverseEclipseRuntimeBindings,
  type UniverseEclipseRuntimeEngine,
  UniverseEclipseRuntime,
} from './universe-eclipse-runtime';

describe('UniverseEclipseRuntime', () => {
  it('parcourt les pages autour des événements affichés puis revient au présent simulé', async () => {
    const harness = createHarness();
    const current = eclipse({ id: 'current', peak: { julianDay: 200 } });
    const previous = eclipse({ id: 'previous', peak: { julianDay: 100 } });
    const next = eclipse({ id: 'next', peak: { julianDay: 300 } });

    harness.state.currentTime = { julianDay: 150 };
    harness.findPage.mockReturnValueOnce([current]);
    await harness.runtime.returnToCurrentEclipses();
    expect(harness.findPage).toHaveBeenLastCalledWith({ julianDay: 150 }, 8, 'future');
    expect(harness.state.upcoming).toEqual([current]);
    expect(harness.state.catalogAtPresent).toBe(true);

    harness.findPage.mockReturnValueOnce([previous]);
    await harness.runtime.browseEarlierEclipses();
    expect(harness.findPage).toHaveBeenLastCalledWith({ julianDay: 200 - 1 / 86_400 }, 8, 'past');
    expect(harness.state.catalogAtPresent).toBe(false);

    harness.findPage.mockReturnValueOnce([next]);
    await harness.runtime.browseLaterEclipses();
    expect(harness.findPage).toHaveBeenLastCalledWith({ julianDay: 100 + 1 / 86_400 }, 8, 'future');
    expect(harness.state.upcoming).toEqual([next]);
  });

  it('utilise la date simulée lorsque la page est vide et traduit une erreur de catalogue', async () => {
    const harness = createHarness();

    harness.state.currentTime = { julianDay: 150 };
    await harness.runtime.browseEarlierEclipses();
    expect(harness.findPage).toHaveBeenLastCalledWith({ julianDay: 150 - 1 / 86_400 }, 8, 'past');

    await harness.runtime.browseLaterEclipses();
    expect(harness.findPage).toHaveBeenLastCalledWith({ julianDay: 150 + 1 / 86_400 }, 8, 'future');

    harness.catalogLoader.mockRejectedValueOnce(new Error('catalogue indisponible'));
    await harness.runtime.returnToCurrentEclipses();
    expect(harness.setPerformanceWarning).toHaveBeenCalledWith('Catalogue indisponible');
    expect(harness.state.eventsLoading).toBe(false);
  });

  it('ne laisse pas une ancienne page écraser la dernière demande', async () => {
    const harness = createHarness();
    const staleGate = deferred<ReturnType<typeof createCatalogModule>>();

    harness.catalogLoader.mockReturnValueOnce(staleGate.promise);
    harness.findPage.mockReturnValueOnce([eclipse({ id: 'latest' })]);
    const staleRequest = harness.runtime.browseEarlierEclipses();
    const latestRequest = harness.runtime.browseLaterEclipses();

    await latestRequest;
    staleGate.resolve(createCatalogModule([eclipse({ id: 'stale' })]));
    await staleRequest;

    expect(harness.state.upcoming.map(({ id }) => id)).toEqual(['latest']);
    expect(harness.state.eventsLoading).toBe(false);
  });

  it('présente une éclipse lunaire puis une éclipse solaire', async () => {
    const harness = createHarness();
    const lunar = eclipse({ family: 'lunar', kind: 'total' });

    await harness.runtime.viewEarthEclipse(lunar);
    expect(harness.engine.setPlaying).toHaveBeenCalledWith(false);
    expect(harness.engine.setTime).toHaveBeenCalledWith(lunar.peak);
    expect(harness.focus).toHaveBeenCalledWith('moon');
    expect(harness.state.active).toBeNull();
    expect(harness.state.observerActive).toBe(false);

    const solar = eclipse();

    await harness.runtime.viewEarthEclipse(solar);
    expect(harness.state.active).toBe(solar);
    expect(harness.engine.viewSolarEclipse).toHaveBeenCalledWith(solar);
  });

  it('traduit une vue solaire impossible', async () => {
    const harness = createHarness();
    const failure = new Error('ombre impossible');

    harness.engine.viewSolarEclipse.mockImplementationOnce(() => {
      throw failure;
    });
    await harness.runtime.viewEarthEclipse(eclipse());

    expect(harness.describeEclipseViewError).toHaveBeenCalledWith(failure);
    expect(harness.setError).toHaveBeenCalledWith('Vue impossible');
  });

  it('ignore une observation lunaire et annule une observation solaire en erreur', () => {
    const harness = createHarness();

    harness.runtime.observeEarthEclipse(eclipse({ family: 'lunar' }));
    expect(harness.engine.observeSolarEclipse).not.toHaveBeenCalled();

    const solar = eclipse();

    harness.runtime.observeEarthEclipse(solar);
    expect(harness.state.observerActive).toBe(true);
    expect(harness.engine.observeSolarEclipse).toHaveBeenCalledWith(solar);

    const failure = new Error('lieu inaccessible');

    harness.engine.observeSolarEclipse.mockImplementationOnce(() => {
      throw failure;
    });
    harness.runtime.observeEarthEclipse(solar);
    expect(harness.state.observerActive).toBe(false);
    expect(harness.describeObserverError).toHaveBeenCalledWith(failure);
    expect(harness.setError).toHaveBeenCalledWith('Observation impossible');
  });

  it('calcule un maximum local et garantit la fin de son chargement en erreur', async () => {
    const harness = createHarness();
    const location = observerLocation();
    const event = eclipse();

    await harness.runtime.viewLocalSolarEclipse(event, location);
    expect(harness.calculateLocal).toHaveBeenCalledWith(event, location);
    expect(harness.engine.viewSolarEclipse).toHaveBeenCalledWith(
      expect.objectContaining({ scope: 'local', observerName: 'Paris' }),
    );
    expect(harness.state.localLoading).toBe(false);

    const failure = new Error('aucun maximum');

    harness.calculateLocal.mockImplementationOnce(() => {
      throw failure;
    });
    await harness.runtime.viewLocalSolarEclipse(event, location);
    expect(harness.describeLocalMaximumError).toHaveBeenCalledWith(failure, location);
    expect(harness.setPerformanceWarning).toHaveBeenCalledWith('Maximum local impossible');
    expect(harness.state.localLoading).toBe(false);
  });

  it('annule les calculs différés lors de la destruction', async () => {
    const harness = createHarness();
    const pageGate = deferred<ReturnType<typeof createCatalogModule>>();
    const localGate = deferred<ReturnType<typeof createLocalModule>>();

    harness.catalogLoader.mockReturnValueOnce(pageGate.promise);
    harness.localLoader.mockReturnValueOnce(localGate.promise);
    const pageRequest = harness.runtime.returnToCurrentEclipses();
    const localRequest = harness.runtime.viewLocalSolarEclipse(eclipse(), observerLocation());

    harness.runtime.cancelPendingRequests();
    pageGate.resolve(createCatalogModule([eclipse({ id: 'stale' })]));
    localGate.resolve(createLocalModule());
    await Promise.all([pageRequest, localRequest]);

    expect(harness.state.upcoming).toEqual([]);
    expect(harness.engine.viewSolarEclipse).not.toHaveBeenCalled();
    expect(harness.state.eventsLoading).toBe(false);
    expect(harness.state.localLoading).toBe(false);
  });

  it('ignore les erreurs de requêtes déjà annulées', async () => {
    const harness = createHarness();
    const pageGate = deferred<ReturnType<typeof createCatalogModule>>();
    const localGate = deferred<ReturnType<typeof createLocalModule>>();

    harness.catalogLoader.mockReturnValueOnce(pageGate.promise);
    harness.localLoader.mockReturnValueOnce(localGate.promise);
    const pageRequest = harness.runtime.returnToCurrentEclipses();
    const localRequest = harness.runtime.viewLocalSolarEclipse(eclipse(), observerLocation());

    harness.runtime.cancelPendingRequests();
    pageGate.reject(new Error('ancienne page indisponible'));
    localGate.reject(new Error('ancien maximum indisponible'));
    await Promise.all([pageRequest, localRequest]);

    expect(harness.setPerformanceWarning).not.toHaveBeenCalled();
    expect(harness.state.eventsLoading).toBe(false);
    expect(harness.state.localLoading).toBe(false);
  });

  it('revient de l’observateur vers l’ombre, contrôle la trajectoire et réinitialise la vue', () => {
    const harness = createHarness();

    harness.runtime.showSolarShadow();
    expect(harness.engine.viewSolarEclipse).not.toHaveBeenCalled();

    const event = eclipse();

    harness.state.active = event;
    harness.state.observerActive = true;
    harness.runtime.showSolarShadow();
    expect(harness.state.observerActive).toBe(false);
    expect(harness.engine.viewSolarEclipse).toHaveBeenCalledWith(event);

    harness.runtime.toggleSolarPath(event);
    expect(harness.engine.setSolarEclipsePathVisible).toHaveBeenLastCalledWith(event, true);
    harness.runtime.toggleSolarPath(event);
    expect(harness.engine.setSolarEclipsePathVisible).toHaveBeenLastCalledWith(event, false);

    harness.runtime.resetPresentation();
    expect(harness.state.active).toBeNull();
    expect(harness.state.observerActive).toBe(false);
    expect(harness.state.pathVisible).toBe(false);
    expect(harness.engine.clearSolarEclipsePresentation).toHaveBeenCalledOnce();
  });

  it('présente uniquement l’éclipse calculée à la date courante', async () => {
    const harness = createHarness();

    harness.runtime.presentCurrentSolarEclipse();
    expect(harness.engine.viewSolarEclipse).not.toHaveBeenCalled();

    const event = eclipse({ id: 'current' });

    harness.state.currentSolar = event;
    harness.runtime.presentCurrentSolarEclipse();
    await Promise.resolve();
    expect(harness.engine.viewSolarEclipse).toHaveBeenCalledWith(event);
  });
});

function createHarness() {
  const state = {
    currentTime: { julianDay: 2_461_250 } satisfies UniverseTime,
    upcoming: [] as readonly EarthEclipseEvent[],
    active: null as EarthEclipseEvent | null,
    currentSolar: null as EarthEclipseEvent | null,
    eventsLoading: false,
    localLoading: false,
    catalogAtPresent: true,
    playing: true,
    browserOpen: true,
    pathVisible: false,
    observerActive: false,
  };
  const engine = new FakeEclipseEngine();
  const findPage = vi.fn<
    (reference: UniverseTime, count: number, direction: 'past' | 'future') => EarthEclipseEvent[]
  >(() => []);
  const calculateLocal = vi.fn(
    (event: EarthEclipseEvent, location: SolarEclipseObserverLocation): EarthEclipseEvent => ({
      ...event,
      id: `${event.id}-${location.id}`,
      scope: 'local',
      observerName: location.name,
      observerTimeZone: location.timeZone,
    }),
  );
  const catalogLoader = vi.fn(async () => ({ findEarthEclipsePage: findPage }));
  const localLoader = vi.fn(async () => ({ calculateLocalSolarEclipse: calculateLocal }));
  const focus = vi.fn(async () => undefined);
  const setError = vi.fn();
  const setPerformanceWarning = vi.fn();
  const describeEclipseViewError = vi.fn(() => 'Vue impossible');
  const describeObserverError = vi.fn(() => 'Observation impossible');
  const describeLocalMaximumError = vi.fn(() => 'Maximum local impossible');
  const bindings: UniverseEclipseRuntimeBindings = {
    getCurrentTime: () => state.currentTime,
    getUpcomingEclipses: () => state.upcoming,
    getActiveSolarEclipse: () => state.active,
    getCurrentSolarEclipse: () => state.currentSolar,
    isSolarPathVisible: () => state.pathVisible,
    setUpcomingEclipses: (events) => {
      state.upcoming = events;
    },
    setCatalogAtPresent: (atPresent) => {
      state.catalogAtPresent = atPresent;
    },
    setEventsLoading: (loading) => {
      state.eventsLoading = loading;
    },
    setLocalLoading: (loading) => {
      state.localLoading = loading;
    },
    setPlaying: (playing) => {
      state.playing = playing;
    },
    setBrowserOpen: (open) => {
      state.browserOpen = open;
    },
    setActiveSolarEclipse: (event) => {
      state.active = event;
    },
    setSolarPathVisible: (visible) => {
      state.pathVisible = visible;
    },
    setSolarObserverActive: (active) => {
      state.observerActive = active;
    },
    focus,
    setError,
    setPerformanceWarning,
    getCatalogUnavailableMessage: () => 'Catalogue indisponible',
    describeEclipseViewError,
    describeObserverError,
    describeLocalMaximumError,
  };

  return {
    runtime: new UniverseEclipseRuntime(engine, catalogLoader, localLoader, bindings),
    engine,
    state,
    findPage,
    calculateLocal,
    catalogLoader,
    localLoader,
    focus,
    setError,
    setPerformanceWarning,
    describeEclipseViewError,
    describeObserverError,
    describeLocalMaximumError,
  };
}

class FakeEclipseEngine implements UniverseEclipseRuntimeEngine {
  public readonly setPlaying = vi.fn();
  public readonly setTime = vi.fn();
  public readonly viewSolarEclipse = vi.fn();
  public readonly observeSolarEclipse = vi.fn();
  public readonly setSolarEclipsePathVisible = vi.fn();
  public readonly clearSolarEclipsePresentation = vi.fn();
}

function createCatalogModule(events: readonly EarthEclipseEvent[] = []) {
  return {
    findEarthEclipsePage: vi.fn(() => [...events]),
  };
}

function createLocalModule() {
  return {
    calculateLocalSolarEclipse: vi.fn(
      (event: EarthEclipseEvent, location: SolarEclipseObserverLocation): EarthEclipseEvent => ({
        ...event,
        scope: 'local',
        observerName: location.name,
      }),
    ),
  };
}

function eclipse(overrides: Partial<EarthEclipseEvent> = {}): EarthEclipseEvent {
  return {
    id: 'eclipse',
    family: 'solar',
    kind: 'total',
    scope: 'global',
    peak: { julianDay: 2_461_265 },
    obscuration: 1,
    durationMinutes: 2,
    latitude: 43,
    longitude: -2,
    observerName: null,
    observerTimeZone: null,
    sunAltitudeDegrees: null,
    ...overrides,
  };
}

function observerLocation(): SolarEclipseObserverLocation {
  return {
    id: 'paris',
    name: 'Paris',
    latitude: 48.8566,
    longitude: 2.3522,
    timeZone: 'Europe/Paris',
  };
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
