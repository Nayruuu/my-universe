import { signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import type { DisplayOptions, SpaceObject } from '../../../data/models/universe.models';
import {
  EARTH_OBSERVER_FIELD_OF_VIEW_DEGREES,
  EARTH_OBSERVER_VIEW_EVENT,
  EARTH_OBSERVER_ZOOM_AT_EVENT,
  type EarthObserverViewState,
  type EarthObserverZoomAtDetail,
} from '../../../engine/camera/earth-observer-camera-control';
import type { EarthObserverFraming } from '../../../engine/camera/earth-observer-orientation';
import { EARTH_OBSERVER_LOCATIONS } from '../../../engine/simulation/earth-observer-location';
import { UniverseEngineFacade } from '../../core/engine/universe-engine.facade';
import { EarthObserverSelection } from './earth-observer-selection';
import { EarthSkyViewComponent } from './earth-sky-view.component';
import { EarthSkyViewState } from './earth-sky-view-state';
import { EarthTerrainHorizonCatalogService } from './earth-terrain-horizon-catalog.service';
import type { EarthTerrainHorizonProfile } from './earth-terrain-horizon-catalog.types';

describe('EarthSkyViewComponent', () => {
  const originalGeolocation = Object.getOwnPropertyDescriptor(navigator, 'geolocation');
  const selectedObject = signal<SpaceObject | null>(sirius());
  const objects = signal<readonly SpaceObject[]>([sirius()]);
  const displayOptions = signal<DisplayOptions>({
    showOrbits: true,
    showConstellations: true,
    showLabels: true,
    quality: 'medium',
    labelDensity: 'balanced',
    temporalMode: 'observable',
  });
  const currentTime = signal({ julianDay: 2_461_055.416_666_7 });
  const terrainHorizonLoad = vi.fn<
    (
      location: (typeof EARTH_OBSERVER_LOCATIONS)[number],
    ) => Promise<EarthTerrainHorizonProfile | null>
  >(async () => null);
  const facade = {
    selectedObject,
    objects,
    displayOptions,
    currentTime,
    prepareEarthObservation: vi.fn<
      (
        objectId: string,
        framing?: EarthObserverFraming,
        selectedObjectId?: string | null,
      ) => Promise<void>
    >(() => Promise.resolve()),
    exitEarthObservation: vi.fn(),
    setEarthObserverCelestialPresentations: vi.fn(),
    selectObject: vi.fn(),
    setTemporalMode: vi.fn(),
    toggleConstellations: vi.fn(() => {
      displayOptions.update((options) => ({
        ...options,
        showConstellations: !options.showConstellations,
      }));
    }),
    toggleLabels: vi.fn(() => {
      displayOptions.update((options) => ({ ...options, showLabels: !options.showLabels }));
    }),
    resolveObject: vi.fn(async (objectId: string) =>
      objectId === 'betelgeuse' ? betelgeuse() : null,
    ),
  };

  beforeEach(async () => {
    window.history.replaceState(null, '', '/fr/');
    selectedObject.set(sirius());
    objects.set([sirius()]);
    displayOptions.set({
      showOrbits: true,
      showConstellations: true,
      showLabels: true,
      quality: 'medium',
      labelDensity: 'balanced',
      temporalMode: 'observable',
    });
    currentTime.set({ julianDay: 2_461_055.416_666_7 });
    vi.clearAllMocks();
    terrainHorizonLoad.mockResolvedValue(null);
    await TestBed.configureTestingModule({
      imports: [EarthSkyViewComponent],
      providers: [
        { provide: UniverseEngineFacade, useValue: facade },
        {
          provide: EarthTerrainHorizonCatalogService,
          useValue: { load: terrainHorizonLoad },
        },
      ],
    }).compileComponents();
    TestBed.inject(EarthSkyViewState).open('sirius', 'Sirius');
  });

  afterEach(() => {
    restoreGeolocation(originalGeolocation);
    TestBed.resetTestingModule();
  });

  it('superpose les commandes à la scène 3D sans créer un second rendu', () => {
    const fixture = TestBed.createComponent(EarthSkyViewComponent);
    const viewState = TestBed.inject(EarthSkyViewState);

    fixture.detectChanges();
    const view = fixture.nativeElement.querySelector('#earth-sky-view') as HTMLElement;

    expect(view.getAttribute('aria-label')).toBe('Ciel nocturne depuis Paris');
    expect(view.dataset['phase']).toBe('open');
    expect(view.textContent).toContain('Localiser Sirius');
    expect(fixture.nativeElement.querySelector('canvas')).toBeNull();
    expect(fixture.nativeElement.querySelector('.earth-sky-view__horizon')).not.toBeNull();
    expect(fixture.nativeElement.querySelector('.earth-sky-view__ground')).not.toBeNull();
    expect(fixture.nativeElement.querySelector('[data-body-id="jupiter"]')).not.toBeNull();
    expect(fixture.nativeElement.querySelector('[data-body-id="sun"]')).toBeNull();
    expect(fixture.nativeElement.querySelector('.earth-sky-target')).toBeNull();
    expect(fixture.nativeElement.querySelector('app-universe-search')).not.toBeNull();
    expect(facade.setEarthObserverCelestialPresentations).toHaveBeenLastCalledWith(
      expect.arrayContaining([
        expect.objectContaining({
          objectId: 'jupiter',
          diameterPixels: expect.any(Number),
          direction: expect.objectContaining({
            x: expect.any(Number),
            y: expect.any(Number),
            z: expect.any(Number),
          }),
        }),
      ]),
    );
    expect(
      (
        fixture.nativeElement.querySelector(
          '.earth-sky-view__location summary strong',
        ) as HTMLElement
      ).textContent,
    ).toBe('Paris');

    fixture.nativeElement.querySelector('.earth-sky-view__close').click();
    expect(facade.exitEarthObservation).toHaveBeenCalledOnce();
    expect(facade.setTemporalMode).toHaveBeenCalledWith('state');
    expect(viewState.activeTargetId()).toBeNull();
  });

  it('charge le relief mesuré à la demande et masque les astres derrière celui-ci', async () => {
    terrainHorizonLoad.mockResolvedValue(terrainProfile(9_000));
    const fixture = TestBed.createComponent(EarthSkyViewComponent);

    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();
    const landscape = fixture.nativeElement.querySelector(
      '.earth-sky-view__landscape',
    ) as HTMLElement;

    expect(terrainHorizonLoad).toHaveBeenCalledWith(expect.objectContaining({ id: 'paris' }));
    expect(landscape.dataset['terrainModel']).toBe('noaa-etopo-fixture');
    expect(landscape.dataset['terrainClassification']).toBe(
      'calculated-from-measured-global-relief-model',
    );
    expect(fixture.nativeElement.querySelector('[data-measured-terrain]')).not.toBeNull();
    expect(fixture.nativeElement.querySelector('[data-body-id="jupiter"]')).toBeNull();
    expect(fixture.nativeElement.textContent).toContain('masquée par le relief calculé');
    expect(fixture.nativeElement.textContent).toContain('NOAA ETOPO 2022');
  });

  it('recherche et recentre une étoile sans quitter le planétarium', async () => {
    const fixture = TestBed.createComponent(EarthSkyViewComponent);
    const component = fixture.componentInstance as unknown as SkyViewAccess;
    const viewState = TestBed.inject(EarthSkyViewState);

    fixture.detectChanges();
    const horizonBefore = Number.parseFloat(component.horizonPosition());

    expect(
      (
        fixture.nativeElement.querySelector(
          '.earth-sky-view__search input[type="search"]',
        ) as HTMLInputElement
      ).placeholder,
    ).toBe('Rechercher une étoile dans le ciel');

    await component.selectSearchResult({
      id: 'betelgeuse',
      name: 'Bételgeuse',
      aliases: [],
      type: 'star',
    });

    expect(facade.resolveObject).toHaveBeenCalledWith('betelgeuse');
    expect(facade.prepareEarthObservation).toHaveBeenCalledWith(
      'betelgeuse',
      expect.objectContaining({ initialPitchOffsetDegrees: expect.any(Number) }),
    );
    expect(facade.selectObject).toHaveBeenCalledWith('betelgeuse');
    const framing = facade.prepareEarthObservation.mock.calls.at(-1)?.[1];
    const fieldOfView = framing?.verticalFieldOfViewDegrees ?? 82;
    const centerAltitude = framing?.initialCenterAltitudeDegrees ?? 0;

    expect(50 + (centerAltitude / fieldOfView) * 100).toBeCloseTo(horizonBefore, 5);
    expect(viewState.activeTargetId()).toBe('betelgeuse');
    expect(viewState.phase()).toBe('open');
  });

  it('garde exactement la même carte pendant le voyage puis affiche seulement les commandes', () => {
    const viewState = TestBed.inject(EarthSkyViewState);

    viewState.close();
    const journey = viewState.beginJourney('sirius', 'Sirius');
    const fixture = TestBed.createComponent(EarthSkyViewComponent);

    fixture.detectChanges();
    const view = fixture.nativeElement.querySelector('#earth-sky-view') as HTMLElement;

    expect(view.dataset['phase']).toBe('travelling');
    expect(view.getAttribute('aria-busy')).toBe('true');
    expect(fixture.nativeElement.querySelector('canvas')).toBeNull();
    expect(fixture.nativeElement.querySelector('.earth-sky-view__landscape')).not.toBeNull();
    expect(fixture.nativeElement.querySelector('.earth-sky-view__heading')).toBeNull();

    expect(viewState.completeJourney(journey)).toBe(true);
    fixture.detectChanges();

    expect(view.dataset['phase']).toBe('open');
    expect(view.getAttribute('aria-busy')).toBe('false');
    expect(fixture.nativeElement.querySelector('.earth-sky-view__heading')).not.toBeNull();
    expect(fixture.nativeElement.querySelector('.earth-sky-view__controls')).not.toBeNull();
  });

  it('recentre la caméra 3D et pilote ses constellations et ses labels', async () => {
    const fixture = TestBed.createComponent(EarthSkyViewComponent);

    fixture.detectChanges();
    const recenter = fixture.nativeElement.querySelector(
      '.earth-sky-view__recenter',
    ) as HTMLButtonElement;
    const constellationButton = fixture.nativeElement.querySelector(
      '.earth-sky-view__constellations',
    ) as HTMLButtonElement;
    const labelsButton = fixture.nativeElement.querySelector(
      '.earth-sky-view__labels',
    ) as HTMLButtonElement;

    recenter.click();
    await fixture.whenStable();
    expect(facade.prepareEarthObservation).toHaveBeenCalledWith(
      'sirius',
      expect.objectContaining({
        initialPitchOffsetDegrees: expect.any(Number),
        pitchLimits: {
          minimumPitchOffsetDegrees: expect.any(Number),
          maximumPitchOffsetDegrees: expect.any(Number),
        },
      }),
      'sirius',
    );

    constellationButton.click();
    labelsButton.click();
    fixture.detectChanges();
    expect(facade.toggleConstellations).toHaveBeenCalledOnce();
    expect(facade.toggleLabels).toHaveBeenCalledOnce();
    expect(constellationButton.getAttribute('aria-pressed')).toBe('false');
    expect(labelsButton.getAttribute('aria-pressed')).toBe('false');
  });

  it('sélectionne une planète visible sans quitter le ciel terrestre', () => {
    const fixture = TestBed.createComponent(EarthSkyViewComponent);
    const viewState = TestBed.inject(EarthSkyViewState);

    fixture.detectChanges();
    const jupiter = fixture.nativeElement.querySelector(
      '[data-body-id="jupiter"]',
    ) as HTMLButtonElement;

    expect(jupiter.dataset['angularDiameterConfidence']).toBe('calculated');
    expect(Number(jupiter.dataset['angularDiameterDegrees'])).toBeGreaterThan(0);
    expect(Number(jupiter.dataset['apparentDiameterPixels'])).toBeGreaterThan(0);
    expect(jupiter.dataset['displayScaleMode']).toBe(
      'calculated-angular-size-with-illustrative-readability-floor',
    );
    expect(jupiter.dataset['resolved']).toBe('false');
    expect(jupiter.dataset['renderer']).toBe('webgl-existing-object');
    expect(jupiter.style.getPropertyValue('--body-texture')).toBe('');
    jupiter.click();

    expect(facade.selectObject).toHaveBeenCalledWith('jupiter');
    expect(viewState.activeTargetId()).toBe('sirius');
    expect(fixture.nativeElement.querySelector('#earth-sky-view')).not.toBeNull();
  });

  it('transmet la molette d’une planète au zoom observateur avec sa position écran', () => {
    const fixture = TestBed.createComponent(EarthSkyViewComponent);
    const forwarded: EarthObserverZoomAtDetail[] = [];
    let interceptZoom = true;
    const handleZoom = (event: Event): void => {
      forwarded.push((event as CustomEvent<EarthObserverZoomAtDetail>).detail);
      if (interceptZoom) {
        event.preventDefault();
      }
    };

    window.addEventListener(EARTH_OBSERVER_ZOOM_AT_EVENT, handleZoom);
    try {
      fixture.detectChanges();
      const jupiter = fixture.nativeElement.querySelector(
        '[data-body-id="jupiter"]',
      ) as HTMLButtonElement;
      const wheel = new WheelEvent('wheel', {
        bubbles: true,
        cancelable: true,
        clientX: 321,
        clientY: 123,
        deltaMode: WheelEvent.DOM_DELTA_PIXEL,
        deltaY: -480,
      });

      jupiter.dispatchEvent(wheel);

      expect(forwarded).toHaveLength(1);
      expect(forwarded[0]).toMatchObject({
        anchorAltitudeDegrees: expect.any(Number),
        anchorAzimuthDegrees: expect.any(Number),
        clientX: 321,
        clientY: 123,
        deltaMode: WheelEvent.DOM_DELTA_PIXEL,
        deltaY: -480,
      });
      expect(wheel.defaultPrevented).toBe(true);

      interceptZoom = false;
      const unhandledWheel = new WheelEvent('wheel', {
        bubbles: true,
        cancelable: true,
        clientX: 321,
        clientY: 123,
        deltaY: -120,
      });

      jupiter.dispatchEvent(unhandledWheel);

      expect(forwarded).toHaveLength(2);
      expect(unhandledWheel.defaultPrevented).toBe(false);
    } finally {
      window.removeEventListener(EARTH_OBSERVER_ZOOM_AT_EVENT, handleZoom);
    }
  });

  it('affiche la Lune éclairée selon sa phase sans jamais ajouter le Soleil', () => {
    const target = moonSightline();

    selectedObject.set(target);
    objects.set([target]);
    currentTime.set({ julianDay: 2_461_269.130_555_555_7 });
    TestBed.inject(EarthSkyViewState).open(target.id, target.name);
    const fixture = TestBed.createComponent(EarthSkyViewComponent);

    fixture.detectChanges();
    const moon = fixture.nativeElement.querySelector('[data-body-id="moon"]') as HTMLButtonElement;

    expect(moon).not.toBeNull();
    expect(moon.dataset['lunarPhase']).toBe('crescent');
    expect(moon.dataset['lunarWaxing']).toBe('true');
    expect(moon.dataset['angularDiameterConfidence']).toBe('calculated');
    expect(moon.dataset['appearanceConfidence']).toBe('observed');
    expect(moon.dataset['resolved']).toBe('true');
    expect(moon.dataset['renderer']).toBe('webgl-existing-object');
    expect(moon.style.getPropertyValue('--moon-phase-scale')).toBe('');
    expect(fixture.nativeElement.querySelector('[data-body-id="sun"]')).toBeNull();

    moon.click();
    expect(facade.selectObject).toHaveBeenCalledWith('moon');
  });

  it('déplace l’horizon avec le regard et le champ de vision sans remplacer la scène', () => {
    const fixture = TestBed.createComponent(EarthSkyViewComponent);

    fixture.detectChanges();
    const landscape = fixture.nativeElement.querySelector(
      '.earth-sky-view__landscape',
    ) as HTMLElement;
    const initialPosition = landscape.style.getPropertyValue('--horizon-y');
    const detail: EarthObserverViewState = {
      active: true,
      pitchOffsetDegrees: -12,
      azimuthOffsetDegrees: 18,
      verticalFieldOfViewDegrees: 64,
    };

    window.dispatchEvent(new CustomEvent(EARTH_OBSERVER_VIEW_EVENT, { detail }));
    fixture.detectChanges();

    expect(landscape.style.getPropertyValue('--horizon-y')).not.toBe(initialPosition);
    expect(fixture.nativeElement.querySelector('canvas')).toBeNull();

    window.dispatchEvent(
      new CustomEvent(EARTH_OBSERVER_VIEW_EVENT, { detail: { ...detail, active: false } }),
    );
    fixture.detectChanges();
    expect(landscape.style.getPropertyValue('--horizon-y')).toBe(initialPosition);
  });

  it('garde l’horizon fixe pendant que le référentiel terrestre entraîne le ciel', () => {
    const fixture = TestBed.createComponent(EarthSkyViewComponent);

    fixture.detectChanges();
    window.dispatchEvent(
      new CustomEvent(EARTH_OBSERVER_VIEW_EVENT, {
        detail: {
          active: true,
          pitchOffsetDegrees: 0,
          azimuthOffsetDegrees: 0,
          verticalFieldOfViewDegrees: 82,
          centerAltitudeDegrees: 28,
          centerAzimuthDegrees: 195,
        } satisfies EarthObserverViewState,
      }),
    );
    fixture.detectChanges();
    const component = fixture.componentInstance as unknown as SkyViewAccess;
    const landscape = fixture.nativeElement.querySelector(
      '.earth-sky-view__landscape',
    ) as HTMLElement;
    const horizonBefore = landscape.style.getPropertyValue('--horizon-y');

    currentTime.set({ julianDay: currentTime().julianDay + 0.25 });
    fixture.detectChanges();

    expect(landscape.style.getPropertyValue('--horizon-y')).toBe(horizonBefore);
    expect(component.horizonPerspective().centerAzimuthDegrees).toBe(195);
  });

  it('maintient le décor de l’horizon dans une plage stable malgré un état transitoire extrême', () => {
    const fixture = TestBed.createComponent(EarthSkyViewComponent);

    fixture.detectChanges();
    const landscape = fixture.nativeElement.querySelector(
      '.earth-sky-view__landscape',
    ) as HTMLElement;
    const detail: EarthObserverViewState = {
      active: true,
      pitchOffsetDegrees: -500,
      azimuthOffsetDegrees: 0,
      verticalFieldOfViewDegrees: 24,
    };

    window.dispatchEvent(new CustomEvent(EARTH_OBSERVER_VIEW_EVENT, { detail }));
    fixture.detectChanges();
    expect(landscape.style.getPropertyValue('--horizon-y')).toBe('0%');

    window.dispatchEvent(
      new CustomEvent(EARTH_OBSERVER_VIEW_EVENT, {
        detail: { ...detail, pitchOffsetDegrees: 500 },
      }),
    );
    fixture.detectChanges();
    expect(landscape.style.getPropertyValue('--horizon-y')).toBe('120%');
  });

  it('applique le cadrage d’arrivée à l’horizon dès le premier plan du voyage', () => {
    const viewState = TestBed.inject(EarthSkyViewState);

    currentTime.set({ julianDay: 2_461_269.416_666_643 });
    viewState.close();
    viewState.beginJourney('sirius', 'Sirius', sirius(), 72.1);
    const fixture = TestBed.createComponent(EarthSkyViewComponent);

    fixture.detectChanges();
    const landscape = fixture.nativeElement.querySelector(
      '.earth-sky-view__landscape',
    ) as HTMLElement;
    const horizonPercentage = Number.parseFloat(landscape.style.getPropertyValue('--horizon-y'));

    expect(horizonPercentage).toBeGreaterThan(50);
    expect(horizonPercentage).toBeLessThan(100);
  });

  it('reprojette les astres lorsque la fenêtre change de taille', () => {
    const fixture = TestBed.createComponent(EarthSkyViewComponent);

    fixture.detectChanges();
    window.dispatchEvent(new Event('resize'));
    fixture.detectChanges();

    expect(fixture.nativeElement.querySelector('[data-body-id="jupiter"]')).not.toBeNull();
  });

  it('place le sol devant une cible sous l’horizon et tolère une observation indisponible', () => {
    currentTime.set({ julianDay: 2_461_055 });
    const fixture = TestBed.createComponent(EarthSkyViewComponent);
    const component = fixture.componentInstance as unknown as SkyViewAccess;

    fixture.detectChanges();
    expect(fixture.nativeElement.querySelector('.earth-sky-view__landscape--below')).not.toBeNull();
    const belowHorizonMessage = fixture.nativeElement.querySelector(
      '.earth-sky-view__below-horizon',
    ) as HTMLElement;

    expect(belowHorizonMessage.getAttribute('role')).toBe('status');
    expect(belowHorizonMessage.textContent).toContain('Sirius est actuellement sous l’horizon');
    expect(belowHorizonMessage.textContent).toContain('Paris');

    selectedObject.set(null);
    objects.set([]);
    fixture.detectChanges();
    expect(component.horizonPosition()).toBe('100%');
    expect(component.horizonPerspective().centerAzimuthDegrees).toBe(0);
  });

  it('recentre avec un cadrage neutre hors du domaine temporel des éphémérides', async () => {
    currentTime.set({ julianDay: Number.MAX_SAFE_INTEGER });
    const fixture = TestBed.createComponent(EarthSkyViewComponent);
    const component = fixture.componentInstance as unknown as SkyViewAccess;

    fixture.detectChanges();
    await component.recenterSky();

    expect(facade.prepareEarthObservation).toHaveBeenCalledWith(
      'sirius',
      expect.objectContaining({ initialPitchOffsetDegrees: 0 }),
      'sirius',
    );
  });

  it('actualise le lieu, conserve un lieu personnalisé et tolère une cible non chargée', async () => {
    const fixture = TestBed.createComponent(EarthSkyViewComponent);
    const selection = TestBed.inject(EarthObserverSelection);
    const component = fixture.componentInstance as unknown as SkyViewAccess;

    fixture.detectChanges();
    component.changeLocation('lyon');
    await fixture.whenStable();
    fixture.detectChanges();
    expect(selection.location()?.id).toBe('lyon');
    expect(facade.prepareEarthObservation).toHaveBeenCalledWith(
      'sirius',
      expect.objectContaining({
        initialPitchOffsetDegrees: expect.any(Number),
        pitchLimits: {
          minimumPitchOffsetDegrees: expect.any(Number),
          maximumPitchOffsetDegrees: expect.any(Number),
        },
      }),
      'sirius',
    );
    expect(fixture.nativeElement.textContent).toContain('Lyon');

    selection.setLocation(customLocation());
    fixture.detectChanges();
    await fixture.whenStable();
    expect(fixture.nativeElement.textContent).toContain('Observatoire privé');
    expect(facade.prepareEarthObservation).toHaveBeenLastCalledWith(
      'sirius',
      expect.objectContaining({ initialPitchOffsetDegrees: expect.any(Number) }),
      'sirius',
    );

    component.changeLocation('missing');
    expect(selection.location()).toBeNull();

    selectedObject.set(null);
    objects.set([]);
    TestBed.inject(EarthSkyViewState).open('missing', 'Introuvable');
    fixture.detectChanges();
    expect(fixture.nativeElement.textContent).toContain('Localiser Introuvable');

    facade.prepareEarthObservation.mockClear();
    await component.recenterSky();
    expect(facade.prepareEarthObservation).toHaveBeenLastCalledWith('missing', undefined, null);

    TestBed.inject(EarthSkyViewState).close();
    await component.recenterSky();
    expect(facade.prepareEarthObservation).toHaveBeenCalledTimes(1);
  });

  it('utilise la position consentie dans le ciel et dans l’état partageable', async () => {
    installGeolocation(geolocationResolving(position(43.296_482, 5.369_78)));
    const fixture = TestBed.createComponent(EarthSkyViewComponent);
    const selection = TestBed.inject(EarthObserverSelection);

    fixture.detectChanges();
    const menu = fixture.nativeElement.querySelector(
      '.earth-sky-view__location details',
    ) as HTMLDetailsElement;

    menu.open = true;
    (
      fixture.nativeElement.querySelector(
        '.earth-sky-view__location .earth-observer-picker__geolocation',
      ) as HTMLButtonElement
    ).click();
    await fixture.whenStable();
    fixture.detectChanges();

    expect(selection.location()).toMatchObject({
      id: 'coordinates-43.296000-5.370000',
      name: 'Ma position',
      latitude: 43.296,
      longitude: 5.37,
    });
    expect(fixture.nativeElement.textContent).toContain('Ciel nocturne depuis Ma position');
    expect(facade.prepareEarthObservation).toHaveBeenLastCalledWith(
      'sirius',
      expect.objectContaining({ initialPitchOffsetDegrees: expect.any(Number) }),
      'sirius',
    );
  });

  it('recentre le ciel lorsqu’une fiche change le lieu partagé', async () => {
    const fixture = TestBed.createComponent(EarthSkyViewComponent);
    const selection = TestBed.inject(EarthObserverSelection);
    const tokyo = EARTH_OBSERVER_LOCATIONS.find(({ name }) => name === 'Tokyo')!;

    fixture.detectChanges();
    facade.prepareEarthObservation.mockClear();

    selection.setLocation(tokyo);
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();

    expect(facade.prepareEarthObservation).toHaveBeenCalledTimes(1);
    expect(facade.prepareEarthObservation).toHaveBeenCalledWith(
      'sirius',
      expect.objectContaining({
        initialCenterAltitudeDegrees: expect.any(Number),
        initialPitchOffsetDegrees: expect.any(Number),
        northDirection: expect.any(Object),
        zenithDirection: expect.any(Object),
      }),
      'sirius',
    );
    expect(fixture.nativeElement.textContent).toContain('Tokyo');
  });

  it('tolère la suppression du lieu depuis une autre commande sans recentrer', async () => {
    const fixture = TestBed.createComponent(EarthSkyViewComponent);
    const selection = TestBed.inject(EarthObserverSelection);

    fixture.detectChanges();
    facade.prepareEarthObservation.mockClear();

    selection.setLocation(null);
    fixture.detectChanges();
    await fixture.whenStable();

    expect(facade.prepareEarthObservation).not.toHaveBeenCalled();
  });

  it('ne rouvre pas une fiche fermée lors du changement de ville', async () => {
    selectedObject.set(null);
    const fixture = TestBed.createComponent(EarthSkyViewComponent);
    const component = fixture.componentInstance as unknown as SkyViewAccess;

    fixture.detectChanges();
    const parisLandscape = fixture.nativeElement.querySelector(
      '.earth-sky-view__landscape',
    ) as HTMLElement;
    const parisHorizonPercentage = Number.parseFloat(
      parisLandscape.style.getPropertyValue('--horizon-y'),
    );

    component.changeLocation('geonames-1850147');
    await fixture.whenStable();

    expect(facade.prepareEarthObservation).toHaveBeenCalledWith(
      'sirius',
      expect.objectContaining({ initialPitchOffsetDegrees: expect.any(Number) }),
      null,
    );
    const landscape = fixture.nativeElement.querySelector(
      '.earth-sky-view__landscape',
    ) as HTMLElement;
    const horizonPercentage = Number.parseFloat(landscape.style.getPropertyValue('--horizon-y'));

    expect(horizonPercentage).toBeCloseTo(parisHorizonPercentage, 5);
    expect(horizonPercentage).toBeGreaterThan(50);
    expect(horizonPercentage).toBeLessThan(100);
    expect(landscape.dataset['horizonProfile']).toBe('geonames-1850147');
    expect(fixture.nativeElement.querySelector('[data-cityscape-svg="paris"]')).toBeNull();
    expect(fixture.nativeElement.querySelector('[data-cityscape-svg="tokyo"]')).not.toBeNull();
    const expectedFraming = facade.prepareEarthObservation.mock.calls.at(-1)?.[1];
    const expectedPitchOffset = expectedFraming?.initialPitchOffsetDegrees ?? 0;
    const expectedCenterAltitude = expectedFraming?.initialCenterAltitudeDegrees;

    expect(expectedCenterAltitude).toEqual(expect.any(Number));

    dispatchObserverView({ active: false, pitchOffsetDegrees: 0 });
    dispatchObserverView({ active: true, pitchOffsetDegrees: 0 });
    dispatchObserverView({
      active: true,
      pitchOffsetDegrees: expectedPitchOffset,
      azimuthOffsetDegrees: 12,
    });
    dispatchObserverView({
      active: true,
      pitchOffsetDegrees: expectedPitchOffset,
      verticalFieldOfViewDegrees: EARTH_OBSERVER_FIELD_OF_VIEW_DEGREES + 8,
    });
    dispatchObserverView({
      active: true,
      centerAltitudeDegrees: expectedCenterAltitude! + 5,
      pitchOffsetDegrees: expectedPitchOffset,
    });
    dispatchObserverView({
      active: true,
      centerAltitudeDegrees: expectedCenterAltitude,
      pitchOffsetDegrees: expectedPitchOffset + 5,
    });
    fixture.detectChanges();
    expect(Number.parseFloat(landscape.style.getPropertyValue('--horizon-y'))).toBeCloseTo(
      horizonPercentage,
      5,
    );

    dispatchObserverView({
      active: true,
      pitchOffsetDegrees: expectedPitchOffset,
      azimuthOffsetDegrees: 359.8,
    });
    dispatchObserverView({ active: true, pitchOffsetDegrees: expectedPitchOffset + 5 });
    fixture.detectChanges();
    expect(Number.parseFloat(landscape.style.getPropertyValue('--horizon-y'))).not.toBeCloseTo(
      horizonPercentage,
      5,
    );
  });

  it('restaure le suivi de la caméra si un recentrage de ville échoue', async () => {
    const fixture = TestBed.createComponent(EarthSkyViewComponent);
    const component = fixture.componentInstance as unknown as SkyViewAccess;

    fixture.detectChanges();
    const landscape = fixture.nativeElement.querySelector(
      '.earth-sky-view__landscape',
    ) as HTMLElement;
    const initialPosition = landscape.style.getPropertyValue('--horizon-y');

    facade.prepareEarthObservation.mockRejectedValueOnce(new Error('navigation unavailable'));

    await expect(component.recenterSky()).rejects.toThrow('navigation unavailable');
    dispatchObserverView({ active: true, pitchOffsetDegrees: -12 });
    fixture.detectChanges();

    expect(landscape.style.getPropertyValue('--horizon-y')).not.toBe(initialPosition);
  });

  it('retrouve la cible dans le catalogue lorsqu’un autre objet est sélectionné', () => {
    selectedObject.set({ ...sirius(), id: 'earth', name: 'Terre', type: 'planet' });
    objects.set([sirius()]);
    const fixture = TestBed.createComponent(EarthSkyViewComponent);

    fixture.detectChanges();

    expect(fixture.nativeElement.textContent).toContain('Localiser Sirius');
  });

  it('conserve le paysage après la fermeture de la fiche d’une étoile chargée dynamiquement', () => {
    const dynamicStar = { ...sirius(), id: 'hyg-dynamic', name: 'Étoile dynamique' };
    const viewState = TestBed.inject(EarthSkyViewState);

    selectedObject.set(dynamicStar);
    objects.set([]);
    viewState.open(dynamicStar.id, dynamicStar.name, dynamicStar);
    const fixture = TestBed.createComponent(EarthSkyViewComponent);

    fixture.detectChanges();
    expect(fixture.nativeElement.querySelector('.earth-sky-view__ground')).not.toBeNull();

    selectedObject.set(null);
    fixture.detectChanges();

    expect(fixture.nativeElement.querySelector('.earth-sky-view__ground')).not.toBeNull();
    expect(fixture.nativeElement.querySelector('.earth-sky-view__horizon')).not.toBeNull();
    expect(fixture.nativeElement.textContent).toContain('Localiser Étoile dynamique');
  });

  it('ferme son état lors de sa destruction', () => {
    const fixture = TestBed.createComponent(EarthSkyViewComponent);
    const viewState = TestBed.inject(EarthSkyViewState);

    fixture.detectChanges();
    fixture.destroy();
    expect(viewState.phase()).toBe('closed');
    expect(facade.setEarthObserverCelestialPresentations).toHaveBeenLastCalledWith([]);
  });
});

interface SkyViewAccess {
  changeLocation(locationId: string): void;
  changeCurrentPosition(location: ReturnType<typeof customLocation>): void;
  recenterSky(): Promise<void>;
  selectSearchResult(result: {
    readonly id: string;
    readonly name: string;
    readonly aliases: readonly string[];
    readonly type: 'star';
  }): Promise<void>;
  horizonPosition(): string;
  horizonPerspective(): { readonly centerAzimuthDegrees: number };
}

function installGeolocation(geolocation: Geolocation): void {
  Object.defineProperty(navigator, 'geolocation', {
    configurable: true,
    value: geolocation,
  });
}

function restoreGeolocation(descriptor: PropertyDescriptor | undefined): void {
  if (descriptor) {
    Object.defineProperty(navigator, 'geolocation', descriptor);
  } else {
    Reflect.deleteProperty(navigator, 'geolocation');
  }
}

function geolocationResolving(positionResult: GeolocationPosition): Geolocation {
  return {
    getCurrentPosition: vi.fn((success: PositionCallback) => success(positionResult)),
    watchPosition: vi.fn(),
    clearWatch: vi.fn(),
  };
}

function position(latitude: number, longitude: number): GeolocationPosition {
  return {
    coords: {
      accuracy: 25,
      altitude: null,
      altitudeAccuracy: null,
      heading: null,
      latitude,
      longitude,
      speed: null,
      toJSON: () => ({}),
    },
    timestamp: 0,
    toJSON: () => ({}),
  };
}

function dispatchObserverView(
  view: Pick<EarthObserverViewState, 'active' | 'pitchOffsetDegrees'> &
    Partial<Omit<EarthObserverViewState, 'active' | 'pitchOffsetDegrees'>>,
): void {
  window.dispatchEvent(
    new CustomEvent(EARTH_OBSERVER_VIEW_EVENT, {
      detail: {
        azimuthOffsetDegrees: 0,
        verticalFieldOfViewDegrees: EARTH_OBSERVER_FIELD_OF_VIEW_DEGREES,
        ...view,
      },
    }),
  );
}

function customLocation() {
  return {
    id: 'custom',
    name: 'Observatoire privé',
    latitude: 40,
    longitude: 3,
    timeZone: 'UTC',
  };
}

function terrainProfile(value: number): EarthTerrainHorizonProfile {
  const distanceBands = [
    { id: 'near' as const, minimumDistanceMeters: 0, maximumDistanceMeters: 30_000 },
    { id: 'mid' as const, minimumDistanceMeters: 30_000, maximumDistanceMeters: 100_000 },
    { id: 'far' as const, minimumDistanceMeters: 100_000, maximumDistanceMeters: 300_000 },
  ];

  return {
    locationId: 'paris',
    latitude: 48.8566,
    longitude: 2.3522,
    observerElevationMeters: 37,
    azimuthStepDegrees: 1,
    distanceLayers: distanceBands.map((band, index) => ({
      ...band,
      obstructionAnglesCentidegrees: new Int16Array(360).fill(
        Math.round(value * (1 - index * 0.28)),
      ),
    })),
    obstructionAnglesCentidegrees: new Int16Array(360).fill(value),
    source: {
      id: 'noaa-etopo-fixture',
      title: 'ETOPO fixture',
      productUrl: 'https://example.com/product',
      dataUrl: 'fixture.tif',
      doi: 'https://doi.org/10.0/fixture',
      horizontalDatum: 'WGS 84',
      verticalDatum: 'EGM2008',
      resolutionArcSeconds: 60,
    },
    calculation: {
      model: 'spherical-geometric-line-of-sight',
      earthRadiusMeters: 6_371_008.8,
      observerEyeHeightMeters: 2,
      maximumDistanceMeters: 300_000,
      sampleStepMeters: 1_852,
      azimuthStepDegrees: 1,
      distanceBands,
      atmosphericRefraction: 'excluded',
      terrainInterpolation: 'bilinear',
      locationAnchor: 'catalogued-city-center',
    },
  };
}

function sirius(): SpaceObject {
  return {
    id: 'sirius',
    name: 'Sirius',
    type: 'star',
    parentId: 'milky-way',
    referenceFrame: 'stellar',
    scientificConfidence: 'observed',
    visual: { visualRadius: 1, scaleMode: 'adaptive', color: '#b8ccff' },
    positionProvider: { type: 'static', position: [1, 2, 3], unit: 'parsec' },
    metadata: {
      rightAscensionDegrees: 101.287_155,
      declinationDegrees: -16.716_116,
      skyCoordinateEpoch: 'J2000',
    },
  };
}

function moonSightline(): SpaceObject {
  return {
    ...sirius(),
    id: 'moon-sightline',
    name: 'Direction de la Lune',
    metadata: {
      rightAscensionDegrees: 190.754_291_893_899_68,
      declinationDegrees: -9.424_038_747_322_9,
      skyCoordinateEpoch: 'J2000',
    },
  };
}

function betelgeuse(): SpaceObject {
  return {
    ...sirius(),
    id: 'betelgeuse',
    name: 'Bételgeuse',
    metadata: {
      rightAscensionDegrees: 88.792_939,
      declinationDegrees: 7.407_064,
      skyCoordinateEpoch: 'J2000',
    },
  };
}
