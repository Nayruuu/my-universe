import * as THREE from 'three';
import { type CosmicStructureType, type GraphicQuality } from '../../data/models/universe.models';
import { dampValue } from '../lod/screen-space-lod';
import { CosmicStructureCatalogRegistry } from '../objects/cosmic-structure-catalog-registry';
import {
  type CosmicMapLayers,
  DEFAULT_COSMIC_MAP_LAYERS,
  getCosmicMapDetail,
  isCosmicMapLayerEnabled,
} from './cosmic-map-policy';
import { createCosmicStructureCatalogVisual } from './cosmic-structure-catalog-visual';

const FADE_START_DISTANCE = 140_000;
const FULL_OPACITY_DISTANCE = 320_000;
const MAXIMUM_OPACITY = 0.52;
const OPACITY_DAMPING = 4;
const DETAIL_DAMPING = 5;
const DETAIL_SCALES = {
  low: 0.75,
  medium: 0.9,
  high: 1,
} as const satisfies Record<GraphicQuality, number>;

export function getCosmicStructureTargetOpacity(cameraDistance: number): number {
  const progress = THREE.MathUtils.clamp(
    (cameraDistance - FADE_START_DISTANCE) / (FULL_OPACITY_DISTANCE - FADE_START_DISTANCE),
    0,
    1,
  );
  const easedProgress = progress * progress * (3 - 2 * progress);

  return MAXIMUM_OPACITY * easedProgress;
}

export class CosmicStructureCatalogBatch {
  public readonly root = new THREE.Group();
  public readonly points: THREE.Points<THREE.BufferGeometry, THREE.ShaderMaterial>;
  public readonly selectionPoint: THREE.Points<THREE.BufferGeometry, THREE.ShaderMaterial>;

  private readonly visibleIndices: Uint8Array;
  private readonly revealThresholds: Float32Array;
  private readonly renderStructureTypes: readonly CosmicStructureType[];
  private readonly renderIndexByObjectId: ReadonlyMap<string, number>;
  private layers: CosmicMapLayers = DEFAULT_COSMIC_MAP_LAYERS;
  private quality: GraphicQuality;
  private cameraDistance = Number.POSITIVE_INFINITY;
  private opacity = 0;
  private detail = 0;
  private activePointCount = 0;

  constructor(
    private readonly registry: CosmicStructureCatalogRegistry,
    quality: GraphicQuality = 'high',
  ) {
    const visual = createCosmicStructureCatalogVisual(registry, this.layers);

    this.quality = quality;
    this.visibleIndices = visual.visibleIndices;
    this.revealThresholds = visual.revealThresholds;
    this.renderStructureTypes = visual.structureTypes;
    this.renderIndexByObjectId = visual.renderIndexByObjectId;
    this.points = visual.points;
    this.selectionPoint = visual.selectionPoint;
    this.root.name = 'documented-cosmic-structure-catalog-root';
    this.root.add(this.points, this.selectionPoint);
    this.setQuality(quality);
  }

  public setQuality(quality: GraphicQuality): void {
    this.quality = quality;
    this.points.material.uniforms['detailScale']!.value = DETAIL_SCALES[quality];
    this.detail = getCosmicMapDetail(this.cameraDistance, quality);
    this.points.material.uniforms['detailLevel']!.value = this.detail;
    this.refreshVisibility();
  }

  public setLayers(layers: CosmicMapLayers): void {
    this.layers = { ...layers };
    this.points.userData['layerState'] = { ...this.layers };
    this.points.material.uniforms['layerMask']!.value.set(
      Number(layers.clusters),
      Number(layers.superclusters),
      Number(layers.filaments),
      Number(layers.voids),
    );
    this.refreshVisibility();
  }

  public setPixelRatio(pixelRatio: number): void {
    const boundedRatio = Math.max(0.5, pixelRatio);

    this.points.material.uniforms['pixelRatio']!.value = boundedRatio;
    this.selectionPoint.material.uniforms['pixelRatio']!.value = boundedRatio;
  }

  public setPhotographicRadiance(radiance: number): void {
    this.points.material.uniforms['radiance']!.value = THREE.MathUtils.clamp(radiance, 0.5, 1.5);
  }

  public updateDistance(cameraDistance: number, deltaSeconds: number): void {
    this.cameraDistance = cameraDistance;
    const targetOpacity = getCosmicStructureTargetOpacity(cameraDistance);

    this.opacity = dampValue(this.opacity, targetOpacity, OPACITY_DAMPING, deltaSeconds);
    this.detail = dampValue(
      this.detail,
      getCosmicMapDetail(cameraDistance, this.quality),
      DETAIL_DAMPING,
      deltaSeconds,
    );
    this.points.material.uniforms['catalogOpacity']!.value = this.opacity;
    this.points.material.uniforms['detailLevel']!.value = this.detail;
    this.refreshVisibility();
  }

  public select(objectId: string | null): void {
    const index = objectId ? this.registry.getIndex(objectId) : null;

    if (!objectId || index === null) {
      this.selectionPoint.visible = false;
      this.selectionPoint.userData['objectId'] = null;

      return;
    }

    this.selectionPoint.position.fromArray(this.registry.renderPositions, index * 3);
    this.selectionPoint.userData['objectId'] = objectId;
    this.selectionPoint.visible = true;
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
    return this.points.visible ? this.activePointCount : 0;
  }

  public isObjectVisible(objectId: string): boolean | null {
    const renderIndex = this.renderIndexByObjectId.get(objectId);

    return renderIndex === undefined ? null : this.visibleIndices[renderIndex] === 1;
  }

  public isObjectVisibleForLabels(objectId: string): boolean | null {
    const catalogIndex = this.registry.getIndex(objectId);

    return catalogIndex === null
      ? null
      : this.points.visible &&
          isCosmicMapLayerEnabled(this.registry.catalog.structureTypes[catalogIndex]!, this.layers);
  }

  public dispose(): void {
    this.points.geometry.dispose();
    this.points.material.dispose();
    this.selectionPoint.geometry.dispose();
    this.selectionPoint.material.dispose();
    this.root.clear();
  }

  private refreshVisibility(): void {
    const drawCount = findThresholdCount(this.revealThresholds, this.detail);

    this.points.geometry.setDrawRange(0, drawCount);
    this.visibleIndices.fill(0);
    let activeCount = 0;

    for (let index = 0; index < drawCount; index += 1) {
      if (!isCosmicMapLayerEnabled(this.renderStructureTypes[index]!, this.layers)) {
        continue;
      }
      this.visibleIndices[index] = 1;
      activeCount += 1;
    }
    this.activePointCount = this.opacity > 0.004 ? activeCount : 0;
    this.points.visible = this.activePointCount > 0;
    if (!this.points.visible) {
      this.visibleIndices.fill(0);
    }
    this.points.userData['activeCount'] = this.activePointCount;
  }
}

function findThresholdCount(thresholds: Float32Array, detail: number): number {
  let lower = 0;
  let upper = thresholds.length;

  while (lower < upper) {
    const middle = (lower + upper) >>> 1;

    if (thresholds[middle]! <= detail) {
      lower = middle + 1;
    } else {
      upper = middle;
    }
  }

  return lower;
}
