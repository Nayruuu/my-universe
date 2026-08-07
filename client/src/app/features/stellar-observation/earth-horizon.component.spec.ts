import { TestBed } from '@angular/core/testing';
import { By } from '@angular/platform-browser';
import type { EarthObserverLocation } from '../../../engine/simulation/earth-observer-location';
import type { StellarObservation } from '../../../engine/simulation/stellar-observation';
import { EarthCityscapeComponent } from './earth-cityscape.component';
import { EarthLandmarkCatalogService } from './earth-landmark-catalog.service';
import { createEarthHorizonProfile } from './earth-horizon-profile';
import { EarthHorizonComponent } from './earth-horizon.component';
import type { EarthTerrainHorizonProfile } from './earth-terrain-horizon-catalog.types';

describe('EarthHorizonComponent', () => {
  beforeEach(async () => {
    window.history.replaceState(null, '', '/fr/');
    await TestBed.configureTestingModule({
      imports: [EarthHorizonComponent],
      providers: [
        {
          provide: EarthLandmarkCatalogService,
          useValue: { load: async () => [] },
        },
      ],
    }).compileComponents();
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
      expect(
        fixture.nativeElement.querySelector(`[data-cityscape-svg="${profile.cityscapeKind}"]`),
      ).not.toBeNull();
      expect(fixture.nativeElement.querySelectorAll('.earth-sky-view__ridge')).toHaveLength(0);
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

  it('remplace la ville inventée par une plaine pour des coordonnées libres', () => {
    const custom = location('coordinates-43.296000-5.370000', 'Ma position', 43.296, 5.37);
    const fixture = createFixture(custom, 180);
    const landscape = fixture.nativeElement.querySelector(
      '.earth-sky-view__landscape',
    ) as HTMLElement;

    expect(landscape.dataset['landscape']).toBe('plain');
    expect(landscape.dataset['lightDensity']).toBe('quiet');
    expect(fixture.nativeElement.querySelectorAll('.earth-sky-view__ridge')).toHaveLength(2);
    expect(fixture.nativeElement.querySelector('.earth-sky-view__city-glow')).toBeNull();
    expect(fixture.nativeElement.querySelector('app-earth-cityscape')).toBeNull();
    expect(fixture.nativeElement.querySelector('[data-cityscape-svg]')).toBeNull();
  });

  it('projette un masque de relief sourcé et expose son seuil dans le contexte scientifique', () => {
    const fixture = createFixture(
      location('paris', 'Paris', 48.8566, 2.3522),
      180,
      true,
      'open',
      terrainProfile(180),
    );
    const landscape = fixture.nativeElement.querySelector(
      '.earth-sky-view__landscape',
    ) as HTMLElement;

    expect(landscape.dataset['terrainModel']).toBe('noaa-etopo-fixture');
    expect(landscape.dataset['terrainSourceDoi']).toBe('https://doi.org/10.0/fixture');
    expect(landscape.dataset['terrainRendering']).toBe(
      'measured-distance-envelopes-with-stylized-lighting',
    );
    expect(fixture.nativeElement.querySelectorAll('[data-terrain-distance-band]')).toHaveLength(3);
    expect(fixture.nativeElement.querySelectorAll('[data-terrain-contour]')).toHaveLength(2);
    expect(
      fixture.nativeElement.querySelector('[data-terrain-distance-band="near"]'),
    ).not.toBeNull();
    expect(
      fixture.nativeElement.querySelector('.earth-sky-view__measured-terrain-crest'),
    ).not.toBeNull();
    expect(fixture.nativeElement.textContent).toContain('relief 1,8°');
  });

  it('retire les collines illustratives lorsqu’un relief mesuré est disponible', () => {
    const fixture = createFixture(
      location('lyon', 'Lyon', 45.764, 4.8357),
      180,
      true,
      'open',
      terrainProfile(800),
    );

    expect(fixture.nativeElement.querySelectorAll('.earth-sky-view__ridge')).toHaveLength(0);
    const cityscape = fixture.debugElement.query(By.directive(EarthCityscapeComponent))
      .componentInstance as EarthCityscapeComponent;

    expect(cityscape.showIllustrativeTerrain()).toBe(false);
  });
});

function createFixture(
  observer: EarthObserverLocation,
  centerAzimuthDegrees: number,
  isAboveHorizon = true,
  phase: 'travelling' | 'open' = 'open',
  terrainHorizon: EarthTerrainHorizonProfile | null = null,
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
  fixture.componentRef.setInput('terrainHorizon', terrainHorizon);
  fixture.detectChanges();

  return fixture;
}

function terrainProfile(value: number): EarthTerrainHorizonProfile {
  const distanceBands = [
    { id: 'near' as const, minimumDistanceMeters: 0, maximumDistanceMeters: 30_000 },
    { id: 'mid' as const, minimumDistanceMeters: 30_000, maximumDistanceMeters: 100_000 },
    { id: 'far' as const, minimumDistanceMeters: 100_000, maximumDistanceMeters: 300_000 },
  ];

  return {
    locationId: 'paris',
    latitude: 48.8566,
    longitude: 2.3522,
    observerElevationMeters: 37,
    azimuthStepDegrees: 1,
    distanceLayers: distanceBands.map((band, index) => ({
      ...band,
      obstructionAnglesCentidegrees: new Int16Array(360).fill(
        Math.round(value * (1 - index * 0.28)),
      ),
    })),
    obstructionAnglesCentidegrees: new Int16Array(360).fill(value),
    source: {
      id: 'noaa-etopo-fixture',
      title: 'ETOPO fixture',
      productUrl: 'https://example.com/product',
      dataUrl: 'fixture.tif',
      doi: 'https://doi.org/10.0/fixture',
      horizontalDatum: 'WGS 84',
      verticalDatum: 'EGM2008',
      resolutionArcSeconds: 60,
    },
    calculation: {
      model: 'spherical-geometric-line-of-sight',
      earthRadiusMeters: 6_371_008.8,
      observerEyeHeightMeters: 2,
      maximumDistanceMeters: 300_000,
      sampleStepMeters: 1_852,
      azimuthStepDegrees: 1,
      distanceBands,
      atmosphericRefraction: 'excluded',
      terrainInterpolation: 'bilinear',
      locationAnchor: 'catalogued-city-center',
    },
  };
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
