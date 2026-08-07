import * as THREE from 'three';
import { GraphicQuality } from '../../data/models/universe.models';
import { dampValue } from '../lod/screen-space-lod';
import { CosmicGroupCatalogRegistry } from '../objects/cosmic-group-catalog-registry';
import {
  CosmicMapLayers,
  DEFAULT_COSMIC_MAP_LAYERS,
  getCosmicGroupDetail,
} from './cosmic-map-policy';
import { createCosmicGroupCatalogVisual } from './cosmic-group-catalog-visual';

const COSMIC_FADE_START_DISTANCE = 30_000;
const COSMIC_FULL_OPACITY_DISTANCE = 300_000;
const COSMIC_MAX_OPACITY = 0.58;
const COSMIC_OPACITY_DAMPING = 4;
const COSMIC_DETAIL_DAMPING = 5;
const IMPOSTOR_FADE_IN_START_DISTANCE = 55_000;
const IMPOSTOR_FADE_IN_END_DISTANCE = 95_000;
const IMPOSTOR_FADE_OUT_START_DISTANCE = 170_000;
const IMPOSTOR_FADE_OUT_END_DISTANCE = 300_000;
const IMPOSTOR_DAMPING = 4;
const FILAMENT_FADE_START_DISTANCE = 140_000;
const FILAMENT_FULL_OPACITY_DISTANCE = 320_000;
const FILAMENT_MAX_OPACITY = 0.22;
const FILAMENT_FULL_DETAIL_DISTANCE = 140_000;
const FILAMENT_OVERVIEW_DISTANCE = 420_000;
const FILAMENT_OVERVIEW_DETAIL = 0.12;

const FILAMENT_QUALITY_BUDGET = {
  low: 0.28,
  medium: 0.62,
  high: 1,
} as const satisfies Record<GraphicQuality, number>;

const IMPOSTOR_QUALITY_SCALE = {
  low: 0.76,
  medium: 0.9,
  high: 1,
} as const satisfies Record<GraphicQuality, number>;

const IMPOSTOR_DETAIL_LIMIT = {
  low: 0.15,
  medium: 0.22,
  high: 0.3,
} as const satisfies Record<GraphicQuality, number>;

export function getCosmicCatalogTargetOpacity(cameraDistance: number): number {
  const progress = THREE.MathUtils.clamp(
    (cameraDistance - COSMIC_FADE_START_DISTANCE) /
      (COSMIC_FULL_OPACITY_DISTANCE - COSMIC_FADE_START_DISTANCE),
    0,
    1,
  );
  const easedProgress = progress * progress * (3 - 2 * progress);

  return COSMIC_MAX_OPACITY * easedProgress;
}

export function getCosmicGroupImpostorBlend(cameraDistance: number): number {
  const fadeIn = smoothstep(
    IMPOSTOR_FADE_IN_START_DISTANCE,
    IMPOSTOR_FADE_IN_END_DISTANCE,
    cameraDistance,
  );
  const fadeOut =
    1 -
    smoothstep(IMPOSTOR_FADE_OUT_START_DISTANCE, IMPOSTOR_FADE_OUT_END_DISTANCE, cameraDistance);

  return fadeIn * fadeOut;
}

export function getCosmicGroupRenderDetail(
  cameraDistance: number,
  quality: GraphicQuality,
): number {
  const mapDetail = getCosmicGroupDetail(cameraDistance, quality);
  const impostorDetail = Math.min(mapDetail, IMPOSTOR_DETAIL_LIMIT[quality]);

  return THREE.MathUtils.lerp(
    mapDetail,
    impostorDetail,
    getCosmicGroupImpostorBlend(cameraDistance),
  );
}

export function getCosmicFilamentTargetOpacity(cameraDistance: number): number {
  const progress = THREE.MathUtils.clamp(
    (cameraDistance - FILAMENT_FADE_START_DISTANCE) /
      (FILAMENT_FULL_OPACITY_DISTANCE - FILAMENT_FADE_START_DISTANCE),
    0,
    1,
  );
  const easedProgress = progress * progress * (3 - 2 * progress);

  return FILAMENT_MAX_OPACITY * easedProgress;
}

