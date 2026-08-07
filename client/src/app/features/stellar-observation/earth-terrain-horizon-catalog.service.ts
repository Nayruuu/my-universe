import { inject, Injectable, InjectionToken, isDevMode } from '@angular/core';
import type { EarthObserverLocation } from '../../../engine/simulation/earth-observer-location';
import {
  EarthTerrainHorizonCatalog,
  loadEarthTerrainHorizonCatalog,
} from './earth-terrain-horizon-catalog';
import type { EarthTerrainHorizonProfile } from './earth-terrain-horizon-catalog.types';

type EarthTerrainHorizonCatalogLoader = () => Promise<EarthTerrainHorizonCatalog>;

export type EarthTerrainHorizonErrorReporter = (error: unknown) => void;

export function createDefaultEarthTerrainHorizonCatalogLoader(): EarthTerrainHorizonCatalogLoader {
  return loadEarthTerrainHorizonCatalog;
}

export function createDefaultEarthTerrainHorizonErrorReporter(
  development = isDevMode(),
): EarthTerrainHorizonErrorReporter {
  return development
    ? (error: unknown) => console.warn('[Universe Map] Terrain horizon unavailable', error)
    : () => undefined;
}

export const EARTH_TERRAIN_HORIZON_CATALOG_LOADER =
  new InjectionToken<EarthTerrainHorizonCatalogLoader>('Earth terrain horizon catalog loader', {
    providedIn: 'root',
    factory: createDefaultEarthTerrainHorizonCatalogLoader,
  });

export const EARTH_TERRAIN_HORIZON_ERROR_REPORTER =
  new InjectionToken<EarthTerrainHorizonErrorReporter>('Earth terrain horizon error reporter', {
    providedIn: 'root',
    factory: createDefaultEarthTerrainHorizonErrorReporter,
  });

@Injectable({ providedIn: 'root' })
export class EarthTerrainHorizonCatalogService {
  private readonly catalogLoader = inject(EARTH_TERRAIN_HORIZON_CATALOG_LOADER);
  private readonly errorReporter = inject(EARTH_TERRAIN_HORIZON_ERROR_REPORTER);
  private catalogPromise: Promise<EarthTerrainHorizonCatalog> | null = null;

  public async load(location: EarthObserverLocation): Promise<EarthTerrainHorizonProfile | null> {
    if (location.id.startsWith('coordinates-')) {
      return null;
    }

    try {
      return (await this.catalog()).profile(location);
    } catch (error: unknown) {
      this.errorReporter(error);

      return null;
    }
  }

  private catalog(): Promise<EarthTerrainHorizonCatalog> {
    this.catalogPromise ??= this.catalogLoader().catch((error: unknown) => {
      this.catalogPromise = null;
      throw error;
    });

    return this.catalogPromise;
  }
}
