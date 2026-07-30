import * as THREE from 'three';
import { dampValue } from '../lod/screen-space-lod';
import { colorIndexToRgb } from '../materials/star-color';
import { CATALOG_STAR_VISUAL_RADIUS, StarCatalogRegistry } from '../objects/star-catalog-registry';
import { PICKING_LAYER } from '../selection/selection-layers';

const LOD_OPACITIES = [0.68, 0.82, 1, 0, 0, 0] as const;
const LOD_POINT_SCALES = [1.9, 1.6, 1.3, 1, 0.82, 0.55] as const;
const ACTIVE_HALO_SIZES = [118, 64, 28, 20, 16, 12] as const;
const ACTIVE_CORE_OPACITIES = [1, 0.28, 0, 0, 0, 0] as const;
const CATALOG_PICKING_PRIORITY = 20;
const SELECTED_STAR_PICKING_PRIORITY = 30;

export class StarCatalogBatch {
  public readonly root = new THREE.Group();
  public readonly points: THREE.Points<THREE.BufferGeometry, THREE.ShaderMaterial>;
  public readonly selectionPoint: THREE.Points<THREE.BufferGeometry, THREE.ShaderMaterial>;
  public readonly activeDetail: THREE.Group;
  public readonly activeHalo: THREE.Points<THREE.BufferGeometry, THREE.ShaderMaterial>;
  public readonly activeCore: THREE.Mesh<THREE.SphereGeometry, THREE.MeshBasicMaterial>;

  private readonly totalCount: number;
  private readonly visibleIndices: Uint8Array;
  private drawCount: number;
  private opacity = 0;
  private pointScale = 1;
  private activeHaloSize = 17;
  private activeCoreOpacity = 0;

