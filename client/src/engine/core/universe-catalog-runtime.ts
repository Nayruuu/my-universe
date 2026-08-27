import {
  type ConstellationCatalog,
  type SearchEntry,
  type SpaceObject,
  type SpaceTileIndex,
  type TempelFilamentSpineSource,
} from '../../data/models/universe.models';
import { type CoordinateSystem } from '../coordinates/coordinate-system';
import { type LoadedUniverseAssets } from '../loaders/asset-loader';
import type {
  DeferredUniverseCatalogLoader,
  LoadedDeferredUniverseCatalogs,
} from '../loaders/deferred-universe-catalog-loader';
import { type CosmicGroupCatalog } from '../loaders/cosmic-group-catalog';
import { type CosmicStructureCatalog } from '../loaders/cosmic-structure-catalog';
import { type CosmicWebVolume } from '../loaders/cosmic-web-volume';
import { type ExoplanetCatalog } from '../loaders/exoplanet-catalog';
import { type CosmicGroupCatalogRegistry } from '../objects/cosmic-group-catalog-registry';
import { type CosmicStructureCatalogRegistry } from '../objects/cosmic-structure-catalog-registry';
import { type ExoplanetCatalogRegistry } from '../objects/exoplanet-catalog-registry';
import { type StarCatalogRegistry } from '../objects/star-catalog-registry';
import { type LabelObject } from '../objects/label-manager';
import { type UniverseScene } from '../rendering/universe-scene';
import { type SpaceTileManager } from '../tiles/space-tile-manager';
import { type StarTileManager } from '../tiles/star-tile-manager';

export type UniverseCatalogScene = Pick<
  UniverseScene,
  | 'setNearbyGalaxyOverview'
  | 'setStarCatalog'
  | 'setConstellationCatalog'
  | 'setExoplanetCatalog'
  | 'setCosmicGroupCatalog'
  | 'setCosmicStructureCatalog'
  | 'setCosmicWebVolume'
>;

export interface UniverseCatalogRuntimeState {
  readonly baseObjects: readonly SpaceObject[];
  readonly starCatalogRegistry: StarCatalogRegistry | null;
  readonly exoplanetCatalogRegistry: ExoplanetCatalogRegistry | null;
  readonly cosmicGroupCatalogRegistry: CosmicGroupCatalogRegistry | null;
  readonly cosmicStructureCatalogRegistry: CosmicStructureCatalogRegistry | null;
  readonly spaceTileManager: SpaceTileManager | null;
  readonly starTileManager: StarTileManager | null;
  readonly tempelFilamentSpineSource: TempelFilamentSpineSource | null;
  readonly constellationCatalog?: ConstellationCatalog | null;
  readonly loadDeferredCatalogs?: DeferredUniverseCatalogLoader | null;
  readonly yieldControl?: () => Promise<void>;
  readonly coordinateSystem?: CoordinateSystem;
  readonly scene?: UniverseCatalogScene;
}

export class UniverseCatalogRuntime {
  public readonly baseObjects: readonly SpaceObject[];
  public readonly starCatalogRegistry: StarCatalogRegistry | null;
  public readonly spaceTileManager: SpaceTileManager | null;
  public readonly starTileManager: StarTileManager | null;
  public readonly tempelFilamentSpineSource: TempelFilamentSpineSource | null;
  public readonly constellationCatalog: ConstellationCatalog | null;
  private deferredCatalogWarnings: readonly string[] = [];
  private deferredCatalogs: LoadedDeferredUniverseCatalogs | null = null;
  private deferredPreparation: Promise<LoadedDeferredUniverseCatalogs> | null = null;
  private deferredInstallation: Promise<readonly string[]> | null = null;
  private deferredLoader: DeferredUniverseCatalogLoader | null;
  private exoplanetRegistry: ExoplanetCatalogRegistry | null;
  private cosmicGroupRegistry: CosmicGroupCatalogRegistry | null;
  private cosmicStructureRegistry: CosmicStructureCatalogRegistry | null;
  private readonly coordinateSystem: CoordinateSystem | null;
  private readonly scene: UniverseCatalogScene | null;
  private readonly yieldControl: () => Promise<void>;

