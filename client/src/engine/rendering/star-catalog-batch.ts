import * as THREE from 'three';
import {
  GraphicQuality,
  type TemporalMode,
  type UniverseTime,
  type Vector3Like,
} from '../../data/models/universe.models';
import {
  calculateStellarNeighborhoodReveal,
  interpolateStellarNeighborhoodLodValue,
  STELLAR_NEIGHBORHOOD_REVEAL_END,
} from '../coordinates/stellar-neighborhood-scale-model';
import { dampValue } from '../lod/screen-space-lod';
import { StarCatalogRegistry } from '../objects/star-catalog-registry';
import { getHeliocentricCatalogObserverOpacity } from './heliocentric-catalog-visibility';
import {
  applyActiveCatalogStarAppearance,
  applyStarCatalogQuality,
  createStarCatalogVisual,
  type StarCatalogVisual,
} from './star-catalog-visual';

const LOD_OPACITIES = [0.68, 0.82, 1, 0, 0, 0] as const;
const LOD_POINT_SCALES = [1.9, 1.6, 1.3, 1, 0.82, 0.55] as const;
const ACTIVE_HALO_SIZES = [196, 112, 52, 20, 16, 12] as const;
const ACTIVE_CORE_OPACITIES = [1, 0.28, 0, 0, 0, 0] as const;
const REMOTE_HYG_VISIBILITY_FLOOR = 0.12;
const MINIMUM_VISIBLE_REVEAL = 0.004;

export class StarCatalogBatch {
  public readonly root = new THREE.Group();
  public readonly points: THREE.Points<THREE.BufferGeometry, THREE.ShaderMaterial>;
  public readonly selectionPoint: THREE.Points<THREE.BufferGeometry, THREE.ShaderMaterial>;
  public readonly activeDetail: THREE.Group;
  public readonly activeHalo: THREE.Points<THREE.BufferGeometry, THREE.ShaderMaterial>;
  public readonly activeCore: THREE.Mesh<THREE.SphereGeometry, THREE.ShaderMaterial>;

  private readonly visual: StarCatalogVisual;
  private readonly totalCount: number;
  private readonly visibleIndices: Uint8Array;
  private drawCount: number;
  private opacity = 0;
  private pointScale = 1;
  private activeHaloSize = 17;
  private activeCoreOpacity = 0;
  private activeVisualScale = 1;
  private selectedObjectId: string | null = null;
  private focusedObjectId: string | null = null;
  private lodInitialized = false;
  private stellarNeighborhoodVisible = true;
  private readonly observerLocalPosition = new THREE.Vector3();
  private readonly observerWorldInverse = new THREE.Matrix4();

  constructor(
    private readonly registry: StarCatalogRegistry,
    quality: GraphicQuality = 'medium',
  ) {
    this.visual = createStarCatalogVisual(registry);
    this.totalCount = registry.catalog.count;
    this.drawCount = registry.catalog.count;
    this.visibleIndices = this.visual.visibleIndices;
    this.points = this.visual.points;
    this.selectionPoint = this.visual.selectionPoint;
    this.activeDetail = this.visual.activeDetail;
    this.activeHalo = this.visual.activeHalo;
    this.activeCore = this.visual.activeCore;
    this.points.userData['catalogCompleteness'] = 'finite-heliocentric-bright-star-sample';
    this.points.userData['remoteVisibilityFloor'] = REMOTE_HYG_VISIBILITY_FLOOR;
    this.root.name = 'hyg-star-catalog-root';
    this.root.add(this.points, this.selectionPoint, this.activeDetail);
    this.setQuality(quality);
  }

  public setDrawLimit(limit: number): void {
    this.drawCount = Math.max(0, Math.min(Math.floor(limit), this.totalCount));
    this.points.geometry.setDrawRange(0, this.drawCount);
    this.updatePickableIndices();
  }

  public setPixelRatio(pixelRatio: number): void {
    const boundedRatio = Math.max(0.5, pixelRatio);

    this.points.material.uniforms['pixelRatio']!.value = boundedRatio;
    this.selectionPoint.material.uniforms['pixelRatio']!.value = boundedRatio;
    this.activeHalo.material.uniforms['pixelRatio']!.value = boundedRatio;
  }

  public setPhotographicRadiance(radiance: number): void {
    this.points.material.uniforms['radiance']!.value = THREE.MathUtils.clamp(radiance, 0.5, 1.5);
  }

  public setQuality(quality: GraphicQuality): void {
    applyStarCatalogQuality(this.visual, quality);
  }

