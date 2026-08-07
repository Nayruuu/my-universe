import * as THREE from 'three';
import type {
  DisplayOptions,
  GraphicQuality,
  SpaceObject,
  UniverseEngineEvent,
  UniverseTime,
} from '../../data/models/universe.models';
import type { CameraController, CameraSettledSource } from '../camera/camera-controller';
import type { NavigationScaleDefinition } from '../camera/navigation-scales';
import { CoordinateSystem } from '../coordinates/coordinate-system';
import { FloatingOriginManager } from '../coordinates/floating-origin-manager';
import { LodManager } from '../lod/lod-manager';
import type { ActiveObjectAdornmentDiagnostics } from '../objects/active-object-adornment-controller';
import type { LabelManager, LabelNameResolver, LabelObject } from '../objects/label-manager';
import { ObjectRegistry } from '../objects/object-registry';
import type { ObjectVisualDiagnostics } from '../objects/object-visual-diagnostics';
import { PerformanceManager } from '../performance/performance-manager';
import type { BlackHoleLensingPass } from '../rendering/black-hole-lensing-pass';
import type { CosmicMapLayers } from '../rendering/cosmic-map-policy';
import type { UniverseScene } from '../rendering/universe-scene';
import type { SelectionManager, ZoomPointer } from '../selection/selection-manager';
import type { EarthEclipseEvent } from '../simulation/earth-eclipse';
import { EarthRotationPlayback } from '../simulation/earth-rotation-playback';
import { TimeController } from '../simulation/time-controller';
import type { RenderLoop } from './render-loop';
import { SolarEclipseStatePublisher } from './solar-eclipse-state-publisher';
import { SolarEclipsePresentationController } from './solar-eclipse-presentation';
import { SolarEclipseViewController } from './solar-eclipse-view-controller';
import type { SpaceStreamingCoordinator } from './space-streaming-coordinator';
import type { UniverseCatalogRuntime } from './universe-catalog-runtime';
import { UniverseDebugRuntime } from './universe-debug-runtime';
import { UniverseDisplayRuntime } from './universe-display-runtime';
import { UniverseDynamicRegistryCoordinator } from './universe-dynamic-registry-coordinator';
import { UniverseFrameContent } from './universe-frame-content';
import { UniverseFrameNavigation } from './universe-frame-navigation';
import { UniverseFrameRenderer } from './universe-frame-renderer';
import { UniverseFrameRuntime } from './universe-frame-runtime';
import { UniverseFrameSimulation } from './universe-frame-simulation';
import { UniverseInitializationBootstrap } from './universe-initialization-bootstrap';
import { UniverseInteractionBootstrap } from './universe-interaction-bootstrap';
import { UniverseNavigationRuntime } from './universe-navigation-runtime';
import { UniverseObjectDirectory } from './universe-object-directory';
import { UniverseObjectRuntime } from './universe-object-runtime';
import { UniversePrimaryRegistryCoordinator } from './universe-primary-registry-coordinator';
import {
  UniverseRenderingBootstrap,
  type WebGlRendererConstructor,
} from './universe-rendering-bootstrap';
import { UniverseRuntimeDisposer } from './universe-runtime-disposer';
import { UniverseSelectionRuntime } from './universe-selection-runtime';
import { UniverseStreamingRuntime } from './universe-streaming-runtime';
import { UniverseTempelFilamentLoader } from './universe-tempel-filament-loader';
import { UniverseViewController } from './universe-view-controller';

export type UniverseEngineListener = (event: UniverseEngineEvent) => void;
export type { WebGlRendererConstructor } from './universe-rendering-bootstrap';

export class UniverseEngineInitializationCancelledError extends Error {
  constructor() {
    super('Initialisation de UniverseEngine annulée après sa destruction.');
    this.name = 'UniverseEngineInitializationCancelledError';
  }
}

