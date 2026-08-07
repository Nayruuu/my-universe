import type { DisplayOptions, SpaceObject, UniverseTime } from '../../data/models/universe.models';
import type { CoordinateSystem } from '../coordinates/coordinate-system';
import type { LoadedUniverseAssets } from '../loaders/asset-loader';
import type { PerformanceManager } from '../performance/performance-manager';
import type { UniverseRenderingRuntime } from './universe-rendering-bootstrap';
import type { UniverseSceneRuntime } from './universe-scene-bootstrap';
import type {
  SpaceStreamingCallbacks,
  SpaceStreamingCoordinator,
} from './space-streaming-coordinator';

export interface UniverseInitializationSceneOptions {
  readonly assets: LoadedUniverseAssets;
  readonly displayOptions: DisplayOptions;
  readonly pixelRatio: number;
  readonly initialTime: UniverseTime;
}

export interface UniverseInitializationDependencies {
  loadAssets(): Promise<LoadedUniverseAssets>;
  createSceneRuntime(options: UniverseInitializationSceneOptions): Promise<UniverseSceneRuntime>;
  createStreamingCoordinator(
    spaceTiles: UniverseSceneRuntime['catalogRuntime']['spaceTileManager'],
    starTiles: UniverseSceneRuntime['catalogRuntime']['starTileManager'],
    callbacks: SpaceStreamingCallbacks,
  ): SpaceStreamingCoordinator;
}

export type UniverseInitializationDependencyLoader = (
  performanceManager: PerformanceManager,
  coordinateSystem: CoordinateSystem,
) => Promise<UniverseInitializationDependencies>;

export interface UniverseInitializationOptions {
  readonly container: HTMLElement;
  readonly displayOptions: DisplayOptions;
  readonly initialTime: UniverseTime;
  isActive(): boolean;
  onSpaceTilesChanged(objects: readonly SpaceObject[]): void;
  onWarning(message: string): void;
}

export interface UniverseInitializationRuntime {
  readonly rendering: UniverseRenderingRuntime;
  readonly sceneRuntime: UniverseSceneRuntime;
  readonly streamingCoordinator: SpaceStreamingCoordinator;
  readonly warnings: readonly string[];
}

export interface UniverseRenderingFactory {
  create(container: HTMLElement, quality: DisplayOptions['quality']): UniverseRenderingRuntime;
}

export class UniverseInitializationBootstrap {
  constructor(
    private readonly renderingFactory: UniverseRenderingFactory,
    private readonly performanceManager: PerformanceManager,
    private readonly coordinateSystem: CoordinateSystem,
    private readonly loadDependencies: UniverseInitializationDependencyLoader = loadUniverseInitializationDependencies,
  ) {}

  public async create(
    options: UniverseInitializationOptions,
  ): Promise<UniverseInitializationRuntime> {
    const dependencies = await this.loadDependencies(
      this.performanceManager,
      this.coordinateSystem,
    );
    const assets = await dependencies.loadAssets();
    const rendering = this.renderingFactory.create(
      options.container,
      options.displayOptions.quality,
    );
    let sceneRuntime: UniverseSceneRuntime | null = null;

    try {
      sceneRuntime = await dependencies.createSceneRuntime({
        assets,
        displayOptions: options.displayOptions,
        pixelRatio: rendering.pixelRatio,
        initialTime: options.initialTime,
      });
      const activeSceneRuntime = sceneRuntime;
      const streamingCoordinator = dependencies.createStreamingCoordinator(
        activeSceneRuntime.catalogRuntime.spaceTileManager,
        activeSceneRuntime.catalogRuntime.starTileManager,
        {
          isActive: options.isActive,
          onSpaceTilesChanged: options.onSpaceTilesChanged,
          onStarTilesChanged: async (tiles) => {
            const starCatalog = activeSceneRuntime.catalogRuntime.starCatalogRegistry;

            if (starCatalog) {
              await activeSceneRuntime.scene.setStarClusterTiles(tiles, starCatalog);
            }
          },
          onWarning: options.onWarning,
        },
      );

      return {
        rendering,
        sceneRuntime: activeSceneRuntime,
        streamingCoordinator,
        warnings: assets.warnings,
      };
    } catch (error) {
      sceneRuntime?.registry.dispose();
      sceneRuntime?.scene.dispose();
      disposeRendering(rendering);
      throw error;
    }
  }

  public dispose(runtime: UniverseInitializationRuntime): void {
    runtime.streamingCoordinator.dispose();
    runtime.sceneRuntime.registry.dispose();
    runtime.sceneRuntime.scene.dispose();
    disposeRendering(runtime.rendering);
  }
}

async function loadUniverseInitializationDependencies(
  performanceManager: PerformanceManager,
  coordinateSystem: CoordinateSystem,
): Promise<UniverseInitializationDependencies> {
  const [
    { AssetLoader },
    { SpaceStreamingCoordinator },
    { createUniverseCatalogRuntime },
    { UniverseSceneBootstrap },
  ] = await Promise.all([
    import('../loaders/asset-loader'),
    import('./space-streaming-coordinator'),
    import('./universe-catalog-runtime'),
    import('./universe-scene-bootstrap'),
  ]);

  return {
    loadAssets: () => new AssetLoader().loadAssets(),
    createSceneRuntime: (options) =>
      new UniverseSceneBootstrap(performanceManager, coordinateSystem).create({
        ...options,
        createCatalogRuntime: createUniverseCatalogRuntime,
      }),
    createStreamingCoordinator: (spaceTiles, starTiles, callbacks) =>
      new SpaceStreamingCoordinator(spaceTiles, starTiles, callbacks),
  };
}

function disposeRendering(rendering: UniverseRenderingRuntime): void {
  rendering.lensingPass.dispose();
  rendering.renderer.renderLists.dispose();
  rendering.renderer.dispose();
  rendering.renderer.domElement.remove();
}
