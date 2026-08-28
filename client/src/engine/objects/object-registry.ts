import * as THREE from 'three';
import {
  DisplayOptions,
  GraphicQuality,
  SpaceObject,
  TemporalMode,
  UniverseTime,
} from '../../data/models/universe.models';
import { CoordinateSystem } from '../coordinates/coordinate-system';
import { calculateGalacticFrameScale } from '../coordinates/galaxy-scale-model';
import type { IntergalacticFrameGroup } from '../coordinates/intergalactic-frame-group';
import { calculateStellarNeighborhoodSceneScale } from '../coordinates/stellar-neighborhood-scale-model';
import type { FarObjectBatch } from '../rendering/far-object-batch';
import { EarthEclipseKind, SolarEclipseAppearance } from '../simulation/earth-eclipse';
import { calculateLunarEclipseAppearance } from '../simulation/lunar-eclipse-calculator';
import { calculateSolarEclipseAppearance } from '../simulation/solar-eclipse-calculator';
import { resolveObjectReceivedLight } from '../simulation/received-light-time';
import {
  ActiveObjectAdornmentController,
  type ActiveObjectAdornmentDiagnostics,
} from './active-object-adornment-controller';
import { BodyRotationController } from './body-rotation-controller';
import { ObjectLodController } from './object-lod-controller';
import {
  createObjectVisualDiagnostics,
  type ObjectVisualDiagnostics,
} from './object-visual-diagnostics';
import { buildObjectRegistry } from './object-registry-builder';
import {
  EarthObserverCelestialPresenter,
  type EarthObserverCelestialPresentation,
} from './earth-observer-celestial-presenter';
import { disposeObjectRegistryTree } from './object-registry-disposer';
import type { ObjectRegistryEntry } from './object-registry-entry';
import { OrbitVisualManager } from './orbit-visual-manager';

export class ObjectRegistry {
  private readonly entries: Map<string, ObjectRegistryEntry>;
  private readonly pickables: THREE.Object3D[];
  private readonly registryRoot: THREE.Group;
  private readonly intergalacticFrames: IntergalacticFrameGroup;
  private readonly galacticFrameRoot: THREE.Group;
  private readonly stellarNeighborhoodRoot: THREE.Group;
  private readonly farObjectBatch: FarObjectBatch;
  private readonly batchedGalaxyTotal: number;
  private readonly activeObjectAdornmentController: ActiveObjectAdornmentController;
  private readonly bodyRotationController = new BodyRotationController();
  private readonly objectLodController: ObjectLodController;
  private readonly orbitVisualManager: OrbitVisualManager;
  private readonly earthObserverCelestialPresenter: EarthObserverCelestialPresenter;
  private selectedId: string | null = null;
  private navigationTargetId: string | null = null;
  private showOrbits = true;
  private solarEclipsePathActive = false;
  private solarEclipsePathRequest = 0;
  private solarEclipseActive = false;
  private solarObserverActive = false;
  private earthObserverActive = false;
  private currentLodLevel = Number.POSITIVE_INFINITY;
  private temporalMode: TemporalMode = 'state';
  private readonly receivedEmissionTimes = new Map<string, UniverseTime>();
  private galacticFrameScale = 1;
  private stellarNeighborhoodReveal = 1;