export class UniverseEngine {
  private readonly listeners = new Set<UniverseEngineListener>();
  private readonly solarEclipseStatePublisher = new SolarEclipseStatePublisher((state) =>
    this.emit({ type: 'solar-eclipse-state', state }),
  );
  private readonly coordinateSystem = new CoordinateSystem();
  private readonly timeController = new TimeController();
  private readonly performanceManager = new PerformanceManager();
  private readonly lodManager = new LodManager();
  private readonly floatingOriginManager = new FloatingOriginManager();
  private readonly earthRotationPlayback = new EarthRotationPlayback();
  private readonly objectRuntime = new UniverseObjectRuntime();
  private readonly runtimeDisposer = new UniverseRuntimeDisposer();
  private readonly interactionBootstrap = new UniverseInteractionBootstrap({
    handleCameraSettled: (distance, source) => this.handleCameraSettled(distance, source),
    isObjectVisible: (objectId) => {
      if (this.universeScene?.hasConstellation(objectId)) {
        return this.displayOptions.showConstellations;
      }

      const registry = this.objectRuntime.getRegistry(objectId);
      const cosmicMapVisible =
        this.universeScene?.isCatalogObjectVisibleForLabels(objectId) ?? true;

      return cosmicMapVisible && (registry === null || registry.isVisibleForLabels(objectId));
    },
    getPickables: () => [
      ...this.objectRuntime.getPickables(),
      ...(this.universeScene?.getCatalogPickables() ?? []),
    ],
    handlePick: (objectId, focusRequested) => this.handlePick(objectId, focusRequested),
    handleNavigationIntent: (objectId) => this.handleNavigationIntent(objectId),
    getReferenceDistance: () => this.cameraController?.distanceToTarget ?? 1,
    isBackgroundObject: (objectId) =>
      this.catalogRuntime?.has(objectId) === true ||
      this.universeScene?.hasConstellation(objectId) === true ||
      this.getDefinition(objectId)?.type === 'galaxy',
    hoverObject: (objectId) => {
      this.universeScene?.hoverConstellation(objectId);
      this.universeScene?.hoverCatalogObject(objectId);
    },
    handleSemanticZoomIntent: (objectId, deltaY, pointer) =>
      this.handleSemanticZoomIntent(objectId, deltaY, pointer),
    supportsWheelNavigation: (objectId) =>
      this.objectRuntime.getRegistry(objectId) !== null ||
      this.catalogRuntime?.supportsWheelNavigation(objectId) === true,
    renderFrame: (deltaSeconds) => this.renderFrame(deltaSeconds),
  });
  private readonly displayRuntime = new UniverseDisplayRuntime({
    recommendQuality: () => this.performanceManager.recommendQuality(),
    setSceneQuality: (quality) => this.universeScene?.setQuality(quality),
    setConstellationsEnabled: (enabled) => this.universeScene?.setConstellationsEnabled(enabled),
    setLabelsEnabled: (enabled) => this.labelManager?.setEnabled(enabled),
    setLabelDensity: (density) => this.labelManager?.setDensity(density),
    resetPixelRatio: (quality) => this.performanceManager.resetAdaptivePixelRatio(quality),
    setScenePixelRatio: (pixelRatio) => this.universeScene?.setPixelRatio(pixelRatio),
    invalidateStreamingViews: () => this.streamingRuntime.coordinator?.invalidateViews(),
    shouldRebuildRegistry: () =>
      this.objectRuntime.primaryRegistry !== null && this.universeScene !== null,
    rebuildRegistry: () => this.rebuildObjectRegistry(),
    setLabelQuality: (quality) => this.labelManager?.setQuality(quality),
    applyRenderPixelRatio: (pixelRatio) => {
      const renderer = this.renderer;

      if (!renderer) {
        return;
      }
      renderer.setPixelRatio(pixelRatio);
      if (this.container) {
        this.resize(this.container.clientWidth, this.container.clientHeight);
      }
    },
    getLabelObjects: () => this.getLabelObjects(),
    setLabelObjects: (objects) => this.labelManager?.setObjects(objects),
    setObjectDisplayOptions: (options) => this.objectRuntime.setDisplayOptions(options),
    applyLabelNameResolver: (resolver) => this.labelManager?.setNameResolver(resolver),
  });
  private readonly objectDirectory = new UniverseObjectDirectory(this.objectRuntime, {
    getLoadedObjects: () => this.streamingRuntime.objects,
    getActiveExoplanetObjects: () => this.streamingRuntime.activeExoplanetSystemObjects,
    getCatalog: () => this.catalogRuntime,
    getScene: () => this.universeScene,
    hasStreamedObject: (objectId) => this.streamingRuntime.hasStreamedObject(objectId),
    getQuality: () => this.displayOptions.quality,
    getLabelDensity: () => this.displayOptions.labelDensity,
  });
  private readonly selectionRuntime = new UniverseSelectionRuntime({
    ensureActiveExoplanetSystem: (objectId) =>
      this.streamingRuntime.ensureActiveExoplanetSystem(objectId),
    getDefinition: (objectId) => this.getDefinition(objectId),
    hasDetailedObject: (objectId) => this.objectRuntime.has(objectId),
    isCatalogObject: (objectId) => this.catalogRuntime?.has(objectId) === true,
    isConstellation: (objectId) => this.universeScene?.hasConstellation(objectId) === true,
    selectDetailedObject: (objectId) => this.objectRuntime.select(objectId),
    selectCatalogObject: (objectId) => this.universeScene?.selectCatalogObject(objectId),
    selectConstellation: (objectId) => this.universeScene?.selectConstellation(objectId),
    setTransientObject: (object) => this.labelManager?.setTransientObject(object),
    setDetailsPanelVisible: (visible) => this.labelManager?.setDetailsPanelVisible(visible),
    ensureTempelFilamentSpines: () => void this.ensureTempelFilamentSpines(),
    emitSelected: (objectId, object) => this.emit({ type: 'object-selected', objectId, object }),
    setTarget: (objectId) => this.setTarget(objectId),
  });
  private readonly dynamicRegistryCoordinator = new UniverseDynamicRegistryCoordinator(
    this.objectRuntime,
    {
      createRegistry: (objects) => {
        const universeScene = this.universeScene;

        return universeScene
          ? new ObjectRegistry(
              universeScene.spaceRoot,
              this.coordinateSystem,
              objects,
              this.displayOptions.quality,
            )
          : null;
      },
      getCurrentTime: () => this.timeController.currentTime,
      getDisplayOptions: () => this.displayOptions,
      getTargetId: () => this.targetId,
      getSelectedId: () => this.selectedId,
    },
  );
  private readonly streamingRuntime = new UniverseStreamingRuntime({
    getExoplanetCatalog: () => this.catalogRuntime?.exoplanetCatalogRegistry ?? null,
    hasPrimaryObject: (objectId) => this.objectRuntime.primaryRegistry?.has(objectId) === true,
    hasActiveExoplanetHost: (hostId) =>
      this.objectRuntime.exoplanetSystemRegistry?.has(hostId) === true,
    rebuildExoplanetSystem: (objects) =>
      this.dynamicRegistryCoordinator.rebuildExoplanetSystem(objects),
    rebuildStreamedObjects: (objects) =>
      this.dynamicRegistryCoordinator.rebuildStreamedObjects(objects),
    refreshLabels: () => this.labelManager?.setObjects(this.getLabelObjects()),
    isInitialized: () => this.initialized,
    emitObjectsChanged: () =>
      this.emit({ type: 'objects-changed', objects: this.getPublicObjects() }),
    emitLoading: (loading) => this.emit({ type: 'loading-state', loading }),
  });
  private readonly primaryRegistryCoordinator = new UniversePrimaryRegistryCoordinator(
    this.objectRuntime,
    {
      createRegistry: () => {
        const universeScene = this.universeScene;

        return universeScene
          ? new ObjectRegistry(
              universeScene.spaceRoot,
              this.coordinateSystem,
              this.streamingRuntime.baseObjects,
              this.displayOptions.quality,
            )
          : null;
      },
      getCurrentTime: () => this.timeController.currentTime,
      getDisplayOptions: () => this.displayOptions,
      getTargetId: () => this.targetId,
      getSelectedId: () => this.selectedId,
      isCatalogObject: (objectId) => this.catalogRuntime?.has(objectId) === true,
      hasConstellation: (objectId) => this.universeScene?.hasConstellation(objectId) === true,
      selectCatalogObject: (objectId) => this.universeScene?.selectCatalogObject(objectId),
      selectConstellation: (objectId) => this.universeScene?.selectConstellation(objectId),
      resetRotationPlayback: (time) => this.frameSimulation.resetRotationPlayback(time),
      emitSolarEclipseState: (appearance) =>
        this.solarEclipseStatePublisher.publish(appearance, true),
      restoreSolarEclipsePresentation: (registry) =>
        this.solarEclipsePresentation.restore(registry),
      rebuildDynamicRegistries: () => this.streamingRuntime.rebuildDynamicRegistries(),
      followCurrentTarget: () => this.followCurrentTarget(),
    },
  );
  private readonly tempelFilamentLoader = new UniverseTempelFilamentLoader({
    getContext: () => {
      const catalogRuntime = this.catalogRuntime;
      const source = catalogRuntime?.tempelFilamentSpineSource;
      const scene = this.universeScene;
      const registry = catalogRuntime?.cosmicStructureCatalogRegistry;

      return catalogRuntime && source && scene && registry && this.initialized
        ? {
            runtimeIdentity: catalogRuntime,
            source,
            scene,
            registry,
            coordinateSystem: this.coordinateSystem,
          }
        : null;
    },
    isActive: () => this.initialized,
    isContextCurrent: (context) =>
      this.initialized &&
      this.catalogRuntime === context.runtimeIdentity &&
      this.universeScene === context.scene &&
      this.catalogRuntime.cosmicStructureCatalogRegistry === context.registry,
    isSceneCurrent: (scene) => this.initialized && this.universeScene === scene,
    getSelectedId: () => this.selectedId,
    loadCatalog: async (source) => {
      const { loadTempelFilamentSpineCatalog } =
        await import('../loaders/tempel-filament-spine-catalog');

      return loadTempelFilamentSpineCatalog(source);
    },
    emitWarning: (message) => this.emit({ type: 'performance-warning', message }),
  });
  private readonly frameContent = new UniverseFrameContent(this.objectRuntime, {
    getStreamingCoordinator: () => this.streamingRuntime.coordinator,
    getQuality: () => this.displayOptions.quality,
    getTargetId: () => this.targetId,
    getSelectedId: () => this.selectedId,
    ensureTempelFilamentSpines: () => this.ensureTempelFilamentSpines(),
  });
  private readonly frameNavigation = new UniverseFrameNavigation(
    this.floatingOriginManager,
    this.lodManager,
    {
      getQuality: () => this.displayOptions.quality,
      emitLodChanged: (level) => this.emit({ type: 'lod-changed', level }),
    },
  );
  private readonly frameSimulation = new UniverseFrameSimulation(
    this.timeController,
    this.earthRotationPlayback,
    {
      getExoplanetSystemRegistry: () => this.objectRuntime.exoplanetSystemRegistry,
      emitSolarEclipseState: (appearance, force) =>
        this.solarEclipseStatePublisher.publish(appearance, force),
      followCurrentTarget: () => this.followCurrentTarget(),
      emitTimeChanged: (time) => this.emit({ type: 'time-changed', time }),
    },
  );
  private readonly frameRenderer = new UniverseFrameRenderer({
    getTargetId: () => this.targetId,
    getSelectedId: () => this.selectedId,
    getQuality: () => this.displayOptions.quality,
    labelsAllowed: () => this.solarEclipsePresentation.labelsAllowed,
    getDefinition: (objectId) => this.getDefinition(objectId),
    getWorldPosition: (objectId, target) => this.getWorldPosition(objectId, target),
    getRegistry: (objectId) => this.objectRuntime.getRegistry(objectId),
    renderLabels: (camera, readWorldPosition, lodLevel, activeObjectId) =>
      this.labelManager?.render(camera, readWorldPosition, lodLevel, activeObjectId),
    clearLabels: () => this.labelManager?.clear(),
  });
  private readonly frameRuntime = new UniverseFrameRuntime(
    this.frameSimulation,
    this.frameNavigation,
    this.frameContent,
    this.frameRenderer,
    {
      getRenderer: () => this.renderer,
      getCamera: () => this.camera,
      getUniverseScene: () => this.universeScene,
      getRegistry: () => this.objectRuntime.primaryRegistry,
      getController: () => this.cameraController,
      getLensingPass: () => this.blackHoleLensingPass,
      getViewportSize: (renderer) => ({
        width: this.container?.clientWidth ?? renderer.domElement.clientWidth,
        height: this.container?.clientHeight ?? renderer.domElement.clientHeight,
      }),
      updateDebugStats: (deltaSeconds) => this.debugRuntime.update(deltaSeconds),
    },
  );
  private readonly navigationRuntime = new UniverseNavigationRuntime({
    hasPrimaryRegistry: () => this.objectRuntime.primaryRegistry !== null,
    getDefinition: (objectId) => this.getDefinition(objectId),
    getWorldPosition: (objectId, target) => this.getWorldPosition(objectId, target),
    setNavigationTarget: (objectId) => this.objectRuntime.setNavigationTarget(objectId),
    selectLodLevel: (cameraDistance) => this.lodManager.selectLevel(cameraDistance),
    emitTargetChanged: (objectId) => this.emit({ type: 'target-changed', objectId }),
  });
  private readonly debugRuntime = new UniverseDebugRuntime(
    this.objectRuntime,
    this.performanceManager,
    {
      getResources: () => {
        const renderer = this.renderer;
        const camera = this.camera;
        const universeScene = this.universeScene;

        return renderer && camera && universeScene && this.objectRuntime.primaryRegistry
          ? { renderer, camera, universeScene }
          : null;
      },
      getCameraTarget: () => this.cameraController?.controls.target ?? null,
      getCameraDistance: () => this.cameraController?.distanceToTarget ?? 0,
      getFloatingOrigin: () => this.floatingOriginManager.accumulatedOrigin,
      getTargetId: () => this.targetId,
      getNavigationContext: () => this.navigationRuntime.resolveContext(this.lodManager.level),
      getLodLevel: () => this.lodManager.level,
      getJulianDay: () => this.timeController.currentTime.julianDay,
      getQuality: () => this.displayOptions.quality,
      getPixelRatio: () => this.renderPixelRatio,
      getStreamingStats: () => this.streamingRuntime.coordinator?.stats ?? null,
      getZoomDiagnostics: () => this.cameraController?.lastZoomDiagnostics ?? null,
      getZoomAnchor: () => this.navigationRuntime.lastZoomAnchor,
      setPixelRatio: (pixelRatio) => {
        this.renderPixelRatio = pixelRatio;
      },
      resize: () => {
        if (this.container) {
          this.resize(this.container.clientWidth, this.container.clientHeight);
        }
      },
      emitStats: (stats) => this.emit({ type: 'debug-stats', stats }),
    },
  );
  private readonly solarEclipsePresentation = new SolarEclipsePresentationController();
  private readonly solarEclipseViewController = new SolarEclipseViewController(
    this.solarEclipsePresentation,
    {
      getRegistry: () => this.objectRuntime.primaryRegistry,
      getCameraController: () => this.cameraController,
      setTime: (time) => this.setTime(time),
      clearNavigationLock: () => this.selectionManager?.clearNavigationLock(),
      adoptTarget: (objectId) => this.navigationRuntime.adoptTarget(objectId),
      resetNavigation: () => this.navigationRuntime.reset(),
      setNavigationTarget: (objectId) => this.objectRuntime.setNavigationTarget(objectId),
      selectObject: (objectId) => this.selectObject(objectId),
      clearLabels: () => this.labelManager?.clear(),
      emitTargetChanged: (objectId) => this.emit({ type: 'target-changed', objectId }),
    },
  );
  private readonly viewController = new UniverseViewController({
    hasPrimaryRegistry: () => this.objectRuntime.primaryRegistry !== null,
    getPrimaryRegistry: () => this.objectRuntime.primaryRegistry,
    getRegistry: (objectId) => this.objectRuntime.getRegistry(objectId),
    getCameraController: () => this.cameraController,
    getVerticalFieldOfView: () => this.camera?.fov ?? null,
    hasObject: (objectId) => this.hasObject(objectId),
    getDefinition: (objectId) => this.getDefinition(objectId),
    getWorldPosition: (objectId) => this.getWorldPosition(objectId),
    getConstellationFocusRadius: (objectId) =>
      this.universeScene?.getConstellationFocusRadius(objectId),
    isExoplanetHost: (objectId) => this.catalogRuntime?.isExoplanetHost(objectId) === true,
    isCatalogStar: (objectId) => this.catalogRuntime?.isCatalogStar(objectId) === true,
    ensureSpaceTileObject: (objectId) => this.streamingRuntime.ensureSpaceTileObject(objectId),
    ensureActiveExoplanetSystem: (objectId) =>
      this.streamingRuntime.ensureActiveExoplanetSystem(objectId),
    ensureTempelFilamentSpines: () => this.ensureTempelFilamentSpines(),
    clearPresentation: () => this.clearSolarEclipsePresentation(),
    clearNavigationLock: () => this.selectionManager?.clearNavigationLock(),
    adoptTarget: (objectId) => this.navigationRuntime.adoptTarget(objectId),
    selectObject: (objectId) => this.selectObject(objectId),
    emitTargetChanged: (objectId) => this.emit({ type: 'target-changed', objectId }),
  });
  private renderer: THREE.WebGLRenderer | null = null;
  private camera: THREE.PerspectiveCamera | null = null;
  private universeScene: UniverseScene | null = null;
  private cameraController: CameraController | null = null;
  private labelManager: LabelManager | null = null;
  private catalogRuntime: UniverseCatalogRuntime | null = null;
  private selectionManager: SelectionManager | null = null;
  private renderLoop: RenderLoop | null = null;
  private blackHoleLensingPass: BlackHoleLensingPass | null = null;
  private container: HTMLElement | null = null;
  private initialized = false;
  private initializationPromise: Promise<void> | null = null;
  private lifecycleRevision = 0;
  private readonly initializationBootstrap: UniverseInitializationBootstrap;

