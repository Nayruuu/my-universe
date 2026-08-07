import { TestBed } from '@angular/core/testing';
import { LocalSkyMapComponent } from './local-sky-map.component';

describe('LocalSkyMapComponent', () => {
  beforeEach(() => {
    window.history.replaceState(null, '', '/fr/');
    TestBed.configureTestingModule({ imports: [LocalSkyMapComponent] });
  });

  afterEach(() => TestBed.resetTestingModule());

  it('projette Sirius dans le quadrant sud-est du ciel parisien', () => {
    const fixture = createFixture(23.290_150_6, 165.539_599_8);

    fixture.detectChanges();
    const map = fixture.nativeElement.querySelector('.sky-map') as HTMLElement;
    const target = fixture.nativeElement.querySelector('.sky-map__target') as HTMLElement;

    expect(fixture.nativeElement.querySelector('figure').getAttribute('aria-label')).toContain(
      'Sirius',
    );
    expect(fixture.nativeElement.textContent).toContain('Zénith');
    expect(fixture.nativeElement.textContent).toContain('Horizon');
    expect(fixture.nativeElement.querySelector('.sky-map--above')).not.toBeNull();
    expect(parseFloat(target.style.left)).toBeCloseTo(57.218_540_6, 5);
    expect(parseFloat(target.style.top)).toBeCloseTo(77.991_821_8, 5);
    expect(map.style.getPropertyValue('--target-azimuth')).toBe('165.5395998deg');
    expect(map.style.getPropertyValue('--target-radius')).toBe('0.7412205488888889');
    expect(fixture.nativeElement.querySelector('.sky-map__west').textContent.trim()).toBe('O');
  });

  it('épingle une étoile sous l’horizon et l’identifie comme non visible', () => {
    const fixture = createFixture(-55.255_609_5, 333.198_646);

    fixture.detectChanges();
    const target = fixture.nativeElement.querySelector('.sky-map__target') as HTMLElement;

    expect(fixture.nativeElement.querySelector('.sky-map--below')).not.toBeNull();
    expect(parseFloat(target.style.left)).toBeLessThan(50);
    expect(parseFloat(target.style.top)).toBeLessThan(50);
    expect(
      Math.hypot(parseFloat(target.style.left) - 50, parseFloat(target.style.top) - 50),
    ).toBeCloseTo(39, 5);
    expect(fixture.nativeElement.querySelector('figure').getAttribute('aria-label')).toMatch(
      /sous l’horizon/iu,
    );
  });
});

function createFixture(altitudeDegrees: number, azimuthDegrees: number) {
  const fixture = TestBed.createComponent(LocalSkyMapComponent);

  fixture.componentRef.setInput('targetName', 'Sirius');
  fixture.componentRef.setInput('altitudeDegrees', altitudeDegrees);
  fixture.componentRef.setInput('azimuthDegrees', azimuthDegrees);

  return fixture;
}
