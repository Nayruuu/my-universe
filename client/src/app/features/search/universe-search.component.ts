import {
  ChangeDetectionStrategy,
  Component,
  computed,
  inject,
  input,
  output,
  signal,
} from '@angular/core';
import { SearchEntry, SpaceObjectType } from '../../../data/models/universe.models';
import { UniverseEngineFacade } from '../../core/engine/universe-engine.facade';
import { I18nService } from '../../core/i18n/i18n.service';
import {
  DEFAULT_EXOPLANET_DISCOVERY_FILTERS,
  ExoplanetSizeFilter,
  SearchService,
} from '../../core/search/search.service';

@Component({
  selector: 'app-universe-search',
  styleUrl: './universe-search.component.scss',
  templateUrl: './universe-search.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class UniverseSearchComponent {
  public readonly selectionMode = input<'navigate' | 'emit'>('navigate');
  public readonly allowedTypes = input<readonly SpaceObjectType[] | null>(null);
  public readonly excludedIds = input<readonly string[]>([]);
  public readonly embedded = input(false);
  public readonly placeholder = input<string | null>(null);
  public readonly resultSelected = output<SearchEntry>();
  protected readonly searchService = inject(SearchService);
  protected readonly facade = inject(UniverseEngineFacade);
  protected readonly i18n = inject(I18nService);
  protected readonly query = signal('');
  protected readonly active = signal(false);
  protected readonly explorerOpen = signal(false);
  protected readonly distanceFilter = signal<number | null>(
    DEFAULT_EXOPLANET_DISCOVERY_FILTERS.maxDistanceParsec,
  );
  protected readonly sizeFilter = signal<ExoplanetSizeFilter>(
    DEFAULT_EXOPLANET_DISCOVERY_FILTERS.size,
  );
  protected readonly methodFilter = signal(DEFAULT_EXOPLANET_DISCOVERY_FILTERS.discoveryMethod);
  protected readonly temperateOnly = signal(DEFAULT_EXOPLANET_DISCOVERY_FILTERS.temperateOnly);
  protected readonly exoplanetCount = this.searchService.exoplanetCount;
  protected readonly results = computed(() => {
    this.searchService.revision();
    const allowedTypes = this.allowedTypes();
    const excludedIds = new Set(this.excludedIds());
    const entries = allowedTypes
      ? this.searchService.search(this.query(), 32)
      : this.searchService.search(this.query());

    return entries
      .filter(
        (entry) =>
          (allowedTypes === null || allowedTypes.includes(entry.type)) &&
          !excludedIds.has(entry.id),
      )
      .slice(0, 8);
  });
  protected readonly searchPlaceholder = computed(
    () => this.placeholder() ?? this.i18n.content().search.placeholder,
  );
  protected readonly catalogExplorerAvailable = computed(() => this.allowedTypes() === null);
  protected readonly discoveryResults = computed(() => {
    this.searchService.revision();

    return this.searchService.discoverExoplanets(
      {
        maxDistanceParsec: this.distanceFilter(),
        size: this.sizeFilter(),
        discoveryMethod: this.methodFilter(),
        temperateOnly: this.temperateOnly(),
      },
      12,
    );
  });

  protected updateQuery(event: Event): void {
    this.query.set((event.target as HTMLInputElement).value);
    this.active.set(true);
    this.explorerOpen.set(false);
  }

  protected choose(result: SearchEntry): void {
    this.query.set('');
    this.active.set(false);
    this.explorerOpen.set(false);
    this.resultSelected.emit(result);
    if (this.selectionMode() === 'navigate') {
      void this.facade.focus(result.id);
    }
  }

  protected clear(): void {
    this.query.set('');
  }

  protected toggleExplorer(): void {
    this.query.set('');
    this.active.set(false);
    this.explorerOpen.update((open) => !open);
  }

  protected updateDistanceFilter(event: Event): void {
    const value = (event.target as HTMLSelectElement).value;

    this.distanceFilter.set(value === 'all' ? null : Number(value));
  }

  protected updateSizeFilter(event: Event): void {
    const value = (event.target as HTMLSelectElement).value;

    if (isExoplanetSizeFilter(value)) {
      this.sizeFilter.set(value);
    }
  }

  protected updateMethodFilter(event: Event): void {
    this.methodFilter.set((event.target as HTMLSelectElement).value);
  }

  protected toggleTemperateOnly(): void {
    this.temperateOnly.update((active) => !active);
  }

  protected formatCount(value: number): string {
    return this.i18n.formatNumber(value, 0);
  }

  protected discoveryDistance(result: SearchEntry): string {
    const distance = result.metadata?.['distanceParsec'];

    return typeof distance === 'number'
      ? `${this.i18n.formatNumber(distance, 1)} pc`
      : this.i18n.content().search.distanceUnknown;
  }

  protected discoveryRadius(result: SearchEntry): string | null {
    const radius = result.metadata?.['radiusEarth'];

    return typeof radius === 'number' ? `${this.i18n.formatNumber(radius, 2)} R⊕` : null;
  }

  protected typeLabel(type: SpaceObjectType, keywords?: readonly string[]): string {
    if (type === 'region' && keywords?.includes('constellation')) {
      return this.i18n.content().objectTypes.constellation;
    }
    const labels = this.i18n.content().objectTypes as Readonly<
      Record<SpaceObjectType | 'default' | 'constellation', string>
    >;

    return labels[type] ?? labels.default;
  }

  protected displayName(result: SearchEntry): string {
    return this.i18n.objectName(result.id, result.name);
  }

  protected parentName(result: SearchEntry): string {
    return result.parentName
      ? this.i18n.localizeKnownObjectName(result.parentName)
      : this.i18n.content().common.universe;
  }
}

function isExoplanetSizeFilter(value: string): value is ExoplanetSizeFilter {
  return ['all', 'earth-sized', 'super-earth', 'neptune-sized', 'giant'].includes(value);
}
