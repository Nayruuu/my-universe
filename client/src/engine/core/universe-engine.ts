import * as THREE from 'three';
import {
  DisplayOptions,
  EngineDebugStats,
  GraphicQuality,
  SolarEclipseState,
  SpaceObject,
  UniverseEngineEvent,
  UniverseTime,
} from '../../data/models/universe.models';
import { CameraController } from '../camera/camera-controller';
import { CAMERA_FAR_DISTANCE, getOrbitOverviewDistance } from '../camera/navigation-policy';
import { type NavigationScaleDefinition } from '../camera/navigation-scales';
import { CoordinateSystem } from '../coordinates/coordinate-system';
import { FloatingOriginManager } from '../coordinates/floating-origin-manager';
import { LodManager } from '../lod/lod-manager';
import { LabelManager } from '../objects/label-manager';
import { ObjectRegistry } from '../objects/object-registry';
import type { StarCatalogRegistry } from '../objects/star-catalog-registry';
import { PerformanceManager } from '../performance/performance-manager';
import { UniverseScene } from '../rendering/universe-scene';
import { SelectionManager } from '../selection/selection-manager';
import { EarthEclipseEvent, SolarEclipseAppearance } from '../simulation/earth-eclipse';
import {
  calculateEarthObserverDirection,
  calculateSolarEclipseAppearance,
  calculateSolarObserverDiscRatio,
} from '../simulation/solar-eclipse-calculator';
import {
  EARTH_ROTATION_RECOVERY_RADIANS_PER_SECOND,
  EarthRotationPlayback,
} from '../simulation/earth-rotation-playback';
import { TimeController } from '../simulation/time-controller';
import { RenderLoop } from './render-loop';

export type UniverseEngineListener = (event: UniverseEngineEvent) => void;
export type WebGlRendererConstructor = new (
  parameters: THREE.WebGLRendererParameters,
) => THREE.WebGLRenderer;

const EARTH_RADIUS_TO_MEAN_LUNAR_DISTANCE = 6_378.137 / 384_400;
const SIMULATION_UPDATE_INTERVAL_SECONDS = 1 / 24;
const CATALOG_STAR_FOCUS_DISTANCE = 800;

export class UniverseEngine {
  private readonly listeners = new Set<UniverseEngineListener>();
  private readonly coordinateSystem = new CoordinateSystem();
  private readonly timeController = new TimeController();
  private readonly performanceManager = new PerformanceManager();
  private readonly lodManager = new LodManager();
  private readonly floatingOriginManager = new FloatingOriginManager();
  private readonly earthRotationPlayback = new EarthRotationPlayback();

  private displayOptions: DisplayOptions = {
    showOrbits: true,
    showLabels: true,
    quality: 'medium',
    temporalMode: 'state',
  };

  private renderer: THREE.WebGLRenderer | null = null;
  private camera: THREE.PerspectiveCamera | null = null;
  private universeScene: UniverseScene | null = null;
  private cameraController: CameraController | null = null;
  private objectRegistry: ObjectRegistry | null = null;
  private labelManager: LabelManager | null = null;
  private starCatalogRegistry: StarCatalogRegistry | null = null;
  private selectionManager: SelectionManager | null = null;
  private renderLoop: RenderLoop | null = null;
  private container: HTMLElement | null = null;
  private objects: SpaceObject[] = [];
  private targetId: string | null = null;
  private selectedId: string | null = null;
  private activeSolarEclipse: EarthEclipseEvent | null = null;
  private solarEclipsePathVisible = false;
  private solarObserverActive = false;
  private solarObserverMoonScale = 1;
  private simulationAccumulator = 0;
  private timeEventAccumulator = 0;
  private statsAccumulator = 0;
  private statsFrames = 0;
  private lastFps = 0;
  private lastEmittedLodLevel = -1;
  private lastSolarEclipsePhase: SolarEclipseState['phase'] | null = null;
  private initialized = false;

  constructor(private readonly Renderer: WebGlRendererConstructor = THREE.WebGLRenderer) {}

