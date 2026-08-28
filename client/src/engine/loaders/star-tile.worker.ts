/// <reference lib="webworker" />

import { handleStarTileWorkerRequest } from './star-tile-worker-handler';
import {
  starClusterTilePackTransferables,
  type StarTileWorkerRequest,
} from './star-tile-worker-protocol';

self.onmessage = (event: MessageEvent<StarTileWorkerRequest>) => {
  void respond(event.data);
};

async function respond(request: StarTileWorkerRequest): Promise<void> {
  const response = await handleStarTileWorkerRequest(request);

  if (response.type === 'star-tile-pack-loaded') {
    self.postMessage(response, starClusterTilePackTransferables(response.pack));

    return;
  }
  self.postMessage(response);
}
