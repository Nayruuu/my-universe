import {
  type SearchEntry,
  type SpaceObject,
  type SpaceTileIndex,
  type StarTileSource,
  type TempelFilamentSpineSource,
} from '../../data/models/universe.models';
import { type CoordinateSystem } from '../coordinates/coordinate-system';
import { type LoadedUniverseAssets } from '../loaders/asset-loader';
import { type CosmicGroupCatalog } from '../loaders/cosmic-group-catalog';
import { type CosmicStructureCatalog } from '../loaders/cosmic-structure-catalog';
import { type CosmicWebVolume } from '../loaders/cosmic-web-volume';
import { type ExoplanetCatalog } from '../loaders/exoplanet-catalog';
import { type StarCatalog } from '../loaders/star-catalog';
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
}

export class UniverseCatalogRuntime {
  public readonly baseObjects: readonly SpaceObject[];
  public readonly starCatalogRegistry: StarCatalogRegistry | null;
  public readonly exoplanetCatalogRegistry: ExoplanetCatalogRegistry | null;
  public readonly cosmicGroupCatalogRegistry: CosmicGroupCatalogRegistry | null;
  public readonly cosmicStructureCatalogRegistry: CosmicStructureCatalogRegistry | null;
  public readonly spaceTileManager: SpaceTileManager | null;
  public readonly starTileManager: StarTileManager | null;
  public readonly tempelFilamentSpineSource: TempelFilamentSpineSource | null;

  constructor(state: UniverseCatalogRuntimeState) {
    this.baseObjects = state.baseObjects;
    this.starCatalogRegistry = state.starCatalogRegistry;
    this.exoplanetCatalogRegistry = state.exoplanetCatalogRegistry;
    this.cosmicGroupCatalogRegistry = state.cosmicGroupCatalogRegistry;
    this.cosmicStructureCatalogRegistry = state.cosmicStructureCatalogRegistry;
    this.spaceTileManager = state.spaceTileManager;
    this.starTileManager = state.starTileManager;
    this.tempelFilamentSpineSource = state.tempelFilamentSpineSource;
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
    maximumCosmicRank: number,
  ): readonly LabelObject[] {
    return [
      ...(this.starCatalogRegistry?.getLabelObjects(existingObjects, maximumCatalogRank) ?? []),
      ...(this.exoplanetCatalogRegistry?.getLabelObjects(maximumCatalogRank) ?? []),
      ...(this.cosmicGroupCatalogRegistry?.getLabelObjects(maximumCosmicRank) ?? []),
      ...(this.cosmicStructureCatalogRegistry?.getLabelObjects(maximumCosmicRank) ?? []),
    ];
  }
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
  const spaceTileManager = await initializeSpaceTiles(
    assets.spaceTileIndex,
    coordinateSystem,
    scene,
  );
  const stellar = await initializeStarCatalog(
    assets.starCatalog,
    assets.starTileSource,
    assets.constellationCatalog,
    assets.objects,
    coordinateSystem,
    scene,
  );
  const exoplanetCatalogRegistry = await initializeExoplanetCatalog(
    assets.exoplanetCatalog,
    stellar.baseObjects,
    coordinateSystem,
    scene,
  );
  const cosmicGroupCatalogRegistry = await initializeCosmicGroupCatalog(
    assets.cosmicGroupCatalog,
    coordinateSystem,
    scene,
  );
  const cosmicStructureCatalogRegistry = await initializeCosmicStructureCatalog(
    assets.cosmicStructureCatalog,
    coordinateSystem,
    scene,
  );

  await initializeCosmicWebVolume(assets.cosmicWebVolume, coordinateSystem, scene);

  return new UniverseCatalogRuntime({
    baseObjects: stellar.baseObjects,
    starCatalogRegistry: stellar.registry,
    exoplanetCatalogRegistry,
    cosmicGroupCatalogRegistry,
    cosmicStructureCatalogRegistry,
    spaceTileManager,
    starTileManager: stellar.tileManager,
    tempelFilamentSpineSource: assets.tempelFilamentSpineSource,
  });
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

async function initializeStarCatalog(
  catalog: StarCatalog | null,
  tileSource: StarTileSource | null,
  constellationCatalog: LoadedUniverseAssets['constellationCatalog'],
  objects: readonly SpaceObject[],
  coordinateSystem: CoordinateSystem,
  scene: UniverseCatalogScene,
): Promise<StellarCatalogRuntime> {
  if (!catalog) {
    return { baseObjects: [...objects], registry: null, tileManager: null };
  }
  const { StarCatalogRegistry } = await import('../objects/star-catalog-registry');
  const registry = new StarCatalogRegistry(catalog, coordinateSystem, objects);
  const baseObjects = registry.resolveCatalogObjects(objects);

  await scene.setStarCatalog(registry);
  const tileManager = await createStarTileManager(tileSource, registry);

  if (constellationCatalog) {
    await scene.setConstellationCatalog(constellationCatalog, registry);
  }

  return { baseObjects, registry, tileManager };
}

async function createStarTileManager(
  source: StarTileSource | null,
  registry: StarCatalogRegistry,
): Promise<StarTileManager | null> {
  if (!source) {
    return null;
  }
  const { StarTileManager } = await import('../tiles/star-tile-manager');

  return new StarTileManager(source, registry);
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
