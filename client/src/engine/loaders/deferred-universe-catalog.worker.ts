/// <reference lib="webworker" />

import { handleDeferredUniverseCatalogWorkerRequest } from './deferred-universe-catalog-worker-handler';
import {
  deferredUniverseCatalogTransferables,
  type DeferredUniverseCatalogWorkerRequest,
} from './deferred-universe-catalog-worker-protocol';

self.onmessage = (event: MessageEvent<DeferredUniverseCatalogWorkerRequest>) => {
  void respond(event.data);
};

async function respond(request: DeferredUniverseCatalogWorkerRequest): Promise<void> {
  const response = await handleDeferredUniverseCatalogWorkerRequest(request);

  if (response.type === 'deferred-universe-catalogs-loaded') {
    self.postMessage(response, deferredUniverseCatalogTransferables(response.catalogs));

    return;
  }
  self.postMessage(response);
}
