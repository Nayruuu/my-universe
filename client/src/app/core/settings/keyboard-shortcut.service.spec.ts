import { TestBed } from '@angular/core/testing';
import { UniverseEngineFacade } from '../engine/universe-engine.facade';
import { KeyboardShortcutService } from './keyboard-shortcut.service';

describe('KeyboardShortcutService', () => {
  const facade = {
    togglePlaying: vi.fn(),
    focusSelected: vi.fn(),
    closeDetails: vi.fn(),
    cycleSpeed: vi.fn(),
  };

  beforeEach(() => {
    vi.clearAllMocks();
    TestBed.configureTestingModule({
      providers: [KeyboardShortcutService, { provide: UniverseEngineFacade, useValue: facade }],
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
