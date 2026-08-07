import type {
  DisplayOptions,
  GraphicQuality,
  NavigationState,
  UniverseEngineEvent,
  UniverseTime,
} from '../../../data/models/universe.models';
import type { CosmicMapLayers } from '../../../engine/rendering/cosmic-map-policy';

export interface UniverseEngineFacadeLifecycleEngine {
  readonly recommendedQuality: GraphicQuality;
  readonly currentTime: UniverseTime;
  subscribe(listener: (event: UniverseEngineEvent) => void): () => void;
  initialize(container: HTMLElement, options: Partial<DisplayOptions>): Promise<void>;
  setCosmicMapLayers(layers: CosmicMapLayers): void;
  setTime(time: UniverseTime): void;
  setTimeSpeed(daysPerSecond: number): void;
  ensureObjectAvailable(objectId: string): Promise<boolean>;
  hasObject(objectId: string): boolean;
  setTarget(objectId: string, zoom?: number): Promise<void>;
  completeTargetTransition(): void;
  selectObject(objectId: string | null): void;
  start(): void;
  dispose(): void;
}

export interface UniverseEngineFacadeLifecycleBindings {
  readNavigation(): Partial<NavigationState>;
  setDisplayOptions(options: DisplayOptions): void;
  getCosmicMapLayers(): CosmicMapLayers;
  getSpeed(): number;
  setCurrentTime(time: UniverseTime): void;
  handleEngineEvent(event: UniverseEngineEvent): void;
  presentCurrentSolarEclipse(): void;
  setReady(ready: boolean): void;
  setLoading(loading: boolean): void;
  setError(message: string): void;
  scheduleNavigationWrite(): void;
  describeInitializationError(error: unknown): string;
}

export class UniverseEngineFacadeLifecycle {
  private initialization: Promise<void> | null = null;
  private lifecycleRevision = 0;
  private unsubscribeEngine: (() => void) | null = null;

  constructor(
    private readonly engine: UniverseEngineFacadeLifecycleEngine,
    private readonly bindings: UniverseEngineFacadeLifecycleBindings,
  ) {}

  public initialize(container: HTMLElement): Promise<void> {
    if (this.initialization) {
      return this.initialization;
    }
    const lifecycleRevision = this.lifecycleRevision;

    this.initialization = this.initializeRuntime(container, lifecycleRevision);

    return this.initialization;
  }

  public dispose(): void {
    this.lifecycleRevision += 1;
    this.initialization = null;
    this.releaseSubscription();
    this.engine.dispose();
    this.bindings.setReady(false);
  }

  private async initializeRuntime(
    container: HTMLElement,
    lifecycleRevision: number,
  ): Promise<void> {
    try {
      const navigation = this.bindings.readNavigation();
      const unsubscribe = this.engine.subscribe((event) => this.bindings.handleEngineEvent(event));

      this.ensureCurrent(lifecycleRevision);
      this.unsubscribeEngine = unsubscribe;
      const options = this.createDisplayOptions(navigation);

      this.bindings.setDisplayOptions(options);
      await this.engine.initialize(container, options);
      this.ensureCurrent(lifecycleRevision);
      this.restoreEngineState(navigation);

      const requestedTarget = navigation.targetId ?? 'earth';

      await this.engine.ensureObjectAvailable(requestedTarget);
      this.ensureCurrent(lifecycleRevision);
      const target = this.engine.hasObject(requestedTarget) ? requestedTarget : 'earth';

      await this.engine.setTarget(target, navigation.zoom);
      this.ensureCurrent(lifecycleRevision);
      if (navigation.selectedId && navigation.selectedId !== requestedTarget) {
        await this.engine.ensureObjectAvailable(navigation.selectedId);
        this.ensureCurrent(lifecycleRevision);
      }
      this.engine.completeTargetTransition();
      this.restoreSelection(navigation);
      if (target === 'earth') {
        this.bindings.presentCurrentSolarEclipse();
      }

      this.engine.start();
      this.bindings.setReady(true);
      this.bindings.scheduleNavigationWrite();
    } catch (error) {
      if (!this.isCurrent(lifecycleRevision)) {
        return;
      }
      this.releaseSubscription();
      this.bindings.setError(this.bindings.describeInitializationError(error));
      this.bindings.setLoading(false);
    }
  }

  private createDisplayOptions(navigation: Partial<NavigationState>): DisplayOptions {
    return {
      showOrbits: navigation.showOrbits ?? true,
      showConstellations: navigation.showConstellations ?? true,
      showLabels: navigation.showLabels ?? true,
      quality: navigation.quality ?? this.engine.recommendedQuality,
      labelDensity: navigation.labelDensity ?? 'balanced',
      temporalMode: navigation.mode ?? 'state',
    };
  }

  private restoreEngineState(navigation: Partial<NavigationState>): void {
    this.engine.setCosmicMapLayers(this.bindings.getCosmicMapLayers());
    if (navigation.julianDay !== undefined) {
      this.engine.setTime({ julianDay: navigation.julianDay });
    } else {
      this.bindings.setCurrentTime(this.engine.currentTime);
    }
    this.engine.setTimeSpeed(this.bindings.getSpeed());
  }

  private restoreSelection(navigation: Partial<NavigationState>): void {
    if (
      navigation.selectedId === null ||
      (navigation.selectedId && navigation.selectedId !== navigation.targetId)
    ) {
      this.engine.selectObject(navigation.selectedId ?? null);
    }
  }

  private ensureCurrent(lifecycleRevision: number): void {
    if (!this.isCurrent(lifecycleRevision)) {
      throw new UniverseEngineFacadeLifecycleCancelledError();
    }
  }

  private isCurrent(lifecycleRevision: number): boolean {
    return lifecycleRevision === this.lifecycleRevision;
  }

  private releaseSubscription(): void {
    this.unsubscribeEngine?.();
    this.unsubscribeEngine = null;
  }
}

class UniverseEngineFacadeLifecycleCancelledError extends Error {
  constructor() {
    super('Initialisation de la façade UniverseEngine annulée.');
    this.name = 'UniverseEngineFacadeLifecycleCancelledError';
  }
}
