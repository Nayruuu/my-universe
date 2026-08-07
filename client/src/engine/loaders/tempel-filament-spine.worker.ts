/// <reference lib="webworker" />

import { loadTempelFilamentSpineCatalogWithMetrics } from './tempel-filament-spine-catalog';
import { handleTempelFilamentSpineWorkerRequest } from './tempel-filament-spine-worker-handler';
import {
  tempelFilamentSpineCatalogTransferables,
  type TempelFilamentSpineWorkerRequest,
} from './tempel-filament-spine-worker-protocol';

self.onmessage = (event: MessageEvent<TempelFilamentSpineWorkerRequest>) => {
  void respond(event.data);
};

async function respond(request: TempelFilamentSpineWorkerRequest): Promise<void> {
  const response = await handleTempelFilamentSpineWorkerRequest(
    request,
    loadTempelFilamentSpineCatalogWithMetrics,
  );

  if (response.type === 'tempel-filament-spines-loaded') {
    self.postMessage(response, tempelFilamentSpineCatalogTransferables(response.catalog));

    return;
  }
  self.postMessage(response);
}