  constructor(Renderer: WebGlRendererConstructor = THREE.WebGLRenderer) {
    this.initializationBootstrap = new UniverseInitializationBootstrap(
      new UniverseRenderingBootstrap(Renderer, this.performanceManager),
      this.performanceManager,
      this.coordinateSystem,
    );
  }

  private get targetId(): string | null {
    return this.navigationRuntime.targetId;
  }

  private set targetId(objectId: string | null) {
    this.navigationRuntime.restoreTarget(objectId);
  }

  private get selectedId(): string | null {
    return this.selectionRuntime.selectedId;
  }

  private set selectedId(objectId: string | null) {
    this.selectionRuntime.restoreSelectedId(objectId);
  }

  private get displayOptions(): DisplayOptions {
    return this.displayRuntime.options;
  }

  private get renderPixelRatio(): number {
    return this.displayRuntime.pixelRatio;
  }

  private set renderPixelRatio(pixelRatio: number) {
    this.displayRuntime.restorePixelRatio(pixelRatio);
  }

  private get labelNameResolver(): LabelNameResolver {
    return this.displayRuntime.labelNameResolver;
  }

  public initialize(
    container: HTMLElement,
    initialOptions?: Partial<DisplayOptions>,
  ): Promise<void> {
    if (this.initialized) {
      return Promise.resolve();
    }
    if (this.initializationPromise) {
      return this.initializationPromise;
    }
    const lifecycleRevision = this.lifecycleRevision;
    const initialization = this.initializeRuntime(
      container,
      lifecycleRevision,
      initialOptions,
    ).finally(() => {
      if (this.initializationPromise === initialization) {
        this.initializationPromise = null;
      }
    });

    this.initializationPromise = initialization;

    return initialization;
  }