  public updateTime(time: UniverseTime, temporalMode: TemporalMode = 'state'): boolean {
    const positionsChanged = this.registry.updateTime(time, temporalMode);
    const motionEpoch = this.registry.stellarMotionEpoch;

    this.points.userData['requestedEpochJulianDay'] = motionEpoch.requestedJulianDay;
    this.points.userData['appliedMotionEpochJulianDay'] = motionEpoch.appliedJulianDay;
    this.points.userData['stellarMotionDomainStatus'] = motionEpoch.status;
    this.points.userData['temporalMode'] = temporalMode;
    this.points.userData['receivedLightClampedStarCount'] =
      this.registry.receivedLightClampedStarCount;
    if (!positionsChanged) {
      return false;
    }

    const positionAttribute = this.points.geometry.getAttribute('position');

    positionAttribute.needsUpdate = true;
    this.points.geometry.computeBoundingSphere();
    this.refreshSelectionPoint();
    this.refreshActiveDetail();

    return true;
  }

  public updateLod(
    lodLevel: number,
    deltaSeconds: number,
    observerPosition?: Vector3Like,
    cameraDistance?: number,
  ): void {
    this.lodInitialized = true;
    const observerBoundaryOpacity = this.getObserverBoundaryOpacity(observerPosition);
    const stellarTransitionActive = lodLevel >= 1 && lodLevel <= 3;
    const transitionDistance =
      cameraDistance ?? (lodLevel <= 2 ? 0 : STELLAR_NEIGHBORHOOD_REVEAL_END);
    const transitionOpacity = calculateStellarNeighborhoodReveal(transitionDistance);
    const transitionStyleReveal =
      cameraDistance === undefined
        ? lodLevel <= 1
          ? 1
          : lodLevel === 2
            ? 0.5
            : 0
        : transitionOpacity;
    const lodOpacity = stellarTransitionActive
      ? interpolateStellarNeighborhoodLodValue(
          LOD_OPACITIES[1],
          LOD_OPACITIES[2],
          LOD_OPACITIES[3],
          transitionStyleReveal,
        )
      : (LOD_OPACITIES[lodLevel] ?? LOD_OPACITIES.at(-1)!);
    const targetOpacity = lodOpacity * observerBoundaryOpacity * transitionOpacity;
    const targetPointScale = stellarTransitionActive
      ? interpolateStellarNeighborhoodLodValue(
          LOD_POINT_SCALES[1],
          LOD_POINT_SCALES[2],
          LOD_POINT_SCALES[3],
          transitionStyleReveal,
        )
      : (LOD_POINT_SCALES[lodLevel] ?? LOD_POINT_SCALES.at(-1)!);
    const targetHaloSize = stellarTransitionActive
      ? interpolateStellarNeighborhoodLodValue(
          ACTIVE_HALO_SIZES[1],
          ACTIVE_HALO_SIZES[2],
          ACTIVE_HALO_SIZES[3],
          transitionStyleReveal,
        )
      : (ACTIVE_HALO_SIZES[lodLevel] ?? ACTIVE_HALO_SIZES.at(-1)!);
    const targetCoreOpacity = stellarTransitionActive
      ? interpolateStellarNeighborhoodLodValue(
          ACTIVE_CORE_OPACITIES[1],
          ACTIVE_CORE_OPACITIES[2],
          ACTIVE_CORE_OPACITIES[3],
          transitionStyleReveal,
        ) * transitionOpacity
      : (ACTIVE_CORE_OPACITIES[lodLevel] ?? ACTIVE_CORE_OPACITIES.at(-1)!);
    const wasVisible = this.points.visible;

    this.opacity = dampValue(this.opacity, targetOpacity, 6, deltaSeconds);
    this.pointScale = dampValue(this.pointScale, targetPointScale, 6, deltaSeconds);
    this.activeHaloSize = dampValue(this.activeHaloSize, targetHaloSize, 7, deltaSeconds);
    this.activeCoreOpacity = dampValue(this.activeCoreOpacity, targetCoreOpacity, 7, deltaSeconds);
    this.points.material.uniforms['catalogOpacity']!.value = this.opacity;
    this.points.userData['observerBoundaryOpacity'] = observerBoundaryOpacity;
    this.points.userData['stellarNeighborhoodReveal'] = transitionOpacity;
    this.points.material.uniforms['pointScale']!.value = this.pointScale;
    this.activeHalo.material.uniforms['pointSize']!.value =
      this.activeHaloSize * this.activeVisualScale;
    this.activeCore.material.opacity = this.activeCoreOpacity;
    this.activeCore.material.uniforms['layerOpacity']!.value = this.activeCoreOpacity;
    this.stellarNeighborhoodVisible = transitionOpacity > MINIMUM_VISIBLE_REVEAL;
    this.refreshPresentationVisibility();
    this.points.visible = this.drawCount > 0 && this.opacity > MINIMUM_VISIBLE_REVEAL;
    if (this.points.visible !== wasVisible) {
      this.updatePickableIndices();
    }
  }

