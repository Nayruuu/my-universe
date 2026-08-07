import { TestBed } from '@angular/core/testing';
import type { SpaceObject, UniverseTime } from '../../../data/models/universe.models';
import { ASTRONOMY_ENGINE_MAX_JULIAN_DAY } from '../../../engine/simulation/astronomy-engine-time-domain';
import { EARTH_OBSERVER_LOCATIONS } from '../../../engine/simulation/earth-observer-location';
import { dateToJulianDay } from '../../../engine/simulation/time-utils';
import { EarthObserverSelection } from './earth-observer-selection';
import { StellarObservationComponent } from './stellar-observation.component';
import { equatorialCoordinates } from './earth-sky-catalog';

describe('StellarObservationComponent', () => {
  const originalGeolocation = Object.getOwnPropertyDescriptor(navigator, 'geolocation');

  beforeEach(() => {
    window.history.replaceState(null, '', '/fr/');
    TestBed.configureTestingModule({ imports: [StellarObservationComponent] });
  });

  afterEach(() => {
    restoreGeolocation(originalGeolocation);
    TestBed.resetTestingModule();
  });

  it('localise Sirius depuis Paris avec la date globale de la carte', () => {
    const fixture = createFixture(sirius(), universeTime('2026-01-15T22:00:00Z'));

    fixture.detectChanges();
    const text = fixture.nativeElement.textContent;

    expect(text).toContain('Localiser Sirius');
    expect(text).toContain('Au-dessus de l’horizon');
    expect(text).toContain('23,3°');
    expect(text).toContain('165,5°');
    expect(text).toContain('Sud');
    expect(fixture.nativeElement.querySelector('section').getAttribute('aria-label')).toBe(
      'Localiser Sirius',
    );
    expect(fixture.nativeElement.querySelector('app-local-sky-map')).not.toBeNull();
    expect(fixture.nativeElement.querySelector('.sky-map__target')).not.toBeNull();
    expect(fixture.nativeElement.querySelector('.horizon-indicator--visible')).not.toBeNull();
  });

  it('recalcule immédiatement le relèvement pour un lieu prédéfini différent', () => {
    const fixture = createFixture(sirius(), universeTime('2026-01-15T22:00:00Z'));
    const component = fixture.componentInstance as unknown as StellarObservationAccess;

    component.changeLocation('marseille');
    fixture.detectChanges();

    expect(component.selectedLocation()?.id).toBe('marseille');
    expect(TestBed.inject(EarthObserverSelection).location()?.id).toBe('marseille');
    expect(component.observation()?.azimuthDegrees).not.toBeCloseTo(165.5396, 3);
    expect(fixture.nativeElement.textContent).toContain('Marseille');

    component.changeLocation('unknown');
    expect(component.selectedLocation()?.id).toBe('paris');
  });

  it('conserve le lieu partagé lorsque la fiche est remontée dans le ciel terrestre', () => {
    const tokyo = EARTH_OBSERVER_LOCATIONS.find(({ name }) => name === 'Tokyo')!;

    TestBed.inject(EarthObserverSelection).setLocation(tokyo);
    const fixture = createFixture(sirius(), universeTime('2026-01-15T22:00:00Z'));

    fixture.detectChanges();

    expect(
      (fixture.componentInstance as unknown as StellarObservationAccess).selectedLocation(),
    ).toBe(tokyo);
    expect(TestBed.inject(EarthObserverSelection).location()).toBe(tokyo);
    expect(fixture.nativeElement.textContent).toContain('Tokyo');
  });

  it('revient au premier lieu lorsque la sélection partagée est absente', () => {
    const selection = TestBed.inject(EarthObserverSelection);

    selection.setLocation(null);
    const fixture = createFixture(sirius(), universeTime('2026-01-15T22:00:00Z'));

    fixture.detectChanges();

    expect(
      (fixture.componentInstance as unknown as StellarObservationAccess).selectedLocation()?.id,
    ).toBe('paris');
    expect(selection.location()?.id).toBe('paris');
  });

  it('restaure les coordonnées personnalisées partagées lorsque la fiche est remontée', () => {
    const selection = TestBed.inject(EarthObserverSelection);

    selection.setLocation({
      id: 'coordinates-35.000000-139.000000',
      name: 'Observatoire privé',
      latitude: 35,
      longitude: 139,
      timeZone: 'UTC',
    });
    const fixture = createFixture(sirius(), universeTime('2026-01-15T22:00:00Z'));

    fixture.detectChanges();

    expect(
      (fixture.componentInstance as unknown as StellarObservationAccess).selectedLocation(),
    ).toMatchObject({
      id: 'coordinates-35.000000-139.000000',
      latitude: 35,
      longitude: 139,
    });
    expect(selection.location()?.id).toBe('coordinates-35.000000-139.000000');
    expect(fixture.nativeElement.textContent).toContain('Coordonnées personnalisées');
  });

  it('utilise la position consentie directement depuis la fiche de l’étoile', async () => {
    installGeolocation(geolocationResolving(position(43.296_482, 5.369_78)));
    const fixture = createFixture(sirius(), universeTime('2026-01-15T22:00:00Z'));

    fixture.detectChanges();
    const menu = fixture.nativeElement.querySelector(
      '.location-picker details',
    ) as HTMLDetailsElement;

    menu.open = true;
    (
      fixture.nativeElement.querySelector(
        '.location-picker .earth-observer-picker__geolocation',
      ) as HTMLButtonElement
    ).click();
    await fixture.whenStable();
    fixture.detectChanges();

    expect(
      (fixture.componentInstance as unknown as StellarObservationAccess).selectedLocation(),
    ).toMatchObject({
      id: 'coordinates-43.296000-5.370000',
      name: 'Ma position',
      latitude: 43.296,
      longitude: 5.37,
    });
    expect(TestBed.inject(EarthObserverSelection).location()).toMatchObject({
      id: 'coordinates-43.296000-5.370000',
      name: 'Ma position',
    });
    expect(fixture.nativeElement.textContent).toContain('Ma position');
    expect(fixture.nativeElement.textContent).toContain(
      'Position utilisée · coordonnées arrondies à environ 100 m',
    );

    fixture.destroy();
    const restoredFixture = createFixture(sirius(), universeTime('2026-01-15T22:00:00Z'));

    restoredFixture.detectChanges();
    expect(
      (restoredFixture.componentInstance as unknown as StellarObservationAccess).selectedLocation(),
    ).toMatchObject({
      id: 'coordinates-43.296000-5.370000',
      name: 'Ma position',
    });
    expect(restoredFixture.nativeElement.textContent).toContain('Ma position');
  });

  it('distingue une étoile sous l’horizon', () => {
    const fixture = createFixture(sirius(), universeTime('2026-07-15T22:00:00Z'));

    fixture.detectChanges();

    expect(fixture.nativeElement.textContent).toContain('Sous l’horizon');
    expect(fixture.nativeElement.textContent).toContain('Nord-ouest');
    expect(fixture.nativeElement.querySelector('.horizon-indicator--below')).not.toBeNull();
  });

  it('valide des coordonnées personnalisées et expose leur persistance partageable', () => {
    const fixture = createFixture(sirius(), universeTime('2026-01-15T22:00:00Z'));
    const component = fixture.componentInstance as unknown as StellarObservationAccess;

    component.changeLocation('custom');
    fixture.detectChanges();
    expect(fixture.nativeElement.textContent).toContain('Renseignez une latitude et une longitude');
    expect(component.observation()).toBeNull();
    expect(TestBed.inject(EarthObserverSelection).location()).toBeNull();

    component.changeCustomLatitude(inputEvent('nord'));
    component.changeCustomLongitude(inputEvent('2'));
    fixture.detectChanges();
    expect(fixture.nativeElement.textContent).toContain('coordonnées décimales valides');

    component.changeCustomLatitude(inputEvent('91'));
    fixture.detectChanges();
    expect(fixture.nativeElement.textContent).toContain('latitude doit être comprise');

    component.changeCustomLatitude(inputEvent('48'));
    component.changeCustomLongitude(inputEvent('181'));
    fixture.detectChanges();
    expect(fixture.nativeElement.textContent).toContain('longitude doit être comprise');

    component.changeCustomLatitude(inputEvent('51.5074'));
    component.changeCustomLongitude(inputEvent('-0.1278'));
    fixture.detectChanges();

    expect(component.selectedLocation()).toMatchObject({ latitude: 51.5074, longitude: -0.1278 });
    expect(fixture.nativeElement.textContent).toContain('Coordonnées personnalisées');
    expect(fixture.nativeElement.textContent).toContain(
      'l’observateur actif est conservé dans l’URL partageable',
    );
  });

  it('explique une date hors domaine et une étoile sans coordonnées équatoriales', () => {
    const unsupported = createFixture(sirius(), {
      julianDay: ASTRONOMY_ENGINE_MAX_JULIAN_DAY + 1,
    });

    unsupported.detectChanges();
    expect(unsupported.nativeElement.textContent).toContain('Date hors du domaine de calcul');

    const missing = createFixture(
      { ...sirius(), metadata: {} },
      universeTime('2026-01-15T22:00:00Z'),
    );

    missing.detectChanges();
    expect(missing.nativeElement.textContent).toContain('Coordonnées équatoriales indisponibles');
    expect(
      equatorialCoordinates({ ...sirius(), metadata: { rightAscensionDegrees: 1 } }),
    ).toBeNull();
    expect(equatorialCoordinates({ ...sirius(), metadata: { declinationDegrees: 1 } })).toBeNull();
    expect(
      equatorialCoordinates({
        ...sirius(),
        metadata: {
          rightAscensionDegrees: 1,
          declinationDegrees: 1,
          skyCoordinateEpoch: 'B1950',
        },
      }),
    ).toBeNull();
  });
});

