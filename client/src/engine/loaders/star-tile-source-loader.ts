import {
  type StarClusterTilePack,
  type StarTileIndex,
  type StarTileSource,
} from '../../data/models/universe.models';
import {
  parseStarClusterTilePack,
  parseStarTileIndex,
} from '../../data/validation/star-tile-index';

export interface StarTilePackSource {
  readonly id: string;
  readonly url: string;
}

export type StarTileSourceFetcher = (url: string) => Promise<Response>;

export async function loadStarTileIndexSource(
  source: StarTileSource,
  fetcher: StarTileSourceFetcher = (url) => fetch(url),
): Promise<StarTileIndex> {
  const response = await fetcher(source.url);

  if (!response.ok) {
    throw new Error(`Impossible de charger l’index stellaire ${source.id} (${response.status}).`);
  }
  const index = parseStarTileIndex(await response.json(), source.id);

  if (index.sourceCatalog !== source.sourceCatalogId) {
    throw new Error(`Index stellaire associé au mauvais catalogue : ${index.sourceCatalog}.`);
  }

  return index;
}

export async function loadStarClusterTilePackSource(
  source: StarTilePackSource,
  fetcher: StarTileSourceFetcher = (url) => fetch(url),
): Promise<StarClusterTilePack> {
  const response = await fetcher(source.url);

  if (!response.ok) {
    throw new Error(`Impossible de charger le paquet de tuiles stellaires (${response.status}).`);
  }

  return parseStarClusterTilePack(await response.json(), source.id);
}
