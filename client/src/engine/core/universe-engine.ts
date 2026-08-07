import * as THREE from 'three';
import {
  DisplayOptions,
  EngineDebugStats,
  GraphicQuality,
  SolarEclipseState,
  SpaceObject,
  type TempelFilamentSpineSource,
  UniverseEngineEvent,
  UniverseTime,
  type ZoomDebugStats,
} from '../../data/models/universe.models';
import { CameraController, type CameraSettledSource } from '../camera/camera-controller';
import { NavigationContextJourney } from '../camera/navigation-context';
import {
  CAMERA_FAR_DISTANCE,
  getMinimumNavigationDistance,
  getOrbitOverviewDistance,
} from '../camera/navigation-policy';
import type { NavigationScaleDefinition } from '../camera/navigation-scales';
import { CoordinateSystem } from '../coordinates/coordinate-system';
import { FloatingOriginManager } from '../coordinates/floating-origin-manager';
import { LodManager } from '../lod/lod-manager';
import {
  getMaximumCatalogLabelPoolRank,
  getMaximumCosmicLabelRank,
  LabelManager,
  type LabelNameResolver,
  type LabelObject,
} from '../objects/label-manager';
import { ObjectRegistry } from '../objects/object-registry';
import type { CosmicGroupCatalogRegistry } from '../objects/cosmic-group-catalog-registry';
import type { CosmicStructureCatalogRegistry } from '../objects/cosmic-structure-catalog-registry';
import type { StarCatalogRegistry } from '../objects/star-catalog-registry';
import type { ExoplanetCatalogRegistry } from '../objects/exoplanet-catalog-registry';
import { PerformanceManager } from '../performance/performance-manager';
import {
  BlackHoleLensingPass,
  projectBlackHoleLensing,
} from '../rendering/black-hole-lensing-pass';
import { UniverseScene } from '../rendering/universe-scene';
import {
  dampPhotographicExposure,
  getPhotographicProfile,
} from '../rendering/photographic-profile';
import type { CosmicMapLayers } from '../rendering/cosmic-map-policy';
import { SelectionManager, type ZoomPointer } from '../selection/selection-manager';
import { EarthEclipseEvent, SolarEclipseAppearance } from '../simulation/earth-eclipse';
import { calculateEarthObserverDirection } from '../simulation/body-orientation';
import {
  calculateSolarEclipseAppearance,
  calculateSolarObserverDiscRatio,
} from '../simulation/solar-eclipse-calculator';
import {
  EARTH_ROTATION_RECOVERY_RADIANS_PER_SECOND,
  EarthRotationPlayback,
} from '../simulation/earth-rotation-playback';
import { TimeController } from '../simulation/time-controller';
import type { SpaceTileManager } from '../tiles/space-tile-manager';
import { createSpaceTileView, type SpaceTileView } from '../tiles/space-tile-selection';
import type { StarTileManager } from '../tiles/star-tile-manager';
import { createStarTileView, type StarTileView } from '../tiles/star-tile-selection';
import { RenderLoop } from './render-loop';

export type UniverseEngineListener = (event: UniverseEngineEvent) => void;
export type WebGlRendererConstructor = new (
  parameters: THREE.WebGLRendererParameters,
) => THREE.WebGLRenderer;

const EARTH_RADIUS_TO_MEAN_LUNAR_DISTANCE = 6_378.137 / 384_400;
const SIMULATION_UPDATE_INTERVAL_SECONDS = 1 / 24;
const CATALOG_STAR_FOCUS_DISTANCE = 800;
const EXOPLANET_SYSTEM_FOCUS_DISTANCE = 72;
const SPACE_TILE_SYNCHRONIZATION_INTERVAL_SECONDS = 0.25;
const STAR_TILE_SYNCHRONIZATION_INTERVAL_SECONDS = 0.25;

interface SpaceTileSynchronizationRequest {
  readonly view: SpaceTileView;
  readonly retainedObjectIds: readonly string[];
}

export class UniverseEngine {
  private readonly listeners = new Set<UniverseEngineListener>();
  private readonly coordinateSystem = new CoordinateSystem();
  private readonly timeController = new TimeController();
  private readonly performanceManager = new PerformanceManager();
  private readonly lodManager = new LodManager();
  private readonly floatingOriginManager = new FloatingOriginManager();
  private readonly earthRotationPlayback = new EarthRotationPlayback();
  private readonly blackHoleLensingPosition = new THREE.Vector3();
  private readonly floatingOriginShift = new THREE.Vector3();
  private readonly navigationContextJourney = new NavigationContextJourney((objectId) =>
    this.getDefinition(objectId),
  );

  private displayOptions: DisplayOptions = {
    showOrbits: true,
    showConstellations: true,
    showLabels: true,
    quality: 'medium',
    labelDensity: 'balanced',
    temporalMode: 'state',
  };

  private renderer: THREE.WebGLRenderer | null = null;
  private camera: THREE.PerspectiveCamera | null = null;
  private universeScene: UniverseScene | null = null;
  private cameraController: CameraController | null = null;
  private objectRegistry: ObjectRegistry | null = null;
  private spaceTileObjectRegistry: ObjectRegistry | null = null;
  private activeExoplanetSystemRegistry: ObjectRegistry | null = null;
  private activeExoplanetSystemObjects: SpaceObject[] = [];
  private labelManager: LabelManager | null = null;
  private starCatalogRegistry: StarCatalogRegistry | null = null;
  private exoplanetCatalogRegistry: ExoplanetCatalogRegistry | null = null;
  private cosmicGroupCatalogRegistry: CosmicGroupCatalogRegistry | null = null;
  private cosmicStructureCatalogRegistry: CosmicStructureCatalogRegistry | null = null;
  private tempelFilamentSpineSource: TempelFilamentSpineSource | null = null;
  private tempelFilamentSpineLoadPromise: Promise<void> | null = null;
  private tempelFilamentSpineWarningEmitted = false;
  private selectionManager: SelectionManager | null = null;
  private renderLoop: RenderLoop | null = null;
  private blackHoleLensingPass: BlackHoleLensingPass | null = null;
  private container: HTMLElement | null = null;
  private baseObjects: SpaceObject[] = [];
  private objects: SpaceObject[] = [];
  private spaceTileManager: SpaceTileManager | null = null;
  private starTileManager: StarTileManager | null = null;
  private pendingStarTileView: StarTileView | null = null;
  private starTileSynchronizationRunning = false;
  private starTileSynchronizationAccumulator = STAR_TILE_SYNCHRONIZATION_INTERVAL_SECONDS;
  private lastStarTileLod = -1;
  private lastStarTileWarning: string | null = null;
  private pendingSpaceTileRequest: SpaceTileSynchronizationRequest | null = null;
  private spaceTileSynchronizationAccumulator = SPACE_TILE_SYNCHRONIZATION_INTERVAL_SECONDS;
  private tileSynchronizationRunning = false;
  private lastSpaceTileContextKey: string | null = null;
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
  private renderPixelRatio = 1;
  private lastEmittedLodLevel = -1;
  private lastSolarEclipsePhase: SolarEclipseState['phase'] | null = null;
  private lastZoomAnchor: Pick<ZoomDebugStats, 'anchorType' | 'anchorObjectId'> | null = null;
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

