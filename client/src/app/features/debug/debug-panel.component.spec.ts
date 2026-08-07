import { signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { EngineDebugStats } from '../../../data/models/universe.models';
import type { ObjectVisualDiagnostics } from '../../../engine/objects/object-visual-diagnostics';
import type { NavigationDebugCopyResult } from '../../core/engine/navigation-debug-report';
import { MILKY_WAY_REVIEW_STOPS } from '../../core/engine/milky-way-review-stops';
import type { MilkyWayReviewPlaybackResult } from '../../core/engine/universe-engine.facade';
import { UniverseEngineFacade } from '../../core/engine/universe-engine.facade';
import { DebugPanelComponent } from './debug-panel.component';

describe('DebugPanelComponent', () => {
  const debugEnabled = signal(false);
  const debugStats = signal<EngineDebugStats | null>(null);
  const targetVisualDiagnostics = signal<ObjectVisualDiagnostics | null>(null);
  const navigationDebugTraceCount = vi.fn(() => 2);
  const copyNavigationDebugTrace = vi.fn<() => Promise<NavigationDebugCopyResult>>(async () =>
    Promise.resolve('copied'),
  );
  const clearNavigationDebugTrace = vi.fn();
  const milkyWayReviewPlaying = signal(false);
  const milkyWayReviewStop = signal<(typeof MILKY_WAY_REVIEW_STOPS)[number] | null>(null);
  const playMilkyWayReview = vi.fn<() => Promise<MilkyWayReviewPlaybackResult>>(async () =>
    Promise.resolve('completed'),
  );
  const copyMilkyWayReviewUrl = vi.fn<() => Promise<'copied' | 'failed'>>(async () => 'copied');
  const facade = {
    debugEnabled,
    debugStats,
    targetVisualDiagnostics,
    navigationDebugTraceCount,
    copyNavigationDebugTrace,
    clearNavigationDebugTrace,
    milkyWayReviewPlaying,
    milkyWayReviewStop,
    playMilkyWayReview,
    copyMilkyWayReviewUrl,
  };

  beforeEach(() => {
    debugEnabled.set(false);
    debugStats.set(null);
    targetVisualDiagnostics.set(null);
    navigationDebugTraceCount.mockReturnValue(2);
    copyNavigationDebugTrace.mockResolvedValue('copied');
    clearNavigationDebugTrace.mockClear();
    playMilkyWayReview.mockClear();
    milkyWayReviewPlaying.set(false);
    milkyWayReviewStop.set(null);
    playMilkyWayReview.mockResolvedValue('completed');
    copyMilkyWayReviewUrl.mockResolvedValue('copied');
    TestBed.configureTestingModule({
      imports: [DebugPanelComponent],
      providers: [{ provide: UniverseEngineFacade, useValue: facade }],
    });
  });

  afterEach(() => TestBed.resetTestingModule());

  it('formate les valeurs ordinaires et les grandes valeurs', () => {
    const component = TestBed.createComponent(DebugPanelComponent)
      .componentInstance as unknown as DebugPanelAccess;

    expect(component.format(12.345)).toBe('12.35');
    expect(component.format(-1_234)).toBe('-1.23e+3');
    expect(component.milliseconds(null)).toBe('—');
    expect(component.milliseconds(12.345)).toBe('12.35 ms');
    expect(component.preloadOutcome(null)).toBe('—');
    expect(component.preloadOutcome(true)).toBe('hit');
    expect(component.preloadOutcome(false)).toBe('miss');
    expect(component.renderingPrewarmStatus('idle')).toBe('en attente');
    expect(component.renderingPrewarmStatus('running')).toBe('en préparation');
    expect(component.renderingPrewarmStatus('ready')).toBe('prêt');
    expect(component.renderingPrewarmStatus('failed')).toBe('échec');
    expect(component.percentage(null)).toBe('—');
    expect(component.percentage(0.1234)).toBe('12.3%');
    expect(component.zoomStatus('applied')).toBe('appliqué');
    expect(component.zoomStatus('minimum')).toBe('limite minimale');
    expect(component.zoomStatus('maximum')).toBe('limite maximale');
    expect(component.zoomStatus('ignored')).toBe('ignoré');
    expect(component.zoomStatus('unchanged')).toBe('sans déplacement');
  });

  it('masque puis affiche toutes les statistiques de débogage', () => {
    const fixture = TestBed.createComponent(DebugPanelComponent);

    fixture.detectChanges();
    expect(fixture.nativeElement.querySelector('.debug-panel')).toBeNull();

    debugEnabled.set(true);
    fixture.detectChanges();
    expect(fixture.nativeElement.querySelector('.debug-panel')).toBeNull();

    debugStats.set(stats(null));
    fixture.detectChanges();
    expect(fixture.nativeElement.textContent).toContain('libre');

    debugStats.set(stats('earth'));
    targetVisualDiagnostics.set(visualDiagnostics());
    fixture.detectChanges();
    expect(fixture.nativeElement.textContent).toContain('earth');
    expect(fixture.nativeElement.textContent).toContain('Trace molette · 2');
    expect(fixture.nativeElement.textContent).toContain('Copier la trace');
    expect(fixture.nativeElement.textContent).toContain('Revue Voie lactée');
    expect(fixture.nativeElement.textContent).toContain('Lire le parcours');
    expect(fixture.nativeElement.textContent).toContain('andromeda');
    expect(fixture.nativeElement.textContent).toContain('Points Gaia envoyés au GPU');
    expect(fixture.nativeElement.textContent).toContain(
      'Sources Gaia détaillées · lisibles estimées / projetées / GPU',
    );
    expect(
      fixture.nativeElement.querySelector('[data-debug-stat="gaia-sampled-sources"]')?.textContent,
    ).toContain('170 / 180 / 250');
    expect(fixture.nativeElement.textContent).toContain('Tuiles galactiques actives / index');
    expect(fixture.nativeElement.textContent).toContain('5 / 5');
    expect(fixture.nativeElement.textContent).toContain('Galaxies groupées');
    expect(fixture.nativeElement.textContent).toContain(
      'Démarrage · moteur / données / scène / carte',
    );
    expect(fixture.nativeElement.textContent).toContain('100.00 ms / 240.00 ms');
    expect(fixture.nativeElement.textContent).toContain('within-budget');
    expect(fixture.nativeElement.textContent).toContain('Préchauffage rendu · initial / Tempel');
    expect(
      fixture.nativeElement.querySelector('[data-debug-stat="rendering-prewarm"]')?.textContent,
    ).toContain('prêt · 18.00 ms / en attente · —');
    expect(fixture.nativeElement.textContent).toContain('Hôtes exoplanétaires visibles');
    expect(fixture.nativeElement.textContent).toContain('4747');
    expect(fixture.nativeElement.textContent).toContain('Exoplanètes NASA indexées');
    expect(fixture.nativeElement.textContent).toContain('6333');
    expect(fixture.nativeElement.textContent).toContain('Groupes Cosmicflows-4');
    expect(fixture.nativeElement.textContent).toContain('37730');
    expect(fixture.nativeElement.textContent).toContain('Filaments dérivés');
    expect(fixture.nativeElement.textContent).toContain('42000');
    expect(fixture.nativeElement.textContent).toContain('Épines Tempel chargées');
    expect(fixture.nativeElement.textContent).toContain('15421');
    expect(fixture.nativeElement.textContent).toContain('Segments Tempel visibles / publiés');
    expect(fixture.nativeElement.textContent).toContain('18000 / 260178');
    expect(fixture.nativeElement.textContent).toContain('Tuiles Tempel GPU');
    expect(fixture.nativeElement.textContent).toContain('7');
    expect(fixture.nativeElement.textContent).toContain('Tempel · téléchargement / décodage');
    expect(fixture.nativeElement.textContent).toContain('24.00 ms / 7.00 ms');
    expect(fixture.nativeElement.textContent).toContain('Tempel · image / activation / total');
    expect(fixture.nativeElement.textContent).toContain('hit · 18.00 ms');
    expect(fixture.nativeElement.textContent).toContain('12.00 ms / 60.00 ms / 104.00 ms');
    expect(fixture.nativeElement.textContent).toContain('limite maximale');
    expect(fixture.nativeElement.textContent).toContain('Référentiel actif');
    expect(fixture.nativeElement.textContent).toContain('stellar');
    expect(fixture.nativeElement.textContent).toContain('Origine navigation');
    expect(fixture.nativeElement.textContent).toContain('sun');
    expect(fixture.nativeElement.textContent).toContain('Cible caméra');
    expect(fixture.nativeElement.textContent).toContain('Résolution rendu');
    expect(fixture.nativeElement.textContent).toContain('1.25×');
    expect(fixture.nativeElement.textContent).toContain('Rendu adaptatif');
    expect(fixture.nativeElement.textContent).toContain('stable · p95 16.00 ms · 1.0% long');
    expect(fixture.nativeElement.textContent).toContain('Surface cible');
    expect(fixture.nativeElement.textContent).toContain('earth-blue-marble-2048.jpg');
    expect(fixture.nativeElement.textContent).toContain('1.00 / 1.00');
    expect(
      fixture.nativeElement.querySelector('[data-debug-stat="target-surface"]')?.textContent,
    ).toContain('2048×1024');
    expect(
      fixture.nativeElement.querySelector('[data-debug-stat="draw-calls"]')?.textContent,
    ).toContain('12');
    expect(
      fixture.nativeElement.querySelector('[data-debug-stat="render-resolution"]')?.textContent,
    ).toContain('1.25×');

    const cosmicStats = stats('cosmic-web');

    cosmicStats.lodLevel = 6;
    debugStats.set(cosmicStats);
    fixture.detectChanges();
    expect(fixture.nativeElement.querySelector('.debug-panel--cosmic')).not.toBeNull();

    const targetZoomStats = stats('earth');

    targetZoomStats.zoom = {
      ...targetZoomStats.zoom!,
      anchorType: 'target',
      anchorObjectId: null,
    };
    debugStats.set(targetZoomStats);
    fixture.detectChanges();
    expect(fixture.nativeElement.textContent).toContain('cible caméra');
  });

  it.each([
    ['copied', 'Trace copiée : colle ce JSON dans la conversation.'],
    ['empty', 'Aucune interaction à copier pour le moment.'],
    ['failed', 'Impossible de copier la trace.'],
  ] as const)('annonce le résultat %s de la copie', async (result, expected) => {
    copyNavigationDebugTrace.mockResolvedValueOnce(result);
    const component = TestBed.createComponent(DebugPanelComponent)
      .componentInstance as unknown as DebugPanelAccess;

    await component.copyNavigationTrace();

    expect(component.traceNotice()).toBe(expected);
  });

  it('efface la trace depuis le panneau', () => {
    const component = TestBed.createComponent(DebugPanelComponent)
      .componentInstance as unknown as DebugPanelAccess;

    component.clearNavigationTrace();

    expect(clearNavigationDebugTrace).toHaveBeenCalledOnce();
    expect(component.traceNotice()).toBe('Trace effacée.');
  });

  it.each([
    ['completed', 'Parcours terminé.'],
    ['interrupted', 'Parcours interrompu.'],
    ['failed', 'Impossible de lire le parcours.'],
  ] as const)('annonce le résultat %s de la lecture galactique', async (result, expected) => {
    playMilkyWayReview.mockResolvedValueOnce(result);
    const component = TestBed.createComponent(DebugPanelComponent)
      .componentInstance as unknown as DebugPanelAccess;

    await component.playMilkyWayReview();

    expect(playMilkyWayReview).toHaveBeenCalledOnce();
    expect(component.reviewNotice()).toBe(expected);
  });

  it('démarre la lecture sans bloquer le gestionnaire de clic', async () => {
    const component = TestBed.createComponent(DebugPanelComponent)
      .componentInstance as unknown as DebugPanelAccess;

    expect(component.startMilkyWayReview()).toBeUndefined();
    expect(playMilkyWayReview).toHaveBeenCalledOnce();
    await Promise.resolve();

    expect(component.reviewNotice()).toBe('Parcours terminé.');
  });

  it('affiche l’étape courante pendant la lecture', () => {
    debugEnabled.set(true);
    debugStats.set(stats('milky-way'));
    milkyWayReviewPlaying.set(true);
    milkyWayReviewStop.set(MILKY_WAY_REVIEW_STOPS[3]!);
    const fixture = TestBed.createComponent(DebugPanelComponent);

    fixture.detectChanges();

    expect(fixture.nativeElement.textContent).toContain('Lecture en cours…');
    expect(fixture.nativeElement.textContent).toContain('Étape : Bras.');
    expect(
      (fixture.nativeElement.querySelector('[data-review-action="play"]') as HTMLButtonElement)
        .disabled,
    ).toBe(true);
  });

  it.each([
    ['copied', 'URL de revue copiée.'],
    ['failed', 'Impossible de copier l’URL de revue.'],
  ] as const)('annonce le résultat %s de la copie de l’URL de revue', async (result, expected) => {
    copyMilkyWayReviewUrl.mockResolvedValueOnce(result);
    const component = TestBed.createComponent(DebugPanelComponent)
      .componentInstance as unknown as DebugPanelAccess;

    await component.copyMilkyWayReviewUrl();

    expect(component.reviewNotice()).toBe(expected);
  });
});

interface DebugPanelAccess {
  traceNotice(): string | null;
  reviewNotice(): string | null;
  copyNavigationTrace(): Promise<void>;
  clearNavigationTrace(): void;
  startMilkyWayReview(): void;
  playMilkyWayReview(): Promise<void>;
  copyMilkyWayReviewUrl(): Promise<void>;
  format(value: number): string;
  milliseconds(value: number | null): string;
  preloadOutcome(value: boolean | null): string;
  percentage(value: number | null): string;
  zoomStatus(status: 'applied' | 'minimum' | 'maximum' | 'ignored' | 'unchanged'): string;
  renderingPrewarmStatus(status: 'idle' | 'running' | 'ready' | 'failed'): string;
}

function visualDiagnostics(): ObjectVisualDiagnostics {
  return {
    objectId: 'earth',
    bodyPresent: true,
    bodyVisible: true,
    visualVisible: true,
    nearVisible: true,
    nearBlend: 1,
    visibilityBlend: 1,
    opacity: 1,
    transparent: true,
    depthTest: true,
    depthWrite: true,
    surfaceTexture: {
      requested: true,
      loaded: true,
      source: 'textures/earth-blue-marble-2048.jpg',
      width: 2048,
      height: 1024,
    },
  };
}

function stats(targetId: string | null): EngineDebugStats {
  return {
    fps: 60,
    drawCalls: 12,
    triangles: 1_200,
    geometries: 4,
    textures: 3,
    visibleObjects: 42,
    catalogStars: 2_000,
    exoplanetHosts: 4_747,
    exoplanets: 6_333,
    cosmicGroups: 37_730,
    cosmicFilaments: 42_000,
    cosmicStructures: 9_985,
    tempelFilamentSpines: 15_421,
    tempelSpineSegments: 260_178,
    visibleTempelSpineSegments: 18_000,
    tempelSpineTiles: 8,
    batchedGalaxies: 7,
    loadedTiles: 5,
    indexedGalaxyTiles: 5,
    cachedGalaxyTiles: 5,
    activeStarTiles: 8,
    cachedStarPacks: 5,
    cachedStarTiles: 19,
    activeStarClusters: 302,
    cachedStarClusters: 2_610,
    visibleStarClusters: 302,
    gaiaPresentation: {
      sampledSources: 250,
      perceptibleSampledSources: 170,
      projectedSampledSources: 180,
      aggregateCells: 52,
      projectedAggregateCells: 31,
    },
    cameraPosition: { x: 1, y: 2, z: 3 },
    cameraTarget: { x: 4, y: 5, z: 6 },
    cameraDistance: 1_500,
    floatingOrigin: { x: 0, y: 0, z: 0 },
    targetId,
    navigationOriginId: 'sun',
    navigationReferenceFrame: 'stellar',
    lodLevel: 2,
    julianDay: 2_461_265.5,
    quality: 'high',
    pixelRatio: 1.25,
    adaptiveRendering: {
      status: 'stable',
      p95FrameMs: 16,
      longFrameRatio: 0.01,
      targetPixelRatio: 1.5,
      currentPixelRatio: 1.25,
    },
    renderingPrewarm: {
      initialScene: { status: 'ready', durationMs: 18 },
      tempelScene: { status: 'idle', durationMs: null },
    },
    zoom: {
      anchorType: 'object',
      anchorObjectId: 'andromeda',
      deltaY: 480,
      beforeDistance: 17_000,
      requestedDistance: 34_000,
      appliedDistance: 18_000,
      minimumDistance: 1.5,
      maximumDistance: 18_000,
      status: 'maximum',
    },
    startupPerformance: startupPerformance(),
    tempelPerformance: {
      status: 'visible',
      execution: 'worker',
      fetchMs: 24,
      decodeMs: 7,
      workerRoundTripMs: 38,
      geometryPreparationMs: 46,
      sceneInstallationMs: 2,
      preloadHit: true,
      preloadLeadMs: 18,
      firstVisibleFrameMs: 12,
      activationToFirstVisibleMs: 60,
      timeToFirstVisibleMs: 104,
    },
  };
}

function startupPerformance() {
  return {
    status: 'usable',
    engineModuleMs: 100,
    dataReadyMs: 240,
    sceneReadyMs: 420,
    firstUsableMapMs: 510,
    budgetStatus: 'within-budget',
    exceededBudgets: [],
  } as const;
}
