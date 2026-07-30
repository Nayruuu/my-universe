import {
  type StarClusterTile,
  type StarClusterTilePack,
  type StarTileIndex,
  type StarTileIndexNode,
  type StarTileSource,
} from '../../data/models/universe.models';
import {
  assertStarClusterTileMatchesCatalog,
  parseStarClusterTilePack,
  parseStarTileIndex,
} from '../../data/validation/star-tile-index';
import { type StarCatalogRegistry } from '../objects/star-catalog-registry';
import {
  createStarTileRenderNodes,
  selectStarTileNodeIds,
  type StarTileRenderNode,
  type StarTileView,
} from './star-tile-selection';

type StarTileFetcher = (url: string) => Promise<Response>;

interface LoadedStarTileIndex {
  readonly index: StarTileIndex;
  readonly nodesById: ReadonlyMap<string, StarTileIndexNode>;
  readonly renderNodes: readonly StarTileRenderNode[];
}

interface CachedStarTilePack {
  readonly pack: StarClusterTilePack;
  readonly tilesById: ReadonlyMap<string, StarClusterTile>;
  lastUsed: number;
}

export interface StarTileSyncResult {
  readonly changed: boolean;
  readonly tiles: readonly StarClusterTile[];
}

export class StarTileManager {
  private indexPromise: Promise<LoadedStarTileIndex> | null = null;
  private readonly cachedPacks = new Map<string, CachedStarTilePack>();
  private readonly pendingPacks = new Map<string, Promise<CachedStarTilePack>>();
  private activeNodeIds: readonly string[] = [];
  private accessSequence = 0;

  constructor(
    private readonly source: StarTileSource,
    private readonly registry: StarCatalogRegistry,
    private readonly fetcher: StarTileFetcher = (url) => fetch(url),
    private readonly cachePackLimit = 24,
  ) {}

  public get activeTileCount(): number {
    return this.activeNodeIds.length;
  }

  public get cachedPackCount(): number {
    return this.cachedPacks.size;
  }

  public get cachedTileCount(): number {
    return [...this.cachedPacks.values()].reduce(
      (total, entry) => total + entry.pack.tiles.length,
      0,
    );
  }

  public get activeClusterCount(): number {
    return this.getActiveTiles().reduce((total, tile) => total + tile.clusterCount, 0);
  }

  public get cachedClusterCount(): number {
    return [...this.cachedPacks.values()].reduce(
      (total, entry) =>
        total + entry.pack.tiles.reduce((packTotal, tile) => packTotal + tile.clusterCount, 0),
      0,
    );
  }

  public async synchronize(view: StarTileView): Promise<StarTileSyncResult> {
    if (view.lodLevel !== 3 && view.lodLevel !== 4) {
      const changed = this.activeNodeIds.length > 0;

      this.activeNodeIds = [];
      this.evictInactivePacks(new Set());

      return { changed, tiles: [] };
    }
    const loadedIndex = await this.loadIndex();
    const selectedNodeIds = selectStarTileNodeIds(loadedIndex.renderNodes, view);

    if (sameIds(this.activeNodeIds, selectedNodeIds)) {
      this.touchActivePacks(loadedIndex.nodesById);

      return { changed: false, tiles: this.getActiveTiles() };
    }
    const selectedNodes = selectedNodeIds.map((nodeId) => {
      const node = loadedIndex.nodesById.get(nodeId);

      if (!node) {
        throw new Error(`Nœud stellaire sélectionné absent de l’index : ${nodeId}.`);
      }

      return node;
    });
    const urls = [...new Set(selectedNodes.map((node) => node.url))];

    await Promise.all(urls.map((url) => this.loadPack(url, loadedIndex)));

    const tiles = selectedNodes.map((node) => {
      const tile = this.cachedPacks.get(node.url)?.tilesById.get(node.id);

      if (!tile) {
        throw new Error(`Tuile stellaire sélectionnée absente : ${node.id}.`);
      }

      return tile;
    });

    this.activeNodeIds = selectedNodeIds;
    this.touchActivePacks(loadedIndex.nodesById);
    this.evictInactivePacks(new Set(urls));

    return { changed: true, tiles };
  }

