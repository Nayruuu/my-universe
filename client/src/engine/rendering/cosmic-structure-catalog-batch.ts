import * as THREE from 'three';
import { CosmicStructureType, GraphicQuality } from '../../data/models/universe.models';
import { dampValue } from '../lod/screen-space-lod';
import { CosmicStructureCatalogRegistry } from '../objects/cosmic-structure-catalog-registry';
import { PICKING_LAYER } from '../selection/selection-layers';
import {
  CosmicMapLayers,
  DEFAULT_COSMIC_MAP_LAYERS,
  getCosmicMapDetail,
  getCosmicStructureRevealThreshold,
  isCosmicMapLayerEnabled,
} from './cosmic-map-policy';

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
const STRUCTURE_KIND_CODES = {
  cluster: 0,
  supercluster: 1,
  wall: 2,
  filament: 3,
  void: 4,
  basin: 5,
  attractor: 6,
  repeller: 7,
} as const satisfies Record<CosmicStructureType, number>;

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
  private readonly renderIndexByObjectId = new Map<string, number>();
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
    this.quality = quality;
    this.visibleIndices = new Uint8Array(registry.catalog.count);
    const pointGeometry = createGeometry(registry);

    this.revealThresholds = pointGeometry.revealThresholds;
    this.renderStructureTypes = pointGeometry.structureTypes;
    this.points = new THREE.Points(pointGeometry.geometry, createMaterial());
    this.selectionPoint = createSelectionPoint();
    this.root.name = 'documented-cosmic-structure-catalog-root';
    this.points.name = 'calculated-cosmic-structure-symbols';
    this.points.visible = false;
    this.points.frustumCulled = false;
    this.points.renderOrder = 2;
    this.points.layers.enable(PICKING_LAYER);
    this.selectionPoint.layers.enable(PICKING_LAYER);
    this.points.userData['catalogCount'] = registry.catalog.count;
    this.points.userData['sourceCount'] = registry.catalog.metadata.sources.length;
    this.points.userData['scientificConfidence'] = 'calculated';
    this.points.userData['representation'] = 'typed-map-symbols';
    this.points.userData['structureCounts'] = countStructures(registry.catalog.structureTypes);
    this.points.userData['objectIds'] = pointGeometry.objectIds;
    this.points.userData['visibleIndices'] = this.visibleIndices;
    this.points.userData['activeCount'] = 0;
    this.points.userData['layerState'] = { ...this.layers };
    for (let index = 0; index < pointGeometry.objectIds.length; index += 1) {
      this.renderIndexByObjectId.set(pointGeometry.objectIds[index]!, index);
    }
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

function createGeometry(registry: CosmicStructureCatalogRegistry): {
  geometry: THREE.BufferGeometry;
  objectIds: readonly string[];
  revealThresholds: Float32Array;
  structureTypes: readonly CosmicStructureType[];
} {
  const catalog = registry.catalog;
  const records: StructureRenderRecord[] = Array.from(
    { length: catalog.count },
    (_, catalogIndex) => {
      const source = catalog.metadata.sources[catalog.sourceIndices[catalogIndex]!]!;
      const objectId = registry.objectIds[catalogIndex]!;

      return {
        catalogIndex,
        objectId,
        structureType: catalog.structureTypes[catalogIndex]!,
        revealThreshold:
          catalog.catalogNumericIds[catalogIndex]! <= 1
            ? 0
            : getCosmicStructureRevealThreshold(
                objectId,
                catalog.structureTypes[catalogIndex]!,
                source.id,
              ),
      };
    },
  );

  records.sort(
    (left, right) =>
      left.revealThreshold - right.revealThreshold || left.catalogIndex - right.catalogIndex,
  );
  const positions = new Float32Array(catalog.count * 3);
  const sizes = new Float32Array(catalog.count);
  const alphas = new Float32Array(catalog.count);
  const kinds = new Float32Array(catalog.count);
  const revealThresholds = new Float32Array(catalog.count);
  const objectIds = new Array<string>(catalog.count);
  const structureTypes = new Array<CosmicStructureType>(catalog.count);

  for (let renderIndex = 0; renderIndex < catalog.count; renderIndex += 1) {
    const record = records[renderIndex]!;
    const catalogIndex = record.catalogIndex;
    const sourceOffset = catalogIndex * 3;
    const renderOffset = renderIndex * 3;
    const structureType = record.structureType;
    const radiusScale = Math.log1p(catalog.radiiMpc[catalogIndex]!) * 0.8;
    const populationScale = Math.log1p(catalog.galaxyCounts[catalogIndex]!) * 0.16;
    const typeScale = structureType === 'void' ? 1.18 : structureType === 'supercluster' ? 1.08 : 1;

    positions.set(registry.renderPositions.subarray(sourceOffset, sourceOffset + 3), renderOffset);
    sizes[renderIndex] = THREE.MathUtils.clamp(
      (2.6 + radiusScale + populationScale) * typeScale,
      3.2,
      9,
    );
    alphas[renderIndex] = 0.28 + catalog.confidences[catalogIndex]! * 0.42;
    kinds[renderIndex] = STRUCTURE_KIND_CODES[structureType];
    revealThresholds[renderIndex] = record.revealThreshold;
    objectIds[renderIndex] = record.objectId;
    structureTypes[renderIndex] = structureType;
  }
  const geometry = new THREE.BufferGeometry();

  geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
  geometry.setAttribute('pointSize', new THREE.BufferAttribute(sizes, 1));
  geometry.setAttribute('pointAlpha', new THREE.BufferAttribute(alphas, 1));
  geometry.setAttribute('structureKind', new THREE.BufferAttribute(kinds, 1));
  geometry.setAttribute('revealThreshold', new THREE.BufferAttribute(revealThresholds, 1));
  geometry.setDrawRange(0, 0);
  geometry.computeBoundingSphere();

  return { geometry, objectIds, revealThresholds, structureTypes };
}

