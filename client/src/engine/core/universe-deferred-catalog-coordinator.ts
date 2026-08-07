export interface DeferredCatalogRuntime {
  readonly hasDeferredCatalogs: boolean;
  installDeferredCatalogs(): Promise<readonly string[]>;
}

export interface UniverseDeferredCatalogCoordinatorBindings {
  getRuntime(): DeferredCatalogRuntime | null;
  hasObject(objectId: string): boolean;
  requiresDeferredCatalogs(objectId: string): boolean;
  isRuntimeCurrent(runtime: DeferredCatalogRuntime): boolean;
  refreshCatalogs(): void;
  emitWarning(message: string): void;
  schedule(callback: () => void): number;
  cancel(handle: number): void;
}

export class UniverseDeferredCatalogCoordinator {
  private scheduledHandle: number | null = null;
  private loading: Promise<void> | null = null;
  private revision = 0;

  constructor(private readonly bindings: UniverseDeferredCatalogCoordinatorBindings) {}

  public schedule(): void {
    const runtime = this.bindings.getRuntime();

    if (this.loading || this.scheduledHandle !== null || !runtime?.hasDeferredCatalogs) {
      return;
    }
    const revision = this.revision;

    this.scheduledHandle = this.bindings.schedule(() => {
      this.scheduledHandle = null;
      void this.load(runtime, revision);
    });
  }

  public async ensureObjectAvailable(objectId: string): Promise<boolean> {
    const runtime = this.bindings.getRuntime();
    const objectAvailable = this.bindings.hasObject(objectId);
    const requiresPendingCatalogs =
      this.bindings.requiresDeferredCatalogs(objectId) && runtime?.hasDeferredCatalogs === true;

    if (objectAvailable && !requiresPendingCatalogs) {
      return true;
    }

    if (!runtime?.hasDeferredCatalogs) {
      return false;
    }
    this.cancelScheduledLoad();
    await this.load(runtime, this.revision);

    return this.bindings.hasObject(objectId);
  }

  public reset(): void {
    this.revision += 1;
    this.cancelScheduledLoad();
    this.loading = null;
  }

  private load(runtime: DeferredCatalogRuntime, revision: number): Promise<void> {
    this.loading ??= this.install(runtime, revision);

    return this.loading;
  }

  private async install(runtime: DeferredCatalogRuntime, revision: number): Promise<void> {
    try {
      const warnings = await runtime.installDeferredCatalogs();

      if (!this.isCurrent(runtime, revision)) {
        return;
      }
      this.bindings.refreshCatalogs();
      for (const warning of warnings) {
        this.bindings.emitWarning(warning);
      }
    } catch (error) {
      if (this.isCurrent(runtime, revision)) {
        const reason = error instanceof Error ? error.message : 'erreur inconnue';

        this.bindings.emitWarning(`Catalogues complémentaires indisponibles : ${reason}`);
      }
    }
  }

  private isCurrent(runtime: DeferredCatalogRuntime, revision: number): boolean {
    return revision === this.revision && this.bindings.isRuntimeCurrent(runtime);
  }

  private cancelScheduledLoad(): void {
    if (this.scheduledHandle === null) {
      return;
    }
    this.bindings.cancel(this.scheduledHandle);
    this.scheduledHandle = null;
  }
}
