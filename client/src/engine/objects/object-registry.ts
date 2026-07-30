import * as THREE from 'three';
import {
  DisplayOptions,
  GraphicQuality,
  SpaceObject,
  UniverseTime,
} from '../../data/models/universe.models';
import { CoordinateSystem } from '../coordinates/coordinate-system';
import {
  calculateApparentRadiusPixels,
  calculateNearRepresentationBlend,
  calculateWorldDiameterForPixels,
  dampValue,
  shouldDisplayObjectAtLevel,
} from '../lod/screen-space-lod';
import {
  CelestialLodRepresentation,
  CelestialVisualAssets,
  createCelestialVisual,
  createCelestialVisualAssets,
  createSelectionMarker,
} from '../materials/celestial-visual-factory';
import { LunarEclipseVisual } from '../materials/lunar-eclipse-visual';
import { SolarEclipseVisual } from '../materials/solar-eclipse-visual';
import { calculateAxialRotation } from '../simulation/body-rotation';
import {
  PositionProviderFactory,
  TemporalPositionProvider,
} from '../simulation/position-providers';
import { FarObjectBatch } from '../rendering/far-object-batch';
import { PICKING_LAYER } from '../selection/selection-layers';
import { EarthEclipseKind, SolarEclipseAppearance } from '../simulation/earth-eclipse';
import { calculateLunarEclipseAppearance } from '../simulation/lunar-eclipse-calculator';
import {
  calculateEarthTextureOrientation,
  calculateSolarEclipseAppearance,
  calculateSolarEclipsePath,
} from '../simulation/solar-eclipse-calculator';

interface RegistryEntry {
  definition: SpaceObject;
  node: THREE.Group;
  visualRoot: THREE.Group;
  rotatingBody: THREE.Object3D | null;
  lunarEclipse: LunarEclipseVisual | null;
  solarEclipse: SolarEclipseVisual | null;
  observerCorona: THREE.Sprite | null;
  lod: CelestialLodRepresentation;
  farBatchIndex: number | null;
  pickTarget: THREE.Object3D | null;
  provider: TemporalPositionProvider;
}

interface OrbitVisual {
  entry: RegistryEntry;
  line: THREE.LineLoop<THREE.BufferGeometry, THREE.LineBasicMaterial>;
  radius: number;
  baseColor: number;
  baseOpacity: number;
}

export class ObjectRegistry {
  private readonly entries = new Map<string, RegistryEntry>();
  private readonly pickables: THREE.Object3D[] = [];
  private readonly orbitVisuals = new Map<string, OrbitVisual>();
  private readonly registryRoot = new THREE.Group();
  private readonly selectionMarker = createSelectionMarker();
  private readonly rotationGuide: THREE.LineSegments<THREE.BufferGeometry, THREE.LineBasicMaterial>;
  private readonly visualAssets: CelestialVisualAssets;
  private readonly farObjectBatch: FarObjectBatch;
  private readonly lodWorldPosition = new THREE.Vector3();
  private readonly lodLocalPosition = new THREE.Vector3();
  private readonly registryWorldInverse = new THREE.Matrix4();
  private readonly earthOrientationMatrix = new THREE.Matrix4();
  private readonly earthXAxis = new THREE.Vector3();
  private readonly earthYAxis = new THREE.Vector3();
  private readonly earthZAxis = new THREE.Vector3();
  private readonly earthTargetQuaternion = new THREE.Quaternion();
  private selectedId: string | null = null;
  private navigationTargetId: string | null = null;
  private showOrbits = true;
  private solarEclipsePathActive = false;
  private solarEclipseActive = false;
  private solarObserverActive = false;
  private currentLodLevel = 0;

