import * as THREE from 'three';
import { type GraphicQuality } from '../../data/models/universe.models';
import { dampValue } from '../lod/screen-space-lod';
import {
  calculateMilkyWayTransition,
  MILKY_WAY_TRANSITION_START,
} from '../lod/milky-way-transition';

export const MILKY_WAY_ATLAS_URL = '/textures/milky-way-emissive-1024.jpg';

export interface MilkyWayVolumeSample {
  opacity: number;
  scale: number;
}

export interface MilkyWayCinematicProfile {
  readonly parallaxStrength: number;
  readonly dustAbsorption: number;
  readonly glowStrength: number;
  readonly colorGradeStrength: number;
}

export type MilkyWayAtlasStatus = 'idle' | 'loading' | 'ready' | 'failed';
export type MilkyWayAtlasLoader = (url: string) => Promise<THREE.Texture>;

const VOLUME_FADE_START = 2_200;
const VOLUME_FADE_END = 6_500;
const MAXIMUM_VOLUME_OPACITY = 0.92;
const DISC_DIAMETER = 12_400;
const DISC_LAYER_OFFSETS = [0, 82, -82] as const;
const DISC_LAYER_ROTATIONS = [0, 0.014, -0.012] as const;
const DISC_LAYER_STRENGTHS = [1, 0.2, 0.14] as const;
const DISC_LAYER_COUNTS = {
  low: 1,
  medium: 2,
  high: 3,
} as const satisfies Record<GraphicQuality, number>;
const TEXTURE_ANISOTROPY = {
  low: 1,
  medium: 2,
  high: 4,
} as const satisfies Record<GraphicQuality, number>;
const CINEMATIC_PROFILES = {
  low: {
    parallaxStrength: 0.0006,
    dustAbsorption: 0.36,
    glowStrength: 0.025,
    colorGradeStrength: 0.48,
  },
  medium: {
    parallaxStrength: 0.0014,
    dustAbsorption: 0.58,
    glowStrength: 0.06,
    colorGradeStrength: 0.74,
  },
  high: {
    parallaxStrength: 0.0024,
    dustAbsorption: 0.78,
    glowStrength: 0.095,
    colorGradeStrength: 1,
  },
} as const satisfies Record<GraphicQuality, MilkyWayCinematicProfile>;

export function getMilkyWayCinematicProfile(quality: GraphicQuality): MilkyWayCinematicProfile {
  return CINEMATIC_PROFILES[quality];
}

export function createMilkyWayVolumeSample(): MilkyWayVolumeSample {
  return { opacity: 0, scale: 1 };
}

export function sampleMilkyWayVolume(
  cameraDistance: number,
  target: MilkyWayVolumeSample,
): MilkyWayVolumeSample {
  const distance = normalizeDistance(cameraDistance);
  const entryOpacity = smoothstep(VOLUME_FADE_START, VOLUME_FADE_END, distance);
  const transition = calculateMilkyWayTransition(distance);

  target.opacity = MAXIMUM_VOLUME_OPACITY * entryOpacity * transition.detailOpacity;
  target.scale = distance < MILKY_WAY_TRANSITION_START ? 1 : transition.detailScale;

  return target;
}

export class MilkyWayVolume {
  public readonly root = new THREE.Group();

  private readonly sample = createMilkyWayVolumeSample();
  private readonly discGeometry = new THREE.PlaneGeometry(DISC_DIAMETER, DISC_DIAMETER);
  private readonly discMaterials = DISC_LAYER_STRENGTHS.map((strength, index) =>
    createDiscMaterial(strength, index > 0),
  );
  private readonly discLayers = this.discMaterials.map((material, index) =>
    createDiscLayer(this.discGeometry, material, index),
  );
  private readonly bulgeGeometry = new THREE.SphereGeometry(1, 32, 18);
  private readonly bulgeMaterial = createBulgeMaterial();
  private readonly bulge = new THREE.Mesh(this.bulgeGeometry, this.bulgeMaterial);
  private quality: GraphicQuality = 'medium';
  private atlas: THREE.Texture | null = null;
  private atlasPromise: Promise<boolean> | null = null;
  private status: MilkyWayAtlasStatus = 'idle';
  private opacity = 0;
  private scale = 1;
  private disposed = false;

