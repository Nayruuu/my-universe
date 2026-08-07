import * as THREE from 'three';
import {
  type GraphicQuality,
  type SearchEntry,
  type SpaceObject,
  type StarClusterTile,
} from '../../data/models/universe.models';
import { createSpaceTileView, type SpaceTileView } from '../tiles/space-tile-selection';
import { createStarTileView, type StarTileView } from '../tiles/star-tile-selection';

const SYNCHRONIZATION_INTERVAL_SECONDS = 0.25;

export interface SpaceTileStream {
  readonly searchEntries: readonly SearchEntry[];
  readonly loadedObjects: readonly SpaceObject[];
  readonly loadedTileCount: number;
  readonly indexedTileCount: number;
  readonly cachedTileCount: number;
  hasObject(objectId: string): boolean;
  ensureObject(objectId: string): Promise<boolean>;
  synchronize(view: SpaceTileView, retainedObjectIds: readonly string[]): Promise<boolean>;
}

export interface StarTileStream {
  readonly activeTileCount: number;
  readonly cachedPackCount: number;
  readonly cachedTileCount: number;
  readonly activeClusterCount: number;
  readonly cachedClusterCount: number;
  synchronize(
    view: StarTileView,
  ): Promise<{ readonly changed: boolean; readonly tiles: readonly StarClusterTile[] }>;
}

export interface SpaceStreamingFrame {
  readonly camera: THREE.PerspectiveCamera;
  readonly viewportHeight: number;
  readonly lodLevel: number;
  readonly quality: GraphicQuality;
  readonly worldOffset: THREE.Vector3;
  readonly transitioning: boolean;
  readonly targetId: string | null;
  readonly selectedId: string | null;
}

export interface SpaceStreamingCallbacks {
  isActive(): boolean;
  onSpaceTilesChanged(objects: readonly SpaceObject[]): void;
  onStarTilesChanged(tiles: readonly StarClusterTile[]): void | Promise<void>;
  onWarning(message: string): void;
}

export interface SpaceStreamingStats {
  readonly loadedTiles: number;
  readonly indexedGalaxyTiles: number;
  readonly cachedGalaxyTiles: number;
  readonly activeStarTiles: number;
  readonly cachedStarPacks: number;
  readonly cachedStarTiles: number;
  readonly activeStarClusters: number;
  readonly cachedStarClusters: number;
}

export interface SpaceStreamingOptions {
  readonly streamStarTiles: boolean;
}

interface SpaceTileSynchronizationRequest {
  readonly view: SpaceTileView;
  readonly retainedObjectIds: readonly string[];
}

export class SpaceStreamingCoordinator {
  private pendingSpaceTileRequest: SpaceTileSynchronizationRequest | null = null;
  private pendingStarTileView: StarTileView | null = null;
  private spaceSynchronizationRunning = false;
  private starSynchronizationRunning = false;
  private spaceSynchronizationAccumulator = SYNCHRONIZATION_INTERVAL_SECONDS;
  private starSynchronizationAccumulator = SYNCHRONIZATION_INTERVAL_SECONDS;
  private lastSpaceContextKey: string | null = null;
  private lastStarLod = -1;
  private lastStarWarning: string | null = null;
  private disposed = false;
  private readonly streamStarTiles: boolean;

  constructor(
    private readonly spaceTiles: SpaceTileStream | null,
    private readonly starTiles: StarTileStream | null,
    private readonly callbacks: SpaceStreamingCallbacks,
    options: Partial<SpaceStreamingOptions> = {},
  ) {
    this.streamStarTiles = options.streamStarTiles ?? true;
  }

  public get searchEntries(): readonly SearchEntry[] {
    return this.spaceTiles?.searchEntries ?? [];
  }

  public get loadedSpaceObjects(): readonly SpaceObject[] {
    return this.spaceTiles?.loadedObjects ?? [];
  }

  public get stats(): SpaceStreamingStats {
    const starTiles = this.streamStarTiles ? this.starTiles : null;

    return {
      loadedTiles: this.spaceTiles?.loadedTileCount ?? 0,
      indexedGalaxyTiles: this.spaceTiles?.indexedTileCount ?? 0,
      cachedGalaxyTiles: this.spaceTiles?.cachedTileCount ?? 0,
      activeStarTiles: starTiles?.activeTileCount ?? 0,
      cachedStarPacks: starTiles?.cachedPackCount ?? 0,
      cachedStarTiles: starTiles?.cachedTileCount ?? 0,
      activeStarClusters: starTiles?.activeClusterCount ?? 0,
      cachedStarClusters: starTiles?.cachedClusterCount ?? 0,
    };
  }

  public hasObject(objectId: string): boolean {
    return this.spaceTiles?.hasObject(objectId) ?? false;
  }

