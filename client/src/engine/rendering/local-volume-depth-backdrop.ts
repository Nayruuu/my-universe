import * as THREE from 'three';
import { GraphicQuality } from '../../data/models/universe.models';
import { dampValue } from '../lod/screen-space-lod';
import { CosmicGroupCatalogRegistry } from '../objects/cosmic-group-catalog-registry';
import { stableMapPriority } from './cosmic-map-policy';

const FADE_IN_START_DISTANCE = 5_800;
const FULL_OPACITY_DISTANCE = 9_500;
const FADE_OUT_START_DISTANCE = 22_000;
const FADE_OUT_END_DISTANCE = 55_000;
const MAXIMUM_OPACITY = 0.4;
const OPACITY_DAMPING = 4;
const DEPTH_SHELL_INNER_RADIUS = 24_000;
const DEPTH_SHELL_OUTER_RADIUS = 56_000;
const QUALITY_SAMPLE_FRACTIONS = {
  low: 0.1,
  medium: 0.24,
  high: 0.44,
} as const satisfies Record<GraphicQuality, number>;

interface DepthRecord {
  readonly catalogIndex: number;
  readonly priority: number;
}

export function getLocalVolumeDepthBackdropOpacity(cameraDistance: number): number {
  const fadeIn = smoothstep(FADE_IN_START_DISTANCE, FULL_OPACITY_DISTANCE, cameraDistance);
  const fadeOut = 1 - smoothstep(FADE_OUT_START_DISTANCE, FADE_OUT_END_DISTANCE, cameraDistance);

  return MAXIMUM_OPACITY * fadeIn * fadeOut;
}

export function projectCosmicGroupToLocalDepthShell(
  x: number,
  y: number,
  z: number,
  distanceProgress: number,
  target: THREE.Vector3,
): THREE.Vector3 {
  const shellProgress = Math.sqrt(THREE.MathUtils.clamp(distanceProgress, 0, 1));
  const radius = THREE.MathUtils.lerp(
    DEPTH_SHELL_INNER_RADIUS,
    DEPTH_SHELL_OUTER_RADIUS,
    shellProgress,
  );

  return target.set(x, y, z).normalize().multiplyScalar(radius);
}

export class LocalVolumeDepthBackdrop {
  public readonly points: THREE.Points<THREE.BufferGeometry, THREE.ShaderMaterial>;

  private enabled = true;
  private opacity = 0;
  private sampleCount = 0;

  constructor(
    private readonly registry: CosmicGroupCatalogRegistry,
    quality: GraphicQuality,
  ) {
    this.points = new THREE.Points(createGeometry(registry), createMaterial());
    this.points.name = 'calculated-local-volume-depth-backdrop';
    this.points.visible = false;
    this.points.frustumCulled = false;
    this.points.renderOrder = 0;
    this.points.userData['catalogCount'] = registry.catalog.count;
    this.points.userData['activeCount'] = 0;
    this.points.userData['scientificConfidence'] = 'calculated';
    this.points.userData['appearanceConfidence'] = 'illustrative';
    this.points.userData['sceneRole'] = 'non-interactive-deep-sky-background';
    this.points.userData['depthProjection'] = 'catalog-direction-preserving-radial-compression';
    this.points.userData['visualProfile'] = 'inclined-multilobed-unresolved-group-light';
    this.points.userData['depthShellRadius'] = [DEPTH_SHELL_INNER_RADIUS, DEPTH_SHELL_OUTER_RADIUS];
    this.points.userData['source'] = 'Cosmicflows-4 · Tully et al. (2023)';
    this.setQuality(quality);
  }

  public setQuality(quality: GraphicQuality): void {
    const count = this.registry.catalog.count;

    this.sampleCount =
      count === 0 ? 0 : Math.max(1, Math.ceil(count * QUALITY_SAMPLE_FRACTIONS[quality]));
    this.points.geometry.setDrawRange(0, this.sampleCount);
    this.refreshVisibility();
  }

  public setEnabled(enabled: boolean): void {
    this.enabled = enabled;
    this.refreshVisibility();
  }

  public setPixelRatio(pixelRatio: number): void {
    this.points.material.uniforms['pixelRatio']!.value = THREE.MathUtils.clamp(
      pixelRatio,
      0.5,
      1.5,
    );
  }