  constructor(private readonly loadAtlas: MilkyWayAtlasLoader = loadMilkyWayAtlas) {
    this.root.name = 'illustrative-milky-way-volume';
    this.root.visible = false;
    this.root.userData['scientificConfidence'] = 'illustrative';
    this.root.userData['visualStructure'] =
      'cinematic-volume-with-view-parallax-and-dust-absorption';
    this.root.userData['structureOrigin'] = 'galactic-center';
    this.root.userData['atlasUrl'] = MILKY_WAY_ATLAS_URL;
    this.root.userData['depthTechnique'] = 'view-dependent-atlas-parallax-and-three-offset-discs';

    this.bulge.name = 'milky-way-volume-bulge';
    this.bulge.scale.set(1_520, 335, 870);
    this.bulge.rotation.y = Math.PI * 0.14;
    this.bulge.renderOrder = 1;
    this.root.add(...this.discLayers, this.bulge);
    this.applyVisibility();
  }

  public get atlasStatus(): MilkyWayAtlasStatus {
    return this.status;
  }

  public get visibleDiscLayerCount(): number {
    return this.discLayers.filter((layer) => layer.visible).length;
  }

  public get drawMeshCount(): number {
    if (!this.root.visible) {
      return 0;
    }

    return this.root.children.filter((child) => child.visible).length;
  }

  public setQuality(quality: GraphicQuality): void {
    this.quality = quality;
    const profile = getMilkyWayCinematicProfile(quality);

    if (this.atlas) {
      this.atlas.anisotropy = TEXTURE_ANISOTROPY[quality];
      this.atlas.needsUpdate = true;
    }
    for (const material of this.discMaterials) {
      applyCinematicProfile(material, profile);
    }
    applyCinematicProfile(this.bulgeMaterial, profile);
    this.root.userData['cinematicQuality'] = quality;
    this.root.userData['cinematicProfile'] = { ...profile };
    this.applyVisibility();
  }

  public async ensureAtlas(): Promise<boolean> {
    if (this.disposed || this.status === 'failed') {
      return false;
    }
    if (this.status === 'ready') {
      return true;
    }
    if (this.atlasPromise) {
      return this.atlasPromise;
    }

    this.status = 'loading';
    this.atlasPromise = this.loadAtlas(MILKY_WAY_ATLAS_URL)
      .then((texture) => this.installAtlas(texture))
      .catch(() => {
        this.status = 'failed';

        return false;
      });

    return this.atlasPromise;
  }

  public update(cameraDistance: number, deltaSeconds: number, galaxyRadiance = 1): void {
    sampleMilkyWayVolume(cameraDistance, this.sample);
    this.opacity = dampValue(this.opacity, this.sample.opacity, 5, deltaSeconds);
    this.scale = dampValue(this.scale, this.sample.scale, 6, deltaSeconds);
    this.root.scale.setScalar(this.scale);

    for (const material of this.discMaterials) {
      material.uniforms['opacity']!.value = this.opacity;
      material.uniforms['galaxyRadiance']!.value = galaxyRadiance;
    }
    this.bulgeMaterial.uniforms['opacity']!.value = this.opacity * 0.54;
    this.bulgeMaterial.uniforms['galaxyRadiance']!.value = galaxyRadiance;
    this.root.visible = this.opacity > 0.004;
    this.applyVisibility();
  }

  public dispose(): void {
    if (this.disposed) {
      return;
    }
    this.disposed = true;
    this.atlas?.dispose();
    this.atlas = null;
    this.discGeometry.dispose();
    this.bulgeGeometry.dispose();
    for (const material of this.discMaterials) {
      material.dispose();
    }
    this.bulgeMaterial.dispose();
    this.root.clear();
  }

  private installAtlas(texture: THREE.Texture): boolean {
    if (this.disposed) {
      texture.dispose();
      this.status = 'failed';

      return false;
    }

    this.atlas = texture;
    texture.colorSpace = THREE.SRGBColorSpace;
    texture.minFilter = THREE.LinearMipmapLinearFilter;
    texture.magFilter = THREE.LinearFilter;
    texture.wrapS = THREE.ClampToEdgeWrapping;
    texture.wrapT = THREE.ClampToEdgeWrapping;
    texture.generateMipmaps = true;
    texture.anisotropy = TEXTURE_ANISOTROPY[this.quality];
    texture.needsUpdate = true;
    for (const material of this.discMaterials) {
      material.uniforms['atlas']!.value = texture;
    }
    this.status = 'ready';
    this.applyVisibility();

    return true;
  }

  private applyVisibility(): void {
    const visibleLayerCount = this.atlas && this.root.visible ? DISC_LAYER_COUNTS[this.quality] : 0;

    for (const [index, layer] of this.discLayers.entries()) {
      layer.visible = index < visibleLayerCount;
    }
    this.bulge.visible = this.root.visible;
  }
}

