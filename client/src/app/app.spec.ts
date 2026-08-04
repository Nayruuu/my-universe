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
  const lodLevel = signal(0);
  const loading = signal(false);
  const error = signal<string | null>(null);
  const performanceWarning = signal<string | null>(null);
  const shareNotice = signal<string | null>(null);
  const currentSolarEclipse = signal<object | null>(null);
  const cosmicMapLayers = signal({
    volume: true,
    groups: true,
    links: true,
    clusters: true,
    superclusters: true,
    filaments: false,
    voids: false,
  });
  const facade = {
    settingsOpen,
    helpOpen,
    ready,
    selectedId,
    debugEnabled,
    lodLevel,
    loading,
    error,
    performanceWarning,
    shareNotice,
    currentSolarEclipse,
    cosmicMapLayers,
    focus: vi.fn(() => Promise.resolve()),
    toggleSettings: vi.fn(),
    toggleHelp: vi.fn(),
    toggleCosmicMapLayer: vi.fn(),
    resetCosmicMapLayers: vi.fn(),
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
    lodLevel.set(0);
    loading.set(false);
    error.set(null);
    performanceWarning.set(null);
    shareNotice.set(null);
    currentSolarEclipse.set(null);
    cosmicMapLayers.set({
      volume: true,
      groups: true,
      links: true,
      clusters: true,
      superclusters: true,
      filaments: false,
      voids: false,
    });
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
    expect(fixture.nativeElement.querySelector('.cosmic-map-key')).toBeNull();
    expect(fixture.nativeElement.querySelector('.science-caption')).not.toBeNull();

    lodLevel.set(6);
    fixture.detectChanges();
    expect(fixture.nativeElement.querySelector('.cosmic-map-key')?.textContent).toContain(
      'Matière cosmique simulée',
    );
    expect(fixture.nativeElement.querySelector('.cosmic-map-key')?.textContent).toContain(
      'Groupes Cosmicflows-4',
    );
    expect(fixture.nativeElement.querySelector('.cosmic-map-key')?.textContent).toContain(
      'Liens de proximité illustratifs',
    );
    expect(fixture.nativeElement.querySelector('.cosmic-map-key')?.textContent).toContain(
      '8 757 superamas',
    );
    expect(fixture.nativeElement.querySelector('.cosmic-map-key')?.textContent).toContain(
      '1 228 vides',
    );
    expect(fixture.nativeElement.querySelector('.cosmic-map-key')?.textContent).toContain(
      '15 421 filaments',
    );
    expect(fixture.nativeElement.querySelector('.cosmic-map-key')?.textContent).toContain(
      '1 094 amas',
    );
    expect(fixture.nativeElement.querySelector('.cosmic-map-key')?.textContent).toContain(
      '26 500 détections',
    );
    expect(fixture.nativeElement.querySelector('.cosmic-map-key')?.textContent).toContain(
      'chaud = proche · violet = lointain',
    );
    expect(fixture.nativeElement.querySelector('.cosmic-map-key')?.textContent).toContain(
      'Zone non relevée ≠ vide cosmique',
    );
    const filamentLayer = fixture.nativeElement.querySelector(
      '[aria-label="Afficher les centres de filaments SDSS"]',
    ) as HTMLButtonElement;
    const groupLayer = fixture.nativeElement.querySelector(
      '[aria-label="Masquer les groupes Cosmicflows-4"]',
    ) as HTMLButtonElement;
    const volumeLayer = fixture.nativeElement.querySelector(
      '[aria-label="Masquer la matière cosmique simulée"]',
    ) as HTMLButtonElement;

    expect(filamentLayer.getAttribute('aria-pressed')).toBe('false');
    expect(groupLayer.getAttribute('aria-pressed')).toBe('true');
    expect(volumeLayer.getAttribute('aria-pressed')).toBe('true');
    filamentLayer.click();
    expect(facade.toggleCosmicMapLayer).toHaveBeenCalledWith('filaments');
    volumeLayer.click();
    expect(facade.toggleCosmicMapLayer).toHaveBeenCalledWith('volume');
    (
      fixture.nativeElement.querySelector(
        '[aria-label="Réinitialiser les couches cosmiques"]',
      ) as HTMLButtonElement
    ).click();
    expect(facade.resetCosmicMapLayers).toHaveBeenCalledOnce();
    expect(fixture.nativeElement.querySelector('.science-caption')).toBeNull();

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