interface StructureRenderRecord {
  readonly catalogIndex: number;
  readonly objectId: string;
  readonly structureType: CosmicStructureType;
  readonly revealThreshold: number;
}

function createMaterial(): THREE.ShaderMaterial {
  return new THREE.ShaderMaterial({
    uniforms: {
      pixelRatio: { value: 1 },
      catalogOpacity: { value: 0 },
      radiance: { value: 1 },
      detailScale: { value: 1 },
      detailLevel: { value: 0 },
      layerMask: { value: new THREE.Vector4(1, 1, 0, 0) },
    },
    vertexShader: `
      attribute float pointSize;
      attribute float pointAlpha;
      attribute float structureKind;
      attribute float revealThreshold;
      uniform float pixelRatio;
      uniform float detailScale;
      uniform float detailLevel;
      uniform vec4 layerMask;
      varying float vAlpha;
      varying float vStructureKind;

      void main() {
        float layerVisibility = structureKind < 0.5
          ? layerMask.x
          : structureKind < 2.5
            ? layerMask.y
            : structureKind < 3.5
              ? layerMask.z
              : structureKind < 4.5
                ? layerMask.w
                : layerMask.y;
        float reveal = smoothstep(
          revealThreshold - 0.018,
          revealThreshold + 0.004,
          detailLevel
        );
        vAlpha = pointAlpha * reveal * layerVisibility;
        vStructureKind = structureKind;
        gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
        gl_PointSize = max(2.0, pointSize * pixelRatio * detailScale);
      }
    `,
    fragmentShader: `
      uniform float catalogOpacity;
      uniform float radiance;
      varying float vAlpha;
      varying float vStructureKind;

      vec3 structureColor(float kind) {
        if (kind < 0.5) return vec3(0.71, 0.68, 1.0);
        if (kind < 1.5) return vec3(0.84, 0.58, 1.0);
        if (kind < 2.5) return vec3(1.0, 0.57, 0.36);
        if (kind < 3.5) return vec3(0.34, 0.84, 0.94);
        if (kind < 4.5) return vec3(0.28, 0.57, 1.0);
        if (kind < 5.5) return vec3(0.56, 0.42, 1.0);
        if (kind < 6.5) return vec3(1.0, 0.72, 0.28);
        return vec3(0.31, 0.86, 0.66);
      }

      void main() {
        float radius = length(gl_PointCoord - vec2(0.5)) * 2.0;
        if (radius > 1.0) {
          discard;
        }
        vec3 color = structureColor(vStructureKind);
        float alpha;

        if (vStructureKind > 3.5 && vStructureKind < 4.5) {
          float ring = smoothstep(0.58, 0.72, radius) * (1.0 - smoothstep(0.86, 1.0, radius));
          float interior = (1.0 - smoothstep(0.0, 0.74, radius)) * 0.06;
          alpha = max(ring, interior);
        } else {
          float halo = pow(1.0 - radius, 0.68);
          float core = 1.0 - smoothstep(0.0, 0.26, radius);
          color = mix(color * 0.68, vec3(1.0), core * 0.72);
          alpha = halo;
        }
        gl_FragColor = vec4(color * radiance, alpha * vAlpha * catalogOpacity);
      }
    `,
    transparent: true,
    blending: THREE.NormalBlending,
    depthWrite: false,
    toneMapped: false,
  });
}

function createSelectionPoint(): THREE.Points<THREE.BufferGeometry, THREE.ShaderMaterial> {
  const geometry = new THREE.BufferGeometry();

  geometry.setAttribute('position', new THREE.Float32BufferAttribute([0, 0, 0], 3));
  const material = new THREE.ShaderMaterial({
    uniforms: { pixelRatio: { value: 1 } },
    vertexShader: `
      uniform float pixelRatio;
      void main() {
        gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
        gl_PointSize = 28.0 * pixelRatio;
      }
    `,
    fragmentShader: `
      void main() {
        float radius = length(gl_PointCoord - vec2(0.5)) * 2.0;
        if (radius > 1.0) discard;
        float ring = 1.0 - smoothstep(0.06, 0.16, abs(radius - 0.7));
        float halo = pow(1.0 - radius, 1.4) * 0.32;
        gl_FragColor = vec4(0.65, 0.88, 1.0, max(ring, halo));
      }
    `,
    transparent: true,
    blending: THREE.AdditiveBlending,
    depthWrite: false,
    toneMapped: false,
  });
  const point = new THREE.Points(geometry, material);

  point.name = 'selected-cosmic-structure';
  point.visible = false;
  point.frustumCulled = false;
  point.renderOrder = 6;
  point.userData['objectId'] = null;

  return point;
}

function countStructures(
  types: readonly CosmicStructureType[],
): Partial<Record<CosmicStructureType, number>> {
  const counts: Partial<Record<CosmicStructureType, number>> = {};

  for (const structureType of types) {
    counts[structureType] = (counts[structureType] ?? 0) + 1;
  }

  return counts;
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
