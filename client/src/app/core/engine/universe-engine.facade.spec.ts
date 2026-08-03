import { TestBed } from '@angular/core/testing';
import {
  EngineDebugStats,
  NavigationState,
  UniverseEngineEvent,
} from '../../../data/models/universe.models';
import { NAVIGATION_SCALES } from '../../../engine/camera/navigation-scales';
import { EarthEclipseEvent } from '../../../engine/simulation/earth-eclipse';
import { MAX_EARTH_VISUAL_DAYS_PER_SECOND } from '../../../engine/simulation/earth-rotation-playback';
import { SolarEclipseObserverLocation } from '../../../engine/simulation/solar-eclipse-locations';
import { SearchService } from '../search/search.service';
import { TIME_SPEED_OPTIONS } from '../settings/time-speeds';
import { NavigationUrlService } from '../url/navigation-url.service';
import {
  EARTH_ECLIPSE_CATALOG_LOADER,
  LOCAL_SOLAR_ECLIPSE_CALCULATOR_LOADER,
  UNIVERSE_ENGINE,
  UniverseEngineFacade,
} from './universe-engine.facade';

const engineInstances: FakeUniverseEngine[] = [];

class FakeUniverseEngine {
  public readonly dispose = vi.fn();
  public readonly setTarget = vi.fn(async () => undefined);
  public readonly completeTargetTransition = vi.fn();
  public readonly clearSolarEclipsePresentation = vi.fn();
  public readonly viewOrbit = vi.fn();
  public readonly viewScale = vi.fn();
  public readonly selectObject = vi.fn();
  public readonly setPlaying = vi.fn();
  public readonly setTimeSpeed = vi.fn();
  public readonly setTime = vi.fn();
  public readonly zoomBy = vi.fn();
  public readonly resize = vi.fn();
  public readonly setDisplayOptions = vi.fn();
  public readonly viewSolarEclipse = vi.fn();
  public readonly observeSolarEclipse = vi.fn();
  public readonly setSolarEclipsePathVisible = vi.fn();
  public readonly initialize = vi.fn(async () => undefined);
  public readonly hasObject = vi.fn(() => true);
  public readonly start = vi.fn();
  public readonly unsubscribe = vi.fn();
  public recommendedQuality = 'high';
  public currentTime = { julianDay: 2_461_250 };
  public cameraDistance = 42;
  public readonly subscribe = vi.fn((listener: (event: unknown) => void) => {
    this.listener = listener;

    return this.unsubscribe;
  });
  private listener: ((event: unknown) => void) | null = null;

  constructor() {
    engineInstances.push(this);
  }

  public emit(event: unknown): void {
    this.listener?.(event);
  }
}

const eclipseModule = {
  findUpcomingEarthEclipses: vi.fn((): EarthEclipseEvent[] => []),
};
const localEclipseModule = {
  calculateLocalSolarEclipse: vi.fn(
    (event: EarthEclipseEvent, location: SolarEclipseObserverLocation): EarthEclipseEvent => ({
      ...event,
      id: `${event.id}-${location.id}`,
      scope: 'local',
      observerName: location.name,
      observerTimeZone: location.timeZone,
    }),
  ),
};

