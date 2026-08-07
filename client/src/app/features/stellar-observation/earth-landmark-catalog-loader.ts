import {
  EarthLandmarkCatalogError,
  type EarthLandmarkCatalogFetcher,
  type EarthLandmarkDefinition,
  type EarthLandmarkManifest,
  type EarthLandmarkPack,
} from './earth-landmark-catalog.types';
import {
  parseEarthLandmarkManifest,
  parseEarthLandmarkPack,
} from './earth-landmark-catalog-validation';

const DEFAULT_MANIFEST_URL = '/data/earth-landmarks/manifest.json';
const DEFAULT_FETCHER: EarthLandmarkCatalogFetcher = (url) => globalThis.fetch(url);

export class EarthLandmarkCatalog {
  private cacheGeneration = 0;
  private readonly loadedPacks = new Map<string, EarthLandmarkPack>();
  private readonly pendingPacks = new Map<string, Promise<EarthLandmarkPack>>();

  constructor(
    private readonly manifest: EarthLandmarkManifest,
    private readonly fetcher: EarthLandmarkCatalogFetcher,
  ) {}

  public get cachedPackCount(): number {
    return this.loadedPacks.size;
  }

  public get indexedLocationCount(): number {
    return this.manifest.locationCount;
  }

  public hasLocation(locationId: string): boolean {
    return this.manifest.locationRegionById.has(locationId);
  }

  public getCachedLandmarks(locationId: string): readonly EarthLandmarkDefinition[] | undefined {
    const regionId = this.manifest.locationRegionById.get(locationId);

    if (!regionId) {
      return undefined;
    }

    return this.loadedPacks.get(regionId)?.get(locationId);
  }

  public async load(locationId: string): Promise<readonly EarthLandmarkDefinition[]> {
    const regionId = this.manifest.locationRegionById.get(locationId);

    if (!regionId) {
      return [];
    }
    const pack = await this.loadRegion(regionId);

    return pack.get(locationId)!;
  }

  public async preloadRegion(regionId: string): Promise<void> {
    await this.loadRegion(regionId);
  }

  public clearCache(): void {
    this.cacheGeneration += 1;
    this.loadedPacks.clear();
    this.pendingPacks.clear();
  }

  private loadRegion(regionId: string): Promise<EarthLandmarkPack> {
    const loadedPack = this.loadedPacks.get(regionId);

    if (loadedPack) {
      return Promise.resolve(loadedPack);
    }
    const pendingPack = this.pendingPacks.get(regionId);

    if (pendingPack) {
      return pendingPack;
    }
    const url = this.manifest.packUrlByRegion.get(regionId);

    if (!url) {
      return Promise.reject(
        new EarthLandmarkCatalogError(
          'unknown-region',
          `Earth landmark region ${regionId} is not indexed.`,
          { regionId },
        ),
      );
    }
    const request = this.fetchPack(regionId, url, this.cacheGeneration);

    this.pendingPacks.set(regionId, request);

    return request;
  }

  private async fetchPack(
    regionId: string,
    url: string,
    cacheGeneration: number,
  ): Promise<EarthLandmarkPack> {
    let response: Response;

    try {
      response = await this.fetcher(url);
    } catch (cause) {
      this.clearPendingPack(regionId, cacheGeneration);
      throw new EarthLandmarkCatalogError(
        'pack-unavailable',
        `Unable to request Earth landmark pack ${regionId}.`,
        { cause, regionId, url },
      );
    }
    if (!response.ok) {
      this.clearPendingPack(regionId, cacheGeneration);
      throw new EarthLandmarkCatalogError(
        'pack-unavailable',
        `Unable to load Earth landmark pack ${regionId} (${response.status}).`,
        { regionId, status: response.status, url },
      );
    }
    let value: unknown;

    try {
      value = await response.json();
      const pack = parseEarthLandmarkPack(
        value,
        regionId,
        this.manifest.locationIdsByRegion.get(regionId)!,
      );

      if (cacheGeneration === this.cacheGeneration) {
        this.loadedPacks.set(regionId, pack);
        this.pendingPacks.delete(regionId);
      }

      return pack;
    } catch (cause) {
      this.clearPendingPack(regionId, cacheGeneration);
      throw new EarthLandmarkCatalogError(
        'pack-invalid',
        `Earth landmark pack ${regionId} is invalid.`,
        { cause, regionId, url },
      );
    }
  }

  private clearPendingPack(regionId: string, cacheGeneration: number): void {
    if (cacheGeneration === this.cacheGeneration) {
      this.pendingPacks.delete(regionId);
    }
  }
}

export async function loadEarthLandmarkCatalog(
  manifestUrl = DEFAULT_MANIFEST_URL,
  fetcher: EarthLandmarkCatalogFetcher = DEFAULT_FETCHER,
): Promise<EarthLandmarkCatalog> {
  let response: Response;

  try {
    response = await fetcher(manifestUrl);
  } catch (cause) {
    throw new EarthLandmarkCatalogError(
      'manifest-unavailable',
      'Unable to request the Earth landmark manifest.',
      { cause, url: manifestUrl },
    );
  }
  if (!response.ok) {
    throw new EarthLandmarkCatalogError(
      'manifest-unavailable',
      `Unable to load the Earth landmark manifest (${response.status}).`,
      { status: response.status, url: manifestUrl },
    );
  }
  try {
    const manifest = parseEarthLandmarkManifest(await response.json());

    return new EarthLandmarkCatalog(manifest, fetcher);
  } catch (cause) {
    throw new EarthLandmarkCatalogError(
      'manifest-invalid',
      'The Earth landmark manifest is invalid.',
      { cause, url: manifestUrl },
    );
  }
}