  public start(): void {
    this.requireInitialized();
    this.renderLoop?.start();
  }

  public stop(): void {
    this.renderLoop?.stop();
  }

  public resize(width: number, height: number): void {
    if (!this.renderer || !this.camera || !this.blackHoleLensingPass || width <= 0 || height <= 0) {
      return;
    }
    this.camera.aspect = width / height;
    this.camera.updateProjectionMatrix();
    this.renderer.setSize(width, height, false);
    this.blackHoleLensingPass.setSize(
      width,
      height,
      this.renderPixelRatio,
      this.displayOptions.quality,
    );
    this.labelManager?.resize(width, height);
  }

  public dispose(): void {
    this.lifecycleRevision += 1;
    this.initializationPromise = null;
    this.releaseRuntimeResources();
    this.listeners.clear();
  }

  public setTime(time: UniverseTime): void {
    this.frameSimulation.setTime(time, this.objectRuntime.primaryRegistry);
  }

  public setPlaying(playing: boolean): void {
    this.timeController.setPlaying(playing);
  }

  public setTimeSpeed(daysPerSecond: number): void {
    this.timeController.setSpeed(daysPerSecond);
  }

  public async setTarget(objectId: string, zoom?: number): Promise<void> {
    await this.viewController.setTarget(objectId, zoom);
  }

