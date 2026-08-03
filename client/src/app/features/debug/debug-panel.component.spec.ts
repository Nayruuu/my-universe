import { signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { EngineDebugStats } from '../../../data/models/universe.models';
import { UniverseEngineFacade } from '../../core/engine/universe-engine.facade';
import { DebugPanelComponent } from './debug-panel.component';

describe('DebugPanelComponent', () => {
  const debugEnabled = signal(false);
  const debugStats = signal<EngineDebugStats | null>(null);
  const facade = { debugEnabled, debugStats };

  beforeEach(() => {
    debugEnabled.set(false);
    debugStats.set(null);
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
    fixture.detectChanges();
    expect(fixture.nativeElement.textContent).toContain('earth');
    expect(fixture.nativeElement.textContent).toContain('andromeda');
    expect(fixture.nativeElement.textContent).toContain('Cellules visibles');
    expect(fixture.nativeElement.textContent).toContain('Tuiles galactiques actives / index');
    expect(fixture.nativeElement.textContent).toContain('5 / 5');
    expect(fixture.nativeElement.textContent).toContain('Galaxies groupées');
    expect(fixture.nativeElement.textContent).toContain('Groupes Cosmicflows-4');
    expect(fixture.nativeElement.textContent).toContain('37730');
    expect(fixture.nativeElement.textContent).toContain('Filaments dérivés');
    expect(fixture.nativeElement.textContent).toContain('42000');
    expect(fixture.nativeElement.textContent).toContain('7');
    expect(fixture.nativeElement.textContent).toContain('limite maximale');
    expect(fixture.nativeElement.textContent).toContain('Référentiel actif');
    expect(fixture.nativeElement.textContent).toContain('stellar');
    expect(fixture.nativeElement.textContent).toContain('Origine navigation');
    expect(fixture.nativeElement.textContent).toContain('sun');
    expect(fixture.nativeElement.textContent).toContain('Cible caméra');
    expect(fixture.nativeElement.textContent).toContain('Résolution rendu');
    expect(fixture.nativeElement.textContent).toContain('1.25×');

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
});

interface DebugPanelAccess {
  format(value: number): string;
  zoomStatus(status: 'applied' | 'minimum' | 'maximum' | 'ignored' | 'unchanged'): string;
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
    cosmicGroups: 37_730,
    cosmicFilaments: 42_000,
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
  };
}