  constructor(
    private readonly spaceRoot: THREE.Group,
    private readonly coordinateSystem: CoordinateSystem,
    objects: readonly SpaceObject[],
    private readonly quality: GraphicQuality,
  ) {
    const registry = buildObjectRegistry(this.spaceRoot, coordinateSystem, objects, quality);

    this.entries = registry.entries;
    this.pickables = registry.pickables;
    this.registryRoot = registry.registryRoot;
    this.intergalacticFrames = registry.intergalacticFrames;
    this.galacticFrameRoot = registry.galacticFrameRoot;
    this.stellarNeighborhoodRoot = registry.stellarNeighborhoodRoot;
    this.farObjectBatch = registry.farObjectBatch;
    this.batchedGalaxyTotal = registry.batchedGalaxyTotal;
    this.activeObjectAdornmentController = new ActiveObjectAdornmentController(
      this.registryRoot,
      this.entries,
      this.quality,
    );
    this.objectLodController = new ObjectLodController(
      this.registryRoot,
      this.entries,
      this.farObjectBatch,
      this.quality,
    );
    this.orbitVisualManager = new OrbitVisualManager(this.registryRoot, this.entries, this.quality);
    this.earthObserverCelestialPresenter = new EarthObserverCelestialPresenter(
      this.registryRoot,
      this.entries,
    );
  }

  public updatePositions(time: UniverseTime): SolarEclipseAppearance {
    this.receivedEmissionTimes.clear();
    for (const entry of this.entries.values()) {
      const receivedPosition =
        this.temporalMode === 'observable'
          ? (entry.provider.getReceivedPositionAt?.(time) ?? null)
          : null;
      const light =
        this.temporalMode === 'observable'
          ? (receivedPosition?.light ?? resolveObjectReceivedLight(entry.definition, time))
          : null;
      const position =
        receivedPosition?.position ?? entry.provider.getPositionAt(light?.emissionTime ?? time);

      if (light) {
        this.receivedEmissionTimes.set(entry.definition.id, light.emissionTime);
      }

      entry.node.position.set(position.x, position.y, position.z);
      entry.supernova?.updateAppearance(time);
      entry.cometActivity?.updateAppearance(
        entry.node.position,
        this.coordinateSystem.sceneUnitsToAstronomicalUnits(entry.node.position.length()),
      );
    }
    const solarEclipseAppearance = calculateSolarEclipseAppearance(time);

    this.entries.get('moon')?.lunarEclipse?.updateAppearance(calculateLunarEclipseAppearance(time));
    this.entries.get('earth')?.solarEclipse?.updateAppearance(solarEclipseAppearance);
    this.solarEclipseActive = solarEclipseAppearance.phase !== 'none';
    this.updateActiveObjectAdornments();

    return solarEclipseAppearance;
  }

  public updateBodyRotations(time: UniverseTime): void {
    if (this.temporalMode === 'state') {
      this.bodyRotationController.update(this.entries.values(), time);

      return;
    }
    for (const entry of this.entries.values()) {
      this.bodyRotationController.updateEntry(
        entry,
        this.receivedEmissionTimes.get(entry.definition.id) ?? time,
      );
    }
  }

  public updateLod(
    camera: THREE.PerspectiveCamera,
    viewportHeight: number,
    lodLevel: number,
    deltaSeconds: number,
    earthObserverActive = false,
  ): void {
    this.currentLodLevel = lodLevel;
    this.earthObserverActive = earthObserverActive;
    const { selectionMarkerScale } = this.objectLodController.update(
      camera,
      viewportHeight,
      {
        lodLevel,
        selectedId: this.selectedId,
        navigationTargetId: this.navigationTargetId,
        solarObserverActive: this.solarObserverActive,
        earthObserverActive: this.earthObserverActive,
        stellarNeighborhoodReveal: this.stellarNeighborhoodReveal,
      },
      deltaSeconds,
    );

    this.activeObjectAdornmentController.setSelectionMarkerScale(selectionMarkerScale);
    this.applyOrbitVisibility();
    this.updateActiveObjectAdornments();
    this.earthObserverCelestialPresenter.update(
      camera,
      viewportHeight,
      earthObserverActive && !this.solarObserverActive,
    );
  }

