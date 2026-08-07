import { signal, Signal, WritableSignal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { EarthEclipseEvent, EarthEclipseKind } from '../../../engine/simulation/earth-eclipse';
import { SolarEclipseObserverLocation } from '../../../engine/simulation/solar-eclipse-locations';
import { UniverseEngineFacade } from '../../core/engine/universe-engine.facade';
import { EclipseBrowserComponent } from './eclipse-browser.component';

describe('EclipseBrowserComponent', () => {
  const eclipseBrowserOpen = signal(false);
  const eclipseEventsLoading = signal(false);
  const localEclipseLoading = signal(false);
  const eclipseCatalogAtPresent = signal(true);
  const upcomingEclipses = signal<readonly EarthEclipseEvent[]>([]);
  const facade = {
    browserTimeZone: 'Europe/Paris',
    eclipseBrowserOpen,
    eclipseEventsLoading,
    localEclipseLoading,
    eclipseCatalogAtPresent,
    upcomingEclipses,
    browseEarlierEclipses: vi.fn(),
    browseLaterEclipses: vi.fn(),
    returnToCurrentEclipses: vi.fn(),
    toggleEclipseBrowser: vi.fn(),
    viewEarthEclipse: vi.fn(() => Promise.resolve()),
    viewLocalSolarEclipse: vi.fn(() => Promise.resolve()),
    observeEarthEclipse: vi.fn(),
  };

  beforeEach(() => {
    eclipseBrowserOpen.set(false);
    eclipseEventsLoading.set(false);
    localEclipseLoading.set(false);
    eclipseCatalogAtPresent.set(true);
    upcomingEclipses.set([]);
    vi.clearAllMocks();
    TestBed.configureTestingModule({
      imports: [EclipseBrowserComponent],
      providers: [{ provide: UniverseEngineFacade, useValue: facade }],
    });
  });

  afterEach(() => TestBed.resetTestingModule());

  it('sélectionne un lieu, ouvre les vues globale, locale et observable', () => {
    const component = createComponent();
    const eclipse = event({ family: 'solar', kind: 'total' });

    expect(component.selectedLocation()?.id).toBe('paris');
    component.changeLocation('biarritz');
    expect(component.selectedLocation()?.id).toBe('biarritz');

    component.view(eclipse);
    component.viewLocal(eclipse);
    component.observe(eclipse);

    expect(facade.viewEarthEclipse).toHaveBeenCalledWith(eclipse);
    expect(facade.viewLocalSolarEclipse).toHaveBeenCalledWith(
      eclipse,
      expect.objectContaining({ id: 'biarritz' }),
    );
    expect(facade.observeEarthEclipse).toHaveBeenCalledWith(eclipse);
  });

  it('accepte des coordonnées arbitraires valides et bloque les valeurs incorrectes', () => {
    const component = createComponent();
    const eclipse = event({ family: 'solar', kind: 'total' });

    component.changeLocation('custom');
    expect(component.selectedLocation()).toBeNull();
    component.viewLocal(eclipse);
    expect(facade.viewLocalSolarEclipse).not.toHaveBeenCalled();

    component.changeCustomLatitude(inputEvent('91'));
    component.changeCustomLongitude(inputEvent('2.3522'));
    expect(component.customLocationIssue()).toBe('latitude-out-of-range');

    component.changeCustomLatitude(inputEvent('48.8566'));
    expect(component.customLocationIssue()).toBeNull();
    expect(component.selectedLocation()).toEqual({
      id: 'coordinates-48.856600-2.352200',
      name: 'Coordonnées personnalisées',
      latitude: 48.8566,
      longitude: 2.3522,
      timeZone: 'UTC',
    });

    component.viewLocal(eclipse);
    expect(facade.viewLocalSolarEclipse).toHaveBeenCalledWith(
      eclipse,
      component.selectedLocation(),
    );
  });

  it('explique chaque erreur de coordonnées et nomme le lieu personnalisé incomplet', () => {
    const component = createComponent();

    component.changeLocation('custom');
    expect(component.customLocationMessage()).toBe('Renseignez une latitude et une longitude.');
    expect(component.selectedLocationName()).toBe('Coordonnées personnalisées');

    component.changeCustomLatitude(inputEvent('nord'));
    component.changeCustomLongitude(inputEvent('2'));
    expect(component.customLocationMessage()).toBe('Utilisez des coordonnées décimales valides.');

    component.changeCustomLatitude(inputEvent('91'));
    expect(component.customLocationMessage()).toBe(
      'La latitude doit être comprise entre −90° et 90°.',
    );

    component.changeCustomLatitude(inputEvent('48'));
    component.changeCustomLongitude(inputEvent('181'));
    expect(component.customLocationMessage()).toBe(
      'La longitude doit être comprise entre −180° et 180°.',
    );

    component.changeCustomLongitude(inputEvent('2'));
    expect(component.customLocationMessage()).toBeNull();
    expect(component.selectedLocationName()).toBe('Coordonnées personnalisées');
  });

  it('parcourt les événements antérieurs, suivants et revient à la date courante', () => {
    const component = createComponent();

    component.browseEarlier();
    component.browseLater();
    component.returnToCurrent();

    expect(facade.browseEarlierEclipses).toHaveBeenCalledOnce();
    expect(facade.browseLaterEclipses).toHaveBeenCalledOnce();
    expect(facade.returnToCurrentEclipses).toHaveBeenCalledOnce();
  });

  it('retombe sur le premier lieu lorsque l’identifiant est inconnu', () => {
    const component = createComponent();

    component.changeLocation('inconnu');

    expect(component.selectedLocation()?.id).toBe('paris');
  });

  it('traduit les familles, types et dates', () => {
    const component = createComponent();
    const kinds: readonly [EarthEclipseKind, string][] = [
      ['penumbral', 'Pénombrale'],
      ['partial', 'Partielle'],
      ['annular', 'Annulaire'],
      ['total', 'Totale'],
    ];

    for (const [kind, label] of kinds) {
      expect(component.kindLabel(kind)).toBe(label);
    }
    expect(component.eventTitle(event({ family: 'lunar', kind: 'partial' }))).toBe(
      'Éclipse lunaire partielle',
    );
    expect(component.eventTitle(event({ family: 'solar', kind: 'annular' }))).toBe(
      'Éclipse solaire annulaire',
    );
    expect(component.peakLabel(event())).toContain('2000');
    expect(component.localPeakLabel(event())).not.toBe('');
  });

  it('formate l’occultation et toutes les formes de durée', () => {
    const component = createComponent();

    expect(component.obscurationLabel(event({ obscuration: null }))).toBe(
      'Visibilité selon le lieu',
    );
    expect(component.obscurationLabel(event({ obscuration: 0.734 }))).toBe('73 % occulté');
    expect(component.durationLabel(event({ durationMinutes: null }))).toBeNull();
    expect(component.durationLabel(event({ durationMinutes: 32 }))).toBe('32 min');
    expect(component.durationLabel(event({ durationMinutes: 125 }))).toBe('2 h 05');
  });

  it('formate les coordonnées centrales dans les quatre hémisphères', () => {
    const component = createComponent();

    expect(component.coordinatesLabel(event())).toBe('Point central calculé');
    expect(component.coordinatesLabel(event({ latitude: 1, longitude: null }))).toBe(
      'Point central calculé',
    );
    expect(component.coordinatesLabel(event({ latitude: 43.5, longitude: 2.3 }))).toBe(
      '43.5° N · 2.3° E',
    );
    expect(component.coordinatesLabel(event({ latitude: -43.5, longitude: -2.3 }))).toBe(
      '43.5° S · 2.3° O',
    );
  });

  it('rend les états fermé, chargement, solaire et lunaire du catalogue', () => {
    const fixture = TestBed.createComponent(EclipseBrowserComponent);

    fixture.detectChanges();
    expect(fixture.nativeElement.querySelector('.eclipse-browser')).toBeNull();

    eclipseBrowserOpen.set(true);
    eclipseEventsLoading.set(true);
    fixture.detectChanges();
    expect(fixture.nativeElement.querySelector('.catalog-loading')).not.toBeNull();

    eclipseEventsLoading.set(false);
    upcomingEclipses.set([
      event({
        id: 'solar',
        family: 'solar',
        kind: 'annular',
        obscuration: 0.88,
        durationMinutes: 5,
        latitude: 43,
        longitude: -1,
      }),
      event({
        id: 'solar-without-center',
        family: 'solar',
        latitude: null,
        longitude: null,
      }),
      event({ id: 'lunar', family: 'lunar', kind: 'penumbral' }),
    ]);
    fixture.detectChanges();

    expect(fixture.nativeElement.querySelectorAll('.event-list__item')).toHaveLength(3);
    expect(fixture.nativeElement.textContent).toContain('Maximum depuis Paris');
    expect(fixture.nativeElement.querySelectorAll('.catalog-navigation button')).toHaveLength(3);

    eclipseCatalogAtPresent.set(false);
    fixture.detectChanges();
    const presentButton = fixture.nativeElement.querySelector(
      '.catalog-navigation__present',
    ) as HTMLButtonElement | null;

    expect(presentButton?.disabled).toBe(false);

    localEclipseLoading.set(true);
    fixture.detectChanges();
    expect(fixture.nativeElement.textContent).toContain('Calcul en cours');
  });

  it('rend les champs de coordonnées et leur validation uniquement en mode personnalisé', () => {
    eclipseBrowserOpen.set(true);
    const fixture = TestBed.createComponent(EclipseBrowserComponent);

    fixture.detectChanges();
    expect(fixture.nativeElement.querySelector('.observer-coordinates')).toBeNull();

    const component = fixture.componentInstance as unknown as EclipseBrowserAccess;

    component.changeLocation('custom');
    fixture.detectChanges();
    expect(fixture.nativeElement.querySelectorAll('.observer-coordinates input')).toHaveLength(2);
    expect(fixture.nativeElement.textContent).toContain('Renseignez une latitude et une longitude');

    component.changeCustomLatitude(inputEvent('45'));
    component.changeCustomLongitude(inputEvent('200'));
    fixture.detectChanges();
    expect(fixture.nativeElement.textContent).toContain('La longitude doit être comprise');
  });
});

interface EclipseBrowserAccess {
  readonly selectedLocationId: WritableSignal<string>;
  readonly selectedLocation: Signal<SolarEclipseObserverLocation | null>;
  readonly customLocationIssue: Signal<string | null>;
  readonly customLocationMessage: Signal<string | null>;
  readonly selectedLocationName: Signal<string>;
  view(event: EarthEclipseEvent): void;
  viewLocal(event: EarthEclipseEvent): void;
  observe(event: EarthEclipseEvent): void;
  browseEarlier(): void;
  browseLater(): void;
  returnToCurrent(): void;
  changeLocation(locationId: string): void;
  changeCustomLatitude(event: Event): void;
  changeCustomLongitude(event: Event): void;
  eventTitle(event: EarthEclipseEvent): string;
  kindLabel(kind: EarthEclipseKind): string;
  peakLabel(event: EarthEclipseEvent): string;
  localPeakLabel(event: EarthEclipseEvent): string;
  obscurationLabel(event: EarthEclipseEvent): string;
  durationLabel(event: EarthEclipseEvent): string | null;
  coordinatesLabel(event: EarthEclipseEvent): string;
}

function createComponent(): EclipseBrowserAccess {
  return TestBed.createComponent(EclipseBrowserComponent)
    .componentInstance as unknown as EclipseBrowserAccess;
}

function event(overrides: Partial<EarthEclipseEvent> = {}): EarthEclipseEvent {
  return {
    id: 'eclipse',
    family: 'solar',
    kind: 'partial',
    scope: 'global',
    peak: { julianDay: 2_451_545 },
    obscuration: null,
    durationMinutes: null,
    latitude: null,
    longitude: null,
    observerName: null,
    observerTimeZone: null,
    sunAltitudeDegrees: null,
    localContacts: null,
    ...overrides,
  };
}

function inputEvent(value: string): Event {
  const input = document.createElement('input');
  const event = new Event('input');

  input.value = value;
  Object.defineProperty(event, 'target', { value: input });

  return event;
}