  constructor(state: UniverseCatalogRuntimeState) {
    this.baseObjects = state.baseObjects;
    this.starCatalogRegistry = state.starCatalogRegistry;
    this.exoplanetRegistry = state.exoplanetCatalogRegistry;
    this.cosmicGroupRegistry = state.cosmicGroupCatalogRegistry;
    this.cosmicStructureRegistry = state.cosmicStructureCatalogRegistry;
    this.spaceTileManager = state.spaceTileManager;
    this.starTileManager = state.starTileManager;
    this.tempelFilamentSpineSource = state.tempelFilamentSpineSource;
    this.constellationCatalog = state.constellationCatalog ?? null;
    this.deferredLoader = state.loadDeferredCatalogs ?? null;
    this.coordinateSystem = state.coordinateSystem ?? null;
    this.scene = state.scene ?? null;
    this.yieldControl = state.yieldControl ?? yieldToBrowser;
  }

  public get exoplanetCatalogRegistry(): ExoplanetCatalogRegistry | null {
    return this.exoplanetRegistry;
  }

  public get cosmicGroupCatalogRegistry(): CosmicGroupCatalogRegistry | null {
    return this.cosmicGroupRegistry;
  }

  public get cosmicStructureCatalogRegistry(): CosmicStructureCatalogRegistry | null {
    return this.cosmicStructureRegistry;
  }

  public get hasDeferredCatalogs(): boolean {
    return this.deferredLoader !== null || this.deferredCatalogs !== null;
  }

  public async prepareDeferredCatalogs(): Promise<void> {
    if (!this.hasDeferredCatalogs) {
      return;
    }

    await this.loadDeferredCatalogs();
  }

  public installDeferredCatalogs(): Promise<readonly string[]> {
    if (this.deferredInstallation) {
      return this.deferredInstallation;
    }
    if (!this.hasDeferredCatalogs) {
      return Promise.resolve(this.deferredCatalogWarnings);
    }

    this.deferredInstallation = this.loadDeferredCatalogs().then((catalogs) =>
      this.installLoadedDeferredCatalogs(catalogs),
    );

    return this.deferredInstallation;
  }

  public has(objectId: string): boolean {
    return (
      this.starCatalogRegistry?.has(objectId) === true ||
      this.exoplanetCatalogRegistry?.has(objectId) === true ||
      this.cosmicGroupCatalogRegistry?.has(objectId) === true ||
      this.cosmicStructureCatalogRegistry?.has(objectId) === true
    );
  }

  public isCatalogStar(objectId: string): boolean {
    return this.starCatalogRegistry?.has(objectId) === true;
  }

  public isExoplanetHost(objectId: string): boolean {
    return this.exoplanetCatalogRegistry?.isHost(objectId) === true;
  }

  public supportsWheelNavigation(objectId: string): boolean {
    return (
      this.exoplanetCatalogRegistry?.has(objectId) === true ||
      this.cosmicGroupCatalogRegistry?.has(objectId) === true ||
      this.cosmicStructureCatalogRegistry?.has(objectId) === true
    );
  }

  public getDefinition(objectId: string): SpaceObject | undefined {
    return (
      this.starCatalogRegistry?.getDefinition(objectId) ??
      this.exoplanetCatalogRegistry?.getDefinition(objectId) ??
      this.cosmicGroupCatalogRegistry?.getDefinition(objectId) ??
      this.cosmicStructureCatalogRegistry?.getDefinition(objectId)
    );
  }

  public getSearchEntries(): readonly SearchEntry[] {
    return [
      ...(this.starCatalogRegistry?.getSearchEntries() ?? []),
      ...(this.exoplanetCatalogRegistry?.getSearchEntries() ?? []),
      ...(this.cosmicGroupCatalogRegistry?.getSearchEntries() ?? []),
      ...(this.cosmicStructureCatalogRegistry?.getSearchEntries() ?? []),
    ];
  }

  public getLabelObjects(
    existingObjects: readonly Pick<SpaceObject, 'name' | 'aliases'>[],
    maximumCatalogRank: number,
    maximumExoplanetHostRank: number,
    maximumCosmicRank: number,
  ): readonly LabelObject[] {
    return [
      ...(this.starCatalogRegistry?.getLabelObjects(existingObjects, maximumCatalogRank) ?? []),
      ...(this.exoplanetCatalogRegistry?.getLabelObjects(maximumExoplanetHostRank) ?? []),
      ...(this.cosmicGroupCatalogRegistry?.getLabelObjects(maximumCosmicRank) ?? []),
      ...(this.cosmicStructureCatalogRegistry?.getLabelObjects(maximumCosmicRank) ?? []),
    ];
  }