  public updateReferenceFrameScale(cameraDistance: number): boolean {
    const intergalacticChanged = this.intergalacticFrames.update(cameraDistance);
    const nextGalacticScale = calculateGalacticFrameScale(cameraDistance);
    const galacticChanged = Math.abs(nextGalacticScale - this.galacticFrameScale) > 1e-12;
    const stellarOriginDistance = this.entries.get('sun')?.node.position.length() ?? 0;
    const stellarSceneScale = calculateStellarNeighborhoodSceneScale(
      cameraDistance,
      stellarOriginDistance,
    );
    const parentScale = Math.max(stellarSceneScale.originScale, 1e-12);
    const nextStellarRadialScale = stellarSceneScale.radialScale / parentScale;
    const nextStellarVerticalScale = stellarSceneScale.verticalScale / parentScale;
    const stellarChanged =
      Math.abs(this.stellarNeighborhoodRoot.scale.x - nextStellarRadialScale) > 1e-12 ||
      Math.abs(this.stellarNeighborhoodRoot.scale.y - nextStellarVerticalScale) > 1e-12;

    if (galacticChanged) {
      this.galacticFrameScale = nextGalacticScale;
      this.galacticFrameRoot.scale.setScalar(nextGalacticScale);
      this.galacticFrameRoot.userData['sceneUnitsPerKiloparsec'] =
        nextGalacticScale * this.coordinateSystem.toSceneDistance(1, 'kiloparsec', 'galactic');
    }

    if (stellarChanged) {
      this.stellarNeighborhoodRoot.scale.set(
        nextStellarRadialScale,
        nextStellarVerticalScale,
        nextStellarRadialScale,
      );
    }
    this.stellarNeighborhoodReveal = stellarSceneScale.reveal;
    this.stellarNeighborhoodRoot.userData['radialScale'] = stellarSceneScale.radialScale;
    this.stellarNeighborhoodRoot.userData['verticalScale'] = stellarSceneScale.verticalScale;
    this.stellarNeighborhoodRoot.userData['originScale'] = stellarSceneScale.originScale;
    this.stellarNeighborhoodRoot.userData['reveal'] = stellarSceneScale.reveal;

    return intergalacticChanged || galacticChanged || stellarChanged;
  }

  public setEarthObserverCelestialPresentations(
    presentations: readonly EarthObserverCelestialPresentation[],
  ): void {
    this.earthObserverCelestialPresenter.setPresentations(presentations);
  }

  public setDisplayOptions(options: DisplayOptions): void {
    this.showOrbits = options.showOrbits;
    this.temporalMode = options.temporalMode;
    this.applyOrbitVisibility();
  }

  public async showSolarEclipsePath(time: UniverseTime, kind: EarthEclipseKind): Promise<void> {
    const request = ++this.solarEclipsePathRequest;
    const visual = this.entries.get('earth')?.solarEclipse;

    this.solarEclipsePathActive = true;
    this.updateActiveObjectAdornments();
    if (!visual) {
      return;
    }
    const { calculateSolarEclipseEventMap, createSolarEclipseEventMapRenderData } =
      await import('../simulation/solar-eclipse-event-map');

    if (request !== this.solarEclipsePathRequest || !this.solarEclipsePathActive) {
      return;
    }
    const eventMap = calculateSolarEclipseEventMap(time);

    visual.setEventMap(eventMap, createSolarEclipseEventMapRenderData(eventMap), kind);
  }

  public clearSolarEclipsePath(): void {
    this.solarEclipsePathRequest += 1;
    this.entries.get('earth')?.solarEclipse?.clearPath();
    this.solarEclipsePathActive = false;
    this.updateActiveObjectAdornments();
  }

  public setSolarObserverActive(active: boolean, moonVisualScale = 1): void {
    this.solarObserverActive = active;
    this.entries.get('moon')?.visualRoot.scale.setScalar(active ? moonVisualScale : 1);
    this.applyOrbitVisibility();
    this.updateActiveObjectAdornments();
  }

  public setNavigationTarget(objectId: string | null): void {
    this.navigationTargetId = objectId;
    this.applyOrbitVisibility();
    this.updateActiveObjectAdornments();
  }