describe('UniverseEngineFacade', () => {
  const searchService = {
    setData: vi.fn(),
  };
  const urlService = {
    read: vi.fn((): Partial<NavigationState> => ({})),
    scheduleWrite: vi.fn(),
    createShareUrl: vi.fn(() => 'https://example.test/?target=earth'),
  };

  let facade: UniverseEngineFacade;
  let engine: FakeEngine;

  beforeEach(() => {
    vi.useFakeTimers();
    vi.clearAllMocks();
    engineInstances.length = 0;
    urlService.read.mockReturnValue({});
    eclipseModule.findUpcomingEarthEclipses.mockReturnValue([]);
    localEclipseModule.calculateLocalSolarEclipse.mockImplementation((eclipse, location) => ({
      ...eclipse,
      id: `${eclipse.id}-${location.id}`,
      scope: 'local',
      observerName: location.name,
      observerTimeZone: location.timeZone,
    }));
    window.history.replaceState(null, '', '/');
    TestBed.configureTestingModule({
      providers: [
        UniverseEngineFacade,
        { provide: SearchService, useValue: searchService },
        { provide: NavigationUrlService, useValue: urlService },
        {
          provide: UNIVERSE_ENGINE,
          useFactory: () => new FakeUniverseEngine(),
        },
        {
          provide: EARTH_ECLIPSE_CATALOG_LOADER,
          useValue: async () => ({
            findUpcomingEarthEclipses: eclipseModule.findUpcomingEarthEclipses,
          }),
        },
        {
          provide: LOCAL_SOLAR_ECLIPSE_CALCULATOR_LOADER,
          useValue: async () => ({
            calculateLocalSolarEclipse: localEclipseModule.calculateLocalSolarEclipse,
          }),
        },
      ],
    });

    facade = TestBed.inject(UniverseEngineFacade);
    engine = engineInstances[0]!;
  });

  afterEach(() => {
    vi.useRealTimers();
    TestBed.resetTestingModule();
  });

  it('calcule la sélection, les horloges et la stabilisation terrestre', () => {
    const earth = spaceObject('earth', 'Terre');
    const eventObject = spaceObject('event', 'Événement');

    facade.objects.set([earth]);
    facade.selectedId.set('earth');
    expect(facade.selectedObject()).toBe(earth);

    (facade as unknown as FacadeAccess).handleEngineEvent({
      type: 'object-selected',
      objectId: 'event',
      object: eventObject,
    } satisfies UniverseEngineEvent);
    expect(facade.selectedObject()).toBe(eventObject);

    facade.playing.set(false);
    facade.speed.set(MAX_EARTH_VISUAL_DAYS_PER_SECOND * 2);
    expect(facade.earthRotationStabilized()).toBe(false);
    facade.playing.set(true);
    expect(facade.earthRotationStabilized()).toBe(true);
    facade.speed.set(MAX_EARTH_VISUAL_DAYS_PER_SECOND);
    expect(facade.earthRotationStabilized()).toBe(false);
    expect(facade.currentIsoDateTime()).not.toBe('');
    expect(facade.currentLocalClock()).not.toBe('');
  });

  it('compose l’éclipse solaire courante et choisit l’événement de timeline pertinent', () => {
    expect(facade.currentSolarEclipse()).toBeNull();
    expect(facade.timelineSolarEclipse()).toBeNull();

    facade.currentTime.set({ julianDay: 2_461_265.5 });
    facade.solarEclipseState.set({
      phase: 'total',
      centralLatitude: 43.5,
      centralLongitude: -1.5,
    });
    const current = facade.currentSolarEclipse()!;

    expect(current).toMatchObject({
      family: 'solar',
      kind: 'total',
      scope: 'instant',
      latitude: 43.5,
      longitude: -1.5,
    });
    expect(facade.timelineSolarEclipse()).toEqual(current);

    const nearby = eclipse({ peak: { julianDay: current.peak.julianDay + 0.4 } });

    facade.activeSolarEclipse.set(nearby);
    expect(facade.timelineSolarEclipse()).toBe(nearby);

    facade.activeSolarEclipse.set(eclipse({ peak: { julianDay: current.peak.julianDay + 0.5 } }));
    expect(facade.timelineSolarEclipse()).toEqual(current);
  });

  it('décrit le lieu et le contexte de toutes les présentations solaires', () => {
    expect(facade.solarObserverLocation()).toBe('Point central');
    expect(facade.eclipseContextLabel()).toBe('Phénomène en cours');

    facade.solarEclipseState.set({
      phase: 'partial',
      centralLatitude: null,
      centralLongitude: 2,
    });
    expect(facade.solarObserverLocation()).toBe('Point central calculé');

    facade.activeSolarEclipse.set(
      eclipse({
        scope: 'local',
        observerName: 'Paris',
        latitude: 48.9,
        longitude: 2.3,
        peak: facade.currentTime(),
      }),
    );
    expect(facade.solarObserverLocation()).toBe('Paris · 48.9° N · 2.3° E');
    expect(facade.eclipseContextLabel()).toBe('Maximum local · Paris');

    facade.activeSolarEclipse.set(
      eclipse({
        scope: 'local',
        observerName: null,
        latitude: -43,
        longitude: -2,
        peak: facade.currentTime(),
      }),
    );
    expect(facade.solarObserverLocation()).toBe('43.0° S · 2.0° O');
    expect(facade.eclipseContextLabel()).toBe('Maximum local · lieu choisi');

    facade.activeSolarEclipse.set(eclipse({ scope: 'global', peak: facade.currentTime() }));
    expect(facade.eclipseContextLabel()).toBe('Maximum mondial');

    facade.solarObserverActive.set(true);
    expect(facade.eclipseContextLabel()).toBe('Observation locale');
  });

  it('résume une éclipse locale avec et sans mesures disponibles', () => {
    expect(facade.localEclipseSummary()).toBeNull();

    facade.currentTime.set({ julianDay: 2_461_265 });
    facade.solarEclipseState.set({
      phase: 'partial',
      centralLatitude: 1,
      centralLongitude: 2,
    });
    facade.activeSolarEclipse.set(
      eclipse({
        scope: 'local',
        obscuration: null,
        sunAltitudeDegrees: null,
        observerTimeZone: null,
      }),
    );
    expect(facade.localEclipseSummary()).toContain('occultation indisponible');

    facade.activeSolarEclipse.set(
      eclipse({
        scope: 'local',
        obscuration: 0.734,
        sunAltitudeDegrees: 12.4,
        observerTimeZone: 'UTC',
      }),
    );
    expect(facade.localEclipseSummary()).toContain('73,4 % occulté');
    expect(facade.localEclipseSummary()).toContain('Soleil à 12,4°');
  });

  it('initialise le moteur une seule fois avec les valeurs par défaut', async () => {
    const container = document.createElement('div');
    const first = facade.initialize(container);
    const second = facade.initialize(container);

    expect(second).toBe(first);
    await first;

    expect(engine.subscribe).toHaveBeenCalledOnce();
    expect(engine.initialize).toHaveBeenCalledWith(container, {
      showOrbits: true,
      showConstellations: true,
      showLabels: true,
      quality: 'high',
      labelDensity: 'balanced',
      temporalMode: 'state',
    });
    expect(facade.currentTime()).toEqual(engine.currentTime);
    expect(engine.setTimeSpeed).toHaveBeenCalledWith(1);
    expect(engine.setTarget).toHaveBeenCalledWith('earth', undefined);
    expect(engine.completeTargetTransition).toHaveBeenCalledOnce();
    expect(engine.start).toHaveBeenCalledOnce();
    expect(engine.completeTargetTransition.mock.invocationCallOrder[0]).toBeLessThan(
      engine.start.mock.invocationCallOrder[0]!,
    );
    expect(facade.ready()).toBe(true);
    expect(urlService.scheduleWrite).toHaveBeenCalledOnce();
  });

  it('restaure intégralement une navigation et retombe sur la Terre si la cible manque', async () => {
    urlService.read.mockReturnValue({
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
    });
    engine.hasObject.mockReturnValue(false);
    facade.solarEclipseState.set({
      phase: 'annular',
      centralLatitude: 10,
      centralLongitude: 20,
    });

    await facade.initialize(document.createElement('div'));

    expect(facade.displayOptions()).toEqual({
      showOrbits: false,
      showConstellations: false,
      showLabels: false,
      quality: 'low',
      labelDensity: 'dense',
      temporalMode: 'observable',
    });
    expect(engine.setTime).toHaveBeenCalledWith({ julianDay: 2_461_265 });
    expect(engine.setTarget).toHaveBeenCalledWith('earth', 12);
    expect(engine.selectObject).toHaveBeenCalledWith(null);
    expect(engine.viewSolarEclipse).toHaveBeenCalled();
  });

  it('restaure une sélection distincte sans remplacer une sélection identique', async () => {
    urlService.read.mockReturnValue({
      targetId: 'mars',
      selectedId: 'venus',
    });
    await facade.initialize(document.createElement('div'));
    expect(engine.selectObject).toHaveBeenCalledWith('venus');

    facade.dispose();
    urlService.read.mockReturnValue({
      targetId: 'mars',
      selectedId: 'mars',
    });
    await facade.initialize(document.createElement('div'));
    expect(engine.selectObject).toHaveBeenCalledTimes(1);
  });

  it.each([
    [new Error('WebGL indisponible'), 'WebGL indisponible'],
    ['erreur inconnue', 'Initialisation impossible.'],
  ])('expose une erreur d’initialisation exploitable', async (failure, expected) => {
    engine.initialize.mockRejectedValue(failure);

    await facade.initialize(document.createElement('div'));

    expect(facade.error()).toBe(expected);
    expect(facade.loading()).toBe(false);
  });

  it('libère un moteur initialisé ou non et permet une nouvelle initialisation', async () => {
    facade.dispose();
    expect(engine.dispose).toHaveBeenCalledOnce();

    await facade.initialize(document.createElement('div'));
    facade.dispose();

    expect(engine.unsubscribe).toHaveBeenCalledOnce();
    expect(engine.dispose).toHaveBeenCalledTimes(2);
    expect(facade.ready()).toBe(false);

    await facade.initialize(document.createElement('div'));
    expect(engine.initialize).toHaveBeenCalledTimes(2);
  });

  it('centre une cible et expose les deux familles d’erreur', async () => {
    facade.activeSolarEclipse.set(eclipse());
    await facade.focus('earth');

    expect(engine.clearSolarEclipsePresentation).toHaveBeenCalledOnce();
    expect(engine.setTarget).toHaveBeenCalledWith('earth');

    engine.setTarget.mockRejectedValueOnce(new Error('Introuvable'));
    await facade.focus('missing');
    expect(facade.error()).toBe('Introuvable');

    engine.setTarget.mockRejectedValueOnce('échec');
    await facade.focus('missing');
    expect(facade.error()).toBe('Cible inaccessible.');
  });

  it('centre uniquement une sélection existante', async () => {
    facade.focusSelected();
    expect(engine.setTarget).not.toHaveBeenCalled();

    facade.selectedId.set('mars');
    facade.focusSelected();
    await Promise.resolve();

    expect(engine.setTarget).toHaveBeenCalledWith('mars');
  });

  it('cadre une orbite, l’active si nécessaire et traduit les erreurs', () => {
    facade.displayOptions.set({ ...facade.displayOptions(), showOrbits: false });
    facade.viewOrbit('earth');

    expect(facade.displayOptions().showOrbits).toBe(true);
    expect(engine.setDisplayOptions).toHaveBeenCalled();
    expect(engine.viewOrbit).toHaveBeenCalledWith('earth');

    engine.viewOrbit.mockImplementationOnce(() => {
      throw new Error('Pas d’orbite');
    });
    facade.viewOrbit('moon');
    expect(facade.error()).toBe('Pas d’orbite');

    engine.viewOrbit.mockImplementationOnce(() => {
      throw 'échec';
    });
    facade.viewOrbit('moon');
    expect(facade.error()).toBe('Orbite inaccessible.');
  });

  it('navigue vers une échelle et gère une échelle inaccessible', () => {
    const scale = NAVIGATION_SCALES[3]!;

    facade.viewScale(scale);
    expect(engine.viewScale).toHaveBeenCalledWith(scale);

    engine.viewScale.mockImplementationOnce(() => {
      throw new Error('erreur');
    });
    facade.viewScale(scale);
    expect(facade.error()).toBe('Échelle inaccessible.');
  });

  it('ferme la fiche et contrôle lecture et vitesse', () => {
    facade.closeDetails();
    expect(engine.selectObject).toHaveBeenCalledWith(null);

    facade.togglePlaying();
    expect(facade.playing()).toBe(true);
    expect(engine.setPlaying).toHaveBeenCalledWith(true);

    facade.togglePlaying();
    expect(facade.playing()).toBe(false);
    expect(engine.setPlaying).toHaveBeenCalledWith(false);

    facade.activeSolarEclipse.set(eclipse());
    facade.togglePlaying();
    expect(engine.clearSolarEclipsePresentation).toHaveBeenCalled();

    facade.playing.set(false);
    facade.activeSolarEclipse.set(null);
    facade.solarObserverActive.set(true);
    facade.togglePlaying();
    expect(engine.clearSolarEclipsePresentation).toHaveBeenCalledTimes(2);

    facade.setSpeed(30);
    expect(engine.setTimeSpeed).toHaveBeenCalledWith(30);
    expect(facade.speed()).toBe(30);
  });

  it('parcourt les vitesses sans dépasser les bornes', () => {
    facade.speed.set(TIME_SPEED_OPTIONS[0]!.daysPerSecond);
    facade.cycleSpeed(-1);
    expect(facade.speed()).toBe(TIME_SPEED_OPTIONS[0]!.daysPerSecond);

    facade.speed.set(TIME_SPEED_OPTIONS.at(-1)!.daysPerSecond);
    facade.cycleSpeed(1);
    expect(facade.speed()).toBe(TIME_SPEED_OPTIONS.at(-1)!.daysPerSecond);

    facade.speed.set(123);
    facade.cycleSpeed(1);
    expect(facade.speed()).toBe(TIME_SPEED_OPTIONS[4]!.daysPerSecond);
  });

  it('ignore une date invalide et présente une éclipse sur la Terre', () => {
    facade.setDateTime('invalide');
    expect(engine.setTime).not.toHaveBeenCalled();

    facade.targetId.set('mars');
    facade.setDateTime('2026-08-12T17:45');
    expect(engine.setTime).toHaveBeenCalledOnce();
    expect(engine.viewSolarEclipse).not.toHaveBeenCalled();

    facade.targetId.set('earth');
    facade.solarEclipseState.set({
      phase: 'partial',
      centralLatitude: 45,
      centralLongitude: 2,
    });
    facade.setDateTime('2026-08-12T17:45');
    expect(engine.viewSolarEclipse).toHaveBeenCalledOnce();
  });

  it('délègue les contrôles élémentaires du temps et de la caméra', () => {
    const time = { julianDay: 2_451_545 };

    facade.setTime(time);
    facade.returnToPresent();
    facade.zoomIn();
    facade.zoomOut();
    facade.resize(800, 450);

    expect(engine.setTime).toHaveBeenCalledWith(time);
    expect(engine.setTime).toHaveBeenCalledTimes(2);
    expect(engine.zoomBy).toHaveBeenNthCalledWith(1, 0.72);
    expect(engine.zoomBy).toHaveBeenNthCalledWith(2, 1.38);
    expect(engine.resize).toHaveBeenCalledWith(800, 450);
  });

  it('met à jour toutes les options d’affichage et avertit le mode observable', () => {
    facade.toggleOrbits();
    facade.toggleConstellations();
    facade.toggleLabels();
    facade.setQuality('low');
    facade.setLabelDensity('dense');
    facade.setTemporalMode('state');
    expect(facade.performanceWarning()).toBeNull();
    facade.setTemporalMode('observable');

    expect(facade.displayOptions()).toEqual({
      showOrbits: false,
      showConstellations: false,
      showLabels: false,
      quality: 'low',
      labelDensity: 'dense',
      temporalMode: 'observable',
    });
    expect(facade.performanceWarning()).toContain('Vue observable');
    expect(engine.setDisplayOptions).toHaveBeenCalledTimes(7);
  });

  it('rend les panneaux mutuellement exclusifs', async () => {
    facade.helpOpen.set(true);
    facade.eclipseBrowserOpen.set(true);
    facade.toggleSettings();
    expect(facade.settingsOpen()).toBe(true);
    expect(facade.helpOpen()).toBe(false);
    expect(facade.eclipseBrowserOpen()).toBe(false);
    facade.toggleSettings();
    expect(facade.settingsOpen()).toBe(false);

    facade.settingsOpen.set(true);
    facade.eclipseBrowserOpen.set(true);
    facade.toggleHelp();
    expect(facade.helpOpen()).toBe(true);
    expect(facade.settingsOpen()).toBe(false);
    expect(facade.eclipseBrowserOpen()).toBe(false);
    facade.toggleHelp();
    expect(facade.helpOpen()).toBe(false);

    eclipseModule.findUpcomingEarthEclipses.mockReturnValue([eclipse()]);
    facade.toggleEclipseBrowser();
    await vi.waitFor(() => expect(facade.eclipseEventsLoading()).toBe(false));
    expect(facade.upcomingEclipses()).toHaveLength(1);
    facade.toggleEclipseBrowser();
    expect(facade.eclipseBrowserOpen()).toBe(false);
  });

  it('signale un échec du catalogue des éclipses', async () => {
    eclipseModule.findUpcomingEarthEclipses.mockImplementationOnce(() => {
      throw new Error('catalogue indisponible');
    });

    facade.toggleEclipseBrowser();
    await vi.waitFor(() => expect(facade.eclipseEventsLoading()).toBe(false));

    expect(facade.performanceWarning()).toContain('catalogue des éclipses');
  });

  it('affiche une éclipse lunaire puis une éclipse solaire', async () => {
    const lunar = eclipse({ family: 'lunar', kind: 'total' });

    await facade.viewEarthEclipse(lunar);
    expect(engine.setPlaying).toHaveBeenCalledWith(false);
    expect(engine.setTime).toHaveBeenCalledWith(lunar.peak);
    expect(engine.setTarget).toHaveBeenCalledWith('moon');

    const solar = eclipse();

    await facade.viewEarthEclipse(solar);
    expect(facade.activeSolarEclipse()).toBe(solar);
    expect(engine.viewSolarEclipse).toHaveBeenCalledWith(solar);
  });

  it.each([
    [new Error('ombre impossible'), 'ombre impossible'],
    ['échec', 'Visualisation de l’éclipse impossible.'],
  ])('traduit une erreur de vue solaire', async (failure, expected) => {
    engine.viewSolarEclipse.mockImplementationOnce(() => {
      throw failure;
    });

    await facade.viewEarthEclipse(eclipse());

    expect(facade.error()).toBe(expected);
  });

  it('ignore l’observation lunaire et active une observation solaire', () => {
    facade.observeEarthEclipse(eclipse({ family: 'lunar' }));
    expect(engine.observeSolarEclipse).not.toHaveBeenCalled();

    const solar = eclipse();

    facade.observeEarthEclipse(solar);
    expect(facade.solarObserverActive()).toBe(true);
    expect(engine.observeSolarEclipse).toHaveBeenCalledWith(solar);
  });

  it.each([
    [new Error('lieu inaccessible'), 'lieu inaccessible'],
    ['échec', 'Point d’observation inaccessible.'],
  ])('annule une observation solaire en erreur', (failure, expected) => {
    engine.observeSolarEclipse.mockImplementationOnce(() => {
      throw failure;
    });

    facade.observeEarthEclipse(eclipse());

    expect(facade.solarObserverActive()).toBe(false);
    expect(facade.error()).toBe(expected);
  });

  it('calcule puis présente un maximum local', async () => {
    const location = observerLocation();

    await facade.viewLocalSolarEclipse(eclipse(), location);

    expect(localEclipseModule.calculateLocalSolarEclipse).toHaveBeenCalledWith(
      expect.objectContaining({ family: 'solar' }),
      location,
    );
    expect(facade.activeSolarEclipse()?.scope).toBe('local');
    expect(facade.localEclipseLoading()).toBe(false);
  });

  it.each([
    [new Error('aucun maximum'), 'aucun maximum'],
    ['échec', 'Le maximum local est indisponible pour Paris.'],
  ])('signale une erreur de maximum local', async (failure, expected) => {
    localEclipseModule.calculateLocalSolarEclipse.mockImplementationOnce(() => {
      throw failure;
    });

    await facade.viewLocalSolarEclipse(eclipse(), observerLocation());

    expect(facade.performanceWarning()).toBe(expected);
    expect(facade.localEclipseLoading()).toBe(false);
  });

  it('revient de l’observateur vers l’ombre et contrôle sa trajectoire', () => {
    facade.showSolarShadow();
    expect(engine.viewSolarEclipse).not.toHaveBeenCalled();

    const event = eclipse();

    facade.activeSolarEclipse.set(event);
    facade.solarObserverActive.set(true);
    facade.showSolarShadow();
    expect(facade.solarObserverActive()).toBe(false);
    expect(engine.viewSolarEclipse).toHaveBeenCalledWith(event);

    facade.toggleSolarPath(event);
    expect(engine.setSolarEclipsePathVisible).toHaveBeenLastCalledWith(event, true);
    facade.toggleSolarPath(event);
    expect(engine.setSolarEclipsePathVisible).toHaveBeenLastCalledWith(event, false);
  });

  it('copie le lien partageable puis masque la confirmation', async () => {
    const writeText = vi.fn(() => Promise.resolve());

    installClipboard(writeText);
    await facade.copyShareUrl();

    expect(writeText).toHaveBeenCalledWith('https://example.test/?target=earth');
    expect(facade.shareNotice()).toBe('Lien copié');
    vi.advanceTimersByTime(2_400);
    expect(facade.shareNotice()).toBeNull();
  });

  it('propose l’URL du navigateur si le presse-papiers échoue', async () => {
    installClipboard(vi.fn(() => Promise.reject(new Error('refus'))));

    await facade.copyShareUrl();

    expect(facade.shareNotice()).toContain('Copie impossible');
  });

  it('réagit à chaque événement publié par le moteur', async () => {
    facade.ready.set(true);
    const objects = [spaceObject('earth', 'Terre')];
    const updatedObjects = [...objects, spaceObject('mars', 'Mars')];
    const stats = debugStats();
    const events: readonly UniverseEngineEvent[] = [
      { type: 'data-ready', objects, catalogEntries: [] },
      { type: 'objects-changed', objects: updatedObjects },
      { type: 'object-selected', objectId: 'earth', object: objects[0]! },
      { type: 'target-changed', objectId: 'earth' },
      { type: 'camera-changed', zoom: 12 },
      { type: 'time-changed', time: { julianDay: 2_451_545 } },
      {
        type: 'solar-eclipse-state',
        state: { phase: 'partial', centralLatitude: 1, centralLongitude: 2 },
      },
      { type: 'lod-changed', level: 3 },
      { type: 'loading-state', loading: false },
      { type: 'performance-warning', message: 'lent' },
      { type: 'debug-stats', stats },
      { type: 'error', message: 'erreur' },
    ];

    await facade.initialize(document.createElement('div'));
    for (const event of events) {
      engine.emit(event);
    }

    expect(facade.objects()).toEqual(updatedObjects);
    expect(searchService.setData).toHaveBeenCalledWith(objects, []);
    expect(searchService.setData).toHaveBeenCalledOnce();
    expect(facade.selectedId()).toBe('earth');
    expect(facade.targetId()).toBe('earth');
    expect(facade.cameraDistance()).toBe(12);
    expect(facade.currentTime().julianDay).toBe(2_451_545);
    expect(facade.solarEclipseState().phase).toBe('partial');
    expect(facade.lodLevel()).toBe(3);
    expect(facade.loading()).toBe(false);
    expect(facade.performanceWarning()).toBe('lent');
    expect(facade.debugStats()).toBe(stats);
    expect(facade.error()).toBe('erreur');
    expect(urlService.scheduleWrite).toHaveBeenCalled();
  });

  it('ne synchronise l’URL qu’après initialisation et applique les trois replis de zoom', () => {
    const access = facade as unknown as FacadeAccess;

    access.scheduleUrlUpdate();
    expect(urlService.scheduleWrite).not.toHaveBeenCalled();

    facade.ready.set(true);
    facade.cameraDistance.set(15);
    access.scheduleUrlUpdate();
    expect(urlService.scheduleWrite).toHaveBeenLastCalledWith(
      expect.objectContaining({ zoom: 15, labelDensity: 'balanced' }),
    );

    facade.cameraDistance.set(0);
    engine.cameraDistance = 42;
    expect(access.createNavigationState().zoom).toBe(42);
    engine.cameraDistance = 0;
    expect(access.createNavigationState().zoom).toBe(24);
  });
});

