import {
  ChangeDetectionStrategy,
  Component,
  computed,
  inject,
  input,
  output,
  signal,
} from '@angular/core';
import {
  EARTH_OBSERVER_LOCATIONS,
  type EarthObserverLocation,
} from '../../../engine/simulation/earth-observer-location';
import { I18nService } from '../../core/i18n/i18n.service';
import {
  earthObserverLocationLabel,
  suggestEarthObserverLocations,
} from './earth-observer-location-search';

const DEFAULT_RESULT_LIMIT = 32;
const SEARCH_RESULT_LIMIT = 80;

@Component({
  selector: 'app-earth-observer-location-picker',
  styleUrl: './earth-observer-location-picker.component.scss',
  templateUrl: './earth-observer-location-picker.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class EarthObserverLocationPickerComponent {
  public readonly locations = input<readonly EarthObserverLocation[]>(EARTH_OBSERVER_LOCATIONS);
  public readonly selectedLocationId = input.required<string>();
  public readonly label = input.required<string>();
  public readonly ariaLabel = input.required<string>();
  public readonly customLabel = input<string | null>(null);
  public readonly compact = input(false);
  public readonly locationChange = output<string>();

  protected readonly i18n = inject(I18nService);
  protected readonly query = signal('');
  protected readonly resultOptions = computed(() => {
    const query = this.query();
    const limit = query.trim().length > 0 ? SEARCH_RESULT_LIMIT : DEFAULT_RESULT_LIMIT;

    return suggestEarthObserverLocations(this.locations(), query, this.i18n.locale(), limit).map(
      (location) => ({
        location,
        label: earthObserverLocationLabel(location, this.i18n.locale()),
      }),
    );
  });
  protected readonly selectedLabel = computed(() => {
    const selected = this.locations().find(({ id }) => id === this.selectedLocationId());

    return selected
      ? earthObserverLocationLabel(selected, this.i18n.locale())
      : { primary: this.customLabel() ?? this.selectedLocationId(), secondary: '' };
  });
  protected readonly locationCount = computed(() =>
    this.i18n.interpolate(this.i18n.content().stellarObservation.locationCount, {
      count: this.locations().length,
    }),
  );

  protected changeQuery(event: Event): void {
    this.query.set((event.target as HTMLInputElement).value);
  }

  protected choose(locationId: string, menu: HTMLDetailsElement): void {
    menu.open = false;
    this.query.set('');
    this.locationChange.emit(locationId);
  }
}
