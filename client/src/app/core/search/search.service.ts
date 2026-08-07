import { DestroyRef, effect, inject, Injectable, signal } from '@angular/core';
import { SearchEntry, SpaceObject } from '../../../data/models/universe.models';
import {
  finishCatalogPreparation,
  yieldCatalogPreparation,
} from '../../../engine/core/catalog-preparation';
import { I18nService } from '../i18n/i18n.service';
import {
  DEFAULT_EXOPLANET_DISCOVERY_FILTERS,
  type ExoplanetDiscoveryFilters,
  matchesExoplanetFilters,
  prepareExoplanetDiscoveryEntries,
} from './exoplanet-discovery';
import { LocalSearchIndex } from './search-index';

export { DEFAULT_EXOPLANET_DISCOVERY_FILTERS } from './exoplanet-discovery';
export type { ExoplanetDiscoveryFilters, ExoplanetSizeFilter } from './exoplanet-discovery';

const PROGRESSIVE_INDEX_THRESHOLD = 2_000;
const SEARCH_INDEX_CHUNK_SIZE = 256;

@Injectable({ providedIn: 'root' })
export class SearchService {
  public readonly revision = signal(0);
  public readonly exoplanetCount = signal(0);

  private index = new LocalSearchIndex();
  private readonly i18n = inject(I18nService);
  private objects: readonly SpaceObject[] | null = null;
  private catalogEntries: readonly SearchEntry[] = [];
  private indexedContent: object | null = null;
  private exoplanets: readonly SearchEntry[] = [];
  private indexBuildGeneration = 0;

  constructor() {
    inject(DestroyRef).onDestroy(() => {
      this.indexBuildGeneration += 1;
    });
    effect(() => {
      const content = this.i18n.content();

      if (this.objects && content !== this.indexedContent) {
        this.rebuildIndex();
      }
    });
  }

  public setData(
    objects: readonly SpaceObject[],
    catalogEntries: readonly SearchEntry[] = [],
  ): void {
    this.objects = objects;
    this.catalogEntries = catalogEntries;
    this.rebuildIndex();
  }

  public search(query: string, limit = 8): SearchEntry[] {
    return this.index.search(query, limit);
  }

  public discoverExoplanets(
    filters: ExoplanetDiscoveryFilters = DEFAULT_EXOPLANET_DISCOVERY_FILTERS,
    limit = 12,
  ): SearchEntry[] {
    if (limit <= 0) {
      return [];
    }

    return this.exoplanets
      .filter((entry) => matchesExoplanetFilters(entry, filters))
      .slice(0, Math.floor(limit));
  }

  private rebuildIndex(): void {
    const objects = this.objects!;
    const content = this.i18n.content();
    const generation = ++this.indexBuildGeneration;
    const searchableObjects = objects.map((object) => ({
      ...object,
      aliases: [...(object.aliases ?? []), ...this.i18n.objectSearchNames(object.id)],
    }));
    const index = new LocalSearchIndex();
    const discoveries = prepareExoplanetDiscoveryEntries(objects, this.catalogEntries);

    this.indexedContent = content;
    if (searchableObjects.length + this.catalogEntries.length <= PROGRESSIVE_INDEX_THRESHOLD) {
      index.build(searchableObjects, this.catalogEntries);
      this.publishIndex(index, finishCatalogPreparation(discoveries));

      return;
    }
    void this.buildIndexProgressively(
      index,
      searchableObjects,
      this.catalogEntries,
      discoveries,
      generation,
    );
  }

  private async buildIndexProgressively(
    index: LocalSearchIndex,
    objects: readonly SpaceObject[],
    catalogEntries: readonly SearchEntry[],
    discoveries: Generator<void, readonly SearchEntry[]>,
    generation: number,
  ): Promise<void> {
    const installed = await index.buildProgressively(objects, catalogEntries, {
      chunkSize: SEARCH_INDEX_CHUNK_SIZE,
      isCurrent: () => generation === this.indexBuildGeneration,
      yieldControl: yieldCatalogPreparation,
    });

    if (!installed || generation !== this.indexBuildGeneration) {
      return;
    }
    let step = discoveries.next();

    while (!step.done) {
      await yieldCatalogPreparation();
      if (generation !== this.indexBuildGeneration) {
        return;
      }
      step = discoveries.next();
    }

    this.publishIndex(index, step.value);
  }

  private publishIndex(index: LocalSearchIndex, exoplanets: readonly SearchEntry[]): void {
    // Readers keep the previous complete search/discovery pair until both replacements are ready.
    this.index = index;
    this.exoplanets = exoplanets;
    this.exoplanetCount.set(exoplanets.length);
    this.revision.update((revision) => revision + 1);
  }
}
