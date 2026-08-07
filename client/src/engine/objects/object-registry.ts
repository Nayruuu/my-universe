import * as THREE from 'three';
import {
  DisplayOptions,
  GraphicQuality,
  SpaceObject,
  UniverseTime,
} from '../../data/models/universe.models';
import { CoordinateSystem } from '../coordinates/coordinate-system';
import {
  CelestialLodRepresentation,
  CelestialVisualAssets,
  createCelestialVisual,
  createCelestialVisualAssets,
} from '../materials/celestial-visual-factory';
import { LunarEclipseVisual } from '../materials/lunar-eclipse-visual';
import { SolarEclipseVisual } from '../materials/solar-eclipse-visual';
import { SupernovaVisual } from '../materials/supernova-visual';
import {
  PositionProviderFactory,
  TemporalPositionProvider,
} from '../simulation/position-providers';
import { FarObjectBatch } from '../rendering/far-object-batch';
import { EarthEclipseKind, SolarEclipseAppearance } from '../simulation/earth-eclipse';
import { calculateLunarEclipseAppearance } from '../simulation/lunar-eclipse-calculator';
import { calculateSolarEclipseAppearance } from '../simulation/solar-eclipse-calculator';
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
import { OrbitVisualManager } from './orbit-visual-manager';

interface RegistryEntry {
  definition: SpaceObject;
  node: THREE.Group;
  visualRoot: THREE.Group;
  lensingForeground: THREE.Object3D | null;
  rotatingBody: THREE.Object3D | null;
  lunarEclipse: LunarEclipseVisual | null;
  solarEclipse: SolarEclipseVisual | null;
  supernova: SupernovaVisual | null;
  observerCorona: THREE.Sprite | null;
  lod: CelestialLodRepresentation;
  farBatchIndex: number | null;
  pickTarget: THREE.Object3D | null;
  provider: TemporalPositionProvider;
}

export class ObjectRegistry {
  private readonly entries = new Map<string, RegistryEntry>();
  private readonly pickables: THREE.Object3D[] = [];
  private readonly registryRoot = new THREE.Group();
  private readonly visualAssets: CelestialVisualAssets;
  private readonly farObjectBatch: FarObjectBatch;
  private readonly batchedGalaxyTotal: number;
  private readonly activeObjectAdornmentController: ActiveObjectAdornmentController;
  private readonly bodyRotationController = new BodyRotationController();
  private readonly objectLodController: ObjectLodController;
  private readonly orbitVisualManager: OrbitVisualManager;
  private selectedId: string | null = null;
  private navigationTargetId: string | null = null;
  private showOrbits = true;
  private solarEclipsePathActive = false;
  private solarEclipsePathRequest = 0;
  private solarEclipseActive = false;
  private solarObserverActive = false;
  private currentLodLevel = Number.POSITIVE_INFINITY;

  constructor(
    private readonly spaceRoot: THREE.Group,
    coordinateSystem: CoordinateSystem,
    objects: readonly SpaceObject[],
    private readonly quality: GraphicQuality,
  ) {
    const providerFactory = new PositionProviderFactory(coordinateSystem);

    this.visualAssets = createCelestialVisualAssets(quality);
    this.registryRoot.name = 'astronomical-object-registry';
    this.spaceRoot.add(this.registryRoot);
    const renderableObjects = objects.filter(
      (object) =>
        object.positionProvider.type !== 'catalog' &&
        object.metadata?.['catalogPointRepresentation'] !== true,
    );
    const farObjects = renderableObjects.filter(usesFarPointBatch);
    const farIndexById = new Map(farObjects.map((object, index) => [object.id, index] as const));

    this.batchedGalaxyTotal = farObjects.filter((object) => object.type === 'galaxy').length;
    this.farObjectBatch = new FarObjectBatch(farObjects, quality);
    this.registryRoot.add(this.farObjectBatch.points);
    this.pickables.push(this.farObjectBatch.points);

    for (const definition of renderableObjects) {
      const node = new THREE.Group();

      node.name = definition.id;
      const visual = createCelestialVisual(definition, quality, this.visualAssets);

      node.add(visual.root);
      this.entries.set(definition.id, {
        definition,
        node,
        visualRoot: visual.root,
        lensingForeground: visual.lensingForeground,
        rotatingBody: visual.rotatingBody,
        lunarEclipse: visual.lunarEclipse,
        solarEclipse: visual.solarEclipse,
        supernova: visual.supernova,
        observerCorona: visual.observerCorona,
        lod: visual.lod,
        farBatchIndex: farIndexById.get(definition.id) ?? null,
        pickTarget: visual.pickables[0] ?? null,
        provider: providerFactory.create(definition.positionProvider, definition.referenceFrame),
      });
      this.pickables.push(...visual.pickables);
    }

    for (const entry of this.entries.values()) {
      const semanticParent = entry.definition.parentId
        ? this.entries.get(entry.definition.parentId)?.node
        : undefined;
      const parent =
        entry.definition.referenceFrame === 'stellar' && entry.definition.parentId === 'milky-way'
          ? (this.entries.get('sun')?.node ?? semanticParent)
          : semanticParent;

      (parent ?? this.registryRoot).add(entry.node);
    }
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
  }

