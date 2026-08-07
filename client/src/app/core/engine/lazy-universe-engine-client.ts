import type {
  AdaptiveRenderingStats,
  DisplayOptions,
  GraphicQuality,
  SpaceObject,
  UniverseEngineEvent,
  UniverseTime,
} from '../../../data/models/universe.models';
import type { NavigationScaleDefinition } from '../../../engine/camera/navigation-scales';
import type { EarthObserverFraming } from '../../../engine/camera/earth-observer-camera-control';
import type { NavigationDebugTraceEntry } from '../../../engine/core/navigation-debug-trace';
import type { ActiveObjectAdornmentDiagnostics } from '../../../engine/objects/active-object-adornment-controller';
import type { EarthObserverCelestialPresentation } from '../../../engine/objects/earth-observer-celestial-presenter';
import type { LabelNameResolver } from '../../../engine/objects/label-canvas-painter';
import type { ObjectVisualDiagnostics } from '../../../engine/objects/object-visual-diagnostics';
import { recommendGraphicQuality } from '../../../engine/performance/graphic-quality-recommendation';
import { UniverseStartupPerformanceTrace } from '../../../engine/performance/universe-startup-performance-trace';
import type { CosmicMapLayers } from '../../../engine/rendering/cosmic-map-policy';
import type { EarthEclipseEvent } from '../../../engine/simulation/earth-eclipse';
import type {
  StellarObservationCatalogEntry,
  StellarObservationConstellation,
} from '../../../engine/simulation/stellar-observation';
import { currentUniverseTime } from '../../../engine/simulation/time-utils';

export interface UniverseEngineClient {
  readonly currentTime: UniverseTime;
  readonly cameraDistance: number;
  readonly cameraTransitioning: boolean;
  readonly adaptiveRenderingStats: AdaptiveRenderingStats;
  readonly recommendedQuality: GraphicQuality;
  subscribe(listener: (event: UniverseEngineEvent) => void): () => void;
  initialize(container: HTMLElement, options?: Partial<DisplayOptions>): Promise<void>;
  start(): void;
  resize(width: number, height: number): void;
  dispose(): void;
  setTime(time: UniverseTime): void;
  setPlaying(playing: boolean): void;
  setTimeSpeed(daysPerSecond: number): void;
  ensureObjectAvailable(objectId: string): Promise<boolean>;
  resolveObject(objectId: string): Promise<SpaceObject | null>;
  setTarget(objectId: string, zoom?: number): Promise<void>;
  prepareEarthObservation(
    objectId: string,
    framing?: EarthObserverFraming,
    selectedObjectId?: string | null,
  ): Promise<void>;
  exitEarthObservation(): void;
  setEarthObserverCelestialPresentations(
    presentations: readonly EarthObserverCelestialPresentation[],
  ): void;
  completeTargetTransition(): void;
  viewRotation(objectId: string): Promise<void>;
  viewOrbit(objectId: string): void;
  viewScale(scale: NavigationScaleDefinition): void;
  viewSolarEclipse(event: EarthEclipseEvent): void;
  observeSolarEclipse(event: EarthEclipseEvent): void;
  setSolarEclipsePathVisible(event: EarthEclipseEvent, visible: boolean): void;
  clearSolarEclipsePresentation(): void;
  selectObject(objectId: string | null): void;
  setDisplayOptions(options: DisplayOptions): void;
  setLabelNameResolver(resolver: LabelNameResolver): void;
  setCosmicMapLayers(layers: CosmicMapLayers): void;
  zoomBy(factor: number): void;
  hasObject(objectId: string): boolean;
  getObjectAdornmentDiagnostics(objectId: string): ActiveObjectAdornmentDiagnostics | null;
  getObjectVisualDiagnostics(objectId: string): ObjectVisualDiagnostics | null;
  setNavigationDebugTracing(enabled: boolean): void;
  getNavigationDebugTrace(): readonly NavigationDebugTraceEntry[];
  clearNavigationDebugTrace(): void;
  getStellarObservationCatalog(maximumCount: number): readonly StellarObservationCatalogEntry[];
  getStellarObservationConstellations(): readonly StellarObservationConstellation[];
}

export type UniverseEngineClientLoader = (
  startupPerformance: UniverseStartupPerformanceTrace,
) => Promise<UniverseEngineClient>;

export class LazyUniverseEngineClient implements UniverseEngineClient {
  private readonly initialTime: UniverseTime;
  private readonly listeners: Set<(event: UniverseEngineEvent) => void>;
  private readonly loader: UniverseEngineClientLoader;
  private readonly recommendQuality: () => GraphicQuality;
  private engine: UniverseEngineClient | null = null;
  private loading: Promise<UniverseEngineClient> | null = null;
  private unsubscribeEngine: (() => void) | null = null;
  private labelNameResolver: LabelNameResolver;
  private earthObserverCelestialPresentations: readonly EarthObserverCelestialPresentation[] = [];
  private navigationDebugTracingEnabled = false;
  private lifecycleRevision = 0;

