import {
  type TempelFilamentSceneInstallationMetrics,
  type TempelFilamentSpineSource,
} from '../../data/models/universe.models';
import { type CoordinateSystem } from '../coordinates/coordinate-system';
import { type TempelFilamentSpineCatalog } from '../loaders/tempel-filament-spine-catalog';
import { type CosmicStructureCatalogRegistry } from '../objects/cosmic-structure-catalog-registry';

export interface UniverseTempelFilamentScene {
  setTempelFilamentSpineCatalog(
    catalog: TempelFilamentSpineCatalog,
    registry: CosmicStructureCatalogRegistry,
    coordinateSystem: CoordinateSystem,
  ): Promise<TempelFilamentSceneInstallationMetrics>;
  selectCatalogObject(objectId: string | null): void;
  dispose(): void;
}

export interface UniverseTempelFilamentContext {
  readonly runtimeIdentity: object;
  readonly source: TempelFilamentSpineSource;
  readonly scene: UniverseTempelFilamentScene;
  readonly registry: CosmicStructureCatalogRegistry;
  readonly coordinateSystem: CoordinateSystem;
}

export interface UniverseTempelFilamentLoaderBindings {
  getContext(): UniverseTempelFilamentContext | null;
  isActive(): boolean;
  isContextCurrent(context: UniverseTempelFilamentContext): boolean;
  isSceneCurrent(scene: UniverseTempelFilamentScene): boolean;
  getSelectedId(): string | null;
  loadCatalog(source: TempelFilamentSpineSource): Promise<TempelFilamentSpineCatalog>;
  preloadRenderer(): Promise<void>;
  recordActivation(): void;
  recordInstallation(metrics: TempelFilamentSceneInstallationMetrics): void;
  recordFailure(): void;
  emitWarning(message: string): void;
}

export class UniverseTempelFilamentLoader {
  private catalogPromise: Promise<TempelFilamentSpineCatalog | null> | null = null;
  private rendererPromise: Promise<RendererPreloadResult> | null = null;
  private preloadPromise: Promise<void> | null = null;
  private installationPromise: Promise<void> | null = null;
  private activationRequested = false;

  constructor(private readonly bindings: UniverseTempelFilamentLoaderBindings) {}

  public get loadingPromise(): Promise<void> | null {
    return this.installationPromise;
  }

  public preload(): Promise<void> {
    if (this.preloadPromise) {
      return this.preloadPromise;
    }
    const context = this.bindings.getContext();

    if (!context) {
      return Promise.resolve();
    }
    this.catalogPromise = this.loadCatalog(context);
    this.rendererPromise ??= this.loadRenderer(true);
    this.preloadPromise = Promise.all([this.catalogPromise, this.rendererPromise]).then(
      () => undefined,
    );

    return this.preloadPromise;
  }

  public ensureLoaded(): Promise<void> {
    if (this.installationPromise) {
      return this.installationPromise;
    }
    const context = this.bindings.getContext();

    if (!context) {
      return Promise.resolve();
    }
    this.activationRequested = true;
    this.catalogPromise ??= this.loadCatalog(context);
    this.rendererPromise ??= this.loadRenderer(false);
    this.bindings.recordActivation();
    this.installationPromise = this.install(context, this.catalogPromise, this.rendererPromise);

    return this.installationPromise;
  }

  public reset(): void {
    this.catalogPromise = null;
    this.rendererPromise = null;
    this.preloadPromise = null;
    this.installationPromise = null;
    this.activationRequested = false;
  }

  private async loadCatalog(
    context: UniverseTempelFilamentContext,
  ): Promise<TempelFilamentSpineCatalog | null> {
    try {
      const catalog = await this.bindings.loadCatalog(context.source);

      if (!this.bindings.isContextCurrent(context)) {
        return null;
      }

      return catalog;
    } catch (error) {
      if (this.activationRequested) {
        this.handleFailure(error);
      } else {
        this.catalogPromise = null;
        this.preloadPromise = null;
      }

      return null;
    }
  }

  private async install(
    context: UniverseTempelFilamentContext,
    catalogPromise: Promise<TempelFilamentSpineCatalog | null>,
    rendererPromise: Promise<RendererPreloadResult>,
  ): Promise<void> {
    try {
      const [catalog, renderer] = await Promise.all([catalogPromise, rendererPromise]);

      if (!catalog || !this.bindings.isContextCurrent(context)) {
        return;
      }
      if (!renderer.loaded) {
        if (!renderer.speculative) {
          throw renderer.error;
        }
        this.rendererPromise = this.loadRenderer(false);
        const retry = await this.rendererPromise;

        if (!retry.loaded) {
          throw retry.error;
        }
      }
      const installation = await context.scene.setTempelFilamentSpineCatalog(
        catalog,
        context.registry,
        context.coordinateSystem,
      );

      if (!this.bindings.isSceneCurrent(context.scene)) {
        context.scene.dispose();

        return;
      }
      this.bindings.recordInstallation(installation);
      context.scene.selectCatalogObject(this.bindings.getSelectedId());
    } catch (error) {
      this.handleFailure(error);
    }
  }

  private async loadRenderer(speculative: boolean): Promise<RendererPreloadResult> {
    try {
      await this.bindings.preloadRenderer();

      return { loaded: true, speculative };
    } catch (error) {
      return { loaded: false, speculative, error };
    }
  }

  private handleFailure(error: unknown): void {
    this.bindings.recordFailure();
    if (this.bindings.isActive()) {
      const reason = error instanceof Error ? error.message : 'erreur inconnue';

      this.bindings.emitWarning(`Épines Tempel indisponibles : ${reason}`);
    }
  }
}

type RendererPreloadResult =
  | { readonly loaded: true; readonly speculative: boolean }
  | { readonly loaded: false; readonly speculative: boolean; readonly error: unknown };