      this.baseObjects = [...assets.objects];
      this.objects = [...this.baseObjects];
      this.tempelFilamentSpineSource = assets.tempelFilamentSpineSource;
      if (assets.spaceTileIndex) {
        const { SpaceTileManager } = await import('../tiles/space-tile-manager');

        this.spaceTileManager = new SpaceTileManager(assets.spaceTileIndex);
      } else {
        this.spaceTileManager = null;
      }

      const renderer = new this.Renderer({
        antialias: false,
        alpha: false,
        powerPreference: 'high-performance',
        logarithmicDepthBuffer: true,
      });

      renderer.domElement.className = 'universe-canvas';
      renderer.outputColorSpace = THREE.SRGBColorSpace;
      renderer.toneMapping = THREE.ACESFilmicToneMapping;
      renderer.toneMappingExposure = getPhotographicProfile(
        0,
        this.displayOptions.quality,
      ).exposure;
      this.renderPixelRatio = this.performanceManager.resetAdaptivePixelRatio(
        this.displayOptions.quality,
      );
      renderer.setPixelRatio(this.renderPixelRatio);
      container.appendChild(renderer.domElement);
      this.renderer = renderer;
      this.blackHoleLensingPass = new BlackHoleLensingPass();

      const camera = new THREE.PerspectiveCamera(48, 1, 0.025, CAMERA_FAR_DISTANCE);

      camera.position.set(39, 8, 20);
      this.camera = camera;

      const universeScene = new UniverseScene(this.performanceManager);

      if (assets.spaceTileIndex) {
        await universeScene.setNearbyGalaxyOverview(assets.spaceTileIndex, this.coordinateSystem);
      }

      if (assets.starCatalog) {
        const { StarCatalogRegistry } = await import('../objects/star-catalog-registry');
        const starCatalogRegistry = new StarCatalogRegistry(
          assets.starCatalog,
          this.coordinateSystem,
          this.baseObjects,
        );

        this.starCatalogRegistry = starCatalogRegistry;
        this.baseObjects = starCatalogRegistry.resolveCatalogObjects(this.baseObjects);
        this.objects = [...this.baseObjects];
        await universeScene.setStarCatalog(starCatalogRegistry);
        if (assets.starTileSource) {
          const { StarTileManager } = await import('../tiles/star-tile-manager');

          this.starTileManager = new StarTileManager(assets.starTileSource, starCatalogRegistry);
        }
        if (assets.constellationCatalog) {
          await universeScene.setConstellationCatalog(
            assets.constellationCatalog,
            starCatalogRegistry,
          );
        }
      }
      if (!assets.starCatalog || !assets.starTileSource) {
        this.starTileManager = null;
      }
      if (assets.exoplanetCatalog) {
        const { ExoplanetCatalogRegistry } = await import('../objects/exoplanet-catalog-registry');
        const exoplanetCatalogRegistry = new ExoplanetCatalogRegistry(
          assets.exoplanetCatalog,
          this.coordinateSystem,
          this.baseObjects,
        );

        this.exoplanetCatalogRegistry = exoplanetCatalogRegistry;
        await universeScene.setExoplanetCatalog(exoplanetCatalogRegistry);
      }
      if (assets.cosmicGroupCatalog) {
        const { CosmicGroupCatalogRegistry } =
          await import('../objects/cosmic-group-catalog-registry');
        const cosmicGroupCatalogRegistry = new CosmicGroupCatalogRegistry(
          assets.cosmicGroupCatalog,
          this.coordinateSystem,
        );

        this.cosmicGroupCatalogRegistry = cosmicGroupCatalogRegistry;
        await universeScene.setCosmicGroupCatalog(cosmicGroupCatalogRegistry);
      }
      if (assets.cosmicStructureCatalog) {
        const { CosmicStructureCatalogRegistry } =
          await import('../objects/cosmic-structure-catalog-registry');
        const cosmicStructureCatalogRegistry = new CosmicStructureCatalogRegistry(
          assets.cosmicStructureCatalog,
          this.coordinateSystem,
        );

        this.cosmicStructureCatalogRegistry = cosmicStructureCatalogRegistry;
        await universeScene.setCosmicStructureCatalog(cosmicStructureCatalogRegistry);
      }
      if (assets.cosmicWebVolume) {
        await universeScene.setCosmicWebVolume(assets.cosmicWebVolume, this.coordinateSystem);
      }
      universeScene.setQuality(this.displayOptions.quality);
      universeScene.setPixelRatio(this.renderPixelRatio);
      universeScene.setConstellationsEnabled(this.displayOptions.showConstellations);
      this.universeScene = universeScene;

