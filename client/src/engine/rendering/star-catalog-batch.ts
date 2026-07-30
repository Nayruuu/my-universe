import * as THREE from 'three';
import { dampValue } from '../lod/screen-space-lod';
import { colorIndexToRgb } from '../materials/star-color';
import { StarCatalogRegistry } from '../objects/star-catalog-registry';
import { PICKING_LAYER } from '../selection/selection-layers';

const LOD_OPACITIES = [0.68, 0.82, 1, 0.44, 0.14] as const;

export class StarCatalogBatch {
  public readonly root = new THREE.Group();
  public readonly points: THREE.Points<THREE.BufferGeometry, THREE.ShaderMaterial>;
  public readonly selectionPoint: THREE.Points<THREE.BufferGeometry, THREE.ShaderMaterial>;

  private readonly totalCount: number;
  private readonly visibleIndices: Uint8Array;
  private drawCount: number;
  private opacity = 0;

  constructor(private readonly registry: StarCatalogRegistry) {
    const catalog = registry.catalog;
    const geometry = createGeometry(registry);
    const material = createMaterial();

    this.totalCount = catalog.count;
    this.drawCount = catalog.count;
    this.visibleIndices = new Uint8Array(catalog.count);
    this.points = new THREE.Points(geometry, material);
    this.selectionPoint = createSelectionPoint();
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
    this.root.add(this.points, this.selectionPoint);
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
  }

  public updateLod(lodLevel: number, deltaSeconds: number): void {
    const targetOpacity = LOD_OPACITIES[lodLevel] ?? LOD_OPACITIES.at(-1)!;
    const wasVisible = this.points.visible;

    this.opacity = dampValue(this.opacity, targetOpacity, 6, deltaSeconds);
    this.points.material.uniforms['catalogOpacity']!.value = this.opacity;
    this.points.visible = this.drawCount > 0 && this.opacity > 0.004;
    if (this.points.visible !== wasVisible) {
      this.updatePickableIndices();
    }
  }

  public select(objectId: string | null): void {
    const position = objectId ? this.registry.getLocalPosition(objectId) : null;

    if (!objectId || !position) {
      this.selectionPoint.visible = false;
      this.selectionPoint.userData['objectId'] = null;

      return;
    }

    this.selectionPoint.position.copy(position);
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
    return this.points.visible ? this.drawCount : 0;
  }

  public dispose(): void {
    this.points.geometry.dispose();
    this.points.material.dispose();
    this.selectionPoint.geometry.dispose();
    this.selectionPoint.material.dispose();
    this.root.clear();
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
    sizes[index] = 1 + Math.pow(brightness, 1.65) * 4.4;
    alphas[index] = 0.28 + brightness * 0.72;
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

  return point;
}

function createMaterial(): THREE.ShaderMaterial {
  return new THREE.ShaderMaterial({
    uniforms: {
      pixelRatio: { value: 1 },
      catalogOpacity: { value: 0 },
    },
    vertexShader: `
      attribute float pointSize;
      attribute float pointAlpha;
      attribute vec3 color;
      uniform float pixelRatio;
      varying vec3 vColor;
      varying float vAlpha;

      void main() {
        vColor = color;
        vAlpha = pointAlpha;
        gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
        gl_PointSize = max(1.0, pointSize * pixelRatio);
      }
    `,
    fragmentShader: `
      uniform float catalogOpacity;
      varying vec3 vColor;
      varying float vAlpha;

      void main() {
        float radius = length(gl_PointCoord - vec2(0.5)) * 2.0;
        if (radius > 1.0) {
          discard;
        }
        float halo = pow(1.0 - radius, 0.9);
        float core = 1.0 - smoothstep(0.0, 0.2, radius);
        vec3 finalColor = vColor * (0.78 + core * 0.74);
        gl_FragColor = vec4(finalColor, vAlpha * catalogOpacity * halo);
      }
    `,
    transparent: true,
    blending: THREE.AdditiveBlending,
    depthWrite: false,
    toneMapped: false,
  });
}
