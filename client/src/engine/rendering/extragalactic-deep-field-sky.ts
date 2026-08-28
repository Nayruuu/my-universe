import * as THREE from 'three';
import { type GraphicQuality } from '../../data/models/universe.models';

export interface ExtragalacticDeepFieldProfile {
  readonly detailStrength: number;
  readonly chromaStrength: number;
}

const DEEP_FIELD_SKY_RADIUS = 160_000;
const DEEP_FIELD_MAXIMUM_OPACITY = 0.58;
const DEEP_FIELD_INNER_FADE_START = 5_800;
const DEEP_FIELD_INNER_FADE_END = 12_000;
const DEEP_FIELD_OUTER_FADE_START = 45_000;
const DEEP_FIELD_OUTER_FADE_END = 75_000;
const MINIMUM_VISIBLE_OPACITY = 0.004;
const DEEP_FIELD_PROFILES = {
  low: { detailStrength: 0.55, chromaStrength: 0.82 },
  medium: { detailStrength: 0.78, chromaStrength: 0.92 },
  high: { detailStrength: 1, chromaStrength: 1 },
} as const satisfies Record<GraphicQuality, ExtragalacticDeepFieldProfile>;

export function getExtragalacticDeepFieldProfile(
  quality: GraphicQuality,
): ExtragalacticDeepFieldProfile {
  return DEEP_FIELD_PROFILES[quality];
}

/**
 * Illustrative visibility of the unresolved deep field behind externally viewed galaxies. It is
 * fully absent from the Milky Way view and its interior traversal, then appears while multiple
 * galaxies become the active spatial context.
 */
export function calculateExtragalacticDeepFieldOpacity(cameraDistance: number): number {
  if (!Number.isFinite(cameraDistance) || cameraDistance < 0) {
    return 0;
  }
  const innerPresence = smoothstep(
    DEEP_FIELD_INNER_FADE_START,
    DEEP_FIELD_INNER_FADE_END,
    cameraDistance,
  );
  const outerPresence =
    1 - smoothstep(DEEP_FIELD_OUTER_FADE_START, DEEP_FIELD_OUTER_FADE_END, cameraDistance);

  return DEEP_FIELD_MAXIMUM_OPACITY * innerPresence * outerPresence;
}

/**
 * One procedural spherical draw for unresolved extragalactic light behind the extended galaxy
 * impostors. It follows camera translation exactly and is never used as Milky Way interior light.
 */
export class ExtragalacticDeepFieldSky {
  public readonly mesh: THREE.Mesh<THREE.SphereGeometry, THREE.ShaderMaterial>;

  private opacity = 0;

  constructor() {
    const geometry = new THREE.SphereGeometry(DEEP_FIELD_SKY_RADIUS, 48, 24);
    const material = createDeepFieldMaterial(DEEP_FIELD_PROFILES.medium);

    this.mesh = new THREE.Mesh(geometry, material);
    this.mesh.name = 'illustrative-extragalactic-deep-field-sky';
    this.mesh.visible = false;
    this.mesh.frustumCulled = false;
    this.mesh.renderOrder = -100;
    this.mesh.userData['scientificConfidence'] = 'illustrative';
    this.mesh.userData['catalogAssociation'] = 'none';
    this.mesh.userData['sceneRole'] = 'galaxy-scale-unresolved-deep-field-background';
    this.mesh.userData['scaleScope'] = 'external-galaxy-views-only';
    this.mesh.userData['representationTechnique'] = 'single-procedural-spherical-shader-draw';
    this.mesh.userData['observerAnchoring'] = 'camera-centered-celestial-sphere';
    this.mesh.userData['motionModel'] = 'fixed-sky-directions-without-translational-parallax';
    this.mesh.userData['rasterAtlas'] = 'none';
    this.mesh.userData['visualStyle'] =
      'deep-indigo-violet-cosmic-ribbon-with-unresolved-galaxy-grain';
    this.mesh.userData['populationTreatment'] =
      'procedural-illustration-of-unresolved-distant-galaxy-light-not-a-catalogue';
    this.mesh.userData['sphereRadius'] = DEEP_FIELD_SKY_RADIUS;
    this.setQuality('medium');
  }

  public setQuality(quality: GraphicQuality): void {
    const profile = getExtragalacticDeepFieldProfile(quality);

    this.mesh.material.uniforms['detailStrength']!.value = profile.detailStrength;
    this.mesh.material.uniforms['chromaStrength']!.value = profile.chromaStrength;
    this.mesh.userData['quality'] = quality;
    this.mesh.userData['detailStrength'] = profile.detailStrength;
    this.mesh.userData['chromaStrength'] = profile.chromaStrength;
  }

