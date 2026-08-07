import * as THREE from 'three';
import { NearbyGalaxyOverviewEntry } from '../../data/models/universe.models';
import { CoordinateSystem } from '../coordinates/coordinate-system';
import { dampValue } from '../lod/screen-space-lod';
import { stableMapPriority } from './cosmic-map-policy';

const FADE_IN_START_DISTANCE = 6_200;
const FULL_OPACITY_DISTANCE = 18_000;
const FADE_OUT_START_DISTANCE = 150_000;
const FADE_OUT_END_DISTANCE = 300_000;
const LOCAL_GROUP_MAXIMUM_OPACITY = 0.56;
const DISTANT_MAXIMUM_OPACITY = 0.42;
const OPACITY_NORMALIZATION_START_DISTANCE = 18_000;
const OPACITY_NORMALIZATION_END_DISTANCE = 45_000;
const OPACITY_DAMPING = 4;

export function getNearbyGalaxyOverviewTargetOpacity(cameraDistance: number): number {
  const fadeIn = smoothstep(FADE_IN_START_DISTANCE, FULL_OPACITY_DISTANCE, cameraDistance);
  const fadeOut = 1 - smoothstep(FADE_OUT_START_DISTANCE, FADE_OUT_END_DISTANCE, cameraDistance);
  const normalizedOpacity = smoothstep(
    OPACITY_NORMALIZATION_START_DISTANCE,
    OPACITY_NORMALIZATION_END_DISTANCE,
    cameraDistance,
  );
  const maximumOpacity = THREE.MathUtils.lerp(
    LOCAL_GROUP_MAXIMUM_OPACITY,
    DISTANT_MAXIMUM_OPACITY,
    normalizedOpacity,
  );

  return maximumOpacity * fadeIn * fadeOut;
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
    this.points.userData['appearanceConfidence'] = 'illustrative';
    this.points.userData['visualStyle'] = 'structured-local-volume-galaxy-impostors';
    this.points.userData['sceneRole'] = 'observed-line-of-sight-background';
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
  const galaxyAngles = new Float32Array(entries.length);
  const galaxyAxisRatios = new Float32Array(entries.length);
  const galaxyProfiles = new Float32Array(entries.length);
  const galaxyProminences = new Float32Array(entries.length);
  const galaxySeeds = new Float32Array(entries.length);

  for (let index = 0; index < entries.length; index += 1) {
    const entry = entries[index]!;
    const position = coordinateSystem.toRenderPosition(
      entry.position,
      entry.unit,
      'nearby-universe',
    );
    const color = new THREE.Color(entry.color);
    const radiusWeight = THREE.MathUtils.clamp(Math.log10(entry.visualRadius + 1) / 2.5, 0, 1);
    const prominence = Math.pow(1 - stableMapPriority(`${entry.id}:prominence`), 5);
    const offset = index * 3;

    positions[offset] = position.x;
    positions[offset + 1] = position.y;
    positions[offset + 2] = position.z;
    colors[offset] = color.r;
    colors[offset + 1] = color.g;
    colors[offset + 2] = color.b;
    sizes[index] = 4.6 + radiusWeight * 9 + prominence * 1.8;
    alphas[index] = 0.28 + radiusWeight * 0.36 + prominence * 0.08;
    galaxyAngles[index] = stableMapPriority(`${entry.id}:angle`) * Math.PI * 2;
    galaxyAxisRatios[index] = 0.22 + stableMapPriority(`${entry.id}:axis-ratio`) * 0.74;
    galaxyProfiles[index] = stableMapPriority(`${entry.id}:profile`);
    galaxyProminences[index] = prominence;
    galaxySeeds[index] = stableMapPriority(`${entry.id}:structure`);
  }
  const geometry = new THREE.BufferGeometry();

  geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
  geometry.setAttribute('color', new THREE.BufferAttribute(colors, 3));
  geometry.setAttribute('pointSize', new THREE.BufferAttribute(sizes, 1));
  geometry.setAttribute('pointAlpha', new THREE.BufferAttribute(alphas, 1));
  geometry.setAttribute('galaxyAngle', new THREE.BufferAttribute(galaxyAngles, 1));
  geometry.setAttribute('galaxyAxisRatio', new THREE.BufferAttribute(galaxyAxisRatios, 1));
  geometry.setAttribute('galaxyProfile', new THREE.BufferAttribute(galaxyProfiles, 1));
  geometry.setAttribute('galaxyProminence', new THREE.BufferAttribute(galaxyProminences, 1));
  geometry.setAttribute('galaxySeed', new THREE.BufferAttribute(galaxySeeds, 1));
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
      attribute float galaxyAngle;
      attribute float galaxyAxisRatio;
      attribute float galaxyProfile;
      attribute float galaxyProminence;
      attribute float galaxySeed;
      uniform float pixelRatio;
      varying float vAlpha;
      varying vec3 vColor;
      varying float vGalaxyAngle;
      varying float vGalaxyAxisRatio;
      varying float vGalaxyProfile;
      varying float vGalaxyProminence;
      varying float vGalaxySeed;

      void main() {
        vAlpha = pointAlpha;
        vColor = color;
        vGalaxyAngle = galaxyAngle;
        vGalaxyAxisRatio = galaxyAxisRatio;
        vGalaxyProfile = galaxyProfile;
        vGalaxyProminence = galaxyProminence;
        vGalaxySeed = galaxySeed;
        gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
        float prominenceScale = 1.0 + galaxyProminence * 0.65;
        gl_PointSize = max(1.0, pointSize * prominenceScale * pixelRatio);
      }
    `,
    fragmentShader: `
      uniform float catalogOpacity;
      uniform float radiance;
      varying float vAlpha;
      varying vec3 vColor;
      varying float vGalaxyAngle;
      varying float vGalaxyAxisRatio;
      varying float vGalaxyProfile;
      varying float vGalaxyProminence;
      varying float vGalaxySeed;

      void main() {
        vec2 point = (gl_PointCoord - vec2(0.5)) * 2.0;
        if (length(point) > 1.0) {
          discard;
        }

        float cosine = cos(vGalaxyAngle);
        float sine = sin(vGalaxyAngle);
        vec2 orientedPoint = mat2(cosine, -sine, sine, cosine) * point;
        float radius = length(vec2(orientedPoint.x, orientedPoint.y / vGalaxyAxisRatio));
        if (radius > 1.0) {
          discard;
        }
        float softEdge = 1.0 - smoothstep(0.74, 1.0, radius);
        float polarAngle = atan(orientedPoint.y, orientedPoint.x);
        float spiralArms = 0.5 + 0.5 * cos(
          polarAngle * 2.0 - radius * 10.5 + vGalaxySeed * 6.2831853
        );
        spiralArms = smoothstep(0.48, 0.94, spiralArms);
        float stellarKnots = pow(
          0.5 + 0.5 * sin(
            orientedPoint.x * 41.0 + orientedPoint.y * 29.0 + vGalaxySeed * 17.0
          ),
          8.0
        ) * spiralArms;
        float diskLight = exp(-3.0 * radius) *
          (0.48 + spiralArms * 0.74 + stellarKnots * 0.32);
        float ellipticalLight = exp(-2.15 * pow(max(radius, 0.0001), 0.7));
        float profileMix = smoothstep(0.32, 0.7, vGalaxyProfile);
        float bodyLight = mix(ellipticalLight, diskLight, profileMix);
        float luminousCore = exp(-14.0 * radius) * (1.0 + vGalaxyProminence * 0.72);
        float dustLane = mix(
          1.0,
          0.7 + 0.3 * smoothstep(0.035, 0.16, abs(orientedPoint.y)),
          profileMix * smoothstep(0.25, 0.72, radius)
        );
        float halo = softEdge * (bodyLight * 0.72 * dustLane + luminousCore * 1.28) *
          (1.05 + vGalaxyProminence * 0.2);
        if (halo < 0.015) {
          discard;
        }
        vec3 warmStarlight = vec3(1.0, 0.62, 0.34);
        vec3 coolStarlight = vec3(0.56, 0.76, 1.0);
        vec3 stellarColor = mix(coolStarlight, warmStarlight, vGalaxySeed);
        vec3 color = mix(vColor, stellarColor, 0.66);
        color = mix(color, vec3(1.0, 0.92, 0.8), luminousCore * 0.6);
        float brightness = 0.72 + luminousCore * 0.78 + stellarKnots * 0.28 +
          vGalaxyProminence * 0.1;

        gl_FragColor = vec4(
          color * radiance * brightness,
          catalogOpacity * vAlpha * halo
        );
      }
    `,
    transparent: true,
    blending: THREE.NormalBlending,
    depthWrite: false,
    toneMapped: false,
  });
}

function smoothstep(minimum: number, maximum: number, value: number): number {
  const progress = THREE.MathUtils.clamp((value - minimum) / (maximum - minimum), 0, 1);

  return progress * progress * (3 - 2 * progress);
}