describe('dépendances par défaut de la façade', () => {
  afterEach(() => TestBed.resetTestingModule());

  it('fournit le moteur et les deux chargeurs paresseux', async () => {
    TestBed.configureTestingModule({});

    const engine = TestBed.inject(UNIVERSE_ENGINE);
    const eclipseCatalog = await TestBed.inject(EARTH_ECLIPSE_CATALOG_LOADER)();
    const localCalculator = await TestBed.inject(LOCAL_SOLAR_ECLIPSE_CALCULATOR_LOADER)();

    expect(engine).toBeDefined();
    expect(eclipseCatalog.findUpcomingEarthEclipses).toBeTypeOf('function');
    expect(localCalculator.calculateLocalSolarEclipse).toBeTypeOf('function');

    engine.dispose();
  });
});

type FakeEngine = FakeUniverseEngine;

interface FacadeAccess {
  scheduleUrlUpdate(): void;
  createNavigationState(): NavigationState;
  handleEngineEvent(event: UniverseEngineEvent): void;
}

function eclipse(overrides: Partial<EarthEclipseEvent> = {}): EarthEclipseEvent {
  return {
    id: 'solar-total',
    family: 'solar',
    kind: 'total',
    scope: 'global',
    peak: { julianDay: 2_461_265 },
    obscuration: 1,
    durationMinutes: 4,
    latitude: 43,
    longitude: -1,
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

function spaceObject(id: string, name: string) {
  return {
    id,
    name,
    type: 'planet' as const,
    referenceFrame: 'solar-system' as const,
    scientificConfidence: 'calculated' as const,
    visual: {
      visualRadius: 1,
      scaleMode: 'adaptive' as const,
    },
    positionProvider: {
      type: 'static' as const,
      position: [0, 0, 0] as [number, number, number],
      unit: 'astronomical-unit' as const,
    },
  };
}

function debugStats(): EngineDebugStats {
  return {
    fps: 60,
    drawCalls: 10,
    triangles: 1_000,
    geometries: 3,
    textures: 2,
    visibleObjects: 5,
    catalogStars: 1_000,
    cosmicGroups: 0,
    cosmicFilaments: 0,
    batchedGalaxies: 0,
    loadedTiles: 0,
    indexedGalaxyTiles: 0,
    cachedGalaxyTiles: 0,
    activeStarTiles: 0,
    cachedStarPacks: 0,
    cachedStarTiles: 0,
    activeStarClusters: 0,
    cachedStarClusters: 0,
    visibleStarClusters: 0,
    cameraPosition: { x: 1, y: 2, z: 3 },
    cameraTarget: { x: 0, y: 0, z: 0 },
    cameraDistance: 4,
    floatingOrigin: { x: 0, y: 0, z: 0 },
    targetId: 'earth',
    navigationOriginId: 'earth',
    navigationReferenceFrame: 'solar-system',
    lodLevel: 0,
    julianDay: 2_451_545,
    quality: 'high',
    pixelRatio: 2,
    zoom: null,
  };
}

function installClipboard(writeText: (value: string) => Promise<void>): void {
  Object.defineProperty(navigator, 'clipboard', {
    configurable: true,
    value: { writeText },
  });
}