function createDiscLayer(
  geometry: THREE.PlaneGeometry,
  material: THREE.ShaderMaterial,
  index: number,
): THREE.Mesh<THREE.PlaneGeometry, THREE.ShaderMaterial> {
  const layer = new THREE.Mesh(geometry, material);

  layer.name = `milky-way-volume-disc-${['base', 'upper', 'lower'][index]!}`;
  layer.position.y = DISC_LAYER_OFFSETS[index]!;
  layer.rotation.set(-Math.PI / 2, 0, DISC_LAYER_ROTATIONS[index]!);
  layer.scale.setScalar(index === 0 ? 1 : 0.99);
  layer.renderOrder = index === 0 ? 0 : 2;

  return layer;
}

function createDiscMaterial(strength: number, additive: boolean): THREE.ShaderMaterial {
  const profile = getMilkyWayCinematicProfile('medium');

  return new THREE.ShaderMaterial({
    uniforms: {
      atlas: { value: null },
      opacity: { value: 0 },
      layerStrength: { value: strength },
      galaxyRadiance: { value: 1 },
      parallaxStrength: { value: profile.parallaxStrength },
      dustAbsorption: { value: profile.dustAbsorption },
      glowStrength: { value: profile.glowStrength },
      colorGradeStrength: { value: profile.colorGradeStrength },
    },
    vertexShader: `
      varying vec2 vUv;
      varying vec2 viewParallax;

      void main() {
        vUv = uv;
        vec4 worldPosition = modelMatrix * vec4(position, 1.0);
        vec3 directionToCamera = normalize(cameraPosition - worldPosition.xyz);
        vec3 tangentX = normalize(modelMatrix[0].xyz);
        vec3 tangentY = normalize(modelMatrix[1].xyz);
        vec3 planeNormal = normalize(modelMatrix[2].xyz);
        float viewFacing = max(abs(dot(directionToCamera, planeNormal)), 0.22);
        viewParallax = vec2(
          dot(directionToCamera, tangentX),
          dot(directionToCamera, tangentY)
        ) / viewFacing;
        gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
      }
    `,
    fragmentShader: `
      uniform sampler2D atlas;
      uniform float opacity;
      uniform float layerStrength;
      uniform float galaxyRadiance;
      uniform float parallaxStrength;
      uniform float dustAbsorption;
      uniform float glowStrength;
      uniform float colorGradeStrength;
      varying vec2 vUv;
      varying vec2 viewParallax;

      void main() {
        float radius = length(vUv - 0.5) * 2.0;
        vec2 parallaxOffset = viewParallax * parallaxStrength * mix(0.42, 1.0, radius);
        vec2 frontUv = clamp(vUv + parallaxOffset, vec2(0.001), vec2(0.999));
        vec2 rearUv = clamp(vUv - parallaxOffset * 0.72, vec2(0.001), vec2(0.999));
        vec3 atlasColor = texture2D(atlas, vUv).rgb;
        vec3 frontColor = texture2D(atlas, frontUv).rgb;
        vec3 rearColor = texture2D(atlas, rearUv).rgb;
        vec3 volumeColor = atlasColor * 0.72 + frontColor * 0.18 + rearColor * 0.10;
        float centerLuminance = dot(atlasColor, vec3(0.2126, 0.7152, 0.0722));
        float frontLuminance = dot(frontColor, vec3(0.2126, 0.7152, 0.0722));
        float rearLuminance = dot(rearColor, vec3(0.2126, 0.7152, 0.0722));
        float structureLuminance = max(centerLuminance, max(frontLuminance, rearLuminance));
        float radialMask = 1.0 - smoothstep(0.78, 1.0, radius);
        float stellarMask = smoothstep(0.005, 0.13, structureLuminance);
        float dustLane = smoothstep(0.028, 0.17, max(frontLuminance, rearLuminance))
          * (1.0 - smoothstep(0.018, 0.115, centerLuminance));
        float coreMask = exp(-pow(radius * 2.7, 2.0));
        vec3 coolGrade = vec3(0.73, 0.88, 1.18);
        vec3 warmGrade = vec3(1.18, 0.86, 0.68);
        vec3 grade = mix(coolGrade, warmGrade, pow(coreMask, 0.72));
        vec3 gradedColor = mix(volumeColor, volumeColor * grade, colorGradeStrength * 0.62);
        float gradedLuminance = dot(gradedColor, vec3(0.2126, 0.7152, 0.0722));

        gradedColor = mix(
          vec3(gradedLuminance),
          gradedColor,
          1.0 + colorGradeStrength * 0.16
        );
        gradedColor *= 1.0 - dustLane * dustAbsorption * 0.76;
        gradedColor += grade * pow(max(structureLuminance, 0.0), 0.56)
          * glowStrength * mix(1.0, 0.58, coreMask);
        gradedColor /= vec3(1.0) + gradedColor * mix(0.12, 0.32, coreMask);

        float volumeMask = max(stellarMask, dustLane * 0.46);
        float alpha = opacity * layerStrength * galaxyRadiance * radialMask * volumeMask;

        gl_FragColor = vec4(max(gradedColor, vec3(0.0)), alpha);
        #include <colorspace_fragment>
      }
    `,
    transparent: true,
    depthWrite: false,
    side: THREE.DoubleSide,
    blending: additive ? THREE.AdditiveBlending : THREE.NormalBlending,
    toneMapped: true,
  });
}