export function getCosmicFilamentDetail(cameraDistance: number): number {
  const progress = THREE.MathUtils.clamp(
    (FILAMENT_OVERVIEW_DISTANCE - cameraDistance) /
      (FILAMENT_OVERVIEW_DISTANCE - FILAMENT_FULL_DETAIL_DISTANCE),
    0,
    1,
  );
  const easedProgress = progress * progress * (3 - 2 * progress);

  return THREE.MathUtils.lerp(FILAMENT_OVERVIEW_DETAIL, 1, easedProgress);
}

export class CosmicGroupCatalogBatch {
  public readonly root = new THREE.Group();
  public readonly filaments: THREE.LineSegments<THREE.BufferGeometry, THREE.ShaderMaterial>;
  public readonly points: THREE.Points<THREE.BufferGeometry, THREE.ShaderMaterial>;
  public readonly selectionPoint: THREE.Points<THREE.BufferGeometry, THREE.ShaderMaterial>;

  private readonly visibleIndices: Uint8Array;
  private readonly revealThresholds: Float32Array;
  private readonly renderIndexByObjectId: ReadonlyMap<string, number>;
  private readonly filamentRevealThresholds: Float32Array;
  private layers: CosmicMapLayers = DEFAULT_COSMIC_MAP_LAYERS;
  private quality: GraphicQuality;
  private cameraDistance = Number.POSITIVE_INFINITY;
  private opacity = 0;
  private impostorBlend = 0;
  private detail = 0;
  private activePointCount = 0;
  private filamentOpacity = 0;
  private filamentDetail = 0;
  private filamentCount = 0;
  private filamentQualityLimit = 0;

  constructor(
    private readonly registry: CosmicGroupCatalogRegistry,
    quality: GraphicQuality = 'high',
  ) {
    const visual = createCosmicGroupCatalogVisual(registry, this.layers);

    this.quality = quality;
    this.visibleIndices = visual.visibleIndices;
    this.filaments = visual.filaments;
    this.filamentRevealThresholds = visual.filamentRevealThresholds;
    this.revealThresholds = visual.pointRevealThresholds;
    this.points = visual.points;
    this.selectionPoint = visual.selectionPoint;
    this.renderIndexByObjectId = visual.renderIndexByObjectId;
    this.root.name = 'cosmicflows4-group-catalog-root';
    this.root.add(this.filaments, this.points, this.selectionPoint);
    this.setQuality(quality);
  }

  public setQuality(quality: GraphicQuality): void {
    const edgeCount = this.filaments.userData['edgeCount'] as number;

    this.quality = quality;
    this.filamentQualityLimit = Math.ceil(edgeCount * FILAMENT_QUALITY_BUDGET[quality]);
    this.detail = getCosmicGroupRenderDetail(this.cameraDistance, quality);
    this.points.material.uniforms['detailLevel']!.value = this.detail;
    this.points.material.uniforms['qualityScale']!.value = IMPOSTOR_QUALITY_SCALE[quality];
    this.refreshPointVisibility();
    this.refreshFilamentVisibility();
  }

  public setLayers(layers: CosmicMapLayers): void {
    this.layers = { ...layers };
    this.points.userData['layerState'] = { ...this.layers };
    this.refreshPointVisibility();
    this.refreshFilamentVisibility();
  }

  public setPixelRatio(pixelRatio: number): void {
    const boundedRatio = Math.max(0.5, pixelRatio);

    this.points.material.uniforms['pixelRatio']!.value = boundedRatio;
    this.selectionPoint.material.uniforms['pixelRatio']!.value = boundedRatio;
  }

  public setPhotographicRadiance(radiance: number): void {
    const boundedRadiance = THREE.MathUtils.clamp(radiance, 0.5, 1.5);

    this.points.material.uniforms['radiance']!.value = boundedRadiance;
    this.filaments.material.uniforms['radiance']!.value = boundedRadiance;
  }

