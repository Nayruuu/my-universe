import * as THREE from 'three';
import { dampValue } from '../lod/screen-space-lod';
import { CosmicGroupCatalogRegistry } from '../objects/cosmic-group-catalog-registry';
import { PICKING_LAYER } from '../selection/selection-layers';

const COSMIC_FADE_START_DISTANCE = 40_000;
const COSMIC_FULL_OPACITY_DISTANCE = 240_000;
const COSMIC_MAX_OPACITY = 0.82;
const COSMIC_OPACITY_DAMPING = 4;

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

export class CosmicGroupCatalogBatch {
  public readonly root = new THREE.Group();
  public readonly points: THREE.Points<THREE.BufferGeometry, THREE.ShaderMaterial>;
  public readonly selectionPoint: THREE.Points<THREE.BufferGeometry, THREE.ShaderMaterial>;

  private readonly visibleIndices: Uint8Array;
  private opacity = 0;

  constructor(private readonly registry: CosmicGroupCatalogRegistry) {
    this.visibleIndices = new Uint8Array(registry.catalog.count);
    this.points = new THREE.Points(createGeometry(registry), createMaterial());
    this.selectionPoint = createSelectionPoint();
    this.root.name = 'cosmicflows4-group-catalog-root';
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
    this.root.add(this.points, this.selectionPoint);
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
    const targetOpacity = getCosmicCatalogTargetOpacity(cameraDistance);
    const wasVisible = this.points.visible;

    this.opacity = dampValue(this.opacity, targetOpacity, COSMIC_OPACITY_DAMPING, deltaSeconds);
    this.points.material.uniforms['catalogOpacity']!.value = this.opacity;
    this.points.visible = this.opacity > 0.004;

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

  public dispose(): void {
    this.points.geometry.dispose();
    this.points.material.dispose();
    this.selectionPoint.geometry.dispose();
    this.selectionPoint.material.dispose();
    this.root.clear();
  }
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