function createBulgeMaterial(): THREE.ShaderMaterial {
  const profile = getMilkyWayCinematicProfile('medium');

  return new THREE.ShaderMaterial({
    uniforms: {
      opacity: { value: 0 },
      galaxyRadiance: { value: 1 },
      dustAbsorption: { value: profile.dustAbsorption },
      glowStrength: { value: profile.glowStrength },
      colorGradeStrength: { value: profile.colorGradeStrength },
      warmColor: { value: new THREE.Color(0xffc78f) },
      coolColor: { value: new THREE.Color(0x668bc7) },
    },
    vertexShader: `
      varying vec3 vViewNormal;
      varying vec3 vViewPosition;

      void main() {
        vec4 viewPosition = modelViewMatrix * vec4(position, 1.0);
        vViewNormal = normalize(normalMatrix * normal);
        vViewPosition = viewPosition.xyz;
        gl_Position = projectionMatrix * viewPosition;
      }
    `,
    fragmentShader: `
      uniform float opacity;
      uniform float galaxyRadiance;
      uniform float dustAbsorption;
      uniform float glowStrength;
      uniform float colorGradeStrength;
      uniform vec3 warmColor;
      uniform vec3 coolColor;
      varying vec3 vViewNormal;
      varying vec3 vViewPosition;

      void main() {
        vec3 viewDirection = normalize(-vViewPosition);
        float facing = abs(dot(normalize(vViewNormal), viewDirection));
        float core = pow(facing, 2.4);
        float dustBelt = 1.0 - smoothstep(0.08, 0.62, abs(vViewNormal.y));
        float alpha = opacity * galaxyRadiance * mix(0.018, 0.38 + glowStrength * 0.14, core);
        vec3 color = mix(coolColor, warmColor, pow(core, 0.7));

        color *= 1.0 - dustBelt * dustAbsorption * 0.28;
        color += warmColor * pow(core, 1.8) * glowStrength * 0.72;
        color = mix(vec3(dot(color, vec3(0.2126, 0.7152, 0.0722))), color, 0.86 + colorGradeStrength * 0.14);

        gl_FragColor = vec4(color, alpha);
        #include <colorspace_fragment>
      }
    `,
    transparent: true,
    depthWrite: false,
    side: THREE.DoubleSide,
    blending: THREE.AdditiveBlending,
    toneMapped: true,
  });
}

function applyCinematicProfile(
  material: THREE.ShaderMaterial,
  profile: MilkyWayCinematicProfile,
): void {
  material.uniforms['dustAbsorption']!.value = profile.dustAbsorption;
  material.uniforms['glowStrength']!.value = profile.glowStrength;
  material.uniforms['colorGradeStrength']!.value = profile.colorGradeStrength;
  if (material.uniforms['parallaxStrength']) {
    material.uniforms['parallaxStrength'].value = profile.parallaxStrength;
  }
}

function loadMilkyWayAtlas(url: string): Promise<THREE.Texture> {
  return new THREE.TextureLoader().loadAsync(url);
}

function normalizeDistance(cameraDistance: number): number {
  if (!Number.isFinite(cameraDistance)) {
    return cameraDistance === Number.POSITIVE_INFINITY ? Number.MAX_VALUE : 0;
  }

  return Math.max(0, cameraDistance);
}

function smoothstep(minimum: number, maximum: number, value: number): number {
  const progress = Math.max(0, Math.min(1, (value - minimum) / (maximum - minimum)));

  return progress * progress * (3 - 2 * progress);
}