  private async installLoadedDeferredCatalogs(
    catalogs: LoadedDeferredUniverseCatalogs,
  ): Promise<readonly string[]> {
    const coordinateSystem = this.coordinateSystem;
    const scene = this.scene;

    if (!coordinateSystem || !scene) {
      throw new Error('Installation différée indisponible sans scène ni système de coordonnées.');
    }
    const exoplanets = await this.installDeferredLayer(catalogs.exoplanetCatalog, (catalog) =>
      initializeExoplanetCatalog(catalog, this.baseObjects, coordinateSystem, scene),
    );
    const cosmicGroups = await this.installDeferredLayer(catalogs.cosmicGroupCatalog, (catalog) =>
      initializeCosmicGroupCatalog(catalog, coordinateSystem, scene),
    );
    const cosmicStructures = await this.installDeferredLayer(
      catalogs.cosmicStructureCatalog,
      (catalog) => initializeCosmicStructureCatalog(catalog, coordinateSystem, scene),
    );

    await this.installDeferredLayer(catalogs.cosmicWebVolume, (volume) =>
      initializeCosmicWebVolume(volume, coordinateSystem, scene),
    );

    this.exoplanetRegistry = exoplanets;
    this.cosmicGroupRegistry = cosmicGroups;
    this.cosmicStructureRegistry = cosmicStructures;
    this.deferredCatalogWarnings = catalogs.warnings;
    this.deferredCatalogs = null;
    this.deferredPreparation = null;
    this.deferredLoader = null;

    return this.deferredCatalogWarnings;
  }

  private loadDeferredCatalogs(): Promise<LoadedDeferredUniverseCatalogs> {
    if (this.deferredCatalogs) {
      return Promise.resolve(this.deferredCatalogs);
    }

    this.deferredPreparation ??= this.deferredLoader!().then((catalogs) => {
      this.deferredCatalogs = catalogs;

      return catalogs;
    });

    return this.deferredPreparation;
  }

  private async installDeferredLayer<Catalog, Result>(
    catalog: Catalog | null,
    install: (catalog: Catalog) => Promise<Result>,
  ): Promise<Result | null> {
    if (!catalog) {
      return null;
    }

    await this.yieldControl();

    return install(catalog);
  }
}

function yieldToBrowser(): Promise<void> {
  return new Promise((resolve) => globalThis.setTimeout(resolve, 0));
}

interface StellarCatalogRuntime {
  readonly baseObjects: readonly SpaceObject[];
  readonly registry: StarCatalogRegistry | null;
  readonly tileManager: StarTileManager | null;
}

export async function createUniverseCatalogRuntime(
  assets: LoadedUniverseAssets,
  coordinateSystem: CoordinateSystem,
  scene: UniverseCatalogScene,
): Promise<UniverseCatalogRuntime> {
  const stellar = await createStellarCatalogRuntime(assets, coordinateSystem);
  const [
    spaceTileManager,
    exoplanetCatalogRegistry,
    cosmicGroupCatalogRegistry,
    cosmicStructureCatalogRegistry,
  ] = await Promise.all([
    initializeSpaceTiles(assets.spaceTileIndex, coordinateSystem, scene),
    initializeExoplanetCatalog(
      assets.exoplanetCatalog,
      stellar.baseObjects,
      coordinateSystem,
      scene,
    ),
    initializeCosmicGroupCatalog(assets.cosmicGroupCatalog, coordinateSystem, scene),
    initializeCosmicStructureCatalog(assets.cosmicStructureCatalog, coordinateSystem, scene),
    initializeCosmicWebVolume(assets.cosmicWebVolume, coordinateSystem, scene),
    installStellarCatalogRuntime(stellar, assets.constellationCatalog, scene),
  ]);

  return new UniverseCatalogRuntime({
    baseObjects: stellar.baseObjects,
    starCatalogRegistry: stellar.registry,
    exoplanetCatalogRegistry,
    cosmicGroupCatalogRegistry,
    cosmicStructureCatalogRegistry,
    spaceTileManager,
    starTileManager: stellar.tileManager,
    tempelFilamentSpineSource: assets.tempelFilamentSpineSource,
    constellationCatalog: assets.constellationCatalog,
    loadDeferredCatalogs: assets.loadDeferredCatalogs,
    coordinateSystem,
    scene,
  });
}