  private async loadIndex(): Promise<LoadedStarTileIndex> {
    this.indexPromise ??= this.fetchIndex();

    return this.indexPromise;
  }

  private async fetchIndex(): Promise<LoadedStarTileIndex> {
    const response = await this.fetcher(this.source.url);

    if (!response.ok) {
      throw new Error(
        `Impossible de charger l’index stellaire ${this.source.id} (${response.status}).`,
      );
    }
    const index = parseStarTileIndex(await response.json(), this.source.id);

    if (index.sourceCatalog !== this.source.starCatalogId) {
      throw new Error(`Index stellaire associé au mauvais catalogue : ${index.sourceCatalog}.`);
    }
    const nodesById = new Map(index.nodes.map((node) => [node.id, node]));
    const renderNodes = createStarTileRenderNodes(index, (position, target) =>
      this.registry.toRenderPosition(position, target),
    );

    return { index, nodesById, renderNodes };
  }

  private async loadPack(
    url: string,
    loadedIndex: LoadedStarTileIndex,
  ): Promise<CachedStarTilePack> {
    const cached = this.cachedPacks.get(url);

    if (cached) {
      cached.lastUsed = ++this.accessSequence;

      return cached;
    }
    const pending = this.pendingPacks.get(url);

    if (pending) {
      return pending;
    }
    const request = this.fetchPack(url, loadedIndex).then((entry) => {
      this.cachedPacks.set(url, entry);

      return entry;
    });

    this.pendingPacks.set(url, request);
    try {
      return await request;
    } finally {
      this.pendingPacks.delete(url);
    }
  }

  private async fetchPack(
    url: string,
    loadedIndex: LoadedStarTileIndex,
  ): Promise<CachedStarTilePack> {
    const response = await this.fetcher(url);

    if (!response.ok) {
      throw new Error(`Impossible de charger le paquet de tuiles stellaires (${response.status}).`);
    }
    const pack = parseStarClusterTilePack(await response.json(), url);
    const tilesById = new Map<string, StarClusterTile>();

    for (const tile of pack.tiles) {
      const node = loadedIndex.nodesById.get(tile.id);

      if (!node) {
        throw new Error(`Tuile stellaire absente de l’index : ${tile.id}.`);
      }
      if (node.url !== url) {
        throw new Error(`Tuile stellaire chargée depuis le mauvais paquet : ${tile.id}.`);
      }
      assertStarClusterTileMatchesCatalog(tile, loadedIndex.index, node, this.registry.catalog);
      tilesById.set(tile.id, tile);
    }

    return { pack, tilesById, lastUsed: ++this.accessSequence };
  }

  private getActiveTiles(): readonly StarClusterTile[] {
    const activeIds = new Set(this.activeNodeIds);

    return [...this.cachedPacks.values()]
      .flatMap((entry) => entry.pack.tiles)
      .filter((tile) => activeIds.has(tile.id))
      .sort((left, right) => left.id.localeCompare(right.id));
  }

  private touchActivePacks(nodesById: ReadonlyMap<string, StarTileIndexNode>): void {
    const activeUrls = new Set(
      this.activeNodeIds
        .map((nodeId) => nodesById.get(nodeId)?.url)
        .filter((url): url is string => url !== undefined),
    );

    for (const url of activeUrls) {
      const entry = this.cachedPacks.get(url);

      if (entry) {
        entry.lastUsed = ++this.accessSequence;
      }
    }
  }

  private evictInactivePacks(activeUrls: ReadonlySet<string>): void {
    const maximum = Math.max(1, this.cachePackLimit);
    const inactive = [...this.cachedPacks.entries()]
      .filter(([url]) => !activeUrls.has(url))
      .sort((left, right) => left[1].lastUsed - right[1].lastUsed);

    while (this.cachedPacks.size > maximum && inactive.length > 0) {
      const oldest = inactive.shift()!;

      this.cachedPacks.delete(oldest[0]);
    }
  }
}

function sameIds(left: readonly string[], right: readonly string[]): boolean {
  return left.length === right.length && left.every((id, index) => id === right[index]);
}
