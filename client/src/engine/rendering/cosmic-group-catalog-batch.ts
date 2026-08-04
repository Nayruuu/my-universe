import * as THREE from 'three';
import { GraphicQuality } from '../../data/models/universe.models';
import { dampValue } from '../lod/screen-space-lod';
import { CosmicGroupCatalogRegistry } from '../objects/cosmic-group-catalog-registry';
import { PICKING_LAYER } from '../selection/selection-layers';
import {
  CosmicMapLayers,
  DEFAULT_COSMIC_MAP_LAYERS,
  getCosmicGroupDetail,
  getCosmicGroupRevealThreshold,
} from './cosmic-map-policy';

const COSMIC_FADE_START_DISTANCE = 110_000;
const COSMIC_FULL_OPACITY_DISTANCE = 300_000;
const COSMIC_MAX_OPACITY = 0.58;
const COSMIC_OPACITY_DAMPING = 4;
const COSMIC_DETAIL_DAMPING = 5;
const FILAMENT_FADE_START_DISTANCE = 140_000;
const FILAMENT_FULL_OPACITY_DISTANCE = 320_000;
const FILAMENT_MAX_OPACITY = 0.22;
const FILAMENT_FULL_DETAIL_DISTANCE = 140_000;
const FILAMENT_OVERVIEW_DISTANCE = 420_000;
const FILAMENT_OVERVIEW_DETAIL = 0.12;
const FILAMENT_MAXIMUM_LENGTH_MPC = 52;

const FILAMENT_QUALITY_BUDGET = {
  low: 0.28,
  medium: 0.62,
  high: 1,
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
  private readonly renderIndexByObjectId = new Map<string, number>();
  private readonly filamentRevealThresholds: Float32Array;
  private layers: CosmicMapLayers = DEFAULT_COSMIC_MAP_LAYERS;
  private quality: GraphicQuality;
  private cameraDistance = Number.POSITIVE_INFINITY;
  private opacity = 0;
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
    this.quality = quality;
    this.visibleIndices = new Uint8Array(registry.catalog.count);
    const filamentPairs = registry.catalog.filamentPairs;
    const filamentEdgeCount = filamentPairs.length / 2;
    const filamentGeometry = createFilamentGeometry(registry, filamentPairs);
    const pointGeometry = createGeometry(registry);

    this.filaments = new THREE.LineSegments(filamentGeometry.geometry, createFilamentMaterial());
    this.filamentRevealThresholds = filamentGeometry.revealThresholds;
    this.revealThresholds = pointGeometry.revealThresholds;
    this.points = new THREE.Points(pointGeometry.geometry, createMaterial());
    this.selectionPoint = createSelectionPoint();
    this.root.name = 'cosmicflows4-group-catalog-root';
    this.filaments.name = 'illustrative-cosmicflows4-filaments';
    this.filaments.visible = false;
    this.filaments.frustumCulled = false;
    this.filaments.renderOrder = 0;
    this.filaments.userData['edgeCount'] = filamentEdgeCount;
    this.filaments.userData['scientificConfidence'] = 'illustrative';
    this.filaments.userData['visualStyle'] = 'derived-nearest-neighbor-cosmic-filaments';
    this.filaments.userData['detailMode'] = 'camera-distance-confidence-fade';
    this.filaments.userData['source'] = 'Derived from Cosmicflows-4 group positions';
    this.points.name = 'calculated-cosmicflows4-groups';
    this.points.visible = false;
    this.points.frustumCulled = false;
    this.points.renderOrder = 1;
    this.points.layers.enable(PICKING_LAYER);
    this.selectionPoint.layers.enable(PICKING_LAYER);
    this.points.userData['catalogCount'] = registry.catalog.count;
    this.points.userData['scientificConfidence'] = 'calculated';
    this.points.userData['source'] = 'Cosmicflows-4 · Tully et al. (2023)';
    this.points.userData['visualColorEncoding'] =
      'illustrative-distance-gradient-near-warm-far-cool';
    this.points.userData['objectIds'] = pointGeometry.objectIds;
    this.points.userData['visibleIndices'] = this.visibleIndices;
    this.points.userData['activeCount'] = 0;
    this.points.userData['layerState'] = { ...this.layers };
    for (let index = 0; index < pointGeometry.objectIds.length; index += 1) {
      this.renderIndexByObjectId.set(pointGeometry.objectIds[index]!, index);
    }
    this.root.add(this.filaments, this.points, this.selectionPoint);
    this.setQuality(quality);
  }

  public setQuality(quality: GraphicQuality): void {
    const edgeCount = this.filaments.userData['edgeCount'] as number;

    this.quality = quality;
    this.filamentQualityLimit = Math.ceil(edgeCount * FILAMENT_QUALITY_BUDGET[quality]);
    this.detail = getCosmicGroupDetail(this.cameraDistance, quality);
    this.points.material.uniforms['detailLevel']!.value = this.detail;
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
      getCosmicGroupDetail(cameraDistance, this.quality),
      COSMIC_DETAIL_DAMPING,
      deltaSeconds,
    );
    this.points.material.uniforms['catalogOpacity']!.value = this.opacity;
    this.points.material.uniforms['detailLevel']!.value = this.detail;
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

