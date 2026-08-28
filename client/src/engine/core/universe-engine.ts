import * as THREE from 'three';
import type {
  AdaptiveRenderingStats,
  DisplayOptions,
  GraphicQuality,
  SpaceObject,
  UniverseEngineEvent,
  UniverseTime,
  Vector3Like,
} from '../../data/models/universe.models';
import type { CameraController, CameraSettledSource } from '../camera/camera-controller';
import { CameraViewportVisibility } from '../camera/camera-viewport-visibility';
import type { EarthObserverFraming } from '../camera/earth-observer-camera-control';
import type { NavigationScaleDefinition } from '../camera/navigation-scales';
import type { WheelZoomInputMetadata } from '../camera/wheel-zoom-normalizer';
import { CoordinateSystem } from '../coordinates/coordinate-system';
import { FloatingOriginManager } from '../coordinates/floating-origin-manager';
import { LodManager } from '../lod/lod-manager';
import type { ActiveObjectAdornmentDiagnostics } from '../objects/active-object-adornment-controller';
import type { EarthObserverCelestialPresentation } from '../objects/earth-observer-celestial-presenter';
import type { LabelManager, LabelNameResolver, LabelObject } from '../objects/label-manager';
import { ObjectRegistry } from '../objects/object-registry';
import type { ObjectVisualDiagnostics } from '../objects/object-visual-diagnostics';
import { PerformanceManager } from '../performance/performance-manager';
import { TempelFilamentPerformanceTrace } from '../performance/tempel-filament-performance-trace';
import { UniverseStartupPerformanceTrace } from '../performance/universe-startup-performance-trace';
import type { BlackHoleLensingPass } from '../rendering/black-hole-lensing-pass';
import type { CosmicMapLayers } from '../rendering/cosmic-map-policy';
import type { UniverseScene } from '../rendering/universe-scene';
import type {
  SelectionManager,
  WheelAnchorDisposition,
  ZoomPointer,
} from '../selection/selection-manager';
import type { EarthEclipseEvent } from '../simulation/earth-eclipse';
import type {
  StellarObservationCatalogEntry,
  StellarObservationConstellation,
} from '../simulation/stellar-observation';
import { TimeController } from '../simulation/time-controller';
import type { RenderLoop } from './render-loop';
import { SolarEclipseStatePublisher } from './solar-eclipse-state-publisher';
import { SolarEclipsePresentationController } from './solar-eclipse-presentation';
import { SolarEclipseViewController } from './solar-eclipse-view-controller';
import type { SpaceStreamingCoordinator } from './space-streaming-coordinator';
import type { UniverseCatalogRuntime } from './universe-catalog-runtime';
import { UniverseDebugRuntime } from './universe-debug-runtime';
import { UniverseDeferredCatalogCoordinator } from './universe-deferred-catalog-coordinator';
import { UniverseAdaptiveRenderingRuntime } from './universe-adaptive-rendering-runtime';
import { UniverseDisplayRuntime } from './universe-display-runtime';
import { UniverseDynamicRegistryCoordinator } from './universe-dynamic-registry-coordinator';
import { UniverseEngineLifecycle } from './universe-engine-lifecycle';
import { UniverseFrameContent } from './universe-frame-content';
import { UniverseFrameNavigation } from './universe-frame-navigation';
import { UniverseFrameRenderer } from './universe-frame-renderer';
import { UniverseFrameRuntime } from './universe-frame-runtime';
import { UniverseFrameSimulation } from './universe-frame-simulation';
import { UniverseInitializationBootstrap } from './universe-initialization-bootstrap';
import { UniverseInteractionBootstrap } from './universe-interaction-bootstrap';
import type { NavigationDebugState, NavigationDebugTraceEntry } from './navigation-debug-trace';
import { UniverseNavigationDebugRuntime } from './universe-navigation-debug-runtime';
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
export { UniverseEngineInitializationCancelledError } from './universe-engine-lifecycle';

const DEFERRED_CATALOG_SCALE_TARGETS = new Set(['local-group', 'nearby-universe', 'cosmic-web']);
const NAVIGATION_TARGET_VIEWPORT_OVERSCAN_NDC = 0.05;