  constructor(
    private readonly spaceRoot: THREE.Group,
    coordinateSystem: CoordinateSystem,
    objects: readonly SpaceObject[],
    private readonly quality: GraphicQuality,
  ) {
    const providerFactory = new PositionProviderFactory(coordinateSystem);

    this.visualAssets = createCelestialVisualAssets(quality);
    this.rotationGuide = createRotationGuide(quality);
    this.registryRoot.name = 'astronomical-object-registry';
    this.spaceRoot.add(this.registryRoot);
    this.registryRoot.add(this.rotationGuide);
    const farObjects = objects.filter(
      (object) => object.type !== 'galaxy' && object.type !== 'region',
    );
    const farIndexById = new Map(farObjects.map((object, index) => [object.id, index] as const));

    this.farObjectBatch = new FarObjectBatch(farObjects, quality);
    this.registryRoot.add(this.farObjectBatch.points);
    this.pickables.push(this.farObjectBatch.points);

    for (const definition of objects) {
      const node = new THREE.Group();

      node.name = definition.id;
      const visual = createCelestialVisual(definition, quality, this.visualAssets);

      node.add(visual.root);
      this.entries.set(definition.id, {
        definition,
        node,
        visualRoot: visual.root,
        rotatingBody: visual.rotatingBody,
        lunarEclipse: visual.lunarEclipse,
        solarEclipse: visual.solarEclipse,
        observerCorona: visual.observerCorona,
        lod: visual.lod,
        farBatchIndex: farIndexById.get(definition.id) ?? null,
        pickTarget: visual.pickables[0] ?? null,
        provider: providerFactory.create(definition.positionProvider, definition.referenceFrame),
      });
      this.pickables.push(...visual.pickables);
    }

    for (const entry of this.entries.values()) {
      const parent = entry.definition.parentId
        ? this.entries.get(entry.definition.parentId)?.node
        : undefined;

      (parent ?? this.registryRoot).add(entry.node);
    }

    for (const entry of this.entries.values()) {
      if (
        entry.definition.positionProvider.type === 'keplerian' ||
        entry.definition.positionProvider.type === 'ephemeris'
      ) {
        this.createOrbitLine(entry);
      }
    }
  }

  public updatePositions(time: UniverseTime): SolarEclipseAppearance {
    for (const entry of this.entries.values()) {
      const position = entry.provider.getPositionAt(time);

      entry.node.position.set(position.x, position.y, position.z);
    }
    const solarEclipseAppearance = calculateSolarEclipseAppearance(time);

    this.entries.get('moon')?.lunarEclipse?.updateAppearance(calculateLunarEclipseAppearance(time));
    this.entries.get('earth')?.solarEclipse?.updateAppearance(solarEclipseAppearance);
    this.solarEclipseActive = solarEclipseAppearance.phase !== 'none';
    this.applySelectionMarkerVisibility();

    return solarEclipseAppearance;
  }

  public updateBodyRotations(time: UniverseTime, earthTime: UniverseTime | null = time): void {
    for (const entry of this.entries.values()) {
      if (entry.definition.id === 'earth') {
        if (earthTime) {
          this.updateBodyRotation(entry, earthTime);
        }
      } else {
        this.updateBodyRotation(entry, time);
      }
    }
  }

  public synchronizeEarthRotation(time: UniverseTime, maximumRadians: number): boolean {
    const body = this.entries.get('earth')?.rotatingBody;

    if (!body) {
      return true;
    }
    this.calculateEarthOrientation(time, this.earthTargetQuaternion);
    body.quaternion.rotateTowards(this.earthTargetQuaternion, Math.max(0, maximumRadians));

    return body.quaternion.angleTo(this.earthTargetQuaternion) < 0.000_01;
  }

