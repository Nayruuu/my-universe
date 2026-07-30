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
  });
});

interface DebugPanelAccess {
  format(value: number): string;
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
    cameraPosition: { x: 1, y: 2, z: 3 },
    cameraDistance: 1_500,
    floatingOrigin: { x: 0, y: 0, z: 0 },
    targetId,
    lodLevel: 2,
    julianDay: 2_461_265.5,
    quality: 'high',
  };
}