  public updatePositions(time: UniverseTime): SolarEclipseAppearance {
    for (const entry of this.entries.values()) {
      const position = entry.provider.getPositionAt(time);

      entry.node.position.set(position.x, position.y, position.z);
      entry.supernova?.updateAppearance(time);
    }
    const solarEclipseAppearance = calculateSolarEclipseAppearance(time);

    this.entries.get('moon')?.lunarEclipse?.updateAppearance(calculateLunarEclipseAppearance(time));
    this.entries.get('earth')?.solarEclipse?.updateAppearance(solarEclipseAppearance);
    this.solarEclipseActive = solarEclipseAppearance.phase !== 'none';
    this.updateActiveObjectAdornments();

    return solarEclipseAppearance;
  }

  public updateBodyRotations(time: UniverseTime, earthTime: UniverseTime | null = time): void {
    this.bodyRotationController.update(this.entries.values(), time, earthTime);
  }

  public updateLod(
    camera: THREE.PerspectiveCamera,
    viewportHeight: number,
    lodLevel: number,
    deltaSeconds: number,
  ): void {
    this.currentLodLevel = lodLevel;
    const { selectionMarkerScale } = this.objectLodController.update(
      camera,
      viewportHeight,
      {
        lodLevel,
        selectedId: this.selectedId,
        navigationTargetId: this.navigationTargetId,
        solarObserverActive: this.solarObserverActive,
      },
      deltaSeconds,
    );

    this.activeObjectAdornmentController.setSelectionMarkerScale(selectionMarkerScale);
    this.applyOrbitVisibility();
    this.updateActiveObjectAdornments();
  }

  public setDisplayOptions(options: DisplayOptions): void {
    this.showOrbits = options.showOrbits;
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
    this.activeObjectAdornmentController.dispose();
    this.orbitVisualManager.dispose();
    disposeObjectTree(this.registryRoot);
    this.registryRoot.removeFromParent();
    this.entries.clear();
    this.pickables.length = 0;
  }

  private applyOrbitVisibility(): void {
    this.orbitVisualManager.update({
      showOrbits: this.showOrbits,
      solarObserverActive: this.solarObserverActive,
      lodLevel: this.currentLodLevel,
      selectedId: this.selectedId,
      navigationTargetId: this.navigationTargetId,
    });
  }

  private updateActiveObjectAdornments(): void {
    this.activeObjectAdornmentController.update({
      selectedId: this.selectedId,
      navigationTargetId: this.navigationTargetId,
      solarObserverActive: this.solarObserverActive,
      solarEclipsePathActive: this.solarEclipsePathActive,
      solarEclipseActive: this.solarEclipseActive,
      lodLevel: this.currentLodLevel,
    });
  }
}

function usesFarPointBatch(object: SpaceObject): boolean {
  return (
    object.type !== 'region' &&
    object.type !== 'black-hole' &&
    (object.type !== 'galaxy' || object.metadata?.['nearbyUniversePointBatch'] === true)
  );
}

function disposeObjectTree(root: THREE.Object3D): void {
  const geometries = new Set<THREE.BufferGeometry>();
  const materials = new Set<THREE.Material>();
  const textures = new Set<THREE.Texture>();

  root.traverse((object) => {
    if (
      object instanceof THREE.Mesh ||
      object instanceof THREE.Points ||
      object instanceof THREE.Line
    ) {
      geometries.add(object.geometry);
      const objectMaterials = Array.isArray(object.material) ? object.material : [object.material];

      for (const material of objectMaterials) {
        materials.add(material);
      }
    } else if (object instanceof THREE.Sprite) {
      materials.add(object.material);
    }
  });

  for (const material of materials) {
    for (const value of Object.values(material)) {
      if (value instanceof THREE.Texture) {
        textures.add(value);
      }
    }
  }
  for (const texture of textures) {
    texture.dispose();
  }
  for (const material of materials) {
    material.dispose();
  }
  for (const geometry of geometries) {
    geometry.dispose();
  }
}
