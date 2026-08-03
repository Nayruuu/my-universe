import * as THREE from 'three';
import { GraphicQuality } from '../../data/models/universe.models';
import { dampValue } from '../lod/screen-space-lod';
import { CosmicGroupCatalogRegistry } from '../objects/cosmic-group-catalog-registry';
import { PICKING_LAYER } from '../selection/selection-layers';
import { buildCosmicFilamentGraph, type CosmicFilamentEdge } from './cosmic-filament-graph';

const COSMIC_FADE_START_DISTANCE = 110_000;
const COSMIC_FULL_OPACITY_DISTANCE = 300_000;
const COSMIC_MAX_OPACITY = 0.82;
const COSMIC_OPACITY_DAMPING = 4;
const FILAMENT_FADE_START_DISTANCE = 140_000;
const FILAMENT_FULL_OPACITY_DISTANCE = 320_000;
const FILAMENT_MAX_OPACITY = 0.58;
const FILAMENT_FULL_DETAIL_DISTANCE = 140_000;
const FILAMENT_OVERVIEW_DISTANCE = 420_000;
const FILAMENT_OVERVIEW_DETAIL = 0.28;

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
  private opacity = 0;
  private filamentOpacity = 0;
  private filamentDetail = 0;
  private filamentCount = 0;

  constructor(
    private readonly registry: CosmicGroupCatalogRegistry,
    quality: GraphicQuality = 'high',
  ) {
    this.visibleIndices = new Uint8Array(registry.catalog.count);
    const filamentEdges = buildCosmicFilamentGraph(
      registry.catalog.positionsMpc,
      registry.catalog.count,
    );

    this.filaments = new THREE.LineSegments(
      createFilamentGeometry(registry, filamentEdges),
      createFilamentMaterial(),
    );
    this.points = new THREE.Points(createGeometry(registry), createMaterial());
    this.selectionPoint = createSelectionPoint();
    this.root.name = 'cosmicflows4-group-catalog-root';
    this.filaments.name = 'illustrative-cosmicflows4-filaments';
    this.filaments.visible = false;
    this.filaments.frustumCulled = false;
    this.filaments.renderOrder = 0;
    this.filaments.userData['edgeCount'] = filamentEdges.length;
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
    this.points.userData['objectIds'] = registry.objectIds;
    this.points.userData['visibleIndices'] = this.visibleIndices;
    this.root.add(this.filaments, this.points, this.selectionPoint);
    this.setQuality(quality);
  }

  public setQuality(quality: GraphicQuality): void {
    const edgeCount = this.filaments.userData['edgeCount'] as number;

    this.filamentCount = Math.ceil(edgeCount * FILAMENT_QUALITY_BUDGET[quality]);
    this.filaments.geometry.setDrawRange(0, this.filamentCount * 2);
    this.filaments.userData['activeEdgeCount'] = this.filamentCount;
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
    const targetOpacity = getCosmicCatalogTargetOpacity(cameraDistance);
    const wasVisible = this.points.visible;

    this.opacity = dampValue(this.opacity, targetOpacity, COSMIC_OPACITY_DAMPING, deltaSeconds);
    this.points.material.uniforms['catalogOpacity']!.value = this.opacity;
    this.points.visible = this.opacity > 0.004;
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
    this.filaments.visible = this.filamentCount > 0 && this.filamentOpacity > 0.004;

    if (this.points.visible !== wasVisible) {
      this.visibleIndices.fill(this.points.visible ? 1 : 0);
    }
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
    return this.points.visible ? this.registry.catalog.count : 0;
  }

  public get activeFilamentCount(): number {
    return this.filamentCount;
  }

  public get visibleFilamentCount(): number {
    return this.filaments.visible ? this.filamentCount : 0;
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
}

