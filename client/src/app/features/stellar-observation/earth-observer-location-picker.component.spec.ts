import { TestBed } from '@angular/core/testing';
import type { EarthObserverLocation } from '../../../engine/simulation/earth-observer-location';
import { EarthObserverLocationPickerComponent } from './earth-observer-location-picker.component';

const LOCATIONS: readonly EarthObserverLocation[] = [
  location('paris', 'Paris', 'FR', 2_000_000),
  location('tokyo', 'Tokyo', 'JP', 14_000_000),
  location('sydney', 'Sydney', 'AU', 5_000_000),
];

describe('EarthObserverLocationPickerComponent', () => {
  const originalGeolocation = Object.getOwnPropertyDescriptor(navigator, 'geolocation');

  beforeEach(async () => {
    window.history.replaceState(null, '', '/fr/');
    await TestBed.configureTestingModule({
      imports: [EarthObserverLocationPickerComponent],
    }).compileComponents();
  });

  afterEach(() => {
    restoreGeolocation(originalGeolocation);
    TestBed.resetTestingModule();
  });

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

  it('demande explicitement la position, l’arrondit puis émet le nouvel observateur', async () => {
    let resolvePosition: PositionCallback = vi.fn();
    const geolocation = geolocationWith((success) => {
      resolvePosition = success;
    });

    installGeolocation(geolocation);
    const fixture = geolocationFixture();
    const detected = vi.fn();

    fixture.componentInstance.currentPositionChange.subscribe(detected);
    fixture.detectChanges();
    const menu = fixture.nativeElement.querySelector('details') as HTMLDetailsElement;
    const button = fixture.nativeElement.querySelector(
      '.earth-observer-picker__geolocation',
    ) as HTMLButtonElement;

    menu.open = true;
    button.click();
    button.click();
    fixture.detectChanges();

    expect(geolocation.getCurrentPosition).toHaveBeenCalledOnce();
    expect(button.disabled).toBe(true);
    expect(button.textContent).toContain('Localisation en cours');
    expect(fixture.nativeElement.textContent).toContain('Localisation en cours');

    resolvePosition(position(48.856_612, 2.352_222));
    await vi.waitFor(() => expect(detected).toHaveBeenCalledOnce());
    fixture.detectChanges();

    expect(detected).toHaveBeenCalledWith(
      expect.objectContaining({
        id: 'coordinates-48.857000-2.352000',
        name: 'Ma position',
        latitude: 48.857,
        longitude: 2.352,
      }),
    );
    expect(menu.open).toBe(false);
    expect(fixture.nativeElement.textContent).toContain('coordonnées arrondies à environ 100 m');
  });

  it.each([
    [undefined, 'La géolocalisation n’est pas disponible'],
    [geolocationRejecting(1), 'L’accès à votre position a été refusé'],
    [geolocationRejecting(2), 'Votre position n’a pas pu être déterminée'],
    [geolocationRejecting(3), 'La localisation a pris trop de temps'],
    [geolocationResolving(position(91, 181)), 'La position reçue est invalide'],
  ] as const)('explique un échec de localisation sans changer de lieu', async (api, message) => {
    installGeolocation(api);
    const fixture = geolocationFixture();
    const detected = vi.fn();

    fixture.componentInstance.currentPositionChange.subscribe(detected);
    fixture.detectChanges();
    (
      fixture.nativeElement.querySelector('.earth-observer-picker__geolocation') as HTMLElement
    ).click();
    await fixture.whenStable();
    fixture.detectChanges();

    expect(detected).not.toHaveBeenCalled();
    expect(fixture.nativeElement.textContent).toContain(message);
    expect(fixture.nativeElement.querySelector('[role="status"]')).not.toBeNull();
  });
});

function geolocationFixture() {
  const fixture = TestBed.createComponent(EarthObserverLocationPickerComponent);

  fixture.componentRef.setInput('locations', LOCATIONS);
  fixture.componentRef.setInput('selectedLocationId', 'paris');
  fixture.componentRef.setInput('label', 'Lieu d’observation');
  fixture.componentRef.setInput('ariaLabel', 'Choisir le lieu');
  fixture.componentRef.setInput('geolocationEnabled', true);

  return fixture;
}

function installGeolocation(geolocation: Geolocation | undefined): void {
  Object.defineProperty(navigator, 'geolocation', {
    configurable: true,
    value: geolocation,
  });
}

function restoreGeolocation(descriptor: PropertyDescriptor | undefined): void {
  if (descriptor) {
    Object.defineProperty(navigator, 'geolocation', descriptor);
  } else {
    Reflect.deleteProperty(navigator, 'geolocation');
  }
}

function geolocationWith(
  getCurrentPosition: (success: PositionCallback, failure?: PositionErrorCallback | null) => void,
): Geolocation {
  return {
    getCurrentPosition: vi.fn(getCurrentPosition),
    watchPosition: vi.fn(),
    clearWatch: vi.fn(),
  };
}

function geolocationResolving(positionResult: GeolocationPosition): Geolocation {
  return geolocationWith((success) => success(positionResult));
}

function geolocationRejecting(code: number): Geolocation {
  return geolocationWith((_success, failure) => failure?.({ code } as GeolocationPositionError));
}

function position(latitude: number, longitude: number): GeolocationPosition {
  return {
    coords: {
      accuracy: 25,
      altitude: null,
      altitudeAccuracy: null,
      heading: null,
      latitude,
      longitude,
      speed: null,
      toJSON: () => ({}),
    },
    timestamp: 0,
    toJSON: () => ({}),
  };
}

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