async function createStellarCatalogRuntime(
  assets: LoadedUniverseAssets,
  coordinateSystem: CoordinateSystem,
): Promise<StellarCatalogRuntime> {
  if (!assets.starCatalog) {
    return { baseObjects: [...assets.objects], registry: null, tileManager: null };
  }
  const [{ StarCatalogRegistry }, { StarTileManager }] = await Promise.all([
    import('../objects/star-catalog-registry'),
    assets.starTileSource
      ? import('../tiles/star-tile-manager')
      : Promise.resolve({ StarTileManager: null }),
  ]);
  const registry = new StarCatalogRegistry(assets.starCatalog, coordinateSystem, assets.objects);
  const tileManager =
    assets.starTileSource && StarTileManager
      ? new StarTileManager(assets.starTileSource, registry)
      : null;

  return {
    baseObjects: registry.resolveCatalogObjects(assets.objects),
    registry,
    tileManager,
  };
}

async function installStellarCatalogRuntime(
  stellar: StellarCatalogRuntime,
  constellationCatalog: LoadedUniverseAssets['constellationCatalog'],
  scene: UniverseCatalogScene,
): Promise<void> {
  if (!stellar.registry) {
    return;
  }
  await Promise.all([
    scene.setStarCatalog(stellar.registry),
    constellationCatalog
      ? scene.setConstellationCatalog(constellationCatalog, stellar.registry)
      : Promise.resolve(),
  ]);
}

async function initializeSpaceTiles(
  index: SpaceTileIndex | null,
  coordinateSystem: CoordinateSystem,
  scene: UniverseCatalogScene,
): Promise<SpaceTileManager | null> {
  if (!index) {
    return null;
  }
  const { SpaceTileManager } = await import('../tiles/space-tile-manager');
  const manager = new SpaceTileManager(index);

  await scene.setNearbyGalaxyOverview(index, coordinateSystem);

  return manager;
}

async function initializeExoplanetCatalog(
  catalog: ExoplanetCatalog | null,
  objects: readonly SpaceObject[],
  coordinateSystem: CoordinateSystem,
  scene: UniverseCatalogScene,
): Promise<ExoplanetCatalogRegistry | null> {
  if (!catalog) {
    return null;
  }
  const { ExoplanetCatalogRegistry } = await import('../objects/exoplanet-catalog-registry');
  const registry = new ExoplanetCatalogRegistry(catalog, coordinateSystem, objects);

  await scene.setExoplanetCatalog(registry);

  return registry;
}

async function initializeCosmicGroupCatalog(
  catalog: CosmicGroupCatalog | null,
  coordinateSystem: CoordinateSystem,
  scene: UniverseCatalogScene,
): Promise<CosmicGroupCatalogRegistry | null> {
  if (!catalog) {
    return null;
  }
  const { CosmicGroupCatalogRegistry } = await import('../objects/cosmic-group-catalog-registry');
  const registry = new CosmicGroupCatalogRegistry(catalog, coordinateSystem);

  await scene.setCosmicGroupCatalog(registry);

  return registry;
}

async function initializeCosmicStructureCatalog(
  catalog: CosmicStructureCatalog | null,
  coordinateSystem: CoordinateSystem,
  scene: UniverseCatalogScene,
): Promise<CosmicStructureCatalogRegistry | null> {
  if (!catalog) {
    return null;
  }
  const { CosmicStructureCatalogRegistry } =
    await import('../objects/cosmic-structure-catalog-registry');
  const registry = new CosmicStructureCatalogRegistry(catalog, coordinateSystem);

  await scene.setCosmicStructureCatalog(registry);

  return registry;
}

async function initializeCosmicWebVolume(
  volume: CosmicWebVolume | null,
  coordinateSystem: CoordinateSystem,
  scene: UniverseCatalogScene,
): Promise<void> {
  if (volume) {
    await scene.setCosmicWebVolume(volume, coordinateSystem);
  }
}
