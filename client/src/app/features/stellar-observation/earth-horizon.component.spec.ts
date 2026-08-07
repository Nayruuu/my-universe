import { TestBed } from '@angular/core/testing';
import type { EarthObserverLocation } from '../../../engine/simulation/earth-observer-location';
import type { StellarObservation } from '../../../engine/simulation/stellar-observation';
import { createEarthHorizonProfile } from './earth-horizon-profile';
import { EarthHorizonComponent } from './earth-horizon.component';

describe('EarthHorizonComponent', () => {
  beforeEach(async () => {
    window.history.replaceState(null, '', '/fr/');
    await TestBed.configureTestingModule({ imports: [EarthHorizonComponent] }).compileComponents();
  });

  afterEach(() => TestBed.resetTestingModule());

  it('affiche le panorama propre à Paris et place la Tour Eiffel dans sa vraie direction', () => {
    const paris = location('paris', 'Paris', 48.8566, 2.3522);
    const fixture = createFixture(paris, 272.6903);
    const landscape = fixture.nativeElement.querySelector(
      '.earth-sky-view__landscape',
    ) as HTMLElement;
    const landmark = fixture.nativeElement.querySelector('[data-landmark="eiffel-tower"]');

    expect(landscape.dataset['horizonProfile']).toBe('paris');
    expect(landscape.dataset['cityscape']).toBe('paris');
    expect(landscape.dataset['lightDensity']).toBe('dense');
    expect(landscape.classList).toContain('earth-sky-view__landscape--open');
    expect(landscape.style.getPropertyValue('--city-light-hue')).toBe('38');
    expect(landscape.style.getPropertyValue('--far-ridge-shape')).toContain('polygon(');
    expect(landscape.style.getPropertyValue('--near-ridge-shape')).toContain('polygon(');
    expect(fixture.nativeElement.querySelector('.earth-sky-view__city-glow')).not.toBeNull();
    expect(fixture.nativeElement.querySelector('[data-cityscape-svg="paris"]')).not.toBeNull();
    expect(fixture.nativeElement.querySelectorAll('.earth-sky-view__ridge')).toHaveLength(0);
    expect(landmark).not.toBeNull();
    expect(landmark.getAttribute('data-landmark-name')).toBe('Tour Eiffel');
    expect(Number.parseFloat((landmark as HTMLElement).style.left)).toBeCloseTo(50, 3);
    const eiffelSilhouette = landmark.querySelector('.earth-sky-view__eiffel-silhouette');

    expect(eiffelSilhouette).not.toBeNull();
    expect(eiffelSilhouette.getAttribute('d').length).toBeGreaterThan(5_000);
    expect(fixture.nativeElement.textContent).toContain('Au-dessus de l’horizon');
  });

  it('rend les huit silhouettes et masque un repère situé hors du champ', () => {
    const locations = [
      location('paris', 'Paris', 48.8566, 2.3522),
      location('geonames-5128581', 'New York City', 40.71427, -74.00597),
      location('geonames-1850147', 'Tokyo', 35.6895, 139.69171),
      location('geonames-2643743', 'London', 51.50853, -0.12574),
      location('geonames-2147714', 'Sydney', -33.86785, 151.20732),
      location('geonames-360630', 'Cairo', 30.06263, 31.24967),
      location('geonames-3451190', 'Rio de Janeiro', -22.90642, -43.18223),
      location('geonames-1835848', 'Seoul', 37.566, 126.9784),
    ];

    for (const observer of locations) {
      const profile = createEarthHorizonProfile(observer);
      const fixture = createFixture(observer, profile.landmark!.bearingDegrees);

      expect(
        fixture.nativeElement.querySelector(`[data-landmark="${profile.landmark!.kind}"]`),
      ).not.toBeNull();
      fixture.destroy();
    }

    const paris = locations[0]!;
    const opposite = createFixture(
      paris,
      createEarthHorizonProfile(paris).landmark!.bearingDegrees + 180,
    );

    expect(opposite.nativeElement.querySelector('[data-landmark]')).toBeNull();
  });

  it('utilise un horizon procédural sans monument et conserve les états du sol', () => {
    const lyon = location('lyon', 'Lyon', 45.764, 4.8357);
    const fixture = createFixture(lyon, 180, false, 'travelling');
    const landscape = fixture.nativeElement.querySelector(
      '.earth-sky-view__landscape',
    ) as HTMLElement;

    expect(landscape.dataset['horizonProfile']).toBe('lyon');
    expect(landscape.classList).toContain('earth-sky-view__landscape--travelling');
    expect(landscape.classList).toContain('earth-sky-view__landscape--below');
    expect(fixture.nativeElement.querySelectorAll('.earth-sky-view__ridge')).toHaveLength(2);
    expect(fixture.nativeElement.querySelector('[data-landmark]')).toBeNull();
    expect(fixture.nativeElement.textContent).toContain('Sous l’horizon');
  });
});

function createFixture(
  observer: EarthObserverLocation,
  centerAzimuthDegrees: number,
  isAboveHorizon = true,
  phase: 'travelling' | 'open' = 'open',
) {
  const fixture = TestBed.createComponent(EarthHorizonComponent);

  fixture.componentRef.setInput('location', observer);
  fixture.componentRef.setInput('observation', observation(isAboveHorizon));
  fixture.componentRef.setInput('phase', phase);
  fixture.componentRef.setInput('horizonPosition', '72%');
  fixture.componentRef.setInput('perspective', {
    centerAzimuthDegrees,
    verticalFieldOfViewDegrees: 82,
    viewport: { width: 1_600, height: 900 },
  });
  fixture.detectChanges();

  return fixture;
}

function observation(isAboveHorizon: boolean): StellarObservation {
  return {
    altitudeDegrees: isAboveHorizon ? 22 : -8,
    geometricAltitudeDegrees: isAboveHorizon ? 22 : -8,
    atmosphericRefractionDegrees: 0,
    azimuthDegrees: 165,
    compassDirection: 'south',
    isAboveHorizon,
  };
}

function location(
  id: string,
  name: string,
  latitude: number,
  longitude: number,
): EarthObserverLocation {
  return { id, name, latitude, longitude, timeZone: 'UTC' };
}
