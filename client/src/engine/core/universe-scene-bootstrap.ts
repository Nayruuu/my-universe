import type { DisplayOptions, SpaceObject, UniverseTime } from '../../data/models/universe.models';
import type { CoordinateSystem } from '../coordinates/coordinate-system';
import type { LoadedUniverseAssets } from '../loaders/asset-loader';
import { ObjectRegistry } from '../objects/object-registry';
import type { PerformanceManager } from '../performance/performance-manager';
import { UniverseScene } from '../rendering/universe-scene';
import type { SolarEclipseAppearance } from '../simulation/earth-eclipse';
import type { UniverseCatalogRuntime, UniverseCatalogScene } from './universe-catalog-runtime';

export type UniverseCatalogRuntimeFactory = (
  assets: LoadedUniverseAssets,
  coordinateSystem: CoordinateSystem,
  scene: UniverseCatalogScene,
) => Promise<UniverseCatalogRuntime>;

export interface UniverseSceneBootstrapOptions {
  readonly assets: LoadedUniverseAssets;
  readonly createCatalogRuntime: UniverseCatalogRuntimeFactory;
  readonly displayOptions: DisplayOptions;
  readonly pixelRatio: number;
  readonly initialTime: UniverseTime;
}

export interface UniverseSceneRuntime {
  readonly scene: UniverseScene;
  readonly catalogRuntime: UniverseCatalogRuntime;
  readonly baseObjects: SpaceObject[];
  readonly objects: SpaceObject[];
  readonly registry: ObjectRegistry;
  readonly solarEclipseAppearance: SolarEclipseAppearance;
}

export class UniverseSceneBootstrap {
  constructor(
    private readonly performanceManager: PerformanceManager,
    private readonly coordinateSystem: CoordinateSystem,
  ) {}

  public async create(options: UniverseSceneBootstrapOptions): Promise<UniverseSceneRuntime> {
    const scene = new UniverseScene(this.performanceManager);
    const catalogRuntime = await options.createCatalogRuntime(
      options.assets,
      this.coordinateSystem,
      scene,
    );
    const baseObjects = [...catalogRuntime.baseObjects];
    const objects = [...baseObjects];

    scene.setQuality(options.displayOptions.quality);
    scene.setPixelRatio(options.pixelRatio);
    scene.setConstellationsEnabled(options.displayOptions.showConstellations);

    const registry = new ObjectRegistry(
      scene.spaceRoot,
      this.coordinateSystem,
      objects,
      options.displayOptions.quality,
    );
    const solarEclipseAppearance = registry.updatePositions(options.initialTime);

    scene.setStellarOrigin(registry.getSpacePosition('sun') ?? { x: 0, y: 0, z: 0 });
    registry.updateBodyRotations(options.initialTime);
    registry.setDisplayOptions(options.displayOptions);

    return {
      scene,
      catalogRuntime,
      baseObjects,
      objects,
      registry,
      solarEclipseAppearance,
    };
  }
}