  public setObserverPosition(position: THREE.Vector3): void {
    this.mesh.position.copy(position);
  }

  public update(targetOpacity: number, deltaSeconds: number, radiance: number): void {
    if (deltaSeconds > 0) {
      this.opacity +=
        (THREE.MathUtils.clamp(targetOpacity, 0, 1) - this.opacity) *
        (1 - Math.exp(-5 * deltaSeconds));
    }
    this.mesh.material.uniforms['opacity']!.value = this.opacity;
    this.mesh.material.uniforms['radiance']!.value = THREE.MathUtils.clamp(radiance, 0.5, 1.5);
    this.mesh.visible = this.opacity > MINIMUM_VISIBLE_OPACITY;
    this.mesh.userData['opacity'] = this.opacity;
  }

  public dispose(): void {
    this.mesh.removeFromParent();
    this.mesh.geometry.dispose();
    this.mesh.material.dispose();
  }
}

function createDeepFieldMaterial(profile: ExtragalacticDeepFieldProfile): THREE.ShaderMaterial {
  return new THREE.ShaderMaterial({
    uniforms: {
      opacity: { value: 0 },
      radiance: { value: 1 },
      detailStrength: { value: profile.detailStrength },
      chromaStrength: { value: profile.chromaStrength },
    },
    vertexShader: `
      varying vec3 skyDirection;

      void main() {
        skyDirection = normalize(position);
        gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
      }
    `,
    fragmentShader: `
      uniform float opacity;
      uniform float radiance;
      uniform float detailStrength;
      uniform float chromaStrength;
      varying vec3 skyDirection;

      float flowingNoise(vec3 position) {
        float first = sin(dot(position, vec3(1.31, 2.17, 3.11)));
        float second = sin(
          dot(position, vec3(-2.47, 1.73, 0.91)) + first * 0.82
        );
        float third = cos(
          dot(position, vec3(0.77, -3.31, 2.23)) + second * 0.68
        );

        return 0.5 + 0.5 * (first * 0.45 + second * 0.35 + third * 0.2);
      }

      float layeredStructure(vec3 direction, float scale, vec3 offset) {
        float broad = flowingNoise(direction * scale + offset);
        float middle = flowingNoise(direction * scale * 2.13 + offset.yzx + 3.7);
        float fine = flowingNoise(direction * scale * 4.47 + offset.zxy - 5.2);

        return broad * 0.5 + middle * 0.32 + fine * 0.18;
      }

      float skyHash(vec2 cell) {
        return fract(sin(dot(cell, vec2(127.1, 311.7))) * 43758.5453);
      }

      float unresolvedGalaxyLayer(vec2 skyUv, float density, float threshold) {
        vec2 grid = vec2(density, density * 0.5);
        vec2 cell = floor(skyUv * grid);
        vec2 localPosition = fract(skyUv * grid) - 0.5;
        float seed = skyHash(cell + vec2(17.3, 53.1));
        float angle = skyHash(cell + vec2(71.7, 19.9)) * 6.2831853;
        vec2 axis = vec2(cos(angle), sin(angle));
        vec2 oriented = vec2(
          dot(localPosition, axis),
          dot(localPosition, vec2(-axis.y, axis.x))
        );
        float axisRatio = mix(0.32, 0.9, skyHash(cell + vec2(29.3, 83.1)));
        float radius = length(vec2(oriented.x, oriented.y / axisRatio));
        float sourceRadius = mix(0.1, 0.24, pow(seed, 5.0));
        float core = 1.0 - smoothstep(sourceRadius * 0.2, sourceRadius, radius);

        return core * smoothstep(threshold, 0.998, seed);
      }

      void main() {
        vec3 direction = normalize(skyDirection);
        vec3 ribbonNormal = normalize(vec3(0.24, 0.91, -0.34));
        float longitude = atan(direction.z, direction.x);
        float broadStructure = layeredStructure(direction, 2.4, vec3(4.1, -2.8, 7.3));
        float filamentStructure = layeredStructure(direction, 6.8, vec3(-6.2, 8.7, 1.9));
        float granularStructure = layeredStructure(direction, 14.7, vec3(3.8, 11.1, -9.4));
        float warpedLatitude = dot(direction, ribbonNormal)
          + sin(longitude * 2.0 + 0.72) * 0.052
          + sin(longitude * 5.0 - 1.18) * 0.018 * detailStrength
          + (broadStructure - 0.5) * 0.07;
        float absoluteLatitude = abs(warpedLatitude);
        float broadRibbon = exp(-absoluteLatitude * 3.1);
        float middleRibbon = exp(-absoluteLatitude * 7.8);
        float brightRidge = exp(-absoluteLatitude * 17.0);
        float structureSignal = clamp(
          broadStructure * 0.4 + filamentStructure * 0.38 + granularStructure * 0.22,
          0.0,
          1.0
        );
        float filament = smoothstep(0.42, 0.78, structureSignal) * middleRibbon;
        float cobaltCloud = smoothstep(0.46, 0.78, filamentStructure)
          * broadRibbon;
        float magentaCloud = smoothstep(
          0.5,
          0.82,
          broadStructure * 0.44 + granularStructure * 0.56
        ) * middleRibbon;
        float warmKnot = smoothstep(0.55, 0.82, filamentStructure)
          * brightRidge
          * smoothstep(0.38, 0.72, broadStructure);
        float darkRift = smoothstep(0.44, 0.77, 1.0 - granularStructure)
          * smoothstep(0.36, 0.72, filamentStructure)
          * exp(-abs(warpedLatitude + sin(longitude * 3.0) * 0.012) * 27.0);
        vec2 skyUv = vec2(
          longitude / 6.28318530718 + 0.5,
          asin(clamp(direction.y, -1.0, 1.0)) / 3.14159265359 + 0.5
        );
        float fineGalaxies = unresolvedGalaxyLayer(skyUv, 920.0, 0.86);
        float brightGalaxies = unresolvedGalaxyLayer(
          skyUv + vec2(0.173, 0.291),
          430.0,
          0.94
        );
        vec2 sourceCell = floor(skyUv * vec2(920.0, 460.0));
        float sourceTemperature = skyHash(sourceCell + vec2(5.7, 91.3));

        vec3 deepIndigo = vec3(0.006, 0.012, 0.075);
        vec3 cobalt = vec3(0.025, 0.085, 0.46);
        vec3 violet = vec3(0.29, 0.045, 0.48);
        vec3 magenta = vec3(0.64, 0.05, 0.34);
        vec3 cyan = vec3(0.025, 0.34, 0.58);
        vec3 dustyRose = vec3(0.68, 0.25, 0.31);
        vec3 blueWhite = vec3(0.55, 0.72, 1.0);
        vec3 warmWhite = vec3(1.0, 0.75, 0.52);
        vec3 color = deepIndigo * broadRibbon * (0.8 + broadStructure * 0.65);
        vec3 ribbonColor = mix(cobalt, violet, smoothstep(0.4, 0.76, broadStructure));

        color += ribbonColor
          * broadRibbon
          * (0.08 + filament * 0.32)
          * detailStrength;
        color += cyan * cobaltCloud * (0.08 + granularStructure * 0.16) * detailStrength;
        color += magenta * magentaCloud * 0.24 * detailStrength;
        color += dustyRose * warmKnot * 0.22;
        color *= 1.0 - darkRift * 0.8;
        color += mix(blueWhite, warmWhite, smoothstep(0.68, 0.96, sourceTemperature))
          * fineGalaxies
          * (0.38 + broadRibbon * 0.34);
        color += mix(cyan, warmWhite, sourceTemperature)
          * brightGalaxies
          * (0.46 + broadRibbon * 0.28);

        float luminance = dot(color, vec3(0.2126, 0.7152, 0.0722));
        color = max(
          vec3(0.0),
          mix(vec3(luminance), color, 1.0 + chromaStrength * 0.22)
        );
        float emission = broadRibbon * (0.12 + filament * 0.34)
          + middleRibbon * (magentaCloud * 0.18 + cobaltCloud * 0.12)
          + fineGalaxies * 0.48
          + brightGalaxies * 0.62;
        float alpha = opacity * clamp(emission * 1.26, 0.0, 0.72);

        if (alpha <= 0.001) {
          discard;
        }
        gl_FragColor = vec4(color * radiance * (1.08 + emission * 0.38), alpha);
        #include <colorspace_fragment>
      }
    `,
    side: THREE.BackSide,
    transparent: true,
    blending: THREE.NormalBlending,
    depthTest: false,
    depthWrite: false,
    toneMapped: false,
  });
}

function smoothstep(minimum: number, maximum: number, value: number): number {
  const progress = THREE.MathUtils.clamp((value - minimum) / (maximum - minimum), 0, 1);

  return progress * progress * (3 - 2 * progress);
}
