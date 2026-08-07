import { inject, Injectable, InjectionToken, isDevMode } from '@angular/core';
import {
  EarthLandmarkCatalogError,
  type EarthLandmarkCatalog,
  type EarthLandmarkDefinition,
  loadEarthLandmarkCatalog,
} from './earth-landmark-catalog';

type EarthLandmarkCatalogLoader = () => Promise<EarthLandmarkCatalog>;

export type EarthLandmarkCatalogErrorReporter = (error: EarthLandmarkCatalogError) => void;

export interface EarthLandmarkCatalogLogger {
  readonly warn: (message: string, context: Readonly<Record<string, unknown>>) => void;
}

export const EARTH_LANDMARK_CATALOG_LOADER = new InjectionToken<EarthLandmarkCatalogLoader>(
  'Earth landmark catalog loader',
  { providedIn: 'root', factory: () => loadEarthLandmarkCatalog },
);

export const EARTH_LANDMARK_CATALOG_ERROR_REPORTER =
  new InjectionToken<EarthLandmarkCatalogErrorReporter>('Earth landmark catalog error reporter', {
    providedIn: 'root',
    factory: () => createEarthLandmarkCatalogErrorReporter(isDevMode()),
  });

export function createEarthLandmarkCatalogErrorReporter(
  enabled: boolean,
  logger: EarthLandmarkCatalogLogger = console,
): EarthLandmarkCatalogErrorReporter {
  if (!enabled) {
    return () => undefined;
  }

  return (error) => {
    logger.warn('[Universe Map] Earth landmark catalog warning', {
      code: error.code,
      message: error.message,
      regionId: error.regionId,
      status: error.status,
      url: error.url,
    });
  };
}

@Injectable({ providedIn: 'root' })
export class EarthLandmarkCatalogService {
  private readonly errorReporter = inject(EARTH_LANDMARK_CATALOG_ERROR_REPORTER);
  private readonly loader = inject(EARTH_LANDMARK_CATALOG_LOADER);
  private catalogPromise: Promise<EarthLandmarkCatalog> | null = null;

  public async load(locationId: string): Promise<readonly EarthLandmarkDefinition[]> {
    try {
      return await (await this.getCatalog()).load(locationId);
    } catch (error) {
      if (error instanceof EarthLandmarkCatalogError) {
        this.errorReporter(error);
      }

      throw error;
    }
  }

  private getCatalog(): Promise<EarthLandmarkCatalog> {
    this.catalogPromise ??= this.loader().catch((error: unknown) => {
      this.catalogPromise = null;
      throw error;
    });

    return this.catalogPromise;
  }
}
