import { type TempelFilamentSpineSource } from '../../data/models/universe.models';
import { type CoordinateSystem } from '../coordinates/coordinate-system';
import { type TempelFilamentSpineCatalog } from '../loaders/tempel-filament-spine-catalog';
import { type CosmicStructureCatalogRegistry } from '../objects/cosmic-structure-catalog-registry';

export interface UniverseTempelFilamentScene {
  setTempelFilamentSpineCatalog(
    catalog: TempelFilamentSpineCatalog,
    registry: CosmicStructureCatalogRegistry,
    coordinateSystem: CoordinateSystem,
  ): Promise<void>;
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
  emitWarning(message: string): void;
}

export class UniverseTempelFilamentLoader {
  private loadPromise: Promise<void> | null = null;

  constructor(private readonly bindings: UniverseTempelFilamentLoaderBindings) {}

  public get loadingPromise(): Promise<void> | null {
    return this.loadPromise;
  }

  public ensureLoaded(): Promise<void> {
    if (this.loadPromise) {
      return this.loadPromise;
    }
    const context = this.bindings.getContext();

    if (!context) {
      return Promise.resolve();
    }
    this.loadPromise = this.load(context);

    return this.loadPromise;
  }

  public reset(): void {
    this.loadPromise = null;
  }

  private async load(context: UniverseTempelFilamentContext): Promise<void> {
    try {
      const catalog = await this.bindings.loadCatalog(context.source);

      if (!this.bindings.isContextCurrent(context)) {
        return;
      }
      await context.scene.setTempelFilamentSpineCatalog(
        catalog,
        context.registry,
        context.coordinateSystem,
      );
      if (!this.bindings.isSceneCurrent(context.scene)) {
        context.scene.dispose();

        return;
      }
      context.scene.selectCatalogObject(this.bindings.getSelectedId());
    } catch (error) {
      if (this.bindings.isActive()) {
        const reason = error instanceof Error ? error.message : 'erreur inconnue';

        this.bindings.emitWarning(`Épines Tempel indisponibles : ${reason}`);
      }
    }
  }
}
