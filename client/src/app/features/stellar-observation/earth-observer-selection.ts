import { Injectable, signal } from '@angular/core';
import {
  DEFAULT_EARTH_OBSERVER_LOCATION,
  type EarthObserverLocation,
} from '../../../engine/simulation/earth-observer-location';

@Injectable({ providedIn: 'root' })
export class EarthObserverSelection {
  public readonly location = signal<EarthObserverLocation | null>(DEFAULT_EARTH_OBSERVER_LOCATION);

  public setLocation(location: EarthObserverLocation | null): void {
    this.location.set(location);
  }
}