      const cameraController = new CameraController(
        camera,
        renderer.domElement,
        this.handleCameraSettled,
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

      universeScene.setStellarOrigin(registry.getSpacePosition('sun') ?? new THREE.Vector3());
      registry.updateBodyRotations(initialTime);
      this.earthRotationPlayback.reset(initialTime);
      this.emitSolarEclipseState(solarEclipseAppearance, true);
      registry.setDisplayOptions(this.displayOptions);
      this.objectRegistry = registry;

      const labelObjects = this.getLabelObjects();
      const labelManager = new LabelManager(
        container,
        labelObjects,
        this.displayOptions.quality,
        this.displayOptions.labelDensity,
        (objectId) => {
          if (this.universeScene?.hasConstellation(objectId)) {
            return this.displayOptions.showConstellations;
          }

          const registry = this.getObjectRegistry(objectId);
          const cosmicMapVisible =
            this.universeScene?.isCatalogObjectVisibleForLabels(objectId) ?? true;

          return cosmicMapVisible && (registry === null || registry.isVisibleForLabels(objectId));
        },
        this.labelNameResolver,
      );

      labelManager.setEnabled(this.displayOptions.showLabels);
      this.labelManager = labelManager;

      this.selectionManager = new SelectionManager(
        renderer.domElement,
        camera,
        () => [
          ...(this.objectRegistry?.getPickables() ?? []),
          ...(this.spaceTileObjectRegistry?.getPickables() ?? []),
          ...(this.activeExoplanetSystemRegistry?.getPickables() ?? []),
          ...(this.universeScene?.getCatalogPickables() ?? []),
        ],
        (clientX, clientY) => this.labelManager?.hitTest(clientX, clientY) ?? null,
        (objectId, focusRequested) => this.handlePick(objectId, focusRequested),
        (objectId) => this.handleNavigationIntent(objectId),
        () => this.cameraController?.distanceToTarget ?? 1,
        (objectId) =>
          this.starCatalogRegistry?.has(objectId) === true ||
          this.exoplanetCatalogRegistry?.has(objectId) === true ||
          this.cosmicGroupCatalogRegistry?.has(objectId) === true ||
          this.cosmicStructureCatalogRegistry?.has(objectId) === true ||
          this.universeScene?.hasConstellation(objectId) === true ||
          this.getDefinition(objectId)?.type === 'galaxy',
        (objectId) => {
          this.labelManager?.setHoveredObject(objectId);
          this.universeScene?.hoverConstellation(objectId);
          this.universeScene?.hoverCatalogObject(objectId);
        },
        this.handleSemanticZoomIntent,
        (objectId) =>
          this.getObjectRegistry(objectId) !== null ||
          this.exoplanetCatalogRegistry?.has(objectId) === true ||
          this.cosmicGroupCatalogRegistry?.has(objectId) === true ||
          this.cosmicStructureCatalogRegistry?.has(objectId) === true,
      );
      this.renderLoop = new RenderLoop((deltaSeconds) => this.renderFrame(deltaSeconds));

      this.resize(container.clientWidth, container.clientHeight);
      this.initialized = true;
      this.emitDataReady();
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
    this.stop();
    this.selectionManager?.dispose();
    this.cameraController?.dispose();
    this.labelManager?.dispose();
    this.objectRegistry?.dispose();
    this.spaceTileObjectRegistry?.dispose();
    this.activeExoplanetSystemRegistry?.dispose();
    this.universeScene?.dispose();
    this.blackHoleLensingPass?.dispose();
    this.renderer?.renderLists.dispose();
    this.renderer?.dispose();
    this.renderer?.domElement.remove();

    this.selectionManager = null;
    this.cameraController = null;
    this.labelManager = null;
    this.starCatalogRegistry = null;
    this.exoplanetCatalogRegistry = null;
    this.cosmicGroupCatalogRegistry = null;
    this.cosmicStructureCatalogRegistry = null;
    this.tempelFilamentSpineSource = null;
    this.tempelFilamentSpineLoadPromise = null;
    this.tempelFilamentSpineWarningEmitted = false;
    this.objectRegistry = null;
    this.spaceTileObjectRegistry = null;
    this.activeExoplanetSystemRegistry = null;
    this.activeExoplanetSystemObjects = [];
    this.universeScene = null;
    this.renderer = null;
    this.camera = null;
    this.renderLoop = null;
    this.blackHoleLensingPass = null;
    this.container = null;
    this.baseObjects = [];
    this.objects = [];
    this.spaceTileManager = null;
    this.starTileManager = null;
    this.pendingStarTileView = null;
    this.starTileSynchronizationRunning = false;
    this.starTileSynchronizationAccumulator = STAR_TILE_SYNCHRONIZATION_INTERVAL_SECONDS;
    this.lastStarTileLod = -1;
    this.lastStarTileWarning = null;
    this.pendingSpaceTileRequest = null;
    this.spaceTileSynchronizationAccumulator = SPACE_TILE_SYNCHRONIZATION_INTERVAL_SECONDS;
    this.tileSynchronizationRunning = false;
    this.lastSpaceTileContextKey = null;
    this.targetId = null;
    this.navigationContextJourney.clear();
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
    this.activeExoplanetSystemRegistry?.updatePositions(time);
    this.activeExoplanetSystemRegistry?.updateBodyRotations(time);
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
    const controller = this.cameraController;

    if (!this.objectRegistry || !controller || !this.hasObject(objectId)) {
      throw new Error(`Objet astronomique introuvable : ${objectId}.`);
    }
    await this.ensureSpaceTileObject(objectId);
    this.ensureActiveExoplanetSystem(objectId);
    const position = this.getWorldPosition(objectId);
    const object = this.getDefinition(objectId);

    if (!this.objectRegistry || !position || !object) {
      throw new Error(`Position indisponible pour ${objectId}.`);
    }
    if (object.type === 'cosmic-filament') {
      await this.ensureTempelFilamentSpines();
    }

    this.clearSolarEclipsePresentation();
    this.selectionManager?.clearNavigationLock();
    this.targetId = objectId;
    this.navigationContextJourney.adoptTarget(objectId);
    this.setNavigationTargetOnRegistries(objectId);
    this.selectObject(objectId);
    const constellationRadius = this.universeScene?.getConstellationFocusRadius(objectId);

    if (constellationRadius !== null && constellationRadius !== undefined && this.camera) {
      const direction = position.clone().negate();

      controller.focusOnFromDirection(
        position,
        object,
        direction,
        zoom ?? getOrbitOverviewDistance(constellationRadius, this.camera.fov),
      );
    } else {
      controller.focusOn(
        position,
        object,
        zoom ??
          (this.exoplanetCatalogRegistry?.isHost(objectId)
            ? EXOPLANET_SYSTEM_FOCUS_DISTANCE
            : this.starCatalogRegistry?.has(objectId)
              ? CATALOG_STAR_FOCUS_DISTANCE
              : undefined),
      );
    }
    this.emit({ type: 'target-changed', objectId });
  }

  public completeTargetTransition(): void {
    this.cameraController?.completeFocusTransition();
  }

  public async viewRotation(objectId: string): Promise<void> {
    const object = this.getDefinition(objectId);

    if (!object?.visual.rotationPeriodHours) {
      throw new Error(`Rotation indisponible pour ${object?.name ?? objectId}.`);
    }
    const distance = Math.max(
      object.visual.visualRadius * 4.4,
      getMinimumNavigationDistance(object) * 1.35,
    );

    await this.setTarget(objectId, distance);
  }