  public async initialize(
    container: HTMLElement,
    initialOptions?: Partial<DisplayOptions>,
  ): Promise<void> {
    if (this.initialized) {
      return;
    }

    this.container = container;
    this.emit({ type: 'loading-state', loading: true });

    try {
      this.displayOptions = {
        ...this.displayOptions,
        ...initialOptions,
        quality: initialOptions?.quality ?? this.performanceManager.recommendQuality(),
      };
      const { AssetLoader } = await import('../loaders/asset-loader');
      const assets = await new AssetLoader().loadAssets();

      this.objects = assets.objects;

      const renderer = new this.Renderer({
        antialias: this.displayOptions.quality !== 'low',
        alpha: false,
        powerPreference: 'high-performance',
        logarithmicDepthBuffer: true,
      });

      renderer.domElement.className = 'universe-canvas';
      renderer.outputColorSpace = THREE.SRGBColorSpace;
      renderer.toneMapping = THREE.ACESFilmicToneMapping;
      renderer.toneMappingExposure = 1.05;
      renderer.setPixelRatio(this.performanceManager.getPixelRatio(this.displayOptions.quality));
      container.appendChild(renderer.domElement);
      this.renderer = renderer;

      const camera = new THREE.PerspectiveCamera(48, 1, 0.025, CAMERA_FAR_DISTANCE);

      camera.position.set(28, 17, 30);
      this.camera = camera;

      const universeScene = new UniverseScene(this.performanceManager);

      if (assets.starCatalog) {
        const { StarCatalogRegistry } = await import('../objects/star-catalog-registry');
        const starCatalogRegistry = new StarCatalogRegistry(
          assets.starCatalog,
          this.coordinateSystem,
        );

        this.starCatalogRegistry = starCatalogRegistry;
        await universeScene.setStarCatalog(starCatalogRegistry);
      }
      universeScene.setQuality(this.displayOptions.quality);
      this.universeScene = universeScene;

      const cameraController = new CameraController(camera, renderer.domElement, (zoom) =>
        this.emit({ type: 'camera-changed', zoom }),
      );

      this.cameraController = cameraController;

      const registry = new ObjectRegistry(
        universeScene.spaceRoot,
        this.coordinateSystem,
        this.objects,
        this.displayOptions.quality,
      );

      const initialTime = this.timeController.currentTime;
      const solarEclipseAppearance = registry.updatePositions(initialTime);

      registry.updateBodyRotations(initialTime);
      this.earthRotationPlayback.reset(initialTime);
      this.emitSolarEclipseState(solarEclipseAppearance, true);
      registry.setDisplayOptions(this.displayOptions);
      this.objectRegistry = registry;

      const labelObjects = [
        ...this.objects,
        ...(this.starCatalogRegistry?.getLabelObjects(this.objects) ?? []),
      ];
      const labelManager = new LabelManager(container, labelObjects, this.displayOptions.quality);

      labelManager.setEnabled(this.displayOptions.showLabels);
      this.labelManager = labelManager;

      this.selectionManager = new SelectionManager(
        renderer.domElement,
        camera,
        () => [
          ...(this.objectRegistry?.getPickables() ?? []),
          ...(this.universeScene?.getCatalogPickables() ?? []),
        ],
        (clientX, clientY) => this.labelManager?.hitTest(clientX, clientY) ?? null,
        (objectId, focusRequested) => this.handlePick(objectId, focusRequested),
        (objectId) => this.handleNavigationIntent(objectId),
        () => this.cameraController?.distanceToTarget ?? 1,
        (objectId) =>
          this.starCatalogRegistry?.has(objectId) === true ||
          this.objectRegistry?.getDefinition(objectId)?.type === 'galaxy',
        (objectId) => this.labelManager?.setHoveredObject(objectId),
        this.handleSemanticZoomIntent,
      );
      this.renderLoop = new RenderLoop((deltaSeconds) => this.renderFrame(deltaSeconds));

      this.resize(container.clientWidth, container.clientHeight);
      this.initialized = true;
      this.emit({
        type: 'data-ready',
        objects: this.objects,
        catalogEntries: this.starCatalogRegistry?.getSearchEntries() ?? [],
      });
      for (const warning of assets.warnings) {
        this.emit({ type: 'performance-warning', message: warning });
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Erreur inconnue du moteur 3D.';

      this.emit({ type: 'error', message });
      throw error;
    } finally {
      this.emit({ type: 'loading-state', loading: false });
    }
  }

  public start(): void {
    this.requireInitialized();
    this.renderLoop?.start();
  }

  public stop(): void {
    this.renderLoop?.stop();
  }

  public resize(width: number, height: number): void {
    if (!this.renderer || !this.camera || width <= 0 || height <= 0) {
      return;
    }
    this.camera.aspect = width / height;
    this.camera.updateProjectionMatrix();
    this.renderer.setSize(width, height, false);
    this.labelManager?.resize(width, height);
  }

  public dispose(): void {
    this.stop();
    this.selectionManager?.dispose();
    this.cameraController?.dispose();
    this.labelManager?.dispose();
    this.objectRegistry?.dispose();
    this.universeScene?.dispose();
    this.renderer?.renderLists.dispose();
    this.renderer?.dispose();
    this.renderer?.domElement.remove();

    this.selectionManager = null;
    this.cameraController = null;
    this.labelManager = null;
    this.starCatalogRegistry = null;
    this.objectRegistry = null;
    this.universeScene = null;
    this.renderer = null;
    this.camera = null;
    this.renderLoop = null;
    this.container = null;
    this.objects = [];
    this.targetId = null;
    this.selectedId = null;
    this.activeSolarEclipse = null;
    this.solarEclipsePathVisible = false;
    this.solarObserverActive = false;
    this.solarObserverMoonScale = 1;
    this.lastSolarEclipsePhase = null;
    this.initialized = false;
    this.listeners.clear();
  }

  public setTime(time: UniverseTime): void {
    this.timeController.setTime(time);
    this.earthRotationPlayback.reset(time);
    const solarEclipseAppearance = this.objectRegistry?.updatePositions(time);

    this.objectRegistry?.updateBodyRotations(time);
    if (solarEclipseAppearance) {
      this.emitSolarEclipseState(solarEclipseAppearance, true);
    }
    this.followCurrentTarget();
    this.emit({ type: 'time-changed', time: this.timeController.currentTime });
  }

  public setPlaying(playing: boolean): void {
    this.timeController.setPlaying(playing);
  }

  public setTimeSpeed(daysPerSecond: number): void {
    this.timeController.setSpeed(daysPerSecond);
  }

  public async setTarget(objectId: string, zoom?: number): Promise<void> {
    const registry = this.objectRegistry;
    const controller = this.cameraController;

    if (!registry || !controller || !this.hasObject(objectId)) {
      throw new Error(`Objet astronomique introuvable : ${objectId}.`);
    }

    const position = this.getWorldPosition(objectId);
    const object = this.getDefinition(objectId);

    if (!position || !object) {
      throw new Error(`Position indisponible pour ${objectId}.`);
    }

    this.clearSolarEclipsePresentation();
    this.selectionManager?.clearNavigationLock();
    this.targetId = objectId;
    registry.setNavigationTarget(registry.has(objectId) ? objectId : null);
    this.selectObject(objectId);
    controller.focusOn(
      position,
      object,
      zoom ?? (this.starCatalogRegistry?.has(objectId) ? CATALOG_STAR_FOCUS_DISTANCE : undefined),
    );
    this.emit({ type: 'target-changed', objectId });
  }

  public viewOrbit(objectId: string): void {
    const registry = this.objectRegistry;
    const controller = this.cameraController;
    const camera = this.camera;
    const object = registry?.getDefinition(objectId);
    const parentId = object?.parentId;
    const parent = parentId ? registry?.getDefinition(parentId) : undefined;
    const parentPosition = parentId ? registry?.getWorldPosition(parentId) : null;
    const orbitRadius = registry?.getOrbitRadius(objectId);

    if (
      !registry ||
      !controller ||
      !camera ||
      !object ||
      !parentId ||
      !parent ||
      !parentPosition ||
      typeof orbitRadius !== 'number' ||
      orbitRadius <= 0
    ) {
      throw new Error(`Orbite indisponible pour ${object?.name ?? objectId}.`);
    }

    this.clearSolarEclipsePresentation();
    this.selectionManager?.clearNavigationLock();
    this.targetId = parentId;
    registry.setNavigationTarget(parentId);
    this.selectObject(objectId);
    controller.focusOnFromDirection(
      parentPosition,
      parent,
      new THREE.Vector3(1, 0.82, 1),
      getOrbitOverviewDistance(orbitRadius, camera.fov),
    );
    this.emit({ type: 'target-changed', objectId: parentId });
  }

  public viewScale(scale: NavigationScaleDefinition): void {
    const registry = this.objectRegistry;
    const controller = this.cameraController;
    const target = registry?.getDefinition(scale.targetId);
    const targetPosition = registry?.getWorldPosition(scale.targetId);

    if (!registry || !controller || !target || !targetPosition) {
      throw new Error('Cadrage indisponible.');
    }

    this.clearSolarEclipsePresentation();
    this.selectionManager?.clearNavigationLock();
    this.targetId = scale.targetId;
    registry.setNavigationTarget(scale.targetId);
    this.selectObject(null);
    controller.focusOnFromDirection(
      targetPosition,
      target,
      new THREE.Vector3(...scale.direction),
      scale.distance,
    );
    this.emit({ type: 'target-changed', objectId: scale.targetId });
  }

  public viewSolarEclipse(event: EarthEclipseEvent): void {
    this.setTime(event.peak);
    const registry = this.objectRegistry;
    const controller = this.cameraController;
    const earthPosition = registry?.getWorldPosition('earth');
    const earth = registry?.getDefinition('earth');
    const appearance = calculateSolarEclipseAppearance(event.peak);

    if (!registry || !controller || !earthPosition || !earth || appearance.phase === 'none') {
      throw new Error('L’ombre de cette éclipse solaire ne peut pas être affichée.');
    }

    this.selectionManager?.clearNavigationLock();
    this.activeSolarEclipse = event;
    this.solarEclipsePathVisible = false;
    this.solarObserverActive = false;
    this.solarObserverMoonScale = 1;
    this.targetId = 'earth';
    registry.setSolarObserverActive(false);
    registry.setNavigationTarget('earth');
    registry.clearSolarEclipsePath();
    this.selectObject(null);
    const shadowViewDirection = new THREE.Vector3(
      appearance.shadowDirection.x,
      appearance.shadowDirection.y,
      appearance.shadowDirection.z,
    ).normalize();

    controller.focusOnFromDirection(
      earthPosition,
      earth,
      shadowViewDirection,
      earth.visual.visualRadius * 5.6,
    );
    this.emit({ type: 'target-changed', objectId: 'earth' });
  }

  public observeSolarEclipse(event: EarthEclipseEvent): void {
    this.setTime(event.peak);
    const registry = this.objectRegistry;
    const controller = this.cameraController;
    const earthPosition = registry?.getWorldPosition('earth');
    const moonPosition = registry?.getWorldPosition('moon');
    const sunPosition = registry?.getWorldPosition('sun');
    const moon = registry?.getDefinition('moon');
    const sun = registry?.getDefinition('sun');
    const appearance = calculateSolarEclipseAppearance(event.peak);
    const latitude = event.latitude ?? appearance.centralLatitude;
    const longitude = event.longitude ?? appearance.centralLongitude;

    if (
      !registry ||
      !controller ||
      !earthPosition ||
      !moonPosition ||
      !sunPosition ||
      !moon ||
      !sun ||
      latitude === null ||
      longitude === null
    ) {
      throw new Error('Le point d’observation terrestre de cette éclipse est indisponible.');
    }

    const observerDirection = calculateEarthObserverDirection(event.peak, latitude, longitude);
    const observerOffset =
      earthPosition.distanceTo(moonPosition) * EARTH_RADIUS_TO_MEAN_LUNAR_DISTANCE;
    const observerPosition = earthPosition
      .clone()
      .add(
        new THREE.Vector3(
          observerDirection.x,
          observerDirection.y,
          observerDirection.z,
        ).multiplyScalar(observerOffset),
      );
    const discRatio = calculateSolarObserverDiscRatio(event.peak, latitude, longitude);
    const sunDistance = observerPosition.distanceTo(sunPosition);
    const moonDistance = observerPosition.distanceTo(moonPosition);
    const adaptedSunAngularRadius = Math.asin(
      Math.min(0.999, sun.visual.visualRadius / sunDistance),
    );
    const adaptedMoonRadius = Math.sin(adaptedSunAngularRadius * discRatio) * moonDistance;
    const moonVisualScale = THREE.MathUtils.clamp(
      adaptedMoonRadius / moon.visual.visualRadius,
      0.72,
      1.28,
    );

    this.selectionManager?.clearNavigationLock();
    this.activeSolarEclipse = event;
    this.solarEclipsePathVisible = false;
    this.solarObserverActive = true;
    this.solarObserverMoonScale = moonVisualScale;
    this.targetId = null;
    registry.clearSolarEclipsePath();
    registry.setSolarObserverActive(true, moonVisualScale);
    registry.setNavigationTarget('sun');
    this.selectObject(null);
    this.labelManager?.clear();
    controller.observeFrom(observerPosition, sunPosition);
    this.emit({ type: 'target-changed', objectId: null });
  }

  public setSolarEclipsePathVisible(event: EarthEclipseEvent, visible: boolean): void {
    this.activeSolarEclipse = event;
    this.solarEclipsePathVisible = visible;
    if (visible) {
      this.objectRegistry?.showSolarEclipsePath(event.peak, event.kind);
    } else {
      this.objectRegistry?.clearSolarEclipsePath();
    }
  }

  public clearSolarEclipsePresentation(): void {
    this.activeSolarEclipse = null;
    this.solarEclipsePathVisible = false;
    this.solarObserverActive = false;
    this.solarObserverMoonScale = 1;
    this.objectRegistry?.setSolarObserverActive(false);
    this.objectRegistry?.clearSolarEclipsePath();
  }

  public selectObject(objectId: string | null): void {
    const object = objectId ? (this.getDefinition(objectId) ?? null) : null;

    if (objectId && !object) {
      return;
    }
    this.selectedId = objectId;
    const catalogObjectId = objectId && this.starCatalogRegistry?.has(objectId) ? objectId : null;

    this.objectRegistry?.select(catalogObjectId ? null : objectId);
    this.universeScene?.selectCatalogObject(catalogObjectId);
    this.labelManager?.setTransientObject(catalogObjectId ? object : null);
    this.emit({ type: 'object-selected', objectId, object });
  }

  public focusSelected(): void {
    if (this.selectedId) {
      void this.setTarget(this.selectedId);
    }
  }

  public setDisplayOptions(options: DisplayOptions): void {
    const qualityChanged = options.quality !== this.displayOptions.quality;

    this.displayOptions = { ...options };
    this.universeScene?.setQuality(this.displayOptions.quality);
    this.labelManager?.setEnabled(this.displayOptions.showLabels);

    if (qualityChanged) {
      if (this.objectRegistry && this.universeScene) {
        this.rebuildObjectRegistry();
      }
      this.labelManager?.setQuality(this.displayOptions.quality);
      if (this.renderer) {
        this.renderer.setPixelRatio(
          this.performanceManager.getPixelRatio(this.displayOptions.quality),
        );
        if (this.container) {
          this.resize(this.container.clientWidth, this.container.clientHeight);
        }
      }
    }
    this.objectRegistry?.setDisplayOptions(this.displayOptions);
  }

  public zoomBy(factor: number): void {
    this.cameraController?.zoomBy(factor);
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
    return this.objects;
  }

  public hasObject(objectId: string): boolean {
    return (
      this.objectRegistry?.has(objectId) === true ||
      this.starCatalogRegistry?.has(objectId) === true
    );
  }

  public get recommendedQuality(): GraphicQuality {
    return this.performanceManager.recommendQuality();
  }

  private readonly handleSemanticZoomIntent = (objectId: string | null, deltaY: number): void => {
    const controller = this.cameraController;

    if (!controller) {
      return;
    }
    if (deltaY < 0 && !controller.semanticZoomActive) {
      this.handleNavigationIntent(objectId);
    }
    controller.zoomSemantically(deltaY);
  };

  private renderFrame(deltaSeconds: number): void {
    const renderer = this.renderer;
    const camera = this.camera;
    const universeScene = this.universeScene;
    const registry = this.objectRegistry;
    const controller = this.cameraController;

    if (!renderer || !camera || !universeScene || !registry || !controller) {
      return;
    }

    const timeAdvanced = this.timeController.update(deltaSeconds);
    const currentTime = this.timeController.currentTime;
    const earthRotation = this.earthRotationPlayback.update(
      currentTime,
      this.timeController.isPlaying,
      this.timeController.speed,
      deltaSeconds,
    );

    this.simulationAccumulator += deltaSeconds;
    this.timeEventAccumulator += deltaSeconds;
    if (earthRotation.mode === 'synchronize') {
      registry.updateBodyRotations(currentTime, null);
      const synchronized = registry.synchronizeEarthRotation(
        currentTime,
        EARTH_ROTATION_RECOVERY_RADIANS_PER_SECOND * deltaSeconds,
      );

      if (synchronized) {
        this.earthRotationPlayback.markSynchronized(currentTime);
      }
    } else if (timeAdvanced) {
      registry.updateBodyRotations(currentTime, earthRotation.time);
    }

    if (timeAdvanced && this.simulationAccumulator >= SIMULATION_UPDATE_INTERVAL_SECONDS) {
      const solarEclipseAppearance = registry.updatePositions(currentTime);

      this.emitSolarEclipseState(solarEclipseAppearance, false);
      this.followCurrentTarget();
      this.simulationAccumulator = 0;
    }

    if (timeAdvanced && this.timeEventAccumulator >= 0.12) {
      this.emit({ type: 'time-changed', time: currentTime });
      this.timeEventAccumulator = 0;
    }

    controller.update(deltaSeconds);
    this.floatingOriginManager.update(
      universeScene.spaceRoot,
      camera,
      controller.controls.target,
      controller.isTransitioning,
    );

    const lodLevel = this.lodManager.selectLevel(controller.distanceToTarget);

    if (lodLevel !== this.lastEmittedLodLevel) {
      this.lastEmittedLodLevel = lodLevel;
      this.emit({ type: 'lod-changed', level: lodLevel });
    }
    registry.updateLod(
      camera,
      this.container?.clientHeight ?? renderer.domElement.clientHeight,
      lodLevel,
      deltaSeconds,
    );
    universeScene.updateLod(lodLevel, deltaSeconds);
    renderer.render(universeScene.scene, camera);
    if (!this.solarObserverActive && !this.activeSolarEclipse) {
      this.labelManager?.render(
        camera,
        (objectId, target) => this.getWorldPosition(objectId, target),
        lodLevel,
        this.selectedId ?? this.targetId,
      );
    } else {
      this.labelManager?.clear();
    }
    this.updateDebugStats(deltaSeconds);
  }

  private updateDebugStats(deltaSeconds: number): void {
    const renderer = this.renderer;
    const camera = this.camera;
    const registry = this.objectRegistry;
    const universeScene = this.universeScene;

    if (!renderer || !camera || !registry || !universeScene) {
      return;
    }

    this.statsAccumulator += deltaSeconds;
    this.statsFrames += 1;
    if (this.statsAccumulator < 1) {
      return;
    }

    this.lastFps = Math.round(this.statsFrames / this.statsAccumulator);
    const stats: EngineDebugStats = {
      fps: this.lastFps,
      drawCalls: renderer.info.render.calls,
      triangles: renderer.info.render.triangles,
      geometries: renderer.info.memory.geometries,
      textures: renderer.info.memory.textures,
      visibleObjects: registry.visibleObjectCount,
      catalogStars: universeScene.visibleCatalogStarCount,
      cameraPosition: vectorToLike(camera.position),
      cameraDistance: this.cameraController?.distanceToTarget ?? 0,
      floatingOrigin: vectorToLike(this.floatingOriginManager.accumulatedOrigin),
      targetId: this.targetId,
      lodLevel: this.lodManager.level,
      julianDay: this.timeController.currentTime.julianDay,
      quality: this.displayOptions.quality,
    };

    this.emit({ type: 'debug-stats', stats });
    this.statsAccumulator = 0;
    this.statsFrames = 0;
  }

  private followCurrentTarget(): void {
    if (!this.targetId || !this.objectRegistry || !this.cameraController) {
      return;
    }
    const position = this.getWorldPosition(this.targetId);

    if (position) {
      this.cameraController.follow(position);
    }
  }

  private handlePick(objectId: string | null, focusRequested: boolean): void {
    if (objectId && focusRequested) {
      void this.setTarget(objectId);

      return;
    }
    this.selectObject(objectId);
  }

  private handleNavigationIntent(objectId: string | null): void {
    const registry = this.objectRegistry;
    const controller = this.cameraController;

    if (!objectId) {
      this.releaseNavigationTarget();

      return;
    }
    const position = this.getWorldPosition(objectId);
    const object = this.getDefinition(objectId);

    if (!registry || !controller || !position || !object) {
      return;
    }

    const targetChanged = this.targetId !== objectId;

    this.targetId = objectId;
    registry.setNavigationTarget(registry.has(objectId) ? objectId : null);
    controller.adoptZoomTarget(position, object);
    if (targetChanged) {
      this.emit({ type: 'target-changed', objectId });
    }
  }

  private releaseNavigationTarget(): void {
    this.cameraController?.releaseTarget();
    this.objectRegistry?.setNavigationTarget(null);
    if (this.targetId !== null) {
      this.targetId = null;
      this.emit({ type: 'target-changed', objectId: null });
    }
  }

  private rebuildObjectRegistry(): void {
    const universeScene = this.universeScene;

    if (!universeScene) {
      return;
    }

    this.objectRegistry?.dispose();
    const registry = new ObjectRegistry(
      universeScene.spaceRoot,
      this.coordinateSystem,
      this.objects,
      this.displayOptions.quality,
    );

    const currentTime = this.timeController.currentTime;
    const solarEclipseAppearance = registry.updatePositions(currentTime);

    registry.updateBodyRotations(currentTime);
    this.earthRotationPlayback.reset(currentTime);
    this.emitSolarEclipseState(solarEclipseAppearance, true);
    registry.setDisplayOptions(this.displayOptions);
    registry.setNavigationTarget(
      this.targetId && registry.has(this.targetId) ? this.targetId : null,
    );
    const selectedCatalogId =
      this.selectedId && this.starCatalogRegistry?.has(this.selectedId) ? this.selectedId : null;

    registry.select(selectedCatalogId ? null : this.selectedId);
    universeScene.selectCatalogObject(selectedCatalogId);
    registry.setSolarObserverActive(this.solarObserverActive, this.solarObserverMoonScale);
    if (this.activeSolarEclipse && this.solarEclipsePathVisible && !this.solarObserverActive) {
      registry.showSolarEclipsePath(this.activeSolarEclipse.peak, this.activeSolarEclipse.kind);
    }
    this.objectRegistry = registry;
    this.followCurrentTarget();
  }

  private getDefinition(objectId: string): SpaceObject | undefined {
    return (
      this.objectRegistry?.getDefinition(objectId) ??
      this.starCatalogRegistry?.getDefinition(objectId)
    );
  }

  private getWorldPosition(objectId: string, target = new THREE.Vector3()): THREE.Vector3 | null {
    return (
      this.objectRegistry?.getWorldPosition(objectId, target) ??
      this.universeScene?.getCatalogWorldPosition(objectId, target) ??
      null
    );
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

  private emitSolarEclipseState(appearance: SolarEclipseAppearance, force: boolean): void {
    if (!force && appearance.phase === this.lastSolarEclipsePhase) {
      return;
    }
    this.lastSolarEclipsePhase = appearance.phase;
    this.emit({
      type: 'solar-eclipse-state',
      state: {
        phase: appearance.phase,
        centralLatitude: appearance.centralLatitude,
        centralLongitude: appearance.centralLongitude,
      },
    });
  }
}

function vectorToLike(vector: THREE.Vector3): { x: number; y: number; z: number } {
  return { x: vector.x, y: vector.y, z: vector.z };
}
