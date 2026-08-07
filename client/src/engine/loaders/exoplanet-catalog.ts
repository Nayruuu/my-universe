import { invalidExoplanetCatalog, parseExoplanetCatalogHeader } from './exoplanet-catalog-format';
import { decodeExoplanetHosts, type DecodedExoplanetHosts } from './exoplanet-host-records';
import { parseExoplanetCatalogMetadata } from './exoplanet-catalog-metadata';
import { decodeExoplanetPlanets, type DecodedExoplanetPlanets } from './exoplanet-planet-records';
import { createExoplanetStringDecoder } from './exoplanet-catalog-string-table';
import type { ExoplanetCatalog, ExoplanetCatalogMetadata } from './exoplanet-catalog-types';

export {
  EXOPLANET_CATALOG_HEADER_BYTES,
  EXOPLANET_CATALOG_HOST_RECORD_BYTES,
  EXOPLANET_CATALOG_MAGIC,
  EXOPLANET_CATALOG_PLANET_RECORD_BYTES,
  EXOPLANET_CATALOG_VERSION,
} from './exoplanet-catalog-format';
export { parseExoplanetCatalogMetadata } from './exoplanet-catalog-metadata';
export type { ExoplanetCatalog, ExoplanetCatalogMetadata } from './exoplanet-catalog-types';

export function parseExoplanetCatalog(
  buffer: ArrayBuffer,
  metadata: ExoplanetCatalogMetadata,
): ExoplanetCatalog {
  const validatedMetadata = parseExoplanetCatalogMetadata(metadata, 'binaire');
  const header = parseExoplanetCatalogHeader(buffer);

  if (
    validatedMetadata.counts.hosts !== header.hostCount ||
    validatedMetadata.counts.planets !== header.planetCount
  ) {
    throw invalidExoplanetCatalog('comptage incohérent avec les métadonnées');
  }

  const strings = createExoplanetStringDecoder(
    header.view,
    header.stringTableOffset,
    header.stringTableBytes,
  );
  const hosts = decodeExoplanetHosts(header.view, header.hostCount, strings);
  const planets = decodeExoplanetPlanets(
    header.view,
    header.planetCount,
    header.planetRecordsOffset,
    header.hostCount,
    strings,
  );

  assertHostPlanetRanges(hosts, planets, header.hostCount, header.planetCount);

  return {
    hostCount: header.hostCount,
    planetCount: header.planetCount,
    ...hosts,
    ...planets,
    metadata: validatedMetadata,
  };
}

function assertHostPlanetRanges(
  hosts: DecodedExoplanetHosts,
  planets: DecodedExoplanetPlanets,
  hostCount: number,
  planetCount: number,
): void {
  let expectedStart = 0;

  for (let hostIndex = 0; hostIndex < hostCount; hostIndex += 1) {
    const start = hosts.hostFirstPlanetIndices[hostIndex]!;
    const count = hosts.hostPlanetCounts[hostIndex]!;
    const end = start + count;

    if (start !== expectedStart || end > planetCount) {
      throw invalidExoplanetCatalog(`plage planétaire invalide pour l’hôte ${hostIndex}`);
    }
    for (let planetIndex = start; planetIndex < end; planetIndex += 1) {
      if (planets.planetHostIndices[planetIndex] !== hostIndex) {
        throw invalidExoplanetCatalog(`plage planétaire invalide pour l’hôte ${hostIndex}`);
      }
    }
    expectedStart = end;
  }
  if (expectedStart !== planetCount) {
    throw invalidExoplanetCatalog('plage planétaire incomplète');
  }
}
