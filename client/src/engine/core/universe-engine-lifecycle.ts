export class UniverseEngineInitializationCancelledError extends Error {
  constructor() {
    super('Initialisation de UniverseEngine annulée après sa destruction.');
    this.name = 'UniverseEngineInitializationCancelledError';
  }
}

export class UniverseEngineLifecycle {
  private active = false;
  private revision = 0;
  private initializationPromise: Promise<void> | null = null;

  public get initialized(): boolean {
    return this.active;
  }

  public initialize(operation: (revision: number) => Promise<void>): Promise<void> {
    if (this.active) {
      return Promise.resolve();
    }
    if (this.initializationPromise) {
      return this.initializationPromise;
    }
    const revision = this.revision;
    const initialization = operation(revision).finally(() => {
      if (this.initializationPromise === initialization) {
        this.initializationPromise = null;
      }
    });

    this.initializationPromise = initialization;

    return initialization;
  }

  public isCurrent(revision: number): boolean {
    return revision === this.revision;
  }

  public ensureCurrent(revision: number): void {
    if (!this.isCurrent(revision)) {
      throw new UniverseEngineInitializationCancelledError();
    }
  }

  public restoreInitialized(initialized: boolean): void {
    this.active = initialized;
  }

  public dispose(releaseResources: () => void): void {
    this.revision += 1;
    this.initializationPromise = null;
    this.active = false;
    releaseResources();
  }

  public requireInitialized(): void {
    if (!this.active) {
      throw new Error('UniverseEngine doit être initialisé avant son démarrage.');
    }
  }
}