function createFilamentGeometry(
  registry: CosmicGroupCatalogRegistry,
  filamentPairs: Uint32Array,
): { geometry: THREE.BufferGeometry; revealThresholds: Float32Array } {
  const edgeCount = filamentPairs.length / 2;
  const records: FilamentRenderRecord[] = [];

  for (let edgeIndex = 0; edgeIndex < edgeCount; edgeIndex += 1) {
    records.push(createFilamentRecord(registry, filamentPairs, edgeIndex));
  }
  records.sort(
    (left, right) =>
      left.revealThreshold - right.revealThreshold || left.edgeIndex - right.edgeIndex,
  );
  const positions = new Float32Array(edgeCount * 6);
  const alphas = new Float32Array(edgeCount * 2);
  const detailThresholds = new Float32Array(edgeCount * 2);
  const revealThresholds = new Float32Array(edgeCount);

  for (let renderIndex = 0; renderIndex < records.length; renderIndex += 1) {
    const record = records[renderIndex]!;
    const vertexOffset = renderIndex * 6;
    const alphaOffset = renderIndex * 2;
    const sourceOffset = record.fromIndex * 3;
    const targetOffset = record.toIndex * 3;

    positions.set(registry.renderPositions.subarray(sourceOffset, sourceOffset + 3), vertexOffset);
    positions.set(
      registry.renderPositions.subarray(targetOffset, targetOffset + 3),
      vertexOffset + 3,
    );
    alphas[alphaOffset] = record.alpha;
    alphas[alphaOffset + 1] = record.alpha;
    detailThresholds[alphaOffset] = record.revealThreshold;
    detailThresholds[alphaOffset + 1] = record.revealThreshold;
    revealThresholds[renderIndex] = record.revealThreshold;
  }
  const geometry = new THREE.BufferGeometry();

  geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
  geometry.setAttribute('lineAlpha', new THREE.BufferAttribute(alphas, 1));
  geometry.setAttribute('detailThreshold', new THREE.BufferAttribute(detailThresholds, 1));
  geometry.setDrawRange(0, 0);
  if (edgeCount > 0) {
    geometry.computeBoundingSphere();
  }

  return { geometry, revealThresholds };
}

interface FilamentRenderRecord {
  readonly edgeIndex: number;
  readonly fromIndex: number;
  readonly toIndex: number;
  readonly alpha: number;
  readonly revealThreshold: number;
}

function createFilamentRecord(
  registry: CosmicGroupCatalogRegistry,
  filamentPairs: Uint32Array,
  edgeIndex: number,
): FilamentRenderRecord {
  const fromIndex = filamentPairs[edgeIndex * 2]!;
  const toIndex = filamentPairs[edgeIndex * 2 + 1]!;
  const sourceOffset = fromIndex * 3;
  const targetOffset = toIndex * 3;
  const deltaX =
    registry.catalog.positionsMpc[targetOffset]! - registry.catalog.positionsMpc[sourceOffset]!;
  const deltaY =
    registry.catalog.positionsMpc[targetOffset + 1]! -
    registry.catalog.positionsMpc[sourceOffset + 1]!;
  const deltaZ =
    registry.catalog.positionsMpc[targetOffset + 2]! -
    registry.catalog.positionsMpc[sourceOffset + 2]!;
  const distanceMpc = Math.hypot(deltaX, deltaY, deltaZ);
  const strength =
    0.12 + (1 - THREE.MathUtils.clamp(distanceMpc / FILAMENT_MAXIMUM_LENGTH_MPC, 0, 1)) * 0.88;
  const sourceReliability =
    1 - THREE.MathUtils.clamp(registry.catalog.distanceModulusErrors[fromIndex]! / 1.2, 0, 1);
  const targetReliability =
    1 - THREE.MathUtils.clamp(registry.catalog.distanceModulusErrors[toIndex]! / 1.2, 0, 1);
  const reliability = (sourceReliability + targetReliability) * 0.5;

  return {
    edgeIndex,
    fromIndex,
    toIndex,
    alpha: (0.38 + strength * 0.62) * (0.6 + reliability * 0.4),
    revealThreshold: 0.04 + (1 - (strength * 0.72 + reliability * 0.28)) * 0.72,
  };
}

