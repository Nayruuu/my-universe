import { signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { DisplayOptions, GraphicQuality, TemporalMode } from '../../../data/models/universe.models';
import { UniverseEngineFacade } from '../../core/engine/universe-engine.facade';
import { FloatingControlsComponent } from './floating-controls.component';

describe('FloatingControlsComponent', () => {
  const facade = {
    selectedId: signal<string | null>(null),
    displayOptions: signal<DisplayOptions>({
      showOrbits: true,
      showLabels: true,
      quality: 'high',
      temporalMode: 'state',
    }),
    settingsOpen: signal(false),
    helpOpen: signal(false),
    focus: vi.fn(() => Promise.resolve()),
    setQuality: vi.fn(),
    setTemporalMode: vi.fn(),
  };

  beforeEach(async () => {
    facade.selectedId.set(null);
    facade.settingsOpen.set(false);
    facade.helpOpen.set(false);
    facade.displayOptions.set({
      showOrbits: true,
      showLabels: true,
      quality: 'high',
      temporalMode: 'state',
    });
    vi.clearAllMocks();
    TestBed.configureTestingModule({
      imports: [FloatingControlsComponent],
      providers: [{ provide: UniverseEngineFacade, useValue: facade }],
    });
    await TestBed.compileComponents();
  });

  afterEach(() => TestBed.resetTestingModule());

  it('délègue les actions de navigation et de qualité', () => {
    const component = createComponent();

    component.focus('earth');
    component.setQuality('high');
    component.setMode('observable');
    component.changeMode(selectEvent('state'));

    expect(facade.focus).toHaveBeenCalledWith('earth');
    expect(facade.setQuality).toHaveBeenCalledWith('high');
    expect(facade.setTemporalMode).toHaveBeenNthCalledWith(1, 'observable');
    expect(facade.setTemporalMode).toHaveBeenNthCalledWith(2, 'state');
  });

  it('affiche les états sélectionné, paramètres et aide', () => {
    facade.selectedId.set('earth');
    facade.settingsOpen.set(true);
    facade.helpOpen.set(true);
    facade.displayOptions.set({
      showOrbits: false,
      showLabels: false,
      quality: 'medium',
      temporalMode: 'observable',
    });
    const fixture = TestBed.createComponent(FloatingControlsComponent);

    fixture.detectChanges();

    expect(fixture.nativeElement.querySelector('.controls--details')).not.toBeNull();
    expect(fixture.nativeElement.querySelector('.settings-popover')).not.toBeNull();
    expect(fixture.nativeElement.querySelector('.help-popover')).not.toBeNull();
  });
});

interface FloatingControlsAccess {
  focus(objectId: string): void;
  setQuality(value: GraphicQuality): void;
  setMode(value: TemporalMode): void;
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