  public select(objectId: string | null): void {
    const index = objectId ? this.registry.getIndex(objectId) : null;

    if (!objectId || index === null) {
      this.selectedObjectId = null;
      this.selectionPoint.userData['objectId'] = null;
      this.refreshActiveDetail();

      return;
    }

    this.selectedObjectId = objectId;
    this.selectionPoint.position.fromArray(this.registry.renderPositions, index * 3);
    this.selectionPoint.userData['objectId'] = objectId;
    this.refreshActiveDetail();
  }

  public focus(objectId: string | null): void {
    const focusedObjectId = objectId && this.registry.getIndex(objectId) !== null ? objectId : null;

    if (focusedObjectId === this.focusedObjectId) {
      return;
    }
    this.focusedObjectId = focusedObjectId;
    this.refreshActiveDetail();
  }

  public getWorldPosition(objectId: string, target = new THREE.Vector3()): THREE.Vector3 | null {
    const position = this.registry.getLocalPosition(objectId, target);

    if (!position) {
      return null;
    }
    this.root.updateWorldMatrix(true, false);

    return position.applyMatrix4(this.root.matrixWorld);
  }

  public getPickables(): readonly THREE.Object3D[] {
    return [this.selectionPoint, this.points];
  }

  public get visibleCount(): number {
    return this.points.visible ? this.drawCount : 0;
  }

  public isObjectVisibleForLabels(objectId: string): boolean | null {
    if (this.registry.getIndex(objectId) === null) {
      return null;
    }

    return (
      !this.lodInitialized ||
      this.points.visible ||
      objectId === this.selectedObjectId ||
      objectId === this.focusedObjectId
    );
  }

  public dispose(): void {
    this.points.geometry.dispose();
    this.points.material.dispose();
    this.selectionPoint.geometry.dispose();
    this.selectionPoint.material.dispose();
    this.activeHalo.geometry.dispose();
    this.activeHalo.material.dispose();
    this.activeCore.geometry.dispose();
    this.activeCore.material.dispose();
    this.activeDetail.clear();
    this.root.clear();
  }

  private refreshActiveDetail(): void {
    const objectId = this.focusedObjectId ?? this.selectedObjectId;
    const index = objectId ? this.registry.getIndex(objectId) : null;

    if (!objectId || index === null) {
      this.activeDetail.userData['objectId'] = null;
      this.activeDetail.userData['activation'] = null;
      this.refreshPresentationVisibility();

      return;
    }

    this.activeDetail.position.fromArray(this.registry.renderPositions, index * 3);
    this.activeDetail.userData['objectId'] = objectId;
    this.activeDetail.userData['activation'] =
      this.focusedObjectId === objectId ? 'navigation-target' : 'selection';
    this.activeVisualScale = applyActiveCatalogStarAppearance(
      this.visual,
      this.registry,
      index,
      this.activeHaloSize,
      this.activeCoreOpacity,
    );
    this.refreshPresentationVisibility();
  }

  private refreshPresentationVisibility(): void {
    const hasActiveDetail = typeof this.activeDetail.userData['objectId'] === 'string';

    this.selectionPoint.visible = this.selectedObjectId !== null && this.stellarNeighborhoodVisible;
    this.activeDetail.visible = hasActiveDetail && this.stellarNeighborhoodVisible;
    this.activeHalo.visible = this.activeDetail.visible;
    this.activeCore.visible =
      this.activeDetail.visible && this.activeCoreOpacity > MINIMUM_VISIBLE_REVEAL;
  }

  private refreshSelectionPoint(): void {
    const index = this.selectedObjectId ? this.registry.getIndex(this.selectedObjectId) : null;

    if (index !== null) {
      this.selectionPoint.position.fromArray(this.registry.renderPositions, index * 3);
    }
  }

  private updatePickableIndices(): void {
    this.visibleIndices.fill(0);
    if (this.points.visible) {
      this.visibleIndices.fill(1, 0, this.drawCount);
    }
  }

  private getObserverBoundaryOpacity(observerPosition?: Vector3Like): number {
    const sphere = this.points.geometry.boundingSphere;

    if (!observerPosition || !sphere) {
      return 1;
    }
    this.points.updateWorldMatrix(true, false);
    this.observerWorldInverse.copy(this.points.matrixWorld).invert();
    this.observerLocalPosition
      .set(observerPosition.x, observerPosition.y, observerPosition.z)
      .applyMatrix4(this.observerWorldInverse);

    return getHeliocentricCatalogObserverOpacity(
      this.observerLocalPosition.length(),
      sphere.radius + sphere.center.length(),
      REMOTE_HYG_VISIBILITY_FLOOR,
    );
  }
}
