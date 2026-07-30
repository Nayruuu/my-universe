import { signal, WritableSignal } from '@angular/core';
import { DeferBlockBehavior, TestBed } from '@angular/core/testing';
import { UniverseEngineFacade } from './core/engine/universe-engine.facade';
import { KeyboardShortcutService } from './core/settings/keyboard-shortcut.service';
import { App } from './app';

describe('App', () => {
  const settingsOpen = signal(false);
  const helpOpen = signal(false);
  const ready = signal(false);
  const selectedId = signal<string | null>(null);
  const debugEnabled = signal(false);
  const loading = signal(false);
  const error = signal<string | null>(null);
  const performanceWarning = signal<string | null>(null);
  const shareNotice = signal<string | null>(null);
  const currentSolarEclipse = signal<object | null>(null);
  const facade = {
    settingsOpen,
    helpOpen,
    ready,
    selectedId,
    debugEnabled,
    loading,
    error,
    performanceWarning,
    shareNotice,
    currentSolarEclipse,
    focus: vi.fn(() => Promise.resolve()),
    toggleSettings: vi.fn(),
    toggleHelp: vi.fn(),
    initialize: vi.fn(() => Promise.resolve()),
    resize: vi.fn(),
    dispose: vi.fn(),
  };
  const shortcuts = {
    start: vi.fn(),
    stop: vi.fn(),
  };

  beforeEach(async () => {
    vi.useFakeTimers();
    settingsOpen.set(false);
    helpOpen.set(false);
    ready.set(false);
    selectedId.set(null);
    debugEnabled.set(false);
    loading.set(false);
    error.set(null);
    performanceWarning.set(null);
    shareNotice.set(null);
    currentSolarEclipse.set(null);
    vi.clearAllMocks();
    vi.stubGlobal(
      'ResizeObserver',
      class {
        public readonly observe = vi.fn();
        public readonly disconnect = vi.fn();
      },
    );
    TestBed.configureTestingModule({
      imports: [App],
      providers: [
        { provide: UniverseEngineFacade, useValue: facade },
        { provide: KeyboardShortcutService, useValue: shortcuts },
      ],
      deferBlockBehavior: DeferBlockBehavior.Manual,
    });
    await TestBed.compileComponents();
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.unstubAllGlobals();
    TestBed.resetTestingModule();
  });

  it('démarre les raccourcis, masque l’aide et délègue le focus', () => {
    const component = createApp();
    const view = component as unknown as AppAccess;

    view.focus('earth');
    expect(view.navigationHintVisible()).toBe(true);

    vi.advanceTimersByTime(7_000);

    expect(view.navigationHintVisible()).toBe(false);
    expect(shortcuts.start).toHaveBeenCalledOnce();
    expect(facade.focus).toHaveBeenCalledWith('earth');

    component.ngOnDestroy();
    expect(shortcuts.stop).toHaveBeenCalledOnce();
  });

  it('peut être détruit avant son initialisation', () => {
    TestBed.runInInjectionContext(() => new App()).ngOnDestroy();

    expect(shortcuts.stop).toHaveBeenCalledOnce();
  });

  it('rend tous les états transitoires du shell', () => {
    const fixture = TestBed.createComponent(App);
    const view = fixture.componentInstance as unknown as AppAccess;

    fixture.detectChanges();
    expect(fixture.nativeElement.querySelector('.loading-screen')).toBeNull();
    expect(fixture.nativeElement.querySelector('.navigation-hint')).toBeNull();

    settingsOpen.set(true);
    helpOpen.set(true);
    ready.set(true);
    loading.set(true);
    error.set('Erreur de chargement');
    performanceWarning.set('Qualité réduite');
    shareNotice.set('Lien copié');
    fixture.detectChanges();

    expect(fixture.nativeElement.querySelector('.loading-screen')).not.toBeNull();
    expect(fixture.nativeElement.textContent).toContain('Erreur de chargement');
    expect(fixture.nativeElement.textContent).toContain('Qualité réduite');
    expect(fixture.nativeElement.textContent).toContain('Lien copié');
    expect(fixture.nativeElement.querySelector('.navigation-hint')).not.toBeNull();

    fixture.nativeElement.querySelector('.notice--warning').click();
    expect(performanceWarning()).toBeNull();

    fixture.nativeElement.querySelector('.navigation-hint').click();
    fixture.detectChanges();
    expect(view.navigationHintVisible()).toBe(false);

    view.navigationHintVisible.set(true);
    currentSolarEclipse.set({});
    loading.set(false);
    error.set(null);
    shareNotice.set(null);
    fixture.detectChanges();

    expect(fixture.nativeElement.querySelector('.navigation-hint')).toBeNull();
    expect(fixture.nativeElement.querySelector('.loading-screen')).toBeNull();
  });
});

interface AppAccess {
  readonly navigationHintVisible: WritableSignal<boolean>;
  focus(objectId: string): void;
}

function createApp(): App {
  return TestBed.createComponent(App).componentInstance;
}
