import { TestBed } from '@angular/core/testing';
import {
  EarthCityscapeComponent,
  earthCityscapePanoramaViewBox,
} from './earth-cityscape.component';

describe('EarthCityscapeComponent', () => {
  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [EarthCityscapeComponent],
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
    expect(
      Number(byId.get('grande-arche')?.getAttribute('width')) / height('grande-arche'),
    ).toBeCloseTo(109 / 111, 8);
    expect(landmarks.every((landmark) => !landmark.parentElement?.hasAttribute('transform'))).toBe(
      true,
    );
    expect(svg.querySelector('.earth-cityscape__chimneys')).toBeNull();
    expect(cityLights.length).toBeGreaterThan(70);
    expect(cityLights.length).toBeLessThan(110);
    expect(cityLights.every((light) => Number(light.getAttribute('width')) < 4)).toBe(true);
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

  it('ne remplace pas les silhouettes des villes sans panorama SVG dédié', () => {
    const fixture = TestBed.createComponent(EarthCityscapeComponent);

    fixture.componentRef.setInput('kind', 'tokyo');
    fixture.componentRef.setInput('perspective', perspective(0));
    fixture.detectChanges();

    expect(fixture.nativeElement.querySelector('svg')).toBeNull();
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

function perspective(centerAzimuthDegrees: number) {
  return {
    centerAzimuthDegrees,
    verticalFieldOfViewDegrees: 82,
    viewport: { width: 1_600, height: 900 },
  };
}