  public setPhotographicRadiance(radiance: number): void {
    this.points.material.uniforms['radiance']!.value = THREE.MathUtils.clamp(radiance, 0.5, 1.5);
  }

  public updateDistance(cameraDistance: number, deltaSeconds: number): void {
    this.opacity = dampValue(
      this.opacity,
      getLocalVolumeDepthBackdropOpacity(cameraDistance),
      OPACITY_DAMPING,
      deltaSeconds,
    );
    this.points.material.uniforms['opacity']!.value = this.opacity;
    this.refreshVisibility();
  }

  public get visibleCount(): number {
    return this.points.visible ? this.sampleCount : 0;
  }

  public dispose(): void {
    this.points.geometry.dispose();
    this.points.material.dispose();
  }

  private refreshVisibility(): void {
    this.points.visible = this.enabled && this.sampleCount > 0 && this.opacity > 0.004;
    this.points.userData['activeCount'] = this.visibleCount;
  }
}

function createGeometry(registry: CosmicGroupCatalogRegistry): THREE.BufferGeometry {
  const catalog = registry.catalog;
  const records: DepthRecord[] = registry.objectIds.map((objectId, catalogIndex) => ({
    catalogIndex,
    priority: stableMapPriority(`${objectId}:local-depth`),
  }));

  records.sort(
    (left, right) => left.priority - right.priority || left.catalogIndex - right.catalogIndex,
  );
  const positions = new Float32Array(catalog.count * 3);
  const colors = new Float32Array(catalog.count * 3);
  const sizes = new Float32Array(catalog.count);
  const alphas = new Float32Array(catalog.count);
  const orientations = new Float32Array(catalog.count);
  const axisRatios = new Float32Array(catalog.count);
  const profiles = new Float32Array(catalog.count);
  const prominences = new Float32Array(catalog.count);
  const seeds = new Float32Array(catalog.count);
  const nearColor = new THREE.Color(0xffd3a0);
  const farColor = new THREE.Color(0x9aafff);
  const pointColor = new THREE.Color();
  const projectedPosition = new THREE.Vector3();
  const distanceRange = Math.max(catalog.maximumDistanceMpc - catalog.minimumDistanceMpc, 1);

  for (let renderIndex = 0; renderIndex < records.length; renderIndex += 1) {
    const record = records[renderIndex]!;
    const sourceOffset = record.catalogIndex * 3;
    const renderOffset = renderIndex * 3;
    const objectId = registry.objectIds[record.catalogIndex]!;
    const appearanceSeed = stableMapPriority(`${objectId}:local-depth-appearance`);
    const prominence = Math.pow(1 - appearanceSeed, 5);
    const distanceProgress = THREE.MathUtils.clamp(
      (catalog.distancesMpc[record.catalogIndex]! - catalog.minimumDistanceMpc) / distanceRange,
      0,
      1,
    );

    projectCosmicGroupToLocalDepthShell(
      registry.renderPositions[sourceOffset]!,
      registry.renderPositions[sourceOffset + 1]!,
      registry.renderPositions[sourceOffset + 2]!,
      distanceProgress,
      projectedPosition,
    );
    projectedPosition.toArray(positions, renderOffset);
    pointColor.copy(nearColor).lerp(farColor, distanceProgress);
    colors[renderOffset] = pointColor.r;
    colors[renderOffset + 1] = pointColor.g;
    colors[renderOffset + 2] = pointColor.b;
    sizes[renderIndex] = 3.1 + prominence * 6.2 + appearanceSeed * 1.1;
    alphas[renderIndex] = 0.3 + prominence * 0.48;
    orientations[renderIndex] = stableMapPriority(`${objectId}:local-depth-angle`) * Math.PI * 2;
    axisRatios[renderIndex] = 0.3 + stableMapPriority(`${objectId}:local-depth-axis-ratio`) * 0.62;
    profiles[renderIndex] = stableMapPriority(`${objectId}:local-depth-profile`);
    prominences[renderIndex] = prominence;
    seeds[renderIndex] = appearanceSeed;
  }
  const geometry = new THREE.BufferGeometry();

  geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
  geometry.setAttribute('pointColor', new THREE.BufferAttribute(colors, 3));
  geometry.setAttribute('pointSize', new THREE.BufferAttribute(sizes, 1));
  geometry.setAttribute('pointAlpha', new THREE.BufferAttribute(alphas, 1));
  geometry.setAttribute('groupOrientation', new THREE.BufferAttribute(orientations, 1));
  geometry.setAttribute('groupAxisRatio', new THREE.BufferAttribute(axisRatios, 1));
  geometry.setAttribute('groupProfile', new THREE.BufferAttribute(profiles, 1));
  geometry.setAttribute('groupProminence', new THREE.BufferAttribute(prominences, 1));
  geometry.setAttribute('groupSeed', new THREE.BufferAttribute(seeds, 1));
  geometry.setDrawRange(0, 0);
  if (catalog.count > 0) {
    geometry.computeBoundingSphere();
  }

  return geometry;
}