  public async ensureObject(objectId: string): Promise<boolean> {
    const manager = this.spaceTiles;

    if (this.disposed || !manager?.hasObject(objectId)) {
      return false;
    }
    const loaded = await manager.ensureObject(objectId);

    if (loaded && this.isCurrent()) {
      this.callbacks.onSpaceTilesChanged(manager.loadedObjects);
    }

    return loaded;
  }

  public update(frame: SpaceStreamingFrame, deltaSeconds: number): void {
    if (this.disposed) {
      return;
    }
    this.requestSpaceTiles(frame, deltaSeconds);
    this.requestStarTiles(frame, deltaSeconds);
  }

  public invalidateViews(): void {
    this.lastSpaceContextKey = null;
    this.lastStarLod = -1;
    this.spaceSynchronizationAccumulator = SYNCHRONIZATION_INTERVAL_SECONDS;
    this.starSynchronizationAccumulator = SYNCHRONIZATION_INTERVAL_SECONDS;
  }

  public dispose(): void {
    this.disposed = true;
    this.pendingSpaceTileRequest = null;
    this.pendingStarTileView = null;
  }

  private requestSpaceTiles(frame: SpaceStreamingFrame, deltaSeconds: number): void {
    const manager = this.spaceTiles;

    if (!manager) {
      return;
    }
    this.spaceSynchronizationAccumulator += deltaSeconds;
    if (frame.transitioning) {
      return;
    }
    const retainedIds = [frame.targetId, frame.selectedId]
      .filter((objectId): objectId is string => objectId !== null && manager.hasObject(objectId))
      .sort();
    const contextKey = `${frame.lodLevel}:${frame.quality}:${retainedIds.join(',')}`;
    const contextChanged = contextKey !== this.lastSpaceContextKey;

    if (
      !contextChanged &&
      this.spaceSynchronizationAccumulator < SYNCHRONIZATION_INTERVAL_SECONDS
    ) {
      return;
    }
    this.lastSpaceContextKey = contextKey;
    this.spaceSynchronizationAccumulator = 0;
    frame.camera.updateMatrixWorld();
    this.pendingSpaceTileRequest = {
      view: createSpaceTileView(
        frame.camera,
        frame.viewportHeight,
        frame.lodLevel,
        frame.quality,
        frame.worldOffset,
      ),
      retainedObjectIds: retainedIds,
    };
    if (!this.spaceSynchronizationRunning) {
      void this.drainSpaceTiles(manager);
    }
  }

  private requestStarTiles(frame: SpaceStreamingFrame, deltaSeconds: number): void {
    const manager = this.starTiles;

    if (!this.streamStarTiles || !manager) {
      return;
    }
    this.starSynchronizationAccumulator += deltaSeconds;
    const lodChanged = frame.lodLevel !== this.lastStarLod;

    if (!lodChanged && this.starSynchronizationAccumulator < SYNCHRONIZATION_INTERVAL_SECONDS) {
      return;
    }
    this.lastStarLod = frame.lodLevel;
    this.starSynchronizationAccumulator = 0;
    frame.camera.updateMatrixWorld();
    this.pendingStarTileView = createStarTileView(
      frame.camera,
      frame.viewportHeight,
      frame.lodLevel,
      frame.quality,
      frame.worldOffset,
    );
    if (!this.starSynchronizationRunning) {
      void this.drainStarTiles(manager);
    }
  }

  private async drainSpaceTiles(manager: SpaceTileStream): Promise<void> {
    this.spaceSynchronizationRunning = true;
    try {
      while (this.pendingSpaceTileRequest) {
        const request = this.pendingSpaceTileRequest;

        this.pendingSpaceTileRequest = null;
        try {
          const changed = await manager.synchronize(request.view, request.retainedObjectIds);

          if (changed && this.isCurrent()) {
            this.callbacks.onSpaceTilesChanged(manager.loadedObjects);
          }
        } catch (error) {
          this.callbacks.onWarning(`Chargement spatial partiel : ${errorReason(error)}`);
        }
      }
    } finally {
      this.spaceSynchronizationRunning = false;
    }
  }

  private async drainStarTiles(manager: StarTileStream): Promise<void> {
    this.starSynchronizationRunning = true;
    try {
      while (this.pendingStarTileView) {
        const view = this.pendingStarTileView;

        this.pendingStarTileView = null;
        try {
          const result = await manager.synchronize(view);

          this.lastStarWarning = null;
          if (result.changed && this.pendingStarTileView === null && this.isCurrent()) {
            await this.callbacks.onStarTilesChanged(result.tiles);
          }
        } catch (error) {
          const reason = errorReason(error);

          if (reason !== this.lastStarWarning) {
            this.lastStarWarning = reason;
            this.callbacks.onWarning(`Streaming stellaire indisponible : ${reason}`);
          }
        }
      }
    } finally {
      this.starSynchronizationRunning = false;
    }
  }

  private isCurrent(): boolean {
    return !this.disposed && this.callbacks.isActive();
  }
}

function errorReason(error: unknown): string {
  return error instanceof Error ? error.message : 'erreur inconnue';
}