function createFilamentMaterial(): THREE.ShaderMaterial {
  return new THREE.ShaderMaterial({
    uniforms: {
      filamentOpacity: { value: 0 },
      filamentDetail: { value: 0 },
      radiance: { value: 1 },
    },
    vertexShader: `
      attribute float lineAlpha;
      attribute float detailThreshold;
      varying float vAlpha;
      varying float vDetailThreshold;

      void main() {
        vAlpha = lineAlpha;
        vDetailThreshold = detailThreshold;
        gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
      }
    `,
    fragmentShader: `
      uniform float filamentOpacity;
      uniform float filamentDetail;
      uniform float radiance;
      varying float vAlpha;
      varying float vDetailThreshold;

      void main() {
        float detailFade = smoothstep(
          vDetailThreshold - 0.025,
          vDetailThreshold + 0.005,
          filamentDetail
        );
        vec3 color = mix(vec3(0.04, 0.34, 0.72), vec3(0.48, 0.93, 1.0), vAlpha);
        gl_FragColor = vec4(color * radiance, filamentOpacity * vAlpha * detailFade);
      }
    `,
    transparent: true,
    blending: THREE.NormalBlending,
    depthWrite: false,
    toneMapped: false,
  });
}

function createGeometry(registry: CosmicGroupCatalogRegistry): {
  geometry: THREE.BufferGeometry;
  objectIds: readonly string[];
  revealThresholds: Float32Array;
} {
  const catalog = registry.catalog;
  const records: GroupRenderRecord[] = Array.from({ length: catalog.count }, (_, catalogIndex) => ({
    catalogIndex,
    objectId: registry.objectIds[catalogIndex]!,
    revealThreshold: getCosmicGroupRevealThreshold(registry.objectIds[catalogIndex]!),
  }));

  if (records.length > 0) {
    records[0]!.revealThreshold = 0;
  }
  records.sort(
    (left, right) =>
      left.revealThreshold - right.revealThreshold || left.catalogIndex - right.catalogIndex,
  );
  const positions = new Float32Array(catalog.count * 3);
  const sizes = new Float32Array(catalog.count);
  const alphas = new Float32Array(catalog.count);
  const colors = new Float32Array(catalog.count * 3);
  const revealThresholds = new Float32Array(catalog.count);
  const objectIds = new Array<string>(catalog.count);
  const nearColor = new THREE.Color(0xffc876);
  const middleColor = new THREE.Color(0xb9e5ff);
  const farColor = new THREE.Color(0x8c78ff);
  const pointColor = new THREE.Color();

  for (let renderIndex = 0; renderIndex < catalog.count; renderIndex += 1) {
    const record = records[renderIndex]!;
    const catalogIndex = record.catalogIndex;
    const sourceOffset = catalogIndex * 3;
    const renderOffset = renderIndex * 3;
    const reliability =
      1 - THREE.MathUtils.clamp(catalog.distanceModulusErrors[catalogIndex]! / 1.2, 0, 1);

    positions.set(registry.renderPositions.subarray(sourceOffset, sourceOffset + 3), renderOffset);
    sizes[renderIndex] = 2.2 + reliability * 3.3;
    alphas[renderIndex] = 0.28 + reliability * 0.56;
    const depth = normalizedLogarithmicDepth(
      catalog.distancesMpc[catalogIndex]!,
      catalog.minimumDistanceMpc,
      catalog.maximumDistanceMpc,
    );

    if (depth < 0.5) {
      pointColor.lerpColors(nearColor, middleColor, depth * 2);
    } else {
      pointColor.lerpColors(middleColor, farColor, (depth - 0.5) * 2);
    }
    colors[renderOffset] = pointColor.r;
    colors[renderOffset + 1] = pointColor.g;
    colors[renderOffset + 2] = pointColor.b;
    revealThresholds[renderIndex] = record.revealThreshold;
    objectIds[renderIndex] = record.objectId;
  }
  const geometry = new THREE.BufferGeometry();

  geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
  geometry.setAttribute('pointSize', new THREE.BufferAttribute(sizes, 1));
  geometry.setAttribute('pointAlpha', new THREE.BufferAttribute(alphas, 1));
  geometry.setAttribute('pointColor', new THREE.BufferAttribute(colors, 3));
  geometry.setAttribute('revealThreshold', new THREE.BufferAttribute(revealThresholds, 1));
  geometry.setDrawRange(0, 0);
  geometry.computeBoundingSphere();

  return { geometry, objectIds, revealThresholds };
}

