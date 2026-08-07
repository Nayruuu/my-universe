import { TestBed } from '@angular/core/testing';
import type { EarthObserverLocation } from '../../../engine/simulation/earth-observer-location';
import { EarthObserverLocationPickerComponent } from './earth-observer-location-picker.component';

const LOCATIONS: readonly EarthObserverLocation[] = [
  location('paris', 'Paris', 'FR', 2_000_000),
  location('tokyo', 'Tokyo', 'JP', 14_000_000),
  location('sydney', 'Sydney', 'AU', 5_000_000),
];

describe('EarthObserverLocationPickerComponent', () => {
  beforeEach(async () => {
    window.history.replaceState(null, '', '/fr/');
    await TestBed.configureTestingModule({
      imports: [EarthObserverLocationPickerComponent],
    }).compileComponents();
  });

  afterEach(() => TestBed.resetTestingModule());

  it('recherche une ville ou un pays puis émet le lieu choisi', () => {
    const fixture = TestBed.createComponent(EarthObserverLocationPickerComponent);
    const selected = vi.fn();

    fixture.componentRef.setInput('locations', LOCATIONS);
    fixture.componentRef.setInput('selectedLocationId', 'paris');
    fixture.componentRef.setInput('label', 'Lieu d’observation');
    fixture.componentRef.setInput('ariaLabel', 'Choisir le lieu');
    fixture.componentInstance.locationChange.subscribe(selected);
    fixture.detectChanges();

    expect(fixture.nativeElement.textContent).toContain('Paris');
    expect(fixture.nativeElement.textContent).toContain('France');
    const input = fixture.nativeElement.querySelector('input') as HTMLInputElement;

    input.value = 'japon';
    input.dispatchEvent(new Event('input'));
    fixture.detectChanges();

    const options = [...fixture.nativeElement.querySelectorAll('[role="option"]')] as HTMLElement[];

    expect(options).toHaveLength(1);
    expect(options[0]?.textContent).toContain('Tokyo');
    options[0]?.click();

    expect(selected).toHaveBeenCalledWith('tokyo');
    expect((fixture.nativeElement.querySelector('details') as HTMLDetailsElement).open).toBe(false);
  });

  it('propose les coordonnées personnalisées et un état vide', () => {
    const fixture = TestBed.createComponent(EarthObserverLocationPickerComponent);
    const selected = vi.fn();

    fixture.componentRef.setInput('locations', LOCATIONS);
    fixture.componentRef.setInput('selectedLocationId', 'custom');
    fixture.componentRef.setInput('label', 'Lieu d’observation');
    fixture.componentRef.setInput('ariaLabel', 'Choisir le lieu');
    fixture.componentRef.setInput('customLabel', 'Coordonnées personnalisées');
    fixture.componentRef.setInput('compact', true);
    fixture.componentInstance.locationChange.subscribe(selected);
    fixture.detectChanges();

    expect(fixture.nativeElement.textContent).toContain('Coordonnées personnalisées');
    expect(fixture.nativeElement.querySelector('.earth-observer-picker--compact')).not.toBeNull();
    const input = fixture.nativeElement.querySelector('input') as HTMLInputElement;

    input.value = 'aucun endroit';
    input.dispatchEvent(new Event('input'));
    fixture.detectChanges();

    expect(fixture.nativeElement.textContent).toContain('Aucun lieu trouvé');
    (
      fixture.nativeElement.querySelector('.earth-observer-picker__custom') as HTMLButtonElement
    ).click();

    expect(selected).toHaveBeenCalledWith('custom');
  });
});

function location(
  id: string,
  name: string,
  countryCode: string,
  population: number,
): EarthObserverLocation {
  return {
    id,
    name,
    countryCode,
    population,
    latitude: 0,
    longitude: 0,
    timeZone: 'UTC',
  };
}