  public updateLod(
    camera: THREE.PerspectiveCamera,
    viewportHeight: number,
    lodLevel: number,
    deltaSeconds: number,
  ): void {
    this.currentLodLevel = lodLevel;
    const minimumPixelDiameter = this.quality === 'low' ? 3.5 : this.quality === 'medium' ? 4.5 : 5;

    this.registryRoot.updateWorldMatrix(true, false);
    this.registryWorldInverse.copy(this.registryRoot.matrixWorld).invert();

    for (const entry of this.entries.values()) {
      const selected = entry.definition.id === this.selectedId;
      const navigationTarget = entry.definition.id === this.navigationTargetId;
      const keepVisible = selected || navigationTarget;
      const allowedInSolarObserver =
        !this.solarObserverActive ||
        entry.definition.id === 'sun' ||
        entry.definition.id === 'moon';
      const targetVisibility =
        allowedInSolarObserver &&
        shouldDisplayObjectAtLevel(entry.definition, lodLevel, keepVisible)
          ? 1
          : 0;
      const lod = entry.lod;

      lod.visibilityBlend = dampValue(lod.visibilityBlend, targetVisibility, 8, deltaSeconds);

      const position = entry.node.getWorldPosition(this.lodWorldPosition);
      const distance = Math.max(camera.position.distanceTo(position), 0.001);
      const apparentRadius = calculateApparentRadiusPixels(
        entry.definition.visual.visualRadius,
        distance,
        viewportHeight,
        camera.fov,
      );
      const allowNearRepresentation =
        lod.nearRoot !== null &&
        (entry.definition.type !== 'star' || entry.definition.id === 'sun' || keepVisible);
      const targetNearBlend = allowNearRepresentation
        ? calculateNearRepresentationBlend(apparentRadius)
        : 0;

      lod.nearBlend = dampValue(lod.nearBlend, targetNearBlend, 10, deltaSeconds);

      const nearOpacity = lod.nearBlend * lod.visibilityBlend;

      entry.lunarEclipse?.setVisibilityBlend(nearOpacity);
      entry.solarEclipse?.setVisibilityBlend(nearOpacity);
      if (entry.observerCorona) {
        entry.observerCorona.material.opacity = this.solarObserverActive ? nearOpacity * 0.32 : 0;
        entry.observerCorona.visible = this.solarObserverActive && nearOpacity > 0.008;
      }
      if (lod.nearRoot) {
        lod.nearRoot.visible = nearOpacity > 0.008;
      }
      for (const managed of lod.nearMaterials) {
        managed.material.opacity = managed.baseOpacity * nearOpacity;
        managed.material.depthWrite = managed.baseDepthWrite && nearOpacity > 0.985;
      }

      const farOpacity = lod.farBaseOpacity * (1 - lod.nearBlend) * lod.visibilityBlend;

      lod.farAlpha = farOpacity;

      const minimumWorldDiameter = calculateWorldDiameterForPixels(
        minimumPixelDiameter,
        distance,
        viewportHeight,
        camera.fov,
      );

      if (lod.farSprite) {
        lod.farSprite.material.opacity = farOpacity;
        lod.farSprite.visible = farOpacity > 0.008;
        const farDiameter = Math.max(lod.farBaseDiameter, minimumWorldDiameter);

        lod.farSprite.scale.set(farDiameter, farDiameter * lod.farAspectRatio, 1);
      } else if (entry.farBatchIndex !== null) {
        const farPixelDiameter = THREE.MathUtils.clamp(
          Math.max(minimumPixelDiameter, apparentRadius * 2.25),
          minimumPixelDiameter,
          28,
        );

        this.lodLocalPosition.copy(position).applyMatrix4(this.registryWorldInverse);
        this.farObjectBatch.updatePoint(
          entry.farBatchIndex,
          this.lodLocalPosition,
          farPixelDiameter,
          farOpacity,
        );
      }
      entry.visualRoot.visible =
        lod.visibilityBlend > 0.008 &&
        (lod.nearRoot?.visible === true || lod.farSprite?.visible === true);
      if (this.solarObserverActive && entry.definition.id === 'earth') {
        entry.visualRoot.visible = false;
      }

      if (entry.pickTarget) {
        if (lod.visibilityBlend > 0.02) {
          entry.pickTarget.layers.enable(PICKING_LAYER);
        } else {
          entry.pickTarget.layers.disable(PICKING_LAYER);
        }
      }

      if (selected) {
        const markerScale = Math.max(
          getSelectionMarkerScale(entry.definition),
          minimumWorldDiameter * 1.55,
        );

        this.selectionMarker.scale.setScalar(markerScale);
      }
    }

    this.farObjectBatch.commit();
    this.applyOrbitVisibility();
    this.applyRotationGuideVisibility();
    this.applySelectionMarkerVisibility();
  }