function createFilamentGeometry(
  registry: CosmicGroupCatalogRegistry,
  edges: readonly CosmicFilamentEdge[],
): THREE.BufferGeometry {
  const positions = new Float32Array(edges.length * 6);
  const alphas = new Float32Array(edges.length * 2);
  const detailThresholds = new Float32Array(edges.length * 2);

  for (let edgeIndex = 0; edgeIndex < edges.length; edgeIndex += 1) {
    const edge = edges[edgeIndex]!;
    const vertexOffset = edgeIndex * 6;
    const alphaOffset = edgeIndex * 2;
    const sourceOffset = edge.fromIndex * 3;
    const targetOffset = edge.toIndex * 3;
    const sourceReliability =
      1 -
      THREE.MathUtils.clamp(registry.catalog.distanceModulusErrors[edge.fromIndex]! / 1.2, 0, 1);
    const targetReliability =
      1 - THREE.MathUtils.clamp(registry.catalog.distanceModulusErrors[edge.toIndex]! / 1.2, 0, 1);
    const reliability = (sourceReliability + targetReliability) * 0.5;
    const alpha = (0.38 + edge.strength * 0.62) * (0.6 + reliability * 0.4);
    const confidence = edge.strength * 0.72 + reliability * 0.28;
    const detailThreshold = 0.08 + (1 - confidence) * 0.82;

    positions.set(registry.renderPositions.subarray(sourceOffset, sourceOffset + 3), vertexOffset);
    positions.set(
      registry.renderPositions.subarray(targetOffset, targetOffset + 3),
      vertexOffset + 3,
    );
    alphas[alphaOffset] = alpha;
    alphas[alphaOffset + 1] = alpha;
    detailThresholds[alphaOffset] = detailThreshold;
    detailThresholds[alphaOffset + 1] = detailThreshold;
  }
  const geometry = new THREE.BufferGeometry();

  geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
  geometry.setAttribute('lineAlpha', new THREE.BufferAttribute(alphas, 1));
  geometry.setAttribute('detailThreshold', new THREE.BufferAttribute(detailThresholds, 1));
  geometry.setDrawRange(0, 0);
  if (edges.length > 0) {
    geometry.computeBoundingSphere();
  }

  return geometry;
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
          vDetailThreshold - 0.08,
          vDetailThreshold + 0.02,
          filamentDetail
        );
        float detailAlpha = mix(0.22, 1.0, detailFade);
        vec3 color = mix(vec3(0.04, 0.34, 0.72), vec3(0.48, 0.93, 1.0), vAlpha);
        gl_FragColor = vec4(color * radiance, filamentOpacity * vAlpha * detailAlpha);
      }
    `,
    transparent: true,
    blending: THREE.AdditiveBlending,
    depthWrite: false,
    toneMapped: false,
  });
}

function createGeometry(registry: CosmicGroupCatalogRegistry): THREE.BufferGeometry {
  const catalog = registry.catalog;
  const sizes = new Float32Array(catalog.count);
  const alphas = new Float32Array(catalog.count);

  for (let index = 0; index < catalog.count; index += 1) {
    const reliability =
      1 - THREE.MathUtils.clamp(catalog.distanceModulusErrors[index]! / 1.2, 0, 1);

    sizes[index] = 1.6 + reliability * 2.4;
    alphas[index] = 0.28 + reliability * 0.6;
  }
  const geometry = new THREE.BufferGeometry();

  geometry.setAttribute('position', new THREE.BufferAttribute(registry.renderPositions, 3));
  geometry.setAttribute('pointSize', new THREE.BufferAttribute(sizes, 1));
  geometry.setAttribute('pointAlpha', new THREE.BufferAttribute(alphas, 1));
  geometry.setDrawRange(0, catalog.count);
  geometry.computeBoundingSphere();

  return geometry;
}

function createMaterial(): THREE.ShaderMaterial {
  return new THREE.ShaderMaterial({
    uniforms: {
      pixelRatio: { value: 1 },
      catalogOpacity: { value: 0 },
      radiance: { value: 1 },
    },
    vertexShader: `
      attribute float pointSize;
      attribute float pointAlpha;
      uniform float pixelRatio;
      varying float vAlpha;

      void main() {
        vAlpha = pointAlpha;
        gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
        gl_PointSize = max(1.0, pointSize * pixelRatio);
      }
    `,
    fragmentShader: `
      uniform float catalogOpacity;
      uniform float radiance;
      varying float vAlpha;

      void main() {
        float radius = length(gl_PointCoord - vec2(0.5)) * 2.0;
        if (radius > 1.0) {
          discard;
        }
        float halo = pow(1.0 - radius, 0.72);
        float core = 1.0 - smoothstep(0.0, 0.24, radius);
        vec3 color = mix(vec3(0.20, 0.48, 0.70), vec3(0.72, 0.90, 1.0), core);
        gl_FragColor = vec4(color * radiance, vAlpha * catalogOpacity * halo);
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
