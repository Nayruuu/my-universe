import { signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { UniverseEngineFacade } from '../engine/universe-engine.facade';
import { EarthSkyViewState } from '../../features/stellar-observation/earth-sky-view-state';
import { KeyboardShortcutService } from './keyboard-shortcut.service';

describe('KeyboardShortcutService', () => {
  const selectedId = signal<string | null>('earth');
  const phase = signal<'closed' | 'travelling' | 'open'>('closed');
  const facade = {
    selectedId,
    togglePlaying: vi.fn(),
    focusSelected: vi.fn(),
    closeDetails: vi.fn(),
    cycleSpeed: vi.fn(),
    setTemporalMode: vi.fn(),
  };
  const earthSkyViewState = {
    phase,
    close: vi.fn(() => phase.set('closed')),
  };

  beforeEach(() => {
    selectedId.set('earth');
    phase.set('closed');
    vi.clearAllMocks();
    TestBed.configureTestingModule({
      providers: [
        KeyboardShortcutService,
        { provide: UniverseEngineFacade, useValue: facade },
        { provide: EarthSkyViewState, useValue: earthSkyViewState },
      ],
    });
  });

  afterEach(() => {
    TestBed.resetTestingModule();
    document.body.replaceChildren();
  });

  it('n’installe et ne retire son écouteur qu’une fois', () => {
    const addListener = vi.spyOn(window, 'addEventListener');
    const removeListener = vi.spyOn(window, 'removeEventListener');
    const service = TestBed.inject(KeyboardShortcutService);

    service.start();
    service.start();
    service.stop();
    service.stop();

    expect(addListener.mock.calls.filter(([type]) => type === 'keydown')).toHaveLength(1);
    expect(removeListener.mock.calls.filter(([type]) => type === 'keydown')).toHaveLength(1);
  });

  it('traduit les raccourcis globaux vers la façade', () => {
    const service = TestBed.inject(KeyboardShortcutService);

    service.start();
    const space = dispatchKey(document.body, ' ');

    dispatchKey(document.body, 'f');
    dispatchKey(document.body, 'Escape');
    dispatchKey(document.body, '+');
    dispatchKey(document.body, '=');
    dispatchKey(document.body, '-');
    dispatchKey(document.body, 'x');
    service.stop();

    expect(space.defaultPrevented).toBe(true);
    expect(facade.togglePlaying).toHaveBeenCalledOnce();
    expect(facade.focusSelected).toHaveBeenCalledOnce();
    expect(facade.closeDetails).toHaveBeenCalledOnce();
    expect(facade.cycleSpeed).toHaveBeenNthCalledWith(1, 1);
    expect(facade.cycleSpeed).toHaveBeenNthCalledWith(2, 1);
    expect(facade.cycleSpeed).toHaveBeenNthCalledWith(3, -1);
  });

  it('quitte entièrement la vue observable avant de cadrer la sélection', () => {
    phase.set('open');
    selectedId.set('jupiter');
    const service = TestBed.inject(KeyboardShortcutService);

    service.start();
    dispatchKey(document.body, 'f');
    service.stop();

    expect(earthSkyViewState.close).toHaveBeenCalledOnce();
    expect(facade.setTemporalMode).toHaveBeenCalledWith('state');
    expect(facade.focusSelected).toHaveBeenCalledOnce();
    expect(earthSkyViewState.close.mock.invocationCallOrder[0]).toBeLessThan(
      facade.setTemporalMode.mock.invocationCallOrder[0],
    );
    expect(facade.setTemporalMode.mock.invocationCallOrder[0]).toBeLessThan(
      facade.focusSelected.mock.invocationCallOrder[0],
    );
  });

  it('ne quitte pas la vue observable lorsque rien n’est sélectionné', () => {
    phase.set('open');
    selectedId.set(null);
    const service = TestBed.inject(KeyboardShortcutService);

    service.start();
    dispatchKey(document.body, 'f');
    service.stop();

    expect(earthSkyViewState.close).not.toHaveBeenCalled();
    expect(facade.setTemporalMode).not.toHaveBeenCalled();
    expect(facade.focusSelected).not.toHaveBeenCalled();
  });

  it.each([
    document.createElement('input'),
    document.createElement('select'),
    document.createElement('textarea'),
    editableElement(),
  ])('ignore les raccourcis saisis dans un contrôle éditable', (target) => {
    const service = TestBed.inject(KeyboardShortcutService);

    document.body.append(target);
    service.start();
    dispatchKey(target, ' ');
    service.stop();

    expect(facade.togglePlaying).not.toHaveBeenCalled();
  });
});

function dispatchKey(target: HTMLElement, key: string): KeyboardEvent {
  const event = new KeyboardEvent('keydown', { key, bubbles: true, cancelable: true });

  target.dispatchEvent(event);

  return event;
}

function editableElement(): HTMLDivElement {
  const element = document.createElement('div');

  Object.defineProperty(element, 'isContentEditable', { value: true });

  return element;
}