  public completeTargetTransition(): void {
    this.viewController.completeTargetTransition();
  }

  public async viewRotation(objectId: string): Promise<void> {
    await this.viewController.viewRotation(objectId);
  }

  public viewOrbit(objectId: string): void {
    this.viewController.viewOrbit(objectId);
  }

  public viewScale(scale: NavigationScaleDefinition): void {
    this.viewController.viewScale(scale);
  }

  public viewSolarEclipse(event: EarthEclipseEvent): void {
    this.solarEclipseViewController.viewSolarEclipse(event);
  }

  public observeSolarEclipse(event: EarthEclipseEvent): void {
    this.solarEclipseViewController.observeSolarEclipse(event);
  }

  public setSolarEclipsePathVisible(event: EarthEclipseEvent, visible: boolean): void {
    this.solarEclipseViewController.setPathVisible(event, visible);
  }

  public clearSolarEclipsePresentation(): void {
    this.solarEclipseViewController.clearPresentation();
  }

  public selectObject(objectId: string | null): void {
    this.selectionRuntime.select(objectId);
  }

  public focusSelected(): void {
    this.selectionRuntime.focusSelected();
  }

  public setDisplayOptions(options: DisplayOptions): void {
    this.displayRuntime.apply(options);
  }

  public setLabelNameResolver(resolver: LabelNameResolver): void {
    this.displayRuntime.setLabelNameResolver(resolver);
  }

