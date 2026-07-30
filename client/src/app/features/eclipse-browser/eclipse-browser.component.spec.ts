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
  const upcomingEclipses = signal<readonly EarthEclipseEvent[]>([]);
  const facade = {
    browserTimeZone: 'Europe/Paris',
    eclipseBrowserOpen,
    eclipseEventsLoading,
    localEclipseLoading,
    upcomingEclipses,
    toggleEclipseBrowser: vi.fn(),
    viewEarthEclipse: vi.fn(() => Promise.resolve()),
    viewLocalSolarEclipse: vi.fn(() => Promise.resolve()),
    observeEarthEclipse: vi.fn(),
  };

  beforeEach(() => {
    eclipseBrowserOpen.set(false);
    eclipseEventsLoading.set(false);
    localEclipseLoading.set(false);
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

    expect(component.selectedLocation().id).toBe('paris');
    component.changeLocation(selectEvent('biarritz'));
    expect(component.selectedLocation().id).toBe('biarritz');

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

  it('retombe sur le premier lieu lorsque l’identifiant est inconnu', () => {
    const component = createComponent();

    component.changeLocation(selectEvent('inconnu'));

    expect(component.selectedLocation().id).toBe('paris');
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

    localEclipseLoading.set(true);
    fixture.detectChanges();
    expect(fixture.nativeElement.textContent).toContain('Calcul en cours');
  });
});

interface EclipseBrowserAccess {
  readonly selectedLocationId: WritableSignal<string>;
  readonly selectedLocation: Signal<SolarEclipseObserverLocation>;
  view(event: EarthEclipseEvent): void;
  viewLocal(event: EarthEclipseEvent): void;
  observe(event: EarthEclipseEvent): void;
  changeLocation(event: Event): void;
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
    ...overrides,
  };
}

function selectEvent(value: string): Event {
  const select = document.createElement('select');
  const event = new Event('change');

  select.add(new Option(value, value));
  select.value = value;
  Object.defineProperty(event, 'target', { value: select });

  return event;
}
