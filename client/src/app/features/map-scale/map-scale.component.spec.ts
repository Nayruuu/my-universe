import { signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { UniverseEngineFacade } from '../../core/engine/universe-engine.facade';
import { MapScaleComponent } from './map-scale.component';

describe('MapScaleComponent', () => {
  const cameraDistance = signal(4.8);
  const lodLevel = signal(0);
  const facade = { cameraDistance, lodLevel };

  beforeEach(() => {
    cameraDistance.set(4.8);
    lodLevel.set(0);
    TestBed.configureTestingModule({
      imports: [MapScaleComponent],
      providers: [{ provide: UniverseEngineFacade, useValue: facade }],
    });
  });

  afterEach(() => TestBed.resetTestingModule());

  it('affiche une barre numérique et explicite son échelle adaptée', () => {
    const fixture = TestBed.createComponent(MapScaleComponent);

    fixture.detectChanges();
    expect(fixture.nativeElement.textContent).toContain('km');
    expect(fixture.nativeElement.textContent).toContain('Échelle visuelle adaptée');
    expect(fixture.nativeElement.querySelector('.map-scale__bar')).not.toBeNull();

    lodLevel.set(4);
    cameraDistance.set(17_000);
    fixture.detectChanges();
    expect(fixture.nativeElement.textContent).toContain('kpc');

    cameraDistance.set(0);
    fixture.detectChanges();
    expect(fixture.nativeElement.querySelector('.map-scale')).toBeNull();
  });
});
