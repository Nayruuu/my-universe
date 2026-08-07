import { inject, Injectable, signal, type WritableSignal } from '@angular/core';
import {
  DEFAULT_EARTH_OBSERVER_LOCATION,
  EARTH_OBSERVER_LOCATIONS,
  parseEarthObserverCoordinates,
  type EarthObserverLocation,
} from '../../../engine/simulation/earth-observer-location';
import { NavigationPresentationState } from '../../core/url/navigation-presentation-state';

const COORDINATE_LOCATION_ID = /^coordinates-(-?\d+(?:\.\d+)?)-(-?\d+(?:\.\d+)?)$/u;

@Injectable({ providedIn: 'root' })
export class EarthObserverSelection {
  public readonly location: WritableSignal<EarthObserverLocation | null>;

  private readonly navigation = inject(NavigationPresentationState);

  constructor() {
    this.location = signal(resolveEarthObserverLocation(this.navigation.observerLocationId()));
  }

  public setLocation(location: EarthObserverLocation | null): void {
    this.location.set(location);
    this.navigation.setObserverLocationId(location?.id ?? null);
  }

  public synchronizeNavigation(): void {
    this.navigation.setObserverLocationId(this.location()?.id ?? null);
  }
}

export function resolveEarthObserverLocation(locationId: string | null): EarthObserverLocation {
  const catalogLocation = EARTH_OBSERVER_LOCATIONS.find(({ id }) => id === locationId);

  if (catalogLocation) {
    return catalogLocation;
  }
  const coordinates = locationId ? COORDINATE_LOCATION_ID.exec(locationId) : null;
  const parsed = coordinates
    ? parseEarthObserverCoordinates(coordinates[1]!, coordinates[2]!)
    : null;

  return parsed?.location ?? DEFAULT_EARTH_OBSERVER_LOCATION;
}