interface GroupRenderRecord {
  readonly catalogIndex: number;
  readonly objectId: string;
  revealThreshold: number;
}

function normalizedLogarithmicDepth(distance: number, minimum: number, maximum: number): number {
  const logarithmicMinimum = Math.log1p(Math.max(0, minimum));
  const logarithmicRange = Math.max(
    0.000_001,
    Math.log1p(Math.max(0, maximum)) - logarithmicMinimum,
  );

  return THREE.MathUtils.clamp(
    (Math.log1p(Math.max(0, distance)) - logarithmicMinimum) / logarithmicRange,
    0,
    1,
  );
}

function createMaterial(): THREE.ShaderMaterial {
  return new THREE.ShaderMaterial({
    uniforms: {
      pixelRatio: { value: 1 },
      catalogOpacity: { value: 0 },
      radiance: { value: 1 },
      detailLevel: { value: 0 },
    },
    vertexShader: `
      attribute float pointSize;
      attribute float pointAlpha;
      attribute vec3 pointColor;
      attribute float revealThreshold;
      uniform float pixelRatio;
      uniform float detailLevel;
      varying float vAlpha;
      varying vec3 vColor;

      void main() {
        float reveal = smoothstep(
          revealThreshold - 0.018,
          revealThreshold + 0.004,
          detailLevel
        );
        vAlpha = pointAlpha * reveal;
        vColor = pointColor;
        gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
        gl_PointSize = max(1.0, pointSize * pixelRatio);
      }
    `,
    fragmentShader: `
      uniform float catalogOpacity;
      uniform float radiance;
      varying float vAlpha;
      varying vec3 vColor;

      void main() {
        float radius = length(gl_PointCoord - vec2(0.5)) * 2.0;
        if (radius > 1.0) {
          discard;
        }
        float halo = pow(1.0 - radius, 1.35);
        float luminousCore = 1.0 - smoothstep(0.0, 0.24, radius);
        float glow = halo * 0.62 + luminousCore;
        vec3 color = mix(vColor, vec3(1.0, 0.97, 0.9), luminousCore * 0.88);
        gl_FragColor = vec4(
          color * radiance * (0.72 + luminousCore * 0.58),
          vAlpha * catalogOpacity * glow
        );
      }
    `,
    transparent: true,
    blending: THREE.AdditiveBlending,
    depthWrite: false,
    toneMapped: false,
  });
}

function createSelectionPoint(): THREE.Points<THREE.BufferGeometry, THREE.ShaderMaterial> {
  const geometry = new THREE.BufferGeometry();

  geometry.setAttribute('position', new THREE.Float32BufferAttribute([0, 0, 0], 3));
  const material = new THREE.ShaderMaterial({
    uniforms: {
      pixelRatio: { value: 1 },
    },
    vertexShader: `
      uniform float pixelRatio;

      void main() {
        gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
        gl_PointSize = 24.0 * pixelRatio;
      }
    `,
    fragmentShader: `
      void main() {
        float radius = length(gl_PointCoord - vec2(0.5)) * 2.0;
        if (radius > 1.0) {
          discard;
        }
        float ring = 1.0 - smoothstep(0.07, 0.18, abs(radius - 0.68));
        float halo = pow(1.0 - radius, 1.5) * 0.38;
        gl_FragColor = vec4(0.52, 0.82, 1.0, max(ring, halo));
      }
    `,
    transparent: true,
    blending: THREE.AdditiveBlending,
    depthWrite: false,
    toneMapped: false,
  });
  const point = new THREE.Points(geometry, material);

  point.name = 'selected-cosmicflows4-group';
  point.visible = false;
  point.frustumCulled = false;
  point.renderOrder = 5;
  point.userData['objectId'] = null;

  return point;
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