  public setDisplayOptions(options: DisplayOptions): void {
    this.showOrbits = options.showOrbits;
    this.applyOrbitVisibility();
  }

  public showSolarEclipsePath(time: UniverseTime, kind: EarthEclipseKind): void {
    const points = calculateSolarEclipsePath(time).map(
      (point) => new THREE.Vector3(point.x, point.y, point.z),
    );

    this.entries.get('earth')?.solarEclipse?.setPath(points, kind);
    this.solarEclipsePathActive = true;
    this.applySelectionMarkerVisibility();
  }

  public clearSolarEclipsePath(): void {
    this.entries.get('earth')?.solarEclipse?.clearPath();
    this.solarEclipsePathActive = false;
    this.applySelectionMarkerVisibility();
  }

  public setSolarObserverActive(active: boolean, moonVisualScale = 1): void {
    this.solarObserverActive = active;
    this.entries.get('moon')?.visualRoot.scale.setScalar(active ? moonVisualScale : 1);
    this.applyOrbitVisibility();
    this.applyRotationGuideVisibility();
    this.applySelectionMarkerVisibility();
  }

  public setNavigationTarget(objectId: string | null): void {
    this.navigationTargetId = objectId;
    this.applyOrbitVisibility();
    this.applyRotationGuideVisibility();
    this.applySelectionMarkerVisibility();
  }

