import { TestBed } from '@angular/core/testing';
import { vi } from 'vitest';
import type { EarthObserverLocation } from '../../../engine/simulation/earth-observer-location';
import type { EarthLandmarkDefinition } from './earth-landmark-catalog';
import { EarthLandmarkCatalogService } from './earth-landmark-catalog.service';
import {
  EarthCityscapeComponent,
  earthCityscapePanoramaViewBox,
} from './earth-cityscape.component';

describe('EarthCityscapeComponent', () => {
  const catalogService = { load: vi.fn() };

  beforeEach(async () => {
    catalogService.load.mockReset().mockResolvedValue([]);
    await TestBed.configureTestingModule({
      imports: [EarthCityscapeComponent],
      providers: [{ provide: EarthLandmarkCatalogService, useValue: catalogService }],
    }).compileComponents();
  });

  afterEach(() => TestBed.resetTestingModule());

  it('rend un panorama SVG parisien unique selon le cap observé', () => {
    const fixture = TestBed.createComponent(EarthCityscapeComponent);

    fixture.componentRef.setInput('kind', 'paris');
    fixture.componentRef.setInput('perspective', perspective(272.7));
    fixture.detectChanges();
    const svg = fixture.nativeElement.querySelector('[data-cityscape-svg="paris"]');
    const viewBox = svg.getAttribute('viewBox').split(' ').map(Number);
    const farPath = svg.querySelector('.earth-cityscape__far').getAttribute('d');
    const nearPath = svg.querySelector('.earth-cityscape__near').getAttribute('d');

    expect(svg).not.toBeNull();
    expect(svg.querySelectorAll(':scope > use')).toHaveLength(3);
    expect(svg.querySelector('.earth-cityscape__far').getAttribute('fill')).toBe(
      'url(#paris-far-buildings)',
    );
    expect(svg.querySelector('.earth-cityscape__near').getAttribute('fill')).toBe(
      'url(#paris-near-buildings)',
    );
    const landmarks = Array.from(
      svg.querySelectorAll('.earth-cityscape__licensed-landmark'),
    ) as SVGSVGElement[];

    expect(landmarks).toHaveLength(5);
    expect(
      landmarks.map((landmark) => landmark.querySelector('use')?.getAttribute('href')),
    ).toEqual([
      '/illustrations/highpoints-of-paris.svg#g21514',
      '/illustrations/highpoints-of-paris.svg#g7527',
      '/illustrations/highpoints-of-paris.svg#g22418',
      '/illustrations/highpoints-of-paris.svg#g20551',
      '/illustrations/highpoints-of-paris.svg#g16954',
    ]);
    const byId = new Map(
      landmarks.map((landmark) => [landmark.dataset['landmarkId'], landmark] as const),
    );
    const cityLights = Array.from(svg.querySelectorAll('[data-city-light]')) as SVGRectElement[];
    const height = (id: string) => Number(byId.get(id)?.getAttribute('height'));

    expect(height('montparnasse') / height('notre-dame')).toBeCloseTo(210 / 69, 8);
    expect(height('grande-arche') / height('arc-de-triomphe')).toBeCloseTo(110 / 49.54, 8);
    expect(height('sacre-coeur') / height('notre-dame')).toBeCloseTo(83 / 69, 8);
    expect(svg.querySelectorAll('.earth-cityscape__montmartre')).toHaveLength(1);
    expect(
      Number(byId.get('grande-arche')?.getAttribute('width')) / height('grande-arche'),
    ).toBeCloseTo(109 / 111, 8);
    expect(landmarks.every((landmark) => !landmark.parentElement?.hasAttribute('transform'))).toBe(
      true,
    );
    expect(svg.querySelector('.earth-cityscape__chimneys')).toBeNull();
    expect(cityLights.length).toBeGreaterThan(160);
    expect(cityLights.length).toBeLessThan(260);
    expect(svg.querySelectorAll('[data-city-light-pool]').length).toBe(21);
    expectUrbanLightLayering(svg);
    expect(cityLights.every((light) => Number(light.getAttribute('width')) < 4.5)).toBe(true);
    expect(cityLights.every((light) => !light.parentElement?.hasAttribute('transform'))).toBe(true);
    expect(farPath.length).toBeGreaterThan(3_000);
    expect(nearPath.length).toBeGreaterThan(6_000);
    expect(nearPath.match(/[LHVQ]/g)?.length).toBeGreaterThan(500);
    expect(viewBox[0]).toBeGreaterThan(11_000);
    expect(viewBox[1]).toBeGreaterThan(0);
    expect(viewBox[2]).toBeGreaterThan(2_000);
    expect(viewBox[2]).toBeLessThan(3_000);
    expect(viewBox[3]).toBeGreaterThan(200);
    expect(viewBox[3]).toBeLessThan(320);
  });

  it('rend un panorama vectoriel distinct pour les sept autres villes emblématiques', () => {
    const kinds = ['new-york', 'tokyo', 'london', 'sydney', 'cairo', 'rio', 'seoul'] as const;
    const nearSilhouettes = new Set<string>();

    for (const kind of kinds) {
      const fixture = TestBed.createComponent(EarthCityscapeComponent);

      fixture.componentRef.setInput('kind', kind);
      fixture.componentRef.setInput('perspective', perspective(0));
      fixture.detectChanges();
      const svg = fixture.nativeElement.querySelector(
        `[data-cityscape-svg="${kind}"]`,
      ) as SVGElement;
      const farPath = svg?.querySelector('.earth-cityscape__far')?.getAttribute('d') ?? '';
      const nearPath = svg?.querySelector('.earth-cityscape__near')?.getAttribute('d') ?? '';
      const landmarks = Array.from(
        svg?.querySelectorAll('[data-regional-landmark]') ?? [],
      ) as SVGSVGElement[];

      expect(svg).not.toBeNull();
      expect(svg.querySelectorAll(':scope > use')).toHaveLength(3);
      expect(svg.querySelector('.earth-cityscape__far')?.getAttribute('fill')).toBe(
        'url(#regional-far-buildings)',
      );
      expect(svg.querySelector('.earth-cityscape__near')?.getAttribute('fill')).toBe(
        'url(#regional-near-buildings)',
      );
      expect(svg.querySelector('.earth-cityscape__far')?.getAttribute('opacity')).toBeNull();
      expect(svg.querySelector('.earth-cityscape__near')?.getAttribute('opacity')).toBeNull();
      expect(farPath.length).toBeGreaterThan(1_000);
      expect(nearPath.length).toBeGreaterThan(2_000);
      expect(svg.querySelectorAll('[data-city-light]').length).toBeGreaterThan(90);
      expect(svg.querySelectorAll('[data-city-light-pool]').length).toBeGreaterThanOrEqual(15);
      expectUrbanLightLayering(svg);
      expect(['balanced', 'dense']).toContain(svg.getAttribute('data-cityscape-light-density'));
      expect(landmarks).toHaveLength(4);
      expect(
        landmarks.every((landmark) => {
          const silhouette = landmark.querySelector('.earth-cityscape__landmark-silhouette');

          return (
            Number(landmark.getAttribute('height')) > 0 &&
            silhouette?.getAttribute('fill') === '#050a11' &&
            silhouette.getAttribute('fill-rule') === 'nonzero'
          );
        }),
      ).toBe(true);
      nearSilhouettes.add(nearPath);
      fixture.destroy();
    }

    expect(nearSilhouettes.size).toBe(kinds.length);
  });

  it('ne remplace pas le panorama procédural des autres lieux', () => {
    const fixture = TestBed.createComponent(EarthCityscapeComponent);

    fixture.componentRef.setInput('kind', 'procedural');
    fixture.componentRef.setInput('perspective', perspective(0));
    fixture.detectChanges();

    expect(fixture.nativeElement.querySelector('svg')).toBeNull();
    expect(catalogService.load).not.toHaveBeenCalled();
    expect(readCatalogCityscape(fixture.componentInstance)()).toBeNull();
  });

  it('compose quatre repères documentés dans un panorama artistique propre au lieu observé', async () => {
    const fixture = TestBed.createComponent(EarthCityscapeComponent);
    const location: EarthObserverLocation = {
      id: 'geonames-2996944',
      name: 'Lyon',
      latitude: 45.764,
      longitude: 4.8357,
      timeZone: 'Europe/Paris',
    };

    catalogService.load.mockResolvedValueOnce([
      catalogLandmark('lyon-one', 45.77, 4.82, 120),
      catalogLandmark('lyon-two', 45.75, 4.86, 80),
      catalogLandmark('lyon-three', 45.78, 4.88, 60),
      catalogLandmark('lyon-four', 45.73, 4.8, null),
    ]);
    fixture.componentRef.setInput('kind', 'procedural');
    fixture.componentRef.setInput('location', location);
    fixture.componentRef.setInput('perspective', perspective(90));
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();
    const svg = fixture.nativeElement.querySelector('[data-cityscape-svg="catalog"]');
    const landmarks = Array.from(
      svg?.querySelectorAll('[data-catalog-landmark]') ?? [],
    ) as SVGSVGElement[];

    expect(catalogService.load).toHaveBeenCalledOnce();
    expect(catalogService.load).toHaveBeenCalledWith(location.id);
    expect(svg?.getAttribute('data-location-id')).toBe(location.id);
    expect(svg?.getAttribute('data-art-direction')).toBe('unique-city-panorama');
    expect(svg?.querySelectorAll(':scope > use')).toHaveLength(3);
    expect(svg?.querySelector('.earth-cityscape__terrain')).not.toBeNull();
    expect(svg?.querySelector('.earth-cityscape__far')).not.toBeNull();
    expect(svg?.querySelector('.earth-cityscape__near')).not.toBeNull();
    expect(svg?.querySelectorAll('[data-city-light]').length).toBeGreaterThanOrEqual(96);
    expect(svg?.querySelectorAll('[data-city-light-pool]').length).toBeGreaterThanOrEqual(10);
    expectUrbanLightLayering(svg);
    expect(svg?.getAttribute('data-cityscape-light-density')).toBe('quiet');
    expect(landmarks).toHaveLength(4);
    expect(landmarks[0]?.dataset['sourceUrl']).toBe('https://example.com/source');
    expect(landmarks[0]?.dataset['visualConfidence']).toBe('illustrative');
    expect(landmarks[0]?.querySelector('path')?.getAttribute('d')).toBe('M0 0H100V100H0Z');
  });

  it('conserve les bâtiments mais retire le terrain illustratif lorsqu’un masque mesuré existe', async () => {
    const fixture = TestBed.createComponent(EarthCityscapeComponent);
    const location = observer('measured-city');

    catalogService.load.mockResolvedValueOnce([catalogLandmark('measured-landmark', 1, 1, 80)]);
    fixture.componentRef.setInput('kind', 'procedural');
    fixture.componentRef.setInput('location', location);
    fixture.componentRef.setInput('perspective', perspective(90));
    fixture.componentRef.setInput('showIllustrativeTerrain', false);
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();

    const svg = fixture.nativeElement.querySelector('[data-cityscape-svg="catalog"]');

    expect(svg?.querySelector('.earth-cityscape__terrain')).toBeNull();
    expect(svg?.querySelector('.earth-cityscape__far')).not.toBeNull();
    expect(svg?.querySelector('.earth-cityscape__near')).not.toBeNull();
    expect(svg?.querySelector('[data-catalog-landmark]')).not.toBeNull();
  });

  it('ignore une ancienne réponse lors d’un changement rapide de lieu', async () => {
    const fixture = TestBed.createComponent(EarthCityscapeComponent);
    const first = deferred<readonly EarthLandmarkDefinition[]>();
    const second = deferred<readonly EarthLandmarkDefinition[]>();

    catalogService.load.mockReturnValueOnce(first.promise).mockReturnValueOnce(second.promise);
    fixture.componentRef.setInput('kind', 'procedural');
    fixture.componentRef.setInput('location', observer('first-city'));
    fixture.componentRef.setInput('perspective', perspective(0));
    fixture.detectChanges();
    fixture.componentRef.setInput('location', observer('second-city'));
    fixture.detectChanges();
    first.resolve([catalogLandmark('obsolete', 1, 1, 100)]);
    await first.promise;
    fixture.detectChanges();
    expect(fixture.nativeElement.querySelector('[data-catalog-landmark]')).toBeNull();

    second.resolve([catalogLandmark('current', 1, 1, 100)]);
    await fixture.whenStable();
    fixture.detectChanges();
    expect(fixture.nativeElement.querySelector('[data-landmark-id="current"]')).not.toBeNull();
  });

  it('conserve le panorama procédural si le catalogue est indisponible', async () => {
    const fixture = TestBed.createComponent(EarthCityscapeComponent);

    catalogService.load.mockRejectedValueOnce(new Error('offline'));
    fixture.componentRef.setInput('kind', 'procedural');
    fixture.componentRef.setInput('location', observer('offline-city'));
    fixture.componentRef.setInput('perspective', perspective(0));
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();

    expect(fixture.nativeElement.querySelector('[data-cityscape-svg="catalog"]')).toBeNull();
  });

  it('ignore une erreur asynchrone après la destruction du panorama', async () => {
    const fixture = TestBed.createComponent(EarthCityscapeComponent);
    const pending = deferred<readonly EarthLandmarkDefinition[]>();

    catalogService.load.mockReturnValueOnce(pending.promise);
    fixture.componentRef.setInput('kind', 'procedural');
    fixture.componentRef.setInput('location', observer('destroyed-city'));
    fixture.componentRef.setInput('perspective', perspective(0));
    fixture.detectChanges();
    fixture.destroy();
    pending.reject(new Error('late failure'));

    await expect(pending.promise).rejects.toThrow('late failure');
  });

  it('boucle le panorama sans discontinuité pour un azimut négatif', () => {
    const [x, y, width, height] = earthCityscapePanoramaViewBox(perspective(-45))
      .split(' ')
      .map(Number);

    expect(x).toBeGreaterThan(12_000);
    expect(y).toBeGreaterThan(0);
    expect(width).toBeGreaterThan(2_000);
    expect(height).toBeGreaterThan(200);
  });

  it('conserve les proportions du dessin sur un écran mobile', () => {
    const [x, y, width, height] = earthCityscapePanoramaViewBox({
      ...perspective(90),
      viewport: { width: 393, height: 852 },
    })
      .split(' ')
      .map(Number);

    expect(x).toBeGreaterThan(8_000);
    expect(y).toBeGreaterThan(0);
    expect(width).toBeLessThan(1_000);
    expect(height).toBeGreaterThan(200);
  });
});

