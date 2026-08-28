import { loadStarClusterTilePackSource, loadStarTileIndexSource } from './star-tile-source-loader';
import {
  type StarTileWorkerRequest,
  type StarTileWorkerResponse,
} from './star-tile-worker-protocol';

export type StarTileIndexLoader = typeof loadStarTileIndexSource;
export type StarTilePackLoader = typeof loadStarClusterTilePackSource;

export async function handleStarTileWorkerRequest(
  request: StarTileWorkerRequest,
  loadIndex: StarTileIndexLoader = loadStarTileIndexSource,
  loadPack: StarTilePackLoader = loadStarClusterTilePackSource,
): Promise<StarTileWorkerResponse> {
  try {
    if (request.type === 'load-star-tile-index') {
      return {
        type: 'star-tile-index-loaded',
        index: await loadIndex(request.source),
      };
    }

    return {
      type: 'star-tile-pack-loaded',
      pack: await loadPack(request.source),
    };
  } catch (error) {
    return {
      type: 'star-tile-error',
      message: error instanceof Error ? error.message : 'erreur inconnue',
    };
  }
}