export class UniverseEngine {
  private readonly listeners = new Set<UniverseEngineListener>();
  private readonly solarEclipseStatePublisher = new SolarEclipseStatePublisher((state) =>
    this.emit({ type: 'solar-eclipse-state', state }),
  );
  private readonly coordinateSystem = new CoordinateSystem();
  private readonly timeController = new TimeController();
  private readonly performanceManager = new PerformanceManager();
  private readonly tempelFilamentPerformance = new TempelFilamentPerformanceTrace();
  private readonly lodManager = new LodManager();
  private readonly floatingOriginManager = new FloatingOriginManager();
  private readonly cameraViewportVisibility = new CameraViewportVisibility();
  private readonly navigationTargetWorldPosition = new THREE.Vector3();
  private readonly objectRuntime = new UniverseObjectRuntime();
  private readonly runtimeDisposer = new UniverseRuntimeDisposer();
  private readonly lifecycle = new UniverseEngineLifecycle();
  private readonly interactionBootstrap = new UniverseInteractionBootstrap({
    handleCameraSettled: (distance, source) => this.handleCameraSettled(distance, source),
    isObjectVisible: (objectId) => {
      if (this.universeScene?.hasConstellation(objectId)) {
        return (
          this.displayOptions.showConstellations &&
          (this.universeScene.isCatalogObjectVisibleForLabels(objectId) ?? true)
        );
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
    handleSemanticZoomIntent: (objectId, deltaY, pointer, metadata) =>
      this.handleSemanticZoomIntent(objectId, deltaY, pointer, metadata),
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
      this.tempelFilamentPerformance.begin();
      const { loadTempelFilamentSpineCatalogOffThread } =
        await import('../loaders/tempel-filament-spine-worker-loader');

      return loadTempelFilamentSpineCatalogOffThread(source, {
        onTelemetry: (telemetry) => this.tempelFilamentPerformance.recordLoad(telemetry),
      });
    },
    preloadRenderer: async () => {
      await import('../rendering/tempel-filament-spine-batch');
    },
    recordActivation: () => this.tempelFilamentPerformance.activate(),
    recordInstallation: (metrics) => this.tempelFilamentPerformance.recordInstallation(metrics),
    recordFailure: () => this.tempelFilamentPerformance.fail(),
    emitWarning: (message) => this.emit({ type: 'performance-warning', message }),
  });
  private readonly frameContent = new UniverseFrameContent(this.objectRuntime, {
    getStreamingCoordinator: () => this.streamingRuntime.coordinator,
    getQuality: () => this.displayOptions.quality,
    getTargetId: () => this.targetId,
    getSelectedId: () => this.selectedId,
    followCurrentTarget: () => this.followCurrentTarget(),
    preloadTempelFilamentSpines: () => this.preloadTempelFilamentSpines(),
    ensureTempelFilamentSpines: () => this.ensureTempelFilamentSpines(),
  });
  private readonly frameNavigation = new UniverseFrameNavigation(
    this.floatingOriginManager,
    this.lodManager,
    {
      getQuality: () => this.displayOptions.quality,
      getCurrentTime: () => this.timeController.currentTime,
      updateCameraGuide: () => this.navigationRuntime.updateCameraGuide(this.cameraController),
      emitLodChanged: (level) => this.emit({ type: 'lod-changed', level }),
    },
  );
  private readonly frameSimulation = new UniverseFrameSimulation(this.timeController, {
    getExoplanetSystemRegistry: () => this.objectRuntime.exoplanetSystemRegistry,
    getTemporalMode: () => this.displayOptions.temporalMode,
    updateStellarCatalog: (time, temporalMode) =>
      this.universeScene?.updateStellarCatalog(time, temporalMode),
    emitSolarEclipseState: (appearance, force) =>
      this.solarEclipseStatePublisher.publish(appearance, force),
    followCurrentTarget: () => this.followCurrentTarget(),
    emitTimeChanged: (time) => this.emit({ type: 'time-changed', time }),
  });
  private readonly frameRenderer = new UniverseFrameRenderer({
    getTargetId: () => this.targetId,
    getSelectedId: () => this.selectedId,
    getQuality: () => this.displayOptions.quality,
    getCameraDistance: () => this.cameraController?.distanceToTarget ?? 0,
    labelsAllowed: () => this.solarEclipsePresentation.labelsAllowed,
    isObserverModeActive: () => this.cameraController?.observerPresentationActive ?? false,
    isObserverSkyObject: (objectId) =>
      this.catalogRuntime?.isCatalogStar(objectId) === true ||
      this.catalogRuntime?.isExoplanetHost(objectId) === true ||
      this.universeScene?.hasConstellation(objectId) === true,
    getDefinition: (objectId) => this.getDefinition(objectId),
    getWorldPosition: (objectId, target) => this.getWorldPosition(objectId, target),
    getRegistry: (objectId) => this.objectRuntime.getRegistry(objectId),
    isCameraTransitioning: () => this.cameraController?.isTransitioning ?? false,
    setLabelsTransitioning: (transitioning) => this.labelManager?.setTransitioning(transitioning),
    renderLabels: (
      camera,
      readWorldPosition,
      lodLevel,
      activeObjectId,
      stellarNeighborhoodReveal,
      galacticContextLabelOpacity,
    ) =>
      this.labelManager?.render(
        camera,
        readWorldPosition,
        lodLevel,
        activeObjectId,
        undefined,
        stellarNeighborhoodReveal,
        galacticContextLabelOpacity,
      ),
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
      updateAdaptiveRendering: (deltaSeconds) => this.adaptiveRenderingRuntime.update(deltaSeconds),
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
  private readonly navigationDebugRuntime = new UniverseNavigationDebugRuntime({
    getAnchor: () => this.navigationRuntime.lastZoomAnchor,
    getZoom: () => this.cameraController?.lastZoomDiagnostics ?? null,
  });
  private readonly adaptiveRenderingRuntime = new UniverseAdaptiveRenderingRuntime(
    this.performanceManager,
    {
      getResources: () => {
        const renderer = this.renderer;
        const universeScene = this.universeScene;

        return renderer && universeScene ? { renderer, universeScene } : null;
      },
      getQuality: () => this.displayOptions.quality,
      isSamplingPaused: () =>
        (this.cameraController?.isTransitioning ?? false) || document.visibilityState !== 'visible',
      setPixelRatio: (pixelRatio) => {
        this.renderPixelRatio = pixelRatio;
      },
      resize: () => {
        if (this.container) {
          this.resize(this.container.clientWidth, this.container.clientHeight);
        }
      },
    },
  );
  private readonly debugRuntime = new UniverseDebugRuntime(this.objectRuntime, {
    getResources: () => {
      const renderer = this.renderer;
      const camera = this.camera;
      const universeScene = this.universeScene;

      return renderer && camera && universeScene && this.objectRuntime.primaryRegistry
        ? {
            renderer,
            camera,
            universeScene,
            getGaiaPresentationStats: () => universeScene.getGaiaPresentationStats(camera),
          }
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
    getAdaptiveRendering: () => this.adaptiveRenderingRuntime.stats,
    getStreamingStats: () => this.streamingRuntime.coordinator?.stats ?? null,
    getZoomDiagnostics: () => this.cameraController?.lastZoomDiagnostics ?? null,
    getZoomAnchor: () => this.navigationRuntime.lastZoomAnchor,
    getTempelPerformance: () => this.tempelFilamentPerformance.snapshot,
    getStartupPerformance: () => this.startupPerformance.snapshot,
    emitStats: (stats) => this.emit({ type: 'debug-stats', stats }),
  });
  private readonly deferredCatalogCoordinator = new UniverseDeferredCatalogCoordinator({
    getRuntime: () => this.catalogRuntime,
    hasObject: (objectId) => this.hasObject(objectId),
    requiresDeferredCatalogs: (objectId) => DEFERRED_CATALOG_SCALE_TARGETS.has(objectId),
    isRuntimeCurrent: (runtime) => this.initialized && this.catalogRuntime === runtime,
    canInstallInBackground: () =>
      this.displayOptions.temporalMode !== 'observable' &&
      this.cameraController?.isTransitioning !== true,
    refreshCatalogs: () => {
      const coordinator = this.streamingRuntime.coordinator;

      this.labelManager?.setObjects(this.getLabelObjects());
      if (coordinator) {
        this.emitDataReady(coordinator);
      }
    },
    emitWarning: (message) => this.emit({ type: 'performance-warning', message }),
    schedule: (callback) => window.setTimeout(callback, 1_200),
    cancel: (handle) => window.clearTimeout(handle),
  });
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
  private readonly initializationBootstrap: UniverseInitializationBootstrap;

  constructor(
    Renderer: WebGlRendererConstructor = THREE.WebGLRenderer,
    private readonly startupPerformance = new UniverseStartupPerformanceTrace(),
  ) {
    this.initializationBootstrap = new UniverseInitializationBootstrap(
      new UniverseRenderingBootstrap(Renderer, this.performanceManager),
      this.performanceManager,
      this.coordinateSystem,
      undefined,
      this.startupPerformance,
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

  private get initialized(): boolean {
    return this.lifecycle.initialized;
  }

  private set initialized(initialized: boolean) {
    this.lifecycle.restoreInitialized(initialized);
  }

  public initialize(
    container: HTMLElement,
    initialOptions?: Partial<DisplayOptions>,
  ): Promise<void> {
    return this.lifecycle.initialize((revision) =>
      this.initializeRuntime(container, revision, initialOptions),
    );
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
    this.lifecycle.dispose(() => this.releaseRuntimeResources());
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

  public async prepareEarthObservation(
    objectId: string,
    framing?: EarthObserverFraming,
    selectedObjectId?: string | null,
  ): Promise<void> {
    await this.viewController.prepareEarthObservation(objectId, framing, selectedObjectId);
  }

  public exitEarthObservation(): void {
    this.releaseNavigationTarget();
  }

  public setEarthObserverCelestialPresentations(
    presentations: readonly EarthObserverCelestialPresentation[],
  ): void {
    this.objectRuntime.setEarthObserverCelestialPresentations(presentations);
  }

  public ensureObjectAvailable(objectId: string): Promise<boolean> {
    return this.deferredCatalogCoordinator.ensureObjectAvailable(objectId);
  }

  public async resolveObject(objectId: string): Promise<SpaceObject | null> {
    await this.ensureObjectAvailable(objectId);

    return this.getDefinition(objectId) ?? null;
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
    const temporalModeChanged = this.displayOptions.temporalMode !== options.temporalMode;

    this.displayRuntime.apply(options);
    if (temporalModeChanged) {
      this.frameSimulation.refreshTemporalPresentation(this.objectRuntime.primaryRegistry);
    }
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

  public get cameraTransitioning(): boolean {
    return this.cameraController?.isTransitioning ?? false;
  }

  public get adaptiveRenderingStats(): AdaptiveRenderingStats {
    return this.adaptiveRenderingRuntime.stats;
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

  public setNavigationDebugTracing(enabled: boolean): void {
    this.navigationDebugRuntime.setEnabled(enabled);
  }

  public getNavigationDebugTrace(): readonly NavigationDebugTraceEntry[] {
    return this.navigationDebugRuntime.snapshot();
  }

  public clearNavigationDebugTrace(): void {
    this.navigationDebugRuntime.clear();
  }

  public getStellarObservationCatalog(
    maximumCount: number,
  ): readonly StellarObservationCatalogEntry[] {
    const registry = this.catalogRuntime?.starCatalogRegistry;

    return registry ? registry.getStellarObservationCatalog(maximumCount) : [];
  }

  public getStellarObservationConstellations(): readonly StellarObservationConstellation[] {
    const registry = this.catalogRuntime?.starCatalogRegistry;
    const catalog = this.catalogRuntime?.constellationCatalog;

    return registry && catalog ? registry.getStellarObservationConstellations(catalog) : [];
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
        isActive: () => this.lifecycle.isCurrent(lifecycleRevision) && this.initialized,
        onSpaceTilesChanged: (objects) => this.streamingRuntime.applyLoadedSpaceTiles(objects),
        onWarning: (message) => this.emit({ type: 'performance-warning', message }),
      });

      if (!this.lifecycle.isCurrent(lifecycleRevision)) {
        this.initializationBootstrap.dispose(initialization);
        this.lifecycle.ensureCurrent(lifecycleRevision);
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
      universeScene.updateStellarCatalog(initialTime, this.displayOptions.temporalMode);
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

      if (this.lifecycle.isCurrent(lifecycleRevision)) {
        this.releaseRuntimeResources();
        this.emit({ type: 'error', message });
      }
      throw error;
    } finally {
      if (this.lifecycle.isCurrent(lifecycleRevision)) {
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
    this.deferredCatalogCoordinator.reset();
    this.tempelFilamentLoader.reset();
    this.tempelFilamentPerformance.reset();
    this.streamingRuntime.reset();
    this.universeScene = null;
    this.renderer = null;
    this.camera = null;
    this.renderLoop = null;
    this.blackHoleLensingPass = null;
    this.debugRuntime.reset();
    this.navigationDebugRuntime.clear();
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
    metadata: WheelZoomInputMetadata = { rawDeltaY: deltaY, deltaMode: 0 },
  ): WheelAnchorDisposition => {
    const controller = this.cameraController;
    const camera = this.camera;

    if (!controller || !camera) {
      this.navigationRuntime.handleSemanticZoomIntent(
        controller,
        objectId,
        deltaY,
        pointer,
        metadata.continuesWheelAnchor !== true,
        metadata.continuesWheelGesture !== true,
      );

      return 'retain-wheel-anchor';
    }
    this.navigationDebugRuntime.handleWheelIntent(
      {
        objectId,
        deltaY,
        rawDeltaY: metadata.rawDeltaY,
        deltaMode: metadata.deltaMode,
        pointer,
      },
      () => this.captureNavigationDebugState(controller, camera),
      () =>
        this.navigationRuntime.handleSemanticZoomIntent(
          controller,
          objectId,
          deltaY,
          pointer,
          metadata.continuesWheelAnchor !== true,
          metadata.continuesWheelGesture !== true,
        ),
    );

    return 'retain-wheel-anchor';
  };

  private captureNavigationDebugState(
    controller: CameraController,
    camera: THREE.PerspectiveCamera,
  ): NavigationDebugState {
    const context = this.navigationRuntime.resolveContext(this.lodManager.level);

    return {
      cameraPosition: vectorLike(camera.position),
      cameraTarget: vectorLike(controller.controls.target),
      distance: controller.distanceToTarget,
      minimumDistance: controller.controls.minDistance,
      maximumDistance: controller.controls.maxDistance,
      targetId: this.targetId,
      navigationOriginId: context.targetId ?? this.targetId,
      referenceFrame: context.referenceFrame,
      lodLevel: this.lodManager.level,
      atMinimumDistance: controller.atMinimumNavigationDistance,
      semanticZoomActive: controller.semanticZoomActive,
      transitioning: controller.isTransitioning,
    };
  }

  private synchronizeNavigationContextTarget(controller: CameraController, lodLevel: number): void {
    this.navigationRuntime.synchronizeContext(controller, lodLevel);
  }

  private readonly handleCameraSettled = (distance: number, source: CameraSettledSource): void => {
    this.emit({ type: 'camera-changed', zoom: distance });
    const controller = this.cameraController;

    if (!controller) {
      this.viewController.cancelPendingSelection();

      return;
    }
    // CameraZoomController publishes `zoom` synchronously, before the navigation runtime can hand
    // the journey to its next scale target. Its current object can therefore be temporarily out of
    // frame even though the same wheel transaction is still using it as a reversible context.
    if (source !== 'zoom' && this.releaseNavigationTargetOutsideViewport(controller)) {
      this.viewController.cancelPendingSelection();

      return;
    }
    this.viewController.handleCameraSettled(source);
    if (source !== 'pinch' || controller.isTransitioning) {
      return;
    }
    this.synchronizeNavigationContextTarget(controller, this.lodManager.selectLevel(distance));
  };

  private releaseNavigationTargetOutsideViewport(controller: CameraController): boolean {
    const camera = this.camera;
    const targetId = this.targetId;

    if (
      !camera ||
      !targetId ||
      controller.isTransitioning ||
      controller.observerPresentationActive
    ) {
      return false;
    }
    const worldPosition = this.getWorldPosition(targetId, this.navigationTargetWorldPosition);

    if (
      !worldPosition ||
      this.cameraViewportVisibility.contains(
        worldPosition,
        camera,
        NAVIGATION_TARGET_VIEWPORT_OVERSCAN_NDC,
      )
    ) {
      return false;
    }
    this.selectObject(null);
    this.releaseNavigationTarget();

    return true;
  }

  private renderFrame(deltaSeconds: number): void {
    const tempelFrameStartedAt = this.tempelFilamentPerformance.beginFrame();

    this.frameRuntime.render(deltaSeconds);
    this.startupPerformance.markMapUsable();
    this.deferredCatalogCoordinator.schedule();
    this.tempelFilamentPerformance.completeFrame(
      tempelFrameStartedAt,
      (this.universeScene?.visibleTempelFilamentSpineSegmentCount ?? 0) > 0,
    );
  }

  private followCurrentTarget(): void {
    this.navigationRuntime.follow(this.cameraController);
  }

  private handlePick(objectId: string | null, focusRequested: boolean): void {
    if (objectId === null) {
      this.selectObject(null);
      if (!this.cameraController?.observerPresentationActive && this.targetId !== null) {
        this.releaseNavigationTarget();
      }

      return;
    }
    if (this.cameraController?.observerPresentationActive) {
      this.selectObject(objectId);

      return;
    }
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

  private preloadTempelFilamentSpines(): Promise<void> {
    return this.tempelFilamentLoader.preload();
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
    this.lifecycle.requireInitialized();
  }
}

function vectorLike(vector: THREE.Vector3): Vector3Like {
  return { x: vector.x, y: vector.y, z: vector.z };
}
