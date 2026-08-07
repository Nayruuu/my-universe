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
  const timelineSolarEclipse = signal<object | null>(null);
  const cosmicMapLayers = signal({
    volume: true,
    groups: true,
    links: true,
    clusters: true,
    superclusters: true,
    filaments: true,
    voids: true,
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
    timelineSolarEclipse,
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
    window.history.replaceState(null, '', '/fr/');
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
    timelineSolarEclipse.set(null);
    cosmicMapLayers.set({
      volume: true,
      groups: true,
      links: true,
      clusters: true,
      superclusters: true,
      filaments: true,
      voids: true,
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

  it('change toute l’interface et l’URL depuis le sélecteur de langue', async () => {
    const fixture = TestBed.createComponent(App);

    fixture.detectChanges();
    const selector = fixture.nativeElement.querySelector(
      '.language-selector select',
    ) as HTMLSelectElement;
    const view = fixture.componentInstance as unknown as AppAccess;
    const languageEvent = new Event('change');

    expect(Array.from(selector.options, (option) => option.value)).toEqual([
      'fr',
      'en',
      'es',
      'de',
      'it',
      'ko',
      'ja',
      'zh',
    ]);
    selector.value = 'en';
    Object.defineProperty(languageEvent, 'target', { value: selector });
    await view.changeLanguage(languageEvent);
    fixture.detectChanges();

    expect(window.location.pathname).toBe('/en/');
    expect(document.documentElement.lang).toBe('en');
    expect(document.title).toContain('Interactive 3D Universe Map');
    expect(fixture.nativeElement.querySelector('h1')?.textContent).toContain(
      'interactive 3D map of the Universe',
    );
    expect(fixture.nativeElement.querySelector('.home-action')?.getAttribute('aria-label')).toBe(
      'Return to Earth',
    );

    const unsupported = document.createElement('select');
    const option = document.createElement('option');

    option.value = 'pt';
    unsupported.append(option);
    unsupported.value = 'pt';
    const unsupportedEvent = new Event('change');

    Object.defineProperty(unsupportedEvent, 'target', { value: unsupported });
    await view.changeLanguage(unsupportedEvent);
    expect(window.location.pathname).toBe('/en/');
  });

  it('affiche dans le sélecteur la langue portée par l’URL initiale', () => {
    window.history.replaceState(null, '', '/ja/?target=earth');
    const fixture = TestBed.createComponent(App);

    fixture.detectChanges();

    const selector = fixture.nativeElement.querySelector(
      '.language-selector select',
    ) as HTMLSelectElement;

    expect(selector.value).toBe('ja');
    expect(selector.selectedOptions.item(0)?.textContent?.trim()).toBe('JA');
  });

  it('rend tous les états transitoires du shell', () => {
    const fixture = TestBed.createComponent(App);
    const view = fixture.componentInstance as unknown as AppAccess;

    fixture.detectChanges();
    expect(fixture.nativeElement.querySelector('h1')?.textContent).toContain(
      'carte 3D interactive de l’Univers',
    );
    expect(fixture.nativeElement.querySelector('.loading-screen')).toBeNull();
    expect(fixture.nativeElement.querySelector('.navigation-hint')).toBeNull();
    expect(fixture.nativeElement.querySelector('.app-shell--details')).toBeNull();
    expect(fixture.nativeElement.querySelector('.app-shell--eclipse')).toBeNull();

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

    lodLevel.set(4);
    fixture.detectChanges();
    expect(fixture.nativeElement.querySelector('.science-caption')?.textContent).toContain(
      '31 galaxies documentées du Groupe local',
    );
    expect(fixture.nativeElement.querySelector('.science-caption')?.textContent).toContain(
      'directions Cosmicflows-4 calculées',
    );
    expect(fixture.nativeElement.querySelector('.science-caption')?.textContent).toContain(
      'profondeurs et luminosités adaptées',
    );

    lodLevel.set(5);
    fixture.detectChanges();
    expect(fixture.nativeElement.querySelector('.science-caption')?.textContent).toContain(
      '720 galaxies observées',
    );
    expect(fixture.nativeElement.querySelector('.science-caption')?.textContent).toContain(
      'groupes Cosmicflows-4 calculés',
    );
    expect(fixture.nativeElement.querySelector('.science-caption')?.textContent).toContain(
      'formes et luminosités illustratives',
    );

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
      '15 421 filaments Tempel · épines 3D',
    );
    expect(fixture.nativeElement.querySelector('.cosmic-map-key')?.textContent).toContain(
      'Cliquez une épine pour l’identifier · recherche facultative',
    );
    expect(fixture.nativeElement.querySelector('.cosmic-map-key')?.textContent).toContain(
      'largeur du halo illustrative',
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
      '[aria-label="Masquer les épines 3D des filaments Tempel"]',
    ) as HTMLButtonElement;
    const groupLayer = fixture.nativeElement.querySelector(
      '[aria-label="Masquer les groupes Cosmicflows-4"]',
    ) as HTMLButtonElement;
    const volumeLayer = fixture.nativeElement.querySelector(
      '[aria-label="Masquer la matière cosmique simulée"]',
    ) as HTMLButtonElement;

    expect(filamentLayer.getAttribute('aria-pressed')).toBe('true');
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
    timelineSolarEclipse.set({});
    selectedId.set('earth');
    loading.set(false);
    error.set(null);
    shareNotice.set(null);
    fixture.detectChanges();

    expect(fixture.nativeElement.querySelector('.navigation-hint')).toBeNull();
    expect(fixture.nativeElement.querySelector('.loading-screen')).toBeNull();
    expect(fixture.nativeElement.querySelector('.app-shell--details')).not.toBeNull();
    expect(fixture.nativeElement.querySelector('.app-shell--eclipse')).not.toBeNull();
  });
});

interface AppAccess {
  readonly navigationHintVisible: WritableSignal<boolean>;
  focus(objectId: string): void;
  changeLanguage(event: Event): Promise<void>;
}

function createApp(): App {
  return TestBed.createComponent(App).componentInstance;
}