  public setCosmicMapLayers(layers: CosmicMapLayers): void {
    this.universeScene?.setCosmicMapLayers(layers);
    if (layers.filaments && this.lodManager.level >= 6) {
      void this.ensureTempelFilamentSpines();
    }
  }

  public zoomBy(factor: number): void {
    this.navigationRuntime.zoomBy(this.cameraController, factor);
  }

  public subscribe(listener: UniverseEngineListener): () => void {
    this.listeners.add(listener);

    return () => this.listeners.delete(listener);
  }

  public get currentTime(): UniverseTime {
    return this.timeController.currentTime;
  }

  public get isPlaying(): boolean {
    return this.timeController.isPlaying;
  }

  public get timeSpeed(): number {
    return this.timeController.speed;
  }

  public get cameraDistance(): number {
    return this.cameraController?.distanceToTarget ?? 0;
  }

  public get allObjects(): readonly SpaceObject[] {
    return this.getPublicObjects();
  }

  public hasObject(objectId: string): boolean {
    return this.objectDirectory.has(objectId);
  }

  public getObjectAdornmentDiagnostics(objectId: string): ActiveObjectAdornmentDiagnostics | null {
    return this.objectRuntime.getRegistry(objectId)?.getAdornmentDiagnostics() ?? null;
  }