  constructor(
    loader: UniverseEngineClientLoader,
    recommendQuality: () => GraphicQuality = recommendGraphicQuality,
    private readonly startupPerformance = new UniverseStartupPerformanceTrace(),
  ) {
    this.loader = loader;
    this.recommendQuality = recommendQuality;
    this.initialTime = currentUniverseTime();
    this.listeners = new Set<(event: UniverseEngineEvent) => void>();
    this.labelNameResolver = (_objectId, fallback) => fallback;
  }

  public get currentTime(): UniverseTime {
    return this.engine?.currentTime ?? this.initialTime;
  }

  public get cameraDistance(): number {
    return this.engine?.cameraDistance ?? 0;
  }

  public get cameraTransitioning(): boolean {
    return this.engine?.cameraTransitioning ?? false;
  }

  public get adaptiveRenderingStats(): AdaptiveRenderingStats {
    return (
      this.engine?.adaptiveRenderingStats ?? {
        status: 'warming',
        p95FrameMs: null,
        longFrameRatio: null,
        targetPixelRatio: 1,
        currentPixelRatio: 1,
      }
    );
  }

  public get recommendedQuality(): GraphicQuality {
    return this.engine?.recommendedQuality ?? this.recommendQuality();
  }

  public subscribe(listener: (event: UniverseEngineEvent) => void): () => void {
    this.listeners.add(listener);

    return () => this.listeners.delete(listener);
  }

  public async initialize(
    container: HTMLElement,
    options?: Partial<DisplayOptions>,
  ): Promise<void> {
    const lifecycleRevision = this.lifecycleRevision;
    const engine = await this.loadEngine(lifecycleRevision);

    this.ensureCurrent(lifecycleRevision, engine);
    try {
      await engine.initialize(container, options);
      this.ensureCurrent(lifecycleRevision, engine);
    } catch (error) {
      this.startupPerformance.fail();
      throw error;
    }
  }

  public start(): void {
    this.run((engine) => engine.start());
  }

  public resize(width: number, height: number): void {
    this.run((engine) => engine.resize(width, height));
  }

  public dispose(): void {
    this.lifecycleRevision += 1;
    this.loading = null;
    this.unsubscribeEngine?.();
    this.unsubscribeEngine = null;
    const engine = this.engine;

    this.engine = null;
    engine?.dispose();
    this.startupPerformance.reset();
  }

  public setTime(time: UniverseTime): void {
    this.run((engine) => engine.setTime(time));
  }

  public setPlaying(playing: boolean): void {
    this.run((engine) => engine.setPlaying(playing));
  }

  public setTimeSpeed(daysPerSecond: number): void {
    this.run((engine) => engine.setTimeSpeed(daysPerSecond));
  }

  public ensureObjectAvailable(objectId: string): Promise<boolean> {
    return this.requireEngine().ensureObjectAvailable(objectId);
  }

  public resolveObject(objectId: string): Promise<SpaceObject | null> {
    return this.requireEngine().resolveObject(objectId);
  }

  public setTarget(objectId: string, zoom?: number): Promise<void> {
    return this.requireEngine().setTarget(objectId, zoom);
  }

  public prepareEarthObservation(
    objectId: string,
    framing?: EarthObserverFraming,
    selectedObjectId?: string | null,
  ): Promise<void> {
    return this.requireEngine().prepareEarthObservation(objectId, framing, selectedObjectId);
  }

  public exitEarthObservation(): void {
    this.run((engine) => engine.exitEarthObservation());
  }

  public setEarthObserverCelestialPresentations(
    presentations: readonly EarthObserverCelestialPresentation[],
  ): void {
    this.earthObserverCelestialPresentations = presentations;
    this.run((engine) => engine.setEarthObserverCelestialPresentations(presentations));
  }

  public completeTargetTransition(): void {
    this.run((engine) => engine.completeTargetTransition());
  }

  public viewRotation(objectId: string): Promise<void> {
    return this.requireEngine().viewRotation(objectId);
  }

  public viewOrbit(objectId: string): void {
    this.run((engine) => engine.viewOrbit(objectId));
  }

  public viewScale(scale: NavigationScaleDefinition): void {
    this.run((engine) => engine.viewScale(scale));
  }

  public viewSolarEclipse(event: EarthEclipseEvent): void {
    this.run((engine) => engine.viewSolarEclipse(event));
  }

