import { type TempelFilamentSpineSource } from '../../data/models/universe.models';
import { type TempelFilamentSpineCatalogLoadResult } from './tempel-filament-spine-catalog';
import { prepareTempelFilamentSpineRenderData } from './tempel-filament-spine-render-data';
import {
  TEMPEL_FILAMENT_SCENE_UNITS_PER_MPC,
  type TempelFilamentSpineWorkerRequest,
  type TempelFilamentSpineWorkerResponse,
} from './tempel-filament-spine-worker-protocol';

export type TempelFilamentSpineCatalogLoader = (
  source: TempelFilamentSpineSource,
) => Promise<TempelFilamentSpineCatalogLoadResult>;

export async function handleTempelFilamentSpineWorkerRequest(
  request: TempelFilamentSpineWorkerRequest,
  loadCatalog: TempelFilamentSpineCatalogLoader,
): Promise<TempelFilamentSpineWorkerResponse> {
  try {
    const result = await loadCatalog(request.source);

    return {
      type: 'tempel-filament-spines-loaded',
      catalog: {
        ...result.catalog,
        renderData: prepareTempelFilamentSpineRenderData(
          result.catalog,
          TEMPEL_FILAMENT_SCENE_UNITS_PER_MPC,
        ),
      },
      metrics: result.metrics,
    };
  } catch (error) {
    return {
      type: 'tempel-filament-spines-error',
      message: error instanceof Error ? error.message : 'erreur inconnue',
    };
  }
}