interface StellarObservationAccess {
  selectedLocation(): { readonly id: string } | null;
  observation(): { readonly azimuthDegrees: number } | null;
  changeLocation(locationId: string): void;
  changeCustomLatitude(event: Event): void;
  changeCustomLongitude(event: Event): void;
}

function createFixture(object: SpaceObject, time: UniverseTime) {
  const fixture = TestBed.createComponent(StellarObservationComponent);

  fixture.componentRef.setInput('object', object);
  fixture.componentRef.setInput('time', time);

  return fixture;
}

function sirius(): SpaceObject {
  return {
    id: 'sirius',
    name: 'Sirius',
    type: 'star',
    parentId: 'milky-way',
    referenceFrame: 'stellar',
    scientificConfidence: 'observed',
    visual: { visualRadius: 1, scaleMode: 'adaptive' },
    positionProvider: { type: 'static', position: [1, 2, 3], unit: 'parsec' },
    metadata: {
      rightAscensionDegrees: 101.287_161_3,
      declinationDegrees: -16.716_122,
      skyCoordinateEpoch: 'J2000',
      properMotionApplied: false,
    },
  };
}

function universeTime(iso: string): UniverseTime {
  return { julianDay: dateToJulianDay(new Date(iso)) };
}

function inputEvent(value: string): Event {
  return { target: { value } } as unknown as Event;
}

function installGeolocation(geolocation: Geolocation): void {
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

function geolocationResolving(positionResult: GeolocationPosition): Geolocation {
  return {
    getCurrentPosition: (success: PositionCallback) => success(positionResult),
  } as Geolocation;
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
