import type { CosmicGroupCatalog } from './cosmic-group-catalog';
import type { CosmicStructureCatalog } from './cosmic-structure-catalog';
import type { CosmicWebVolume } from './cosmic-web-volume';
import type {
  DeferredCatalogDatasets,
  LoadedDeferredUniverseCatalogs,
} from './deferred-universe-catalog-load';
import type { ExoplanetCatalog } from './exoplanet-catalog';

export interface DeferredUniverseCatalogWorkerRequest {
  readonly type: 'load-deferred-universe-catalogs';
  readonly datasets: DeferredCatalogDatasets;
}

export type DeferredUniverseCatalogWorkerResponse =
  | {
      readonly type: 'deferred-universe-catalogs-loaded';
      readonly catalogs: LoadedDeferredUniverseCatalogs;
    }
  | {
      readonly type: 'deferred-universe-catalogs-error';
      readonly message: string;
    };

export function deferredUniverseCatalogTransferables(
  catalogs: LoadedDeferredUniverseCatalogs,
): ArrayBuffer[] {
  return [
    ...cosmicGroupTransferables(catalogs.cosmicGroupCatalog),
    ...cosmicStructureTransferables(catalogs.cosmicStructureCatalog),
    ...cosmicWebVolumeTransferables(catalogs.cosmicWebVolume),
    ...exoplanetTransferables(catalogs.exoplanetCatalog),
  ];
}

function cosmicGroupTransferables(catalog: CosmicGroupCatalog | null): ArrayBuffer[] {
  return catalog
    ? transferableBuffers(
        catalog.positionsMpc,
        catalog.distancesMpc,
        catalog.distanceModulusErrors,
        catalog.velocitiesCmbKmPerSecond,
        catalog.pgcIds,
        catalog.distanceModuli,
        catalog.filamentPairs,
      )
    : [];
}

function cosmicStructureTransferables(catalog: CosmicStructureCatalog | null): ArrayBuffer[] {
  return catalog
    ? transferableBuffers(
        catalog.positionsMpc,
        catalog.distancesMpc,
        catalog.radiiMpc,
        catalog.confidences,
        catalog.densityContrasts,
        catalog.boundaryDistancesMpc,
        catalog.galaxyCounts,
        catalog.sourceIndices,
        catalog.catalogNumericIds,
        catalog.flags,
      )
    : [];
}

function cosmicWebVolumeTransferables(volume: CosmicWebVolume | null): ArrayBuffer[] {
  return volume ? transferableBuffers(volume.density) : [];
}

function exoplanetTransferables(catalog: ExoplanetCatalog | null): ArrayBuffer[] {
  return catalog
    ? transferableBuffers(
        catalog.hostFirstPlanetIndices,
        catalog.hostPlanetCounts,
        catalog.hostStarCounts,
        catalog.hostCircumbinaryFlags,
        catalog.hostRightAscensionDegrees,
        catalog.hostDeclinationDegrees,
        catalog.hostDistancesParsec,
        catalog.hostTemperaturesKelvin,
        catalog.hostRadiiSolar,
        catalog.hostMassesSolar,
        catalog.hostApparentMagnitudes,
        catalog.planetHostIndices,
        catalog.planetOrbitalPeriodsDays,
        catalog.planetSemiMajorAxesAu,
        catalog.planetRadiiEarth,
        catalog.planetMassesEarth,
        catalog.planetEquilibriumTemperaturesKelvin,
        catalog.planetEccentricities,
        catalog.planetInclinationsDegrees,
        catalog.planetInsolationsEarth,
        catalog.planetDiscoveryYears,
        catalog.planetControversialFlags,
      )
    : [];
}

function transferableBuffers(...views: readonly ArrayBufferView[]): ArrayBuffer[] {
  return views.flatMap((view) => (view.buffer instanceof ArrayBuffer ? [view.buffer] : []));
}
