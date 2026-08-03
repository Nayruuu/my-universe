import * as THREE from 'three';
import { NearbyGalaxyOverviewEntry } from '../../data/models/universe.models';
import { CoordinateSystem } from '../coordinates/coordinate-system';
import { dampValue } from '../lod/screen-space-lod';

const FADE_IN_START_DISTANCE = 10_000;
const FULL_OPACITY_DISTANCE = 26_000;
const FADE_OUT_START_DISTANCE = 150_000;
const FADE_OUT_END_DISTANCE = 300_000;
const MAXIMUM_OPACITY = 0.42;
const OPACITY_DAMPING = 4;

export function getNearbyGalaxyOverviewTargetOpacity(cameraDistance: number): number {
  const fadeIn = smoothstep(FADE_IN_START_DISTANCE, FULL_OPACITY_DISTANCE, cameraDistance);
  const fadeOut = 1 - smoothstep(FADE_OUT_START_DISTANCE, FADE_OUT_END_DISTANCE, cameraDistance);

  return MAXIMUM_OPACITY * fadeIn * fadeOut;
}

export class NearbyGalaxyOverviewBatch {
  public readonly points: THREE.Points<THREE.BufferGeometry, THREE.ShaderMaterial>;

  private opacity = 0;

  constructor(
    private readonly entries: readonly NearbyGalaxyOverviewEntry[],
    coordinateSystem: CoordinateSystem,
  ) {
    this.points = new THREE.Points(createGeometry(entries, coordinateSystem), createMaterial());
    this.points.name = 'observed-nearby-galaxy-overview';
    this.points.visible = false;
    this.points.frustumCulled = false;
    this.points.renderOrder = 2;
    this.points.userData['catalogCount'] = entries.length;
    this.points.userData['scientificConfidence'] = 'observed';
    this.points.userData['visualStyle'] = 'adaptive-local-volume-overview';
    this.points.userData['source'] = 'Updated Nearby Galaxy Catalog · Karachentsev et al. (2013)';
    this.points.userData['objectIds'] = entries.map((entry) => entry.id);
  }

  public setPixelRatio(pixelRatio: number): void {
    this.points.material.uniforms['pixelRatio']!.value = Math.max(0.5, pixelRatio);
  }

  public setPhotographicRadiance(radiance: number): void {
    this.points.material.uniforms['radiance']!.value = THREE.MathUtils.clamp(radiance, 0.5, 1.5);
  }

  public updateDistance(cameraDistance: number, deltaSeconds: number): void {
    this.opacity = dampValue(
      this.opacity,
      getNearbyGalaxyOverviewTargetOpacity(cameraDistance),
      OPACITY_DAMPING,
      deltaSeconds,
    );
    this.points.material.uniforms['catalogOpacity']!.value = this.opacity;
    this.points.visible = this.entries.length > 0 && this.opacity > 0.004;
  }

  public get visibleCount(): number {
    return this.points.visible ? this.entries.length : 0;
  }

  public dispose(): void {
    this.points.geometry.dispose();
    this.points.material.dispose();
  }
}

function createGeometry(
  entries: readonly NearbyGalaxyOverviewEntry[],
  coordinateSystem: CoordinateSystem,
): THREE.BufferGeometry {
  const positions = new Float32Array(entries.length * 3);
  const colors = new Float32Array(entries.length * 3);
  const sizes = new Float32Array(entries.length);
  const alphas = new Float32Array(entries.length);

  for (let index = 0; index < entries.length; index += 1) {
    const entry = entries[index]!;
    const position = coordinateSystem.toRenderPosition(
      entry.position,
      entry.unit,
      'nearby-universe',
    );
    const color = new THREE.Color(entry.color);
    const radiusWeight = THREE.MathUtils.clamp(Math.log10(entry.visualRadius + 1) / 2.5, 0, 1);
    const offset = index * 3;

    positions[offset] = position.x;
    positions[offset + 1] = position.y;
    positions[offset + 2] = position.z;
    colors[offset] = color.r;
    colors[offset + 1] = color.g;
    colors[offset + 2] = color.b;
    sizes[index] = 4.5 + radiusWeight * 5.5;
    alphas[index] = 0.34 + radiusWeight * 0.46;
  }
  const geometry = new THREE.BufferGeometry();

  geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
  geometry.setAttribute('color', new THREE.BufferAttribute(colors, 3));
  geometry.setAttribute('pointSize', new THREE.BufferAttribute(sizes, 1));
  geometry.setAttribute('pointAlpha', new THREE.BufferAttribute(alphas, 1));
  geometry.setDrawRange(0, entries.length);
  if (entries.length > 0) {
    geometry.computeBoundingSphere();
  }

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
      attribute vec3 color;
      uniform float pixelRatio;
      varying float vAlpha;
      varying vec3 vColor;

      void main() {
        vAlpha = pointAlpha;
        vColor = color;
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
        float core = 1.0 - smoothstep(0.0, 0.25, radius);
        vec3 color = mix(vColor, vec3(0.92, 0.96, 1.0), core * 0.72);
        gl_FragColor = vec4(color * radiance, catalogOpacity * vAlpha * halo);
      }
    `,
    transparent: true,
    blending: THREE.AdditiveBlending,
    depthWrite: false,
    toneMapped: false,
  });
}

function smoothstep(minimum: number, maximum: number, value: number): number {
  const progress = THREE.MathUtils.clamp((value - minimum) / (maximum - minimum), 0, 1);

  return progress * progress * (3 - 2 * progress);
}