  public updateDistance(cameraDistance: number, deltaSeconds: number): void {
    this.cameraDistance = cameraDistance;
    const targetOpacity = getCosmicCatalogTargetOpacity(cameraDistance);

    this.opacity = dampValue(this.opacity, targetOpacity, COSMIC_OPACITY_DAMPING, deltaSeconds);
    this.detail = dampValue(
      this.detail,
      getCosmicGroupRenderDetail(cameraDistance, this.quality),
      COSMIC_DETAIL_DAMPING,
      deltaSeconds,
    );
    this.points.material.uniforms['catalogOpacity']!.value = this.opacity;
    this.points.material.uniforms['detailLevel']!.value = this.detail;
    this.impostorBlend = dampValue(
      this.impostorBlend,
      getCosmicGroupImpostorBlend(cameraDistance),
      IMPOSTOR_DAMPING,
      deltaSeconds,
    );
    this.points.material.uniforms['impostorBlend']!.value = this.impostorBlend;
    const targetFilamentOpacity = getCosmicFilamentTargetOpacity(cameraDistance);

    this.filamentOpacity = dampValue(
      this.filamentOpacity,
      targetFilamentOpacity,
      COSMIC_OPACITY_DAMPING,
      deltaSeconds,
    );
    this.filamentDetail = dampValue(
      this.filamentDetail,
      getCosmicFilamentDetail(cameraDistance),
      COSMIC_OPACITY_DAMPING,
      deltaSeconds,
    );
    this.filaments.material.uniforms['filamentOpacity']!.value = this.filamentOpacity;
    this.filaments.material.uniforms['filamentDetail']!.value = this.filamentDetail;
    this.refreshPointVisibility();
    this.refreshFilamentVisibility();
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

  public get activeFilamentCount(): number {
    return this.filamentCount;
  }

  public get visibleFilamentCount(): number {
    return this.filaments.visible ? this.filamentCount : 0;
  }

  public isObjectVisible(objectId: string): boolean | null {
    const renderIndex = this.renderIndexByObjectId.get(objectId);

    return renderIndex === undefined ? null : this.visibleIndices[renderIndex] === 1;
  }

  public isObjectVisibleForLabels(objectId: string): boolean | null {
    return this.registry.has(objectId) ? this.points.visible && this.layers.groups : null;
  }

  public dispose(): void {
    this.points.geometry.dispose();
    this.points.material.dispose();
    this.filaments.geometry.dispose();
    this.filaments.material.dispose();
    this.selectionPoint.geometry.dispose();
    this.selectionPoint.material.dispose();
    this.root.clear();
  }

  private refreshPointVisibility(): void {
    const drawCount = findThresholdCount(this.revealThresholds, this.detail);
    const visible = this.layers.groups && this.opacity > 0.004 && drawCount > 0;

    this.activePointCount = visible ? drawCount : 0;
    this.points.geometry.setDrawRange(0, drawCount);
    this.points.visible = visible;
    this.visibleIndices.fill(0);
    if (visible) {
      this.visibleIndices.fill(1, 0, drawCount);
    }
    this.points.userData['activeCount'] = this.activePointCount;
  }

  private refreshFilamentVisibility(): void {
    const detailCount = findThresholdCount(this.filamentRevealThresholds, this.filamentDetail);

    this.filamentCount = Math.min(detailCount, this.filamentQualityLimit);
    this.filaments.geometry.setDrawRange(0, this.filamentCount * 2);
    this.filaments.userData['activeEdgeCount'] = this.filamentCount;
    this.filaments.visible =
      this.layers.links && this.filamentCount > 0 && this.filamentOpacity > 0.004;
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

function smoothstep(minimum: number, maximum: number, value: number): number {
  const progress = THREE.MathUtils.clamp((value - minimum) / (maximum - minimum), 0, 1);

  return progress * progress * (3 - 2 * progress);
}
