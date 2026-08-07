import {
  ChangeDetectionStrategy,
  Component,
  computed,
  effect,
  inject,
  input,
  signal,
} from '@angular/core';
import type { SpaceObject, UniverseTime } from '../../../data/models/universe.models';
import {
  EARTH_OBSERVER_LOCATIONS,
  parseEarthObserverCoordinates,
} from '../../../engine/simulation/earth-observer-location';
import {
  calculateStellarObservation,
  type CompassDirection,
} from '../../../engine/simulation/stellar-observation';
import { I18nService } from '../../core/i18n/i18n.service';
import { EarthObserverSelection } from './earth-observer-selection';
import { EarthObserverLocationPickerComponent } from './earth-observer-location-picker.component';
import { equatorialCoordinates } from './earth-sky-catalog';
import { LocalSkyMapComponent } from './local-sky-map.component';

const CUSTOM_LOCATION_ID = 'custom';

@Component({
  selector: 'app-stellar-observation',
  styleUrl: './stellar-observation.component.scss',
  templateUrl: './stellar-observation.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [EarthObserverLocationPickerComponent, LocalSkyMapComponent],
})
export class StellarObservationComponent {
  public readonly object = input.required<SpaceObject>();
  public readonly time = input.required<UniverseTime>();

  protected readonly i18n = inject(I18nService);
  protected readonly locations = EARTH_OBSERVER_LOCATIONS;
  protected readonly observerSelection = inject(EarthObserverSelection);
  protected readonly initialObserverLocation = this.observerSelection.location();
  protected readonly selectedLocationId = signal(this.initialLocationId());
  protected readonly customLatitudeInput = signal(this.initialCustomCoordinate('latitude'));
  protected readonly customLongitudeInput = signal(this.initialCustomCoordinate('longitude'));
  protected readonly customLocationSelected = computed(
    () => this.selectedLocationId() === CUSTOM_LOCATION_ID,
  );
  protected readonly customLocationResult = computed(() =>
    parseEarthObserverCoordinates(this.customLatitudeInput(), this.customLongitudeInput(), {
      name: this.i18n.content().eclipses.customCoordinates,
      timeZone: 'UTC',
    }),
  );
  protected readonly customLocationMessage = computed(() => {
    const text = this.i18n.content().eclipses;

    switch (this.customLocationResult().issue) {
      case null:
        return null;
      case 'missing-coordinate':
        return text.coordinatesMissing;
      case 'invalid-coordinate':
        return text.coordinatesInvalid;
      case 'latitude-out-of-range':
        return text.latitudeRange;
      case 'longitude-out-of-range':
        return text.longitudeRange;
    }
  });
  protected readonly selectedLocation = computed(() => {
    if (this.customLocationSelected()) {
      return this.customLocationResult().location;
    }

    return this.locations.find(({ id }) => id === this.selectedLocationId()) ?? this.locations[0]!;
  });
  protected readonly localizedObjectName = computed(() => {
    const object = this.object();

    return this.i18n.objectName(object.id, object.name);
  });
  protected readonly localizedTitle = computed(() =>
    this.i18n.interpolate(this.i18n.content().stellarObservation.title, {
      name: this.localizedObjectName(),
    }),
  );
  protected readonly coordinates = computed(() => equatorialCoordinates(this.object()));
  protected readonly observation = computed(() => {
    const coordinates = this.coordinates();
    const location = this.selectedLocation();

    return coordinates && location
      ? calculateStellarObservation(this.time(), coordinates, location)
      : null;
  });
  private readonly synchronizeObserverLocation = effect(() =>
    this.observerSelection.setLocation(this.selectedLocation()),
  );
  protected changeLocation(locationId: string): void {
    this.selectedLocationId.set(locationId);
  }

  protected changeCustomLatitude(event: Event): void {
    this.customLatitudeInput.set((event.target as HTMLInputElement).value);
  }

  protected changeCustomLongitude(event: Event): void {
    this.customLongitudeInput.set((event.target as HTMLInputElement).value);
  }

  protected directionLabel(direction: CompassDirection): string {
    return this.i18n.content().stellarObservation.directions[direction];
  }

  private initialLocationId(): string {
    const location = this.initialObserverLocation;

    if (!location) {
      return this.locations[0]!.id;
    }

    return this.locations.some(({ id }) => id === location.id) ? location.id : CUSTOM_LOCATION_ID;
  }

  private initialCustomCoordinate(coordinate: 'latitude' | 'longitude'): string {
    const location = this.initialObserverLocation;

    return location && !this.locations.some(({ id }) => id === location.id)
      ? String(location[coordinate])
      : '';
  }
}
