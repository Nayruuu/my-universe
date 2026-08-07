import { signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import {
  DisplayOptions,
  GraphicQuality,
  LabelDensity,
  TemporalMode,
} from '../../../data/models/universe.models';
import { UniverseEngineFacade } from '../../core/engine/universe-engine.facade';
import { I18nService } from '../../core/i18n/i18n.service';
import { FloatingControlsComponent } from './floating-controls.component';

describe('FloatingControlsComponent', () => {
  const facade = {
    selectedId: signal<string | null>(null),
    displayOptions: signal<DisplayOptions>({
      showOrbits: true,
      showConstellations: true,
      showLabels: true,
      quality: 'high',
      labelDensity: 'balanced',
      temporalMode: 'state',
    }),
    settingsOpen: signal(false),
    helpOpen: signal(false),
    focus: vi.fn(() => Promise.resolve()),
    setQuality: vi.fn(),
    setLabelDensity: vi.fn(),
    setTemporalMode: vi.fn(),
    toggleConstellations: vi.fn(),
  };

  beforeEach(async () => {
    window.history.replaceState(null, '', '/fr/');
    facade.selectedId.set(null);
    facade.settingsOpen.set(false);
    facade.helpOpen.set(false);
    facade.displayOptions.set({
      showOrbits: true,
      showConstellations: true,
      showLabels: true,
      quality: 'high',
      labelDensity: 'balanced',
      temporalMode: 'state',
    });
    vi.clearAllMocks();
    TestBed.configureTestingModule({
      imports: [FloatingControlsComponent],
      providers: [{ provide: UniverseEngineFacade, useValue: facade }],
    });
    await TestBed.compileComponents();
  });

  afterEach(() => {
    TestBed.resetTestingModule();
    window.history.replaceState(null, '', '/fr/');
  });

  it('délègue les actions de navigation et de qualité', () => {
    const component = createComponent();

    component.focus('earth');
    component.setQuality('high');
    component.setDensity('dense');
    component.setMode('observable');
    component.changeDensity(selectEvent('minimal'));
    component.changeMode(selectEvent('state'));

    expect(facade.focus).toHaveBeenCalledWith('earth');
    expect(facade.setQuality).toHaveBeenCalledWith('high');
    expect(facade.setLabelDensity).toHaveBeenNthCalledWith(1, 'dense');
    expect(facade.setLabelDensity).toHaveBeenNthCalledWith(2, 'minimal');
    expect(facade.setTemporalMode).toHaveBeenNthCalledWith(1, 'observable');
    expect(facade.setTemporalMode).toHaveBeenNthCalledWith(2, 'state');
  });

  it('affiche les états sélectionné, paramètres et aide', async () => {
    facade.selectedId.set('earth');
    facade.settingsOpen.set(true);
    facade.helpOpen.set(true);
    facade.displayOptions.set({
      showOrbits: false,
      showConstellations: false,
      showLabels: false,
      quality: 'medium',
      labelDensity: 'dense',
      temporalMode: 'observable',
    });
    const fixture = TestBed.createComponent(FloatingControlsComponent);

    fixture.detectChanges();

    expect(fixture.nativeElement.querySelector('.controls--details')).not.toBeNull();
    expect(fixture.nativeElement.querySelector('.settings-popover')).not.toBeNull();
    expect(fixture.nativeElement.querySelector('.help-popover')).not.toBeNull();
    expect(
      (fixture.nativeElement.querySelector('.documentation-link') as HTMLAnchorElement | null)
        ?.pathname,
    ).toBe('/guide/fr/');
    const portfolioLink = fixture.nativeElement.querySelector(
      '.creator-link',
    ) as HTMLAnchorElement | null;

    expect(portfolioLink?.getAttribute('href')).toBe('https://super-dev.app');
    expect(portfolioLink?.target).toBe('_blank');
    expect(portfolioLink?.rel).toContain('me');
    expect(fixture.nativeElement.querySelector('.creator-link--support')).toBeNull();
    expect(
      fixture.nativeElement.querySelector('[aria-label="Afficher ou masquer les constellations"]'),
    ).not.toBeNull();
    expect(
      (
        fixture.nativeElement.querySelector(
          'select[aria-label="Densité des noms"]',
        ) as HTMLSelectElement | null
      )?.value,
    ).toBe('dense');
    expect(
      (
        fixture.nativeElement.querySelector(
          'select[aria-label="Densité des noms"]',
        ) as HTMLSelectElement | null
      )?.disabled,
    ).toBe(true);

    await TestBed.inject(I18nService).setLanguage('en');
    fixture.detectChanges();
    expect(
      (fixture.nativeElement.querySelector('.documentation-link') as HTMLAnchorElement | null)
        ?.pathname,
    ).toBe('/guide/');
    expect(fixture.nativeElement.querySelector('.creator-card')?.textContent).toContain(
      'Created by Nayruuu',
    );
  });
});

interface FloatingControlsAccess {
  focus(objectId: string): void;
  setQuality(value: GraphicQuality): void;
  setDensity(value: LabelDensity): void;
  setMode(value: TemporalMode): void;
  changeDensity(event: Event): void;
  changeMode(event: Event): void;
}

function createComponent(): FloatingControlsAccess {
  return TestBed.createComponent(FloatingControlsComponent)
    .componentInstance as unknown as FloatingControlsAccess;
}

function selectEvent(value: string): Event {
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
