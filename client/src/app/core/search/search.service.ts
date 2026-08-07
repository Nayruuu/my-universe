import { effect, inject, Injectable, signal } from '@angular/core';
import { SearchEntry, SpaceObject } from '../../../data/models/universe.models';
import { I18nService } from '../i18n/i18n.service';
import { LocalSearchIndex } from './search-index';

const LIGHT_YEARS_PER_PARSEC = 3.261_563_777;
const TEMPERATE_MINIMUM_KELVIN = 180;
const TEMPERATE_MAXIMUM_KELVIN = 320;
const TEMPERATE_MAXIMUM_RADIUS_EARTH = 2.5;
const PROGRESSIVE_INDEX_THRESHOLD = 2_000;
const SEARCH_INDEX_CHUNK_SIZE = 256;

export type ExoplanetSizeFilter = 'all' | 'earth-sized' | 'super-earth' | 'neptune-sized' | 'giant';

export interface ExoplanetDiscoveryFilters {
  readonly maxDistanceParsec: number | null;
  readonly size: ExoplanetSizeFilter;
  readonly discoveryMethod: string | 'all';
  readonly temperateOnly: boolean;
}

export const DEFAULT_EXOPLANET_DISCOVERY_FILTERS: ExoplanetDiscoveryFilters = {
  maxDistanceParsec: null,
  size: 'all',
  discoveryMethod: 'all',
  temperateOnly: false,
};

@Injectable({ providedIn: 'root' })
export class SearchService {
  public readonly revision = signal(0);
  public readonly exoplanetCount = signal(0);

  private readonly index = new LocalSearchIndex();
  private readonly i18n = inject(I18nService);
  private objects: readonly SpaceObject[] | null = null;
  private catalogEntries: readonly SearchEntry[] = [];
  private indexedContent: object | null = null;
  private exoplanets: readonly SearchEntry[] = [];
  private indexBuildGeneration = 0;

  constructor() {
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
    this.exoplanets = createExoplanetDiscoveryEntries(objects, catalogEntries);
    this.exoplanetCount.set(this.exoplanets.length);
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

    this.indexedContent = content;
    if (searchableObjects.length + this.catalogEntries.length <= PROGRESSIVE_INDEX_THRESHOLD) {
      this.index.build(searchableObjects, this.catalogEntries);
      this.publishIndexRevision();

      return;
    }
    void this.buildIndexProgressively(searchableObjects, this.catalogEntries, generation);
  }

  private async buildIndexProgressively(
    objects: readonly SpaceObject[],
    catalogEntries: readonly SearchEntry[],
    generation: number,
  ): Promise<void> {
    const installed = await this.index.buildProgressively(objects, catalogEntries, {
      chunkSize: SEARCH_INDEX_CHUNK_SIZE,
      isCurrent: () => generation === this.indexBuildGeneration,
      yieldControl: yieldToBrowser,
    });

    if (installed) {
      this.publishIndexRevision();
    }
  }

  private publishIndexRevision(): void {
    this.revision.update((revision) => revision + 1);
  }
}

function yieldToBrowser(): Promise<void> {
  return new Promise((resolve) => globalThis.setTimeout(resolve, 0));
}

function createExoplanetDiscoveryEntries(
  objects: readonly SpaceObject[],
  catalogEntries: readonly SearchEntry[],
): readonly SearchEntry[] {
  const objectNames = new Map(objects.map((object) => [object.id, object.name]));
  const entriesById = new Map<string, SearchEntry>();

  for (const object of objects) {
    if (object.type !== 'exoplanet') {
      continue;
    }
    const radiusEarth = metadataNumber(object.metadata, 'radiusEarth');
    const equilibriumTemperature = metadataNumber(object.metadata, 'equilibriumTemperatureK');
    const distanceParsec =
      metadataNumber(object.metadata, 'distancePc') ??
      divideFinite(metadataNumber(object.metadata, 'distanceLy'), LIGHT_YEARS_PER_PARSEC);
    const discoveryMethod = metadataString(object.metadata, 'detectionMethod') ?? 'Non précisée';

    entriesById.set(object.id, {
      id: object.id,
      name: object.name,
      aliases: object.aliases ?? [],
      type: 'exoplanet',
      parentName: object.parentId ? objectNames.get(object.parentId) : undefined,
      keywords: ['exoplanète confirmée', discoveryMethod],
      metadata: compactMetadata({
        distanceParsec,
        radiusEarth,
        discoveryMethod,
        discoveryYear: metadataNumber(object.metadata, 'discoveryYear'),
        temperateCandidate: isTemperateCandidate(radiusEarth, equilibriumTemperature),
        controversial: metadataBoolean(object.metadata, 'controversial'),
      }),
    });
  }

  for (const entry of catalogEntries) {
    if (entry.type === 'exoplanet' && !entriesById.has(entry.id)) {
      entriesById.set(entry.id, entry);
    }
  }

  return [...entriesById.values()].sort(compareExoplanetDiscoveryEntries);
}