function createMaterial(): THREE.ShaderMaterial {
  return new THREE.ShaderMaterial({
    uniforms: {
      opacity: { value: 0 },
      pixelRatio: { value: 1 },
      radiance: { value: 1 },
    },
    vertexShader: `
      attribute vec3 pointColor;
      attribute float pointSize;
      attribute float pointAlpha;
      attribute float groupOrientation;
      attribute float groupAxisRatio;
      attribute float groupProfile;
      attribute float groupProminence;
      attribute float groupSeed;
      uniform float pixelRatio;
      varying vec3 vColor;
      varying float vAlpha;
      varying vec2 vOrientation;
      varying float vAxisRatio;
      varying float vProfile;
      varying float vProminence;
      varying float vSeed;

      void main() {
        vColor = pointColor;
        vAlpha = pointAlpha;
        vOrientation = vec2(cos(groupOrientation), sin(groupOrientation));
        vAxisRatio = groupAxisRatio;
        vProfile = groupProfile;
        vProminence = groupProminence;
        vSeed = groupSeed;
        gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
        gl_PointSize = max(2.4, pointSize * pixelRatio);
      }
    `,
    fragmentShader: `
      uniform float opacity;
      uniform float radiance;
      varying vec3 vColor;
      varying float vAlpha;
      varying vec2 vOrientation;
      varying float vAxisRatio;
      varying float vProfile;
      varying float vProminence;
      varying float vSeed;

      void main() {
        vec2 point = (gl_PointCoord - vec2(0.5)) * 2.0;
        vec2 orientedPoint = mat2(
          vOrientation.x,
          -vOrientation.y,
          vOrientation.y,
          vOrientation.x
        ) * point;
        float radius = length(vec2(orientedPoint.x, orientedPoint.y / vAxisRatio));
        if (radius > 1.0) {
          discard;
        }
        float softEdge = 1.0 - smoothstep(0.68, 1.0, radius);
        float diffuseLight = exp(-2.8 * pow(max(radius, 0.0001), 0.76));
        float core = exp(-12.0 * radius) * (0.5 + vProminence * 0.7);
        vec2 lobeOffset = vec2(mix(0.2, 0.38, vSeed), mix(-0.14, 0.14, vProfile));
        float secondaryLobe = exp(-13.0 * length(orientedPoint - lobeOffset));
        float groupLight = softEdge *
          (diffuseLight * 0.76 + core * 0.92 + secondaryLobe * (0.14 + vProfile * 0.2));
        if (groupLight < 0.012) {
          discard;
        }
        vec3 coreColor = vec3(1.0, 0.91, 0.76);
        vec3 color = mix(vColor, coreColor, core * 0.52);

        gl_FragColor = vec4(
          color * radiance * (0.74 + groupLight * 0.48),
          opacity * vAlpha * groupLight
        );
        #include <colorspace_fragment>
      }
    `,
    transparent: true,
    blending: THREE.NormalBlending,
    depthTest: true,
    depthWrite: false,
    toneMapped: false,
  });
}

function smoothstep(minimum: number, maximum: number, value: number): number {
  const progress = THREE.MathUtils.clamp((value - minimum) / (maximum - minimum), 0, 1);

  return progress * progress * (3 - 2 * progress);
}