  public getObjectVisualDiagnostics(objectId: string): ObjectVisualDiagnostics | null {
    return this.objectRuntime.getVisualDiagnostics(objectId);
  }

  public get recommendedQuality(): GraphicQuality {
    return this.performanceManager.recommendQuality();
  }

  private async initializeRuntime(
    container: HTMLElement,
    lifecycleRevision: number,
    initialOptions?: Partial<DisplayOptions>,
  ): Promise<void> {
    this.container = container;
    this.emit({ type: 'loading-state', loading: true });

    try {
      this.displayRuntime.configureInitial(initialOptions);
      const initialTime = this.timeController.currentTime;
      const initialization = await this.initializationBootstrap.create({
        container,
        displayOptions: this.displayOptions,
        initialTime,
        isActive: () => this.initialized,
        onSpaceTilesChanged: (objects) => this.streamingRuntime.applyLoadedSpaceTiles(objects),
        onWarning: (message) => this.emit({ type: 'performance-warning', message }),
      });

      if (lifecycleRevision !== this.lifecycleRevision) {
        this.initializationBootstrap.dispose(initialization);
        throw new UniverseEngineInitializationCancelledError();
      }
      const { renderer, camera, lensingPass, pixelRatio } = initialization.rendering;
      const { sceneRuntime, streamingCoordinator } = initialization;

      this.renderPixelRatio = pixelRatio;
      this.renderer = renderer;
      this.blackHoleLensingPass = lensingPass;
      this.camera = camera;
      const { scene: universeScene, catalogRuntime, registry } = sceneRuntime;

      this.catalogRuntime = catalogRuntime;
      this.universeScene = universeScene;
      this.frameSimulation.resetRotationPlayback(initialTime);
      this.solarEclipseStatePublisher.publish(sceneRuntime.solarEclipseAppearance, true);
      this.objectRuntime.replacePrimary(registry);

      this.streamingRuntime.install(sceneRuntime.baseObjects, streamingCoordinator);
      const interactionRuntime = this.interactionBootstrap.create({
        container,
        canvas: renderer.domElement,
        camera,
        labelObjects: this.getLabelObjects(),
        quality: this.displayOptions.quality,
        labelDensity: this.displayOptions.labelDensity,
        labelsEnabled: this.displayOptions.showLabels,
        labelNameResolver: this.labelNameResolver,
      });

      this.cameraController = interactionRuntime.cameraController;
      this.labelManager = interactionRuntime.labelManager;
      this.selectionManager = interactionRuntime.selectionManager;
      this.renderLoop = interactionRuntime.renderLoop;

      this.resize(container.clientWidth, container.clientHeight);
      this.initialized = true;
      this.emitDataReady(streamingCoordinator);
      for (const warning of initialization.warnings) {
        this.emit({ type: 'performance-warning', message: warning });
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Erreur inconnue du moteur 3D.';

      if (lifecycleRevision === this.lifecycleRevision) {
        this.releaseRuntimeResources();
        this.emit({ type: 'error', message });
      }
      throw error;
    } finally {
      if (lifecycleRevision === this.lifecycleRevision) {
        this.emit({ type: 'loading-state', loading: false });
      }
    }
  }

  private releaseRuntimeResources(): void {
    this.stop();
    this.runtimeDisposer.dispose(
      [
        this.streamingRuntime.coordinator,
        this.selectionManager,
        this.cameraController,
        this.labelManager,
        this.objectRuntime,
        this.universeScene,
        this.blackHoleLensingPass,
      ],
      this.renderer,
    );

    this.selectionManager = null;
    this.cameraController = null;
    this.labelManager = null;
    this.catalogRuntime = null;
    this.tempelFilamentLoader.reset();
    this.streamingRuntime.reset();
    this.universeScene = null;
    this.renderer = null;
    this.camera = null;
    this.renderLoop = null;
    this.blackHoleLensingPass = null;
    this.debugRuntime.reset();
    this.container = null;
    this.navigationRuntime.reset();
    this.selectedId = null;
    this.solarEclipseViewController.clearPresentation();
    this.solarEclipseStatePublisher.reset();
    this.initialized = false;
  }

  private readonly handleSemanticZoomIntent = (
    objectId: string | null,
    deltaY: number,
    pointer: ZoomPointer = { x: 0, y: 0 },
  ): void => {
    this.navigationRuntime.handleSemanticZoomIntent(
      this.cameraController,
      objectId,
      deltaY,
      pointer,
    );
  };

  private synchronizeNavigationContextTarget(controller: CameraController, lodLevel: number): void {
    this.navigationRuntime.synchronizeContext(controller, lodLevel);
  }

  private readonly handleCameraSettled = (distance: number, source: CameraSettledSource): void => {
    this.emit({ type: 'camera-changed', zoom: distance });
    const controller = this.cameraController;

    if (!controller || source !== 'pinch' || controller.isTransitioning) {
      return;
    }
    this.synchronizeNavigationContextTarget(controller, this.lodManager.selectLevel(distance));
  };

  private renderFrame(deltaSeconds: number): void {
    this.frameRuntime.render(deltaSeconds);
  }

  private followCurrentTarget(): void {
    this.navigationRuntime.follow(this.cameraController);
  }

  private handlePick(objectId: string | null, focusRequested: boolean): void {
    if (objectId && focusRequested) {
      void this.setTarget(objectId);

      return;
    }
    this.selectObject(objectId);
  }

  private handleNavigationIntent(objectId: string | null): void {
    if (!objectId) {
      this.releaseNavigationTarget();

      return;
    }
    this.streamingRuntime.ensureActiveExoplanetSystem(objectId);
    this.navigationRuntime.handleNavigationIntent(this.cameraController, objectId);
  }

  private releaseNavigationTarget(): void {
    this.navigationRuntime.releaseTarget(this.cameraController);
  }

  private rebuildObjectRegistry(): void {
    this.primaryRegistryCoordinator.rebuild();
  }

  private ensureTempelFilamentSpines(): Promise<void> {
    return this.tempelFilamentLoader.ensureLoaded();
  }

  private getLabelObjects(): LabelObject[] {
    return this.objectDirectory.getLabelObjects();
  }

  private emitDataReady(streamingCoordinator: SpaceStreamingCoordinator): void {
    const payload = this.objectDirectory.createDataReadyPayload(streamingCoordinator);

    this.emit({
      type: 'data-ready',
      ...payload,
    });
  }

  private getDefinition(objectId: string): SpaceObject | undefined {
    return this.objectDirectory.getDefinition(objectId);
  }

  private getWorldPosition(objectId: string, target = new THREE.Vector3()): THREE.Vector3 | null {
    return this.objectDirectory.getWorldPosition(objectId, target);
  }

  private getPublicObjects(): SpaceObject[] {
    return this.objectDirectory.getPublicObjects();
  }

  private emit(event: UniverseEngineEvent): void {
    for (const listener of this.listeners) {
      listener(event);
    }
  }

  private requireInitialized(): void {
    if (!this.initialized) {
      throw new Error('UniverseEngine doit être initialisé avant son démarrage.');
    }
  }
}
