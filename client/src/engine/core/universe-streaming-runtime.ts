import type { SpaceObject } from '../../data/models/universe.models';
import type { SpaceStreamingCoordinator } from './space-streaming-coordinator';

export interface UniverseStreamingExoplanetCatalog {
  has(objectId: string): boolean;
  getHostIdForObject(objectId: string): string | null;
  createSystemObjects(objectId: string): readonly SpaceObject[];
}

export interface UniverseStreamingRuntimeBindings {
  getExoplanetCatalog(): UniverseStreamingExoplanetCatalog | null;
  hasPrimaryObject(objectId: string): boolean;
  hasActiveExoplanetHost(hostId: string): boolean;
  rebuildExoplanetSystem(objects: readonly SpaceObject[]): void;
  rebuildStreamedObjects(objects: readonly SpaceObject[]): void;
  refreshLabels(): void;
  isInitialized(): boolean;
  emitObjectsChanged(): void;
  emitLoading(loading: boolean): void;
}

export class UniverseStreamingRuntime {
  private installedBaseObjects: SpaceObject[] = [];
  private loadedObjects: SpaceObject[] = [];
  private activeExoplanetObjects: SpaceObject[] = [];
  private streamingCoordinator: SpaceStreamingCoordinator | null = null;

  constructor(private readonly bindings: UniverseStreamingRuntimeBindings) {}

  public get baseObjects(): readonly SpaceObject[] {
    return this.installedBaseObjects;
  }

  public get objects(): readonly SpaceObject[] {
    return this.loadedObjects;
  }

  public get activeExoplanetSystemObjects(): readonly SpaceObject[] {
    return this.activeExoplanetObjects;
  }

  public get coordinator(): SpaceStreamingCoordinator | null {
    return this.streamingCoordinator;
  }

  public install(
    baseObjects: readonly SpaceObject[],
    coordinator: SpaceStreamingCoordinator,
  ): void {
    this.installedBaseObjects = [...baseObjects];
    this.loadedObjects = [...baseObjects];
    this.activeExoplanetObjects = [];
    this.streamingCoordinator = coordinator;
  }

  public reset(): void {
    this.installedBaseObjects = [];
    this.loadedObjects = [];
    this.activeExoplanetObjects = [];
    this.streamingCoordinator = null;
  }

  public hasStreamedObject(objectId: string): boolean {
    return this.streamingCoordinator?.hasObject(objectId) ?? false;
  }

  public ensureActiveExoplanetSystem(objectId: string): void {
    const catalog = this.bindings.getExoplanetCatalog();

    if (!catalog?.has(objectId) || this.bindings.hasPrimaryObject(objectId)) {
      return;
    }
    const hostId = catalog.getHostIdForObject(objectId);

    if (!hostId || this.bindings.hasActiveExoplanetHost(hostId)) {
      return;
    }
    this.activeExoplanetObjects = [...catalog.createSystemObjects(objectId)];
    this.bindings.rebuildExoplanetSystem(this.activeExoplanetObjects);
    this.bindings.refreshLabels();
    if (this.bindings.isInitialized()) {
      this.bindings.emitObjectsChanged();
    }
  }

  public rebuildDynamicRegistries(): void {
    this.bindings.rebuildStreamedObjects(this.streamingCoordinator?.loadedSpaceObjects ?? []);
    this.bindings.rebuildExoplanetSystem(this.activeExoplanetObjects);
  }

  public async ensureSpaceTileObject(objectId: string): Promise<void> {
    const coordinator = this.streamingCoordinator;

    if (
      !coordinator?.hasObject(objectId) ||
      this.loadedObjects.some((object) => object.id === objectId)
    ) {
      return;
    }

    this.bindings.emitLoading(true);
    try {
      await coordinator.ensureObject(objectId);
    } finally {
      this.bindings.emitLoading(false);
    }
  }

  public applyLoadedSpaceTiles(loadedObjects: readonly SpaceObject[]): void {
    this.loadedObjects = [...this.installedBaseObjects, ...loadedObjects];
    this.bindings.rebuildStreamedObjects(loadedObjects);
    this.bindings.refreshLabels();
    this.bindings.emitObjectsChanged();
  }
}
