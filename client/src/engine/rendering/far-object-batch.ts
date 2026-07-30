import * as THREE from 'three';
import { GraphicQuality, SpaceObject } from '../../data/models/universe.models';
import { PICKING_LAYER } from '../selection/selection-layers';

export class FarObjectBatch {
  public readonly points: THREE.Points<THREE.BufferGeometry, THREE.ShaderMaterial>;

  private readonly positions: Float32Array;
  private readonly sizes: Float32Array;
  private readonly alphas: Float32Array;
  private readonly visibleIndices: Uint8Array;
  private readonly positionAttribute: THREE.BufferAttribute;
  private readonly sizeAttribute: THREE.BufferAttribute;
  private readonly alphaAttribute: THREE.BufferAttribute;
  private positionsDirty = true;
  private appearanceDirty = true;
  private visibleCount = 0;

  constructor(objects: readonly SpaceObject[], quality: GraphicQuality) {
    const count = objects.length;

    this.positions = new Float32Array(count * 3);
    this.sizes = new Float32Array(count);
    this.alphas = new Float32Array(count);
    this.visibleIndices = new Uint8Array(count);
    const colors = new Float32Array(count * 3);

    for (let index = 0; index < count; index += 1) {
      const color = new THREE.Color(objects[index]?.visual.color ?? '#b6c3da');
      const offset = index * 3;

      colors[offset] = color.r;
      colors[offset + 1] = color.g;
      colors[offset + 2] = color.b;
    }

    const geometry = new THREE.BufferGeometry();

    this.positionAttribute = new THREE.BufferAttribute(this.positions, 3);
    this.positionAttribute.setUsage(THREE.DynamicDrawUsage);
    this.sizeAttribute = new THREE.BufferAttribute(this.sizes, 1);
    this.sizeAttribute.setUsage(THREE.DynamicDrawUsage);
    this.alphaAttribute = new THREE.BufferAttribute(this.alphas, 1);
    this.alphaAttribute.setUsage(THREE.DynamicDrawUsage);
    geometry.setAttribute('position', this.positionAttribute);
    geometry.setAttribute('color', new THREE.BufferAttribute(colors, 3));
    geometry.setAttribute('pointSize', this.sizeAttribute);
    geometry.setAttribute('pointAlpha', this.alphaAttribute);
    geometry.setDrawRange(0, count);

    const pixelRatioCap = quality === 'low' ? 1 : quality === 'medium' ? 1.5 : 2;
    const material = new THREE.ShaderMaterial({
      uniforms: {
        pixelRatio: {
          value: Math.min(window.devicePixelRatio, pixelRatioCap),
        },
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
          vec4 viewPosition = modelViewMatrix * vec4(position, 1.0);
          gl_Position = projectionMatrix * viewPosition;
          gl_PointSize = max(1.0, pointSize * pixelRatio);
        }
      `,
      fragmentShader: `
        varying vec3 vColor;
        varying float vAlpha;

        void main() {
          float radius = length(gl_PointCoord - vec2(0.5)) * 2.0;
          if (radius > 1.0 || vAlpha < 0.005) {
            discard;
          }
          float halo = pow(1.0 - radius, 0.72);
          float core = 1.0 - smoothstep(0.0, 0.32, radius);
          vec3 finalColor = vColor * (0.72 + core * 0.72);
          gl_FragColor = vec4(finalColor, vAlpha * halo);
        }
      `,
      transparent: true,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
      toneMapped: false,
    });

    this.points = new THREE.Points(geometry, material);
    this.points.name = 'batched-far-celestial-objects';
    this.points.layers.enable(PICKING_LAYER);
    this.points.frustumCulled = false;
    this.points.visible = false;
    this.points.renderOrder = 4;
    this.points.userData['objectIds'] = objects.map((object) => object.id);
    this.points.userData['visibleIndices'] = this.visibleIndices;
  }

  public updatePoint(
    index: number,
    position: THREE.Vector3,
    sizePixels: number,
    opacity: number,
  ): void {
    const offset = index * 3;

    if (
      this.positions[offset] !== position.x ||
      this.positions[offset + 1] !== position.y ||
      this.positions[offset + 2] !== position.z
    ) {
      this.positions[offset] = position.x;
      this.positions[offset + 1] = position.y;
      this.positions[offset + 2] = position.z;
      this.positionsDirty = true;
    }

    if (this.sizes[index] !== sizePixels || this.alphas[index] !== opacity) {
      const wasVisible = this.visibleIndices[index] === 1;
      const isVisible = opacity > 0.008;

      this.sizes[index] = sizePixels;
      this.alphas[index] = opacity;
      this.visibleIndices[index] = isVisible ? 1 : 0;
      if (wasVisible !== isVisible) {
        this.visibleCount += isVisible ? 1 : -1;
        this.points.visible = this.visibleCount > 0;
      }
      this.appearanceDirty = true;
    }
  }

  public commit(): void {
    if (this.positionsDirty) {
      this.positionAttribute.needsUpdate = true;
      this.positionsDirty = false;
    }
    if (this.appearanceDirty) {
      this.sizeAttribute.needsUpdate = true;
      this.alphaAttribute.needsUpdate = true;
      this.appearanceDirty = false;
    }
  }
}