  public viewOrbit(objectId: string): void {
    this.ensureActiveExoplanetSystem(objectId);
    const registry = this.getObjectRegistry(objectId);
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
    this.navigationContextJourney.adoptTarget(parentId);
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
    this.navigationContextJourney.adoptTarget(scale.targetId);
    this.setNavigationTargetOnRegistries(scale.targetId);
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
    this.navigationContextJourney.adoptTarget('earth');
    registry.setSolarObserverActive(false);
    this.setNavigationTargetOnRegistries('earth');
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
    this.navigationContextJourney.clear();
    registry.clearSolarEclipsePath();
    registry.setSolarObserverActive(true, moonVisualScale);
    this.setNavigationTargetOnRegistries('sun');
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
    if (objectId) {
      this.ensureActiveExoplanetSystem(objectId);
    }
    const object = objectId ? (this.getDefinition(objectId) ?? null) : null;

    if (objectId && !object) {
      return;
    }
    this.selectedId = objectId;
    const detailedObjectId =
      objectId &&
      (this.objectRegistry?.has(objectId) ||
        this.spaceTileObjectRegistry?.has(objectId) ||
        this.activeExoplanetSystemRegistry?.has(objectId))
        ? objectId
        : null;
    const catalogObjectId =
      objectId &&
      !detailedObjectId &&
      (this.starCatalogRegistry?.has(objectId) ||
        this.exoplanetCatalogRegistry?.has(objectId) ||
        this.cosmicGroupCatalogRegistry?.has(objectId) ||
        this.cosmicStructureCatalogRegistry?.has(objectId))
        ? objectId
        : null;
    const constellationObjectId =
      objectId && this.universeScene?.hasConstellation(objectId) ? objectId : null;

    this.selectOnRegistries(detailedObjectId);
    this.universeScene?.selectCatalogObject(catalogObjectId);
    this.universeScene?.selectConstellation(constellationObjectId);
    this.labelManager?.setTransientObject(catalogObjectId ? object : null);
    this.labelManager?.setDetailsPanelVisible(objectId !== null);
    if (object?.type === 'cosmic-filament') {
      void this.ensureTempelFilamentSpines();
    }
    this.emit({ type: 'object-selected', objectId, object });
  }

  public focusSelected(): void {
    if (this.selectedId) {
      void this.setTarget(this.selectedId);
    }
  }

  public setDisplayOptions(options: DisplayOptions): void {
    const qualityChanged = options.quality !== this.displayOptions.quality;
    const labelDensityChanged = options.labelDensity !== this.displayOptions.labelDensity;

    this.displayOptions = { ...options };
    this.universeScene?.setQuality(this.displayOptions.quality);
    this.universeScene?.setConstellationsEnabled(this.displayOptions.showConstellations);
    this.labelManager?.setEnabled(this.displayOptions.showLabels);
    this.labelManager?.setDensity(this.displayOptions.labelDensity);

    if (qualityChanged) {
      this.renderPixelRatio = this.performanceManager.resetAdaptivePixelRatio(
        this.displayOptions.quality,
      );
      this.universeScene?.setPixelRatio(this.renderPixelRatio);
      this.lastStarTileLod = -1;
      this.starTileSynchronizationAccumulator = STAR_TILE_SYNCHRONIZATION_INTERVAL_SECONDS;
      if (this.objectRegistry && this.universeScene) {
        this.rebuildObjectRegistry();
      }
      this.labelManager?.setQuality(this.displayOptions.quality);
      if (this.renderer) {
        this.renderer.setPixelRatio(this.renderPixelRatio);
        if (this.container) {
          this.resize(this.container.clientWidth, this.container.clientHeight);
        }
      }
    } else {
      this.universeScene?.setPixelRatio(this.renderPixelRatio);
    }
    if (qualityChanged || labelDensityChanged) {
      this.labelManager?.setObjects(this.getLabelObjects());
    }
    this.objectRegistry?.setDisplayOptions(this.displayOptions);
    this.spaceTileObjectRegistry?.setDisplayOptions(this.displayOptions);
    this.activeExoplanetSystemRegistry?.setDisplayOptions(this.displayOptions);
  }

  public setLabelNameResolver(resolver: LabelNameResolver): void {
    this.labelNameResolver = resolver;
    this.labelManager?.setNameResolver(resolver);
  }

  public setCosmicMapLayers(layers: CosmicMapLayers): void {
    this.universeScene?.setCosmicMapLayers(layers);
    if (layers.filaments && this.lodManager.level >= 6) {
      void this.ensureTempelFilamentSpines();
    }
  }

  public zoomBy(factor: number): void {
    const controller = this.cameraController;

    if (!controller) {
      return;
    }
    const previousLodLevel = this.lodManager.selectLevel(controller.distanceToTarget);

    controller.zoomBy(factor);
    const nextLodLevel = this.lodManager.selectLevel(controller.distanceToTarget);

    if (nextLodLevel !== previousLodLevel) {
      this.synchronizeNavigationContextTarget(controller, nextLodLevel);
    }
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
    return (
      this.objectRegistry?.has(objectId) === true ||
      this.spaceTileObjectRegistry?.has(objectId) === true ||
      this.starCatalogRegistry?.has(objectId) === true ||
      this.exoplanetCatalogRegistry?.has(objectId) === true ||
      this.cosmicGroupCatalogRegistry?.has(objectId) === true ||
      this.cosmicStructureCatalogRegistry?.has(objectId) === true ||
      this.universeScene?.hasConstellation(objectId) === true ||
      this.spaceTileManager?.hasObject(objectId) === true
    );
  }

  public get recommendedQuality(): GraphicQuality {
    return this.performanceManager.recommendQuality();
  }

  private labelNameResolver: LabelNameResolver = (_objectId, fallback) => fallback;

  private readonly handleSemanticZoomIntent = (
    objectId: string | null,
    deltaY: number,
    pointer: ZoomPointer = { x: 0, y: 0 },
  ): void => {
    const controller = this.cameraController;

    if (!controller) {
      return;
    }
    const previousLodLevel = this.lodManager.selectLevel(controller.distanceToTarget);
    const zoomObjectId =
      deltaY < 0 && controller.isTransitioning && objectId !== this.targetId ? null : objectId;
    const anchorPosition = zoomObjectId ? this.getWorldPosition(zoomObjectId) : null;
    const anchorObject = zoomObjectId ? this.getDefinition(zoomObjectId) : undefined;

    if (!(deltaY < 0)) {
      controller.adoptZoomAnchor(controller.controls.target);
      this.lastZoomAnchor = {
        anchorType: 'target',
        anchorObjectId: null,
      };
    } else if (anchorPosition) {
      controller.adoptZoomAnchor(anchorPosition);
      this.lastZoomAnchor = {
        anchorType: 'object',
        anchorObjectId: zoomObjectId,
      };
    } else {
      controller.adoptZoomPointer(pointer.x, pointer.y);
      this.lastZoomAnchor = {
        anchorType: 'pointer',
        anchorObjectId: null,
      };
    }
    if (zoomObjectId && anchorPosition && anchorObject && deltaY < 0) {
      this.adoptSemanticZoomTarget(zoomObjectId, anchorPosition, anchorObject, controller);
    }
    controller.zoomSemantically(deltaY);
    const nextLodLevel = this.lodManager.selectLevel(controller.distanceToTarget);

    if (nextLodLevel !== previousLodLevel) {
      this.synchronizeNavigationContextTarget(controller, nextLodLevel);
    }
  };

