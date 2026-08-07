import { signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import type { DisplayOptions, SpaceObject } from '../../../data/models/universe.models';
import {
  EARTH_OBSERVER_FIELD_OF_VIEW_DEGREES,
  EARTH_OBSERVER_VIEW_EVENT,
  type EarthObserverViewState,
} from '../../../engine/camera/earth-observer-camera-control';
import type { EarthObserverFraming } from '../../../engine/camera/earth-observer-orientation';
import { UniverseEngineFacade } from '../../core/engine/universe-engine.facade';
import { EarthObserverSelection } from './earth-observer-selection';
import { EarthSkyViewComponent } from './earth-sky-view.component';
import { EarthSkyViewState } from './earth-sky-view-state';

describe('EarthSkyViewComponent', () => {
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
    await TestBed.configureTestingModule({
      imports: [EarthSkyViewComponent],
      providers: [{ provide: UniverseEngineFacade, useValue: facade }],
    }).compileComponents();
    TestBed.inject(EarthSkyViewState).open('sirius', 'Sirius');
  });

  afterEach(() => TestBed.resetTestingModule());

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
    expect(
      (
        fixture.nativeElement.querySelector(
          '.earth-sky-view__location summary strong',
        ) as HTMLElement
      ).textContent,
    ).toBe('Paris');

    fixture.nativeElement.querySelector('.earth-sky-view__close').click();
    expect(facade.setTemporalMode).toHaveBeenCalledWith('state');
    expect(viewState.activeTargetId()).toBeNull();
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

    jupiter.click();

    expect(facade.selectObject).toHaveBeenCalledWith('jupiter');
    expect(viewState.activeTargetId()).toBe('sirius');
    expect(fixture.nativeElement.querySelector('#earth-sky-view')).not.toBeNull();
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
    expect(Number.parseFloat(moon.style.getPropertyValue('--moon-phase-scale'))).toBeCloseTo(
      0.641_512,
      5,
    );
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
    expect(fixture.nativeElement.textContent).toContain('Sous l’horizon');

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
    expect(fixture.nativeElement.textContent).toContain('Observatoire privé');

    component.changeLocation('missing');
    expect(selection.location()).toBeNull();

    selectedObject.set(null);
    objects.set([]);
    TestBed.inject(EarthSkyViewState).open('missing', 'Introuvable');
    fixture.detectChanges();
    expect(fixture.nativeElement.textContent).toContain('Localiser Introuvable');

    await component.recenterSky();
    expect(facade.prepareEarthObservation).toHaveBeenLastCalledWith('missing', undefined, null);

    TestBed.inject(EarthSkyViewState).close();
    await component.recenterSky();
    expect(facade.prepareEarthObservation).toHaveBeenCalledTimes(2);
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
    const expectedPitchOffset =
      facade.prepareEarthObservation.mock.calls.at(-1)?.[1]?.initialPitchOffsetDegrees ?? 0;

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
  });
});

interface SkyViewAccess {
  changeLocation(locationId: string): void;
  recenterSky(): Promise<void>;
  horizonPosition(): string;
  horizonPerspective(): { readonly centerAzimuthDegrees: number };
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