  public select(objectId: string | null): void {
    this.selectedId = objectId;
    this.activeObjectAdornmentController.select(objectId);
    this.applyOrbitVisibility();
    this.updateActiveObjectAdornments();
  }

  public getDefinition(objectId: string): SpaceObject | undefined {
    return this.entries.get(objectId)?.definition;
  }

  public getWorldPosition(objectId: string, target = new THREE.Vector3()): THREE.Vector3 | null {
    const entry = this.entries.get(objectId);

    if (!entry) {
      return null;
    }

    return entry.node.getWorldPosition(target);
  }

  public getLensingForeground(objectId: string): THREE.Object3D | null {
    const entry = this.entries.get(objectId);

    return entry?.definition.type === 'black-hole' ? entry.lensingForeground : null;
  }

  public getSpacePosition(objectId: string, target = new THREE.Vector3()): THREE.Vector3 | null {
    const worldPosition = this.getWorldPosition(objectId, target);

    if (!worldPosition) {
      return null;
    }
    this.spaceRoot.updateWorldMatrix(true, false);

    return this.spaceRoot.worldToLocal(worldPosition);
  }

  public getOrbitRadius(objectId: string): number | null {
    return this.orbitVisualManager.getRadius(objectId);
  }

  public getAdornmentDiagnostics(): ActiveObjectAdornmentDiagnostics {
    return this.activeObjectAdornmentController.getDiagnostics();
  }

  public getVisualDiagnostics(objectId: string): ObjectVisualDiagnostics | null {
    const entry = this.entries.get(objectId);

    return entry
      ? createObjectVisualDiagnostics({
          objectId,
          visualRoot: entry.visualRoot,
          rotatingBody: entry.rotatingBody,
          lod: entry.lod,
        })
      : null;
  }

  public getPickables(): readonly THREE.Object3D[] {
    return this.pickables;
  }

  public has(objectId: string): boolean {
    return this.entries.has(objectId);
  }

  public isVisibleForLabels(objectId: string): boolean {
    if (objectId === 'milky-way' && this.currentLodLevel === 3) {
      return true;
    }

    return (this.entries.get(objectId)?.lod.visibilityBlend ?? 0) > 0.02;
  }

  public get visibleObjectCount(): number {
    let visible = 0;

    for (const entry of this.entries.values()) {
      if (entry.lod.visibilityBlend > 0.008) {
        visible += 1;
      }
    }

    return visible;
  }

  public get batchedGalaxyCount(): number {
    return this.batchedGalaxyTotal;
  }

  public dispose(): void {
    this.solarEclipsePathRequest += 1;
    this.solarEclipsePathActive = false;
    this.earthObserverCelestialPresenter.dispose();
    this.activeObjectAdornmentController.dispose();
    this.orbitVisualManager.dispose();
    for (const entry of this.entries.values()) {
      for (const resource of entry.lod.deferredResources ?? []) {
        resource.dispose();
      }
    }
    disposeObjectRegistryTree(this.registryRoot);
    this.registryRoot.removeFromParent();
    this.entries.clear();
    this.pickables.length = 0;
  }

  private applyOrbitVisibility(): void {
    this.orbitVisualManager.update({
      showOrbits: this.showOrbits,
      solarObserverActive: this.solarObserverActive,
      earthObserverActive: this.earthObserverActive,
      lodLevel: this.currentLodLevel,
      selectedId: this.selectedId,
      navigationTargetId: this.navigationTargetId,
      stellarNeighborhoodReveal: this.stellarNeighborhoodReveal,
    });
  }

  private updateActiveObjectAdornments(): void {
    this.activeObjectAdornmentController.update({
      selectedId: this.selectedId,
      navigationTargetId: this.navigationTargetId,
      solarObserverActive: this.solarObserverActive || this.earthObserverActive,
      solarEclipsePathActive: this.solarEclipsePathActive,
      solarEclipseActive: this.solarEclipseActive,
      lodLevel: this.currentLodLevel,
    });
  }
}