  private adoptSemanticZoomTarget(
    objectId: string,
    position: THREE.Vector3,
    object: SpaceObject,
    controller: CameraController,
  ): void {
    if (!this.objectRegistry || this.targetId === objectId) {
      return;
    }

    this.targetId = objectId;
    this.navigationContextJourney.adoptTarget(objectId);
    this.setNavigationTargetOnRegistries(objectId);
    controller.trackTarget(position, object);
    this.emit({ type: 'target-changed', objectId });
  }

  private synchronizeNavigationContextTarget(controller: CameraController, lodLevel: number): void {
    let context = this.navigationContextJourney.resolve(lodLevel);

    if (!context.targetId && this.targetId) {
      this.navigationContextJourney.adoptTarget(this.targetId);
      context = this.navigationContextJourney.resolve(lodLevel);
    }

    if (!context.targetId || context.targetId === this.targetId) {
      return;
    }
    const object = this.getDefinition(context.targetId);
    const position = this.getWorldPosition(context.targetId);

    if (!object || !position) {
      return;
    }

    this.targetId = context.targetId;
    this.setNavigationTargetOnRegistries(context.targetId);
    controller.transitionReferenceFrame(position, object);
    this.emit({ type: 'target-changed', objectId: context.targetId });
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
    const renderer = this.renderer;
    const camera = this.camera;
    const universeScene = this.universeScene;
    const registry = this.objectRegistry;
    const controller = this.cameraController;
    const blackHoleLensingPass = this.blackHoleLensingPass;

    if (
      !renderer ||
      !camera ||
      !universeScene ||
      !registry ||
      !controller ||
      !blackHoleLensingPass
    ) {
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
      this.activeExoplanetSystemRegistry?.updateBodyRotations(currentTime);
    }

    if (timeAdvanced && this.simulationAccumulator >= SIMULATION_UPDATE_INTERVAL_SECONDS) {
      const solarEclipseAppearance = registry.updatePositions(currentTime);

      this.activeExoplanetSystemRegistry?.updatePositions(currentTime);

      this.emitSolarEclipseState(solarEclipseAppearance, false);
      this.followCurrentTarget();
      this.simulationAccumulator = 0;
    }

    if (timeAdvanced && this.timeEventAccumulator >= 0.12) {
      this.emit({ type: 'time-changed', time: currentTime });
      this.timeEventAccumulator = 0;
    }

    controller.update(deltaSeconds);
    this.floatingOriginShift.copy(controller.controls.target);
    const originShifted = this.floatingOriginManager.update(
      universeScene.spaceRoot,
      camera,
      controller.controls.target,
      controller.isTransitioning,
    );

    if (originShifted) {
      controller.shiftTrackedPosition(this.floatingOriginShift);
    }

    const lodLevel = this.lodManager.selectLevel(controller.distanceToTarget);
    const photographicProfile = getPhotographicProfile(lodLevel, this.displayOptions.quality);

    renderer.toneMappingExposure = dampPhotographicExposure(
      renderer.toneMappingExposure,
      photographicProfile.exposure,
      deltaSeconds,
    );

    if (lodLevel !== this.lastEmittedLodLevel) {
      this.lastEmittedLodLevel = lodLevel;
      this.emit({ type: 'lod-changed', level: lodLevel });
    }
    this.requestSpaceTileSynchronization(lodLevel, deltaSeconds);
    this.requestStarTileSynchronization(lodLevel, deltaSeconds);
    if (lodLevel >= 0 && lodLevel <= 4) {
      void universeScene.ensureMilkyWayAtlas();
    }
    if (lodLevel >= 6) {
      void this.ensureTempelFilamentSpines();
    }
    registry.updateLod(
      camera,
      this.container?.clientHeight ?? renderer.domElement.clientHeight,
      lodLevel,
      deltaSeconds,
    );
    this.spaceTileObjectRegistry?.updateLod(
      camera,
      this.container?.clientHeight ?? renderer.domElement.clientHeight,
      lodLevel,
      deltaSeconds,
    );
    this.activeExoplanetSystemRegistry?.updateLod(
      camera,
      this.container?.clientHeight ?? renderer.domElement.clientHeight,
      lodLevel,
      deltaSeconds,
    );
    universeScene.updateLod(lodLevel, deltaSeconds, controller.distanceToTarget, camera.position);
    const viewportWidth = this.container?.clientWidth ?? renderer.domElement.clientWidth;
    const viewportHeight = this.container?.clientHeight ?? renderer.domElement.clientHeight;
    const lensingObjectId = this.targetId ?? this.selectedId;
    const lensingRegistry = lensingObjectId ? this.getObjectRegistry(lensingObjectId) : null;
    const lensingObject = lensingObjectId ? this.getDefinition(lensingObjectId) : undefined;
    const lensingPosition = lensingObjectId
      ? this.getWorldPosition(lensingObjectId, this.blackHoleLensingPosition)
      : null;
    const lensingEffect = projectBlackHoleLensing(
      lensingObject,
      lensingPosition,
      camera,
      viewportWidth,
      viewportHeight,
      this.displayOptions.quality,
    );
    const lensingForeground =
      lensingObjectId && lensingRegistry
        ? lensingRegistry.getLensingForeground(lensingObjectId)
        : null;

    blackHoleLensingPass.render(
      renderer,
      universeScene.scene,
      camera,
      lensingEffect,
      lensingForeground,
      deltaSeconds,
    );
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
    const adjustedPixelRatio = this.performanceManager.observeFrameRate(
      this.displayOptions.quality,
      this.lastFps,
    );

    if (adjustedPixelRatio !== null) {
      this.renderPixelRatio = adjustedPixelRatio;
      renderer.setPixelRatio(adjustedPixelRatio);
      universeScene.setPixelRatio(adjustedPixelRatio);
      if (this.container) {
        this.resize(this.container.clientWidth, this.container.clientHeight);
      }
    }
    const navigationContext = this.navigationContextJourney.resolve(this.lodManager.level);
    const stats: EngineDebugStats = {
      fps: this.lastFps,
      drawCalls: renderer.info.render.calls,
      triangles: renderer.info.render.triangles,
      geometries: renderer.info.memory.geometries,
      textures: renderer.info.memory.textures,
      visibleObjects:
        registry.visibleObjectCount +
        (this.spaceTileObjectRegistry?.visibleObjectCount ?? 0) +
        (this.activeExoplanetSystemRegistry?.visibleObjectCount ?? 0),
      catalogStars: universeScene.visibleCatalogStarCount,
      exoplanetHosts: universeScene.visibleExoplanetHostCount,
      exoplanets: universeScene.exoplanetCount,
      cosmicGroups: universeScene.visibleCosmicGroupCount,
      cosmicFilaments: universeScene.visibleCosmicFilamentCount,
      cosmicStructures: universeScene.visibleCosmicStructureCount,
      tempelFilamentSpines: universeScene.tempelFilamentSpineCount,
      tempelSpineSegments: universeScene.tempelFilamentSpineSegmentCount,
      visibleTempelSpineSegments: universeScene.visibleTempelFilamentSpineSegmentCount,
      tempelSpineTiles: universeScene.tempelFilamentSpineTileCount,
      batchedGalaxies:
        registry.batchedGalaxyCount + (this.spaceTileObjectRegistry?.batchedGalaxyCount ?? 0),
      loadedTiles: this.spaceTileManager?.loadedTileCount ?? 0,
      indexedGalaxyTiles: this.spaceTileManager?.indexedTileCount ?? 0,
      cachedGalaxyTiles: this.spaceTileManager?.cachedTileCount ?? 0,
      activeStarTiles: this.starTileManager?.activeTileCount ?? 0,
      cachedStarPacks: this.starTileManager?.cachedPackCount ?? 0,
      cachedStarTiles: this.starTileManager?.cachedTileCount ?? 0,
      activeStarClusters: this.starTileManager?.activeClusterCount ?? 0,
      cachedStarClusters: this.starTileManager?.cachedClusterCount ?? 0,
      visibleStarClusters: universeScene.visibleStarClusterCount,
      cameraPosition: vectorToLike(camera.position),
      cameraTarget: this.cameraController
        ? vectorToLike(this.cameraController.controls.target)
        : { x: 0, y: 0, z: 0 },
      cameraDistance: this.cameraController?.distanceToTarget ?? 0,
      floatingOrigin: vectorToLike(this.floatingOriginManager.accumulatedOrigin),
      targetId: this.targetId,
      navigationOriginId: navigationContext.targetId ?? this.targetId,
      navigationReferenceFrame: navigationContext.referenceFrame,
      lodLevel: this.lodManager.level,
      julianDay: this.timeController.currentTime.julianDay,
      quality: this.displayOptions.quality,
      pixelRatio: this.renderPixelRatio,
      zoom:
        this.cameraController?.lastZoomDiagnostics && this.lastZoomAnchor
          ? {
              ...this.cameraController.lastZoomDiagnostics,
              ...this.lastZoomAnchor,
            }
          : null,
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
    const controller = this.cameraController;

    if (!objectId) {
      this.releaseNavigationTarget();

      return;
    }
    this.ensureActiveExoplanetSystem(objectId);
    const position = this.getWorldPosition(objectId);
    const object = this.getDefinition(objectId);

    if (!this.objectRegistry || !controller || !position || !object) {
      return;
    }

    const targetChanged = this.targetId !== objectId;

    this.targetId = objectId;
    this.navigationContextJourney.adoptTarget(objectId);
    this.setNavigationTargetOnRegistries(objectId);
    controller.adoptZoomTarget(position, object);
    if (targetChanged) {
      this.emit({ type: 'target-changed', objectId });
    }
  }

  private releaseNavigationTarget(): void {
    this.cameraController?.releaseTarget();
    this.setNavigationTargetOnRegistries(null);
    if (this.targetId !== null) {
      this.targetId = null;
      this.navigationContextJourney.clear();
      this.emit({ type: 'target-changed', objectId: null });
    }
  }

  private rebuildObjectRegistry(): void {
    const universeScene = this.universeScene;

    if (!universeScene) {
      return;
    }

    this.objectRegistry?.dispose();
    this.spaceTileObjectRegistry?.dispose();
    this.spaceTileObjectRegistry = null;
    const registry = new ObjectRegistry(
      universeScene.spaceRoot,
      this.coordinateSystem,
      this.baseObjects,
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
    const selectedRegistryId =
      this.selectedId && registry.has(this.selectedId) ? this.selectedId : null;
    const selectedCatalogId =
      this.selectedId &&
      !selectedRegistryId &&
      (this.starCatalogRegistry?.has(this.selectedId) ||
        this.exoplanetCatalogRegistry?.has(this.selectedId) ||
        this.cosmicGroupCatalogRegistry?.has(this.selectedId) ||
        this.cosmicStructureCatalogRegistry?.has(this.selectedId))
        ? this.selectedId
        : null;
    const selectedConstellationId =
      this.selectedId && universeScene.hasConstellation(this.selectedId) ? this.selectedId : null;

    registry.select(selectedRegistryId);
    universeScene.selectCatalogObject(selectedCatalogId);
    universeScene.selectConstellation(selectedConstellationId);
    registry.setSolarObserverActive(this.solarObserverActive, this.solarObserverMoonScale);
    if (this.activeSolarEclipse && this.solarEclipsePathVisible && !this.solarObserverActive) {
      registry.showSolarEclipsePath(this.activeSolarEclipse.peak, this.activeSolarEclipse.kind);
    }
    this.objectRegistry = registry;
    this.rebuildSpaceTileObjectRegistry();
    this.rebuildActiveExoplanetSystemRegistry();
    this.followCurrentTarget();
  }

  private ensureActiveExoplanetSystem(objectId: string): void {
    const catalogRegistry = this.exoplanetCatalogRegistry;

    if (!catalogRegistry?.has(objectId) || this.objectRegistry?.has(objectId)) {
      return;
    }
    const hostId = catalogRegistry.getHostIdForObject(objectId);

    if (!hostId || this.activeExoplanetSystemRegistry?.has(hostId)) {
      return;
    }
    this.activeExoplanetSystemObjects = [...catalogRegistry.createSystemObjects(objectId)];
    this.rebuildActiveExoplanetSystemRegistry();
    this.labelManager?.setObjects(this.getLabelObjects());
    if (this.initialized) {
      this.emit({ type: 'objects-changed', objects: this.getPublicObjects() });
    }
  }

  private rebuildActiveExoplanetSystemRegistry(): void {
    const universeScene = this.universeScene;

    this.activeExoplanetSystemRegistry?.dispose();
    this.activeExoplanetSystemRegistry = null;
    if (!universeScene || this.activeExoplanetSystemObjects.length === 0) {
      return;
    }
    const registry = new ObjectRegistry(
      universeScene.spaceRoot,
      this.coordinateSystem,
      this.activeExoplanetSystemObjects,
      this.displayOptions.quality,
    );
    const currentTime = this.timeController.currentTime;

    registry.updatePositions(currentTime);
    registry.updateBodyRotations(currentTime);
    registry.setDisplayOptions(this.displayOptions);
    registry.setNavigationTarget(
      this.targetId && registry.has(this.targetId) ? this.targetId : null,
    );
    registry.select(this.selectedId && registry.has(this.selectedId) ? this.selectedId : null);
    this.activeExoplanetSystemRegistry = registry;
  }

  private rebuildSpaceTileObjectRegistry(): void {
    const universeScene = this.universeScene;
    const loadedObjects = this.spaceTileManager?.loadedObjects ?? [];

    this.spaceTileObjectRegistry?.dispose();
    this.spaceTileObjectRegistry = null;
    if (!universeScene || loadedObjects.length === 0) {
      return;
    }

    const registry = new ObjectRegistry(
      universeScene.spaceRoot,
      this.coordinateSystem,
      loadedObjects,
      this.displayOptions.quality,
    );
    const currentTime = this.timeController.currentTime;

    registry.updatePositions(currentTime);
    registry.setDisplayOptions(this.displayOptions);
    registry.setNavigationTarget(
      this.targetId && registry.has(this.targetId) ? this.targetId : null,
    );
    registry.select(this.selectedId && registry.has(this.selectedId) ? this.selectedId : null);
    this.spaceTileObjectRegistry = registry;
  }

  private async ensureSpaceTileObject(objectId: string): Promise<void> {
    const manager = this.spaceTileManager;

    if (!manager?.hasObject(objectId) || this.objects.some((object) => object.id === objectId)) {
      return;
    }

    this.emit({ type: 'loading-state', loading: true });
    try {
      await manager.ensureObject(objectId);
      if (this.spaceTileManager === manager && this.initialized) {
        this.applyLoadedSpaceTiles();
      }
    } finally {
      this.emit({ type: 'loading-state', loading: false });
    }
  }

  private ensureTempelFilamentSpines(): Promise<void> {
    if (this.tempelFilamentSpineLoadPromise) {
      return this.tempelFilamentSpineLoadPromise;
    }
    const source = this.tempelFilamentSpineSource;
    const scene = this.universeScene;
    const registry = this.cosmicStructureCatalogRegistry;

    if (!source || !scene || !registry || !this.initialized) {
      return Promise.resolve();
    }

    this.tempelFilamentSpineLoadPromise = (async () => {
      try {
        const { loadTempelFilamentSpineCatalog } =
          await import('../loaders/tempel-filament-spine-catalog');
        const catalog = await loadTempelFilamentSpineCatalog(source);

        if (
          this.initialized &&
          this.tempelFilamentSpineSource === source &&
          this.universeScene === scene &&
          this.cosmicStructureCatalogRegistry === registry
        ) {
          await scene.setTempelFilamentSpineCatalog(catalog, registry, this.coordinateSystem);
          if (!this.initialized || this.universeScene !== scene) {
            scene.dispose();

            return;
          }
          scene.selectCatalogObject(this.selectedId);
        }
      } catch (error) {
        if (!this.tempelFilamentSpineWarningEmitted && this.initialized) {
          const reason = error instanceof Error ? error.message : 'erreur inconnue';

          this.tempelFilamentSpineWarningEmitted = true;
          this.emit({
            type: 'performance-warning',
            message: `Épines Tempel indisponibles : ${reason}`,
          });
        }
      }
    })();

    return this.tempelFilamentSpineLoadPromise;
  }

  private requestSpaceTileSynchronization(lodLevel: number, deltaSeconds: number): void {
    const manager = this.spaceTileManager;
    const scene = this.universeScene;
    const camera = this.camera;
    const renderer = this.renderer;
    const controller = this.cameraController;

    if (!manager || !scene || !camera || !renderer || !controller) {
      return;
    }
    this.spaceTileSynchronizationAccumulator += deltaSeconds;
    if (controller.isTransitioning) {
      return;
    }
    const retainedIds = [this.targetId, this.selectedId]
      .filter((objectId): objectId is string => objectId !== null && manager.hasObject(objectId))
      .sort();
    const contextKey = `${lodLevel}:${this.displayOptions.quality}:${retainedIds.join(',')}`;
    const contextChanged = contextKey !== this.lastSpaceTileContextKey;

    if (
      !contextChanged &&
      this.spaceTileSynchronizationAccumulator < SPACE_TILE_SYNCHRONIZATION_INTERVAL_SECONDS
    ) {
      return;
    }
    this.lastSpaceTileContextKey = contextKey;
    this.spaceTileSynchronizationAccumulator = 0;
    camera.updateMatrixWorld();
    this.pendingSpaceTileRequest = {
      view: createSpaceTileView(
        camera,
        this.container?.clientHeight ?? renderer.domElement.clientHeight,
        lodLevel,
        this.displayOptions.quality,
        scene.spaceRoot.position,
      ),
      retainedObjectIds: retainedIds,
    };
    if (!this.tileSynchronizationRunning) {
      void this.drainSpaceTileSynchronizations();
    }
  }

  private requestStarTileSynchronization(lodLevel: number, deltaSeconds: number): void {
    const manager = this.starTileManager;
    const scene = this.universeScene;
    const registry = this.starCatalogRegistry;
    const camera = this.camera;
    const renderer = this.renderer;

    if (!manager || !scene || !registry || !camera || !renderer) {
      return;
    }
    this.starTileSynchronizationAccumulator += deltaSeconds;
    const lodChanged = lodLevel !== this.lastStarTileLod;

    if (
      !lodChanged &&
      this.starTileSynchronizationAccumulator < STAR_TILE_SYNCHRONIZATION_INTERVAL_SECONDS
    ) {
      return;
    }
    this.lastStarTileLod = lodLevel;
    this.starTileSynchronizationAccumulator = 0;
    camera.updateMatrixWorld();
    this.pendingStarTileView = createStarTileView(
      camera,
      this.container?.clientHeight ?? renderer.domElement.clientHeight,
      lodLevel,
      this.displayOptions.quality,
      scene.spaceRoot.position,
    );
    if (!this.starTileSynchronizationRunning) {
      void this.drainStarTileSynchronizations();
    }
  }

  private async drainStarTileSynchronizations(): Promise<void> {
    this.starTileSynchronizationRunning = true;

    while (this.pendingStarTileView) {
      const view = this.pendingStarTileView;

      this.pendingStarTileView = null;
      const manager = this.starTileManager;
      const scene = this.universeScene;
      const registry = this.starCatalogRegistry;

      if (!manager || !scene || !registry) {
        continue;
      }
      try {
        const result = await manager.synchronize(view);

        this.lastStarTileWarning = null;
        if (
          result.changed &&
          this.pendingStarTileView === null &&
          this.starTileManager === manager &&
          this.universeScene === scene &&
          this.starCatalogRegistry === registry &&
          this.initialized
        ) {
          await scene.setStarClusterTiles(result.tiles, registry);
        }
      } catch (error) {
        const reason = error instanceof Error ? error.message : 'erreur inconnue';

        if (reason !== this.lastStarTileWarning) {
          this.lastStarTileWarning = reason;
          this.emit({
            type: 'performance-warning',
            message: `Streaming stellaire indisponible : ${reason}`,
          });
        }
      }
    }

    this.starTileSynchronizationRunning = false;
  }

  private async drainSpaceTileSynchronizations(): Promise<void> {
    this.tileSynchronizationRunning = true;

    while (this.pendingSpaceTileRequest !== null) {
      const request = this.pendingSpaceTileRequest;

      this.pendingSpaceTileRequest = null;
      try {
        await this.synchronizeSpaceTiles(request);
      } catch (error) {
        const reason = error instanceof Error ? error.message : 'erreur inconnue';

        this.emit({
          type: 'performance-warning',
          message: `Chargement spatial partiel : ${reason}`,
        });
      }
    }

    this.tileSynchronizationRunning = false;
  }

  private async synchronizeSpaceTiles(request: SpaceTileSynchronizationRequest): Promise<void> {
    const manager = this.spaceTileManager;

    if (!manager) {
      return;
    }
    const changed = await manager.synchronize(request.view, request.retainedObjectIds);

    if (changed && this.spaceTileManager === manager && this.initialized) {
      this.applyLoadedSpaceTiles();
    }
  }

  private applyLoadedSpaceTiles(): void {
    this.objects = [...this.baseObjects, ...(this.spaceTileManager?.loadedObjects ?? [])];
    this.rebuildSpaceTileObjectRegistry();
    this.labelManager?.setObjects(this.getLabelObjects());
    this.emit({ type: 'objects-changed', objects: this.getPublicObjects() });
  }

  private getLabelObjects(): LabelObject[] {
    const publicObjects = this.getPublicObjects();
    const maximumCatalogRank = getMaximumCatalogLabelPoolRank(
      this.displayOptions.quality,
      this.displayOptions.labelDensity,
    );

    return [
      ...publicObjects,
      ...(this.starCatalogRegistry?.getLabelObjects(publicObjects, maximumCatalogRank) ?? []),
      ...(this.exoplanetCatalogRegistry?.getLabelObjects(maximumCatalogRank) ?? []),
      ...(this.cosmicGroupCatalogRegistry?.getLabelObjects(
        getMaximumCosmicLabelRank(this.displayOptions.quality, 6, this.displayOptions.labelDensity),
      ) ?? []),
      ...(this.cosmicStructureCatalogRegistry?.getLabelObjects(
        getMaximumCosmicLabelRank(this.displayOptions.quality, 6, this.displayOptions.labelDensity),
      ) ?? []),
    ];
  }

  private emitDataReady(): void {
    const publicObjects = this.getPublicObjects();
    const loadedObjectIds = new Set(this.objects.map((object) => object.id));
    const tileSearchEntries =
      this.spaceTileManager?.searchEntries.filter((entry) => !loadedObjectIds.has(entry.id)) ?? [];

    this.emit({
      type: 'data-ready',
      objects: publicObjects,
      catalogEntries: [
        ...(this.starCatalogRegistry?.getSearchEntries() ?? []),
        ...(this.exoplanetCatalogRegistry?.getSearchEntries() ?? []),
        ...(this.cosmicGroupCatalogRegistry?.getSearchEntries() ?? []),
        ...(this.cosmicStructureCatalogRegistry?.getSearchEntries() ?? []),
        ...tileSearchEntries,
      ],
    });
  }

  private getObjectRegistry(objectId: string): ObjectRegistry | null {
    if (this.objectRegistry?.has(objectId)) {
      return this.objectRegistry;
    }
    if (this.spaceTileObjectRegistry?.has(objectId)) {
      return this.spaceTileObjectRegistry;
    }
    if (this.activeExoplanetSystemRegistry?.has(objectId)) {
      return this.activeExoplanetSystemRegistry;
    }

    return null;
  }

  private setNavigationTargetOnRegistries(objectId: string | null): void {
    this.objectRegistry?.setNavigationTarget(
      objectId && this.objectRegistry.has(objectId) ? objectId : null,
    );
    this.spaceTileObjectRegistry?.setNavigationTarget(
      objectId && this.spaceTileObjectRegistry.has(objectId) ? objectId : null,
    );
    this.activeExoplanetSystemRegistry?.setNavigationTarget(
      objectId && this.activeExoplanetSystemRegistry.has(objectId) ? objectId : null,
    );
  }

  private selectOnRegistries(objectId: string | null): void {
    this.objectRegistry?.select(objectId && this.objectRegistry.has(objectId) ? objectId : null);
    this.spaceTileObjectRegistry?.select(
      objectId && this.spaceTileObjectRegistry.has(objectId) ? objectId : null,
    );
    this.activeExoplanetSystemRegistry?.select(
      objectId && this.activeExoplanetSystemRegistry.has(objectId) ? objectId : null,
    );
  }

  private getDefinition(objectId: string): SpaceObject | undefined {
    return (
      this.objectRegistry?.getDefinition(objectId) ??
      this.spaceTileObjectRegistry?.getDefinition(objectId) ??
      this.activeExoplanetSystemRegistry?.getDefinition(objectId) ??
      this.starCatalogRegistry?.getDefinition(objectId) ??
      this.exoplanetCatalogRegistry?.getDefinition(objectId) ??
      this.cosmicGroupCatalogRegistry?.getDefinition(objectId) ??
      this.cosmicStructureCatalogRegistry?.getDefinition(objectId) ??
      this.universeScene?.getConstellationDefinition(objectId)
    );
  }

  private getWorldPosition(objectId: string, target = new THREE.Vector3()): THREE.Vector3 | null {
    return (
      this.objectRegistry?.getWorldPosition(objectId, target) ??
      this.spaceTileObjectRegistry?.getWorldPosition(objectId, target) ??
      this.activeExoplanetSystemRegistry?.getWorldPosition(objectId, target) ??
      this.universeScene?.getCatalogWorldPosition(objectId, target) ??
      this.universeScene?.getConstellationWorldPosition(objectId, target) ??
      null
    );
  }

  private getPublicObjects(): SpaceObject[] {
    return [
      ...this.objects,
      ...this.activeExoplanetSystemObjects,
      ...(this.universeScene?.constellationDefinitions ?? []),
    ];
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