function expectUrbanLightLayering(svg: Element | null): void {
  const panorama = svg?.querySelector('g[id$="panorama"]');
  const far = panorama?.querySelector('.earth-cityscape__far');
  const pools = panorama?.querySelector('[data-city-light-pools]');
  const near = panorama?.querySelector('.earth-cityscape__near');
  const layers = Array.from(panorama?.children ?? []);
  const indexOfLayerContaining = (element: Element | null | undefined): number =>
    layers.findIndex(
      (layer) =>
        layer === element || (element !== null && element !== undefined && layer.contains(element)),
    );

  expect(panorama).not.toBeNull();
  expect(indexOfLayerContaining(far)).toBeLessThan(indexOfLayerContaining(pools));
  expect(indexOfLayerContaining(pools)).toBeLessThan(indexOfLayerContaining(near));
}

function readCatalogCityscape(component: EarthCityscapeComponent): () => unknown {
  return (
    component as unknown as {
      readonly catalogCityscape: () => unknown;
    }
  ).catalogCityscape;
}

function perspective(centerAzimuthDegrees: number) {
  return {
    centerAzimuthDegrees,
    verticalFieldOfViewDegrees: 82,
    viewport: { width: 1_600, height: 900 },
  };
}

function catalogLandmark(
  id: string,
  latitude: number,
  longitude: number,
  heightMeters: number | null,
): EarthLandmarkDefinition {
  return {
    category: 'tower',
    distanceMeters: 1_000,
    heightConfidence: heightMeters === null ? 'unknown' : 'documented',
    heightMeters,
    id,
    latitude,
    longitude,
    name: id,
    scientificConfidence: 'observed',
    selectionMethod: 'wikimedia-geosearch',
    silhouettePath: 'M0 0H100V100H0Z',
    sourceAspectRatio: 1,
    sourceTitle: 'Documented source',
    sourceUrl: 'https://example.com/source',
    sourceViewBox: '0 0 100 100',
    visualConfidence: 'illustrative',
    wikidataId: 'Q1',
    wikipediaUrl: 'https://example.com/article',
  };
}

function observer(id: string): EarthObserverLocation {
  return { id, name: id, latitude: 0, longitude: 0, timeZone: 'UTC' };
}

function deferred<T>(): {
  readonly promise: Promise<T>;
  readonly reject: (reason: unknown) => void;
  readonly resolve: (value: T) => void;
} {
  let resolvePromise!: (value: T) => void;
  let rejectPromise!: (reason: unknown) => void;
  const promise = new Promise<T>((resolve, reject) => {
    resolvePromise = resolve;
    rejectPromise = reject;
  });

  return { promise, reject: rejectPromise, resolve: resolvePromise };
}
