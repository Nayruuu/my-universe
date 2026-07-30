import { Signal, signal } from '@angular/core';
import { DeferBlockBehavior, TestBed } from '@angular/core/testing';
import { TemporalMode, UniverseTime } from '../../../data/models/universe.models';
import { EarthEclipseEvent, EarthEclipseKind } from '../../../engine/simulation/earth-eclipse';
import { UniverseEngineFacade } from '../../core/engine/universe-engine.facade';
import { TimelineComponent } from './timeline.component';

describe('TimelineComponent', () => {
  const currentTime = signal<UniverseTime>({ julianDay: 2_461_250 });
  const timelineSolarEclipse = signal<EarthEclipseEvent | null>(null);
  const eclipseContextLabel = signal('Phénomène en cours');
  const solarObserverActive = signal(false);
  const solarObserverLocation = signal('Point central');
  const localEclipseSummary = signal<string | null>(null);
  const solarPathVisible = signal(false);
  const playing = signal(false);
  const currentLocalClock = signal('14:00');
  const eclipseBrowserOpen = signal(false);
  const earthRotationStabilized = signal(false);
  const speed = signal(1);
  const displayOptions = signal({
    showOrbits: true,
    showConstellations: true,
    showLabels: true,
    quality: 'high' as const,
    labelDensity: 'balanced' as const,
    temporalMode: 'state' as TemporalMode,
  });
  const currentIsoDateTime = signal('2026-07-29T12:00');
  const facade = {
    currentTime,
    timelineSolarEclipse,
    eclipseContextLabel,
    solarObserverActive,
    solarObserverLocation,
    localEclipseSummary,
    solarPathVisible,
    playing,
    currentLocalClock,
    eclipseBrowserOpen,
    earthRotationStabilized,
    speed,
    displayOptions,
    currentIsoDateTime,
    showSolarShadow: vi.fn(),
    toggleSolarPath: vi.fn(),
    togglePlaying: vi.fn(),
    returnToPresent: vi.fn(),
    toggleEclipseBrowser: vi.fn(),
    setDateTime: vi.fn(),
    setSpeed: vi.fn(),
    setTime: vi.fn(),
    setTemporalMode: vi.fn(),
    viewEarthEclipse: vi.fn(() => Promise.resolve()),
    observeEarthEclipse: vi.fn(),
  };

  beforeEach(async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-07-29T12:00:00.000Z'));
    currentTime.set({ julianDay: 2_461_251 });
    timelineSolarEclipse.set(null);
    solarObserverActive.set(false);
    localEclipseSummary.set(null);
    solarPathVisible.set(false);
    playing.set(false);
    eclipseBrowserOpen.set(false);
    earthRotationStabilized.set(false);
    displayOptions.set({
      showOrbits: true,
      showConstellations: true,
      showLabels: true,
      quality: 'high',
      labelDensity: 'balanced',
      temporalMode: 'state',
    });
    vi.clearAllMocks();
    TestBed.configureTestingModule({
      imports: [TimelineComponent],
      providers: [{ provide: UniverseEngineFacade, useValue: facade }],
      deferBlockBehavior: DeferBlockBehavior.Manual,
    });
    await TestBed.compileComponents();
  });

  afterEach(() => {
    vi.useRealTimers();
    TestBed.resetTestingModule();
  });

  it('borne le curseur à dix ans autour du présent', () => {
    const component = createComponent();

    currentTime.set({ julianDay: component.presentJulianDay + 10 });
    expect(component.timelineOffset()).toBe(10);
    currentTime.set({ julianDay: component.presentJulianDay - 5_000 });
    expect(component.timelineOffset()).toBe(-3_652.5);
    currentTime.set({ julianDay: component.presentJulianDay + 5_000 });
    expect(component.timelineOffset()).toBe(3_652.5);
    expect(component.epochLabel()).not.toBe('');
  });

  it('délègue tous les contrôles temporels', () => {
    const component = createComponent();
    const eclipse = event();

    component.changeDateTime(inputEvent('2026-08-12T17:45', 'datetime-local'));
    component.changeSpeed(selectEvent('30.4375'));
    component.changeTimeline(inputEvent('12', 'range'));
    component.changeMode(selectEvent('observable'));
    component.centerSolarShadow(eclipse);
    component.observeSolarEclipse(eclipse);

    expect(facade.setDateTime).toHaveBeenCalledWith('2026-08-12T17:45');
    expect(facade.setSpeed).toHaveBeenCalledWith(30.4375);
    expect(facade.setTime).toHaveBeenCalledWith({
      julianDay: component.presentJulianDay + 12,
    });
    expect(facade.setTemporalMode).toHaveBeenCalledWith('observable');
    expect(facade.viewEarthEclipse).toHaveBeenCalledWith(eclipse);
    expect(facade.observeEarthEclipse).toHaveBeenCalledWith(eclipse);
  });

  it('traduit chaque type d’éclipse', () => {
    const component = createComponent();
    const labels: readonly [EarthEclipseKind, string][] = [
      ['penumbral', 'pénombrale'],
      ['partial', 'partielle'],
      ['annular', 'annulaire'],
      ['total', 'totale'],
    ];

    for (const [kind, label] of labels) {
      expect(component.eclipseKindLabel(kind)).toBe(label);
    }
  });

  it('rend les variantes temporelles et les contextes d’éclipse', () => {
    const fixture = TestBed.createComponent(TimelineComponent);

    fixture.detectChanges();
    expect(fixture.nativeElement.querySelector('.eclipse-context')).toBeNull();
    expect(fixture.nativeElement.querySelector('.play-icon')).not.toBeNull();

    timelineSolarEclipse.set(
      event({
        kind: 'annular',
        scope: 'local',
        observerName: 'Biarritz',
      }),
    );
    solarPathVisible.set(true);
    fixture.detectChanges();
    expect(fixture.nativeElement.textContent).toContain('Annularité');
    expect(fixture.nativeElement.textContent).toContain('Biarritz');

    localEclipseSummary.set('80 % occulté');
    fixture.detectChanges();
    expect(fixture.nativeElement.textContent).toContain('80 % occulté');

    solarObserverActive.set(true);
    playing.set(true);
    earthRotationStabilized.set(true);
    fixture.detectChanges();
    expect(fixture.nativeElement.textContent).toContain('reconstruction calculée');
    expect(fixture.nativeElement.querySelector('.pause-icon')).not.toBeNull();
    expect(fixture.nativeElement.textContent).toContain('Terre stabilisée');

    solarObserverActive.set(false);
    localEclipseSummary.set(null);
    timelineSolarEclipse.set(
      event({
        kind: 'total',
        scope: 'global',
        latitude: null,
        longitude: null,
      }),
    );
    fixture.detectChanges();
    expect(fixture.nativeElement.textContent).toContain('Totalité');
    expect(fixture.nativeElement.textContent).not.toContain('Vue au sol');
  });
});

interface TimelineAccess {
  readonly presentJulianDay: number;
  readonly timelineOffset: Signal<number>;
  readonly epochLabel: Signal<string>;
  changeDateTime(event: Event): void;
  changeSpeed(event: Event): void;
  changeTimeline(event: Event): void;
  changeMode(event: Event): void;
  centerSolarShadow(event: EarthEclipseEvent): void;
  observeSolarEclipse(event: EarthEclipseEvent): void;
  eclipseKindLabel(kind: EarthEclipseKind): string;
}

function createComponent(): TimelineAccess {
  return TestBed.createComponent(TimelineComponent).componentInstance as unknown as TimelineAccess;
}

function inputEvent(value: string, type: string): Event {
  const input = document.createElement('input');

  input.type = type;
  input.value = value;

  return eventWithTarget(input);
}

function selectEvent(value: TemporalMode | string): Event {
  const select = document.createElement('select');

  select.add(new Option(value, value));
  select.value = value;

  return eventWithTarget(select);
}

function eventWithTarget(target: EventTarget): Event {
  const event = new Event('change');

  Object.defineProperty(event, 'target', { value: target });

  return event;
}

function event(overrides: Partial<EarthEclipseEvent> = {}): EarthEclipseEvent {
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