  constructor(private readonly registry: StarCatalogRegistry) {
    const catalog = registry.catalog;
    const geometry = createGeometry(registry);
    const material = createMaterial();

    this.totalCount = catalog.count;
    this.drawCount = catalog.count;
    this.visibleIndices = new Uint8Array(catalog.count);
    this.points = new THREE.Points(geometry, material);
    this.selectionPoint = createSelectionPoint();
    this.activeDetail = new THREE.Group();
    this.activeHalo = createActiveHalo();
    this.activeCore = createActiveCore();
    this.root.name = 'hyg-star-catalog-root';
    this.points.name = 'observed-hyg-star-catalog';
    this.points.layers.enable(PICKING_LAYER);
    this.selectionPoint.layers.enable(PICKING_LAYER);
    this.points.visible = false;
    this.points.renderOrder = 2;
    this.points.userData['catalogCount'] = catalog.count;
    this.points.userData['referenceEpochJulianDay'] = catalog.referenceEpochJulianDay;
    this.points.userData['scientificConfidence'] = 'observed';
    this.points.userData['visualScale'] = 'compressed';
    this.points.userData['objectIds'] = registry.objectIds;
    this.points.userData['visibleIndices'] = this.visibleIndices;
    this.points.userData['visualStyle'] = 'photographic-temperature-and-diffraction';
    this.points.userData['pickingPriority'] = CATALOG_PICKING_PRIORITY;
    this.activeDetail.name = 'active-hyg-star-detail';
    this.activeDetail.visible = false;
    this.activeDetail.userData['objectId'] = null;
    this.activeDetail.userData['kind'] = 'adaptive-catalog-star';
    this.activeDetail.add(this.activeHalo, this.activeCore);
    this.root.add(this.points, this.selectionPoint, this.activeDetail);
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

  public updateLod(lodLevel: number, deltaSeconds: number): void {
    const targetOpacity = LOD_OPACITIES[lodLevel] ?? LOD_OPACITIES.at(-1)!;
    const targetPointScale = LOD_POINT_SCALES[lodLevel] ?? LOD_POINT_SCALES.at(-1)!;
    const targetHaloSize = ACTIVE_HALO_SIZES[lodLevel] ?? ACTIVE_HALO_SIZES.at(-1)!;
    const targetCoreOpacity = ACTIVE_CORE_OPACITIES[lodLevel] ?? ACTIVE_CORE_OPACITIES.at(-1)!;
    const wasVisible = this.points.visible;

    this.opacity = dampValue(this.opacity, targetOpacity, 6, deltaSeconds);
    this.pointScale = dampValue(this.pointScale, targetPointScale, 6, deltaSeconds);
    this.activeHaloSize = dampValue(this.activeHaloSize, targetHaloSize, 7, deltaSeconds);
    this.activeCoreOpacity = dampValue(this.activeCoreOpacity, targetCoreOpacity, 7, deltaSeconds);
    this.points.material.uniforms['catalogOpacity']!.value = this.opacity;
    this.points.material.uniforms['pointScale']!.value = this.pointScale;
    this.activeHalo.material.uniforms['pointSize']!.value = this.activeHaloSize;
    this.activeCore.material.opacity = this.activeCoreOpacity;
    this.activeCore.visible = this.activeDetail.visible && this.activeCoreOpacity > 0.004;
    this.activeHalo.visible = this.activeDetail.visible;
    this.points.visible = this.drawCount > 0 && this.opacity > 0.004;
    if (this.points.visible !== wasVisible) {
      this.updatePickableIndices();
    }
  }

  public select(objectId: string | null): void {
    const index = objectId ? this.registry.getIndex(objectId) : null;

    if (!objectId || index === null) {
      this.selectionPoint.visible = false;
      this.selectionPoint.userData['objectId'] = null;
      this.activeDetail.visible = false;
      this.activeDetail.userData['objectId'] = null;

      return;
    }

    this.selectionPoint.position.fromArray(this.registry.renderPositions, index * 3);
    this.selectionPoint.userData['objectId'] = objectId;
    this.selectionPoint.visible = true;
    this.activeDetail.position.copy(this.selectionPoint.position);
    this.activeDetail.userData['objectId'] = objectId;
    this.activeDetail.visible = true;
    this.activeHalo.visible = true;
    this.activeCore.visible = this.activeCoreOpacity > 0.004;
    this.applyActiveStarColor(index);
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

  private applyActiveStarColor(index: number): void {
    const [red, green, blue] = colorIndexToRgb(this.registry.catalog.colorIndicesBv[index]!);
    const color = this.activeHalo.material.uniforms['starColor']!.value as THREE.Color;

    color.setRGB(red, green, blue);
    this.activeCore.material.color.setRGB(red, green, blue);
  }

  private updatePickableIndices(): void {
    this.visibleIndices.fill(0);
    if (this.points.visible) {
      this.visibleIndices.fill(1, 0, this.drawCount);
    }
  }
}

function createGeometry(registry: StarCatalogRegistry): THREE.BufferGeometry {
  const catalog = registry.catalog;
  const colors = new Float32Array(catalog.count * 3);
  const sizes = new Float32Array(catalog.count);
  const alphas = new Float32Array(catalog.count);

  for (let index = 0; index < catalog.count; index += 1) {
    const offset = index * 3;
    const color = colorIndexToRgb(catalog.colorIndicesBv[index]!);
    const brightness = THREE.MathUtils.clamp((7 - catalog.apparentMagnitudes[index]!) / 8.5, 0, 1);

    colors[offset] = color[0];
    colors[offset + 1] = color[1];
    colors[offset + 2] = color[2];
    sizes[index] = 1.55 + Math.pow(brightness, 1.55) * 7.1;
    alphas[index] = 0.38 + brightness * 0.62;
  }

  const geometry = new THREE.BufferGeometry();

  geometry.setAttribute('position', new THREE.BufferAttribute(registry.renderPositions, 3));
  geometry.setAttribute('color', new THREE.BufferAttribute(colors, 3));
  geometry.setAttribute('pointSize', new THREE.BufferAttribute(sizes, 1));
  geometry.setAttribute('pointAlpha', new THREE.BufferAttribute(alphas, 1));
  geometry.setDrawRange(0, catalog.count);
  geometry.computeBoundingSphere();

  return geometry;
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
        gl_PointSize = 17.0 * pixelRatio;
      }
    `,
    fragmentShader: `
      void main() {
        float radius = length(gl_PointCoord - vec2(0.5)) * 2.0;
        if (radius > 1.0) {
          discard;
        }
        float ring = 1.0 - smoothstep(0.08, 0.2, abs(radius - 0.68));
        float core = (1.0 - smoothstep(0.0, 0.22, radius)) * 0.72;
        float alpha = max(ring * 0.92, core);
        gl_FragColor = vec4(0.48, 0.82, 1.0, alpha);
      }
    `,
    transparent: true,
    blending: THREE.AdditiveBlending,
    depthWrite: false,
    toneMapped: false,
  });
  const point = new THREE.Points(geometry, material);

  point.name = 'selected-hyg-star';
  point.visible = false;
  point.frustumCulled = false;
  point.renderOrder = 5;
  point.userData['objectId'] = null;
  point.userData['pickingPriority'] = SELECTED_STAR_PICKING_PRIORITY;

  return point;
}

function createActiveHalo(): THREE.Points<THREE.BufferGeometry, THREE.ShaderMaterial> {
  const geometry = new THREE.BufferGeometry();

  geometry.setAttribute('position', new THREE.Float32BufferAttribute([0, 0, 0], 3));
  const material = new THREE.ShaderMaterial({
    uniforms: {
      pixelRatio: { value: 1 },
      pointSize: { value: 17 },
      starColor: { value: new THREE.Color(0xdce8ff) },
    },
    vertexShader: `
      uniform float pixelRatio;
      uniform float pointSize;

      void main() {
        gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
        gl_PointSize = max(1.0, pointSize * pixelRatio);
      }
    `,
    fragmentShader: `
      uniform vec3 starColor;

      void main() {
        float radius = length(gl_PointCoord - vec2(0.5)) * 2.0;
        if (radius > 1.0) {
          discard;
        }
        float halo = pow(1.0 - radius, 1.35);
        float core = 1.0 - smoothstep(0.0, 0.16, radius);
        vec3 finalColor = starColor * (0.84 + core * 1.35);
        float alpha = min(1.0, halo * 0.68 + core * 0.72);
        gl_FragColor = vec4(finalColor, alpha);
      }
    `,
    transparent: true,
    blending: THREE.AdditiveBlending,
    depthWrite: false,
    toneMapped: false,
  });
  const halo = new THREE.Points(geometry, material);

  halo.name = 'active-hyg-star-halo';
  halo.frustumCulled = false;
  halo.renderOrder = 4;
  halo.userData['representation'] = 'halo';

  return halo;
}

function createActiveCore(): THREE.Mesh<THREE.SphereGeometry, THREE.MeshBasicMaterial> {
  const core = new THREE.Mesh(
    new THREE.SphereGeometry(1, 24, 16),
    new THREE.MeshBasicMaterial({
      color: 0xdce8ff,
      transparent: true,
      opacity: 0,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
      toneMapped: false,
    }),
  );

  core.name = 'active-hyg-star-core';
  core.scale.setScalar(CATALOG_STAR_VISUAL_RADIUS);
  core.visible = false;
  core.renderOrder = 3;
  core.userData['representation'] = 'volume';

  return core;
}

function createMaterial(): THREE.ShaderMaterial {
  return new THREE.ShaderMaterial({
    uniforms: {
      pixelRatio: { value: 1 },
      catalogOpacity: { value: 0 },
      pointScale: { value: 1 },
      radiance: { value: 1 },
      diffractionStrength: { value: 0.42 },
    },
    vertexShader: `
      attribute float pointSize;
      attribute float pointAlpha;
      attribute vec3 color;
      uniform float pixelRatio;
      uniform float pointScale;
      varying vec3 vColor;
      varying float vAlpha;

      void main() {
        vColor = color;
        vAlpha = pointAlpha;
        gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
        gl_PointSize = max(1.0, pointSize * pointScale * pixelRatio);
      }
    `,
    fragmentShader: `
      uniform float catalogOpacity;
      uniform float radiance;
      uniform float diffractionStrength;
      varying vec3 vColor;
      varying float vAlpha;

      void main() {
        vec2 point = (gl_PointCoord - vec2(0.5)) * 2.0;
        float radius = length(point);
        if (radius > 1.0) {
          discard;
        }
        float halo = pow(1.0 - radius, 1.08);
        float core = 1.0 - smoothstep(0.0, 0.19, radius);
        float horizontal = 1.0 - smoothstep(0.0, 0.055, abs(point.y));
        float vertical = 1.0 - smoothstep(0.0, 0.055, abs(point.x));
        float brightStar = smoothstep(0.72, 0.98, vAlpha);
        float diffraction = max(horizontal, vertical) * pow(1.0 - radius, 1.8)
          * brightStar * diffractionStrength;
        vec3 finalColor = vColor * (0.76 + core * 0.92 + diffraction * 1.35) * radiance;
        float alpha = min(1.0, halo + diffraction) * vAlpha * catalogOpacity;
        gl_FragColor = vec4(finalColor, alpha);
      }
    `,
    transparent: true,
    blending: THREE.AdditiveBlending,
    depthWrite: false,
    toneMapped: false,
  });
}