  public select(objectId: string | null): void {
    this.selectionMarker.removeFromParent();
    this.selectedId = objectId;

    if (!objectId) {
      this.applyOrbitVisibility();
      this.applyRotationGuideVisibility();
      this.applySelectionMarkerVisibility();

      return;
    }

    const entry = this.entries.get(objectId);

    if (!entry) {
      this.applyOrbitVisibility();
      this.applyRotationGuideVisibility();
      this.applySelectionMarkerVisibility();

      return;
    }
    this.selectionMarker.scale.setScalar(getSelectionMarkerScale(entry.definition));
    if (entry.definition.type !== 'region') {
      entry.node.add(this.selectionMarker);
    }
    this.applyOrbitVisibility();
    this.applyRotationGuideVisibility();
    this.applySelectionMarkerVisibility();
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

  public getOrbitRadius(objectId: string): number | null {
    return this.orbitVisuals.get(objectId)?.radius ?? null;
  }

  public getPickables(): readonly THREE.Object3D[] {
    return this.pickables;
  }

  public has(objectId: string): boolean {
    return this.entries.has(objectId);
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

  public dispose(): void {
    this.selectionMarker.removeFromParent();
    this.selectionMarker.material.map?.dispose();
    this.selectionMarker.material.dispose();
    disposeObjectTree(this.registryRoot);
    this.registryRoot.removeFromParent();
    this.entries.clear();
    this.pickables.length = 0;
    this.orbitVisuals.clear();
  }

  private createOrbitLine(entry: RegistryEntry): void {
    const definition = entry.definition.positionProvider;

    if (definition.type !== 'keplerian' && definition.type !== 'ephemeris') {
      return;
    }

    const points: THREE.Vector3[] = [];
    const segments =
      this.quality === 'low'
        ? entry.definition.type === 'moon'
          ? 48
          : 96
        : this.quality === 'medium'
          ? entry.definition.type === 'moon'
            ? 72
            : 144
          : entry.definition.type === 'moon'
            ? 96
            : 180;

    for (let index = 0; index < segments; index += 1) {
      const julianDay =
        (definition.type === 'keplerian'
          ? definition.epochJulianDay
          : definition.orbitEpochJulianDay) +
        (index / segments) * definition.orbitalPeriodDays;
      const position = entry.provider.getPositionAt({ julianDay });

      points.push(new THREE.Vector3(position.x, position.y, position.z));
    }

    const geometry = new THREE.BufferGeometry().setFromPoints(points);
    const baseColor = entry.definition.type === 'moon' ? 0x718097 : 0x465266;
    const baseOpacity = entry.definition.type === 'moon' ? 0.5 : 0.34;
    const material = new THREE.LineBasicMaterial({
      color: baseColor,
      transparent: true,
      opacity: baseOpacity,
      depthWrite: false,
    });
    const orbit = new THREE.LineLoop(geometry, material);

    orbit.name = `${entry.definition.id}-orbit`;
    orbit.userData['kind'] = 'orbit';
    const parent = entry.definition.parentId
      ? this.entries.get(entry.definition.parentId)?.node
      : undefined;

    (parent ?? this.registryRoot).add(orbit);
    this.orbitVisuals.set(entry.definition.id, {
      entry,
      line: orbit,
      radius: points.reduce((maximum, point) => Math.max(maximum, point.length()), 0),
      baseColor,
      baseOpacity,
    });
  }

  private updateBodyRotation(entry: RegistryEntry, time: UniverseTime): void {
    const periodHours = entry.definition.visual.rotationPeriodHours;

    if (!entry.rotatingBody || !periodHours) {
      return;
    }
    if (entry.definition.id === 'earth') {
      this.calculateEarthOrientation(time, entry.rotatingBody.quaternion);

      return;
    }
    entry.rotatingBody.rotation.y = calculateAxialRotation(time, periodHours);
  }

  private calculateEarthOrientation(time: UniverseTime, target: THREE.Quaternion): void {
    const orientation = calculateEarthTextureOrientation(time);

    this.earthXAxis.set(orientation.xAxis.x, orientation.xAxis.y, orientation.xAxis.z);
    this.earthYAxis.set(orientation.yAxis.x, orientation.yAxis.y, orientation.yAxis.z);
    this.earthZAxis.set(orientation.zAxis.x, orientation.zAxis.y, orientation.zAxis.z);
    this.earthOrientationMatrix.makeBasis(this.earthXAxis, this.earthYAxis, this.earthZAxis);
    target.setFromRotationMatrix(this.earthOrientationMatrix).normalize();
  }

  private applyOrbitVisibility(): void {
    const activeOrbitId = this.getActiveOrbitId();
    const orbitsAllowed = this.showOrbits && !this.solarObserverActive;

    for (const [objectId, orbit] of this.orbitVisuals) {
      const active = objectId === activeOrbitId;

      orbit.line.visible =
        orbitsAllowed && (this.currentLodLevel <= 1 || (active && this.currentLodLevel <= 2));
      orbit.line.material.color.set(
        active ? (orbit.entry.definition.visual.color ?? 0x8acff4) : orbit.baseColor,
      );
      orbit.line.material.opacity = active ? 0.9 : orbit.baseOpacity;
      orbit.line.renderOrder = active ? 3 : 0;
      orbit.line.userData['active'] = active;
    }
  }

  private applyRotationGuideVisibility(): void {
    const entry = this.getActiveRotatingEntry();
    const rotationPeriodHours = entry?.definition.visual.rotationPeriodHours;

    if (!entry?.rotatingBody || !rotationPeriodHours) {
      this.rotationGuide.visible = false;
      this.rotationGuide.userData['objectId'] = null;

      return;
    }
    entry.rotatingBody.add(this.rotationGuide);
    this.rotationGuide.scale.set(1, 1, rotationPeriodHours < 0 ? -1 : 1);
    this.rotationGuide.material.color.set(
      entry.definition.visual.atmosphereColor ?? entry.definition.visual.color ?? 0x8acff4,
    );
    this.rotationGuide.userData['objectId'] = entry.definition.id;
    this.rotationGuide.userData['direction'] = rotationPeriodHours < 0 ? 'retrograde' : 'prograde';
    this.rotationGuide.visible = !this.solarObserverActive && this.currentLodLevel === 0;
  }

  private getActiveOrbitId(): string | null {
    const selectedOrbit = this.selectedId ? this.orbitVisuals.get(this.selectedId) : undefined;

    if (selectedOrbit?.entry.definition.parentId === this.navigationTargetId) {
      return this.selectedId;
    }

    return null;
  }

  private getActiveRotatingEntry(): RegistryEntry | null {
    const selected = this.selectedId ? this.entries.get(this.selectedId) : undefined;

    if (selected?.rotatingBody && selected.definition.visual.rotationPeriodHours) {
      return selected;
    }
    const target = this.navigationTargetId ? this.entries.get(this.navigationTargetId) : undefined;

    return target?.rotatingBody && target.definition.visual.rotationPeriodHours ? target : null;
  }

  private applySelectionMarkerVisibility(): void {
    this.selectionMarker.visible =
      !this.solarObserverActive &&
      !this.solarEclipsePathActive &&
      !this.solarEclipseActive &&
      !this.rotationGuide.visible;
  }
}

function createRotationGuide(
  quality: GraphicQuality,
): THREE.LineSegments<THREE.BufferGeometry, THREE.LineBasicMaterial> {
  const segments = quality === 'low' ? 40 : quality === 'medium' ? 56 : 72;
  const radius = 1.38;
  const positions: number[] = [];
  const colors: number[] = [];

  for (let index = 0; index < segments; index += 1) {
    const start = (index / segments) * Math.PI * 2;
    const end = ((index + 1) / segments) * Math.PI * 2;
    const startIntensity = getRotationRingIntensity(start);
    const endIntensity = getRotationRingIntensity(end);

    positions.push(
      Math.cos(start) * radius,
      0,
      Math.sin(start) * radius,
      Math.cos(end) * radius,
      0,
      Math.sin(end) * radius,
    );
    colors.push(
      startIntensity,
      startIntensity,
      startIntensity,
      endIntensity,
      endIntensity,
      endIntensity,
    );
  }
  positions.push(0, -1.62, 0, 0, 1.62, 0);
  colors.push(0.24, 0.24, 0.24, 0.24, 0.24, 0.24);
  const geometry = new THREE.BufferGeometry();

  geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  geometry.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3));
  const guide = new THREE.LineSegments(
    geometry,
    new THREE.LineBasicMaterial({
      color: 0x8acff4,
      vertexColors: true,
      transparent: true,
      opacity: 0.78,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
    }),
  );

  guide.name = 'active-rotation-guide';
  guide.visible = false;
  guide.renderOrder = 4;
  guide.userData['kind'] = 'rotation-guide';
  guide.userData['style'] = 'moving-highlight';
  guide.userData['objectId'] = null;

  return guide;
}

function getRotationRingIntensity(angle: number): number {
  const distanceFromHighlight = Math.abs(Math.atan2(Math.sin(angle), Math.cos(angle)));
  const highlightWidth = Math.PI * 0.26;
  const normalizedDistance = Math.min(distanceFromHighlight / highlightWidth, 1);
  const highlight = Math.cos((normalizedDistance * Math.PI) / 2) ** 2;

  return 0.18 + highlight * 0.82;
}

function getSelectionMarkerScale(object: SpaceObject): number {
  const radius = object.visual.visualRadius;

  return object.type === 'galaxy' ? radius * 0.5 : radius * 3.3;
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