  public observeSolarEclipse(event: EarthEclipseEvent): void {
    this.run((engine) => engine.observeSolarEclipse(event));
  }

  public setSolarEclipsePathVisible(event: EarthEclipseEvent, visible: boolean): void {
    this.run((engine) => engine.setSolarEclipsePathVisible(event, visible));
  }

  public clearSolarEclipsePresentation(): void {
    this.run((engine) => engine.clearSolarEclipsePresentation());
  }

  public selectObject(objectId: string | null): void {
    this.run((engine) => engine.selectObject(objectId));
  }

  public setDisplayOptions(options: DisplayOptions): void {
    this.run((engine) => engine.setDisplayOptions(options));
  }

  public setLabelNameResolver(resolver: LabelNameResolver): void {
    this.labelNameResolver = resolver;
    this.run((engine) => engine.setLabelNameResolver(resolver));
  }

  public setCosmicMapLayers(layers: CosmicMapLayers): void {
    this.run((engine) => engine.setCosmicMapLayers(layers));
  }

  public zoomBy(factor: number): void {
    this.run((engine) => engine.zoomBy(factor));
  }

  public hasObject(objectId: string): boolean {
    return this.engine?.hasObject(objectId) ?? false;
  }

  public getObjectAdornmentDiagnostics(objectId: string): ActiveObjectAdornmentDiagnostics | null {
    return this.engine?.getObjectAdornmentDiagnostics(objectId) ?? null;
  }

  public getObjectVisualDiagnostics(objectId: string): ObjectVisualDiagnostics | null {
    return this.engine?.getObjectVisualDiagnostics(objectId) ?? null;
  }

  public setNavigationDebugTracing(enabled: boolean): void {
    this.navigationDebugTracingEnabled = enabled;
    this.run((engine) => engine.setNavigationDebugTracing(enabled));
  }

  public getNavigationDebugTrace(): readonly NavigationDebugTraceEntry[] {
    return this.engine?.getNavigationDebugTrace() ?? [];
  }

  public clearNavigationDebugTrace(): void {
    this.run((engine) => engine.clearNavigationDebugTrace());
  }

  public getStellarObservationCatalog(
    maximumCount: number,
  ): readonly StellarObservationCatalogEntry[] {
    return this.engine?.getStellarObservationCatalog(maximumCount) ?? [];
  }

  public getStellarObservationConstellations(): readonly StellarObservationConstellation[] {
    return this.engine?.getStellarObservationConstellations() ?? [];
  }

  private async loadEngine(lifecycleRevision: number): Promise<UniverseEngineClient> {
    if (this.engine) {
      return this.engine;
    }
    if (!this.loading) {
      this.startupPerformance.begin();
      this.loading = this.createEngine(lifecycleRevision);
    }

    try {
      return await this.loading;
    } finally {
      this.loading = null;
    }
  }

  private async createEngine(lifecycleRevision: number): Promise<UniverseEngineClient> {
    let engine: UniverseEngineClient;

    try {
      engine = await this.loader(this.startupPerformance);
      this.startupPerformance.markEngineModuleLoaded();
    } catch (error) {
      this.startupPerformance.fail();
      throw error;
    }

    if (lifecycleRevision !== this.lifecycleRevision) {
      engine.dispose();
      throw new LazyUniverseEngineInitializationCancelledError();
    }
    this.engine = engine;
    engine.setLabelNameResolver(this.labelNameResolver);
    engine.setEarthObserverCelestialPresentations(this.earthObserverCelestialPresentations);
    engine.setNavigationDebugTracing(this.navigationDebugTracingEnabled);
    this.unsubscribeEngine = engine.subscribe((event) => this.emit(event));

    return engine;
  }

  private ensureCurrent(lifecycleRevision: number, engine: UniverseEngineClient): void {
    if (lifecycleRevision !== this.lifecycleRevision || engine !== this.engine) {
      throw new LazyUniverseEngineInitializationCancelledError();
    }
  }

  private requireEngine(): UniverseEngineClient {
    if (!this.engine) {
      throw new Error('Le moteur de l’univers n’est pas encore initialisé.');
    }

    return this.engine;
  }

  private run(command: (engine: UniverseEngineClient) => void): void {
    if (this.engine) {
      command(this.engine);
    }
  }

  private emit(event: UniverseEngineEvent): void {
    for (const listener of this.listeners) {
      listener(event);
    }
  }
}

export class LazyUniverseEngineInitializationCancelledError extends Error {
  constructor() {
    super('Le chargement du moteur de l’univers a été annulé.');
    this.name = 'LazyUniverseEngineInitializationCancelledError';
  }
}