function matchesExoplanetFilters(entry: SearchEntry, filters: ExoplanetDiscoveryFilters): boolean {
  const distance = metadataNumber(entry.metadata, 'distanceParsec');
  const radius = metadataNumber(entry.metadata, 'radiusEarth');
  const method = metadataString(entry.metadata, 'discoveryMethod');
  const temperate = metadataBoolean(entry.metadata, 'temperateCandidate') === true;

  return (
    (filters.maxDistanceParsec === null ||
      (distance !== undefined && distance <= filters.maxDistanceParsec)) &&
    matchesSize(radius, filters.size) &&
    (filters.discoveryMethod === 'all' || method === filters.discoveryMethod) &&
    (!filters.temperateOnly || temperate)
  );
}

function matchesSize(radiusEarth: number | undefined, filter: ExoplanetSizeFilter): boolean {
  if (filter === 'all') {
    return true;
  }
  if (radiusEarth === undefined) {
    return false;
  }

  switch (filter) {
    case 'earth-sized':
      return radiusEarth <= 1.5;
    case 'super-earth':
      return radiusEarth > 1.5 && radiusEarth <= 2.5;
    case 'neptune-sized':
      return radiusEarth > 2.5 && radiusEarth <= 6;
    case 'giant':
      return radiusEarth > 6;
  }
}

function compareExoplanetDiscoveryEntries(left: SearchEntry, right: SearchEntry): number {
  const leftDistance = metadataNumber(left.metadata, 'distanceParsec') ?? Number.POSITIVE_INFINITY;
  const rightDistance =
    metadataNumber(right.metadata, 'distanceParsec') ?? Number.POSITIVE_INFINITY;

  return leftDistance - rightDistance || left.name.localeCompare(right.name);
}

function isTemperateCandidate(
  radiusEarth: number | undefined,
  temperatureKelvin: number | undefined,
): boolean {
  return (
    radiusEarth !== undefined &&
    temperatureKelvin !== undefined &&
    radiusEarth <= TEMPERATE_MAXIMUM_RADIUS_EARTH &&
    temperatureKelvin >= TEMPERATE_MINIMUM_KELVIN &&
    temperatureKelvin <= TEMPERATE_MAXIMUM_KELVIN
  );
}

function metadataNumber(
  metadata: Readonly<Record<string, string | number | boolean>> | undefined,
  key: string,
): number | undefined {
  const value = metadata?.[key];

  return typeof value === 'number' && Number.isFinite(value) ? value : undefined;
}

function metadataString(
  metadata: Readonly<Record<string, string | number | boolean>> | undefined,
  key: string,
): string | undefined {
  const value = metadata?.[key];

  return typeof value === 'string' && value ? value : undefined;
}

function metadataBoolean(
  metadata: Readonly<Record<string, string | number | boolean>> | undefined,
  key: string,
): boolean | undefined {
  const value = metadata?.[key];

  return typeof value === 'boolean' ? value : undefined;
}

function divideFinite(value: number | undefined, divisor: number): number | undefined {
  return value === undefined ? undefined : value / divisor;
}

function compactMetadata(
  metadata: Record<string, string | number | boolean | undefined>,
): Readonly<Record<string, string | number | boolean>> {
  return Object.fromEntries(
    Object.entries(metadata).filter(([, value]) => value !== undefined),
  ) as Record<string, string | number | boolean>;
}
